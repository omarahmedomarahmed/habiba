import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { logUsage, openai, parseJson } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { transcriptSegments } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/**
 * Work out who said what, when only one microphone was running.
 *
 * ## Why this exists
 *
 * Attribution in this product is normally physical: a video session records the
 * clinician and the patient on separate tracks, so a chunk's speaker is simply
 * whose track it arrived on. That is exact, and where it is available nothing
 * here runs.
 *
 * It is not available for an in-person session — one microphone in a room,
 * hearing two people — and it is not available when a patient's track never
 * connects. Both used to produce a transcript that was either entirely
 * `unknown` or, worse, entirely attributed to the clinician. A clinical record
 * that puts the patient's words in the clinician's mouth is not a cosmetic
 * problem, and neither is a note written from one.
 *
 * ## Why the words rather than the audio
 *
 * Acoustic diarisation — separating voices by how they sound — needs a provider
 * that offers it, and the transcription model here does not. What this does
 * instead is read the transcript and assign turns from its structure: in a
 * first therapy session the clinician asks and reflects, the patient discloses
 * and answers. Two speakers, alternating, in a genre with strong conventions.
 *
 * That is a real limitation and the schema records it. Every row this touches
 * is marked `speaker_inferred`, the transcript panel says so, and nothing
 * downstream is allowed to present an inference as a measurement.
 *
 * If acoustic diarisation is added later, it belongs in front of this, not
 * instead of it: use the provider's turns where they exist, fall back here.
 */

/** Long enough to have structure to reason about, short enough to be cheap. */
const MIN_SEGMENTS = 4;

/**
 * How many segments go into one call.
 *
 * ## The bug this replaces (H11)
 *
 * This used to be `MAX_SEGMENTS = 160`, applied as `.limit(160)` on the query —
 * so a longer session was not merely labelled in one big call, it was **never
 * read past segment 160 at all**. Measured on this database: a 60-minute
 * session is around 450 segments, so roughly two thirds of a long session could
 * not be attributed no matter how well the model performed. The tail was not
 * unreliable; it was absent.
 *
 * The reasoning behind the cap was sound — a single call really does get
 * unreliable about indices somewhere past a couple of hundred lines — but the
 * remedy was to drop the data rather than to make more calls.
 *
 * Now every segment is fetched and the work is batched. The batch size is the
 * old ceiling's *intent* (keep one call's index space small) without its
 * consequence (lose everything after the first batch).
 */
const BATCH_SEGMENTS = 120;

/**
 * How many already-labelled lines ride along at the front of each later batch.
 *
 * A batch that starts cold has no idea who spoke last, and the first line of a
 * therapy exchange is exactly where that matters: "And how did that feel?"
 * belongs to whoever did *not* just disclose. These lines are sent as context
 * and their labels are ignored on the way back — they are there to be read, not
 * to be relabelled.
 */
const BATCH_OVERLAP = 8;

/**
 * A ceiling on total work, so one pathological session cannot bill for an hour.
 *
 * 40 batches is 4,800 segments — around ten hours of speech, which is not a
 * session. Reaching this means something else is wrong.
 */
const MAX_BATCHES = 40;

/**
 * Which segments go in which call, as arithmetic.
 *
 * Pure and exported so the property that actually matters can be tested without
 * a model, a network or a database: **every segment lands in exactly one batch,
 * and none is dropped.** That is the whole of H11 — the old code's failure was
 * not a bad label, it was a segment that was never looked at.
 */
export function planBatches(
  total: number,
  batchSize = BATCH_SEGMENTS,
  maxBatches = MAX_BATCHES,
): Array<{ offset: number; length: number }> {
  const out: Array<{ offset: number; length: number }> = [];
  for (let offset = 0; offset < total; offset += batchSize) {
    out.push({ offset, length: Math.min(batchSize, total - offset) });
    if (out.length >= maxBatches) break;
  }
  return out;
}

