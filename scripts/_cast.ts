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
      "activates the practice and the companies, approves the partner, and with Sherif posts the month's two-person ledger adjustment and sends a company its money back",
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
      "the second pair of hands on every two-person decision, and the radar report reviewed in round 3",
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
    record:
      "the patients' transfers confirmed or rejected, the refunds sent, and the money with no claim matched in round 5",
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
    record:
      "the clinicians' and the practice's bill payments: a plan paid by transfer, a part payment, an overpayment",
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
      "the company top-ups confirmed, each with this staff member's name on the row",
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
      "every licence check: three approvals on day 1, Dr Omar rejected twice then approved, and the payout approved and marked sent",
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
      "the support inbox and the number-change queue, answering the tickets the cast writes",
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
      "the main caseload: Layla in Arabic, Mostafa weekly with the copilot, an in-person session paid by wall code, homework, and a payout requested mid-month",
  },
  {
    key: "T2",
    name: "Dr Yassin Demo",
    email: "yassin.demo@example.com",
    as: "therapist",
    wave: 1,
    arrives: "signs up",
    record:
      "Salma's sessions paid by transfer, the risk session with Mostafa, the cheaper replacement a waiting patient moves to, and a plan bought by transfer",
  },
  {
    key: "T3",
    name: "Dr Karim Demo",
    email: "karim.demo@example.com",
    as: "therapist",
    wave: 1,
    arrives: "signs up",
    record:
      "on call on the crisis radar, an in-person session paid directly, the no-show, and bills paid in part",
  },
  {
    key: "T4",
    name: "Dr Omar Demo",
    email: "omar.demo@example.com",
    as: "therapist",
    wave: 1,
    arrives: "signs up",
    record:
      "rejected twice with the reason in the reviewer's own words, documents cleared, approved on day 14",
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
      "the whole product in Arabic: invited, claimed, booked, a crisis radar booking, homework, and the access revoked on day 21",
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
      "sessions paid by bank transfer, one changed and one cancelled, a refund, and a support ticket",
  },

  /* ------------------------------------------------------------ wave 2 -- */
  {
    key: "C1-M",
    name: "Hana Example",
    email: "hana.example@example.com",
    as: "practice manager",
    wave: 1,
    arrives: "signs up",
    record:
      "Nile Practice: activated on day 1, one clinician invited and later removed, a seat bought mid-month with the quote read first, the practice bill paid by transfer",
  },
  {
    key: "C1-S",
    name: "Fatma Example",
    email: "fatma.example@example.com",
    as: "practice staff",
    wave: 2,
    arrives: "signs up",
    record:
      "delegated staff: what was allowed and what was refused",
  },
  {
    key: "C1-A",
    name: "Dr Tarek Demo",
    email: "tarek.demo@example.com",
    as: "therapist",
    wave: 2,
    arrives: "signs up",
    record:
      "invited into the practice, verified, working, and removed on day 21",
  },
  {
    key: "E1-HR",
    name: "Dalia Example",
    email: "dalia.example@example.com",
    as: "employer",
    wave: 1,
    arrives: "signs up",
    record:
      "Cairo Foundry: a pot topped up by transfer, a staff email list, 100% coverage lowered on day 21 with 30 days' notice, and the alerts as the pot runs dry",
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
      "the deep record: covered 100%, weekly with Dr Amira, the copilot's subject, the risk session on day 14",
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
      "refused at enrolment by staff number, accepted by work email, left waiting by a clinician who never came, and paid in person by wall code",
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
      "Alexandria Textiles at 10%: the split every session shows, and ending Nadia's benefit on leaving",
  },
  {
    key: "E3-HR",
    name: "Rania Example",
    email: "rania.example@example.com",
    as: "employer",
    wave: 3,
    arrives: "signs up",
    record:
      "Delta Logistics: a top-up rejected twice then confirmed, Nadia's new employer, and money asked back on day 28",
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
      "changes employer mid-month: one course of care, two payers, and neither employer learns of the other",
  },
  {
    key: "P6",
    name: "Ziad Example",
    email: null,
    as: "patient",
    wave: 3,
    arrives: "never signs up",
    record:
      "sessions joined by link with no account, reachable only from the clinician's side",
  },
  {
    key: "D1",
    name: "Tamer Example",
    email: "tamer.example@example.com",
    as: "partner",
    wave: 1,
    arrives: "signs up",
    record:
      "Helio Health's developer: applies, keys, API sessions, webhooks, a teammate, and the production approval",
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
      "arrives mid-month with the wrong country corrected before saving, and takes the practice's new seat",
  },

  /* ------------------------------------------------------------ wave 5 -- */
  {
    key: "T6",
    name: "Dr Sameh Demo",
    email: "sameh.demo@example.com",
    as: "therapist",
    wave: 6,
    arrives: "signs up",
    record:
      "arrives on day 28 on pay as you go, overpays the first bill by transfer",
  },
  {
    key: "P7",
    name: "Yousra Demo",
    email: "yousra.demo@example.com",
    phone: "+20 100 900 0047",
    as: "patient",
    wave: 6,
    arrives: "signs up",
    record:
      "three self-paid sessions with Dr Sameh, and a search for a way to delete the account",
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
