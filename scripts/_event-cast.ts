/**
 * 🔴 THE EVENT CAST: THE PEOPLE IN THE FOUNDERS' DEMO VIDEO, WITH LOGINS TO HAND OUT.
 *
 *     npm run seed:demo -- --scenario=event
 *     npm run verify:event-demo
 *     npm run logins                      # writes docs/DEMO-LOGINS.md from this file
 *
 * ## Why this is its own position and not a sixth `SCENARIOS` entry
 *
 * The five positions in `_value-statements.ts` are walks: each one is a diff of
 * the everyday cast, seeded to prove named promises, and `verify:prove` insists
 * every one of them has a section in `docs/PROVE-IT.md`. This is not a walk. It
 * is a whole, different cast, seeded so a stranger at a startup event can be
 * handed a login and find a product that looks lived in: a company paying for
 * its staff, a clinician with a month of notes, a clinic with a week booked.
 *
 * So it shares the wipe and the console logins with `seed-demo.ts` and nothing
 * else, and it lives here, in a file with no `main()`, for the reason
 * `_demo-cast.ts` gives: the seed writes it and the verifier reads it, and
 * importing a value from the seed would run the seed.
 *
 * ## 🔴 THE PASSWORD IS WRITTEN HERE ON PURPOSE
 *
 * These logins are meant to be given to strangers. Every one is an invented
 * person at `example.com`, and the password opens nothing else: the console
 * and the support account keep `DEMO_PRIVATE_PASSWORD` (`PRIVATE_LOGINS`), and
 * `verify:event-demo` checks that neither published password opens them.
 */

/** One password for every event login, shared with strangers on purpose. */
export const EVENT_PASSWORD = "Techne2026!";

/** Where people sign in. The product's own domain. */
export const SITE = "https://24therapy.app";

/** Which table holds a login. The same four `_demo-cast.ts` names, plus the partner portal. */
export type EventLoginTable =
  | "users"
  | "sponsor_users"
  | "clinic_managers"
  | "patient_accounts"
  | "partner_users";

export type EventLogin = {
  /** The person, as the video names them. */
  who: string;
  /** What they are, in one phrase. */
  role: string;
  email: string;
  table: EventLoginTable;
  /** The sign-in path on `SITE`. */
  where: string;
  /** One line: what to try first. */
  tryThis: string;
};

/* ---------------------------------------------------------- the names -- */

export const EVENT = {
  karim: "karim.nabil@example.com",
  mariam: "mariam.hassan@example.com",
  mariamPhone: "+201009000061",
  dalia: "dalia.foundry@example.com",
  nilePharmaHr: "hr.nilepharma@example.com",
  hana: "hana.clinic@example.com",
  helio: "dev.helio@example.com",
  cairoFoundry: "Cairo Foundry",
  nilePharma: "Nile Pharma",
  clinicSlug: "nile-practice",
  partnerSlug: "helio-health",
  karimLicence: "EG-PSY-20417",
  /** The record a clinician wrote down and nobody has claimed. */
  unclaimed: "hoda.ibrahim@example.com",
  /** The record that moved between two clinicians at two practices. */
  moved: "sherif.wahba@example.com",
} as const;

/**
 * 🔴 EVERY LOGIN THE EVENT CAST CREATES, in the order somebody would hand them out.
 *
 * `docs/DEMO-LOGINS.md` is generated from this and `verify:event-demo` signs in
 * as each one, so the table a stranger reads and the one the gate checks are
 * the same array.
 */
