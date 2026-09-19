/*
 * 🔴 30.1 — the CONTROL PLANE. One copy, read by every region.
 *
 * This module reads facts about the PRODUCT rather than about a person:
 * settings, content, taxonomy, language, the operator console. There is one
 * of each and Cairo reads the same rows as Virginia. The compiler would not
 * let this file compile without making that choice explicitly.
 */
import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { DEMO_NOTE, DEMO_TRANSCRIPT } from "@/components/demo/fixtures";
import { controlDb as db } from "@/lib/db";
import { contentPages, type NoteContent } from "@/lib/db/schema";
import { getLocale } from "@/lib/i18n/server";

/**
 * The words inside the live components on the public site. PLAN.md 18.13.
 *
 * ## Why the mockups are content
 *
 * Sprint 21 has to be able to translate the *demonstrations*, not only the
 * paragraphs around them. A homepage that shows a real transcript panel in
 * Arabic with an English conversation inside it is worse than a screenshot:
 * it looks like the product cannot do Arabic, which is the opposite of true.
 *
 * So the demo transcript, the demo brief, the demo homework and the demo
 * profile live in a `content_pages` row (`slug = "demo"`) like everything
 * else, one per locale, and fall back to `components/demo/fixtures.ts` when
 * there is no row — the same two-job arrangement `defaults.ts` has, for the
 * same reason: the marketing site must not go blank because Postgres blinked.
 *
 * ## 🔴 Still synthetic, whatever an admin types
 *
 * 18.11: never a real record. The fallback is invented, and a row here is
 * written by staff in the CMS. Neither path can reach a patient — nothing in
 * this module reads a clinical table, and the components it feeds take their
 * data as props.
 */

export type DemoContent = {
  transcript: { id: string; speaker: "therapist" | "patient"; text: string }[];
  brief: string;
  steps: string[];
  /** The dated observations on the demo profile. */
  observations: { at: string; text: string }[];
  homework: { title: string; detail: string }[];
  patientSessions: { therapist: string; when: string; brief: string | null }[];
  /** 28.6 — the versioned summary, with the clinician behind each version. */
  summaryVersions: { version: number; author: string; on: string; body: string }[];
  /** 28.6 — what the person wrote themselves, between sessions. */
  journalEntries: { on: string; text: string }[];
  /**
   * 🔴 76.32 — THE NOTE ITSELF, which is the thing the demo is ABOUT.
   *
   * Every other field here has been translatable since sprint 28 and the note
   * was not, so the Arabic homepage rendered an Arabic conversation and then
   * produced an English SOAP note from it. That is a worse demonstration than
   * no demonstration: the one claim the hero makes is that the product writes
   * the note, and the picture said it writes it in the wrong language.
   */
  note: NoteContent;
  /** The two copilot prompts shown beside the transcript. */
  copilot: { kind: string; text: string }[];
  /**
   * 🔴 76.70 — WHAT A CLINICIAN ASKS IT, AND WHAT COMES BACK.
   *
   * The copilot demo used to be a list of things the product says at you. Half
   * of what it is for is the other direction: mid-session, a therapist asks
   * about the person in front of them and gets an answer built out of the
   * sessions they have already had. A demonstration with no question in it
   * shows a notifier rather than an assistant.
   *
   * Every answer carries `cites`, and that is not decoration either. The
   * product's rule is that an answer about a patient names the moment it came
   * from, so a clinician can go and read it rather than trust a paraphrase.
   * A demo answer with no citation would be advertising a behaviour the real
   * screen refuses to have.
   */
  copilotAsks: {
    q: string;
    a: string;
    cites: { on: string; at: string; who: "therapist" | "patient"; quote: string }[];
  }[];
  /** The phrase the risk banner is demonstrating having caught. */
  riskIndicator: string;
};

