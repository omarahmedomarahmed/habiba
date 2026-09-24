/**
 * 🔴 80.1 — THE PROMISES, AND THE POSITIONS THAT PROVE THEM.
 *
 * ## Why this is code and not a document
 *
 * A founder asked for the product to be tested live by eight people on eight
 * devices, walking every flow, with each flow proving a **value statement** we
 * make to that kind of user. Written as a document, that is a list somebody
 * checks once. Written here, three things read the same array:
 *
 *   - `npm run prove` writes `docs/VALUE-STATEMENTS.md` from it,
 *   - `docs/PROVE-IT.md` walks each one and `verify:prove` fails if a statement
 *     is never walked,
 *   - `seed:demo --scenario=<name>` seeds the position each walk starts from.
 *
 * So a promise that nothing proves is a failing gate rather than a paragraph.
 *
 * ## 🔴 EVERY STATEMENT IS ALREADY PUBLISHED, AND `where` SAYS WHERE
 *
 * Nothing here is new marketing. Each `says` is a claim the product already
 * makes on a page a stranger can read, or a rule it already enforces in code,
 * and `where` names it. That constraint is the whole point: a test plan written
 * against invented promises proves a product nobody was sold.
 *
 * `lib/content/honesty.ts` refuses two claim shapes at the door — that paid
 * sessions cover our fee, and any forecast of what a clinician will earn. So
 * neither appears below, and neither may be added.
 *
 * ## What `proof` has to be
 *
 * A thing a person can SEE on a screen, not a row they could query. The whole
 * reason this is walked by people rather than by `verify:demo` is that a
 * verifier holds an invariant about a row and cannot tell you the screen above
 * it does not say enough for somebody to act on. `docs/simulation/09-THE-EDGES.md`
 * makes the same argument about its own twelve gated cases.
 */

/** The five people this product is built for, and who tests each one. */
export type Audience = "patient" | "therapist" | "clinic" | "company" | "admin";

export const AUDIENCES: { id: Audience; who: string; signsInAt: string }[] = [
  { id: "patient", who: "Somebody in therapy", signsInAt: "/patient/login" },
  { id: "therapist", who: "A clinician, solo or on a clinic seat", signsInAt: "/login" },
  { id: "clinic", who: "The person who runs a practice", signsInAt: "/clinic/sign-in" },
  { id: "company", who: "An employer paying for staff therapy", signsInAt: "/sponsor/sign-in" },
  { id: "admin", who: "Us: approving, confirming, monitoring", signsInAt: "/staff/sign-in" },
];

export type ValueStatement = {
  /** `P1`, `T3`, `A2`. Stable: `PROVE-IT.md` refers to these. */
  id: string;
  audience: Audience;
  /** The promise, in the words the product already uses. */
  says: string;
  /** Where we already say it, so nobody can invent one. */
  where: string;
  /** What has to be visible on a screen for it to be proved. */
  proof: string;
};

/**
 * 🔴 TWENTY-FIVE PROMISES, FIVE PER AUDIENCE.
 *
 * Five is not a round number chosen for neatness. It is what fits in one
 * tester's sitting: a person on one device walking five things and writing down
 * what each screen said is about ninety minutes, and a plan longer than that is
 * a plan whose last third nobody walks.
 */
