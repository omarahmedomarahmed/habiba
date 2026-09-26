/**
 * 🔴 65.17 / 65.18 / 65.19 — WHAT THE MARKETING SITE FEEDS THE REAL COMPONENTS.
 *
 * > **65.17** *The components are the REAL ones, rendered. Not screenshots that rot, not
 * > mockups drawn in a design tool.*
 *
 * A rendered component is the feature, and it stops working the day somebody removes
 * it. `verify:reachable` already proves a component is wired to something; this makes
 * the marketing site one of the things it is wired to.
 *
 * ## 🔴 THE FOUNDERS' DEMO VIDEO, TYPED OUT BY HAND (founder, 26 Sep)
 *
 * *"Make the data on the mockups the same data from the video, seeded data as it would
 * look like when we sign in to this demo seeded user portal or app."*
 *
 * So every screen on the public site now shows the event cast: Cairo Foundry and its HR
 * lead Dalia Samir, Mariam Hassan and her four sessions with Dr Karim Nabil, and Nile
 * Practice run by Hana Mahmoud. Every one of them is an invented person at
 * `example.com`, written for `scripts/_event-cast.ts` and `scripts/_event-story.ts`, and
 * the figures below are the ones that seed produces (EGP 34,700 left of 55,000, 18
 * sessions, EGP 20,300 spent, joining code F7WZYJ97 as the video shows it).
 *
 * ## 🔴 65.19 STILL HOLDS WHERE IT MATTERS: THIS FILE IMPORTS NOTHING
 *
 * The rule was that no row can reach a marketing page. That is still true: the values
 * are TYPED here, copied from the story by a person, and this file has no import, no
 * query and no path to a database. The obvious build, a script that reads the seeded
 * database and writes this file, is still forbidden, and `verify:sprint65` still
 * refuses any import at all. What changed is only whose invented names are typed in.
 *
 * Dates are the seed's own, laid out on the day the video was recorded: "today" is
 * Saturday 26 September 2026, Mariam's sessions are 28, 21, 14 and 7 days before it
 * at 16:00 Cairo time, and her next one is tomorrow.
 */

/* ======================================================================== */
/*  names, in both languages                                                 */
/* ======================================================================== */

const AR_NAMES: Record<string, string> = {
  "Mariam Hassan": "مريم حسن",
  Mariam: "مريم",
  "Dr Karim Nabil": "د. كريم نبيل",
  "Karim Nabil": "كريم نبيل",
  "Dr Salma Fouad": "د. سلمى فؤاد",
  "Dr Youssef Adel": "د. يوسف عادل",
  "Dr Nour El-Sayed": "د. نور السيد",
  "Dr Amira Mansour": "د. أميرة منصور",
  "Dr Hesham Ragab": "د. هشام رجب",
  "Dalia Samir": "داليا سمير",
  "Hana Mahmoud": "هنا محمود",
  "Omar Khaled": "عمر خالد",
  "Mohamed Gaber": "محمد جابر",
  "Tamer Adly": "تامر عدلي",
  "Rana Shawky": "رنا شوقي",
  "Dina Lotfy": "دينا لطفي",
  "Hany Zaki": "هاني زكي",
  "Mai Soliman": "مي سليمان",
  "Omar K.": "عمر خ.",
  "Rana S.": "رنا ش.",
  "Hazem T.": "حازم ت.",
  "Yara M.": "يارا م.",
  "Sherif W.": "شريف و.",
  "Hoda I.": "هدى إ.",
  "Clinical psychologist": "أخصائي نفسي إكلينيكي",
  "Counselling psychologist": "أخصائية إرشاد نفسي",
  "Family therapist": "معالجة أسرية",
  Psychotherapist: "معالج نفسي",
  Cairo: "القاهرة",
  Giza: "الجيزة",
  Alexandria: "الإسكندرية",
  Mansoura: "المنصورة",
};

/** A name, a credential or a city in the page's language. Unknown words pass through. */
export function demoName(name: string, locale: "en" | "ar"): string {
  return locale === "ar" ? (AR_NAMES[name] ?? name) : name;
}

const AR_LANGUAGES: Record<string, string> = {
  Arabic: "العربية",
  English: "الإنجليزية",
  French: "الفرنسية",
};

/** "Arabic, English" becomes "العربية، الإنجليزية" on an Arabic page. */
export function demoLanguages(list: string, locale: "en" | "ar"): string {
  if (locale !== "ar") return list;
  return list
    .split(", ")
    .map((one) => AR_LANGUAGES[one] ?? one)
    .join("، ");
}

