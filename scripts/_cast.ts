/**
 * 🔴 76.54 — EVERY PERSON IN THE RUN, AND THE ADDRESS THEY SIGN UP WITH.
 *
 * ## Why this list exists in code and not only in a document
 *
 * The run ends with six months of records on the production database and they
 * are not deleted afterwards, so the founder's first question is "let me sign in
 * as her and read it". That is only possible if every agent used a predictable
 * address, and an instruction to use a predictable address, written in a
 * document, is an instruction that is followed five times out of eight.
 *
 * So the addresses are here, `verify:cast` reads them back out of the database
 * and checks the password actually works, and `docs/simulation/12-THE-LOGINS.md`
 * is generated from this file. A login list maintained by hand is a login list
 * that is wrong about two of them, and you find out which two while trying to
 * read a record.
 *
 * ## The convention, and it is mechanical
 *
 *     <first name>.<surname>@example.com, lower case
 *
 * `Dr Amira Demo` is `amira.demo@example.com`. `Salma Example` is
 * `salma.example@example.com`.
 *
 * ## 🔴 SEEDED versus SIGNED UP, and the distinction is the point of the run
 *
 * Three people are seeded, because the console has to work before there is
 * anybody in it and the transfer queue has to be a queue two people share.
 * **Everybody else signs themselves up**, through the same form a stranger uses,
 * because sign-up is where two of the last three walkthroughs found their worst
 * defects. A cast seeded into existence never walks it.
 *
 * So most rows below are an EXPECTATION, not a fixture. `verify:cast` says which
 * have arrived and does not fail for one that has not: during a run that is a
 * progress report. `--complete` is the flag for the end, when somebody missing
 * means an agent never finished their wave.
 *
 * ## 🔴 AND ONE PERSON HAS NO LOGIN AT ALL, ON PURPOSE
 *
 * `P6` Ziad Example never creates an account. He sees a therapist three times
 * through join links and stays a stranger to us. His record is reachable from
 * his clinician's side and from nowhere else, and that is the product working:
 * a table of logins that quietly grew a row for him would be the run failing.
 */

/**
 * 🔴 ONE PASSWORD FOR EVERY ACCOUNT IN THE RUN, and it lives HERE rather than in
 * `simulate-seed.ts`, which is where it was.
 *
 * `verify-cast.ts` needs it, imported it from there, and importing that file
 * RAN it: `simulate-seed.ts` calls `main()` at module load, so a read-only
 * verifier seeded a cast and then refused itself. Found immediately, and it is
 * the reason a constant belongs in a module with nothing else in it.
 */
export const SIMULATION_PASSWORD = "Simulation2026!";

export type CastMember = {
  /** The key the simulation documents use: `T1`, `P3`, `E1-HR`. */
  key: string;
  name: string;
  /** Null for the one person who deliberately never has an account. */
  email: string | null;
  as:
    | "operator"
    | "staff"
    | "therapist"
    | "patient"
    | "practice manager"
    | "practice staff"
    | "employer";
  wave: number;
  arrives: "seeded" | "signs up" | "never signs up";
  /** What their record should hold by month 6, so a reader knows what to look for. */
  record: string;
};