export const VALUE_STATEMENTS: ValueStatement[] = [
  /* ------------------------------------------------------------ patient -- */
  {
    id: "P1",
    audience: "patient",
    says: "Three taps from opening it to being in a session.",
    where: "`/`, the radar card: “Somebody who is free now”",
    proof:
      "From the app's home screen to a live video room, counting the taps out loud. If it is more than three, the number is the finding.",
  },
  {
    id: "P2",
    audience: "patient",
    says: "Nothing the product tells you is only in an email.",
    where:
      "`scripts/verify-notices.ts`, the gate written after a patient was invited on production and their app said nothing",
    proof:
      "An invitation, a payment confirmation and a session starting each appear in the app itself, with the session orb on every screen while money is owed or a door is open.",
  },
  {
    id: "P3",
    audience: "patient",
    says: "Nothing written by a machine reaches you unsigned.",
    where: "`/for-patients`, “You never talk to the AI”",
    proof:
      "The summary after a session carries a clinician's name and credentials. Before they sign it, the app says they are still writing it rather than showing a draft.",
  },
  {
    id: "P4",
    audience: "patient",
    says: "One record, however many therapists. Every version stays, under its author's name.",
    where: "`/for-patients`, “It moves with you”",
    proof:
      "A record seen by two clinicians at two practices shows both summaries, each named, and the patient decides who may read the history.",
  },
  {
    id: "P5",
    audience: "patient",
    says: "A crisis path that never depends on money.",
    where: "C235, and `components/patient/session-orb.tsx`, which sits UNDER the SOS orb on purpose",
    proof:
      "With an unpaid session and a payment reminder on screen, the SOS button is reachable, on top, and dials without passing anything about money.",
  },

  /* ---------------------------------------------------------- therapist -- */
  {
    id: "T1",
    audience: "therapist",
    says: "The note, before you stand up. Written from what was actually said.",
    where: "`/`, the how-it-works card",
    proof:
      "A session ends and the draft is there, built from the transcript, not from a template. It says draft on every screen until it is signed.",
  },
  {
    id: "T2",
    audience: "therapist",
    says: "Take it off the record for a minute and nothing in that minute is kept.",
    where: "`/`, the room card",
    proof: "The transcript has a hole where the off-record minute was, and the note does not describe it.",
  },
  {
    id: "T3",
    audience: "therapist",
    says: "What you owe comes out of what you earn before it reaches your account.",
    where:
      "`lib/content/honesty.ts`: netting is the true version of the claim it refuses. `/pricing`",
    proof:
      "The earnings screen shows held earnings and what is owed as two halves of one number, and the payout is the difference.",
  },
  {
    id: "T4",
    audience: "therapist",
    says: "Invite somebody to a session and the link works, for a stranger or for a patient who is already signed in.",
    where: "Task 109, and `app/join/[token]/page.tsx`, which stopped asking a signed-in patient their own name",
    proof:
      "The same invitation, opened by a stranger, asks a name; opened by the patient it belongs to, says “Joining as …” and asks nothing.",
  },
  {
    id: "T5",
    audience: "therapist",
    says: "Only a clinician the patient chose can ask the copilot anything, only about them, and only while they allow it.",
    where: "`/for-patients`, “You never talk to the AI”",
    proof:
      "The copilot answers with the sentence it came from attached, and a revoked grant stops it on the next question rather than at the next session.",
  },

  /* ------------------------------------------------------------- clinic -- */
  {
    id: "C1",
    audience: "clinic",
    says: "Add a clinician and they are on the radar the same hour.",
    where: "`/`, the clinic card: “Seats and the people on them”",
    proof:
      "A seat added in the clinic portal puts that clinician on the public radar, with their verification state on the row.",
  },
  {
    id: "C2",
    audience: "clinic",
    says: "The practice sees a patient as a first name and a last initial, and nothing clinical.",
    where: "The founder's decision of 2026-09-23: the practice sees first name and last initial on each clinician's calendar and patient list",
    proof:
      "In the clinic portal a patient appears only as a first name and a last initial, on a clinician's calendar or patient list. No note, transcript, risk, diagnosis, phone or email on any screen.",
  },
  {
    id: "C3",
    audience: "clinic",
    says: "One bill for the practice, not one per clinician.",
    where: "`/`, “One set of books”",
    proof: "One invoice, priced per seat, and the seats on it are the seats that were filled.",
  },
  {
    id: "C4",
    audience: "clinic",
    says: "A seat that leaves mid-month lowers the next bill by exactly one seat, and that clinician keeps working.",
    where: "`docs/simulation/09-THE-EDGES.md` `PL6`",
    proof:
      "Release a seat: the next bill is lower by one seat and the clinician lands on pay-as-you-go by themselves. Nobody is suspended.",
  },
  {
    id: "C5",
    audience: "clinic",
    says: "Earnings per clinician, because you pay them.",
    where: "`/`, “One set of books”",
    proof: "Each clinician's earnings are visible to the practice, and each clinician's patients appear only as a first name and a last initial, with nothing clinical.",
  },

  /* ------------------------------------------------------------ company -- */
  {
    id: "E1",
    audience: "company",
    says: "Who is enrolled, what you funded, and every session's money: its price, your cover, your share and your employee's share. Never who, never which therapist, never the day.",
    where: "`/`, the company card: “The pot, and what is left in it”, widened by the founder's decisions of 2026-09-23 and 2026-09-24: companies see their employees' names and control their benefit, and see each session's money with no name and no therapist",
    proof:
      "`/sponsor` lists enrolled names with benefit controls, and a ledger of session money entries (price, cover %, covered amount, employee's share) with analytics, filters, sorting and export, carrying no employee, no therapist and no date finer than the publishing batch. The balance is a published figure rather than a live one.",
  },
  {
    id: "E2",
    audience: "company",
    says: "The portal has no screen that could show a note, a session time or an attendance list.",
    where: "`/`, “What you will never see”. A fact about the queries rather than a promise",
    proof:
      "Every screen in the company portal, opened one by one, with nothing clinical on any of them. An employee's name appears only on the enrolment list; if it appears beside a therapist, a session or a date anywhere, the walk stops there.",
  },
  {
    id: "E3",
    audience: "company",
    says: "A price somebody was shown is a price they are owed.",
    where: "`docs/simulation/09-THE-EDGES.md` `CV7`",
    proof:
      "Lower coverage after a session is booked: that session still splits at the old share, and the next one is offered at the new one.",
  },
  {
    id: "E4",
    audience: "company",
    says: "Setting coverage to zero is not removing somebody.",
    where: "C345, `docs/simulation/09-THE-EDGES.md` `CV6`",
    proof:
      "At 0% the employee keeps their badge and their place on the roster, owes the whole price, and no screen says they were removed.",
  },
  {
    id: "E5",
    audience: "company",
    says: "When the pot runs out the patient is told to ask HR, not shown a payment error.",
    where: "`docs/simulation/09-THE-EDGES.md` `CV9`",
    proof:
      "A booking against an empty pot: the pot takes nothing, the ordinary pay link is offered, and the patient's screen says who to ask.",
  },

  /* -------------------------------------------------------------- admin -- */
  {
    id: "A1",
    audience: "admin",
    says: "Nothing is granted before a person confirms it.",
    where: "`verify:rail`. There is no processor behind the Egyptian rail",
    proof:
      "Money submitted sits in a queue until an operator presses Confirm, and the thing it pays for does not start until then.",
  },
  {
    id: "A2",
    audience: "admin",
    says: "Pressing Confirm twice moves the money once.",
    where: "`docs/simulation/09-THE-EDGES.md` `RA3`, held by `verify:edges`",
    proof:
      "Confirm, watch nothing obvious change, confirm again. No second ledger leg, no second settlement, and the screen says which.",
  },
  {
    id: "A3",
    audience: "admin",
    says: "A rejection is a sentence in the operator's own words, and the payer reads it verbatim.",
    where: "`docs/simulation/09-THE-EDGES.md` `RA4`",
    proof: "Reject a transfer with a specific reason, then read that exact sentence on the payer's own screen.",
  },
  {
    id: "A4",
    audience: "admin",
    says: "Money that arrives with no claim is a line somebody has to decide about, never silently kept.",
    where: "`docs/simulation/09-THE-EDGES.md` `RA6`, `RA8`",
    proof:
      "An overpayment and an unmatchable bank line both appear on `/admin/transfers` as work, with the difference visible.",
  },
  {
    id: "A5",
    audience: "admin",
    says: "A role is a list, not a rank, and every read is written down.",
    where: "`/security`",
    proof:
      "A staff account is refused a founder-only screen and redirected rather than shown an error, and the refusal is on the record.",
  },
];

