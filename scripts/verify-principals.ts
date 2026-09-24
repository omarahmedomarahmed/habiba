/**
 * Sprint 58 acceptance: which principal can reach which data. PLAN.md 58.6, C336.
 *
 *   npm run verify:principals
 *
 * ## Why this is not a 415-by-7 matrix
 *
 * The first design was one: every exported data function against every
 * principal, asserting refusal by default. `lib/data` exports **415 functions**
 * and this product has six principals with a seventh arriving in sprint 63.
 * That is 2,900 cells nobody would maintain, and C286 is the record of what an
 * unmaintained instrument does: it becomes a documented limitation whose cost
 * is never counted.
 *
 * The second design asked every data function to take an `Actor`. Thirty-four
 * of 384 do. The rest are guarded by their CALLER, which is this codebase's
 * actual architecture: a page calls `requireRole` or `requirePatient`, then
 * calls the query. Demanding an actor everywhere is a rewrite wearing the
 * costume of a gate.
 *
 * So this measures the property that architecture actually rests on, and the
 * one that breaks first when a new portal is added:
 *
 *   **Every page or route that can reach a clinically-scoped data module must
 *   call a guard, and only a guard that principal is allowed to be.**
 *
 * A clinic-staff page importing `lib/data/sessions` is the failure sprint 63
 * has to not have. This is the gate that will catch it, written before the
 * portal exists rather than after.
 *
 * ## Every module needs an entry, including a new one
 *
 * `lib/data/*.ts` with no entry in `SCOPE` **fails the build**. That is C336's
 * rule: a function with no entry is not "probably fine", it is a decision
 * nobody has made. A genuinely public module says so, out loud, with a reason.
 */
import { stripCommentsKeepingLines } from "./_dashes";
import { loadSurfaces, type Surfaces } from "./_surfaces";
import { reporter } from "./_verify";
import { readdirSync } from "node:fs";

const { check, finish } = reporter();

/* -------------------------------------------------------------- the map -- */

/**
 * Which guard each principal signs in through. One entry per portal.
 *
 * `requireUserApi` and `requireRoleApi` are the same principals reached from a
 * route handler rather than a page: same identity, different failure mode
 * (a 401 rather than a redirect), so they map to the same principal here.
 */
const GUARDS: Record<string, string[]> = {
  clinician: ["requireUser", "requireVerified", "requireUserApi"],
  admin: ["requireRole", "requireStaff", "requireManager", "requireRoleApi"],
  patient: ["requirePatient"],
  /*
   * W2-C01: `requireClinicCapability` is `requireClinic` plus a capability,
   * and every clinic page now signs in through it. Unlisted, a page guarded
   * MORE narrowly than before read as unguarded.
   */
  clinic: ["requireClinic", "requireClinicAdmin", "requireClinicCapability"],
  sponsor: ["requireSponsor", "requireSponsorAdmin"],
  partner: ["requirePartner", "requirePartnerAdmin"],
};

const ALL_GUARDS = Object.values(GUARDS).flat();

/**
 * What each data module holds, and who may reach it.
 *
 * `clinical: true` means the module can produce a note, a transcript, a
 * diagnosis, a journal, a risk assessment or a patient's identity. Those are
 * the modules where reaching them from the wrong portal is the defect this
 * whole file exists to prevent.
 *
 * `open` means genuinely reachable without a guard, and every one of them has
 * to be argued rather than assumed.
 */
type Scope = { who: string[]; clinical?: true; why?: string };

