/**
 * 🔴 76.54: WRITES THE LOGIN DOCUMENTS FROM THE THREE CAST FILES.
 *
 *     npm run logins
 *
 *     docs/simulation/01-THE-CAST.md     from scripts/_cast.ts       the run
 *     docs/DEMO.md (one marked block)    from scripts/_demo-cast.ts  the everyday demo
 *     docs/DEMO-LOGINS.md                from scripts/_event-cast.ts the event, shareable
 *
 * 🔴 78.1 — AND THE FIRST OF THEM NOW DESCRIBES PEOPLE WHO ARE GONE.
 *
 * `seed:demo` wiped the production database and seeded the demo cast in its
 * place, so `verify:cast` reads red on production and that is correct rather
 * than broken. The generated document says so at the top, because a login list
 * that quietly stops working is the failure this whole generator exists to
 * prevent, and the document is the only place a person looking for Nour would
 * think to check.
 *
 * 🔴 AND IT SAYS WHAT WAS ACTUALLY THERE. The first draft of that banner said
 * the wipe took six months of records, because that is what the document around
 * it describes. Production was read before the wipe and held the starting
 * position and nothing else: nine operator accounts, two organisations, three
 * sponsor applications and one test person with one session. A note that
 * overstates what was destroyed is as wrong as one that hides it, and it is the
 * kind of wrong that makes somebody restore a snapshot they did not need.
 *
 * ## Why this is generated
 *
 * The run leaves six months of records on production and nothing deletes them,
 * so the document that says how to sign in as each person is the document that
 * makes the whole run readable afterwards. A login list maintained by hand goes
 * stale the first time somebody renames a cast member, and you find out which
 * two rows are wrong while trying to open a record.
 *
 * `_cast.ts` is the one list. `verify:cast` checks it against the database and
 * checks the password actually works. This turns it into prose. All three read
 * the same array, so they cannot disagree.
 *
 * ## 🔴 THE PASSWORD IS IN THE FILE, AND THAT IS FINE HERE AND NOWHERE ELSE
 *
 * `Simulation2026!` opens twenty six invented accounts belonging to nobody, on a
 * database whose keys are rotated the day the run ends. It is written down
 * because a founder who cannot get in cannot read the thing this was all for.
 *
 * The day a real person signs up, this document describes accounts that must be
 * deleted rather than accounts somebody may sign into, and `08-THE-END.md` says
 * so. That is a different document's job and it is not softened here.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { CAST, type CastMember, PAYROLL, SIMULATION_PASSWORD, WITH_LOGINS } from "./_cast";
import { DEMO_LOGINS, DEMO_PASSWORD, UNCLAIMED_EMAIL, isPrivateLogin } from "./_demo-cast";
import { EVENT, EVENT_LOGINS, EVENT_PASSWORD, SITE } from "./_event-cast";

const PATH = "docs/simulation/01-THE-CAST.md";
/*
 * 🔴 The event cast's sheet, `DEMO-LOGINS.md`, is the one handed to strangers,
 * so it must name only logins that may be shared. The everyday cast lists the
 * console, so it is not on that sheet: since 2026-10-01 it is a generated block
 * inside the hand-written `docs/DEMO.md` (it was `docs/DEMO-CAST.md` before).
 */
const DEMO_PATH = "docs/DEMO.md";
const DEMO_START = "<!-- logins:demo-cast:start -->";
const DEMO_END = "<!-- logins:demo-cast:end -->";
const EVENT_PATH = "docs/DEMO-LOGINS.md";

/**
 * Replace what sits between two marker lines in a hand-written document, and
 * nothing else. Throws when either marker is missing, so a renamed heading or a
 * deleted marker is a loud failure rather than a block appended somewhere odd.
 */
function writeBlock(path: string, start: string, end: string, body: string): void {
  const doc = readFileSync(path, "utf8");
  const from = doc.indexOf(start);
  const to = doc.indexOf(end);
  if (from < 0 || to < from) {
    throw new Error(`${path} has no ${start} ... ${end} block to replace`);
  }
  writeFileSync(path, `${doc.slice(0, from + start.length)}\n${body}\n${doc.slice(to)}`);
}

