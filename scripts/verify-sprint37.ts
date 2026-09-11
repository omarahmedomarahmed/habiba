/**
 * Sprint 37 acceptance, offline half. PLAN.md 37.1 to 37.3, gap 37.4.
 *
 *   npm run verify:sprint37
 *
 * ## The claim this sprint makes
 *
 * **An unrecognised voice cannot be written down as a person.** Not "is not",
 * by convention in a service that remembers to pass `unknown`: *cannot*,
 * because the column that would hold the guess does not exist and the trigger
 * refuses the row.
 *
 * Every refusal below is paired with the write it must allow (C165), the
 * column scan is proved against planted column names (C132's lesson), and the
 * fixture set is proved against a planted offender — the aligner with its
 * share floor removed — because a fixture set that has never been watched
 * failing is a fixture set that might be agreeing with itself (C84).
 *
 * ## ⚠️ 37.4 is a NAMED GAP, not a silence
 *
 * No provider call and no acoustic diarisation error rate ship in this sprint.
 * The last checks here assert that the gap is real (nothing in the codebase
 * calls a diarisation provider) and that it is written down where the plan can
 * see it, in the same way 35R.4 is.
 */
import { readFileSync } from "node:fs";

import { eq, sql } from "drizzle-orm";

import { DIARISATION_FIXTURES, IDENTITIES, fixture, goldMatches, measuredMap } from "../evals/cases/diarisation";
import { alignSegments } from "../lib/diarisation/align";
import { normaliseTurns } from "../lib/diarisation/turns";
import { displayFor, resolveVoices } from "../lib/diarisation/voices";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";
import { sessionVoices, sessions, transcriptSegments, users } from "../lib/db/schema";
import { scanRegionPins } from "./_region-pins";
import { stripComments } from "./_dashes";
import { reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();
const db = dbFor(DEFAULT_REGION);
const TAG = "verify37";

async function refused(write: () => Promise<unknown>): Promise<string | null> {
  try {
    await write();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * A column name that would let somebody type a name onto a voice.
 *
 * The rule is that identity comes from the session we created (41.5) or from a
 * named human's decision. A free-text name on the voice row is how a meeting
 * provider's "Mum" or "iPhone" gets into a clinical transcript.
 */
const NAME_SHAPE = /display_name|speaker_name|voice_name|nickname|alias|caller|participant_name/i;

async function main() {
  writesTo();
  console.log("\nSprint 37, acoustic diarisation, offline half\n");

  /* ----------------------------------------------- 37.2 · the shape applied */

  const columns = await db.execute(sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'session_voices'`);
  const names = columns.rows.map((row) => (row as { column_name: string }).column_name);

  check(
    "37.2 the table is applied, with the label, the ordinal and how we know",
    ["label", "ordinal", "role", "bound_by", "bound_by_user_id", "bound_at"].every((column) =>
      names.includes(column),
    ),
    `${names.length} columns`,
  );

  const nameish = names.filter((column) => NAME_SHAPE.test(column));
  check(
    "🔴 37.2 no column on session_voices could hold a typed-in name",
    nameish.length === 0,
    nameish.join(", ") || `${names.length} columns scanned`,
  );

  check(
    "🔴 37.2 CONTROL, the same scan CATCHES the column somebody would add",
    ["display_name", "speaker_name", "nickname", "participant_name"].every((column) =>
      NAME_SHAPE.test(column),
    ),
    "display_name · speaker_name · nickname · participant_name",
  );

  const voiceId = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'transcript_segments' AND column_name = 'voice_id'`);
  check(
    "37.1 a transcript line can say which voice spoke it",
    voiceId.rows.length === 1,
    "transcript_segments.voice_id, nullable and additive",
  );

  /* ------------------------------------------ 37.2 · the writes it refuses */

  const [reference] = await db
    .select({ organizationId: users.organizationId, id: users.id })
    .from(users)
    .where(eq(users.role, "therapist"))
    .limit(1);
  const clinician = required(reference, "therapist whose organisation the fixtures can join");

  let sessionId: string | null = null;
  let otherSessionId: string | null = null;

  try {
    const made = await db
      .insert(sessions)
      .values({
        organizationId: clinician.organizationId,
        therapistId: clinician.id,
        feedbackToken: `${TAG}-a`,
      })
      .returning({ id: sessions.id });
    sessionId = made[0]!.id;

    const other = await db
      .insert(sessions)
      .values({
        organizationId: clinician.organizationId,
        therapistId: clinician.id,
        feedbackToken: `${TAG}-b`,
      })
      .returning({ id: sessions.id });
    otherSessionId = other[0]!.id;

    const base = { sessionId, organizationId: clinician.organizationId } as const;

    /* An unrecognised voice: a label, a number, and nobody. */
    const [unknownVoice] = await db
      .insert(sessionVoices)
      .values({ ...base, label: "spk_0", ordinal: 1 })
      .returning({ id: sessionVoices.id });

    const guessed = await refused(() =>
      db.insert(transcriptSegments).values({
        ...base,
        sequence: 1,
        speaker: "therapist",
        voiceId: unknownVoice!.id,
        text: "and how did that feel?",
      }),
    );
    check(
      "🔴 37.2 a line on an UNRECOGNISED voice cannot claim a person",
      guessed !== null,
      guessed ? "transcript_segments_voice_agrees" : "IT WAS ACCEPTED",
    );

    /* 🔴 The paired write: the shape it must ALLOW. */
    const [numbered] = await db
      .insert(transcriptSegments)
      .values({
        ...base,
        sequence: 2,
        speaker: "unknown",
        voiceId: unknownVoice!.id,
        text: "and how did that feel?",
      })
      .returning({ id: transcriptSegments.id });
    check(
      "🔴 37.2 …and the same line IS accepted as a numbered speaker",
      Boolean(numbered?.id),
      "Speaker 1 is a row; a guess is not",
    );

    const modelBound = await refused(() =>
      db
        .update(sessionVoices)
        .set({ role: "therapist", boundBy: "model" as never, boundAt: new Date() })
        .where(eq(sessionVoices.id, unknownVoice!.id)),
    );
    check(
      "🔴 37.2 there is no way to write down that a MODEL decided who this is",
      modelBound !== null,
      modelBound ? "session_voices_bound_by" : "IT WAS ACCEPTED",
    );

    const halfBound = await refused(() =>
      db
        .update(sessionVoices)
        .set({ role: "therapist" })
        .where(eq(sessionVoices.id, unknownVoice!.id)),
    );
    check(
      "37.2 a role with no account of how we know is REFUSED",
      halfBound !== null,
      halfBound ? "session_voices_binding_is_whole" : "IT WAS ACCEPTED",
    );

    const anonymousOperator = await refused(() =>
      db
        .update(sessionVoices)
        .set({ role: "therapist", boundBy: "operator", boundAt: new Date() })
        .where(eq(sessionVoices.id, unknownVoice!.id)),
    );
    check(
      "37.2 …and a human's say-so is a NAMED human's say-so",
      anonymousOperator !== null,
      anonymousOperator ? "session_voices_operator_is_named" : "IT WAS ACCEPTED",
    );

    /* 🔴 The paired write again: binding from a track must work. */
    await db
      .update(sessionVoices)
      .set({ role: "therapist", boundBy: "track", boundAt: new Date() })
      .where(eq(sessionVoices.id, unknownVoice!.id));

    const [bound] = await db
      .select({ role: sessionVoices.role, boundBy: sessionVoices.boundBy })
      .from(sessionVoices)
      .where(eq(sessionVoices.id, unknownVoice!.id));
    check(
      "🔴 37.2 …and a voice the RECORDING proves IS bound, from a track",
      bound?.role === "therapist" && bound.boundBy === "track",
      `${bound?.role} by ${bound?.boundBy}`,
    );

    const named = await db
      .update(transcriptSegments)
      .set({ speaker: "therapist" })
      .where(eq(transcriptSegments.id, numbered!.id))
      .returning({ id: transcriptSegments.id });
    check(
      "37.2 …and now the line may carry that person",
      named.length === 1,
      "the same row, the same voice, a proof in between",
    );

    const wrongPerson = await refused(() =>
      db
        .update(transcriptSegments)
        .set({ speaker: "patient" })
        .where(eq(transcriptSegments.id, numbered!.id)),
    );
    check(
      "🔴 37.2 a line cannot claim a person its voice is not bound to",
      wrongPerson !== null,
      wrongPerson ? "transcript_segments_voice_agrees" : "IT WAS ACCEPTED",
    );

    /* --------------------------------- 37.2 · unbinding, and what it cleans */

    await db
      .update(sessionVoices)
      .set({ role: null, boundBy: null, boundAt: null })
      .where(eq(sessionVoices.id, unknownVoice!.id));

    const [afterUnbind] = await db
      .select({ speaker: transcriptSegments.speaker })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.id, numbered!.id));
    check(
      "🔴 37.2 unbinding a voice takes the name off every line that claimed it",
      afterUnbind?.speaker === "unknown",
      `the line now says ${afterUnbind?.speaker}`,
    );

    const repointed = await refused(() =>
      db
        .update(sessionVoices)
        .set({ label: "spk_9" })
        .where(eq(sessionVoices.id, unknownVoice!.id)),
    );
    check(
      "37.2 a voice keeps its label for the life of the recording",
      repointed !== null,
      repointed ? "session_voices_no_repoint" : "IT WAS ACCEPTED",
    );

    const renumbered = await refused(() =>
      db
        .update(sessionVoices)
        .set({ ordinal: 7 })
        .where(eq(sessionVoices.id, unknownVoice!.id)),
    );
    check(
      "🔴 37.2 …and its number, because Speaker 3 must keep meaning Speaker 3",
      renumbered !== null,
      renumbered ? "session_voices_no_repoint" : "IT WAS ACCEPTED",
    );

    await db
      .update(sessionVoices)
      .set({ role: "therapist", boundBy: "track", boundAt: new Date() })
      .where(eq(sessionVoices.id, unknownVoice!.id));

    const swapped = await refused(() =>
      db
        .update(sessionVoices)
        .set({ role: "patient" })
        .where(eq(sessionVoices.id, unknownVoice!.id)),
    );
    check(
      "37.2 one person cannot be swapped for another in a single statement",
      swapped !== null,
      swapped ? "unbind first, which clears the lines" : "IT WAS ACCEPTED",
    );

    /* ----------------------------------------------------- 37.3 · N voices */

    const [second] = await db
      .insert(sessionVoices)
      .values({ ...base, label: "spk_1", ordinal: 2 })
      .returning({ id: sessionVoices.id });
    const [third] = await db
      .insert(sessionVoices)
      .values({ ...base, label: "spk_2", ordinal: 3 })
      .returning({ id: sessionVoices.id });

    check(
      "🔴 37.3 a session holds as many voices as the recording had",
      Boolean(second?.id && third?.id),
      "three voices, two of them nobody",
    );

    const duplicateOrdinal = await refused(() =>
      db.insert(sessionVoices).values({ ...base, label: "spk_3", ordinal: 3 }),
    );
    check(
      "37.3 …and two voices cannot be the same numbered speaker",
      duplicateOrdinal !== null,
      duplicateOrdinal ? "session_voices_ordinal_unique" : "IT WAS ACCEPTED",
    );

    const secondTherapist = await refused(() =>
      db
        .update(sessionVoices)
        .set({ role: "therapist", boundBy: "track", boundAt: new Date() })
        .where(eq(sessionVoices.id, second!.id)),
    );
    check(
      "37.3 one session has one clinician, and the index says so",
      secondTherapist !== null,
      secondTherapist ? "session_voices_one_therapist" : "IT WAS ACCEPTED",
    );

    /* 🔴 The paired write: couples and groups have more than one patient. */
    await db
      .update(sessionVoices)
      .set({ role: "patient", boundBy: "track", boundAt: new Date() })
      .where(eq(sessionVoices.id, second!.id));
    const twoPatients = await refused(() =>
      db
        .update(sessionVoices)
        .set({ role: "patient", boundBy: "track", boundAt: new Date() })
        .where(eq(sessionVoices.id, third!.id)),
    );
    check(
      "🔴 37.3 …but TWO patient voices are allowed, because couples exist",
      twoPatients === null,
      twoPatients ? `IT WAS REFUSED: ${twoPatients}` : "two patients, one session",
    );

    const crossSession = await refused(() =>
      db.insert(transcriptSegments).values({
        sessionId: otherSessionId!,
        organizationId: clinician.organizationId,
        sequence: 1,
        speaker: "unknown",
        voiceId: unknownVoice!.id,
        text: "a line from another session",
      }),
    );
    check(
      "🔴 37.1 a line cannot point at a voice from another session",
      crossSession !== null,
      crossSession ? "transcript_segments_voice_agrees" : "IT WAS ACCEPTED",
    );
  } finally {
    for (const id of [sessionId, otherSessionId]) {
      if (!id) continue;
      await db.delete(transcriptSegments).where(eq(transcriptSegments.sessionId, id));
      await db.delete(sessionVoices).where(eq(sessionVoices.sessionId, id));
      await db.delete(sessions).where(eq(sessions.id, id));
    }
  }

  /* ------------------------------------------- 37.1 · the arithmetic itself */

  let wrongLines = 0;
  for (const item of DIARISATION_FIXTURES) {
    wrongLines += goldMatches(item.gold, alignSegments(item.segments, normaliseTurns(item.turns).turns)).length;
  }
  check(
    "37.1 every fixture chunk aligns as the recording was constructed",
    wrongLines === 0,
    `${DIARISATION_FIXTURES.length} recordings, ${DIARISATION_FIXTURES.reduce((n, f) => n + f.gold.length, 0)} chunks`,
  );

  /*
   * 🔴 The planted offender, because a fixture set nobody has watched fail is
   * a fixture set that might be agreeing with itself (C84).
   *
   * The share floor is what refuses a chunk holding a question and its answer.
   * Removed, the straddle and crosstalk recordings should start producing
   * confident labels — and if they do not, these fixtures are not testing what
   * the comments say they test.
   */
  const withoutFloor = ["straddle", "crosstalk"].map((id) => {
    const item = fixture(id);
    return goldMatches(item.gold, alignSegments(item.segments, item.turns, { minShare: 0 })).length;
  });
  check(
    "🔴 37.1 CONTROL, the same fixtures FAIL with the share floor removed",
    withoutFloor.every((wrong) => wrong > 0),
    `${withoutFloor.join(" and ")} chunks wrongly labelled once the floor is gone`,
  );

  const couples = fixture("couples-third-voice");
  const couplesTurns = normaliseTurns(couples.turns).turns;
  const resolved = resolveVoices({
    turns: couplesTurns,
    alignments: alignSegments(couples.segments, couplesTurns),
    measured: measuredMap(couples),
  });
  const shown = resolved.voices.map((voice) => displayFor(voice, IDENTITIES));

  check(
    "🔴 37.2 the voice nothing proves is Speaker 2, not 'the one who is not the therapist'",
    resolved.voices[1]?.role === null && shown[1] === "Speaker 2",
    shown.join(" · "),
  );

  check(
    "🔴 37.2 …and the third voice is Speaker 3, counted among ALL the voices",
    shown[2] === "Speaker 3",
    "the number a person reading the transcript would use",
  );

  /* The C165 pairing: evidence still names a voice. */
  const withEvidence = resolveVoices({
    turns: couplesTurns,
    alignments: alignSegments(couples.segments, couplesTurns),
    measured: new Map([...measuredMap(couples), [1, "patient" as const], [3, "patient" as const], [5, "patient" as const]]),
  });
  check(
    "🔴 37.2 …and a voice the tracks DO prove is named",
    withEvidence.voices[0]?.role === "therapist",
    "the refusal is about missing evidence, not a binder that never binds",
  );

  const group = fixture("group-five");
  const groupTurns = normaliseTurns(group.turns).turns;
  const groupVoices = resolveVoices({
    turns: groupTurns,
    alignments: alignSegments(group.segments, groupTurns),
    measured: new Map(),
  });
  check(
    "🔴 37.3 five people in a room are five voices and five numbers",
    groupVoices.voices.length === 5 &&
      groupVoices.voices.every((voice, i) => displayFor(voice, IDENTITIES) === `Speaker ${i + 1}`),
    `${groupVoices.unnamed} unnamed, none invented`,
  );

  /* ---------------------------------------------- 37.4 · the gap, on record */

  const sources = ["turns", "align", "voices", "provider"].map((file) =>
    stripComments(readFileSync(`lib/diarisation/${file}.ts`, "utf8")),
  );

  check(
    "⚠️ 37.4 no provider is called anywhere in the diarisation modules",
    sources.every(
      (source) =>
        !/fetch\(|axios|openai|assemblyai|deepgram|pyannote|whisper|https?:\/\//i.test(source),
    ),
    "the arithmetic only; the provider call is the named gap",
  );

  check(
    "37.1 …and the modules are pure: no database, no server-only, no request",
    sources.every((source) => !/server-only|@\/lib\/db|drizzle-orm/.test(source)),
    "measurable without a network",
  );

  const schema = readFileSync("lib/db/schema.ts", "utf8");
  check(
    "🔴 37.2 the binding enum has two values and neither of them is a model",
    /VOICE_BINDINGS = \["track", "operator"\] as const/.test(schema),
    "track · operator",
  );

  const plan = readFileSync("PLAN.md", "utf8");
  check(
    "⚠️ 37.4 the measurement gap is written down where the plan can see it",
    /37\.4/.test(plan) && /35R\.4/.test(plan),
    "named the way 35R.4 is named, rather than absorbed",
  );

  /* ----------------------------------------------------------- 30.1 · pins */

  const pins = scanRegionPins();
  check(
    "🔴 30.1 this sprint's modules are ROUTED, not pinned",
    !pins.some((pin) => pin.file.includes("session-voices") || pin.file.includes("diarisation/")),
    `${pins.length} pinned call sites, none of them this sprint's`,
  );

  const unvalidated = await db.execute(sql`
    SELECT count(*)::int AS n FROM pg_constraint WHERE NOT convalidated`);
  check(
    "H1 no unvalidated constraint anywhere in the database",
    (unvalidated.rows[0] as { n: number }).n === 0,
    `${(unvalidated.rows[0] as { n: number }).n} unvalidated`,
  );

  finish("Sprint 37");
}

void main();
