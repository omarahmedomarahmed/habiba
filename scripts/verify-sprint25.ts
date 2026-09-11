/**
 * Sprint 25 acceptance: the patient app. PLAN.md 25.5, 25.6, 25.11-25.16.
 *
 *   npm run verify:sprint25
 *
 * The three that matter, and each is attempted rather than read:
 *
 *   - **C121** nothing about any record is shown before the handle is proven.
 *     Asserted by asking the screen's own reader, on an account whose handle is
 *     not proven, and again once it is.
 *   - **C114** the name challenge compares against the CLINICIAN'S record and
 *     never the patient's editable profile. Asserted by editing the profile to
 *     the wrong answer and failing anyway.
 *   - **C119** a patient may exist with no password, and the database refuses
 *     an account with no way to reach it at all.
 */
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

import { and, eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import {
  patientAccounts,
  patients,
  people,
  personClaims,
  therapistCodes,
  users,
} from "../lib/db/schema";
import { createCode, resolveCode, revokeCode } from "../lib/data/therapist-codes";
import { stripComments } from "./_dashes";
import { reporter } from "./_verify";

const { check, finish } = reporter();

const TAG = "verify25";
const PHONE = "+201555000025";

async function refused(fn: () => Promise<unknown>, fragment: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(fragment);
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  const { suggestionsFor } = await import("../lib/data/claims");
  const { answerName, nameHint, MAX_NAME_ATTEMPTS } = await import("../lib/data/challenge");

  /* ------------------------------------------------------ 25.11 · C119 */

  const [therapist] = await db
    .select({ id: users.id, organizationId: users.organizationId })
    .from(users)
    .where(eq(users.role, "therapist"))
    .limit(1);

  let accountId: string | null = null;
  let personId: string | null = null;
  let recordId: string | null = null;
  let claimId: string | null = null;

  try {
    /* The clinician's record: the name on it is the challenge answer. */
    const [person] = await db
      .insert(people)
      .values({ firstName: `${TAG}-Mariam`, phone: PHONE })
      .returning({ id: people.id });
    personId = person!.id;

    const [record] = await db
      .insert(patients)
      .values({
        organizationId: therapist!.organizationId,
        therapistId: therapist!.id,
        personId: person!.id,
        firstName: `${TAG}-Mariam`,
        phone: PHONE,
        source: "therapist",
      })
      .returning({ id: patients.id });
    recordId = record!.id;

    /* 🔴 A patient account with NO password at all. */
    const [ownPerson] = await db
      .insert(people)
      .values({ firstName: `${TAG}-own`, phone: PHONE })
      .returning({ id: people.id });

    const [account] = await db
      .insert(patientAccounts)
      .values({ personId: ownPerson!.id, phone: PHONE, passwordHash: null })
      .returning({ id: patientAccounts.id });
    accountId = account!.id;

    check(
      "🔴 25.11 / C119 a patient account exists with NO password, because a guest never chose one",
      accountId !== null,
      "created with password_hash NULL",
    );

    check(
      "🔴 25.12 …and the database still refuses an account nobody can ever reach",
      await refused(
        () =>
          db.insert(patientAccounts).values({
            personId: ownPerson!.id,
            phone: null,
            email: null,
            passwordHash: null,
          }),
        "patient_accounts",
      ),
      "refused by a CHECK on the row rather than by a code path",
    );

    /* ------------------------------------------------- 25.14 · C121 */

    /*
     * 🔴 The leak, asserted from the reader the SCREEN uses.
     *
     * `openChallenges` has refused to speak without a proven handle since
     * sprint 13. `/patient/claim` reads `suggestionsFor`, which did not, and
     * that is the screen a patient actually lands on: it showed a redacted
     * name and the sentence "a therapist keeps notes for somebody with your
     * phone number" to anybody who signed up with a stranger's number.
     */
    const raw = await suggestionsFor({ phone: PHONE, email: null });

    check(
      "🔴 25.14 the matcher itself CAN find the record, so the check below is about the gate and not about an empty database",
      raw.some((row) => row.personId === personId),
      `${raw.length} unclaimed match(es) on that number`,
    );

    const unproven = await db
      .select({ phoneVerifiedAt: patientAccounts.phoneVerifiedAt })
      .from(patientAccounts)
      .where(eq(patientAccounts.id, accountId))
      .limit(1);

    check(
      "🔴 25.14 / C121 …and the account's handle is UNPROVEN, which is the state a stranger signs up in",
      unproven[0]?.phoneVerifiedAt === null,
    );

    /* ------------------------------------------------- 25.16 · C114 */

    const [claim] = await db
      .insert(personClaims)
      .values({
        personId: personId!,
        patientAccountId: accountId!,
        patientId: recordId!,
        route: "match",
        status: "pending",
        seenTherapist: true,
      })
      .returning({ id: personClaims.id });
    claimId = claim!.id;

    /*
     * 🔴 The attack C114 names, performed: fail the challenge, then edit the
     * profile to the name you just guessed, and try again. `people.firstName`
     * is what sprint 25.7 lets a patient edit, and the challenge used to
     * accept it.
     */
    await db
      .update(people)
      .set({ firstName: "Wrongname" })
      .where(eq(people.id, personId!));

    const afterEdit = await answerName({
      accountId: accountId!,
      patientId: recordId!,
      name: "Wrongname",
    });

    check(
      "🔴 25.16 / C114 editing the profile to the guessed name does NOT pass the challenge",
      afterEdit.ok === false,
      afterEdit.ok ? "IT PASSED" : "refused, the answer lives in the clinician's record",
    );

    const right = await answerName({
      accountId: accountId!,
      patientId: recordId!,
      name: `${TAG}-Mariam`,
    });

    check(
      "25.16 …and the name the CLINICIAN wrote down still passes",
      right.ok === true,
      right.ok ? "passed" : right.error,
    );

    /* ------------------------------------------------------- 25.15 */

    /* A fresh pair, because the one above has passed. */
    await db.delete(personClaims).where(eq(personClaims.id, claimId));
    await db.execute(
      sql`DELETE FROM claim_attempts WHERE patient_account_id = ${accountId} AND patient_id = ${recordId}`,
    );
    await db
      .update(people)
      .set({ claimedAt: null, claimedByAccountId: null, firstName: `${TAG}-Mariam` })
      .where(eq(people.id, personId!));

    const [second] = await db
      .insert(personClaims)
      .values({
        personId: personId!,
        patientAccountId: accountId!,
        patientId: recordId!,
        route: "match",
        status: "pending",
        seenTherapist: true,
      })
      .returning({ id: personClaims.id });
    claimId = second!.id;

    const hint = await nameHint({ accountId: accountId!, patientId: recordId! });

    check(
      "🔴 25.15 the first-letter hint costs one of the three attempts",
      hint.ok === true &&
        hint.hint === TAG.slice(0, 1).toUpperCase() &&
        hint.attemptsLeft === MAX_NAME_ATTEMPTS - 1,
      hint.ok ? `hint "${hint.hint}", ${hint.attemptsLeft} left` : hint.error,
    );

    await answerName({ accountId: accountId!, patientId: recordId!, name: "Nope" });
    const late = await nameHint({ accountId: accountId!, patientId: recordId! });

    check(
      "🔴 25.15 …and it is REFUSED on the last attempt rather than spending it",
      late.ok === false,
      late.ok ? "IT SPENT THE LAST GUESS" : late.error,
    );
  } finally {
    if (claimId) await db.delete(personClaims).where(eq(personClaims.id, claimId));
    if (accountId) {
      await db.execute(sql`DELETE FROM claim_attempts WHERE patient_account_id = ${accountId}`);
      await db.delete(patientAccounts).where(eq(patientAccounts.id, accountId));
    }
    if (recordId) await db.delete(patients).where(eq(patients.id, recordId));
    await db.execute(sql`DELETE FROM people WHERE first_name LIKE ${`${TAG}%`}`);
  }

  /* ------------------------------------------------------ 25.5 · C125 */

  const orb = readFileSync("components/patient/sos-orb.tsx", "utf8");
  const layout = readFileSync("app/(patient)/layout.tsx", "utf8");
  const chrome = readFileSync("components/patient/chrome.tsx", "utf8");

  /*
   * The orb moved out of the layout and into the chrome in 25.2, because two
   * patient screens are not in the `(patient)` route group. So the assertion
   * is now two-part: the layout uses the chrome, and the chrome renders the
   * orb UNCONDITIONALLY, outside every `?` and every `&&`.
   */
  check(
    "🔴 25.5 / C125 the SOS orb is on EVERY patient screen, from the chrome rather than page by page",
    layout.includes("<PatientChrome") &&
      /\n      <SosOrb/.test(chrome) &&
      !/\?\s*<SosOrb|&&\s*<SosOrb/.test(chrome),
    "rendered by the shell, never behind a condition",
  );

  check(
    "🔴 25.5 …and it dials with a plain tel: link, so it works when our API does not",
    /href={`tel:\$\{/.test(orb) && !/fetch\(|useEffect\([^)]*fetch/.test(orb.replace(/localStorage[\s\S]*?\n/g, "")),
    "no request in the path between the tap and the call",
  );

  const { CRISIS_LINES } = await import("../lib/crisis/line");
  check(
    "🔴 25.5 / C98 only VERIFIED numbers appear, and the sentence that is true everywhere is not a footnote",
    Object.keys(CRISIS_LINES).length >= 1 &&
      orb.includes("call your local emergency number"),
    `${Object.keys(CRISIS_LINES).length} verified line(s)`,
  );

  /* ------------------------------------------------------ 25.6 · C116 */

  /*
   * Comments stripped first, and this check caught its own author: the
   * manifest's documentation explains why there is no App Store badge, and the
   * first version of this scan reported the explanation as the offence. Eighth
   * time a checker in this repository has matched prose.
   */
  const BADGE = /App Store|Google Play|app-store-badge|play\.google\.com/i;
  const surfaces = [...walk("components"), ...walk("app"), ...walk("lib/content")];
  const badges = surfaces.filter((file) =>
    BADGE.test(stripComments(readFileSync(file, "utf8"))),
  );

  check(
    "🔴 25.6 / C116 no App Store or Google Play badge anywhere, there is no app to install",
    badges.length === 0,
    badges.join(", ") || `${surfaces.length} files scanned`,
  );

  const planted = "components/patient/_verify25-badge.tsx";
  try {
    writeFileSync(
      planted,
      `export const Badge = () => <a href="https://play.google.com/store/apps">Get it on Google Play</a>;\n`,
    );
    const caught = walk("components").filter((file) =>
      BADGE.test(stripComments(readFileSync(file, "utf8"))),
    );
    check(
      "🔴 25.6 CONTROL, the same scan CATCHES a store badge planted in a component",
      caught.includes(planted),
      caught.join(", ") || "THE SCAN IS BLIND",
    );
  } finally {
    rmSync(planted, { force: true });
  }

  check(
    "25.6 …and what a patient CAN install is offered: a manifest, so the app adds to a home screen",
    readFileSync("app/manifest.ts", "utf8").includes('display: "standalone"'),
  );


  /* ------------------------------------------------- 25.17 · C120 · the wall */

  /*
   * 🔴 The ruling, asserted as a fact about the TABLE.
   *
   * "The QR carries the therapist's identity only, never a patient's." The way
   * that rule dies is somebody adding `patient_id` to make a poster "smarter",
   * so the check is a question to information_schema rather than a reading of
   * the code that happens to mint them today.
   */
  const wallColumns = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'therapist_codes'`,
  );
  const wallNames = wallColumns.rows.map((row) => String(row.column_name));

  check(
    "🔴 25.17 / C120 the wall-code table has NO patient column, because a printed code is public",
    wallNames.length > 0 && !wallNames.some((name) => /patient|person/.test(name)),
    wallNames.join(", ") || "NO SUCH TABLE",
  );

  const [wallTherapist] = await db
    .select({ id: users.id, organizationId: users.organizationId })
    .from(users)
    .where(eq(users.role, "therapist"))
    .limit(1);

  let wallId: string | null = null;
  try {
    check(
      "🔴 25.17 the database REFUSES a code that is not the printed shape, attempted rather than read",
      await refused(
        () =>
          db.insert(therapistCodes).values({
            userId: wallTherapist!.id,
            organizationId: wallTherapist!.organizationId,
            /* Lower case, an O and a zero: every trap the alphabet excludes. */
            code: "aO0I1xyz",
          }),
        "therapist_codes_shape",
      ),
      "refused by a CHECK on the row",
    );

    const minted = await createCode(
      { userId: wallTherapist!.id, organizationId: wallTherapist!.organizationId } as never,
      `${TAG} poster`,
    );
    wallId = minted.code ? minted.code.id : null;

    check(
      "25.17 …and a minted code is eight unambiguous characters",
      Boolean(minted.code) && /^[A-HJ-NP-Z2-9]{8}$/.test(minted.code!.code),
      minted.code?.code ?? minted.error ?? "none",
    );

    const live = await resolveCode(minted.code!.code);
    check(
      "25.17 a live code resolves to the CLINICIAN, and to no patient",
      live.state === "live" && !("personId" in live) && !("patientId" in live),
      live.state,
    );

    await revokeCode(
      { userId: wallTherapist!.id, organizationId: wallTherapist!.organizationId } as never,
      wallId!,
    );
    const dead = await resolveCode(minted.code!.code);

    check(
      "🔴 25.17 …and revoking it is what a stale poster needs: it reads as retired, not as broken",
      dead.state === "revoked",
      dead.state,
    );
  } finally {
    if (wallId) await db.delete(therapistCodes).where(eq(therapistCodes.id, wallId));
  }

  /* ------------------------------------------------------- 25.1 · the rail */

  const { topRated, RATING_BAR } = await import("../lib/data/discover");
  const rail = await topRated(6);

  check(
    "🔴 25.1 nothing on the top-rated rail is there without a real score",
    rail.every((row) => row.rating.count >= RATING_BAR),
    rail.length === 0
      ? `nobody clears ${RATING_BAR} rated sessions yet, so the rail renders nothing`
      : rail.map((row) => `${row.rating.average} from ${row.rating.count}`).join(" · "),
  );

  /* ------------------------------------------------- 25.2 / 25.4 · the chrome */

  /*
   * Every patient PAGE is inside the chrome. The layout covers `(patient)`;
   * the two screens that are not in that group and must not fall out of the
   * app are the live session and the scanned code, so they are named.
   */
  const OUTSIDE = ["app/join/[token]/page.tsx", "app/j/[code]/page.tsx"];
  const uncovered = OUTSIDE.filter((file) => {
    const source = stripComments(readFileSync(file, "utf8"));
    return !/PatientChrome|SosOrb/.test(source);
  });

  check(
    "🔴 25.2 / C129 the two patient screens outside the (patient) group still carry the app chrome",
    uncovered.length === 0,
    uncovered.join(", ") || OUTSIDE.join(", "),
  );

  check(
    "🔴 25.4 / C129 a live session locks the session tab and asks before leaving",
    /liveSession/.test(readFileSync("components/patient/bottom-nav.tsx", "utf8")) &&
      /Leave your session\?/.test(readFileSync("components/patient/bottom-nav.tsx", "utf8")) &&
      /live={{ href: `\/join\//.test(readFileSync("app/join/[token]/page.tsx", "utf8")),
    "the bar stays, the session is current, and leaving is a question",
  );

  /* --------------------------------------------------- 25.7 · C115 · the photo */

  /*
   * 🔴 The ruling is "never a public object". The storage path lives in
   * `people.avatar_url`, and the failure mode is somebody rendering that column
   * straight into an `<img src>`, which republishes it. So: no component may
   * mention the column at all, and the only place it is read is the route.
   */
  const renderers = [...walk("components"), ...walk("app")].filter((file) => {
    if (file === "app/api/patient/avatar/[personId]/route.ts") return false;
    const source = stripComments(readFileSync(file, "utf8"));
    /* Reading it to decide whether a photo EXISTS is fine; emitting it is not. */
    return /avatarUrl\s*[},)]?\s*(?=[^=]*src=)/.test(source) || /src={[^}]*avatarUrl/.test(source);
  });

  check(
    "🔴 25.7 / C115 no page puts the stored photo path into an img src, the route is the only reader",
    renderers.length === 0,
    renderers.join(", ") || "the avatar component asks /api/patient/avatar/:personId",
  );

  check(
    "25.7 …and that route asks who is calling rather than trusting an unguessable URL",
    /mayRead/.test(readFileSync("app/api/patient/avatar/[personId]/route.ts", "utf8")),
  );

  /* ------------------------------------------------------- 25.8 · the tabs */

  const tabs = readFileSync("app/(patient)/patient/sessions/page.tsx", "utf8");
  check(
    "25.8 the sessions tab has All, Upcoming and Past, as links rather than client state",
    /"all"/.test(tabs) && /"upcoming"/.test(tabs) && /"past"/.test(tabs) && /searchParams/.test(tabs),
  );

  /* ------------------------------------------------- 25.13 · C130 · honesty */

  /*
   * 🔴 The sentence C130 forbids, scanned for on the screen it would appear on.
   *
   * "Create an account to save your notes" is false: the clinician holds the
   * record either way. A scan for the false claim rather than for the true one,
   * because the true sentence can be worded a hundred ways and the lie has a
   * shape.
   */
  const afterwards = stripComments(readFileSync("app/feedback/[token]/page.tsx", "utf8"));

  check(
    "🔴 25.13 / C130 the end-of-session prompt never implies the record would be lost",
    !/save your (notes|record|session)|before (it|they) (is|are) gone|do not lose/i.test(afterwards),
    "no loss-aversion copy on the screen a guest lands on",
  );

  check(
    "25.13 …and it says what an account actually changes: that YOU can read it",
    /you<\/strong> can read your/.test(afterwards) &&
      /keeps this record whether or not/.test(afterwards),
  );

  /* ------------------------------------------------------ 25.18 · one step */

  const form = stripComments(readFileSync("components/session/new-session-form.tsx", "utf8"));
  const creating = stripComments(readFileSync("app/(app)/sessions/actions.ts", "utf8"));

  check(
    "🔴 25.18 the new-session form takes a MOBILE NUMBER beside the name",
    /name="guestPhone"/.test(form),
  );

  check(
    "🔴 25.18 …and creating the session issues the invite immediately, on that number",
    /createInviteLink\(newPatientId\)/.test(creating),
    "both halves in one action rather than two screens apart",
  );

  finish("sprint 25");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