const AR_SPECIALTIES: Record<string, string> = {
  Anxiety: "القلق",
  "Work stress & burnout": "ضغط العمل والاحتراق",
  Sleep: "النوم",
  Depression: "الاكتئاب",
  "Grief & loss": "الحزن والفقد",
  Relationships: "العلاقات",
  "Trauma & PTSD": "الصدمة واضطراب ما بعد الصدمة",
  "Panic attacks": "نوبات الهلع",
  "Family conflict": "الخلافات الأسرية",
  Postnatal: "ما بعد الولادة",
  OCD: "الوسواس القهري",
  "Eating disorders": "اضطرابات الأكل",
  Addiction: "الإدمان",
};

export function demoSpecialty(name: string, locale: "en" | "ar"): string {
  return locale === "ar" ? (AR_SPECIALTIES[name] ?? name) : name;
}

/** Text written in both languages, picked by the page's. */
export type Both = { en: string; ar: string };
export const pick = (text: Both, locale: "en" | "ar") => text[locale];

/* ======================================================================== */
/*  the day                                                                  */
/* ======================================================================== */

/** Where every example clock is. Cairo, as the whole cast is. */
export const DEMO_ZONE = "Africa/Cairo";

/** The seed's "today": the example screens are dated around it. */
export const DEMO_TODAY = "2026-09-26T09:00:00Z";

/* ======================================================================== */
/*  the therapists a patient can find                                        */
/* ======================================================================== */

export type DemoTherapist = {
  name: string;
  credentials: string;
  city: string;
  languages: string;
  specialties: string[];
  headline: Both;
  /** Pounds per session, as each one set it. */
  egp: number;
  /** Their patients' stars, as the seed's feedback averages them. */
  rating: { average: number; count: number };
  /** Where they sit on the map. */
  country: string;
};

/**
 * 🔴 In the order Mariam's home screen shows them, which is the founder's own list:
 * Karim for anxiety, Salma for depression, Youssef for trauma.
 */
export const DEMO_THERAPISTS: DemoTherapist[] = [
  {
    name: "Dr Karim Nabil",
    credentials: "Clinical psychologist",
    city: "Cairo",
    languages: "Arabic, English",
    specialties: ["Anxiety", "Work stress & burnout", "Sleep"],
    headline: {
      en: "Anxiety, burnout and sleep, in Arabic and English",
      ar: "القلق والاحتراق والنوم، بالعربية والإنجليزية",
    },
    egp: 1_200,
    rating: { average: 4.8, count: 6 },
    country: "EG",
  },
  {
    name: "Dr Salma Fouad",
    credentials: "Counselling psychologist",
    city: "Cairo",
    languages: "Arabic, English",
    specialties: ["Depression", "Grief & loss", "Relationships"],
    headline: { en: "Grief, low mood and relationships", ar: "الحزن والمزاج المنخفض والعلاقات" },
    egp: 1_000,
    rating: { average: 4.8, count: 5 },
    country: "EG",
  },
  {
    name: "Dr Youssef Adel",
    credentials: "Clinical psychologist",
    city: "Giza",
    languages: "Arabic, English",
    specialties: ["Trauma & PTSD", "Panic attacks", "Anxiety"],
    headline: { en: "Trauma and panic, step by step", ar: "الصدمة والهلع، خطوة بخطوة" },
    egp: 1_400,
    rating: { average: 4.8, count: 6 },
    country: "EG",
  },
  {
    name: "Dr Nour El-Sayed",
    credentials: "Family therapist",
    city: "Cairo",
    languages: "Arabic, English, French",
    specialties: ["Family conflict", "Relationships", "Postnatal"],
    headline: { en: "Families, couples and new parents", ar: "العائلات والأزواج والآباء الجدد" },
    egp: 1_100,
    rating: { average: 4.8, count: 5 },
    country: "EG",
  },
  {
    name: "Dr Amira Mansour",
    credentials: "Clinical psychologist",
    city: "Alexandria",
    languages: "Arabic, French, English",
    specialties: ["OCD", "Anxiety", "Eating disorders"],
    headline: {
      en: "OCD, anxiety and eating, in Alexandria and online",
      ar: "الوسواس والقلق والأكل، في الإسكندرية وأونلاين",
    },
    egp: 900,
    rating: { average: 4.8, count: 8 },
    country: "EG",
  },
  {
    name: "Dr Hesham Ragab",
    credentials: "Psychotherapist",
    city: "Mansoura",
    languages: "Arabic",
    specialties: ["Addiction", "Depression", "Work stress & burnout"],
    headline: {
      en: "Drinking, low mood and work stress, in Arabic",
      ar: "الشرب والمزاج المنخفض وضغط العمل، بالعربية",
    },
    egp: 700,
    rating: { average: 4.6, count: 5 },
    country: "EG",
  },
];

