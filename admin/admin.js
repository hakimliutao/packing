/* ============================ 后台主逻辑 ============================ */
let DB = { products: [], tax: null, site: null };

const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast on' + (isErr ? ' err' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = 'toast', isErr ? 5000 : 2400);
}

/* 所有写操作都走这里：失败时把真实原因告诉大哥，
   免得点完保存以为成功了，其实没存上 */
async function guard(okMsg, fn, after) {
  try {
    await fn();
    if (after) after();
    toast(okMsg);
    return true;
  } catch (e) {
    const m = (e && e.message) || String(e);
    if (/401|غير مصرح/.test(m)) {
      toast('密码不对 — 检查一下管理密码', true);
    } else if (/Failed to fetch|NetworkError|load failed/i.test(m)) {
      toast('连不上服务器 — 检查一下网络', true);
    } else if (/500|Internal/i.test(m)) {
      toast('服务器出错 — 稍后再试', true);
    } else {
      toast('保存失败：' + m, true);
    }
    console.error('[save error]', m);
    return false;
  }
}

function catOf(id) { return DB.tax.categories.find(c => c.id === id); }
function sectorOf(id) { return DB.tax.sectors.find(s => s.id === id); }

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
}
function nextId(base) {
  let id = base, i = 2;
  while (DB.products.some(p => p.id === id)) id = `${base}-${i++}`;
  return id;
}

async function loadAll() {
  DB.products = await getProductsRaw();
  DB.tax = await getTaxonomy();
  DB.site = await getSite();
}

/* ---------- 列表渲染 ---------- */
let filter = { cat: '', q: '', show: 'pub' };

function renderList() {
  let list = [...DB.products].sort((a, b) => (a.sort || 99) - (b.sort || 99));
  if (filter.cat) list = list.filter(p => p.categoryId === filter.cat);
  if (filter.show === 'pub') list = list.filter(p => p.published !== false);
  if (filter.show === 'unpub') list = list.filter(p => p.published === false);
  if (filter.show === 'feat') list = list.filter(p => p.featured);
  if (filter.q) {
    const k = filter.q.toLowerCase();
    list = list.filter(p => ((p.nameAr || '') + ' ' + (p.nameZh || '')).toLowerCase().includes(k));
  }

  const t = document.getElementById('list');
  t.innerHTML = list.length ? list.map(p => {
    const c = catOf(p.categoryId);
    return `<tr data-id="${esc(p.id)}">
      <td class="th-t">
        <div class="tp">${(p.images || []).find(Boolean)
          ? `<img src="${esc((p.images || []).find(Boolean))}" alt="">`
          : `<span class="tph">${esc(c?.emoji || '📦')}</span>`}</div>
      </td>
      <td>
        <b>${esc(p.nameAr)}</b>
        ${p.nameZh ? `<div class="zh">${esc(p.nameZh)}</div>` : ''}
      </td>
      <td><span class="tag">${esc(c?.nameAr || '—')}</span></td>
      <td><div class="tsec">${(p.sectorIds || []).map(s => {
        const sec = sectorOf(s); return sec ? `<span>${sec.emoji}</span>` : '';
      }).join('')}</div></td>
      <td class="ctr"><span class="ord">${p.sort ?? '—'}</span></td>
      <td>
        ${p.featured ? '<span class="fl on">推荐</span>' : '<span class="fl">—</span>'}
      </td>
      <td>
        <span class="pub ${p.published !== false ? 'on' : 'off'}">
          ${p.published !== false ? '已发布' : '已隐藏'}</span>
      </td>
      <td class="ctr">
        <button class="mini" data-act="edit">编辑</button>
        <button class="mini" data-act="toggle">${p.published !== false ? '隐藏' : '发布'}</button>
        <button class="mini danger" data-act="del">删除</button>
      </td>
    </tr>`;
  }).join('') : `<tr><td colspan="8" class="none">没有匹配的产品。</td></tr>`;

  document.getElementById('count').textContent =
    `共 ${DB.products.length} 个，已选 ${list.length}`;
}

/* ---------- 删除确认框 ----------
   原来用浏览器原生confirm()，大哥反馈「点了没反应」——
   原生那个会被弹窗拦截挡掉，样式也不搭。换成页内自己的层。
   用法：
     if (!await askConfirm('标题', '正文 <b>名字</b>')) return;
   await 的是 true/false，不抛异常。 */
let _cfmResolve = null;
function askConfirm(title, bodyHtml) {
  const box = document.getElementById('confirm');
  if (!box) return Promise.resolve(window.confirm(title));   /* 万一DOM 没加载 */
  document.getElementById('cfm-t').textContent = title || '确认';
  document.getElementById('cfm-b').innerHTML = bodyHtml || '';
  box.classList.add('on');
  return new Promise(res => { _cfmResolve = res; });
}
function closeConfirm(v) {
  const box = document.getElementById('confirm');
  if (box) box.classList.remove('on');
  const r = _cfmResolve; _cfmResolve = null;
  if (r) r(!!v);
}
function bindConfirm() {
  const box = document.getElementById('confirm');
  /* 保险：HTML 顺序万一被改过，DOM 还没到位就在 ready 后再绑一次。
     少了这一句，绑定会静默失败 —— 表现是「点删除毫无反应」，
     而且 onclick 是 null，typeof 查出来是 'object'，很容易看走眼。 */
  if (!box) {
    document.addEventListener('DOMContentLoaded', bindConfirm, { once: true });
    return;
  }
  if (box._cfmBound) return;
  box._cfmBound = true;
  document.getElementById('cfm-yes').onclick = () => closeConfirm(true);
  document.getElementById('cfm-no').onclick = () => closeConfirm(false);
  box.onclick = e => { if (e.target === box) closeConfirm(false); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && box.classList.contains('on')) closeConfirm(false);
  });
}

function bindList() {
  document.getElementById('list').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = tr.dataset.id;
    const i = DB.products.findIndex(p => p.id === id);
    if (i < 0) return;
    const act = btn.dataset.act;

    if (act === 'edit') { openEditor(DB.products[i]); return; }
    if (act === 'toggle') {
      const next = DB.products[i].published === false;
      DB.products[i].published = next;
      await guard(next ? '已发布' : '已隐藏',
        () => saveProducts(DB.products), renderList);
      if (next !== DB.products[i].published) DB.products[i].published = !next;  /* 失败则还原 */
      return;
    }
    if (act === 'del') {
      const p = DB.products[i];
      const ok = await askConfirm(
        '删掉这个产品？',
        `「${esc(p.nameAr)}」会从网站和查询里彻底删掉。<br>这一步没法撤销。`);
      if (!ok) return;
      DB.products.splice(i, 1);
      const done = await guard('已删除', () => saveProducts(DB.products), renderList);
      if (!done) DB.products.splice(i, 0, p);   /* 失败则放回去 */
    }
  });
}

/* ---------- 编辑器 ---------- */
let editing = null;   /* null = 新建 */

/* ---------- 常用值快捷按钮（chips）----------
   大哥的要求：尺寸、材质、工艺这些字段以前只能手打，太慢。
   列一批常见值，点一下就填进去。**但仍然保留手打** —— 特殊产品总有例外。

   ★ 按钮显示中文，填进去的是阿语。
   每条是 [中文显示, 实际值]。大哥看中文点，
   输入框里落的是前台要用的阿语 —— 他不用管阿语拼写对不对。
   （之前只显示阿语，大哥根本不知道哪个是哪个，等于没做。）

   细节：
   · 分隔符写在 HTML 的 data-sep 上 —— 规格区是阿语逗号「، 」，
     可定制项区是「 · 」，跟前台显示的一致。
   · data-single="1" 的（交期）是单选，点了直接覆盖。
   · 再点一下已选中的 = 取消（toggle），不用回删输入框。
   · 「材质」「印刷工艺」两组是动态的：一个从材料表拉（有 nameZh），
     一个从工艺区拉（工艺也有 nameZh 字段）—— 两边加东西这里自动跟上。 */
const CHIPS = {
  size: [
    ['4 安士', '4 أونصة'], ['6 安士', '6 أونصة'], ['8 安士', '8 أونصة'],
    ['10 安士', '10 أونصة'], ['12 安士', '12 أونصة'], ['16 安士', '16 أونصة'],
    ['20 安士', '20 أونصة'], ['22 安士', '22 أونصة'],
  ],
  color: [
    ['白色', 'أبيض'], ['牛皮色', 'كرافت'], ['黑色', 'أسود'],
    ['彩色印刷', 'طباعة ملونة'], ['定制色', 'لون مخصص'],
  ],
  /* 「适合装什么」—— 具体饮品，跟「适用行业」两回事 */
  use: [
    ['热咖啡', 'قهوة ساخنة'], ['茶', 'شاي'], ['冷饮', 'مشروب بارد'],
    ['果汁', 'عصير'], ['奶茶', 'شاي الحليب'], ['甜品', 'حلوى'],
    ['汤', 'شوربة'],
  ],
  extras: [
    ['塑料盖', 'غطاء بلاستيكي'], ['纸盖', 'غطاء ورقي'],
    ['隔热杯套', 'غلاف عازل'], ['牛皮纸袋', 'كيس ورقي'],
    ['独立包装', 'تغليف فردي'], ['吸管', 'شفاطة'], ['纸巾', 'مناديل'],
  ],
  lead: [['7–14 天', '7–14 يوم'], ['15–20 天', '15–20 يوم'],
         ['25–30 天', '25–30 يوم']],
};

/* chip 的值：写死的查 CHIPS，动态的现算。统一返回 [中文, 实际值] 的数组。 */
function chipValues(set) {
  if (CHIPS[set]) return CHIPS[set];
  if (set === 'cmaterial') {
    /* 材料表 11 条全都有 nameZh，直接拿来当按钮文字 */
    return (DB.tax.materials || [])
      .filter(m => m && m.nameAr)
      .map(m => [m.nameZh || m.nameAr, m.nameAr]);
  }
  if (set === 'print') {
    /* 工艺 —— 按钮文字优先用中文名（nameZh），没有才退回英文名/阿语名 */
    return ((DB.site.crafts && DB.site.crafts.items) || [])
      .filter(c => c && c.published !== false && c.nameAr)
      .slice().sort((a, b) => (a.sort || 99) - (b.sort || 99))
      .map(c => [c.nameZh || c.nameEn || c.nameAr, c.nameAr]);
  }
  return [];
}

/* 输入框里的值 -> 数组。分隔符宽容一点：阿语逗号、中点、英文逗号都认，
   大哥手打时用了哪个都能正确拆开。 */
function splitLoose(v) {
  return (v || '').split(/[،·,]+/).map(s => s.trim()).filter(Boolean);
}

function renderChips() {
  document.querySelectorAll('#dlg .chips').forEach(box => {
    const vals = chipValues(box.dataset.set);
    /* 按钮上显示中文，data-v 里存阿语 —— 大哥看中文点，
       落进输入框的是前台要用的阿语。title 放阿语，鼠标停上去能看到填的是什么。 */
    box.innerHTML = vals.length
      ? vals.map(([zh, ar]) =>
          `<button type="button" class="chip" data-v="${esc(ar)}" title="${esc(ar)}">${esc(zh)}</button>`).join('')
      : '';
  });
  syncChips();
}

/* 让 chip 的高亮跟着输入框走 —— 大哥手删了输入框里的值，
   按钮也得跟着熄灭，不然两边对不上。 */
function syncChips() {
  document.querySelectorAll('#dlg .chips').forEach(box => {
    const t = document.getElementById(box.dataset.for);
    if (!t) return;
    const cur = splitLoose(t.value);
    box.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('on', cur.includes(c.dataset.v));
    });
  });
}

/* 点 chip = 追加 / 取消。事件委托绑一次，重建 DOM 也不用重新绑。 */
document.addEventListener('click', e => {
  const chip = e.target.closest('#dlg .chip');
  if (!chip) return;
  e.preventDefault();
  const box = chip.closest('.chips');
  const t = document.getElementById(box.dataset.for);
  if (!t) return;

  const v = chip.dataset.v;
  const sep = box.dataset.sep || '، ';

  if (box.dataset.single === '1') {
    /* 交期那种单选：再点一下同一项就清空 */
    t.value = (t.value.trim() === v) ? '' : v;
  } else {
    const parts = splitLoose(t.value);
    const at = parts.indexOf(v);
    if (at >= 0) parts.splice(at, 1);      /* 已有 -> 取消 */
    else parts.push(v);
    t.value = parts.join(sep);
  }
  syncChips();
  /* 让 openEditor/bindEditor 里的 input 监听能收到，跟手打一个效果 */
  t.dispatchEvent(new Event('input', { bubbles: true }));
});

/* 手打时 chip 高亮也要跟着变 */
document.addEventListener('input', e => {
  if (e.target.closest('#dlg .chips + *') || e.target.closest('#dlg')) {
    syncChips();
  }
});

