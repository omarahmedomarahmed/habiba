import assert from "node:assert/strict";
import { test } from "node:test";

import { accessStateFor, capabilitiesFor, explain, isLiveGrant } from "../lib/access/state";
import { lateRecordingStamp, LATE_RECORDING_THRESHOLD_MS } from "../lib/consent";

/**
 * §3's four states, and the two consent controls, as arithmetic.
 *
 * The rules here decide what one person may read about another, so every one
 * of them is a test rather than a paragraph. The two that matter most:
 *
 *   - **revoking stops new reading and cannot un-read.** A revoked therapist
 *     keeps their own transcripts, their own notes and the old chat. If a
 *     future edit takes those away, this suite fails.
 *   - **an unclaimed record is nobody's to grant.** There is no state in which
 *     an unclaimed person's record can be shared, because there is nobody to
 *     ask (§6).
 */

const now = new Date("2026-09-05T12:00:00Z");
const granted = { status: "granted" as const, expiresAt: null };

/* ------------------------------------------------------------- the states -- */

test("no patient row means this session's transcript and nothing else", () => {
  const state = accessStateFor({
    hasPatientRow: false,
    claimed: true,
    documented: true,
    grant: granted,
    now,
  });
  assert.equal(state, "no_relationship");

  // Even holding a live grant. The grant is consent to read a history; it is
  // not a relationship, and §3 gives a stranger nothing.
  const caps = capabilitiesFor(state);
  assert.equal(caps.ownTranscripts, false);
  assert.equal(caps.copilot, false);
  assert.equal(caps.canRequestAccess, false);
});

test("an unclaimed record is the therapist's own file, and cannot be granted", () => {
  for (const documented of [true, false]) {
    const state = accessStateFor({
      hasPatientRow: true,
      claimed: false,
      documented,
      grant: granted,
      now,
    });
    assert.equal(state, documented ? "unclaimed_documented" : "unclaimed_bare");

    const caps = capabilitiesFor(state);
    // §6: nothing unclaimed is ever shared. There is no live profile to read
    // and no patient files, whatever a stray grant row says.
    assert.equal(caps.liveProfile, false);
    assert.equal(caps.patientFiles, false);
    // …and nobody to ask, so no request button.
    assert.equal(caps.canRequestAccess, false);
  }
});

test("claimed with a live grant is full access", () => {
  const state = accessStateFor({
    hasPatientRow: true,
    claimed: true,
    documented: true,
    grant: granted,
    now,
  });
  assert.equal(state, "granted");

  const caps = capabilitiesFor(state);
  assert.equal(caps.liveProfile, true);
  assert.equal(caps.patientFiles, true);
  assert.equal(caps.diagnosisChanges, true);
  assert.equal(explain(state), null, "nothing to explain when nothing is missing");
});

test("claimed with no grant at all is the degraded state — the default is OFF", () => {
  // The step-7 default, expressed as arithmetic: the *absence* of a grant is
  // the revoked state. That is what makes "default off" real rather than a
  // checkbox somebody could flip.
  const state = accessStateFor({
    hasPatientRow: true,
    claimed: true,
    documented: true,
    grant: null,
    now,
  });
  assert.equal(state, "revoked");
});

/* ------------------------------------------------ the rule about un-reading -- */

test("revoking stops new reading and takes nothing away that was already theirs", () => {
  const caps = capabilitiesFor("revoked");

  // Stops.
  assert.equal(caps.liveProfile, false);
  assert.equal(caps.patientFiles, false);
  assert.equal(caps.diagnosisChanges, false);

  // Stays. §3: "Revoking stops new reading. It cannot un-read what was already
  // seen — the old chat stays."
  assert.equal(caps.ownTranscripts, true);
  assert.equal(caps.ownNotes, true);
  assert.equal(caps.oldChat, true);
  assert.equal(caps.copilot, true);

  assert.equal(caps.canRequestAccess, true);
});

test("the banner never accuses the patient", () => {
  const message = explain("revoked")!;
  assert.match(message, /has not granted/);
  assert.doesNotMatch(message, /revoked|refused|denied/i);
});

/* ------------------------------------------------------------- expiry -- */