/* ========================================================================== */
/*  the positions                                                             */
/* ========================================================================== */

export type ScenarioName = "live" | "money" | "continuity" | "crisis" | "growth";

export type Scenario = {
  name: ScenarioName;
  /** What the database is put into, in one line. */
  title: string;
  /** Why this position and not the everyday one. */
  why: string;
  /** The statements this position is walked to prove. */
  proves: string[];
  /** The edge cases from `09-THE-EDGES.md` it puts the product into. */
  edges: string[];
};

/**
 * 🔴 FIVE POSITIONS, WALKED IN THIS ORDER, RESEEDING BETWEEN EACH.
 *
 * Each one is a complete starting position rather than a diff: `seed:demo`
 * wipes and rebuilds, so there is no order dependence between them and no way
 * for a half-finished walk to poison the next.
 *
 * `live` is first because it is the flow every other one assumes works, and
 * because it is the one that was broken on production last week.
 */
export const SCENARIOS: Scenario[] = [
  {
    name: "live",
    title: "The everyday one: a clinician invites a patient to a paid session, and they meet.",
    why:
      "It is the flagship, it touches six surfaces, and every part of it was broken on production " +
      "within the last week: the patient was told nothing, the pay link asked a signed-in person " +
      "their own name, and the room threw a client-side exception the clinician could not read.",
    proves: ["P1", "P2", "P3", "T1", "T2", "T4", "A1"],
    edges: ["RA1", "RA10", "RA11"],
  },
  {
    name: "money",
    title: "The covered employee, the part payment, and money nobody can match.",
    why:
      "The path with the most moving parts in this product. Sprint 76 found four defects in it " +
      "in one afternoon, and all four were invisible to every gate that claimed to cover it.",
    proves: ["E1", "E2", "E3", "T3", "A2", "A3", "A4"],
    edges: ["CV1", "CV2", "CV4", "CV11", "CV12", "RA3", "RA4", "RA6", "RA7", "RA8", "RA9"],
  },
  {
    name: "continuity",
    title: "A record that moves between clinicians, and one nobody has claimed.",
    why:
      "Portability is the claim the whole patient site rests on, and it is the one thing that " +
      "cannot be shown on a database where everybody saw one person.",
    proves: ["P3", "P4", "T5", "C2", "C5"],
    edges: ["RR2"],
  },
  {
    name: "crisis",
    title: "Somebody in trouble with an unpaid bill, and every dead end in the product.",
    why:
      "C235 is that a patient's crisis path never depends on money. The rest of this position is " +
      "the honest half: the rejected transfer, the expired claim link and the applicant who is " +
      "waiting, which are the three ways this product currently strands a person.",
    proves: ["P5", "A3", "A5"],
    edges: ["RR4", "RA2", "RA5"],
  },
  {
    name: "growth",
    title: "A practice taking somebody on, a pot running dry, and a seat leaving.",
    why:
      "Everything that changes shape rather than state. The pot emptying mid-week and the seat " +
      "released mid-month are the two the product has never been walked through.",
    proves: ["C1", "C3", "C4", "E4", "E5"],
    edges: ["CV6", "CV9", "PL6", "PL7", "RR9"],
  },
];

