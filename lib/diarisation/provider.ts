/**
 * The shape of the half that is not built. PLAN.md 37.1, gap 37.4.
 *
 * ## ⚠️ 37.4 — THE NAMED GAP
 *
 * Sprint 37 was split deliberately and this file is the seam. What ships is
 * everything that can be measured without a provider: the turn arithmetic, the
 * alignment, the evidence rules, the fixtures and the tests. What does **not**
 * ship is:
 *
 *   1. **the provider call** — no diarisation SDK, no API key, no audio leaves
 *      this codebase in this sprint; and
 *   2. **the acoustic diarisation error rate** — the number that says how well
 *      a provider separates two voices sharing one microphone in one room.
 *
 * The second is the reason for the first. A diarisation number measured
 * against synthetic turns measures nothing but the arithmetic in `align.ts`,
 * which is already measured exactly by `tests/diarisation.test.ts`. The
 * honest DER needs real audio of two people in a room with a gold transcript,
 * and a provider to run it against. Until that exists this is a gap, named the
 * way 35R.4 is named, and **41 stays blocked on 37 being measured rather than
 * merely built**.
 *
 * ## What the missing half must supply, and nothing more
 *
 * One function. It receives audio and returns turns with opaque labels. It is
 * given no session, no patient, no names, and it returns none: everything it
 * could say about identity would be a guess, and `voices.ts` refuses guesses.
 *
 * There is no default implementation here on purpose. A stub that returned an
 * empty turn list would make every caller degrade silently into "no voices
 * were heard", which is indistinguishable in a transcript from a recording of
 * an empty room. The absence is a compile error instead.
 */
import type { AcousticTurn } from "./turns";

export type DiarisationRequest = {
  /** Where the audio is. A URL or a key, never the bytes in a log line. */
  audioRef: string;
  /**
   * How many voices to expect, when the session record knows.
   *
   * 🔴 A hint, never a cap that invents an answer: a provider told "2" that
   * hears three people must be allowed to say three. 37.3 is N speakers, and a
   * third voice collapsed into the second to match a hint is precisely the
   * invented identity that rule forbids.
   */
  expectedVoices?: number;
  languageHint?: string;
};

export type DiarisationResponse = {
  turns: AcousticTurn[];
  /** The provider's own name for what it ran, for the audit and the ledger. */
  engine: string;
  durationMs: number;
};

export type DiarisationProvider = {
  name: string;
  diarise(request: DiarisationRequest): Promise<DiarisationResponse>;
};
