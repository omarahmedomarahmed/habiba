/**
 * 🔴 78.3 — THE DEMO CAST, IN ONE PLACE, WITH NOTHING THAT RUNS.
 *
 * ## Why this is its own file and not a constant in the seed
 *
 * It was a constant in the seed, and `verify-demo.ts` imported it. Importing a
 * value from `scripts/seed-demo.ts` **runs that file**, because it calls
 * `main()` at module scope like every other script here — so the verifier wiped
 * the database it was in the middle of reading, and reported the pot at zero
 * because it had just deleted it.
 *
 * That is a five second bug against a dev branch and an unrecoverable one
 * against production: a command documented as read-only, on the read half of
 * the `on:production` allow-list, would have emptied the founders' database the
 * first time anybody ran it there.
 *
 * So anything two scripts share lives here, where the file has no `main()`, no
 * side effect and nothing to import a database connection for. The seed writes
 * the cast; the verifier reads it; neither can start the other.
 *
 * ## 🔴 AND THE LIST IS SHARED RATHER THAN COPIED
 *
 * C60: the verifier's first draft typed the eleven logins out again beside the
 * seed's own list. Two copies of a cast drift the first time somebody is added,
 * and the copy that drifts is the one the gate reads, so the gate goes on
 * passing about a person who is no longer there.
 */

/** One password for every login, because eleven is too many to remember. */
export const DEMO_PASSWORD = "Demo2026!Therapy";

/**
 * 🔴 THE FOUR REAL INBOXES, NAMED, because everything else must be invented.
 *
 * The founder asked for these four addresses specifically: they own them, and
 * the whole point of the cast is to sign in and watch what arrives. Every other
 * person is at `example.com`, which RFC 2606 reserves, so a message that
 * escapes the test reaches nobody. `verify:demo` asserts exactly that split.
 */
export const OWNED_INBOXES = [
  "omar@24therapy.app",
  "habiba@24therapy.app",
  "omarabdelgawad001@gmail.com",
  "habibaheikal27@gmail.com",
  "mr.3omar.a7mad@gmail.com",
] as const;

/** Which table holds a login, because four different ones do. */
export type LoginTable = "users" | "sponsor_users" | "clinic_managers" | "patient_accounts";

export type DemoLogin = {
  /** What this person is, in the words the founder used. */
  who: string;
  email: string;
  table: LoginTable;
  /** Where to type it in. */
  where: string;
};

/**
 * Every login the seed creates, in the order somebody would work through them.
 *
 * `laila.demo@example.com` is deliberately absent: her record exists on a
 * clinician's list and she has never claimed it, which is the state the claim
 * flow is tested against. `verify:demo` asserts she has no account.
 */
export const DEMO_LOGINS: DemoLogin[] = [
  { who: "Platform admin", email: "omar@24therapy.app", table: "users", where: "/staff/sign-in" },
  /*
   * 🔴 80.1 — A SECOND CONSOLE ACCOUNT THAT IS NOT A FOUNDER, and without it
   * one of our own promises cannot be walked at all.
   *
   * `/security` says *"a role is a list, not a rank"*, and `/admin/actuals`,
   * `/admin/benefits`, `/admin/radar`, the board and the error log are
   * founder-only: a support person opening one is redirected. The cast held
   * exactly one console login and it was `super_admin`, so the only way to see
   * that boundary was to be refused by it, and nobody could be.
   *
   * `docs/simulation/12-THE-LOGINS.md` says it in as many words about the run
   * that was never made: **a permission nobody was ever refused by is a
   * permission nobody has tested.** This is the person who does the refusing.
   */
  {
    who: "Support, not a founder",
    email: "staff.demo@example.com",
    table: "users",
    where: "/staff/sign-in",
  },
  {
    who: "Company (Habiba Holdings)",
    email: "habiba@24therapy.app",
    table: "sponsor_users",
    where: "/sponsor/sign-in",
  },
  {
    who: "Clinic manager (Nile Practice)",
    email: "habibaheikal27@gmail.com",
    table: "clinic_managers",
    where: "/clinic/sign-in",
  },
  {
    who: "Therapist, solo practice",
    email: "omarabdelgawad001@gmail.com",
    table: "users",
    where: "/login",
  },
  {
    who: "Therapist, clinic, 2 patients",
    email: "dr.sara.demo@example.com",
    table: "users",
    where: "/login",
  },
  {
    who: "Therapist, clinic, 1 patient",
    email: "dr.kareem.example@example.com",
    table: "users",
    where: "/login",
  },
  {
    who: "Clinician still applying",
    email: "dr.yasmin.example@example.com",
    table: "users",
    where: "/login",
  },
  {
    who: "Patient, not enrolled",
    email: "mr.3omar.a7mad@gmail.com",
    table: "patient_accounts",
    where: "/patient/login",
  },
  {
    who: "Patient, company pays",
    email: "mariam.demo@example.com",
    table: "patient_accounts",
    where: "/patient/login",
  },
  {
    who: "Patient, record handed on",
    email: "tarek.demo@example.com",
    table: "patient_accounts",
    where: "/patient/login",
  },
  {
    who: "Patient, Dr Kareem's",
    email: "nadia.demo@example.com",
    table: "patient_accounts",
    where: "/patient/login",
  },
];

/** The one person with a record and no way in, which is a state rather than a gap. */
export const UNCLAIMED_EMAIL = "laila.demo@example.com";
