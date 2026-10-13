/* ==========================================================================
   currency.js — 六国货币换算
   --------------------------------------------------------------------------
   为什么不做「按 IP 强制切换」
   同一个网址给不同国家的人返回不同内容，Google 判定为重复内容，
   同一个页面在阿联酋是迪拉姆版、在沙特是里亚尔版，两个版本互相稀释排名，
   SEO 会掉分。所以这里的做法是：

     IP  → 只决定「第一次打开时默认显示哪个」
     选过 → 记在 localStorage 里，之后这个人一直看到自己选的

   页面本身的文字、价格结构对所有人是一样的（同一份 HTML），只有数字前
   缀的货币符号会变 —— 这不算重复内容，因为主体内容一致。

   汇率从哪来
   1. Netlify 函数 fx 每小时拉一次官方汇率，缓存在 Blobs（免费额度够）
   2. 拉不到就用本地这组兜底值，并标 stale，前台照常显示只是提示可能不准
   3. 后台可以手动锁定汇率（汇率剧烈波动时应急）

   币值排序（海湾六国，不能按数字大小排）：
     1 KWD > 1 BHD > 1 OMR > 1 AED > 1 SAR > 1 QAR
   所以「1 KWD 能换 12 个 AED」，反过来不成立。 */

const CURRENCIES = {
  AED: { ar: 'درهم إماراتي', short: 'د.إ', country: 'AE', nation: 'الإمارات', fallback: 1 },
  SAR: { ar: 'ريال سعودي',  short: 'ر.س', country: 'SA', nation: 'السعودية', fallback: 1.0926 },
  KWD: { ar: 'دينار كويتي', short: 'د.ك', country: 'KW', nation: 'الكويت', fallback: 0.0823 },
  BHD: { ar: 'دينار بحريني', short: 'د.ب', country: 'BH', nation: 'البحرين', fallback: 0.0982 },
  OMR: { ar: 'ريال عماني', short: 'ر.ع', country: 'OM', nation: 'عُمان', fallback: 0.3847 },
  QAR: { ar: 'ريال قطري', short: 'ر.ق', country: 'QA', nation: 'قطر', fallback: 1.0107 },
};
const BASE_CCY = 'AED';           /* 所有价格存成 AED，前台按需换 */
const KEYS = Object.keys(CURRENCIES);

/* 国家 → 默认货币。IP 查到的国家落到这里 */
const COUNTRY_CCY = {
  AE: 'AED', SA: 'SAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', QA: 'QAR',
  /* 周边说阿拉伯语的国家默认迪拉姆（阿联酋是海湾里最大的转口市场） */
  EG: 'AED', JO: 'AED', LB: 'AED', IQ: 'AED', SY: 'AED', YE: 'AED', PS: 'AED', DZ: 'AED',
};

let _state = { ccy: BASE_CCY, rates: null, stale: false, locked: false };
let _ready = null;

/* ---------- 汇率 ---------- */

/* 兜底汇率：全部按 1 AED = X 记（上次手工核的量级，只求不离谱） */
function fallbackRates() {
  const r = {};
  KEYS.forEach(k => { r[k] = CURRENCIES[k].fallback; });
  return r;
}

/* 去后端拿汇率 + 访客国家。
   拿不到就用兜底汇率，别让页面因为汇率接口挂了就不显示价格。 */
