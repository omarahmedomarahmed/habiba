/**
 * 🔴 THE EVENT CAST'S WORDS: WHAT WAS SAID IN EACH ROOM, AND WHAT WAS SIGNED AFTER IT.
 *
 * Data only, no database and no `main()`, so the seed can read it and a reviewer can
 * read it without running anything. `_seed-event.ts` writes it.
 *
 * Mariam Hassan's four sessions with Dr Karim Nabil are the spine of the founders'
 * demo video, so each has its own transcript and its own signed note, and they move
 * forward: the late messages, the rule she never wrote down, the conversation with her
 * manager, and the nights she slept through. Everybody else gets one conversation per
 * clinician, shorter, and a note that changes from visit to visit.
 *
 * 🔴 Invented people, invented employers, invented practices. Nothing here describes
 * anybody real, and every address the seed writes is at `example.com`.
 */

export type Line = { speaker: "therapist" | "patient"; text: string };

export type Soap = { subjective: string; objective: string; assessment: string; plan: string };

/** What the patient reads after a session, the part a clinician signs off to them. */
export type Brief = { brief: string; steps: string[]; next: string };

export type Visit = {
  /** Days before today. */
  daysAgo: number;
  lines: Line[];
  soap: Soap;
  summary: string;
  brief: Brief;
  talkingPoints: string[];
  impressions: string;
  recommendations: string[];
  followUp: string;
};

const t = (text: string): Line => ({ speaker: "therapist", text });
const p = (text: string): Line => ({ speaker: "patient", text });

/* ======================================================================== */
/*  Mariam Hassan and Dr Karim Nabil                                        */
/* ======================================================================== */