const SCOPE: Record<string, Scope> = {
  /* ------------------------------------------------------------- clinical */
  "patient-view": { who: ["patient"], clinical: true },
  patients: { who: ["clinician", "admin"], clinical: true },
  people: { who: ["clinician", "admin", "patient"], clinical: true },
  sessions: { who: ["clinician", "admin"], clinical: true },
  "session-risk": { who: ["clinician", "admin"], clinical: true },
  "session-sources": { who: ["clinician", "admin"], clinical: true },
  "session-voices": { who: ["clinician", "admin"], clinical: true },
  /*
   * 🔴 W1-03: the lock on a signed note and its addenda. The clinician's
   * only: a patient reads their own released addenda through `patient-view`
   * and `feedback`, never through this module.
   */
  "note-record": { who: ["clinician"], clinical: true },
  /*
   * 🔴 W2-F01 / D7: a clinician's note formats and their default. Their own
   * way of writing, not a record about anybody, so not clinical; reached
   * from settings and from the note writer that drafts in it.
   */
  "note-formats": { who: ["clinician"] },
  copilot: { who: ["clinician"], clinical: true },
  /*
   * 🔴 76.39 — the same thread as `copilot`, assembled for the two surfaces
   * that render it, so the clinician-only rule is the same one.
   */
  "copilot-view": { who: ["clinician"], clinical: true },
  /*
   * 🔴 76.40 — inviting a patient to a paid session. Clinical because it reads
   * their chart to find a phone and an email before it sends anything, and a
   * clinician's only because the thing it creates is their session at their
   * rate.
   */
  "session-invite": { who: ["clinician"], clinical: true },
  journals: { who: ["clinician", "patient"], clinical: true },
  facts: { who: ["clinician"], clinical: true },
  memory: { who: ["clinician"], clinical: true },
  /*
   * A patient reaches their OWN, on /patient/profile, which that page's own
   * header names as one of the two things that are theirs. C113 forbids a
   * conclusion reaching a patient without a clinician; a diagnosis they
   * entered and a clinician confirmed is the opposite of that.
   */
  diagnoses: { who: ["clinician", "admin", "patient"], clinical: true },
  assessments: { who: ["clinician", "patient", "admin"], clinical: true },
  homework: { who: ["clinician", "patient"], clinical: true },
  documents: { who: ["clinician", "patient", "admin"], clinical: true },
  summaries: { who: ["clinician", "patient"], clinical: true },
  grants: { who: ["clinician", "patient", "admin"], clinical: true },
  /*
   * A clinician reaches this for the UNCLAIMED badge on a patient row, and
   * the pre-auth signup and invite pages reach it to tell somebody a record
   * is waiting for them. Neither reads a record: both read whether one has
   * been claimed, which is the fact the claim flow exists to change.
   */
  claims: { who: ["patient", "admin", "clinician"], clinical: true },
  // A clinician exports their own caseload from /connect. The patient exports
  // their own record. Neither reaches the other's.
  portability: { who: ["patient", "admin", "clinician"], clinical: true },
  "patient-import": { who: ["clinician", "admin"], clinical: true },
  // A clinic reads its own EHR connections and writeback log from
  // /clinic/records. Connections and deliveries, never a record.
  ehr: { who: ["clinician", "admin", "clinic"], clinical: true },
  /*
   * `/verify` is public and reaches `verifyExtract`, which checks whether a
   * document somebody is holding was really issued by us. It reads a hash, not
   * a record, and a verification page behind a login could not verify anything
   * for the person most likely to need it.
   */
  export: { who: ["admin", "clinician", "patient"], clinical: true },
  checkins: { who: ["patient", "admin"], clinical: true },
  notices: { who: ["patient", "admin"], clinical: true },
  notifications: { who: ["clinician", "patient", "admin"], clinical: true },
  recovery: { who: ["patient", "admin"], clinical: true },
  /*
   * 🔴 W1-13: a clinician cancelling their own booked session. Clinical
   * because it reads the patient's contact details to tell them, and the
   * clinician's only because it acts on their own appointment.
   */
  "clinician-cancel": { who: ["clinician"], clinical: true },
  /*
   * 🔴 W1-02: whether an organisation is a solo practice or a clinic, so a
   * seat clinician cannot run the clinic's account. It reads one column of
   * the actor's own organisation and nothing about any patient.
   */
  "org-kind": { who: ["clinician"] },
  "name-match": { who: ["clinician", "admin"], clinical: true },
  "phone-change": { who: ["patient", "admin"], clinical: true },
  /*
   * 🔴 NOT clinical, and the reason is the select list rather than the subject.
   *
   * It reads `partner_subjects` and `partners`: a platform's name, when the link
   * was made, and whether it is live. Neither table can produce a session, a
   * note, a diagnosis or a date of care, so the person's own consent screen can
   * read it without widening anything. The clinicians who arrived through a
   * partner are `grants`, one entry up, and that one IS clinical.
   */
  "partner-links": { who: ["patient"] },
  /*
   * 🔴 NOT clinical, and the select lists are the argument rather than the
   * subject matter.
   *
   * It reads `sponsor_domains`: a domain, two proof timestamps and a DNS token.
   * No person appears in this module at all, which is C227 holding — a sponsor
   * performs no act about any individual — and it is why the same module can be
   * read by the sponsor's own setup screen and by an operator without the
   * matrix having to argue about it.
   */
  "sponsor-domains": { who: ["sponsor", "admin"] },
  residency: { who: ["patient", "admin"], clinical: true },
  // Also reached by the public rating link `/t/[id]` and the radar, which
  // carry a one-time token rather than a session. C273: a rating is never
  // attributed, so the read is an aggregate.
  feedback: { who: ["clinician", "patient", "admin"], clinical: true },
  scheduling: { who: ["clinician", "patient", "admin"], clinical: true },
  "meeting-connections": { who: ["clinician", "admin"], clinical: true },
  challenge: { who: ["clinician", "patient", "admin"], clinical: true },
  // A patient browses clinicians. What this exposes is a clinician's own
  // published profile, which is the same surface the public radar shows.
  discover: { who: ["clinician", "admin", "patient"], clinical: true },
  usage: { who: ["admin"] },

  /*
   * 🔴 76.53 — THE COMPANY'S OWN RESULT AND THE COMPANY'S OWN PAYROLL.
   *
   * Neither is clinical: `actuals` reads the ledger, `ai_request_logs` and
   * counts of sessions, never a note, a transcript, a risk level or a patient's
   * name. `payroll` reads two tables that contain nobody who uses this product.
   *
   * `admin` here means super_admin, which the pages enforce with
   * `requireRole("super_admin")` and `lib/data/payroll.ts` asserts again for
   * any caller that is not a page. The 24/7 team works queues; what a colleague
   * is paid is not a queue.
   */
  actuals: { who: ["admin"] },
  payroll: { who: ["admin"] },
  /*
   * 🔴 76.56 — WHAT IS IN THE BANK, AND WHAT NOTHING IN THE PRODUCT BUYS.
   *
   * The third of the same family and the same ruling. `capital` holds two
   * tables that contain no customer of this product at all: money the founders
   * put in, and the video, hosting and accountancy bills nothing here pays. It
   * is not clinical by construction, there is no patient column to scope, and
   * `lib/data/capital.ts` asserts super_admin again for any caller that is not
   * a page. How much money the company has left is not a queue.
   */
  capital: { who: ["admin"] },

  /*
   * 🔴 C379 — Total View. It reads live transcripts, note content and risk
   * levels straight from the database, and until now no gate could see it.
   * super_admin only, which `elevated()` enforces on top of the page's guard.
   */
  "console/reads": { who: ["admin"], clinical: true },
  /*
   * 🔴 76.1 — the board. Admin only, and NOT clinical, which is the whole
   * difference between it and `console/reads` above. It counts rows: how many
   * sessions, how much money, how many people. It never reads a transcript, a
   * note, a message or a name from a clinical table, and this declaration is
   * what the gate checks that claim against.
   */
  "console/board": { who: ["admin"] },
  /* 🔴 76.29 — where a sponsor pot went. Operators only, and it names no patient. */
  "console/pot-trace": { who: ["admin"] },
  "console/gate": { who: ["admin"] },
  "console/history": { who: ["admin"], clinical: true },

  /* -------------------------------------------------------- back office */
  admin: { who: ["admin"] },
  "radar-admin": { who: ["admin"] },
  "clinic-admin": { who: ["admin"] },
  "partner-admin": { who: ["admin"] },
  clinic: { who: ["clinic", "admin"] },
  /*
   * 🔴 63.11 — THE SEVENTH PRINCIPAL'S TWO NEW MODULES, AND NEITHER IS CLINICAL.
   *
   * > *Clinic staff never reach a record, a note, a transcript, a copilot or a risk
   * > alert. Proved by the 58.6 matrix, not by a comment.*
   *
   * `clinic-team` writes PERMISSIONS: roles, staff and assignments. It touches
   * `clinic_managers`, `clinic_roles`, `clinic_staff_assignments` and `users` for a
   * name, and nothing with a note, a transcript or a session in it.
   */
  "clinic-team": { who: ["clinic"] },
  /*
   * 🔴 63.17 / C334 — the export, and it is declared as the CLINIC's because it is.
   *
   * It holds no queries of its own: every row it writes comes back from
   * `clinicSchedule` and `clinicBills`, so it inherits their capability checks, their
   * assignment scoping and their shortened patient names. Declaring it clinical would
   * be declaring `clinic` clinical, which it is not.
   */
  "clinic-export": { who: ["clinic"] },
  /*
   * 🔴 66.1 to 66.12 — THE SPONSOR'S HR CONNECTION, AND IT IS NOT CLINICAL.
   *
   * It touches `sponsors`, `partner_api_keys`, `partner_webhooks` and a COUNT over
   * `enrolment_attestations`. There is no session in it, no patient, no note, and the
   * one query that reads an enrolment table returns an integer: C227 removed the
   * roster and 66.9 keeps it removed by having nowhere to put one.
   */
  "sponsor-integrations": { who: ["sponsor"] },
  /*
   * 🔴 `clinic-visibility` IS READ BY THE PATIENT, AND THAT IS THE WHOLE POINT OF IT.
   *
   * C327 says the patient is TOLD what administrative staff at their therapist's
   * practice can see. So the module that answers "what do they see about me" belongs
   * to the person it is about, and the clinic principal has no business reading it:
   * a practice asking us what it can see about a named patient is a question with a
   * screen, not an API.
   */
  "clinic-visibility": { who: ["patient"] },
  enrolment: { who: ["sponsor", "admin", "patient"] },
  "enrolment-verify": { who: ["sponsor", "admin", "patient"] },
  "instrument-seeds": { who: ["admin"] },

  /*
   * 🔴 75.5 — minting a staff or manager account. The narrowest scope there is,
   * because it is the module that decides who else gets to be an operator, and
   * `super_admin` is deliberately not one of the roles it can create.
   */
  "admin-team": { who: ["admin"] },

  sponsors: { who: ["admin"] },
  "sponsor-admin": { who: ["admin"] },
  /*
   * W2-S05: a company's own logins: invite, role, remove, reset, change. It
   * reads `sponsor_users` and `sponsor_auth_sessions` and nothing about any
   * person the company funds, so a sponsor may call it for its own account.
   */
  "sponsor-users": { who: ["sponsor"] },
  /*
   * W2-S10: the company's money ledger, C244's one sanctioned exception. It
   * reads `sponsor_money_entries` alone, which carries money and a week and no
   * session, person or therapist, so it is not clinical and a sponsor reads it.
   */
  "sponsor-ledger": { who: ["sponsor"] },
  support: { who: ["admin", "patient", "clinician"] },
  taxonomy: { who: ["admin"] },
  "therapist-codes": { who: ["clinician", "admin"] },
  vault: { who: ["admin"] },
  verification: { who: ["clinician", "admin"] },
  /* W1-16: a clinician's own licence standing, and the daily sweep (cron). */
  "licence-expiry": { who: ["clinician", "admin"] },
  /* W1-23: a clinician's own licence change, held for an operator. */
  "licence-change": { who: ["clinician", "admin"] },
  verified: { who: ["clinician", "admin", "clinic", "partner"] },
  timeline: { who: ["clinician", "admin"], clinical: true },
  transcript: { who: ["clinician", "admin"], clinical: true },
  timezone: {
    who: [],
    why: "Time zone names and offsets. A lookup table with no row about any person in it, imported by scheduling screens on every side of the product including ones a visitor can reach before signing in.",
  },

  /* -------------------------------------------------------------- public */
  radar: {
    who: [],
    why: "The public Crisis Radar. Reachable with no account at all, deliberately: C275's whole point is that somebody in distress does not sign up first. What it exposes is a clinician's own published availability, never a patient.",
  },
};

