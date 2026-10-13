import { ok, fail, store, writeBlob, isAdmin } from './_shared.js'

/* 一次性迁移接口：把 Blobs 里的旧数据补上新字段，跑完就删。

   为什么需要：
   重新上传文件夹只会更新代码，Blobs 里的数据还是老的。
   老数据缺 theme（品牌色）、hero.banners、分类图字段，
   前台新代码读不到，所以改版在页面上看不出效果。

   这里做的是「合并」不是「覆盖」：
   老数据里有值的地方一律保留，只补缺失的字段。
   这样后台已经传过的图片、已经改过的文案都不会丢。

   用法：POST /api/migrate   带 X-Admin-Token 头 */

import seedSite from '../../data/site.json'
import seedCats from '../../data/categories.json'
import seedProducts from '../../data/products.json'

/* 老值优先：只有老值是空的时候才用种子的值兜底。
   种子也没有值时返回空串，不要留undefined —— 前端读 undefined 会拿到
   "undefined" 字样，JSON 接口里也不好排查。 */
function keep(oldV, newV) {
  const empty = (v) =>
    v === undefined || v === null || v === '' ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === 'object' && !Array.isArray(v) &&
      v !== null && Object.keys(v).length === 0)

  if (!empty(oldV)) return oldV
  return empty(newV) ? '' : newV
}

/* 号码清洗：跟前台 site.js 的 waClean、后台 admin.js 的 waCleanAdmin 是同一套逻辑，
   三处必须一致，不然后台存的是干净的、迁移完又变脏。

   wa.me 官方要求斜杠后面只能是「国家码 + 号码」的纯数字，不能带 + 、空格、
   横线，也不能带 00 这个国际拨号前缀（官方错误示例就是 wa.me/+001-(XXX)…）。
   老数据里很可能已经存了带 00 或带 + 的号，迁移时顺手洗干净。 */
function waCleanNum(raw) {
  return String(raw == null ? '' : raw).replace(/\D/g, '').replace(/^0+/, '');
}

/* 把老对象和新种子合并：老的有值就老优先，新字段补上 */
function merge(oldObj, seedObj) {  const out = Object.assign({}, seedObj, oldObj || {})
  for (const k of Object.keys(oldObj || {})) {
    const o = oldObj[k]
    const s = seedObj ? seedObj[k] : undefined
    /* 嵌套一层够了：theme、hero、brand 都是浅对象 */
    if (o && typeof o === 'object' && !Array.isArray(o) &&
        s && typeof s === 'object' && !Array.isArray(s)) {
      out[k] = Object.assign({}, s, o)
    } else {
      out[k] = o
    }
  }
  return out
}

