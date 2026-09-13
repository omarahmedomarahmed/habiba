import "server-only";

import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { sessionSources, sessions } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * 🔴 55.7 — A SESSION HELD ELSEWHERE, LANDING IN OUR RECORD, SOURCE-ATTRIBUTED.
 *
 * *Through the door 36 built*, which is `session_sources`. That table exists so a chart
 * can say WHERE a session happened, and the whole value of the partner plane to a patient
 * depends on it: §7's position is that we are *the clinical record layer above whatever a
 * therapist already uses*, and a layer that cannot say which tool a session was held in is
 * not a record of anything.
 *
 * ## 🔴 WHAT THIS WRITES, AND THE FOUR THINGS IT DOES NOT
 *
 * It writes a `sessions` row marked completed with a duration, and a `session_sources` row
 * of kind `partner_platform` naming the partner's own meeting id. That is all.
 *
 * It does NOT write:
 *
 *   - **A note.** Content in a chart needs a named clinician who approved that exact text
 *     (§7's first hard rule). A partner's server is not one.
 *   - **A transcript.** Same rule, and worse: a transcript arriving from outside has no
 *     consent record attached to it, and C214's whole design is that consent is recorded
 *     on the session it belongs to.
 *   - **A price or a payment.** A session held on their platform was paid for on their
 *     platform. Inventing a `price_cents` here would put a charge in our books for money
 *     that never came to us.
 *   - **A recording consent.** `recording_consent` stays null, which reads as "the patient
 *     did not turn it on" everywhere it is consulted, and is the correct reading: nobody
 *     asked them, here.
 *
 * ## 🔴 AND IT IS IDEMPOTENT ON THE PARTNER'S OWN ID
 *
 * A partner retrying a failed request must not produce a second session in somebody's
 * chart. The external meeting id is the natural key: a writeback naming an id we already
 * have returns the session we already made, rather than a second one that a clinician
 * would have to notice and delete.
 */
export async function recordExternalSession(input: {
  partnerId: string;
  organizationId: string;
  therapistId: string;
  patientId: string;
  startedAt: Date;
  durationMinutes: number;
  /**
   * The partner's own id for the meeting. Required, because without it there is no
   * idempotency key and no way for a chart to say which of their sessions this was.
   */
  externalMeetingId?: string;
}): Promise<{ sessionId: string } | { error: string; status: 400 }> {
  const minutes = Math.round(input.durationMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 600) {
    return { error: "That duration is not a session.", status: 400 };
  }
  if (Number.isNaN(input.startedAt.getTime())) {
    return { error: "That start time is not a date.", status: 400 };
  }
  /*
   * 🔴 A session cannot have happened in the future, and the check is worth having because
   * the caller is somebody else's clock. A writeback dated next Tuesday would sit in a
   * clinician's schedule as an appointment they have not agreed to.
   */
  if (input.startedAt.getTime() > Date.now() + 60_000) {
    return { error: "That session has not happened yet.", status: 400 };
  }

  const externalMeetingId = input.externalMeetingId?.trim();
  if (!externalMeetingId) {
    return { error: "Name the session in your own system, so a retry is not a duplicate.", status: 400 };
  }

  /*
   * 🔴 Idempotent on (partner's meeting id, organisation).
   *
   * Scoped to the organisation as well as the id, because two partners may both send
   * `"M-1"` for the same reason 42.2 exists: an external reference is meaningless without
   * whose it is.
   */
  const [existing] = await controlDb
    .select({ sessionId: sessionSources.sessionId })
    .from(sessionSources)
    .where(
      and(
        eq(sessionSources.externalMeetingId, externalMeetingId),
        eq(sessionSources.organizationId, input.organizationId),
        eq(sessionSources.kind, "partner_platform"),
      ),
    )
    .limit(1);

  if (existing) return { sessionId: existing.sessionId };

  const endedAt = new Date(input.startedAt.getTime() + minutes * 60 * 1000);

  const [created] = await controlDb
    .insert(sessions)
    .values({
      organizationId: input.organizationId,
      therapistId: input.therapistId,
      patientId: input.patientId,
      status: "completed",
      /*
       * `in_person` is wrong and `video` is a guess, so: the modality a partner's platform
       * used is a fact we do not have. `video` is the honest default for a platform that
       * embeds us, and `session_sources` carries the thing that actually matters, which is
       * whose platform it was.
       */
      modality: "video",
      scheduledAt: input.startedAt,
      startedAt: input.startedAt,
      endedAt,
      durationMinutes: minutes,
      feedbackToken: randomBytes(24).toString("base64url"),
      /* 🔴 No price. It was paid for on their platform, not in our books. */
      priceCents: 0,
      paymentStatus: "not_required",
    })
    .returning({ id: sessions.id });

  if (!created) return { error: "That session could not be written.", status: 400 };

  /*
   * 🔴 THE SOURCE ROW, and `provisioned_by_user_id` is the CLINICIAN.
   *
   * `session_sources_external_is_provisioned` requires an external kind to name who made
   * the meeting and when. The partner's platform created it on that clinician's behalf, and
   * naming the clinician keeps the column's meaning: who is answerable for this hour
   * existing. 0076 adds `partner_platform` to that constraint's list, which is the half a
   * careless enum extension would have missed.
   */
  await controlDb.insert(sessionSources).values({
    sessionId: created.id,
    organizationId: input.organizationId,
    kind: "partner_platform",
    externalMeetingId,
    provisionedAt: new Date(),
    provisionedByUserId: input.therapistId,
  });

  log.info("partner session written back", {
    session: ref(created.id),
    partner: ref(input.partnerId),
  });

  return { sessionId: created.id };
}