function openEditor(p) {
  editing = p ? { ...p, specs: JSON.parse(JSON.stringify(p.specs || {})) } : {
    id: '', nameAr: '', nameZh: '', categoryId: (DB.tax.categories[0] || {}).id || '',
    sectorIds: [], craftIds: [], shortAr: '', descAr: '',
    specs: { materialAr: '', sizesAr: [], colorsAr: [], usesAr: [] },
    /* 可定制项 + 阶梯价格。老产品没这些字段，这里兜成空，后面读取都判空。 */
    custom: { sizesAr: [], materialsAr: [], printAr: [], extrasAr: [], leadTimeAr: '' },
    priceTiers: [],
    images: [], imageLabelsAr: ['主图', '正面', '背面', '详情', '尺寸', '使用场景图'],
    /* 新产品默认算今天上架，进「最新上架」。大哥可以改成实际日期。
     注意别用 toISOString() —— 那是 UTC 日期。
     后台是北京时间在用，北京时间 00:00~08:00 之间 UTC 还停在前一天，
     会把新产品标成「昨天上架」（2026-10-08 凌晨实测踩到）。
     这里按本地时间拼 YYYY-MM-DD。 */
    addedAt: (() => {
      const d = new Date();
      const p2 = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    })(),
    featured: false, published: true, sort: (DB.products.length + 1) * 10
  };
  if (!editing.images.length) editing.images = ['', '', '', '', '', ''];
  if (!editing.imageLabelsAr.length) editing.imageLabelsAr = ['', '', '', '', '', ''];
  /* 老数据补齐 —— 迁移早于这两个字段的老产品，直接补空数组，
     不然下面读 custom.sizesAr 会炸 */
  editing.custom = Object.assign(
    { sizesAr: [], materialsAr: [], printAr: [], extrasAr: [], leadTimeAr: '' },
    editing.custom || {});
  if (!Array.isArray(editing.priceTiers)) editing.priceTiers = [];

  const d = document.getElementById('dlg');
  d.classList.add('on');
  document.getElementById('dlg-title').textContent = p ? '编辑产品' : '添加产品';

  document.getElementById('f-nameAr').value = editing.nameAr || '';
  document.getElementById('f-nameZh').value = editing.nameZh || '';
  document.getElementById('f-cat').innerHTML = DB.tax.categories.map(c =>
    `<option value="${esc(c.id)}" ${c.id === editing.categoryId ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.nameAr)}</option>`).join('');
  document.getElementById('f-sectors').innerHTML = (DB.tax.sectors || []).map(s =>
    `<label class="ck"><input type="checkbox" value="${esc(s.id)}" ${(editing.sectorIds || []).includes(s.id) ? 'checked' : ''}> ${esc(s.emoji)} ${esc(s.nameAr)}</label>`).join('');
  document.getElementById('f-materials').innerHTML = (DB.tax.materials || []).map(m =>
    `<label class="ck"><input type="checkbox" value="${esc(m.id)}" ${(editing.materialIds || []).includes(m.id) ? 'checked' : ''}> ${esc(m.emoji)} ${esc(m.nameAr)}</label>`).join('');

  /* 可用工艺 —— 列表现取自「工艺」区（site.crafts.items）。
     那边加一条，这里就多一个可勾的，不用改代码。
     只列上架的：还没上架的工艺勾上去，客户也点不进那一页。 */
  const craftList = ((DB.site.crafts && DB.site.crafts.items) || [])
    .filter(c => c && c.published !== false && c.nameAr)
    .slice().sort((a, b) => (a.sort || 99) - (b.sort || 99));
  const craftBox = document.getElementById('f-crafts');
  if (craftBox) {
    craftBox.innerHTML = craftList.length
      ? craftList.map(c =>
          `<label class="ck"><input type="checkbox" value="${esc(c.id)}" ${(editing.craftIds || []).includes(c.id) ? 'checked' : ''}> ${esc(c.nameAr)}</label>`).join('')
      : '<span class="hint">还没有工艺。先去上面「工艺」区加几条，这里才会出现可勾的选项。</span>';
  }
  document.getElementById('f-shortAr').value = editing.shortAr || '';
  document.getElementById('f-descAr').value = editing.descAr || '';
  document.getElementById('f-material').value = editing.specs.materialAr || '';
  document.getElementById('f-sizes').value = (editing.specs.sizesAr || []).join('، ');
  document.getElementById('f-colors').value = (editing.specs.colorsAr || []).join('، ');
  document.getElementById('f-uses').value = (editing.specs.usesAr || []).join('، ');
  const cu = editing.custom || {};
  /* 用「·」回填，跟前台显示的一模一样 ——
     大哥在后台看到的分隔符就是前台那个，看到什么填什么，存回去才对得上 */
  const j = a => (a || []).join(' · ');
  /* r28：cu.sizesAr 不再回填了 —— 「容量」那个输入框已经和「规格 → 尺寸」
     合并，尺寸统一在上面的 #f-sizes 里改。 */
  document.getElementById('f-cust-materials').value = j(cu.materialsAr);
  document.getElementById('f-cust-print').value = j(cu.printAr);
  document.getElementById('f-cust-extras').value = j(cu.extrasAr);
  document.getElementById('f-cust-lead').value = cu.leadTimeAr || '';
  renderChips();          /* 常用值按钮：要在输入框都回填完再画，高亮才对得上 */
  renderTiers();
  document.getElementById('f-sort').value = editing.sort ?? '';
  document.getElementById('f-addedAt').value = (editing.addedAt || '').slice(0, 10);
  document.getElementById('f-featured').checked = !!editing.featured;
  document.getElementById('f-published').checked = editing.published !== false;
  renderImages();
}

let _uploading = null;   /* 正在上传的图位，避免重复上传 */

/* ---------- 阶梯价格 ----------
   每行是 { from, to, price }：
     from = 最小数量，to = 最大数量（留空 = 该档往上不限），price = 单价 AED。
   页面上一行就是给买家看的「买得多更便宜」，这是促成询盘最有效的一块内容。
   价格一律存 AED（基准货币），前台按访客所在国家的货币换算。 */
function renderTiers() {
  const host = document.getElementById('f-tiers');
  if (!host) return;
  const t = editing.priceTiers || [];
  if (!t.length) {
    host.innerHTML = `<p class="hint" style="margin:0">这个产品没有填价格 —— 前台就不显示价格，客户可以直接用 WhatsApp 问。</p>`;
    return;
  }
  host.innerHTML = t.map((x, i) => `
    <div class="tierrow" data-i="${i}">
      <input type="number" class="inp w60" data-f="from" value="${x.from ?? ''}"
             placeholder="100" min="0" dir="ltr" title="起始数量">
      <span class="tilde">–</span>
      <input type="number" class="inp w60" data-f="to" value="${x.to ?? ''}"
             placeholder="499" min="0" dir="ltr" title="到多少（留空=不限）">
      <span class="eq">=</span>
      <input type="number" class="inp w80" data-f="price" value="${x.price ?? ''}"
             placeholder="0.35" min="0" step="0.001" dir="ltr" title="单个价格（迪拉姆）">
      <span class="cur">AED</span>
      <button type="button" class="mini danger" data-tier-del="${i}">删除</button>
    </div>`).join('');
}

/* 从输入框把阶梯价格读回来。空行整行丢掉，不存半截数据。 */
function collectTiers() {
  const host = document.getElementById('f-tiers');
  if (!host) return [];
  const out = [];
  host.querySelectorAll('.tierrow').forEach(row => {
    const g = f => row.querySelector('[data-f="' + f + '"]').value.trim();
    const from = parseInt(g('from'), 10);
    const price = parseFloat(g('price'));
    if (!(from > 0) || !(price >= 0)) return;      /* 没填全就当没这行 */
    const toRaw = g('to');
    const to = toRaw === '' ? null : parseInt(toRaw, 10);
    out.push({ from: from, to: (to && to >= from) ? to : null, price: price });
  });
  /* 按起订量从小到大排 —— 前台要按这个顺序显示，
     大哥填乱了顺序也不能让页面显示乱 */
  out.sort((a, b) => a.from - b.from);
  return out;
}

function renderImages() {
  document.getElementById('f-images').innerHTML = editing.images.map((src, i) => {
    const busy = _uploading === i;
    return `
    <div class="imgrow">
      <span class="ilabel">${esc(editing.imageLabelsAr[i] || ('图片 ' + (i + 1)))}</span>
      <input type="text" data-i="${i}" data-k="src" value="${esc(src)}"
             placeholder="图片路径或链接" ${busy ? 'disabled' : ''}>
      <label class="file">
        <input type="file" accept="image/*" data-i="${i}" data-k="file" ${busy ? 'disabled' : ''}>
        <span>${busy ? '正在上传…' : '上传'}</span>
      </label>
      ${src ? `<button type="button" class="mini" data-clr="${i}">删除图片</button>` : ''}
    </div>`;
  }).join('');
}

async function collectEditor() {
  /* 逗号、顿号、分号、竖线、点号 全当分隔符。
     前台把这些项是用「·」连起来显示的，后台必须照认这个分隔符 ——
     否则大哥照着前台的样子填回去，会被当成一整条存进去。 */
  const split = s => s.split(/[،,،؛;|·•\n]/)
    .map(x => x.trim().replace(/[،,؛;|]\s*$/, '')).filter(Boolean);
  editing.nameAr = document.getElementById('f-nameAr').value.trim();
  editing.nameZh = document.getElementById('f-nameZh').value.trim();
  editing.categoryId = document.getElementById('f-cat').value;
  editing.sectorIds = [...document.querySelectorAll('#f-sectors input:checked')].map(x => x.value);
  editing.materialIds = [...document.querySelectorAll('#f-materials input:checked')].map(x => x.value);
  /* 可用工艺（r27）：存 id，跟 materialIds / sectorIds 一个模式。
     存 id 才能让产品页跳到 craft.html?c=<id>，也才能做「按工艺筛选」。 */
  editing.craftIds = [...document.querySelectorAll('#f-crafts input:checked')].map(x => x.value);
  editing.shortAr = document.getElementById('f-shortAr').value.trim();
  editing.descAr = document.getElementById('f-descAr').value.trim();
  editing.specs = {
    materialAr: document.getElementById('f-material').value.trim(),
    sizesAr: split(document.getElementById('f-sizes').value),
    colorsAr: split(document.getElementById('f-colors').value),
    usesAr: split(document.getElementById('f-uses').value)
  };
  /* 可定制项：空的全清掉，别把一堆空数组存进数据里 */
  const cu = {};
  const put = (k, id) => { const v = split(document.getElementById(id).value); if (v.length) cu[k] = v; };
  /* r28：不再存 sizesAr —— 容量和规格尺寸合并了，尺寸只存在 specs.sizesAr */
  put('materialsAr', 'f-cust-materials');
  put('printAr', 'f-cust-print');
  put('extrasAr', 'f-cust-extras');
  const lead = document.getElementById('f-cust-lead').value.trim();
  if (lead) cu.leadTimeAr = lead;
  if (Object.keys(cu).length) editing.custom = cu;
  else delete editing.custom;

  const tiers = collectTiers();
  if (tiers.length) editing.priceTiers = tiers;
  else delete editing.priceTiers;

  editing.sort = parseInt(document.getElementById('f-sort').value, 10) || 99;
  /* 日期留空就删掉这个字段，别存成空字符串 ——
     isNewish() 靠真日期判断，存 '' 会让产品算进「没日期」那批。 */
  const added = document.getElementById('f-addedAt').value;
  if (added) editing.addedAt = added;
  else delete editing.addedAt;
  editing.featured = document.getElementById('f-featured').checked;
  editing.published = document.getElementById('f-published').checked;

  if (!editing.nameAr) { toast('产品阿拉伯语名称必须填', true); return false; }
  return true;
}

function bindEditor() {
  const d = document.getElementById('dlg');
  document.getElementById('dlg-close').onclick = () => d.classList.remove('on');
  document.getElementById('dlg-cancel').onclick = () => d.classList.remove('on');

  /* 阶梯价格：加行 / 删行。改数值不用重画（重画会丢焦点），保存时才读。 */
  document.getElementById('f-tier-add').onclick = () => {
    editing.priceTiers = editing.priceTiers || [];
    const last = editing.priceTiers[editing.priceTiers.length - 1];
    /* 新行接着上一行的上限往下接，省得大哥自己算 */
    editing.priceTiers.push({ from: last ? (last.to || last.from * 2) : 100, to: null, price: 0 });
    renderTiers();
  };
  document.getElementById('f-tiers').addEventListener('click', e => {
    const i = e.target.dataset.tierDel;
    if (i === undefined) return;
    editing.priceTiers.splice(+i, 1);
    renderTiers();
  });

  document.getElementById('f-images').addEventListener('input', e => {
    const i = e.target.dataset.i, k = e.target.dataset.k;
    if (k === 'src' && i !== undefined) editing.images[i] = e.target.value;
  });
  document.getElementById('f-images').addEventListener('click', e => {
    const i = e.target.dataset.clr;
    if (i === undefined) return;
    editing.images[+i] = '';
    renderImages();
  });
  document.getElementById('f-images').addEventListener('change', async e => {
    if (e.target.dataset.k !== 'file') return;
    const i = +e.target.dataset.i;
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { toast('图片超过 12MB', true); return; }

    _uploading = i;
    renderImages();
    try {
      const r = await uploadCompressed(file, window.AR_ADMIN_HEADERS(), window.AR_BASE);
      editing.images[i] = r.url;
      /* 三档地址记在产品数据里，前台塞 srcset。
         记成 "地址@宽度|地址@宽度"，| 分是因为地址里不会有这个字符。
         宽度必须带上，档数不一定总是 3，只按顺序猜会错位。 */
      editing.imageSets = editing.imageSets || {};
      editing.imageSets[i] = imgSetStr(r);
      const note = (r.originalBytes && r.bytes)
        ? `${Math.round(r.bytes / 1024)} KB · 省了 ${Math.round((1 - r.bytes / r.originalBytes) * 100)}%`
        : '';
      toast(note ? `图片已上传 · ${note}` : '图片已上传');
    } catch (err) {
      console.error('[upload]', err);
      toast('图片上传失败：' + ((err && err.message) || err), true);
    } finally {
      _uploading = null;
      renderImages();
    }
  });

  /* 上传中不许保存，否则存进去的是空链接 */
  document.getElementById('f-save').addEventListener('click', () => {
    if (_uploading !== null) { toast('等图片上传完', true); return; }
  }, true);

  document.getElementById('f-save').onclick = async () => {
    if (!await collectEditor()) return;
    const snapshot = JSON.parse(JSON.stringify(DB.products));
    if (editing.id) {
      const i = DB.products.findIndex(p => p.id === editing.id);
      if (i < 0) DB.products.push(editing);
      else DB.products[i] = editing;
    } else {
      editing.id = nextId(slugify(editing.nameZh || editing.nameAr));
      DB.products.push(editing);
    }
    const done = await guard('已保存', () => saveProducts(DB.products));
    if (done) {
      d.classList.remove('on');
      renderList();
    } else {
      DB.products = snapshot;   /* 存不进去就还原，界面对得上实际数据 */
      renderList();
    }
  };
}