export const MARIAM_VISITS: Visit[] = [
  {
    daysAgo: 28,
    lines: [
      t("Welcome, Mariam. Take your time. What made you book now rather than a month ago?"),
      p("Honestly, the sleep. I fall asleep fine and then I am awake at three, going through my inbox in my head."),
      t("Every night, or some nights?"),
      p("Four or five nights a week. مش قادرة أنام تاني. And then I am useless at work the next day, which makes it worse."),
      t("What is happening at work at three in the morning, in your head?"),
      p("My manager, Sherine. She sends messages at eleven at night and I feel I have to answer before I sleep."),
      t("What happens if you answer in the morning instead?"),
      p("Nothing, probably. But it feels like everything. Two years at Cairo Foundry and I have never once said no to her."),
      t("So there is a rule you are following that nobody actually wrote down."),
      p("Yes. Exactly that. I did not think of it as a rule until you said it."),
      t("Let us not change anything yet. This week, can you notice which nights you answer after ten, and how you sleep after each?"),
      p("Just writing it down? Not stopping?"),
      t("Just noticing. And there are two short questionnaires in the app, about mood and worry, so we have a starting point."),
      p("Okay. الحمد لله إني أخيرًا بتكلم مع حد عن الموضوع ده."),
    ],
    soap: {
      subjective:
        "Presents with middle insomnia four to five nights a week, waking around 03:00 with rumination about work. Links it to late-evening messages from her manager, which she answers before sleeping. Reports never having declined a request at work in two years.",
      objective: "Arrived on time, engaged and articulate. Mixed Arabic and English. Mild psychomotor tension. No acute distress.",
      assessment:
        "Work-related anxiety with sleep maintenance difficulty, maintained by an unspoken rule of constant availability. PHQ-9 12, GAD-7 13 at baseline. No risk indicators elicited.",
      plan: "Self-monitoring for one week: nights with messages answered after 22:00 against sleep quality. Baseline measures completed. Review next week.",
    },
    summary: "Assessment session: middle insomnia and work anxiety linked to late-evening messages from her manager.",
    brief: {
      brief:
        "You named the thing that wakes you at three: the messages that arrive at eleven and the feeling you have to answer them. This week is only about noticing, not changing.",
      steps: ["Note each night you answer work messages after 10pm", "Note how you slept after each night"],
      next: "Same time next week. Bring what you wrote down.",
    },
    talkingPoints: ["What the notes show about answering late", "Where the rule about never saying no came from"],
    impressions: "Consistent with work-related anxiety and learned over-availability. Good insight once the pattern is named.",
    recommendations: ["One week of self-monitoring before any change", "Repeat PHQ-9 and GAD-7 at session four"],
    followUp: "One week.",
  },
  {
    daysAgo: 21,
    lines: [
      t("How did the week of noticing go?"),
      p("It was a bit embarrassing, honestly. Five nights I answered after ten. Five nights I woke at three."),
      t("And the other two?"),
      p("The two nights I left the phone in the kitchen I slept until seven. Both of them."),
      t("That is a clear pattern for one week of notes. What went through your mind when you did not answer?"),
      p("That she would think I am not committed. That I am lazy. حاسة إني لازم أكون موجودة طول الوقت."),
      t("Where does that sound familiar from, before Sherine?"),
      p("My father, I think. He always said work comes first, you answer when you are called."),
      t("So the rule is older than this job."),
      p("Much older. I just did not notice I had brought it with me."),
      t("What would a small version of a boundary look like, one you could actually try this week?"),
      p("Maybe the phone stays in the kitchen after half past ten. And if it is urgent she can call."),
      t("Good. And one sentence ready for the morning, so answering late does not feel like the only way to show you care."),
      p("Something like: I saw this last night and I am on it this morning. I can say that."),
    ],
    soap: {
      subjective:
        "Monitoring completed. Answered work messages after 22:00 on five nights and woke around 03:00 on the same five. Slept through on the two nights the phone stayed out of the bedroom. Identifies the availability rule with her father's expectations.",
      objective: "Engaged, reflective, some embarrassment when reporting. Good humour. No acute distress.",
      assessment:
        "Clear behavioural link between late-evening availability and sleep maintenance. Underlying belief that being unavailable equals being uncommitted, of long standing.",
      plan: "Behavioural experiment: phone out of the bedroom after 22:30 on at least four nights. Prepared morning reply sentence. Review sleep and any consequence at work.",
    },
    summary: "Monitoring showed waking on every night she answered late messages; first boundary experiment agreed.",
    brief: {
      brief:
        "Your own notes did the work this week: five late answers, five nights awake at three, and two nights with the phone in the kitchen that you slept until seven. The rule is older than this job, and you can try loosening it.",
      steps: ["Phone stays in the kitchen after 10:30pm, at least four nights", "Use your morning sentence instead of answering late"],
      next: "Same time next week. We will look at what happened at work, if anything.",
    },
    talkingPoints: ["What actually happened at work when she did not answer", "The father's rule and whether it still fits"],
    impressions: "Strong insight. The belief is conditional rather than global, which is encouraging.",
    recommendations: ["Behavioural experiment with a clear review point", "Explore the origin of the rule without dwelling on it"],
    followUp: "One week.",
  },
  {
    daysAgo: 14,
    lines: [
      t("Tell me about the phone and the kitchen."),
      p("Four nights. I slept through three of them. The one I did not, I think I was just hot, not thinking."),
      t("And at work?"),
      p("Sherine sent something Thursday at eleven and I answered Sunday morning with my sentence. Nothing happened. Nothing at all."),
      t("How was that for you, nothing happening?"),
      p("Relief. And then something else. On Monday she corrected my report in front of the whole team."),
      t("What did you tell yourself after that meeting?"),
      p("That she thinks I am lazy now. حاسة إني دايمًا مقصرة. It went round and round that night."),
      t("What is the evidence she thinks you are lazy?"),
      p("Well. She corrected one number. She also asked me to present the same report to the investors."),
      t("Both of those happened. Which one did your mind keep at three in the morning?"),
      p("Only the first one. Of course only the first one."),
      t("That is worth knowing about your mind. Would it help to ask her directly how she wants urgent things raised?"),
      p("A one to one about response times. I think I can ask for that. I am nervous, but I can."),
    ],
    soap: {
      subjective:
        "Kept the phone out of the bedroom on four nights and slept through on three. A late message answered next morning had no consequence. Ruminated after being corrected in a team meeting, interpreting it as her manager thinking she is lazy.",
      objective: "Brighter affect than previous sessions. Became tearful briefly when describing the meeting, recovered quickly.",
      assessment:
        "Good response to the behavioural experiment. Selective attention to criticism with discounting of positive evidence. Mood improving.",
      plan: "Evidence log for the belief 'she thinks I am lazy'. Request a one-to-one with her manager about response times for urgent matters.",
    },
    summary: "Boundary experiment worked on three of four nights; worked on selective attention to criticism after a team meeting.",
    brief: {
      brief:
        "Three of four nights slept through, and the late message you answered on Sunday cost you nothing. After the meeting your mind kept the correction and dropped the investor presentation. Both happened.",
      steps: ["Keep the kitchen rule on the nights it is easy", "Write down one piece of evidence for and against 'she thinks I am lazy' each day", "Ask Sherine for ten minutes about urgent messages"],
      next: "Same time next week. Tell me how the conversation with Sherine went.",
    },
    talkingPoints: ["The one-to-one with her manager", "What the evidence log shows"],
    impressions: "Improving. The cognitive pattern is clear and she can already name it herself.",
    recommendations: ["Continue behavioural boundary", "Support the conversation with the manager rather than rehearse it"],
    followUp: "One week.",
  },
  {
    daysAgo: 7,
    lines: [
      t("You look different today. How did the conversation with Sherine go?"),
      p("I did it on Tuesday. كنت خايفة جدًا بس الموضوع طلع أبسط بكتير."),
      t("What did you agree?"),
      p("If it is urgent she calls. Everything else I answer in the morning. She said she did not expect me to answer at night at all."),
      t("She did not expect it. How did that land?"),
      p("I laughed. Two years of answering at midnight and she never needed it."),
      t("And the sleep this week?"),
      p("Five nights of seven I slept through. The questionnaires felt different too, I noticed when I filled them in."),
      t("They are. Both scores came down by about five points since the first week."),
      p("I am worried it will come back when the quarter closes. That is always a bad month."),
      t("That is a good thing to plan for. What would you notice first if it started coming back?"),
      p("Checking my phone in bed. That is always the first thing."),
      t("Then that is your early sign. Let us write down what you would do if you notice it."),
      p("Phone back to the kitchen, and book a session before it gets bad, not after."),
    ],
    soap: {
      subjective:
        "Held a one-to-one with her manager and agreed that urgent matters come by phone call and everything else waits until morning. Manager said she never expected night replies. Slept through five of seven nights. Anticipates pressure at quarter close.",
      objective: "Relaxed, smiling, spontaneous humour. Speech and affect markedly brighter than at intake.",
      assessment:
        "Significant improvement in sleep and anxiety. PHQ-9 7 (from 12), GAD-7 8 (from 13). Belief about availability substantially revised by direct evidence.",
      plan: "Relapse prevention: early warning sign (checking phone in bed) and response plan. Consolidate over the next sessions and review workload before quarter close.",
    },
    summary: "Agreed response times with her manager; sleeping through five of seven nights; relapse plan written.",
    brief: {
      brief:
        "You had the conversation you were dreading, and it turned out your manager never expected a reply at night. Five nights of seven slept through, and both questionnaires are about five points lower than in the first week.",
      steps: ["Your early sign is checking the phone in bed", "If you notice it: phone back to the kitchen, and book a session early"],
      next: "Next session: planning for the quarter close before it arrives.",
    },
    talkingPoints: ["Quarter close and workload", "Keeping the gains without the notes"],
    impressions: "Good response to a brief behavioural and cognitive approach. Prognosis good.",
    recommendations: ["Relapse prevention plan in place", "Space sessions out after the quarter close if stable"],
    followUp: "One week, then review spacing.",
  },
];

