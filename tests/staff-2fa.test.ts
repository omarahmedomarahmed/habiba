import assert from "node:assert/strict";
import { test } from "node:test";

import {
  base32Decode,
  base32Encode,
  hashRecoveryCode,
  hotp,
  looksLikeRecoveryCode,
  needsSecondFactor,
  newRecoveryCodes,
  otpauthUri,
  redeemRecoveryCode,
  secondFactorCurrent,
  stepAt,
  totpAt,
  verifyTotp,
} from "../lib/auth/totp";

/**
 * 🔴 Task 40: the back office's second step, the pure half.
 *
 *   npm run test:staff-2fa
 *
 * The RFC's own vectors first, because a TOTP that is wrong by one byte of
 * truncation is a TOTP that no authenticator app agrees with, and nobody
 * finds out until the owner is locked out of the console.
 */

/** RFC 6238 appendix B, the SHA-1 key: the ASCII string "12345678901234567890". */
const RFC_KEY = Buffer.from("12345678901234567890", "ascii");

test("RFC 6238 appendix B, SHA-1, every vector", () => {
  const vectors: [number, string][] = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  for (const [seconds, expected] of vectors) {
    assert.equal(totpAt(RFC_KEY, seconds * 1000, 8), expected, `T=${seconds}`);
    // The six digit code an app shows is the same number modulo 10^6.
    assert.equal(totpAt(RFC_KEY, seconds * 1000), expected.slice(2), `T=${seconds}, 6 digits`);
  }
});

test("RFC 4226 appendix D, the HOTP it is built on", () => {
  const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  expected.forEach((code, counter) => assert.equal(hotp(RFC_KEY, counter), code, `counter ${counter}`));
});

test("base32 round trips, and the RFC key encodes as every app expects", () => {
  assert.equal(base32Encode(RFC_KEY), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.deepEqual(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq"), RFC_KEY);
  const uri = otpauthUri({ secret: RFC_KEY, account: "sam@example.com", issuer: "24Therapy" });
  assert.match(uri, /^otpauth:\/\/totp\/24Therapy%3Asam%40example\.com\?/);
  assert.match(uri, /secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ/);
  assert.match(uri, /algorithm=SHA1&digits=6&period=30/);
});

test("the window: one step either side passes, two does not", () => {
  const now = 1_111_111_111_000;
  const step = stepAt(now);
  const at = (offset: number) => hotp(RFC_KEY, step + offset);

  assert.deepEqual(verifyTotp(RFC_KEY, at(0), now, null), { ok: true, step });
  assert.deepEqual(verifyTotp(RFC_KEY, at(-1), now, null), { ok: true, step: step - 1 });
  assert.deepEqual(verifyTotp(RFC_KEY, at(1), now, null), { ok: true, step: step + 1 });
  assert.deepEqual(verifyTotp(RFC_KEY, at(-2), now, null), { ok: false, reason: "wrong" });
  assert.deepEqual(verifyTotp(RFC_KEY, at(2), now, null), { ok: false, reason: "wrong" });

  // Malformed input never reaches the comparison.
  assert.deepEqual(verifyTotp(RFC_KEY, "12345", now, null), { ok: false, reason: "malformed" });
  assert.deepEqual(verifyTotp(RFC_KEY, "abcdef", now, null), { ok: false, reason: "malformed" });
  // Spaces a person types between the groups are forgiven.
  assert.equal(verifyTotp(RFC_KEY, `${at(0).slice(0, 3)} ${at(0).slice(3)}`, now, null).ok, true);
});

test("🔴 a replay of the same step is refused, and so is any earlier step", () => {
  const now = 1_234_567_890_000;
  const step = stepAt(now);
  const code = hotp(RFC_KEY, step);

  const first = verifyTotp(RFC_KEY, code, now, null);
  assert.deepEqual(first, { ok: true, step });

  // The same code, ten seconds later, still inside its window: refused.
  assert.deepEqual(verifyTotp(RFC_KEY, code, now + 10_000, step), { ok: false, reason: "replayed" });
  // The previous step's code, which the window would otherwise admit: refused.
  assert.deepEqual(verifyTotp(RFC_KEY, hotp(RFC_KEY, step - 1), now, step), { ok: false, reason: "replayed" });
  // CONTROL: the next step's code is fresh and passes.
  assert.deepEqual(verifyTotp(RFC_KEY, hotp(RFC_KEY, step + 1), now + 30_000, step), { ok: true, step: step + 1 });
});

test("🔴 a recovery code works once, and a spent one reads as wrong", () => {
  const codes = newRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10, "ten different codes");
  for (const code of codes) assert.match(code, /^[a-z2-9]{5}-[a-z2-9]{5}$/);

  let stored = codes.map((code) => ({ codeHash: hashRecoveryCode(code), usedAt: null as Date | null }));
  // Only hashes are kept: no stored field contains the code.
  for (const [i, row] of stored.entries()) assert.ok(!row.codeHash.includes(codes[i]!.replace("-", "")));

  const typed = `  ${codes[3]!.toUpperCase().replace("-", " ")} `;
  assert.equal(looksLikeRecoveryCode(typed), true);
  const once = redeemRecoveryCode(stored, typed);
  assert.equal(once.ok, true);
  if (once.ok) stored = once.codes;
  assert.equal(stored.filter((row) => row.usedAt).length, 1);

  assert.deepEqual(redeemRecoveryCode(stored, codes[3]!), { ok: false }, "the same code, twice");
  assert.deepEqual(redeemRecoveryCode(stored, "zzzzz-zzzzz"), { ok: false }, "a code never issued");
  // CONTROL: a different, unspent code still works.
  assert.equal(redeemRecoveryCode(stored, codes[4]!).ok, true);
  // Six digits are an app code, never a recovery code.
  assert.equal(looksLikeRecoveryCode("123456"), false);
});

test("who owes the step, and for how long it counts", () => {
  for (const role of ["staff", "manager", "super_admin"] as const) assert.equal(needsSecondFactor(role), true, role);
  assert.equal(needsSecondFactor("therapist"), false, "clinicians are unaffected");
  assert.equal(needsSecondFactor(null), false);

  const now = new Date("2026-09-25T12:00:00Z");
  const hours = (h: number) => new Date(now.getTime() - h * 3_600_000);
  assert.equal(secondFactorCurrent(null, now), false, "a password alone");
  assert.equal(secondFactorCurrent(hours(1), now), true);
  assert.equal(secondFactorCurrent(hours(11.9), now), true);
  assert.equal(secondFactorCurrent(hours(12), now), false, "asked again after twelve hours");
  assert.equal(secondFactorCurrent(hours(-1), now), false, "a time in the future fails closed");
});
