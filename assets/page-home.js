/* ============================ 首页 ============================ */
async function initHome() {
  await boot('home');
  const { site, tax } = CTX;
  const ui = tax.ui;

  /* 首屏文案
     banner 已经在 HTML 里放到最上面了（#hero-banners 在 .hero-text 之前），
     这边只填文字。原来四段（eyebrow 小字 / 大标题 / 直答块 / 营销句）
     按用户要求砍成两段：大标题 + 一句 30-40 字的介绍。
     eyebrow 和 lead 的元素已经从 HTML 里删掉，这里的 set 会自动跳过。 */
  const hero = site.hero || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || ''; };

  /* 每个板块显示几个 —— 后台可改（categories.json 的 ui.home*CountAr）。
     传 0 或者没配就用默认值，避免后台误填把整个板块清空。
     numUi 读的是数字，字段里存的是字符串，所以要 parseInt。 */
  const numUi = (key, dflt) => {
    const n = parseInt(ui[key], 10);
    /* 显式填 0 = 隐藏该板块（后台「أقسام الصفحة الرئيسية」里能设）。
       没配这个字段（老数据）才退回默认数量。 */
    if (n === 0) return 0;
    return Number.isFinite(n) && n > 0 ? n : dflt;
  };

  /* 后台把某个板块的数量填成 0 → 整个 section 藏掉，不是显示 0 个卡片。
     留个空标题在页面上比不显示更难解释。
     返回 true = 该板块要藏，后面就别渲染了。 */
  const hideIfZero = (secId, key, dflt) => {
    const n = numUi(key, dflt);
    if (n === 0) {
      const el = document.getElementById(secId);
      if (el) el.hidden = true;
      return true;
    }
    const el = document.getElementById(secId);
    if (el) el.hidden = false;
    return false;
  };

  /* r26：首页要显示哪几个「选择入口」。
     大哥要求只留「工艺」和「行业&场景」两个 —— 产品类型和原材料收起来。
     代码、数据、上传过的图全都留着，把这里改成 true 就能恢复，不用动别的。 */
  const HOME_ENTRIES = { crafts: true, sectors: true, cats: false, mats: false };

  /* r24：末行孤儿卡。
     5 张卡摆 3 列 -> 每行 [3,1,1]，最后那两张孤零零挂在下面，
     大哥说这正是「看着空旷」的来源之一。

     做法：算出这个网格实际几列，把末行装不下的藏起来。
     不砍数据、不改后台配置 —— 只在前台少显示。
     宽度变了列数也会变（4列→2列→1列），所以监听 resize 重算。
     为什么不用 CSS :last-child:nth-child 那些技巧：列数跟断点走，
     写死一套规则要同时照顾 4 种列数，维护不动。 */
  const fillRow = (id) => {
    const g = document.getElementById(id);
    if (!g) return;
    /* 每次都从完整子列表开始，先把上次藏的全都放回来。
       —— 必须在算 cols 之前恢复：如果上次藏了卡片，这次 cols 变了，
       只看「当前可见的」会导致上次的隐藏被继承，越算越少。 */
    /* ★ 只数真正的卡片，edit-jump（前台那个「编辑」按钮）不算。
       editjump.js 把按钮挂在网格容器里面，它也是 g.children 的一员，
       但它是绝对定位浮在板块上的浮层，不占grid 位。
       踩过一次：把它算进总数，new-grid 是 4 卡 + 1 按钮 = 5，
       5 % 3 = 2 → 末行藏2 张，其中 1 张是真卡、1 张是编辑按钮，
       结果真卡少显示一张、编辑按钮也点不到了。 */
    const all = [...g.children].filter(k => !k.classList.contains('edit-jump'));
    all.forEach(k => k.hidden = false);
    if (!all.length) return;
    /* grid-template-columns 的实际值形如 "310px 310px 310px"，
       空格分隔的段数就是列数；repeat() 已由浏览器算成 px 了。 */
    const cols = getComputedStyle(g).gridTemplateColumns
      .split(' ').filter(s => s && s !== 'none').length;
    /* 单列（一列就占满一行）本来就没有孤儿卡，不用动。 */
    if (!cols || cols < 2) return;
    const rest = all.length % cols;
    if (rest) {
      for (let i = all.length - rest; i < all.length; i++) all[i].hidden = true;
    }
  };
  /* 几张网格都在同一段落里渲染完，统一在最后调一次。
     resize 要节流，不然拖窗口时疯狂重排。 */
  const FILL_TARGETS = ['trust-grid', 'new-grid', 'feat-grid',
    'featured-grid', 'cat-rail', 'mat-grid'];
  let _fillTimer = null;
  const fillAll = () => FILL_TARGETS.forEach(fillRow);
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      clearTimeout(_fillTimer);
      _fillTimer = setTimeout(fillAll, 160);
    });
  }

  /* 大标题里允许 <em> 包裹关键词（阿拉伯语斜体，视觉上更突出），
     但其余字符要转义 —— esc 之后把 &lt;em&gt; 换回真标签。 */
  const ht = document.getElementById('hero-title');
  if (ht) ht.innerHTML = esc(hero.titleAr || '').replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>');
  set('hero-primary', hero.primaryBtnAr);
  set('hero-secondary', hero.secondaryBtnAr);

  /* 直答块 —— 按用户要求压到30-40 字，只回答三件事：
     我们是做什么的 / 覆盖哪些海湾国家 / 怎么找我。
     这段是写给搜索引擎和 AI 引擎看的：它们不执行 JS，
     只从 HTML 里抓文字，抓到明确的答案才会引用。
     所以措辞要像被人问「你们是干什么的」时的标准回答。 */
  set('hero-answer',
    ui.heroAnswerAr ||
    'شركة تغليف عربية تقدّم أكواباً وأكياساً وعلباً ورقية ومبلاستيكية تُطبَّع بشعارك. ' +
    'نخدم المقاهي والمطاعم في دول الخليج. اطلب عرض سعر على واتساب ونرد خلال ساعات.');

  /* 三个数字：后台把 stats 清空 → 整块连分隔线一起藏掉，
不留一条空横线在那里。数量也能控（homeStatsCountAr，0 = 隐藏）。

   r23补：光看数量不够。大哥在后台把三个数字的内容删了（清空 value/labelAr），
   但数量配置还是 99，hideIfZero 会返回 false 把盒子留着 ——
   于是 .hero-stats 的 margin-top:44px + padding-top:28px + border-top
   全成了空白，一条横线孤零零挂在那儿，这就是大哥说的「留了一个很大的空位置」。
   所以这里再判一次：渲染完如果一个有效数字都没有，整个盒子也藏掉。
   比直接删板块好 —— 以后想加回来，后台填数字就行，代码不用动。 */
  const statsHidden = hideIfZero('hero-stats-box', 'homeStatsCountAr', 99);
  const hs = document.getElementById('hero-stats');
  if (hs) {
    hs.innerHTML = (site.stats || []).map(s =>
      `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.labelAr)}</span></div>`).join('');
    /* 内容真的空了（数字和说明都没填）→ 也藏，别留空壳 */
    const realStats = (site.stats || []).filter(s => (s.value || '').trim() || (s.labelAr || '').trim());
    const box = document.getElementById('hero-stats-box');
    if (!realStats.length && box) box.hidden = true;
    else if (box && !statsHidden) box.hidden = false;
  }

  /* 信任区：买家下单前最想确认的四件事。
     这一块跟 SEO 无关，纯粹为了成单—— 「能不能定制 / 交期多久 /
     什么材料 / 怎么下单」答清楚，询盘质量会明显提高。
     手机端 4 小格一行，点格子弹层看说明（弹层在 popup.js 里统一处理，
     这里只负责把说明放进 data-desc）。数量由 homeTrustCountAr 控制，0 = 隐藏。 */
  const trustItems = (site.trust && site.trust.items && site.trust.items.length)
    ? site.trust.items
    : [
        { ic: '✎', titleAr: 'تخصيص كامل', descAr: 'شعارك ونصك مطبوعان على المنتج، مع اختيار المقاس والخامة والعدد.' },
        { ic: '◷', titleAr: 'تسليم 7–25 يوم', descAr: 'مدة تسليم واضحة منذ البداية، بلا مفاجآت.' },
        { ic: '✓', titleAr: 'مواد غذائية آمنة', descAr: 'خامات مطابقة للمواصفات مع شهادات مطابقة عند الطلب.' },
        { ic: '¤', titleAr: 'أسعار خليجية', descAr: 'الأسعار تُعرض بعملة بلدك تلقائياً: درهم، ريال، دينار.' },
      ];
  set('trust-title', (site.trust && site.trust.titleAr) || ui.trustTitleAr || 'تغليف مخصص من الألف إلى الياء');
  const trustHidden = hideIfZero('trust-sec', 'homeTrustCountAr', 99);
  const tg = document.getElementById('trust-grid');
  if (tg && !trustHidden) {
    tg.innerHTML = trustItems.slice(0, numUi('homeTrustCountAr', 99)).map(t => `
      <div class="trust" tabindex="0" data-title="${esc(t.titleAr)}" data-desc="${esc(t.descAr || '')}">
        <span class="trust-ic">${esc(t.ic || '✓')}</span>
        <h3>${esc(t.titleAr)}</h3>
      </div>`).join('');
  }

  /* FAQ —— 后台可改问答（site.faqs.items），也可用 tax.ui.faqHomeCountAr
     控制首页显示几条。

     SEO 这块要小心：index.html 里那 6 条 <details> 是写死的，
     爬虫和 AI 引擎不执行 JS，只从 HTML 抓文字。所以那 6 条永远留着，
     后台配了数据就追加在后面（不替换），没配就完全不动 HTML。
     大哥后台删掉的题，真实用户看不到了，爬虫还能看到旧的 ——
     这个代价可以接受，总比为了 SEO 正确把内容锁死在代码里强。 */
  const faqBlk = site.faqs || {};
  set('faq-title', faqBlk.titleAr || ui.faqTitleAr || 'أسئلة يسألها العملاء');
  const faqHidden = hideIfZero('faq-sec', 'faqHomeCountAr', 3);
  if (!faqHidden) {
    const list = document.getElementById('faq-list');
    if (list) {
      /* 先摘出 HTML 里写死的那几条（种子），重置成干净状态 */
      const seeds = [...list.querySelectorAll('details.faq-item')].map(d => ({
        q: (d.querySelector('summary') || {}).textContent || '',
        a: (d.querySelector('p') || {}).textContent || '',
      })).filter(x => x.q);

      /* 后台配了 → 用后台的（后台为空数组时保留种子） */
      const mine = (faqBlk.items || [])
        .filter(x => (x.qAr || '').trim())
        .sort((a, b) => (a.sort || 99) - (b.sort || 99))
        .map(x => ({ q: x.qAr.trim(), a: (x.aAr || '').trim() }));

      const allFaq = mine.length ? mine : seeds;
      list.innerHTML = allFaq.map(f => `
        <details class="faq-item">
          <summary>${esc(f.q)}</summary>
          <p>${esc(f.a)}</p>
        </details>`).join('');

      /* 首页只显示前 N 条，其余收进 hidden（不删 —— 爬虫照样读到） */
      const keep = numUi('faqHomeCountAr', 3);
      [...list.querySelectorAll('details.faq-item')].slice(keep)
        .forEach(d => { d.hidden = true; });
    }
    const more = document.getElementById('faq-more');
    if (more) {
      more.textContent = ui.faqMoreAr || 'المزيد';
      more.href = 'faqs.html';
    }
  }

  /* banner 轮播（后台可传多张，没传图就退回装饰圆） */
  renderBanners();

  /* 分类横向滑动条 */
  const all = await getProducts();
  const cats = (tax.categories || []).slice().sort((a, b) => (a.sort || 99) - (b.sort || 99));
  /* r26：HOME_ENTRIES.cats 关掉时也要藏 —— 直接短路 hideIfZero 它就不执行了，
     元素会停在 HTML 写的初值上，以后改初值容易漏。 */
  const catsHidden = !HOME_ENTRIES.cats
                     || hideIfZero('cats-sec', 'homeCatsCountAr', 99);
  if (!HOME_ENTRIES.cats) {
    const _cats = document.getElementById('cats-sec');
    if (_cats) _cats.hidden = true;
  }
  const rail = document.getElementById('cat-rail');
  if (rail && !catsHidden) {
    /* 圆形图 + 文字在图下面。文字不再塞在图里，短名字也不会把卡片撑宽。
       原来下面还有一行「2 منتج」，大哥说不好看，去掉了 ——
       分类条上点进去就知道有几个产品，这行只是占高度、把条撑得松垮。
       产品总数在首屏那三个数字里已经有了。 */
    rail.innerHTML = cats.slice(0, numUi('homeCatsCountAr', 99)).map(c => `
      <a class="catcard" href="products.html?cat=${encodeURIComponent(c.id)}">
        <span class="cc-img">
          ${c.image || c.imageAr
            ? imgTag(c.image || c.imageAr, c.nameAr, { set: c.imageSet, sizes: '112px' })
            : `<span class="is-emoji">${esc(c.emoji)}</span>`}
        </span>
        <span class="cc-bd">
          <b>${esc(c.nameAr)}</b>
        </span>
      </a>`).join('');
    setTimeout(() => railEdges(rail), 60);
  }
  if (!catsHidden) {
    set('cat-title', ui.catsTitleAr);
  }

  /* 推荐产品 */
  const featHidden = hideIfZero('featured-sec', 'homeFeaturedCountAr', 8);
  if (!featHidden) {
    const featured = (await getProducts({ featuredOnly: true }))
      .slice(0, numUi('homeFeaturedCountAr', 8));
    document.getElementById('featured-grid').innerHTML =
      featured.map(productCard).join('') ||
      emptyState(ui.emptyCategoryAr, ui.emptyCategorySubAr);
    set('featured-title', ui.featuredTitleAr);
    set('view-all', ui.viewAllAr);
  }
  paintFavs();

  /* 新上架：按上架日期倒序取最近几个。
     一个都没有（老数据没填日期）就整块藏起来，不留空标题。 */
  const newSec = document.getElementById('new-sec');
  const newHidden = hideIfZero('new-sec', 'homeNewCountAr', 4);
  const fresh = newHidden ? []
    : (await getProducts({ newOnly: true })).slice(0, numUi('homeNewCountAr', 4));
  if (newSec) {
    if (fresh.length) {
      newSec.hidden = false;
      /* slim=true：这个区的卡片只显示标题和价格。
         大哥说原来那张卡挤成一团 —— 类别、场景、起订量（还写了两次）、
         都有，扫一眼看不清是什么。详情页里这些信息都有。 */
      document.getElementById('new-grid').innerHTML = fresh.map(p => productCard(p, true, true)).join('');
      set('new-title', ui.newTitleAr);
    } else {
      newSec.hidden = true;
    }
  }

  /* 行业 */
  /* 工艺 —— 首页第一个选择入口（r26 新增）。
     数据来自后台「工艺」区（site.crafts.items）。上架几个就显示几个，
     一个都没上架就整块藏掉。卡片直接复用 .sector 的样式，
     跟下面「行业&场景」长得一样。
     行数上限由 CSS 的 #craft-grid 规则管：桌面 3 行（3 列 = 9 个）、
     手机 2 行（2 列 = 4 个）。这里只管渲染，不管裁行。 */
  const craftSec = document.getElementById('craft-sec');
  const craftGrid = document.getElementById('craft-grid');
  const craftFoot = document.getElementById('craft-foot');
  const craftAll = ((site.crafts && site.crafts.items) || [])
    .filter(c => c && c.published !== false)
    .slice().sort((a, b) => (a.sort || 99) - (b.sort || 99));
  if (craftGrid && HOME_ENTRIES.crafts && craftAll.length) {
    craftGrid.innerHTML = craftAll.slice(0, numUi('homeCraftsCountAr', 12)).map(c => `
      <a class="sector" href="craft.html?c=${encodeURIComponent(c.id)}">
        <span class="sec-img">
          ${c.image
            ? imgTag(c.image, c.nameAr, { set: c.imageSet, sizes: '(max-width:700px) 100vw, 380px' })
            : '<span class="is-emoji">\u2726</span>'}
        </span>
        <span class="sec-bd">
          <h3>${esc(c.nameAr)}</h3>
          <p>${esc(c.leadAr || '')}</p>
        </span>
      </a>`).join('');
    set('craft-title', (site.crafts && site.crafts.titleAr) || ui.craftTitleAr
        || '\u0627\u0644\u0637\u0628\u0627\u0639\u0627\u062a \u0648\u0627\u0644\u062a\u0634\u0637\u064a\u0628\u0627\u062a');
    /* 超过一屏能放下的量（桌面 3 行 = 9 个）才给「查看全部」入口 */
    if (craftFoot && craftAll.length > 9) {
      craftFoot.hidden = false;
      set('craft-all', (ui.craftsAllAr || '\u0639\u0631\u0636 \u0643\u0644 \u0627\u0644\u0637\u0628\u0627\u0639\u0627\u062a')
          + ' (' + craftAll.length + ')');
    }
  } else if (craftSec) {
    craftSec.hidden = true;
  }

  const counts = {};
  all.forEach(p => (p.sectorIds || []).forEach(s => counts[s] = (counts[s] || 0) + 1));
  const secs = (tax.sectors || []).slice().sort((a, b) => (a.sort || 99) - (b.sort || 99));
  const secHidden = hideIfZero('sector-sec', 'homeSectorsCountAr', 99);
  if (!secHidden) document.getElementById('sector-grid').innerHTML =
    secs.slice(0, numUi('homeSectorsCountAr', 99)).map(s => `
    <a class="sector" data-sec="${esc(s.id)}"
       href="products.html?sec=${encodeURIComponent(s.id)}">
      <span class="sec-img">
        ${s.image || s.imageAr
          ? imgTag(s.image || s.imageAr, s.nameAr, { set: s.imageSet, sizes: '(max-width:700px) 100vw, 380px' })
          : `<span class="is-emoji">${esc(s.emoji)}</span>`}
      </span>
      <span class="sec-bd">
        <h3>${esc(s.nameAr)}</h3>
        <p>${esc(s.descAr || '')}</p>
      </span>
    </a>`).join('');
  if (!secHidden) {
    set('sector-title', ui.sectorTitleAr);
    bindSectorProducts();
  }

  /* r28：点行业卡片 -> 就地展开这个行业的产品，不再直接跳走。
     大哥的原话：「现在点一下标签我不知道会显示什么」。
     现在点完下面立刻出产品，一眼可见；再点同一个 = 收起，换一个 = 换内容。

     卡片本身仍然是 <a href="products.html?sec=...">：
     没 JS 时照旧能点进去，爬虫也抓得到链接 —— 这里只拦下默认跳转。

     只显示两行：桌面 4 列 = 8 个、手机 2 列 = 4 个（CSS 按 nth-child 裁）。
     超出的走「更多产品」按钮去列表页看全的。 */
  function bindSectorProducts() {
    const grid = document.getElementById('sector-grid');
    const wrap = document.getElementById('sec-prod-wrap');
    const box = document.getElementById('sec-prod');
    const foot = document.getElementById('sec-prod-foot');
    const more = document.getElementById('sec-prod-more');
    const closeBtn = document.getElementById('sec-prod-close');
    if (!grid || !wrap || !box) return;

    const LIMIT = 8;          /* 桌面 4 列 × 2 行 */
    let curSec = '';

    function collapse() {
      curSec = '';
      wrap.hidden = true;
      grid.querySelectorAll('.sector').forEach(a => a.classList.remove('on'));
    }

    function open(secId) {
      const sec = secs.find(x => x.id === secId);
      if (!sec) return;
      curSec = secId;
      grid.querySelectorAll('.sector').forEach(a =>
        a.classList.toggle('on', a.dataset.sec === secId));

      const list = all.filter(p => (p.sectorIds || []).indexOf(secId) >= 0);
      wrap.hidden = false;
      set('sec-prod-title',
          (ui.secProdTitleAr || 'المنتجات') + ' — ' + sec.nameAr);
      set('sec-prod-close', ui.collapseAr || 'إغلاق');

      box.innerHTML = list.length
        ? list.slice(0, LIMIT).map(productCard).join('')
        : emptyState(ui.emptyCategoryAr, ui.emptyCategorySubAr);

      if (list.length > LIMIT) {
        foot.hidden = false;
        set('sec-prod-more',
            (ui.viewAllAr || 'شاهد الكل') + ' (' + list.length + ')');
        if (more) more.href = 'products.html?sec=' + encodeURIComponent(secId);
      } else {
        foot.hidden = true;
      }
      paintFavs();
      /* 展开的东西在行业网格下面，手机上可能在屏幕外 —— 滚过去 */
      setTimeout(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    }

    grid.addEventListener('click', e => {
      const a = e.target.closest('.sector[data-sec]');
      if (!a) return;
      e.preventDefault();
      const id = a.dataset.sec;
      if (id === curSec) collapse(); else open(id);
    });
    if (closeBtn) closeBtn.addEventListener('click', collapse);
  }

  /* 原材料 —— 第三个筛选维度，改成横向滑动条（.rail）只占一行高度，
     以后材料加到几十种也不会把首页撑长。
     点进去带 mat=<id>，跟产品类型（cat=）、行业（sec=）同一套逻辑。
     没有产品的材料不显示：点了进去是空页面，不如不摆出来。 */
  const mcounts = {};
  all.forEach(p => (p.materialIds || []).forEach(m => mcounts[m] = (mcounts[m] || 0) + 1));
  const mats = (tax.materials || []).slice().sort((a, b) => (a.sort || 99) - (b.sort || 99));
  const matHidden = !HOME_ENTRIES.mats
                    || hideIfZero('mat-sec', 'homeMatsCountAr', 99);
  const matSec = document.getElementById('mat-sec');
  if (!HOME_ENTRIES.mats && matSec) matSec.hidden = true;
  const matGrid = document.getElementById('mat-grid');
  if (matGrid && !matHidden) {
    const shown = mats.filter(m => mcounts[m.id]).slice(0, numUi('homeMatsCountAr', 99));
    if (shown.length) {
      if (matSec) matSec.hidden = false;
      matGrid.innerHTML = shown.map(m => `
        <a class="sector matcard" href="products.html?mat=${encodeURIComponent(m.id)}">
          <span class="sec-img">
            ${m.image || m.imageAr
              ? imgTag(m.image || m.imageAr, m.nameAr, { set: m.imageSet, sizes: '(max-width:700px) 60vw, 300px' })
              : `<span class="is-emoji">${esc(m.emoji || '\u{1F9FB}')}</span>`}
          </span>
          <span class="sec-bd">
            <h3>${esc(m.nameAr)}</h3>
            <p>${esc(m.descAr || '')}</p>
          </span>
        </a>`).join('');
      set('mat-title', ui.matTitleAr);
      /* 「查看全部材料」按钮上的数量要跟实际显示的一致 */
      set('mat-all', (ui.matsAllAr || 'عرض كل الخامات').replace(/\\((\\d+)\\)/, '(' + mats.length + ')'));
      setTimeout(() => railEdges(matGrid), 60);
    } else {
      if (matSec) matSec.hidden = true;
    }
  }

  /* 优势 —— 手机端 4 小格一行，点格子弹层看解释（data-desc 给 popup.js 用）。
     电脑端保持原来的 2 列带说明文字，弹层只在窄屏生效。 */
  const featGrid = document.getElementById('feat-grid');
  if (featGrid) {
    featGrid.innerHTML = (tax.features || []).map(f => `
    <div class="feat" tabindex="0" data-title="${esc(f.titleAr)}" data-desc="${esc(f.descAr || '')}">
      <span class="n">${esc(f.no)}</span>
      <h3>${esc(f.titleAr)}</h3>
      <p>${esc(f.descAr)}</p>
    </div>`).join('');
  }
  set('feat-more', ui.featuresMoreAr || 'المزيد');
  /* 「我们是谁」+ 优势合并成一个板块（r19）：
     左边一段引言，右边还是原来那四条优势。
     优势条目本身还是后台 categories.json 的 features，随时能改能增删。 */
  set('feat-kicker', ui.aboutKickerAr || ui.featuresKickerAr);
  set('feat-title', ui.aboutTitleAr || ui.featuresTitleAr);
  set('feat-lead', ui.aboutLeadAr || '');

  /* 场景（取第一个行业）。
     默认关闭 —— 这个区块讲的是「某个行业场景下整套包装怎么配」，
     跟上面的行业板块内容重叠，用户反馈不知道是干什么的。
     想开的话把后台 homeSceneEnabledAr 改成 1。 */
  const sceneWrap = document.getElementById('scene-sec');
  const sceneOn = String(ui.homeSceneEnabledAr || '0') === '1';
  if (sceneWrap) sceneWrap.hidden = !sceneOn;
  const scene = sceneOn ? (site.scenes || [])[0] : null;
  if (scene) {
    const s = sectorOf(scene.sectorId);
    const items = all.filter(p => (p.sectorIds || []).includes(scene.sectorId)).slice(0, 4);
    const grouped = {};
    items.forEach(p => { grouped[p.categoryId] = (grouped[p.categoryId] || 0) + 1; });
    const simg = document.getElementById('scene-img');
    if (simg) {
      const src = s && (s.image || s.imageAr);
      simg.innerHTML =
        (src ? imgTag(src, '', { set: s && s.imageSet, sizes: '(max-width:900px) 100vw, 460px' }) : '') +
        `<span class="cap">${esc(s?.nameAr || '')}</span>`;
    }
    set('scene-kicker', scene.kickerAr);
    set('scene-title', scene.titleAr);
    set('scene-body', scene.bodyAr);
    document.getElementById('scene-list').innerHTML = items.map(p => `
      <a href="products.html?cat=${encodeURIComponent(p.categoryId)}">
        ${esc(catOf(p.categoryId)?.nameAr || '')}
        <span class="cnt">${grouped[p.categoryId]} ${esc(ui.resultsAr)}</span>
      </a>`).join('');
    const sb = document.getElementById('scene-btn');
    sb.textContent = `${ui.browseSectorAr} ${s?.nameAr || ''}`;
    sb.href = `products.html?sec=${encodeURIComponent(scene.sectorId)}`;
  }
  /* ---------- 三个新板块的首页入口 ----------
     认证资质：一条 banner，点进去 certifications.html
     定制流程：横向滑动条，点进去 process.html
     客户案例：只显示 3 个 + 「المزيد」，点进去 clients.html
     渲染函数都在 blocks.js 里，详情页用的是同一套逻辑。
     kicker 和 lead 都已从 HTML 删除，这里只填主标题。 */
  const procHidden = hideIfZero('proc-sec', 'homeProcessCountAr', 99);
  if (!procHidden) {
    const pb = blockData('process');
    set('proc-title', pb.titleAr);
    const ps = document.getElementById('proc-slot');
    if (ps) ps.innerHTML = processStrip();
  }

  const cliHidden = hideIfZero('cli-sec', 'homeClientsCountAr', 3);
  if (!cliHidden) {
    const cb = blockData('clients');
    set('cli-title', cb.titleAr);
    const cs = document.getElementById('cli-slot');
    if (cs) cs.innerHTML = clientWall(numUi('homeClientsCountAr', 3));
  }

  /* 认证资质这块是个 div 不是 section，hideIfZero 传它自己的 id */
  const certHidden = hideIfZero('cert-slot', 'homeCertsCountAr', 99);
  const cs2 = document.getElementById('cert-slot');
  if (cs2 && !certHidden) cs2.innerHTML = certBanner();

  /* ---------- 末行孤儿卡收尾（r24） ----------
     必须等图片加载完再算：grid 的行高是内容撑的，
     图片没加载完时卡片高度只有文字那点，量出来的行数不准。
     300ms 是给懒加载图片留的余量，window load 之后再补一次。 */
  fillAll();
  setTimeout(fillAll, 300);
  if (document.readyState === 'complete') {
    setTimeout(fillAll, 900);
  } else {
    window.addEventListener('load', () => setTimeout(fillAll, 300));
  }
}

initHome().catch(e => console.error('[home]', e));
