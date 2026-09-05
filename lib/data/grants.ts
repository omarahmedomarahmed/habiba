import "server-only";

import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  historyGrants,
  patients,
  people,
  users,
  type GrantShape,
  type HistoryGrant,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { consume, subjectKey } from "@/lib/rate-limit";

import {
  accessStateFor,
  capabilitiesFor,
  isRejectionReason,
  type AccessState,
  type Capabilities,
} from "@/lib/access/state";

/**
 * Consent, and the four states that hang off it. PLAN.md 7.1–7.7.
 *
 * The decision itself lives in `lib/access/state.ts`, pure and tested. This
 * module is the part that needs a database: reading the grant, writing the
 * request, honouring the answer.
 *
 * ## Everything here is keyed on a *person*
 *
 * A grant is given by the human being, and it covers everything of theirs. A
 * therapist asks about a patient row; this module resolves that to a person
 * first, and if there is no person the answer is "unclaimed" — which is the
 * correct answer, not a missing one.
 */

/** 7.3 — a therapist may ask twice a day, per patient. Spam is the failure mode. */
const REQUESTS_PER_DAY = 2;
const DAY_SECONDS = 24 * 60 * 60;

const GRANT_24H_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------- reading -- */

/**
 * The live grant between a person and a therapist, if there is one.
 *
 * "Live" is decided by `isLiveGrant` on the way out rather than in SQL, so the
 * expiry rule has exactly one implementation.
 */
async function liveGrantRow(
  personId: string,
  therapistUserId: string,
): Promise<HistoryGrant | null> {
  const [row] = await db
    .select()
    .from(historyGrants)
    .where(
      and(
        eq(historyGrants.personId, personId),
        eq(historyGrants.therapistUserId, therapistUserId),
        inArray(historyGrants.status, ["pending", "granted"]),
      ),
    )
    .orderBy(desc(historyGrants.createdAt))
    .limit(1);

  return row ?? null;
}

export type Access = {
  state: AccessState;
  capabilities: Capabilities;
  personId: string | null;
  /** Present whenever a row exists, live or not — the UI shows "requested" too. */
  grant: Pick<HistoryGrant, "id" | "status" | "shape" | "expiresAt" | "requestedAt"> | null;
};

/**
 * 7.7 — what this therapist may see about this patient, right now.
 *
 * Scoped like every other patient read: the row must be in their organisation
 * and (unless they are a super admin) on their caseload. A patient id that
 * fails that check comes back as `no_relationship` rather than as an error,
 * because "you have no record for this person" is exactly what it means.
 */
export async function accessFor(actor: Actor, patientId: string): Promise<Access> {
  const [row] = await db
    .select({
      patientId: patients.id,
      personId: patients.personId,
      claimedAt: people.claimedAt,
      clinical: patients.clinical,
    })
    .from(patients)
    .leftJoin(people, eq(people.id, patients.personId))
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.organizationId, actor.organizationId),
        actor.role === "super_admin" ? undefined : eq(patients.therapistId, actor.userId),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    const state = accessStateFor({
      hasPatientRow: false,
      claimed: false,
      documented: false,
      grant: null,
      now: new Date(),
    });
    return { state, capabilities: capabilitiesFor(state), personId: null, grant: null };
  }

  const grant = row.personId ? await liveGrantRow(row.personId, actor.userId) : null;

  const state = accessStateFor({
    hasPatientRow: true,
    claimed: row.claimedAt !== null,
    /*
     * C46: §3 unlocks the unclaimed allowance with "a diagnosis **and**
     * written or dictated history". There is nowhere to store a history yet —
     * `clinical` holds only `diagnoses` and `goals` — so this asks the half of
     * the question the data model can answer, and the state is reported rather
     * than used to take anything away.
     */
    documented: (row.clinical?.diagnoses?.length ?? 0) > 0,
    grant: grant ? { status: grant.status, expiresAt: grant.expiresAt } : null,
    now: new Date(),
  });

  return {
    state,
    capabilities: capabilitiesFor(state),
    personId: row.personId,
    grant: grant
      ? {
          id: grant.id,
          status: grant.status,
          shape: grant.shape,
          expiresAt: grant.expiresAt,
          requestedAt: grant.requestedAt,
        }
      : null,
  };
}

/** Everything a person has been asked for, and everything they have given. 13.7 / 7.5. */
export async function grantsForPerson(personId: string) {
  return db
    .select({
      id: historyGrants.id,
      status: historyGrants.status,
      shape: historyGrants.shape,
      requestNote: historyGrants.requestNote,
      requestedAt: historyGrants.requestedAt,
      decidedAt: historyGrants.decidedAt,
      expiresAt: historyGrants.expiresAt,
      revokedAt: historyGrants.revokedAt,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
      therapistId: users.id,
    })
    .from(historyGrants)
    .innerJoin(users, eq(users.id, historyGrants.therapistUserId))
    .where(eq(historyGrants.personId, personId))
    .orderBy(desc(historyGrants.createdAt));
}

