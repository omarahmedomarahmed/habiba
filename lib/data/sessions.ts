import "server-only";

import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";

import { auditPhi } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { qualified } from "@/lib/db/qualified";
import {
  availabilitySlots,
  manualPayments,
  organizations,
  patients,
  sessionNotes,
  sessions,
  transcriptSegments,
  users,
  type Modality,
} from "@/lib/db/schema";
import { ensurePersonForPatient, normalisePhone } from "@/lib/data/people";
import { log, ref } from "@/lib/logger";
import { capSeconds, sessionClock, type SessionClock } from "@/lib/session-clock";
import { getSettings } from "@/lib/settings";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/data/sessions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * Every read and write of clinical data goes through this module, and every
 * query here is scoped by `organizationId` taken from the authenticated actor —
 * never from a request parameter.
 *
 * The old code threaded `req.user.organization_id` into hand-written SQL at
 * ~200 call sites with uneven coverage, so a single forgotten `AND
 * organization_id = $n` was a cross-tenant leak with nothing behind it. Here
 * there is one place to get it wrong.
 */

/** Scope predicate: an org, and for clinicians their own caseload. */
function scope(actor: Actor) {
  return actor.role === "super_admin"
    ? eq(sessions.organizationId, actor.organizationId)
    : and(
        eq(sessions.organizationId, actor.organizationId),
        eq(sessions.therapistId, actor.userId),
      );
}

export type SessionListItem = {
  id: string;
  status: string;
  modality: Modality;
  noteStatus: string;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  /**
   * 🔴 THE HOUR IT IS FOR, which this list did not even select.
   *
   * Every clinician surface rendered `endedAt ?? createdAt`, so a session
   * booked for Thursday and created on Monday read "Today" on Monday. The
   * clinician — the one person who has to be in the room on Thursday — was
   * the only one told the wrong day. The patient's own view was right all
   * along, because `patient-view.ts` reaches for `scheduledAt` first.
   */
  scheduledAt: Date | null;
  durationMinutes: number | null;
  patientId: string | null;
  patientFirstName: string | null;
  patientLastName: string | null;
  guestName: string | null;
};

export async function listSessions(
  actor: Actor,
  opts: { limit?: number } = {},
): Promise<SessionListItem[]> {
  return db
    .select({
      id: sessions.id,
      status: sessions.status,
      modality: sessions.modality,
      noteStatus: sessions.noteStatus,
      createdAt: sessions.createdAt,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      scheduledAt: sessions.scheduledAt,
      durationMinutes: sessions.durationMinutes,
      patientId: sessions.patientId,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      guestName: sessions.guestName,
    })
    .from(sessions)
    // LEFT JOIN, always. `sessions.patient_id` is nullable for link-based
    // sessions, and an INNER JOIN here silently hid those rows — the same bug
    // was fixed three separate times in the old codebase.
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(scope(actor))
    .orderBy(desc(sessions.createdAt))
    .limit(opts.limit ?? 50);
}

/**
 * 🔴 T15: THE SESSIONS LIST, SPLIT IN TWO AND PAGED.
 *
 * `/sessions` read `listSessions`, which is the fifty most recently CREATED rows.
 * A session booked in March for next Thursday was created in March, so a busy
 * clinician's next appointment fell off the end of their own list, and the order
 * they did see was the order the rows were typed in rather than the order they
 * happen in.
 *
 * So two lists, each ordered by the thing a clinician reads it for:
 *
 *   upcoming  scheduled or in progress, soonest first. A live session with no
 *             booked hour sorts by when it started, which puts it at the top
 *             where it belongs. A booked hour that has passed without the
 *             session starting stays here, at the top, because it still needs
 *             the clinician to start it or cancel it.
 *   past      completed or cancelled, most recent first, by when it ended, else
 *             the hour it was for, else when it was made.
 *
 * Paged by offset with one row of lookahead, so `hasMore` is a fact about the
 * database rather than a guess from a full page. The id breaks ties, so two
 * sessions at the same hour cannot swap between pages.
 */
export const SESSIONS_PAGE_SIZE = 20;

export type SessionListWhen = "upcoming" | "past";

export async function listSessionsPage(
  actor: Actor,
  opts: { when: SessionListWhen; page: number; pageSize?: number },
): Promise<{ items: SessionListItem[]; hasMore: boolean }> {
  const size = opts.pageSize ?? SESSIONS_PAGE_SIZE;
  const page = Number.isInteger(opts.page) && opts.page > 0 ? opts.page : 0;

  const upcoming = opts.when === "upcoming";
  const at = upcoming
    ? sql`coalesce(${sessions.scheduledAt}, ${sessions.startedAt}, ${sessions.createdAt})`
    : sql`coalesce(${sessions.endedAt}, ${sessions.scheduledAt}, ${sessions.createdAt})`;

  const rows = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      modality: sessions.modality,
      noteStatus: sessions.noteStatus,
      createdAt: sessions.createdAt,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      scheduledAt: sessions.scheduledAt,
      durationMinutes: sessions.durationMinutes,
      patientId: sessions.patientId,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      guestName: sessions.guestName,
    })
    .from(sessions)
    // LEFT JOIN, for the reason `listSessions` gives: link sessions have no patient.
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(
      and(
        scope(actor),
        inArray(
          sessions.status,
          upcoming ? ["scheduled", "in_progress"] : ["completed", "cancelled"],
        ),
      ),
    )
    .orderBy(...(upcoming ? [asc(at), asc(sessions.id)] : [desc(at), desc(sessions.id)]))
    .limit(size + 1)
    .offset(page * size);

  return { items: rows.slice(0, size), hasMore: rows.length > size };
}

/**
 * 🔴 T18: WHERE A SESSION ROW LEADS, decided once for every list.
 *
 * Only a session that can still happen opens the room. The dashboard sent every
 * row that was not `completed` there, so a cancelled session opened a video room
 * for an appointment that no longer exists; `/sessions` already sent it to the
 * session page. One function, so the two lists cannot disagree again.
 */
