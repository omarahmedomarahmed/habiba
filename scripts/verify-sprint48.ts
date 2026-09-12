/**
 * Sprint 48 acceptance: the copilot in the room, free.
 *
 *   npm run verify:sprint48
 *
 * ## The case this sprint is built around
 *
 * A patient declines recording. There is no transcript, so there is no note to
 * draft, so the only AI help the therapist has left is the panel that reads
 * the record that already existed. Ticket 23.3 said that panel spends the same
 * allowance as `/copilot`, which would lock them out of it on exactly the
 * session where they need it most, having already paid the platform fee.
 *
 * C210 overturned 23.3. This proves the three properties that makes true:
 *
 *   free       an in-room question does not spend the earned allowance
 *   bounded    it reads the record as of `startedAt` and nothing after it
 *   finite     the free window is the session, not a room somebody left open
 *
 * ## 🔴 Why each is checked with its opposite
 *
 * "An in-room question is not counted" passes against a counter that counts
 * nothing. "The copilot cannot see the live session" passes against a copilot
 * that can see nothing at all. Every check below is paired with the one that
 * makes it mean something.
 */
import { and, eq, sql } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

async function main() {
  writesTo();

  const { controlDb: db } = await import("../lib/db");
  const { copilotMessages, copilotThreads, sessions, patients } = await import(
    "../lib/db/schema"
  );
  const { checkQuota } = await import("../lib/data/copilot");
  const { liveSessionForPatient } = await import("../lib/data/sessions");
  const { getSettings } = await import("../lib/settings");

  const settings = await getSettings();

  const thread = required(
    (
      await db
        .select({
          id: copilotThreads.id,
          patientId: copilotThreads.patientId,
          organizationId: copilotThreads.organizationId,
          therapistId: copilotThreads.therapistId,
        })
        .from(copilotThreads)
        .limit(1)
    )[0],
    "copilot thread",
  );

  const actor = {
    userId: thread.therapistId,
    organizationId: thread.organizationId,
    role: "therapist",
  } as never;

  /* ------------------------------------------ 48.2 / C210 · free and uncounted -- */

  const before = await checkQuota(actor, thread.id);

  const session = required(
    (
      await db
        .select({ id: sessions.id, organizationId: sessions.organizationId, therapistId: sessions.therapistId })
        .from(sessions)
        .where(eq(sessions.organizationId, thread.organizationId))
        .limit(1)
    )[0],
    "session to attribute an in-room question to",
  );

  const [inRoom] = await db
    .insert(copilotMessages)
    .values({
      threadId: thread.id,
      role: "therapist",
      content: "verify:sprint48, asked from inside the room",
      sessionId: session.id,
    })
    .returning({ id: copilotMessages.id });

  const afterInRoom = await checkQuota(actor, thread.id);

  const [between] = await db
    .insert(copilotMessages)
    .values({
      threadId: thread.id,
      role: "therapist",
      content: "verify:sprint48, asked between sessions",
      sessionId: null,
    })
    .returning({ id: copilotMessages.id });

  const afterBetween = await checkQuota(actor, thread.id);

  try {
    check(
      "🔴 48.2 / C210 a question asked IN THE ROOM spends no allowance",
      afterInRoom.used === before.used,
      `used ${before.used} → ${afterInRoom.used}`,
    );

    /*
     * 🔴 CONTROL — and a question asked between sessions still does.
     *
     * Without this, the check above passes against a `checkQuota` that has
     * stopped counting altogether, which would give away the whole allowance
     * rather than the in-room part of it, and would look identical on the
     * screen and in the ledger until somebody totted up the model spend.
     */
    check(
      "🔴 CONTROL a question asked BETWEEN sessions still spends one",
      afterBetween.used === afterInRoom.used + 1,
      `used ${afterInRoom.used} → ${afterBetween.used}`,
    );
  } finally {
    for (const row of [inRoom, between]) {
      if (row) await db.delete(copilotMessages).where(eq(copilotMessages.id, row.id));
    }
  }

  /* ---------------------------------------------- 48.6 / C224 · the window ends -- */

  /*
   * 🔴 "Free means a therapist can open a room and never close it."
   *
   * The founder's own words, and the reason `liveSessionForPatient` gained a
   * clock bound. A session that is `in_progress` and started before the clock
   * ran out is live; one that started a day ago is not, whether or not
   * anything got round to writing `completed`.
   *
   * Proved with two real rows rather than by reading the query, because the
   * bound is arithmetic against `now()` and arithmetic is what gets inverted.
   */
  const liveMinutes = settings.clock.runningMinutes + settings.clock.countdownMinutes;

  const patient = required(
    (
      await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.organizationId, thread.organizationId))
        .limit(1)
    )[0],
    "patient to open a room for",
  );

  const made: string[] = [];
  const openRoom = async (startedAt: Date) => {
    const [row] = await db
      .insert(sessions)
      .values({
        organizationId: session.organizationId,
        therapistId: session.therapistId,
        patientId: patient.id,
        status: "in_progress",
        startedAt,
        feedbackToken: `v48-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
      .returning({ id: sessions.id });
    if (row) made.push(row.id);
    return row?.id ?? null;
  };

  try {
    const freshId = await openRoom(new Date());
    const fresh = await liveSessionForPatient(actor, patient.id);

    check(
      "🔴 CONTROL a room opened just now IS live, so the free window is real",
      fresh?.id === freshId && fresh?.startedAt instanceof Date,
      fresh ? `live since ${fresh.startedAt.toISOString()}` : "no live session found",
    );

    // Age it past the clock without touching anything else.
    if (freshId) {
      await db
        .update(sessions)
        .set({ startedAt: new Date(Date.now() - (liveMinutes + 60) * 60_000) })
        .where(eq(sessions.id, freshId));
    }

    const stale = await liveSessionForPatient(actor, patient.id);

    check(
      "🔴 48.6 / C224 a room left open past the session clock is NOT live, so the free window closes",
      stale === null,
      `clock is ${liveMinutes} minutes; the room was aged ${liveMinutes + 60} minutes`,
    );
  } finally {
    for (const id of made) await db.delete(sessions).where(eq(sessions.id, id));
  }

  /* --------------------------------------------- 48.4 / C211 · the time bound -- */

  /*
   * One bound, no branch. Asserted on the source because the alternative is
   * running a live model call, and what is being checked is the SHAPE: that
   * the cut is a single parameter threaded through every read, rather than
   * three cases keyed on the consent state.
   *
   * 🔴 The second half is the one that matters. A bound that reads
   * `recordingConsent` anywhere in the copilot's context assembly is three
   * branches pretending to be a rule, and the branch that would be got wrong
   * is the one where the patient said no.
   */
  const copilot = readSource("lib/ai/case-copilot.ts");

  check(
    "🔴 48.4 / C211 the copilot takes a `liveSince` bound and applies it to the record",
    /liveSince\?: Date \| null/.test(copilot) &&
      /buildPatientContext\(opts\.patientId, before\)/.test(copilot),
    "one parameter, threaded through the transcript and the journals",
  );

  check(
    "🔴 48.4 …and NOTHING in the copilot's context branches on the consent state",
    !/recordingConsent/.test(copilot),
    "granted, declined and withdrawn are one rule, because three branches is three chances to get the refusal wrong",
  );

  /*
   * The journals are bounded too, and that is not obvious: a patient
   * journalling on their phone during their own session is not hypothetical,
   * the app is open in front of them. Without this the live-session reading
   * arrives through a side door.
   */
  const journals = readSource("lib/data/journals.ts");

  check(
    "🔴 48.4 the journal context honours the same bound",
    /before\?: Date \| null/.test(journals) && /lt\(journals\.createdAt, opts\.before\)/.test(journals),
    "a patient writing during their own session is not a hypothetical",
  );

  /* --------------------------------------------------- 48.5 · the sentence -- */

  /*
   * 🔴 The wording, and the half of the founder's sentence that is NOT here.
   *
   * 48.5 words it "This session is not being recorded. I only know what came
   * before it." The first half is false half the time: the bound applies
   * identically when consent was GRANTED. A therapist who reads "not being
   * recorded" during a session that is being recorded stops trusting the
   * panel, and a panel nobody trusts is worse than no panel.
   */
  const panel = readSource("components/session/ask-panel.tsx");

  check(
    "🔴 48.5 the panel says the bound out loud, before the first question",
    /troom\.ask\.bound/.test(panel),
    "on screen from the moment it opens, not printed as an apology after a disappointing answer",
  );

  const { en } = await import("../lib/i18n/messages");

  check(
    "🔴 48.5 …and the sentence never claims the session is unrecorded",
    /only know what came before/i.test(en["troom.ask.bound"]) &&
      !/not being recorded/i.test(en["troom.ask.bound"]),
    JSON.stringify(en["troom.ask.bound"]),
  );

  /*
   * And the model is told, at the top, above the therapist's own standing
   * instructions. Same position and reason as the consent boundary (H2): this
   * is not theirs to waive.
   */
  check(
    "🔴 48.5 the model is given the bound above the therapist's own instructions",
    /TIME BOUND THAT OVERRIDES EVERYTHING BELOW/.test(copilot),
    "a therapist cannot instruct their way past it, because it is not theirs to waive",
  );

  /* ------------------------------------ 48.10 · the patient's own control -- */

  const patientRoom = readSource("components/join/patient-room.tsx");
  const joinActions = readSource("app/join/[token]/actions.ts");

  check(
    "🔴 48.10 the patient can stop the recording themselves",
    /stopRecording/.test(patientRoom) && /export async function stopRecording/.test(joinActions),
    "the person whose consent is the basis for recording had no way to withdraw it except by asking",
  );

  /*
   * 🔴 And it stops the audio without deleting what was captured.
   *
   * The generous-looking build erases the transcript, and a chart that
   * rewrites itself is worse than one with a gap: a note drafted from a
   * transcript that has since been shortened is a document whose evidence no
   * longer matches it, and nobody reading it later can tell.
   */
  const stopBody = joinActions.slice(joinActions.indexOf("export async function stopRecording"));

  check(
    "🔴 48.10 …and stopping does NOT delete what was already captured",
    /recordingPausedAt: new Date\(\)/.test(stopBody) &&
      !/delete\(transcriptSegments\)/.test(stopBody),
    "a chart that rewrites itself is worse than one with a gap (47.2 names the gap)",
  );

  /*
   * The strip no longer says "paused by your therapist", which stopped being
   * true the moment the patient got the same button. A person who has just
   * stopped their own recording and is told their therapist did it would
   * reasonably conclude the control did nothing.
   */
  check(
    "48.10 the recording strip no longer attributes the pause to the therapist",
    !/paused by your therapist/i.test(patientRoom) &&
      !/paused by your therapist/i.test(en["proom.recordingStopped"] ?? ""),
    JSON.stringify(en["proom.recordingStopped"]),
  );

  /* ---------------------------------------------------- 48.9 · polling -- */

  const chat = readSource("components/copilot/chat.tsx");

  check(
    "48.9 the live indicator polls, and is not a websocket",
    /setInterval/.test(chat) && /copilot\/live\?patient=/.test(chat) && !/WebSocket/.test(chat),
    "the founder's ruling: one clinician's screen refreshing a boolean is not a signalling problem",
  );

  /* ------------------------------------------- 48.7 · the four states hold -- */

  /*
   * "A new surface on existing machinery, never a second set of rules."
   * `askCopilot` is the one entry point and it still checks `accessFor`
   * BEFORE anything is spent — which matters more now, not less: a refusal
   * that has already consumed a credit is a refusal the clinician pays for,
   * and the in-room path must not have found a way round the check by being
   * free.
   */
  const actions = readSource("app/(app)/copilot/actions.ts");
  const accessIndex = actions.indexOf("accessFor(actor, patientId)");
  const quotaIndex = actions.indexOf("checkQuota(actor, found.thread.id)");

  check(
    "🔴 48.7 the four access states are still checked, and still before the quota",
    accessIndex > 0 && quotaIndex > accessIndex,
    "one entry point, one set of rules; free did not become a way round consent",
  );

  finish("sprint 48");
}

void main();