/* ------------------------------------------------------------- writing -- */

export type RequestResult = { ok: true; grantId: string } | { ok: false; error: string };

/**
 * 7.3 — a therapist asks, with a note.
 *
 * Rate limited per (therapist, patient), not per therapist: a clinician with
 * forty patients has forty legitimate reasons to ask, and a global limit would
 * punish a busy practice while doing nothing about somebody pestering one
 * person. Two a day is enough to recover from a mis-typed note and not enough
 * to be a channel for pressure.
 *
 * Refuses on an unclaimed record. There is nobody to ask (§6), and a pending
 * request against a record with no owner would sit there forever looking like
 * something is in flight.
 */
export async function requestAccess(input: {
  actor: Actor;
  patientId: string;
  note: string;
}): Promise<RequestResult> {
  const access = await accessFor(input.actor, input.patientId);

  if (!access.personId || access.state === "no_relationship") {
    return { ok: false, error: "You have no record for this person." };
  }
  if (access.state.startsWith("unclaimed")) {
    return {
      ok: false,
      error:
        "This record has not been claimed by the person it describes, so there is nobody to ask.",
    };
  }
  if (access.state === "granted") {
    return { ok: false, error: "You already have access." };
  }
  if (access.grant?.status === "pending") {
    return { ok: false, error: "You have already asked. They have not answered yet." };
  }

  const note = input.note.trim();
  if (!note) return { ok: false, error: "Say why you are asking." };
  if (note.length > 500) return { ok: false, error: "Keep the note under 500 characters." };

  const verdict = await consume(
    subjectKey("grant:request", `${input.actor.userId}:${input.patientId}`),
    REQUESTS_PER_DAY,
    DAY_SECONDS,
  );
  if (!verdict.allowed) {
    return { ok: false, error: "You have already asked twice today. Give them time to answer." };
  }

  const now = new Date();
  const [created] = await db
    .insert(historyGrants)
    .values({
      personId: access.personId,
      therapistUserId: input.actor.userId,
      organizationId: input.actor.organizationId,
      status: "pending",
      requestNote: note,
      requestedAt: now,
      updatedAt: now,
    })
    /*
     * The partial unique index covers pending and granted rows, so a race
     * between two tabs cannot produce two pending requests. Doing nothing on
     * conflict rather than updating: the second press is a duplicate, and
     * rewriting the note under a request the patient may already be reading
     * would change the question after it was asked.
     */
    .onConflictDoNothing({
      target: [historyGrants.personId, historyGrants.therapistUserId],
      /*
       * `where` here is the *index predicate*, matching the partial unique
       * index — not a filter on the row being inserted. Postgres refuses a
       * partial index as an ON CONFLICT arbiter without it (C44, the same
       * mistake one sprint earlier).
       */
      where: sql`status IN ('pending', 'granted')`,
    })
    .returning({ id: historyGrants.id });

  if (!created) return { ok: false, error: "You have already asked. They have not answered yet." };

  await audit({
    actor: input.actor,
    category: "clinical",
    action: "grant.request",
    resourceType: "history_grant",
    resourceId: created.id,
    patientId: input.patientId,
    reason: note,
  });

  return { ok: true, grantId: created.id };
}

export type DecideResult = { ok: true } | { ok: false; error: string };

/**
 * 7.2 / 7.4 — the person answers.
 *
 * Both answers are one conditional UPDATE against `status = 'pending'`, so an
 * answer that arrives twice (a double tap, a stale tab) lands once. `granted`
 * writes the expiry now rather than deriving it later: a 24-hour grant means
 * 24 hours from the moment they said yes, and a window computed at read time
 * moves every time somebody reads it.
 */
export async function decideGrant(input: {
  accountId: string;
  personId: string;
  grantId: string;
  decision: "granted" | "rejected";
  shape?: GrantShape;
  reason?: string | null;
}): Promise<DecideResult> {
  const now = new Date();

  if (input.decision === "granted" && !input.shape) {
    return { ok: false, error: "Choose how long they may have access." };
  }

  const [updated] = await db
    .update(historyGrants)
    .set({
      status: input.decision,
      shape: input.decision === "granted" ? input.shape : null,
      decidedAt: now,
      expiresAt:
        input.decision === "granted" && input.shape === "24h"
          ? new Date(now.getTime() + GRANT_24H_MS)
          : null,
      rejectionReason:
        input.decision === "rejected" && isRejectionReason(input.reason) ? input.reason : null,
      updatedAt: now,
    })
    .where(
      and(
        eq(historyGrants.id, input.grantId),
        // Their own record. A grant id from somewhere else must not be
        // answerable by whoever is signed in.
        eq(historyGrants.personId, input.personId),
        eq(historyGrants.status, "pending"),
      ),
    )
    .returning({ id: historyGrants.id, therapist: historyGrants.therapistUserId });

  if (!updated) return { ok: false, error: "That request is no longer waiting for an answer." };

  await audit({
    patientAccountId: input.accountId,
    actor: null,
    category: "clinical",
    action: input.decision === "granted" ? "grant.granted" : "grant.rejected",
    resourceType: "history_grant",
    resourceId: updated.id,
    reason: input.decision === "granted" ? (input.shape ?? null) : (input.reason ?? null),
  });

  log.info("grant decided", { grant: ref(updated.id), decision: input.decision });
  return { ok: true };
}

