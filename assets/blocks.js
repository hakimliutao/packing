/* ==========================================================================
   三个新板块的渲染：认证资质 / 定制流程 / 客户案例
   --------------------------------------------------------------------------
   为什么单独一个文件：这三个板块首页只放一个入口，详情页才展开细说。
   首页和详情页都要用同一套渲染逻辑，写两遍以后改文案就会漏掉一处。
   数据都在 site.json 里，老数据没有这三个字段 —— 一律给空数组兜底，
   页面不会因为「后台还没填」而白屏。
   ========================================================================== */

/* ---------- 通用小工具 ---------- */
function blockData(key) {
  return (CTX && CTX.site && CTX.site[key]) || {};
}
function blockItems(key, sub) {
  const b = blockData(key);
  const arr = b[sub] || [];
  /* 按 sort 排，没 sort 的保持原顺序（老数据兼容） */
  return arr
    .map((x, i) => ({ x, i }))
    .sort((a, b2) => ((a.x.sort || a.i + 1) - (b2.x.sort || b2.i + 1)))
    .map(o => o.x);
}

/* ==========================================================================
   ① 认证资质
   首页：一条窄 banner，点进去看全部（大哥说首页不要堆太多）
   详情：网格卡片，每张有 logo 图、机构、编号、有效期、说明
   ========================================================================== */
function certBanner() {
  const b = blockData('certifications');
  const items = blockItems('certifications', 'items');
  if (!items.length) return '';
  const ui = (CTX.tax && CTX.tax.ui) || {};
  return `
    <a class="cert-banner" href="certifications.html">
      <div class="cb-in">
        <div class="cb-txt">
          <span class="kicker">${esc(b.kickerAr || '')}</span>
          <h2>${esc(b.titleAr || '')}</h2>
          <p>${esc(b.leadAr || '')}</p>
        </div>
        <div class="cb-n">
          <b>${items.length}</b>
          <span>${esc(ui.certCountAr || 'شهادة')}</span>
        </div>
        <span class="cb-go">${esc(ui.viewAllAr || 'عرض الكل')} <i aria-hidden="true">←</i></span>
      </div>
    </a>`;
}

function certGrid(full) {
  const items = blockItems('certifications', 'items');
  if (!items.length) return '';
  return `<div class="cert-grid${full ? ' full' : ''}">` + items.map(c => `
    <article class="cert-card">
      <div class="cc-top">
        <div class="cc-badge">
          ${c.image ? imgTag(c.image, c.nameAr, { set: c.imageSet, sizes: '(max-width:620px) 64px, 64px' })
                    : `<span class="cc-ic" aria-hidden="true">✓</span>`}
        </div>
        <div class="cc-tt">
          <h3>${esc(c.nameAr || '')}</h3>
          ${c.orgAr ? `<p class="cc-org">${esc(c.orgAr)}</p>` : ''}
        </div>
      </div>
      ${c.descAr ? `<p class="cc-desc">${esc(c.descAr)}</p>` : ''}
      <dl class="cc-meta">
        ${c.noAr ? `<div><dt>${esc((CTX.tax?.ui?.certNoAr) || 'رقم الشهادة')}</dt><dd>${esc(c.noAr)}</dd></div>` : ''}
        ${c.dateAr ? `<div><dt>${esc((CTX.tax?.ui?.certDateAr) || 'تاريخ الإصدار')}</dt><dd>${esc(c.dateAr)}</dd></div>` : ''}
      </dl>
      ${c.file ? `<a class="cc-file" href="${esc(c.file)}" target="_blank" rel="noopener">${esc((CTX.tax?.ui?.certFileAr) || 'تحميل الشهادة')}</a>` : ''}
    </article>`).join('') + `</div>`;
}

/* ==========================================================================
   ② 定制流程（首页六站位图 / 详情页逐步展开）
   ========================================================================== */
/* 首页流程条：横向滑动条，手机左右滑。
   按用户要求去掉每步下面的说明文字，只留编号 + 图标 + 标题 ——
   6 个步骤竖着排会占满一屏，横着滑只占一行高度。
   详细的每步说明在 process.html。 */
function processStrip() {
  const b = blockData('process');
  const steps = blockItems('process', 'steps');
  if (!steps.length) return '';
  const ui = (CTX.tax && CTX.tax.ui) || {};
  return `
    <div class="proc-wrap rail-wrap">
      <div class="rail proc-grid" id="proc-rail">
        ${steps.map((s, i) => `
          <a class="proc-step" href="process.html#${esc(s.id)}">
            <span class="ps-n">${esc(s.n || (i + 1))}</span>
            <span class="ps-ic">
              ${s.image ? imgTag(s.image, s.titleAr, { set: s.imageSet, sizes: '(max-width:620px) 40vw, 160px' })
                        : `<span class="ps-em" aria-hidden="true">${['💬', '📐', '🏷️', '✅', '🏭', '🚚'][i] || '•'}</span>`}
            </span>
            <span class="ps-t">${esc(s.titleAr || '')}</span>
          </a>`).join('')}
      </div>
      <a class="btn btn-line proc-more" href="process.html">${esc(ui.processMoreAr || 'تفاصيل خطوات التخصيص')}</a>
    </div>`;
}