/* ---------- 分类 / 行业 / 设置 ---------- */

/* 上传一张图，返回 { url, variants: [{url,w,h}] }，地址可存进 JSON。
   走 imgopt 压缩后再传 —— 之前是原图直传，实测 1.5MB 的图拖慢整页 30 秒。
   线上传到 Blobs 只留链接；本地模式直接存压好的 base64（没有多档）。
   调用方要拿三档地址就拼 "|"，前台 imgTag 会读它生成 srcset。 */
async function uploadImage(file) {
  if (!file) throw new Error('还没选文件');
  if (!/^image\//.test(file.type)) throw new Error('这个文件不是图片');
  if (file.size > 12 * 1024 * 1024) throw new Error('图片超过 12MB');

  if (!isOnline()) {
    /* 本地模式没有 Blobs，压完直接存 base64 一样能用 */
    const r = await compressImage(file);
    return { url: r.url, variants: [] };
  }
  return await uploadCompressed(file, window.AR_ADMIN_HEADERS(), window.AR_BASE);
}

/* 把 variants 拼成前台能读的 "地址@宽度|地址@宽度"；
   宽度必须一起存 —— 档数不一定总是 3，光按顺序猜会错位。 */
function imgSetStr(r) {
  return ((r && r.variants) || []).map(v => v.url + '@' + (v.w || 0)).join('|');
}

/* 表格里那一格「缩略图 + 路径 + 上传按钮」 */
function imgCell(kind, item) {
  const src = item.image || '';
  return `<div class="imgcell" data-kind="${kind}" data-id="${esc(item.id)}">
    <div class="tp">${src ? `<img src="${esc(src)}" alt="">` : `<span class="ico">${esc(item.emoji)}</span>`}</div>
    <input type="text" data-k="image" value="${esc(src)}" placeholder="图片路径">
    <label class="file"><input type="file" accept="image/*"><span>上传</span></label>
  </div>`;
}

function renderCats() {
  document.getElementById('cat-list').innerHTML = DB.tax.categories.map(c => {
    const n = DB.products.filter(p => p.categoryId === c.id).length;
    return `<tr data-id="${esc(c.id)}">
      <td>${imgCell('cat', c)}</td>
      <td><input data-k="nameAr" value="${esc(c.nameAr)}"></td>
      <td class="ctr"><input class="w60" data-k="emoji" value="${esc(c.emoji || '')}"></td>
      <td class="ctr"><input class="w60" data-k="sort" value="${c.sort || 0}"></td>
      <td class="ctr"><span class="count">${n}</span></td>
      <td class="ctr"><button class="mini danger" data-del="${esc(c.id)}">删除</button></td>
    </tr>`;
  }).join('');
  document.getElementById('sector-list').innerHTML = DB.tax.sectors.map(s => {
    const n = DB.products.filter(p => (p.sectorIds || []).includes(s.id)).length;
    return `<tr data-id="${esc(s.id)}">
      <td>${imgCell('sec', s)}</td>
      <td><input data-k="nameAr" value="${esc(s.nameAr)}"></td>
      <td><input data-k="descAr" value="${esc(s.descAr || '')}" placeholder="简短描述"></td>
      <td class="ctr"><input class="w60" data-k="emoji" value="${esc(s.emoji || '')}"></td>
      <td class="ctr"><input class="w60" data-k="sort" value="${s.sort || 0}"></td>
      <td class="ctr"><span class="count">${n}</span></td>
      <td class="ctr"><button class="mini danger" data-delsec="${esc(s.id)}">删除</button></td>
    </tr>`;
  }).join('');
  /* 材料 = 第三个筛选维度。老数据里没有这个表，退回空数组别炸 */
  document.getElementById('material-list').innerHTML = (DB.tax.materials || []).map(m => {
    const n = DB.products.filter(p => (p.materialIds || []).includes(m.id)).length;
    return `<tr data-id="${esc(m.id)}">
      <td>${imgCell('mat', m)}</td>
      <td><input data-k="nameAr" value="${esc(m.nameAr)}"></td>
      <td><input data-k="descAr" value="${esc(m.descAr || '')}" placeholder="简短描述"></td>
      <td class="ctr"><input class="w60" data-k="emoji" value="${esc(m.emoji || '')}"></td>
      <td class="ctr"><input class="w60" data-k="sort" value="${m.sort || 0}"></td>
      <td class="ctr"><span class="count">${n}</span></td>
      <td class="ctr"><button class="mini danger" data-delmat="${esc(m.id)}">删除</button></td>
    </tr>`;
  }).join('');
}

function bindCats() {
  /* 行内编辑 */
  const bind = (tid, listKey) => {
    document.getElementById(tid).addEventListener('input', e => {
      const k = e.target.dataset.k;
      if (!k) return;
      const tr = e.target.closest('tr');
      const item = DB.tax[listKey].find(x => x.id === tr.dataset.id);
      if (!item) return;
      item[k] = k === 'sort' ? (parseInt(e.target.value, 10) || 0) : e.target.value;
      if (k === 'image') {           /* 路径改了缩略图跟着变 */
        const tp = tr.querySelector('.imgcell .tp');
        if (tp) tp.innerHTML = e.target.value
          ? `<img src="${esc(e.target.value)}" alt="">` : `<span class="ico">${esc(item.emoji)}</span>`;
      }
    });
  };
  bind('cat-list', 'categories');
  bind('sector-list', 'sectors');
  bind('material-list', 'materials');

  /* 图片上传 */
  const LIST_OF = { cat: 'categories', sec: 'sectors', mat: 'materials' };
  ['cat-list', 'sector-list', 'material-list'].forEach(tid => {
    const box = document.getElementById(tid);
    box.addEventListener('change', async e => {
      const f = e.target.closest('.file input[type=file]');
      if (!f || !f.files || !f.files[0]) return;
      const cell = f.closest('.imgcell');
      const item = (DB.tax[LIST_OF[cell.dataset.kind]] || [])
        .find(x => x.id === cell.dataset.id);
      if (!item) return;
      f.disabled = true;
      try {
        const r = await uploadImage(f.files[0]);
        item.image = r.url;
        item.imageSet = imgSetStr(r);
        const inp = cell.querySelector('input[type=text]');
        if (inp) inp.value = item.image;
        const tp = cell.querySelector('.tp');
        if (tp) tp.innerHTML = `<img src="${esc(item.image)}" alt="">`;
        toast('图片已上传 — 点「保存修改」');
      } catch (err) {
        toast('上传失败：' + ((err && err.message) || err), true);
      }
      f.disabled = false;
      f.value = '';
    });
  });

  document.getElementById('cat-list').addEventListener('click', async e => {
    const id = e.target.dataset.del; if (!id) return;
    if (DB.products.some(p => p.categoryId === id)) { toast('这个分类下还有产品 — 先把产品移到别的分类', true); return; }
    if (!await askConfirm('删掉这个分类？', '会从网站的筛选里消失，撤不回来。')) return;
    const snap = DB.tax.categories;
    DB.tax.categories = DB.tax.categories.filter(c => c.id !== id);
    const done = await guard('已删除', () => saveTaxonomy(DB.tax), () => { renderCats(); renderList(); });
    if (!done) { DB.tax.categories = snap; renderCats(); }
  });
  document.getElementById('sector-list').addEventListener('click', async e => {
    const id = e.target.dataset.delsec; if (!id) return;
    if (!await askConfirm('删掉这个行业？', '会从网站的筛选里消失，撤不回来。')) return;
    const snap = DB.tax.sectors;
    DB.tax.sectors = DB.tax.sectors.filter(s => s.id !== id);
    const done = await guard('已删除', () => saveTaxonomy(DB.tax), () => { renderCats(); renderList(); });
    if (!done) { DB.tax.sectors = snap; renderCats(); }
  });

  document.getElementById('add-cat').onclick = () => {
    const id = nextId('cat-' + (DB.tax.categories.length + 1));
    DB.tax.categories.push({ id, nameAr: '新分类', emoji: '📦', image: '', sort: DB.tax.categories.length + 1 });
    guard('先填个名字再保存', () => saveTaxonomy(DB.tax), renderCats);
  };
  document.getElementById('add-sector').onclick = () => {
    const id = nextId('sec-' + (DB.tax.sectors.length + 1));
    DB.tax.sectors.push({ id, nameAr: '新行业', emoji: '🏷️', image: '', descAr: '', sort: DB.tax.sectors.length + 1 });
    guard('先填个名字再保存', () => saveTaxonomy(DB.tax), renderCats);
  };
  document.getElementById('material-list').addEventListener('click', async e => {
    const id = e.target.dataset.delmat; if (!id) return;
    const used = DB.products.filter(p => (p.materialIds || []).includes(id));
    if (used.length) { toast('这个材料被 ' + used.length + ' 个产品用着，先从产品上解掉', true); return; }
    if (!await askConfirm('删掉这个材料？', '会从材料筛选里消失，撤不回来。')) return;
    const snap = DB.tax.materials;
    DB.tax.materials = (DB.tax.materials || []).filter(m => m.id !== id);
    const done = await guard('已删除', () => saveTaxonomy(DB.tax), () => { renderCats(); renderList(); });
    if (!done) { DB.tax.materials = snap; renderCats(); }
  });
  document.getElementById('add-material').onclick = () => {
    if (!Array.isArray(DB.tax.materials)) DB.tax.materials = [];
    const id = nextId('mat-' + (DB.tax.materials.length + 1));
    DB.tax.materials.push({ id, nameAr: '新材料', emoji: '🧻', image: '', descAr: '', sort: DB.tax.materials.length + 1 });
    guard('先填个名字再保存', () => saveTaxonomy(DB.tax), renderCats);
  };
  document.getElementById('save-tax').onclick = async () => {
    await guard('分类/行业/材料已保存', () => saveTaxonomy(DB.tax));
  };
}

/* ---------- banner 管理 ---------- */
/* 每张 banner 点了之后去哪。类型分开存，比让后台自己拼 URL 稳 ——
   分类名、产品 id 都是站内数据，改版时 URL 变了不用重新填一遍。 */
const BNR_LINK_TYPES = [
  { v: 'none',     ar: '没有链接（只放图）' },
  { v: 'category', ar: '分类 / 产品类型' },
  { v: 'product',  ar: '指定产品' },
  { v: 'wa',       ar: 'WhatsApp' },
  { v: 'url',      ar: '外部链接' },
];

function getBanners() {
  if (!DB.site.hero) DB.site.hero = {};
  if (!Array.isArray(DB.site.hero.banners)) DB.site.hero.banners = [];
  return DB.site.hero.banners;
}

/* 老封面图（hero.imageAr）也要给入口。
   改版前首页横幅是单张图，存的就是这个字段；改版后前台会拿它当兜底
   （banners 为空时顶上），但后台一直没地方改它 →
   大哥在后台只看到 banners 列表，看到图却改不了，就是这个原因。
   这里单独给它一格：能上传、能手动贴链接、能清掉。 */
function renderHeroCover() {
  const host = document.getElementById('bnr-cover');
  if (!host) return;
  const hero = DB.site.hero || (DB.site.hero = {});
  const cur = hero.imageAr || '';
  const used = (hero.banners || []).length > 0;

  host.innerHTML = `
    <div class="bnr-card bnr-cover-card" data-i="-1">
      <div class="bnr-thumb">
        ${cur ? `<img src="${esc(cur)}" alt="">` : '<span class="tph">🖼</span>'}
      </div>
      <div class="bnr-fields">
        <label>旧封面图链接<input class="inp" data-k="imageAr"
               value="${esc(cur)}" placeholder="图片地址，兜底横幅用"></label>
        <p class="hint" style="margin:0">
          这是改版前那张单张首页大图。
          ${used ? '现在已经有横幅列表了，只有列表被清空时才会用它。'
                  : '现在首页显示的就是这张 —— 上传一张新的就能换掉。'}
        </p>
      </div>
      <div class="bnr-acts">
        <label class="file"><input type="file" accept="image/*"><span>上传图片</span></label>
        <button class="mini danger" type="button" data-clear-cover>清空</button>
      </div>
    </div>`;
}

function renderBanners() {
  renderHeroCover();          /* 旧封面图那张一起画，别漏 */
  const list = getBanners();
  const host = document.getElementById('bnr-list');
  document.getElementById('bnr-count').textContent =
    list.length ? `${list.length} 条横幅` : '还没有横幅';
  if (!list.length) {
    host.innerHTML = `<div class="bnr-empty">
      还没有横幅。点「+ 添加横幅」，至少上传一张图片。
    </div>`;
    return;
  }
  host.innerHTML = list.map((b, i) => `
    <div class="bnr-card" data-i="${i}">
      <div class="bnr-thumb">
        ${b.image ? `<img src="${esc(b.image)}" alt="">` : '<span class="tph">🖼</span>'}
      </div>
      <div class="bnr-fields">
        <div class="fgrid">
          <label>标题<input class="inp" data-k="titleAr" value="${esc(b.titleAr || '')}" placeholder="选填"></label>
          <label>小标题<input class="inp" data-k="subAr" value="${esc(b.subAr || '')}" placeholder="选填"></label>
        </div>
        <label>图片链接<input class="inp" data-k="image" value="${esc(b.image || '')}" placeholder="图片必填"></label>
        <label class="full">点击后跳到哪<input class="inp" data-k="linkTo" value="${esc(b.linkTo || '')}" placeholder="选填"></label>
        <label class="full">链接类型
          <select class="inp" data-k="linkType">
            ${BNR_LINK_TYPES.map(t => `<option value="${t.v}"${(b.linkType || 'none') === t.v ? ' selected' : ''}>${t.ar}</option>`).join('')}
          </select>
        </label>
        ${b.linkType && b.linkType !== 'none' ? `
        <p class="hint" style="margin:0">
          ${b.linkType === 'category'
            ? '填阿拉伯语分类名，跟「产品分类」里写的完全一致，比如：الأكواب'
            : b.linkType === 'product'
              ? '填产品 ID。在产品页网址里 product.html?id= 后面那一串就是'
              : b.linkType === 'wa'
                ? 'WhatsApp 号码用国际格式，不带 + 不带空格，比如：966500000000'
                : '链接要写完整，比如：https://example.com/page'}
        </p>` : ''}
      </div>
      <div class="bnr-acts">
        <label class="file"><input type="file" accept="image/*"><span>上传图片</span></label>
        <button class="mini" type="button" data-up title="提交">↑</button>
        <button class="mini" type="button" data-down title="延迟">↓</button>
        <button class="mini danger" type="button" data-delb>删除</button>
      </div>
    </div>`).join('');
}

function bindBanners() {
  const host = document.getElementById('bnr-list');
  const list = getBanners;
  const cover = document.getElementById('bnr-cover');

  /* 旧封面图那张卡（data-i="-1"）走单独的逻辑：
     写的是 hero.imageAr，不是 banners[i].image。 */
  if (cover) {
    cover.addEventListener('input', e => {
      if (e.target.dataset.k !== 'imageAr') return;
      DB.site.hero.imageAr = e.target.value;
    });
    cover.addEventListener('change', async e => {
      const f = e.target.closest('input[type=file]');
      if (!f || !f.files || !f.files[0]) return;
      f.disabled = true;
      const btn = f.parentElement;
      if (btn) btn.querySelector('span').textContent = '上传中…';
      try {
        const r = await uploadImage(f.files[0]);
        /* 上传完自动填链接 —— 大哥第6 条：传了就该出地址，不用手填 */
        DB.site.hero.imageAr = r.url;
        renderHeroCover();
        toast('图片已上传 — 点保存才生效');
      } catch (err) {
        toast('上传失败：' + ((err && err.message) || err), true);
        if (btn) btn.querySelector('span').textContent = '上传图片';
        f.disabled = false;
      }
      f.value = '';
    });
    cover.addEventListener('click', async e => {
      if (!e.target.closest('[data-clear-cover]')) return;
      if (!await askConfirm('清空这张封面图？',
          '首页如果没有别的横幅，顶部会变成没有图。')) return;
      DB.site.hero.imageAr = '';
      renderHeroCover();
    });
  }

  /* ★ 卡片的 class 必须跟这些事件处理对齐。
     踩过：renderBanners() 里写的是 `blk-card`（那是流程/案例那种单列卡的样式），
     但下面全用 `.bnr-card` 去找 —— closest 返回 null：
       · 上传 →「Cannot read properties of null (reading 'dataset')」直接崩
       · 删除 → 静默 return，点删除一点反应都没有
     所以这里统一写 .bnr-card。改这张卡的 class 时，下面这些 selector
     要一起改。 */
  host.addEventListener('input', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    const card = e.target.closest('.bnr-card');
    if (!card) return;
    const i = +card.dataset.i;
    if (!list()[i]) return;
    list()[i][k] = e.target.value;
    if (k === 'image') {
      const t = card.querySelector('.bnr-thumb');
      if (t) {
        t.innerHTML = e.target.value ? `<img src="${esc(e.target.value)}" alt="">` : '<span class="tph">🖼</span>';
      }
    }
  });

  /* select 不发 input 事件，只发 change。不单独处理的话，
     「链接类型」选了等于没选，存下去永远是默认的 none。 */
  host.addEventListener('change', e => {
    const k = e.target.dataset.k;
    if (k !== 'linkType') return;
    const card = e.target.closest('.bnr-card');
    if (!card) return;
    const i = +card.dataset.i;
    if (!list()[i]) return;
    list()[i].linkType = e.target.value;
    renderBanners();          /* 重画，把下方那行提示文字换掉 */
  });

  host.addEventListener('change', async e => {
    const f = e.target.closest('input[type=file]');
    if (!f || !f.files || !f.files[0]) return;
    const card = f.closest('.bnr-card');
    if (!card) { toast('这张横幅的位置找不到了，刷新后台再试', true); return; }
    const i = +card.dataset.i;
    f.disabled = true;
    try {
      const r = await uploadImage(f.files[0]);
      if (!list()[i]) list()[i] = {};
      list()[i].image = r.url;
      list()[i].imageSet = imgSetStr(r);
      renderBanners();
      toast('图片已上传 — 点保存');
    } catch (err) {
      toast('上传失败：' + ((err && err.message) || err), true);
      f.disabled = false;
    }
    f.value = '';
  });

  host.addEventListener('click', async e => {
    /* 点空白处不管 */
    if (!e.target.closest('.bnr-card')) return;
    const card = e.target.closest('.bnr-card');
    const i = +card.dataset.i;
    const L = list();
    if (!L[i]) { toast('这张横幅找不到了，刷新后台再试', true); return; }

    if (e.target.closest('[data-up]') && i > 0) {
      [L[i - 1], L[i]] = [L[i], L[i - 1]];
    } else if (e.target.closest('[data-down]') && i < L.length - 1) {
      [L[i + 1], L[i]] = [L[i], L[i + 1]];
    } else if (e.target.closest('[data-delb]')) {
      if (!await askConfirm('删掉这张横幅？',
          '会从首页顶部消失，撤不回来。')) return;
      L.splice(i, 1);
      toast('已删掉 — 点保存才生效');
    } else return;
    renderBanners();
  });

  document.getElementById('bnr-add').onclick = () => {
    /* 新卡默认无跳转；选好类型再填目标 */
    list().push({ image: '', titleAr: '', subAr: '', linkType: 'none', linkTo: '' });
    renderBanners();
    const cards = document.querySelectorAll('#bnr-list .bnr-card');
    const last = cards[cards.length - 1];
    if (last) {
      last.scrollIntoView({ behavior: 'smooth', block: 'center' });
      /* 新卡没有缩略图样式里的 .bnr-thumb img，给个聚焦提示，
         大哥上传前就知道该点哪 */
      const t = last.querySelector('.bnr-thumb');
      if (t) t.style.outline = '2px dashed var(--brand)';
    }
  };
}

