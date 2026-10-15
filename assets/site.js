/* ==========================================================================
   site.js — 页面渲染公共部分
   导航、页脚、WhatsApp 链接、产品卡渲染。所有页面共用。
   ========================================================================== */

const WA_ICON = window.WA_ICON = `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.16c-.24.68-1.42 1.31-1.95 1.36-.53.05-1.02.24-3.45-.72-2.9-1.15-4.73-4.12-4.87-4.31-.14-.19-1.15-1.53-1.15-2.92 0-1.39.73-2.07 1-2.36.26-.29.57-.36.77-.36.19 0 .39 0 .56.01.19.01.43-.07.67.51.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.15.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.29.74 1.22 1.59 1.98 1.09.98 2.01 1.28 2.3 1.43.29.14.45.12.62-.07.17-.19.72-.84.91-1.13.19-.29.39-.24.65-.14.26.09 1.65.78 1.94.92.29.14.48.22.55.34.07.12.07.7-.17 1.38z"/></svg>`;
const SEARCH_ICON = window.SEARCH_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`;
const PLUS_ICON = window.PLUS_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
/* 「放大看」图标，详情页主图上那个角标 */
const ZOOM_ICON = window.ZOOM_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8.5v5M8.5 11h5"/></svg>`;

let CTX = {};   /* 全站共享数据：{site, tax, ui} */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ==========================================================================
   YouTube 链接识别（r29）
   --------------------------------------------------------------------------
   后台填链接的入口不止一处：工艺详情页（每条工艺一条）、
   首页的公司介绍视频（一条）。两边的解析规则必须一致，
   所以放这里共用，谁也别自己写一份正则。

   认这几种写法，带 &t=34s 之类的参数都不影响：
     youtube.com/watch?v=xxx  ·  youtu.be/xxx  ·  /embed/xxx
     /shorts/xxx              ·  直接填 11 位 id
   认不出（非 YouTube 链接、空值）→ 返回 '' → 调用方把那块藏起来。 */
function ytId(url) {
  const s = String(url == null ? '' : url).trim();
  if (!s) return '';
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/v\/)([\w-]{11})/);
  return m ? m[1] : '';
}

/* 顺手给全 { id, thumb, embed }。thumb 走 i.ytimg.com —— 纯图片，
   不拉播放器也不塞第三方 cookie；embed 是点了才用的地址。 */
function ytInfo(url) {
  const id = ytId(url);
  if (!id) return null;
  return {
    id: id,
    thumb: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg',
    embed: 'https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0',
  };
}
window.ytId = ytId;
window.ytInfo = ytInfo;

/* 把视频块挂到容器里。容器要先存在（可以是 hidden 的 section）。
   没有链接 / 链接认不出 → 不动 DOM，由调用方自己决定藏不藏。 */
function mountVideo(host, videoUrl, title) {
  if (!host) return false;
  const v = ytInfo(videoUrl);
  if (!v) return false;
  host.innerHTML = `
    <div class="yt-video" id="yt-video-box" role="button" tabindex="0"
         style="background-image:url('${v.thumb}')"
         data-embed="${esc(v.embed)}"
         aria-label="${esc(title || '')}">
      <span class="yt-video-play" aria-hidden="true"></span>
    </div>`;
  const box = host.querySelector('#yt-video-box');
  const play = () => {
    /* 点了才放 iframe —— 一开始就嵌的话，300KB 播放器加第三方 cookie
       白拉一遍，还可能拖慢首屏。 */
    box.innerHTML = `<iframe src="${esc(box.dataset.embed)}"
      title="${esc(title || '')}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen loading="lazy"></iframe>`;
    box.classList.add('yt-video-on');
    box.removeAttribute('role');
    box.removeAttribute('tabindex');
  };
  box.addEventListener('click', play);
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); }
  });
  return true;
}
window.mountVideo = mountVideo;

/* ==========================================================================
   WhatsApp 多号码（r21）
   --------------------------------------------------------------------------
   原来全站只有一个号码（site.whatsapp.number），所有按钮都指向它。
   现在改成多号码：
     wa.nums     —— 号码列表，每个可带名字和专属开场白
     wa.map      —— 每个位置用哪个号（waProduct / waGeneral 等键）
     wa.off      —— 哪些位置整体关掉（键名数组）
   老数据没有 nums/map/off，一律退回原来的单号行为，
   所以升级不会把现有站点搞坏。

   位置分配是有优先级的：一个位置被关掉就直接不显示；
   没关就用map 里指定的号；map 里也没配就用第一个号码。 */
const WA_PLACEMENTS = window.WA_PLACEMENTS = [
  /* 键名跟后台一致，on 是给人看的说明 */
  { key: 'waFab',        on: '右下角悬浮圆钮', onHint: '所有页面都有，永远悬停' },
  { key: 'waNav',        on: '顶栏按钮',     onHint: '页面顶部的那个' },
  { key: 'waDrawer',     on: '侧边抽屉底部', onHint: '打开三横线菜单后最下面' },
  { key: 'waProduct',    on: '产品卡/详情页/价格页', onHint: '带产品信息的这几个一起用一个号' },
  { key: 'waContactBtn', on: '联系页发送按钮', onHint: '联系表单那个' },
  { key: 'waFoot',       on: '底部联系区',   onHint: '最下面那一栏' },
];

/* --------------------------------------------------------------------------
   号码清洗：后台不管填成什么样，都能拼出正确的 wa.me 链接。
   --------------------------------------------------------------------------
   WhatsApp 官方要求 wa.me/ 后面只放「国家码 + 号码」的纯数字，
   不能有 +、空格、横线，也不能有 00 这个国际拨号前缀
   （官方给的错误示例就是 wa.me/+001-(XXX)XXXXXXX）。

   所以后台的号码框必须容错 —— 大哥很可能顺手写成 0086... 或 +86 ...。
   这里统一洗一遍：
     1. replace(/\D/g, '')  只留数字，+ 空格 横线 括号全去掉
     2. replace(/^0+/, '')   剥掉开头的 0
   第2 步为什么敢直接剥所有 0：国家码一律是 1~9 开头（1 美国 44 英国
   86 中国 966 沙特 971 阿联酋……），所以开头连续的 0 一定不是国家码的一部分。
   本地号码写法 015168250885 那个 0 是国内长途前缀，同样要去掉。 */