function processFull() {
  const b = blockData('process');
  const steps = blockItems('process', 'steps');
  if (!steps.length) return '';
  return `<ol class="proc-detail">` + steps.map((s, i) => `
    <li class="pd-row" id="${esc(s.id)}">
      <div class="pd-img">
        ${s.image ? imgTag(s.image, s.titleAr, { set: s.imageSet, sizes: '(max-width:900px) 100vw, 420px' })
                  : `<span class="pd-em" aria-hidden="true">${['💬', '📐', '🏷️', '✅', '🏭', '🚚'][i] || '•'}</span>`}
      </div>
      <div class="pd-body">
        <span class="pd-n">${s.n || (i + 1)}</span>
        <h3>${esc(s.titleAr || '')}</h3>
        <p>${esc(s.bodyAr || '')}</p>
      </div>
    </li>`).join('') + `</ol>`;
}

/* ==========================================================================
   ③ 客户案例墙
   首页：卡片（logo + 客户名 + 一句合作细节），点进去看合影大图
   详情：logo + 合影 + 完整合作叙述
   ========================================================================== */
/* 首页客户墙：只显示前 limit 个（后台 homeClientsCountAr，默认 3），
   后面跟一个「المزيد」按钮进 clients.html 看全部。
   limit 传 0 / 不传 = 全部显示（详情页 clientFull 用的是全量）。 */
function clientWall(limit) {
  const b = blockData('clients');
  const all = blockItems('clients', 'items');
  if (!all.length) return '';
  const ui = (CTX.tax && CTX.tax.ui) || {};
  const n = parseInt(limit, 10);
  const items = (Number.isFinite(n) && n > 0) ? all.slice(0, n) : all;

  /* 摘要优先用后台填的 summaryAr（专门给卡片用的一句话）。
     没有就退回 bodyAr 截断 —— bodyAr 是详情页的长描述，
     直接搬上来卡片会高矮不齐，一排卡片看着很乱。
     注意：截断要在渲染时做，不能在写入时做 ——
     详情页还要用完整的 bodyAr，截了就丢了。 */
  const brief = c => {
    const s = (c.summaryAr || c.bodyAr || '').trim();
    return s.length > 96 ? s.slice(0, 96).replace(/\s+\S*$/, '') + '…' : s;
  };

  /* 左右结构：左边 logo 方图，右边行业 + 客户名 + 摘要 + 阅读更多 */
  const wall = `
    <div class="cli-wall">
      ${items.map(c => `
        <a class="cli-card" href="clients.html#${esc(c.id)}">
          <span class="cli-logo">
            ${c.logo ? imgTag(c.logo, c.nameAr, { set: c.logoSet, sizes: '(max-width:620px) 96px, 132px' })
                     : `<span class="cli-ic" aria-hidden="true">◈</span>`}
          </span>
          <span class="cli-bd">
            ${c.subAr ? `<span class="cli-tag">${esc(c.subAr)}</span>` : ''}
            <b class="cli-name">${esc(c.nameAr || '')}</b>
            <span class="cli-body">${esc(brief(c))}</span>
            <span class="cli-go">${esc(ui.clientMoreAr || 'اقرأ التفاصيل')} <i aria-hidden="true">←</i></span>
          </span>
        </a>`).join('')}
    </div>`;

  /* 「更多」按钮总是显示。用户明确要求「只展示三个，其余的点击更多」，
     即使当前正好只有 3 个客户也要给一个入口去 clients.html
     （那张页有合影大图和完整合作细节，首页卡片看不到）。 */
  return wall + `
    <div class="sec-foot">
      <a class="btn btn-line" href="clients.html">${esc(ui.clientsMoreAr || 'كل العملاء')}</a>
    </div>`;
}

function clientFull() {
  const items = blockItems('clients', 'items');
  if (!items.length) return '';
  return `<div class="cli-detail">` + items.map(c => `
    <article class="cd-row" id="${esc(c.id)}">
      <div class="cd-photo">
        ${c.image ? imgTag(c.image, c.nameAr, { set: c.imageSet, sizes: '(max-width:900px) 100vw, 480px' })
                  : `<span class="cd-em" aria-hidden="true">◈</span>`}
      </div>
      <div class="cd-body">
        <div class="cd-logo">
          ${c.logo ? imgTag(c.logo, c.nameAr, { set: c.logoSet, sizes: '160px' })
                   : `<span class="cli-ic" aria-hidden="true">◈</span>`}
        </div>
        <h3>${esc(c.nameAr || '')}</h3>
        ${c.subAr ? `<p class="cd-sub">${esc(c.subAr)}</p>` : ''}
        <p class="cd-text">${esc(c.bodyAr || '')}</p>
      </div>
    </article>`).join('') + `</div>`;
}

window.blockData = blockData;
window.certBanner = certBanner;
window.certGrid = certGrid;
window.processStrip = processStrip;
window.processFull = processFull;
window.clientWall = clientWall;
window.clientFull = clientFull;
