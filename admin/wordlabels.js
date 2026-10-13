/* ui 字段的中文标签。后台文案编辑页靠它把 allAr / catsKickerAr 这类
   内部字段名翻译成大哥看得懂的话。改文案分组在 tools/生成文案标签.cjs 里调。
   由那个脚本校验过：ui 里每条都有对应标签，一条不漏。 */
const WORD_GROUPS = [
  {
    "name": "home",
    "items": [
      {
        "key": "matKickerAr",
        "label": "首页材料板块·小标题",
        "value": "حسب الخامة"
      },
      {
        "key": "matTitleAr",
        "label": "首页材料板块·标题",
        "value": "نصنع التغليف من كل الخامات"
      },
      {
        "key": "matSubAr",
        "label": "首页材料板块·说明",
        "value": "ورق، بلاستيك، ألياف، أو ألمنيوم. اختر الخامة وتعرّف على المنتجات اللي منها."
      },
      {
        "key": "homeCatsCountAr",
        "label": "首页产品类型·显示几条",
        "value": "8"
      },
      {
        "key": "homeSectorsCountAr",
        "label": "首页行业板块·显示几条",
        "value": "6"
      },
      {
        "key": "homeMatsCountAr",
        "label": "首页材料板块·显示几条",
        "value": "8"
      },
      {
        "key": "homeFeaturedCountAr",
        "label": "首页热门产品·显示几条",
        "value": "8"
      },
      {
        "key": "homeNewCountAr",
        "label": "首页最新产品·显示几条",
        "value": "4"
      },
      {
        "key": "homeSceneEnabledAr",
        "label": "首页场景区块·开关(1开/0关)",
        "value": "0"
      },
      {
        "key": "faqTitleAr",
        "label": "常见疑问·标题",
        "value": "أسئلة يسألها العملاء"
      },
      {
        "key": "faqLeadAr",
        "label": "更多问题页·说明",
        "value": "جمعنا هنا أكثر ما يسأل عنه العملاء قبل ما يبدأون طلبهم. لو ما لقيت جوابك، راسلنا على واتساب ونرد مباشرة."
      },
      {
        "key": "faqMoreAr",
        "label": "首页FAQ按钮文字",
        "value": "المزيد"
      },
      {
        "key": "faqKickerAr",
        "label": "FAQ·小标题",
        "value": "أسئلة شائعة"
      },
      {
        "key": "faqHomeCountAr",
        "label": "首页FAQ·显示几条",
        "value": "3"
      },
      {
        "key": "faqsCntAr",
        "label": "FAQ计数后缀",
        "value": "سؤال"
      },
      {
        "key": "aboutKickerAr",
        "label": "我们是谁·小标题",
        "value": "من نحن"
      },
      {
        "key": "aboutTitleAr",
        "label": "我们是谁·标题",
        "value": "شركة تغليف عربية متخصصة"
      },
      {
        "key": "aboutLeadAr",
        "label": "我们是谁·介绍文字",
        "value": "نعمل منذ سنوات على التغليف المخصص للمحلات والمقاهي والمطاعم في الخليج. نبدأ من فهم استخدامك للمنتج، نرشّح لك المقاس والخامة، ونطبع شعارك — كله في طلب واحد."
      },
      {
        "key": "heroAnswerAr",
        "label": "首屏·一段介绍（显示在大标题下面）",
        "value": "شركة تغليف عربية تقدّم أكواباً وأكياساً وعلباً ورقية ومبلاستيكية تُطبَّع بشعارك. نخدم المقاهي والمطاعم في دول الخليج. اطلب عرض سعر على واتساب ونرد خلال ساعات."
      },
      {
        "key": "homeStatsCountAr",
        "label": "首屏·三个数字显示几个",
        "value": "3"
      },
      {
        "key": "homeTrustCountAr",
        "label": "首页信任板块·显示几条",
        "value": "4"
      },
      {
        "key": "homeProcessCountAr",
        "label": "首页定制流程·显示几步",
        "value": "6"
      },
      {
        "key": "homeClientsCountAr",
        "label": "首页客户案例·显示几个",
        "value": "3"
      },
      {
        "key": "homeCertsCountAr",
        "label": "首页认证横幅·显示几条",
        "value": "1"
      }
    ]
  },
  {
    "name": "clients",
    "items": [
      {
        "key": "clientsCntAr",
        "label": "案例计数后缀",
        "value": "عميل"
      }
    ]
  },
  {
    "name": "process",
    "items": [
      {
        "key": "procCtaTitleAr",
        "label": "流程页底部 CTA 标题",
        "value": "جاهز تبدأ طلبك؟"
      },
      {
        "key": "procCtaBodyAr",
        "label": "流程页底部 CTA 说明",
        "value": "أرسل لنا مواصفات المنتج والكمية، ونرد عليك بعرض سعر مفصل خلال ساعات."
      },
      {
        "key": "procCtaBtnAr",
        "label": "流程页底部 CTA 按钮",
        "value": "اطلب عرض سعر"
      }
    ]
  },
  {
    "name": "certifications",
    "items": [
      {
        "key": "certCountAr",
        "label": "认证 banner 里的单位词",
        "value": "شهادة"
      },
      {
        "key": "certNoAr",
        "label": "证书卡：编号标签",
        "value": "رقم الشهادة"
      },
      {
        "key": "certDateAr",
        "label": "证书卡：日期标签",
        "value": "تاريخ الإصدار"
      },
      {
        "key": "certFileAr",
        "label": "证书卡：下载文件链接",
        "value": "تحميل الشهادة"
      },
      {
        "key": "certCrumbAr",
        "label": "面包屑上的「证书」",
        "value": "الشهادات"
      },
      {
        "key": "certFaqKickerAr",
        "label": "证书页 FAQ 小标题",
        "value": "أسئلة متكررة"
      },
      {
        "key": "certFaqTitleAr",
        "label": "证书页 FAQ 标题",
        "value": "أسئلة يطرحها العملاء عن الشهادات"
      },
      {
        "key": "certFaq1Q",
        "label": "FAQ1 问题",
        "value": "هل يمكنني الحصول على ملفات الشهادات؟"
      },
      {
        "key": "certFaq1A",
        "label": "FAQ1 答案",
        "value": "نعم، نرفق نسخ الشهادات مع العرض السعر، أو نرسلها لك قبل تأكيد الطلب. إذا كانت الجهات التنظيمية لديك تطلب نسخة محددة، أخبرنا ونجهزها."
      },
      {
        "key": "certFaq2Q",
        "label": "FAQ2 问题",
        "value": "هل الشهادات تغطي كل المنتجات؟"
      },
      {
        "key": "certFaq2A",
        "label": "FAQ2 答案",
        "value": "الشهادة تخص مادة ومنتجاً معيّناً. مثلاً شهادة المواد الغذائية تغطي الأكواب الورقية، لكنها لا تغطي الأكواب البلاستيكية. نوضح لك ذلك ذلك في عرض السعر."
      },
      {
        "key": "certFaq3Q",
        "label": "FAQ3 问题",
        "value": "هل تنتهي صلاحية الشهادات؟"
      },
      {
        "key": "certFaq3A",
        "label": "FAQ3 答案",
        "value": "نعم، أكثر الشهادات لها تاريخ انتهاء. نراجع تواريخها دورياً ونحدّثها، وفي هذه الصفحة نكتب تاريخ كل شهادة صراحة."
      },
      {
        "key": "certFaq4Q",
        "label": "FAQ4 问题",
        "value": "هل تناسب هذه الشهادات للتخليص الجماركي؟"
      },
      {
        "key": "certFaq4A",
        "label": "FAQ4 答案",
        "value": "نعم، نرفق إيكان المطابقة والشهادات المطلوبة لدول الخليج. أخبرنا إن كانت جهتك تطلب نموذجاً معيّناً وسنجهّزه."
      },
      {
        "key": "noCertAr",
        "label": "空状态：没有证书",
        "value": "لم تُضف شهادات بعد"
      },
      {
        "key": "noCertSubAr",
        "label": "空状态说明",
        "value": "أضف شهاداتك من لوحة التحكم لتظهر هنا."
      }
    ]
  },
  {
    "name": "process",
    "items": [
      {
        "key": "processMoreAr",
        "label": "流程板块「看详情」按钮",
        "value": "تفاصيل خطوات التخصيص"
      },
      {
        "key": "noProcessAr",
        "label": "空状态：没有流程步骤",
        "value": "لم تُضف خطوات بعد"
      },
      {
        "key": "noProcessSubAr",
        "label": "空状态说明",
        "value": "أضف خطوات التخصيص من لوحة التحكم لتظهر هنا."
      },
      {
        "key": "procTitleShortAr",
        "label": "首页流程板块·标题（短的那句）",
        "value": "من الطلب إلى التسليم"
      }
    ]
  },
  {
    "name": "clients",
    "items": [
      {
        "key": "clientMoreAr",
        "label": "案例卡「读详情」",
        "value": "اقرأ التفاصيل"
      },
      {
        "key": "noClientsAr",
        "label": "空状态：没有案例",
        "value": "لم تُضف عملاء بعد"
      },
      {
        "key": "noClientsSubAr",
        "label": "空状态说明",
        "value": "أضف عملائك وصور التعاون من لوحة التحكم لتظهر هنا."
      },
      {
        "key": "clientsMoreAr",
        "label": "首页客户板块·更多按钮文字",
        "value": "كل العملاء"
      }
    ]
  },
  {
    "name": "الفلترة（三维筛选）",
    "items": [
      {
        "key": "byProductAr",
        "label": "筛选组标题：按产品",
        "value": "حسب المنتج"
      },
      {
        "key": "bySceneAr",
        "label": "筛选组标题：按使用场景",
        "value": "حسب الاستخدام"
      },
      {
        "key": "byMaterialAr",
        "label": "筛选组标题：按材料",
        "value": "حسب الخامة"
      },
      {
        "key": "clearAllAr",
        "label": "筛选面板底部「清除全部」",
        "value": "مسح الكل"
      },
      {
        "key": "removeAr",
        "label": "筛选组右上角「移除该条件」",
        "value": "إزالة"
      }
    ]
  },
  {
    "name": "顶栏",
    "items": [
      {
        "key": "allAr",
        "label": "全部（顶栏菜单）",
        "value": "الكل"
      },
      {
        "key": "menuAr",
        "label": "“菜单”按钮",
        "value": "القائمة"
      },
      {
        "key": "myFavAr",
        "label": "“我的收藏”",
        "value": "منتجاتي المفضلة"
      },
      {
        "key": "myFavShortAr",
        "label": "顶栏收藏按钮的短文字",
        "value": "المفضلة"
      },
      {
        "key": "myFavSubAr",
        "label": "收藏页副标题",
        "value": "المنتجات اللي ضغطت عليها القلب — محفوظة في هذا المتصفح فقط، ما تحتاج حساب."
      },
      {
        "key": "quickOrderAr",
        "label": "顶栏询价按钮",
        "value": "اطلب عرض سعر"
      },
      {
        "key": "searchAr",
        "label": "搜索",
        "value": "بحث"
      },
      {
        "key": "searchBtnAr",
        "label": "搜索按钮",
        "value": "بحث"
      },
      {
        "key": "searchPlaceholderAr",
        "label": "搜索框提示语",
        "value": "ابحث عن كوب، كيس، علبة…"
      }
    ]
  },
  {
    "name": "通用",
    "items": [
      {
        "key": "addFavAr",
        "label": "“加入收藏”按钮",
        "value": "أضف للمفضلة"
      },
      {
        "key": "allProductsAr",
        "label": "所有产品（页面标题）",
        "value": "جميع المنتجات"
      },
      {
        "key": "browseAllAr",
        "label": "“浏览全部”",
        "value": "تصفح كل المنتجات"
      },
      {
        "key": "clearFavAr",
        "label": "“清空收藏”按钮",
        "value": "مسح المفضلة"
      },
      {
        "key": "emptyIconAr",
        "label": "空状态图标",
        "value": "📦"
      },
      {
        "key": "fabWaAr",
        "label": "右下角悬浮按钮",
        "value": "تواصل واتساب"
      },
      {
        "key": "resultsAr",
        "label": "“N 个结果”里的“N 个”",
        "value": "منتج"
      },
      {
        "key": "viewAllAr",
        "label": "“查看全部”按钮",
        "value": "عرض جميع المنتجات"
      },
      {
        "key": "whatsappAr",
        "label": "“WhatsApp”按钮",
        "value": "واتساب"
      }
    ]
  },
  {
    "name": "分类",
    "items": [
      {
        "key": "catsKickerAr",
        "label": "分类区小标题",
        "value": "تصفّح حسب النوع"
      },
      {
        "key": "catsSubAr",
        "label": "分类区说明",
        "value": "اضغط على القسم لتظهر لك كل منتجاته."
      },
      {
        "key": "catsTitleAr",
        "label": "分类区大标题",
        "value": "أي نوع تغليف تطلب؟"
      }
    ]
  },
  {
    "name": "推荐",
    "items": [
      {
        "key": "featuredAr",
        "label": "产品卡上的“精选”角标",
        "value": "مميز"
      },
      {
        "key": "featuredKickerAr",
        "label": "推荐区小标题",
        "value": "الأكثر طلباً"
      },
      {
        "key": "featuredSubAr",
        "label": "推荐区说明",
        "value": "اختيارات عملائنا الأكثر طلباً، جاهزة للطباعة والتخصيص بعلامتك التجارية."
      },
      {
        "key": "featuredTitleAr",
        "label": "推荐区大标题",
        "value": "منتجاتنا المميزة"
      }
    ]
  },
  {
    "name": "新品",
    "items": [
      {
        "key": "newBadgeAr",
        "label": "新品卡上的“新品”角标",
        "value": "جديد"
      },
      {
        "key": "newKickerAr",
        "label": "新品区小标题",
        "value": "وصل حديثاً"
      },
      {
        "key": "newSubAr",
        "label": "新品区说明",
        "value": "منتجات أضفناها مؤخراً، ابدأ من هنا."
      },
      {
        "key": "newTitleAr",
        "label": "新品区大标题",
        "value": "أحدث المنتجات"
      }
    ]
  },
  {
    "name": "行业",
    "items": [
      {
        "key": "browseSectorAr",
        "label": "“查看该行业”",
        "value": "تصفّح القطاع"
      },
      {
        "key": "sectorKickerAr",
        "label": "行业区小标题",
        "value": "حسب القطاع"
      },
      {
        "key": "sectorSubAr",
        "label": "行业区说明",
        "value": "اختر قطاعك ونعرض لك كل ما يناسبه من منتجات، جاهزة للطباعة بشعارك."
      },
      {
        "key": "sectorTitleAr",
        "label": "行业区大标题",
        "value": "حلول لمختلف القطاعات"
      }
    ]
  },
  {
    "name": "材料",
    "items": [
      {
        "key": "matsAllAr",
        "label": "首页材料板块·查看全部按钮文字",
        "value": "عرض كل الخامات"
      },
      {
        "key": "browseMatAr",
        "label": "材料卡片·进入按钮文字",
        "value": "تصفح الخامة"
      },
      {
        "key": "noMatsSubAr",
        "label": "材料板块·一条材料都没有时的提示",
        "value": "لم تُضف خامات بعد — أضفها من لوحة التحكم لتظهر هنا."
      }
    ]
  },
  {
    "name": "优势",
    "items": [
      {
        "key": "featuresKickerAr",
        "label": "优势区小标题",
        "value": "لماذا نحن"
      },
      {
        "key": "featuresTitleAr",
        "label": "优势区大标题",
        "value": "لماذا يختارنا عملاؤنا"
      },
      {
        "key": "featuresLeadAr",
        "label": "优势详情页·顶部引言",
        "value": "أسباب تجعلنا شريكك المناسب: جودة نتحقق منها، تصاميم تناسب مناسبتك، وحلول نطبعها على مقاسك وخامتك."
      },
      {
        "key": "featuresMoreAr",
        "label": "首页优势板块·更多按钮文字",
        "value": "لماذا تختارنا"
      }
    ]
  },
  {
    "name": "价格",
    "items": [
      {
        "key": "fromAr",
        "label": "「起」字（起订量）",
        "value": "ابتداءً من"
      },
      {
        "key": "fromAr2",
        "label": "总价前面的「从」字",
        "value": "من"
      },
      {
        "key": "negotiableAr",
        "label": "总价算不出时显示的「按量报价」",
        "value": "حسب الكمية"
      },
      {
        "key": "pcsAr",
        "label": "「件」",
        "value": "قطعة"
      },
      {
        "key": "perPieceAr",
        "label": "「每件」",
        "value": "للقطعة"
      },
      {
        "key": "plusAr",
        "label": "数量后的加号（1000+）",
        "value": "+"
      },
      {
        "key": "priceNoteAr",
        "label": "价格表下方的说明",
        "value": "الأسعار تقديرية وتختلف حسب المقاس والخامة وكمية الطباعة. للتسعير النهائي تواصل معنا."
      },
      {
        "key": "priceTitleAr",
        "label": "价格表标题",
        "value": "الأسعار التقديرية"
      },
      {
        "key": "qtyAr",
        "label": "价格表「数量」列表头",
        "value": "الكمية"
      },
      {
        "key": "totalAr",
        "label": "价格表「总价」列表头",
        "value": "الإجمالي"
      },
      {
        "key": "unitPriceAr",
        "label": "价格表「单价」列表头",
        "value": "سعر القطعة"
      }
    ]
  },
  {
    "name": "定制",
    "items": [
      {
        "key": "customLeadAr",
        "label": "可定制项里的「交期」标签",
        "value": "مدة التسليم"
      },
      {
        "key": "customTitleAr",
        "label": "「可定制什么」区块标题",
        "value": "شنو نقدر نعدّل"
      }
    ]
  },
  {
    "name": "报价",
    "items": [
      {
        "key": "quoteBtnAr",
        "label": "详情页「要报价」按钮",
        "value": "اطلب عرض سعر"
      },
      {
        "key": "quoteHintAr",
        "label": "报价按钮下面的提示",
        "value": "أرسل لنا المقاس والكمية والخامة، ونرد خلال ساعات بالأسعار."
      },
      {
        "key": "quoteTitleAr",
        "label": "报价区块标题",
        "value": "اطلب عرض سعر"
      }
    ]
  },
  {
    "name": "货币",
    "items": [
      {
        "key": "baseAr",
        "label": "货币下拉里「基准货币」的标注",
        "value": "أساسي"
      },
      {
        "key": "ccyNoteAr",
        "label": "「按汇率折算」的说明",
        "value": "الأسعار محسوبة حسب سعر الصرف اليوم"
      },
      {
        "key": "currencyAr",
        "label": "顶栏货币选择器",
        "value": "العملة"
      }
    ]
  },
  {
    "name": "详情页",
    "items": [
      {
        "key": "detailsAr",
        "label": "“查看详情”",
        "value": "عرض التفاصيل"
      },
      {
        "key": "relatedAr",
        "label": "相关产品区标题",
        "value": "منتجات مشابهة في"
      },
      {
        "key": "specColorsAr",
        "label": "规格里的“颜色”",
        "value": "الألوان"
      },
      {
        "key": "specMaterialAr",
        "label": "规格里的“材质”",
        "value": "المادة"
      },
      {
        "key": "specSizesAr",
        "label": "规格里的“尺寸”",
        "value": "الأحجام"
      },
      {
        "key": "specUsesAr",
        "label": "规格里的“用途”",
        "value": "الاستخدامات"
      },
      {
        "key": "zoomAr",
        "label": "详情页放大提示",
        "value": "تكبير"
      }
    ]
  },
  {
    "name": "空状态",
    "items": [
      {
        "key": "emptyCategoryAr",
        "label": "搜不到时的标题",
        "value": "لا يوجد منتجات في هذا القسم بعد."
      },
      {
        "key": "emptyCategorySubAr",
        "label": "搜不到时的说明",
        "value": "لو تبحث عن شي معيّن، جرّب كلمة ثانية."
      },
      {
        "key": "emptyFavAr",
        "label": "收藏页空的标题",
        "value": "لسه ما اخترت أي منتج"
      },
      {
        "key": "emptyFavSubAr",
        "label": "收藏页空的说明",
        "value": "اضغط على القلب في أي منتج، وبيظهر هنا."
      },
      {
        "key": "noResultAr",
        "label": "搜索无结果提示",
        "value": "لا توجد نتائج مطابقة."
      }
    ]
  },
  {
    "name": "排序",
    "items": [
      {
        "key": "sortAzAr",
        "label": "排序“按字母”",
        "value": "أبجدياً"
      },
      {
        "key": "sortNewAr",
        "label": "排序“最新”",
        "value": "الأحدث"
      },
      {
        "key": "sortRelAr",
        "label": "排序“最相关”",
        "value": "الأكثر ملاءمة"
      }
    ]
  },
  {
    "name": "菜单",
    "items": [
      {
        "key": "menuCatsAr",
        "label": "抽屉里的“产品分类”",
        "value": "أقسام المنتجات"
      },
      {
        "key": "menuQuickAr",
        "label": "抽屉里的“快速链接”",
        "value": "روابط سريعة"
      },
      {
        "key": "menuSectorsAr",
        "label": "抽屉里的“行业”",
        "value": "حسب القطاع"
      }
    ]
  },
  {
    "name": "页脚",
    "items": [
      {
        "key": "footCatsAr",
        "label": "页脚“产品分类”",
        "value": "الأقسام"
      },
      {
        "key": "footContactAr",
        "label": "页脚“联系我们”",
        "value": "تواصل"
      },
      {
        "key": "footQuickAr",
        "label": "页脚“快速链接”",
        "value": "روابط سريعة"
      },
      {
        "key": "footSectorsAr",
        "label": "页脚“行业”",
        "value": "القطاعات"
      },
      {
        "key": "privacyAr",
        "label": "页脚“隐私政策”",
        "value": "سياسة الخصوصية"
      },
      {
        "key": "termsAr",
        "label": "页脚“使用条款”",
        "value": "الشروط والأحكام"
      }
    ]
  }
];