/** Which agent in `02-THE-MONTH.md` plays each cast member. */
const AGENT: Record<string, string> = {
  OP: "OPS", OP2: "OPS", SU1: "OPS", SU2: "OPS", SU3: "OPS", SU4: "OPS", SU5: "OPS",
  T1: "THERAPISTS-A", T2: "THERAPISTS-A", T3: "THERAPISTS-A",
  T4: "THERAPISTS-B", T5: "THERAPISTS-B", T6: "THERAPISTS-B",
  "C1-M": "CLINIC", "C1-S": "CLINIC", "C1-A": "CLINIC",
  "E1-HR": "COMPANIES", "E2-HR": "COMPANIES", "E3-HR": "COMPANIES",
  P1: "PATIENTS-A", P2: "PATIENTS-A", P3: "PATIENTS-A",
  P4: "PATIENTS-B", P5: "PATIENTS-B", P6: "PATIENTS-B", P7: "PATIENTS-B",
  D1: "PARTNER-WEB",
};

const DOOR: Record<CastMember["as"], string> = {
  operator: "`/staff/sign-in`",
  staff: "`/staff/sign-in`",
  therapist: "`/login`",
  patient: "`/patient/login`",
  "practice manager": "`/clinic/sign-in`",
  "practice staff": "`/clinic/sign-in`",
  employer: "`/sponsor/sign-in`",
  partner: "`/partner/sign-in`",
};