window.waClean = function waClean(raw) {
  return String(raw == null ? '' : raw).replace(/\D/g, '').replace(/^0+/, '');
};

/* 取号码列表。老格式 {number, defaultMessageAr} 会被包成 nums[0]，
   这样下面的代码只有一套，不用到处判「是新的还是老的」。 */
function waNums() {
  const wa = (CTX.site && CTX.site.whatsapp) || {};
  if (Array.isArray(wa.nums) && wa.nums.length) {
    return wa.nums.filter(n => waClean(n.number));
  }
  if (wa.number) {
    return [{ id: 'main', nameAr: 'عام', number: wa.number, msgAr: wa.defaultMessageAr || '' }];
  }
  return [];
}

/* 某位置该用哪个号。off 里列了就返回 null（= 这个位置不显示）。 */
function waNumFor(place) {
  const wa = (CTX.site && CTX.site.whatsapp) || {};
  if (Array.isArray(wa.off) && wa.off.indexOf(place) >= 0) return null;
  const nums = waNums();
  if (!nums.length) return null;
  const want = (wa.map && wa.map[place]) || 'general';
  return nums.find(n => n.id === want) || nums[0];
}

/* 位置是否要显示。号码没配也等于不显示。 */
function waOn(place) { return !!waNumFor(place); }

/* 生成链接。msg 显式传就用它（产品信息那种），
   没传就用号码自己的开场白，都没有就用通用那句。 */