/* ---------- 站点文案 ---------- */
/* 59 条阿拉伯语文案原来只存在数据文件里，后台一个入口都没有 ——
   大哥想改「查看全部」这四个字都做不到。这页把它们全列出来。
   WORD_GROUPS 在 wordlabels.js 里，是这些字段的中文对照。 */
function renderWords() {
  const ui = DB.tax.ui || (DB.tax.ui = {});
  const host = document.getElementById('words-list');
  let n = 0;
  host.innerHTML = WORD_GROUPS.map(g => `
    <h3 style="margin-top:26px">${esc(g.name)}</h3>
    ${g.items.map(it => {
      n++;
      return `<div class="imgrow">
        <span class="ilabel" style="width:210px">${esc(it.label)}
          <span class="hint" dir="ltr" style="display:block;font-size:11px">${esc(it.key)}</span>
        </span>
        <input class="inp" data-wkey="${esc(it.key)}" value="${esc(ui[it.key] || '')}"
               dir="rtl" placeholder="${esc(it.value)}">
      </div>`;
    }).join('')}
  `).join('');
  document.getElementById('words-count').textContent = `${n} 个文本`;
}

function bindWords() {
  const host = document.getElementById('words-list');

  host.addEventListener('input', e => {
    const k = e.target.dataset.wkey;
    if (!k) return;
    DB.tax.ui[k] = e.target.value;
  });

  document.getElementById('words-save').onclick = async () => {
    /* 空的写回默认值，别存成空串 —— 前台
       `ui.viewAllAr || '全部'` 这种兜底才生效 */
    await guard('文案已保存', () => saveTaxonomy(DB.tax));
  };
}

/* ---------- 首屏统计数字 ---------- */
/* site.stats 就是首页那三行（+250 / +6 / 24–48），原来只写在种子文件里，
   后台改不了。这里做成能增删改的列表。 */
function getStats() {
  if (!Array.isArray(DB.site.stats)) DB.site.stats = [];
  return DB.site.stats;
}

function renderStats() {
  const list = getStats();
  const host = document.getElementById('stats-list');
  host.innerHTML = list.length ? list.map((s, i) => `
    <div class="imgrow" data-i="${i}" style="align-items:center">
      <input class="inp w60" data-k="value" value="${esc(s.value || '')}"
             placeholder="+250" dir="ltr" style="text-align:center">
      <input class="inp" data-k="labelAr" value="${esc(s.labelAr || '')}"
             placeholder="目录里的产品" style="flex:1;min-width:180px">
      <button type="button" class="mini danger" data-del-s="${i}">删除</button>
    </div>`).join('')
    : '<p class="hint" style="margin:0">还没有数字 —— 这一块会从首页隐藏。</p>';
}

function bindStats() {
  const host = document.getElementById('stats-list');
  host.addEventListener('input', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    getStats()[+e.target.closest('[data-i]').dataset.i][k] = e.target.value;
  });
  host.addEventListener('click', async e => {
    const b = e.target.closest('[data-del-s]');
    if (!b) return;
    if (!await askConfirm('删掉这个号码？', '会从首页顶部消失。')) return;
    getStats().splice(+b.dataset.delS, 1);
    renderStats();
  });
  document.getElementById('stats-add').onclick = () => {
    getStats().push({ value: '+0', labelAr: '' });
    renderStats();
  };
}

/* ---------- 品牌色 ---------- */
const SWATCHES = {
  primary: ['#0e6b52', '#c9962f', '#1f6f5c', '#a3402f', '#1e5fa8', '#5b3fa8', '#12100e'],
  gold:    ['#c9962f', '#e0a92e', '#b8862f', '#d4a017', '#c07d20', '#e8b93a', '#a97c2a'],
};
const DEFAULT_THEME = { primary: '#0e6b52', gold: '#c9962f' };


/* 首页各板块显示几条 —— 输入框 id → categories.json 的 ui 字段名。
   提到模块级：加载（renderSettings）和保存（saveSettings 的点击处理）
   在两个函数里，const 局部的话保存时会报 UI_COUNT_KEYS is not defined，
   数字框看着能填，保存后完全没反应。 */
const UI_COUNT_KEYS = {
  's-h-stats': 'homeStatsCountAr', 's-h-trust': 'homeTrustCountAr',
  's-h-cats': 'homeCatsCountAr', 's-h-sectors': 'homeSectorsCountAr',
  's-h-mats': 'homeMatsCountAr', 's-h-featured': 'homeFeaturedCountAr',
  's-h-new': 'homeNewCountAr', 's-h-proc': 'homeProcessCountAr',
  's-h-cli': 'homeClientsCountAr', 's-h-cert': 'homeCertsCountAr',
  's-h-faq': 'faqHomeCountAr',
};

/* ==========================================================================
   r21 新增：WhatsApp 多号码 + 位置分配
   --------------------------------------------------------------------------
   site.whatsapp 现在的结构：
     nums  —— [{id, nameAr, number, msgAr}]  号码列表
     map   —— {waFab:'general', ...}      每个位置用哪个号
     off   —— ['waNav', ...]              哪些位置整个关掉

   老数据只有 number / defaultMessageAr，前台会自动包成 nums[0]，
   这里读的时候也做同样的兜底 —— 升级不会丢号码。
   ========================================================================== */
