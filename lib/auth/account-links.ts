import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { hashPassword, validatePassword } from "@/lib/auth/password";
import { controlDb } from "@/lib/db";
import {
  accountLinks,
  clinicManagers,
  organizations,
  partnerUsers,
  partners,
  sponsorUsers,
  sponsors,
  users,
  type AccountAudience,
} from "@/lib/db/schema";
import { SPONSOR_PASSWORD_MIN } from "@/lib/data/sponsor-users";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";
import { PARTNER_PASSWORD_MIN } from "@/lib/partner/team";
import {
  CLINIC_SIGN_IN,
  PARTNER_SIGN_IN,
  SPONSOR_SIGN_IN,
  STAFF_SIGN_IN,
} from "@/lib/routing";

const db = controlDb;

/**
 * 🔴 W2-A06: an account is invited by link. Nobody types a customer's password.
 * Migration 0141.
 *
 * The console created back office, company, clinic and partner accounts with
 * a password the operator typed in clear, usually read out on a call. The
 * operator then knew it, and nothing made the customer change it. Now the
 * account is created with no usable password and its owner is emailed a link
 * that sets one.
 *
 * ## One module for every portal, on purpose
 *
 * The four kinds of account live in four tables. This is the one place that
 * knows how to set a password on each from a link, so a portal's own team
 * page (clinic, company and partner self-service, built beside this) invites
 * and resets through `mintAccountLink` rather than growing a fifth copy of
 * the rule. `/welcome/[token]` is the one page that redeems a link.
 *
 * The token is 32 random bytes, stored as its SHA-256 like `auth_tokens`, used
 * once, and a new link for the same account retires any unused one.
 */

const INVITE_DAYS = 7;
const RESET_HOURS = 1;

/** Where each kind of account signs in once its password is set. */
export const SIGN_IN_FOR: Record<AccountAudience, string> = {
  staff: STAFF_SIGN_IN,
  sponsor: SPONSOR_SIGN_IN,
  clinic: CLINIC_SIGN_IN,
  partner: PARTNER_SIGN_IN,
};

/**
 * 🔴 B29 / B48 — THE PORTAL'S OWN FLOOR, not the clinician one.
 *
 * `/welcome` checked every link against `validatePassword`'s ten characters,
 * so a company admin or a developer invited by link chose a password their
 * own portal would refuse on the next change, under a hint that contradicted
 * the team page ("twelve characters or more"). Each portal's number is read
 * from where that portal enforces it.
 */
export const PASSWORD_MIN_FOR: Record<AccountAudience, number> = {
  staff: 10,
  clinic: 10,
  sponsor: SPONSOR_PASSWORD_MIN,
  partner: PARTNER_PASSWORD_MIN,
};