/** The areas on her home screen, most listed first, as `categories()` orders them. */
export const DEMO_AREAS: { code: string; count: number }[] = [
  { code: "Anxiety", count: 3 },
  { code: "Depression", count: 2 },
  { code: "Relationships", count: 2 },
  { code: "Work stress & burnout", count: 2 },
  { code: "Addiction", count: 1 },
  { code: "Eating disorders", count: 1 },
  { code: "Family conflict", count: 1 },
  { code: "Grief & loss", count: 1 },
  { code: "OCD", count: 1 },
  { code: "Panic attacks", count: 1 },
  { code: "Postnatal", count: 1 },
  { code: "Sleep", count: 1 },
  { code: "Trauma & PTSD", count: 1 },
];

/* ======================================================================== */
/*  Mariam Hassan, a patient whose employer pays                             */
/* ======================================================================== */

export const DEMO_PATIENT = {
  first: { en: "Mariam", ar: "مريم" } as Both,
  full: "Mariam Hassan",
  employer: "Cairo Foundry",
} as const;

/** Kept for the room demo, which greets her by first name. */
export const DEMO_PATIENT_NAME = { en: "Mariam", ar: "مريم" } as const;

export type DemoVisit = {
  at: string;
  therapist: string;
  brief: Both;
};

/** Her four sessions with Dr Karim, each with the brief he signed and released. */
export const MARIAM_VISITS: DemoVisit[] = [
  {
    at: "2026-09-19T13:00:00Z",
    therapist: "Dr Karim Nabil",
    brief: {
      en: "You had the conversation you were dreading, and it turned out your manager never expected a reply at night. Five nights of seven slept through, and both questionnaires are about five points lower than in the first week.",
      ar: "أجريتِ المحادثة التي كنتِ تخشينها، واتضح أن مديرتك لم تتوقع ردًا في الليل أصلًا. خمس ليالٍ من سبع نمتِ فيها دون انقطاع، ودرجتا الاستبيانين أقل بنحو خمس نقاط من الأسبوع الأول.",
    },
  },
  {
    at: "2026-09-12T13:00:00Z",
    therapist: "Dr Karim Nabil",
    brief: {
      en: "Three of four nights slept through, and the late message you answered on Sunday cost you nothing. After the meeting your mind kept the correction and dropped the investor presentation. Both happened.",
      ar: "ثلاث ليالٍ من أربع نمتِ فيها دون انقطاع، والرسالة المتأخرة التي رددتِ عليها يوم الأحد لم تكلفكِ شيئًا. بعد الاجتماع احتفظ ذهنك بالتصحيح وأسقط عرض المستثمرين. والاثنان حدثا.",
    },
  },
  {
    at: "2026-09-05T13:00:00Z",
    therapist: "Dr Karim Nabil",
    brief: {
      en: "Your own notes did the work this week: five late answers, five nights awake at three, and two nights with the phone in the kitchen that you slept until seven. The rule is older than this job, and you can try loosening it.",
      ar: "ملاحظاتك أنتِ قامت بالعمل هذا الأسبوع: خمس ردود متأخرة، وخمس ليالٍ مستيقظة في الثالثة، وليلتان والهاتف في المطبخ نمتِ فيهما حتى السابعة. القاعدة أقدم من هذه الوظيفة، ويمكنكِ أن تجربي تخفيفها.",
    },
  },
  {
    at: "2026-08-29T13:00:00Z",
    therapist: "Dr Karim Nabil",
    brief: {
      en: "You named the thing that wakes you at three: the messages that arrive at eleven and the feeling you have to answer them. This week is only about noticing, not changing.",
      ar: "سمّيتِ الشيء الذي يوقظك في الثالثة: الرسائل التي تصل في الحادية عشرة، والإحساس بأن عليكِ الرد عليها. هذا الأسبوع للملاحظة فقط، لا للتغيير.",
    },
  },
];

