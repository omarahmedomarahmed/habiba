import "server-only";

import { asc, eq } from "drizzle-orm";

import { recordSessionNote } from "@/lib/data/copilot";
import { db } from "@/lib/db";
import {
  NOTE_LANGUAGES,
  patients,
  sessionNotes,
  sessions,
  transcriptSegments,
  type NoteContent,
} from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { MODELS, logUsage, openai, parseJson } from "./client";

const EMPTY_NOTE: NoteContent = {
  soap: { subjective: "", objective: "", assessment: "", plan: "" },
  summary: "",
  talkingPoints: [],
  observations: "",
  impressions: "",
  recommendations: [],
  followUp: "",
  patientBrief: "",
  patientSteps: [],
  patientNext: "",
};

const SYSTEM_PROMPT = `You are a clinical documentation assistant for a licensed psychotherapist.

You are given a transcript of one therapy session and minimal context. Produce documentation the clinician can review and sign.

Rules:
- Write in the clinician's professional voice: third person, past tense, specific.
- Ground every statement in the transcript. If the transcript does not support a field, leave it empty rather than inventing content. An empty field is a normal outcome for a short or partial session.
- Do not diagnose. "impressions" holds clinical impressions for the clinician to consider, and must read as provisional.
- Never address the patient. Never include advice written to the patient.
- Refer to the person as "the patient". Do not use any name, even if one appears in the transcript.
- If the transcript contains language suggesting risk of harm to self or others, say so plainly in "assessment" and in "impressions".
- Lines marked "Speaker" come from a single microphone in a shared room and are not attributed. Work out from context who is speaking — the clinician asks, reflects and summarises; the patient discloses and describes their own experience — and attribute correctly in your write-up. Where a line is genuinely ambiguous, do not guess in a way that changes clinical meaning.

LANGUAGE
- Write the note in the language the session was conducted in. If the transcript is in Arabic, the note is in Arabic; if it is in Spanish, the note is in Spanish. Do not translate the clinical record into English.
- Use the clinical register a professional in that language would actually write in, not a literal translation of English phrasing.
- Report the language you wrote in as a two-letter ISO 639-1 code in "language".
- If the session mixes languages, use the one the patient mostly spoke in — the record should read naturally to the clinician who was in the room.

THE PATIENT'S COPY
Three fields — "patientBrief", "patientSteps", "patientNext" — are the only part the patient ever reads, and they are written *to them*: second person, plain words, no clinical vocabulary, no diagnosis, no impressions, no risk language, no labels. Write them in the same language as the rest of the note. All three must be true to the session, and must be something the person could read alone at midnight without feeling described.
- "patientBrief": two or three short paragraphs. What you talked about, and what you worked out together. Not a transcript and not a compliment — the point is that they recognise their own session in it.
- "patientSteps": what to actually do before the next session. Two or three items, never more than four. Each one concrete enough to do on a Tuesday evening and small enough to finish: "write down the three times this week you noticed the tight feeling starting" rather than "practise mindfulness". Only include something that was actually agreed or suggested in the session. If nothing was, return an empty array rather than inventing homework.
- "patientNext": one sentence about what happens next — when to come back, and what to do in the meantime if things get harder. No risk language: "if it gets heavier before then, book sooner" and not "if you experience suicidal ideation".

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
 * Translation is a second, separate call rather than asking for two notes at
 * once.
 *
 * Two reasons. A single call producing both drifts — the model starts
 * summarising differently in each language and you end up with two records that
 * disagree, which is worse than having one. And the translation is optional: if
 * it fails, the clinician still has the note they will actually sign.
 */
const TRANSLATE_PROMPT = `You translate a clinical psychotherapy note into English.