export function sessionHref(session: { id: string; status: string }): string {
  const live = session.status === "in_progress" || session.status === "scheduled";
  return live ? `/sessions/${session.id}/room` : `/sessions/${session.id}`;
}

/**
 * 🔴 W2-T05: THE SESSIONS A CLINICIAN RAN AT A PRACTICE THEY HAVE LEFT.
 *
 * `removeClinician` moves them to a practice of their own and leaves every
 * session, patient and note with the clinic (C266: the credential and the
 * record were the practice's). Every clinical list here is scoped by
 * organisation, so on the Monday after they were removed `/sessions` and
 * `/patients` were simply empty, with nothing to say why.
 *
 * This is the sight they keep: who they saw, when, where and how it ended.
 * Their own rows only (`therapist_id`), in any organisation that is not their
 * current one. No note, no transcript, no summary: reading those is the
 * practice's now, and a patient who wants them to keep reading can grant it
 * (P4). Not a link either, for the same reason.
 *
 * Audited as one read, like the clinic's schedule, because it reads patient
 * names across a tenancy boundary.
 */
export async function formerSessions(actor: Pick<Actor, "userId" | "organizationId">) {
  const rows = await db
    .select({
      id: sessions.id,
      practice: organizations.name,
      status: sessions.status,
      scheduledAt: sessions.scheduledAt,
      createdAt: sessions.createdAt,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      guestName: sessions.guestName,
    })
    .from(sessions)
    .innerJoin(organizations, eq(organizations.id, sessions.organizationId))
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(
      and(
        eq(sessions.therapistId, actor.userId),
        ne(sessions.organizationId, actor.organizationId),
      ),
    )
    .orderBy(desc(sessions.createdAt))
    .limit(200);

  if (rows.length > 0) {
    const { audit } = await import("@/lib/audit");
    await audit({
      actor,
      category: "phi_access",
      action: "sessions.former.read",
      resourceType: "user",
      resourceId: actor.userId,
      reason: `${rows.length} sessions at a practice they have left`,
    });
  }

  return rows;
}