function hashOf(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Mint a link and return its URL. The caller emails it; it is never shown to an operator. */
export async function mintAccountLink(input: {
  audience: AccountAudience;
  accountId: string;
  purpose?: "invite" | "reset";
  createdByUserId: string | null;
}): Promise<string> {
  const purpose = input.purpose ?? "invite";
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const ttl = purpose === "invite" ? INVITE_DAYS * 86_400_000 : RESET_HOURS * 3_600_000;

  await db.transaction(async (tx) => {
    // One live link per account: an older unused one stops working.
    await tx
      .update(accountLinks)
      .set({ usedAt: now })
      .where(
        and(
          eq(accountLinks.audience, input.audience),
          eq(accountLinks.accountId, input.accountId),
          isNull(accountLinks.usedAt),
        ),
      );
    await tx.insert(accountLinks).values({
      audience: input.audience,
      accountId: input.accountId,
      purpose,
      tokenHash: hashOf(token),
      expiresAt: new Date(now.getTime() + ttl),
      createdByUserId: input.createdByUserId,
    });
  });

  log.info("account link minted", { account: ref(input.accountId), audience: input.audience, purpose });
  return `${env.appUrl}/welcome/${token}`;
}

/** The live link a token names, or null. Read-only, for the page that shows the form. */
export async function peekAccountLink(
  token: string,
): Promise<{ audience: AccountAudience; accountId: string; purpose: "invite" | "reset" } | null> {
  if (!token || token.length > 200) return null;
  const [row] = await db
    .select({
      audience: accountLinks.audience,
      accountId: accountLinks.accountId,
      purpose: accountLinks.purpose,
    })
    .from(accountLinks)
    .where(
      and(
        eq(accountLinks.tokenHash, hashOf(token)),
        isNull(accountLinks.usedAt),
        gt(accountLinks.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * 🔴 B43 — WHY A LINK THAT NO LONGER WORKS STOPPED WORKING, for the page that
 * says so. Reopening a spent invitation showed "The link may be old, or the
 * page has moved" with no heading, and a manager who had just set a password
 * could not tell whether it had taken. Only the portal and the reason come
 * back, never the account: the token is a capability, and a dead one grants
 * nothing but a sentence and the right door.
 */
export async function deadAccountLink(
  token: string,
): Promise<{ reason: "used" | "expired"; audience: AccountAudience } | null> {
  if (!token || token.length > 200) return null;
  const [row] = await db
    .select({ audience: accountLinks.audience, usedAt: accountLinks.usedAt, expiresAt: accountLinks.expiresAt })
    .from(accountLinks)
    .where(eq(accountLinks.tokenHash, hashOf(token)))
    .limit(1);
  if (!row) return null;
  if (row.usedAt) return { reason: "used", audience: row.audience };
  if (row.expiresAt.getTime() <= Date.now()) return { reason: "expired", audience: row.audience };
  return null;
}

/**
 * Set the password a link was minted for, once. The link is spent in the same
 * transaction as the password is written, and the spend is guarded on
 * `used_at IS NULL`, so two submissions of one link set it once.
 */
export async function redeemAccountLink(
  token: string,
  password: string,
): Promise<
  | { ok: true; signIn: string; audience: AccountAudience; accountId: string }
  | { error: "weak"; minimum: number }
  | { error: "invalid" }
> {
  /*
   * 🔴 B29 / B48: the floor is the portal's, so the link is read first to learn
   * which portal. Only a read: the spend below is still the one guarded write.
   */
  const live = await peekAccountLink(token);
  if (!live) return { error: "invalid" };
  const minimum = PASSWORD_MIN_FOR[live.audience];
  if (validatePassword(password) || password.length < minimum) return { error: "weak", minimum };

  const passwordHash = await hashPassword(password);
  const now = new Date();

  const spent = await db.transaction(async (tx) => {
    const [link] = await tx
      .update(accountLinks)
      .set({ usedAt: now })
      .where(
        and(
          eq(accountLinks.tokenHash, hashOf(token)),
          isNull(accountLinks.usedAt),
          gt(accountLinks.expiresAt, now),
        ),
      )
      .returning({ audience: accountLinks.audience, accountId: accountLinks.accountId });
    if (!link) return null;

    const set = { passwordHash };
    if (link.audience === "staff") {
      await tx.update(users).set({ ...set, updatedAt: now }).where(eq(users.id, link.accountId));
    } else if (link.audience === "sponsor") {
      await tx.update(sponsorUsers).set(set).where(eq(sponsorUsers.id, link.accountId));
    } else if (link.audience === "clinic") {
      await tx.update(clinicManagers).set(set).where(eq(clinicManagers.id, link.accountId));
    } else {
      await tx.update(partnerUsers).set(set).where(eq(partnerUsers.id, link.accountId));
    }
    return link;
  });

  if (!spent) return { error: "invalid" };

  if (spent.audience === "staff") {
    // A reset ends every session the old password opened (the same rule as `resetPassword`).
    const { revokeAllSessionsForUser } = await import("@/lib/auth/session");
    await revokeAllSessionsForUser(spent.accountId);
  }

  log.info("account link redeemed", { account: ref(spent.accountId), audience: spent.audience });
  return { ok: true, signIn: SIGN_IN_FOR[spent.audience], ...spent };
}

/**
 * Mint a link and email it to the account's owner. The operator who pressed
 * the button never sees it, so they can no more set the password than type it.
 */
export async function emailAccountLink(input: {
  audience: AccountAudience;
  accountId: string;
  email: string;
  purpose?: "invite" | "reset";
  createdByUserId: string | null;
}): Promise<boolean> {
  const url = await mintAccountLink(input);
  const account = await accountFor(input.audience, input.accountId);
  const purpose = input.purpose ?? "invite";
  /* 🔴 Ruling 8: our own staff have a saved language; the portal accounts do not yet. */
  const { recipientLocale } = await import("@/lib/i18n/preference");
  const locale = input.audience === "staff" ? await recipientLocale({ userId: input.accountId }) : null;
  const { sendAccountLink } = await import("@/lib/mail");
  return sendAccountLink({
    to: input.email,
    url,
    reader: READER_FOR[input.audience],
    purpose,
    organisation: account.organisation,
    role: account.role,
    name: account.name,
    signIn: `${env.appUrl}${SIGN_IN_FOR[input.audience]}`,
    days: purpose === "invite" ? INVITE_DAYS : 0,
    locale,
  });
}

/** The reader each kind of account is, for the words and the footer. */
const READER_FOR: Record<AccountAudience, "staff" | "company" | "manager" | "partner"> = {
  staff: "staff",
  sponsor: "company",
  clinic: "manager",
  partner: "partner",
};

/**
 * 🔴 B24: whose account this is and in what role, so the invitation can say.
 * Read from the row the link was minted for, never from the form, so it names
 * what was actually created.
 */
async function accountFor(
  audience: AccountAudience,
  accountId: string,
): Promise<{ organisation: string | null; role: string; name: string | null }> {
  if (audience === "staff") {
    const [row] = await db
      .select({ role: users.role, name: users.firstName })
      .from(users)
      .where(eq(users.id, accountId))
      .limit(1);
    return { organisation: null, role: row?.role ?? "staff", name: row?.name ?? null };
  }
  if (audience === "sponsor") {
    const [row] = await db
      .select({ organisation: sponsors.name, role: sponsorUsers.role, name: sponsorUsers.name })
      .from(sponsorUsers)
      .innerJoin(sponsors, eq(sponsors.id, sponsorUsers.sponsorId))
      .where(eq(sponsorUsers.id, accountId))
      .limit(1);
    return { organisation: row?.organisation ?? null, role: row?.role ?? "viewer", name: row?.name ?? null };
  }
  if (audience === "clinic") {
    const [row] = await db
      .select({ organisation: organizations.name, role: clinicManagers.role, name: clinicManagers.name })
      .from(clinicManagers)
      .innerJoin(organizations, eq(organizations.id, clinicManagers.organizationId))
      .where(eq(clinicManagers.id, accountId))
      .limit(1);
    return { organisation: row?.organisation ?? null, role: row?.role ?? "viewer", name: row?.name ?? null };
  }
  const [row] = await db
    .select({ organisation: partners.name, role: partnerUsers.role, name: partnerUsers.name })
    .from(partnerUsers)
    .innerJoin(partners, eq(partners.id, partnerUsers.partnerId))
    .where(eq(partnerUsers.id, accountId))
    .limit(1);
  return { organisation: row?.organisation ?? null, role: row?.role ?? "developer", name: row?.name ?? null };
}

/**
 * A password nobody knows, for an account that must exist before its owner
 * has chosen one. `users.password_hash` is NOT NULL; the three portal tables
 * take null instead, which their sign-ins already refuse.
 */
export async function unusablePasswordHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString("base64url"));
}