function waLink(message, place) {
  const wa = (CTX.site && CTX.site.whatsapp) || {};
  const p = place || 'waGeneral';
  const n = waNumFor(p) || waNumFor('general') || waNums()[0];
  if (!n) return '#';
  const num = waClean(n.number);
  if (!num) return '#';
  const text = message || n.msgAr || wa.defaultMessageAr || '';
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

/* 产品类按钮：按用户要求走「通用咨询」那个号
   （waProduct 在后台映射到 general，所以这里传 waProduct）。 */
function waProductLink(product) {
  const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}product.html?id=${product.id}`;
  return waLink(
    `مرحباً، أريد الاستفسار عن منتج:\n${product.nameAr}\n\nرابط المنتج:\n${url}`,
    'waProduct'
  );
}

function catOf(id) { return (CTX.tax?.categories || []).find(c => c.id === id); }
function sectorOf(id) { return (CTX.tax?.sectors || []).find(s => s.id === id); }
/* 材料维度（第三个分类轴）。老数据没有这个表，返回空数组，
   调用方一律要能处理「一个材料都没有」的情况。 */
function materialOf(id) { return (CTX.tax?.materials || []).find(m => m.id === id); }
function materialsOf() { return CTX.tax?.materials || []; }

/* 工艺（r27）—— 数据在 site.crafts.items（后台「工艺」区管的），不在 taxonomy 里，
   所以单独取一份。只取上架的 —— 没上架的工艺点进去是空页，别摆出来。 */
function craftsOf() {
  const items = ((CTX && CTX.site && CTX.site.crafts) || {}).items || [];
  return items.filter(c => c && c.published !== false && c.nameAr)
    .slice().sort((a, b) => (a.sort || 99) - (b.sort || 99));
}

/* 按 id 取一条工艺 —— 产品页和列表页的标题都要用 */
function craftById(id) {
  return craftsOf().find(c => c.id === id) || null;
}

/* ---------- 三维筛选面板 ----------
   三个维度（产品 / 场景 / 材料）是并列的，可以同时选、互相叠加。
   每个维度内部是单选 —— 同一维度选两个等于「同时属于这两类」，
   包装品类里几乎没有这种产品，选了只会给用户一个空页面。 */
function filterPanel(cur, opts) {
  const tax = CTX.tax || {};
  const ui = tax.ui || {};
  const on = (a, b) => (a === b ? ' on' : '');
  /* 材料是多选（最多两个），高亮态要看数组里有没有它 */
  const on2 = (arr, v) => ((arr || []).indexOf(v) >= 0 ? ' on' : '');

  /* 产品维度 —— 后台没配图就退到 emoji，跟分类圆卡一个逻辑 */
  const catRow = (tax.categories || []).map(c => {
    const src = c.image || c.imageAr;
    return `<button class="fp-item fp-cat${on(cur.cat, c.id)}" data-f="cat" data-v="${esc(c.id)}"
      aria-pressed="${cur.cat === c.id}">
      ${src ? `<span class="fp-ic"><img src="${esc(src)}" alt="" loading="lazy"></span>`
            : `<span class="fp-ic fp-em">${esc(c.emoji || '')}</span>`}
      <span class="fp-t">${esc(c.nameAr)}</span>
    </button>`;
  }).join('');

  const secRow = (tax.sectors || []).map(s => {
    const src = s.image || s.imageAr;
    return `<button class="fp-item fp-cat${on(cur.sec, s.id)}" data-f="sec" data-v="${esc(s.id)}"
      aria-pressed="${cur.sec === s.id}">
      ${src ? `<span class="fp-ic"><img src="${esc(src)}" alt="" loading="lazy"></span>`
            : `<span class="fp-ic fp-em">${esc(s.emoji || '')}</span>`}
      <span class="fp-t">${esc(s.nameAr)}</span>
    </button>`;
  }).join('');

  const matRow = materialsOf().map(m => {
    const src = m.image || m.imageAr;
    return `<button class="fp-item fp-cat${on2(cur.mat, m.id)}" data-f="mat" data-v="${esc(m.id)}"
      aria-pressed="${(cur.mat || []).indexOf(m.id) >= 0}">
      ${src ? `<span class="fp-ic"><img src="${esc(src)}" alt="" loading="lazy"></span>`
            : `<span class="fp-ic fp-em">${esc(m.emoji || '')}</span>`}
      <span class="fp-t">${esc(m.nameAr)}</span>
    </button>`;
  }).join('');

  /* 工艺（r27）：跟材料一样多选（最多两个）。
     这一行只在这个材料/工艺术语真有产品用时才有意义，但空着也不算错 ——
     客户点进去看到空列表比看不到入口更糟，所以至少要有工艺才渲染这一组。 */
  const craftList = craftsOf();
  const craftRow = craftList.map(c => {
    const src = c.image || '';
    return `<button class="fp-item fp-cat${on2(cur.craft, c.id)}" data-f="craft" data-v="${esc(c.id)}"
      aria-pressed="${(cur.craft || []).indexOf(c.id) >= 0}">
      ${src ? `<span class="fp-ic"><img src="${esc(src)}" alt="" loading="lazy"></span>`
            : `<span class="fp-ic fp-em">\u2726</span>`}
      <span class="fp-t">${esc(c.nameAr)}</span>
    </button>`;
  }).join('');

  const clear = (cur.cat || cur.sec || (cur.mat || []).length
                 || (cur.craft || []).length)
    ? `<button class="fp-clear" data-f="clear">${esc(ui.clearAllAr || 'مسح الكل')}</button>` : '';

  return `
    <div class="filter-panel">
      <div class="fp-group">
        <div class="fp-head">
          <h3>${esc(ui.byProductAr || 'حسب المنتج')}</h3>
          ${cur.cat ? `<button class="fp-x" data-f="cat" data-v="">${esc(ui.removeAr || 'إزالة')}</button>` : ''}
        </div>
        <div class="fp-row">${catRow}</div>
      </div>
      <div class="fp-group">
        <div class="fp-head">
          <h3>${esc(ui.bySceneAr || 'حسب الاستخدام')}</h3>
          ${cur.sec ? `<button class="fp-x" data-f="sec" data-v="">${esc(ui.removeAr || 'إزالة')}</button>` : ''}
        </div>
        <div class="fp-row">${secRow}</div>
      </div>
      <div class="fp-group">
        <div class="fp-head">
          <h3>${esc(ui.byMaterialAr || 'حسب الخامة')}</h3>
          ${(cur.mat || []).length ? `<button class="fp-x" data-f="mat" data-v="">${esc(ui.removeAr || 'إزالة')}</button>` : ''}
        </div>
        <div class="fp-row">${matRow}</div>
      </div>
      ${craftList.length ? `
      <div class="fp-group">
        <div class="fp-head">
          <h3>${esc(ui.byCraftAr || 'حسب الطباعة')}</h3>
          ${(cur.craft || []).length ? `<button class="fp-x" data-f="craft" data-v="">${esc(ui.removeAr || 'إزالة')}</button>` : ''}
        </div>
        <div class="fp-row">${craftRow}</div>
      </div>` : ''}
      ${clear ? `<div class="fp-foot">${clear}</div>` : ''}
    </div>`;
}

/* 已选条件的标签条 —— 让买家随时知道自己筛了什么、怎么一键取消 */
function activeFilterTags(cur) {
  const ui = CTX.tax?.ui || {};
  const bits = [];
  const add = (kind, obj) => {
    if (!obj) return;
    bits.push(`<button class="fp-tag" data-f="${kind}" data-v="">
      ${esc(obj.nameAr)} <i aria-hidden="true">×</i></button>`);
  };
  add('cat', catOf(cur.cat));
  add('sec', sectorOf(cur.sec));
  (cur.mat || []).forEach(id => add('mat', materialOf(id)));
  /* 工艺（r27）：跟材料一样，每个已选的都要给一个能点掉的标签 */
  (cur.craft || []).forEach(id => add('craft', craftById(id)));
  if (!bits.length) return '';
  return `<div class="fp-tags">${bits.join('')}</div>`;
}

/* ---------- 导航 ----------
   顶栏方案 B：
   左边（RTL 里是「起始侧」）= 三横线 + 搜索
   中间 = 品牌名
   右边 = 收藏（红底白心 + 数字角标）
   桌面端保留文字导航，手机端收进抽屉。 */
/* 货币下拉的选项。
   默认币（AED）排第一并标「基准」，其余按海湾六国顺序排——
   顺序按地理和交易习惯排，不按汇率数字大小排。

   r22：原来每个 option 写的是「AED — الإمارات」这么一长串，
   原生 select 收起时显示的就是选中项那行字，所以页头那个货币按钮
   被撑得很宽、把旁边的搜索和菜单按钮挤出去了。
   r22 改：option 只留阿语货币简写（د.إ / ر.س）。

   r24：大哥还是嫌字多 ——「货币区域写的文字还是太多，只需要写 AED 或 SAR」。
   现在收起时显示的是「د.إ · أساسي」这种，阿语符号 + 基准标注反而更难认。
   改成收起时**只显示三字母代码**（AED / SAR / KWD…），这是国际通用写法，
   阿拉伯客户一眼就认得.country 名挪到 data-full，展开时才补上。
   宽度也跟着从 62px 收到 54px。 */
function ccyOptions() {
  if (!window.CURRENCY_LIST) return '';
  const cur = (window.Currency && typeof Currency.current === 'function')
    ? Currency.current() : 'AED';
  return CURRENCY_LIST.map(k => {
    const c = window.CURRENCY_INFO[k];
    /* r24：收起时只留货币代码。原来的阿语简写（د.إ）+「· أساسي」标注
       太长，62px 装不下会挤到旁边的搜索框。 */
    const short = esc(k);
    const full = esc((c.ar || '') + ' · ' + (c.nation || ''));
    return `<option value="${k}" data-full="${full}"${k === cur ? ' selected' : ''}>${short}</option>`;
  }).join('');
}

/* 货币切换的绑定 + 首次按 IP 定默认。
   注意是「IP 只定默认值，用户选过就以他选的为准」——
   同一个网址对不同国家返回不同内容会被 Google 判重复内容，SEO 掉分。
   所以这里不强制切，只在没有手动选择记录时才用 IP 推的。 */
async function bindCurrency() {
  const sel = document.getElementById('ccy-select');
  if (sel && !sel.dataset.bound) {
    sel.dataset.bound = '1';
    sel.onchange = () => {
      if (window.Currency) Currency.setCurrency(sel.value);
    };
  }
  if (!window.Currency) return;
  const st = await Currency.init();
  /* HTML 上标 data-ccy，CSS 不用也能靠它做数字排版微调 */
  document.documentElement.setAttribute('data-ccy', st.ccy);
  const s2 = document.getElementById('ccy-select');
  if (s2) s2.value = st.ccy;
}

function renderHeader(active) {
  const { site, tax } = CTX;
  const ui = tax?.ui || {};
  /* r30：板块上下间距 —— 后台「网站设置」可调，写进 CSS 变量，
     三处 section padding 都读它，默认 46 */
  if (Number(site?.secPad) > 0) {
    document.documentElement.style.setProperty('--sec-pad', Number(site.secPad) + 'px');
  }
  const nav = (tax?.nav || []).map(n =>
    `<a href="${n.href}" class="${n.key === active ? 'on' : ''}">${esc(n.labelAr)}</a>`
  ).join('');

  document.getElementById('site-header').innerHTML = `
    <div class="nav">
      <div class="nav-in">
        <div class="nav-end">
          <a class="favbtn-top" href="favorites.html" aria-label="${esc(ui.myFavAr || 'منتجاتي المفضلة')}">
            <span class="ic">${HEART_FILL_SVG}</span>
            <span class="bdg" data-fav-count>0</span>
            <span class="lbl">${esc(ui.myFavShortAr || 'المفضلة')}</span>
          </a>
          ${waOn('waNav') ? `<a class="btn btn-wa nav-wa" href="${waLink('', 'waNav')}" target="_blank" rel="noopener">
            ${WA_ICON} <span>${esc(ui.quickOrderAr || 'اطلب عرض سعر')}</span></a>` : ''}
        </div>

        <a class="logo nav-logo" href="index.html">
          <span class="mark">${esc(site.brand.logoTextAr)}</span>
          <span class="lgo-tx">${esc(site.brand.nameAr)}</span>
        </a>

        <div class="nav-tail">
          <nav class="menu">${nav}</nav>
          <div class="nav-start">
            <div class="ccy-box">
              <label class="ccy-lbl" for="ccy-select" aria-label="${esc(ui.currencyAr || 'العملة')}">
                <span class="ccy-ic" aria-hidden="true">¤</span>
              </label>
              <select id="ccy-select" class="ccy-sel" title="${esc(ui.currencyAr || 'العملة')}">
                ${ccyOptions()}
              </select>
            </div>
            <button class="burger" id="burger" aria-label="${esc(ui.menuAr || 'القائمة')}"
                    aria-expanded="false" aria-controls="site-drawer">${BURGER_SVG}</button>
            <button class="icon-btn" id="searchToggle" aria-label="${esc(ui.searchAr || 'بحث')}">${SEARCH_ICON}</button>
          </div>
        </div>
      </div>
    </div>`;

  const b = document.getElementById('burger');
  if (b) b.onclick = () => toggleDrawer();
}

function renderSearchBar() {
  if (document.getElementById('search-bar')) return;
  const ui = CTX.tax?.ui || {};
  const el = document.createElement('div');
  el.id = 'search-bar';
  el.innerHTML = `
    <div class="search-inner">
      <span class="si-ic">${SEARCH_ICON}</span>
      <input type="search" id="q" autocomplete="off"
             placeholder="${esc(ui.searchPlaceholderAr || 'بحث')}">
      <button class="btn btn-primary" id="qGo">${esc(ui.searchBtnAr || 'بحث')}</button>
      <button class="icon-btn" id="qClose" aria-label="إغلاق">${X_SVG}</button>
    </div>`;
  document.body.prepend(el);
  const open = () => { el.classList.add('on'); document.body.classList.add('noscroll'); setTimeout(() => document.getElementById('q').focus(), 60); };
  const close = () => { el.classList.remove('on'); document.body.classList.remove('noscroll'); };
  document.getElementById('searchToggle').onclick = open;
  document.getElementById('qClose').onclick = close;
  el.addEventListener('click', e => { if (e.target === el) close(); });
  const go = () => {
    const v = document.getElementById('q').value.trim();
    if (!v) return;
    location.href = 'products.html?q=' + encodeURIComponent(v);
  };
  document.getElementById('qGo').onclick = go;
  document.getElementById('q').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  if (CTX.lastQuery) document.getElementById('q').value = CTX.lastQuery;
}

/* ---------- 页脚 ----------
   r21：底部两组的链接搬进后台（site.footer）。
   后台没配（老数据）时退回原来的自动生成 —— 从 tax.nav 和
   site.contact 拼，外观一个字不变。用户说页脚样式「算了不改了」，
   所以这里只换数据来源，不动结构。

   产品分类和行业继续自动生成：以后后台加分类/行业，页脚自动跟着长，
   不用手动一条条加。用户明确选了方案 B。 */
function renderFooter() {
  const { site, tax } = CTX;
  const ui = tax?.ui || {};
  const cats = (tax?.categories || []).slice(0, 4);
  const sectors = (tax?.sectors || []).slice(0, 4);

  /* 链接组：后台配了用后台的，没配用自动的。
     三种数据源：
       href   —— 直接写链接
       cat    —— 产品分类（点进去带 cat=）
       sector —— 行业（点进去带 sec=）
       fav    —— 收藏页（保留原有的收藏入口） */
  const autoNav = [
    ...(tax.nav || []).map(n => ({ labelAr: n.labelAr, href: n.href })),
    { labelAr: ui.myFavAr || 'منتجاتي المفضلة', href: 'favorites.html' },
  ];
  const autoContact = [
    { labelAr: 'واتساب', wa: true },
    { labelAr: site.contact.email, href: 'mailto:' + site.contact.email },
    { labelAr: site.contact.cityAr, href: 'contact.html' },
  ];

  /* 后台数据里 wa:true 的项按 WhatsApp 处理，链接实时生成 */
  const linkRow = l => {
    if (l.wa) {
      if (!waOn('waFoot')) return '';
      return `<a href="${waLink('', 'waFoot')}" target="_blank" rel="noopener">${esc(l.labelAr || 'واتساب')}</a>`;
    }
    let href = l.href || '';
    if (l.cat) href = 'products.html?cat=' + encodeURIComponent(l.cat);
    else if (l.sector) href = 'products.html?sec=' + encodeURIComponent(l.sector);
    else if (l.fav) href = 'favorites.html';
    if (!href) return '';
    return `<a href="${esc(href)}">${esc(l.labelAr || '')}</a>`;
  };

  const cfg = site.footer || {};
  const quickTitle = cfg.quickTitleAr || ui.footQuickAr || 'روابط سريعة';
  const quickLinks = (cfg.quickLinks && cfg.quickLinks.length) ? cfg.quickLinks : autoNav;
  const conTitle = cfg.contactTitleAr || ui.footContactAr || 'تواصل';
  const conLinks = (cfg.contactLinks && cfg.contactLinks.length) ? cfg.contactLinks : autoContact;

  /* 社媒：后台填了链接才显示，图标按渠道自动配 */
  const soc = socialLinks();

  document.getElementById('site-footer').innerHTML = `
    <div class="f-grid">
      <div class="f-col">
        <div class="logo" style="margin-bottom:14px">
          <span class="mark">${esc(site.brand.logoTextAr)}</span>
          <span>${esc(site.brand.nameAr)}</span>
        </div>
        <p style="font-size:14.5px;color:var(--ink-3);max-width:34ch">${esc(site.brand.taglineAr)}</p>
        ${soc.length ? `<div class="f-soc">${soc.map(s => `
          <a href="${esc(s.href)}" target="_blank" rel="noopener" title="${esc(s.name)}"
             aria-label="${esc(s.name)}">${s.icon}</a>`).join('')}</div>` : ''}
      </div>
      <div class="f-col">
        <h4>${esc(quickTitle)}</h4>
        ${quickLinks.map(linkRow).join('')}
      </div>
      <div class="f-col">
        <h4>${esc(ui.footCatsAr || 'الأقسام')}</h4>
        ${cats.map(c => `<a href="products.html?cat=${encodeURIComponent(c.id)}">${esc(c.nameAr)}</a>`).join('')}
      </div>
      <div class="f-col">
        <h4>${esc(ui.footSectorsAr || 'القطاعات')}</h4>
        ${sectors.map(s => `<a href="sectors.html#${s.id}">${esc(s.nameAr)}</a>`).join('')}
        <h4 style="margin-top:20px">${esc(conTitle)}</h4>
        ${conLinks.map(linkRow).join('')}
      </div>
    </div>
    <div class="f-bottom">
      <span>© ${new Date().getFullYear()} ${esc(site.brand.nameAr)}. جميع الحقوق محفوظة.</span>
      <span>${esc(ui.privacyAr || 'سياسة الخصوصية')} · ${esc(ui.termsAr || 'الشروط والأحكام')}</span>
    </div>`;
}

/* ---------- 社媒渠道（r21） ----------
   后台 site.social = { instagram: 'https://...', facebook: '...', ... }
   填了链接才显示，图标按渠道名自动配（用户明确说不要自己挑图标）。
   固定这7 个渠道，顺序按这里定义的，链接为空就跳过。 */
const SOCIAL_ICONS = window.SOCIAL_ICONS = {
  instagram: { name: 'Instagram', icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>' },
  facebook: { name: 'Facebook', icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M14 8.5V7c0-.8.2-1.2 1.4-1.2H17V3h-2.6C11.4 3 10.4 4.4 10.4 6.8v1.7H9V11h1.4v10H14V11h2.2l.3-2.5H14z"/></svg>' },
  linkedin: { name: 'LinkedIn', icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M6.9 8.8H4V20h2.9zM5.4 7.4a1.7 1.7 0 100-3.4 1.7 1.7 0 000 3.4zM20 13.9c0-3.2-1.7-4.7-4-4.7-1.2 0-2.1.6-2.5 1.3V8.8H10.6V20h2.9v-5.6c0-1.5.3-2.4 1.7-2.4s1.9.9 1.9 2.4V20H20z"/></svg>' },
  tiktok: { name: 'TikTok', icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3h-2.4v12.2a2.4 2.4 0 11-2-2.4V10.4a4.8 4.8 0 102.4 4.2V8.6a5.4 5.4 0 003.2 1V7.4a3.2 3.2 0 01-1.2-4.4z"/></svg>' },
  snapchat: { name: 'Snapchat', icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c2.7 0 4.3 2 4.3 4.4v1.4c.5.1.8.5.6.9-.3.5-1.2.7-1.8.9.3.4.9.7 1.7.7.5 0 .7.4.4.7-.7.6-1.7.9-2.7 1-.2.6-.8.9-1.7.9h-.9c-.5 0-.7.4-1 .8-.4.5-1.3.5-1.7 0-.3-.4-.5-.8-1-.8h-.9c-.9 0-1.5-.3-1.7-.9-1-.1-2-.4-2.7-1-.3-.3-.1-.7.4-.7.8 0 1.4-.3 1.7-.7-.6-.2-1.5-.4-1.8-.9-.2-.4.1-.8.6-.9V7.4C7.7 5 9.3 3 12 3z"/></svg>' },
  x: { name: 'X', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3l-6.6 7.5L21.8 21h-6l-4.7-6.2L5.7 21h-3l7-8L2.5 3h6.2l4.3 5.6zm-1 16h1.7L7.6 4.7H5.8z"/></svg>' },
  telegram: { name: 'Telegram', icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.3L2.9 11.4c-.9.4-.9.9-.1 1.2l4.7 1.5 1.8 5.6c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.5c.3-1.2-.5-1.7-1.3-1.4zM7.9 14.1l9-5.7c.4-.3.8-.1.5.2l-7.6 6.8-.3 3.6z"/></svg>' },
};

function socialLinks() {
  const sc = (CTX.site && CTX.site.social) || {};
  const out = [];
  Object.keys(SOCIAL_ICONS).forEach(k => {
    const url = String(sc[k] || '').trim();
    if (!url) return;             /* 填了才显示 */
    out.push({ key: k, name: SOCIAL_ICONS[k].name, icon: SOCIAL_ICONS[k].icon, href: url });
  });
  return out;
}

/* ---------- 产品卡 ----------
   整张卡都是热点：点图片、点标题、点空白处都进详情。
   只有「收藏」和「WhatsApp」两个按钮是自己动的。 */
/* freshFirst：新板块渲染时为 true，「جديد」角标优先于「مميز」
   slim：精简模式（r22）。首页「最新上架」区用——
   大哥说那张卡信息太多：产品类别、场景分类、起订量写了两次、还写了价格，
   看着挤成一团。精简后只留「标题 + 价格」，别的全不要。
   「热门推荐」区还是完整版，不受影响。
   注意：slim 必须严格比 true。全站有 4 处 list.map(productCard) 这种写法，
   map 会把第三个参数 array 一起塞进来，数组是 truthy，
   只写 if (slim) 会让推荐区、收藏页、相关推荐、全部产品列表全被误伤成精简卡。 */
function productCard(p, freshFirst, slim) {
  const slimCard = (slim === true);
  const c = catOf(p.categoryId);
  const ui = CTX.tax?.ui || {};
  const imgs = (p.images || []).filter(Boolean);
  const img = imgs[0];
  const href = 'product.html?id=' + encodeURIComponent(p.id);

  /* 起订量 = 价格阶梯第一档的 from。没有阶梯价的（按尺寸谈的那种）
     就退到 custom.moq，再没有就不显示这一行 —— 宁可少一行，
     也不要显示「起订量：-」这种占位。 */
  const tiers = p.priceTiers || [];
  const moq = tiers.length ? tiers[0].from
            : (p.custom && p.custom.moq) || null;
  const moqTxt = moq
    ? `${ui.fromAr || 'يبدأ من'} ${moq} ${ui.pcsAr || 'قطعة'}`
    : '';

  return `
  <article class="pcard" data-id="${esc(p.id)}">
    <a class="pcover" href="${href}" data-id="${esc(p.id)}" aria-label="${esc(p.nameAr)}"></a>
    <div class="pimg">
      ${img ? imgTag(img, p.nameAr, { set: imgSetOf(p, 0), sizes: '(max-width:620px) 45vw, 300px' })
            : `<span class="shape">${esc(c?.emoji || '\u{1F4E6}')}</span>`}
      ${/* 角标谁优先，看这个产品出现在哪：
          推荐区里 featured 产品显示「مميز」；
          新品区里「新」更重要，不然被推荐的那几个永远看不到「新」字样。
          freshFirst 就是新品区渲染时打开的。 */
        (freshFirst && isNewish(p, 30))
          ? `<span class="badge-new">${esc(ui.newBadgeAr || 'جديد')}</span>`
          : p.featured
            ? `<span class="badge-new">${esc(ui.featuredAr || 'مميز')}</span>`
            : ''}
      <button class="favbtn" data-fav="${esc(p.id)}" aria-pressed="false"
              aria-label="${esc(ui.addFavAr || 'أضف للمفضلة')}"><span class="ic">${HEART_SVG}</span></button>
    </div>
    <div class="pbody">
      ${/* 精简模式（slim）：只要标题和价格。
          类别、场景、起订量全去掉 —— 那些在详情页里都有，
          卡片上重复一遍反而挤得看不清。 */
        slimCard ? `
      <span class="pname">${esc(p.nameAr)}</span>
      ${priceTable(p, { compact: true }) || '<span class="pprice-ph"></span>'}` : `
      <span class="pcat">${esc(c?.nameAr || '')}</span>
      <span class="pname">${esc(p.nameAr)}</span>
      ${/* 起订量行：没价格的（按尺寸谈的那种）也占位，空着。
          不占位的话，这张卡比旁边有起订量的矮一截，一排参差不齐。
          高度跟真起订量标签一致（29px）。 */
        moqTxt ? `<span class="pmoq">${esc(moqTxt)}</span>` : '<span class="pmoq-ph"></span>'}
      ${/* 起价行：没阶梯价的也占位，空着。
          不占位的话，有价和没价的卡片高度差一截，一排看着参差不齐。
          用户明确要求卡片定长。 */
        priceTable(p, { compact: true }) || '<span class="pprice-ph"></span>'}`}
      ${/* WhatsApp 改成右下角小圆标，不再是占一整行的绿按钮。
          一排 4 张卡全是大绿按钮的话，视觉上比产品图还抢眼，
          而且卡片整张就是热点，点进详情页有专门的报价入口。 */
        (waOn('waProduct') ? `<a class="pwa" href="${waProductLink(p)}" target="_blank" rel="noopener" aria-label="${esc(ui.quickOrderAr || 'اطلب عرض سعر')}">${WA_ICON}</a>` : '')}
    </div>
  </article>`;
}

/* 空状态：没产品 / 没图片 时给句人话 */
function emptyState(msg, sub) {
  return `<div class="empty-state">
    <span class="es-ic">${esc(CTX.tax?.ui?.emptyIconAr || '📦')}</span>
    <p>${esc(msg)}</p>
    ${sub ? `<small>${esc(sub)}</small>` : ''}
  </div>`;
}

function renderCta() {
  const { site } = CTX;
  const c = site?.cta || {};
  const el = document.getElementById('cta-slot');
  if (!el) return;
  /* CTA 归到 footer 那个位置控制（页尾的 WhatsApp CTA） */
  if (!waOn('waFoot')) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="cta">
      <div>
        <h2>${esc(c.titleAr || '')}</h2>
        <p>${esc(c.bodyAr || '')}</p>
      </div>
      <a class="btn btn-wa" href="${waLink('', 'waFoot')}" target="_blank" rel="noopener">
        ${WA_ICON} ${esc(c.buttonAr || '')}</a>
    </div>`;
}

