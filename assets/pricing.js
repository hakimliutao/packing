/* ==========================================================================
   pricing.js — 阶梯价格 + 可定制项渲染
   --------------------------------------------------------------------------
   为什么单独一个文件：
   阶梯价格要按访客所在国家换算货币，还要能随货币切换刷新 ——
   这套逻辑在产品卡和详情页都要用，摊在这里比各写一遍强。

   数据长这样（后台填的）：
     priceTiers: [{ from: 100, to: 499, price: 0.35 }, { from: 500, to: null, price: 0.28 }]
     custom:     { sizesAr: [...], materialsAr: [...], printAr: [...],
                   extrasAr: [...], leadTimeAr: '7 – 14 يوم' }

   price 一律是 AED（基准货币）。这里转成访客的货币显示。
   没有价格的产品（包装盒这类按尺寸谈的）不显示价格块，
   直接引导去 Whats报 —— 硬编个数字反而显得不专业。 */

/* ---------- 阶梯价格 ---------- */

/* 把 to=null（无上限）显示成 "1000 +" */
function tierLabel(t) {
  const ui = (typeof CTX !== 'undefined' && CTX.tax && CTX.tax.ui) || {};
  if (t.to == null) return fmtNum(t.from) + ' ' + (ui.plusAr || '+');
  return fmtNum(t.from) + ' – ' + fmtNum(t.to);
}

/* 千位分隔：1234 → 1,234。中东那边读阿拉伯数字的习惯不一样，
   统一用西文数字 + 逗号最不容易出错 */