/**
 * 7.5 — revoke, in one tap, effective immediately.
 *
 * Immediate because the next `accessFor` reads the row; there is no cache and
 * no session to expire. What it does not do is reach backwards: §3 is explicit
 * that the therapist keeps the conversation they already had, and
 * `capabilitiesFor("revoked")` says so.
 */
export async function revokeGrant(input: {
  accountId: string;
  personId: string;
  grantId: string;
}): Promise<DecideResult> {
  const now = new Date();

  const [updated] = await db
    .update(historyGrants)
    .set({ status: "revoked", revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(historyGrants.id, input.grantId),
        eq(historyGrants.personId, input.personId),
        eq(historyGrants.status, "granted"),
      ),
    )
    .returning({ id: historyGrants.id });

  if (!updated) return { ok: false, error: "That access has already ended." };

  await audit({
    patientAccountId: input.accountId,
    actor: null,
    category: "clinical",
    action: "grant.revoked",
    resourceType: "history_grant",
    resourceId: updated.id,
  });

  return { ok: true };
}

/**
 * Sprint 6's step 7, honoured. Called when a claim completes.
 *
 * The claim asked "does your therapist keep access?" and stored the answer;
 * until now nothing acted on it. Saying **yes** creates an open-ended grant to
 * every clinician who already holds a record for this person — plural, because
 * a person may have been written down by more than one. Saying **no** creates
 * nothing at all, which is what makes the default off: absence of a grant is
 * the revoked state, and revoked is where §3 starts.
 */
export async function applyClaimDecision(input: {
  personId: string;
  accountId: string;
  therapistKeepsAccess: boolean;
}): Promise<number> {
  if (!input.therapistKeepsAccess) {
    await audit({
      patientAccountId: input.accountId,
      actor: null,
      category: "clinical",
      action: "grant.withheld_at_claim",
      resourceType: "person",
      resourceId: input.personId,
    });
    return 0;
  }

  /*
   * `patients.therapist_id` is nullable, so a record that lost its clinician
   * has nobody to grant to. Filtered in SQL rather than skipped in the loop:
   * an insert with a null therapist would fail at the database anyway, and a
   * loop that quietly skips rows hides how many clinicians were actually
   * covered.
   */
  const holders = await db
    .selectDistinct({ therapistId: patients.therapistId, organizationId: patients.organizationId })
    .from(patients)
    .where(
      and(
        eq(patients.personId, input.personId),
        isNull(patients.deletedAt),
        isNotNull(patients.therapistId),
      ),
    );

  const now = new Date();
  let created = 0;

  for (const holder of holders) {
    // Unreachable — the query filters it — but narrowing here beats a `!`,
    // which asserts something the type system cannot check.
    if (!holder.therapistId) continue;

    const [row] = await db
      .insert(historyGrants)
      .values({
        personId: input.personId,
        therapistUserId: holder.therapistId,
        organizationId: holder.organizationId,
        status: "granted",
        shape: "open",
        decidedAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [historyGrants.personId, historyGrants.therapistUserId],
        where: sql`status IN ('pending', 'granted')`,
      })
      .returning({ id: historyGrants.id });

    if (row) created += 1;
  }

  await audit({
    patientAccountId: input.accountId,
    actor: null,
    category: "clinical",
    action: "grant.kept_at_claim",
    resourceType: "person",
    resourceId: input.personId,
    reason: `${created} clinician(s)`,
  });

  return created;
}

/** Requests waiting on this person. The patient's own screen (13.7). */
export async function pendingRequestsFor(personId: string) {
  return db
    .select({
      id: historyGrants.id,
      requestNote: historyGrants.requestNote,
      requestedAt: historyGrants.requestedAt,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
    })
    .from(historyGrants)
    .innerJoin(users, eq(users.id, historyGrants.therapistUserId))
    .where(and(eq(historyGrants.personId, personId), eq(historyGrants.status, "pending")))
    .orderBy(desc(historyGrants.requestedAt));
}

/** Counts for the verifier and the admin console. */
export async function grantCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: historyGrants.status, n: sql<number>`COUNT(*)::int` })
    .from(historyGrants)
    .groupBy(historyGrants.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
