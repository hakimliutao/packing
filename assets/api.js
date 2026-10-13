/* ==========================================================================
   api.js — 数据访问层
   --------------------------------------------------------------------------
   全站唯一读写数据的地方。

   两种模式：
   线上模式（默认）  —— 数据存 Netlify Blobs，任何电脑打开网址都能加产品
   本地模式          —— 数据存浏览器本地，断了网也能用

   切换方法：改下面这一行
   ========================================================================== */

/* 线上模式：接了 Netlify 函数就用这个 */
const LOCAL_MODE = false;

/* ------------------------------------------------------------------
   线上模式：走 Netlify Functions + Blobs
   ------------------------------------------------------------------ */

/* 后台身份令牌。配了 Netlify 环境变量 ADMIN_TOKEN 就填这里，
   没配就留空（靠 Netlify 的整站密码保护）。 */
const ADMIN_TOKEN = '';

/* 站点根地址。页面在根目录、后台在 admin/ 子目录，用绝对路径保证两边都能取到。 */
const BASE = window.AR_BASE = new URL('../', document.currentScript ? document.currentScript.src : location.href).href;

function adminHeaders(extra) {
  const h = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
  const t = localStorage.getItem('ar_admin_token');
  if (t) h['X-Admin-Token'] = t;
  return h;
}
window.AR_ADMIN_HEADERS = adminHeaders;   /* 后台上传图片时要用 */

let _cache = {};
/* 分类数据单独留一份引用 —— matchMaterial 要在getProducts 里查材料的阿语名，
   那时可能CTX 还没建好（api.js 不知道 site.js 的存在）。 */
let _taxCache = null;
function setTaxCache(tax) { _taxCache = tax || null; }
window.matchMaterial = matchMaterial;
window.setTaxCache = setTaxCache;

async function apiGet(name) {
  if (_cache[name]) return _cache[name];
  const res = await fetch(BASE + 'api/' + name, { headers: adminHeaders() });
  if (!res.ok) throw new Error('API ' + name + ' failed: ' + res.status);
  const j = await res.json();
  if (j.ok === false) throw new Error(j.error || 'api error');
  _cache[name] = j.data;
  return _cache[name];
}

async function apiPut(name, payload) {
  const res = await fetch(BASE + 'api/' + name, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }
  _cache[name] = null;
  const j = await res.json();
  return j.data;
}

async function getSite()      { return apiGet('site'); }
async function getTaxonomy()  { return apiGet('categories'); }
async function getProductsRaw() {
  const d = await apiGet('products');
  return d.products || [];
}
async function saveProducts(list) { return apiPut('products', { products: list }); }
async function saveTaxonomy(tax)  { return apiPut('categories', tax); }
async function saveSite(site)      { return apiPut('site', site); }

/* ------------------------------------------------------------------
   以下是本地模式 + 公共部分，两种模式都用
   ------------------------------------------------------------------ */

/* 本地模式的数据文件位置 */
const DATA_BASE = BASE + 'data/';
let _seeded = false;

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem('ar_' + key) || 'null'); }
  catch (e) { return null; }
}
function writeLocal(key, val) {
  localStorage.setItem('ar_' + key, JSON.stringify(val));
  return val;
}

async function loadJSON(name) {
  if (_cache[name]) return _cache[name];
  const res = await fetch(DATA_BASE + name + '.json?t=' + Date.now());
  if (!res.ok) throw new Error('تعذّر تحميل ' + name + '.json');
  _cache[name] = await res.json();
  return _cache[name];
}

async function ensureSeeded() {
  if (!LOCAL_MODE || _seeded) return;
  _seeded = true;
  const [p, c, s] = await Promise.all([
    loadJSON('products'), loadJSON('categories'), loadJSON('site')
  ]);
  if (!readLocal('products')) writeLocal('products', p);

  const sync = (key, fresh) => {
    const cur = readLocal(key);
    if (!cur) { writeLocal(key, fresh); return; }
    const curV = cur.dataVersion, newV = fresh.dataVersion;
    if (newV && newV !== curV) writeLocal(key, fresh);
  };
  sync('categories', c);
  sync('site', s);
}

/* 按当前模式读取 */
async function readData(name) {
  if (!LOCAL_MODE) return apiGet(name);
  await ensureSeeded();
  const key = name === 'site' ? 'site' : name;
  return readLocal(key) || loadJSON(name);
}

async function writeData(name, val) {
  if (!LOCAL_MODE) return apiPut(name, val);
  _cache[name] = null;
  writeLocal(name, val);
}