export async function getSession(actor: Actor, sessionId: string) {
  const [row] = await db
    .select({
      session: sessions,
      patient: patients,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(and(scope(actor), eq(sessions.id, sessionId)))
    .limit(1);

  if (!row) return null;

  await auditPhi(actor, "session.read", {
    resourceType: "session",
    resourceId: sessionId,
    patientId: row.session.patientId,
  });

  return row;
}

export async function createSession(
  actor: Actor,
  input: {
    modality: Modality;
    patientId?: string | null;
    guestName?: string;
    guestEmail?: string;
    /**
     * 25.18 — the mobile number, taken at the same moment as the name.
     *
     * §3b makes the phone the identity, and the two halves of "new patient,
     * new session" were two screens apart: the chart was created here with no
     * number, and the invite that makes the record theirs lived on a different
     * page a clinician had to remember to visit. A number here is what lets
     * the invite go immediately.
     */
    guestPhone?: string;
    /** Zero means free to join, which is the default and the common case. */
    priceCents?: number;
  },
) {
  let patientId = input.patientId ?? null;

  /*
   * 🔴 A patient id from a form is a claim, not a fact. It has to be a chart
   * this clinician may open (the same gate every patient screen uses), or
   * the session, its room and its AI notes would load somebody else's file.
   */
  if (patientId) {
    const { getPatient } = await import("@/lib/data/patients");
    if (!(await getPatient(actor, patientId))) return null;
  }

  /*
   * An in-person session with a typed name creates the chart immediately, so the clinician never
   * has to "add a patient" as a separate step.
   *
   * ## 🔴 …AND ONLY IF THERE IS A WAY TO REACH THEM. THIS WAS BROKEN FOR TEN SPRINTS.
   *
   * `patients_phone_present` (0042) requires a phone on any patient whose `source` is `therapist`,
   * because §3b is that the phone is the handle most of this book's patients have and an email is
   * not. This block set `phone: normalisePhone(input.guestPhone) ?? null` and `source: "therapist"`
   * unconditionally — so a therapist who typed only a walk-in's NAME, which is all the form asks
   * for, hit the constraint and the whole session creation failed.
   *
   * 🔴 That is the most important flow in the product: a clinician with somebody in the room typing
   * their name and pressing Start. It has been failing since sprint 42 added the constraint, and
   * nothing caught it because the one test that covers it (`tests/e2e.test.ts`, "starting a session
   * records audio") could not launch a browser in this environment — a browser problem recorded for
   * four sprints as "no headless shell" while it masked this.
   *
   * Found by sprint 52's walkthrough, which is what 52.3 is for.
   *
   * ## ⚠️ 76.36 — AND SPRINT 52'S ANSWER WAS "NO CHART", WHICH WAS HALF RIGHT
   *
   * 52's ruling was: the constraint is about REACHABILITY, a patient a therapist wrote down must be
   * reachable, and inventing an unreachable record is worse than having none. So a guest with no
   * contact details got a SESSION and not a chart, and everything downstream was built to cope:
   * `sessions.guest_name` carries who it was, `session_notes.patient_id` is nullable, and
   * `lib/ai/notes.ts` left-joins the patient.
   *
   * It all works, and it is still wrong, because of the person it forgot. A clinician ran an
   * offline session, approved the note, and their Patients tab said **0**. They had seen somebody
   * an hour earlier. There was nowhere to put the next session with that person, nothing for a
   * profile or a copilot to accumulate against, and no chart to add a number to once they had one.
   *
   * The constraint guards a record nobody can REACH. A walk-in is a record of somebody who was in
   * the room, which is a different claim, so it gets a different `source` and the constraint has no
   * opinion about it. `patients_phone_present` conditions on `source = 'therapist'` and nothing in
   * the database enumerates that column's values, so this needed no migration at all.
   *
   *   phone         → `therapist`, the ordinary written-down patient
   *   email only    → `join_link`, reachable, and the shape 52 already allowed
   *   neither       → `walk_in`, somebody in the room
   *
   * The clinician adds a number later from the patient's own profile, and it becomes `therapist`.
   */
  const guestPhone = normalisePhone(input.guestPhone);
  const guestEmail = input.guestEmail?.trim() || null;

  if (!patientId && input.guestName?.trim()) {
    const [created] = await db
      .insert(patients)
      .values({
        organizationId: actor.organizationId,
        therapistId: actor.userId,
        firstName: input.guestName.trim().split(/\s+/)[0]!,
        lastName: input.guestName.trim().split(/\s+/).slice(1).join(" ") || null,
        email: guestEmail,
        /*
         * 🔴 `source` follows what we HAVE, because the constraint is about reachability.
         *
         * With a phone this is an ordinary therapist-entered patient. With only an email it is not:
         * `patients_phone_present` would refuse it, and §3b's own reasoning is that an email is a
         * complete fallback on the booking path — which is what `join_link` means here. Recording
         * `therapist` for a row with no phone would be recording something the schema forbids.
         */
        phone: guestPhone,
        /*
         * 🔴 76.36 — THE SOURCE FOLLOWS WHAT WE HAVE, and now covers having nothing.
         *
         * `therapist` is the only value `patients_phone_present` has an opinion about, and it is
         * the right one exactly when there is a phone. An email alone is `join_link`, which is
         * what 52 already did. Neither is `walk_in`, which is the case that used to produce no
         * chart at all and a caseload of zero.
         */
        source: guestPhone ? "therapist" : guestEmail ? "join_link" : "walk_in",
      })
      .returning({ id: patients.id });
    patientId = created?.id ?? null;
    // 5.1: a chart created here is still a person's chart.
    if (patientId) await ensurePersonForPatient(patientId);
  }

  const needsLink = input.modality === "video";
  // Belt and braces: a price on an in-person session would be an unreachable
  // paywall, because there is no link for the patient to pay through.
  const price = needsLink ? Math.max(0, Math.round(input.priceCents ?? 0)) : 0;

  const [created] = await db
    .insert(sessions)
    .values({
      organizationId: actor.organizationId,
      therapistId: actor.userId,
      patientId,
      guestName: input.guestName?.trim() || null,
      guestEmail,
      modality: input.modality,
      status: "scheduled",
      // 4.6: where this session came from, recorded rather than inferred later.
      sessionType: price > 0 ? "paid_link" : "direct",
      joinToken: needsLink ? randomBytes(24).toString("base64url") : null,
      // Issued alongside the join token and never equal to it. This one has to
      // outlive the session, because a patient who closed the tab should still
      // be able to rate it days later.
      feedbackToken: randomBytes(24).toString("base64url"),
      joinTokenExpiresAt: needsLink ? new Date(Date.now() + 12 * 60 * 60 * 1000) : null,
      priceCents: price,
      /*
       * 🔴 0149 — dollars, the currency the books and every payment path are
       * kept in. A price typed in pounds was converted on the way in, at the
       * rate the payment is then asked for at, so the receipt reproduces it.
       */
      priceCurrency: "usd",
      paymentStatus: price > 0 ? "pending" : "not_required",
    })
    .returning();

  /*
   * 🔴 53.21 — pot first, on this path too.
   *
   * A clinician booking a session for a patient whose employer funds them must
   * not send that patient a pay link. Same call, same reasons as `bookSlot`; it
   * resolves the benefit from the session id and does nothing when there is none.
   */
  const { payFromPot } = await import("@/lib/billing/pot");
  await payFromPot(created!.id);

  await auditPhi(actor, "session.create", {
    resourceType: "session",
    resourceId: created!.id,
    patientId,
  });

  return created!;
}

/**
 * A session created by a patient off the radar, with no authenticated actor.
 *
 * Kept separate from `createSession` because there is no `Actor` here to scope
 * anything by — the org and therapist come from the radar row, which is the
 * only reason this is safe. Deliberately does not create a patient record: that
 * happens when they type their name on the join page, exactly as it does for a
 * link the therapist sent, so there is one code path that turns a stranger into
 * a chart.
 */
export async function createRadarSession(input: {
  organizationId: string;
  therapistId: string;
  guestName: string;
  guestEmail: string | null;
  priceCents: number;
}) {
  const [created] = await db
    .insert(sessions)
    .values({
      organizationId: input.organizationId,
      therapistId: input.therapistId,
      guestName: input.guestName.trim().slice(0, 80),
      guestEmail: input.guestEmail?.trim().toLowerCase() || null,
      modality: "video",
      status: "scheduled",
      // Every session created here came off the live map, priced or not — the
      // distinction a free radar session and a free link both lose otherwise.
      sessionType: "radar",
      joinToken: randomBytes(24).toString("base64url"),
      feedbackToken: randomBytes(24).toString("base64url"),
      // Short: this is a session starting now, not an invitation for later.
      joinTokenExpiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      priceCents: input.priceCents,
      priceCurrency: "usd",
      paymentStatus: input.priceCents > 0 ? "pending" : "not_required",
    })
    .returning();

  /*
   * ⚠️ 53.21 IS NOT APPLIED HERE, and the reason is structural rather than an
   * omission.
   *
   * A radar session has NO PATIENT ROW yet — the comment above says so and it is
   * the whole reason this function is separate from `createSession`. There is no
   * person, so there is no enrolment to find and nothing the pot could pay for.
   *
   * The pot is charged instead the moment the patient identifies themselves on
   * the join page, which is the first instant a benefit exists to read. Doing it
   * there rather than pretending here is the difference between a gap that is
   * closed and a call that looks like it covers this path and returns
   * `no_benefit` for everybody.
   */
  return created!;
}

/**
 * Status transitions. `waiting` from the old model is gone — a session is
 * scheduled until someone presses Start.
 *
 * Both `scheduled → completed` and `in_progress → completed` are allowed: a
 * clinician ending a session they never formally started used to get a 400.
 */
const TRANSITIONS: Record<string, string[]> = {
  scheduled: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * The states `TRANSITIONS` says may reach `cancelled`, derived rather than
 * retyped so the list and the table cannot drift apart. C368.
 */
const CANCELLABLE_FROM = Object.entries(TRANSITIONS)
  .filter(([, to]) => to.includes("cancelled"))
  .map(([from]) => from) as (typeof sessions.$inferSelect)["status"][];

export class TransitionError extends Error {}

export async function startSession(actor: Actor, sessionId: string) {
  const [current] = await db
    .select({ status: sessions.status })
    .from(sessions)
    .where(and(scope(actor), eq(sessions.id, sessionId)))
    .limit(1);
  if (!current) throw new TransitionError("Session not found");

  // Re-entering a live room must be a no-op, not an error. The old client had
  // to special-case `in_progress → in_progress` in a string comparison.
  if (current.status === "in_progress") return;
  if (!TRANSITIONS[current.status]?.includes("in_progress")) {
    throw new TransitionError("This session can no longer be started");
  }

  /*
   * 🔴 76.17 — THE STATUS IS IN THE WHERE, and that is the whole guarantee.
   *
   * The SELECT above and this UPDATE are two statements, so two taps, two
   * tabs, or a clinician and their colleague can both pass the check. It did
   * not matter while starting was idempotent by accident — the second write
   * simply set the same status and moved `startedAt` a few milliseconds.
   *
   * It matters now that a message leaves the building on this transition. A
   * patient's phone buzzing twice about one session is how somebody learns to
   * ignore the buzz, and this is the one alert on this product worth
   * interrupting them for.
   *
   * So the database decides who won, and `returning` says so. Losing is the
   * same as re-entry: nothing changed, nobody is told, no error.
   */
  const started = await db
    .update(sessions)
    .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
    .where(and(scope(actor), eq(sessions.id, sessionId), eq(sessions.status, "scheduled")))
    .returning({ id: sessions.id });

  if (started.length === 0) return;

  /*
   * 🔴 AWAITED, THOUGH A CLINICIAN IS WAITING ON IT.
   *
   * Not fire and forget: a server action's un-awaited work is cut off with the
   * response, and the one message that has to arrive is the one saying a room
   * is open right now. It is wrapped, so the cost of a slow provider is a
   * slower Start and never a failed one.
   */
  const { noticeSessionStarted } = await import("@/lib/sessions/started-notice");
  await noticeSessionStarted(sessionId);
}

/* ---------------------------------------------------------- the clock -- */

/**
 * Where a live session is on its ladder, read from the database.
 *
 * The one authority. Both clients compute the same thing locally so the
 * countdown ticks smoothly between polls, but this is the copy that decides
 * whether a session is over — a client that computes its own answer and acts on
 * it is a client that can be lied to by a changed system clock.
 *
 * Unauthenticated by design, because the patient needs it too and has no
 * account. It returns nothing but a countdown.
 */
export async function readSessionClock(sessionId: string): Promise<SessionClock & { live: boolean }> {
  const { clock: limits } = await getSettings();

  const [row] = await db
    .select({
      status: sessions.status,
      startedAt: sessions.startedAt,
      /*
       * The last thing anybody said, for the "everyone left" check.
       *
       * `created_at` on the newest segment rather than a column on the session:
       * it is already written by the upload path, it cannot drift from the
       * transcript it describes, and it costs one indexed lookup.
       */
      lastActivityAt: sql<Date | null>`(
        SELECT max(t."created_at") FROM ${transcriptSegments} t
        WHERE t."session_id" = ${sessions}."id"
      )`,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) {
    return { ...sessionClock({ startedAt: null, limits }), live: false };
  }

  return {
    ...sessionClock({
      startedAt: row.status === "in_progress" ? row.startedAt : null,
      lastActivityAt: row.lastActivityAt,
      limits,
    }),
    live: row.status === "in_progress",
  };
}

/**
 * End a session nobody is ending.
 *
 * Runs off whichever side happens to poll — the clinician's room, or the
 * patient's page — for the same reason the abandonment check does: the event
 * that matters is somebody being in a session that has run over, and that
 * somebody is already talking to us every few seconds. A cron would have to
 * wake the database on a schedule to ask a question whose answer is almost
 * always no.
 *
 * Unscoped by actor on purpose. The patient has no account and is exactly the
 * party most likely to still have a tab open when the clinician's laptop has
 * gone to sleep — which is the case this exists for.
 *
 * The guard on `status` makes it safe to call from both sides at once: whoever
 * gets there second updates nothing and returns false.
 */
export async function autoEndSession(
  sessionId: string,
  reason: "cap" | "silence",
): Promise<{ ended: boolean; organizationId?: string; therapistId?: string; patientId?: string | null }> {
  const endedAt = new Date();

  const [row] = await db
    .update(sessions)
    .set({
      status: "completed",
      endedAt,
      autoEndedReason: reason,
      durationMinutes: sql`GREATEST(1, ROUND(EXTRACT(EPOCH FROM (${endedAt.toISOString()}::timestamptz - ${sessions.startedAt})) / 60))::int`,
      noteStatus: "generating",
      updatedAt: endedAt,
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.status, "in_progress")))
    .returning({
      organizationId: sessions.organizationId,
      therapistId: sessions.therapistId,
      patientId: sessions.patientId,
    });

  if (!row) return { ended: false };

  log.info("session auto-ended", { session: ref(sessionId), reason });
  /* 🔴 C6: a partner's clinician's session ended; the partner is told. */
  const { notifySessionEvent } = await import("@/lib/partner/webhooks");
  await notifySessionEvent(sessionId, "session.completed");
  return { ended: true, ...row };
}

/**
 * Close sessions that ran over and that nobody is watching.
 *
 * The ladder is enforced on the polls both sides make, which is the right place
 * for it — it costs nothing when nobody is in a session and it fires the moment
 * one runs over. But it has one blind spot, and this database contains an
 * example of it: a session whose clinician closed the tab and whose patient
 * never had one. Nothing polls, so nothing ever ends it, and it sits
 * `in_progress` with the clinician marked unavailable on the public radar.
 *
 * Bounded to sessions past the cap so it can never touch one that is genuinely
 * running, and folded into the nightly batch so it costs no extra wake.
 */
export async function sweepOverrunSessions(): Promise<{ ended: number }> {
  // The hard stop, read from settings rather than a constant: an admin who
  // lengthens a session must not have the sweeper end it early the same night.
  const { clock } = await getSettings();
  const cutoff = new Date(Date.now() - capSeconds(clock) * 1000);

  const stale = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.status, "in_progress"),
        isNotNull(sessions.startedAt),
        lt(sessions.startedAt, cutoff),
      ),
    )
    .limit(200);

  let ended = 0;
  for (const row of stale) {
    const result = await autoEndSession(row.id, "cap");
    if (!result.ended) continue;
    ended += 1;
    const { finishSession } = await import("@/lib/session-finish");
    await finishSession({
      sessionId: row.id,
      organizationId: result.organizationId!,
      therapistId: result.therapistId!,
      patientId: result.patientId ?? null,
    });
  }

  return { ended };
}

