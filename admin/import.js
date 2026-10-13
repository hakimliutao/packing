/* ==========================================================================
   import.js — 批量导入 / 导出  （依赖 admin.js 里的全局变量）
   --------------------------------------------------------------------------
   用法：
     1. 点「下载表格模板」拿到 xlsx，表头已填好，照着填
     2. 点「选择表格」上传填好的 xlsx / xls / csv
     3. 页面显示预览：新增加几行、更新几行、哪几行有问题
     4. 选好导入模式，点「开始导入」

   图片有两种填法：
     · 直接填网址        https://... 或 /api/img?k=xxx   —— 原样保留
     · 填文件名          cup-01.jpg                      —— 从「图片」里选的文件中按文件名匹配后上传
   ========================================================================== */

/* ---------------------------------------------------------------- 表格列定义 */
const IMP_COLS = [
  { key: 'nameZh',     cn: '中文名称',       ar: '名称 中文',       hint: '必填。用它匹配老产品：填了就是更新，不填就是新增。' },
  { key: 'nameAr',     cn: '阿拉伯名称',     ar: '阿拉伯语名称',   hint: '必填。网站上显示的名字。' },
  { key: 'category',   cn: '分类',           ar: '所属分类',            hint: '填中文名或阿语名都行，找不到会自动新建。留空则用第一个分类。' },
  { key: 'sectors',    cn: '行业',           ar: 'القطاعات',         hint: '多个用、分隔。例：咖啡店,烘焙店。找不到会自动新建。' },
  { key: 'shortAr',    cn: '简短描述',       ar: '简短描述',          hint: '产品卡片上那一行字。' },
  { key: 'descAr',     cn: '详细描述',       ar: '完整描述',      hint: '详情页正文。可以写多行。' },
  { key: 'materialAr', cn: '材质',           ar: '材料' },
  { key: 'sizesAr',    cn: '尺寸',           ar: 'الأحجام',          hint: '多个用、分隔。' },
  { key: 'colorsAr',   cn: '颜色',           ar: 'الألوان',          hint: '多个用、分隔。' },
  { key: 'usesAr',     cn: '用途',           ar: 'الاستخدامات',      hint: '多个用、分隔。' },
  { key: 'img1', cn: '图片1', ar: '图片 1', alt: ['主图', '图片 1', '主图'] },
  { key: 'img2', cn: '图片2', ar: '图片 2', alt: ['背面', 'جهة', '图片 2'] },
  { key: 'img3', cn: '图片3', ar: '图片 3', alt: ['细节', '详情', '图片 3'] },
  { key: 'img4', cn: '图片4', ar: '图片 4' },
  { key: 'img5', cn: '图片5', ar: '图片 5' },
  { key: 'img6', cn: '图片6', ar: '图片 6' },
  { key: 'lab1', cn: '图注1', ar: 'تعليق 1', hint: '可选。这张图下面的小字说明。' },
  { key: 'lab2', cn: '图注2', ar: 'تعليق 2' },
  { key: 'lab3', cn: '图注3', ar: 'تعليق 3' },
  { key: 'lab4', cn: '图注4', ar: 'تعليق 4' },
  { key: 'lab5', cn: '图注5', ar: 'تعليق 5' },
  { key: 'lab6', cn: '图注6', ar: 'تعليق 6' },
  { key: 'sort',      cn: '排序',       ar: '排序',     hint: '数字，小的在前。留空按行号自动排。' },
  { key: 'addedAt',cn: '上架日期',   ar: 'تاريخ ال添加', hint: '可填。填了就会出现在首页「最新上架」，按日期新的在前。留空不显示。' },
  { key: 'featured',  cn: '特色产品',   ar: '推荐',        hint: '是 / 否。选“是”会显示在首页。' },
  { key: 'published', cn: '是否发布',   ar: 'منشور',       hint: '是 / 否。选“否”网站上看不到。' },
];

const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };

