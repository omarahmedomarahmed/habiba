import "server-only";

import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { controlDb } from "@/lib/db";
import { sponsorAuthSessions, sponsorUsers, type SponsorRole } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";
import {
  passwordLinkMatches,
  passwordLinkToken,
  readPasswordLink,
  type LinkPurpose,
} from "@/lib/sponsor/password-link";

/**
 * 🔴 W2-S05: A COMPANY RUNS ITS OWN LOGINS.
 *
 * Every portal login was typed in by an operator at `/admin/sponsors`, with a
 * password somebody then had to hand over, and there was no way back in for a
 * person who forgot theirs. A company can now invite a colleague, give them a
 * role, take it away, and anybody can reset or change their own password.
 *
 * ## 🔴 The links carry no row, and that is why there is no migration
 *
 * A reset or invite link is an HMAC over the login, an expiry, and the
 * password hash as it stands, with `AUTH_SECRET`, the construction the domain
 * mailbox link already uses. Setting a password changes the hash, so the link
 * that did it stops working: single use without a column. An expired link
 * fails on its own date. Nothing is stored that could leak.
 *
 * ## What this module never touches
 *
 * An enrolment, a person or a pot. A sponsor user is somebody at the company,
 * never one of the people it funds (C227), and nothing here reads any table
 * but the two that describe them.
 */

/** Twelve, like `createSponsorUser`: the same account, the same floor. */
export const SPONSOR_PASSWORD_MIN = 12;

async function loginRow(sponsorUserId: string) {
  const [row] = await controlDb
    .select({
      id: sponsorUsers.id,
      sponsorId: sponsorUsers.sponsorId,
      email: sponsorUsers.email,
      passwordHash: sponsorUsers.passwordHash,
      role: sponsorUsers.role,
    })
    .from(sponsorUsers)
    .where(and(eq(sponsorUsers.id, sponsorUserId), isNull(sponsorUsers.deletedAt)))
    .limit(1);
  return row ?? null;
}

async function linkFor(sponsorUserId: string, purpose: LinkPurpose): Promise<string> {
  const row = await loginRow(sponsorUserId);
  const token = passwordLinkToken({ sponsorUserId, purpose, passwordHash: row?.passwordHash ?? null });
  return `${env.appUrl}/sponsor/set-password?t=${encodeURIComponent(token)}`;
}

async function revokeSessions(sponsorUserId: string) {
  await controlDb
    .update(sponsorAuthSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(sponsorAuthSessions.sponsorUserId, sponsorUserId), isNull(sponsorAuthSessions.revokedAt)),
    );
}

/** Everybody who can sign in to this company's portal. No person it funds. */
export async function sponsorTeam(sponsorId: string) {
  const rows = await controlDb
    .select({
      id: sponsorUsers.id,
      email: sponsorUsers.email,
      name: sponsorUsers.name,
      role: sponsorUsers.role,
      passwordHash: sponsorUsers.passwordHash,
    })
    .from(sponsorUsers)
    .where(and(eq(sponsorUsers.sponsorId, sponsorId), isNull(sponsorUsers.deletedAt)))
    .orderBy(asc(sponsorUsers.email));

  /* Whether a password is set, never the hash itself. */
  return rows.map(({ passwordHash, ...row }) => ({ ...row, invited: passwordHash === null }));
}

/**
 * Invite a colleague. The login exists at once with no password, so it cannot
 * sign in until the person who owns the address sets one from the link.
 */
export async function inviteSponsorUser(input: {
  sponsorId: string;
  email: string;
  name?: string | null;
  role: SponsorRole;
  /** The email, already in the inviter's language. The link is appended. */
  message: { subject: string; body: string };
}): Promise<{ ok?: true; sponsorUserId?: string; error?: string }> {
  const email = input.email.trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "That email address does not look right." };
  }
  if (input.role !== "admin" && input.role !== "viewer") return { error: "Pick a role." };

  let created: { id: string } | undefined;
  try {
    [created] = await controlDb
      .insert(sponsorUsers)
      .values({
        sponsorId: input.sponsorId,
        email,
        name: input.name?.trim().slice(0, 120) || null,
        passwordHash: null,
        role: input.role,
      })
      .returning({ id: sponsorUsers.id });
  } catch {
    return { error: "There is already an account with that email address." };
  }
  if (!created) return { error: "That could not be saved. Try again." };

  const url = await linkFor(created.id, "invite");
  const { notify } = await import("@/lib/notify");
  await notify(
    { email, phone: null, timezone: null },
    { kind: "sponsor.invite", ...input.message, link: { label: input.message.subject, url } },
  );

  log.info("sponsor user invited", { sponsor: ref(input.sponsorId) });
  return { ok: true, sponsorUserId: created.id };
}

/**
 * Forgot password. 🔴 The same answer whether or not the address has a login,
 * so this cannot be used to learn who works at which customer.
 */
export async function requestSponsorReset(
  rawEmail: string,
  message: { subject: string; body: string },
): Promise<{ ok: true }> {
  const email = rawEmail.trim().toLowerCase();
  const [row] = await controlDb
    .select({ id: sponsorUsers.id })
    .from(sponsorUsers)
    .where(and(eq(sponsorUsers.email, email), isNull(sponsorUsers.deletedAt)))
    .limit(1);

  if (row) {
    const url = await linkFor(row.id, "reset");
    const { notify } = await import("@/lib/notify");
    await notify(
      { email, phone: null, timezone: null },
      { kind: "sponsor.password_reset", ...message, link: { label: message.subject, url } },
    );
    log.info("sponsor password reset requested", { user: ref(row.id) });
  }

  return { ok: true };
}