export async function completeSession(actor: Actor, sessionId: string) {
  const [current] = await db
    .select({
      status: sessions.status,
      startedAt: sessions.startedAt,
      patientId: sessions.patientId,
    })
    .from(sessions)
    .where(and(scope(actor), eq(sessions.id, sessionId)))
    .limit(1);
  if (!current) throw new TransitionError("Session not found");
  if (current.status === "completed") return { alreadyCompleted: true, patientId: current.patientId };
  if (!TRANSITIONS[current.status]?.includes("completed")) {
    throw new TransitionError("This session can no longer be completed");
  }

  const endedAt = new Date();
  const durationMinutes = current.startedAt
    ? Math.max(1, Math.round((endedAt.getTime() - current.startedAt.getTime()) / 60000))
    : null;

  await db
    .update(sessions)
    .set({
      status: "completed",
      endedAt,
      durationMinutes,
      noteStatus: "generating",
      /*
       * The join token survives the session ending, and it must.
       *
       * It used to be nulled here — "kill the link the moment the session
       * ends" — which was belt and braces, because `resolveJoinToken` already
       * refuses any session with an `ended_at`. The braces were doing the work
       * and the belt was strangling the patient: every feedback lookup finds
       * the session by this token, so nulling it meant nobody could ever rate
       * a session or receive their brief. The whole flow was dead on arrival
       * and nothing failed loudly, because a missing row just reads as an
       * expired link.
       *
       * Cancelling still clears it. A cancelled session has no brief to
       * collect and no rating to give.
       */
      updatedAt: endedAt,
    })
    .where(and(scope(actor), eq(sessions.id, sessionId)));

  if (current.patientId) {
    await db
      .update(patients)
      .set({ lastSessionAt: endedAt })
      .where(eq(patients.id, current.patientId));
  }

  await auditPhi(actor, "session.complete", {
    resourceType: "session",
    resourceId: sessionId,
    patientId: current.patientId,
  });
  /* 🔴 C6: see `autoEndSession`. */
  const { notifySessionEvent } = await import("@/lib/partner/webhooks");
  await notifySessionEvent(sessionId, "session.completed");

  return { alreadyCompleted: false, patientId: current.patientId };
}

