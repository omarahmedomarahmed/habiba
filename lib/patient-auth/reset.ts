"use server";

import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";

import { hashPassword, validatePassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patientAccounts, patientAuthTokens, RESET_CODE_ATTEMPTS } from "@/lib/db/schema";
import { normaliseEmail } from "@/lib/data/people";
import { notify } from "@/lib/notify";
import { whatsappConfigured } from "@/lib/notify/whatsapp";
import { toE164 } from "@/lib/phone/e164";
import { callerKey, consume } from "@/lib/rate-limit";
import { log, ref } from "@/lib/logger";

import { revokeAllPatientSessions } from "./session";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/patient-auth/reset.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * Getting a patient back into their own record. PLAN.md 21R.4, C94, §3b.
 *
 * ## 🔴 There was no way back in
 *
 * Not a broken reset — none at all. `/patient/login` and `/patient/signup`
 * existed and linked to each other, and a patient who forgot their password had
 * no route to their notes, their homework, or the list of who can read their
 * record. Every reset in the product hung off `users`, the clinician table.
 *
 * ## The code goes over WhatsApp, because most of them have no email
 *
 * §3b: the phone is the handle that is never missing; the address is a real
 * second way in *when there is one*. A reset that emails a link is a reset most
 * patients in this database cannot use — 56 of 66 had no address (C43). So the
 * default channel is WhatsApp and the code is six digits, with email sent as
 * well when there is an address, never instead (13R.12).
 *
 * ⚠️ **Incomplete until Meta approves the template.** `password_reset_code` is
 * an *authentication* template on Meta's stricter track, and until it is
 * approved `sendWhatsapp` refuses and nothing arrives. The page says so, in
 * those words, rather than showing "check your phone" to somebody who is going
 * to stand there waiting — see `PatientForgotPasswordForm`.
 *
 * ## What is deliberately identical on every path
 *
 * The answer. A handle with no account, a handle with an account, a channel
 * that could not deliver — all return the same sentence, because the difference
 * between them is an oracle for "does this number have a therapy account", which
 * is a disclosure this product cannot make.
 */

export type PatientResetState = {
  /** The neutral acknowledgement. Never says whether an account was found. */
  sent?: boolean;
  /** ⚠️ True when the code could not go anywhere, so the page can say so. */
  channelDown?: boolean;
  error?: string;
};

/** Long enough to read a message and type it, short enough to be worth little. */
const CODE_MINUTES = 15;

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Six digits, from the CSPRNG. `Math.random()` is not a code. */
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

/** Step one: ask for a code. */
export async function requestPatientReset(
  _prev: PatientResetState,
  formData: FormData,
): Promise<PatientResetState> {
  const handle = String(formData.get("handle") ?? "").trim();
  const country = String(formData.get("handleCountry") ?? "") || null;

  if (!handle) return { error: "Enter the phone number or email you sign in with." };

  /*
   * Rate-limited per caller, because this endpoint sends messages to strangers'
   * phones. Without it, one script turns 24Therapy into a way to make somebody
   * else's phone buzz all night.
   */
  const verdict = await consume(await callerKey("patient:reset"), 5, 15 * 60);
  if (!verdict.allowed) {
    const minutes = Math.max(1, Math.ceil(verdict.retryAfter / 60));
    return {
      error: `Too many requests from this connection. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const account = await findAccount(handle, country);

  /*
   * ⚠️ The one thing the answer does depend on: whether the channel is up at
   * all. That is a fact about *us*, not about whether this person has an
   * account, so saying it discloses nothing — and not saying it leaves somebody
   * waiting for a message that was never going to arrive.
   */
  const channelDown = !whatsappConfigured();

  if (account) {
    const code = newCode();
    const channel = account.phone ? "whatsapp" : "email";

    await db.insert(patientAuthTokens).values({
      patientAccountId: account.id,
      purpose: "password_reset",
      tokenHash: hash(code),
      channel,
      expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
    });

    const delivery = await notify(
      { email: account.email, phone: account.phone },
      {
        kind: "password.reset_code",
        subject: "Your 24Therapy code",
        body: `${code} is your code to set a new password. It expires in ${CODE_MINUTES} minutes. If you did not ask for it, ignore this message.`,
        variables: [code],
      },
    );

    log.info("patient reset requested", {
      account: ref(account.id),
      channel,
      delivered: delivery.channels.join(",") || "none",
    });
  }

  return { sent: true, channelDown };
}

/** Step two: the code, and a new password. */
export async function completePatientReset(
  _prev: PatientResetState,
  formData: FormData,
): Promise<PatientResetState> {
  const handle = String(formData.get("handle") ?? "").trim();
  const country = String(formData.get("handleCountry") ?? "") || null;
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const password = String(formData.get("password") ?? "");

  const problem = validatePassword(password);
  if (problem) return { error: problem };

  const verdict = await consume(await callerKey("patient:reset-confirm"), 10, 15 * 60);
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
        eq(patientAuthTokens.purpose, "password_reset"),
        isNull(patientAuthTokens.usedAt),
        gt(patientAuthTokens.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(patientAuthTokens.createdAt))
    .limit(1);

  if (!row) return wrong;

  if (row.tokenHash !== hash(code)) {
    /*
     * A wrong guess costs one of the five the database will allow. When they
     * run out the UPDATE itself is refused by `patient_auth_tokens_attempts_
     * bounded`, which is the point of putting the ceiling there: the budget
     * cannot be spent past its end by a caller who forgot to check.
     */
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

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx
      .update(patientAccounts)
      .set({ passwordHash })
      .where(eq(patientAccounts.id, account.id));
    await tx
      .update(patientAuthTokens)
      .set({ usedAt: new Date() })
      .where(eq(patientAuthTokens.id, row.id));
  });

  /*
   * Every other session goes. Somebody resetting a password may be doing it
   * because another person has their account — leaving that session alive is
   * leaving the door they came through open.
   */
  await revokeAllPatientSessions(account.id);

  await audit({
    actor: null,
    category: "auth",
    action: "patient.password.reset",
    resourceType: "patient_account",
    resourceId: account.id,
    reason: `code over ${row.channel}`,
  });

  return { sent: true };
}