/* 号码清洗。跟前台 site.js 的 waClean、迁移脚本 migrate.js 的 waCleanNum
   是同一套逻辑，三处必须一致 —— 不然后台存的是干净的、迁移完又变脏。

   为什么要洗：wa.me 官方要求斜杠后面只能是「国家码 + 号码」的纯数字，
   不能带 +、空格、横线，也不能带 00 这个国际拨号前缀
   （官方给的错误示例就是 wa.me/+001-(XXX)XXXXXXX）。
   大哥在后台很可能顺手写成 0086... 或 +86 151 ...，不洗的话链接直接失效，
   客户点了看到「号码无效」。

   洗法：先只留数字（+ 空格 横线 括号全去掉），再剥掉开头的 0。
   敢直接剥所有 0，是因为国家码一律 1~9 开头（1 美国 44 英国 86 中国
   966 沙特 971 阿联酋……），开头连续的 0 一定不属于国家码。 */
function waCleanAdmin(raw) {
  return String(raw == null ? '' : raw).replace(/\D/g, '').replace(/^0+/, '');
}

/* 位置清单：key 必须跟前台 site.js 的 WA_PLACEMENTS 一致 */
const WA_PLACES = [
  ['waFab', '右下角悬浮圆钮', '所有页面都有，永远悬停在右下角'],
  ['waNav', '顶栏按钮', '页面最上面那排里的绿色按钮'],
  ['waDrawer', '侧边抽屉底部', '点三横线打开菜单后，最下面那个'],
  ['waProduct', '产品卡/详情页/价格页', '这三个一起用一个号，消息里自动带产品名'],
  ['waContactBtn', '联系页发送按钮', '联系表单里那个'],
  ['waFoot', '底部联系区', '页脚「联系」那一栏，还有页面末尾的询价条'],
];

function waSeed() {
  const w = DB.site.whatsapp || {};
  if (Array.isArray(w.nums) && w.nums.length) return w.nums;
  if (w.number) {
    return [{ id: 'general', nameAr: '一般咨询', number: w.number,
              msgAr: w.defaultMessageAr || '' }];
  }
  return [{ id: 'general', nameAr: '一般咨询', number: '', msgAr: '' }];
}

function renderWaAdmin() {
  const host = document.getElementById('wa-list');
  const mapHost = document.getElementById('wa-map');
  if (!host || !mapHost) return;
  const w = DB.site.whatsapp || (DB.site.whatsapp = {});
  w.nums = waSeed();
  if (!w.map) w.map = {};
  if (!Array.isArray(w.off)) w.off = [];

  const nums = w.nums;
  host.innerHTML = nums.map((n, i) => `
    <div class="blk-card" data-i="${i}">
      <div class="blk-head">
        <input data-k="nameAr" value="${esc(n.nameAr || '')}" placeholder="名称（例：销售部）" style="max-width:150px">
        <input data-k="number" value="${esc(n.number || '')}" placeholder="966500000000" dir="ltr" style="max-width:170px">
        <button type="button" class="mini danger" data-del-wa="${i}" data-del-wa-id="${esc(n.id || '')}">删除</button>
      </div>
      <div class="blk-body">
        <input data-k="msgAr" value="${esc(n.msgAr || '')}"
               placeholder="这个号码专用的开场白（选填 — 留空就用上面那句通用开场白）">
      </div>
    </div>`).join('');

  /* 位置分配：勾 + 下拉。下拉的选项就是上面这几个号码。 */
  mapHost.innerHTML = WA_PLACES.map(([key, on, hint]) => {
    const off = w.off.indexOf(key) >= 0;
    const cur = w.map[key] || (nums[0] ? nums[0].id : 'general');
    const opts = nums.map(n => `
      <option value="${esc(n.id)}"${n.id === cur ? ' selected' : ''}>${esc(n.nameAr || n.id)}</option>
    `).join('');
    return `
      <div class="row-actions" style="justify-content:space-between;border:1px solid var(--line);
           border-radius:10px;padding:9px 12px">
        <label class="chk" style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1">
          <input type="checkbox" data-wa-on="${key}"${off ? '' : ' checked'} style="width:17px;height:17px">
          <span><b>${esc(on)}</b><br><small style="color:var(--ink-3)">${esc(hint)}</small></span>
        </label>
        <select class="inp" data-wa-use="${key}" style="width:auto;min-width:150px"${off ? ' disabled' : ''}>
          ${opts}
        </select>
      </div>`;
  }).join('');
}

function collectWaAdmin() {
  const w = DB.site.whatsapp || (DB.site.whatsapp = {});
  const host = document.getElementById('wa-list');
  if (host) {
    host.querySelectorAll('.blk-card').forEach(card => {
      const i = +card.dataset.i;
      if (!w.nums[i]) return;
      card.querySelectorAll('[data-k]').forEach(inp => {
        w.nums[i][inp.dataset.k] = inp.value.trim();
      });
    });
    /* 号码在存进数据之前就洗干净：只留数字、剥掉开头的 0。
       后台爱填 0086... / +86 ... / 86 151 ... / 带空格横线都行，
       存下来的一定是 wa.me 能直接用的样子。
       （wa.me 官方要求纯数字，不接受 + 和 00 国际前缀） */
    w.nums.forEach(n => { n.number = waCleanAdmin(n.number); });
    /* 号码只剩空的就剔掉 —— 免得下拉里出现一个没号的选项 */
    w.nums = w.nums.filter(n => n.number);
    w.nums.forEach((n, i) => { if (!n.id) n.id = 'wa' + (i + 1); });
  }
  /* off 存的是「关掉」的那些，没勾的就是关掉 —— 跟开关语义相反，要反过来 */
  const off = [];
  document.querySelectorAll('[data-wa-on]').forEach(cb => {
    if (!cb.checked) off.push(cb.dataset.waOn);
  });
  w.off = off;
  document.querySelectorAll('[data-wa-use]').forEach(sel => {
    w.map[sel.dataset.waUse] = sel.value;
  });
  /* 老的单号字段同步一份，方便外部工具读 */
  if (w.nums[0]) {
    w.number = w.nums[0].number;
    w.defaultMessageAr = w.nums[0].msgAr || w.defaultMessageAr || '';
  }
}

/* ==========================================================================
   r21 新增：页脚链接后台配置
   --------------------------------------------------------------------------
   只管「快速链接」和「联系」两组（用户选了方案 B）。
   产品分类和行业继续自动生成 —— 以后后台加分类，页脚自动跟着长。
   三种条目：普通链接 / 产品分类 / 行业 / WhatsApp。
   ========================================================================== */
function renderFootAdmin() {
  const f = DB.site.footer || (DB.site.footer = {});
  const mk = (key, list) => {
    const host = document.getElementById(key);
    if (!host) return;
    host.innerHTML = (list || []).map((l, i) => `
      <div class="row-actions" style="gap:6px">
        <input class="inp" data-fk="${key}:${i}:labelAr" value="${esc(l.labelAr || '')}" placeholder="名称" style="flex:1;min-width:110px">
        <select class="inp" data-fk="${key}:${i}:type" style="width:auto;min-width:110px">
          <option value="link"${!l.cat && !l.sector && !l.fav && !l.wa ? ' selected' : ''}>普通链接</option>
          <option value="cat"${l.cat ? ' selected' : ''}>产品分类</option>
          <option value="sector"${l.sector ? ' selected' : ''}>行业</option>
          <option value="fav"${l.fav ? ' selected' : ''}>我的收藏</option>
          <option value="wa"${l.wa ? ' selected' : ''}>WhatsApp</option>
        </select>
        <input class="inp" data-fk="${key}:${i}:href" value="${esc(l.href || '')}" placeholder="https://..." dir="ltr" style="flex:1;min-width:130px">
        <button type="button" class="mini danger" data-del-ft="${key}:${i}">删除</button>
      </div>`).join('') || '<p class="hint" style="margin:0">还没有链接 — 会用默认的。</p>';
  };
  const qt = document.getElementById('ft-quicktitle');
  if (qt) qt.value = f.quickTitleAr || '';
  const ct = document.getElementById('ft-contacttitle');
  if (ct) ct.value = f.contactTitleAr || '';
  mk('ft-quick', f.quickLinks);
  mk('ft-contact', f.contactLinks);
}

function collectFootAdmin() {
  const f = DB.site.footer || (DB.site.footer = {});
  const qt = document.getElementById('ft-quicktitle');
  if (qt) f.quickTitleAr = qt.value.trim();
  const ct = document.getElementById('ft-contacttitle');
  if (ct) f.contactTitleAr = ct.value.trim();
  ['ft-quick', 'ft-contact'].forEach(key => {
    const host = document.getElementById(key);
    if (!host) return;
    const out = [];
    host.querySelectorAll('[data-fk]').forEach(inp => {
      const [, idx, field] = inp.dataset.fk.split(':');
      const i = +idx;
      if (!out[i]) out[i] = { labelAr: '', href: '' };
      const v = inp.value.trim();
      if (field === 'type') {
        delete out[i].cat; delete out[i].sector; delete out[i].fav; delete out[i].wa;
        if (v === 'wa') out[i].wa = true;
        else if (v === 'fav') out[i].fav = true;
        else if (v === 'cat') out[i].cat = 'cat';
        else if (v === 'sector') out[i].sector = 'sec';
      } else {
        out[i][field] = v;
      }
    });
    const clean = out.filter(x => x && (x.labelAr || x.wa));
    if (key === 'ft-quick') f.quickLinks = clean;
    else f.contactLinks = clean;
  });
}

function renderSwatches() {
  ['primary', 'gold'].forEach(k => {
    const box = document.getElementById('sw-' + k);
    const inp = document.getElementById('s-' + k);
    if (!box) return;
    const cur = (inp.value || '').toLowerCase();
    box.innerHTML = SWATCHES[k].map(c =>
      `<button type="button" class="sw-btn ${c.toLowerCase() === cur ? 'on' : ''}"
               data-sw="${k}" data-c="${c}" style="background:${c}" title="${c}"></button>`
    ).join('');
  });
}
function bindTheme() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-sw]');
    if (!b) return;
    const inp = document.getElementById('s-' + b.dataset.sw);
    if (!inp) return;
    inp.value = b.dataset.c;
    renderSwatches();
  });
  ['s-primary', 's-gold'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderSwatches);
  });
  const rst = document.getElementById('theme-reset');
  if (rst) rst.onclick = () => {
    document.getElementById('s-primary').value = DEFAULT_THEME.primary;
    document.getElementById('s-gold').value = DEFAULT_THEME.gold;
    renderSwatches();
  };
}

function renderSettings() {
  const s = DB.site;
  document.getElementById('s-brand').value = s.brand.nameAr;
  document.getElementById('s-logo').value = s.brand.logoTextAr;
  document.getElementById('s-tagline').value = s.brand.taglineAr || '';
  document.getElementById('s-wamsg').value = (s.whatsapp || {}).defaultMessageAr || '';
  document.getElementById('s-email').value = s.contact.email;
  document.getElementById('s-city').value = s.contact.cityAr;
  document.getElementById('s-hours').value = s.contact.workingHoursAr || '';
  Object.keys(UI_COUNT_KEYS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = (DB.tax.ui && DB.tax.ui[UI_COUNT_KEYS[id]]) || '0';
  });
  const sc = document.getElementById('s-h-scene');
  if (sc) sc.checked = String((DB.tax.ui || {}).homeSceneEnabledAr || '0') === '1';

  /* 社媒渠道：填了才显示 */
  const soc = s.social || {};
  const socMap = { 's-ig': 'instagram', 's-fb': 'facebook', 's-li': 'linkedin',
                   's-tt': 'tiktok', 's-sc': 'snapchat', 's-x': 'x', 's-tg': 'telegram' };
  Object.keys(socMap).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = soc[socMap[id]] || '';
  });

  renderWaAdmin();
  renderFootAdmin();

document.getElementById('s-hero').value = s.hero.titleAr.replace(/<[^>]+>/g, '');
  const sl = document.getElementById('s-lead');
  if (sl) sl.value = s.hero.leadAr || '';
  document.getElementById('s-cta').value = s.cta.titleAr;
  document.getElementById('s-ctabody').value = s.cta.bodyAr;

  const th = s.theme || {};
  document.getElementById('s-primary').value = th.primary || DEFAULT_THEME.primary;
  document.getElementById('s-gold').value = th.gold || DEFAULT_THEME.gold;
  renderSwatches();
  renderBanners();
  renderStats();
  if (typeof renderBlocks === 'function') renderBlocks();
}