async function loadRates() {
  try {
    const res = await fetch(window.AR_BASE + 'api/fx', { headers: window.AR_ADMIN_HEADERS() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j.ok === false || !j.data || !j.data.rates) throw new Error(j.error || 'no rates');
    return {
      rates: j.data.rates,
      stale: !!j.data.stale,
      locked: !!j.data.locked,
      country: (j.data.country || '').toUpperCase(),
    };
  } catch (e) {
    /* 接口不通（本地没网、公司防火墙）时用兜底值，
       价格照常显示，只是汇率可能不是最新的 —— 强过整页不显示价格 */
    return { rates: fallbackRates(), stale: true, locked: false, country: '' };
  }
}

/* ---------- 当前选哪个货币 ---------- */

function countryOf() {
  return _state.country || '';
}

/* 国家来源优先级：
   ① 用户手选过（localStorage）—— 这是唯一真正决定显示什么的
   ② 后端按 IP 查到的国家（Netlify 的 x-nf-geo 头）
   ③ 浏览器语言里的地区码
   ④ 兜底 AED
   注意 ② 只在「没有手动记录」时才用。已经在 localStorage 里选过的人，
   哪怕他从阿联酋飞到科威特，也还是看他自己选的那个。 */
function current() {
  const saved = localStorage.getItem('ar_ccy');
  if (saved && KEYS.includes(saved)) return saved;
  const byCountry = COUNTRY_CCY[countryOf()];
  return byCountry || BASE_CCY;
}

/* 读浏览器语言（阿拉伯语区多数）—— 拿不到国家时的次选依据 */
function guessFromLanguage() {
  const lang = (navigator.language || '').toUpperCase();
  /* 有些地区标记带区域：AR-AE / ar-KW */
  const m = lang.match(/[-_]([A-Z]{2})$/);
  const cc = m ? m[1] : null;
  return (cc && COUNTRY_CCY[cc]) || null;
}

/* ---------- 换算 ---------- */

/* AED 金额 → 当前货币金额 */
function convert(aedAmount, ccy) {
  const to = ccy || _state.ccy || BASE_CCY;
  const rate = (_state.rates && _state.rates[to]) || CURRENCIES[to].fallback;
  return aedAmount * rate;
}

/* 数字格式化：按货币习惯决定小数位。
   科威特/巴林/卡塔尔用三小数（ fils），阿联酋/沙特/阿曼用两小数。 */
function fmt(aedAmount, opts) {
  const o = opts || {};
  const to = o.ccy || _state.ccy || BASE_CCY;
  const v = convert(aedAmount, to);
  /* 三位就转 fils：1.234 KWD 显示成 1.234，不是 1.23 */
  const digits = (CURRENCIES[to].fallback < 0.15) ? 3 : 2;
  const n = v.toFixed(o.digits != null ? o.digits : digits);
  const sym = o.symbol || CURRENCIES[to].short;
  const body = (o.plain || !sym) ? n : n + ' ' + sym;
  return body;
}

/* ---------- 初始化 ---------- */

/* 只调一次。多个页面都调，用同一个 promise 复用。
   国家从 Netlify 注入的 header 拿（服务端加一行 script），拿不到退回语言推断。 */
function init() {
  if (_ready) return _ready;
  _ready = (async () => {
    const fx = await loadRates();
    _state.rates = fx.rates;
    _state.stale = fx.stale;
    _state.locked = fx.locked;
    /* IP 查到的国家 —— 只在没有手动选择时才影响默认值 */
    _state.country = fx.country || window.AR_COUNTRY || '';
    _state.ccy = current();
    /* 后端没给国家（本地开发、外部接口挂了）时退到浏览器语言 */
    if (!localStorage.getItem('ar_ccy') && !_state.country) {
      const byLang = guessFromLanguage();
      if (byLang) _state.ccy = byLang;
    }
    /* 汇率到了就把页面上已经画出来的价格重刷一次。
       页面不等汇率（不然首屏变慢），所以很可能价格是用兜底汇率先画的，
       这一步把它换成真实汇率 —— 少了这步，从科威特进来会先看到迪拉姆闪一下。*/
    paintCurrency();
    return _state;
  })();
  return _ready;
}

/* 切换货币：记进 localStorage，然后刷新页面上所有价格。 */
async function setCurrency(code) {
  if (!KEYS.includes(code)) return;
  localStorage.setItem('ar_ccy', code);
  _state.ccy = code;
  document.documentElement.setAttribute('data-ccy', code);
  if (window.paintCurrency) window.paintCurrency(code);
  try {
    window.dispatchEvent(new CustomEvent('ccychange', { detail: { ccy: code } }));
  } catch (e) {}
}

/* 价格元素统一加这个类，切换时自动被刷新。
   显示方式（要不要符号、几位小数）写进 data-*，
   切换货币时 paintCurrency 照着原样重刷，不会把所有价格刷成同一个样。 */
/* 出价元素。
   注意：不管汇率到没到，都必须带 data-aed ——
   页面渲染可能早于汇率返回（页面不等汇率，直接画），那时rates 还是空的。
   如果这时不写 data-aed，汇率回来后就刷不动了，数字会一直停在裸数字上。 */
function money(aedAmount, opts) {
  const o = opts || {};
  const attrs = Object.keys(o.attrs || {}).map(k => ' ' + k + '="' + o.attrs[k] + '"').join('');
  let meta = '';
  if (o.plain) meta += ' data-plain="1"';
  if (o.symbol === '') meta += ' data-sym="0"';
  else if (typeof o.symbol === 'string') meta += ' data-sym="' + o.symbol + '"';
  if (o.digits != null) meta += ' data-digits="' + o.digits + '"';
  return '<span class="money" data-aed="' + (aedAmount || 0) + '"' + meta +
         (o.cls ? ' class="' + o.cls + '"' : '') + attrs + '>' +
         fmt(aedAmount, o) + '</span>';
}

/* 页面上所有 .money 重新按新货币刷新一次 */
function paintCurrency() {
  document.querySelectorAll('.money[data-aed]').forEach(el => {
    const aed = parseFloat(el.getAttribute('data-aed')) || 0;
    /* 记下当初的显示方式，刷新时照样套用 */
    const sym = el.getAttribute('data-sym');
    const digits = el.getAttribute('data-digits');
    el.textContent = fmt(aed, {
      ccy: _state.ccy,
      plain: el.getAttribute('data-plain') === '1',
      symbol: sym === '0' ? '' : (sym || undefined),
      digits: digits != null && digits !== '' ? parseInt(digits, 10) : undefined,
    });
  });
  const sel = document.getElementById('ccy-select');
  if (sel) sel.value = _state.ccy;
}

window.Currency = {
  CURRENCIES, KEYS, BASE_CCY, COUNTRY_CCY,
  init, current, setCurrency, convert, fmt, money, paintCurrency,
  get state() { return _state; },
  get rates() { return _state.rates || fallbackRates(); },
  fallbackRates,
};
window.AR_CURRENCY = window.Currency;
/* 页头下拉要读这两个（site.js 里的 ccyOptions 用） */
window.CURRENCY_LIST = KEYS;
window.CURRENCY_INFO = CURRENCIES;