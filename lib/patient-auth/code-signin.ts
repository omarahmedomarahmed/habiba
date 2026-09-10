"use server";

import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { patientAccounts, patientAuthTokens, RESET_CODE_ATTEMPTS } from "@/lib/db/schema";
import { normaliseEmail } from "@/lib/data/people";
import { notify } from "@/lib/notify";
import { whatsappConfigured } from "@/lib/notify/whatsapp";
import { toE164 } from "@/lib/phone/e164";
import { callerKey, consume } from "@/lib/rate-limit";
import { log, ref } from "@/lib/logger";

import { createPatientSession } from "./session";

/**
 * Signing in with a code. PLAN.md 25.11-25.13, C119.
 *
 * ## 🔴 Why a password cannot be the only way in
 *
 * 13R made a password mandatory on a patient account. §3b then made the phone
 * the handle that is never missing and the email a real second way in, and the
 * two do not fit: a guest who joined a session on a phone number has no
 * password and never chose one. Asking them to invent one at the end of a
 * session, while the therapist waits, is how a record nobody can get back into
 * gets created.
 *
 * A code to a handle is also the stronger factor. A password typed once under
 * time pressure is forgotten by the following week; a number is not.
 *
 * ## What this deliberately does not tell anybody
 *
 * Whether the handle exists. Every path returns the same sentence, because the
 * difference between "no account" and "code sent" is an oracle for "is this
 * number in therapy", which is the disclosure this product cannot make (§6,
 * C121).
 *
 * ⚠️ **Incomplete until Meta approves the WhatsApp template**: a patient with
 * no email cannot receive the code today. The page says so rather than
 * leaving somebody waiting for a message that is not coming.
 */

export type CodeSignInState = {
  /** The neutral acknowledgement. Never says whether an account was found. */
  sent?: boolean;
  channelDown?: boolean;
  error?: string;
};

const CODE_MINUTES = 15;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function findAccount(handle: string, country: string | null) {
  const asPhone = toE164(handle, country);
  const asEmail = handle.includes("@") ? normaliseEmail(handle) : null;

  const [account] = await db
    .select({
      id: patientAccounts.id,
      email: patientAccounts.email,
      phone: patientAccounts.phone,
    })
    .from(patientAccounts)
    .where(
      and(
        isNull(patientAccounts.deletedAt),
        or(
          asEmail ? eq(patientAccounts.email, asEmail) : sql`false`,
          asPhone.ok ? eq(patientAccounts.phone, asPhone.e164) : sql`false`,
        ),
      ),
    )
    .limit(1);

  return account ?? null;
}

/** Step one: a code to whichever handle they typed. */
export async function requestSignInCode(
  _prev: CodeSignInState,
  formData: FormData,
): Promise<CodeSignInState> {
  const handle = String(formData.get("handle") ?? "").trim();
  const country = String(formData.get("handleCountry") ?? "") || null;

  if (!handle) return { error: "Enter the phone number or email you use here." };

  const verdict = await consume(await callerKey("patient:code"), 5, 15 * 60);
  if (!verdict.allowed) {
    const minutes = Math.max(1, Math.ceil(verdict.retryAfter / 60));
    return {
      error: `Too many codes asked for from this connection. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const account = await findAccount(handle, country);
  const channelDown = !whatsappConfigured();

  if (account) {
    const code = newCode();
    const channel = handle.includes("@") ? ("email" as const) : ("whatsapp" as const);

    await db.insert(patientAuthTokens).values({
      patientAccountId: account.id,
      purpose: "handle_verify",
      tokenHash: hash(code),
      channel,
      expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
    });

    /*
     * Sent to the handle they typed, never to the other one. A code for an
     * email typed into this box must not arrive on a phone the account happens
     * to carry: that is how somebody with a stolen address reaches a number.
     */
    await notify(
      channel === "email" ? { email: account.email, phone: null } : { email: null, phone: account.phone },
      {
        kind: "claim.code",
        subject: "Your 24Therapy code",
        body: `${code} is your code to sign in. It expires in ${CODE_MINUTES} minutes. If you did not ask for it, ignore this message.`,
        variables: [code],
      },
    );

    log.info("sign-in code requested", { account: ref(account.id), channel });
  }

  return { sent: true, channelDown };
}

/** Step two: the code is the sign-in, and it proves the handle on the way. */
export async function signInWithCode(
  _prev: CodeSignInState,
  formData: FormData,
): Promise<CodeSignInState> {
  const handle = String(formData.get("handle") ?? "").trim();
  const country = String(formData.get("handleCountry") ?? "") || null;
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");

  const verdict = await consume(await callerKey("patient:code-confirm"), 10, 15 * 60);
  if (!verdict.allowed) {
    const minutes = Math.max(1, Math.ceil(verdict.retryAfter / 60));
    return {
      error: `Too many attempts from this connection. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const account = await findAccount(handle, country);
  const wrong = { error: "That code is wrong or has expired. Ask for a new one." };
  if (!account) return wrong;

  const [row] = await db
    .select()
    .from(patientAuthTokens)
    .where(
      and(
        eq(patientAuthTokens.patientAccountId, account.id),
        eq(patientAuthTokens.purpose, "handle_verify"),
        isNull(patientAuthTokens.usedAt),
        gt(patientAuthTokens.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(patientAuthTokens.createdAt))
    .limit(1);

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
   * 🔴 The code proves the handle it went to, and signing in is what happens
   * next rather than a separate step. One arrival, one proof: a code sent to
   * the number marks the number, never the address.
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
      .where(eq(patientAccounts.id, account.id));

    await tx
      .update(patientAuthTokens)
      .set({ usedAt: now })
      .where(eq(patientAuthTokens.id, row.id));
  });

  await createPatientSession(account.id);
  log.info("patient signed in with a code", { account: ref(account.id), channel: row.channel });

  return { sent: true };
}
