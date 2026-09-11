/**
 * Sprint 36 acceptance: session sources, and a third door. PLAN.md 36.1 to 36.3.
 *
 *   npm run verify:sprint36
 *
 * ## The two claims this sprint makes
 *
 *   1. **A session source cannot describe a meeting we did not create**, so
 *      sprint 41's rule — *the bot joins meetings 24Therapy created for a
 *      session, nothing else, ever* — is a property of the schema rather than
 *      a convention in a service.
 *   2. **There is a third door on ingestion and it is narrower than the other
 *      two.** One session, one purpose, expiring, revocable.
 *
 * Both are proved by attempting the write, and every refusal is paired with the
 * write it must allow (C165). The C132 scan is proved against a planted column
 * name, because a scan that finds nothing proves nothing until it is watched
 * finding something.
 */
import { readFileSync } from "node:fs";

import { eq, sql } from "drizzle-orm";

import { ingestDecision, mintIngestToken } from "../lib/ingest/token";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";
import { organizations, sessions, sessionSources, users } from "../lib/db/schema";
import { scanRegionPins } from "./_region-pins";
import { stripComments } from "./_dashes";
import { reporter, required, writesTo, readSource } from "./_verify";

const { check, finish } = reporter();
const db = dbFor(DEFAULT_REGION);
const TAG = "verify36";

