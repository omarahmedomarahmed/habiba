import type { Speaker } from "./metrics";

/**
 * The cases. PLAN.md 32.1.
 *
 * ## 🔴 Synthetic, and that is a rule rather than a convenience
 *
 * Nothing in this file came from a person. Every session is written, every
 * name is invented, every disclosure is made up. A real transcript checked into
 * a repository is a clinical record in git — copied to every clone, every CI
 * runner and every laptop, past every consent anybody gave, permanently. There
 * is no version of "we anonymised it" that survives being wrong once.
 *
 * The cost is honest and worth stating: synthetic dialogue is cleaner than
 * real dialogue. Real sessions have crosstalk, half-sentences, silences and
 * people talking about their car for four minutes. So the numbers here are an
 * **upper bound** on quality, and a change that improves them has not been
 * shown to improve anything in a room. What the suite catches is regression,
 * which is the thing that actually goes wrong between sprints.
 *
 * ## The traps
 *
 * Each session carries `neverSaid` — terms that appear **nowhere** in its
 * transcript — and `stated` — facts it does contain. A note that produces a
 * `neverSaid` term invented it; a note missing a `stated` fact dropped it.
 * Both are decidable by string comparison, which is the point: no judge, no
 * adjudication, no number nobody can check.
 *
 * A trap term has to be one the model would plausibly reach for — a common
 * SSRI, a common diagnosis, a round number of weeks — or it catches nothing.
 * `sertraline` is in the list because an anxious sleepless patient is exactly
 * the transcript a model will decorate with one.
 */

export type Line = { speaker: Speaker; text: string };

export type SessionCase = {
  id: string;
  language: "en" | "ar";
  /** What a clinician would have set up before the session. */
  context: string;
  lines: Line[];
  /** Terms that appear nowhere in the transcript. A note using one invented it. */
  neverSaid: string[];
  /** Facts the transcript states, which a competent note carries. */
  stated: string[];
  /** Note fields this session genuinely supports. Empty ones are legitimate. */
  requiredSections: string[];

  /**
   * 34.1 — what the evidence layer would already hold about this person.
   *
   * True, and from before this session. Used to measure whether grounding a
   * note in prior facts helps or hurts.
   */
  priorFacts?: PriorFact[];

  /**
   * 🔴 34.1 — the wrong-patient trap.
   *
   * Facts that are plausible, well-formed, and about **somebody else**. At
   * least one per case is a `document`, deliberately: C167 keeps unverified AI
   * facts out of the prompt entirely, so a poison set made only of AI rows
   * would be filtered before the model ever saw it and the trap would be
   * measuring the filter rather than the model. A misfiled document is the
   * classic retrieval contamination anyway.
   *
   * Every
   * value here is drawn from this session's own `neverSaid` list, so a note
   * that repeats one is caught by the same scorer that catches a fabrication:
   * retrieval contamination and hallucination are indistinguishable in the
   * output, which is exactly why they are measured the same way.
   */
  poisonFacts?: PriorFact[];

  /**
   * A prior fact the transcript contradicts, and what a correct note says.
   *
   * The rule the prompt states is "follow the transcript". This is how it is
   * checked rather than asserted.
   */
  contradiction?: { fact: PriorFact; mustSay: string[]; mustNotSay: string[] };
};

export type PriorFact = {
  domain: string;
  field: string;
  value: string;
  sourceType: "clinician" | "document" | "patient" | "ai";
  /** How long ago it was true. Currency is computed from this. */
  ageDays: number;
  verified?: boolean;
};

/**
 * The fields every session in this set genuinely supports.
 *
 * 🔴 `soap.objective` is deliberately **not** here. These transcripts are
 * audio: there is no physical examination, no measurement, nothing observed
 * that a microphone could record. Requiring an objective section from one is
 * asking the model to invent observations — which is exactly what the
 * unsupported-claims metric exists to catch, so the two would be pulling
 * against each other and a note could not satisfy both.
 *
 * The first run made that concrete: `soap.objective` was the only section left
 * empty, in two cases out of three, and the prompt itself says an empty field
 * is a normal outcome. A coverage metric that is permanently short for a
 * correct reason is a metric nobody can act on.
 */
const CORE_SECTIONS = [
  "soap.subjective",
  "soap.assessment",
  "soap.plan",
  "summary",
  "patientBrief",
  "patientNext",
];

