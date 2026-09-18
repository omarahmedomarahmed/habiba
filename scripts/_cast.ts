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
  /**
   * 🔴 76.58 — A PATIENT'S HANDLE IS HER PHONE, AND THE MINI SIMULATION FOUND
   * OUT BY BEING REFUSED.
   *
   * `/patient/signup` asks for a first name, a phone, a time zone and an
   * optional password. **It never asks for an email**, and nothing anywhere
   * else lets a patient add one: `/patient/account` shows the address as "not
   * added" beside a notice calling it *"another way to sign in, and the only
   * way to receive your record"*, and offers no control to add it.
   *
   * So `patient_accounts.email` is null for every patient who signs herself up,
   * and this file used to promise seven patient addresses that cannot exist.
   * `verify:cast --complete` would have reported seven people missing at the
   * end of six months, which reads as an agent who never finished a wave and is
   * the product working as designed.
   *
   * The number is the handle, in the block `01-THE-CAST.md` already reserved,
   * and she signs in with a one-time code rather than a password.
   */
  phone?: string;
  as:
    | "operator"
    | "staff"
    | "therapist"
    | "patient"
    | "practice manager"
    | "practice staff"
    | "employer"
    | "partner";
  wave: number;
  arrives: "seeded" | "signs up" | "never signs up";
  /** What their record should hold by month 6, so a reader knows what to look for. */
  record: string;
  /**
   * 🔴 Set for everybody on OUR OWN payroll, and it is the list `simulate:seed`
   * writes into `employees`.
   *
   * It lives here rather than in the seed because it was in the seed, in a second
   * array of seven, and the two lists disagreed: the payroll held seven people and
   * the cast held two of them, so five colleagues drew a salary in
   * `/admin/actuals` and could not sign in to do the job the salary was for. One
   * list, two readers, and they cannot drift apart again.
   *
   * `queue` is the screens they work. `null` would mean nobody works them, which
   * is not a thing a seven-person company can afford, so every one of them has
   * one.
   */
  payroll?: {
    title: string;
    queue: string;
    role: "super_admin" | "staff";
    monthlyCents: number;
  };
};

/**
 * 🔴 $500 a month each, which is `lib/finance/plans.ts`'s figure and not a new one.
 *
 * Seven people at this is $3,500 a month and $21,000 over the run, against a
 * forecast of a few thousand dollars of revenue. The wage bill IS the plan.
 */
