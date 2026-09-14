import "server-only";

import { NOTE_LANGUAGES, type NoteContent } from "@/lib/db/schema";

import { MODELS, openai, parseJson } from "./client";

/**
 * The note generator, and NOTHING THAT TOUCHES A DATABASE. PLAN.md 68.6, 58.6, C336.
 *
 * ## 🔴 WHY THIS FILE EXISTS, AND IT IS THE PRINCIPAL MATRIX RATHER THAN TIDINESS
 *
 * `lib/ai/notes.ts` writes a note AND stores it, so it imports `lib/data/copilot`,
 * `lib/data/feedback`, `lib/data/people` and `lib/data/facts`. Every one of those is
 * declared clinical in the 58.6 matrix, and rightly.
 *
 * Sprint 68's note route is authenticated by a PARTNER's API key. The moment it
 * imported `lib/ai/notes.ts` for one pure function, the matrix reported eight paths
 * from a partner-authenticated route into our clinical data layer, which is exactly
 * the finding that check exists to produce. Nothing was being read; what WAS true is
 * that a partner's route had become one line away from reading a chart, and C336 is
 * the rule that refuses to let that become normal.
 *
 * So the pure half lives here: a prompt, a model call, and the coercion that turns
 * whatever came back into a shape. No `db`, no `lib/data`, no session id, no patient.
 *
 * ## 🔴 AND IT IS THE SAME FUNCTION, NOT A COPY
 *
 * `lib/ai/notes.ts` re-exports from this file and `evals/` measures it. A second
 * prompt for partners would be the C84 shape: a copy of a pipeline that drifts from
 * it silently, with an eval suite reporting a number about code nobody runs.
 */

const SYSTEM_PROMPT = `RULE THAT OVERRIDES EVERYTHING BELOW: the note describes THIS SESSION. Anything under "KNOWN BEFORE THIS SESSION" is background, not evidence: it may not go in the note on its own authority, and you must not name a diagnosis it implies. Where the transcript disagrees with it, the transcript is what happened and the background is out of date - follow the transcript and note the change in "assessment". Where the transcript says the same thing, write it from the transcript: background must never make you leave out what the session covered.

You are a clinical documentation assistant for a licensed psychotherapist.

You are given a transcript of one therapy session and minimal context. Produce documentation the clinician can review and sign.

Rules:
- Write in the clinician's professional voice: third person, past tense, specific.
- Ground every statement in the transcript. If the transcript does not support a field, leave it empty rather than inventing content. An empty field is a normal outcome for a short or partial session.
- Do not diagnose. "impressions" holds clinical impressions for the clinician to consider, and must read as provisional.
- Never address the patient. Never include advice written to the patient.
- Refer to the person as "the patient". Do not use any name, even if one appears in the transcript.
- If the transcript contains language suggesting risk of harm to self or others, say so plainly in "assessment" and in "impressions".
- 🔴 A section headed "KNOWN BEFORE THIS SESSION" is BACKGROUND, not evidence. Nothing in it may be written into the note as something observed, said or agreed today. If the transcript does not support it, it does not go in the note. Where the transcript contradicts it, follow the transcript and say in "assessment" that it differs from what was on record.
- Lines marked "Speaker" come from a single microphone in a shared room and are not attributed. Work out from context who is speaking, the clinician asks, reflects and summarises; the patient discloses and describes their own experience, and attribute correctly in your write-up. Where a line is genuinely ambiguous, do not guess in a way that changes clinical meaning.

LANGUAGE
- Write the note in the language the session was conducted in. If the transcript is in Arabic, the note is in Arabic; if it is in Spanish, the note is in Spanish. Do not translate the clinical record into English.
- Use the clinical register a professional in that language would actually write in, not a literal translation of English phrasing.
- Report the language you wrote in as a two-letter ISO 639-1 code in "language".
- If the session mixes languages, use the one the patient mostly spoke in, the record should read naturally to the clinician who was in the room.

THE PATIENT'S COPY
Three fields, "patientBrief", "patientSteps", "patientNext", are the only part the patient ever reads, and they are written *to them*: second person, plain words, no clinical vocabulary, no diagnosis, no impressions, no risk language, no labels. Write them in the same language as the rest of the note. All three must be true to the session, and must be something the person could read alone at midnight without feeling described.
- "patientBrief": two or three short paragraphs. What you talked about, and what you worked out together. Not a transcript and not a compliment. The point is that they recognise their own session in it.
- "patientSteps": what to actually do before the next session. Two or three items, never more than four. Each one concrete enough to do on a Tuesday evening and small enough to finish: "write down the three times this week you noticed the tight feeling starting" rather than "practise mindfulness". Only include something that was actually agreed or suggested in the session. If nothing was, return an empty array rather than inventing homework.
- "patientNext": one sentence about what happens next, when to come back, and what to do in the meantime if things get harder. No risk language: "if it gets heavier before then, book sooner" and not "if you experience suicidal ideation".

Respond with a single JSON object with exactly these keys:
{
  "language": string,
  "soap": { "subjective": string, "objective": string, "assessment": string, "plan": string },
  "summary": string,
  "talkingPoints": string[],
  "observations": string,
  "impressions": string,
  "recommendations": string[],
  "followUp": string,
  "patientBrief": string,
  "patientSteps": string[],
  "patientNext": string
}`;