export const CAST: CastMember[] = [
  /* ------------------------------------------------------------ wave 1 -- */
  {
    key: "OP",
    name: "Nour Example",
    email: "nour.example@example.com",
    as: "operator",
    wave: 1,
    arrives: "seeded",
    record:
      "the whole console. Every approval, every rejection, every transfer she cleared, and the audit log with her name on it",
  },
  {
    key: "SU1",
    name: "Heba Example",
    email: "heba.example@example.com",
    as: "staff",
    wave: 1,
    arrives: "seeded",
    record: "the transfer queue she worked, and the payments she confirmed or rejected with a reason",
  },
  {
    key: "SU2",
    name: "Sara Example",
    email: "sara.example@example.com",
    as: "staff",
    wave: 1,
    arrives: "seeded",
    record: "the same queue, shared with Heba, which is where one transfer gets picked up twice",
  },
  {
    key: "T1",
    name: "Dr Amira Demo",
    email: "amira.demo@example.com",
    as: "therapist",
    wave: 1,
    arrives: "signs up",
    record:
      "six months of patients, a practice seat from wave 2, her held earnings and the payout she requested in wave 3",
  },
  {
    key: "T2",
    name: "Dr Yassin Demo",
    email: "yassin.demo@example.com",
    as: "therapist",
    wave: 1,
    arrives: "signs up",
    record:
      "metered until wave 4, then a subscription paid by bank transfer, then the cancellation in wave 5",
  },
  {
    key: "T3",
    name: "Dr Karim Demo",
    email: "karim.demo@example.com",
    as: "therapist",
    wave: 1,
    arrives: "signs up",
    record: "the radar work, mostly strangers in crisis, and the bill he let lapse in wave 4",
  },
  {
    key: "T4",
    name: "Dr Omar Demo",
    email: "omar.demo@example.com",
    as: "therapist",
    wave: 1,
    arrives: "signs up",
    record:
      "two rejections with the reasons in the operator's own words, documents cleared, and a practice seat that still did not let him see a patient",
  },
  {
    key: "P1",
    name: "Layla Demo",
    email: "layla.demo@example.com",
    as: "patient",
    wave: 1,
    arrives: "signs up",
    record:
      "the whole product in Arabic: sessions found on the radar with no account, the record she claimed afterwards, and the access she revoked in wave 3",
  },
  {
    key: "P2",
    name: "Salma Example",
    email: "salma.example@example.com",
    as: "patient",
    wave: 1,
    arrives: "signs up",
    record:
      "appointments booked on a calendar and paid by bank transfer, each one waiting for an operator to clear it",
  },

  /* ------------------------------------------------------------ wave 2 -- */
  {
    key: "C1-M",
    name: "Hana Example",
    email: "hana.example@example.com",
    as: "practice manager",
    wave: 2,
    arrives: "signs up",
    record:
      "Nile Practice: the seats she bought, the clinicians she invited, and not one clinical note anywhere",
  },
  {
    key: "C1-S",
    name: "Fatma Example",
    email: "fatma.example@example.com",
    as: "practice staff",
    wave: 2,
    arrives: "signs up",
    record: "what she was delegated and what she was refused, both of them captured",
  },
  {
    key: "C1-A",
    name: "Dr Tarek Demo",
    email: "tarek.demo@example.com",
    as: "therapist",
    wave: 2,
    arrives: "signs up",
    record: "invited, verified his own licence, joined the practice, and left again in wave 4",
  },
  {
    key: "E1-HR",
    name: "Dalia Example",
    email: "dalia.example@example.com",
    as: "employer",
    wave: 2,
    arrives: "signs up",
    record:
      "Cairo Foundry's pot at 100% coverage, funded once and spent to nothing in wave 4, and a roster she can count but never name",
  },
  {
    key: "P3",
    name: "Mostafa Demo",
    email: "mostafa.demo@example.com",
    as: "patient",
    wave: 2,
    arrives: "signs up",
    record:
      "🔴 THE DEEP RECORD. Covered at 100%, weekly, two therapists, the most journal entries on the platform, and the copilot exam is mostly about him",
  },
  {
    key: "P4",
    name: "Hoda Demo",
    email: "hoda.demo@example.com",
    as: "patient",
    wave: 2,
    arrives: "signs up",
    record:
      "an enrolment that was refused on a staff number the employer did not recognise, and a second that worked off her work email",
  },

  /* ------------------------------------------------------------ wave 3 -- */
  {
    key: "E2-HR",
    name: "Mariam Example",
    email: "mariam.example@example.com",
    as: "employer",
    wave: 3,
    arrives: "signs up",
    record:
      "Alexandria Textiles at 10% coverage, the slider she had to press Edit to move, and the notice period she could not shorten",
  },
  {
    key: "E3-HR",
    name: "Rania Example",
    email: "rania.example@example.com",
    as: "employer",
    wave: 3,
    arrives: "signs up",
    record: "Delta Logistics, a pot funded by transfer in wave 5, and the employee they hired away",
  },
  {
    key: "P5",
    name: "Nadia Example",
    email: "nadia.example@example.com",
    as: "patient",
    wave: 3,
    arrives: "signs up",
    record:
      "🔴 READ THIS ONE FIRST. She changed employer mid-treatment. One continuous course of care, two payers, and neither employer learns the other exists",
  },
  {
    key: "P6",
    name: "Ziad Example",
    email: null,
    as: "patient",
    wave: 3,
    arrives: "never signs up",
    record:
      "three sessions through join links and no account at all. Reachable from his clinician's side only, which is the product working rather than a gap",
  },
];

/** Everybody `simulate:seed` creates, so nothing else has to know which those are. */
export const SEEDED = CAST.filter((person) => person.arrives === "seeded");

/** Everybody who should be able to sign in by the end. */
export const WITH_LOGINS = CAST.filter((person) => person.email !== null);