/**
 * Does this line contain a turn boundary — two speakers in one chunk?
 *
 * ## Why a wrong label is worse than no label
 *
 * The old 8-second cutter sliced wherever the clock landed, so a chunk
 * routinely holds the end of one person's turn and the start of the other's.
 * The prompt used to tell the model to "label the line by whoever speaks most
 * of it", which sounds reasonable and is not: it takes a line that is half
 * therapist and half patient and writes a single confident answer into a
 * clinical record.
 *
 * Measured on this database, one of those lines reads:
 *
 *   "What made you decide to come here today? Um, well, as I told you, I wanna
 *    kill myself."
 *
 * labelled `patient`. Half of that is right. The half that is wrong attaches a
 * therapist's question to a patient's crisis disclosure — and a clinician
 * reading the note acts on the label, not on the raw text. `unknown` is honest;
 * a guess manufactures certainty.
 *
 * ## The signal, and why it is this one
 *
 * An interior `?` or `؟` with words after it. In a therapy transcript a
 * question is overwhelmingly the clinician, and text continuing past it is
 * overwhelmingly the other person answering — so this is high precision.
 *
 * Interior `.` or `!` was measured and rejected: it fires on 60 of 151 labelled
 * segments versus 22 for the question mark, because one speaker saying two
 * sentences in a chunk is completely ordinary. Trading 38 correct labels for a
 * handful of extra catches is the wrong trade; the model's own judgement covers
 * the rest, and that costs nothing extra.
 *
 * Pure and exported so the rule is a test rather than a hope.
 */
export function straddlesTurnBoundary(text: string): boolean {
  const trimmed = text.trim();
  const lastQuestion = Math.max(trimmed.lastIndexOf("?"), trimmed.lastIndexOf("؟"));
  if (lastQuestion === -1) return false;

  /*
   * Everything after the *last* question mark, not the first.
   *
   * The first draft of this used the first one, and hand-checking all 22 lines
   * it flagged found 3 false positives with an identical shape: one clinician
   * asking a run of questions in a single breath.
   *
   *   "Can you tell me more about what do you do for a living? Where do you
   *    live? Are you married?"
   *
   * That is one speaker, and refusing to label it throws away a correct answer.
   * Measuring from the last question mark separates the two cases exactly: a
   * run of questions has nothing after the final one, while a question followed
   * by somebody else's reply does.
   */
  const tail = trimmed.slice(lastQuestion + 1);
  return /[\p{L}\p{N}]{2}/u.test(tail);
}

const SYSTEM = `RULE THAT OVERRIDES EVERYTHING BELOW: if a line contains two
speakers — one person finishing and the other starting inside the same line —
label it "unknown". Do not pick whoever says most of it. A half-correct label is
worse than no label, because it is written into a clinical record as if it were
certain. When in doubt between two speakers, "unknown" is the answer.

You are labelling the turns of a recorded therapy session.

The transcript comes from one microphone that heard both people, so the turns
are not marked. Decide, for each numbered line, whether it was spoken by the
"therapist" or the "patient".

How to tell them apart:
- The therapist asks questions, reflects back, summarises, normalises, and
  proposes what to try before next time.
- The patient describes their own experience, answers questions, and discloses.
- A single line may contain the end of one speaker's turn and the start of the
  other's, because the recording was cut into fixed chunks rather than at turn
  boundaries. **Label that line "unknown"** — see the rule at the top. A line
  containing a question and then its answer is the commonest example.
- If a line genuinely could be either, use "unknown". Do not guess to be tidy.

Reply with JSON only: {"turns":[{"i":0,"speaker":"therapist"}, ...]}
Include every index you were given, in order.`;

type Turn = { i: number; speaker: "therapist" | "patient" | "unknown" };

export type DiariseResult = {
  /** Segments whose speaker this changed. Zero is a normal outcome. */
  updated: number;
  /**
   * Lines left `unknown` because they contain two speakers.
   *
   * Reported rather than hidden: it is the number that says how much of a
   * transcript the old cutter made unattributable, and it should fall as
   * pause-aligned recordings replace clock-aligned ones.
   */
  straddles?: number;
  /** Why it did nothing, when it did nothing. */
  skipped?: "two-track" | "too-short" | "no-transcript" | "unavailable";
};

