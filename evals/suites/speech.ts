import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { openai } from "@/lib/ai/client";
import { transcribeAudio } from "@/lib/ai/transcribe";

import { SPEECH_CASES } from "../cases";
import { wordErrorRate } from "../metrics";
import type { Measurement } from "../report";

/**
 * Word error rate. PLAN.md 32.1.
 *
 * ## Where the audio comes from
 *
 * There is no recording of a real session that may be committed, so each case
 * is **synthesised** from a written script and the script is the reference.
 * The audio is cached under `.evals-audio/` (git-ignored) so a re-run costs one
 * transcription rather than a synthesis and a transcription, and so two runs
 * on the same machine are comparing the same waveform rather than two takes.
 *
 * 🔴 The number is a **floor**, and the report has to say so. This is clean
 * studio speech with one speaker, no crosstalk, no radiator and no phone on a
 * coffee table. A real session is worse, and nothing here tells you how much
 * worse. What it does tell you is when a change made it worse than it was,
 * which was not detectable at all before this sprint.
 *
 * ## 🔴 And the second number, which is the one that has already been wrong
 *
 * Every case is transcribed twice: once with the language given, once with it
 * omitted so the model detects it. Production takes the second path whenever a
 * session has no language set, and the last time this was got wrong every
 * Arabic session in the product was asserted to be English — a transcript of
 * English words that sound vaguely like what somebody said in Arabic, and a
 * clinical note written from it. The gap between the two columns is the cost
 * of not knowing the session's language.
 */
const CACHE = new URL("../../.evals-audio/", import.meta.url).pathname;

async function audioFor(id: string, script: string, voice: string): Promise<Buffer> {
  mkdirSync(CACHE, { recursive: true });
  const path = `${CACHE}${id}.mp3`;
  if (existsSync(path)) return readFileSync(path);

  const spoken = await openai().audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice,
    input: script,
    response_format: "mp3",
  });

  const bytes = Buffer.from(await spoken.arrayBuffer());
  writeFileSync(path, bytes);
  return bytes;
}

export const speech = {
  name: "speech",
  needsModel: true,

  async run(): Promise<Measurement[]> {
    let told = 0;
    let detected = 0;
    let words = 0;
    let arabicTold = 0;
    let arabicWords = 0;
    const detail: string[] = [];

    for (const example of SPEECH_CASES) {
      const audio = await audioFor(example.id, example.script, example.voice);
      const buffer = audio.buffer.slice(
        audio.byteOffset,
        audio.byteOffset + audio.byteLength,
      ) as ArrayBuffer;

      const withLanguage = await transcribeAudio({
        audio: buffer,
        mimeType: "audio/mpeg",
        language: example.language,
      });
      const withoutLanguage = await transcribeAudio({
        audio: buffer,
        mimeType: "audio/mpeg",
        language: null,
      });

      const a = wordErrorRate(example.script, withLanguage);
      const b = wordErrorRate(example.script, withoutLanguage);

      /* Weighted by reference length, so a long case is not worth one short one. */
      told += a.wer * a.referenceWords;
      detected += b.wer * b.referenceWords;
      words += a.referenceWords;

      if (example.language === "ar") {
        arabicTold += a.wer * a.referenceWords;
        arabicWords += a.referenceWords;
      }

      detail.push(`${example.id} ${(a.wer * 100).toFixed(0)}/${(b.wer * 100).toFixed(0)}`);
    }

    return [
      {
        key: "speech.wer",
        label: "word error rate",
        value: words === 0 ? 0 : told / words,
        direction: "down",
        unit: "rate",
        /* Transcription of identical audio is close to, but not, repeatable. */
        tolerance: 0.04,
        detail: `told/detected per case: ${detail.join(" · ")}`,
      },
      {
        key: "speech.wer.detected",
        label: "  …language not told",
        value: words === 0 ? 0 : detected / words,
        direction: "down",
        unit: "rate",
        tolerance: 0.06,
      },
      {
        key: "speech.wer.ar",
        label: "  …Arabic, language told",
        value: arabicWords === 0 ? 0 : arabicTold / arabicWords,
        direction: "down",
        unit: "rate",
        tolerance: 0.06,
      },
    ];
  },
};