export const DEFAULT_SCENARIO: ScenarioName = "live";

/**
 * 🔴 THE KNOBS THE SEED READS AND THE VERIFIER CHECKS AGAINST.
 *
 * It lives here rather than in `seed-demo.ts` for the reason `_demo-cast.ts`
 * exists at all: `verify-demo.ts` has to know what each position was funded and
 * priced at, and importing a value from the seed RUNS the seed, because it
 * calls `main()` at module scope like every other script here. A verifier that
 * wipes the database it is reading is not a hypothetical; it happened.
 *
 * The alternative to a shared table was a scenario layer that ran after the
 * base seed and corrected it: set the coverage back, delete the pot's ledger
 * legs, re-post them at another rate. That produces books which do not
 * reconcile to their own history, which is the defect sprint 75 found and the
 * reason every cent in the seed goes through the product's own functions.
 */
export type Tuning = {
  /** What share of a session the company pays, in basis points. */
  coverageBps: number;
  /**
   * 🔴 What the operator confirms into the pot, in USD cents. $150 is EGP
   * 7,500 at 50, the size a company here actually tops up by (EGP 5,000 to
   * 10,000).
   *
   * `growth` funds it to $100 (EGP 5,000) with no welcome credit, against six
   * fully covered sessions that want $144 (EGP 7,200), so the pot genuinely
   * runs out partway through its own history. That is `CV9`
   * and `RR9`, and it cannot be faked by editing a balance: `payFromPot`
   * refuses the spend, and the sessions it refused stay unpaid, which is the
   * position a person has to walk.
   */
  topUpCreditCents: number;
  /** Whether the unenrolled patient is enrolled at the company too. */
  enrolTheSecondPatient: boolean;
  /** What we give the company to start, in USD cents. $100 is EGP 5,000. */
  welcomeCreditCents: number;
};

