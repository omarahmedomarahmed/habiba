import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { generateCopilot, shouldRunCopilot } from "@/lib/ai/copilot";
import { transcribeChunk } from "@/lib/ai/transcribe";
import { AuthorizationError, assertSameOrigin, requireUserApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { appendTranscriptSegment } from "@/lib/data/sessions";
import { log, ref, safeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * A chunk is ~8 seconds of 16 kHz mono audio (~256 KB) and transcribes in
 * roughly one to two seconds. Sixty is generous; it exists so a stuck upstream
 * call fails fast rather than holding the clinician's connection open.
 */
export const maxDuration = 60;

/** Reject anything much larger than a chunk should ever be. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertSameOrigin();
    const actor = await requireUserApi();
    const { id: sessionId } = await params;

    // Ownership is checked here, not inferred from the URL. The transcript is
    // the rawest PHI in the system.
    const [session] = await db
      .select({
        id: sessions.id,
        status: sessions.status,
        organizationId: sessions.organizationId,
        therapistId: sessions.therapistId,
        patientId: sessions.patientId,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.organizationId, actor.organizationId),
          eq(sessions.therapistId, actor.userId),
        ),
      )
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "not_live" }, { status: 409 });
    }

    const form = await request.formData();
    const file = form.get("audio");
    const sequenceRaw = Number(form.get("sequence") ?? 0);
    const durationRaw = Number(form.get("duration") ?? 8);
    const speakerRaw = String(form.get("speaker") ?? "unknown");
    // On a video call each participant is captured on their own track, so the
    // client knows exactly who is speaking. In person there is one microphone
    // in a room and honestly saying "unknown" beats guessing wrong in a chart.
    const speaker =
      speakerRaw === "therapist" || speakerRaw === "patient" ? speakerRaw : "unknown";

    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "no_audio" }, { status: 400 });
    }
    // The old handler set no multer limits and no body parser limit anywhere,
    // so an arbitrarily large upload was buffered straight into memory.
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }
    if (!Number.isFinite(sequenceRaw) || sequenceRaw < 1) {
      return NextResponse.json({ error: "bad_sequence" }, { status: 400 });
    }

    const text = await transcribeChunk({
      audio: await file.arrayBuffer(),
      mimeType: file.type || "audio/wav",
      durationSeconds: Number.isFinite(durationRaw) ? durationRaw : 8,
      organizationId: session.organizationId,
      userId: actor.userId,
      sessionId: session.id,
    });

    if (!text) {
      return NextResponse.json({ text: "", sequence: sequenceRaw, crisis: false });
    }

    const result = await appendTranscriptSegment({
      sessionId: session.id,
      organizationId: session.organizationId,
      therapistId: session.therapistId,
      patientId: session.patientId,
      sequence: sequenceRaw,
      speaker,
      text,
      startMs: (sequenceRaw - 1) * 8000,
      endMs: sequenceRaw * 8000,
    });

    // The response to the chunk upload is the push channel. The client is
    // already talking to the server every few seconds, so a crisis flag, a new
    // segment and any copilot suggestion ride back on a request that was
    // happening anyway — which is why this app needs no WebSocket at all.
    const suggestions =
      result.inserted && shouldRunCopilot(sequenceRaw)
        ? await generateCopilot({
            sessionId: session.id,
            organizationId: session.organizationId,
            userId: actor.userId,
          })
        : [];

    return NextResponse.json({
      text,
      speaker,
      sequence: sequenceRaw,
      crisis: result.crisis,
      suggestions,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    log.warn("transcribe route failed", { reason: safeErrorMessage(error) });
    return NextResponse.json({ error: "transcription_failed" }, { status: 500 });
  }
}
