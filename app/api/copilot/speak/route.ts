import { NextResponse } from "next/server";

import { openai } from "@/lib/ai/client";
import { AuthorizationError, assertSameOrigin, requireUserApi } from "@/lib/auth/guard";
import { log, safeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Read a copilot answer aloud.
 *
 * Only ever called from an explicit "read aloud" press — nothing speaks by
 * itself. A clinical app that starts talking on its own in a room with a
 * patient in it would be a genuine problem, not a delight.
 */
const VOICES = {
  british_female: "fable",
  british_male: "alloy",
  american_male: "onyx",
  american_female: "nova",
} as const;

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    await requireUserApi();

    const body = (await request.json()) as { text?: string; voice?: string; speed?: number };
    const text = (body.text ?? "").trim().slice(0, 4000);
    if (!text) return NextResponse.json({ error: "no_text" }, { status: 400 });

    const voice = VOICES[(body.voice ?? "") as keyof typeof VOICES] ?? VOICES.british_female;
    // Clamped to what the API accepts; a therapist scrubbing a slider should
    // never produce a 400.
    const speed = Math.min(2, Math.max(0.5, Number(body.speed) || 1));

    const speech = await openai().audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      speed,
      response_format: "mp3",
    });

    return new NextResponse(await speech.arrayBuffer(), {
      headers: {
        "Content-Type": "audio/mpeg",
        // Clinical content: never cached by a shared proxy.
        "Cache-Control": "no-store, private",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    log.warn("speech synthesis failed", { reason: safeErrorMessage(error) });
    return NextResponse.json({ error: "speech_failed" }, { status: 500 });
  }
}
