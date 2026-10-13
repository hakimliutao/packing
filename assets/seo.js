/* ==========================================================================
   seo.js — SEO / GEO
   --------------------------------------------------------------------------
   为什么这个文件单独存在：

   1. SEO —— 现在 4 个页面的 title 是光杆词（「الرئيسية」「المنتجات」），
      没有 description、没有 og、没有结构化数据。这套东西搜索引擎基本读不到。

   2. GEO（Generative Engine Optimization）—— 跟 SEO 不是一回事。
      GEO 面向的是 AI 引擎（ChatGPT / Perplexity / Gemini / Claude）：
      它们不会执行 JS，只从 HTML 里抓文字，然后挑「能直接回答问题的段落」引用。
      所以关键不是堆关键词，而是把答案用文字直接写在 HTML 里 ——
      这就是每页那段 heroAnswer 和首页 FAQ 的用途。

   设计原则：内容用 JS 渲染出来没问题（用户看得到就行），
   但**结构化数据用 JS 注入会被 Google 当作不可信**，所以 JSON-LD
   走服务端注入更稳 —— 这份数据是静态的，直接写在 HTML 里最可靠。
   本文件只负责 meta 和那些必须动态的部分（og:url、canonical）。 */

const SITE_URL = 'https://packingcoffee.netlify.app';
const BRAND_AR = 'موسى للتغليف';   /* 占位，brand.nameAr 才是准的 */

window.SEO = { SITE_URL };

/* ---------- 每个页面的基础信息 ---------- */
const PAGES = {
  home: {
    title: 'تغليف مخصص للمقاهي والمطاعم في الخليج | أكواب وأكياس وعلب بشعارك',
    desc: 'شركة تغليف عربية تقدم أكواباً وأكياساً وعلباً ورقية ومبلاستيكية مخصصة بالكامل بشعارك. اطلب عرض سعر خلال ساعات — نرد على واتساب.',
    kw: 'تغليف مخصص, أكواب ورقية, أكواب قهوة, أكياس ورقية, علب طعام, تغليف المطاعم, طباعة شعار, دبي, أبوظبي, جدة, الكويت',
  },
  products: {
    title: 'كتالوج التغليف المخصص — كل المنتجات والأسعار | موسى للتغليف',
    desc: 'تصفح كل منتجات التغليف المخصص: أكواب، أكياس، علب، ملصقات، مناديل، وأدوات مائدة. أسعار متدرجة واضحة، والتخصيص بالكامل بشعارك.',
    kw: 'كتالوج تغليف, أسعار تغليف, أكواب مخصصة, أكياس قهوة, علب طعام',
  },
  product: {
    title: 'تفاصيل المنتج والتسعير | موسى للتغليف',
    desc: 'مواصفات المنتج كاملة، الخامات والمقاسات المتاحة، وخيارات التخصيص وأسعارها المتدرجة.',
    kw: 'تفاصيل منتج, سعر, مواصفات, تخصيص',
  },
  about: {
    title: 'من نحن — شركة تغليف عربية متخصصة | موسى للتغليف',
    desc: 'من نحن، خبرتنا في التغليف المخصص، جودة موادنا، والتزامنا بمواعيد التسليم.',
    kw: 'من نحن, شركة تغليف, خامة, جودة',
  },
  contact: {
    title: 'تواصل معنا واطلب عرض سعر | موسى للتغليف',
    desc: 'راسلنا على واتساب أو عبر النموذج. أرسل نوع المنتج والمقاس والكمية والشعار، ونرد خلال ساعات بعرض سعر.',
    kw: 'تواصل, طلب عرض سعر, واتساب, استفسار',
  },
  favorites: {
    title: 'منتجاتي المفضلة | موسى للتغليف',
    desc: 'قائمة المنتجات التي حفظتها، وقارن الأسعار والمقاسات قبل طلب عرض السعر.',
    kw: 'مفضلة, محفوظات',
  },
  sectors: {
    title: 'التغليف حسب القطاع — مقاهي، مطاعم، حلويات، بقالات | موسى للتغليف',
    desc: 'حلول تغليف مخصصة لكل قطاع: المقاهي، المطاعم، محلات الحلويات، البقالات، ومعارض الأزياء. اختر قطاعك وشاهد المنتجات المناسبة.',
    kw: 'تغليف مقاهي, تغليف مطاعم, تغليف حلويات, تغليف بقالات, قطاعات',
  },
};

/* 当前页是哪一页：从文件名认。 */
function currentKey() {
  const f = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
  if (f === 'index' || f === '') return 'home';
  return Object.keys(PAGES).includes(f) ? f : 'home';
}