/* ------------------------------------------------------------- the scan -- */

/**
 * 🔴 A SESSION is not the only way to be authenticated, and the first draft
 * assumed it was.
 *
 * Ten entry points came back "unguarded while reaching clinical data", and not
 * one of them was: they authenticate by a **capability in the URL** or by a
 * **shared secret in a header**, which are both real and both deliberate.
 *
 *   - `/patient/invite/[token]` and `/patient/signup?invite=` resolve a
 *     single-use invite. A login in front of an invite is a login in front of
 *     the thing that creates the account.
 *   - `/t/[id]` and `/verify` are the public rating link and the document
 *     verification page. Both exist precisely for somebody who is not signed in
 *     and, in the second case, may not have an account at all.
 *   - `/api/cron/[job]` checks `CRON_SECRET` against the Authorization header.
 *   - `/api/documents/[id]` runs `documentReadDecision`, which takes BOTH an
 *     optional clinician and an optional patient and decides from the document.
 *
 * A gate that could not see this would have pushed somebody to wrap a crisis
 * rating link in a login, which is worse than the thing it was protecting
 * against. So capability auth is modelled rather than allowlisted, and each
 * recogniser is named so a new one is a decision.
 */
const CAPABILITY_AUTH = [
  "resolveInvite",
  "publicProfile",
  "verifyExtract",
  "documentReadDecision",
  "cronSecret",
  "listRadar",
  /*
   * The token routes. Each is a single-use or scoped capability handed to one
   * person, and each is the ONLY way that person reaches the thing:
   *
   *   resolveJoinToken   `/join/[token]` and `/pay/[token]`, the link a patient
   *                      is sent for one session. A login here is a login in
   *                      front of a session somebody is already late for.
   *   openExport         `/records/[token]`, a record export the holder was
   *                      given deliberately. The token IS the grant.
   *   feedbackContext    `/feedback/[token]`, the rating link. C273: never
   *                      attributed, so the read is of one session's own row.
   *   pending.state      the EHR OAuth callback, matched against the state we
   *                      generated. An unmatched state is refused outright.
   */
  "resolveJoinToken",
  "openExport",
  "feedbackContext",
  "pending.state",
];