/**
 * 🔴 The model call, with no database on either side of it. PLAN.md 32.1.
 *
 * Split out of `generateNoteContent` so `evals/` can exercise **this prompt**
 * — the one that ships — against a synthetic transcript. The alternative was
 * an eval that rebuilt the request from an exported constant, which measures a
 * copy of the pipeline and drifts from it silently. That is C84's shape, and
 * an eval suite measuring a copy is worse than none: it reports a number about
 * code nobody runs.
 *
 * Usage is returned rather than logged, because the caller is the thing that
 * knows whose organisation to bill. An eval has none and logs nothing.
 */
export async function noteFromTranscript(input: {
  context: string;
  transcript: string;
}): Promise<{
  content: NoteContent;
  language: string;
  raw: Record<string, unknown>;
  model: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const completion = await openai().chat.completions.create({
    model: MODELS.note,
    temperature: 0.2,
    response_format: { type: "json_object" },
    max_tokens: 3000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${input.context ? `Context:\n${input.context}\n\n` : ""}Transcript:\n${input.transcript}`,
      },
    ],
  });

  const raw = parseJson<Record<string, unknown>>(
    completion.choices[0]?.message?.content,
    {},
    "note-generation",
  );

  const content = normaliseNote(raw);

  return {
    content,
    /* The tag is checked against what was actually written. See C169. */
    language: normaliseLanguage(raw.language, noteWords(content)),
    raw,
    model: MODELS.note,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
}

/** Every string in a note, for the script check. */
function noteWords(note: NoteContent): string {
  return [
    note.soap.subjective,
    note.soap.objective,
    note.soap.assessment,
    note.soap.plan,
    note.summary,
    note.observations,
    note.impressions,
    note.patientBrief,
    note.patientNext,
    ...note.talkingPoints,
    ...note.recommendations,
    ...note.patientSteps,
  ].join(" ");
}

const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F]/g;

export function normaliseLanguage(raw: unknown, text?: string): string {
  const tag = typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 2) : "";
  const claimed = tag in NOTE_LANGUAGES ? tag : "en";

  if (!text) return claimed;

  const arabic = (text.match(ARABIC_SCRIPT) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;

  /* Written in Arabic, tagged as something else. The tag loses. */
  if (arabic > latin && arabic > 40) return "ar";
  /* Tagged Arabic, written in Latin script. The tag loses again. */
  if (claimed === "ar" && latin > arabic) return "en";

  return claimed;
}

/**
 * Coerce whatever the model returned into the shape the UI renders. A model
 * that returns a string where an array was asked for should produce a slightly
 * wrong note, not a runtime crash inside a clinician's workflow.
 */
export function normaliseNote(raw: Record<string, unknown>): NoteContent {
  const asString = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const asArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(asString).filter(Boolean);
    const single = asString(v);
    return single ? [single] : [];
  };

  const soap = (raw.soap ?? {}) as Record<string, unknown>;

  return {
    soap: {
      subjective: asString(soap.subjective),
      objective: asString(soap.objective),
      assessment: asString(soap.assessment),
      plan: asString(soap.plan),
    },
    summary: asString(raw.summary),
    talkingPoints: asArray(raw.talkingPoints),
    observations: asString(raw.observations),
    impressions: asString(raw.impressions),
    recommendations: asArray(raw.recommendations),
    followUp: asString(raw.followUp),
    patientBrief: asString(raw.patientBrief),
    // Four is the cap in the prompt; enforced again here because a model that
    // returns nine has produced a list nobody will start, and the clinician
    // would have to delete five of them by hand before releasing it.
    patientSteps: asArray(raw.patientSteps).slice(0, 4),
    patientNext: asString(raw.patientNext),
  };
}
