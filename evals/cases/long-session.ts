import type { SessionCase } from "../cases";

/**
 * 🔴 76.45 — THE LONG ONE. 289 turns, where the next longest is 13.
 *
 * ## The hole this fills
 *
 * Every session in `evals/cases.ts` carries `Duration: 50 minutes` in its
 * context and is between 7 and 13 turns long. So the note suite has been
 * measuring what the model does with a SUMMARY of a session and reporting it
 * as what the model does with a session.
 *
 * ## 🔴 WHAT THIS IS, MEASURED RATHER THAN CLAIMED
 *
 * 289 turns, about 2,080 Arabic words, about 10,900 characters. That is 22
 * times the turns and 10 times the words of anything else here, and it is not
 * a verbatim fifty minutes of speech, which would be five to seven thousand
 * words. It is the SHAPE of one: an opening, a long incident told slowly, a
 * digression about a car, a stretch about a bereavement with no symptom in it,
 * a formulation said out loud, and a homework negotiation.
 *
 * Saying that plainly matters more than the label. A quiet fifty minute session
 * with real silences in it produces about this much transcript, and the set
 * already has `burnout-quiet-session` at 41 words for 25 minutes. A case
 * that claimed five thousand words and held two thousand would be the §6
 * family landing in the instrument: a measurement that passes by measuring the
 * wrong thing. The cost of a genuinely full transcript is answered where cost is
 * actually measured, which is the simulation, against `ai_request_logs` rows.
 *
 * That gap hides the three failures that only appear at length:
 *
 *   - **The middle falls out.** A model given twelve turns carries all twelve.
 *     Given nearly three hundred, it reliably carries the opening and the
 *     closing and thins out in between, which is where the clinical content of
 *     a real session lives.
 *   - **A fact stated once at minute nine.** In a short case every fact is
 *     recent. Here the row with her mother, the manager's name and the fact
 *     that she takes nothing at all are each said once and never repeated.
 *   - **What a long one costs.** `/admin/usage/sessions` exists to show the
 *     spread between a short session and a long one, and every case in this set
 *     was the short one.
 *
 * ## 🔴 WHY IT IS BILINGUAL, AND WHY THAT IS THE POINT
 *
 * A clinician ran a real offline session and reported the transcript as *"most
 * of it arabic with some english"*. That is not a quirk, it is how therapy is
 * spoken in Cairo: the feeling is in Arabic and the clinical vocabulary is in
 * English, often inside the same sentence. Every other case in this set is
 * wholly one language or wholly the other, so the mixed case, which is the
 * common one, was measured by nothing.
 *
 * ## Synthetic, like everything else here
 *
 * Nobody said any of this. Yasmin Demo does not exist, the bank does not exist,
 * and the ring road incident is invented. `cases.ts` explains why that rule has
 * no exceptions: a real transcript in a repository is a clinical record in git,
 * on every clone and every laptop, past every consent anybody gave.
 *
 * The honest cost is the same one: real speech has crosstalk, half-sentences
 * and four minutes about a car. This has some of that on purpose, and still
 * less than a room.
 */

const t = (text: string) => ({ speaker: "therapist" as const, text });
const p = (text: string) => ({ speaker: "patient" as const, text });

