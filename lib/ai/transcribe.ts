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
/**
 * 🔴 The transcription call, with no database on either side of it. 32.1.
 *
 * Extracted so `evals/` can measure word error rate against the **shipped**
 * request — this model, this language handling, this prompt — rather than a
 * reconstruction of it. The language logic in particular is the part that has
 * already been wrong once in production (every Arabic session asserted to be
 * English), and an eval that rebuilt the request would not have been measuring
 * the thing that broke.
 *
 * `extension` matters: the API reads the container from the filename, and a
 * WAV sent as `.webm` is rejected.
 */
export async function transcribeAudio(opts: {
  audio: ArrayBuffer;
  mimeType: string;
  language?: string | null;
  /** 🔴 Board 824 / 868: the languages this session may be in. See `transcriptionRequests`. */
  languages?: readonly string[];
}): Promise<string> {
  return (await transcribeAudioDetailed(opts)).text;
}

/**
 * 🔴 Board 824 / 868: ONE REQUEST PER LANGUAGE THE SESSION MAY BE IN, AND THE
 * SURER ANSWER KEPT.
 *
 * A session between an Arabic and an English speaker, or one where an Egyptian
 * patient answers in English, has no single right language tag. Pinning Arabic
 * (the B63 fix) translated "Tired, honestly." into «تعب، بصراحة.», words nobody
 * said in that language; detecting per chunk wrote «يعني صعب عليكي ترفضي» as
 * "Jien, sa baħalek tirfudi", a guess at another language in Latin letters.
 *
 * So each chunk of such a session is sent once per candidate language, each
 * pass pinned to its language and its own hint, with the model's token
 * confidence asked for. The pass the model was surer of is the transcript. A
 * pass whose letters are not its language's (Latin back from an Arabic pass,
 * Arabic back from an English one) never wins. One language, set in the room or
 * the only one known, is one pinned request; none known is one detected request.
 */
export type TranscriptionRequest = {
  language: string | null;
  prompt: string;
  include?: ["logprobs"];
};

export function transcriptionRequests(
  language: string | null | undefined,
  languages: readonly string[] = [],
): TranscriptionRequest[] {
  const pinned = normaliseLanguage(language);
  if (pinned) return [{ language: pinned, prompt: chunkPrompt(pinned) }];
  const candidates = [
    ...new Set(languages.map((l) => normaliseLanguage(l)).filter((l): l is string => Boolean(l))),
  ].slice(0, 3);
  if (candidates.length === 0) return [{ language: null, prompt: chunkPrompt(null) }];
  if (candidates.length === 1) return [{ language: candidates[0]!, prompt: chunkPrompt(candidates[0]!) }];
  return candidates.map((l) => ({ language: l, prompt: chunkPrompt(l), include: ["logprobs"] }));
}

const ARABIC_LETTER = /[؀-ۿݐ-ݿࢠ-ࣿ]/g;
const LATIN_LETTER = /[A-Za-zÀ-ɏ]/g;

/** Whether the letters of `text` are in the script `language` is written in. */
export function inItsScript(text: string, language: string | null): boolean {
  if (!language) return true;
  const arabic = (text.match(ARABIC_LETTER) ?? []).length;
  const latin = (text.match(LATIN_LETTER) ?? []).length;
  if (arabic + latin === 0) return true;
  return language === "ar" ? arabic >= latin : latin >= arabic;
}

export type TranscriptionPass = {
  language: string | null;
  text: string;
  /** The mean token log probability, when the model returned one. */
  confidence: number | null;
};

/**
 * The pass to keep: one in its own script first, then the surer, then the
 * first asked (the session's primary language) when no pass reported a
 * confidence.
 */
export function pickTranscription(passes: readonly TranscriptionPass[]): TranscriptionPass | null {
  const heard = passes.filter((p) => p.text.trim());
  if (heard.length === 0) return passes[0] ?? null;
  const own = heard.filter((p) => inItsScript(p.text, p.language));
  const pool = own.length > 0 ? own : heard;
  return pool.reduce((best, p) =>
    p.confidence !== null && (best.confidence === null || p.confidence > best.confidence) ? p : best,
  );
}