/** The shipped default. Every word invented; see the file it comes from. */
export const DEMO_FALLBACK: DemoContent = {
  transcript: DEMO_TRANSCRIPT.slice(0, 6).map((line) => ({
    id: line.id,
    speaker: line.speaker === "patient" ? "patient" : "therapist",
    text: line.text,
  })),
  brief: DEMO_NOTE.patientBrief ?? "",
  steps: DEMO_NOTE.patientSteps ?? [],
  /*
   * 🔴 76.66 — SIX, NOT THREE, AND THE COUNT IS THE POINT.
   *
   * These fixtures feed both the marketing demos and the UI reference, and at
   * two or three entries every screen rendered a third full and two thirds
   * white. A product shown half empty looks like a product with nothing in it.
   * Six observations is also closer to what a rolling profile actually holds
   * after a few months, so the demo stops understating the thing it sells.
   */
  observations: [
    { at: "12 March", text: "Sleep disruption returns before performance reviews, twice now." },
    { at: "5 March", text: "Kept the wind-down on four nights. Named it as the first thing that has worked." },
    { at: "27 February", text: "Describes the wind-down routine as 'pointless' before trying it." },
    { at: "20 February", text: "Work anxiety framed as 'just how the job is' rather than as a thing to treat." },
    { at: "13 February", text: "Reports the 03:00 waking is the part she dreads, more than the tiredness." },
    { at: "6 February", text: "First session. Came for sleep; work anxiety surfaced by minute ten." },
  ],
  homework: [
    { title: "Screens down an hour before bed", detail: "Four nights. Pick them now." },
    { title: "Same wake time after a bad night", detail: "The one that does the most work." },
    { title: "Two times, written down", detail: "Roughly asleep, roughly awake. Not a diary." },
    { title: "Out of bed after twenty minutes awake", detail: "Somewhere dim. Back when you are heavy." },
    { title: "One line about the review, before bed", detail: "On paper, so it is not in your head at three." },
  ],
  patientSessions: [
    { therapist: "Dr Nadia Farouk", when: "Tomorrow, 18:00", brief: null },
    {
      therapist: "Dr Nadia Farouk",
      when: "Last Tuesday",
      brief: "You said you would try going to bed earlier, and on the two nights you did it worked.",
    },
    {
      therapist: "Dr Nadia Farouk",
      when: "Two weeks ago",
      brief: "We looked at what happens between eleven and three, and you noticed it is the review you are rehearsing.",
    },
    {
      therapist: "Dr Nadia Farouk",
      when: "Last month",
      brief: "First session. You came about sleep and we ended up talking about work, which is worth following.",
    },
  ],
  /*
   * 🔴 Two clinicians, deliberately. One version would demonstrate a summary;
   * two with different names on them demonstrate the thing that is actually
   * hard, which is that moving practice does not start you again.
   */
  summaryVersions: [
    {
      version: 2,
      author: "Dr Youssef Bakr",
      on: "4 June",
      body: "Picking up from Dr Farouk. Sleep is steadier and the work anxiety underneath it is what we are on now. You said the reviews are the trigger rather than the job, which is worth holding on to.",
    },
    {
      version: 1,
      author: "Dr Nadia Farouk",
      on: "18 March",
      body: "You came about sleep and we found the pattern around performance reviews within two sessions. The wind-down routine helps on the nights you keep it. Handing over because you are moving cities, not because anything went wrong.",
    },
  ],
  journalEntries: [
    { on: "2 June", text: "Slept through for the first time in about three weeks. Nothing special happened, which is the annoying part." },
    { on: "31 May", text: "Got out of bed at half one like she said instead of lying there. Felt stupid. Went back down quicker though." },
    { on: "29 May", text: "Bad one. Kept rehearsing the review in my head until about two. Did the breathing, it helped a bit, not much." },
    { on: "26 May", text: "Wrote the review thing down before bed. Still thought about it, but it did not feel like it was growing." },
    { on: "22 May", text: "Skipped the wind-down, stayed on my phone. Predictable. Not doing that again this week." },
  ],
  note: DEMO_NOTE,
  copilot: [
    { kind: "explore", text: "Two of seven nights went better, worth naming that back." },
    { kind: "observation", text: "Fatigue and worry described as a loop, not two problems." },
    { kind: "explore", text: "She called the routine pointless in February and is keeping it now." },
    { kind: "pattern", text: "Third mention of the performance review in four sessions." },
    { kind: "observation", text: "Says 'just how the job is' when the work comes up. Same phrase as 20 February." },
  ],
  copilotAsks: [
    {
      q: "Has she mentioned the review before?",
      a: "Three times in the last four sessions. On 20 February she called it \"the thing in March\" and moved on; by 12 March she was naming it as the reason she was awake. The pattern is that it comes up late in the session rather than when you ask about work.",
      cites: [
        {
          on: "20 February",
          at: "31:04",
          who: "patient",
          quote: "There is the thing in March but that is ages away, it is fine.",
        },
        {
          on: "12 March",
          at: "08:20",
          who: "patient",
          quote: "I wake around three and then my head just starts going about the review.",
        },
      ],
    },
    {
      q: "What have we tried for the sleep?",
      a: "One thing: the wind-down routine agreed on 20 February. She called it pointless at the time. Adherence went from zero to two nights of seven, and both of those nights she reported getting back to sleep faster. Nothing else has been tried, so this is a first intervention rather than a failed one.",
      cites: [
        {
          on: "20 February",
          at: "44:12",
          who: "patient",
          quote: "I will try it but honestly it sounds a bit pointless.",
        },
        {
          on: "12 March",
          at: "14:55",
          who: "patient",
          quote: "I did it twice. Both times I got back down quicker, which I had not really clocked.",
        },
      ],
    },
    {
      q: "Anything I should be careful about today?",
      a: "Nothing on the risk side has been flagged in this session or the previous four. One thing to hold lightly: she tends to close down when the work is named directly, and opens up when it arrives sideways through sleep. That is an observation about two sessions, not a rule.",
      cites: [
        {
          on: "26 February",
          at: "19:41",
          who: "therapist",
          quote: "Can we stay with work for a minute?",
        },
      ],
    },
  ],
  riskIndicator: "want to die",
};