/* 老产品没填 materialIds（改版前传的那批），退回用自由文本 materialAr 模糊匹配。
   用阿语名比对，因为后台展示给用户看的是阿语名，不是 id。
   例：材料「ورق كرافت」的阿语名是「ورق كرافت」，
       老产品 specs.materialAr 写「ورق كرافت فود غذائي」也能匹配上。 */
function matchMaterial(p, matId) {
  if (!matId) return true;
  if ((p.materialIds || []).includes(matId)) return true;
  const tax = _taxCache;
  const m = (tax?.materials || []).find(x => x.id === matId);
  if (!m) return false;
  const keys = [m.nameAr, m.nameZh, m.nameAr + ' '].filter(Boolean);
  const hay = [p.specs && p.specs.materialAr, p.materialAr,
               p.custom && (p.custom.materialsAr || []).join(' ')]
              .filter(Boolean).join(' ');
  const hn = hay.toLowerCase();
  return keys.some(k => hn.includes(String(k).toLowerCase()));
}

/* 产品列表，按条件过滤。
   三个分类维度是并列的（不是互斥的三选一）：
     cat  具体产品 —— 杯子 / 袋子 / 盒子…
     sec  使用场景 —— 咖啡店 / 餐厅 / 酒店…
     mat  材料     —— 牛皮纸 / PET / 无纺布…
   老数据没有 materialIds，getProducts 会退回到读 specs.materialAr 做模糊匹配，
   保证改版前传的产品也筛得出来。 */
async function getProducts(opts = {}) {
  let list = await getProductsRaw();
  if (!opts.includeUnpublished) list = list.filter(p => p.published !== false);
  if (opts.categoryId) list = list.filter(p => p.categoryId === opts.categoryId);
  if (opts.sectorId) list = list.filter(p => (p.sectorIds || []).includes(opts.sectorId));
  if (opts.materialId) list = list.filter(p => matchMaterial(p, opts.materialId));
  /* 多个材料同时选中 = 取交集（同时满足这两种材料的产品）。
     选一个的话跟普通筛选一样；选三个以上基本筛不出东西，
     所以前台最多让选两个，够用且不会给用户一个空页面。 */
  if (Array.isArray(opts.materialIds)) {
    if (opts.materialIds.length > 1) {
      list = list.filter(p => opts.materialIds.every(m => matchMaterial(p, m)));
    } else if (opts.materialIds.length === 1) {
      list = list.filter(p => matchMaterial(p, opts.materialIds[0]));
    }
  }
  if (opts.featuredOnly) list = list.filter(p => p.featured);
  list.sort((a, b) => (a.sort || 99) - (b.sort || 99));

  /* 新品：
     有addedAt 的按日期倒序，没日期的（改版前的老数据）排在后面按 sort 倒序。
     这样后台还没填日期时，区块也有东西能显示 —— sort 本来就是
     「越晚加的越大」，用它当兜底比只认日期更符合直觉。
     全都没有日期时才算真的没有新品。 */
  if (opts.newOnly) {
    list.sort((a, b) => {
      const da = addedAtOf(a), db = addedAtOf(b);
      if (da && db) {
        const d = new Date(db) - new Date(da);
        if (d) return d;
      } else if (da) return -1;    /* 有日期的排前面 */
      else if (db) return 1;
      /* 同为无日期：sort 大的在前 */
      return (b.sort || 99) - (a.sort || 99);
    });
  }
  return list;
}

/* 上架日期：后台填的 addedAt 优先，其次其他时间字段，都没有就空 */
function addedAtOf(p) {
  if (p.addedAt) return String(p.addedAt);
  const t = p.createdAt || p.updatedAt;
  if (t) return String(t);
  return '';
}
/* 新品徽章：上架 30 天内的算「新」。没日期的不显示徽章，
   否则老产品会集体挂「新」标签。 */
function isNewish(p, days) {
  const s = addedAtOf(p);
  if (!s) return false;
  const t = new Date(s).getTime();
  if (isNaN(t)) return false;
  return Date.now() - t < (days || 30) * 86400000;
}
window.addedAtOf = addedAtOf;
window.isNewish = isNewish;

/* 全部产品（只读），菜单里要数每个分类有多少产品时会用到 */
let _allP = null;
async function allProducts() {
  if (!_allP) _allP = getProductsRaw().catch(e => { _allP = null; throw e; });
  return _allP;
}
window.allProducts = allProducts;

async function getProduct(id) {
  const list = await getProductsRaw();
  return list.find(p => p.id === id) || null;
}

