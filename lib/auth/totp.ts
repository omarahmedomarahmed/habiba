import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { BACK_OFFICE_ROLES, type Role } from "@/lib/db/schema";

/**
 * 🔴 TASK 40: THE BACK OFFICE'S SECOND STEP, THE PURE HALF.
 *
 * Staff and owners approve payouts, confirm transfers and read records. A
 * password alone was the whole of that, so a password reused from somewhere
 * else was the console. After 0167 a back office session must also pass a
 * second step: a code from an authenticator app (RFC 6238). DD-2 B2.3 retired
 * the emailed code; DD-2 B2.4 lets clinicians, clinic managers and partner
 * users add the same app, and asks for it once they have.
 *
 * Everything here is pure and has no database, so `tests/staff-2fa.test.ts`
 * runs the RFC's own vectors against it. The half that stores and spends
 * things is `lib/auth/second-factor.ts`.
 *
 * ## Why node:crypto and not a package
 *
 * TOTP is an HMAC over a counter and a dynamic truncation, about thirty lines.
 * A dependency for it would be a supply chain for thirty lines that sit on the
 * sign-in path of every account that can move money.
 */

/** RFC 6238 defaults, which every authenticator app assumes. */
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** ±1 step: a phone clock thirty seconds out still signs in, ninety does not. */
export const TOTP_WINDOW = 1;

/** 🔴 Asked for again after twelve hours, whatever the session's own clock says. */
export const SECOND_FACTOR_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const RECOVERY_CODE_COUNT = 10;

/* ------------------------------------------------------------------ */
/*  Who must, and whether they have                                    */
/* ------------------------------------------------------------------ */

/** Staff, managers and owners must have one. Everybody else may. */
export function needsSecondFactor(role: Role | null | undefined): boolean {
  return Boolean(role) && (BACK_OFFICE_ROLES as readonly string[]).includes(role!);
}

/** DD-2 B2.4: the step is owed by a role that must, and by anybody who enrolled an app. */
export function secondStepOwed(role: Role | null | undefined, appEnrolled: boolean): boolean {
  return needsSecondFactor(role) || appEnrolled;
}

/**
 * Whether a session's second step still counts. A time in the future is a
 * clock fault or a forged row, and fails closed rather than counting forever.
 */
export function secondFactorCurrent(
  passedAt: Date | null | undefined,
  now: Date = new Date(),
  maxAgeMs: number = SECOND_FACTOR_MAX_AGE_MS,
): boolean {
  if (!passedAt) return false;
  const age = now.getTime() - passedAt.getTime();
  return age >= -60_000 && age < maxAgeMs;
}

/* ------------------------------------------------------------------ */
/*  Base32, RFC 4648, which is what an otpauth URI carries             */
/* ------------------------------------------------------------------ */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Not a base32 secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/* ------------------------------------------------------------------ */
/*  HOTP and TOTP                                                      */
/* ------------------------------------------------------------------ */

