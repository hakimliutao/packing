/* ==========================================================================
   前台 → 后台 一键跳转（r23）
   --------------------------------------------------------------------------
   大哥的原话：「能不能把网站前端和后端同时展示出来，然后我点击前端就跳到对应的
   后台修改的位置？这样会很节省力气。」

   做法：前台每个能改的板块，鼠标移上去时右上角浮出一个「✎ 编辑」小按钮，
   点一下就跳到 admin/?p=哪个分区&at=哪个区块，后台那边会滚到那一块
   并闪两下红框，一眼就看到要改哪儿。

   为什么不做成「前后同屏」：
     后台表单很长，跟前台同屏要塞进一个小窗口，改个图都得缩着鼠标拖，
     反而更累。跳过去更直接，而且跳过去就能接着改。

   为什么用配置表而不是往 HTML 里塞 data-edit：
     首页板块以后还会增删（后台能开关），配置表加一行就行，
     不用动HTML，也不会漏掉哪个板块忘了标。

   只在桌面端显示：手机上 hover 不成立，那个小按钮纯粹占地方。
   也不影响 SEO：这些都是运行时加的 DOM，不进 HTML 源码。
   ========================================================================== */

/* 每个板块去哪：前台容器 id → 后台 [分区, 后台锚点, 说明]
   分区只能是 products / cats / import / words / settings，
   对应后台 tab 上的 data-p 值。
   锚点是后台那些 <h3 id="set-xxx">，2026-10-08 用脚本批量加上去的。

   ★ 前台容器 id 必须跟 index.html 里真实的对得上。
     踩过一次：写cli-grid，实际是 cli-slot；
     proc-rail 是 blocks.js 生成的，静态 HTML 里没有，得用它的父容器 proc-sec。
     改这份表之前先 grep 一下 index.html 确认 id 存在。 */
const EDIT_MAP = [
  ['hero-stats-box', 'settings', 'set-stats',      '首页三个数字'],
  ['trust-grid',     'settings', 'set-homecopy',   '买家最关心的四件事'],
  ['cat-rail',        'cats',     'set-cats',       '产品类型'],
  ['mat-grid',        'cats',     'set-mats',       '原材料'],
  ['new-grid',        'products', '',               '最新上架产品'],
  ['cert-slot',       'settings', 'set-certs',      '认证资质'],
  ['feat-grid',       'settings', 'set-homecopy',   '我们是谁 · 优势'],
  ['faq-list',        'settings', 'set-faq',        '常见问题'],
  ['scene-sec',       'settings', 'set-homeblocks', '行业场景开关'],
  ['cta-slot',        'settings', 'set-homecopy',   '底部行动号召文案'],
  ['proc-sec',        'settings', 'set-process',    '定制流程'],
  ['cli-slot',        'settings', 'set-clients',    '客户案例'],
];

/* 板块自己可能整个藏掉（后台关了），藏掉的就不显示按钮。
   靠 find 一次真实存在来判，比猜 id 稳。 */
function makeEditBtn(targetId, panel, at, label) {
  const t = document.getElementById(targetId);
  if (!t) return;

  /* 找一个不挡内容的位置放按钮：优先板块右上角，
     板块太矮（内容不满一屏）就退到右上角外面一点，
     免得盖住第一张卡片的角。 */
  t.dataset.editHost = '1';
  t.style.position = t.style.position || 'relative';

  const b = document.createElement('a');
  b.className = 'edit-jump';
  b.href = '../admin/?p=' + panel + (at ? '&at=' + at : '');
  b.title = '到后台改「' + label + '」';
  b.setAttribute('data-edit-for', targetId);
  b.innerHTML = '<span class="ej-i">✎</span><span class="ej-t">编辑</span>';
  b.addEventListener('click', e => {
    /* Ctrl/⌘ + 点 → 新标签打开，前台这页不动。
       大哥想两边对照看的时候正好用得上。 */
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    markBackPos();
    location.href = b.getAttribute('href');
  });
  t.appendChild(b);

  /* 鼠标移入显示 */
  t.addEventListener('mouseenter', () => t.classList.add('edit-hover'));
  t.addEventListener('mouseleave', () => t.classList.remove('edit-hover'));
}

/* 前台这边只负责「跳之前记住回来的位置」。
   显示「回到前台」那条 bar 是后台干的活 —— 后台不加载本文件，
   写在在这儿等于白写（之前就踩过：函数在，但后台根本没执行它）。 */
function markBackPos() {
  try {
    sessionStorage.setItem('ej_back', location.pathname + location.hash);
  } catch (x) {}
}

/* 板块是 page-home.js 异步渲染的，而本文件在它之后加载 ——
   直接跑的话容器还不存在，12 个按钮只能挂上2 个（当时 hero 那个刚好在）。
   所以：先等 DOMContentLoaded，再等几个渲染周期，然后还漏就补，
   最后挂一个观察者兜底（有板块后来才插进来也能补上）。
   dataset 上有标记，补挂不会重复。 */
function markDone(el) {
  if (el.querySelector(':scope > .edit-jump')) return false;
  return true;
}

function tryMount() {
  let n = 0;
  EDIT_MAP.forEach(([t, p, at, label]) => {
    const host = document.getElementById(t);
    if (!host) return;
    if (!markDone(host)) return;
    makeEditBtn(t, p, at, label);
    n++;
  });
  return n;
}

function initEditJump() {
  if (!document.body) return;
  tryMount();
  /* 三轮补挂：数据来了会重绘板块，容器可能换掉 */
  [400, 1200, 2600].forEach(ms => setTimeout(tryMount, ms));
  /* 之后再插进来的板块（新板块 / 板块开关切了）也补上 */
  new MutationObserver(tryMount).observe(document.body,
    { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditJump);
} else {
  initEditJump();
}