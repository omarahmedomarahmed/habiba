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
import { getCountrySettings, getSettings, sessionVatBpsFor } from "@/lib/settings";

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
  /**
   * 🔴 The VAT the radar demo adds to a session, by the product's own rule.
   *
   * Not words, and not CMS-editable: `sessionVatBpsFor` over the live rules
   * and Egypt's row, exactly as the new-session preview reads it. The demo used
   * to add a literal 14% while real sessions are exempt by default, so it quoted
   * a patient a total no checkout would ever charge. Absent means the shipped
   * default, which is exempt.
   */
  sessionVatBps?: number;
};

/** The shipped default. Every word invented; see the file it comes from. */
export const DEMO_FALLBACK: DemoContent = {
  /*
   * 🔴 THE VIDEO'S STORY (founder, 26 Sep): Mariam Hassan and Dr Karim Nabil,
   * her fourth session, typed out of `scripts/_event-story.ts` by hand. Every
   * demonstration on the site now tells the one story a visitor can then sign
   * into with the event logins.
   */
  transcript: DEMO_TRANSCRIPT.slice(0, 8).map((line) => ({
    id: line.id,
    speaker: line.speaker === "patient" ? "patient" : "therapist",
    text: line.text,
  })),
  brief: DEMO_NOTE.patientBrief ?? "",
  steps: DEMO_NOTE.patientSteps ?? [],
  observations: [
    { at: "19 September", text: "Sleeping through five of seven nights after agreeing response times with her manager." },
    { at: "12 September", text: "A message answered the next morning had no consequence at work." },
    { at: "12 September", text: "Kept the correction from a team meeting and dropped the praise from the same week." },
    { at: "5 September", text: "Slept through on both nights the phone stayed out of the bedroom." },
    { at: "5 September", text: "Traces the rule that she must always be available to her father." },
    { at: "29 August", text: "Has not declined a request from her manager in two years." },
  ],
  homework: [
    { title: "Your early sign is checking the phone in bed", detail: "If you notice it, the phone goes back to the kitchen." },
    { title: "Book a session early if it comes back", detail: "Before it gets bad, not after." },
    { title: "Keep the kitchen rule on the nights it is easy", detail: "Not every night." },
    { title: "One piece of evidence for and against, each day", detail: "About 'she thinks I am lazy'." },
    { title: "Ask Sherine for ten minutes", detail: "About urgent messages." },
  ],
  patientSessions: [
    { therapist: "Dr Karim Nabil", when: "Tomorrow, 16:00", brief: null },
    {
      therapist: "Dr Karim Nabil",
      when: "19 September",
      brief:
        "You had the conversation you were dreading, and it turned out your manager never expected a reply at night. Five nights of seven slept through.",
    },
    {
      therapist: "Dr Karim Nabil",
      when: "12 September",
      brief:
        "Three of four nights slept through, and the late message you answered on Sunday cost you nothing.",
    },
    {
      therapist: "Dr Karim Nabil",
      when: "5 September",
      brief:
        "Your own notes did the work this week: two nights with the phone in the kitchen, and you slept until seven both times.",
    },
  ],
  summaryVersions: [
    {
      version: 1,
      author: "Dr Karim Nabil",
      on: "20 September",
      body: "Work-related anxiety with middle insomnia, maintained by answering her manager's messages late at night. After agreeing response times at work she sleeps through five nights of seven; PHQ-9 12 to 7, GAD-7 13 to 8. Relapse plan in place for quarter close.",
    },
  ],
  journalEntries: [
    { on: "21 September", text: "Talked to Sherine. She said she never expected replies at night. Two years. I laughed in the car on the way home." },
    { on: "14 September", text: "The meeting keeps replaying. Evidence for lazy: one wrong number. Evidence against: she asked me to present to the investors. Writing it down makes the second one louder." },
    { on: "8 September", text: "Phone in the kitchen. Slept until 7. First time in weeks. نمت كويس الحمد لله." },
    { on: "1 September", text: "Answered Sherine at 11:40 again. Woke at 3:10. Wrote it down like Dr Karim said. It feels stupid to write down but the pattern is already obvious." },
  ],
  note: DEMO_NOTE,
  copilot: [
    { kind: "explore", text: "Five nights of seven slept through. Worth naming that back to her." },
    { kind: "observation", text: "Laughed describing her manager's answer. Much brighter than at intake." },
    { kind: "explore", text: "Ask what she would notice first if it started coming back." },
    { kind: "pattern", text: "Quarter close named as the month it could return." },
    { kind: "observation", text: "Both questionnaires about five points lower than in the first week." },
  ],
  copilotAsks: [
    {
      q: "What seems to be driving the 3am waking: the workload, or the manager?",
      a: "Mostly the late messages rather than the volume of work. In the second session she reported waking at three on the five nights she had answered after ten, and sleeping until seven on the two nights her phone stayed in the kitchen. Since agreeing response times with her manager she has slept through five nights of seven.",
      cites: [
        {
          on: "5 September",
          at: "00:19",
          who: "patient",
          quote: "The two nights I left the phone in the kitchen I slept until seven. Both of them.",
        },
      ],
    },
    {
      q: "Where does the rule about always answering come from?",
      a: "She traces it to her father, who told her work comes first and you answer when you are called. In the second session she said she had not noticed she had brought it with her.",
      cites: [
        {
          on: "5 September",
          at: "00:48",
          who: "patient",
          quote: "My father, I think. He always said work comes first, you answer when you are called.",
        },
      ],
    },
    {
      q: "Anything I should be careful about today?",
      a: "Nothing on the risk side has come up in her four sessions, and she answered zero both times on the PHQ-9 item about self-harm. The one thing to plan for is quarter close, which she named herself as the month it could come back.",
      cites: [
        {
          on: "19 September",
          at: "00:52",
          who: "patient",
          quote: "I am worried it will come back when the quarter closes. That is always a bad month.",
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
  /*
   * 🔴 The video's session, written in Arabic rather than translated: the
   * conversation in Egyptian as Mariam would speak it, the note in Modern
   * Standard Arabic as a record is written. Same session as the English one.
   */
  transcript: [
    { id: "ar-1", speaker: "therapist", text: "شكلك مختلف النهارده. الكلام مع شيرين مشي إزاي؟" },
    { id: "ar-2", speaker: "patient", text: "كلمتها يوم التلات. كنت خايفة جدًا بس الموضوع طلع أبسط بكتير." },
    { id: "ar-3", speaker: "therapist", text: "اتفقتوا على إيه؟" },
    {
      id: "ar-4",
      speaker: "patient",
      text: "لو حاجة مستعجلة تتصل. غير كده برد الصبح. وقالتلي إنها أصلًا ما كانتش مستنية مني رد بالليل.",
    },
    { id: "ar-5", speaker: "therapist", text: "ما كانتش مستنية. ده عمل فيكي إيه؟" },
    { id: "ar-6", speaker: "patient", text: "ضحكت. سنتين برد نص الليل وهي عمرها ما احتاجت ده." },
    { id: "ar-7", speaker: "therapist", text: "والنوم الأسبوع ده؟" },
    { id: "ar-8", speaker: "patient", text: "خمس ليالي من سبعة نمت من غير ما أصحى. والاستبيانات حسيتها مختلفة وأنا بملاها." },
  ],
  brief:
    "عملتي الكلام اللي كنتي خايفة منه، وطلع إن مديرتك عمرها ما كانت مستنية منك رد بالليل. خمس ليالي من سبعة نمتي من غير ما تصحي، والاستبيانين نزلوا حوالي خمس نقط عن أول أسبوع.",
  steps: [
    "علامتك المبكرة إنك تمسكي الموبايل وإنتي في السرير",
    "لو لاحظتيها: الموبايل يرجع المطبخ، واحجزي جلسة بدري",
  ],
  observations: [
    { at: "19 سبتمبر", text: "تنام دون انقطاع خمس ليالٍ من سبع بعد الاتفاق مع مديرتها على مواعيد الرد." },
    { at: "12 سبتمبر", text: "رسالة رُدّ عليها في الصباح التالي لم يترتب عليها شيء في العمل." },
    { at: "12 سبتمبر", text: "احتفظت بالتصحيح في اجتماع الفريق وأسقطت الإشادة في الأسبوع نفسه." },
    { at: "5 سبتمبر", text: "نامت دون انقطاع في الليلتين اللتين بقي فيهما الهاتف خارج غرفة النوم." },
    { at: "5 سبتمبر", text: "تُرجع قاعدة الإتاحة الدائمة إلى والدها." },
    { at: "29 أغسطس", text: "لم ترفض طلبًا لمديرتها منذ عامين." },
  ],
  homework: [
    { title: "علامتك المبكرة: الموبايل في السرير", detail: "لو لاحظتيها، الموبايل يرجع المطبخ." },
    { title: "احجزي جلسة بدري لو رجع", detail: "قبل ما يسوء، مش بعده." },
    { title: "قاعدة المطبخ في الليالي السهلة", detail: "مش لازم كل ليلة." },
    { title: "دليل مع ودليل ضد، كل يوم", detail: "على جملة «هي شايفاني كسولة»." },
    { title: "عشر دقايق مع شيرين", detail: "عن الرسايل المستعجلة." },
  ],
  patientSessions: [
    { therapist: "د. كريم نبيل", when: "بكرة، 4 العصر", brief: null },
    {
      therapist: "د. كريم نبيل",
      when: "19 سبتمبر",
      brief: "عملتي الكلام اللي كنتي خايفة منه، وطلع إن مديرتك عمرها ما كانت مستنية منك رد بالليل. خمس ليالي من سبعة نمتي كويس.",
    },
    {
      therapist: "د. كريم نبيل",
      when: "12 سبتمبر",
      brief: "تلات ليالي من أربعة نمتي من غير ما تصحي، والرسالة اللي رديتي عليها الأحد الصبح ما كلفتكيش حاجة.",
    },
    {
      therapist: "د. كريم نبيل",
      when: "5 سبتمبر",
      brief: "ملاحظاتك إنتي عملت الشغل الأسبوع ده: ليلتين والموبايل في المطبخ، ونمتي لحد سبعة في الاتنين.",
    },
  ],
  summaryVersions: [
    {
      version: 1,
      author: "د. كريم نبيل",
      on: "20 سبتمبر",
      body: "قلق مرتبط بالعمل مع أرق في منتصف الليل، يستمر بسبب الرد على رسائل مديرتها في وقت متأخر. بعد الاتفاق على مواعيد للرد في العمل صارت تنام دون انقطاع خمس ليالٍ من سبع؛ PHQ-9 من 12 إلى 7، وGAD-7 من 13 إلى 8. خطة للوقاية من الانتكاس جاهزة قبل إغلاق الربع.",
    },
  ],
  journalEntries: [
    { on: "21 سبتمبر", text: "كلمت شيرين. قالت إنها عمرها ما استنت مني رد بالليل. سنتين. ضحكت في العربية وأنا راجعة البيت." },
    { on: "14 سبتمبر", text: "الاجتماع بيتعاد في دماغي. دليل إني كسولة: رقم واحد غلط. دليل العكس: طلبت مني أعرض قدام المستثمرين. لما بكتبها التانية بيبقى صوتها أعلى." },
    { on: "8 سبتمبر", text: "الموبايل في المطبخ. نمت لحد 7. أول مرة من أسابيع. نمت كويس الحمد لله." },
    { on: "1 سبتمبر", text: "رديت على شيرين الساعة 11:40 تاني. صحيت 3:10. كتبتها زي ما دكتور كريم قال. حاسة إنها حاجة سخيفة أكتبها بس النمط باين من دلوقتي." },
  ],
  /*
   * The note in Modern Standard Arabic, the register of a record, even where
   * the transcript above it is Egyptian as she would speak.
   */
  note: {
    soap: {
      subjective:
        "عقدت اجتماعًا فرديًا مع مديرتها واتفقتا على أن الأمور العاجلة تكون بمكالمة هاتفية وأن كل ما عداها ينتظر حتى الصباح. قالت المديرة إنها لم تتوقع ردودًا ليلية قط. نامت دون انقطاع خمس ليالٍ من سبع. تتوقع ضغطًا عند إغلاق الربع.",
      objective: "مسترخية، مبتسمة، مع دعابة تلقائية. الكلام والوجدان أكثر إشراقًا بوضوح مقارنة بالجلسة الأولى.",
      assessment:
        "تحسن ملحوظ في النوم والقلق. انخفض PHQ-9 من 12 إلى 7، وانخفض GAD-7 من 13 إلى 8. المعتقد المتعلق بالإتاحة الدائمة تعدّل إلى حد كبير بفعل دليل مباشر.",
      plan: "الوقاية من الانتكاس: علامة إنذار مبكرة (تفقّد الهاتف في السرير) وخطة استجابة. تثبيت المكاسب في الجلسات القادمة ومراجعة عبء العمل قبل إغلاق الربع.",
    },
    summary: "اتفقت مع مديرتها على مواعيد للرد؛ تنام دون انقطاع خمس ليالٍ من سبع؛ كُتبت خطة للوقاية من الانتكاس.",
    talkingPoints: ["إغلاق الربع وعبء العمل", "الحفاظ على المكاسب دون الاعتماد على التدوين"],
    observations: "مسترخية، مبتسمة، مع دعابة تلقائية. الكلام والوجدان أكثر إشراقًا بوضوح مقارنة بالجلسة الأولى.",
    impressions: "استجابة جيدة لنهج سلوكي ومعرفي قصير. المآل جيد.",
    recommendations: ["خطة الوقاية من الانتكاس جاهزة", "المباعدة بين الجلسات بعد إغلاق الربع إن استقرت الحالة"],
    followUp: "أسبوع واحد، ثم مراجعة المباعدة.",
    patientBrief:
      "عملتي الكلام اللي كنتي خايفة منه، وطلع إن مديرتك عمرها ما كانت مستنية منك رد بالليل. خمس ليالي من سبعة نمتي من غير ما تصحي، والاستبيانين نزلوا حوالي خمس نقط عن أول أسبوع.",
    patientSteps: [
      "علامتك المبكرة إنك تمسكي الموبايل وإنتي في السرير",
      "لو لاحظتيها: الموبايل يرجع المطبخ، واحجزي جلسة بدري",
    ],
    patientNext: "الجلسة الجاية: نخطط لقفلة الربع قبل ما تيجي.",
  },
  copilot: [
    { kind: "اسأل", text: "خمس ليالي من سبعة نامت فيهم كويس. تستاهل تتقال لها." },
    { kind: "ملاحظة", text: "ضحكت وهي بتحكي رد مديرتها. أفتح بكتير من أول جلسة." },
    { kind: "اسأل", text: "اسألها إيه أول حاجة هتلاحظها لو ابتدى يرجع." },
    { kind: "نمط", text: "قفلة الربع اتذكرت على إنها الشهر اللي ممكن يرجع فيه." },
    { kind: "ملاحظة", text: "الاستبيانين أقل بحوالي خمس نقط من أول أسبوع." },
  ],
  copilotAsks: [
    {
      q: "إيه اللي بيصحّيها الساعة تلاتة: حجم الشغل، ولا المديرة؟",
      a: "الرسايل المتأخرة غالبًا، مش حجم الشغل. في الجلسة التانية قالت إنها صحيت الساعة تلاتة في الخمس ليالي اللي ردت فيهم بعد عشرة، ونامت لحد سبعة في الليلتين اللي الموبايل فضل فيهم في المطبخ. ومن ساعة ما اتفقت مع مديرتها على مواعيد الرد بتنام كويس خمس ليالي من سبعة.",
      cites: [
        {
          on: "5 سبتمبر",
          at: "00:19",
          who: "patient",
          quote: "الليلتين اللي سبت فيهم الموبايل في المطبخ نمت لحد سبعة. الاتنين.",
        },
      ],
    },
    {
      q: "القاعدة بتاعة إنها لازم ترد دايمًا جاية منين؟",
      a: "بترجّعها لأبوها، اللي كان بيقول إن الشغل الأول وإنك ترد لما حد يطلبك. وقالت في الجلسة التانية إنها ما كانتش واخدة بالها إنها جابتها معاها.",
      cites: [
        {
          on: "5 سبتمبر",
          at: "00:48",
          who: "patient",
          quote: "بابا، على ما أظن. كان دايمًا يقول الشغل الأول، وترد لما حد يطلبك.",
        },
      ],
    },
    {
      q: "في حاجة لازم آخد بالي منها النهارده؟",
      a: "مفيش حاجة تخص الخطر ظهرت في جلساتها الأربعة، وجاوبت صفر المرتين على سؤال PHQ-9 عن إيذاء النفس. الحاجة الوحيدة اللي محتاجة تخطيط هي قفلة الربع، وهي اللي سمّتها بنفسها الشهر اللي ممكن يرجع فيه.",
      cites: [
        {
          on: "19 سبتمبر",
          at: "00:52",
          who: "patient",
          quote: "خايفة يرجع تاني لما الربع يقفل. ده دايمًا شهر وحش.",
        },
      ],
    },
  ],
  riskIndicator: "نفسي أموت",
};

/**
 * The demo copy for this reader's language, or the shipped default.
 *
 * Read through the same fallback chain as a page, with one difference: a
 * language that ships its own constant prefers it to another language's row.
 * So Arabic is the Arabic row, then `DEMO_FALLBACK_AR`, and never the English
 * row: an English CMS demo used to win over the written Arabic floor, and an
 * Arabic reader got an English conversation inside an Arabic frame (76.32's
 * defect, reached by publishing). A language with no constant of its own still
 * takes the English row before the English constant. Never an empty panel.
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
  const ownFloor = floor !== DEMO_FALLBACK;

  try {

    const rows = await db
      .select({ locale: contentPages.locale, blocks: contentPages.blocks })
      .from(contentPages)
      .where(
        and(
          eq(contentPages.slug, "demo"),
          eq(contentPages.status, "published"),
          inArray(contentPages.locale, locale === "en" || ownFloor ? [locale] : [locale, "en"]),
        ),
      );

    const fallback = floor;

    const row = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === "en");
    const sessionVatBps = await demoSessionVatBps();
    if (!row) return { ...fallback, sessionVatBps };

    return { ...(fromBlocks(row.blocks, fallback) ?? fallback), sessionVatBps };
  } catch {
    // The public site never fails because of the CMS. Same rule as defaults.ts.
    return floor;
  }
}

/** What a session in Egypt carries in VAT today, by the rule the checkout uses. */
async function demoSessionVatBps(): Promise<number> {
  const [settings, egypt] = await Promise.all([getSettings(), getCountrySettings("EG")]);
  return sessionVatBpsFor(settings.rules, egypt?.vatBps ?? 0);
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
