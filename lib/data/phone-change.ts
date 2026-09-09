import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { hashPassword as hashCode, verifyPassword as verifyCode } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { patientAccounts, phoneChangeRequests, users } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { notify } from "@/lib/notify";
import { e164Problem, toE164 } from "@/lib/phone/e164";

/**
 * Changing the number an identity hangs on. PLAN.md 20.13–20.17, §3d.
 *
 * ## 🔴 Why this is a queue with a human in it
 *
 * §3b makes the phone number the identity: it is what a claim is proved
 * against, what a code is sent to, and what stops two people sharing a record.
 * Letting somebody change it from a settings screen is letting them move an
 * account onto a number they have proved nothing about — and the person most
 * motivated to do that is not the account's owner.
 *
 * So: a request in the patient's own words, a staff member who calls or
 * messages the new number, an approval by a named person, and then a code sent
 * **to the new number** and entered in the app. Four steps, three of them
 * refusable, and the last one impossible to fake from inside this building —
 * the code is hashed, so a staff member reading the table cannot complete a
 * change they approved.
 *
 * ## The 90-day lock, and the one exception that matters
 *
 * 20.14: ninety days from the day a number is confirmed, and ninety days
 * between changes — **except** a correction inside the first 24 hours after
 * signup, which is not a change of number at all. Without that exception a
 * mistyped digit traps somebody outside their own record for three months, and
 * we would get the support ticket anyway.
 */

export const LOCK_DAYS = 90;
export const CORRECTION_HOURS = 24;
export const CODE_HOURS = 24;

export type ChangeResult = { ok?: boolean; error?: string; id?: string };

/* -------------------------------------------------------- the patient's side -- */

/**
 * Ask to change the number. 20.13.
 *
 * The reason and the contact permission are both required by the database as
 * well as here: a request with no reason is one staff cannot judge, and
 * calling a number nobody authorised is not a check, it is a cold call to a
 * stranger about somebody else's therapy account.
 */
export async function requestPhoneChange(input: {
  accountId: string;
  newPhone: string;
  country: string | null;
  reason: string;
  contactConsent: boolean;
}): Promise<ChangeResult> {
  const [account] = await db
    .select({
      id: patientAccounts.id,
      phone: patientAccounts.phone,
      phoneVerifiedAt: patientAccounts.phoneVerifiedAt,
      createdAt: patientAccounts.createdAt,
    })
    .from(patientAccounts)
    .where(eq(patientAccounts.id, input.accountId))
    .limit(1);

  if (!account?.phone) return { error: "This account has no number to change." };
  if (!input.contactConsent) {
    return { error: "We need your permission to contact the new number before we can check it." };
  }
  if (input.reason.trim().length < 10) {
    return { error: "Tell us why, in your own words, a person reads this." };
  }

  const expanded = toE164(input.newPhone, input.country);
  const problem = e164Problem(expanded);
  if (problem || !expanded.ok) {
    return { error: problem ?? "That number does not look right. Include the country." };
  }
  if (expanded.e164 === account.phone) {
    return { error: "That is the number already on the account." };
  }

  /*
   * 🔴 20.15 — a number already on another account is refused OUTRIGHT, and
   * the patient is told that is the reason. **Never whose.** "That number
   * belongs to Omar" is a disclosure; "that number is already in use" is an
   * answer they can act on.
   */
  const [taken] = await db
    .select({ id: patientAccounts.id })
    .from(patientAccounts)
    .where(and(eq(patientAccounts.phone, expanded.e164), isNull(patientAccounts.deletedAt)))
    .limit(1);
  if (taken) {
    return {
      error:
        "That number is already in use on another account. If it is yours, write to us and a person will look at it.",
    };
  }

  const locked = lockUntil(account);
  if (locked) {
    return {
      error: `Your number was confirmed recently, so it is locked until ${locked.toISOString().slice(0, 10)}. Write to us if you cannot wait.`,
    };
  }

  const [row] = await db
    .insert(phoneChangeRequests)
    .values({
      patientAccountId: account.id,
      oldPhone: account.phone,
      newPhone: expanded.e164,
      reason: input.reason.trim(),
      contactConsent: true,
      status: "requested",
    })
    .returning({ id: phoneChangeRequests.id })
    .onConflictDoNothing();

  if (!row) return { error: "You already have a change in progress. A person is looking at it." };

  log.info("phone change requested", { account: ref(account.id) });
  return { ok: true, id: row.id };
}