/* ---------- banner 轮播 ----------
   后台可以传任意多张，每张都能单独设跳转。没传图就退回原来的装饰圆。 */

/* banner 点了去哪。按 linkType 分开算，不让后台自己拼 URL ——
   分类和产品都用 id 存，改版 URL 变了不用回去重填。
   返回 {href, external}，null 表示这张图不可点。 */
function bannerHref(b) {
  const raw = String(b.linkTo || '').trim();
  const type = b.linkType || 'none';

  if (type === 'none' || !raw) return null;

  if (type === 'wa') {
    /* 后台可能带 + 和空格，甚至手滑加了 00，都洗一遍 */
    const num = waClean(raw);
    if (!num) return null;
    return {
      href: 'https://wa.me/' + num + '?text=' +
            encodeURIComponent(CTX.site?.whatsapp?.defaultMessageAr || ''),
      external: true,
    };
  }

  if (type === 'url') {
    /* 只认 http/https，别把 javascript: 之类放进来 */
    if (!/^https?:\/\//i.test(raw)) return null;
    return { href: raw, external: true };
  }

  /* 下面两种是站内数据，后台可能填阿语名，也可能填 id，两种都认 */
  if (type === 'category') {
    const t = CTX.tax || {};
    const hit =
      (t.categories || []).find(c => c.id === raw) ||
      (t.categories || []).find(c => (c.nameAr || '').trim() === raw) ||
      /* 行业也放这儿，省得后台再分一次 */
      (t.sectors || []).find(s => s.id === raw) ||
      (t.sectors || []).find(s => (s.nameAr || '').trim() === raw);
    if (!hit) return null;
    const key = (t.categories || []).indexOf(hit) >= 0 ? 'cat' : 'sec';
    return { href: 'products.html?' + key + '=' + encodeURIComponent(hit.id), external: false };
  }

  if (type === 'product') {
    if (!raw) return null;
    return {
      href: 'product.html?id=' + encodeURIComponent(raw),
      external: false,
    };
  }

  return null;
}

function renderBanners() {
  const host = document.getElementById('hero-banners');
  if (!host) return;
  const hero = CTX.site?.hero || {};
  let list = (hero.banners || []).filter(b => b && (b.image || b.titleAr || b.subAr));
  /* 老数据里存过 hero.imageAr（改版前的单张封面图），
     当时后台还没这个输入框了，那张图别让它白丢 — 当成一张无跳转的 banner 兜底。 */
  if (!list.length && hero.imageAr) list = [{ image: hero.imageAr }];
  if (!list.length) { host.remove(); return; }

  host.className = 'hero-visual has-banners';
  host.innerHTML = `
    <div class="bnr-track" id="bnr-track">
      ${list.map((b, i) => {
        const link = bannerHref(b);
        const inner = `
          ${b.image ? imgTag(b.image, b.titleAr || '', {
                set: b.imageSet,
                /* 第一张是首屏就看得到的，别 lazy —— lazy 会让它晚半秒才出现 */
                lazy: i !== 0,
                sizes: '100vw',
              }) : ''}
          ${(b.titleAr || b.subAr) ? `<div class="bnr-tx">
            ${b.titleAr ? `<h3>${esc(b.titleAr)}</h3>` : ''}
            ${b.subAr ? `<p>${esc(b.subAr)}</p>` : ''}
          </div>` : ''}`;
        /* 有链接就整张包成 a，没有就是普通 div —— 别用空 href，
           <a href="">点了会跳到当前页并改地址栏 */
        return link
          ? `<a class="bnr ${i === 0 ? 'on' : ''}" data-i="${i}"
                href="${esc(link.href)}"
                ${link.external ? 'target="_blank" rel="noopener"' : ''}
                aria-label="${esc(b.titleAr || '')}">${inner}</a>`
          : `<div class="bnr ${i === 0 ? 'on' : ''}" data-i="${i}">${inner}</div>`;
      }).join('')}
    </div>
    ${list.length > 1 ? `
      <button class="bnr-nav bnr-prev" data-bnr="-1" aria-label="السابق">
        <span style="display:block;transform:scaleX(-1)">${ARROW_SVG}</span></button>
      <button class="bnr-nav bnr-next" data-bnr="1" aria-label="التالي">${ARROW_SVG}</button>
      <div class="bnr-dots" id="bnr-dots">
        ${list.map((_, i) => `<button data-bnr-go="${i}" class="${i === 0 ? 'on' : ''}" aria-label="${i + 1}"></button>`).join('')}
      </div>` : ''}
    <div class="blob" style="width:180px;height:180px;background:#fff;inset-block-start:40px;inset-inline-end:50px"></div>
    <div class="blob" style="width:110px;height:110px;background:#c9b79a;inset-block-end:70px;inset-inline-start:60px"></div>`;

  if (list.length < 2) return;
  const track = host.querySelector('#bnr-track');
  const slides = [...host.querySelectorAll('.bnr')];
  const dots = [...host.querySelectorAll('[data-bnr-go]')];
  let cur = 0, timer = null;

  function goTo(i) {
    cur = (i + slides.length) % slides.length;
    /* RTL 下 track 往反方向平移 */
    track.style.transform = `translateX(${cur * 100}%)`;
    slides.forEach((s, k) => s.classList.toggle('on', k === cur));
    dots.forEach((d, k) => d.classList.toggle('on', k === cur));
  }
  function play() {
    stop();
    timer = setInterval(() => goTo(cur + 1), 5200);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  host.addEventListener('click', e => {
    const s = e.target.closest('[data-bnr]');
    const d = e.target.closest('[data-bnr-go]');
    if (s) { goTo(cur + (+s.dataset.bnr)); play(); return; }
    if (d) { goTo(+d.dataset.bnrGo); play(); }
  });
  /* 鼠标停在上面就不自动切 */
  host.addEventListener('mouseenter', stop);
  host.addEventListener('mouseleave', play);
  /* 手指左右滑动切换。
     ★ 为什么加：原来只有「点两侧小按钮」和「点圆点」两种切换方式。
     手机上用户习惯直接用手滑，滑不动就会以为横幅只有一张。
     大哥 2026-10-12 报的「前端不能左右滑动」就是这个。
     （更正一处误判：.bnr-nav / .bnr-dots 只在 @media print 里被隐藏，
     手机上按钮是在的 —— 只是 34px 的小圆点，手指不好点。） */
  let _sx = 0, _sy = 0, _dx = 0, _drag = false;
  host.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    _sx = e.touches[0].clientX;
    _sy = e.touches[0].clientY;
    _dx = 0;
    _drag = true;
    stop();
  }, { passive: true });

  host.addEventListener('touchmove', e => {
    if (!_drag || e.touches.length !== 1) return;
    const cx = e.touches[0].clientX;
    const cy = e.touches[0].clientY;
    /* 横向没超过纵向就先不接管 —— 不然页面上下滚动会被吃掉 */
    if (Math.abs(cx - _sx) < Math.abs(cy - _sy)) return;
    _dx = cx - _sx;
  }, { passive: true });

  function endTouch() {
    if (!_drag) return;
    const moved = _dx;
    _drag = false;
    /* 滑够 40px 才算数，太短当误触 */
    if (Math.abs(moved) > 40) {
      /* 阿语是 RTL，横幅从右往左排：手指往左拖 = 看下一张 */
      goTo(cur + (moved < 0 ? 1 : -1));
    }
    play();
  }
  host.addEventListener('touchend', endTouch, { passive: true });
  host.addEventListener('touchcancel', () => { _drag = false; play(); },
                       { passive: true });
  play();
}

