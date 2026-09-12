import "server-only";

import { accessTokenFor } from "@/lib/data/meeting-connections";
import type { MeetingProvider } from "@/lib/db/schema";
import { log, safeErrorMessage } from "@/lib/logger";

/**
 * Creating the meeting, inside the clinician's own account. PLAN.md 41.2, and
 * the sequence decided 2026-09-12.
 *
 * ## 🔴 Why WE create it, which is the whole argument
 *
 * > *Whoever creates the meeting holds the link, and a therapist holding it
 * > will eventually send it straight to the patient, not maliciously but
 * > because it is one fewer step on a busy afternoon. The consent screen then
 * > never happens.*
 *
 * That is why sprint 36 built `session_sources` with no column that can hold a
 * pasted link, and why an external kind requires `provisioned_at` and
 * `provisioned_by_user_id` (C175, C215). A therapist pasting their own Zoom
 * link is structurally excluded, and that was a decision rather than an
 * omission.
 *
 * It is created **in their account**, not ours, so it is their meeting with
 * their branding, their recording policy and their retention. We hold the link
 * and hand the patient a different one (41.4). The therapist gets the raw join
 * link for their own calendar, because they are the other participant.
 *
 * ## The failure mode this function has to get right
 *
 * A clinician with no connection, a revoked one, or an expired token is a
 * clinician whose session still has to happen. Every path here returns a
 * REASON rather than throwing, and `sessions/new` falls back to the 24Therapy
 * room, which already works. 41.3: *a therapist who cannot connect uses the
 * 24Therapy room, and the Integrations page says so before they try.*
 */

export type CreatedMeeting = {
  /** 🔴 Ours to hold. Never handed to a patient (41.4, C133). */
  joinUrl: string;
  /** The provider's id for the meeting, stored as `external_meeting_id`. */
  externalId: string;
};

export type CreateResult =
  | { ok: true; meeting: CreatedMeeting }
  | { ok: false; error: string };

export async function createMeeting(input: {
  userId: string;
  provider: MeetingProvider;
  /**
   * 🔴 A neutral topic, never the patient's name.
   *
   * A meeting titled "Session with Sara Ahmed" puts a patient's name into a
   * calendar entry, a notification, and every participant list the provider
   * renders. The session id is ours and means nothing to anybody else.
   */
  topic: string;
  startsAt?: Date | null;
}): Promise<CreateResult> {
  const token = await accessTokenFor(input.userId, input.provider);
  if (!token) {
    return {
      ok: false,
      error:
        "That account is not connected, or the connection has expired. Connect it again in Settings, or run this session in the 24Therapy room.",
    };
  }

  try {
    switch (input.provider) {
      case "zoom":
        return await createZoomMeeting(token, input.topic, input.startsAt ?? null);
      /*
       * 🔴 Named, refused, and not silently treated as Zoom.
       *
       * Google Meet and Teams have connections and scopes defined and no
       * creation call written. A switch with a default that guessed would make
       * "Meet" a button that creates a Zoom meeting, which is the kind of bug
       * that reaches a patient before anybody notices.
       */
      case "google_meet":
      case "teams":
        return {
          ok: false,
          error:
            "That provider is not finished yet. Use Zoom or the 24Therapy room for this session.",
        };
    }
  } catch (error) {
    log.warn("meeting creation failed", {
      provider: input.provider,
      reason: safeErrorMessage(error),
    });
    return {
      ok: false,
      error: "That meeting could not be created. Run this session in the 24Therapy room instead.",
    };
  }
}

/**
 * Zoom, through their own API, on the clinician's token.
 *
 * `settings.waiting_room: false` is deliberate and is the one setting here
 * that is a product decision rather than a default: the patient has already
 * been through our consent screen and paid if the session is paid, so a
 * waiting room would hold somebody who has done everything asked of them in
 * front of a door the clinician has to notice.
 */
async function createZoomMeeting(
  token: string,
  topic: string,
  startsAt: Date | null,
): Promise<CreateResult> {
  const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      topic,
      type: startsAt ? 2 : 1,
      ...(startsAt ? { start_time: startsAt.toISOString() } : {}),
      settings: {
        waiting_room: false,
        join_before_host: true,
        /*
         * 🔴 Their cloud recording stays OFF.
         *
         * We transcribe through the bot, which the patient consented to. A
         * second recording sitting in the clinician's Zoom account is a copy
         * of a therapy session in a place this product cannot see, cannot
         * delete on request, and never told the patient about.
         */
        auto_recording: "none",
      },
    }),
  });

  if (!response.ok) {
    log.warn("zoom refused meeting creation", { status: response.status });
    return {
      ok: false,
      error:
        response.status === 401
          ? "Zoom no longer accepts that connection. Connect it again in Settings."
          : "Zoom would not create the meeting. Run this session in the 24Therapy room instead.",
    };
  }

  const body = (await response.json()) as { id?: number | string; join_url?: string };
  if (!body.join_url || body.id === undefined) {
    return { ok: false, error: "Zoom did not return a usable meeting." };
  }

  return { ok: true, meeting: { joinUrl: body.join_url, externalId: String(body.id) } };
}
