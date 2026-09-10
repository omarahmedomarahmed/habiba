"use server";

import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { patientAccounts, patientAuthTokens, RESET_CODE_ATTEMPTS } from "@/lib/db/schema";
import { notify } from "@/lib/notify";
import { whatsappConfigured } from "@/lib/notify/whatsapp";
import { callerKey, consume } from "@/lib/rate-limit";
import { log, ref } from "@/lib/logger";

import { requirePatient } from "./guard";

/**
 * Proving a handle. PLAN.md 25.14, 25.15, C121.
 *
 * ## 🔴 What this is for, and what went wrong without it
 *
 * §3b's rule is that a phone number proves a number, never a person, and §6's
 * is that **nothing about any record is shown before the handle is proven**.
 * `openChallenges` obeyed that from sprint 13: it returns nothing at all
 * unless `phone_verified_at` or `email_verified_at` is set.
 *
 * The screen a patient actually lands on did not. `/patient/claim` reads
 * `suggestionsFor`, which matched on whatever number was typed at signup and
 * showed a redacted name and the sentence *"a therapist keeps notes for
 * somebody with your phone number"*. Type a stranger's number, sign up, and
 * learn that they are in therapy and roughly what their name is. Two initials
 * are "something about a record".
 *
 * So there is a step before the claim screen says anything: a six-digit code
 * to the handle, and only then does the product admit whether anything exists.
 *
 * ## Why it is the password-reset machinery
 *
 * Because it is the same mechanic, and a second implementation of "issue a
 * code, hash it, expire it, bound the guesses" is a second place to get the
 * bounding wrong. Same table, one more `purpose`, same database-enforced
 * ceiling on attempts (0053, widened by 0055).
 *
 * ⚠️ **Incomplete until Meta approves the WhatsApp template.** A patient with
 * no email cannot receive this code today, exactly as with the reset, and the
 * screen says so rather than telling them to wait for a message.
 */

export type HandleState = {
  sent?: boolean;
  verified?: boolean;
  /** ⚠️ The channel is not switched on, so the page can say so. */
  channelDown?: boolean;
  channel?: "whatsapp" | "email";
  error?: string;
};

const CODE_MINUTES = 15;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Six digits, from the CSPRNG. */
function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Step one: send a code to the handle on this account. */
export async function requestHandleCode(): Promise<HandleState> {
  const actor = await requirePatient();

  const verdict = await consume(await callerKey("patient:handle"), 5, 15 * 60);
  if (!verdict.allowed) {
    const minutes = Math.max(1, Math.ceil(verdict.retryAfter / 60));
    return {
      error: `Too many codes asked for from this connection. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const [account] = await db
    .select({
      id: patientAccounts.id,
      phone: patientAccounts.phone,
      email: patientAccounts.email,
      phoneVerifiedAt: patientAccounts.phoneVerifiedAt,
      emailVerifiedAt: patientAccounts.emailVerifiedAt,
    })
    .from(patientAccounts)
    .where(eq(patientAccounts.id, actor.accountId))
    .limit(1);

  if (!account) return { error: "We could not find your account." };
  if (account.phoneVerifiedAt || account.emailVerifiedAt) return { verified: true };

  const code = newCode();
  const channel = account.phone ? ("whatsapp" as const) : ("email" as const);

  await db.insert(patientAuthTokens).values({
    patientAccountId: account.id,
    purpose: "handle_verify",
    tokenHash: hash(code),
    channel,
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
  });

  await notify(
    { email: account.email, phone: account.phone },
    {
      kind: "claim.code",
      subject: "Your 24Therapy code",
      body: `${code} is your code. It expires in ${CODE_MINUTES} minutes. If you did not ask for it, ignore this message.`,
      variables: [code],
    },
  );

  log.info("handle verification requested", { account: ref(account.id), channel });

  return { sent: true, channel, channelDown: channel === "whatsapp" && !whatsappConfigured() };
}

/** Step two: the code. Proving the handle is what unlocks everything else. */
export async function confirmHandleCode(
  _prev: HandleState,
  formData: FormData,
): Promise<HandleState> {
  const actor = await requirePatient();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");

  const verdict = await consume(await callerKey("patient:handle-confirm"), 10, 15 * 60);
  if (!verdict.allowed) {
    const minutes = Math.max(1, Math.ceil(verdict.retryAfter / 60));
    return {
      error: `Too many attempts from this connection. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const [row] = await db
    .select()
    .from(patientAuthTokens)
    .where(
      and(
        eq(patientAuthTokens.patientAccountId, actor.accountId),
        eq(patientAuthTokens.purpose, "handle_verify"),
        isNull(patientAuthTokens.usedAt),
        gt(patientAuthTokens.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(patientAuthTokens.createdAt))
    .limit(1);

  const wrong = { error: "That code is wrong or has expired. Ask for a new one." };
  if (!row) return wrong;

  if (row.tokenHash !== hash(code)) {
    const spent = row.attempts + 1;
    if (spent > RESET_CODE_ATTEMPTS) {
      await db
        .update(patientAuthTokens)
        .set({ usedAt: new Date() })
        .where(eq(patientAuthTokens.id, row.id));
      return { error: "Too many wrong codes. Ask for a new one." };
    }
    await db
      .update(patientAuthTokens)
      .set({ attempts: spent })
      .where(eq(patientAuthTokens.id, row.id));
    return wrong;
  }

  /*
   * The channel the code went out on is the handle it proves. A code that
   * arrived by email proves the address, not the number, and marking both
   * would be exactly the shortcut §3b exists to prevent.
   */
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(patientAccounts)
      .set(
        row.channel === "whatsapp"
          ? { phoneVerifiedAt: now, updatedAt: now }
          : { emailVerifiedAt: now, updatedAt: now },
      )
      .where(eq(patientAccounts.id, actor.accountId));

    await tx
      .update(patientAuthTokens)
      .set({ usedAt: now })
      .where(eq(patientAuthTokens.id, row.id));
  });

  log.info("handle verified", { account: ref(actor.accountId), channel: row.channel });
  return { verified: true, channel: row.channel };
}