export default async (req) => {
  if (req.method !== 'POST') return fail(405, 'POST only')
  if (!isAdmin(req)) return fail(401, 'غير مصرح')

  const changed = {}

  /* ---- site：补 theme、hero.banners、imageAr 等新字段 ---- */
  try {
    const old = await store().get('site', { type: 'json' })
    const merged = merge(old || {}, seedSite)
    /* 老数据没有 theme，兜底给祖母绿+鎏金，跟本地一致 */
    merged.theme = keep(old?.theme, seedSite.theme)
    merged.hero = merge(old?.hero, seedSite.hero)
    merged.hero.banners = (keep(old?.hero?.banners, seedSite.hero.banners) || []).map(b => {
      /* 老 banner 只有 image/titleAr/subAr，补上链接两个字段。
         前台 bannerHref() 缺字段时会当'none' 处理，但显式写出来
         后台打开就能直接看到下拉框的值，不用靠猜。 */
      return Object.assign({ linkType: 'none', linkTo: '' }, b)
    })
    /* stats 同理，老数据可能是数组也可能压根没有 */
    merged.stats = (Array.isArray(old?.stats) ? old.stats : []).map(s => ({
      value: s.value || '',
      labelAr: s.labelAr || '',
    }))
    merged.dataVersion = seedSite.dataVersion

    /* ---- WhatsApp：老数据只有单号 number + defaultMessageAr ----
       r21 起前台读的是 nums 数组 + map（哪个位置用哪个号）。
       不迁的话老站迁上来之后，六个位置的 WhatsApp 按钮会全空。

       迁移规则：
         nums 为空 → 把老的 number 包成一个 nums[0]，id 固定 'general'
         nums 有几条 → 每条补齐 id / nameAr / number / msgAr
         map 为空 → 六个位置全指到 nums[0]
         map 里有的位置 → 指向的 id 如果不存在（号码被删过），拉回 nums[0]
         off 是数组就用老值，不是数组就用空数组（前台 .includes 会抛错） */
    const WA_PLACES = ['waFab', 'waNav', 'waDrawer', 'waProduct', 'waContactBtn', 'waFoot']
    const oldWa = old?.whatsapp || {}
    const seedWa = seedSite.whatsapp || {}
    const srcNums = Array.isArray(oldWa.nums) && oldWa.nums.length
      ? oldWa.nums
      : Array.isArray(seedWa.nums) && seedWa.nums.length
        ? seedWa.nums
        : (oldWa.number || seedWa.number
            ? [{
                id: 'general',
                nameAr: 'استفسار عام',
                number: oldWa.number || seedWa.number,
                msgAr: oldWa.defaultMessageAr || seedWa.defaultMessageAr || '',
              }]
            : [])
    merged.whatsapp = {
      /* 这两个老字段留着：后台还有别的地方在读，别删 */
      number: waCleanNum(oldWa.number || seedWa.number || (srcNums[0] && srcNums[0].number)),
      defaultMessageAr: (oldWa.defaultMessageAr || seedWa.defaultMessageAr || ''),
      nums: srcNums.map((n, k) => ({
        id: n.id || ('n' + (k + 1)),
        nameAr: n.nameAr || '',
        number: waCleanNum(n.number),
        msgAr: n.msgAr || oldWa.defaultMessageAr || seedWa.defaultMessageAr || '',
      })),
      map: {},
      off: Array.isArray(oldWa.off) ? oldWa.off : [],
    }
    const firstId = merged.whatsapp.nums[0] ? merged.whatsapp.nums[0].id : ''
    const oldMap = (oldWa.map && typeof oldWa.map === 'object') ? oldWa.map : {}
    WA_PLACES.forEach(p => {
      const want = oldMap[p] || (seedWa.map && seedWa.map[p]) || firstId
      /* 指向的号码已经被删了 → 拉回第一个，不然前台 waLink 会返回空 */
      merged.whatsapp.map[p] = merged.whatsapp.nums.some(n => n.id === want) ? want : firstId
    })

    /* ---- footer：r21 起「快速链接」「联系」两组可以在后台自己配 ----
       老数据没有这两组 → 用种子兜底（种子是空数组，前台会自动生成）。
       已经配过的 → 原样留着，一个字都不动。 */
    const oldFt = (old?.footer && typeof old.footer === 'object') ? old.footer : {}
    const seedFt = seedSite.footer || {}
    merged.footer = {
      quickTitleAr: keep(oldFt.quickTitleAr, seedFt.quickTitleAr),
      contactTitleAr: keep(oldFt.contactTitleAr, seedFt.contactTitleAr),
      quickLinks: (Array.isArray(oldFt.quickLinks) && oldFt.quickLinks.length)
        ? oldFt.quickLinks : (seedFt.quickLinks || []),
      contactLinks: (Array.isArray(oldFt.contactLinks) && oldFt.contactLinks.length)
        ? oldFt.contactLinks : (seedFt.contactLinks || []),
    }

    /* ---- social：七个渠道，填链接才显示 ----
       老的可能有部分渠道，老数据优先，留下的空串照样留着（后台能看到「没填」）。 */
    const oldSo = (old?.social && typeof old.social === 'object') ? old.social : {}
    const seedSo = seedSite.social || {}
    const CH = ['instagram', 'facebook', 'linkedin', 'tiktok', 'snapchat', 'x', 'telegram']
    merged.social = {}
    CH.forEach(k => {
      merged.social[k] = (typeof oldSo[k] === 'string' && oldSo[k])
        ? oldSo[k] : (seedSo[k] || '')
    })

    await writeBlob('site', merged)
    changed.site = Object.keys(merged).join(',')
  } catch (e) {
    changed.site = 'FAIL: ' + e.message
  }

  /* ---- categories：补 image / imageAr / descAr ---- */
  try {
    const old = await store().get('categories', { type: 'json' })
    const cats = (old?.categories || seedCats.categories).map(c => {
      const s = (seedCats.categories || []).find(x => x.id === c.id) || {}
      /* image 一定要 keep：后台传过的图不能被种子空值冲掉 */
      return Object.assign({}, s, c, {
        image: keep(c.image, s.image),
        imageAr: keep(c.imageAr, s.imageAr),
      })
    })
    const secs = (old?.sectors || seedCats.sectors).map(c => {
      const s = (seedCats.sectors || []).find(x => x.id === c.id) || {}
      return Object.assign({}, s, c, {
        image: keep(c.image, s.image),
        imageAr: keep(c.imageAr, s.imageAr),
      })
    })
    /* materials 是第三个筛选维度（材料）。
       老规矩：老数据有值就保留（后台传过的图、改过的名都不丢），
       只补缺失的字段。

       ⚠️ 这里必须用「种子为准 + 老数据打补丁」，不能反过来。
       原来写的是 (old?.materials || seedCats.materials)，意思是
       「线上已经建过材料表就完全用线上的」—— 结果这轮新加的
       foil / pe / corrugated 三种永远补不进去，
       后台想用就得手动敲三遍。老数据没建的表才用种子兜底。 */
    const oldMats = old?.materials || [];
    const mats = (seedCats.materials || []).map(s => {
      const c = oldMats.find(x => x.id === s.id) || {};   /* 线上同id 的那条 */
      return Object.assign({}, s, c, {
        image: keep(c.image, s.image),
        imageAr: keep(c.imageAr, s.imageAr),
      })
    });
    /* 后台自己加的材料（种子里没有的）也得留住，别被这次迁移冲掉 */
    oldMats.filter(c => !(seedCats.materials || []).some(s => s.id === c.id))
      .forEach(c => mats.push(c));
    const out = Object.assign({}, seedCats, old || {}, { categories: cats, sectors: secs, materials: mats })
    /* ui 必须单独合。
       上面那行 Object.assign 里 old.ui 会整个盖掉 seedCats.ui，
       改版后新加的文案（新板块标题之类）就补不进去，
       前台读到 undefined，标题会是一片空白。 */
    out.ui = Object.assign({}, seedCats.ui || {}, old?.ui || {})
    await writeBlob('categories', out)
    changed.categories = cats.length + ' 分类 / ' + secs.length + ' 行业 / ' + mats.length + ' خامة'
    changed.ui = Object.keys(out.ui).length + ' 条文案'
  } catch (e) {
    changed.categories = 'FAIL: ' + e.message
  }

  /* ---- products：只补新字段，不碰图片和已发布状态 ---- */
  try {
    const old = await store().get('products', { type: 'json' })
    const list = (old?.products || seedProducts.products).map(p => {
      const s = (seedProducts.products || []).find(x => x.id === p.id) || {}
      const merged = Object.assign({}, s, p, {
        /* 图片和标签都 keep —— 这些是后台攒出来的 */
        images: keep(p.images, s.images),
        imageLabelsAr: keep(p.imageLabelsAr, s.imageLabelsAr),
      })
      /* materialIds 是材料维度的归属数组。保证它一定是数组 ——
         存成 null 或对象的话，前台 .includes() 会直接抛错把整页搞白。 */
      if (!Array.isArray(merged.materialIds)) {
        merged.materialIds = Array.isArray(s.materialIds) ? s.materialIds : []
      }
      return merged
    })
    await writeBlob('products', { products: list })
    changed.products = list.length + ' 个'
  } catch (e) {
    changed.products = 'FAIL: ' + e.message
  }

  return ok({ migrated: changed, note: '已合并，保留原有数据' })
}