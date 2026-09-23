/**
 * 🔴 WHETHER AUDIO FROM THIS SESSION MAY BE TURNED INTO WORDS. Task 123.
 *
 * One rule, asked by every door that transcribes: our own room's chunk upload
 * (`app/api/sessions/[id]/transcribe`) and a meeting bot's webhook
 * (`app/api/meetings/transcript/[sessionId]`). The webhook had it; the room
 * did not, so an in-person session, where nobody is ever asked, was recorded
 * and transcribed with `recording_consent` NULL, and the note page then said
 * "Not recorded" over a note drafted from that recording. Seen on production
 * 2026-09-23 (`takeover/walk/RESULTS.md`, live 7-8).
 *
 * A consent that was never given is a no. So is a pause, whoever set it: the
 * clinician's off-record button, "do not transcribe" at creation, or the
 * patient's own Stop, which also withdraws consent so the clinician cannot
 * resume past it (`stopRecording`).
 */
export function mayRecord(row: {
  recordingConsent: "granted" | "declined" | null;
  recordingPausedAt: Date | null;
}): boolean {
  return row.recordingConsent === "granted" && row.recordingPausedAt === null;
}
