import "server-only";

import { asc, eq } from "drizzle-orm";

import { recordSessionNote } from "@/lib/data/copilot";
import { noteProvenanceFor } from "@/lib/data/feedback";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
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
/*
 * 🔴 58.6 / C336 — THE PURE GENERATOR MOVED OUT, and the reason is the matrix.
 *
 * A partner-authenticated route needs `noteFromTranscript` and nothing else in this
 * file. While it lived here, importing it dragged four clinical data modules into a
 * route holding a third party's API key. `lib/ai/note-writer.ts` has no database in
 * it at all.
 *
 * Re-exported, because these three were exported from here for four sprints and every
 * caller and every eval still asks this file for them.
 */
import {
  noteFromTranscript,
  normaliseLanguage,
  normaliseNote,
} from "./note-writer";

export { noteFromTranscript, normaliseLanguage, normaliseNote };

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/ai/notes.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
      personId: patients.personId,
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

  /*
   * 🔴 34.1 — the two lines above became a record. PLAN.md 34.1.
   *
   * `patients.clinical` is a JSON blob of strings with no date, no source and
   * no way to disagree with it, and until this sprint it was the entire memory
   * a note generator had. The evidence layer replaces it with facts that carry
   * when they were true and who said so, which is what turns an isolated SOAP
   * generator into longitudinal documentation.
   *
   * The blob is deliberately still sent. It is what a clinician typed into the
   * old field and it is still on thousands of rows; dropping it on the day the
   * new layer ships would quietly make every existing note worse. It goes when
   * the facts are extracted from it, not before, and nothing here backfills.
   *
   * One failing lookup degrades this section rather than failing the note: a
   * session whose patient has no person row is the ordinary case for a join
   * link, and it must still produce documentation.
   */
  if (row?.personId) {
    try {
      const { factsFor } = await import("@/lib/data/facts");
      const { factsPrompt } = await import("@/lib/clinical/context");
      const facts = await factsFor(row.personId);
      const block = factsPrompt(facts, new Date());
      if (block) contextParts.push("", block);
    } catch (error) {
      log.warn("note context could not read the evidence layer", {
        session: ref(sessionId),
        reason: safeErrorMessage(error),
      });
    }
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
  /** 49.14a — who the note is about, for cost by patient. Null on a guest session. */
  patientId: string | null;
}): Promise<{ content: NoteContent; language: string; contentEn: NoteContent | null; model: string }> {
  const started = Date.now();
  const { context, transcript } = await buildContext(opts.sessionId);

  if (transcript.trim().length < 80) throw new EmptyTranscriptError();

  try {
    const generated = await noteFromTranscript({ context, transcript });

    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      patientId: opts.patientId,
      kind: "note",
      model: generated.model,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      durationMs: Date.now() - started,
      status: "success",
    });

    const { content, language } = generated;

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
      patientId: opts.patientId,
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
 *
 * ## 🔴 C169 — the model's word is checked against the script it wrote in
 *
 * The grounding eval caught a note for an English session, written in English,
 * reported as **`es`**. The word "metro" in the transcript is the likely pull.
 * Two things follow from a wrong tag and neither is cosmetic: the viewer gets
 * the wrong direction and font for the note, and `generateNoteContent` sees a
 * non-English language and spends a second model call translating an English
 * note into English.
 *
 * So the claim is checked against the evidence. The script is decidable: a note
 * in Arabic characters is Arabic whatever the tag says, and a note in Latin
 * characters is not Arabic whatever the tag says. That closes the failure that
 * matters — right-to-left rendered left-to-right, which is the most visible way
 * an interface announces nobody localised it (C150, 21.x).
 *
 * **The residual, named:** `en` mislabelled as `es` shares a script, so this
 * cannot see it, and the eval still records it. Distinguishing two Latin
 * languages needs actual language identification, which is a dependency and a
 * sprint, and the harm is one wasted call rather than an unreadable note.
 */

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
/**
 * The stamp for one session, read from the two timestamps that decide it.
 *
 * Separate from `lateRecordingStamp` (which is pure, in `lib/consent.ts`) so
 * the rule can be tested without a database and the query lives next to its
 * only caller.
 */
async function lateRecordingStampFor(
  sessionId: string,
  therapistId: string,
): Promise<string | null> {
  const { lateRecordingStamp } = await import("@/lib/consent");
  const { users } = await import("@/lib/db/schema");

  const [row] = await db
    .select({
      startedAt: sessions.startedAt,
      recordingStartedAt: sessions.recordingStartedAt,
      profile: users.profile,
    })
    .from(sessions)
    .leftJoin(users, eq(users.id, therapistId))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return null;

  return lateRecordingStamp({
    startedAt: row.startedAt,
    recordingStartedAt: row.recordingStartedAt,
    timeZone: row.profile?.timezone ?? null,
  });
}

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
      patientId: opts.patientId,
      sessionId: opts.sessionId,
      organizationId: opts.organizationId,
      userId: opts.therapistId,
    });

    /*
     * 7.8 — a session that was only half recorded says so, on the note.
     *
     * Prepended to the summary rather than added as a field: it has to be the
     * first thing read, and a separate field is a field a template can forget
     * to render. Applied to the English copy too, because that is the one an
     * auditor or a second clinician reads.
     *
     * This is a fact about the recording, not a summary of the session, so it
     * is written here from the timestamps rather than asked of the model — a
     * model asked to describe its own missing input will describe it wrongly.
     */
    const stamp = await lateRecordingStampFor(opts.sessionId, opts.therapistId);
    if (stamp) {
      content.summary = content.summary ? `${stamp}\n\n${content.summary}` : stamp;
      if (contentEn?.summary) contentEn.summary = `${stamp}\n\n${contentEn.summary}`;
    }

    /*
     * 🔴 47.1 / C212 — the note records how it was made, stamped here.
     *
     * At save rather than at read, because the answer is a fact about the
     * session that produced it and the evidence for it — the segments — can be
     * deleted later under retention. A note that recomputed its own provenance
     * would quietly become `clinician` the day a transcript aged out, which is
     * a record rewriting its own history.
     *
     * It is written on the conflict path too. A note regenerated after the
     * clinician went off record must not keep the badge it had when the whole
     * session was captured.
     */
    const origin = await noteProvenanceFor(opts.sessionId);

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
        provenance: origin.provenance,
        offRecordSeconds: origin.offRecordSeconds,
      })
      .onConflictDoUpdate({
        target: sessionNotes.sessionId,
        set: {
          content,
          language,
          contentEn,
          model,
          provenance: origin.provenance,
          offRecordSeconds: origin.offRecordSeconds,
          updatedAt: new Date(),
        },
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

    /*
     * 9.1 — the rolling profile is rebuilt after every session.
     *
     * Here rather than on a schedule because "after each session" is what the
     * ticket asks for and what a clinician expects: they finish at 3pm and the
     * standing profile they read before the next appointment already knows
     * about it.
     *
     * Best-effort and last. A profile that failed to rebuild is stale by one
     * session; a note that failed to save is a session with no record, and the
     * second must never be caused by the first.
     */
    if (opts.patientId) {
      try {
        const { personIdForPatient } = await import("@/lib/data/people");
        const personId = await personIdForPatient(opts.patientId);
        if (personId) {
          const { regenerateProfile } = await import("@/lib/ai/profile");
          await regenerateProfile({
            personId,
            organizationId: opts.organizationId,
            userId: opts.therapistId,
          });
        }
      } catch (error) {
        log.warn("profile refresh after note failed", {
          session: ref(opts.sessionId),
          reason: safeErrorMessage(error),
        });
      }
    }

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