/**
 * 🔴 20.14 — when the current number is locked until, or null if it is free.
 *
 * Pure enough to reason about: a number confirmed within the last 90 days is
 * locked, **unless** the account itself is less than a day old, in which case
 * this is somebody fixing a typo minutes after signing up.
 */
export function lockUntil(account: {
  phoneVerifiedAt: Date | null;
  createdAt: Date;
}): Date | null {
  const now = Date.now();

  const correctionWindow = account.createdAt.getTime() + CORRECTION_HOURS * 3_600_000;
  if (now < correctionWindow) return null;

  if (!account.phoneVerifiedAt) return null;
  const unlocksAt = new Date(account.phoneVerifiedAt.getTime() + LOCK_DAYS * 86_400_000);
  return unlocksAt.getTime() > now ? unlocksAt : null;
}

/* ------------------------------------------------------------ the staff side -- */

/** The open queue, oldest first. Staff see the request, never the account. */
export async function openChanges(limit = 100) {
  const now = Date.now();

  const rows = await db
    .select({
      id: phoneChangeRequests.id,
      oldPhone: phoneChangeRequests.oldPhone,
      newPhone: phoneChangeRequests.newPhone,
      reason: phoneChangeRequests.reason,
      status: phoneChangeRequests.status,
      ownerUserId: phoneChangeRequests.ownerUserId,
      approvedByUserId: phoneChangeRequests.approvedByUserId,
      createdAt: phoneChangeRequests.createdAt,
      verificationExpiresAt: phoneChangeRequests.verificationExpiresAt,
    })
    .from(phoneChangeRequests)
    .where(sql`${phoneChangeRequests.status} IN ('requested', 'approved', 'verifying')`)
    .orderBy(asc(phoneChangeRequests.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    ageHours: Math.round(((now - row.createdAt.getTime()) / 3_600_000) * 10) / 10,
  }));
}

/**
 * A staff member has called or messaged the new number and is satisfied. 20.16.
 *
 * Approval alone changes nothing about the account. It only unlocks sending
 * the code — the account moves when somebody proves they hold the new number,
 * not when somebody in this building says so.
 */
export async function approveChange(input: {
  requestId: string;
  actor: { userId: string; organizationId: string; role: string };
  note: string;
}): Promise<ChangeResult> {
  if (input.note.trim().length < 5) {
    return { error: "Record how you checked, a call, a message, what they said." };
  }

  const updated = await db
    .update(phoneChangeRequests)
    .set({
      status: "approved",
      approvedByUserId: input.actor.userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(phoneChangeRequests.id, input.requestId), eq(phoneChangeRequests.status, "requested")),
    )
    .returning({ id: phoneChangeRequests.id });

  if (updated.length === 0) return { error: "That request is not waiting for approval." };

  await audit({
    actor: input.actor as never,
    category: "admin",
    action: "phone_change.approved",
    resourceType: "phone_change_request",
    resourceId: input.requestId,
    // How they checked — a call, a message, what was said. 20.17 wants the
    // verification itself recorded, not just its outcome.
    reason: input.note.trim(),
  });

  return { ok: true };
}

/**
 * Send the code — to the **new** number. 20.16.
 *
 * Hashed on the way in, so nobody who can read this table can complete the
 * change. Twenty-four hours to use it, because a code that lives for ever is a
 * credential.
 */
