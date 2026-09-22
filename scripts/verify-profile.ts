/**
 * 🔴 76.40 — THE PATIENT PROFILE, AND THE INVITATION THAT HAS TO ACTUALLY WORK.
 *
 *   npm run verify:profile
 *
 * ## What this is for
 *
 * A profile page is mostly presentation, and presentation is the part of a
 * product that gates habitually skip. Three things on it are not presentation
 * at all, and each of the three has a way of being wrong that compiles, renders
 * and looks completely fine:
 *
 *   1. **The invitation books a real, paid session.** "One click invite to a
 *      paid session, make sure it actually works" is the request. A button that
 *      creates a session with no join token, or with a price of nothing, or
 *      attached to no patient, does not announce itself.
 *   2. **The copilot on the profile is the SAME thread as the copilot page.**
 *      Two surfaces rendering one conversation is one thread; two surfaces each
 *      loading their own is two memories of one patient, and the one a
 *      clinician is not looking at is the one holding the correction.
 *   3. **The headshot goes through the authenticated route.** C115 stores a
 *      patient's photograph private and serves it through a route that asks who
 *      is looking. A page that reads `people.avatarUrl` into an `<img src>`
 *      renders exactly the same picture and makes it a public object.
 *
 * Rows for 1 and 2, source for 3. Everything created is deleted in a `finally`
 * and `writesTo()` refuses production by name.
 */
import { sql } from "drizzle-orm";

