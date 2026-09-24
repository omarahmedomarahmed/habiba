import assert from "node:assert/strict";
import { test } from "node:test";

import { dropWavStart, isWavType, wavInfo } from "../lib/partner/wav";

/** 🔴 W1-17: the cut at the consent boundary, as arithmetic. */

function wav(seconds: number, fill = 0): Buffer {
  const data = 32_000 * seconds;
  const out = Buffer.alloc(44 + data, fill);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + data, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16_000, 24);
  out.writeUInt32LE(32_000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(data, 40);
  return out;
}

test("a WAV is read for its length", () => {
  assert.equal(wavInfo(wav(3))?.durationSeconds, 3);
  assert.equal(wavInfo(Buffer.from("not audio at all")), null);
});

test("the first seconds are cut exactly, and the header describes what is left", () => {
  const cut = dropWavStart(wav(10), 4)!;
  const info = wavInfo(cut)!;
  assert.equal(info.durationSeconds, 6);
  assert.equal(cut.length, 44 + 32_000 * 6);
  assert.equal(cut.readUInt32LE(4), 36 + 32_000 * 6);
});

test("a cut inside a frame rounds forward, never back into the unconsented part", () => {
  const cut = dropWavStart(wav(2), 0.00001)!;
  assert.equal(wavInfo(cut)!.dataLength, 32_000 * 2 - 2);
});

test("audio wholly before the offset leaves nothing", () => {
  assert.equal(dropWavStart(wav(3), 3), null);
  assert.equal(dropWavStart(wav(3), 10), null);
});

test("content types", () => {
  assert.ok(isWavType("audio/wav"));
  assert.ok(isWavType("audio/x-wav; codecs=1"));
  assert.ok(!isWavType("audio/webm"));
});