/** Tomorrow at 16:00 Cairo, booked, and paid by Cairo Foundry's pot at booking. */
export const MARIAM_NEXT = { at: "2026-09-27T13:00:00Z", therapist: "Dr Karim Nabil" } as const;

/** The two steps still open, from her last session. */
export const MARIAM_STEPS: Both[] = [
  { en: "Your early sign is checking the phone in bed", ar: "علامتك المبكرة هي تفقّد الهاتف في السرير" },
  {
    en: "If you notice it: phone back to the kitchen, and book a session early",
    ar: "إن لاحظتِها: الهاتف يعود إلى المطبخ، واحجزي جلسة مبكرًا",
  },
];

/** Her journal, in her own words, dated between the sessions. */
export const MARIAM_JOURNAL: { on: string; text: Both }[] = [
  {
    on: "2026-09-21T18:00:00Z",
    text: {
      en: "Talked to Sherine. She said she never expected replies at night. Two years. I laughed in the car on the way home.",
      ar: "كلمت شيرين. قالت إنها عمرها ما استنت مني رد بالليل. سنتين. ضحكت في العربية وأنا راجعة البيت.",
    },
  },
  {
    on: "2026-09-14T18:00:00Z",
    text: {
      en: "The meeting keeps replaying. Evidence for lazy: one wrong number. Evidence against: she asked me to present to the investors. Writing it down makes the second one louder.",
      ar: "الاجتماع بيتعاد في دماغي. دليل إني كسولة: رقم واحد غلط. دليل العكس: طلبت مني أعرض قدام المستثمرين. لما بكتبها التانية بيبقى صوتها أعلى.",
    },
  },
  {
    on: "2026-09-08T18:00:00Z",
    text: {
      en: "Phone in the kitchen. Slept until 7. First time in weeks. نمت كويس الحمد لله.",
      ar: "الموبايل في المطبخ. نمت لحد ٧. أول مرة من أسابيع. نمت كويس الحمد لله.",
    },
  },
  {
    on: "2026-09-01T18:00:00Z",
    text: {
      en: "Answered Sherine at 11:40 again. Woke at 3:10. Wrote it down like Dr Karim said. It feels stupid to write down but the pattern is already obvious.",
      ar: "رديت على شيرين الساعة ١١:٤٠ تاني. صحيت ٣:١٠. كتبتها زي ما دكتور كريم قال. حاسة إنها حاجة سخيفة أكتبها بس النمط باين من دلوقتي.",
    },
  },
];

/** The one summary on her record, signed the day after her last session. */
export const MARIAM_SUMMARY = {
  version: 1,
  author: "Dr Karim Nabil",
  credentials: "Clinical psychologist",
  on: "2026-09-20T12:00:00Z",
  body: {
    en: "Work-related anxiety with middle insomnia, maintained by answering her manager's messages late at night. After agreeing response times at work she sleeps through five nights of seven; PHQ-9 12 to 7, GAD-7 13 to 8. Relapse plan in place for quarter close.",
    ar: "قلق مرتبط بالعمل مع أرق في منتصف الليل، يستمر بسبب الرد على رسائل مديرتها في وقت متأخر. بعد الاتفاق على مواعيد للرد في العمل صارت تنام دون انقطاع خمس ليالٍ من سبع؛ PHQ-9 من 12 إلى 7، وGAD-7 من 13 إلى 8. خطة للوقاية من الانتكاس جاهزة قبل إغلاق الربع.",
  } as Both,
} as const;

/* ======================================================================== */
/*  Dr Karim Nabil, a therapist in solo practice                             */
/* ======================================================================== */

export const KARIM = {
  name: "Karim Nabil",
  email: "karim.nabil@example.com",
  /** What a patient pays him, and what reaches him after the 15% fee. */
  priceEgp: 1_200,
  keepsEgp: 1_020,
} as const;

/** Every session he has held and has booked, newest first. */
export const KARIM_SESSIONS: { patient: string; at: string; upcoming?: boolean; covered: boolean }[] = [
  { patient: "Mariam Hassan", at: "2026-09-27T13:00:00Z", upcoming: true, covered: true },
  { patient: "Mariam Hassan", at: "2026-09-19T13:00:00Z", covered: true },
  { patient: "Mohamed Gaber", at: "2026-09-14T13:00:00Z", covered: true },
  { patient: "Mariam Hassan", at: "2026-09-12T13:00:00Z", covered: true },
  { patient: "Mariam Hassan", at: "2026-09-05T13:00:00Z", covered: true },
  { patient: "Mohamed Gaber", at: "2026-08-31T12:00:00Z", covered: true },
  { patient: "Mariam Hassan", at: "2026-08-29T13:00:00Z", covered: true },
];