export const EVENT_LOGINS: EventLogin[] = [
  {
    who: "Mariam Hassan",
    role: "Patient, her employer pays",
    email: EVENT.mariam,
    table: "patient_accounts",
    where: "/patient/login",
    tryThis:
      "See your Cairo Foundry benefit, read what Dr Karim signed after each session, book him again, and check who can read your record.",
  },
  {
    who: "Dr Karim Nabil",
    role: "Therapist, solo practice",
    email: EVENT.karim,
    table: "users",
    where: "/login",
    tryThis:
      "Open Mariam's chart, read her standing profile, and ask the copilot what is driving her sleep problem at work.",
  },
  {
    who: "Dalia Samir",
    role: "HR, Cairo Foundry (covers 100%)",
    email: EVENT.dalia,
    table: "sponsor_users",
    where: "/sponsor/sign-in",
    tryThis:
      "See the pot, the weekly spend and your joining code. Try to find out who went to therapy: you cannot.",
  },
  {
    who: "Nile Pharma HR",
    role: "HR, Nile Pharma (covers 50%)",
    email: EVENT.nilePharmaHr,
    table: "sponsor_users",
    where: "/sponsor/sign-in",
    tryThis: "Each session split in two: your half from the pot, your employee's half by transfer.",
  },
  {
    who: "Hana Mahmoud",
    role: "Clinic manager, Nile Practice",
    email: EVENT.hana,
    table: "clinic_managers",
    where: "/clinic/sign-in",
    tryThis: "Three clinicians on seats, this week's bookings and the bills, with no clinical detail anywhere.",
  },
  {
    who: "Dr Salma Fouad",
    role: "Therapist, Nile Practice",
    email: "salma.fouad@example.com",
    table: "users",
    where: "/login",
    tryThis: "Find Hoda's record, which you wrote and she has never claimed, and invite her to it.",
  },
  {
    who: "Dr Youssef Adel",
    role: "Therapist, Nile Practice",
    email: "youssef.adel@example.com",
    table: "users",
    where: "/login",
    tryThis: "Your week: a covered patient booked in three days, and your earnings so far.",
  },
  {
    who: "Dr Nour El-Sayed",
    role: "Therapist, Nile Practice",
    email: "nour.elsayed@example.com",
    table: "users",
    where: "/login",
    tryThis: "Open Sherif's chart: his record came with him from another practice, with both summaries.",
  },
  {
    who: "Dr Amira Mansour",
    role: "Therapist, solo, Alexandria",
    email: "amira.mansour@example.com",
    table: "users",
    where: "/login",
    tryThis: "Set your opening hours and see how a patient books you.",
  },
  {
    who: "Dr Hesham Ragab",
    role: "Therapist, solo, Mansoura",
    email: "hesham.ragab@example.com",
    table: "users",
    where: "/login",
    tryThis: "See what your patients paid by InstaPay and what reaches your account.",
  },
  {
    who: "Omar Khaled",
    role: "Patient, Cairo Foundry, sees Dr Salma",
    email: "omar.khaled@example.com",
    table: "patient_accounts",
    where: "/patient/login",
    tryThis: "A session in two days, already paid by your employer. Open it.",
  },
  {
    who: "Yara Mostafa",
    role: "Patient, Nile Pharma pays half",
    email: "yara.mostafa@example.com",
    table: "patient_accounts",
    where: "/patient/login",
    tryThis: "Your next session: the company paid its half, pay yours by InstaPay.",
  },
  {
    who: "Hazem Tawfik",
    role: "Patient, Nile Pharma pays half",
    email: "hazem.tawfik@example.com",
    table: "patient_accounts",
    where: "/patient/login",
    tryThis: "Book Dr Nour from her open hours and see the price split before you pay.",
  },
  {
    who: "Ahmed Samir",
    role: "Patient, pays for himself",
    email: "ahmed.samir@example.com",
    table: "patient_accounts",
    where: "/patient/login",
    tryThis: "Browse therapists by language and city, and book one without anybody's permission.",
  },
  {
    who: "Nadine Farouk",
    role: "Patient, pays for herself",
    email: "nadine.farouk@example.com",
    table: "patient_accounts",
    where: "/patient/login",
    tryThis: "Write in your journal and tick off this week's steps.",
  },
  {
    who: "Sherif Wahba",
    role: "Patient, record moved to a new therapist",
    email: EVENT.moved,
    table: "patient_accounts",
    where: "/patient/login",
    tryThis: "See both therapists' summaries in one record, and take Dr Nour's access back if you want.",
  },
  {
    who: "Rami Helmy (Helio Health)",
    role: "Partner developer",
    email: EVENT.helio,
    table: "partner_users",
    where: "/partner/sign-in",
    tryThis: "A sandbox key is already on your account. Mint your own, read the API docs, and make a first call.",
  },
];

/**
 * 🔴 `--scenario=event`, parsed the way `scenarioFrom` parses the other five.
 *
 * Both spellings, `--scenario=event` and `--scenario event`, because npm hands
 * either one through and a flag that only works one way is a flag that seeds the
 * wrong position on the day somebody types the other.
 */
export function isEventScenario(argv: string[]): boolean {
  const flag = argv.find((a) => a.startsWith("--scenario"));
  if (!flag) return false;
  const value = flag.includes("=") ? flag.split("=")[1] : argv[argv.indexOf(flag) + 1];
  return value === "event";
}
