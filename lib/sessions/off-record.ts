/**
 * 🔴 W1-06: the off-record press waits for the server.
 *
 * It was fire and forget (`void setRecordingPaused(...)`), so a write that
 * failed left the clinician's screen saying off record while the server, which
 * decides what is kept (`mayRecord`), still accepted every chunk. Now the press
 * awaits the answer, and a refusal or a throw puts the room back where the
 * server is, and says so.
 *
 * ## Which way is optimistic
 *
 * Going OFF record mutes at once. A muted recorder sends nothing, so muting
 * before the server agrees can only record less, never keep more.
 *
 * Going back ON waits. Until the server has cleared the pause, the transcribe
 * route refuses every chunk anyway, and a pill saying live over audio that is
 * being thrown away is the same lie in the other direction.
 */

export type OffRecordDeps = {
  /** Put the pill and both recorders into this state. */
  apply: (offRecord: boolean) => void;
  /** Tell the server. `setRecordingPaused`. */
  write: (paused: boolean) => Promise<{ ok: boolean }>;
};

export type OffRecordOutcome = { offRecord: boolean; failed: boolean };

export async function pressOffRecord(
  current: boolean,
  consent: "granted" | "declined" | null,
  deps: OffRecordDeps,
): Promise<OffRecordOutcome> {
  // Resume is the clinician's over their own pause only (task 123).
  if (current && consent !== "granted") return { offRecord: current, failed: false };
  const next = !current;

  if (next) deps.apply(true);

  let ok = false;
  try {
    ok = (await deps.write(next)).ok;
  } catch {
    ok = false;
  }

  if (!ok) {
    if (next) deps.apply(current);
    return { offRecord: current, failed: true };
  }
  if (!next) deps.apply(false);
  return { offRecord: next, failed: false };
}