/* ---------- 启动 ---------- */
async function boot(activeKey) {
  try {
    /* SEO 先落一部分 —— title/description 不依赖数据，
       等下再按页面类型补 og:image 和结构化数据。 */
    if (window.SEO) { try { SEO.apply({ key: activeKey }); } catch (e) { console.warn('[seo]', e); } }

    /* 货币和汇率先起（不等它画页面，但要并行）。
       价格展示依赖它，晚一步会让先渲染出来的价格闪一下 AED 再变。 */
    if (window.Currency) Currency.init().catch(() => {});

    const [site, tax] = await Promise.all([getSite(), getTaxonomy()]);
    CTX = { site, tax };
    /* 把分类数据给 api.js 一份 —— 筛选时要按材料阿语名反查老产品 */
    if (typeof setTaxCache === 'function') setTaxCache(tax);
    if (typeof applyTheme === 'function') applyTheme(site.theme);

    /* 顶栏先画出来，数据没到也能看见骨架 */
    renderHeader(activeKey);
    bindCurrency();
    renderSearchBar();
    renderFooter();
    renderCta();
    if (typeof initUI === 'function') initUI();
    paintFavs();

    /* 数据到了再跑一次 SEO —— 这时才有品牌名、banner 图、分类名可写。
       组织信息 + 网站信息全站都注入，Google 靠这个判断公司是谁。 */
    if (window.SEO) {
      try {
        SEO.apply({ key: activeKey });
        SEO.injectLd(SEO.orgLd(site));
        SEO.injectLd(SEO.webSiteLd(site));
        /* 首页的 FAQ 是静态写死的，结构化数据能直接对上 */
        if (document.getElementById('faq-list')) SEO.injectLd(SEO.faqLd());
      } catch (e) { console.warn('[seo-ld]', e); }
    }
  } catch (e) {
    /* 服务器出问题时给客户一句人话，别白屏 */
    console.error('[boot]', e);
    const msg = (e && e.message) || String(e);
    document.getElementById('site-header').innerHTML =
      `<div class="wrap" style="padding:22px 0;color:#c0392b;font-weight:700">
         تعذّر تحميل بيانات الموقع. يرجى المحاولة بعد قليل.
       </div>`;
    const main = document.querySelector('section');
    if (main) {
      main.innerHTML =
        `<div class="wrap" style="text-align:center;padding:70px 24px">
           <p style="font-size:17px;color:#4a4740;margin-bottom:12px">الموقع في وضع مؤقت</p>
           <p style="color:#8a857a;font-size:14px">${esc(msg)}</p>
         </div>`;
    }
    throw e;
  }
}
