import "server-only";

import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";

import { dbFor } from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patientAccounts, patientAuthTokens, RESET_CODE_ATTEMPTS } from "@/lib/db/schema";
import { normaliseEmail } from "@/lib/data/people";
import { wordsFor } from "@/lib/i18n/message-words";
import { log, ref } from "@/lib/logger";
import { notify } from "@/lib/notify";

/*
 * ⚠️ 30.1: NOT ROUTED YET, and counted rather than hidden, like every other
 * module in `lib/patient-auth`.
 */
const db = dbFor(pinnedToDefaultRegion("lib/patient-auth/email.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));

/**
 * 🔴 W2-P03: an address a patient can add, proved by a code sent to it.
 *
 * `patient_accounts.email` was written by nothing after signup, and signup had
 * no field for it, so the record export, email sign-in and the claim code (all
 * of which need an address) were closed to everybody who joined by phone.
 *
 * ## Why the address is only written once the code comes back
 *
 * The address is a unique handle. Writing it first would let anybody park a
 * stranger's address on their own account and lock the owner out of signing
 * up with it. So the code is bound to the address instead: the token stores
 * `hash(code:address)`, the form sends both back, and the column is written
 * only when they match. No migration, and no pending address stored anywhere.
 *
 * Same table, same purpose and same attempt ceiling as the claim's handle code
 * (0053, 0055), because a second implementation of a bounded code is a second
 * place to get the bound wrong. A claim code cannot finish this, nor this one a
 * claim: their hashes cover different strings.
 */

const CODE_MINUTES = 15;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const bound = (code: string, email: string) => hash(`${code}:${email}`);

/** A shape check only. Whether the address is theirs is what the code proves. */
export function emailProblem(raw: string): string | null {
  const email = normaliseEmail(raw);
  if (!email || email.length > 200 || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
    return "That does not look like an email address.";
  }
  return null;
}

/**
 * Send a code to the address. Returns the code to the caller for the verifier
 * only; the action never passes it on.
 *
 * An address already on another live account is not told so, and gets no
 * code: "that address is registered" tells anybody with a list of addresses
 * which of them are in therapy. The person simply never receives one.
 */
export async function issueEmailCode(
  accountId: string,
  raw: string,
): Promise<{ ok: true; code: string | null } | { ok: false; error: string }> {
  const problem = emailProblem(raw);
  if (problem) return { ok: false, error: problem };
  const email = normaliseEmail(raw)!;

  const [taken] = await db
    .select({ id: patientAccounts.id })
    .from(patientAccounts)
    .where(
      and(
        eq(patientAccounts.email, email),
        isNull(patientAccounts.deletedAt),
        ne(patientAccounts.id, accountId),
      ),
    )
    .limit(1);
  if (taken) return { ok: true, code: null };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(patientAuthTokens).values({
    patientAccountId: accountId,
    purpose: "handle_verify",
    tokenHash: bound(code, email),
    channel: "email",
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
  });

  /* 🔴 Ruling 8: in the language the account holder chose. */
  const [holder] = await db
    .select({ personId: patientAccounts.personId })
    .from(patientAccounts)
    .where(eq(patientAccounts.id, accountId))
    .limit(1);
  const { t, locale } = await wordsFor(holder?.personId ? { personId: holder.personId } : null);

  /* To this address only: a code for an address proves nothing if it lands on a phone. */
  await notify(
    { email, phone: null, locale },
    {
      kind: "claim.code",
      subject: t("pmsg.code.subject"),
      body: t("pmsg.code.addEmail", { code, minutes: CODE_MINUTES }),
      variables: [code],
    },
  );

  log.info("email code requested", { account: ref(accountId) });
  return { ok: true, code };
}

/** The code and the address together, or nothing is written. */
export async function confirmEmailCode(
  accountId: string,
  raw: string,
  rawCode: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const email = normaliseEmail(raw);
  const code = rawCode.replace(/\D/g, "");
  const wrong = { ok: false as const, error: "That code is wrong or has expired. Ask for a new one." };
  if (!email || code.length !== 6) return wrong;

  const [row] = await db
    .select()
    .from(patientAuthTokens)
    .where(
      and(
        eq(patientAuthTokens.patientAccountId, accountId),
        eq(patientAuthTokens.purpose, "handle_verify"),
        eq(patientAuthTokens.channel, "email"),
        isNull(patientAuthTokens.usedAt),
        gt(patientAuthTokens.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(patientAuthTokens.createdAt))
    .limit(1);
  if (!row) return wrong;

  if (row.tokenHash !== bound(code, email)) {
    const spent = row.attempts + 1;
    await db
      .update(patientAuthTokens)
      .set(spent > RESET_CODE_ATTEMPTS ? { usedAt: new Date() } : { attempts: spent })
      .where(eq(patientAuthTokens.id, row.id));
    return wrong;
  }

  const now = new Date();
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(patientAuthTokens)
        .set({ usedAt: now })
        .where(eq(patientAuthTokens.id, row.id));
      await tx
        .update(patientAccounts)
        .set({ email, emailVerifiedAt: now, updatedAt: now })
        .where(eq(patientAccounts.id, accountId));
    });
  } catch {
    /* Taken by another account since the code went out. Same sentence, no oracle. */
    return wrong;
  }

  log.info("email added", { account: ref(accountId) });
  return { ok: true, email };
}
