/* ==========================================================================
   ui.js — 前台交互组件
   --------------------------------------------------------------------------
   收藏夹 / 汉堡菜单 / 悬浮 WhatsApp / 滚动位置记忆 / 图片灯箱 / 搜索打分
   所有页面都加载这个文件。不依赖任何框架，纯 DOM。
   ========================================================================== */

/* ---------- 图标 ---------- */
const HEART_SVG = window.HEART_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"
        stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 5.6a5.1 5.1 0 0 0-7.2 0L12 7.2l-1.6-1.6a5.1 5.1 0 1 0-7.2 7.2l1.6 1.6L12 21.6l7.2-7.2 1.6-1.6a5.1 5.1 0 0 0 0-7.2z"/></svg>`;
const HEART_FILL_SVG = window.HEART_FILL_SVG =
  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.6l-1.5-1.35L4.2 14.2A5.6 5.6 0 0 1 4 6.2a5.1 5.1 0 0 1 7.2 0L12 7l.8-.8a5.1 5.1 0 0 1 7.2 0 5.6 5.6 0 0 1-.2 8l-6.3 6.05z"/></svg>`;
const BURGER_SVG = window.BURGER_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"
        stroke-linecap="round"><path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/></svg>`;
const ARROW_SVG = window.ARROW_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
        stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;
const X_SVG = window.X_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
        stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

/* ==========================================================================
   ① 收藏夹 —— 存在访客自己的浏览器里，不需要账号
   ========================================================================== */
const FAV_KEY = 'ar_favs_v1';

function favList() {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x) : [];
  } catch (e) { return []; }
}
function favWrite(list) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (e) {}
  document.dispatchEvent(new CustomEvent('favchange', { detail: { list } }));
}
function isFav(id) { return favList().indexOf(String(id)) >= 0; }
function favCount() { return favList().length; }

/* 返回 true = 加进去了 */
function toggleFav(id) {
  id = String(id);
  const list = favList();
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1); else list.push(id);
  favWrite(list);
  return i < 0;
}

/* 把页面上所有收藏按钮和角标刷成最新状态 */
function paintFavs() {
  const list = favList();
  document.querySelectorAll('[data-fav]').forEach(el => {
    const on = list.indexOf(el.dataset.fav) >= 0;
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
    const ic = el.querySelector('.ic');
    if (ic) ic.innerHTML = on ? HEART_FILL_SVG : HEART_SVG;
  });
  document.querySelectorAll('[data-fav-count]').forEach(el => {
    const n = list.length;
    el.textContent = n > 99 ? '99+' : String(n);
    el.classList.toggle('on', n > 0);
    const wrap = el.closest('.favbtn-top');
    if (wrap) wrap.classList.toggle('has', n > 0);
  });
}
document.addEventListener('favchange', paintFavs);

/* ==========================================================================
   ② 汉堡菜单抽屉：产品类型 + 使用场景
   ========================================================================== */
/* 抽屉 / 筛选器里那些小缩略图。传入 imageSet 才有 srcset ——
   分类图、行业图后台都会存三档地址，这里顺手用上，手机下小图不拉大图。 */
function taxThumb(item, cls) {
  const img = item && (item.image || item.imageAr);
  if (img) return imgTag(img, '', { set: item && item.imageSet, cls: cls, sizes: '44px' });
  return `<span class="${cls} is-emoji">${esc((item && item.emoji) || '•')}</span>`;
}

/* 统计每个分类 / 行业下有多少产品 */
async function taxCounts() {
  const out = { cat: {}, sec: {} };
  let list = [];
  try { list = await allProducts(); } catch (e) { return out; }
  list.forEach(p => {
    if (p.published === false) return;
    if (p.categoryId) out.cat[p.categoryId] = (out.cat[p.categoryId] || 0) + 1;
    (p.sectorIds || []).forEach(s => { out.sec[s] = (out.sec[s] || 0) + 1; });
  });
  return out;
}

function drawerItem(href, thumb, title, sub) {
  return `<a class="drw-item" href="${href}">
    <span class="di-ic">${thumb}</span>
    <span class="di-tx"><b>${esc(title)}</b><small>${esc(sub)}</small></span>
    <span class="di-go">${ARROW_SVG}</span>
  </a>`;
}

async function buildDrawer() {
  const host = document.getElementById('site-drawer');
  if (!host) return;
  const { site, tax } = CTX;
  const ui = tax?.ui || {};
  const cats = (tax?.categories || []).slice().sort((a, b) => (a.sort || 99) - (b.sort || 99));
  const secs = (tax?.sectors || []).slice().sort((a, b) => (a.sort || 99) - (b.sort || 99));
  const counts = await taxCounts();

  host.innerHTML = `
    <div class="drw-scrim" data-drawer-close></div>
    <aside class="drw-panel" role="dialog" aria-modal="true" aria-label="القائمة">
      <div class="drw-head">
        <a class="logo" href="index.html">
          <span class="mark">${esc(site.brand.logoTextAr)}</span>
          <span>${esc(site.brand.nameAr)}</span>
        </a>
        <button class="icon-btn" data-drawer-close aria-label="إغلاق">${X_SVG}</button>
      </div>
      <div class="drw-body">
        <div class="drw-two">
          <section class="drw-sec">
            <h4>${esc(ui.menuCatsAr || 'أقسام المنتجات')}</h4>
            <div class="drw-list">
              ${cats.map(c => drawerItem(
                'products.html?cat=' + encodeURIComponent(c.id),
                taxThumb(c),
                c.nameAr,
                (counts.cat[c.id] || 0) + ' ' + (ui.resultsAr || 'منتج')
              )).join('')}
            </div>
          </section>
          <section class="drw-sec">
            <h4>${esc(ui.menuSectorsAr || 'حسب القطاع')}</h4>
            <div class="drw-list">
              ${secs.map(s => drawerItem(
                'products.html?sec=' + encodeURIComponent(s.id),
                taxThumb(s),
                s.nameAr,
                (counts.sec[s.id] || 0) + ' ' + (ui.resultsAr || 'منتج')
              )).join('')}
            </div>
          </section>
        </div>
        <section class="drw-sec">
          <h4>${esc(ui.menuQuickAr || 'روابط سريعة')}</h4>
          <div class="drw-quick">
            <a href="products.html">${esc(ui.allProductsAr || 'جميع المنتجات')}</a>
            <a href="favorites.html">${HEART_FILL_SVG} ${esc(ui.myFavAr || 'منتجاتي المفضلة')}${
              countsFav() ? `<span class="drw-qn">${countsFav()}</span>` : ''}</a>
            ${(tax.nav || []).map(n => `<a href="${n.href}">${esc(n.labelAr)}</a>`).join('')}
          </div>
        </section>
      </div>
      <div class="drw-foot">
        ${waOn('waDrawer') ? `<a class="btn btn-wa btn-lg" href="${waLink('', 'waDrawer')}" target="_blank" rel="noopener">
          ${WA_ICON} ${esc(ui.quickOrderAr || 'اطلب عرض سعر')}</a>` : ''}
      </div>
    </aside>`;

  host.querySelectorAll('[data-drawer-close]').forEach(el => {
    el.onclick = () => toggleDrawer(false);
  });
  host.querySelectorAll('.drw-item, .drw-quick a').forEach(el => {
    el.onclick = () => toggleDrawer(false);
  });
  paintFavs();
}
function countsFav() { return favCount(); }

function toggleDrawer(on) {
  const host = document.getElementById('site-drawer');
  if (!host) return;
  const want = on === undefined ? !host.classList.contains('on') : !!on;
  host.classList.toggle('on', want);
  document.body.classList.toggle('noscroll', want);
  if (want) {
    const first = host.querySelector('.drw-item');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
  }
}

/* ==========================================================================
   ③ 悬浮 WhatsApp —— 全站任何页面都常驻。
   r21：后台可以把这个位置关掉，关了就不挂这个圆钮。
   ========================================================================== */
function renderFloatWA() {
  if (document.getElementById('fab-wa')) return;
  if (!waOn('waFab')) return;
  const el = document.createElement('a');
  el.id = 'fab-wa';
  el.className = 'fab-wa';
  el.href = waLink('', 'waFab');
  el.target = '_blank';
  el.rel = 'noopener';
  el.setAttribute('aria-label', 'واتساب');
  el.innerHTML = `${WA_ICON}<span class="fab-tx">${esc(CTX.tax?.ui?.fabWaAr || 'تواصل واتساب')}</span>`;
  document.body.appendChild(el);
}

/* ==========================================================================
   ⑤ 图片灯箱 —— 点大图看，左右切图
   ========================================================================== */
let _lb = null;
function ensureLightbox() {
  if (_lb) return _lb;
  const el = document.createElement('div');
  el.id = 'lightbox';
  el.innerHTML = `
    <div class="lb-scrim" data-lb-close></div>
    <div class="lb-box">
      <button class="lb-x" data-lb-close aria-label="إغلاق">${X_SVG}</button>
      <button class="lb-nav lb-prev" data-lb-step="-1" aria-label="السابق">${ARROW_SVG}</button>
      <img class="lb-img" alt="">
      <button class="lb-nav lb-next" data-lb-step="1" aria-label="التالي">
        <span style="display:block;transform:scaleX(-1)">${ARROW_SVG}</span></button>
      <div class="lb-cap"></div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if (e.target.closest('[data-lb-close]')) closeLightbox();
    const st = e.target.closest('[data-lb-step]');
    if (st) lbStep(+st.dataset.lbStep);
  });
  document.addEventListener('keydown', e => {
    if (!el.classList.contains('on')) return;
    if (e.key === 'Escape') closeLightbox();
    /* RTL：视觉上的「下一张」是左箭头 */
    if (e.key === 'ArrowLeft') lbStep(1);
    if (e.key === 'ArrowRight') lbStep(-1);
  });
  _lb = el;
  return el;
}
let _lbData = { imgs: [], i: 0 };
function openLightbox(imgs, i) {
  imgs = (imgs || []).filter(Boolean);
  if (!imgs.length) return;
  _lbData = { imgs, i: Math.max(0, Math.min(i || 0, imgs.length - 1)) };
  const el = ensureLightbox();
  el.classList.add('on');
  document.body.classList.add('noscroll');
  lbPaint();
}
function lbStep(d) {
  const n = _lbData.imgs.length;
  if (!n) return;
  _lbData.i = (_lbData.i + d + n) % n;
  lbPaint();
}
function lbPaint() {
  const el = ensureLightbox();
  const { imgs, i } = _lbData;
  const img = el.querySelector('.lb-img');
  img.src = imgs[i];
  const cap = el.querySelector('.lb-cap');
  cap.textContent = imgs.length > 1 ? (i + 1) + ' / ' + imgs.length : '';
  el.querySelectorAll('.lb-nav').forEach(b => { b.hidden = imgs.length < 2; });
}
function closeLightbox() {
  const el = document.getElementById('lightbox');
  if (!el) return;
  el.classList.remove('on');
  document.body.classList.remove('noscroll');
}