/**
 * 🔴 The Arabic fallback. PLAN.md 28.1, and 76.32 closes the rest of 22R.10.
 *
 * There is no `demo` row in `content_pages` and there never has been, so every
 * demonstration on the Arabic pages was falling through to the English
 * constant above: an Arabic page showing a transcript panel with an English
 * conversation inside it. 21R recorded that as 42 English passages remaining
 * and left it, correctly, because writing an Arabic transcript is writing
 * rather than translating.
 *
 * 🔴 SPRINT 28 CLOSED 5 OF THEM AND LEFT 37, DEFERRED TO "22R.10". Fifty-four
 * sprints later that sprint had not happened and `render:check` still printed
 * `PASS (18 checks, 1 deferred)`, which a reader takes as a pass. The 37 were
 * the two surfaces sprint 28 could not reach from here: the NOTE itself, and
 * the hero's own chrome, both of which read their English straight out of
 * `components/demo/fixtures.ts` without passing through this file at all.
 *
 * They pass through it now. `note`, `copilot` and `riskIndicator` below are
 * the rest of that writing, and the deferral is deleted rather than renamed.
 *
 * This is that writing. The people, the session and the week are invented, as
 * they are in the English one, and the conversation is written as Arabic
 * rather than rendered from the English sentences: an Egyptian patient does
 * not describe insomnia in translated English syntax.
 *
 * An admin can still override any of it from the CMS. This is the floor.
 */
