"use server";

import { joinByToken, resolveJoinToken } from "@/lib/data/sessions";
import { createMeetingToken, roomUrlWithToken } from "@/lib/video";
import { log } from "@/lib/logger";

export type JoinState = {
  error?: string;
  joined?: boolean;
  videoUrl?: string | null;
};

/**
 * The patient side of a join link. Unauthenticated by definition.
 *
 * What it deliberately does not do: return the clinician's name or photo,
 * expose any clinical data, or hand back a room URL that works on its own. The
 * old public endpoint returned therapist identity and a *public* Daily room URL
 * to any caller holding a token that never expired — and created the room as a
 * side effect, so an unauthenticated request could allocate resources.
 */
export async function submitJoin(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Please enter your first name." };
  if (name.length > 80) return { error: "That name is a little long." };

  const sessionId = await joinByToken(token, name);
  if (!sessionId) {
    return { error: "This link is no longer valid. Ask your therapist for a new one." };
  }

  const session = await resolveJoinToken(token);
  if (!session) return { joined: true, videoUrl: null };

  let videoUrl: string | null = null;
  if (session.modality === "video" && session.videoRoomUrl && session.videoRoomName) {
    // Non-owner token, short expiry, minted only after a valid join.
    const meetingToken = await createMeetingToken({
      roomName: session.videoRoomName,
      userName: name,
      isOwner: false,
      minutes: 120,
    });
    videoUrl = roomUrlWithToken(session.videoRoomUrl, meetingToken);
  }

  log.info("patient joined session");
  return { joined: true, videoUrl };
}

/** Polled by the waiting room until the clinician starts. */
export async function checkJoinState(token: string): Promise<{ live: boolean; ended: boolean }> {
  const session = await resolveJoinToken(token);
  if (!session) return { live: false, ended: true };
  return { live: session.status === "in_progress", ended: false };
}