/**
 * 🔴 C368 — this ignored the state machine above it, and sprint 58 made that
 * reachable.
 *
 * `TRANSITIONS` declares `completed: []`, and `startSession` and
 * `completeSession` both honour it. This did not: a bare UPDATE with no status
 * guard, which could flip a completed, billed, noted session to `cancelled`.
 *
 * It was latent for as long as nothing called it. Sprint 58 wired
 * `abandonSession` to a button, because the pricing page had promised one, and
 * a latent defect became a live one. The button only renders while a session is
 * live, but a server action is an endpoint: a UI condition is not enforcement,
 * and every other transition in this file is guarded in the database rather
 * than in a component.
 *
 * The guard is IN THE WHERE CLAUSE rather than a read followed by a write, so
 * two requests racing cannot both pass a check and then both write. Returning
 * the row count tells the caller whether anything happened, which a bare update
 * could not.
 */
export async function cancelSession(actor: Actor, sessionId: string): Promise<boolean> {
  const cancelled = await db
    .update(sessions)
    .set({ status: "cancelled", joinToken: null, updatedAt: new Date() })
    .where(
      and(
        scope(actor),
        eq(sessions.id, sessionId),
        inArray(
          sessions.status,
          // Exactly the states TRANSITIONS says may reach `cancelled`. Read from
          // the table rather than retyped, so the two cannot drift apart.
          CANCELLABLE_FROM,
        ),
      ),
    )
    .returning({ id: sessions.id });

  /*
   * 🔴 AND THE HOUR IS FREE AGAIN. A booked hour cancelled from the session
   * page stayed booked for ever; only the on-call screen freed it.
   */
  if (cancelled.length > 0) {
    await db
      .update(availabilitySlots)
      .set({ status: "open", sessionId: null, bookedByAccountId: null, note: null, updatedAt: new Date() })
      .where(and(eq(availabilitySlots.sessionId, sessionId), eq(availabilitySlots.status, "booked")));
  }

  return cancelled.length > 0;
}

// --------------------------------------------------------------- transcript ---

export async function getTranscript(actor: Actor, sessionId: string) {
  const [owned] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(scope(actor), eq(sessions.id, sessionId)))
    .limit(1);
  if (!owned) return [];

  return db
    .select()
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, sessionId))
    .orderBy(asc(transcriptSegments.sequence));
}

export async function nextSequence(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`COALESCE(MAX(${transcriptSegments.sequence}), 0)` })
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, sessionId));
  return (row?.max ?? 0) + 1;
}

// -------------------------------------------------------------------- notes ---

/**
 * 🔴 W2-F01 / D7: every note of a session, one per format. The primary first
 * (the session's own note, which carries the patient's copy), then the others
 * in the order they were written.
 */