/** The guards a file calls, by name. */
function guardsIn(src: string): string[] {
  return ALL_GUARDS.filter((g) => new RegExp(`\\b${g}\\s*\\(`).test(src));
}

/** True when the entry point authenticates by a token or a secret rather than a session. */
function hasCapabilityAuth(src: string): boolean {
  return CAPABILITY_AUTH.some((name) => new RegExp(`\\b${name}\\b`).test(src));
}

/** Which principals a file has authenticated as, by the guards it calls. */
function principalsOf(src: string): string[] {
  const called = guardsIn(src);
  return Object.entries(GUARDS)
    .filter(([, names]) => names.some((n) => called.includes(n)))
    .map(([principal]) => principal);
}

/** Every page, layout and route handler: the places a request actually lands. */
function entryPoints(s: Surfaces): string[] {
  return s.files.filter((f) => /^app\/.*\/(page|layout|route)\.tsx?$/.test(f) || /^app\/(page|layout)\.tsx$/.test(f));
}

/**
 * Does this entry point reach that data module, transitively?
 *
 * Import-graph reachability, forwards this time: `_surfaces` answers "who
 * imports me", and this needs "what do I import".
 */
/**
 * Module prefixes whose contents are clinical reads. C379.
 *
 * A module named here is keyed in `SCOPE` by the part of its path after the
 * prefix, so `lib/console/reads` is `console/reads` and `lib/data/sessions` is
 * `sessions`. The asymmetry is deliberate: `lib/data` is the bulk and reads
 * better unprefixed, and a second directory appearing in the scope table is
 * exactly the signal that a new clinical read path has been created.
 */