export async function transcribeAudioDetailed(opts: {
  audio: ArrayBuffer;
  mimeType: string;
  language?: string | null;
  languages?: readonly string[];
}): Promise<{ text: string; language: string | null; passes: number }> {
  const extension = opts.mimeType.includes("wav")
    ? "wav"
    : opts.mimeType.includes("mp3") || opts.mimeType.includes("mpeg")
      ? "mp3"
      : "webm";
  const requests = transcriptionRequests(opts.language, opts.languages);

  const passes = await Promise.all(
    requests.map(async (request): Promise<TranscriptionPass> => {
      const file = await toFile(Buffer.from(opts.audio), `chunk.${extension}`, {
        type: opts.mimeType,
      });
      const result = await openai().audio.transcriptions.create({
        model: MODELS.transcribe,
        file,
        // Omitted entirely when unknown. The API detects a language when this key
        // is absent; sending an empty string or "auto" is an error, not a hint.
        ...(request.language ? { language: request.language } : {}),
        // Nudges the model away from hallucinating filler on near-silent chunks.
        // Written in the target language, because an English prompt is itself a
        // pull toward English output on ambiguous audio: the same bias that the
        // hardcoded language tag caused, arriving through a different door.
        prompt: request.prompt,
        ...(request.include ? { include: request.include } : {}),
      });
      const logprobs = (result as { logprobs?: Array<{ logprob?: number }> }).logprobs ?? [];
      const scores = logprobs
        .map((l) => l.logprob)
        .filter((n): n is number => typeof n === "number");
      return {
        language: request.language,
        text: cleanTranscript(result.text ?? ""),
        confidence: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      };
    }),
  );

  const kept = pickTranscription(passes);
  return { text: kept?.text ?? "", language: kept?.language ?? null, passes: requests.length };
}

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
  /** 🔴 Board 824 / 868: every language the session may be in. See `transcriptionRequests`. */
  languages?: readonly string[];
}): Promise<string> {
  const started = Date.now();
  /* Each pass is billed audio: two passes over eight seconds are sixteen. */
  const passes = transcriptionRequests(opts.language, opts.languages).length;
  try {
    const { text } = await transcribeAudioDetailed({
      audio: opts.audio,
      mimeType: opts.mimeType,
      language: opts.language,
      languages: opts.languages,
    });

    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      kind: "transcribe",
      model: MODELS.transcribe,
      audioSeconds: Math.round(opts.durationSeconds) * passes,
      durationMs: Date.now() - started,
      status: "success",
    });

    return text;
  } catch (error) {
    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      kind: "transcribe",
      model: MODELS.transcribe,
      audioSeconds: Math.round(opts.durationSeconds) * passes,
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

/**
 * 🔴 Board 335: THE PROMPT IS NEVER A LINE OF SPEECH.
 *
 * On a quiet chunk the model can hand back the decoding hint it was given, and
 * "Clinical therapy session. Conversational speech." went into the transcript
 * as the patient's words, labelled Them, where the note could quote it. Every
 * sentence of any prompt we send is taken out of what comes back, compared
 * without case, punctuation or spacing; what is left is kept, and a chunk that
 * was nothing but the prompt is silence.
 */
function comparable(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PROMPT_SENTENCES = new Set(
  Object.values(CHUNK_PROMPTS).flatMap((prompt) =>
    [prompt, ...prompt.split(/(?<=[.!?؟])\s+/)].map(comparable).filter(Boolean),
  ),
);

function withoutPrompt(text: string): string {
  if (PROMPT_SENTENCES.has(comparable(text))) return "";
  const sentences = text.split(/(?<=[.!?؟])\s+/);
  const kept = sentences.filter((sentence) => !PROMPT_SENTENCES.has(comparable(sentence)));
  return kept.length === sentences.length ? text : kept.join(" ").trim();
}

export function cleanTranscript(text: string): string {
  const trimmed = withoutPrompt(text.trim());
  if (!trimmed) return "";
  if (HALLUCINATION_ARTEFACTS.has(trimmed.toLowerCase())) return "";
  if (trimmed.length < 2) return "";
  return trimmed;
}
