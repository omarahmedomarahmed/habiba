import "server-only";

import { env, features } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";

/**
 * The bot, through Recall.ai. PLAN.md 41.6.
 *
 * > *Our differentiation is not that we worked out how to join Zoom.*
 *
 * So this file is thin on purpose, and everything interesting about the meeting
 * bot lives somewhere else: what may be joined is a database constraint
 * (`session_sources_bot_only_if_ours`), when it is dispatched is the patient's
 * consent and nothing else (41.8), and who is speaking comes from the session
 * we created rather than from anything the provider tells us (41.5).
 *
 * ## 🔴 What this adapter is not allowed to become
 *
 * It takes a meeting URL and returns a bot id. It does not decide whether to
 * join, does not look anything up, and has no access to a session, a patient
 * or a consent state. A provider adapter that could decide to join is a second
 * dispatcher, and 41.8's whole argument is that there is exactly one.
 *
 * ## Unconfigured is a SENTENCE, not a crash
 *
 * With no `RECALL_API_KEY` the dispatch refuses and says so. The integrations
 * page asks `features.meetingBots` first and tells a clinician before they
 * try, the same way `whatsappConfigured()` keeps the reset page honest about a
 * channel that is down. A product that offers a button it cannot honour is the
 * defect `lib/integrations/registry.ts` exists to prevent, arriving through the
 * portal instead of the marketing site.
 */

export type DispatchResult =
  | { ok: true; botId: string }
  | { ok: false; error: string; configured: boolean };

/**
 * Send a bot into a meeting.
 *
 * 🔴 `meetingUrl` must come from a `session_sources` row we provisioned. This
 * function cannot check that and does not try: the check belongs at the call
 * site where a session is in hand, and in the CHECK constraint underneath it,
 * which is the one that survives the next writer.
 */
export async function dispatchBot(input: {
  meetingUrl: string;
  /**
   * What the participants see in the room.
   *
   * 🔴 Deliberately a plain, honest label and never a patient's name. A bot
   * named after the person it is recording puts their name in a participant
   * list that may be visible to everybody in a group or a couples session.
   */
  displayName: string;
  /** Where the provider sends transcript and status. Ours, signed. */
  webhookUrl: string;
}): Promise<DispatchResult> {
  if (!features.meetingBots) {
    return {
      ok: false,
      configured: false,
      error:
        "Meeting recording is not switched on for this deployment, so no bot was sent. The session runs normally and is not transcribed.",
    };
  }

  try {
    const response = await fetch(`${env.recallBaseUrl}/api/v1/bot/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${env.recallApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        meeting_url: input.meetingUrl,
        bot_name: input.displayName,
        /*
         * Transcription on, and the real-time endpoint pointed at us.
         *
         * 41.7's "out-of-order transcript reconciled" is why we take the
         * timestamped stream rather than a file at the end: a segment carries
         * its own offset, so arrival order stops mattering.
         */
        transcription_options: { provider: "meeting_captions" },
        real_time_transcription: {
          destination_url: input.webhookUrl,
          partial_results: false,
        },
      }),
    });

    if (!response.ok) {
      /*
       * The provider's body is not shown to a clinician. It is their error
       * vocabulary, not ours, and "401 Unauthorized" on a therapist's screen
       * during a session is noise they can do nothing with.
       */
      log.warn("recall dispatch refused", { status: response.status });
      return {
        ok: false,
        configured: true,
        error: "The recorder could not join this meeting. The session runs normally without it.",
      };
    }

    const body = (await response.json()) as { id?: string };
    if (!body.id) {
      return {
        ok: false,
        configured: true,
        error: "The recorder did not confirm it joined, so nothing was recorded.",
      };
    }

    return { ok: true, botId: body.id };
  } catch (error) {
    log.warn("recall dispatch failed", { reason: safeErrorMessage(error) });
    return {
      ok: false,
      configured: true,
      error: "The recorder could not be reached. The session runs normally without it.",
    };
  }
}

/**
 * Take the bot out. 41.7 — consent revoked mid-session.
 *
 * 🔴 Leaving is not the same as pausing, and this is the one that matters.
 * A patient who withdraws consent has withdrawn it; a bot that stays in the
 * room "not transcribing" is a recorder somebody was told had gone. If this
 * call fails, the caller stops processing anyway — refusing the audio is under
 * our control, and the provider's cooperation is not.
 */
export async function removeBot(botId: string): Promise<{ ok: boolean; error?: string }> {
  if (!features.meetingBots) return { ok: false, error: "not configured" };

  try {
    const response = await fetch(`${env.recallBaseUrl}/api/v1/bot/${botId}/leave_call/`, {
      method: "POST",
      headers: { Authorization: `Token ${env.recallApiKey}` },
    });
    if (!response.ok) {
      log.warn("recall leave refused", { status: response.status });
      return { ok: false, error: "the recorder did not confirm it left" };
    }
    return { ok: true };
  } catch (error) {
    log.warn("recall leave failed", { reason: safeErrorMessage(error) });
    return { ok: false, error: "the recorder could not be reached" };
  }
}
