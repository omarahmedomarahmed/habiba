import { NextResponse } from "next/server";

import { transcribeChunk } from "@/lib/ai/transcribe";
import { AuthorizationError, assertSameOrigin, requireUserApi } from "@/lib/auth/guard";
import { log, safeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Voice prompting: speak a question, get text back to review before sending.
 *
 * Deliberately does not send the transcription anywhere — it returns the text
 * so the therapist can read and edit it first. Dictation that posts straight
 * to a model is how you end up asking a clinical question you did not mean.
 */
export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const actor = await requireUserApi();

    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "no_audio" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }

    const text = await transcribeChunk({
      audio: await file.arrayBuffer(),
      mimeType: file.type || "audio/wav",
      durationSeconds: Number(form.get("duration") ?? 10),
      organizationId: actor.organizationId,
      userId: actor.userId,
      sessionId: "",
    });

    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    log.warn("voice prompt failed", { reason: safeErrorMessage(error) });
    return NextResponse.json({ error: "transcription_failed" }, { status: 500 });
  }
}