export const DEMO_FALLBACK_AR: DemoContent = {
  transcript: [
    { id: "ar-1", speaker: "therapist", text: "طيب، حكيلي عن النوم الأسبوع ده." },
    { id: "ar-2", speaker: "patient", text: "بنام بالعافية. بفضل مستني الساعة تبقى تلاتة وأنا صاحي." },
    { id: "ar-3", speaker: "therapist", text: "وبيحصل ده كل ليلة، ولا في ليالي بعينها؟" },
    { id: "ar-4", speaker: "patient", text: "الأحد والاتنين أوحش حاجة. يوم التقييم في الشغل يوم التلات." },
    { id: "ar-5", speaker: "therapist", text: "ده أول مرة نقول فيها إن التقييم قبل النوم مش بعده." },
    { id: "ar-6", speaker: "patient", text: "أيوه. أنا مكنتش واخد بالي إن ده نفس النمط." },
  ],
  brief:
    "اتكلمنا النهاردة عن النوم، ولقينا إن أسوأ ليلتين هما اللي قبل التقييم في الشغل. اتفقنا تجرب تسيب الموبايل ساعة قبل ما تنام، أربع ليالي بس، وتصحى في نفس الميعاد حتى لو الليلة كانت وحشة.",
  steps: [
    "الموبايل بعيد ساعة قبل النوم، أربع ليالي",
    "نفس ميعاد الصحيان حتى بعد ليلة وحشة",
    "تكتب ميعادين تقريبيين: نمت امتى، صحيت امتى",
  ],
  observations: [
    { at: "١٢ مارس", text: "النوم بيتقطع قبل التقييم في الشغل، للمرة التانية." },
    { at: "٥ مارس", text: "مشيت على الروتين أربع ليالي. قالت إنها أول حاجة نفعت معاها." },
    { at: "٢٧ فبراير", text: "بيوصف روتين ما قبل النوم بأنه «ملوش لازمة» قبل ما يجربه." },
    { at: "٢٠ فبراير", text: "بتتكلم عن ضغط الشغل كأنه «طبيعة الشغل» مش حاجة ليها علاج." },
    { at: "١٣ فبراير", text: "بتقول إن الصحيان الساعة تلاتة هو الجزء اللي بتخاف منه، أكتر من التعب نفسه." },
    { at: "٦ فبراير", text: "أول جلسة. جه بسبب النوم، وقلق الشغل ظهر في أول عشر دقايق." },
  ],
  homework: [
    { title: "الموبايل بعيد ساعة قبل النوم", detail: "أربع ليالي. اختارهم دلوقتي." },
    { title: "نفس ميعاد الصحيان بعد الليلة الوحشة", detail: "دي اللي بتعمل الشغل كله." },
    { title: "ميعادين مكتوبين", detail: "نمت امتى تقريبًا، وصحيت امتى. مش مفكرة." },
    { title: "اقومي من السرير بعد عشرين دقيقة صحيان", detail: "مكان إضاءته هادية. وارجعي لما تتقلي." },
    { title: "سطر واحد عن التقييم قبل النوم", detail: "على ورق، عشان ما يفضلش في دماغك الساعة تلاتة." },
  ],
  patientSessions: [
    { therapist: "د. نادية فاروق", when: "بكرة، ٦ مساءً", brief: null },
    {
      therapist: "د. نادية فاروق",
      when: "الثلاثاء اللي فات",
      brief: "قلت إنك هتجرب تنام بدري، وفي الليلتين اللي عملت فيهم كده فعلًا نفع.",
    },
    {
      therapist: "د. نادية فاروق",
      when: "من أسبوعين",
      brief: "بصينا على اللي بيحصل بين حداشر وتلاتة، ولاحظتي إن اللي بتعيديه في دماغك هو التقييم.",
    },
    {
      therapist: "د. نادية فاروق",
      when: "الشهر اللي فات",
      brief: "أول جلسة. جيتي بسبب النوم وانتهينا بنتكلم عن الشغل، وده يستاهل نكمل فيه.",
    },
  ],
  summaryVersions: [
    {
      version: 2,
      author: "د. يوسف بكر",
      on: "٤ يونيو",
      body: "مكمل بعد د. نادية. النوم بقى أهدى، واللي تحته قلق الشغل وده اللي شغالين عليه دلوقتي. قلت إن التقييم هو اللي بيقلقك مش الشغل نفسه، وده كلام يستاهل نمسك فيه.",
    },
    {
      version: 1,
      author: "د. نادية فاروق",
      on: "١٨ مارس",
      body: "جيت بسبب النوم، ولقينا النمط اللي حوالين التقييم في جلستين. روتين ما قبل النوم بينفع في الليالي اللي بتلتزم بيه. بسلّم الملف لأنك بتنتقل مدينة، مش لأن حاجة مشيت غلط.",
    },
  ],
  journalEntries: [
    { on: "٢ يونيو", text: "نمت الليلة كلها لأول مرة من حوالي تلات أسابيع. مفيش حاجة مخصوص حصلت، وده الجزء المضايق." },
    { on: "٣١ مايو", text: "قمت من السرير الساعة واحدة ونص زي ما قالت، بدل ما أفضل نايمة صاحية. حسيت إني بعمل حاجة سخيفة. بس رجعت نمت أسرع." },
    { on: "٢٩ مايو", text: "ليلة وحشة. فضلت أعيد التقييم في دماغي لحد تقريبًا اتنين. عملت التنفس، نفع شوية، مش كتير." },
    { on: "٢٦ مايو", text: "كتبت موضوع التقييم قبل ما أنام. فضلت أفكر فيه، بس ما حستش إنه بيكبر." },
    { on: "٢٢ مايو", text: "ما عملتش الروتين وفضلت على الموبايل. متوقع. مش هكرر ده الأسبوع ده." },
  ],
  /*
   * 🔴 76.32 — AND THE NOTE IS WRITTEN IN ARABIC, not translated into it.
   *
   * The note is the one artefact on this page a clinician will read closely,
   * and clinical Arabic is its own register: Modern Standard for the record,
   * even where the transcript above it is Egyptian as a patient would speak.
   * A SOAP note phrased in colloquial Egyptian would demonstrate a product
   * that does not know the difference, which is the doubt a clinician arrives
   * with.
   *
   * Same session as the transcript above, deliberately. A hero that shows one
   * conversation and a note about a different one is the failure sprint 21R
   * named in the other language.
   */
  note: {
    soap: {
      subjective:
        "يفيد المريض بعودة أرق منتصف الليل خلال الأسبوع الماضي، مع الاستيقاظ قرابة الثالثة فجرًا وأفكار متكررة تدور حول تقييم أداء وشيك في العمل. يصف حلقة متبادلة بين إرهاق النهار وقلق الترقّب. التزام جزئي بروتين ما قبل النوم المتفق عليه، ليلتان من سبع، مع عودة أسرع للنوم في الليلتين.",
      objective:
        "متيقظ وموجَّه ومتفاعل طوال الجلسة. الوجدان مقيَّد قليلًا ومتوافق مع المزاج المذكور. الكلام طبيعي في معدله وحجمه. البصيرة سليمة، وقد راجع المريض تقييمه العام الأولي عند عرض بياناته عليه.",
      assessment:
        "انتكاسة اضطراب نوم مدفوع بالقلق في سياق ضاغط محدد ومحدود زمنيًا. متسقة مع الصياغة القائمة ولا تمثل عملية جديدة. الالتزام، لا الاستراتيجية، هو العامل المحدد. لم تُستخلص أو تُلاحَظ أي مؤشرات خطورة.",
      plan: "رفع هدف روتين ما قبل النوم إلى أربع ليالٍ قبل الجلسة القادمة، مع تسجيل مكتوب لليالي المنفَّذة. مواصلة العمل المعرفي على التقييم الكارثي لمراجعة الأداء. إعادة تقييم نمط النوم في الجلسة القادمة.",
    },
    summary:
      "جلسة متابعة تتناول انتكاسة أرق منتصف الليل لمدة أسبوع مرتبطة بقلق ترقّب متعلق بالعمل. الالتزام الجزئي بالتدخل الخاص بالنوم أنتج تحسنًا قابلًا للقياس لم ينتبه إليه المريض.",
    talkingPoints: [
      "عودة أرق منتصف الليل، الاستيقاظ قرابة الثالثة مع اجترار",
      "تقييم الأداء الوشيك بوصفه الضاغط المحدد",
      "الإرهاق والقلق يعملان كحلقة متبادلة",
      "روتين ما قبل النوم استُخدم ليلتين من سبع، وكانت الليلتان أفضل",
    ],
    observations:
      "متفاعل ومتعاون. استجاب جيدًا حين عُرضت عليه الفجوة بين النتيجة التي يرويها وبين بياناته الفعلية.",
    impressions:
      "متسق مع الصياغة القائمة لاضطراب نوم يديمه القلق. مبدئي، لمراجعة المعالج.",
    recommendations: [
      "رفع هدف روتين ما قبل النوم إلى أربع ليالٍ أسبوعيًا مع تسجيل مكتوب بسيط",
      "مواصلة إعادة البناء المعرفي حول تهويل مراجعة الأداء",
    ],
    followUp: "أسبوع واحد",
    patientBrief:
      "قعدنا النهاردة نتكلم عن الليالي اللي بتعدي عليك صعبة، وعن قد إيه اليوم بيروح وإنت مستعد للّي جاي. وصّفت ده بوضوح فعلًا.\n\nالحاجة اللي تستاهل تمسك فيها: الليلتين اللي عملت فيهم الروتين قبل النوم، نمت أحسن. إنت كنت حاسبهم صدفة لحد ما حطينهم جنب بعض.",
    patientSteps: [
      "الموبايل بعيد ساعة قبل النوم، أربع ليالي الأسبوع ده، واختار الليالي دلوقتي مش كل ليلة لوحدها.",
      "اصحى في نفس الميعاد حتى بعد ليلة وحشة. دي اللي بتعمل أكتر شغل وهي أكتر حاجة حاسس إنها ملهاش لازمة.",
      "اكتب تقريبًا نمت امتى وصحيت امتى. مش مفكرة، ميعادين بس.",
    ],
    patientNext:
      "نفس الميعاد الأسبوع الجاي، وهات معاك المواعيد اللي كتبتها. لو التقييم اتقدّم عن المتوقع والليالي تقلت، ابعتلي نقرّب الجلسة.",
  },
  copilot: [
    { kind: "اسأل", text: "ليلتين من سبع كانوا أحسن، تستاهل تتقال له." },
    { kind: "ملاحظة", text: "الإرهاق والقلق موصوفين كحلقة واحدة، مش مشكلتين." },
    { kind: "اسأل", text: "قالت على الروتين إنه «ملوش لازمة» في فبراير، ودلوقتي ماشية عليه." },
    { kind: "نمط", text: "تالت مرة يتذكر فيها التقييم في أربع جلسات." },
    { kind: "ملاحظة", text: "بتقول «دي طبيعة الشغل» لما الشغل ييجي في السيرة. نفس الجملة بتاعة ٢٠ فبراير." },
  ],
  copilotAsks: [
    {
      q: "هي جابت سيرة التقييم قبل كده؟",
      a: "تلات مرات في آخر أربع جلسات. يوم ٢٠ فبراير سمّته «الحكاية اللي في مارس» وعدّت عليها، ويوم ١٢ مارس بقت بتقول إنه السبب اللي بيصحّيها. والنمط إنه بييجي في آخر الجلسة، مش لما تسألي عن الشغل.",
      cites: [
        {
          on: "٢٠ فبراير",
          at: "31:04",
          who: "patient",
          quote: "في الحكاية اللي في مارس بس دي لسه بدري أوي، عادي.",
        },
        {
          on: "١٢ مارس",
          at: "08:20",
          who: "patient",
          quote: "بصحى الساعة تلاتة ودماغي تبتدي تلف على التقييم.",
        },
      ],
    },
    {
      q: "جرّبنا إيه للنوم؟",
      a: "حاجة واحدة: روتين التهدئة اللي اتفقتوا عليه يوم ٢٠ فبراير. ساعتها قالت عليه إنه ملوش لازمة. الالتزام طلع من صفر لليلتين من سبع، وفي الليلتين دول قالت إنها رجعت نامت أسرع. مفيش حاجة تانية اتجرّبت، يعني دي أول محاولة مش محاولة فشلت.",
      cites: [
        {
          on: "٢٠ فبراير",
          at: "44:12",
          who: "patient",
          quote: "هجرّب بس بصراحة شكله ملوش لازمة.",
        },
        {
          on: "١٢ مارس",
          at: "14:55",
          who: "patient",
          quote: "عملته مرتين. المرتين رجعت نمت أسرع، وده أنا أصلًا ما كنتش واخدة بالي منه.",
        },
      ],
    },
    {
      q: "في حاجة لازم أخد بالي منها النهارده؟",
      a: "مفيش أي مؤشر خطر اتسجّل في الجلسة دي ولا في الأربعة اللي قبلها. حاجة واحدة خدي بالك منها من غير ما تبني عليها: بتقفل لما الشغل يتقال بشكل مباشر، وبتتفتح لما ييجي من ناحية النوم. دي ملاحظة على جلستين، مش قاعدة.",
      cites: [
        {
          on: "٢٦ فبراير",
          at: "19:41",
          who: "therapist",
          quote: "ممكن نقعد شوية على موضوع الشغل؟",
        },
      ],
    },
  ],
  riskIndicator: "نفسي أموت",
};