Rules:
- Translate faithfully. Do not summarise, expand, soften or add clinical judgement that is not in the source.
- Keep the professional register: third person, past tense, specific.
- Keep every field. An empty field in the source stays empty.
- Clinical terms take their standard English equivalent, not a literal word-for-word rendering.
- Return only the JSON object, with exactly the keys given to you.`;

/**
 * Build the model context.
 *
 * The patient's name is deliberately not included. The old context builder
 * opened with `Patient: {first_name} {last_name}` followed by age, gender,
 * diagnoses and the entire transcript, with no de-identification at all. Names
 * add nothing to note quality — the clinician knows who they saw — and leaving
 * them out means the identity never reaches the provider in the first place.
 *
 * Each section is assembled defensively: one failing lookup degrades that
 * section rather than failing the whole note.
 */
async function buildContext(sessionId: string): Promise<{ context: string; transcript: string }> {
  const contextParts: string[] = [];

  const [row] = await db
    .select({
      modality: sessions.modality,
      durationMinutes: sessions.durationMinutes,
      clinical: patients.clinical,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (row) {
    contextParts.push(
      `Session type: ${row.modality === "video" ? "video" : "in person"}`,
      `Duration: ${row.durationMinutes ?? "unknown"} minutes`,
    );
    const diagnoses = row.clinical?.diagnoses ?? [];
    const goals = row.clinical?.goals ?? [];
    if (diagnoses.length) contextParts.push(`Working diagnoses: ${diagnoses.join("; ")}`);
    if (goals.length) contextParts.push(`Treatment goals: ${goals.join("; ")}`);
  }

  const segments = await db
    .select({ speaker: transcriptSegments.speaker, text: transcriptSegments.text })
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, sessionId))
    .orderBy(asc(transcriptSegments.sequence))
    // A 50-minute session is roughly 400 segments. The cap is a cost and
    // latency guard; the old query had no LIMIT at all.
    .limit(1200);

  const transcript = segments
    .map((s) => `${s.speaker === "patient" ? "Patient" : s.speaker === "therapist" ? "Therapist" : "Speaker"}: ${s.text}`)
    .join("\n");

  return { context: contextParts.join("\n"), transcript };
}

export class EmptyTranscriptError extends Error {
  constructor() {
    super("No transcript was captured for this session");
    this.name = "EmptyTranscriptError";
  }
}

export async function generateNoteContent(opts: {
  sessionId: string;
  organizationId: string;
  userId: string;
}): Promise<{ content: NoteContent; language: string; contentEn: NoteContent | null; model: string }> {
  const started = Date.now();
  const { context, transcript } = await buildContext(opts.sessionId);

  if (transcript.trim().length < 80) throw new EmptyTranscriptError();

  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.note,
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 3000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${context ? `Context:\n${context}\n\n` : ""}Transcript:\n${transcript}`,
        },
      ],
    });

    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      kind: "note",
      model: MODELS.note,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
      status: "success",
    });

    const raw = parseJson<Record<string, unknown>>(
      completion.choices[0]?.message?.content,
      {},
      "note-generation",
    );

    const content = normaliseNote(raw);
    const language = normaliseLanguage(raw.language);

    // English sessions are already English; asking for a translation would
    // spend money to produce the same text.
    const contentEn =
      language === "en"
        ? null
        : await translateNote({ content, from: language, ...opts }).catch((error) => {
            // The note is the deliverable. A failed translation is a missing
            // convenience, not a failed session.
            log.warn("note translation failed", {
              session: ref(opts.sessionId),
              reason: safeErrorMessage(error),
            });
            return null;
          });

    return { content, language, contentEn, model: MODELS.note };
  } catch (error) {
    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      kind: "note",
      model: MODELS.note,
      durationMs: Date.now() - started,
      status: "error",
      errorCode: error instanceof Error ? error.name : "unknown",
    });
    log.error("note generation failed", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Only a language we can actually render and label. Anything else is English:
 * a note tagged `xy` would give the viewer no way to pick a direction or a
 * font, and guessing wrong on right-to-left is very visible.
 */
export function normaliseLanguage(raw: unknown): string {
  const tag = typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 2) : "";
  return tag in NOTE_LANGUAGES ? tag : "en";
}