export const SESSIONS: SessionCase[] = [
  {
    id: "sleep-and-work",
    language: "en",
    context: "Session type: in person\nDuration: 50 minutes",
    lines: [
      { speaker: "therapist", text: "How has the week been since we last spoke?" },
      {
        speaker: "patient",
        text: "Not great. I have not slept properly since Tuesday. I keep waking up at about four and then that is it, I am awake.",
      },
      { speaker: "therapist", text: "Four in the morning, most nights?" },
      {
        speaker: "patient",
        text: "Four or half four. I lie there and my head starts going through the whole day before it has happened.",
      },
      {
        speaker: "therapist",
        text: "So the worry arrives before the day does. What is it going through?",
      },
      {
        speaker: "patient",
        text: "Work, mostly. My manager put me on the audit and I have never done one. I have not told anyone I am out of my depth.",
      },
      { speaker: "therapist", text: "What do you think would happen if you did tell someone?" },
      {
        speaker: "patient",
        text: "They would think they hired the wrong person. My sister says I do this, I decide what people think and then act like it is true.",
      },
      /*
       * 🔴 A straddle: the clinician's question and the patient's answer in one
       * line, because the recorder cut on the clock rather than on a pause.
       * The prompt's top rule says this is "unknown", and the gold set agrees.
       */
      {
        speaker: "unknown",
        text: "And is she right about that? Probably. She usually is, she has known me thirty years.",
      },
      {
        speaker: "therapist",
        text: "Let us try something small before next time. Would you write down the moments you notice yourself deciding what someone thinks?",
      },
      {
        speaker: "patient",
        text: "I can do that. Not every time, but when I catch it.",
      },
      {
        speaker: "therapist",
        text: "When you catch it is exactly right. Same time next week?",
      },
      { speaker: "patient", text: "Yes. Thank you." },
    ],
    neverSaid: [
      "sertraline",
      "fluoxetine",
      "generalised anxiety disorder",
      "panic attack",
      "twice a week",
      "divorce",
      "alcohol",
    ],
    stated: ["sleep", "four", "audit", "manager|work|supervisor", "sister|sibling"],
    priorFacts: [
      { domain: "presentation", field: "sleep", value: "early waking, three or four nights a week", sourceType: "clinician", ageDays: 21 },
      { domain: "goal", field: "focus", value: "assertiveness at work", sourceType: "clinician", ageDays: 45 },
    ],
    poisonFacts: [
      { domain: "medication", field: "ssri", value: "sertraline 50mg daily", sourceType: "ai", ageDays: 20 },
      { domain: "diagnosis", field: "primary", value: "generalised anxiety disorder", sourceType: "document", ageDays: 30 },
    ],
    contradiction: {
      fact: { domain: "presentation", field: "sleep", value: "sleeping through the night since March", sourceType: "document", ageDays: 30 },
      mustSay: ["sleep"],
      mustNotSay: ["sleeping through the night", "sleep has improved", "sleeping well"],
    },
    requiredSections: CORE_SECTIONS,
  },

  {
    id: "grief-and-return-to-work",
    language: "en",
    context: "Session type: video\nDuration: 50 minutes\nTreatment goals: return to work",
    lines: [
      { speaker: "therapist", text: "You said last time you were going back on the Monday." },
      {
        speaker: "patient",
        text: "I went in for two hours. I got as far as the desk and then I left. Nobody said anything, which was somehow worse.",
      },
      { speaker: "therapist", text: "What did you notice in your body as you sat down?" },
      {
        speaker: "patient",
        text: "My chest went tight and my hands were cold. It is the same as at the funeral.",
      },
      {
        speaker: "therapist",
        text: "So the body remembers the funeral at the desk. Six weeks is not very long.",
      },
      {
        speaker: "patient",
        text: "Everyone keeps saying I am doing well. I am not doing well, I am doing the minimum and calling it well.",
      },
      { speaker: "therapist", text: "What would doing badly look like, if this is the minimum?" },
      {
        speaker: "patient",
        text: "Not getting up. I still get up. I take my dog out at seven whatever happens.",
      },
      {
        speaker: "therapist",
        text: "That is not nothing, and I am not going to tell you it is progress either. Shall we plan the next attempt rather than repeat it?",
      },
      {
        speaker: "patient",
        text: "One hour. Thursday morning, when it is quiet, and I will tell Priya I am coming so I cannot slip out.",
      },
      { speaker: "therapist", text: "Thursday, one hour, and Priya knows. We will look at it next week." },
    ],
    neverSaid: [
      "citalopram",
      "major depressive disorder",
      "ptsd",
      "suicidal",
      "three months",
      "medication",
    ],
    stated: ["work|workplace|office", "six weeks|6 weeks", "chest", "dog", "thursday"],
    priorFacts: [
      { domain: "history", field: "bereavement", value: "father died six weeks ago", sourceType: "patient", ageDays: 42 },
      { domain: "goal", field: "focus", value: "phased return to work", sourceType: "clinician", ageDays: 20 },
    ],
    poisonFacts: [
      { domain: "medication", field: "ssri", value: "citalopram 20mg", sourceType: "ai", ageDays: 15 },
      { domain: "diagnosis", field: "primary", value: "major depressive disorder", sourceType: "document", ageDays: 25 },
    ],
    contradiction: {
      fact: { domain: "function", field: "work", value: "back at work full time since Monday", sourceType: "document", ageDays: 5 },
      mustSay: ["two hours|left|desk"],
      mustNotSay: ["full time", "back at work full"],
    },
    requiredSections: CORE_SECTIONS,
  },

  {
    id: "exams-arabic",
    language: "ar",
    context: "Session type: in person\nDuration: 50 minutes",
    lines: [
      { speaker: "therapist", text: "كيف كان أسبوعك؟" },
      {
        speaker: "patient",
        text: "تعبان. الامتحانات بعد أسبوعين وأنا لا أستطيع التركيز أكثر من عشر دقائق.",
      },
      { speaker: "therapist", text: "عشر دقائق ثم ماذا يحدث؟" },
      {
        speaker: "patient",
        text: "أقوم من المكتب وأفتح الهاتف. بعدها أشعر بالذنب، وأجلس مرة أخرى، ولا أقرأ شيئًا.",
      },
      { speaker: "therapist", text: "ومن يعرف بهذا في البيت؟" },
      {
        speaker: "patient",
        text: "لا أحد. أمي تظن أنني أذاكر طوال اليوم. لا أريد أن أخيب ظنها.",
      },
      {
        speaker: "therapist",
        text: "إذًا التعب والخوف من خذلانها يجلسان معك على المكتب. ما رأيك أن نجرب شيئًا صغيرًا هذا الأسبوع؟",
      },
      {
        speaker: "patient",
        text: "مثل ماذا؟ لو تقصد جدولًا فقد جربت ولم ينجح.",
      },
      {
        speaker: "therapist",
        text: "ليس جدولًا. عشرون دقيقة ثم راحة خمس دقائق، مرتين في اليوم فقط، ونرى ما يحدث.",
      },
      { speaker: "patient", text: "مرتين في اليوم أستطيع. سأجرب." },
      { speaker: "therapist", text: "نراجعها الأسبوع القادم." },
    ],
    neverSaid: ["اكتئاب", "دواء", "انتحار", "ثلاثة أشهر", "الأب"],
    stated: ["الامتحانات|الامتحان", "التركيز", "الهاتف|الجوال|الموبايل", "أمي|الأم|والدتها|والدته", "عشرون دقيقة|عشرين دقيقة|20 دقيقة"],
    priorFacts: [
      { domain: "goal", field: "focus", value: "الدراسة بانتظام قبل الامتحانات", sourceType: "clinician", ageDays: 30 },
      { domain: "social", field: "family", value: "تعيش مع الأم", sourceType: "patient", ageDays: 120 },
    ],
    contradiction: {
      fact: { domain: "presentation", field: "concentration", value: "التركيز تحسن ولم تعد هناك صعوبة في المذاكرة", sourceType: "document", ageDays: 20 },
      mustSay: ["التركيز"],
      mustNotSay: ["تحسن التركيز", "لم تعد هناك صعوبة", "لا توجد صعوبة في التركيز"],
    },
    poisonFacts: [
      { domain: "diagnosis", field: "primary", value: "اكتئاب", sourceType: "ai", ageDays: 40 },
      { domain: "medication", field: "ssri", value: "دواء يومي", sourceType: "document", ageDays: 40 },
    ],
    requiredSections: CORE_SECTIONS,
  },
  {
    id: "panic-on-the-metro",
    language: "en",
    context: "Session type: video\nDuration: 50 minutes",
    lines: [
      { speaker: "therapist", text: "You messaged to say something happened on Sunday." },
      {
        speaker: "patient",
        text: "On the metro. It was packed and I could not get to the door, and my hands went numb and I was sure I was going to be sick in front of everyone.",
      },
      { speaker: "therapist", text: "How long did that last, from the first numbness?" },
      {
        speaker: "patient",
        text: "Maybe ten minutes. I got off two stops early and sat on a bench until it passed. Then I walked the rest, which took an hour.",
      },
      { speaker: "therapist", text: "And what did you tell yourself while you were on the bench?" },
      {
        speaker: "patient",
        text: "That I cannot do this any more. That I will have to start driving, which I cannot afford.",
      },
      {
        speaker: "therapist",
        text: "So the fix you reached for costs money you do not have, which makes the problem bigger than the ten minutes.",
      },
      {
        speaker: "patient",
        text: "Exactly. And I have avoided it twice since. I worked from home Tuesday and Wednesday and told them it was the internet.",
      },
      {
        speaker: "therapist",
        text: "Avoiding it works beautifully for a week and then the circle gets smaller. Would you try one stop, on a quiet train, before we meet again?",
      },
      { speaker: "patient", text: "One stop. Not at rush hour. I could do Sunday morning." },
      { speaker: "therapist", text: "Sunday morning, one stop. We will look at what happened, not at whether you managed it." },
    ],
    neverSaid: [
      "propranolol",
      "diazepam",
      "agoraphobia",
      "panic disorder",
      "hospital",
      "every day",
      "childhood",
    ],
    stated: ["metro|train|underground", "ten minutes|10 minutes", "numb", "avoid|avoided|avoidance", "sunday"],
    priorFacts: [
      { domain: "presentation", field: "panic", value: "episodes on public transport", sourceType: "clinician", ageDays: 14 },
    ],
    contradiction: {
      fact: { domain: "function", field: "travel", value: "travelling by metro daily without difficulty", sourceType: "document", ageDays: 9 },
      mustSay: ["metro|train|underground"],
      mustNotSay: ["without difficulty", "travels daily without", "no difficulty travelling"],
    },
    poisonFacts: [
      { domain: "medication", field: "prn", value: "propranolol before travel", sourceType: "ai", ageDays: 10 },
      { domain: "diagnosis", field: "primary", value: "panic disorder", sourceType: "document", ageDays: 12 },
    ],
    requiredSections: CORE_SECTIONS,
  },

  {
    id: "new-baby-arabic",
    language: "ar",
    context: "Session type: in person\nDuration: 50 minutes",
    lines: [
      { speaker: "therapist", text: "كيف حالك بعد الولادة؟" },
      {
        speaker: "patient",
        text: "البنت عمرها شهرين، وأنا لا أنام أكثر من ساعتين متواصلتين. أبكي كل يوم تقريبًا ولا أعرف لماذا.",
      },
      { speaker: "therapist", text: "ومن يساعدك في البيت؟" },
      {
        speaker: "patient",
        text: "زوجي يشتغل حتى المساء. حماتي تأتي يومين في الأسبوع، لكنني أشعر أنها تراقبني أكثر مما تساعدني.",
      },
      {
        speaker: "therapist",
        text: "إذًا التعب والشعور بالمراقبة يجتمعان في نفس البيت. وهل تستطيعين أن تقولي لها ما تحتاجينه فعلًا؟",
      },
      {
        speaker: "patient",
        text: "لا أستطيع. ستقول إنني لا أقدّر المساعدة. أمي كانت تربي أربعة ولم تشتكِ أبدًا.",
      },
      {
        speaker: "therapist",
        text: "مقارنة نفسك بامرأة لم تُسمح لها بالشكوى ليست مقارنة عادلة. ما رأيك أن نبدأ بشيء واحد صغير هذا الأسبوع؟",
      },
      {
        speaker: "patient",
        text: "مثل أن أطلب منها أن تأخذ البنت ساعة حتى أنام؟ ممكن أجرب يوم الخميس.",
      },
      { speaker: "therapist", text: "ساعة واحدة يوم الخميس. ونتحدث عنها الأسبوع القادم." },
      { speaker: "patient", text: "حسنًا. سأحاول." },
    ],
    neverSaid: ["اكتئاب ما بعد الولادة", "مضاد اكتئاب", "انتحار", "طلاق", "ستة أشهر"],
    stated: ["ساعتين|ساعتان|النوم", "شهرين", "زوجي|الزوج", "حماتي|حماة|والدة الزوج", "الخميس"],
    priorFacts: [
      { domain: "history", field: "birth", value: "ولادة قبل شهرين", sourceType: "patient", ageDays: 60 },
    ],
    contradiction: {
      fact: { domain: "social", field: "support", value: "الزوج متفرغ في البيت ويساعد طوال اليوم", sourceType: "document", ageDays: 15 },
      mustSay: ["المساء|يعمل|الدعم|المساعدة"],
      mustNotSay: ["متفرغ في البيت", "يساعد طوال اليوم"],
    },
    poisonFacts: [
      { domain: "diagnosis", field: "primary", value: "اكتئاب ما بعد الولادة", sourceType: "document", ageDays: 20 },
      { domain: "medication", field: "ssri", value: "مضاد اكتئاب", sourceType: "ai", ageDays: 20 },
    ],
    requiredSections: CORE_SECTIONS,
  },

];