function fmtNum(n) {
  const v = Math.round(Number(n) || 0);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* 阶梯价格表。
   o.compact = true 时只显示「起 N 件 · 单价」一行，用于产品卡。 */
function priceTable(p, opts) {
  const o = opts || {};
  const tiers = (p && p.priceTiers) || [];
  if (!tiers.length) return '';
  const ui = (typeof CTX !== 'undefined' && CTX.tax && CTX.tax.ui) || {};
  const per = ui.perPieceAr || 'للقطعة';
  const cur = window.Currency ? window.Currency.current() : 'AED';

  if (o.compact) {
    /* 卡片上只给最低那档的起价 —— 让人知道「便宜得下来」，
       想看全部档位得点进详情 */
    const first = tiers[0];
    return `<div class="ptier-compact">
      <span class="pt-label">${esc(ui.fromAr || 'ابتداءً من')}</span>
      <span class="pt-qty">${fmtNum(first.from)} ${esc(ui.pcsAr || 'قطعة')}</span>
      <span class="pt-price">${moneyHTML(first.price)} <span class="pt-per">${esc(per)}</span></span>
    </div>`;
  }

  return `<div class="ptier-box">
    <div class="ptier-head">
      <span class="ptier-title">${esc(ui.priceTitleAr || 'الأسعار التقديرية')}</span>
      <span class="ptier-ccy" dir="ltr">${esc(cur)}</span>
    </div>
    <table class="ptier">
      <thead><tr>
        <th>${esc(ui.qtyAr || 'الكمية')}</th>
        <th>${esc(ui.unitPriceAr || 'سعر القطعة')}</th>
        <th>${esc(ui.totalAr || 'الإجمالي')}</th>
      </tr></thead>
      <tbody>
        ${tiers.map(t => {
          /* 总价给个参考，方便买家心里算账。
             最后一档（无上限）没法算总价，显示 "حسب الكمية"。 */
          const total = t.to == null ? null : t.from * t.price;
          return `<tr${t === tiers[tiers.length - 1] ? ' class="last"' : ''}>
            <td class="q">${fmtNum(t.from)}${t.to == null ? ' <span class="more">+</span>' : ' – ' + fmtNum(t.to)}</td>
            <td class="p">${moneyHTML(t.price)}</td>
            <td class="t">${total == null
              ? `<span class="neg">${esc(ui.negotiableAr || 'حسب الكمية')}</span>`
              : `<span class="from">${esc(ui.fromAr2 || 'من')} </span>${moneyHTML(total)}`}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <p class="ptier-note">${esc(ui.priceNoteAr ||
      'الأسعار تقديرية وتختلف حسب المقاس والخامة وكمية الطباعة. للتسعير النهائي تواصل معنا.')}</p>
  </div>`;
}

/* 出一段价格 HTML（带 data-aed，货币切换时能自动刷新）。
   Currency 没加载时退化成纯数字 —— 页面不能因为缺个脚本就不显示价格。 */
function moneyHTML(aed, digits) {
  if (!window.Currency) return esc(String(aed));
  return window.Currency.money(aed, { digits: digits });
}

/* ---------- 可定制项 ---------- */

const CUSTOM_LABEL = {
  sizesAr: 'المقاسات المتاحة',
  materialsAr: 'الخامات',
  printAr: 'خيارات الطباعة',
  extrasAr: 'إضافات',
  leadTimeAr: 'مدة التسليم',
};

/* 「可定制项」清单 —— 买家最想知道的四件事之一（另三件：起订量/交期/材质/报价入口）。
   按类分组显示，别堆成一长串。 */
function customBlock(p) {
  const c = (p && p.custom) || {};
  const ui = (typeof CTX !== 'undefined' && CTX.tax && CTX.tax.ui) || {};
  /* r28：sizesAr 从这里去掉了 —— 尺寸（原来的「容量」）已经合并进规格表，
     这里再列一遍客户会在同一页看到两处尺寸。 */
  const keys = ['materialsAr', 'printAr', 'extrasAr'];
  const rows = keys.filter(k => (c[k] || []).length).map(k => `
    <div class="cu-row">
      <span class="cu-k">${esc(CUSTOM_LABEL[k])}</span>
      <span class="cu-v">${(c[k] || []).map(x => esc(x)).join(' <i>·</i> ')}</span>
    </div>`).join('');

  const lead = c.leadTimeAr ? `
    <div class="cu-row cu-lead">
      <span class="cu-k">${esc(CUSTOM_LABEL.leadTimeAr)}</span>
      <span class="cu-v">${esc(c.leadTimeAr)}</span>
    </div>` : '';

  if (!rows && !lead) return '';
  return `<div class="cu-box">
    <div class="cu-title">
      <span class="cu-ic">✎</span>
      ${esc(ui.customTitleAr || 'شنو نقدر نعدّل')}
    </div>
    ${rows}${lead}
  </div>`;
}

/* ---------- 详情页顶部的行动区 ---------- */

/* 「اطلب عرض سعر」—— 买家点了直接开 WhatsApp，
   消息里带上产品名，能省一轮来回问「你要什么」。
   这是成单最关键的一个按钮，所以放在价格块上面。 */
function quoteBar(p) {
  const ui = (typeof CTX !== 'undefined' && CTX.tax && CTX.tax.ui) || {};
  const link = ((typeof waProductLink === 'function') ? waProductLink(p) : '#');
  /* r21：后台关掉「产品类按钮」这一位置，报价条也一起消失，
     不能留一条没按钮的空提示条在那儿。 */
  if (typeof waOn === 'function' && !waOn('waProduct')) return '';
  return `<div class="quotebar">
    <a class="btn btn-wa btn-lg" href="${esc(link)}" target="_blank" rel="noopener">
      ${window.WA_ICON || ''} ${esc(ui.quoteBtnAr || 'اطلب عرض سعر')}
    </a>
    <p class="qb-hint">${esc(ui.quoteHintAr ||
      'أرسل لنا المقاس والكمية والخامة، ونرد خلال ساعات بالأسعار.')}</p>
  </div>`;
}

window.Pricing = {
  priceTable, customBlock, quoteBar, tierLabel, fmtNum,
  CUSTOM_LABEL,
};