export async function getNotes(actor: Actor, sessionId: string) {
  const rows = await db
    .select({ note: sessionNotes })
    .from(sessionNotes)
    .innerJoin(sessions, eq(sessions.id, sessionNotes.sessionId))
    .where(and(scope(actor), eq(sessionNotes.sessionId, sessionId)))
    .orderBy(desc(sessionNotes.isPrimary), asc(sessionNotes.createdAt));
  return rows.map((row) => row.note);
}

/**
 * 🔴 W2-F01: every note of these sessions, for the patient's history: format,
 * draft or signed, who wrote or signed it, and when. The text is not read here.
 */
export async function notesForSessions(actor: Actor, sessionIds: string[]) {
  if (sessionIds.length === 0) return [];
  return db
    .select({
      id: sessionNotes.id,
      sessionId: sessionNotes.sessionId,
      format: sessionNotes.format,
      status: sessionNotes.status,
      isPrimary: sessionNotes.isPrimary,
      createdAt: sessionNotes.createdAt,
      approvedAt: sessionNotes.approvedAt,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
    })
    .from(sessionNotes)
    .innerJoin(sessions, eq(sessions.id, sessionNotes.sessionId))
    .innerJoin(
      users,
      eq(users.id, sql`coalesce(${sessionNotes.approvedBy}, ${sessionNotes.therapistId})`),
    )
    .where(and(scope(actor), inArray(sessionNotes.sessionId, sessionIds)))
    .orderBy(desc(sessionNotes.isPrimary), asc(sessionNotes.createdAt));
}

export async function listRecentNotes(actor: Actor, limit = 50) {
  return db
    .select({
      id: sessionNotes.id,
      sessionId: sessionNotes.sessionId,
      status: sessionNotes.status,
      // 47.3 — how the note was made travels with the note, everywhere.
      provenance: sessionNotes.provenance,
      offRecordSeconds: sessionNotes.offRecordSeconds,
      patientStatus: sessionNotes.patientStatus,
      /* W2-F01: which document of the session this is. */
      format: sessionNotes.format,
      isPrimary: sessionNotes.isPrimary,
      createdAt: sessionNotes.createdAt,
      content: sessionNotes.content,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      guestName: sessions.guestName,
      sessionEndedAt: sessions.endedAt,
    })
    .from(sessionNotes)
    .innerJoin(sessions, eq(sessions.id, sessionNotes.sessionId))
    .leftJoin(patients, eq(patients.id, sessionNotes.patientId))
    .where(scope(actor))
    .orderBy(desc(sessionNotes.createdAt))
    .limit(limit);
}

/**
 * Notes still waiting on the clinician — either signature outstanding.
 *
 * A note whose chart is signed but whose patient summary has not been approved
 * is still work: somebody is waiting for it. Counting only `status` would have
 * dropped exactly those from the badge, which is the half that has a person on
 * the other end of it.
 */
export async function countOpenDrafts(actor: Actor): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessionNotes)
    .innerJoin(sessions, eq(sessions.id, sessionNotes.sessionId))
    .where(
      and(
        scope(actor),
        /*
         * 🔴 W2-F01: the patient's copy is the primary note's alone, so another
         * format's unused copy fields are nobody's work.
         */
        or(
          eq(sessionNotes.status, "draft"),
          and(eq(sessionNotes.isPrimary, true), eq(sessionNotes.patientStatus, "draft")),
        ),
      ),
    );
  return row?.count ?? 0;
}

// ------------------------------------------------------------- join tokens ---

/**
 * Resolve a patient join link. Unauthenticated by definition, so it returns the
 * bare minimum: enough to render a waiting room, and nothing clinical.
 *
 * The old endpoint returned the therapist's name and avatar *and* eagerly
 * created the video room for any caller holding a token that never expired.
 */
export async function resolveJoinToken(token: string) {
  const [row] = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      modality: sessions.modality,
      videoRoomUrl: sessions.videoRoomUrl,
      videoRoomName: sessions.videoRoomName,
      /* So `ensureRoom` can tell a live room from one Daily has already reaped. */
      videoRoomExpiresAt: sessions.videoRoomExpiresAt,
      expiresAt: sessions.joinTokenExpiresAt,
      organizationId: sessions.organizationId,
      therapistId: sessions.therapistId,
      patientId: sessions.patientId,
      // The paywall state. Returned because the join page has to render it, and
      // it is not clinical: a price and whether it has been settled.
      priceCents: sessions.priceCents,
      paymentStatus: sessions.paymentStatus,
      guestName: sessions.guestName,
      /*
       * 14.1's clock, on the page the patient is actually waiting on.
       *
       * `startedAt` is null until the clinician arrives, and `scheduledAt` is
       * when they said they would. Both are facts about a diary rather than
       * clinical material (C57), and without them the no-show recovery built
       * in sprint 14 had no screen to appear on.
       */
      startedAt: sessions.startedAt,
      scheduledAt: sessions.scheduledAt,
      /*
       * 🔴 HAS THIS PERSON ALREADY BEEN IN?
       *
       * The join page needs to tell a first arrival from a return. Without it,
       * a reload — which is all a dropped connection is — looked exactly like a
       * stranger opening the link, and the patient was sent back to "tell us
       * what to call you" after they had already given their name, answered the
       * recording question, and been in the room.
       */
      patientJoinedAt: sessions.patientJoinedAt,
      /*
       * 🔴 WHAT THEY ALREADY ANSWERED, SO THE ROOM DOES NOT ASK AGAIN.
       *
       * The room's "Your choices" panel started from `{recording: null}` and
       * waited for the five-second poll to tell it otherwise, so a patient who
       * had just answered "Yes, you may record this session" was shown
       * "Record this session — Turn on", their own consent displayed back to
       * them as not given. Two separate walks caught it independently.
       *
       * The answer is already on the row by then. Render it.
       */
      recordingConsent: sessions.recordingConsent,
      profileShareConsent: sessions.profileShareConsent,
      /*
       * 🔴 P20: a transfer the payer has DECLARED (sent, with a reference or a
       * receipt) and an operator has not decided yet. Read with the row so the
       * expiry below can tell somebody waiting on us from an abandoned link.
       */
      transferDeclared: sql<boolean>`EXISTS (
        SELECT 1 FROM ${manualPayments}
         WHERE ${manualPayments.purpose} = 'session'
           AND ${manualPayments.refId} = ${qualified(sessions.id)}
           AND ${manualPayments.state} = 'submitted')`,
    })
    .from(sessions)
    .where(and(eq(sessions.joinToken, token), isNull(sessions.endedAt)))
    .limit(1);

  if (!row) return null;

  /*
   * 🔴 P20: THE CLOCK ON A LINK IS FOR A LINK NOBODY HAS PAID FOR.
   *
   * A radar link lives three hours (`createRadarSession`), which is right for
   * somebody who books and walks away. It was also applied to somebody who
   * paid, or declared a transfer that an operator confirmed four hours later:
   * the confirmation flipped the session to paid and `/pay` answered it with
   * a 404, so the one person who had done everything asked of them could not
   * reach what they paid for.
   *
   * So money settled, or declared and waiting on us, holds the link open. An
   * unpaid expired link is exactly as dead as before, and so is any link
   * whose session has ended, been cancelled or completed (below): this lifts
   * the clock, never the state.
   */
  const committed = row.paymentStatus === "paid" || Boolean(row.transferDeclared);
  if (row.expiresAt && row.expiresAt < new Date() && !committed) return null;
  if (row.status === "cancelled" || row.status === "completed") return null;
  return row;
}