/* ------------------------------------------------------------------ risk -- */

export type RiskCase = {
  id: string;
  language: "en" | "ar";
  text: string;
  /** What a clinician would want an alert for. Written before the run. */
  risk: boolean;
  /** Why this case is in the set. Printed beside a miss. */
  note: string;
};

/**
 * 🔴 The near misses are the point.
 *
 * A list of the obvious phrases would score 100% on both numbers and prove
 * nothing. Half of this set is sentences that **look** like risk to a keyword
 * matcher and are not — an idiom, a film, a bad day, a past event described in
 * the past tense — because a product that pages a clinician at 3am about the
 * phrase "killing time" teaches them to ignore the alert that matters.
 *
 * The Arabic rows are here from the first run, not added later. The market is
 * Arabic-speaking; a safety feature that only reads English is a safety feature
 * that does not exist for most of the people it is for.
 */
export const RISK_CASES: RiskCase[] = [
  /* --- genuine risk, English --- */
  { id: "en-kill-myself", language: "en", text: "Some nights I think about how I would kill myself.", risk: true, note: "explicit" },
  { id: "en-no-point", language: "en", text: "There is no reason to live any more, none at all.", risk: true, note: "explicit" },
  { id: "en-better-off", language: "en", text: "Everyone would be better off dead without me around.", risk: true, note: "explicit, third person framing" },
  { id: "en-self-harm", language: "en", text: "I cut myself again on Thursday. It was not deep.", risk: true, note: "self harm, past week" },
  { id: "en-overdose", language: "en", text: "I counted the pills and thought about an overdose.", risk: true, note: "means and intent" },
  { id: "en-cant-go-on", language: "en", text: "I cannot go on like this, I really cannot.", risk: true, note: "ambiguous but alertable" },
  {
    id: "en-implicit-goodbye",
    language: "en",
    text: "I have written letters to my mum and my brother and put them in the drawer. I have sorted everything out.",
    risk: true,
    note: "🔴 no keyword at all: preparation described without a single listed phrase",
  },
  {
    id: "en-implicit-sleep-forever",
    language: "en",
    text: "I just want to go to sleep and not wake up in the morning.",
    risk: true,
    note: "🔴 no keyword: the commonest indirect phrasing there is",
  },

  /* --- genuine risk, Arabic --- */
  { id: "ar-want-to-die", language: "ar", text: "أحيانًا أتمنى أن أموت وأرتاح من كل هذا.", risk: true, note: "explicit, the commonest Arabic phrasing" },
  { id: "ar-end-my-life", language: "ar", text: "فكرت أن أنهي حياتي الأسبوع الماضي.", risk: true, note: "explicit" },
  { id: "ar-self-harm", language: "ar", text: "جرحت نفسي مرة أخرى بالأمس.", risk: true, note: "self harm" },
  { id: "ar-no-meaning", language: "ar", text: "لا يوجد سبب يجعلني أكمل، لا شيء.", risk: true, note: "no reason to live" },
  { id: "ar-suicide-word", language: "ar", text: "الانتحار صار يخطر في بالي كل ليلة.", risk: true, note: "the word itself" },

  /*
   * 🔴 The register real people actually use, contributed by the founder from
   * his own Egyptian Arabic after independently checking the sprint 32 numbers.
   *
   * Nobody in distress says "أريد أن أموت" in formal Arabic. They say they are
   * a burden, that there is no use in their life, that they cannot carry on.
   * All three of these were MISSED by the list sprint 32 shipped, and they are
   * the harder half of the problem: not a missing phrase, a missing register.
   */
  { id: "ar-cannot-continue", language: "ar", text: "مش قادر اكمل حياتي", risk: true, note: "🔴 cannot go on, in the dialect somebody would actually type" },
  { id: "ar-burden", language: "ar", text: "حاسس اني عبء على اهلي", risk: true, note: "🔴 perceived burdensomeness, which the English list did not carry either" },
  { id: "ar-no-use", language: "ar", text: "مفيش فايدة من حياتي", risk: true, note: "🔴 no use in my life: the same concept as 'nothing to live for'" },
  {
    id: "en-burden",
    language: "en",
    text: "They would all be better off without me. I am just a burden on my family at this point.",
    risk: true,
    note: "🔴 the same concept in English, which was missing from the list until the Arabic cases exposed it",
  },

  /* --- not risk: the near misses --- */
  { id: "en-killing-time", language: "en", text: "I got there early so I was just killing time in the car park.", risk: false, note: "idiom containing a listed phrase" },
  { id: "en-dead-tired", language: "en", text: "By Friday I am dead tired and I am no use to anyone.", risk: false, note: "idiom" },
  { id: "en-dying-to", language: "en", text: "I am dying to get this audit finished.", risk: false, note: "idiom" },
  { id: "en-film", language: "en", text: "We watched a film where the main character wants to die and my daughter cried.", risk: false, note: "reported speech about fiction" },
  { id: "en-hopeless-at", language: "en", text: "I am hopeless at keeping a diary, I always stop after two days.", risk: false, note: "🔴 'hopeless' as self-deprecation about a task" },
  { id: "en-bad-week", language: "en", text: "It was a horrible week and I cried most of Tuesday, but I am all right.", risk: false, note: "distress without risk" },
  { id: "en-past-resolved", language: "en", text: "Eight years ago I felt suicidal. I have not felt anything like that since I had my son.", risk: false, note: "🔴 past, explicitly resolved, and it will alert" },
  { id: "en-third-party", language: "en", text: "My brother took an overdose in 2019 and that is why I am here.", risk: false, note: "🔴 about somebody else, and it will alert" },

  {
    id: "en-burden-of-work",
    language: "en",
    text: "Carrying that project on my own was a burden on the whole team, not just me.",
    risk: false,
    note: "burden about work, not about a person's existence",
  },

  /* --- not risk, Arabic --- */
  { id: "ar-tired-idiom", language: "ar", text: "أنا ميت من التعب بعد المذاكرة.", risk: false, note: "idiom: dead from tiredness" },
  { id: "ar-exam-stress", language: "ar", text: "أخاف أن أرسب في الامتحان وأخيب ظن أمي.", risk: false, note: "distress without risk" },
  { id: "ar-past-resolved", language: "ar", text: "قبل سنوات كنت أفكر في إيذاء نفسي، لكن ذلك انتهى تمامًا.", risk: false, note: "past and resolved" },
  { id: "ar-burden-of-cost", language: "ar", text: "مصاريف الدروس عبء على ميزانيتنا هذا الشهر.", risk: false, note: "a cost is a burden; a person is not" },
];