export async function diariseSession(opts: {
  sessionId: string;
  organizationId: string;
  userId: string;
}): Promise<DiariseResult> {
  // No LIMIT. The old one silently discarded everything past segment 160.
  const rows = await db
    .select({
      id: transcriptSegments.id,
      speaker: transcriptSegments.speaker,
      text: transcriptSegments.text,
    })
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, opts.sessionId))
    .orderBy(asc(transcriptSegments.sequence));

  if (rows.length === 0) return { updated: 0, skipped: "no-transcript" };

  /*
   * Fill the gaps; never overwrite a measurement.
   *
   * ## The bug this replaces
   *
   * This used to be: if *any* row says "patient", the two-track capture worked,
   * so return and change nothing. The reasoning was right — guessing over the
   * top of a physical measurement makes the record less true — but the scope
   * was wrong, and it produced the failure PLAN.md 3.4 describes as
   * "attribution silently stops".
   *
   * A video session whose patient track drops at minute twenty has patient-
   * labelled rows before the drop and `unknown` rows after it. The old guard
   * saw the early rows, concluded two-track capture was working, and returned —
   * so the entire second half of that session stayed `unknown` permanently, and
   * nothing anywhere said so. The one case that most needs inference was the
   * one case guaranteed not to get it.
   *
   * The rule now distinguishes the two questions. *Is there anything to do?* is
   * "are any rows unknown". *May this row be changed?* is "is this row unknown"
   * — enforced at the write below, so a measured `patient` or `therapist` label
   * is never touched no matter what the model returns.
   */
  const unknownCount = rows.filter((row) => row.speaker === "unknown").length;
  if (unknownCount === 0) return { updated: 0, skipped: "two-track" };
  if (rows.length < MIN_SEGMENTS) return { updated: 0, skipped: "too-short" };

  /*
   * Batched, with an overlap, and each batch's indices are local to it.
   *
   * The model is asked about at most `BATCH_SEGMENTS` numbered lines at a time —
   * which is what keeps index-following reliable — and each batch after the
   * first is preceded by `BATCH_OVERLAP` lines it has already labelled, marked
   * as context. Those carry the conversational thread across the seam so that
   * the first line of a batch is not judged in a vacuum.
   *
   * One failed batch does not fail the session. A network blip in batch three
   * of five leaves batches one, two, four and five attributed, which is
   * strictly better than the old behaviour of attributing nothing past 160.
   */
  const plan = planBatches(rows.length);
  const batches = plan.map((b) => ({
    offset: b.offset,
    rows: rows.slice(b.offset, b.offset + b.length),
  }));

  const planned = plan.reduce((n, b) => n + b.length, 0);
  if (planned < rows.length) {
    log.warn("diarisation truncated at the batch ceiling", {
      session: ref(opts.sessionId),
      segments: rows.length,
      planned,
    });
  }

  /** What each row was decided to be, keyed by its index in `rows`. */
  const decided = new Map<number, "therapist" | "patient">();
  let failedBatches = 0;
  /** Lines the model labelled that were refused for containing two speakers. */
  let straddles = 0;

  for (const batch of batches) {
    /*
     * The context prefix: lines already labelled, immediately before this
     * batch. Sent with their speaker so the model can see the rhythm it is
     * joining, and with negative indices so a label coming back for one of them
     * is unmistakably out of range and ignored.
     */
    const contextStart = Math.max(0, batch.offset - BATCH_OVERLAP);
    const context = rows.slice(contextStart, batch.offset).map((row, i) => {
      const idx = contextStart + i;
      const who = decided.get(idx) ?? row.speaker;
      return `(already labelled, ${who}): ${row.text}`;
    });

    const numbered = batch.rows.map((row, i) => `${i}: ${row.text}`).join("\n");
    const content =
      context.length > 0
        ? `Earlier lines, for context only — do not label these:\n${context.join("\n")}\n\nLabel these:\n${numbered}`
        : numbered;

    let turns: Turn[];
    try {
      const started = Date.now();
      const response = await openai().chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
      });

      await logUsage({
        organizationId: opts.organizationId,
        userId: opts.userId,
        sessionId: opts.sessionId,
        kind: "diarise",
        model: "gpt-4o-mini",
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        durationMs: Date.now() - started,
        status: "success",
      });

      const parsed = parseJson<{ turns?: Turn[] }>(
        response.choices[0]?.message?.content ?? "",
        { turns: [] },
        "diarise",
      );
      turns = Array.isArray(parsed.turns) ? parsed.turns : [];
    } catch (error) {
      /*
       * One batch, not the session.
       *
       * A transcript with some speakers is worse than one with all of them and
       * far better than one with none. This never fails the note it runs
       * before.
       */
      failedBatches += 1;
      log.warn("diarisation batch unavailable", {
        session: ref(opts.sessionId),
        offset: batch.offset,
        reason: safeErrorMessage(error),
      });
      continue;
    }

    for (const turn of turns) {
      // Local index -> global. Anything outside this batch's own range is
      // dropped, which is what makes the context prefix safe.
      if (!Number.isInteger(turn.i) || turn.i < 0 || turn.i >= batch.rows.length) continue;
      if (turn.speaker !== "therapist" && turn.speaker !== "patient") continue;

      /*
       * The deterministic floor, applied after the model has answered.
       *
       * The prompt asks for `unknown` on a straddling line and puts that rule
       * above the schema (H2 — an instruction below the schema loses to the
       * weight of the context above it). This is the half that does not depend
       * on the model having listened. A line with a question and an answer in
       * it is left `unknown` whatever came back.
       *
       * Deliberately not applied to the *context* prefix, which is not being
       * relabelled anyway.
       */
      if (straddlesTurnBoundary(batch.rows[turn.i]!.text)) {
        straddles += 1;
        continue;
      }

      decided.set(batch.offset + turn.i, turn.speaker);
    }
  }

  if (decided.size === 0) {
    return { updated: 0, skipped: failedBatches > 0 ? "unavailable" : undefined };
  }

  /*
   * Group by speaker and write one statement per group rather than one per
   * segment: a fifty-minute session is a few hundred rows, and a few hundred
   * round trips to say two distinct things is a waste of a database that
   * charges by the second it is awake.
   */
  const byLabel = new Map<"therapist" | "patient", string[]>();
  for (const [index, speaker] of decided) {
    const row = rows[index];
    if (!row) continue;
    // The invariant, enforced where it is cheapest to enforce: only a row that
    // is currently `unknown` may be given an inferred speaker. A row the
    // hardware already answered for is never overwritten by a guess.
    if (row.speaker !== "unknown") continue;
    const list = byLabel.get(speaker) ?? [];
    list.push(row.id);
    byLabel.set(speaker, list);
  }

  let updated = 0;
  for (const [speaker, ids] of byLabel) {
    if (ids.length === 0) continue;
    /*
     * Chunked, because `inArray` becomes one bind parameter per id and Postgres
     * caps a statement at 65535 of them. A long session labelled entirely as
     * one speaker would otherwise fail at exactly the length this sprint set
     * out to make possible. H7: `inArray` and parameter binding, never
     * `sql.raw`.
     */
    for (let i = 0; i < ids.length; i += 500) {
      const slice = ids.slice(i, i + 500);
      await db
        .update(transcriptSegments)
        .set({ speaker, speakerInferred: true })
        .where(
          and(
            eq(transcriptSegments.sessionId, opts.sessionId),
            inArray(transcriptSegments.id, slice),
          ),
        );
      updated += slice.length;
    }
  }

  log.info("diarisation complete", {
    session: ref(opts.sessionId),
    segments: rows.length,
    batches: batches.length,
    failedBatches,
    straddles,
    updated,
  });
  return { updated, straddles };
}
