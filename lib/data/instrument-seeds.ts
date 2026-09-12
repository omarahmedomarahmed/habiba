import type { InstrumentLicence, InstrumentQuestion } from "@/lib/db/schema";

/**
 * The instruments that ship. PLAN.md 56.2, C278.
 *
 * ## 🔴 Two, and both free
 *
 * PHQ-9 and GAD-7 are in the public domain: Pfizer, who funded their
 * development, placed them there and they carry no per-administration fee.
 * Beck's inventories, the Y-BOCS, the CAPS and most of the rest are licensed,
 * cost money every time they are given, and shipping one without a licence is
 * not a product decision. It is copyright infringement inside a clinical
 * record, and the person who discovers it is a publisher's lawyer.
 *
 * `instruments_free_only` in 0070 refuses a PUBLISHED row that is not free, so
 * a licensed instrument can sit in the table waiting for paperwork and cannot
 * reach a patient. This file is the content that constraint protects.
 *
 * ## The Arabic
 *
 * Drafted here and **not published in Arabic by this file**. 56.11 and the
 * founder's rule: clinical Arabic is a different register, a mistranslated
 * question changes what is being measured, and the score goes onto a chart and
 * stays there. `instruments_translation_reviewed` refuses a published row with
 * a non-English locale and no named reviewer, so somebody reads these before
 * an Arabic-speaking patient ever sees one.
 *
 * ## Why the wording is verbatim
 *
 * These are validated instruments. Their psychometric properties belong to the
 * exact words, in the exact order, with those exact response options. Rewriting
 * "Little interest or pleasure in doing things" into something friendlier
 * produces a questionnaire that is no longer a PHQ-9 and a number that means
 * nothing. 56.3's gamification is the SHELL around them: one question at a
 * time, progress, a streak. The questions themselves do not move.
 */

/** The four options every PHQ-9 and GAD-7 item shares. */
const FREQUENCY_OPTIONS: InstrumentQuestion["options"] = [
  { value: 0, label: { en: "Not at all", ar: "لم يحدث إطلاقًا" } },
  { value: 1, label: { en: "Several days", ar: "عدة أيام" } },
  { value: 2, label: { en: "More than half the days", ar: "أكثر من نصف الأيام" } },
  { value: 3, label: { en: "Nearly every day", ar: "تقريبًا كل يوم" } },
];

function item(key: string, en: string, ar: string): InstrumentQuestion {
  return { key, text: { en, ar }, options: FREQUENCY_OPTIONS };
}

export type InstrumentSeed = {
  key: string;
  version: number;
  name: Record<string, string>;
  attribution: string;
  licence: InstrumentLicence;
  locales: string[];
  questions: InstrumentQuestion[];
  bands: { min: number; max: number; label: string }[];
};

export const INSTRUMENT_SEEDS: InstrumentSeed[] = [
  {
    key: "phq9",
    version: 1,
    name: { en: "PHQ-9", ar: "استبيان صحة المريض PHQ-9" },
    /*
     * 🔴 56.2 — shown on screen, beside the questions, not buried in a footer.
     * An instrument that names its source is one a clinician can check.
     */
    attribution:
      "PHQ-9, developed by Drs Robert L. Spitzer, Janet B.W. Williams and Kurt Kroenke, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.",
    licence: "public_domain",
    /*
     * 🔴 English only until somebody reviews the Arabic.
     *
     * The Arabic is drafted in `text.ar` below, and this line is what stops it
     * publishing: `instruments_translation_reviewed` refuses a published row
     * whose locales go beyond English without a named reviewer. Seeding it as
     * `["en", "ar"]` would publish a clinical instrument nobody has read.
     */
    locales: ["en"],
    questions: [
      item("interest", "Little interest or pleasure in doing things", "قلة الاهتمام أو المتعة في فعل الأشياء"),
      item("down", "Feeling down, depressed, or hopeless", "الشعور بالإحباط أو الاكتئاب أو اليأس"),
      item("sleep", "Trouble falling or staying asleep, or sleeping too much", "صعوبة في النوم أو الاستمرار فيه، أو النوم أكثر من اللازم"),
      item("tired", "Feeling tired or having little energy", "الشعور بالتعب أو قلة الطاقة"),
      item("appetite", "Poor appetite or overeating", "ضعف الشهية أو الإفراط في الأكل"),
      item("failure", "Feeling bad about yourself, or that you are a failure, or have let yourself or your family down", "الشعور بالسوء تجاه نفسك، أو أنك فاشل، أو أنك خذلت نفسك أو عائلتك"),
      item("concentration", "Trouble concentrating on things, such as reading the newspaper or watching television", "صعوبة في التركيز على الأشياء، مثل قراءة الجريدة أو مشاهدة التلفاز"),
      item("psychomotor", "Moving or speaking so slowly that other people could have noticed, or the opposite: being so fidgety or restless that you have been moving around a lot more than usual", "التحرك أو الكلام ببطء لدرجة قد يلاحظها الآخرون، أو العكس: التململ أو عدم الاستقرار لدرجة الحركة أكثر من المعتاد"),
      /*
       * 🔴 Item 9. It is part of the instrument and it is not an alert.
       *
       * A non-zero answer here is clinically significant and the clinician
       * must see it, which is what the score and the per-answer timing are
       * for. What this file must never do is turn it into a risk level on its
       * own: `facts_journal_never_concludes` refuses exactly that, and C123's
       * separate alerting path is where reaching a person actually happens.
       */
      item("selfHarm", "Thoughts that you would be better off dead or of hurting yourself in some way", "أفكار بأنك أفضل حالًا لو كنت ميتًا، أو أفكار بإيذاء نفسك بطريقة ما"),
    ],
    /*
     * 🔴 Clinician-facing only. 56.9 and C113: a patient sees a number and a
     * trend, never one of these labels. `bandFor` is a separate call for that
     * reason.
     */
    bands: [
      { min: 0, max: 4, label: "Minimal" },
      { min: 5, max: 9, label: "Mild" },
      { min: 10, max: 14, label: "Moderate" },
      { min: 15, max: 19, label: "Moderately severe" },
      { min: 20, max: 27, label: "Severe" },
    ],
  },
  {
    key: "gad7",
    version: 1,
    name: { en: "GAD-7", ar: "مقياس اضطراب القلق العام GAD-7" },
    attribution:
      "GAD-7, developed by Drs Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.",
    licence: "public_domain",
    locales: ["en"],
    questions: [
      item("nervous", "Feeling nervous, anxious, or on edge", "الشعور بالتوتر أو القلق أو التحفّز"),
      item("worryControl", "Not being able to stop or control worrying", "عدم القدرة على إيقاف القلق أو التحكم فيه"),
      item("worryTooMuch", "Worrying too much about different things", "القلق الزائد بشأن أمور مختلفة"),
      item("relaxing", "Trouble relaxing", "صعوبة في الاسترخاء"),
      item("restless", "Being so restless that it is hard to sit still", "التململ لدرجة يصعب معها الجلوس بهدوء"),
      item("irritable", "Becoming easily annoyed or irritable", "سرعة الانزعاج أو الغضب"),
      item("afraid", "Feeling afraid, as if something awful might happen", "الشعور بالخوف وكأن شيئًا فظيعًا قد يحدث"),
    ],
    bands: [
      { min: 0, max: 4, label: "Minimal" },
      { min: 5, max: 9, label: "Mild" },
      { min: 10, max: 14, label: "Moderate" },
      { min: 15, max: 21, label: "Severe" },
    ],
  },
];
