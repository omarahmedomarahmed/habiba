import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { acrossRegions, dbFor } from "@/lib/db";
import { regionOfOrganization, regionOfPatient } from "@/lib/db/directory";
import { EXTERNAL_SOURCE_KINDS, sessionSources, sessions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";
import { dispatchBot, removeBot } from "./recall";

/**
 * Sending the bot, and taking it out again. PLAN.md 41.1, 41.7, 41.8.
 *
 * ## 🔴 41.8 — there is no bot button, and that is the design (C216)
 *
 * > *A button a therapist can forget is a session that silently went
 * > untranscribed; a button they can press is a bot that can be sent somewhere
 * > it should not go.*
 *
 * So `sendBotForConsent` has exactly one caller: `answerConsent`. It is not
 * exported to any component, no server action calls it directly, and there is
 * no admin tool that dispatches. A decline dispatches nothing at all — not a
 * bot that joins and stays quiet — which is both the ethics and the cost
 * answer, since Recall bills per bot-hour and a bot on a declined session is
 * money spent recording nothing.
 *
 * ## 🔴 41.1 — it joins meetings WE created, and the database says so
 *
 * `session_sources_bot_only_if_ours` refuses a `bot_id` on any row without
 * `provisioned_at` and `provisioned_by_user_id`, and 0064 already refuses an
 * external kind without them. So there is no path — through this file, a
 * future call site, or an admin tool — that puts a bot into a meeting a
 * therapist pasted. Everything below is the sentence a person reads; the
 * constraint is the rule.
 *
 * ## 🔴 41.7 — reconnect without duplicating
 *
 * The claim is a conditional UPDATE against `bot_id IS NULL`, and
 * `session_sources_bot_unique` underneath it. A network blip means our
 * dispatch may have succeeded while its response was lost, so a retry is the
 * ordinary case. A second bot is not a duplicate row: it is a second recorder
 * in a room where the patient agreed to one.
 */

async function regionFor(patientId: string | null, organizationId: string) {
  return patientId ? regionOfPatient(patientId) : regionOfOrganization(organizationId);
}

/**
 * 🔴 The only dispatcher. Called by `answerConsent` and by nothing else.
 *
 * Returns quietly in every case a bot should not be sent, because this runs
 * inside a patient pressing "yes" on a consent screen and nothing here may
 * stop them reaching their session. A meeting that cannot be recorded is a
 * session that happens without a transcript, which is the pre-41 behaviour and
 * is fine; a consent screen that errors is a patient who cannot get in.
 */
export async function sendBotForConsent(sessionId: string): Promise<void> {
  /*
   * 30.1 — `acrossRegions`, for the same reason `sourceForIngest` uses it:
   * this runs from an unauthenticated consent action holding a session id and
   * nothing to route on.
   */
  const rows = await acrossRegions((db) =>
    db
      .select({
        kind: sessionSources.kind,
        externalMeetingId: sessionSources.externalMeetingId,
        provisionedAt: sessionSources.provisionedAt,
        botId: sessionSources.botId,
        organizationId: sessions.organizationId,
        patientId: sessions.patientId,
      })
      .from(sessionSources)
      .innerJoin(sessions, eq(sessions.id, sessionSources.sessionId))
      .where(eq(sessionSources.sessionId, sessionId))
      .limit(1),
  );

  const source = rows[0];
  if (!source) return;

  /*
   * 🔴 Four refusals, and none of them is an error a patient sees.
   *
   * Not an external meeting: the 24Therapy room records itself and an
   * in-person session has no meeting to join.
   * Not provisioned by us: the constraint would refuse the write anyway, and
   * refusing here means we never call the provider for it either.
   * Already has a bot: 41.7, the reconnect case.
   */
  if (!EXTERNAL_SOURCE_KINDS.includes(source.kind)) return;
  if (!source.provisionedAt || !source.externalMeetingId) return;
  if (source.botId) return;

  const sent = await dispatchBot({
    meetingUrl: source.externalMeetingId,
    /*
     * 🔴 41.5 / C134 — a plain label, never a patient's name.
     *
     * A bot named after the person it is recording puts their name into a
     * participant list that everybody in a group or a couples session can
     * read. The transcript learns who is speaking from the session we created,
     * not from anything in the room.
     */
    displayName: "24Therapy recorder",
    webhookUrl: `${env.appUrl}/api/meetings/transcript/${sessionId}`,
  });

  if (!sent.ok) {
    log.info("bot not dispatched", { session: ref(sessionId), configured: sent.configured });
    return;
  }

  /*
   * 🔴 The claim, conditional on there being no bot yet.
   *
   * Two consent actions racing — a double-tap, a retried form post — must
   * produce one bot. The loser's UPDATE matches nothing, and its bot is
   * removed immediately rather than left in the room.
   */
  const db = dbFor(await regionFor(source.patientId, source.organizationId));
  const [claimed] = await db
    .update(sessionSources)
    .set({
      botId: sent.botId,
      botDispatchedAt: new Date(),
      botStatus: "dispatched",
      updatedAt: new Date(),
    })
    .where(and(eq(sessionSources.sessionId, sessionId), isNull(sessionSources.botId)))
    .returning({ id: sessionSources.id });

  if (!claimed) {
    log.warn("second bot dispatched for one session, removing it", { session: ref(sessionId) });
    await removeBot(sent.botId);
    return;
  }

  log.info("bot dispatched on consent", { session: ref(sessionId) });
}

/**
 * 🔴 41.7 — consent revoked mid-session. The bot LEAVES.
 *
 * Not paused, not muted, not left in the room transcribing into a buffer
 * nobody reads. A patient who withdraws consent has withdrawn it, and a
 * recorder still sitting in the call is a recorder they were told had gone.
 *
 * The stamp is written whether or not the provider confirms. Refusing to
 * process the audio is under our control; the provider's cooperation is not,
 * and a failed API call must not leave us believing a bot is still authorised.
 */
export async function withdrawBot(input: {
  sessionId: string;
  organizationId: string;
  patientId: string | null;
  reason: "consent_withdrawn" | "session_ended" | "wrong_meeting";
}): Promise<void> {
  const db = dbFor(await regionFor(input.patientId, input.organizationId));

  const [row] = await db
    .select({ botId: sessionSources.botId })
    .from(sessionSources)
    .where(eq(sessionSources.sessionId, input.sessionId))
    .limit(1);

  if (!row?.botId) return;

  await db
    .update(sessionSources)
    .set({ botLeftAt: new Date(), botStatus: input.reason, updatedAt: new Date() })
    .where(eq(sessionSources.sessionId, input.sessionId));

  const left = await removeBot(row.botId);
  if (!left.ok) {
    /*
     * Loud, because this is the one failure in the file that leaves a
     * recorder in a room it should not be in. The stamp above means nothing
     * it sends will be processed, which is the half we control.
     */
    log.warn("bot did not confirm it left", {
      session: ref(input.sessionId),
      reason: input.reason,
    });
  }

  log.info("bot withdrawn", { session: ref(input.sessionId), reason: input.reason });
}

/**
 * 🔴 41.7 — "a bot in the wrong meeting is a hard stop".
 *
 * The strongest of the eighteen edge cases and the only one that is not a
 * degradation. If a transcript arrives for a bot id we did not dispatch for
 * that session, something has gone wrong in a way nobody can reason about: the
 * safe reading is that a recorder is in a room we did not send it to, possibly
 * somebody else's.
 *
 * So: no partial acceptance, no "record it and flag it for review", no
 * best-effort matching on a meeting URL. The audio is refused, the bot is
 * removed, and it is audited — because a year later somebody will need to know
 * this happened and what we did about it.
 */
export async function assertOurBot(input: {
  sessionId: string;
  botId: string;
  organizationId: string;
  patientId: string | null;
}): Promise<boolean> {
  const db = dbFor(await regionFor(input.patientId, input.organizationId));

  const [row] = await db
    .select({ botId: sessionSources.botId })
    .from(sessionSources)
    .where(eq(sessionSources.sessionId, input.sessionId))
    .limit(1);

  if (row?.botId === input.botId) return true;

  log.warn("HARD STOP, transcript from a bot we did not send", {
    session: ref(input.sessionId),
  });

  await audit({
    /*
     * 🔴 `null`, because nobody did this.
     *
     * A hard stop is the machine noticing an anomaly, not a person acting.
     * Naming the clinician as the actor would put their id against an event
     * they had no part in, and "who did this" is a question the audit log has
     * to be able to answer honestly with "nobody".
     */
    actor: null,
    category: "clinical",
    action: "meeting.wrong_bot",
    resourceType: "session",
    resourceId: input.sessionId,
  });

  // Remove it rather than only refusing its audio. A recorder in the wrong
  // room is a problem whether or not we are listening to it.
  await removeBot(input.botId);
  return false;
}