/* ==========================================================================
   ⑥ 搜索 —— 打分排序，不是简单的「有没有这个词」
   --------------------------------------------------------------------------
   老逻辑只找 nameAr/shortAr/nameZh 三个字段的完整子串，搜「杯子」找不到
   名字写「كوب」的，搜「8oz」找不到规格里写的。现在改成：
     · 阿拉伯语归一化（去音标、统一 أ/إ/آ、ى/ي、ة/ه、阿拉伯数字）
     · 按空格切词，词与词之间是「与」关系
     · 名字命中权重最高，规格和描述次之
   ========================================================================== */
/* 阿拉伯语归一化：把写法不同但意思一样的词拉平成同一串，
   这样搜「أونصه」也能搜到规格里写的「أونصة」。 */

/* 音标（tashkīl）和 tatweel。必须逐个码点列清楚 ——
   写成区间的话，U+061A–U+0670 会把整个字母区 U+0628–U+0648 一起吃掉，
   结果 normAr('كوب') 返回空串，搜索直接失效。 */
const AR_DIACRITICS = /[ً-ْٓ-ٰٕ-ٖٟۖ-ۭـ]/g;

function normAr(s) {
  return String(s == null ? '' : s)
    .replace(AR_DIACRITICS, '')
    .replace(/[أإآٱٲٳٵ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function specText(p) {
  const s = p.specs || {};
  return normAr([].concat(s.materialAr || '', s.sizesAr || [], s.colorsAr || [], s.usesAr || []).join(' '));
}

/* 分类名和行业名。CTX 没就绪时返回空串，不去调外部函数 */
function taxNamesOf(p) {
  const tax = CTX.tax;
  if (!tax) return '';
  const c = (tax.categories || []).find(x => x.id === p.categoryId);
  const secs = (tax.sectors || []).filter(s => (p.sectorIds || []).includes(s.id));
  return normAr([c ? c.nameAr : '', ...secs.map(s => s.nameAr)].join(' '));
}

/* 给单个产品对一组词打分；返回 0 表示不匹配 */
function scoreProduct(p, terms) {
  const fields = [
    { w: 16, t: normAr(p.nameAr) },
    { w: 11, t: normAr(p.nameZh) },
    { w: 8,  t: normAr(p.shortAr) },
    { w: 6,  t: taxNamesOf(p) },
    { w: 4,  t: normAr(p.descAr) },
    { w: 4,  t: specText(p) },
    { w: 3,  t: normAr((p.imageLabelsAr || []).join(' ')) },
    /* id 是英文的（cup-01 / bags-02），客户搜 "cup" 也能搜到 */
    { w: 2,  t: normAr(String(p.id || '').replace(/[-_]/g, ' ')) },
  ];
  const whole = terms.join(' ');
  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const f of fields) {
      if (!f.t) continue;
      const at = f.t.indexOf(term);
      if (at < 0) continue;
      let s = f.w;
      if (at === 0) s += 5;                                  /* 开头命中 */
      if (f.t === term) s += 8;                               /* 完全等于 */
      if (f.t.includes(' ' + term)) s += 3;                   /* 独立成词 */
      if (s > best) best = s;
    }
    if (!best) return 0;          /* 一个词没命中就淘汰 */
    total += best;
  }
  /* 整个查询串原样出现在名字里，再加分 */
  if (whole && normAr(p.nameAr).indexOf(whole) === 0) total += 12;
  return total;
}

function searchProducts(list, q) {
  const terms = normAr(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return { list: list.slice(), scored: false };
  const hit = [];
  list.forEach(p => {
    const s = scoreProduct(p, terms);
    if (s > 0) hit.push({ p, s });
  });
  hit.sort((a, b) => b.s - a.s || (a.p.sort || 99) - (b.p.sort || 99));
  return { list: hit.map(x => x.p), scored: true };
}

/* ==========================================================================
   ⑦ 横向滑动的分类条（参考竞品做法）
   ========================================================================== */
function railStep(rail, dir) {
  if (!rail) return;
  const rtl = getComputedStyle(rail).direction === 'rtl';
  const cur = rail.scrollLeft;
  const d = rail.clientWidth * 0.78 * (dir > 0 ? 1 : -1);
  const next = rtl ? cur - d : cur + d;
  rail.scrollTo({ left: next, behavior: 'smooth' });
}
function railEdges(rail) {
  if (!rail) return;
  const prev = rail.parentElement && rail.parentElement.querySelector('[data-rail="-1"]');
  const next = rail.parentElement && rail.parentElement.querySelector('[data-rail="1"]');
  if (!prev || !next) return;
  const max = rail.scrollWidth - rail.clientWidth;
  const rtl = getComputedStyle(rail).direction === 'rtl';
  const x = Math.abs(rail.scrollLeft);
  const a = rtl ? x : max - x;   /* 统一换算成「距起点的距离」 */
  prev.hidden = a < 8;
  next.hidden = a > max - 8;
}

/* ==========================================================================
   横向滑动条自动轮播（r22）
   --------------------------------------------------------------------------
   大哥要「让它自己动起来」。但自动轮播最容易踩的坑是
   跟用户抢滚动位置 —— 用户正看着某张卡，自动把它推走了，很烦。

   所以这里的规则是：
     · 鼠标悬停 / 手指按着 / 焦点在条上→ 暂停
     · 用户手动滑过→ 静默3 秒再恢复（别一松手就继续推）
     · 条内容不满一屏（没什么可滑的）→ 不启动
     · 页面标签切到后台 → 暂停（省电，也避免回来时位置全乱）
     · 尊重系统的「减少动态效果」设置

   RTL 注意：阿拉伯语下 scrollLeft 是负数或从右往左增长，
   跟 LTR 完全不一样。所以下面所有位置换算都走railPos()，
   跟上面 railEdges() 用的是同一套逻辑，别自己另写一套。 */
const RAIL_AUTOPLAY_MS = 4200;   /* 一次推一「屏」还是一「张」看下面 */
const RAIL_RESUME_MS = 3000;     /* 用户手动滑过后静默多久恢复 */

/* 取「距起点的距离」，屏蔽 LTR/RTL 差异。跟 railEdges() 同一套算法。 */
function railPos(rail) {
  const max = rail.scrollWidth - rail.clientWidth;
  const rtl = getComputedStyle(rail).direction === 'rtl';
  const x = Math.abs(rail.scrollLeft);
  return { max: Math.max(0, max), pos: rtl ? x : max - x, rtl };
}

/* rail.dataset.autoplay 有三种值：
     '1'    已经启动，interval 在跑
     'wait' 内容还不够一屏，等 DOM 变了再来重试
     'off'  用户系统里开了「减少动态效果」，永久不启动
   之前是一上来就打 '1' 再检查能不能滑，内容没渲染完就永久放弃了，
   所以动态插入的流程条（proc-rail）压根没挂上。 */
function railAutoPlay(rail) {
  if (!rail) return;
  if (rail.dataset.autoplay === '1' || rail.dataset.autoplay === 'off') return;

  /* 没什么可滑的（内容不满一屏）就先等等。
     rail 里的卡都是 JS 后填的，initUI 跑的时候可能还是空的，
     所以挂个观察者，内容一变就重试，别一棍子打死。 */
  if (rail.scrollWidth - rail.clientWidth < 8) {
    rail.dataset.autoplay = 'wait';
    if (!rail._apObs) {
      rail._apObs = new MutationObserver(() => railAutoPlay(rail));
      rail._apObs.observe(rail, { childList: true, subtree: true });
    }
    return;
  }

  /* 系统设置里开了「减少动态效果」就别自动动了 */
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rail.dataset.autoplay = 'off';
      return;
    }
  } catch (e) {}

  rail.dataset.autoplay = '1';

  let timer = null;
  let paused = false;

  /* 一次推一张卡。
     两个坑踩过：
     1) 别用「卡宽 + gap」自己算距离。.rail 上是 scroll-snap-type:x mandatory，
        推到不是卡片起点的位置，浏览器会吸回最近的吸附点，看起来就是完全没动。
     2) 别直接用 offsetLeft 当「距起点距离」。RTL 下浏览器给的 offsetLeft
        起点方向是 0、往左为负（proc-rail 实测 [928,714,500,286,72,-142]），
        abs() 之后跟当前位置比根本对不上，会算出「下一步=回到原地」而永远不动。
     可靠办法：按 getBoundingClientRect 相对滚动容器反算，
     容器右边缘就是 RTL 下的「起点」。 */
  function step() {
    const { max, pos } = railPos(rail);
    if (max < 8) return;

    /* getBoundingClientRect 反映的是「当前视觉位置」，
       也就是「距起点距离」减掉了已经滚过去的 pos。
       想拿卡片的真实停点，得把 pos 加回去。 */
    const base = rail.getBoundingClientRect();
    const rtl = rail.dataset.rtl === '1';
    const stops = [];
    for (const el of rail.children) {
      const b = el.getBoundingClientRect();
      /* RTL 起点在右边，LTR 起点在左边。 */
      const d = (rtl ? base.right - b.right : b.left - base.left) + pos;
      /* 过滤条件放宽：
         原来要 d < max-1，但内容只超出一张卡宽的条（比如 max=146、卡宽=200），
         所有站都会被滤光 → stops 空 → 一步都不走，正好卡在原地。
         所以只要「在范围内、且不是最后那张露半张的卡」就行。 */
      if (d > 1 && d <= max) stops.push(d);
    }
    stops.sort((a, b) => a - b);

    /* 找当前位置之后的第一站。
       没找到分两种情况：
         · 还在中间 → 推到头
         · 已经在头上 → 回到起点，循环播
       一开始就只有一个站可停的（内容只超出一张卡宽）也归到「推到头」，
       至少是真的在动，不会被 scroll-snap 吸回原地卡死。 */
    let next = stops.find(d => d > pos + 8);
    if (next === undefined) {
      next = (pos < max - 8) ? max : 0;
    }

    rail.scrollTo({ left: rtl ? -next : next, behavior: 'smooth' });
  }

  function start() {
    if (timer || paused) return;
    timer = setInterval(() => {
      /* 正在被用户操作就不动 */
      if (rail.matches(':hover') || rail.dataset.busy === '1') return;
      /* 不在视口里也不动，省得白跑 */
      const r = rail.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      step();
    }, RAIL_AUTOPLAY_MS);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  rail._railPause = () => { paused = true; stop(); };
  rail._railResume = () => { paused = false; start(); };

  /* 悬停暂停 */
  rail.addEventListener('mouseenter', rail._railPause);
  rail.addEventListener('mouseleave', () => { rail._railResume(); });

  /* 键盘操作（左右方向键）也算用户在操作 */
  rail.addEventListener('keydown', rail._railPause);
  rail.addEventListener('focusin', rail._railPause);
  rail.addEventListener('focusout', () => { rail._railResume(); });

  /* 触摸中暂停 */
  rail.addEventListener('touchstart', rail._railPause, { passive: true });
  rail.addEventListener('touchend', () => { rail._railResume(); }, { passive: true });

  /* 标签页切到后台就停，回到前台再跑 */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  /* 记下方向，自动轮播时要用（RTL 的 scrollLeft 是负数） */
  rail.dataset.rtl = getComputedStyle(rail).direction === 'rtl' ? '1' : '0';

  /* 用户手动滑（滚轮、拖拽、箭头）之后静默一会儿再恢复 */
  let quiet = null;
  const markBusy = () => {
    rail.dataset.busy = '1';
    if (rail._railResume) rail._railPause();
    if (quiet) clearTimeout(quiet);
    quiet = setTimeout(() => {
      rail.dataset.busy = '0';
      if (rail._railResume) rail._railResume();
    }, RAIL_RESUME_MS);
  };
  rail.addEventListener('wheel', markBusy, { passive: true });
  rail.addEventListener('scroll', () => {
    if (rail.dataset.drag === '1') markBusy();
  }, { passive: true });
  /* 点两侧箭头也算手动 */
  rail.parentElement && rail.parentElement.addEventListener('click', e => {
    if (e.target.closest('[data-rail]')) markBusy();
  });
  /* 鼠标拖动（下面 initUI 里拖动时会打 data-drag） */
  rail.addEventListener('pointerdown', markBusy);

  start();
}

/* ==========================================================================
   启动
   ========================================================================== */
function initUI() {
  const b = document.getElementById('burger');
  if (b) b.onclick = () => toggleDrawer();

  renderFloatWA();
  paintFavs();
  buildDrawer();

  /* 卡片上的收藏：全局代理，重新渲染网格后照样生效 */
  document.addEventListener('click', e => {
    const f = e.target.closest('[data-fav]');
    if (f) {
      e.preventDefault();
      e.stopPropagation();
      const on = toggleFav(f.dataset.fav);
      f.classList.add('pulse');
      setTimeout(() => f.classList.remove('pulse'), 420);
      toastMini(on ? 'أُضيف إلى مفضلتك' : 'أُزيل من مفضلتك');
      return;
    }

    const lb = e.target.closest('[data-lb]');
    if (lb) {
      let imgs = [];
      try { imgs = JSON.parse(lb.dataset.lb); } catch (e) {}
      if (imgs.length) { e.preventDefault(); openLightbox(imgs, +(lb.dataset.lbi || 0)); }
    }
  });

  /* 横向滑动条的两侧箭头 */
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-rail]');
    if (!btn) return;
    railStep(btn.parentElement.querySelector('.rail'), +btn.dataset.rail);
  });
  document.addEventListener('scroll', e => {
    if (e.target && e.target.classList && e.target.classList.contains('rail')) railEdges(e.target);
  }, true);
  window.addEventListener('resize', () => {
    document.querySelectorAll('.rail').forEach(railEdges);
  });
  document.querySelectorAll('.rail').forEach(railEdges);

  /* 滑动条支持鼠标拖动（桌面上比只有箭头好用） */
  document.querySelectorAll('.rail').forEach(rail => {
    let down = false, sx = 0, sl = 0;
    rail.addEventListener('pointerdown', e => {
      down = true; sx = e.clientX; sl = rail.scrollLeft;
      rail.classList.add('dragging');
      /* 告诉自动轮播「用户在拖」，别跟手抢 */
      rail.dataset.drag = '1';
    });
    addEventListener('pointerup', () => {
      down = false;
      rail.classList.remove('dragging');
      rail.dataset.drag = '0';
    });
    rail.addEventListener('pointermove', e => {
      if (!down) return;
      const rtl = getComputedStyle(rail).direction === 'rtl';
      const dx = (rtl ? -1 : 1) * (e.clientX - sx);
      rail.scrollLeft = sl + dx;
    });
    rail.addEventListener('scroll', () => railEdges(rail), { passive: true });
  });

  /* 自动轮播：卡片滑动条（.rail）自己动起来。
     注意只挂 .rail（流程区、材料区那种卡片条），
     不碰 .fp-row（筛选按钮行）—— 那个是让人主动点的，
     自动跑会把用户正要点的选项推走。
     railAutoPlay 里 dataset 去重，重复调用安全。 */
  document.querySelectorAll('.rail').forEach(railAutoPlay);

  /* 首页的流程条（proc-rail）是 page-home.js 渲染完才插进 DOM 的，
     上面那一遍扫不到它。所以盯着 body，后面谁插进来的 rail 都能补挂上。 */
  if (!initUI._apWatch) {
    initUI._apWatch = true;
    new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.classList && n.classList.contains('rail')) railAutoPlay(n);
          /* 也可能整块一起插进来，rail 在里面 */
          n.querySelectorAll && n.querySelectorAll('.rail').forEach(railAutoPlay);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
}

/* 轻提示：收藏成功这种小事不用打断人 */
let _tm = null;
function toastMini(msg) {
  let el = document.getElementById('mini-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mini-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(_tm);
  _tm = setTimeout(() => el.classList.remove('on'), 1700);
}

/* ==========================================================================
   颜色（改版时定下的品牌色）
   ========================================================================== */
function applyTheme(theme) {
  const t = theme || {};
  const r = document.documentElement.style;
  if (t.primary)   r.setProperty('--brand', t.primary);
  if (t.deep)      r.setProperty('--brand-deep', t.deep);
  if (t.gold)      r.setProperty('--gold', t.gold);
  if (t.bg)        r.setProperty('--bg', t.bg);
  if (t.ink)       r.setProperty('--ink', t.ink);
}