export const STARTING_SALARY_CENTS = 50_000;

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
    payroll: {
      title: "Founder, clinical and operations",
      queue: "verifications, payments and the settings",
      role: "super_admin",
      monthlyCents: STARTING_SALARY_CENTS,
    },
  },
  {
    key: "OP2",
    name: "Sherif Example",
    email: "sherif.example@example.com",
    as: "operator",
    wave: 1,
    arrives: "seeded",
    record:
      "the founder-only half of the console: the board, the radar, the benefits screen, the error log and the actuals. The screens Heba is refused, so the refusal means something",
    payroll: {
      title: "Founder, product and engineering",
      queue: "the board, the radar, benefits, errors and the actuals",
      role: "super_admin",
      monthlyCents: STARTING_SALARY_CENTS,
    },
  },
  {
    key: "SU1",
    name: "Heba Example",
    email: "heba.example@example.com",
    as: "staff",
    wave: 1,
    arrives: "seeded",
    record: "the transfer queue she worked, and the payments she confirmed or rejected with a reason",
    payroll: {
      title: "Support, the transfer queue",
      queue: "transfers",
      role: "staff",
      monthlyCents: STARTING_SALARY_CENTS,
    },
  },
  {
    key: "SU2",
    name: "Sara Example",
    email: "sara.example@example.com",
    as: "staff",
    wave: 1,
    arrives: "seeded",
    record: "the same queue, shared with Heba, which is where one transfer gets picked up twice",
    payroll: {
      title: "Support, the transfer queue and onboarding",
      queue: "transfers",
      role: "staff",
      monthlyCents: STARTING_SALARY_CENTS,
    },
  },
  {
    key: "SU3",
    name: "Amal Example",
    email: "amal.example@example.com",
    as: "staff",
    wave: 1,
    arrives: "seeded",
    record:
      "the companies she sold to and the pot top-ups she cleared for them, each one with her name on the row rather than the operator's",
    payroll: {
      title: "Sales, companies and universities",
      queue: "sponsors and their pot top-ups",
      role: "staff",
      monthlyCents: STARTING_SALARY_CENTS,
    },
  },
  {
    key: "SU4",
    name: "Hossam Example",
    email: "hossam.example@example.com",
    as: "staff",
    wave: 1,
    arrives: "seeded",
    record:
      "the licences he checked and the payouts he stamped. Both rejections of Dr Omar carry a name, and it can be his rather than everybody's",
    payroll: {
      title: "Sales, clinics and therapists",
      queue: "verifications and payouts",
      role: "staff",
      monthlyCents: STARTING_SALARY_CENTS,
    },
  },
  {
    key: "SU5",
    name: "Farida Example",
    email: "farida.example@example.com",
    as: "staff",
    wave: 1,
    arrives: "seeded",
    record:
      "the support inbox and the crisis numbers directory. In a company of seven the marketer answers the inbox, which is not a compromise in the fiction, it is what seven people means",
    payroll: {
      title: "Marketing",
      queue: "support and the crisis numbers directory",
      role: "staff",
      monthlyCents: STARTING_SALARY_CENTS,
    },
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
    phone: "+20 100 900 0041",
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
    phone: "+20 100 900 0042",
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
    phone: "+20 100 900 0043",
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
    phone: "+20 100 900 0044",
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
    phone: "+20 100 900 0045",
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
  {
    key: "D1",
    name: "Tamer Example",
    email: "tamer.example@example.com",
    as: "partner",
    wave: 3,
    arrives: "signs up",
    record:
      "Helio Health's developer account: the keys he minted, the scopes they carry, the rate limit he hit, and the sessions his platform opened. Not one patient he did not bring",
  },

  /* ------------------------------------------------------------ wave 4 -- */
  {
    key: "T5",
    name: "Dr Hala Demo",
    email: "hala.demo@example.com",
    as: "therapist",
    wave: 4,
    arrives: "signs up",
    record:
      "the country she set wrong and corrected before saving, one free month then the full $80, and the mid month upgrade from one seat to three quoted for the days remaining before she agreed",
  },

  /* ------------------------------------------------------------ wave 5 -- */
  {
    key: "T6",
    name: "Dr Sameh Demo",
    email: "sameh.demo@example.com",
    as: "therapist",
    wave: 5,
    arrives: "signs up",
    record:
      "one free month, then a first real bill he overpaid, paid twice, and declined the plan against with the confirmation panel open. He never subscribes, and at three sessions a month he is right not to",
  },
  {
    key: "P7",
    name: "Yousra Demo",
    email: "yousra.demo@example.com",
    phone: "+20 100 900 0047",
    as: "patient",
    wave: 5,
    arrives: "signs up",
    record:
      "three self paid sessions with the metered therapist, charged her session price both before and after his free month ended. The trial is his fee and was never her price",
  },
];

/** Everybody `simulate:seed` creates, so nothing else has to know which those are. */
export const SEEDED = CAST.filter((person) => person.arrives === "seeded");

/** Everybody who should be able to sign in by the end. */
export const WITH_LOGINS = CAST.filter((person) => person.email !== null);

/**
 * 🔴 Our own staff, which is a different list from the cast and the reason
 * `/admin/actuals` can report what six months cost.
 */
export const PAYROLL = CAST.filter(
  (person): person is CastMember & { payroll: NonNullable<CastMember["payroll"]> } =>
    person.payroll !== undefined,
);

/** The first name the sign-up forms want, split off the one name we hold. */
export function firstNameOf(person: CastMember): string {
  return person.name.replace(/^Dr /, "").split(" ")[0]!;
}

/** The surname, which is always `Demo` or `Example` and is checked by `verify:synthetic`. */
export function lastNameOf(person: CastMember): string {
  return person.name.split(" ").at(-1)!;
}