/**
 * The demo copy for this reader's language, or the shipped default.
 *
 * Read through the same fallback chain as a page: exact locale, then English,
 * then the constant above. A missing Arabic row is an English demo, never an
 * empty panel.
 */
export async function getDemoContent(requested?: string): Promise<DemoContent> {
  /*
   * 🔴 Resolved before the try, so a caller that KNOWS the language is never
   * at the mercy of the runtime.
   *
   * `getLocale()` reads a cookie and throws **synchronously** outside a
   * request, which `.catch()` does not catch (19.0a learned this once
   * already), so every script-rendered page landed in the outer catch and got
   * the English constant. A caller that passes a locale now keeps it even when
   * the whole read fails.
   */
  const locale = requested ?? (await getLocale().catch(() => "en" as const));
  const floor = locale === "ar" ? DEMO_FALLBACK_AR : DEMO_FALLBACK;

  try {

    const rows = await db
      .select({ locale: contentPages.locale, blocks: contentPages.blocks })
      .from(contentPages)
      .where(
        and(
          eq(contentPages.slug, "demo"),
          eq(contentPages.status, "published"),
          inArray(contentPages.locale, locale === "en" ? ["en"] : [locale, "en"]),
        ),
      );

    const fallback = floor;

    const row = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === "en");
    if (!row) return fallback;

    return fromBlocks(row.blocks, fallback) ?? fallback;
  } catch {
    // The public site never fails because of the CMS. Same rule as defaults.ts.
    return floor;
  }
}