function bindSettings() {
  document.getElementById('save-site').onclick = async () => {
    const g = id => document.getElementById(id).value.trim();
    DB.site.brand.nameAr = g('s-brand');
    DB.site.brand.logoTextAr = g('s-logo');
    DB.site.brand.taglineAr = g('s-tagline');
    collectWaAdmin();
    const wamsg = document.getElementById('s-wamsg');
    DB.site.whatsapp.defaultMessageAr = wamsg ? wamsg.value.trim() : '';
    DB.site.contact.email = g('s-email');
    DB.site.contact.cityAr = g('s-city');
    DB.site.contact.workingHoursAr = g('s-hours');
    /* 社媒渠道：存进 site.social，空的存空串（前台不显示） */
    DB.site.social = DB.site.social || {};
    const socMap = { 's-ig': 'instagram', 's-fb': 'facebook', 's-li': 'linkedin',
                     's-tt': 'tiktok', 's-sc': 'snapchat', 's-x': 'x', 's-tg': 'telegram' };
    Object.keys(socMap).forEach(id => {
      const el = document.getElementById(id);
      if (el) DB.site.social[socMap[id]] = el.value.trim();
    });
    collectFootAdmin();
    /* 首页板块数量：0 = 隐藏该区块 */
    if (!DB.tax.ui) DB.tax.ui = {};
    Object.keys(UI_COUNT_KEYS).forEach(id => {
      const el = document.getElementById(id);
      if (el) DB.tax.ui[UI_COUNT_KEYS[id]] = String(parseInt(el.value, 10) || 0);
    });
    const sc2 = document.getElementById('s-h-scene');
    if (sc2) DB.tax.ui.homeSceneEnabledAr = sc2.checked ? '1' : '0';

    DB.site.hero.titleAr = g('s-hero');
    DB.site.hero.leadAr = g('s-lead');
    DB.site.cta.titleAr = g('s-cta');
    DB.site.cta.bodyAr = g('s-ctabody');
    /* 颜色 */
    DB.site.theme = {
      primary: g('s-primary') || DEFAULT_THEME.primary,
      gold: g('s-gold') || DEFAULT_THEME.gold,
    };
    /* banner：存之前把空的踢掉 */
    DB.site.hero.banners = getBanners().filter(b => b && (b.image || b.titleAr || b.subAr));
    /* 统计数字：两栏都得有值才留，缺一边的丢掉 */
    DB.site.stats = getStats().filter(s => s.value && s.labelAr);
    /* 三个新板块（证书/流程/案例）—— 头部文案收一下，顺带踢掉空项 */
    if (typeof collectBlocks === 'function') collectBlocks();
    /* 板块数量存在 tax.ui 里，不在 site 里 —— 只存 site 的话这几个数字会丢。
       所以设置页保存要连 tax 一起存。
       顺序：先存 site（主要数据），再存 tax（分类 + 文案）。
       两个都成功才算成功，不然会出现「设置说保存了但数量没变」。 */
    const okSite = await guard('设置已保存', () => saveSite(DB.site));
    await guard('设置已保存', () => saveTaxonomy(DB.tax));
    /* 存完重画一次：号码和页脚链接的 DOM 要反映最新的内存值，
       否则删掉的号码在下拉里还留着。 */
    renderWaAdmin();
    renderFootAdmin();
  };

  /* ---- 号码增删 ---- */
  const waAdd = document.getElementById('wa-add');
  if (waAdd) waAdd.onclick = () => {
    collectWaAdmin();
    const w = DB.site.whatsapp;
    const n = w.nums.length + 1;
    w.nums.push({ id: 'wa' + n, nameAr: '号码 ' + n, number: '', msgAr: '' });
    renderWaAdmin();
  };

  /* ---- 页脚链接增删 ---- */
  const ftAdd = (btnId, field) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.onclick = () => {
      collectFootAdmin();
      const f = DB.site.footer;
      f[field].push({ labelAr: '', href: '' });
      renderFootAdmin();
    };
  };
  ftAdd('ft-quick-add', 'quickLinks');
  ftAdd('ft-contact-add', 'contactLinks');

  /* 线上模式下没有"恢复原状"这回事——数据在服务器上，本地按钮只清浏览器缓存 */
  const resetBtn = document.getElementById('reset-data');
  if (isOnline()) {
    resetBtn.textContent = '清除浏览器缓存';
    resetBtn.onclick = () => {
      resetLocal();
      toast('已清浏览器缓存 — 正在重新加载页面');
      setTimeout(() => location.reload(), 900);
    };
  } else {
    resetBtn.onclick = async () => {
      if (!confirm('恢复到原始数据？\n会删掉你在这个浏览器里的全部改动。\n\n（撤不回来）')) return;
      resetLocal();
      await loadAll();
      renderList(); renderCats(); renderSettings();
      toast('已恢复');
    };
  }
}

/* ---------- 数据升级 ----------
   线上 Blobs 里的旧数据缺 theme、hero.banners、分类图这些新字段。
   重拖文件夹只更代码不更数据，所以第一次进后台要提示补一次。
   这里调的是 netlify/functions/migrate.js，只做合并不覆盖。 */
function needsUpgrade() {
  const s = DB.site || {};
  /* ui 缺字段也要提示：改版新加的文案（新板块标题之类）
     补不进去的话，页面上就是一片空白标题，
     而后台看着像「已经填好了」，最难查。 */
  const ui = DB.tax?.ui || {};
  const missingWords = WORD_GROUPS.some(g => g.items.some(it => !(it.key in ui)));
  return !s.theme ||
         !Array.isArray(s.hero?.banners) ||
         !(DB.tax.categories || []).every(c => 'image' in c) ||
         !Array.isArray(DB.tax.materials) ||
         !DB.products.every(p => Array.isArray(p.materialIds)) ||
         missingWords;
}

async function runUpgrade() {
  const btn = document.getElementById('btn-upgrade');
  const msg = document.getElementById('upgrade-msg');
  btn.disabled = true;
  msg.textContent = '正在更新…';
  try {
    const res = await fetch(AR_BASE + 'api/migrate', {
      method: 'POST',
      headers: adminHeaders(),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j.ok === false) throw new Error(j.error || 'api error');

    msg.textContent = '好。正在重新加载…';
    /* 后台缓存了旧数据，必须重新拉一遍，不然看到的还是补之前的 */
    _cache = {};
    await loadAll();
    renderList(); renderCats(); renderSettings(); renderBanners(); renderWords();
    document.getElementById('upgrade-box').hidden = true;
    toast('数据已更新');
  } catch (e) {
    const m = (e && e.message) || String(e);
    /* 404 说明这个函数还没部署上去 —— 重新拖一次文件夹就好 */
    msg.textContent = /404/.test(m)
      ? '这个接口不存在 — 把项目文件夹重新拖到 Netlify 上传，再试一次'
      : '失败：' + m;
    btn.disabled = false;
  }
}

/* ---------- 导出备份 ---------- */
function bindExport() {
  document.getElementById('export-all').onclick = () => {
    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(),
      mode: isOnline() ? 'online' : 'local',
      products: DB.products, categories: DB.tax, site: DB.site
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'site-data-backup.json';
    a.click();
    toast(isOnline() ? '备份已下载' : '已下载');
  };
}

/* ---------- 启动 ---------- */
async function initAdmin() {
  bindConfirm();
  await loadAll();
  bindList();
  bindEditor();
  bindCats();
  bindBanners();
  bindTheme();
  bindStats();
  bindWords();
  bindSettings();
  bindExport();
  bindGate();
  /* 数据是旧的就提示补一次。补完把按钮收起来，别一直杵在那儿。 */
  if (needsUpgrade()) {
    document.getElementById('upgrade-box').hidden = false;
    document.getElementById('btn-upgrade').onclick = runUpgrade;
  }
  renderList();
  renderCats();
  renderBanners();
  renderWords();
  renderSettings();
  /* ★ r22 修复：bindBlocks() 必须排在 renderSettings() 之后。
     设置页那三块（认证资质 / 定制流程 / 客户案例）的 DOM 是
     renderSettings() → renderBlocks() → renderCerts() 等
     用 innerHTML 生成的。原来 bindBlocks() 排在 renderSettings() 前面，
     那一刻 DOM 还是空的，querySelectorAll 找到 0 个 input，
     于是设置页的图片上传从来没绑上过 —— 大哥点了没反应、也没提示。
     顺序反了就是这样。 */
  bindBlocks();

  document.getElementById('add-product').onclick = () => openEditor(null);
  document.getElementById('q-filter').addEventListener('input', e => { filter.q = e.target.value; renderList(); });
  document.getElementById('cat-filter').addEventListener('change', e => { filter.cat = e.target.value; renderList(); });
  document.getElementById('show-filter').addEventListener('change', e => { filter.show = e.target.value; renderList(); });

  /* 筛选下拉的选项依赖分类数据，必须在绑定之后填充 */
  document.getElementById('cat-filter').innerHTML =
    `<option value="">全部分类</option>` +
    DB.tax.categories.map(c => `<option value="${esc(c.id)}">${esc(c.emoji)} ${esc(c.nameAr)}</option>`).join('');

  document.querySelectorAll('.tabs button').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('on'));
      document.querySelectorAll('.panel').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      document.getElementById('p-' + b.dataset.p).classList.add('on');
    };
  });
}

/* ---------- 从前台跳过来（r23） ----------
   大哥要「前台和后台一起看到，点前台就跳到后台改那块」。
   前台首页 hover 板块时会浮出一个「编辑」按钮，点它跳到
     admin/?p=settings&at=hero-stats-box
   这里负责：切到 ?p= 那个分区 → 等 DOM 画完 → 把 ?at= 那个区块
   滚到中间并高亮两秒，一眼就看到要改哪儿。
   闸门没过（没填密钥）时先不跳，等过了闸门再补跳，
   不然填完密钥就停在首页，白跳一次。 */
function jumpFromFront() {
  const q = new URLSearchParams(location.search);
  const p = q.get('p');
  if (!p) return;

  /* 前台点「编辑」跳过来时，sessionStorage 里存着前台地址。
     顶部挂一条「回到前台看效果」，改完能一键回去对照。
     （这行原来写在前台的 editjump.js 里 —— 后台不加载那个文件，等于没写。） */
  try {
    const back = sessionStorage.getItem('ej_back');
    if (back && !document.querySelector('.edit-backbar')) {
      const bar = document.createElement('div');
      bar.className = 'edit-backbar';
      bar.innerHTML = '<a class="eb-link" href="../../' + back.replace(/^\//, '') + '">'
                    + '← 回到前台看效果</a>'
                    + '<span class="eb-tip">改完记得点「保存」</span>';
      document.body.insertBefore(bar, document.body.firstChild);
      sessionStorage.removeItem('ej_back');
    }
  } catch (x) {}

  const tab = document.querySelector(`.tabs button[data-p="${p}"]`);
  const panel = document.getElementById('p-' + p);
  if (!tab || !panel) return;

  document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('on'));
  document.querySelectorAll('.panel').forEach(x => x.classList.remove('on'));
  tab.classList.add('on');
  panel.classList.add('on');

  const at = q.get('at');
  if (!at) return;
  /* 渲染是同步的，但保险起见等一帧，别跟 innerHTML 抢 */
  setTimeout(() => {
    const el = document.getElementById(at) || document.querySelector(at);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('edit-here');
    setTimeout(() => el.classList.remove('edit-here'), 2600);
  }, 120);
}
/* ---------- 密钥闸门 ----------
   线上模式 + 设了 ADMIN_TOKEN 时，进后台要先填密钥。
   密钥存在浏览器里，之后就不用再填。 */