/**
 * 🔴 Board 357: whether a reset or invite link can still set a password, so the
 * page says a spent link is spent on arrival (as the clinic's does) rather than
 * after somebody has typed a new password twice. The same two checks
 * `setSponsorPassword` makes, which stays the authority.
 */
export async function sponsorPasswordLinkLive(token: string): Promise<boolean> {
  const link = readPasswordLink(token);
  if (!link) return false;
  const row = await loginRow(link.sponsorUserId);
  return Boolean(row && passwordLinkMatches(token, row.passwordHash));
}

/**
 * Set a password from a reset or invite link. Every session the login had is
 * ended, because a reset exists for the case where somebody else got in.
 */
export async function setSponsorPassword(
  token: string,
  password: string,
): Promise<{ ok?: true; error?: string }> {
  const expired = { error: "That link has expired or was already used. Ask for a new one." };
  const link = readPasswordLink(token);
  if (!link) return expired;

  if (password.length < SPONSOR_PASSWORD_MIN) return { error: "Use at least twelve characters." };
  if (password.length > 200) return { error: "Use fewer than 200 characters." };

  const row = await loginRow(link.sponsorUserId);
  if (!row || !passwordLinkMatches(token, row.passwordHash)) return expired;
  const purpose = link.purpose;

  /*
   * Guarded on the hash we checked the link against, so two tabs pressing Save
   * on one link cannot both win: the second finds the hash already changed.
   */
  const passwordHash = await hashPassword(password);
  const [updated] = await controlDb
    .update(sponsorUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(
      and(
        eq(sponsorUsers.id, row.id),
        row.passwordHash === null
          ? isNull(sponsorUsers.passwordHash)
          : eq(sponsorUsers.passwordHash, row.passwordHash),
      ),
    )
    .returning({ id: sponsorUsers.id });
  if (!updated) return expired;

  await revokeSessions(row.id);
  log.info("sponsor password set from a link", { user: ref(row.id), purpose });
  return { ok: true };
}

/** Change your own password, knowing the current one. Other sessions end. */
export async function changeSponsorPassword(
  sponsorUserId: string,
  current: string,
  next: string,
): Promise<{ ok?: true; error?: string }> {
  const row = await loginRow(sponsorUserId);
  if (!row?.passwordHash || !(await verifyPassword(current, row.passwordHash))) {
    return { error: "Your current password is not right." };
  }
  if (next.length < SPONSOR_PASSWORD_MIN) return { error: "Use at least twelve characters." };
  if (next.length > 200) return { error: "Use fewer than 200 characters." };

  await controlDb
    .update(sponsorUsers)
    .set({ passwordHash: await hashPassword(next), updatedAt: new Date() })
    .where(eq(sponsorUsers.id, row.id));
  await revokeSessions(row.id);
  return { ok: true };
}

async function otherAdmins(sponsorId: string, sponsorUserId: string): Promise<number> {
  const [row] = await controlDb
    .select({ n: sql<number>`count(*)::int` })
    .from(sponsorUsers)
    .where(
      and(
        eq(sponsorUsers.sponsorId, sponsorId),
        eq(sponsorUsers.role, "admin"),
        isNull(sponsorUsers.deletedAt),
        ne(sponsorUsers.id, sponsorUserId),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Change a colleague's role. 🔴 The last admin cannot become a viewer: an
 * account with no admin can change nothing, top up nothing and invite nobody,
 * and only an operator could get it back.
 */
export async function setSponsorUserRole(input: {
  sponsorId: string;
  sponsorUserId: string;
  role: SponsorRole;
}): Promise<{ ok?: true; error?: string }> {
  if (input.role !== "admin" && input.role !== "viewer") return { error: "Pick a role." };
  const row = await loginRow(input.sponsorUserId);
  /* Scoped to the company doing it. A borrowed id changes nobody. */
  if (!row || row.sponsorId !== input.sponsorId) return { error: "That login is not on your account." };

  if (row.role === "admin" && input.role === "viewer" && (await otherAdmins(input.sponsorId, row.id)) === 0) {
    return { error: "Make somebody else an admin first." };
  }

  await controlDb
    .update(sponsorUsers)
    .set({ role: input.role, updatedAt: new Date() })
    .where(eq(sponsorUsers.id, row.id));
  return { ok: true };
}

/** Remove a colleague's login. Never your own, never the last admin. */
export async function removeSponsorUser(input: {
  sponsorId: string;
  sponsorUserId: string;
  bySponsorUserId: string;
}): Promise<{ ok?: true; error?: string }> {
  if (input.sponsorUserId === input.bySponsorUserId) {
    return { error: "You cannot remove yourself. Ask another admin." };
  }
  const row = await loginRow(input.sponsorUserId);
  if (!row || row.sponsorId !== input.sponsorId) return { error: "That login is not on your account." };
  if (row.role === "admin" && (await otherAdmins(input.sponsorId, row.id)) === 0) {
    return { error: "Make somebody else an admin first." };
  }

  await controlDb
    .update(sponsorUsers)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(sponsorUsers.id, row.id));
  await revokeSessions(row.id);
  return { ok: true };
}