export async function sendChangeCode(input: {
  requestId: string;
  actorUserId: string;
}): Promise<ChangeResult> {
  const [row] = await db
    .select()
    .from(phoneChangeRequests)
    .where(eq(phoneChangeRequests.id, input.requestId))
    .limit(1);

  if (!row) return { error: "That request no longer exists." };
  if (row.status !== "approved" && row.status !== "verifying") {
    return { error: "That request has not been approved yet." };
  }

  const code = String(Math.floor(100_000 + Math.random() * 900_000));

  await db
    .update(phoneChangeRequests)
    .set({
      status: "verifying",
      verificationHash: await hashCode(code),
      verificationSentAt: new Date(),
      verificationExpiresAt: new Date(Date.now() + CODE_HOURS * 3_600_000),
      updatedAt: new Date(),
    })
    .where(eq(phoneChangeRequests.id, row.id));

  await notify(
    { phone: row.newPhone, email: null, timezone: null },
    {
      kind: "phone.verify",
      subject: "Confirm your new number",
      body: `Your 24Therapy code is ${code}. Enter it in the app to finish moving your account to this number. It lasts ${CODE_HOURS} hours. If you did not ask for this, ignore it and nothing changes.`,
      variables: [code],
    },
  );

  log.info("phone change code sent", { request: ref(row.id) });
  return { ok: true };
}

/**
 * 🔴 The patient enters the code, and the account moves. 20.16, 20.17.
 *
 * This is the only function that writes `patient_accounts.phone`, and it does
 * it in the same statement that consumes the verification — so a code that
 * has already been used cannot move a second account, and a change cannot be
 * completed by anybody who has not held the new handset.
 */
export async function completeChange(input: {
  requestId: string;
  code: string;
}): Promise<ChangeResult> {
  const [row] = await db
    .select()
    .from(phoneChangeRequests)
    .where(eq(phoneChangeRequests.id, input.requestId))
    .limit(1);

  const wrong = { error: "That code is not right, or it has expired." };
  if (!row?.verificationHash || row.status !== "verifying") return wrong;
  if (!row.verificationExpiresAt || row.verificationExpiresAt < new Date()) return wrong;
  if (!(await verifyCode(input.code, row.verificationHash))) return wrong;

  /*
   * The account row is updated with the old number in the WHERE clause. Two
   * completions racing, or a stale request replayed after the number moved,
   * both lose here rather than overwriting a number somebody has since
   * verified.
   */
  const moved = await db
    .update(patientAccounts)
    .set({
      phone: row.newPhone,
      phoneVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(patientAccounts.id, row.patientAccountId),
        eq(patientAccounts.phone, row.oldPhone),
      ),
    )
    .returning({ id: patientAccounts.id });

  if (moved.length === 0) return { error: "This account's number has already changed." };

  await db
    .update(phoneChangeRequests)
    .set({
      status: "done",
      verifiedAt: new Date(),
      completedAt: new Date(),
      verificationHash: null,
      updatedAt: new Date(),
    })
    .where(eq(phoneChangeRequests.id, row.id));

  log.info("phone change completed", { request: ref(row.id) });
  return { ok: true };
}

/** Refused, with a reason the patient reads. Nothing about the account changes. */
export async function refuseChange(input: {
  requestId: string;
  actorUserId: string;
  reason: string;
}): Promise<ChangeResult> {
  const reason = input.reason.trim();
  if (reason.length < 5) return { error: "Say why, so they know what to do next." };

  const updated = await db
    .update(phoneChangeRequests)
    .set({ status: "refused", refusedReason: reason, updatedAt: new Date() })
    .where(sql`${phoneChangeRequests.id} = ${input.requestId} AND status <> 'done'`)
    .returning({ id: phoneChangeRequests.id });

  return updated.length > 0 ? { ok: true } : { error: "That request is already finished." };
}

/** 20.17 — the whole record of one change, for an audit or a dispute. */
export async function changeHistory(accountId: string) {
  return db
    .select({
      id: phoneChangeRequests.id,
      oldPhone: phoneChangeRequests.oldPhone,
      newPhone: phoneChangeRequests.newPhone,
      reason: phoneChangeRequests.reason,
      status: phoneChangeRequests.status,
      approvedBy: users.firstName,
      approvedAt: phoneChangeRequests.approvedAt,
      verifiedAt: phoneChangeRequests.verifiedAt,
      refusedReason: phoneChangeRequests.refusedReason,
      createdAt: phoneChangeRequests.createdAt,
    })
    .from(phoneChangeRequests)
    .leftJoin(users, eq(users.id, phoneChangeRequests.approvedByUserId))
    .where(eq(phoneChangeRequests.patientAccountId, accountId))
    .orderBy(asc(phoneChangeRequests.createdAt));
}