import { readSource, reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `prof${Date.now().toString(36)}`;

const PAGE = "app/(app)/patients/[id]/page.tsx";
const COPILOT_PAGE = "app/(app)/copilot/[patientId]/page.tsx";
const ACTIONS = "app/(app)/patients/actions.ts";
const DOC_ACTIONS = "app/(app)/patients/[id]/documents/actions.ts";

async function main() {
  writesTo();

  const { db, pool } = connect();

  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };

  try {
    /* ================================================================ */
    /*  1 · ONE TAP FROM A PROFILE TO A PAID SESSION                     */
    /* ================================================================ */

    const org = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug, kind)
      VALUES ('Profile Demo Practice', 'eg', ${fixture}, 'solo') RETURNING id`);

    const RATE = 4500;

    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash,
                         session_rate_cents)
      VALUES (${org.id}, ${`mona.${fixture}@example.com`}, 'Mona', 'Demo', 'therapist', 'x', ${RATE})
      RETURNING id`);

    const actor = {
      userId: therapist.id,
      organizationId: org.id,
      role: "therapist" as const,
      email: `mona.${fixture}@example.com`,
      firstName: "Mona",
      lastName: "Demo",
      timezone: "UTC",
    };

    const reachable = await one<{ id: string }>(sql`
      INSERT INTO patients (organization_id, therapist_id, first_name, last_name, phone, source)
      VALUES (${org.id}, ${therapist.id}, 'Yara', 'Demo', '+201009000101', 'therapist')
      RETURNING id`);

    /*
     * 🔴 THE DATA MODULE, NOT THE SERVER ACTION, and that is the whole reason
     * there is one. `inviteToPaidSession` reads the signed-in clinician out of
     * a cookie, which no script has. The four lines that do that are the only
     * lines this cannot reach, and everything under them takes an `actor`.
     */
    const { inviteToSession } = await import("../lib/data/session-invite");

    const invited = await inviteToSession(actor as never, reachable.id);

    check(
      "🔴 76.40 inviting somebody to a session actually returns a link",
      !("error" in invited) && Boolean(invited.url),
      "error" in invited ? invited.error : invited.url,
    );

    check(
      "🔴 76.40 …priced at the clinician's OWN rate, not a number typed on a page",
      !("error" in invited) && invited.priceCents === RATE,
      "error" in invited ? "no price" : `${invited.priceCents} cents, rate is ${RATE}`,
    );

    const booked = await one<{
      id: string;
      patient_id: string | null;
      price_cents: number;
      modality: string;
      join_token: string | null;
      status: string;
    }>(sql`
      SELECT id, patient_id, price_cents, modality, join_token, status
      FROM sessions WHERE organization_id = ${org.id}`);

    check(
      "🔴 76.40 …and there is a real session behind it, attached to THAT patient",
      booked?.patient_id === reachable.id,
      booked?.patient_id ? "attached" : "a link to a session that belongs to nobody",
    );

    check(
      "🔴 76.40 …a video session, with a join token, at the full price",
      booked?.modality === "video" &&
        Boolean(booked?.join_token) &&
        booked?.price_cents === RATE,
      `${booked?.modality}, token ${booked?.join_token ? "yes" : "NO"}, ${booked?.price_cents} cents`,
    );

    check(
      "🔴 76.40 …and the link in the message is the token on that row",
      !("error" in invited) && invited.url.endsWith(`/join/${booked?.join_token}`),
      "error" in invited ? "no url" : invited.url,
    );

    /*
     * 🔴 CONTROL — SOMEBODY WITH NOWHERE TO SEND IT.
     *
     * The request was an invite by "phone and/or email". A walk-in has
     * neither, and the failure mode without this refusal is the worst kind: a
     * session is created and billed, the clinician is told it was sent, and
     * nobody was ever told about it.
     */
    const unreachable = await one<{ id: string }>(sql`
      INSERT INTO patients (organization_id, therapist_id, first_name, source)
      VALUES (${org.id}, ${therapist.id}, 'Hassan', 'walk_in')
      RETURNING id`);

    const refused = await inviteToSession(actor as never, unreachable.id);

    const after = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM sessions WHERE organization_id = ${org.id}`);

    check(
      "🔴 CONTROL inviting somebody with no phone and no email is refused",
      "error" in refused,
      "error" in refused ? refused.error : "it invited a person with no way to be told",
    );

    check(
      "🔴 CONTROL …and it creates NO session, so nobody is billed for a message nobody got",
      after.n === 1,
      `${after.n} sessions, expected 1`,
    );

    /*
     * 🔴 CONTROL — A CLINICIAN WHO HAS NOT PRICED THEIR WORK.
     *
     * A zero rate is the default on a fresh account. Inviting somebody to a
     * free session by accident is a worse outcome than being asked to set a
     * price, and the number is read on the SERVER so a page cannot supply one.
     */
    await db.execute(sql`UPDATE users SET session_rate_cents = 0 WHERE id = ${therapist.id}`);
    const unpriced = await inviteToSession(actor as never, reachable.id);

    check(
      "🔴 CONTROL a clinician with no rate set is asked to set one, not given a free session",
      "error" in unpriced,
      "error" in unpriced ? unpriced.error : "it booked a session worth nothing",
    );

    await db.execute(sql`UPDATE users SET session_rate_cents = ${RATE} WHERE id = ${therapist.id}`);

    /* ================================================================ */
    /*  2 · ONE THREAD, TWO SURFACES                                     */
    /* ================================================================ */

    const { copilotViewFor } = await import("../lib/data/copilot-view");

    const fromProfile = await copilotViewFor(actor as never, reachable.id);
    const fromCopilot = await copilotViewFor(actor as never, reachable.id);

    check(
      "🔴 76.39 the profile and the copilot page load the same thread",
      Boolean(fromProfile?.threadId) && fromProfile?.threadId === fromCopilot?.threadId,
      fromProfile?.threadId ?? "no thread",
    );

    const threads = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM copilot_threads WHERE patient_id = ${reachable.id}`);

    check(
      "🔴 76.39 …and loading it twice made ONE row, not one per surface",
      threads.n === 1,
      `${threads.n} threads for one patient`,
    );

    /*
     * 🔴 CONTROL — THE SCOPE CHECK IS THE LOADER.
     *
     * `copilotViewFor` returns null for a patient this actor may not read,
     * which is why both callers can treat null as "not found" instead of
     * running their own ownership query and hoping the two agree. A second
     * practice's clinician asking for this patient must get nothing.
     */
    const otherOrg = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug, kind)
      VALUES ('Other Demo Practice', 'eg', ${`${fixture}b`}, 'solo') RETURNING id`);

    const stranger = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${otherOrg.id}, ${`omar.${fixture}@example.com`}, 'Omar', 'Example', 'therapist', 'x')
      RETURNING id`);

    const denied = await copilotViewFor(
      {
        userId: stranger.id,
        organizationId: otherOrg.id,
        role: "therapist",
        email: `omar.${fixture}@example.com`,
        timezone: "UTC",
      } as never,
      reachable.id,
    );

    check(
      "🔴 CONTROL a clinician in another practice gets nothing back, not an empty thread",
      denied === null,
      denied === null ? "null" : "it handed over somebody else's patient",
    );

    /* ================================================================ */
    /*  3 · SOURCE: THE THREE THINGS A RENDER CANNOT SHOW YOU            */
    /* ================================================================ */

    const page = readSource(PAGE);
    const copilotPage = readSource(COPILOT_PAGE);
    const actions = readSource(ACTIONS);
    const docActions = readSource(DOC_ACTIONS);

    /*
     * 🔴 C115 — THE PHOTOGRAPH IS SERVED, NEVER LINKED.
     *
     * The storage URL works and is unguessable, which is exactly why this is
     * easy to get wrong: an `<img src={person.avatarUrl}>` renders the right
     * face and turns a private object into a public one the moment the page is
     * screenshotted, forwarded or cached.
     *
     * ## 🔴 AND THIS CHECK WENT RED FOR AN IMPROVEMENT, WHICH IS ITS OWN LESSON
     *
     * It used to assert the page contained the literal `/api/patient/avatar/`.
     * 79.4 moved that string into `PatientAvatar`, because the page had been
     * hand-rolling an `<img>` that drew a broken image glyph for every patient
     * with no photo. The page got better and the check went red.
     *
     * That is the trap `docs/TRAPS.md` records as "a check bound to a syntax
     * rather than a property", and the question it tells you to ask is: *if
     * somebody improved this code, would my check still pass?*
     *
     * So it asks the property. The face reaches this page through the
     * authenticated route, whether the page builds that URL itself or renders
     * the one component that does. `verify:sprint25` is what makes the second
     * spelling as strong as the first: it asserts `PatientAvatar` is the ONLY
     * file in the product allowed to build an avatar URL.
     */
    check(
      "🔴 C115 the headshot is served through the authenticated route",
      page.includes("/api/patient/avatar/") || page.includes("PatientAvatar"),
      "the route asks on every request whether this reader may see this face",
    );

    check(
      "🔴 C115 CONTROL …and the page never reads a storage URL into the markup",
      !page.includes("avatarUrl"),
      page.includes("avatarUrl") ? "a storage URL reached the page" : "no storage URL on the page",
    );

    /*
     * 🔴 BOTH SURFACES GO THROUGH THE ONE LOADER.
     *
     * The rows above prove the loader returns one thread. This is the property
     * that keeps it true next sprint: a page that gathers its own quota, voice
     * and messages is a page that can disagree with the other one, and the
     * disagreement is invisible until somebody notices a different number.
     */
    check(
      "🔴 76.39 the profile page loads the thread through `copilotViewFor`",
      page.includes("copilotViewFor"),
      "one loader",
    );

    check(
      "🔴 76.39 …and so does the copilot page, rather than assembling its own",
      copilotPage.includes("copilotViewFor") && !copilotPage.includes("getOrCreateThread"),
      copilotPage.includes("getOrCreateThread")
        ? "the copilot page still gathers its own"
        : "both go through the loader",
    );

    /*
     * 🔴 76.40 — THE INVITATION READS THE RATE ON THE SERVER.
     *
     * If the price were a parameter, the page would be the source of it, and a
     * price a page supplies is a price somebody can change. C311 says a price
     * somebody was shown is a price they are owed, and the only way to keep
     * that true is to have one place the number comes from.
     */
    check(
      "🔴 C311 the invitation reads the rate on the server and takes no price argument",
      /export async function inviteToSession\(actor: Actor, patientId: string\)/.test(
        readSource("lib/data/session-invite.ts"),
      ) &&
        readSource("lib/data/session-invite.ts").includes("getConnectAccount") &&
        /export async function inviteToPaidSession\(patientId: string\)/.test(actions),
      "the rate comes from the clinician's own account, and no caller can pass one",
    );

    /*
     * 🔴 76.40 — ADDING TO THE HISTORY REFRESHES THE PAGE IT WAS ADDED FROM.
     *
     * The control now lives on two screens and the write revalidated one. A
     * clinician who uploads a file on the profile and watches nothing happen
     * uploads it again.
     */
    check(
      "🔴 76.40 a document written from the profile refreshes the profile",
      docActions.includes("revalidatePath(`/patients/${patientId}`)"),
      "both surfaces refresh",
    );

    /*
     * 🔴 THE SESSION PAGE IS THE DOOR TO THE PROFILE.
     *
     * "Session history should open a patient profile" — the name at the top of
     * a session is the thing a clinician taps, and it went nowhere.
     */
    const sessionPage = readSource("app/(app)/sessions/[id]/page.tsx");
    check(
      "🔴 76.40 a session links to its patient's profile",
      sessionPage.includes("href={`/patients/${row.session.patientId}`}"),
      "the name at the top of a session opens the profile",
    );
  } finally {
    await db.execute(sql`DELETE FROM copilot_messages WHERE thread_id IN
      (SELECT ct.id FROM copilot_threads ct JOIN patients p ON p.id = ct.patient_id
       WHERE p.organization_id IN (SELECT id FROM organizations WHERE slug LIKE ${`${fixture}%`}))`);
    await db.execute(sql`DELETE FROM copilot_threads WHERE patient_id IN
      (SELECT id FROM patients WHERE organization_id IN
       (SELECT id FROM organizations WHERE slug LIKE ${`${fixture}%`}))`);
    await db.execute(sql`DELETE FROM sessions WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug LIKE ${`${fixture}%`})`);
    await db.execute(sql`DELETE FROM patients WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug LIKE ${`${fixture}%`})`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}@example.com`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug LIKE ${`${fixture}%`}`);
    await pool.end();
  }

  finish("the patient profile");
}

main();