/** The next one, booked for tomorrow, so Mariam's Sessions tab has something ahead. */
export const MARIAM_NEXT_HOUR_UTC = 13;

/** Her journal, in her own words, dated between the sessions. */
export const MARIAM_JOURNAL: { daysAgo: number; body: string }[] = [
  { daysAgo: 25, body: "Answered Sherine at 11:40 again. Woke at 3:10. Wrote it down like Dr Karim said. It feels stupid to write down but the pattern is already obvious." },
  { daysAgo: 18, body: "Phone in the kitchen. Slept until 7. First time in weeks. نمت كويس الحمد لله." },
  { daysAgo: 12, body: "The meeting keeps replaying. Evidence for lazy: one wrong number. Evidence against: she asked me to present to the investors. Writing it down makes the second one louder." },
  { daysAgo: 5, body: "Talked to Sherine. She said she never expected replies at night. Two years. I laughed in the car on the way home." },
];

/**
 * The standing profile, written the way `lib/ai/profile.ts` asks the model to write
 * one: every sentence carries the marker of the line it came from. The markers are
 * resolved against the seeded transcript by `quote`, not typed as numbers, so a line
 * moved in the transcript above cannot leave a reference pointing at the wrong words.
 */
export const MARIAM_PROFILE: { heading: string; parts: { text: string; session: number; quote: string }[] }[] = [
  {
    heading: "Presenting problem",
    parts: [
      { text: "Wakes around 3am four to five nights a week, going through work in her head.", session: 1, quote: "awake at three, going through my inbox" },
      { text: "Links it to late-evening messages from her manager that she answers before sleeping.", session: 1, quote: "She sends messages at eleven at night" },
    ],
  },
  {
    heading: "What has helped",
    parts: [
      { text: "Leaving her phone in the kitchen: she slept until seven on both nights she did it in the first week.", session: 2, quote: "left the phone in the kitchen I slept until seven" },
      { text: "A direct conversation with her manager, who said she never expected replies at night.", session: 4, quote: "She said she did not expect me to answer at night" },
    ],
  },
  {
    heading: "Watch for",
    parts: [
      { text: "A long-standing rule that she must always be available, which she traces to her father.", session: 2, quote: "My father, I think" },
      { text: "Remembering criticism and dropping praise after meetings.", session: 3, quote: "Only the first one" },
      { text: "Her own early sign of relapse is checking the phone in bed, likely around quarter close.", session: 4, quote: "Checking my phone in bed" },
    ],
  },
];

