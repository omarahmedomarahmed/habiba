import { NextResponse } from "next/server";

import { mayAnswer } from "@/lib/partner/platform";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 25 MB. Above this an integration should be streaming, not posting a file. */
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * 🔴 68.3 — POST /api/partner/v1/sessions/[ref]/media
 *
 * *Audio in, by upload or by stream. Their video stays theirs; we never need the
 * stream to be ours.*
 *
 * ## 🔴 WE TAKE AUDIO AND WE DO NOT TAKE VIDEO, AND THAT IS A DECISION
 *
 * Everything this product does with a session is done from audio: the transcript, the
 * diarisation, the note, the summary. Video adds nothing we use and a great deal we
 * would then be holding — a therapy room, on our disks, for a platform whose patients
 * never chose us. So the route accepts audio content types and refuses the rest, and
 * a partner's video never leaves their infrastructure.
 *
 * ## 🔴 THE CONSENT CHECK IS BEFORE THE BODY IS READ
 *
 * `mayAnswer` runs first, so audio for a session nobody consented to is refused
 * without ever being read into memory. Reading it and then discarding it would mean
 * the bytes existed on our side for the length of a request, which is exactly the
 * thing "without it we record nothing" promises does not happen.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const guard = await withKey(request, "session:media");
  if ("response" in guard) return guard.response;

  const { ref } = await params;

  const allowed = await mayAnswer({
    partnerId: guard.key.partnerId,
    externalSessionRef: ref,
  });
  if (!allowed.ok) return fail(allowed.error, allowed.status);

  /*
   * 🔴 W2-X02: an ended session takes no more audio. The copilot and the memory
   * read it from the moment it ended, and material growing behind that read would
   * be a session that is over and still being recorded.
   */
  if (allowed.session.endedAt) {
    return fail("This session has ended, so it takes no more audio.", 409);
  }

  const type = request.headers.get("content-type") ?? "";
  if (!/^audio\//.test(type)) {
    return fail(
      "Send audio. We do not take video: everything we produce is made from audio, and a therapy room on our disks is a thing nobody asked us to hold.",
      415,
    );
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) {
    return fail("That file is too large. Stream a long session rather than posting it.", 413);
  }

  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0) return fail("That request had no audio in it.", 400);
  if (audio.byteLength > MAX_BYTES) {
    return fail("That file is too large. Stream a long session rather than posting it.", 413);
  }

  /*
   * 🔴 THE OFFSET IS THE CONSENT BOUNDARY, AND IT IS NOT A FIELD THEY SEND.
   *
   * A partner could otherwise post audio claiming it starts at minute ten while
   * sending the whole session, and the note would cover a period nobody agreed to.
   * The number comes from OUR consent log. 🔴 W1-17: and audio before it is cut
   * HERE, not left for the partner: see `ingestPartnerAudio`.
   */
  const from = allowed.session.recordingFromSeconds ?? 0;
  const startHeader = request.headers.get("x-audio-start-seconds");
  const start = startHeader === null ? 0 : Number(startHeader);
  if (!Number.isFinite(start) || start < 0) {
    return fail("X-Audio-Start-Seconds must be a number of seconds from the session's start.", 400);
  }

  /*
   * 🔴 W2-X05: the first audio is what bills a session, so the limit is asked here,
   * before anything is transcribed, and the session is billed once it has been.
   */
  const { billFirstAudio, mayBillFirstAudio } = await import("@/lib/partner/platform");
  const billing = await mayBillFirstAudio({
    partnerId: guard.key.partnerId,
    session: allowed.session,
  });
  if (!billing.ok) return fail(billing.error, 409);

  const { ingestPartnerAudio } = await import("@/lib/partner/media");
  const result = await ingestPartnerAudio({
    partnerSessionId: allowed.session.id,
    audio: Buffer.from(audio),
    contentType: type,
    fromSeconds: from,
    startSeconds: start,
  });

  if (result.error) return fail(result.error, result.status ?? 400);
  if (result.transcribed) await billFirstAudio(allowed.session.id);

  return NextResponse.json({
    accepted_bytes: audio.byteLength,
    /* 🔴 Said back, so an integration can assert it agrees with what it sent. */
    recording_from_seconds: from,
    /* W1-17: how much of this piece was before the boundary, and not kept. */
    dropped_seconds: result.droppedSeconds ?? 0,
    transcript_ready: result.ready,
  });
}