/* 供「重置数据」按钮用：线上无法真的重置，只能清本地缓存 */
function resetLocal() {
  ['products', 'categories', 'site'].forEach(k => localStorage.removeItem('ar_' + k));
  _cache = {};
  _seeded = false;
}

/* 后台设置令牌 */
function setAdminToken(t) {
  if (t) localStorage.setItem('ar_admin_token', t);
  else localStorage.removeItem('ar_admin_token');
}
function getAdminToken() { return localStorage.getItem('ar_admin_token') || ''; }
function isOnline() { return !LOCAL_MODE; }

/* 读本地图片文件成 base64（data URL），上传图片时用 */
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('تعذّر قراءة الملف'));
    fr.readAsDataURL(file);
  });
}

/* 问服务器后台该怎么进，返回 { needToken, canEdit, reason } */
async function getAdminGate() {
  if (!isOnline()) return { needToken: false, canEdit: true, reason: 'local' };
  try {
    const r = await fetch(BASE + 'api/config', { headers: adminHeaders() });
    if (!r.ok) return { needToken: true, canEdit: false, reason: 'unknown' };
    const j = await r.json();
    return j.data || { needToken: true, canEdit: false, reason: 'unknown' };
  } catch (e) {
    return { needToken: true, canEdit: false, reason: 'offline' };
  }
}

/* ------------------------------------------------------------------
   图片标签 —— 全站统一从这里出
   ------------------------------------------------------------------
   为什么要有这个：
   之前每个地方都手写 <img src>，结果是手机和电脑下同一张全尺寸大图。
   屏幕上显示 200px 宽，底下却下 1600px 的原图 —— 手机上打开就卡。

   现在后台传图时会存三档（400/900/1600），三档地址记在
   product.imageSets[i] 里，这里拼成 srcset 交给浏览器自己挑。

   没有 imageSets 的老图（大哥以前传的那批）照样能用，只是没得挑，
   还是下原图 —— 重新传一次就自动有了。

   用法：imgTag(src, alt, { cls, lazy, sizes, set })
     src   —— 主图地址
     set   —— 后台存的那个字符串，可省
     sizes —— 告诉浏览器这张图显示多宽，用来选档。
              不给就用 '100vw'，对全宽 banner 和圆卡都合适。

   set 的格式是 "地址@宽度|地址@宽度|..."，宽度必须一起存：
   档数不一定总是 3（小图可能只出两档），光按位置猜宽度会错位，
   比如两档的 400 档被写成 900w，手机就挑了那张大图，白折腾。 */
function imgSrcset(set) {
  if (!set || typeof set !== 'string') return '';
  const list = set.split('|').filter(Boolean);
  if (list.length < 2) return '';
  /* 老数据是没带宽度的纯地址（过渡期），那就退回到按档位猜 */
  const FALLBACK = [400, 900, 1600];
  const items = list.map((raw, i) => {
    const at = raw.lastIndexOf('@');
    const w = at > 0 ? parseInt(raw.slice(at + 1), 10) : 0;
    return {
      url: at > 0 ? raw.slice(0, at) : raw,
      w: w > 0 ? w : FALLBACK[Math.round((i / Math.max(1, list.length - 1)) * 2)],
    };
  }).filter(it => it.w > 0 && it.url);
  if (items.length < 2) return '';
  /* 存的顺序是窄 → 宽，srcset 要求宽的在前 */
  items.sort((a, b) => b.w - a.w);
  return items.map(it => it.url + ' ' + it.w + 'w').join(', ');
}

/* 从 product 里取出第 i 张图的三档地址 */
function imgSetOf(obj, i) {
  const s = obj && obj.imageSets;
  if (!s) return '';
  return s[i] || s[String(i)] || '';
}

function imgTag(src, alt, opts) {
  if (!src) return '';
  const o = opts || {};
  const ss = imgSrcset(o.set || '');
  let s = '<img src="' + esc(src) + '"';
  s += ' alt="' + esc(alt || '') + '"';
  if (ss) {
    s += ' srcset="' + esc(ss) + '"';
    s += ' sizes="' + esc(o.sizes || '100vw') + '"';
  }
  /* decoding=async：解码不挡渲染，图片能更早点亮 */
  s += ' decoding="async"';
  s += ' loading="' + (o.lazy === false ? 'eager' : 'lazy') + '"';
  if (o.cls) s += ' class="' + esc(o.cls) + '"';
  if (o.width) s += ' width="' + o.width + '"';
  if (o.height) s += ' height="' + o.height + '"';
  s += '>';
  return s;
}
window.imgTag = imgTag;
window.imgSrcset = imgSrcset;
window.imgSetOf = imgSetOf;
