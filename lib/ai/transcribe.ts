import "server-only";

import { toFile } from "openai";

import { MODELS, logUsage, openai } from "./client";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/**
 * Transcribe one audio chunk.
 *
 * The client sends self-contained 16 kHz mono WAV files, one per chunk. That is
 * the whole reason this function is as short as it is.
 *
 * The old implementation used `MediaRecorder.start(timeslice)` and POSTed each
 * emitted Blob as a standalone `.webm`. Only the first chunk of a timesliced
 * MediaRecorder stream carries the container header — chunks 2..N are raw
 * Matroska cluster continuations, which are not decodable on their own. Nothing
 * accumulated the header, so in practice only the first five seconds of any
 * session ever transcribed correctly, and the rest was silently dropped or
 * garbled. Building WAV in the browser sidesteps containers entirely: every
 * chunk is a complete, valid file.
 *
 * `toFile` (rather than `new File(...)`) is required — the browser File
 * constructor does not work with a Node Buffer.
 */
export async function transcribeChunk(opts: {
  audio: ArrayBuffer;
  mimeType: string;
  durationSeconds: number;
  organizationId: string;
  userId: string;
  sessionId: string;
}): Promise<string> {
  const started = Date.now();
  const extension = opts.mimeType.includes("wav") ? "wav" : "webm";

  try {
    const file = await toFile(Buffer.from(opts.audio), `chunk.${extension}`, {
      type: opts.mimeType,
    });

    const result = await openai().audio.transcriptions.create({
      model: MODELS.transcribe,
      file,
      language: "en",
      // Nudges the model away from hallucinating filler on near-silent chunks.
      prompt: "Clinical therapy session. Conversational speech.",
    });

    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      kind: "transcribe",
      model: MODELS.transcribe,
      audioSeconds: Math.round(opts.durationSeconds),
      durationMs: Date.now() - started,
      status: "success",
    });

    return cleanTranscript(result.text ?? "");
  } catch (error) {
    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      kind: "transcribe",
      model: MODELS.transcribe,
      audioSeconds: Math.round(opts.durationSeconds),
      durationMs: Date.now() - started,
      status: "error",
      errorCode: error instanceof Error ? error.name : "unknown",
    });
    // Deliberately does not include the transcript or the audio in the log line.
    log.warn("transcription failed", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Whisper-family models emit a small set of stock phrases when handed silence
 * or noise. Dropping them stops a quiet room filling the chart with
 * "Thank you." every eight seconds.
 */
const HALLUCINATION_ARTEFACTS = new Set([
  "thank you.",
  "thanks for watching!",
  "thank you for watching.",
  "you",
  "bye.",
  "[ silence ]",
  "[silence]",
  "[ music ]",
  "[music]",
  "subtitles by the amara.org community",
]);

export function cleanTranscript(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (HALLUCINATION_ARTEFACTS.has(trimmed.toLowerCase())) return "";
  if (trimmed.length < 2) return "";
  return trimmed;
}