/**
 * Records the patient's chosen name against the session and marks them joined.
 *
 * 🔴 W2-P04: `personId` is the signed-in patient's, from their session cookie.
 * With it, a session with no patient yet is attached to that person's own file
 * with this clinician rather than to a new stranger with their first name.
 *
 * 🔴 P13: `receiptEmail` is the address the join form asks for "for your
 * receipt". It was read and thrown away, so a guest who typed it was never
 * sent one. It goes on `guest_email`, which is the column the transfer rail's
 * payment notice already reads for a guest (`lib/billing/payment-notices.ts`),
 * and only when the session has none: an address the clinician entered when
 * they sent the link is not replaced by whatever arrives on a form.
 */
export async function joinByToken(
  token: string,
  displayName: string,
  personId: string | null = null,
  receiptEmail: string | null = null,
) {
  const target = await resolveJoinToken(token);
  if (!target) return null;

  const name = displayName.trim().slice(0, 80);
  if (!name) return null;

  /*
   * The browser's `type="email"` already refuses a malformed address, so one
   * that fails this arrived by a hand-built post and is simply not stored.
   */
  const email = receiptEmail?.trim().toLowerCase().slice(0, 254) || null;
  const storedEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;

  /* Outside the transaction, for the reason `ensurePersonForPatient` is below. */
  const own =
    !target.patientId && personId
      ? await (await import("./people")).patientRowForPerson({
          organizationId: target.organizationId,
          therapistId: target.therapistId,
          personId,
        })
      : null;

  await db.transaction(async (tx) => {
    let patientId = target.patientId ?? own;

    if (!patientId) {
      const [created] = await tx
        .insert(patients)
        .values({
          organizationId: target.organizationId,
          therapistId: target.therapistId,
          firstName: name.split(/\s+/)[0]!,
          lastName: name.split(/\s+/).slice(1).join(" ") || null,
          source: "join_link",
        })
        .returning({ id: patients.id });
      patientId = created?.id ?? null;
    }

    await tx
      .update(sessions)
      .set({
        // COALESCE semantics: never overwrite an existing link.
        patientId: target.patientId ?? patientId,
        guestName: name,
        /* P13: the receipt address, never over one already on the session. */
        ...(storedEmail
          ? { guestEmail: sql<string>`COALESCE(${sessions.guestEmail}, ${storedEmail})` }
          : {}),
        patientJoinedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, target.id));
  });

  /*
   * After the transaction, not inside it (5.1).
   *
   * `ensurePersonForPatient` opens its own connection, and running it inside
   * this transaction would deadlock against the row this transaction is still
   * holding. A patient briefly without a person is a row the next read fixes;
   * a deadlock is a patient who cannot get into the room.
   */
  const [after] = await db
    .select({ patientId: sessions.patientId })
    .from(sessions)
    .where(eq(sessions.id, target.id))
    .limit(1);
  if (after?.patientId) await ensurePersonForPatient(after.patientId);

  return target.id;
}

/**
 * The session this clinician has live with this patient, if any.
 *
 * Used to stamp a copilot question with the session it was asked during, so
 * that "how much copilot did this session use" has an answer. Scoped through
 * `scope(actor)` like everything else here: a patient id from a URL cannot
 * reach a session on somebody else's caseload.
 *
 * Returns null when nothing is live, and null is a real answer — a question
 * asked on a Tuesday about a patient seen last week belongs to no session.
 */