/** RFC 4226: HMAC-SHA-1 over the 8 byte counter, dynamic truncation, modulo 10^digits. */
export function hotp(key: Uint8Array, counter: number, digits: number = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(message).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary =
    ((mac[offset]! & 0x7f) << 24) |
    (mac[offset + 1]! << 16) |
    (mac[offset + 2]! << 8) |
    mac[offset + 3]!;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The 30 second step a moment falls in. */
export function stepAt(timeMs: number): number {
  return Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
}

export function totpAt(key: Uint8Array, timeMs: number, digits: number = TOTP_DIGITS): string {
  return hotp(key, stepAt(timeMs), digits);
}

export type TotpVerdict =
  | { ok: true; step: number }
  | { ok: false; reason: "malformed" | "wrong" | "replayed" };

/**
 * Check a six digit code against the steps either side of now.
 *
 * 🔴 `lastStep` is the step the previous accepted code was for, and any step
 * at or before it is refused as a replay. Without it a code read over a
 * shoulder, or lifted from a screen share, works for up to ninety seconds.
 * The caller writes the returned step back with a conditional UPDATE so two
 * requests racing with the same code cannot both pass.
 *
 * Every candidate is compared, in constant time, whether or not an earlier
 * one matched, so how long this takes says nothing about which step was right.
 */
export function verifyTotp(
  key: Uint8Array,
  code: string,
  nowMs: number,
  lastStep: number | null,
  window: number = TOTP_WINDOW,
): TotpVerdict {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return { ok: false, reason: "malformed" };

  const current = stepAt(nowMs);
  let matched: number | null = null;
  for (let offset = -window; offset <= window; offset += 1) {
    const step = current + offset;
    if (step < 0) continue;
    const expected = Buffer.from(hotp(key, step, TOTP_DIGITS));
    if (timingSafeEqual(expected, Buffer.from(digits)) && matched === null) matched = step;
  }

  if (matched === null) return { ok: false, reason: "wrong" };
  if (lastStep !== null && matched <= lastStep) return { ok: false, reason: "replayed" };
  return { ok: true, step: matched };
}

/** 160 bits, the RFC 4226 recommendation and what every app expects. */
export function newTotpSecret(): Buffer {
  return randomBytes(20);
}

/**
 * The URI the QR code carries. SHA1, 6 digits and 30 seconds are stated even
 * though they are the defaults, because some apps read an absent parameter as
 * "ask the user" and the rest of this file does not bend.
 */
export function otpauthUri(input: { secret: Uint8Array; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${input.issuer}:${input.account}`);
  const params = new URLSearchParams({
    secret: base32Encode(input.secret),
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/*  Recovery codes                                                     */
/* ------------------------------------------------------------------ */

const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Ten codes of ten characters, about 49 bits each, printed `xxxxx-xxxxx`.
 * The alphabet leaves out 0, o, 1, i and l, because these are copied onto
 * paper and read back months later.
 */
export function newRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    let raw = "";
    for (let i = 0; i < 10; i += 1) raw += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

/** What was typed, as it was issued: case, spaces and the dash do not matter. */
export function normaliseRecoveryCode(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** A recovery code is a password nobody chose, so it is stored as a hash and nothing else. */
export function hashRecoveryCode(input: string): string {
  return createHash("sha256").update(`staff-recovery:${normaliseRecoveryCode(input)}`).digest("hex");
}

/** Whether a typed string is shaped like a recovery code rather than six digits. */
export function looksLikeRecoveryCode(input: string): boolean {
  return normaliseRecoveryCode(input).length === 10 && !/^\d+$/.test(input.trim());
}

/**
 * Spend one recovery code from a list, purely. The database does the same in
 * one conditional UPDATE (`used_at IS NULL`); this is the rule it enforces,
 * stated where a test can hold it: a code works once, and a spent one is
 * refused exactly like a wrong one.
 */
export function redeemRecoveryCode<T extends { codeHash: string; usedAt: Date | null }>(
  codes: T[],
  input: string,
  now: Date = new Date(),
): { ok: true; codes: T[] } | { ok: false } {
  const hash = hashRecoveryCode(input);
  const index = codes.findIndex((code) => code.codeHash === hash && code.usedAt === null);
  if (index < 0) return { ok: false };
  return { ok: true, codes: codes.map((code, i) => (i === index ? { ...code, usedAt: now } : code)) };
}

/* ------------------------------------------------------------------ */
/*  Proving the person before an app is enrolled                       */
/* ------------------------------------------------------------------ */

/**
 * A back office member's FIRST app is enrolled only after six digits emailed
 * to their own address, so a stolen password alone cannot plant an app. The
 * code lives ten minutes; the proof it gives lasts thirty, for this session.
 */
export const ENROL_CODE_MINUTES = 10;
export const ENROL_PROOF_MINUTES = 30;
/** A pending app not confirmed within this long has to be started again. */
export const PENDING_ENROLMENT_MINUTES = 15;

export function newEnrolCode(): string {
  return String(randomInt(1_000_000)).padStart(6, "0");
}

export function hashEnrolCode(code: string): string {
  return createHash("sha256").update(`staff-enrol:${code.replace(/\D/g, "")}`).digest("hex");
}

/**
 * How far the database clock may run ahead of the app's. A row stamped by the
 * database `now()` read by the app can look a fraction of a second "in the
 * future" (176 ms measured on 4 Oct), which read as expired the moment it was made.
 */
export const CLOCK_SKEW_MS = 60_000;

/** Whether a proof spent at `usedAt` still opens enrolment. A time further ahead than clock skew fails closed. */
export function enrolProofCurrent(usedAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!usedAt) return false;
  const age = now.getTime() - usedAt.getTime();
  return age >= -CLOCK_SKEW_MS && age <= ENROL_PROOF_MINUTES * 60_000;
}

/** Whether a pending (unconfirmed) app was started recently enough to be shown or confirmed. */
export function pendingEnrolmentCurrent(startedAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!startedAt) return false;
  const age = now.getTime() - startedAt.getTime();
  return age >= -CLOCK_SKEW_MS && age <= PENDING_ENROLMENT_MINUTES * 60_000;
}