export const TUNING: Record<ScenarioName, Tuning> = {
  live: { coverageBps: 6000, topUpCreditCents: 15_000, enrolTheSecondPatient: false, welcomeCreditCents: 10_000 },
  /*
   * 🔴 10 per cent, so a covered session splits VISIBLY: the patient owes 90
   * plus the VAT on 90, and every surface that prices it has to agree. At 60
   * per cent the two wrong answers — the share and the whole price — are close
   * enough that a person reads past the difference.
   */
  money: { coverageBps: 1000, topUpCreditCents: 15_000, enrolTheSecondPatient: true, welcomeCreditCents: 10_000 },
  continuity: { coverageBps: 6000, topUpCreditCents: 15_000, enrolTheSecondPatient: false, welcomeCreditCents: 10_000 },
  crisis: { coverageBps: 6000, topUpCreditCents: 15_000, enrolTheSecondPatient: false, welcomeCreditCents: 10_000 },
  growth: { coverageBps: 10000, topUpCreditCents: 10_000, enrolTheSecondPatient: true, welcomeCreditCents: 0 },
};

/** Every statement id, for the checks that have to know the whole set. */
export const STATEMENT_IDS: string[] = VALUE_STATEMENTS.map((s) => s.id);

/**
 * 🔴 `--scenario=<name>`, READ THE SAME WAY BY THE SEED AND BY THE VERIFIER.
 *
 * Two scripts parsing the same flag two ways is how you seed one position and
 * certify another, and both would report success.
 */
export function scenarioFrom(argv: string[]): ScenarioName {
  const flag = argv.find((a) => a.startsWith("--scenario"));
  if (!flag) return DEFAULT_SCENARIO;

  const value = flag.includes("=")
    ? flag.split("=")[1]
    : argv[argv.indexOf(flag) + 1];

  const found = SCENARIOS.find((s) => s.name === value);
  if (!found) {
    const names = SCENARIOS.map((s) => s.name).join(", ");
    throw new Error(`unknown scenario ${String(value)}. One of: ${names}`);
  }
  return found.name;
}

/** The scenario record, by name, for a caller that already validated it. */
export function scenario(name: ScenarioName): Scenario {
  const found = SCENARIOS.find((s) => s.name === name);
  if (!found) throw new Error(`no scenario ${name}`);
  return found;
}