async function translateNote(opts: {
  content: NoteContent;
  from: string;
  sessionId: string;
  organizationId: string;
  userId: string;
}): Promise<NoteContent | null> {
  const started = Date.now();

  const completion = await openai().chat.completions.create({
    model: MODELS.note,
    temperature: 0,
    response_format: { type: "json_object" },
    max_tokens: 3000,
    messages: [
      { role: "system", content: TRANSLATE_PROMPT },
      {
        role: "user",
        content: `Source language: ${NOTE_LANGUAGES[opts.from] ?? opts.from}\n\nNote:\n${JSON.stringify(opts.content)}`,
      },
    ],
  });

  await logUsage({
    organizationId: opts.organizationId,
    userId: opts.userId,
    sessionId: opts.sessionId,
    kind: "translate",
    model: MODELS.note,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
    durationMs: Date.now() - started,
    status: "success",
  });

  const raw = parseJson<Record<string, unknown>>(
    completion.choices[0]?.message?.content,
    {},
    "note-translation",
  );

  const translated = normaliseNote(raw);
  return isNoteEmpty(translated) ? null : translated;
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

export function isNoteEmpty(content: NoteContent): boolean {
  return (
    !content.soap.subjective &&
    !content.soap.objective &&
    !content.soap.assessment &&
    !content.soap.plan &&
    !content.summary
  );
}

/**
 * Generate and store the note for a completed session.
 *
 * Called from `waitUntil()` after the response has been sent, so the clinician
 * is not staring at a spinner for twenty seconds. `sessions.noteStatus` is the
 * job record — the old implementation was a bare floating promise with no
 * persisted state, so a restart mid-generation lost the note permanently with
 * nothing to retry from.
 */
export async function generateAndStoreNote(opts: {
  sessionId: string;
  organizationId: string;
  therapistId: string;
  patientId: string | null;
}): Promise<void> {
  try {
    /*
     * Attribute the turns before writing anything from them.
     *
     * Order matters: the note is generated from the transcript, so a transcript
     * that does not know who spoke produces a note that has to guess — and it
     * guesses in the direction of whoever the segments claim to be. Running
     * this first means the note, the patient's brief and every later copilot
     * answer all read the same, attributed record.
     *
     * It is a no-op when the two-track capture already answered the question,
     * and it never throws: a session that cannot be diarised still gets a note.
     */
    const { diariseSession } = await import("@/lib/ai/diarise");
    await diariseSession({
      sessionId: opts.sessionId,
      organizationId: opts.organizationId,
      userId: opts.therapistId,
    });

    const { content, language, contentEn, model } = await generateNoteContent({
      sessionId: opts.sessionId,
      organizationId: opts.organizationId,
      userId: opts.therapistId,
    });

    await db
      .insert(sessionNotes)
      .values({
        sessionId: opts.sessionId,
        organizationId: opts.organizationId,
        therapistId: opts.therapistId,
        patientId: opts.patientId,
        content,
        language,
        contentEn,
        status: "draft",
        model,
      })
      .onConflictDoUpdate({
        target: sessionNotes.sessionId,
        set: { content, language, contentEn, model, updatedAt: new Date() },
      });

    await db
      .update(sessions)
      .set({ noteStatus: "ready", updatedAt: new Date() })
      .where(eq(sessions.id, opts.sessionId));

    // Open (or extend) this patient's copilot thread. A session that produced a
    // note but no thread would be invisible in the copilot inbox — which is how
    // a Crisis Radar patient, seen once by a clinician who never created them
    // by hand, would quietly have no conversation at all.
    await recordSessionNote({
      organizationId: opts.organizationId,
      therapistId: opts.therapistId,
      patientId: opts.patientId,
      sessionId: opts.sessionId,
      summary: content.summary,
    });

    log.info("note generated", { session: ref(opts.sessionId) });
  } catch (error) {
    await db
      .update(sessions)
      .set({ noteStatus: "failed", updatedAt: new Date() })
      .where(eq(sessions.id, opts.sessionId));
    log.error("note generation aborted", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
  }
}

export { EMPTY_NOTE };