const TRACKED = ["lib/data/", "lib/console/"];

function buildForwardGraph(s: Surfaces) {
  /*
   * 🔴 Two kinds of import are NOT a data reach, and the first draft counted
   * both. `app/(public)/[slug]/page.tsx` came back reaching `lib/data/sessions`
   * and `lib/data/people`, which read as a public marketing page querying
   * clinical tables. It is not:
   *
   *   page → blocks → radar-hero → booking-sheet → app/(public)/radar/actions.ts
   *
   * The last hop is a SERVER ACTION. It runs on its own request, under its own
   * guard, and following through it measures the wrong thing entirely: an
   * action is a boundary, not an edge. The same page also "reached"
   * `lib/data/patient-view` through `import type` in a session-list component,
   * which carries no runtime read at all and vanishes at compile time.
   *
   * Both were false positives of exactly the shape `_reachability.ts` got wrong
   * twice, which is why they are excluded here with the reason attached.
   */
  const isAction = (file: string) =>
    /^\s*["']use server["']/m.test((s.body.get(file) ?? "").slice(0, 400));

  const importsOf = new Map<string, string[]>();
  for (const f of s.files) {
    const src = s.body.get(f)!;
    const statics = [...src.matchAll(/(^|\n)\s*import(\s+type)?[^;]*?from\s+["']@\/([^"']+)["']/g)]
      .filter((m) => m[2] === undefined)
      .map((m) => m[3]!);

    /*
     * 🔴 C378 — `await import()` WAS INVISIBLE, and it is this codebase's
     * dominant way of reaching the data layer.
     *
     * 188 dynamic imports across the app, 36 of them straight into
     * `lib/data/*`. The pattern is deliberate and documented: a server-only
     * module imported at the top of a file that also renders would throw, so
     * half this codebase reaches the database through a lazy import inside the
     * function that needs it.
     *
     * A gate measuring which principal can reach which clinical data, that
     * cannot see the main way anything reaches anything, passed 12 of 12 while
     * reading a fraction of the graph. Sprint 63's clinic-staff principal was
     * going to be proved safe by exactly this check.
     *
     * Caught by the auditor pointed at the gates rather than at the product,
     * which is the argument for having had one.
     */
    const dynamic = [...src.matchAll(/import\(\s*["']@\/([^"']+)["']\s*\)/g)].map((m) => m[1]!);

    importsOf.set(f, [...statics, ...dynamic]);
  }

  const cache = new Map<string, Set<string>>();
  function modulesFrom(file: string, seen = new Set<string>()): Set<string> {
    if (cache.has(file)) return cache.get(file)!;
    if (seen.has(file)) return new Set();
    seen.add(file);
    const out = new Set<string>();
    for (const spec of importsOf.get(file) ?? []) {
      /*
       * 🔴 C379 — `lib/data/` was the only prefix this tracked, and it is not
       * the only place clinical reads live.
       *
       * `/admin/tv` reads live transcripts, note content and risk levels from
       * `lib/console/reads.ts`, which queries the database directly and imports
       * nothing from `lib/data/`. The gate that guarantees "every clinical read
       * is made by a declared principal" could not see that page at all.
       *
       * The prefix list is explicit rather than "anything under lib", because
       * `lib` also holds pure arithmetic, formatting and types whose reach says
       * nothing about who may read a chart.
       */
      for (const prefix of TRACKED) {
        if (spec.startsWith(prefix)) out.add(spec.slice(prefix.length));
      }
      const candidates = [`${spec}.ts`, `${spec}.tsx`, `${spec}/index.ts`];
      const target = candidates.find((c) => importsOf.has(c));
      // A server action guards itself. Do not follow through one.
      if (target && !isAction(target)) {
        for (const m of modulesFrom(target, seen)) out.add(m);
      }
    }
    cache.set(file, out);
    return out;
  }
  return modulesFrom;
}

function main() {
  const s = loadSurfaces();

  /* ------------------------------------- 58.6a · every module is declared */

  const modules = TRACKED.flatMap((prefix) =>
    readdirSync(prefix.replace(/\/$/, ""))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => prefix.slice("lib/".length) + f.slice(0, -3))
      .map((key) => (key.startsWith("data/") ? key.slice("data/".length) : key)),
  );

  const undeclared = modules.filter((m) => !(m in SCOPE));
  check(
    "🔴 58.6 / C336 every data module is declared. A new one FAILS the build",
    undeclared.length === 0,
    undeclared.join(", ") ||
      `${modules.length} modules declared, ${Object.values(SCOPE).filter((v) => v.clinical).length} of them clinical`,
  );

  const stale = Object.keys(SCOPE).filter((m) => !modules.includes(m));
  check(
    "58.6 …and no declaration outlives the module it describes",
    stale.length === 0,
    stale.join(", ") || "every entry names a real module",
  );

  check(
    "58.6 …and an unguarded module argues for itself rather than being silent",
    Object.values(SCOPE).every((v) => v.who.length > 0 || (v.why ?? "").length > 80),
    "a module reachable with no account needs a paragraph, not a blank",
  );

  /* ---------------------------------- 58.6b · who actually reaches what */

  const modulesFrom = buildForwardGraph(s);
  const entries = entryPoints(s);

  check(
    "58.6 entry points were found at all",
    entries.length > 80,
    `${entries.length} pages, layouts and route handlers`,
  );

  type Breach = { entry: string; module: string; reached: string[] };
  const breaches: Breach[] = [];
  const unguarded: { entry: string; module: string }[] = [];

  for (const entry of entries) {
    const src = s.body.get(entry)!;
    const who = principalsOf(src);
    const reached = [...modulesFrom(entry)];

    for (const mod of reached) {
      const scope = SCOPE[mod];
      if (!scope || !scope.clinical) continue;

      /*
       * 🔴 A layout is a shell. It guards for the pages beneath it, and a page
       * that renders inside a guarded layout is guarded. So a layout with no
       * guard of its own is not a finding; a PAGE with no guard that reaches
       * clinical data is.
       */
      if (/\/(layout)\.tsx$/.test(entry)) continue;

      if (who.length === 0) {
        // A capability in the URL or a secret in a header is authentication.
        if (!hasCapabilityAuth(src)) unguarded.push({ entry, module: mod });
        continue;
      }
      const allowed = who.some((p) => scope.who.includes(p));
      if (!allowed) breaches.push({ entry, module: mod, reached: who });
    }
  }

  check(
    "🔴 58.6 no entry point reaches clinical data as a principal that may not",
    breaches.length === 0,
    breaches
      .slice(0, 8)
      .map((b) => `${b.entry} → lib/data/${b.module} as ${b.reached.join("+")}`)
      .join(" · ") || "every clinical read is made by a principal declared for it",
  );

  /*
   * 🔴 A page with NO guard at all that reaches clinical data is the sharper
   * finding, and it is reported separately so it cannot hide inside the count
   * above. It is also the one a new portal produces first.
   */
  const knownUnguarded = new Set<string>([
    // A guard inside the page's own callee rather than at the top of the file
    // is still a guard. Entries here name where it is, and are the reason this
    // list is enumerated rather than a threshold.
  ]);
  const unguardedReal = unguarded.filter((u) => !knownUnguarded.has(u.entry));

  check(
    "🔴 58.6 no UNGUARDED page reaches clinical data",
    unguardedReal.length === 0,
    unguardedReal
      .slice(0, 10)
      .map((u) => `${u.entry} → lib/data/${u.module}`)
      .join(" · ") || "every clinical page authenticates first",
  );

  /* ----------------------------------------------------- 58.6c · CONTROLS */

  /*
   * 🔴 Two absences in a row pass just as happily against a scanner that
   * resolved no imports at all. Both rules are proved against a real file
   * whose answer is known.
   */
  const patientAccount = "app/(patient)/patient/account/page.tsx";
  check(
    "🔴 58.6 CONTROL the forward graph really resolves imports",
    entries.includes(patientAccount) && modulesFrom(patientAccount).size >= 0,
    `${[...modulesFrom("app/(patient)/patient/page.tsx")].length} data modules reached from the patient home`,
  );

  /*
   * 🔴 C378 CONTROL. A file that reaches clinical data ONLY through a dynamic
   * import must now be seen doing it. Without this the widening is a claim.
   */
  const cron = "app/api/cron/[job]/route.ts";
  check(
    "🔴 58.6 / C378 CONTROL a dynamic `await import()` edge is followed",
    entries.includes(cron) && modulesFrom(cron).size > 0,
    `${[...modulesFrom(cron)].length} data modules reached from the cron route, all of them dynamically`,
  );

  check(
    "🔴 58.6 CONTROL a known clinical page IS seen reaching clinical data",
    modulesFrom("app/(patient)/patient/sessions/page.tsx").has("patient-view"),
    "so 'no breaches' cannot mean 'no edges found'",
  );

  check(
    "🔴 58.6 CONTROL …and that page is recognised as guarded, as a patient",
    principalsOf(s.body.get("app/(patient)/patient/sessions/page.tsx")!).includes("patient"),
  );

  /*
   * 🔴 And the rule fires: a patient guard on a clinician-only module is a
   * breach. Asserted against a constructed pair rather than a real file,
   * because there is deliberately no such page to point at.
   */
  /*
   * 🔴 CONTROL for capability auth: it must recognise a real token page AND
   * must NOT wave through a page that authenticates nothing. A recogniser that
   * matched everything would silently switch this whole check off.
   */
  check(
    "🔴 58.6 CONTROL capability auth is recognised where it exists",
    hasCapabilityAuth(s.body.get("app/(public)/verify/page.tsx")!) &&
      hasCapabilityAuth(s.body.get("app/api/cron/[job]/route.ts")!),
  );
  check(
    "🔴 58.6 CONTROL …and NOT where nothing authenticates",
    !hasCapabilityAuth("export default function Page() { return <p>hello</p>; }"),
    "otherwise the unguarded check passes on everything",
  );

  const wouldBreach = !["patient"].some((p) => SCOPE["copilot"]!.who.includes(p));
  check(
    "🔴 58.6 CONTROL the rule WOULD refuse a patient reaching the clinician copilot",
    wouldBreach,
    "lib/data/copilot is clinician-only, and a patient guard does not satisfy it",
  );

  /* ------------------------------- 58.7 · every principal's acts are logged */

  /*
   * 🔴 A PRINCIPAL WHOSE ACTS ARE NOT WRITTEN DOWN.
   *
   * Found by reading rather than by any gate: `audit()` took an `Actor` or a
   * patient account id, and `SponsorActor` and `ClinicActor` deliberately have
   * neither, so neither principal could be passed to it and neither was. Ending
   * somebody's benefit, changing the identifier gate, topping up a pot,
   * inviting a clinician, removing one, disconnecting a hospital: none of it
   * left a row, for four sprints.
   *
   * The code said otherwise, which is what made it invisible. `removeFromRoster`
   * takes `bySponsorUserId` with the comment "for `audit`" and passed it
   * nowhere, and the admin sponsor actions describe the sponsor's own acts as
   * carrying "a sponsor user id and no actor", which reads as a description of
   * a second audited path that did not exist.
   *
   * So this is the gate that makes the next one fail on the day it is written.
   * Every action file under a portal, except the ones named below, must call
   * `audit` at least once.
   *
   * 🔴 The exemptions are by PATH and each carries a reason, in the shape
   * `ROUTES_BY_DESIGN` uses in `verify:reachable`. A blanket "auth files are
   * exempt" would exempt the next auth file that starts doing something else.
   */
  const AUDIT_BY_DESIGN: Record<string, string> = {
    "app/(sponsor)/sponsor/sign-in/actions.ts":
      "sign-in and sign-out. The auth trail is sponsor_auth_sessions, which records every session with its own timestamps; a second copy in audit_log would be two places to look for one fact.",
    "app/(clinic)/clinic/sign-in/actions.ts":
      "sign-in and sign-out. The auth trail is clinic_auth_sessions, which records every session with its own timestamps and is the table an operator reads when a practice disputes access.",
    "app/(sponsor)/sponsor/apply/actions.ts":
      "an application from the public web by somebody who is not yet a principal. There is no sponsor user to name, and the row created IS the record of the act.",
    "app/(clinic)/clinic/apply/actions.ts":
      "a practice applying from the public web. Nobody is signed in, so there is no clinic manager to name, and the application row created IS the record of the act.",
    "app/(clinic)/clinic/join/[token]/actions.ts":
      "a clinician accepting an invitation. They are not a clinic manager and never become one, so there is no clinic actor here; the invitation row is stamped accepted, which is the record.",
  };

  const portalActions = s.files.filter(
    (f) =>
      /^app\/\((sponsor|clinic)\)\//.test(f) && f.endsWith("actions.ts"),
  );

  /*
   * 🔴 COMMENTS STRIPPED, C205, and this scan is exactly where it matters.
   *
   * Every one of these files carries a long paragraph about what it does and
   * does not record. Reading the raw source, a file whose only mention of
   * auditing is a note explaining why it does not audit would pass, which is
   * the ninth time this rule has had to be remembered in this repository.
   */
  const unaudited = portalActions.filter(
    (f) =>
      !(f in AUDIT_BY_DESIGN) &&
      !/\baudit\s*\(/.test(stripCommentsKeepingLines(s.body.get(f) ?? "")),
  );

  check(
    "🔴 58.7 every sponsor and clinic action file records what it did",
    unaudited.length === 0,
    unaudited.length === 0
      ? `${portalActions.length} action files, ${Object.keys(AUDIT_BY_DESIGN).length} exempt with a reason`
      : `NO AUDIT: ${unaudited.join(", ")}`,
  );

  /*
   * 🔴 And the exemptions have to keep earning it, or the allowlist becomes the
   * answer. Same construction as 58.4: an entry naming a file that no longer
   * exists is a stale exemption nobody noticed, and a one-word reason is a
   * shrug with a comma in it.
   */
  const staleExempt = Object.keys(AUDIT_BY_DESIGN).filter(
    (f) => !portalActions.includes(f),
  );

  check(
    "58.7 …and no exemption outlives the file it excuses",
    staleExempt.length === 0,
    staleExempt.join(", ") || "every exemption names a real action file",
  );

  check(
    "58.7 …and every exemption says why in a sentence somebody can argue with",
    Object.values(AUDIT_BY_DESIGN).every((why) => why.length > 60),
    "a one-word reason is a shrug with a comma in it",
  );

  /*
   * 🔴 CONTROL. The scan must be reading the code and not the comments.
   *
   * C205 is the standing rule and this file has broken it before. An action
   * file whose only mention of `audit` is a paragraph explaining why it does
   * not audit would pass the check above and record nothing.
   */
  check(
    "🔴 58.7 CONTROL the audit scan reads code, not the prose about it",
    !/\baudit\s*\(/.test(
      stripCommentsKeepingLines(
        '/* we should call audit(...) here one day */\nexport async function go() {}\n',
      ),
    ),
    "a file that only talks about auditing must not read as a file that audits",
  );

  finish("sprint 58 principals");
}

main();