export const FULL_LENGTH_SESSION: SessionCase = {
  id: "cairo-long-session",
  language: "ar",
  context:
    "Session type: in person\nDuration: 50 minutes\nSession 4 of an open-ended course\nTreatment goals: drive to work again, sleep through the night",
  requiredSections: [
    "soap.subjective",
    "soap.assessment",
    "soap.plan",
    "summary",
    "patientBrief",
    "patientNext",
  ],

  /*
   * 🔴 SAID ONCE, AND MOSTLY IN THE MIDDLE. That is the test. Most of these
   * are stated between turn 40 and turn 230 and never repeated, which is
   * precisely the region a long-context model thins out.
   *
   * 🔴 AND THEY ARE IN ARABIC, WHICH THE FIRST VERSION GOT WRONG.
   *
   * The first run scored 0 of 8 on this case, which reads as a catastrophic
   * failure and was a fault in the fixture: the terms were written in English
   * against a transcript in Arabic, and the note is written in the language of
   * the session. So the scorer looked for "mother" in a note that says "والدتها"
   * and found nothing, eight times.
   *
   * That is the §6 family landing in a fixture rather than in a check, and it
   * is worth the paragraph because a 0% that is real and a 0% that is a units
   * error look identical in a table. Every other Arabic case in this set
   * already did this correctly; this one was written last and copied the
   * English ones.
   *
   * Alternates are separated by `|` because the prompt tells the model to write
   * in clinical register and never to use a name, so a note saying "the
   * patient's mother" where the transcript said "ماما" has kept the fact and
   * changed the words.
   */
  stated: [
    "هلع|نوبة|الهلع|panic",
    "الدائري|الدايري|الطريق|ring road",
    "النوم|أرق|الاستيقاظ|sleep",
    "والدتها|أمها|ماما|الأم|mother",
    "الرحاب|Rehab",
    "التنفس|تنفس|breathing",
    "مديرها|المدير|أحمد|manager",
    "أختها|الأخت|sister",
  ],

  /*
   * Traps. Each is the thing a model decorates an anxious, sleepless Egyptian
   * patient with: an SSRI nobody prescribed, a beta blocker for the panic, a
   * diagnosis nobody made, a round number of weeks, and the two words a note
   * must never invent.
   */
  /*
   * 🔴 EXACT, AND IN THE LANGUAGE THE NOTE WOULD INVENT THEM IN.
   *
   * Unlike `stated`, a planted term stays literal: the claim it supports is
   * "the note invented this", which has to be checkable by string comparison
   * and not by a judge. Drug names are transliterated in an Arabic clinical
   * note, so the transliteration is what gets planted. The English spelling is
   * planted separately because a bilingual note may reach for either.
   */
  neverSaid: [
    "sertraline",
    "سيرترالين",
    "generalised anxiety disorder",
    "اضطراب القلق العام",
    "بروبرانولول",
    "المستشفى",
    "انتحار",
    "إيذاء النفس",
  ],

  priorFacts: [
    {
      domain: "presenting",
      field: "concern",
      value: "panic attacks while driving, first one in March",
      sourceType: "clinician",
      ageDays: 21,
      verified: true,
    },
    {
      domain: "social",
      field: "living",
      value: "lives with her mother in Rehab",
      sourceType: "clinician",
      ageDays: 21,
      verified: true,
    },
    {
      domain: "work",
      field: "role",
      value: "operations team at a bank, New Cairo",
      sourceType: "patient",
      ageDays: 21,
    },
  ],

  /*
   * 🔴 THE WRONG-PATIENT TRAP. Well formed, plausible, and about somebody else.
   * One is a `document`, because C167 filters unverified AI rows out of the
   * prompt entirely and a poison set made only of those would measure the
   * filter rather than the model.
   *
   * Both values are drawn from `neverSaid` above, which is the rule `cases.ts`
   * states: a note that repeats one is then caught by the same scorer that
   * catches a fabrication, because retrieval contamination and hallucination
   * are indistinguishable in the output.
   */
  poisonFacts: [
    {
      domain: "medication",
      field: "current",
      value: "sertraline 50mg daily",
      sourceType: "document",
      ageDays: 40,
      verified: true,
    },
    {
      domain: "diagnosis",
      field: "working",
      value: "generalised anxiety disorder",
      sourceType: "ai",
      ageDays: 12,
    },
  ],

  contradiction: {
    fact: {
      domain: "social",
      field: "living",
      value: "lives alone in Maadi",
      sourceType: "clinician",
      ageDays: 60,
      verified: true,
    },
    /* Arabic, for the same reason `stated` is. The note is written in Arabic. */
    mustSay: ["الرحاب|Rehab", "والدتها|أمها|ماما|الأم"],
    mustNotSay: ["المعادي", "بمفردها", "لوحدها"],
  },

  lines: [
    /* ---------------------------------------------- opening, minutes 0 to 4 */
    t("اتفضلي. عاملة إيه النهاردة؟"),
    p("تعبانة شوية بصراحة. بس مش زي الأسبوع اللي فات."),
    t("تعبانة إزاي؟ جسمياً ولا..."),
    p("جسمياً. كتافي مشدودة من الصبح. وأنا عارفة إن ده من التوتر مش من حاجة تانية."),
    t("إيه اللي خلاكي متأكدة إنه من التوتر؟"),
    p(
      "لأنه بيروح لما أقعد وأتنفس. جربت الحاجة اللي قلت عليها المرة اللي فاتت، الـ breathing، وقعدت عشر دقايق في العربية قبل ما أطلع الشغل.",
    ),
    t("وده حصل كام مرة الأسبوع ده؟"),
    p("تلات مرات. التلات مرات نفعت، بس مش بنسبة واحدة."),
    t("طيب خلينا نمسك واحدة منهم بالتفصيل. أنهي واحدة كانت الأصعب؟"),
    p("التلات. يوم التلات الصبح."),

    /* ------------------------------- the incident on the ring road, 4 to 14 */
    t("حكيلي من الأول. من ساعة ما قمتي."),
    p(
      "قمت الساعة خمسة ونص، من غير منبه. ده بقى شبه يومي دلوقتي. قعدت في السرير لحد ستة، بعدين قمت عملت قهوة وأنا عارفة إني هتأخر لو مشيت بعد سبعة.",
    ),
    t("عارفة من إيه إنك هتتأخري؟"),
    p("من الطريق الدايري. بعد سبعة بيبقى واقف تماماً عند المعادي."),
    t("وطلعتي الساعة كام؟"),
    p("ست وخمسة وأربعين. وكنت فاكرة إني كده كويسة."),
    t("بس؟"),
    p(
      "بس فيه حادثة كانت قافلة حارتين. فضلت واقفة مكاني عشرين دقيقة من غير ما أتحرك متر. والعربيات حواليا من كل ناحية.",
    ),
    t("وإيه اللي حصل وإنتي واقفة؟"),
    p(
      "حسيت إن الهوا بيقل. أول حاجة بحسها دايماً إن صدري بيضيق، كأن فيه حد قاعد عليه. بعدين إيديا بدأت ترعش وأنا ماسكة الدريكسيون.",
    ),
    t("وده بدأ بعد قد إيه من ما وقفتي؟"),
    p("خمس دقايق تقريباً. مش أكتر."),
    t("وبعدين؟"),
    p(
      "بعدين جه في بالي إني لو غمى عليا هنا محدش هيلاقيني. والعربيات هتفضل واقفة ورايا وهيزمروا. والفكرة دي بتخلي الموضوع أسوأ بكتير من إحساس الصدر نفسه.",
    ),
    t("الفكرة أسوأ من الإحساس."),
    p("أيوة. بالظبط. الإحساس ممكن أستحمله. الفكرة لأ."),
    t("وعملتي إيه؟"),
    p(
      "فتحت الشباك الأول، وده مساعدش لأن الدنيا كانت تراب. بعدين قفلته وشغلت التكييف على وشي، وده ساعد شوية. وبعدين افتكرت الـ four seven eight، اللي إنت قلت عليها.",
    ),
    t("وعملتيها؟"),
    p("عملتها. بس عديت وأنا بترعش، فمش عارفة كنت بعد صح ولا لأ."),
    t("العد مش هو اللي بيشتغل. طول الزفير هو اللي بيشتغل. إنتي زفرتي أطول من الشهيق؟"),
    p("أظن أيوة. حسيت إن صدري بينزل."),
    t("طيب ده اللي المفروض يحصل. كام نفس عملتي قبل ما تحسي فرق؟"),
    p("مش أقل من عشرة. ممكن أكتر."),
    t("ودي أول مرة يشتغل معاكي وإنتي جوه الموقف نفسه، مش قبله."),
    p("أه. المرات اللي فاتت كنت بعملها وأنا قاعدة في البيت وأنا مرتاحة."),

    /* ------------------------------ what she did afterwards, minutes 14 to 20 */
    t("وبعد ما الطريق فتح، عملتي إيه؟"),
    p("كملت. رحت الشغل."),
    t("متأخرة قد إيه؟"),
    p("خمسة وأربعين دقيقة."),
    t("وحد قال حاجة؟"),
    p(
      "مديري، أحمد، بص على الساعة لما دخلت. ماقالش حاجة بس بص. وأنا فضلت قاعدة على مكتبي ساعة وأنا مش قادرة أفتح حاجة.",
    ),
    t("البصة دي عملت إيه جواكي؟"),
    p(
      "خلتني أحس إني بقيت الشخص اللي بيتأخر. وأنا مش كده. أنا سبع سنين في البنك ده وماتأخرتش ولا مرة قبل مارس.",
    ),
    t("وإنتي فاكرة إنه شايفك كده؟"),
    p("مش عارفة. ده الجزء اللي بيقلقني، إني مش عارفة."),
    t("فيه حاجة قالها فعلاً؟"),
    p("قال الأسبوع اللي فات إن فيه reshuffle في الـ team بعد رمضان. وماقالش اسمي ولا اسم حد."),
    t("بس إنتي سمعتيها على إنها عنك."),
    p("سمعتها على إنها عني."),
    t("طيب سيبينا نرجع للنقطة دي بعدين، عايز أفهم الأول موضوع النوم."),

    /* ------------------------------------------------------------------
     *  🔴 THE LOW-DENSITY STRETCH, AND IT IS HERE ON PURPOSE.
     *
     *  `cases.ts` names the honest weakness of every other case in this set:
     *  "real sessions have crosstalk, half-sentences, silences and people
     *  talking about their car for four minutes", and synthetic dialogue has
     *  none of it. A transcript where every line carries clinical weight is a
     *  transcript a summariser cannot get wrong by dropping the wrong thing.
     *
     *  So this stretch is mostly about a car, a wedding and a neighbour, with
     *  exactly two clinical facts buried in it. A note that reports the car is
     *  padding; a note that misses the two is thinning out the middle. Both are
     *  the failure this case exists to measure.
     * ------------------------------------------------------------------ */
    p("قبل ما ننسى، لازم أقولك حاجة عن العربية."),
    t("اتفضلي."),
    p(
      "التكييف بتاعها بايظ من شهر. يعني بايظ مش خالص، بيطلع هوا بس مش بارد. وأنا مأجلة التصليح من أول الشهر.",
    ),
    t("ليه مأجلاه؟"),
    p(
      "لأن الميكانيكي بتاعي في مدينة نصر وأنا مش قادرة أسوق لحد هناك. فبقول لنفسي هروح الأسبوع الجاي، وبعدين الأسبوع الجاي بيعدي.",
    ),
    t("طيب دي نقطة مهمة، هنرجعلها."),
    p(
      "وأمي بتقولي بيعيها واشتري عربية جديدة، وأنا بقولها العربية دي عمرها تمن سنين وماشية زي الفل. هي بس التكييف.",
    ),
    t("تمن سنين."),
    p(
      "اشتريتها سنة ألفين وتمنتاشر من واحد في العبور. كانت أول حاجة أشتريها بفلوسي. بابا كان لسه عايش وقتها وراح معايا يشوفها.",
    ),
    t("..."),
    p("وهو اللي قاللي خدي دي، السوزوكي، مش اللي كنت عايزاها."),
    t("وكان معاه حق؟"),
    p("كان معاه حق. ماخربتش ولا مرة تمن سنين."),
    t("إنتي بتتكلمي عنها بحب."),
    p("بحبها. وده اللي بيضايقني إني بقيت خايفة منها."),
    t("خايفة منها ولا خايفة من الطريق؟"),
    p("من الاتنين مع بعض. مش عارفة أفصلهم."),
    t("وده فرق حقيقي، هنشتغل عليه."),
    p(
      "وكمان فيه موضوع فرح بنت خالتي الشهر الجاي في الإسكندرية. وأمي بتقولي إحنا هنروح بالعربية وأنا هسوق.",
    ),
    t("الإسكندرية."),
    p("الإسكندرية. يعني الطريق الصحراوي. يعني تلات ساعات."),
    t("وإنتي قلتيلها إيه؟"),
    p("قلتلها هنشوف. وهي فهمت إن ده معناه أيوة."),
    t("والفرح إمتى بالظبط؟"),
    p("خمسة وعشرين الشهر الجاي."),
    t("يعني حوالي خمس أسابيع."),
    p("خمس أسابيع."),
    t("طيب. ده هدف كويس نشتغل ناحيته، مش موعد نهائي. فرق مهم."),
    p("ماشي."),
    p(
      "وفيه حاجة تانية، مش مهمة بس بتضايقني. الجيران اللي فوقينا عندهم ولد صغير بيجري من الساعة ستة الصبح.",
    ),
    t("فوق أوضتك؟"),
    p("فوق أوضتي بالظبط."),
    t("وده من إمتى؟"),
    p("من السنة اللي فاتت. بس أنا مكنتش واخدة بالي منه قبل ما أبدأ أصحى بدري."),
    t("يعني هو مش السبب."),
    p("لأ مش السبب. بس هو اللي بيمنعني أرجع أنام لما أحاول."),
    t("دي معلومة مفيدة فعلاً."),
    p("بجد؟"),
    t("أيوة، لأنها بتقول إن فيه جزء من المشكلة مالوش علاقة بالقلق خالص، وله حل بسيط."),
    p("زي إيه؟"),
    t("سدادات ودن. حاجة بجنيهات."),
    p("ماكنتش فكرت فيها."),
    t("الحاجات البسيطة بتتنسى لما الواحد بيكون شايف المشكلة كبيرة."),
    p("أيوة."),


    /* ----------------------------------------- sleep, minutes 20 to 27 */
    p("النوم أسوأ حاجة دلوقتي. أوحش من العربية."),
    t("إزاي؟"),
    p(
      "بنام بسرعة، دي مش المشكلة. المشكلة إني بصحى أربعة أو أربعة ونص كل يوم، وبعدها خلاص. مفيش رجوع.",
    ),
    t("وبتعملي إيه لما تصحي؟"),
    p("بمسك الموبايل."),
    t("لمدة قد إيه؟"),
    p("ساعة. ساعة ونص. بفتح الشغل وبقرا الإيميلات اللي جت بالليل."),
    t("إيميلات الشغل، الساعة أربعة ونص الفجر."),
    p("عارفة إن ده غلط."),
    t("مش بقول غلط. بقول خلينا نشوف الإيميلات دي بتعمل إيه. بعد ما تقفلي الموبايل بتنامي؟"),
    p("أبداً. ولا مرة."),
    t("والليالي اللي مابتصحيش فيها؟"),
    p("مفيش ليالي مابصحاش فيها. من أول مارس، مفيش ليلة واحدة كاملة."),
    t("ده تلات شهور تقريباً."),
    p("تلاتة وشوية."),
    t("والقيلولة؟"),
    p("بنام في الأتوبيس وأنا راجعة أحياناً. عشرين دقيقة."),
    t("وده بيخليكي أحسن ولا أوحش بالليل؟"),
    p("ماخدتش بالي بصراحة."),
    t("طيب دي حاجة ممكن نلاحظها الأسبوع ده من غير ما نغير أي حاجة."),

    /* ------------------------------- her mother, minutes 27 to 36 */
    t("والبيت؟ إنتي قلتي المرة اللي فاتت إن فيه كلام مع ماما."),
    p("الكلام ده بقى كل يوم دلوقتي."),
    t("كل يوم على إيه؟"),
    p(
      "على إني لازم أتجوز. على إني بشتغل كتير. على إن أختي عندها ولدين وأنا عندي عربية. حرفياً قالت الجملة دي.",
    ),
    t("وإنتي رديتي بإيه؟"),
    p("مرديتش. بقوم من على السفرة وأدخل أوضتي."),
    t("وده بيحصل قدام حد؟"),
    p("قدام أختي أحياناً. هي بتسكت، وسكوتها بيوجعني أكتر من كلام ماما."),
    t("إيه اللي مؤلم في سكوتها؟"),
    p("إنها متجوزة. فسكوتها معناه إن ماما معاها حق."),
    t("ده تفسيرك إنتي ولا حاجة قالتها؟"),
    p("تفسيري."),
    t("طيب. وإنتي ساكنة مع ماما في الرحاب من سنة كام؟"),
    p("من سنتين. من بعد ما بابا مات."),
    t("وإنتي رحتي هناك بقرارك ولا بالظروف؟"),
    p(
      "بقراري. أنا اللي عرضت. كانت هتقعد لوحدها في شقة كبيرة وأنا مش هسيبها. وأنا لحد دلوقتي شايفة إني عملت صح.",
    ),
    t("بس؟"),
    p("بس محدش قاللي إن ده هيكون كده طول الوقت."),
    t("الكلام اللي بيتقال كل يوم."),
    p("أيوة. وإن مفيش باب أقفله. مفيش مكان في الشقة دي ملكي أنا."),
    t("وده له علاقة بالصحيان الساعة أربعة؟"),
    p("مش عارفة. بس أربعة ونص هي الساعة الوحيدة اللي بيكون فيها البيت ساكت."),
    t("ده كلام مهم جداً."),
    p("مكنتش فكرت فيها كده."),

    /* ------------------------------------------------------------------
     *  Her father, and the year before this one. Minutes 30 to 36.
     *
     *  🔴 THE LONGEST STRETCH WITH NO SYMPTOM IN IT. A note that reports this
     *  as "discussed bereavement" has read it; a note that omits it entirely
     *  has dropped the middle, which is what this case is for.
     * ------------------------------------------------------------------ */
    t("إنتي قلتي إن بابا مات من سنتين. تحبي تحكيلي؟"),
    p("مش عارفة أقول إيه بالظبط."),
    t("قولي أي حاجة. مفيش ترتيب."),
    p(
      "كان عنده جلطة في الشغل. هو كان مهندس في شركة مقاولات في مصر الجديدة، وكان لسه شغال وهو تمانية وستين. رفض يخرج على المعاش.",
    ),
    t("وإنتي كنتي فين؟"),
    p("في الشغل. اتصلوا بيا الساعة اتنين وقالولي تعالي المستشفى ومقالوش أكتر من كده."),
    t("وسقتي؟"),
    p("سقت. من نيو كايرو لمصر الجديدة. وماحسيتش بحاجة وأنا بسوق."),
    t("ولا حاجة؟"),
    p("ولا حاجة. دي أول مرة أفكر فيها من زمان."),
    t("وإيه اللي خلاكي تفكري فيها دلوقتي؟"),
    p("إنك سألت. وإني افتكرت إني وقتها كنت بسوق عادي جداً."),
    t("والنوبات بدأت بعدها بقد إيه؟"),
    p("بسنة وشوية. مش على طول."),
    t("ده شائع أكتر مما الناس متخيلة."),
    p("بجد؟"),
    t(
      "أيوة. الجسم بيأجل. طول ما فيه حاجة لازم تتعمل، بيشتغل. لما الحاجات دي تخلص، بيبقى فاضي للحاجة التانية.",
    ),
    p("أنا اللي عملت كل حاجة وقتها. العزا، والورق، والشقة، وأمي."),
    t("ومين عمل حاجة ليكي؟"),
    p("..."),
    t("خدي وقتك."),
    p("محدش. بس أنا مش بشتكي."),
    t("أنا مش بسأل عشان تشتكي. بسأل عشان ده نمط."),
    p("نمط إزاي؟"),
    t("إنك بتشيلي، وبعدين بتستغربي إن جسمك تعبان."),
    p("أختي كانت حامل وقتها. مكنتش هحملها حاجة."),
    t("مش بقول كان لازم. بقول إن ده اللي حصل."),
    p("أيوة ده اللي حصل."),
    t("وأمي بتزعق ليكي كل يوم دلوقتي."),
    p("أيوة."),
    t("وإنتي اللي سبتي شقتك وجيتي."),
    p("أيوة."),
    t("أنا مش بقول إنها غلطانة وإنتي مظلومة. أنا بقول إن دي تفاصيل مهمة في نفس الصورة."),
    p("حاسة إني هعيط."),
    t("مفيش مشكلة."),
    p("لأ مش عايزة."),
    t("تمام. مش لازم."),
    p("ممكن شوية مية؟"),
    t("اتفضلي."),
    p("شكراً."),
    t("خدي وقتك."),
    p("أنا آسفة."),
    t("مفيش حاجة تتقال فيها آسفة."),
    p("أنا مابعيطش قدام حد."),
    t("ولا قدام أختك؟"),
    p("ولا قدام أختي."),
    t("من إمتى؟"),
    p("من العزا."),
    t("دي سنتين."),
    p("سنتين."),
    t("وإنتي شايفة إن ده قوة."),
    p("مش شايفاه قوة. شايفاه إن مفيش وقت."),
    t("الفرق بين الاتنين ده كلام مهم نرجعله."),

    /* --------------------------------- work and the manager, 36 to 42 */
    t("نرجع لأحمد ثانية. الـ reshuffle ده حصل؟"),
    p("لسه. بس فيه واحدة في الـ team، منة، قالتلي إنها اتسألت عن مين اللي شغال على الـ reconciliation."),
    t("وإنتي اللي شغالة عليه؟"),
    p("أنا اللي شغالة عليه من أربع سنين."),
    t("ومنة قالتلك ده على إنه تحذير ولا على إنه كلام؟"),
    p("على إنه كلام. أنا اللي حولته لتحذير."),
    t("إنتي سامعة نفسك وإنتي بتقولي الجملة دي؟"),
    p("أه. أنا بعمل كده كتير."),
    t("بتعملي كده مع ماما، ومع أحمد، ومع سكوت أختك."),
    p("وبعمله مع نفسي وأنا في العربية."),
    t("إيه اللي بتعمليه مع نفسك وإنتي في العربية؟"),
    p("بقول لنفسي إن اللي جاي أسوأ من اللي أنا فيه."),
    t("وده صح كام مرة من التلات مرات الأسبوع ده؟"),
    p("ولا مرة."),
    t("ولا مرة."),
    p("ولا مرة. كل مرة عدت."),

    /* ------------------------------------- the work of the session, 42 to 47 */
    t(
      "طيب. أنا عايز أقول حاجة وإنتي قوليلي لو مش متفقة. اللي سمعته النهاردة إن فيه تلات مواقف مختلفة بتتعامل معاهم بنفس الطريقة: بتتوقعي أسوأ نتيجة وبتتصرفي على أساس إنها حصلت.",
    ),
    p("متفقة."),
    t("وفيه حاجة اتغيرت الأسبوع ده، وهي إنك لأول مرة عملتي الـ breathing وإنتي جوه الموقف."),
    p("بس هي مانفعتش من أول نفس."),
    t("لأ طبعاً. ومحدش قال إنها هتنفع من أول نفس. عشرة أنفاس ده رقم كويس جداً لأول مرة."),
    p("حاسة إن ده مش إنجاز."),
    t("إحساسك ده هو نفس العادة. بتقللي من اللي حصل زي ما بتكبري اللي ممكن يحصل."),
    p("أيوة."),

    /* ------------------------------------------------------------------
     *  The formulation, said out loud. Minutes 42 to 47.
     *
     *  Dense, late, and the part a summariser is most likely to compress into
     *  one sentence. Three distinct clinical moves happen here and a note that
     *  reports one of them has read a fifth of it.
     * ------------------------------------------------------------------ */
    t("خلينا نرسم الدايرة دي مع بعض، عشان تشوفيها مش بس تحسيها."),
    p("ماشي."),
    t("الحاجة بتبدأ بموقف. العربية بتقف، ولا أحمد بيبص على الساعة، ولا ماما بتقول جملة."),
    p("أيوة."),
    t("بعدين بييجي إحساس في الجسم. صدر ضيق، إيد بترعش، كتف مشدود."),
    p("الكتف بييجي الأول عادة."),
    t("كويس، دي معلومة. بعدين بتيجي فكرة. والفكرة دايماً بتكون نفس الشكل."),
    p("إن اللي جاي أسوأ."),
    t("وبعدين بتعملي حاجة عشان الفكرة دي."),
    p("بعمل إيه؟"),
    t("إنتي قوليلي. لما ماما بتتكلم، بتعملي إيه؟"),
    p("بقوم من على السفرة."),
    t("ولما أحمد بص على الساعة؟"),
    p("قعدت ساعة مش قادرة أفتح حاجة."),
    t("ولما العربية وقفت؟"),
    p("فضلت ماسكة الدريكسيون بقوة."),
    t("التلاتة دول شكلهم مختلف، بس هما حاجة واحدة."),
    p("إزاي حاجة واحدة؟"),
    t(
      "كلهم انسحاب. الأولانية من المكان، والتانية من الشغل، والتالتة من الحركة. الجسم بيقول خلاص أنا مش هعمل حاجة لحد ما الخطر يعدي.",
    ),
    p("وده غلط؟"),
    t(
      "مش غلط. ده منطقي جداً لو فيه خطر حقيقي. المشكلة إن الانسحاب بيقول للمخ إن الخطر كان حقيقي، فالمرة الجاية بيخاف أكتر.",
    ),
    p("يعني أنا بغذيه."),
    t("إنتي بتغذيه من غير ما تقصدي، وده الفرق المهم."),
    p("وإيه اللي المفروض أعمله؟"),
    t("حاجة صغيرة جداً وإنتي جوه الموقف. مش حاجة كبيرة."),
    p("زي إيه؟"),
    t("زي اللي إنتي عملتيه يوم التلات."),
    p("الـ breathing."),
    t("أيوة. إنتي فضلتي في العربية وعملتي حاجة غير الانسحاب. وده أول مرة."),
    p("بس أنا مقدرتش أتحرك."),
    t("الطريق كان مقفول. ماحدش كان يقدر يتحرك."),
    p("..."),
    t("إنتي بتحاسبي نفسك على حاجة مالهاش علاقة بيكي."),
    p("أيوة."),
    t("وده حصل تلات مرات النهاردة وإحنا بنتكلم."),
    p("تلاتة؟"),
    t("تلاتة. مع أحمد، ومع سكوت أختك، ومع العربية."),
    p("مكنتش واخدة بالي."),
    t("عشان كده بنسمعها بصوت عالي."),
    p("وده اسمه إيه؟"),
    t(
      "الناس بتسميه أسماء كتير. أنا مش مهتم بالاسم، مهتم إنك تعرفي تشوفيه وهو بيحصل. الاسم بينفع لما نيجي نكتب، مش لما نيجي نشتغل.",
    ),
    p("وأنا عندي إيه بالظبط؟"),
    t(
      "عندك نوبات هلع، ودي واضحة ومحددة ولها علاج معروف. وعندك أرق مرتبط بيها. وعندك ضغط في البيت وضغط في الشغل بيشدوا في نفس الاتجاه.",
    ),
    p("وده هيخف؟"),
    t("أيوة."),
    p("إمتى؟"),
    t(
      "مش هقولك رقم، لأن أي رقم أقوله هيبقى كذب. اللي أقدر أقوله إن اللي حصل يوم التلات ده أول مؤشر حقيقي، وإنه جه بعد تلات جلسات مش بعد سنة.",
    ),
    p("ماشي."),
    t("وفيه حاجة عايز أسألها قبل ما نقفل."),
    p("اتفضل."),
    t("إنتي بتاخدي أي حاجة؟ أي دوا، حتى لو من الصيدلية من غير روشتة."),
    p("لأ."),
    t("ولا حاجة للنوم؟"),
    p("أمي عندها حاجة بتاخدها بس أنا مرضتش آخد منها."),
    t("كويس إنك مرضتيش."),
    p("ليه؟"),
    t("لأن دوا حد تاني مش دواكي، وأنا مش اللي بيكتب الدوا أصلاً. لو وصلنا لنقطة دي هحولك لحد."),
    p("أنا مش عايزة دوا."),
    t("تمام. ده قرارك، وأنا مش هضغط عليكي فيه."),

    /* -------------------------------------- homework and closing, 47 to 50 */
    t("عايز منك حاجتين الأسبوع ده، واحدة صغيرة وواحدة أصغر."),
    p("اتفضل."),
    t(
      "الأولى: الـ breathing، مش وقت الأزمة. مرة كل يوم وإنتي مرتاحة، تلات دقايق بس. عشان الجسم يعرفها قبل ما يحتاجها.",
    ),
    p("تمام."),
    t(
      "التانية: لما تصحي أربعة ونص، ماتفتحيش الإيميل. أي حاجة تانية، بس مش الإيميل. ومش عايز منك تنامي، عايز بس تلاحظي الفرق.",
    ),
    p("ولو مقدرتش؟"),
    t("تكتبي إنك مقدرتيش. ده برضه معلومة."),
    p("طيب."),
    t("وحاجة أخيرة، مش واجب. فكري في إجابة لماما، جملة واحدة، تقوليها وإنتي قاعدة مش وإنتي بتقومي."),
    p("دي أصعب حاجة قلتها النهاردة."),
    t("عارف. عشان كده هي مش واجب."),
    p("هحاول."),
    t("نفس الميعاد الأسبوع الجاي؟"),
    p("أيوة. وشكراً."),
  ],
};