export const KARIM_PATIENTS: { name: string; sessions: number; last: string; next?: string }[] = [
  { name: "Mariam Hassan", sessions: 4, last: "2026-09-19T13:00:00Z", next: "2026-09-27T13:00:00Z" },
  { name: "Mohamed Gaber", sessions: 2, last: "2026-09-14T13:00:00Z" },
];

/** What his chart holds on her: dated observations, each traceable to a session. */
export const MARIAM_OBSERVATIONS: { at: string; text: Both }[] = [
  {
    at: "2026-09-19T13:00:00Z",
    text: {
      en: "Sleeping through five of seven nights after agreeing response times with her manager.",
      ar: "تنام دون انقطاع خمس ليالٍ من سبع بعد الاتفاق مع مديرتها على مواعيد الرد.",
    },
  },
  {
    at: "2026-09-12T13:00:00Z",
    text: {
      en: "A message answered the next morning had no consequence at work.",
      ar: "رسالة رُدّ عليها في الصباح التالي لم يترتب عليها شيء في العمل.",
    },
  },
  {
    at: "2026-09-05T13:00:00Z",
    text: {
      en: "Slept through on both nights the phone stayed out of the bedroom.",
      ar: "نامت دون انقطاع في الليلتين اللتين بقي فيهما الهاتف خارج غرفة النوم.",
    },
  },
  {
    at: "2026-08-29T13:00:00Z",
    text: {
      en: "Has not declined a request from her manager in two years.",
      ar: "لم ترفض طلبًا لمديرتها منذ عامين.",
    },
  },
];

/** The copilot thread already on his side of her chart. */
export const MARIAM_COPILOT = {
  question: {
    en: "What seems to be driving the 3am waking: the workload, or the manager?",
    ar: "ما الذي يبدو أنه يوقظها في الثالثة: حجم العمل، أم المديرة؟",
  } as Both,
  answer: {
    en: "Mostly the late messages rather than the volume of work. In the second session she reported waking at three on the five nights she had answered after ten, and sleeping until seven on the two nights her phone stayed in the kitchen. Since agreeing response times with her manager she has slept through five nights of seven.",
    ar: "الرسائل المتأخرة غالبًا، لا حجم العمل. في الجلسة الثانية قالت إنها استيقظت في الثالثة في الليالي الخمس التي ردّت فيها بعد العاشرة، ونامت حتى السابعة في الليلتين اللتين بقي فيهما الهاتف في المطبخ. ومنذ اتفقت مع مديرتها على مواعيد الرد تنام دون انقطاع خمس ليالٍ من سبع.",
  } as Both,
  cite: {
    on: "2026-09-05T13:00:00Z",
    quote: {
      en: "The two nights I left the phone in the kitchen I slept until seven. Both of them.",
      ar: "الليلتين اللي سبت فيهم الموبايل في المطبخ نمت لحد سبعة. الاتنين.",
    } as Both,
  },
} as const;

/* ======================================================================== */
/*  Cairo Foundry, a company that covers every session                       */
/* ======================================================================== */

export const COMPANY = {
  name: "Cairo Foundry",
  hr: "Dalia Samir",
  hrEmail: "dalia.foundry@example.com",
  /** What it covers of each session. */
  coveragePercent: 100,
  code: "F7WZYJ97",
  /** In pounds: the welcome credit and the transfer, the spend, and what is left. */
  putInEgp: 55_000,
  spentEgp: 20_300,
  leftEgp: 34_700,
  sessions: 18,
  expiresOn: "2027-08-22",
  staffCount: 8,
} as const;

/** Its people on the staff list. Enrolled, which is all the portal ever says about them. */
export const COMPANY_STAFF: string[] = [
  "Mariam Hassan",
  "Omar Khaled",
  "Mohamed Gaber",
  "Tamer Adly",
  "Rana Shawky",
  "Dina Lotfy",
  "Hany Zaki",
  "Mai Soliman",
];

/**
 * 🔴 Spend by week, as the seed dates it. The first week held one session, which is
 * under the floor, so the real rule hatches it rather than printing EGP 1,000 beside
 * the only person who went that week.
 */
