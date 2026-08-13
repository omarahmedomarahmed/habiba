import type { DefaultPage } from "./defaults";

/**
 * The public site, in Arabic.
 *
 * Not a translation of the English pages so much as the same argument made to
 * the same reader in their own language — which is why the headings are
 * shorter here. Arabic renders wider than English at the same point size, and
 * a headline that fits on one line in English wraps to three in Arabic and
 * stops being a headline.
 *
 * Two things are deliberately left in Latin script: the product name, because
 * it is a name, and the Western digits, because a person in crisis reading a
 * number needs to recognise it instantly. See `localeTag` in lib/i18n/config.
 *
 * The legal pages are NOT here, and that is a decision rather than an
 * omission. Machine-translated terms of service and privacy policy are a
 * liability: they are the documents that get read adversarially, in front of a
 * regulator, by somebody looking for the gap between the two language
 * versions. They fall back to English until a qualified translator has been
 * through them, which the CMS does automatically.
 */
export const DEFAULT_PAGES_AR: DefaultPage[] = [
  {
    slug: "home",
    title: "24Therapy — ملاحظات جلساتك، تُكتب من أجلك",
    description:
      "سجّل جلسة علاجية من هاتفك واخرج منها بملاحظة سريرية كاملة، ورؤى إكلينيكية، وتقرير يمكنك إرساله لمريضك.",
    layout: "marketing",
    navLabel: null,
    navOrder: null,
    blocks: [
      {
        type: "hero",
        eyebrow: "رادار الأزمات",
        heading: "تحدّث إلى معالج حقيقي خلال دقيقة",
        body: "كل نقطة على الخريطة معالج مرخّص متاح في هذه اللحظة. اختر اللغة أو ما تحتاج المساعدة فيه، اختر شخصًا، أخبره بما يناديك به — وتكون داخل الجلسة. بلا حساب، بلا قوائم انتظار، وبلا استمارات تأمين.",
        demo: "radar",
      },
      {
        type: "hero",
        eyebrow: "للمعالجين",
        heading: "أنهِ ملاحظاتك قبل أن تغادر الغرفة",
        body: "ابدأ الجلسة من هاتفك. يكتب 24Therapy النص مباشرة أثناء الحديث، ثم يعدّ الملاحظة السريرية والملخص والمتابعة بينما لا تزال تودّع مريضك. تراجعها، تعتمدها، وترسلها.",
        ctaLabel: "ابدأ جلستك الأولى مجانًا",
        ctaHref: "/signup",
        demo: "session-room",
        backgroundImage: "/backgrounds/mesh.svg",
      },
      {
        type: "showcase",
        heading: "كل ما نقوله هنا شاشة يمكنك رؤيتها",
        items: [
          {
            title: "النص يكتب نفسه",
            body: "يُلتقط الصوت في مقاطع قصيرة ويُحوَّل إلى نص أثناء سير الجلسة. في مكالمات الفيديو يكون لكل شخص مساره الصوتي المستقل، فنعرف من قال ماذا بدل أن نخمّن.",
            icon: "mic",
            demo: "transcript",
          },
          {
            title: "الملاحظة جاهزة حين تقف",
            body: "إنهاء الجلسة يبدأ التوليد فورًا: ملاحظة سريرية كاملة مع ملخص ونقاط للحديث وملاحظات وانطباعات وخطة متابعة. كل ذلك مسودة باسمك حتى تعتمدها أنت.",
            icon: "fileText",
            demo: "note",
          },
          {
            title: "لغة الخطر لا تفوتنا أبدًا",
            body: "يُفحص كل مقطع فور وصوله. إذا ظهرت لغة تشير إلى خطر تصلك الإشارة داخل الغرفة، وتُكتب في قاعدة البيانات قبل إخطار أي أحد — لتبقى حتى لو فشل الإرسال.",
            icon: "shield",
            demo: "risk",
          },
          {
            title: "رأي ثانٍ هادئ",
            body: "اقتراحان قصيران على الأكثر في كل مرة، وفقط حين يكون هناك ما يستحق قوله. يقترح ولا يأمر، والصمت هو الإجابة المتوقعة.",
            icon: "brain",
            demo: "copilot",
          },
        ],
      },
      {
        type: "features",
        heading: "ثلاث نقرات من التحية إلى ملاحظة موقّعة",
        items: [
          {
            title: "ابدأ",
            body: "اضغط جلسة جديدة، اكتب اسمًا أول، اضغط ابدأ. حضوريًا أو بالفيديو — بلا جدولة ولا استمارات ولا معالج إعداد.",
            icon: "zap",
          },
          {
            title: "تحدّث",
            body: "يُبنى النص إلى جوارك. اضغط «خارج التسجيل» في أي لحظة لا ينبغي فيها التقاط الحديث.",
            icon: "mic",
          },
          {
            title: "أرسل",
            body: "أنهِ الجلسة وستجد الملاحظة بانتظارك. اقرأها، عدّل ما تشاء، اعتمدها، وأرسل للمريض ملخصًا بلغة بسيطة.",
            icon: "mail",
          },
          {
            title: "المرضى لا يحتاجون حسابًا",
            body: "أرسل رابطًا. يكتبون اسمهم الأول ويدخلون. بلا كلمة مرور، بلا تطبيق، وبلا بوابة تحتاج دعمًا فنيًا.",
            icon: "users",
          },
          {
            title: "بيانات المرضى تبقى في مكانها",
            body: "كل اطّلاع على ملف يُسجَّل في سجل تدقيق لا يُعدَّل. ولا يصل نص أي جلسة إلى سجلات التطبيق.",
            icon: "lock",
          },
          {
            title: "مصمم للهاتف",
            body: "المعالجون يعملون من هواتفهم، ولذلك صُمم هذا للهاتف أولًا. سطح المكتب إضافة، وليس العكس.",
            icon: "clock",
          },
        ],
      },
      {
        type: "cta",
        heading: "جلستك الأولى مجانية",
        body: "بلا بطاقة وبلا معالج إعداد. سجّل وابدأ جلسة في أقل من دقيقة.",
        ctaLabel: "أنشئ حسابك",
        ctaHref: "/signup",
        backgroundImage: "/backgrounds/waves.svg",
      },
    ],
  },
  {
    slug: "features",
    title: "كيف يعمل 24Therapy",
    description:
      "تفريغ نصي مباشر، وملاحظات سريرية تلقائية، وتنبيهات للغة الأزمات، وتقارير للمرضى — من هاتفك.",
    layout: "marketing",
    navLabel: "المزايا",
    navOrder: 1,
    blocks: [
      {
        type: "hero",
        eyebrow: "المزايا",
        heading: "المنتج كله شاشة واحدة",
        body: "معظم البرمجيات السريرية تطلب منك أن تتعلّمها. هذا يطلب منك أن تضغط «ابدأ».",
        ctaLabel: "اطّلع على الأسعار",
        ctaHref: "/pricing",
        demo: "session-room",
        backgroundImage: "/backgrounds/grid.svg",
      },
      {
        type: "showcase",
        heading: "داخل الغرفة",
        items: [
          {
            title: "نص مباشر، بصوتين",
            body: "في الفيديو يصل المعالج والمريض على مسارين صوتيين منفصلين، فيُنسب كل سطر بيقين. وحضوريًا يسمع ميكروفون واحد الغرفة، وتستنتج الملاحظة المتحدث من السياق.",
            icon: "mic",
            demo: "transcript",
          },
          {
            title: "اقتراحات لا تعليمات",
            body: "يقرأ المساعد آخر دقائق ويقدم اقتراحين قصيرين على الأكثر، كل عدة مقاطع لا باستمرار — فالنصيحة التي تتغير كل ثماني ثوانٍ ضجيج.",
            icon: "brain",
            demo: "copilot",
          },
          {
            title: "لغة الأزمة ترفع علامة",
            body: "التنبيهات تصلك أنت وحدك. المريض الداخل عبر رابط لا يرى أبدًا مستوى خطر — بل رسالة داعمة ورقم خط للمساعدة.",
            icon: "alert",
            demo: "risk",
          },
          {
            title: "الملاحظة التي كنت ستكتبها",
            body: "ذاتي وموضوعي وتقييم وخطة، مع ملخص ونقاط للحديث وملاحظات وانطباعات ومتابعة. قابلة للتعديل بالكامل، ولا يوقّعها أحد سواك.",
            icon: "fileText",
            demo: "note",
          },
        ],
      },
    ],
  },
  {
    slug: "contact",
    title: "تواصل معنا",
    description: "تحدّث إلى شخص حقيقي من 24Therapy.",
    layout: "document",
    navLabel: "تواصل معنا",
    navOrder: 3,
    blocks: [
      {
        type: "hero",
        eyebrow: "تواصل",
        heading: "تواصل معنا",
        demo: "none",
        icon: "mail",
        backgroundImage: "/backgrounds/contours.svg",
      },
      {
        type: "prose",
        heading: "قبل أي شيء",
        body: "هذه ليست خدمة طوارئ. إذا كنت في خطر مباشر، اتصل برقم الطوارئ في بلدك الآن ولا تنتظر ردًا منا.",
      },
      {
        type: "prose",
        heading: "نحن في مرحلة تجريبية",
        body: "24Therapy قيد الاختبار مع عدد محدود من العيادات، ولم نكمل بعد متطلبات الامتثال الأمريكية. إن كنت عيادة مهتمة بالانضمام إلى هذه المرحلة فنحن نودّ التحدث إليك، وسنكون صريحين تمامًا بشأن ما هو جاهز وما ليس كذلك.",
      },
    ],
  },
];