test("a 24-hour grant is live up to its last second and dead after it", () => {
  const expiresAt = new Date(now.getTime() + 1000);
  assert.equal(isLiveGrant({ status: "granted", expiresAt }, now), true);
  assert.equal(isLiveGrant({ status: "granted", expiresAt }, new Date(now.getTime() + 999)), true);
  assert.equal(
    isLiveGrant({ status: "granted", expiresAt }, new Date(now.getTime() + 1000)),
    false,
  );
});

test("an expired grant degrades rather than erroring", () => {
  const state = accessStateFor({
    hasPatientRow: true,
    claimed: true,
    documented: true,
    grant: { status: "granted", expiresAt: new Date(now.getTime() - 1) },
    now,
  });
  assert.equal(state, "revoked");
});

test("pending and rejected are not access", () => {
  for (const status of ["pending", "rejected", "revoked"] as const) {
    assert.equal(isLiveGrant({ status, expiresAt: null }, now), false);
  }
});

test("an open-ended grant does not expire", () => {
  const farFuture = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3650);
  assert.equal(isLiveGrant({ status: "granted", expiresAt: null }, farFuture), true);
});

/* ------------------------------------------------ 7.8: the recording stamp -- */

const started = new Date("2026-09-05T10:22:00Z");

test("a session recorded from the start is not stamped", () => {
  assert.equal(
    lateRecordingStamp({ startedAt: started, recordingStartedAt: started, timeZone: "UTC" }),
    null,
  );
});

test("the threshold exists so the stamp does not appear on every note", () => {
  // Consent on the join form and the session starting are separate writes
  // seconds apart. A stamp that fired on that gap would train clinicians to
  // ignore it — including on the session where it matters.
  const justUnder = new Date(started.getTime() + LATE_RECORDING_THRESHOLD_MS - 1);
  assert.equal(
    lateRecordingStamp({ startedAt: started, recordingStartedAt: justUnder, timeZone: "UTC" }),
    null,
  );

  const justOver = new Date(started.getTime() + LATE_RECORDING_THRESHOLD_MS);
  assert.notEqual(
    lateRecordingStamp({ startedAt: started, recordingStartedAt: justOver, timeZone: "UTC" }),
    null,
  );
});

test("§3's worked example: recording turned on at minute 10", () => {
  const stamp = lateRecordingStamp({
    startedAt: started,
    recordingStartedAt: new Date("2026-09-05T10:32:00Z"),
    timeZone: "UTC",
  });

  assert.ok(stamp);
  assert.match(stamp, /10:32/);
  assert.match(stamp, /first 10 minutes/);
  // The claim §3 actually cares about: those minutes do not exist.
  assert.match(stamp, /not captured and do not exist/);
});

test("the time is shown in the therapist's zone, and says UTC when there is none", () => {
  const at = new Date("2026-09-05T10:32:00Z");

  // Cairo is UTC+3 in September.
  const cairo = lateRecordingStamp({
    startedAt: started,
    recordingStartedAt: at,
    timeZone: "Africa/Cairo",
  })!;
  assert.match(cairo, /13:32/);
  assert.doesNotMatch(cairo, /UTC/);

  // No zone, or a zone this runtime does not know: say so rather than render a
  // time in whatever zone the server happens to be in.
  const bare = lateRecordingStamp({ startedAt: started, recordingStartedAt: at, timeZone: null })!;
  assert.match(bare, /10:32 UTC/);

  const nonsense = lateRecordingStamp({
    startedAt: started,
    recordingStartedAt: at,
    timeZone: "Mars/Olympus",
  })!;
  assert.match(nonsense, /10:32 UTC/);
});

test("unknown is silence, never a guess", () => {
  // A session with no recording start time is one where we do not know when
  // the microphone began. The stamp exists to stop a note claiming a
  // completeness it lacks; inventing one would do the opposite.
  assert.equal(
    lateRecordingStamp({ startedAt: started, recordingStartedAt: null, timeZone: "UTC" }),
    null,
  );
  assert.equal(
    lateRecordingStamp({ startedAt: null, recordingStartedAt: started, timeZone: "UTC" }),
    null,
  );
});

test("one minute reads as a minute, not 1 minutes", () => {
  const stamp = lateRecordingStamp({
    startedAt: started,
    recordingStartedAt: new Date(started.getTime() + 60_000),
    timeZone: "UTC",
  })!;
  assert.match(stamp, /first 1 minute /);
});