/**
 * A `demo` page's blocks, read as demo copy.
 *
 * Deliberately forgiving: a missing section falls back field by field rather
 * than dropping the whole row, because an admin editing one paragraph of the
 * transcript should not be able to blank the homepage.
 */
function fromBlocks(blocks: unknown, floor: DemoContent = DEMO_FALLBACK): DemoContent | null {
  if (!Array.isArray(blocks)) return null;

  const find = (heading: string) =>
    blocks.find(
      (b): b is { heading?: string; body?: string; items?: { title?: string; body?: string }[] } =>
        typeof b === "object" &&
        b !== null &&
        "heading" in b &&
        String((b as { heading?: string }).heading ?? "").toLowerCase() === heading,
    );

  const transcript = find("transcript");
  const brief = find("brief");
  const homework = find("homework");
  const observations = find("observations");
  const summary = find("summary");
  const journal = find("journal");

  return {
    transcript:
      transcript?.items?.map((item, i) => ({
        id: `cms-${i}`,
        // The convention is "who is speaking" in the item title. Anything that
        // is not the patient is the clinician — a demo line with no speaker
        // must never be attributed to the patient by accident.
        speaker: (item.title ?? "").toLowerCase().includes("patient")
          ? ("patient" as const)
          : ("therapist" as const),
        text: item.body ?? "",
      })) ?? floor.transcript,
    brief: brief?.body ?? floor.brief,
    steps: homework?.items?.map((item) => item.title ?? "") ?? floor.steps,
    observations:
      observations?.items?.map((item) => ({ at: item.title ?? "", text: item.body ?? "" })) ??
      floor.observations,
    homework:
      homework?.items?.map((item) => ({ title: item.title ?? "", detail: item.body ?? "" })) ??
      floor.homework,
    patientSessions: floor.patientSessions,
    /*
     * 🔴 76.32 — NOT CMS-EDITABLE, and that is the ruling rather than a gap.
     *
     * A SOAP note has a shape a clinician recognises and an admin typing into
     * a textarea can produce something that is not one. The three fields here
     * are the demonstration's clinical content, they are written in this file
     * with a reviewer's eye, and the CMS has no block type that could hold
     * them without inventing one. `patientSessions` has been read this way
     * since sprint 28 for the same reason.
     */
    note: floor.note,
    copilot: floor.copilot,
    /*
     * 🔴 76.70 — NOT CMS-EDITABLE either, for the same reason as the note.
     *
     * Each ask carries citations that have to line up with the transcript they
     * quote. An admin editing an answer through a textarea can make it say
     * something the quoted line does not support, which demonstrates the
     * product doing exactly what it is built to refuse to do.
     */
    copilotAsks: floor.copilotAsks,
    riskIndicator: floor.riskIndicator,
    /*
     * 28.6 — editable like every other demo, and field-by-field like every
     * other demo: an admin rewriting one version must not blank the panel.
     *
     * The version number is positional rather than typed by the editor, so a
     * demo of an append-only record cannot be made to show version 5 above
     * version 9, which would demonstrate the opposite of 26.1.
     */
    summaryVersions:
      summary?.items?.map((item, i) => ({
        version: (summary.items?.length ?? 0) - i,
        author: item.title ?? "",
        on: "",
        body: item.body ?? "",
      })) ?? floor.summaryVersions,
    journalEntries:
      journal?.items?.map((item) => ({ on: item.title ?? "", text: item.body ?? "" })) ??
      floor.journalEntries,
  };
}
