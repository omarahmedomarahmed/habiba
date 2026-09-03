import "server-only";

import { toFile } from "openai";

import { MODELS, logUsage, openai } from "./client";
import { NOTE_LANGUAGES } from "@/lib/db/schema";
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
  /**
   * ISO 639-1 code for the language being spoken, or null to let the model
   * decide.
   *
   * This used to be the string `"en"`, written into the request body and not
   * reachable from anywhere. Every Arabic session in the product was therefore
   * handed to the model with an assertion that it was English — which is how
   * you get a transcript full of English words that sound vaguely like what
   * somebody said in Arabic, and a clinical note written from it.
   *
   * Passing null is strictly better than guessing wrong: an omitted language
   * makes the model detect one. Passing a known value is better still, because
   * detection runs per eight-second chunk and a chunk of "mm-hmm" can be
   * detected as anything.
   */
  language?: string | null;
}): Promise<string> {
  const started = Date.now();
  const extension = opts.mimeType.includes("wav") ? "wav" : "webm";
  const language = normaliseLanguage(opts.language);

  try {
    const file = await toFile(Buffer.from(opts.audio), `chunk.${extension}`, {
      type: opts.mimeType,
    });

    const result = await openai().audio.transcriptions.create({
      model: MODELS.transcribe,
      file,
      // Omitted entirely when unknown. The API detects a language when this key
      // is absent; sending an empty string or "auto" is an error, not a hint.
      ...(language ? { language } : {}),
      // Nudges the model away from hallucinating filler on near-silent chunks.
      // Written in the target language, because an English prompt is itself a
      // pull toward English output on ambiguous audio — the same bias that the
      // hardcoded language tag caused, arriving through a different door.
      prompt: chunkPrompt(language),
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
 * Reduce whatever we were handed to a bare ISO 639-1 code we can send, or null.
 *
 * Region tags are dropped — `ar-EG` and `ar-SA` are one language as far as the
 * transcription API is concerned, and sending the full tag is rejected. An
 * unrecognised code returns null rather than being passed through, because a
 * bad language tag fails the whole request while an absent one just means
 * "detect it".
 */
export function normaliseLanguage(input: string | null | undefined): string | null {
  const base = (input ?? "").trim().toLowerCase().split(/[-_]/)[0];
  if (!base || base === "auto") return null;
  return base in NOTE_LANGUAGES ? base : null;
}

/**
 * The anti-hallucination nudge, in the language being spoken.
 *
 * The prompt is a decoding hint, so an English one applied to Arabic audio
 * pulls the output toward English on exactly the ambiguous chunks where it does
 * the most damage. That is the same failure as the hardcoded language tag,
 * arriving through a different door, and fixing one without the other leaves
 * half the bias in place.
 *
 * Only languages whose phrasing is worth asserting are listed. Everything else
 * falls back to English, which is no worse than the single prompt this
 * replaced.
 */
const CHUNK_PROMPTS: Record<string, string> = {
  en: "Clinical therapy session. Conversational speech.",
  ar: "جلسة علاج نفسي. حديث عادي بين شخصين.",
  fr: "Séance de thérapie. Conversation ordinaire.",
  es: "Sesión de terapia. Conversación normal.",
  de: "Therapiesitzung. Normales Gespräch.",
  pt: "Sessão de terapia. Conversa normal.",
  it: "Seduta di terapia. Conversazione normale.",
  tr: "Terapi seansı. Normal konuşma.",
};

export function chunkPrompt(language: string | null): string {
  return (language && CHUNK_PROMPTS[language]) || CHUNK_PROMPTS.en!;
}

/**
 * Whisper-family models emit a small set of stock phrases when handed silence
 * or noise. Dropping them stops a quiet room filling the chart with
 * "Thank you." every eight seconds.
 *
 * The Arabic entries are not padding. They only became reachable when the
 * hardcoded `language: "en"` came out: with English forced, Arabic silence
 * hallucinated as English artefacts and the list above caught it. Now that the
 * model is allowed to hear Arabic, it produces the Arabic subtitle-credit and
 * subscribe-to-the-channel phrases it learned from video, and none of the
 * English entries match them.
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
  // Arabic, from the same class of training data.
  "شكرا لمشاهدتكم",
  "شكراً لمشاهدتكم",
  "شكرا للمشاهدة",
  "اشتركوا في القناة",
  "ترجمة نانسي قنقر",
  "[موسيقى]",
  "[ موسيقى ]",
]);
// Deliberately not on that list: "الحمد لله". It is a stock phrase in subtitle
// data and also one of the most ordinary things an Arabic-speaking patient
// says out loud in a session. Filtering it would delete real clinical content
// to save one line of noise, which is the wrong trade in a chart.

export function cleanTranscript(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (HALLUCINATION_ARTEFACTS.has(trimmed.toLowerCase())) return "";
  if (trimmed.length < 2) return "";
  return trimmed;
}
