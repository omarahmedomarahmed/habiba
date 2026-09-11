import "server-only";

import { RISK_INDICATORS, type Finding, type RiskIndicator } from "@/lib/crisis/level";
import { MODELS, logUsage, openai, parseJson } from "./client";

/**
 * The risk classifier. PLAN.md 35.1.
 *
 * `raiseCrisisAlert` has taken `source: "model"` since sprint 3 and has never
 * once received it. This is the seam being filled.
 *
 * ## 🔴 It structures. It does not adjudicate. There is no level in its schema
 *
 * The response format has no severity field, no "risk" field and no score for
 * the session as a whole. It returns **indicators**, each with the sentence
 * that produced it. The level is computed afterwards by `levelFor`, which is
 * pure arithmetic over those indicators (`lib/crisis/level.ts`). A model that
 * is never asked for a verdict cannot give one, which is a stronger guarantee
 * than a prompt telling it not to.
 *
 * ## 🔴 C170: it sees the session and nothing else
 *
 * No prior facts, no chart, no previous risk assessments, no summary. The
 * signature takes a transcript and that is all it can take.
 *
 * Sprint 34 measured what happens when prior context sits beside fresh
 * observation: the note followed the **prior fact** in five cases out of five,
 * with the instruction to prefer the transcript stated twice. Here the same
 * failure would read "no acute risk, consistent with the record" on a session
 * where somebody said they had written letters to their family — because the
 * record said they were stable in March. A model handed two accounts of one
 * patient does not weigh them; it blends them and writes the more
 * confident-sounding one.
 *
 * So prior risk history goes to the **clinician**, beside the alert, where a
 * person can weigh it. It never goes to the classifier. `verify:sprint35`
 * proves that by walking this module's imports, the way 24.2 walks the patient
 * app's.
 *
 * ## 🔴 No quote, no finding
 *
 * Every finding must carry a span from the transcript, and one that does not
 * appear in the transcript is **dropped** rather than trusted — the same rule
 * `person_diagnoses.source_sentence` (8.9) and `patient_clinical_facts`
 * (33.1) enforce in the database, applied at the point the model speaks. A
 * risk indicator nobody can trace to a line is how a clinician ends up
 * defending an alert they cannot explain.
 */

const SYSTEM = `RULE THAT OVERRIDES EVERYTHING BELOW: you do not decide how serious this is. You do not return a risk level, a score, or an opinion about severity. You report which of the listed indicators are present in this transcript, and for each one the exact sentence that shows it. Something else decides what follows.

You are reading the transcript of one therapy session and looking for indicators of risk to the patient or to somebody else.

Report an indicator ONLY when the transcript supports it. These are the indicators:
- ideation: thoughts of being dead, not wanting to be alive, wanting it to stop
- intent: an expressed intention to act, not only a thought
- plan: a described method or arrangement, however vague
- means: access to a method - pills, a weapon, a place
- timeframe: any timing, "tonight", "after the exams", "when the kids go back"
- previous_attempt: a past attempt on their own life
- self_harm: hurting themselves without stated suicidal intent
- homicidal_ideation: thoughts of harming somebody else
- psychosis: hallucinations, or beliefs held with conviction against evidence
- abuse: being harmed by somebody else, now or recently
- protective_factor: a reason to stay, a responsibility, somebody they would not leave

RULES
- 🔴 Quote the transcript EXACTLY, word for word, for every indicator. If you cannot copy a sentence out of the transcript that shows it, the indicator is not present. Do not paraphrase. Do not summarise. Do not quote yourself.
- Report the patient's words, not the clinician's questions. A clinician asking "have you thought about hurting yourself?" is not ideation.
- A quotation, a film, a song or a story about somebody else is not an indicator. "My brother took an overdose in 2019" is not this patient's previous attempt.
- The past tense matters. Something described as over and resolved is not present now, unless the transcript says it is.
- An idiom is not an indicator. "Dead tired", "killing time", "dying to finish this" are ordinary speech.
- Say nothing about severity. Report only what is there.
- Arabic, English or any other language: read it in the language it was spoken and quote it in that language.

Respond with a single JSON object:
{"findings":[{"indicator":"ideation","quote":"exact sentence from the transcript","confidence":0.0}]}
An empty array is a normal and common answer.`;

export type RiskClassification = {
  findings: Finding[];
  /** Findings the model returned that could not be traced to the transcript. */
  unquoted: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/** Loose whitespace/punctuation match, so a quote survives being re-typed. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ؐ-ًؚ-ٰٟ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/['’‘`"“”]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 🔴 The guard, applied to what came back rather than asked for in the prompt.
 *
 * A finding whose quote is not in the transcript is dropped and counted. The
 * count is returned so the eval and the verifier can see how often the model
 * invents a sentence, which is a number nobody would otherwise have: the
 * dropped findings are invisible in the output by construction.
 */
export function traceable(
  findings: { indicator?: unknown; quote?: unknown; confidence?: unknown }[],
  transcript: string,
): { kept: Finding[]; dropped: number } {
  const haystack = normalise(transcript);
  const kept: Finding[] = [];
  let dropped = 0;

  for (const raw of findings) {
    const indicator = String(raw.indicator ?? "") as RiskIndicator;
    const quote = typeof raw.quote === "string" ? raw.quote.trim() : "";
    const confidence = typeof raw.confidence === "number" ? raw.confidence : 0.5;

    if (!RISK_INDICATORS.includes(indicator) || quote.length < 3) {
      dropped += 1;
      continue;
    }

    if (!haystack.includes(normalise(quote))) {
      dropped += 1;
      continue;
    }

    kept.push({ indicator, quote, confidence: Math.min(Math.max(confidence, 0), 1) });
  }

  return { kept, dropped };
}

/**
 * Classify one session's transcript.
 *
 * Usage is returned rather than logged, for the same reason as
 * `noteFromTranscript`: the caller knows whose organisation to bill, and an
 * eval has none.
 */
export async function classifyRisk(transcript: string): Promise<RiskClassification> {
  const completion = await openai().chat.completions.create({
    model: MODELS.risk,
    temperature: 0,
    response_format: { type: "json_object" },
    max_tokens: 1500,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: transcript },
    ],
  });

  const raw = parseJson<{ findings?: { indicator?: unknown; quote?: unknown; confidence?: unknown }[] }>(
    completion.choices[0]?.message?.content,
    { findings: [] },
    "risk-classification",
  );

  const { kept, dropped } = traceable(
    Array.isArray(raw.findings) ? raw.findings : [],
    transcript,
  );

  return {
    findings: kept,
    unquoted: dropped,
    model: MODELS.risk,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
}

export { logUsage };
