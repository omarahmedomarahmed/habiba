/**
 * Whose voice it is, and when we are not allowed to say. PLAN.md 37.2, 37.3.
 *
 * ## The two rules, stated once
 *
 *   37.2 **An unrecognised voice is "Speaker 3", never a guess.**
 *   37.3 **Group and couples: N speakers, no invented identities.**
 *
 * Both say the same thing from two directions: the number of people in the
 * recording comes from the audio, and the *names* of those people come from the
 * session we created, and neither may be derived from the other.
 *
 * ## 🔴 Why there is no elimination rule
 *
 * The tempting line of code is four words long. Two voices, one of them is the
 * therapist because we can prove it, therefore the other one is the patient.
 * It is right most of the time and this file will not do it, because the times
 * it is wrong are not random:
 *
 *   - a supervisor sits in on the third session;
 *   - a parent answers for a child, from the same side of the table;
 *   - a partner joins twenty minutes in;
 *   - a receptionist puts their head round the door;
 *   - the patient's phone is on speaker and their mother is on the other end.
 *
 * Every one of those is a voice that is not the patient, in a recording where
 * the only other identified voice is the clinician. Elimination labels all of
 * them "patient", and what it writes into the record is somebody else's words
 * under the patient's name. There is no confidence score that separates these
 * cases from an ordinary two-person session, because acoustically there is
 * nothing to separate: two voices, one known.
 *
 * So a voice is bound to a person **only by evidence**, and a voice with no
 * evidence is `Speaker N` forever. The cost is real and is stated rather than
 * hidden: a single-microphone session with no two-track evidence attributes
 * nobody by this path at all, and falls back to the semantic layer in
 * `lib/ai/diarise.ts`, which labels roles from the words and marks every row
 * it touches `speaker_inferred`. That is the layering 37.1 asks for: acoustic
 * separation underneath, semantic correction on top, and the inference flag
 * telling the reader which of the two answered.
 *
 * ## What counts as evidence
 *
 * Exactly two things, and neither is a model:
 *
 *   - `track` — the recording already knew. A video session captures the
 *     clinician and the patient on separate tracks, so rows that arrived that
 *     way carry a *measured* speaker. A voice whose chunks line up with those
 *     rows is that person. This is the case that matters most, because it is
 *     the dropout case: a patient track that dies at minute twenty leaves
 *     twenty minutes of proof about a voice that keeps talking for another
 *     thirty.
 *   - `operator` — a named human listened and said so, with their user id on
 *     the row and the date beside it.
 *
 * There is deliberately no third value, in this file or in the column's CHECK.
 * A schema that cannot express "a model decided who this is" is a schema in
 * which 37.2 cannot quietly stop being true.
 */
import type { Alignment } from "./align";
import { voiceOrder, type AcousticTurn } from "./turns";

export type VoiceRole = "therapist" | "patient";
/** How an identity was established. 🔴 There is no "model" and never will be. */
export type BoundBy = "track" | "operator";

export type Voice = {
  /** The provider's opaque label. */
  label: string;
  /** 1-based position in the order the voices are first heard. */
  ordinal: number;
  /** Null means unrecognised, which is a normal and permanent outcome. */
  role: VoiceRole | null;
  boundBy: BoundBy | null;
};

/**
 * How many measured chunks a voice needs before it is anybody.
 *
 * Three, because one is a coincidence of the alignment arithmetic: a single
 * chunk that happens to straddle a track boundary would otherwise be enough to
 * name a voice for the rest of the session.
 */
export const MIN_EVIDENCE = 3;

/**
 * How clean that evidence has to be.
 *
 * 90%: one disagreeing chunk in ten is the ordinary noise of two clocks; two
 * in ten is a voice the tracks do not actually agree about, and a voice the
 * tracks do not agree about is not evidence, it is a coin toss with a number
 * printed next to it.
 */
export const EVIDENCE_PURITY = 0.9;

/** The voices of a recording, in first-heard order, all of them unrecognised. */
export function rosterFor(turns: readonly AcousticTurn[]): Voice[] {
  return voiceOrder(turns).map((label, i) => ({
    label,
    ordinal: i + 1,
    role: null,
    boundBy: null,
  }));
}

export type Tally = {
  label: string;
  therapist: number;
  patient: number;
  /** The role the evidence points at, before conflicts are resolved. */
  candidate: VoiceRole | null;
  /** Why not, when there is no candidate. */
  refusal: "no_evidence" | "too_little" | "disagrees" | null;
};

/**
 * Count what the measured rows say about each voice.
 *
 * `measured` is the speaker of rows the *hardware* answered for: two-track
 * capture, never an inference. A row whose speaker was guessed by the semantic
 * layer must not appear here, or the guess becomes its own evidence and the
 * whole chain is a model naming a voice after all. The caller reads
 * `speaker_inferred = false` to build this map, and `verify:sprint37` proves
 * an inferred row is refused as evidence.
 */