/* ---------------------------------------------------------------- 小工具 */
/* 分隔符：中文顿号/逗号/分号 + 阿拉伯语逗号 ٫ 分号 ؛ + 英文逗号分号 + 换行 */
const SPLIT_RE = /[、,，;；|،؛\n\r]+/;
const splitList = s => String(s == null ? '' : s).split(SPLIT_RE).map(x => x.trim()).filter(Boolean);

/* 表头归一化：去空格、去标点、全角转半角，中文数字换成阿拉伯数字 */
function normHeader(s) {
  let t = String(s == null ? '' : s);
  t = t.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  t = t.replace(/[　\s]/g, '');
  t = t.replace(/[（）()【】\[\]]/g, '');
  t = t.replace(/[:：*＊]/g, '');
  t = t.replace(/[一二三四五六]/g, c => CN_NUM[c]);
  return t.toLowerCase().trim();
}

function toBool(v, def) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (!s) return def;
  if (['是', '有', 'yes', 'y', 'true', '1', 'نعم', 'صح', '✓', '√', 'x', 'on'].includes(s)) return true;
  if (['否', '无', 'no', 'n', 'false', '0', 'لا', 'خطأ', '✗', '×', 'off'].includes(s)) return false;
  return def;
}
const toNum = v => {
  const n = parseInt(String(v == null ? '' : v).replace(/[^\d-]/g, ''), 10);
  return isNaN(n) ? null : n;
};

/* Excel 里的日期什么写法都有：2026-10-01、2026/10/1、2026.10.01、
   还有 Excel 读出来的序列号 46307。都统一成 YYYY-MM-DD。
   认不出来就返回空，这一行不进新品区，不猜。 */