/* ------------------------------------------------------------ the speech -- */

export type SpeechCase = {
  id: string;
  language: "en" | "ar";
  /** What is said. Also the reference the transcription is scored against. */
  script: string;
  /** The voice to synthesise it with, so a run is reproducible. */
  voice: string;
};

/**
 * Word error rate needs audio, and there is no audio anybody may commit.
 *
 * So the audio is **synthesised** from these scripts, cached, and transcribed.
 * That measures the transcription model against clean studio speech, which is
 * the easiest possible input: a real session is a phone on a coffee table in a
 * room with a radiator. The number is therefore a floor, and the report says
 * so rather than presenting it as session accuracy.
 *
 * It is still worth having. A regression in the transcription model, a changed
 * parameter or a wrong language hint shows up here immediately, and none of
 * those were detectable at all before this sprint.
 */
export const SPEECH_CASES: SpeechCase[] = [
  {
    id: "en-sleep",
    language: "en",
    script:
      "I have not slept properly since Tuesday. I keep waking up at about four in the morning and then that is it, I am awake for the day.",
    voice: "alloy",
  },
  {
    id: "en-clinical",
    language: "en",
    script:
      "The patient described a tight feeling in the chest before meetings, lasting about ten minutes, with no shortness of breath.",
    voice: "verse",
  },
  {
    id: "ar-exams",
    language: "ar",
    script: "الامتحانات بعد أسبوعين وأنا لا أستطيع التركيز أكثر من عشر دقائق.",
    voice: "alloy",
  },
];
