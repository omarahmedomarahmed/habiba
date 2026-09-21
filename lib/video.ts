import "server-only";

import { env } from "@/lib/env";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/**
 * Daily.co rooms.
 *
 * Three things here are corrections of the old implementation, which created
 * rooms with no `privacy` property at all (defaulting to public), a
 * deterministic name of `therapy-${sessionId}`, `enable_knocking: false`, and
 * no meeting tokens. The room URL was the only credential, it was guessable
 * from a session id, and an unauthenticated caller could make the server create
 * one. In other words: anyone who could guess or intercept a link could sit in
 * on a live therapy session.
 *
 *  1. `privacy: "private"` — the URL alone is not enough.
 *  2. A random room name, unrelated to the session id.
 *  3. A short-lived per-participant meeting token, minted separately for the
 *     clinician (owner) and the patient (non-owner).
 */

const API = "https://api.daily.co/v1";

export type RoomInfo = { url: string; name: string };

/**
 * 🔴 79.1 — WHY THERE IS NO ROOM, AND NOT JUST THAT THERE IS NONE.
 *
 * This returned `null` for four different situations: no API key, a rejected
 * key, Daily being down, and a malformed reply. One value for all four meant no
 * caller could tell a deployment that has never been given a key from one whose
 * key stopped working this morning, and the two need opposite responses.
 *
 * It also meant the commonest case logged NOTHING. `if (!env.dailyApiKey) return
 * null` returns before any request, so a product with no key wrote no line
 * anywhere, and the only trace was a session row with a null `video_room_url`.
 * That is how a founder ends up inviting somebody to a therapy session, sitting
 * in it with them, and finding out from the silence that no room was ever made.
 */
export type RoomResult =
  | { ok: true; room: RoomInfo }
  | { ok: false; reason: "not_configured" | "rejected" | "unreachable" | "malformed" };

/** What went wrong, in words an operator can act on. */
export function roomFailureText(reason: Exclude<RoomResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "not_configured":
      return "DAILY_API_KEY is not set.";
    case "rejected":
      return "The video provider rejected our key.";
    case "unreachable":
      return "We could not reach the video provider.";
    case "malformed":
      return "The video provider answered with something unusable.";
  }
}

function randomRoomName(): string {
  // Daily room names allow [a-zA-Z0-9-_]. 20 hex chars is plenty of entropy.
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return `s-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function createPrivateRoom(sessionId: string): Promise<RoomResult> {
  if (!env.dailyApiKey) {
    /*
     * 🔴 A LINE, EVERY TIME. This is the branch that was silent, and it is the
     * branch that was being taken in production.
     */
    log.warn("no video room: DAILY_API_KEY is not set", { session: ref(sessionId) });
    return { ok: false, reason: "not_configured" };
  }

  const name = randomRoomName();
  const expiry = Math.floor(Date.now() / 1000) + 4 * 60 * 60;

  try {
    const response = await fetch(`${API}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.dailyApiKey}`,
      },
      body: JSON.stringify({
        name,
        privacy: "private",
        properties: {
          exp: expiry,
          enable_chat: false,
          enable_screenshare: true,
          enable_knocking: false,
          start_video_off: false,
          start_audio_off: false,
          eject_at_room_exp: true,
        },
      }),
    });

    if (!response.ok) {
      log.warn("daily room creation failed", {
        session: ref(sessionId),
        status: response.status,
      });
      /* 401 and 403 are the key; anything else is the service. */
      return {
        ok: false,
        reason: response.status === 401 || response.status === 403 ? "rejected" : "unreachable",
      };
    }

    const room = (await response.json()) as { url?: string; name?: string };
    if (!room.url || !room.name) {
      log.warn("daily returned a room with no url", { session: ref(sessionId) });
      return { ok: false, reason: "malformed" };
    }
    return { ok: true, room: { url: room.url, name: room.name } };
  } catch (error) {
    log.warn("daily room creation errored", {
      session: ref(sessionId),
      reason: safeErrorMessage(error),
    });
    return { ok: false, reason: "unreachable" };
  }
}

/**
 * 🔴 79.1 — CAN WE ACTUALLY MAKE A ROOM RIGHT NOW?
 *
 * Asked by `/admin/settings` so the answer is a fact rather than a guess. It
 * creates a real room and deletes it again, because the only question worth
 * answering is the one a clinician is about to ask, and a key can be present,
 * well-formed and still refused.
 */
export async function videoHealth(): Promise<{ ok: boolean; detail: string }> {
  const made = await createPrivateRoom("health-check");
  if (!made.ok) return { ok: false, detail: roomFailureText(made.reason) };
  await deleteRoom(made.room.name);
  return { ok: true, detail: "A room was built and torn down just now." };
}

/**
 * Mint a meeting token. Without one, a private room cannot be entered at all —
 * which is the point.
 */
export async function createMeetingToken(opts: {
  roomName: string;
  userName: string;
  isOwner: boolean;
  minutes?: number;
}): Promise<string | null> {
  if (!env.dailyApiKey) return null;

  try {
    const response = await fetch(`${API}/meeting-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.dailyApiKey}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: opts.roomName,
          user_name: opts.userName.slice(0, 60),
          is_owner: opts.isOwner,
          exp: Math.floor(Date.now() / 1000) + (opts.minutes ?? 120) * 60,
        },
      }),
    });

    if (!response.ok) return null;
    const body = (await response.json()) as { token?: string };
    return body.token ?? null;
  } catch (error) {
    log.warn("daily meeting token failed", { reason: safeErrorMessage(error) });
    return null;
  }
}

export async function deleteRoom(roomName: string): Promise<void> {
  if (!env.dailyApiKey) return;
  try {
    await fetch(`${API}/rooms/${encodeURIComponent(roomName)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${env.dailyApiKey}` },
    });
  } catch {
    // Rooms carry a 4-hour `exp` and eject on expiry, so a failed delete is a
    // tidiness problem, not a security one.
  }
}

/** Build the embeddable URL for a private room + token. */
export function roomUrlWithToken(roomUrl: string, token: string | null): string {
  if (!token) return roomUrl;
  const separator = roomUrl.includes("?") ? "&" : "?";
  return `${roomUrl}${separator}t=${encodeURIComponent(token)}`;
}