export const MARIAM_OBSERVATIONS: { session: number; quote: string; text: string }[] = [
  { session: 1, quote: "never once said no to her", text: "Has not declined a request from her manager in two years." },
  { session: 2, quote: "slept until seven", text: "Slept through on both nights the phone stayed out of the bedroom." },
  { session: 3, quote: "Nothing happened. Nothing at all.", text: "A message answered the next morning had no consequence at work." },
  { session: 4, quote: "Five nights of seven", text: "Sleeping through five of seven nights after agreeing response times with her manager." },
];

/** The copilot thread already on Dr Karim's side of her chart. */
export const MARIAM_COPILOT = {
  question: "What seems to be driving the 3am waking: the workload, or the manager?",
  answer:
    "Mostly the late messages rather than the volume of work. In the second session she reported waking at three on the five nights she had answered after ten, and sleeping until seven on the two nights her phone stayed in the kitchen. The rule underneath it is her own and older than this job: she traces it to her father. Since agreeing response times with her manager she has slept through five nights of seven.",
  session: 2,
  quote: "left the phone in the kitchen I slept until seven",
};

/* ======================================================================== */
/*  everybody else: one conversation per clinician, several visits           */
/* ======================================================================== */

export type Pair = {
  therapist: string;
  patient: string;
  /** Days before today for each held session, oldest first. */
  held: number[];
  /** Days from today for a booked one, if any. */
  booked?: number;
  modality?: "video" | "in_person";
  language?: "en" | "ar";
  lines: Line[];
  soap: Soap;
  summary: string;
  briefs: Brief[];
  /** The clinical summary on the person's record, by this clinician. */
  record: string;
};