async function refused(write: () => Promise<unknown>): Promise<string | null> {
  try {
    await write();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** A column name that would let somebody join meetings from a diary. C132. */
const CALENDAR_SHAPE = /calendar|ics_|icalendar|organizer|invitee|event_id|meeting_url|join_url/i;

async function main() {
  writesTo();
  console.log("\nSprint 36, session sources\n");

  /* ------------------------------------------------ 36.1 · the shape, applied */

  const columns = await db.execute(sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'session_sources'`);
  const names = columns.rows.map((row) => (row as { column_name: string }).column_name);

  check(
    "36.1 the table is applied, with the kind, the provisioning and the token on it",
    ["kind", "external_meeting_id", "provisioned_at", "provisioned_by_user_id", "ingest_token_hash"]
      .every((column) => names.includes(column)),
    `${names.length} columns`,
  );

  /*
   * 🔴 C132 — no column that would make reading a calendar convenient.
   *
   * The rule is "no calendar is read". The cheapest way to keep it is for
   * there to be nowhere to put one: somebody who wanted to join meetings from
   * a diary would have to add a column, in a migration, with their name on it.
   */
  const calendarish = names.filter((column) => CALENDAR_SHAPE.test(column));
  check(
    "🔴 C132 no column on session_sources could hold a calendar or a pasted link",
    calendarish.length === 0,
    calendarish.join(", ") || `${names.length} columns scanned`,
  );

  check(
    "🔴 C132 CONTROL, the same scan CATCHES the column somebody would add",
    ["calendar_event_id", "ics_uid", "organizer_email", "join_url"].every((column) =>
      CALENDAR_SHAPE.test(column),
    ),
    "calendar_event_id · ics_uid · organizer_email · join_url",
  );

  /* -------------------------------------------- 36.1 · the writes it refuses */

  const [reference] = await db
    .select({ organizationId: users.organizationId, id: users.id })
    .from(users)
    .where(eq(users.role, "therapist"))
    .limit(1);
  const clinician = required(reference, "therapist whose organisation the fixtures can join");

  let sessionId: string | null = null;
  let otherSessionId: string | null = null;

  try {
    const made = await db
      .insert(sessions)
      .values({
        organizationId: clinician.organizationId,
        therapistId: clinician.id,
        feedbackToken: `${TAG}-a`,
      })
      .returning({ id: sessions.id });
    sessionId = made[0]!.id;

    const other = await db
      .insert(sessions)
      .values({
        organizationId: clinician.organizationId,
        therapistId: clinician.id,
        feedbackToken: `${TAG}-b`,
      })
      .returning({ id: sessions.id });
    otherSessionId = other[0]!.id;

    const base = { sessionId, organizationId: clinician.organizationId } as const;

    const unprovisioned = await refused(() =>
      db.insert(sessionSources).values({ ...base, kind: "zoom" }),
    );
    check(
      "🔴 36.1 a Zoom source that does not say WE created the meeting is REFUSED",
      unprovisioned !== null,
      unprovisioned ? "external_is_provisioned" : "IT WAS ACCEPTED",
    );

    const pretending = await refused(() =>
      db.insert(sessionSources).values({
        ...base,
        kind: "in_person",
        externalMeetingId: "zoom-999",
        provisionedAt: new Date(),
        provisionedByUserId: clinician.id,
      }),
    );
    check(
      "36.1 …and a room with a microphone cannot claim to be a meeting we provisioned",
      pretending !== null,
      pretending ? "external_is_provisioned" : "IT WAS ACCEPTED",
    );

    /* 🔴 The paired write: the shapes it must ALLOW. */
    const [inPerson] = await db
      .insert(sessionSources)
      .values({ ...base, kind: "in_person" })
      .returning({ id: sessionSources.id, kind: sessionSources.kind });

    check(
      "🔴 36.1 …and an honest source IS accepted",
      inPerson?.kind === "in_person",
      `${inPerson?.kind} source recorded`,
    );

    const [provisioned] = await db
      .insert(sessionSources)
      .values({
        sessionId: otherSessionId,
        organizationId: clinician.organizationId,
        kind: "google_meet",
        externalMeetingId: "meet-abc-123",
        provisionedAt: new Date(),
        provisionedByUserId: clinician.id,
      })
      .returning({ id: sessionSources.id });

    check(
      "36.1 …including a meeting we DID create, with who and when on the row",
      Boolean(provisioned?.id),
    );

    const second = await refused(() =>
      db.insert(sessionSources).values({ ...base, kind: "upload" }),
    );
    check(
      "🔴 36.1 a session cannot have TWO sources: audio arrives from one place",
      second !== null,
      second ? "session_unique" : "IT WAS ACCEPTED",
    );

    const repointed = await refused(() =>
      db
        .update(sessionSources)
        .set({ kind: "zoom" })
        .where(eq(sessionSources.sessionId, sessionId!)),
    );
    check(
      "🔴 41.7 a source cannot be re-pointed at another meeting after the fact",
      repointed !== null,
      repointed ? "identity_is_fixed" : "IT WAS ACCEPTED",
    );

    const unhashed = await refused(() =>
      db
        .update(sessionSources)
        .set({ ingestTokenHash: "si_plain_text_token", ingestTokenExpiresAt: new Date() })
        .where(eq(sessionSources.sessionId, sessionId!)),
    );
    check(
      "🔴 36.2 the token column will not hold anything but a hash",
      unhashed !== null,
      unhashed ? "token_is_hashed" : "IT WAS ACCEPTED",
    );

    /* 🔴 The paired write again: minting must work. */
    const minted = mintIngestToken(sessionId);
    await db
      .update(sessionSources)
      .set({ ingestTokenHash: minted.hash, ingestTokenExpiresAt: minted.expiresAt })
      .where(eq(sessionSources.sessionId, sessionId));

    const [stored] = await db
      .select({
        hash: sessionSources.ingestTokenHash,
        expires: sessionSources.ingestTokenExpiresAt,
        revoked: sessionSources.ingestTokenRevokedAt,
        session: sessionSources.sessionId,
      })
      .from(sessionSources)
      .where(eq(sessionSources.sessionId, sessionId));

    check(
      "🔴 36.2 …and a real token IS stored, as a hash, never in the clear",
      stored?.hash === minted.hash && stored.hash !== minted.token,
      `${stored?.hash?.slice(0, 12)}…`,
    );

    /* ------------------------------------------------- 36.2 · the door itself */

    check(
      "🔴 36.2 the door opens for the session it was minted for",
      ingestDecision({
        sessionId,
        header: `Bearer ${minted.token}`,
        source: {
          sessionId: stored!.session,
          ingestTokenHash: stored!.hash,
          ingestTokenExpiresAt: stored!.expires,
          ingestTokenRevokedAt: stored!.revoked,
        },
      }).ok,
    );

    /*
     * 🔴 The whole point, end to end and against real rows: a token minted for
     * one session, presented at another. 41.7 makes a bot in the wrong meeting
     * a hard stop; this is that stop, two sprints early and in the schema.
     */
    const crossed = ingestDecision({
      sessionId: otherSessionId,
      header: `Bearer ${minted.token}`,
      source: {
        sessionId: otherSessionId,
        ingestTokenHash: stored!.hash,
        ingestTokenExpiresAt: stored!.expires,
        ingestTokenRevokedAt: stored!.revoked,
      },
    });
    check(
      "🔴 41.7 session A's token is REFUSED at session B, even with B's own row",
      !crossed.ok && crossed.reason === "wrong_session",
      crossed.ok ? "IT WAS ACCEPTED" : crossed.reason,
    );

    await db
      .update(sessionSources)
      .set({ ingestTokenRevokedAt: new Date() })
      .where(eq(sessionSources.sessionId, sessionId));

    const [revokedRow] = await db
      .select({
        hash: sessionSources.ingestTokenHash,
        expires: sessionSources.ingestTokenExpiresAt,
        revoked: sessionSources.ingestTokenRevokedAt,
      })
      .from(sessionSources)
      .where(eq(sessionSources.sessionId, sessionId));

    check(
      "36.2 revoking closes it, and revoking is an UPDATE the trigger allows",
      !ingestDecision({
        sessionId,
        header: `Bearer ${minted.token}`,
        source: {
          sessionId,
          ingestTokenHash: revokedRow!.hash,
          ingestTokenExpiresAt: revokedRow!.expires,
          ingestTokenRevokedAt: revokedRow!.revoked,
        },
      }).ok,
    );
  } finally {
    if (sessionId) {
      await db.delete(sessionSources).where(eq(sessionSources.sessionId, sessionId));
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    }
    if (otherSessionId) {
      await db.delete(sessionSources).where(eq(sessionSources.sessionId, otherSessionId));
      await db.delete(sessions).where(eq(sessions.id, otherSessionId));
    }
  }

  /* --------------------------------------------- 36.2 · what the door is NOT */

  const route = stripComments(
    readSource("app/api/sessions/[id]/transcribe/route.ts"),
  );

  check(
    "🔴 36.2 the two existing doors are untouched: same origin and a real user",
    /assertSameOrigin\(\)/.test(route) && /requireUserApi\(\)/.test(route),
    "a bot gets a third door, not a wider one",
  );

  check(
    "🔴 36.2 the token branch never runs the copilot",
    /!viaToken && result\.inserted && shouldRunCopilot/.test(route),
    "the copilot belongs to a person who is in the room",
  );

  check(
    "🔴 36.2 …and a token holder is answered with a sequence number, not clinical text",
    /if \(viaToken\) \{[\s\S]{0,600}?return NextResponse\.json\(\{ sequence: sequenceRaw, accepted: true \}\)/.test(
      route,
    ),
    "what goes in is audio; what comes out is an acknowledgement",
  );

  check(
    "36.3 no bot ships in this sprint",
    !/recall\.ai|recallai|puppeteer|playwright|joinMeeting/i.test(route) &&
      !/recall/i.test(readSource("lib/data/session-sources.ts")),
    "the shape only",
  );

  /* ----------------------------------------------------------- 30.1 · pins */

  const pins = scanRegionPins();
  check(
    "🔴 30.1 the new modules are ROUTED, not pinned, including the one with nothing to route on",
    !pins.some((pin) => pin.file.includes("session-sources") || pin.file.includes("ingest/")),
    `${pins.length} pinned call sites, none of them this sprint's`,
  );

  const unvalidated = await db.execute(sql`
    SELECT count(*)::int AS n FROM pg_constraint WHERE NOT convalidated`);
  check(
    "H1 no unvalidated constraint anywhere in the database",
    (unvalidated.rows[0] as { n: number }).n === 0,
    `${(unvalidated.rows[0] as { n: number }).n} unvalidated`,
  );

  finish("Sprint 36");
}

void main();