function main(): void {
  const rounds = [...new Set(CAST.map((person) => person.wave))].sort();
  const missing = CAST.filter((person) => !AGENT[person.key]);
  if (missing.length > 0) throw new Error(`no agent for ${missing.map((p) => p.key).join(", ")}`);

  const lines: string[] = [
    "# The cast",
    "",
    "Generated by `npm run logins` from `scripts/_cast.ts`. Edit that file, not this one.",
    "",
    "**Status (2026-10-01).** The one-month run with this cast finished on 2026-09-26, and",
    "`seed:demo -- --scenario=event` then replaced it on production with the event cast",
    "(`docs/DEMO-LOGINS.md`). These logins open only on a database seeded with this cast, so",
    "`verify:cast` reads red on production by design. Re-running the month starts from",
    "`00-START-HERE.md`.",
    "",
    "Everybody here is invented. Every address is `@example.com`, so no message to any of them",
    "is sent: it is kept in `sim_outbox` and read with",
    "`npm run on:production -- sim:inbox -- <address or phone>`. The founder plays the console",
    "under their own login, which is the one real inbox in the run.",
    "",
    "One password opens every account below:",
    "",
    "    " + SIMULATION_PASSWORD,
    "",
    "It opens invented accounts only, which is why it may be written here. Patients sign up with",
    "a phone number and may add an email; they can sign in with either, by password or by a code",
    "kept in the outbox. `npm run on:production -- verify:cast` checks every login opens.",
    "",
    "| | |",
    "| --- | --- |",
    `| Cast members who sign up during the month | ${String(CAST.filter((p) => p.arrives === "signs up").length)} |`,
    `| Our own staff, seeded by \`simulate:seed\` | ${String(PAYROLL.length)} |`,
    `| Joins by link and never has an account | ${String(CAST.filter((p) => p.arrives === "never signs up").length)} |`,
    `| **People** | **${String(CAST.length)}** |`,
    `| **Accounts that must open with the password** | **${String(WITH_LOGINS.length)}** |`,
    "",
  ];

  for (const round of rounds) {
    lines.push(
      `## First acting in round R${String(round)}`,
      "",
      "| Key | Who | Signs in at | With | Played by | Their month |",
      "| --- | --- | --- | --- | --- | --- |",
    );
    for (const person of CAST.filter((p) => p.wave === round)) {
      const handle = person.email
        ? person.phone
          ? `${person.email}, or \`${person.phone}\``
          : person.email
        : "no account, joins by link";
      lines.push(
        `| \`${person.key}\` | ${person.name} | ${person.email ? DOOR[person.as] : "the join link"} | ${handle} | ${AGENT[person.key]!} | ${person.record} |`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Our own staff and the queue each works",
    "",
    "| Who | Role | The queue that is theirs |",
    "| --- | --- | --- |",
    ...PAYROLL.map((p) => `| ${p.name} | \`${p.payroll.role}\` | ${p.payroll.queue} |`),
    "",
    "The founders are `super_admin` and the rest are `staff`. A staff member opening a",
    "founder-only screen is refused, and that refusal is flow `AD3`.",
    "",
  );

  writeFileSync(PATH, lines.join("\n"));
  console.log(`\n  ${PATH}: ${String(CAST.length)} people, ${String(rounds.length)} rounds.`);

  writeBlock(DEMO_PATH, DEMO_START, DEMO_END, demoDoc().join("\n"));
  console.log(`  ${DEMO_PATH} (the everyday cast block): ${String(DEMO_LOGINS.length)} logins.`);

  writeFileSync(EVENT_PATH, eventDoc().join("\n"));
  console.log(`  ${EVENT_PATH}: ${String(EVENT_LOGINS.length)} logins.\n`);
}

/** A table cell: no pipe may break the row. */
const cell = (text: string) => text.replace(/\|/g, "/");

/**
 * 🔴 THE LOGINS HANDED TO STRANGERS AT AN EVENT, from `_event-cast.ts`.
 *
 * `verify:event-demo` signs in as every row of this table, from the same array,
 * so the sheet somebody photographs at a stand cannot name a login that does not
 * open. The console and the support account are not in it and never will be:
 * they keep the private password, and this file is public.
 */
function eventDoc(): string[] {
  return [
    "# 24Therapy demo logins",
    "",
    "🔴 **Generated by `npm run logins` from `scripts/_event-cast.ts`. Do not edit it by hand.**",
    "",
    "Everyone below is invented, and every address is at `example.com`, so nothing the product",
    "sends to them reaches a real inbox. These logins are for sharing: hand them to anyone.",
    "",
    "One password for every login below:",
    "",
    "    " + EVENT_PASSWORD,
    "",
    "The story is the founders' demo video. **Mariam Hassan** works at **Cairo Foundry**, which pays",
    "for its staff's therapy. She has seen **Dr Karim Nabil** four times about work stress, sleep",
    "and a manager who messages at midnight, and she is booked with him again tomorrow. Around",
    "them: a second company paying half, a clinic with a week of bookings, ten more clinicians",
    "(most in Cairo, from Heliopolis to New Cairo, four in Alexandria and one in Mansoura),",
    "patients who pay for themselves, and a record that moved from one therapist to another.",
    "",
    "## Who to sign in as",
    "",
    "| Who | Role | Email | Password | Sign in at | Try this |",
    "| --- | --- | --- | --- | --- | --- |",
    ...EVENT_LOGINS.map(
      (l) =>
        `| ${cell(l.who)} | ${cell(l.role)} | \`${l.email}\` | \`${EVENT_PASSWORD}\` | ${SITE}${l.where} | ${cell(l.tryThis)} |`,
    ),
    "",
    "## Good to know",
    "",
    `- \`${EVENT.unclaimed}\` (Hoda Ibrahim) has no login on purpose: Dr Salma wrote her record`,
    "  and she has never claimed it, which is the state the claim flow exists for.",
    "- The partner's sandbox key is printed once, when the cast is seeded, and is never written",
    "  here. Ask whoever seeded it, or make a new one from the partner portal.",
    "- The clinicians are invented. Booking one works, but do not transfer any money for it:",
    "  the session is with nobody.",
    "",
    "## For whoever reseeds it",
    "",
    "    npm run on:production -- seed:demo -- --scenario=event",
    "    npm run on:production -- verify:event-demo",
    "",
    "The seed wipes every person on the database and writes this cast; configuration, prices",
    "and the published website are kept, and counted before and after. The verifier signs in",
    "as every row above, checks each company's pot against its ledger, and checks every",
    "clinician is visible to patients. The platform console and the support account keep the",
    "private password and are deliberately absent from this page.",
    "",
  ];
}

/**
 * 🔴 THE LIST THAT OPENS THE DEPLOYED PRODUCT TODAY.
 *
 * Generated from `_demo-cast.ts` for the same reason as the one above: the seed
 * writes those people, `verify:demo` reads them back and checks the password
 * actually opens the account, and this turns the array into prose. Three
 * readers, one array, and no chance of the document being right about ten of
 * eleven.
 */
function demoDoc(): string[] {
  return [
    "",
    "Generated by `npm run logins` from `scripts/_demo-cast.ts`, between the two markers. Edit",
    "that file, not this block.",
    "",
    "Seeded by `seed:demo` in any of its five positions. The event cast (`--scenario=event`)",
    "replaces it; which one a database holds is whichever was seeded last.",
    "",
    "One password for every patient, clinician and the clinic:",
    "",
    "    " + DEMO_PASSWORD,
    "",
    "🔴 **Except three, which never take it:** the platform admin, the support account and the",
    "company. This repository is public, so a password written here is a password every reader",
    "holds, and those three open the production console and a company's money. Their password",
    "is `DEMO_PRIVATE_PASSWORD` in the operator's own `.env.local`, which is never committed;",
    "without it the seed gives each a random password nobody is told.",
    "",
    "`npm run on:production -- verify:demo` reads every row back out of the database, checks",
    "the password actually opens it (and that the published one does NOT open the three),",
    "and checks that what each portal would show is not",
    "empty. The second half is the one that matters: a seed can write every row correctly and",
    "still produce a caseload the clinician cannot see.",
    "",
    "#### Who they are",
    "",
    "| Who | Sign-in page | Address |",
    "| --- | --- | --- |",
    ...DEMO_LOGINS.map(
      (l) =>
        `| ${l.who}${isPrivateLogin(l.email) ? " (private password)" : ""} | \`${l.where}\` | \`${l.email}\` |`,
    ),
    "",
    "#### The one with no way in, which is a state rather than a gap",
    "",
    `\`${UNCLAIMED_EMAIL}\` has a record on Dr Omar's list with her address on it, a session`,
    "behind her and **no account**. She has never claimed it. That is the state the whole",
    "claim flow exists for and the one nobody ever has on a test database, so it is seeded",
    "deliberately and `verify:demo` fails if anything gives her a login.",
    "",
    "#### What each one opens onto",
    "",
    "| Login | Not empty because |",
    "| --- | --- |",
    "| Platform admin | a verification waiting, a confirmed transfer, a payout to send, a support ticket, 20 ledger entries |",
    "| Company | a pot with money in it, three sessions it paid 60 per cent of, one employee enrolled |",
    "| Clinic manager | two clinicians on seats, eight sessions between them |",
    "| Therapist, solo | three patients, nine completed sessions with approved notes, one booked ahead |",
    "| Therapist, clinic (Sara) | two patients, four sessions, one record handed to her by another practice |",
    "| Therapist, clinic (Kareem) | one patient, four sessions |",
    "| Clinician still applying | **nothing, deliberately.** This is the screen between applying and being let in |",
    "| Patients | sessions, an approved summary, homework and a journal each |",
    "| Patient, not enrolled (Omar) | 500 cents in his wallet, spent automatically on his next booking (ruling 7) |",
    "| Every clinician | mornings bookable online or in person at an invented practice, afternoons online (ruling 5c) |",
    "",
    "#### Console accounts ask for a second step",
    "",
    "After the password, the admin and support accounts ask for a code: from an authenticator",
    "app once one is added at `/admin/security`, otherwise by email. The support account's",
    "address is invented, so its email code arrives nowhere. To walk it, add an authenticator",
    "to it while signed in, or give it an address that receives mail.",
  ];
}

main();