function showGate(msg) {
  document.getElementById('gate').classList.add('on');
  document.getElementById('gate-err').textContent = msg || '';
  setTimeout(() => document.getElementById('gate-token').focus(), 100);
}
function hideGate() {
  document.getElementById('gate').classList.remove('on');
}
function bindGate() {
  if (document.getElementById('gate-ok').dataset.bound) return;
  document.getElementById('gate-ok').dataset.bound = '1';

  const btn = document.getElementById('gate-ok');
  const inp = document.getElementById('gate-token');
  const submit = async () => {
    const v = inp.value.trim();
    if (!v) { document.getElementById('gate-err').textContent = '请输入密码'; return; }
    setAdminToken(v);
    inp.value = '';
    /* 用 /api/config 真正验一次密钥。
       不能用 loadAll()——那是读数据，不需要密钥，填错也会「通过」。 */
    try {
      const gate = await getAdminGate();
      if (gate.needToken) throw new Error('密码不对');
      if (gate.reason === 'not_configured') {
        setAdminToken('');
        document.getElementById('gate-err').textContent =
          '服务器上还没设管理密码 — 去 Netlify 设置里加 ADMIN_TOKEN';
        return;
      }
      await loadAll();
      renderList(); renderCats(); renderSettings();
      hideGate();
      /* 从前台跳过来的：闸门过了才补跳，不然填完密码停在首页白跳一次 */
      if (typeof jumpFromFront === 'function') setTimeout(jumpFromFront, 260);
    } catch (e) {
      setAdminToken('');
      const m = (e && e.message) || String(e);
      if (/401|غير مصرح|غير صحيح/.test(m)) {
        document.getElementById('gate-err').textContent = '密码不对';
      } else if (/Failed to fetch|NetworkError/i.test(m)) {
        document.getElementById('gate-err').textContent = '连不上服务器';
      } else {
        document.getElementById('gate-err').textContent = '错误：' + m;
      }
    }
  };
  btn.onclick = submit;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

initAdmin()
  .then(async () => {
    /* 读数据不需要密钥，所以 initAdmin 一定成功。
       得主动问服务器「要不要填密钥」，填了才把闸门收起来。
       以前写成读完就hideGate()，导致密钥框从来没出现过，没地方填。 */
    const gate = await getAdminGate();
    if (gate.needToken) {
      showGate('请输入管理密码以继续');
    } else if (gate.reason === 'not_configured') {
      showGate('服务器上还没设管理密码 — 去 Netlify 设置里加 ADMIN_TOKEN，然后重试');
    } else {
      hideGate();
      /* 本地模式 / 已记住密钥：直接跳，不用等闸门 */
      if (typeof jumpFromFront === 'function') setTimeout(jumpFromFront, 200);
    }
  })
  .catch(async e => {
    const msg = (e && e.message) || String(e);
    if (isOnline() && /401|غير مصرح/.test(msg)) {
      /*密钥不对，或压根还没填 —— 一律弹闸门*/
      showGate('请输入管理密码以继续');
    } else if (isOnline() && (await getAdminGate()).needToken) {
      showGate('请输入管理密码以继续');
    } else {
      const box = document.getElementById('list');
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
      const help = isOnline()
        ? '确认 Netlify Functions 已启用，并且网站在同一个域名下。'
        : '确认 data/ 文件夹存在，并且你是通过服务器打开的页面（不是直接双击 html 文件）。';
      document.getElementById('p-products').innerHTML =
        `<h1>数据加载失败</h1>
         <div class="tbl-wrap" style="padding:26px">
           <p style="color:#a3402f;font-weight:700;margin-bottom:12px">${esc(msg)}</p>
           <p style="color:var(--ink-3);line-height:1.9">${esc(help)}</p>
         </div>`;
      document.getElementById('p-products').classList.add('on');
    }
    console.error('[initAdmin]', msg);
  });

/* 已保存过密钥就自动带上，后台直接进 */
if (getAdminToken()) { /* api.js 的 adminHeaders 会自动读取 */ }

/* ---------- 三个新板块：认证资质 / 定制流程 / 客户案例 ----------
   数据挂在 DB.site.certifications / .process / .clients，
   跟 saveSite 一起提交（前台 blockData() 读的就是这三个字段）。

   为什么不用表格：这三块每项字段多（名称/机构/编号/说明/两张图），
   挤进表格每格只 60px 宽，根本没法看。证书字段少用表格，
   流程和案例用卡片块，一块一项，跟后台的 banner 管理一个路子。 */

/* 保证三块都存在 —— 老数据（大哥现在线上的）里根本没有这些字段，
   直接 DB.site.certifications.id 会抛错把整个设置页搞白。 */
function blocksInit() {
  const s = DB.site;
  /* 工艺：首页第一个选择入口。数据挂在 site.crafts.items ——
     跟证书/流程/案例一个模式，复用现成的存储、上传、保存链路。 */
  if (!s.crafts) s.crafts = { kickerAr: '', titleAr: '', leadAr: '', items: [] };
  if (!s.crafts.items) s.crafts.items = [];
  if (!s.certifications) s.certifications = { kickerAr: '', titleAr: '', leadAr: '', items: [] };
  if (!s.certifications.items) s.certifications.items = [];
  if (!s.process) s.process = { kickerAr: '', titleAr: '', leadAr: '', steps: [] };
  if (!s.process.steps) s.process.steps = [];
  if (!s.clients) s.clients = { kickerAr: '', titleAr: '', leadAr: '', items: [] };
  if (!s.clients.items) s.clients.items = [];
  if (!s.faqs) s.faqs = { kickerAr: '', titleAr: '', leadAr: '', items: [] };
  if (!s.faqs.items) s.faqs.items = [];
}

/* 小工具：一张图的位（logo / 合影 / 证书图） */
function imgSlot(item, field, setField) {
  const src = item[field] || '';
  return `<div class="imgcell" data-field="${field}" data-set="${setField}">
    <div class="tp">${src ? `<img src="${esc(src)}" alt="">` : '<span class="ico">+</span>'}</div>
    <input type="text" data-k="${field}" value="${esc(src)}" placeholder="图片路径">
    <label class="file"><input type="file" accept="image/*"><span>上传</span></label>
  </div>`;
}

/* ---------- ⓪ 工艺（卡片块） ---------- */

/* 工艺分类。前台按这个顺序分组展示。 */
const CRAFT_GROUPS = [
  { v: 'print', ar: '印刷' },
  { v: 'foil', ar: '烫印' },
  { v: 'relief', ar: '立体' },
  { v: 'gloss', ar: '光效' },
  { v: 'special', ar: '特殊' },
];

function renderCrafts() {
  blocksInit();
  const b = DB.site.crafts;
  const g = id => document.getElementById(id);
  if (g('cf-kicker')) g('cf-kicker').value = b.kickerAr || '';
  if (g('cf-title')) g('cf-title').value = b.titleAr || '';
  if (g('cf-lead')) g('cf-lead').value = b.leadAr || '';
  const host = g('craft-list');
  if (!host) return;
  host.innerHTML = (b.items || []).map((c, i) => `
    <div class="blk-card" data-i="${i}">
      <div class="blk-head">
        <b>${i + 1}</b>
        <input data-k="nameAr" value="${esc(c.nameAr || '')}" placeholder="工艺名（阿语，前台卡片上显示这个）">
        <input class="w60" data-k="sort" value="${c.sort || i + 1}" title="排序">
        <label class="ck" style="margin:0"><input type="checkbox" data-k="published"${c.published === false ? '' : ' checked'}> 上架</label>
        <button class="mini danger" data-delcraft="${i}">删除</button>
      </div>
      <div class="blk-body">
        ${imgSlot(c, 'image', 'imageSet')}
        <div class="fgrid">
          <label>中文名称<span class="hint">仅供你自己核对，不显示在网站上</span>
            <input data-k="nameZh" value="${esc(c.nameZh || '')}" placeholder="烫金"></label>
          <label>英文名<span class="hint">给网址用，比如 gold-foil</span>
            <input data-k="nameEn" value="${esc(c.nameEn || '')}" dir="ltr" placeholder="gold-foil"></label>
          <label>分类
            <select data-k="group">
              ${CRAFT_GROUPS.map(x => `<option value="${x.v}"${(c.group || 'special') === x.v ? ' selected' : ''}>${x.ar}</option>`).join('')}
            </select>
          </label>
          <label class="full">一句话定义<span class="hint">首屏用，一句话说清是什么</span>
            <input data-k="leadAr" value="${esc(c.leadAr || '')}"></label>
          <label class="full">详细说明<span class="hint">这是什么 / 什么效果 / 长什么样</span>
            <textarea data-k="descAr" rows="3">${esc(c.descAr || '')}</textarea></label>
          <label class="full">YouTube 视频<span class="hint">选填。把 YouTube 链接整段粘进来就行；不填前台不显示这一块</span>
            <input data-k="videoUrl" value="${esc(c.videoUrl || '')}" dir="ltr" placeholder="https://www.youtube.com/watch?v=..."></label>
          <label>起订量<input data-k="moqAr" value="${esc(c.moqAr || '')}" placeholder="例如 10,000 个"></label>
          <label>工期<input data-k="leadTimeAr" value="${esc(c.leadTimeAr || '')}" placeholder="例如 15-20 天"></label>
          <label>可用材质<input data-k="materialsAr" value="${esc(c.materialsAr || '')}" placeholder="例如 白卡 / 牛皮纸"></label>
          <label>限制<input data-k="limitsAr" value="${esc(c.limitsAr || '')}" placeholder="例如 深色纸要先打白底"></label>
        </div>
      </div>
    </div>`).join('');
  /* innerHTML 重建过了，补一次图片上传绑定（跟其它块一样） */
  bindImgCells(document.getElementById('p-settings'));
}

/* ---------- ① 认证资质 ---------- */
function renderCerts() {
  blocksInit();
  const b = DB.site.certifications;
  document.getElementById('c-kicker').value = b.kickerAr || '';
  document.getElementById('c-title').value = b.titleAr || '';
  document.getElementById('c-lead').value = b.leadAr || '';
  document.getElementById('cert-list').innerHTML = (b.items || []).map((c, i) => `
    <tr data-i="${i}">
      <td>${imgSlot(c, 'image', 'imageSet')}</td>
      <td><input data-k="nameAr" value="${esc(c.nameAr || '')}"></td>
      <td><input data-k="orgAr" value="${esc(c.orgAr || '')}" placeholder="发证机构">
          <input data-k="descAr" value="${esc(c.descAr || '')}" placeholder="简要说明" style="margin-top:5px">
          <input data-k="file" value="${esc(c.file || '')}" placeholder="证书文件链接（选填）" style="margin-top:5px"></td>
      <td><input data-k="noAr" value="${esc(c.noAr || '')}" dir="ltr"></td>
      <td><input data-k="dateAr" value="${esc(c.dateAr || '')}" placeholder="2026-12"></td>
      <td class="ctr"><input class="w60" data-k="sort" value="${c.sort || i + 1}"></td>
      <td class="ctr"><button class="mini danger" data-del="${i}">删除</button></td>
    </tr>`).join('');
  /* r22：innerHTML 重建过了，补一次图片上传的绑定 */
  bindImgCells(document.getElementById('p-settings'));
}

/* ---------- ② 定制流程（卡片块） ---------- */
function renderProcAdmin() {
  blocksInit();
  const b = DB.site.process;
  document.getElementById('p-kicker').value = b.kickerAr || '';
  document.getElementById('p-title').value = b.titleAr || '';
  document.getElementById('p-lead').value = b.leadAr || '';
  document.getElementById('proc-list-admin').innerHTML = (b.steps || []).map((s, i) => `
    <div class="blk-card" data-i="${i}">
      <div class="blk-head">
        <b>${s.n || (i + 1)}</b>
        <input data-k="titleAr" value="${esc(s.titleAr || '')}" placeholder="步骤标题">
        <input class="w60" data-k="sort" value="${s.sort || i + 1}" title="排序">
        <button class="mini danger" data-delstep="${i}">删除</button>
      </div>
      <div class="blk-body">
        ${imgSlot(s, 'image', 'imageSet')}
        <textarea data-k="bodyAr" rows="2" placeholder="这一步的说明">${esc(s.bodyAr || '')}</textarea>
      </div>
    </div>`).join('');
  /* r22：innerHTML 重建过了，补一次图片上传的绑定 */
  bindImgCells(document.getElementById('p-settings'));
}

/* ---------- ③ 客户案例（卡片块，两张图） ---------- */
function renderClientsAdmin() {
  blocksInit();
  const b = DB.site.clients;
  document.getElementById('cl-kicker').value = b.kickerAr || '';
  document.getElementById('cl-title').value = b.titleAr || '';
  document.getElementById('cl-lead').value = b.leadAr || '';
  document.getElementById('client-list-admin').innerHTML = (b.items || []).map((c, i) => `
    <div class="blk-card" data-i="${i}">
      <div class="blk-head">
        <input data-k="nameAr" value="${esc(c.nameAr || '')}" placeholder="客户名称">
        <input data-k="subAr" value="${esc(c.subAr || '')}" placeholder="动作类型">
        <input class="w60" data-k="sort" value="${c.sort || i + 1}" title="排序">
        <button class="mini danger" data-delcli="${i}">删除</button>
      </div>
      <div class="blk-body">
        <div style="display:flex;gap:10px">
          <div style="flex:0 0 130px">${imgSlot(c, 'logo', 'logoSet')}</div>
          <div style="flex:0 0 190px">${imgSlot(c, 'image', 'imageSet')}</div>
          <textarea data-k="bodyAr" rows="3" placeholder="合作细节" style="flex:1">${esc(c.bodyAr || '')}</textarea>
        </div>
      </div>
    </div>`).join('');
  const cnt = document.getElementById('client-count');
  if (cnt) cnt.textContent = (b.items || []).length + ' ' + (DB.tax?.ui?.clientsCntAr || '客户');
  /* r22：innerHTML 重建过了，补一次图片上传的绑定 */
  bindImgCells(document.getElementById('p-settings'));
}

/* ---------- ④ 常见问题（问答） ----------
   字段最少：问题 + 答案 + 顺序。所以不用 blk-card 那套图位，
   一行标题框 + 一个多行答案框，横向排。 */
function renderFaqAdmin() {
  blocksInit();
  const b = DB.site.faqs;
  document.getElementById('fq-kicker').value = b.kickerAr || '';
  document.getElementById('fq-title').value = b.titleAr || '';
  document.getElementById('fq-lead').value = b.leadAr || '';
  document.getElementById('faq-list-admin').innerHTML = (b.items || []).map((q, i) => `
    <div class="blk-card" data-i="${i}">
      <div class="blk-head">
        <input data-k="qAr" value="${esc(q.qAr || '')}" placeholder="问题">
        <input class="w60" data-k="sort" value="${q.sort || i + 1}" title="排序">
        <button class="mini danger" data-delq="${i}">删除</button>
      </div>
      <div class="blk-body">
        <textarea data-k="aAr" rows="2" placeholder="回答">${esc(q.aAr || '')}</textarea>
      </div>
    </div>`).join('') || '<p class="hint">还没有问题 — 点「+ 增加问题」。</p>';
  const c = document.getElementById('faq-count');
  if (c) {
    const n = (b.items || []).length;
    const home = parseInt(DB.tax?.ui?.faqHomeCountAr, 10);
    c.textContent = n + ' ' + (DB.tax?.ui?.faqsCntAr || '问题')
      + ' — ' + (Number.isFinite(home) ? home : 3) + ' 个产品（首页会显示）';
  }
}

function renderBlocks() {
  renderCrafts();
  renderCerts();
  renderProcAdmin();
  renderClientsAdmin();
  renderFaqAdmin();
}

/* --------------------------------------------------------------------------
   图片上传绑定（r22 单独抽出来）
   --------------------------------------------------------------------------
   为什么要单独一个函数：设置页三块的列表是用 innerHTML 重建的，
   每次「+ 添加」「删除」都会重来一遍，新生成的 input 上不会有任何事件。
   所以这三处重绘之后都必须再调一次 bindImgCells()。

   为什么用 inp.onchange = fn 而不是 addEventListener：
   赋值形式是幂等的，重复调用同一个 input 只是覆盖，不会累积监听器；
   addEventListener 重复调用会叠加，触发一次上传跑好几遍。

   ★ 这里绝不能有「静默 return」。原来三处出错都是直接 return，
     大哥点下去既看不到成功也看不到失败，以为是网站坏了。
     现在每一处都要 toast 出到底卡在哪。 */
function bindImgCells(area) {
  if (!area) return;
  const num = v => parseInt(v, 10) || 0;

  [].forEach.call(area.querySelectorAll('.imgcell input[type=file]'), inp => {
    inp.onchange = async () => {
      /* 用户点了「选择文件」又取消 —— 这不是错误，别打扰他 */
      if (!inp.files || !inp.files[0]) return;

      const cell = inp.closest('.imgcell');
      const host = inp.closest('[data-i]');
      if (!cell || !host) {
        toast('这个上传格子没接上所属的条目，请刷新后台页面再试', true);
        return;
      }
      const field = cell.dataset.field, setField = cell.dataset.set;
      if (!field || !setField) {
        toast('上传格子缺字段配置，请刷新后台页面再试', true);
        return;
      }

      /* 找这个 imgcell 属于哪一块 */
      let item = null;
      if (host.closest('#craft-list')) item = DB.site.crafts.items[num(host.dataset.i)];
      else if (host.closest('#cert-list')) item = DB.site.certifications.items[num(host.dataset.i)];
      else if (host.closest('#proc-list-admin')) item = DB.site.process.steps[num(host.dataset.i)];
      else if (host.closest('#client-list-admin')) item = DB.site.clients.items[num(host.dataset.i)];
      if (!item) {
        toast('找不到这一条对应的数据（可能刚被删掉了），请刷新后台页面再试', true);
        return;
      }

      const f = inp.files[0];
      inp.disabled = true;
      const label = inp.closest('label.file');
      const old = label ? label.querySelector('span') : null;
      if (old) old.textContent = '上传中…';
      try {
        const r = await uploadImage(f);
        if (!r || !r.url) throw new Error('服务器没返回图片地址');
        item[field] = r.url;
        item[setField] = imgSetStr(r);
        const txt = cell.querySelector('input[type=text]');
        if (txt) txt.value = item[field];
        const tp = cell.querySelector('.tp');
        if (tp) tp.innerHTML = `<img src="${esc(item[field])}" alt="">`;
        toast('图片已上传 — 点「保存设置」才会生效');
      } catch (err) {
        console.error('[imgcell]', err);
        toast('图片上传失败：' + ((err && err.message) || err), true);
      }
      inp.disabled = false;
      inp.value = '';
      if (old) old.textContent = '上传';
    };
  });
}

/* 行内输入 → 写回 DB。field 指明是哪个数组的哪一项。 */
function bindBlocks() {
  const area = document.getElementById('p-settings');

  const num = v => parseInt(v, 10) || 0;

  /* 每个块挂的数据路径不一样（certifications.items / process.steps /
     clients.items），所以按块分别绑一次。 */
  const bindArr = (boxId, blockKey, arrKey) => {
    const box = document.getElementById(boxId);
    if (!box) return;
    box.addEventListener('input', e => {
      const k = e.target.dataset.k;
      if (!k) return;
      const host = e.target.closest('[data-i]');
      if (!host) return;
      const item = DB.site[blockKey][arrKey][num(host.dataset.i)];
      if (!item) return;
      /* checkbox 的 value 永远是 "on"，得读 checked ——
         工艺那个「上架」开关就是 checkbox，读 value 会把布尔写成字符串。 */
      if (e.target.type === 'checkbox') item[k] = e.target.checked;
      else item[k] = (k === 'sort' || k === 'n') ? num(e.target.value) : e.target.value;
      if (k === 'image' || k === 'logo') {
        const cell = host.querySelector(`.imgcell[data-field="${k}"]`);
        const tp = cell && cell.querySelector('.tp');
        if (tp) tp.innerHTML = e.target.value
          ? `<img src="${esc(e.target.value)}" alt="">` : '<span class="ico">+</span>';
      }
    });
  };
  bindArr('craft-list', 'crafts', 'items');
  bindArr('cert-list', 'certifications', 'items');
  bindArr('proc-list-admin', 'process', 'steps');
  bindArr('client-list-admin', 'clients', 'items');
  bindArr('faq-list-admin', 'faqs', 'items');

  /* 板块大标题/说明 */
  const headMap = [
    ['cf-kicker', 'crafts', 'kickerAr'], ['cf-title', 'crafts', 'titleAr'],
    ['cf-lead', 'crafts', 'leadAr'],
    ['c-kicker', 'certifications', 'kickerAr'], ['c-title', 'certifications', 'titleAr'],
    ['c-lead', 'certifications', 'leadAr'],
    ['p-kicker', 'process', 'kickerAr'], ['p-title', 'process', 'titleAr'],
    ['p-lead', 'process', 'leadAr'],
    ['cl-kicker', 'clients', 'kickerAr'], ['cl-title', 'clients', 'titleAr'],
    ['cl-lead', 'clients', 'leadAr'],
    ['fq-kicker', 'faqs', 'kickerAr'], ['fq-title', 'faqs', 'titleAr'],
    ['fq-lead', 'faqs', 'leadAr'],
  ];
  headMap.forEach(([id, blk, f]) => {
    const el = document.getElementById(id);
    if (el) el.oninput = () => { blocksInit(); DB.site[blk][f] = el.value; };
  });

  /* 图片上传 —— 三块共用一套。
     抽成独立函数，因为这三块每次增删都会 renderXxx() 用 innerHTML 重建 DOM，
     重建出来的 input 是全新的元素，onchange 不会自动继承，
     必须重绘完再 bindImgCells() 补一次。 */
  bindImgCells(area);

  /* 增 */
  document.getElementById('craft-add').onclick = () => {
    blocksInit();
    const b = DB.site.crafts;
    const n = b.items.length + 1;
    b.items.push({ id: nextId('craft-' + n),
      nameAr: '工艺 ' + n, nameEn: '', group: 'special',
      leadAr: '', descAr: '', image: '', imageSet: '',
      moqAr: '', leadTimeAr: '', materialsAr: '', limitsAr: '',
      sort: n, published: true });
    renderCrafts();
    /* 新加的卡片滚进视野 —— 免得大哥以为没加上，又点一次 */
    const cards = document.querySelectorAll('#craft-list .blk-card');
    const last = cards[cards.length - 1];
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  document.getElementById('cert-add').onclick = () => {
    blocksInit();
    const b = DB.site.certifications;
    b.items.push({ id: nextId('cert-' + (b.items.length + 1)),
      nameAr: '新证书', orgAr: '', noAr: '', dateAr: '',
      descAr: '', image: '', imageSet: '', file: '', sort: b.items.length + 1 });
    renderCerts();
  };
  document.getElementById('proc-add').onclick = () => {
    blocksInit();
    const b = DB.site.process;
    b.steps.push({ id: nextId('step-' + (b.steps.length + 1)),
      n: b.steps.length + 1, titleAr: '新步骤', bodyAr: '',
      image: '', imageSet: '', sort: b.steps.length + 1 });
    renderProcAdmin();
  };
  document.getElementById('faq-add').onclick = () => {
    blocksInit();
    const b = DB.site.faqs;
    b.items.push({ id: nextId('faq-' + (b.items.length + 1)),
      qAr: '新问题', aAr: '', sort: b.items.length + 1 });
    renderFaqAdmin();
  };
  document.getElementById('client-add').onclick = () => {
    blocksInit();
    const b = DB.site.clients;
    b.items.push({ id: nextId('client-' + (b.items.length + 1)),
      nameAr: '新客户', subAr: '', bodyAr: '',
      logo: '', logoSet: '', image: '', imageSet: '', sort: b.items.length + 1 });
    renderClientsAdmin();
  };

  /* 删 —— 每一条都要确认。这三块原来是点一下就没了的，
     手一滑删掉三步流程/一个客户案例，前台直接少一块，救不回来。 */
  area.addEventListener('click', async e => {
    let i = e.target.dataset.delcraft;
    if (i !== undefined) {
      if (!await askConfirm('删掉这个工艺？',
          '会从首页和工艺页一起消失，撤不回来。')) return;
      DB.site.crafts.items.splice(num(i), 1);
      return renderCrafts();
    }
    i = e.target.dataset.del;
    if (i !== undefined) {
      if (!await askConfirm('删掉这张证书？', '会从证书页面上消失，撤不回来。')) return;
      DB.site.certifications.items.splice(num(i), 1);
      return renderCerts();
    }
    i = e.target.dataset.delstep;
    if (i !== undefined) {
      if (!await askConfirm('删掉这一步？', '会从定制流程页面上消失，撤不回来。')) return;
      DB.site.process.steps.splice(num(i), 1);
      /* 编号要重排，不然删了中间一条后面编号会跳号 */
      DB.site.process.steps.forEach((s, k) => { s.n = k + 1; });
      return renderProcAdmin();
    }
    i = e.target.dataset.delcli;
    if (i !== undefined) {
      if (!await askConfirm('删掉这个客户？', '会从客户页面消失，撤不回来。')) return;
      DB.site.clients.items.splice(num(i), 1);
      return renderClientsAdmin();
    }
    i = e.target.dataset.delq;
    if (i !== undefined) {
      if (!await askConfirm('删掉这个问题？', '会从常见问题页面消失，撤不回来。')) return;
      DB.site.faqs.items.splice(num(i), 1);
      return renderFaqAdmin();
    }
  });
}

/* r21：WhatsApp 号码和页脚链接的删除。
   这两块在「网站设置」面板里，不是上面那个 area，
   所以要单独在 document 上挂事件委托。 */
document.addEventListener('click', async e => {
  const delWa = e.target.dataset.delWa;
  if (delWa === undefined) return;
  if (!await askConfirm('删掉这个号码？', '所有用它的地方都会一起消失。')) return;
  collectWaAdmin();
  const w = DB.site.whatsapp;
  const goneId = w.nums[num(delWa)] ? w.nums[num(delWa)].id : '';
  w.nums.splice(num(delWa), 1);
  if (!w.nums.length) w.nums.push({ id: 'general', nameAr: '一般咨询', number: '', msgAr: '' });
  /* 有位置正用这个号的话，改回第一个 —— 不能留个指向已删号的空引用 */
  Object.keys(w.map).forEach(k => { if (w.map[k] === goneId) w.map[k] = w.nums[0].id; });
  renderWaAdmin();
});

document.addEventListener('click', async e => {
  const dft = e.target.dataset.delFt;
  if (!dft) return;
  const [key, idx] = dft.split(':');
  if (!await askConfirm('删掉这条链接？', '会从页脚消失，撤不回来。')) return;
  collectFootAdmin();
  const field = key === 'ft-quick' ? 'quickLinks' : 'contactLinks';
  DB.site.footer[field].splice(num(idx), 1);
  renderFootAdmin();
});

/* 保存前把三块的头部文案收进 DB（输入框已经实时写了，这里兜底） */
function collectBlocks() {
  blocksInit();
  const g = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
  DB.site.crafts.kickerAr = g('cf-kicker');
  DB.site.crafts.titleAr  = g('cf-title');
  DB.site.crafts.leadAr   = g('cf-lead');
  DB.site.certifications.kickerAr = g('c-kicker');
  DB.site.certifications.titleAr  = g('c-title');
  DB.site.certifications.leadAr   = g('c-lead');
  DB.site.process.kickerAr = g('p-kicker');
  DB.site.process.titleAr  = g('p-title');
  DB.site.process.leadAr   = g('p-lead');
  DB.site.clients.kickerAr = g('cl-kicker');
  DB.site.clients.titleAr  = g('cl-title');
  DB.site.clients.leadAr   = g('cl-lead');
  /* 空标题的证书/步骤/案例直接踢掉 —— 免得前台出现一张空卡片 */
  /* 工艺同理：名字和一句话定义都空的，踢掉（前台卡片没内容可显示） */
  DB.site.crafts.items = (DB.site.crafts.items || [])
    .filter(x => (x.nameAr || '').trim() || (x.leadAr || '').trim());
  DB.site.certifications.items = (DB.site.certifications.items || [])
    .filter(x => (x.nameAr || '').trim() || (x.orgAr || '').trim());
  DB.site.process.steps = (DB.site.process.steps || [])
    .filter(x => (x.titleAr || '').trim() || (x.bodyAr || '').trim());
  DB.site.clients.items = (DB.site.clients.items || [])
    .filter(x => (x.nameAr || '').trim() || (x.subAr || '').trim());
  DB.site.faqs.kickerAr = g('fq-kicker');
  DB.site.faqs.titleAr  = g('fq-title');
  DB.site.faqs.leadAr   = g('fq-lead');
  /* 只剩空壳的（问题和答案都空）直接踢 —— 前台会渲染出一个空的三角块 */
  DB.site.faqs.items = (DB.site.faqs.items || [])
    .filter(x => (x.qAr || '').trim() || (x.aAr || '').trim());
}

window.blocksInit = blocksInit;
window.renderBlocks = renderBlocks;
window.bindBlocks = bindBlocks;
window.collectBlocks = collectBlocks;
window.renderFaqAdmin = renderFaqAdmin;