export const PAIRS: Pair[] = [
  {
    therapist: "karim",
    patient: "mohamed",
    held: [26, 12],
    lines: [
      t("How have the evenings been since last time?"),
      p("Still the same. I get home at nine and I am still on the production schedule in my head."),
      t("What happens at home when you are still on the schedule?"),
      p("I snap at my wife over nothing. Then I feel terrible and cannot sleep."),
      t("What would a clear end to the working day look like for you?"),
      p("Maybe a walk from the metro instead of the taxi. Twenty minutes where nobody can reach me."),
      t("Let us try that on three days and see what it does to the evenings."),
      p("Three days. Okay. I can do three."),
    ],
    soap: {
      subjective: "Long hours in production planning, unable to switch off in the evenings, irritable at home, poor sleep.",
      objective: "Tired, slightly flat, engaged. No acute distress.",
      assessment: "Burnout pattern with poor detachment from work. No risk indicators.",
      plan: "Transition ritual (walk from the metro) on three days a week. Review irritability and sleep.",
    },
    summary: "Burnout and poor detachment from work; transition ritual agreed.",
    briefs: [
      { brief: "The day does not end when you get home, and your evenings pay for it. We agreed to try a twenty-minute walk as a line between work and home.", steps: ["Walk from the metro three days this week", "Notice the evenings after those days"], next: "Two weeks." },
      { brief: "Two of three walks done, and you noticed the evenings after them were calmer. Keep the walk and add one evening a week with no work at all.", steps: ["Keep the walk", "One evening with the work phone off"], next: "Two weeks." },
    ],
    record: "Burnout with poor detachment from work, showing as irritability at home and poor sleep. A daily transition ritual is helping on the days he keeps it.",
  },
  {
    therapist: "salma",
    patient: "omar",
    held: [35, 25, 18, 4],
    booked: 2,
    lines: [
      t("You mentioned your father's birthday is coming up. How are you feeling about it?"),
      p("Heavy. It is the first one since he died. Everybody at home is pretending it is a normal week."),
      t("What would you want the day to look like, if you could choose?"),
      p("I would want to visit the grave with my brother. We have not talked about him properly since the funeral."),
      t("That sounds important. What stops you from asking him?"),
      p("I do not want to make him sad. ماكنتش عايز أزعله."),
      t("It is possible he is waiting for someone to ask too."),
      p("Maybe. I will call him this weekend."),
    ],
    soap: {
      subjective: "Grief six months after his father's death, low mood, withdrawal from family conversation about the loss.",
      objective: "Low affect, tearful at times, good rapport.",
      assessment: "Grief reaction with avoidance of shared mourning. PHQ-9 in the moderate range at intake, improving.",
      plan: "Behavioural activation and planned contact with his brother around the anniversary.",
    },
    summary: "Grief and low mood six months after bereavement; working on shared mourning with family.",
    briefs: [
      { brief: "Grief does not keep to a timetable, and six months is not late to still feel this. We talked about what you miss most and what you are avoiding.", steps: ["One short walk each day", "Write down one memory of your father this week"], next: "Next week." },
      { brief: "You noticed how much you have stopped doing since the funeral. We picked two things to bring back.", steps: ["Football with friends on Friday", "Call your brother once"], next: "Next week." },
      { brief: "The birthday is coming and everyone at home is pretending it is a normal week. You want to visit the grave with your brother.", steps: ["Call your brother this weekend", "Tell him what you would like the day to be"], next: "Next week, after the birthday." },
      { brief: "You and your brother went together and talked about him for the first time. That is the conversation that was missing.", steps: ["Keep the Friday football", "Write down how the day felt"], next: "In two days, as booked." },
    ],
    record: "Grief after his father's death, with low mood and avoidance of shared mourning. Behavioural activation and reconnecting with his brother are helping.",
  },
  {
    therapist: "salma",
    patient: "hoda",
    held: [9],
    modality: "in_person",
    lines: [
      t("Thank you for coming in. What would you like to start with?"),
      p("The engagement ended in the summer and I thought I would be fine by now."),
      t("What does not being fine look like, day to day?"),
      p("I stay in bed on Fridays. I stopped seeing my friends because they ask about it."),
      t("Could we start with one friend who does not ask?"),
      p("Maybe Dina. She just talks about her own life, which is actually nice."),
    ],
    soap: {
      subjective: "Low mood and withdrawal following the end of an engagement in the summer.",
      objective: "Quiet, engaged, no acute distress.",
      assessment: "Adjustment with low mood and social withdrawal. No risk indicators.",
      plan: "Gradual social re-engagement, starting with one low-demand friend.",
    },
    summary: "First session: low mood and withdrawal after an engagement ended.",
    briefs: [
      { brief: "You thought you would be fine by now, and you are allowed not to be. We picked one friend to see who does not ask about it.", steps: ["See Dina once this week"], next: "Book when you are ready." },
    ],
    record: "Low mood and social withdrawal after the end of an engagement. Seen once, in person.",
  },
  {
    therapist: "youssef",
    patient: "rana",
    held: [33, 19, 5],
    lines: [
      t("Tell me about the last time it happened on the metro."),
      p("Tuesday, between Sadat and Attaba. My heart was racing and I was sure I was going to faint."),
      t("Did you faint?"),
      p("No. I got off and sat on the platform for ten minutes and then I took a taxi."),
      t("What did getting off teach your body about the metro?"),
      p("That it is dangerous, I suppose. That I had to escape."),
      t("This week, what if you stayed on for one more stop, and noticed what the panic did?"),
      p("One more stop. That feels possible. Scary but possible."),
    ],
    soap: {
      subjective: "Panic attacks on the metro commute, escape behaviour, increasing taxi use.",
      objective: "Anxious when describing episodes, otherwise settled.",
      assessment: "Panic disorder with emerging avoidance of public transport.",
      plan: "Psychoeducation on the panic cycle; graded exposure, one stop at a time.",
    },
    summary: "Panic on the metro commute; graded exposure started.",
    briefs: [
      { brief: "Panic feels like danger but it is your alarm going off at the wrong time. We drew the cycle together.", steps: ["Read the panic cycle sheet", "Note each episode and what you did"], next: "Two weeks." },
      { brief: "You stayed on for one extra stop twice. The panic peaked and came down on its own both times.", steps: ["Two extra stops, three times this week"], next: "Two weeks." },
      { brief: "You rode from Sadat to Attaba without getting off. That was the stretch you used to escape from.", steps: ["Take the metro to work two days", "Leave the taxi app closed"], next: "Two weeks." },
    ],
    record: "Panic attacks on the metro with growing avoidance. Graded exposure is working; she now completes the stretch she used to escape from.",
  },
  {
    therapist: "youssef",
    patient: "yara",
    held: [29, 15, 8],
    booked: 3,
    lines: [
      t("How did it feel sitting in the driver's seat this week?"),
      p("I sat in the car for five minutes with the engine off. My hands were shaking."),
      t("And after five minutes?"),
      p("They stopped, actually. I did not expect that."),
      t("That is your body learning the car is not the accident."),
      p("The accident was on the Ring Road. I still take the long way to avoid it."),
      t("We will get to the Ring Road. Not this week."),
      p("Good. شوية شوية."),
    ],
    soap: {
      subjective: "Intrusive memories and avoidance of driving since a car accident four months ago.",
      objective: "Visible anxiety when recalling the accident; able to stay with it.",
      assessment: "Post-traumatic stress symptoms after a road traffic accident, with avoidance.",
      plan: "Trauma-focused work with graded return to driving, starting stationary.",
    },
    summary: "Trauma after a road accident; graded return to driving.",
    briefs: [
      { brief: "The accident is still happening in your body when you think about the car. We started, slowly, where you feel safe.", steps: ["Sit in the parked car for five minutes, twice"], next: "Two weeks." },
      { brief: "Your hands stopped shaking after five minutes in the car. Your body is learning the car is not the accident.", steps: ["Start the engine and stay parked", "Drive around the block once"], next: "One week." },
      { brief: "You drove to the supermarket and back. The Ring Road can wait.", steps: ["Two short drives this week"], next: "In three days, as booked." },
    ],
    record: "Post-traumatic stress symptoms after a road accident, with avoidance of driving. Graded return to driving is under way.",
  },
  {
    therapist: "nour",
    patient: "hazem",
    held: [27, 13, 6],
    booked: 1,
    lines: [
      t("How are things at home since the baby arrived?"),
      p("Loud. My mother is staying with us and she and my wife disagree about everything."),
      t("And where are you when they disagree?"),
      p("In the middle. Or at work, honestly. I stay late so I do not have to choose."),
      t("What would your wife say she needs from you?"),
      p("To back her up. Even once. She said that on Thursday."),
      t("What would backing her up once look like, this week?"),
      p("Telling my mother that bath time is my wife's decision. Politely."),
    ],
    soap: {
      subjective: "Conflict between his wife and mother after the birth of their first child; avoids home by staying late at work.",
      objective: "Tired, candid, some guilt when describing avoidance.",
      assessment: "Family conflict with triangulation and avoidance, in the postnatal period.",
      plan: "Communication work and one planned act of support for his wife.",
    },
    summary: "Family conflict in the postnatal period; working on supporting his wife.",
    briefs: [
      { brief: "Staying late at work keeps you out of the argument and leaves your wife alone in it. We talked about what she has asked for.", steps: ["Leave work on time twice this week"], next: "Two weeks." },
      { brief: "You backed your wife up about bath time, and your mother took it better than you feared.", steps: ["Ask your wife what else she needs", "Keep leaving on time"], next: "One week." },
      { brief: "Home is calmer. You are home for bath time four days a week now.", steps: ["Plan one evening out with your wife"], next: "Tomorrow, as booked." },
    ],
    record: "Family conflict after the birth of his first child, with avoidance of home. Communication work is helping; he is more present at home.",
  },
  {
    therapist: "amira",
    patient: "sherif",
    held: [56, 49],
    lines: [
      t("How many times did you check your pulse yesterday?"),
      p("Maybe thirty. Every time I felt anything in my chest."),
      t("And each time, what did the checking do?"),
      p("It calmed me for a minute. Then the thought came back stronger."),
      t("That is the trap. Checking buys a minute and costs the day."),
      p("Je sais. I know. But I cannot stop."),
      t("We are not stopping yet. Let us count first, and delay each check by five minutes."),
      p("Five minutes I can try."),
    ],
    soap: {
      subjective: "Health anxiety with frequent pulse checking and reassurance seeking.",
      objective: "Anxious, engaged, some French and English.",
      assessment: "Health anxiety maintained by checking and reassurance.",
      plan: "Monitoring and delay of checking; psychoeducation on reassurance.",
    },
    summary: "Health anxiety with checking; delay strategy started.",
    briefs: [
      { brief: "Checking your pulse buys a minute of calm and costs the rest of the day. This week we only count, and delay.", steps: ["Count each check", "Wait five minutes before checking"], next: "One week." },
      { brief: "You moved to Cairo for the new job, so we planned a handover to a colleague there. Your record goes with you if you allow it.", steps: ["Keep delaying checks by ten minutes"], next: "With Dr Nour in Cairo." },
    ],
    record: "Health anxiety with pulse checking and reassurance seeking. Delay strategy started; moved to Cairo for work and referred on to Dr Nour El-Sayed.",
  },
  {
    therapist: "nour",
    patient: "sherif",
    held: [20, 6],
    booked: 4,
    lines: [
      t("I read Dr Amira's summary. You were working on delaying the checks."),
      p("Yes. It helped me not having to tell the whole story again. I was dreading that."),
      t("Where are you with the checking since the move?"),
      p("Worse the first week in Cairo. New job, new flat. Better now, maybe ten a day."),
      t("From thirty to ten, in a month of change. That is real."),
      p("I did not see it like that. I only saw that it is not zero."),
      t("Let us move from delaying to dropping one check a day entirely."),
      p("The one after lunch. That one is always a habit, not a feeling."),
    ],
    soap: {
      subjective: "Continuing care after moving from Alexandria. Checking reduced from about thirty to ten times a day despite a move and new job.",
      objective: "Settled, engaged, relieved not to repeat his history.",
      assessment: "Health anxiety improving with response prevention.",
      plan: "Response prevention: drop the post-lunch check entirely. Continue monitoring.",
    },
    summary: "Picked up care from Dr Amira Mansour; checking down from thirty to ten a day.",
    briefs: [
      { brief: "You did not have to tell the whole story again. Checking went up with the move and is coming back down.", steps: ["Keep counting", "Delay by fifteen minutes"], next: "Two weeks." },
      { brief: "Thirty checks a day to ten, through a move and a new job. This week, drop the one after lunch altogether.", steps: ["No pulse check after lunch", "Count the rest"], next: "In four days, as booked." },
    ],
    record: "Picking up from Dr Amira Mansour. Health anxiety improving with response prevention; checking has fallen from about thirty to ten times a day.",
  },
  {
    therapist: "amira",
    patient: "tamer",
    held: [30, 16, 9],
    lines: [
      t("How many times did you re-read the email before sending it?"),
      p("Eleven. It was two lines. To a supplier."),
      t("What were you afraid would happen if there was a mistake?"),
      p("That they would think the whole company is careless. That it would be my fault."),
      t("What happened the one time you sent it after reading it twice?"),
      p("Nothing. They replied thank you."),
      t("So the rule this week is two reads, then send."),
      p("Two reads. My stomach hurts just thinking about it. Okay."),
    ],
    soap: {
      subjective: "Re-reading and re-checking work emails many times before sending, fear of blame.",
      objective: "Tense, perfectionistic language, good engagement.",
      assessment: "OCD-spectrum checking at work, driven by inflated responsibility.",
      plan: "Exposure and response prevention: two reads, then send.",
    },
    summary: "Checking emails before sending; exposure and response prevention.",
    briefs: [
      { brief: "Eleven reads for a two-line email, and the one you sent after two reads got a thank you.", steps: ["Two reads, then send, for every supplier email"], next: "Two weeks." },
      { brief: "You held two reads on most emails. The urge peaks and falls if you let it.", steps: ["Two reads for internal emails too"], next: "One week." },
      { brief: "You sent the monthly report after one read. Nothing went wrong, and you noticed you were less tired at the end of the day.", steps: ["Keep one or two reads", "Notice the time it gives you back"], next: "Two weeks." },
    ],
    record: "Checking and re-reading at work driven by fear of blame. Exposure and response prevention is reducing it.",
  },
  {
    therapist: "amira",
    patient: "nadine",
    held: [22, 11, 3],
    lines: [
      t("Comment s'est passée la semaine? How was the week?"),
      p("Better on weekdays. Weekends are hard, when there is no routine I skip meals."),
      t("What happens in your head before you skip one?"),
      p("That I have not earned it. I did not do anything useful that day."),
      t("Food is not a reward for being useful."),
      p("I know that when I say it here. At home it sounds different."),
      t("Let us plan the weekend meals in advance, so there is no decision to make."),
      p("D'accord. Friday night I will write them down."),
    ],
    soap: {
      subjective: "Restrictive eating on unstructured days, linked to beliefs about earning food. Anxiety.",
      objective: "Engaged, reflective, weight not discussed in detail this session.",
      assessment: "Disordered eating pattern with anxiety; no medical red flags reported.",
      plan: "Regular eating plan for weekends; monitor thoughts about earning food.",
    },
    summary: "Skipping meals on weekends; planned regular eating.",
    briefs: [
      { brief: "Weekdays are steadier, and weekends without routine are where meals go missing.", steps: ["Write weekend meals down on Friday night"], next: "Two weeks." },
      { brief: "You ate at regular times on both weekend days, and the thought about earning food was quieter when the plan was already made.", steps: ["Keep the Friday plan", "Notice the 'not earned' thought, do not argue with it"], next: "One week." },
      { brief: "A hard Saturday, and you still ate lunch. That matters more than the easy weekends.", steps: ["Keep the Friday plan", "One journal entry about the hard day"], next: "Two weeks." },
    ],
    record: "Restrictive eating on unstructured days with anxiety and beliefs about earning food. A planned eating routine is helping.",
  },
  {
    therapist: "hesham",
    patient: "ahmed",
    held: [40, 24, 10],
    lines: [
      t("How many evenings did you drink this week?"),
      p("Four. Less than before. Two beers, sometimes three."),
      t("What happens on the evenings you do not?"),
      p("I go to the gym instead. Then I sleep better, strangely."),
      t("Not strange at all. What gets in the way of the gym on the other nights?"),
      p("Work. If a client shouts at me I just want to switch off."),
      t("Then the shouting client is the moment to plan for, not the beer."),
      p("صح. That is exactly it."),
    ],
    soap: {
      subjective: "Drinking most evenings to manage work stress; reduced from daily. Sleeps better on alcohol-free nights.",
      objective: "Open, motivated, no signs of withdrawal.",
      assessment: "Hazardous drinking linked to work stress; motivated to reduce.",
      plan: "Plan for high-risk evenings after difficult client calls; keep alcohol-free nights.",
    },
    summary: "Reducing evening drinking; planning for high-risk evenings after stressful calls.",
    briefs: [
      { brief: "You drink to switch off after work. We looked at which evenings and why.", steps: ["Write down each drink and what happened that day"], next: "Two weeks." },
      { brief: "Four evenings this week, down from seven. The gym nights are the good ones.", steps: ["Gym on two evenings", "Plan what to do after a hard call"], next: "Two weeks." },
      { brief: "Three alcohol-free nights in a row, including one after a difficult client. You used the plan.", steps: ["Keep three free nights", "Tell one friend what you are doing"], next: "Two weeks." },
    ],
    record: "Hazardous drinking linked to work stress, reducing steadily. Planning for high-risk evenings is working.",
  },
  {
    therapist: "hesham",
    patient: "aya",
    held: [20, 10],
    language: "ar",
    lines: [
      t("إزيك النهارده؟ الأسبوع كان عامل إزاي؟"),
      p("تعبانة شوية. مش قادرة أصحى الصبح خالص."),
      t("إيه اللي بيحصل لما تصحي؟"),
      p("بفضل في السرير وأفكر إن مفيش حاجة تستاهل."),
      t("لو اخترنا حاجة واحدة صغيرة تعمليها أول ما تصحي، تبقى إيه؟"),
      p("ممكن أشرب قهوة في البلكونة. كنت بحب ده زمان."),
      t("تمام. نجرب ده أربع أيام الأسبوع ده."),
      p("ماشي، هحاول."),
    ],
    soap: {
      subjective: "Low mood, difficulty getting up in the morning, loss of interest. Arabic-speaking.",
      objective: "Flat affect, slowed speech, engaged. Denies thoughts of self-harm when asked directly.",
      assessment: "Depressive symptoms, moderate. No risk indicators on direct questioning.",
      plan: "Behavioural activation, starting with one morning activity she used to enjoy.",
    },
    summary: "Low mood and loss of interest; behavioural activation started.",
    briefs: [
      { brief: "The mornings are the hardest part. We picked one small thing you used to enjoy: coffee on the balcony.", steps: ["Coffee on the balcony four mornings"], next: "Two weeks." },
      { brief: "Three mornings on the balcony, and you noticed the day started a little lighter on those days.", steps: ["Keep the balcony coffee", "Call your sister once"], next: "Two weeks." },
    ],
    record: "Moderate depressive symptoms with low morning motivation. Behavioural activation is under way.",
  },
];