export async function liveSessionForPatient(
  actor: Actor,
  patientId: string,
): Promise<{ id: string; startedAt: Date } | null> {
  /*
   * 🔴 48.6 / C224 — the free window is the session, and a session has an END.
   *
   * This asked for `status = 'in_progress'` and nothing else, which was
   * correct while the only thing the stamp did was attribute a question to a
   * session. 48.2 makes an in-room question **free**, and a status nobody
   * closes is then an unbounded giveaway: a therapist who opens a room on
   * Monday and never closes it has free model spend until somebody notices.
   * "Free means a therapist can open a room and never close it" is C224 in the
   * founder's own words.
   *
   * A session that has passed its own clock is over whether or not anything
   * got round to writing `completed`. The clock is the settings pair the room
   * already counts down with, so the boundary here and the boundary the
   * clinician watches on screen are the same boundary.
   */
  const settings = await getSettings();
  const liveMinutes = settings.clock.runningMinutes + settings.clock.countdownMinutes;

  const [row] = await db
    /*
     * 48.4 — the instant comes back with the id, from ONE query.
     *
     * The caller needs both: the id to mark the question free (48.2) and the
     * instant to bound what the copilot may read (48.4). Two lookups is two
     * answers to "is this a live session, and since when", and the way that
     * goes wrong is a session that is free but unbounded.
     */
    .select({ id: sessions.id, startedAt: sessions.startedAt })
    .from(sessions)
    .where(
      and(
        scope(actor),
        eq(sessions.patientId, patientId),
        eq(sessions.status, "in_progress"),
        /*
         * Started, and started recently enough to still be running. A session
         * with no `startedAt` is not live by any reading: `in_progress` without
         * a start time is a row mid-transition, not a room with people in it.
         */
        isNotNull(sessions.startedAt),
        gte(sessions.startedAt, new Date(Date.now() - liveMinutes * 60_000)),
      ),
    )
    .orderBy(desc(sessions.startedAt))
    .limit(1);

  // `isNotNull` above means this narrowing always succeeds; the check is here
  // because the column's type does not know that and a cast would hide it.
  return row?.startedAt ? { id: row.id, startedAt: row.startedAt } : null;
}

/* --------------------------------------------------------------- the room -- */

/**
 * 🔴 79.1 — THE ROOM A SESSION SHOULD ALREADY HAVE, BUILT NOW IF IT DOES NOT.
 *
 * ## Why a repair exists at all
 *
 * Creation is where a room belongs, and since 79.1 a video session cannot be
 * created without one. That leaves two cases this covers, and they are the two
 * that put a person in front of a black box:
 *
 *   1. **Every session made before 79.1.** Production is full of them, because
 *      `DAILY_API_KEY` was never set and the old code carried on regardless.
 *      Their patients still hold join links.
 *   2. **A room that was made and is gone.** Daily rooms carry a four-hour
 *      `exp` and `eject_at_room_exp`, so a session booked in the morning for
 *      the afternoon outlives its own room. Nothing noticed this before.
 *
 * ## Why it is safe to write during a render
 *
 * The UPDATE is conditional on the columns still being null, so two people
 * arriving at once cannot make two rooms and overwrite each other: the second
 * matches no row, re-reads, and uses the first one's. A room that is created
 * and then loses that race is abandoned rather than deleted, which costs one
 * unused room that expires in four hours and is the cheap side of the trade.
 */
export async function ensureRoom(session: {
  id: string;
  modality: string;
  videoRoomUrl: string | null;
  videoRoomName: string | null;
  /** When Daily reaps the room we already have. Null means we do not know. */
  videoRoomExpiresAt?: Date | null;
  /** The hour this session is for, so a room built early still opens on the day. */
  scheduledAt?: Date | null;
}): Promise<{ ok: true; url: string; name: string } | { ok: false; reason: string }> {
  if (session.modality !== "video") return { ok: false, reason: "not_video" };

  /*
   * 🔴 IS THERE A ROOM, AND IS IT STILL ALIVE WHEN THIS SESSION NEEDS IT.
   *
   * This used to be `if (url && name) return it`, which asks only the first
   * half. A Daily room has a hard expiry, so a URL in the row is not evidence
   * that anything is behind it — and because nothing ever nulls that column,
   * a dead URL was permanent and this heal could never fire again.
   *
   * What that cost, observed on production: a session booked for Wednesday
   * 16:00, a clinician who opened its room page on Monday out of curiosity,
   * and a room built with a four hour life that died 57 hours before the
   * appointment. On Wednesday both people would be handed a door that Daily
   * had already reaped, by the very code written to prevent that.
   *
   * A null expiry means a row from before this column existed. Treated as
   * expired on purpose: the cost of rebuilding unnecessarily is one wasted
   * room, and the cost of the other guess is two people in a session they
   * cannot enter.
   */
  const needsBy = session.scheduledAt ?? new Date();
  const alive =
    session.videoRoomUrl &&
    session.videoRoomName &&
    session.videoRoomExpiresAt &&
    session.videoRoomExpiresAt > needsBy;

  if (alive) {
    return { ok: true, url: session.videoRoomUrl!, name: session.videoRoomName! };
  }

  const { createPrivateRoom } = await import("@/lib/video");
  const made = await createPrivateRoom(session.id, { liveAt: session.scheduledAt ?? null });
  if (!made.ok) {
    log.error("a session has no video room and one could not be made", {
      session: ref(session.id),
      reason: made.reason,
    });
    return { ok: false, reason: made.reason };
  }

  /*
   * The conditional UPDATE still makes two concurrent arrivals safe, but the
   * condition can no longer be "there is no room" — we are now also here to
   * REPLACE a dead one. So: take it if the row has no room, or if the room it
   * has is already expired. Whoever writes a live room first wins, and the
   * loser reads theirs back below.
   */
  const [claimed] = await db
    .update(sessions)
    .set({
      videoRoomUrl: made.room.url,
      videoRoomName: made.room.name,
      videoRoomExpiresAt: made.room.expiresAt,
    })
    .where(
      and(
        eq(sessions.id, session.id),
        or(
          isNull(sessions.videoRoomUrl),
          isNull(sessions.videoRoomExpiresAt),
          lt(sessions.videoRoomExpiresAt, needsBy),
        ),
      ),
    )
    .returning({ url: sessions.videoRoomUrl, name: sessions.videoRoomName });

  if (claimed?.url && claimed.name) {
    log.info("built a missing video room", { session: ref(session.id) });
    return { ok: true, url: claimed.url, name: claimed.name };
  }

  /* Somebody beat us to it. Theirs is the real one. */
  const [winner] = await db
    .select({ url: sessions.videoRoomUrl, name: sessions.videoRoomName })
    .from(sessions)
    .where(eq(sessions.id, session.id))
    .limit(1);

  return winner?.url && winner.name
    ? { ok: true, url: winner.url, name: winner.name }
    : { ok: false, reason: "unreachable" };
}