function toDate(v) {
  if (v == null || v === '') return '';
  /* Excel 序列号：1900-01-01 起的天数。1万以上才当日期看，
     免得把「2026」这种当成 2026 天错算。 */
  if (typeof v === 'number' && v > 10000 && v < 80000) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  /* 只有年月的场合，补 1 号 */
  m = s.match(/^(\d{4})\D(\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-01`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- 读表格 */
async function readSpreadsheet(file) {
  const buf = await file.arrayBuffer();

  /* CSV 常见两种编码：UTF-8 和 GBK。先按 UTF-8 解，出现乱码再退回 GBK */
  if (/\.csv$|\.txt$/i.test(file.name)) {
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.indexOf('�') >= 0) {
      try { text = new TextDecoder('gbk').decode(buf); } catch (e) { /* 浏览器不支持就算了 */ }
    }
    return XLSX.read(text.replace(/^﻿/, ''), { type: 'string' });
  }
  return XLSX.read(buf, { type: 'array' });
}

/* 把第一张表变成 [{ 列名: 值 }] */
function sheetToRows(ws) {
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
  if (!aoa.length) return { head: [], rows: [] };

  /* 找表头行：含「阿拉伯名称」或「中文名称」的那一行；找不到就用第一行 */
  let hi = 0;
  for (let i = 0; i < Math.min(aoa.length, 6); i++) {
    const line = aoa[i].map(normHeader).join('|');
    if (line.includes('名称بالعربية') || line.includes('阿拉伯名称') || line.includes('اسمبالعربية')) { hi = i; break; }
  }
  const head = aoa[hi].map(x => String(x == null ? '' : x).trim());
  const rows = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i];
    /* 一整行都空就跳过 */
    if (!r.some(v => String(v == null ? '' : v).trim() !== '')) continue;
    const o = { __row: i + 1 };
    head.forEach((h, ci) => { o[h || ('col' + ci)] = r[ci]; });
    rows.push(o);
  }
  return { head, rows };
}

/* 表头 → 列 key 映射 */
function mapColumns(head) {
  const map = {};
  const used = {};
  IMP_COLS.forEach(col => {
    const aliases = [col.cn, col.ar].concat(col.alt || []).map(normHeader);
    /* 先精确匹配，被占用了就跳过 */
    for (let i = 0; i < head.length; i++) {
      if (used[i]) continue;
      if (aliases.includes(normHeader(head[i]))) { map[col.key] = head[i]; used[i] = 1; return; }
    }
    /* 精确没中，再试包含（例：表头写「图片 1（主图）」「材质 material」） */
    for (let i = 0; i < head.length; i++) {
      if (used[i]) continue;
      const h = normHeader(head[i]);
      if (!h) continue;
      if (aliases.some(a => a && (h.includes(a) || a.includes(h)))) { map[col.key] = head[i]; used[i] = 1; return; }
    }
  });
  return map;
}

/* ---------------------------------------------------------------- 图片仓库 */
const imgRepo = { files: new Map(), done: new Map(), pending: new Set() };

function addImageFiles(fileList) {
  let n = 0;
  for (const f of fileList) {
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(f.name)) continue;
    imgRepo.files.set(f.name.toLowerCase(), f);
    imgRepo.files.set(f.name.replace(/\.[^.]+$/, '').toLowerCase(), f);
    n++;
  }
  return n;
}

/* Excel 里内嵌的图上传后返回 { url, variants } —— 三档地址要留着，
   不然一次导几十张图，前台每张都下全尺寸，又回到「打开很慢」的老问题。 */
async function uploadOneImage(token, f) {
  const key = token + '|' + f.name;
  if (imgRepo.done.has(key)) return imgRepo.done.get(key);
  const p = (async () => {
    if (!isOnline()) {
      const r = await compressImage(f);
      return { url: r.url, variants: [] };
    }
    return await uploadCompressed(f, window.AR_ADMIN_HEADERS(), window.AR_BASE);
  })();
  imgRepo.done.set(key, p);
  return p;
}

/* ---------------------------------------------------------------- 行 → 产品 */
let taxDirty = false;

/* ---------------------------------------------------------------- 分类 / 行业自动新建 */
/* 中文名推不出有意义的英文 id，硬转成拼音又太重。
   规则：名字里有拉丁字母就用它；纯中文/纯 emoji 就退回「cat-2」这种序号，
   反正 id 只当内部标识用，序号反而干净。 */
function makeTaxId(kind, list, taken) {
  const prefix = kind === 'cat' ? 'cat-' : 'sec-';
  /* 先看看能不能从现有名字里捞出拉丁部分 */
  for (const x of list) {
    if (taken.has(x.id)) continue;
    const m = String(x.nameAr || '').toLowerCase().match(/[a-z][a-z0-9]*/g);
    if (m && m.length) {
      const cand = prefix + m.join('-').slice(0, 24);
      if (!taken.has(cand)) return cand;
    }
  }
  let i = 2;
  while (taken.has(prefix + i)) i++;
  return prefix + i;
}

function taxFindAndCreate(list, kind, name, taken) {
  const n = String(name).trim();
  if (!n) return null;
  let hit = list.find(x => x.nameAr === n) || list.find(x => x.nameZh === n) ||
            list.find(x => (x.emoji || '') === n);
  if (hit) return hit;
  hit = { id: makeTaxId(kind, list, taken), nameAr: n, emoji: '📦', sort: list.length + 1 };
  list.push(hit);
  taken.add(hit.id);
  taxDirty = true;
  return hit;
}

/* 某行的图片列值 → 该不该去图片仓库里找文件 */
function isUrlLike(s) {
  return /^(https?:)?\/\//i.test(s) || s.startsWith('/api/') || s.startsWith('data:');
}

/* 产品 id：中文名 slugify 出来是空的（只剩 'item'），一堆产品会撞车。
   所以 slug 退化时用「中文名哈希」保证稳定又唯一。 */
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function makeProductId(nameZh, nameAr, rowNo, taken) {
  const stem = slugify(nameZh || nameAr || '');
  const meaningful = stem && stem !== 'item' ? stem : 'p' + hashStr(nameZh || nameAr || String(rowNo));
  let id = meaningful, i = 2;
  while (taken.has(id)) id = `${meaningful}-${i++}`;
  return id;
}

function buildRow(rowObj, colMap, rowNo, taken) {
  const get = k => (colMap[k] ? String(rowObj[colMap[k]] == null ? '' : rowObj[colMap[k]]).trim() : '');
  const problems = [];   /* 致命：这行不能导入 */
  const warns = [];      /* 只是提醒：这行能导入，但有地方空着 */
  const notes = [];

  const nameZh = get('nameZh');
  const nameAr = get('nameAr');
  if (!nameAr) problems.push('阿拉伯名称（nameAr）为空 —— 这行会被跳过');
  if (!nameZh) warns.push('中文名称为空 → 视为新增产品');

  /* 匹配老产品：先按中文名，再按阿语名 */
  let target = null;
  if (nameZh) target = DB.products.find(p => p.nameZh === nameZh);
  if (!target && nameAr) target = DB.products.find(p => p.nameAr === nameAr);

  const p = target
    ? JSON.parse(JSON.stringify(target))
    : {
        id: '', nameAr: '', nameZh: '', categoryId: (DB.tax.categories[0] || {}).id || '',
        sectorIds: [], shortAr: '', descAr: '',
        specs: { materialAr: '', sizesAr: [], colorsAr: [], usesAr: [] },
        images: ['', '', '', '', '', ''],
        imageSets: {},
        imageLabelsAr: ['', '', '', '', '', ''],
        featured: false, published: true, sort: 99
      };

  if (nameAr) p.nameAr = nameAr;
  if (nameZh) p.nameZh = nameZh;

  const catName = get('category');
  if (catName) {
    const c = taxFindAndCreate(DB.tax.categories, 'cat', catName, taken);
    if (c) p.categoryId = c.id;
  } else if (!target) {
    notes.push('分类为空 → 用第一个分类');
  }

  const secNames = splitList(get('sectors'));
  if (secNames.length) {
    p.sectorIds = secNames
      .map(n => taxFindAndCreate(DB.tax.sectors, 'sec', n, taken))
      .filter(Boolean).map(x => x.id);
  }

  ['shortAr', 'descAr'].forEach(k => { const v = get(k); if (v) p[k] = v; });
  ['materialAr'].forEach(k => { const v = get(k); if (v) p.specs[k] = v; });
  [['sizesAr', 'sizesAr'], ['colorsAr', 'colorsAr'], ['usesAr', 'usesAr']].forEach(([k, dest]) => {
    const v = splitList(get(k));
    if (v.length) p.specs[dest] = v;
  });

  /* 图片：网址直接留；文件名去仓库找 */
  const imgs = [], labs = [], sets = {};
  for (let i = 1; i <= 6; i++) {
    const v = get('img' + i);
    const lab = get('lab' + i);
    labs.push(lab);
    if (!v) { imgs.push(target ? (target.images || [])[i - 1] || '' : ''); continue; }
    if (isUrlLike(v)) {
      imgs.push(v);
      /* Excel 里没这一列三档地址，导出的只有主图。
         地址跟老产品一样就把原来的三档接回来，不一样（换了新图）就清掉 ——
         留着旧的会让 srcset 指向上一张图。 */
      if (target && (target.images || [])[i - 1] === v && target.imageSets) {
        if (target.imageSets[i] || target.imageSets[String(i)]) {
          sets[i] = target.imageSets[i] || target.imageSets[String(i)];
        }
      }
      continue;
    }
    const f = imgRepo.files.get(v.toLowerCase()) || imgRepo.files.get(v.replace(/\.[^.]+$/, '').toLowerCase());
    if (f) { imgs.push('PENDING::' + f.name); imgRepo.pending.add(f.name); continue; }
    imgs.push('');
    warns.push('图片' + i + ' 找不到文件「' + v + '」，这格留空');
  }
  p.images = imgs;
  p.imageLabelsAr = labs.length ? labs : (target ? target.imageLabelsAr || [] : ['', '', '', '', '', '']);
  /* 三档地址先接着老产品的，等上传那步填新图的 */
  if (Object.keys(sets).length) p.imageSets = Object.assign({}, target && target.imageSets || {}, sets);

  const s = toNum(get('sort'));
  if (s !== null) p.sort = s;
  else if (!target) p.sort = (rowNo + 1) * 10;

  if (colMap.addedAt) {
    const d = toDate(rowObj[colMap.addedAt]);
    /* 有表头这列就认它：填了就用，没填/认不出就删掉字段。
       不然老产品会被算成「今天上架」，首页新品区全是老货。 */
    if (d) p.addedAt = d;
    else delete p.addedAt;
  }
  if (colMap.featured) p.featured = toBool(rowObj[colMap.featured], !!p.featured);
  if (colMap.published) p.published = toBool(rowObj[colMap.published], p.published !== false);

  /* 新产品才生成 id。taken 里装了已有的 + 本次表格里先出现的，
     不然同一张表里两行同名会拿到同一个 id，互相覆盖。 */
  if (!target) {
    p.id = makeProductId(nameZh, nameAr, rowNo, taken);
    taken.add(p.id);
  }

  return { p, problems, warns, notes, isNew: !target, rowNo };
}

/* ---------------------------------------------------------------- 模板 / 导出 */
function buildAoa(products) {
  const keys = IMP_COLS.map(c => c.key);
  const catName = id => (catOf(id) || {}).nameAr || '';
  const secNames = ids => (ids || []).map(s => (sectorOf(s) || {}).nameAr || '').filter(Boolean).join('، ');

  const aoa = [IMP_COLS.map(c => c.cn)];
  products.forEach(p => {
    const specs = p.specs || {};
    aoa.push(keys.map(k => {
      switch (k) {
        case 'nameZh': return p.nameZh || '';
        case 'nameAr': return p.nameAr || '';
        case 'category': return catName(p.categoryId);
        case 'sectors': return secNames(p.sectorIds);
        case 'shortAr': return p.shortAr || '';
        case 'descAr': return p.descAr || '';
        case 'materialAr': return specs.materialAr || '';
        case 'sizesAr': return (specs.sizesAr || []).join('، ');
        case 'colorsAr': return (specs.colorsAr || []).join('، ');
        case 'usesAr': return (specs.usesAr || []).join('، ');
        case 'sort': return p.sort == null ? '' : p.sort;
        case 'addedAt': return (p.addedAt || '').slice(0, 10);
        case 'featured': return p.featured ? '是' : '否';
        case 'published': return p.published !== false ? '是' : '否';
        default:
          if (/^img\d$/.test(k)) return (p.images || [])[+k.slice(3) - 1] || '';
          if (/^lab\d$/.test(k)) return (p.imageLabelsAr || [])[+k.slice(3) - 1] || '';
          return '';
      }
    }));
  });
  return aoa;
}

function downloadXlsx(wb, filename) {
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  const sample = buildAoa([{
    nameZh: '定制纸杯', nameAr: 'كوب ورقي مخصص', categoryId: (DB.tax.categories[0] || {}).id,
    sectorIds: [], shortAr: 'كوب ورقي جاهز للطباعة بشعارك',
    descAr: 'كوب ورقي من درجتين، مناسب للمقاهي والمطاعم.',
    specs: { materialAr: 'ورق معتمد غذائياً', sizesAr: ['4 أونصة', '8 أونصة'], colorsAr: ['أبيض'], usesAr: ['قهوة', 'عصير'] },
    images: [], imageLabelsAr: [], featured: true, published: true, sort: 10
  }]);
  sample[1][IMP_COLS.findIndex(c => c.key === 'img1')] = 'cup-01.jpg';
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sample), '产品');

  const help = [['列名', '说明']];
  IMP_COLS.forEach(c => help.push([c.cn, (c.hint || '') + '（后台对应：' + c.ar + '）']));
  help.push([]);
  help.push(['图片怎么填', '① 填网址，原样使用；② 填文件名如 cup-01.jpg，导入时在下面选好图片，程序按文件名自动上传。']);
  help.push(['几个关键点', '中文名称用来认出老产品并覆盖更新；填一个新的中文名称就是新增产品。']);
  help.push(['多个值', '用 、 或 , 分隔，例：咖啡店,烘焙店']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(help), '填写说明');

  const ws = wb.Sheets['产品'];
  ws['!cols'] = IMP_COLS.map(c => ({ wch: Math.max(12, c.cn.length * 2 + 2) }));
  wb.Sheets['填写说明']['!cols'] = [{ wch: 18 }, { wch: 70 }];

  downloadXlsx(wb, '产品批量导入模板.xlsx');
  toast('模板已下载');
}

function exportCurrent() {
  if (!DB.products.length) { toast('没有产品可以导出', true); return; }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(buildAoa(DB.products));
  ws['!cols'] = IMP_COLS.map(c => ({ wch: Math.max(12, c.cn.length * 2 + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, '产品');
  downloadXlsx(wb, '当前产品.xlsx');
  toast('产品已导出 — 改完之后从「导入」页面上传回来');
}

/* ---------------------------------------------------------------- 界面 */
let impParsed = null;   /* { rows, colMap } */

function renderPreview() {
  const box = document.getElementById('imp-preview');
  if (!impParsed) { box.innerHTML = ''; return; }

  const list = impParsed.rows;
  const fatal = list.filter(r => r.problems.length);
  const okRows = list.filter(r => !r.problems.length);
  const isNew = okRows.filter(r => r.isNew).length;
  const upd = okRows.length - isNew;
  const modeEl = document.getElementById('imp-mode');
  const mode = modeEl && ['append', 'upsert', 'replace'].includes(modeEl.value) ? modeEl.value : 'append';

  /* append 模式下，「已存在」的行会被跳过（不覆盖也不重复加），
     得在预览里说清楚，不然大哥以为导进去了 */
  const willSkip = mode === 'append' ? upd : 0;

  document.getElementById('imp-stat').innerHTML =
    `读到 <b>${list.length}</b> 行：可导入 <b>${okRows.length}</b>（新增 <b>${isNew}</b>` +
    (mode === 'append' ? '' : `，更新 <b>${upd}</b>`) + '）' +
    (willSkip ? `，<b>${willSkip}</b> 条已存在会被跳过` : '') +
    (fatal.length ? `，<b style="color:var(--danger)">${fatal.length} 行会跳过</b>` : '') +
    (imgRepo.pending.size ? ` · 待上传图片 <b>${imgRepo.pending.size}</b> 张` : '');

  box.innerHTML = list.length ? `<div class="tbl-wrap"><table>
    <thead><tr>
      <th style="width:56px">行号</th><th style="width:80px">动作</th>
      <th>中文名称</th><th>阿拉伯名称</th><th style="width:110px">分类</th>
      <th style="width:60px">图片</th><th>提示</th>
    </tr></thead><tbody>` +
    list.map(r => {
      let msg = '';
      if (r.problems.length) {
        msg = r.problems.map(x => `<span style="color:var(--danger)">${esc(x)}</span>`).join('<br>');
      } else {
        const rest = r.warns.concat(r.notes);
        msg = rest.length ? rest.map(esc).join('；')
          : '<span style="color:var(--ok)">没问题</span>';
      }
      return `<tr>
        <td class="ctr ord">${r.rowNo}</td>
        <td class="ctr">${r.problems.length
          ? '<span class="pub off">跳过</span>'
          : (mode === 'append' && !r.isNew)
            ? '<span class="pub off">已存在</span>'
            : `<span class="pub ${r.isNew ? 'off' : 'on'}">${r.isNew ? '新增' : '更新'}</span>`}</td>
        <td>${esc(r.p.nameZh || '—')}<div class="zh">${esc(r.p.id)}</div></td>
        <td dir="auto">${esc(r.p.nameAr || '—')}</td>
        <td><span class="tag">${esc((catOf(r.p.categoryId) || {}).nameAr || '—')}</span></td>
        <td class="ctr ord">${(r.p.images || []).filter(Boolean).length}</td>
        <td style="font-size:13px">${msg}</td>
      </tr>`;
    }).join('') + '</tbody></table></div>'
    : '<p class="tip">没有可导入的数据行。</p>';
}

function parseFile(file) {
  if (!window.XLSX) { toast('表格处理库没加载上，刷新一下页面', true); return; }
  readSpreadsheet(file)
    .then(wb => {
      const ws = wb.Sheets[wb.SheetNames[0]];
      const { head, rows } = sheetToRows(ws);
      if (!head.length) throw new Error('文件是空的，或者里面没有表头');

      const colMap = mapColumns(head);
      if (!colMap.nameAr && !colMap.nameZh) {
        throw new Error('找不到表头。请用「下载表格模板」里的表头，第一行必须是表头。');
      }
      const missed = IMP_COLS.filter(c => !colMap[c.key] && c.hint).map(c => c.cn);
      /* taken 收集所有已占用的 id：新产品的 id、新建的分类/行业 id 都从这里挑 */
      const taken = new Set([
        ...DB.products.map(p => p.id),
        ...DB.tax.categories.map(c => c.id),
        ...DB.tax.sectors.map(s => s.id),
      ]);
      const built = rows.map((r, i) => buildRow(r, colMap, i, taken));
      impParsed = { rows: built, colMap, file: file.name, rawFile: file, head };

      renderPreview();
      toast(`已读取 ${built.length} 行`);
      if (missed.length) console.warn('[import] 未识别的列:', missed.join(', '));
      console.info('[import] 识别到的列:', colMap);
    })
    .catch(e => {
      impParsed = null;
      renderPreview();
    toast('文件读不出来: ' + ((e && e.message) || e), true);
    });
}

async function doImport() {
  if (!impParsed) { toast('先选一个表格文件', true); return; }

  /* 大哥的用法：每次只在表格里放新产品，导入 = 追加。
     所以默认走 append；万一 select 丢了值也回 append，
     不然老产品会被表格内容覆盖，那是他最不想要的。 */
  const sel = document.getElementById('imp-mode');
  const mode = sel && ['append', 'upsert', 'replace'].includes(sel.value) ? sel.value : 'append';

  const bad = impParsed.rows.filter(r => r.problems.length);
  if (bad.length && !confirm(`${bad.length} 行缺少阿拉伯名称，会被跳过。\n剩下的行继续导入吗？`)) return;

  /* 只导入没致命错的行。有问题的行不占位、不进库。 */
  const usable = impParsed.rows.filter(r => !r.problems.length);

  const pending = [...imgRepo.pending];
  const bar = document.getElementById('imp-bar');
  const barTxt = document.getElementById('imp-bartxt');
  const show = p => { if (bar) bar.style.width = p + '%'; if (barTxt) barTxt.textContent = p + '%'; };

  /* 1. 先把图片传上去，token -> { url, variants } */
  const tokenUrl = new Map();
  const imgErr = [];
  for (let i = 0; i < pending.length; i++) {
    const name = pending[i];
    const f = imgRepo.files.get(name.toLowerCase()) || imgRepo.files.get(name.replace(/\.[^.]+$/, '').toLowerCase());
    const token = 'PENDING::' + name;
    if (!f) { imgErr.push(name + '：文件丢了'); tokenUrl.set(token, null); }
    else {
      try { tokenUrl.set(token, await uploadOneImage(token, f)); }
      catch (e) { imgErr.push(name + '：' + ((e && e.message) || e)); tokenUrl.set(token, null); }
    }
    show(Math.round((i + 1) / (pending.length || 1) * 100));
  }
  if (imgErr.length) console.warn('[import] 图片上传失败', imgErr);

  /* 2. 合并进产品列表 */
  const snapshot = JSON.parse(JSON.stringify(DB.products));
  const incoming = usable.map(r => {
    const p = JSON.parse(JSON.stringify(r.p));
    /* 本行涉及的图片里，有刚上传的就把三档地址写进 imageSets[i]，
       前台 imgTag 靠它出 srcset。没涉及的保留原来的。 */
    const sets = Object.assign({}, r.p.imageSets || {});
    p.images = (p.images || []).map((s, i) => {
      if (!s.startsWith('PENDING::')) return s;
      const up = tokenUrl.get(s);
      if (!up) return '';
      sets[i] = ((up.variants || []).map(v => v.url + '@' + (v.w || 0)).join('|'));
      return up.url;
    });
    if (Object.keys(sets).length) p.imageSets = sets;
    return p;
  });

  let next;
  if (mode === 'replace') {
    if (!confirm(`会把当前 ${DB.products.length} 个产品全部删掉，换成新的 ${incoming.length} 个。\n\n确定吗？`)) return;
    next = incoming;
  } else if (mode === 'upsert') {
    /* id 或中文名对得上就覆盖，对不上就新增 */
    next = [...DB.products];
    incoming.forEach(p => {
      const i = next.findIndex(x => x.id === p.id || (p.nameZh && x.nameZh === p.nameZh));
      if (i >= 0) next[i] = p; else next.push(p);
    });
  } else {
    /* append：只加网站里还没有的 id，老产品一个字都不动。
       同一个文件导两次不会有重复 —— 第二次全是「已存在」，直接跳过。
       这比「照名字硬加一条」安全：万一他重传了文件，不会多出一堆一样的产品。 */
    next = [...DB.products];
    let skipped = 0;
    incoming.forEach(p => { if (next.some(x => x.id === p.id)) skipped++; else next.push(p); });
    if (skipped) console.info('[import] append 跳过已存在的 ' + skipped + ' 条');
  }

  /* 3. 写库 */
  const saved = await guard(mode === 'replace' ? '产品已全部替换' : '导入完成', () => saveProducts(next));
  if (!saved) { DB.products = snapshot; return; }
  if (taxDirty) await guard('分类与行业已更新', () => saveTaxonomy(DB.tax));

  DB.products = next.sort((a, b) => (a.sort || 99) - (b.sort || 99));
  imgRepo.pending.clear();
  impParsed = null;
  renderPreview();
  renderList();
  renderCats();
  show(0);
  if (imgErr.length) toast(`导入完成，但有 ${imgErr.length} 张图片没传上去（看浏览器 F12 的黄色提示）`, true);
}

function bindImport() {
  document.getElementById('imp-tpl').onclick = downloadTemplate;
  document.getElementById('imp-export').onclick = exportCurrent;

  document.getElementById('imp-file').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) parseFile(f);
    e.target.value = '';
  });

  document.getElementById('imp-imgs').addEventListener('change', e => {
    const n = addImageFiles(e.target.files || []);
    document.getElementById('imp-imgcount').textContent =
      n ? `已选 ${n} 个图片文件` : '还没选图片';
    /* 图片变了就重跑一遍表，文件名才能对上 */
    if (impParsed && impParsed.head) reparseWithImages();
    e.target.value = '';
  });

  document.getElementById('imp-folder').addEventListener('change', e => {
    const n = addImageFiles(e.target.files || []);
    document.getElementById('imp-imgcount').textContent =
      n ? `已选 ${n} 个图片文件` : '还没选图片';
    if (impParsed && impParsed.head) reparseWithImages();
    e.target.value = '';
  });

  document.getElementById('imp-go').onclick = doImport;
}

/* 表头留着，重新解析一遍（图片是后选的） */
function reparseWithImages() {
  const file = impParsed && impParsed.rawFile;
  if (file) parseFile(file);
}

bindImport();