export const COMPANY_WEEKS: { weekStart: string; egp: number | null }[] = [
  { weekStart: "2026-08-17", egp: null },
  { weekStart: "2026-08-24", egp: 3_500 },
  { weekStart: "2026-08-31", egp: 3_400 },
  { weekStart: "2026-09-07", egp: 4_500 },
  { weekStart: "2026-09-14", egp: 3_300 },
  { weekStart: "2026-09-21", egp: 4_600 },
];

/** The spending page's months: August 5 sessions, September 13. */
export const COMPANY_MONTHS: { month: string; egp: number; sessions: number }[] = [
  { month: "2026-09-01", egp: 14_600, sessions: 13 },
  { month: "2026-08-01", egp: 5_700, sessions: 5 },
];

/** What went into the pot: the welcome credit and one bank transfer. */
export const COMPANY_TOPUPS: { what: "welcome" | "transfer"; on: string; egp: number; reference?: string }[] = [
  { what: "transfer", on: "2026-07-28", egp: 50_000, reference: "CIB-TRF-2026-08-731" },
  { what: "welcome", on: "2026-07-28", egp: 5_000 },
];

/* ======================================================================== */
/*  Nile Practice, a clinic of three                                         */
/* ======================================================================== */

export const CLINIC = {
  name: "Nile Practice",
  manager: "Hana Mahmoud",
  managerEmail: "hana.clinic@example.com",
  seats: 3,
} as const;

export const CLINIC_TEAM: {
  name: string;
  email: string;
  verify: "verified" | "pending";
  patients: number;
  /** What reached them from sessions held here, in pounds, after the fee. */
  earnedEgp: number;
}[] = [
  { name: "Dr Salma Fouad", email: "salma.fouad@example.com", verify: "verified", patients: 2, earnedEgp: 4_250 },
  { name: "Dr Youssef Adel", email: "youssef.adel@example.com", verify: "verified", patients: 2, earnedEgp: 7_140 },
  { name: "Dr Nour El-Sayed", email: "nour.elsayed@example.com", verify: "verified", patients: 2, earnedEgp: 4_675 },
];

/**
 * Two weeks of the rota: the one the video opens on, with what was held in it, and the
 * one after, with what is booked. First name and last initial, because that is all the
 * clinic's screen carries.
 */
export const CLINIC_WEEKS: { monday: string; rows: { at: string; clinician: string; patient: string }[] }[] = [
  {
    monday: "2026-09-21T09:00:00Z",
    rows: [
      { at: "2026-09-21T12:00:00Z", clinician: "Dr Youssef Adel", patient: "Rana S." },
      { at: "2026-09-22T08:00:00Z", clinician: "Dr Salma Fouad", patient: "Omar K." },
      { at: "2026-09-27T14:00:00Z", clinician: "Dr Nour El-Sayed", patient: "Hazem T." },
    ],
  },
  {
    monday: "2026-09-28T09:00:00Z",
    rows: [
      { at: "2026-09-28T09:00:00Z", clinician: "Dr Salma Fouad", patient: "Omar K." },
      { at: "2026-09-29T11:00:00Z", clinician: "Dr Youssef Adel", patient: "Yara M." },
      { at: "2026-09-30T14:00:00Z", clinician: "Dr Nour El-Sayed", patient: "Sherif W." },
    ],
  },
];

/* ======================================================================== */
/*  Helio Health, a partner developer                                        */
/* ======================================================================== */

export const DEMO_ORGS = { partner: "Helio Health" } as const;

export const PARTNER_KEYS: { prefix: string; live: boolean; usedAt: string; scopes: string[] }[] = [
  { prefix: "pk_test_4f2a", live: false, usedAt: "14:02", scopes: ["record:read", "session:write"] },
];

export const PARTNER_DELIVERIES: {
  status: number;
  event: string;
  state: "delivered" | "pending" | "failed";
  attempts: number;
  subject: string;
  at: string;
}[] = [
  { status: 200, event: "note.approved", state: "delivered", attempts: 1, subject: "sub_8f3k2q", at: "14:02" },
  { status: 200, event: "session.completed", state: "delivered", attempts: 1, subject: "sub_8f3k2q", at: "13:51" },
  { status: 503, event: "session.completed", state: "pending", attempts: 2, subject: "sub_2m7x9d", at: "13:20" },
];