export function tallyEvidence(
  roster: readonly Voice[],
  alignments: readonly Alignment[],
  measured: ReadonlyMap<number, VoiceRole>,
): Tally[] {
  return roster.map((voice) => {
    let therapist = 0;
    let patient = 0;

    for (const alignment of alignments) {
      if (alignment.label !== voice.label) continue;
      const role = measured.get(alignment.index);
      if (role === "therapist") therapist += 1;
      if (role === "patient") patient += 1;
    }

    const total = therapist + patient;
    const top = therapist >= patient ? "therapist" : "patient";
    const topCount = Math.max(therapist, patient);

    if (total === 0) {
      return { label: voice.label, therapist, patient, candidate: null, refusal: "no_evidence" };
    }
    if (total < MIN_EVIDENCE) {
      return { label: voice.label, therapist, patient, candidate: null, refusal: "too_little" };
    }
    if (topCount / total < EVIDENCE_PURITY) {
      return { label: voice.label, therapist, patient, candidate: null, refusal: "disagrees" };
    }
    return { label: voice.label, therapist, patient, candidate: top, refusal: null };
  });
}

/**
 * Bind the voices the evidence names, and leave every other voice unnamed.
 *
 * 🔴 Two properties, both proved as negatives in `verify:sprint37`:
 *
 *   1. **No elimination.** A voice with no evidence of its own is never given
 *      the role that happens to be left over, however few voices there are.
 *   2. **No double-binding.** When two voices both look like the therapist,
 *      the one with more evidence takes it and the other is left *unnamed* —
 *      not handed the other role, which is elimination wearing a hat.
 *
 * A tie is nobody. Two voices with identical evidence for one role is a
 * recording where something is wrong with the tracks, and the honest output is
 * two unnamed voices and a transcript that says so.
 */
export function bindVoices(
  roster: readonly Voice[],
  tallies: readonly Tally[],
  boundBy: BoundBy = "track",
): Voice[] {
  const byLabel = new Map(tallies.map((tally) => [tally.label, tally]));
  const winners = new Map<VoiceRole, string>();

  for (const role of ["therapist", "patient"] as const) {
    const claimants = tallies
      .filter((tally) => tally.candidate === role)
      .sort((a, b) => b[role] - a[role]);

    if (claimants.length === 0) continue;
    /* A tie for one role is nobody, in both directions. */
    if (claimants.length > 1 && claimants[0]![role] === claimants[1]![role]) continue;
    winners.set(role, claimants[0]!.label);
  }

  return roster.map((voice) => {
    const tally = byLabel.get(voice.label);
    const role = tally?.candidate ?? null;
    const holds = role !== null && winners.get(role) === voice.label;
    return holds ? { ...voice, role, boundBy } : { ...voice, role: null, boundBy: null };
  });
}

/**
 * The identities a session may lend to a voice.
 *
 * 🔴 41.5 in advance: **identity comes from the session we created, never from
 * a meeting display name.** This type is the only way a name reaches a
 * transcript line, and it is built from the session record. A provider's
 * `participant.name` — "iPhone", "Mum", "Dr Smith (guest)" — has nowhere to go.
 */
export type SessionIdentities = {
  therapist: string;
  /** Null for a session with no patient on it, such as a join-link session. */
  patient: string | null;
};

/**
 * What the transcript shows beside a line.
 *
 * An unrecognised voice is `Speaker N` where N is its position among **all**
 * the voices in the recording, not among the unnamed ones. The third voice in
 * the room is "Speaker 3" whether or not the first two were identified, which
 * is how a person reading the transcript counts and therefore the only
 * numbering that does not mislead.
 */
export function displayFor(voice: Voice, identities: SessionIdentities): string {
  if (voice.role === "therapist") return identities.therapist;
  if (voice.role === "patient" && identities.patient) return identities.patient;
  /*
   * A patient-bound voice in a session with no patient record still must not be
   * invented a name. It falls through to its ordinal, like any other voice we
   * cannot name.
   */
  return `Speaker ${voice.ordinal}`;
}

/**
 * What goes in the `speaker` column for a line assigned to this voice.
 *
 * 🔴 An unrecognised voice writes `unknown`, always. This is the same rule the
 * database enforces in migration 0065, in two places on purpose: the column
 * is the rule that cannot be forgotten, and this is the one a developer reads.
 */
export function speakerFor(voice: Voice | null | undefined): VoiceRole | "unknown" {
  return voice?.role ?? "unknown";
}

export type VoiceReport = {
  voices: Voice[];
  /** Voices the evidence could not name. Never a failure, often the answer. */
  unnamed: number;
};

/** The whole offline pass, for a caller that has turns, chunks and evidence. */
export function resolveVoices(input: {
  turns: readonly AcousticTurn[];
  alignments: readonly Alignment[];
  measured: ReadonlyMap<number, VoiceRole>;
  boundBy?: BoundBy;
}): VoiceReport {
  const roster = rosterFor(input.turns);
  const tallies = tallyEvidence(roster, input.alignments, input.measured);
  const voices = bindVoices(roster, tallies, input.boundBy ?? "track");
  return { voices, unnamed: voices.filter((voice) => voice.role === null).length };
}