/* ---------- meta 注入 ---------- */

function setMeta(name, content, attr) {
  const a = attr || 'name';
  let el = document.head.querySelector('meta[' + a + '="' + name + '"]');
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(a, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content || '');
  return el;
}

function setLink(rel, href) {
  let el = document.head.querySelector('link[rel="' + rel + '"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function applySeo(overrides) {
  const o = overrides || {};
  const key = o.key || currentKey();
  const p = PAGES[key] || PAGES.home;
  const brand = (window.CTX && window.CTX.site && window.CTX.site.brand && window.CTX.site.brand.nameAr) || BRAND_AR;

  /* title：品牌名放后面。买家搜的是「تغليف مخصص」不是品牌名，
     品牌名塞前面会挤掉关键词 */
  const title = o.title || p.title + ' | ' + brand;
  const desc = o.desc || p.desc;
  const url = SITE_URL + (location.pathname || '/').replace(/index\.html$/, '');

  document.title = title;
  setMeta('description', desc);
  setMeta('keywords', p.kw);
  setMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1');
  /* 阿拉伯语页面标成阿拉伯语地区，告诉 Google 该给谁看 */
  setMeta('content-language', 'ar');
  setMeta('audience', 'ae, sa, kw, bh, om, qa');
  setMeta('geo.region', 'AE');
  setMeta('geo.placename', 'Dubai');

  /* canonical：告诉搜索引擎哪个地址是正版，防重复内容 */
  setLink('canonical', url);

  /* og：分享到 WhatsApp / Facebook / X 时的卡片。
     中东客户主要在 WhatsApp 上转发，og:image 直接决定长什么样。 */
  setMeta('og:type', o.ogType || 'website', 'property');
  setMeta('og:site_name', brand, 'property');
  setMeta('og:title', title, 'property');
  setMeta('og:description', desc, 'property');
  setMeta('og:url', url, 'property');
  setMeta('og:locale', 'ar_AE', 'property');
  const ogImg = o.image || ((window.CTX && window.CTX.site && window.CTX.site.hero && window.CTX.site.hero.banners && window.CTX.site.hero.banners[0] && window.CTX.site.hero.banners[0].image) || '');
  if (ogImg) {
    const abs = ogImg.startsWith('http') ? ogImg : (SITE_URL + ogImg);
    setMeta('og:image', abs, 'property');
    setMeta('twitter:image', abs, 'name');
  }
  /* 有大图就大卡片，没图就小卡片 —— 不写这条，X/WhatsApp 会自己瞎猜 */
  setMeta('twitter:card', ogImg ? 'summary_large_image' : 'summary');
  setMeta('twitter:title', title);
  setMeta('twitter:description', desc);
}

/* ---------- JSON-LD ----------
   这块必须写在 HTML 里（静态），JS 动态注入 Google 有时不认。
   本文件只提供一个「生成 Product 结构化数据」的函数，
   给 product 页和列表页在渲染卡片后调用 —— 但 home 页的是静态写死的。

   为什么重要：B2B 买家越来越多用 AI 找供应商。
   结构化数据让 AI 能准确读出「你们卖什么、多少钱、怎么定制」。 */

function jsonLd(obj) {
  /* </script> 写在字符串里会提前闭合脚本标签 —— 把 < 转成 \u003c。
     注意只能转义一次：先 stringify 出真 JSON，再替换 <，
     千万别再套一层 stringify（那会把整段变成一个带引号的字符串）。 */
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

/* Organization —— 说清公司是谁、卖什么、在哪。放全站 */
function orgLd(site) {
  const s = site || {};
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: (s.brand && s.brand.nameAr) || BRAND_AR,
    alternateName: (s.brand && s.brand.nameZh) || undefined,
    url: SITE_URL,
    logo: SITE_URL + '/assets/vendor/logo.svg',
    description: 'شركة تغليف عربية تقدم أكواباً وأكياساً وعلباً ورقية ومبلاستيكية مخصصة بالكامل بشعارك، تخدم المقاهي والمطاعم في دول الخليج.',
    areaServed: [
      { '@type': 'Country', name: 'الإمارات العربية المتحدة' },
      { '@type': 'Country', name: 'المملكة العربية السعودية' },
      { '@type': 'Country', name: 'الكويت' },
      { '@type': 'Country', name: 'البحرين' },
      { '@type': 'Country', name: 'سلطنة عُمان' },
      { '@type': 'Country', name: 'قطر' },
    ],
    knowsLanguage: ['ar', 'en', 'zh'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      availableLanguage: ['ar', 'en'],
      /* schema.org 的 telephone 要 E.164 格式，也就是 +国家码+号码（+966500000000），
         跟 wa.me 链接那套「纯数字无加号」不一样，这里得自己补 +。
         号码本身先洗干净（只留数字、剥掉开头的 00），免得大哥在后台
         写成 0086... 的时候结构化数据也跟着变脏，搜索引擎那边不合规。 */
      telephone: (() => {
        const raw = s.whatsapp && s.whatsapp.number;
        const clean = window.waClean ? window.waClean(raw)
                                     : String(raw == null ? '' : raw).replace(/\D/g, '').replace(/^0+/, '');
        return clean ? '+' + clean : undefined;
      })(),
    },
  };
}

/* WebSite —— 带 SearchAction，方便搜索引擎理解站内搜索 */
function webSiteLd(site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: (site && site.brand && site.brand.nameAr) || BRAND_AR,
    url: SITE_URL,
    inLanguage: 'ar',
    potentialAction: {
      '@type': 'SearchAction',
      target: SITE_URL + '/products.html?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };
}

/* FAQPage —— 首页那6 个问答。
   这是 GEO 里最容易被 AI 引用的结构：AI 搜「كم الحد الأدنى للطلب
   في دبي”就可能直接答出 FAQPage 里的原文。 */
function faqLd() {
  const items = [...document.querySelectorAll('#faq-list .faq-item')].map(d => {
    const q = d.querySelector('summary');
    const a = d.querySelector('p');
    if (!q || !a) return null;
    return {
      '@type': 'Question',
      name: (q.textContent || '').trim(),
      acceptedAnswer: { '@type': 'Answer', text: (a.textContent || '').trim() },
    };
  }).filter(Boolean);
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items };
}

/* Product —— 详情页用。
   把阶梯价格标成 offers.priceSpecification，AI 能直接读出「100 个多少钱」。 */
function productLd(p, site) {
  if (!p) return null;
  const tiers = p.priceTiers || [];
  const cur = (window.Currency && typeof Currency.current === 'function')
    ? Currency.current() : 'AED';
  const rate = (window.Currency && window.Currency.rates && window.Currency.rates[cur]) || 1;

  const offer = tiers.length
    ? {
        '@type': 'AggregateOffer',
        priceCurrency: cur,
        lowPrice: (Math.min(...tiers.map(t => t.price)) * rate).toFixed(3),
        highPrice: (Math.max(...tiers.map(t => t.price)) * rate).toFixed(3),
        offerCount: tiers.length,
        priceSpecification: tiers.map(t => ({
          '@type': 'UnitPriceSpecification',
          price: (t.price * rate).toFixed(3),
          priceCurrency: cur,
          eligibleQuantity: {
            '@type': 'QuantitativeValue',
            minValue: t.from,
            maxValue: t.to == null ? undefined : t.to,
            unitCode: 'C62',
          },
        })),
      }
    : {
        /* 没有公开单价的产品（按尺寸谈的）走询盘，
           用 priceSpecification 的最低价 = 0 会误导 SEO，直接不写价格 */
        '@type': 'Offer',
        availability: 'https://schema.org/InStock',
        url: SITE_URL + '/product.html?id=' + encodeURIComponent(p.id),
        priceSpecification: undefined,
      };

  const imgs = (p.images || []).filter(Boolean);
  const cu = CTX && CTX.tax && CTX.tax.categories &&
             CTX.tax.categories.find(c => c.id === p.categoryId);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.nameAr,
    alternateName: p.nameZh || undefined,
    description: p.shortAr || p.descAr || '',
    sku: p.id,
    category: (cu && cu.nameAr) || undefined,
    image: imgs.map(x => (x.startsWith('http') ? x : SITE_URL + x)),
    material: (p.specs && p.specs.materialAr) || (p.custom && (p.custom.materialsAr || [])[0]) || undefined,
    offers: offer,
    /* 「可定制」这件事写进 businessFeature ——
       定制是主打卖点，AI 搜索「custom packaging dubai」时靠这条匹配 */
    businessFeature: p.custom
      ? ['Custom logo printing', 'Custom size', 'Custom material',
         ...(p.custom.printAr || []), ...(p.custom.extrasAr || [])]
      : ['Custom logo printing'],
    areaServed: 'Gulf Cooperation Council',
  };
}

function injectLd(obj) {
  if (!obj) return;
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.textContent = jsonLd(obj);
  document.head.appendChild(el);
}

window.SEO.apply = applySeo;
window.SEO.orgLd = orgLd;
window.SEO.webSiteLd = webSiteLd;
window.SEO.faqLd = faqLd;
window.SEO.productLd = productLd;
window.SEO.injectLd = injectLd;
window.SEO.jsonLd = jsonLd;