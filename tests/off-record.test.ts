import assert from "node:assert/strict";
import { test } from "node:test";

import { pressOffRecord } from "../lib/sessions/off-record";

/**
 * 🔴 W1-06: the off-record press waits for the server.
 *
 * It was fire and forget, so a failed write left the screen saying off record
 * while the server still took audio. These drive the press with a write that
 * fails, and with one that succeeds, and read back what the room was told.
 */

function room() {
  const applied: boolean[] = [];
  return { applied, apply: (off: boolean) => applied.push(off) };
}

test("a failed pause puts the pill and the recorders back, and says so", async () => {
  const r = room();
  const outcome = await pressOffRecord(false, "granted", {
    apply: r.apply,
    write: async () => ({ ok: false }),
  });
  assert.equal(outcome.failed, true);
  assert.equal(outcome.offRecord, false);
  assert.equal(r.applied.at(-1), false, "the room must end where the server is: recording");
});

test("a pause whose write throws is reverted the same way", async () => {
  const r = room();
  const outcome = await pressOffRecord(false, "granted", {
    apply: r.apply,
    write: async () => {
      throw new Error("network");
    },
  });
  assert.equal(outcome.failed, true);
  assert.equal(r.applied.at(-1), false);
});

test("going off record mutes at once: muting early can only record less", async () => {
  const r = room();
  let mutedBeforeServer = false;
  await pressOffRecord(false, "granted", {
    apply: r.apply,
    write: async () => {
      mutedBeforeServer = r.applied.at(-1) === true;
      return { ok: true };
    },
  });
  assert.equal(mutedBeforeServer, true);
  assert.deepEqual(r.applied, [true]);
});

test("resuming waits for the server before the room says live", async () => {
  const r = room();
  let liveBeforeServer = false;
  const outcome = await pressOffRecord(true, "granted", {
    apply: r.apply,
    write: async () => {
      liveBeforeServer = r.applied.includes(false);
      return { ok: true };
    },
  });
  assert.equal(liveBeforeServer, false);
  assert.deepEqual(r.applied, [false]);
  assert.equal(outcome.offRecord, false);
});

test("a failed resume stays off record", async () => {
  const r = room();
  const outcome = await pressOffRecord(true, "granted", {
    apply: r.apply,
    write: async () => ({ ok: false }),
  });
  assert.equal(outcome.failed, true);
  assert.equal(outcome.offRecord, true);
  assert.notEqual(r.applied.at(-1), false, "the microphone never opened");
});

test("no standing yes: resume is not the clinician's to press", async () => {
  const r = room();
  const outcome = await pressOffRecord(true, "declined", {
    apply: r.apply,
    write: async () => ({ ok: true }),
  });
  assert.equal(outcome.offRecord, true);
  assert.deepEqual(r.applied, []);
});
