import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { hashPassword } from "@/lib/auth/password";
import { controlDb } from "@/lib/db";
import {
  partnerAuthSessions,
  partnerUsers,
  partners,
  PARTNER_ROLES,
  type PartnerRole,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";

/**
 * 🔴 W2-X06: A PARTNER'S OWN PEOPLE: A PASSWORD THEY CAN RESET, AND COLLEAGUES.
 *
 * Only an operator could create a partner user, with a password set on a call, and
 * nobody could reset one. So a developer who forgot theirs was locked out for good,
 * and a team of three shared one login. Now an admin adds a colleague by email, the
 * colleague chooses their own password from a link, and anybody can reset theirs.
 * No operator ever types a customer's password.
 *
 * ## 🔴 THE LINK IS SIGNED, NOT STORED, AND IT WORKS ONCE
 *
 * The token is the user's id and an expiry, signed with an HMAC over those AND the
 * user's current password hash (C406's construction for the sponsor's confirm link).
 * Setting a password changes the hash, so the same link cannot set a second one, and
 * no table of live reset tokens exists to leak.
 */

const RESET_MS = 60 * 60 * 1000;
const INVITE_MS = 7 * 24 * 60 * 60 * 1000;

/** The same floor `createPartnerUser` applies, and `/welcome` too (B29). */
export const PARTNER_PASSWORD_MIN = 12;
const MIN_PASSWORD = PARTNER_PASSWORD_MIN;

function sign(userId: string, expires: number, passwordHash: string | null): string {
  return createHmac("sha256", env.authSecret)
    .update(`partner-password:${userId}:${expires}:${passwordHash ?? ""}`)
    .digest("base64url");
}

function tokenFor(user: { id: string; passwordHash: string | null }, ttlMs: number): string {
  const expires = Date.now() + ttlMs;
  return `${user.id}.${expires}.${sign(user.id, expires, user.passwordHash)}`;
}

/** Where a signed link lands. Built here, so the page it names is reachable (58.4). */
function passwordUrl(token: string): string {
  return `${env.appUrl}/partner/reset?token=${encodeURIComponent(token)}`;
}

/**
 * Ask for a reset link. Always the same answer, found or not: a different one
 * would tell anybody typing addresses which companies integrate with us.
 */
export async function requestPartnerReset(email: string): Promise<{ ok: true }> {
  const [user] = await controlDb
    .select({ id: partnerUsers.id, passwordHash: partnerUsers.passwordHash })
    .from(partnerUsers)
    .innerJoin(partners, eq(partners.id, partnerUsers.partnerId))
    .where(
      and(
        eq(partnerUsers.email, email.trim().toLowerCase()),
        isNull(partnerUsers.deletedAt),
        eq(partners.state, "active"),
      ),
    )
    .limit(1);

  if (user) {
    const { sendPasswordReset } = await import("@/lib/mail");
    await sendPasswordReset({ to: email.trim().toLowerCase(), url: passwordUrl(tokenFor(user, RESET_MS)) });
    log.info("partner password reset requested", { user: ref(user.id) });
  }

  return { ok: true };
}

/**
 * Set a password from a signed link: a reset, or a colleague's first password.
 *
 * 🔴 Every session the user had is revoked, so a reset locks out whoever was using
 * the old password, which is the case a reset exists for.
 */
export async function setPartnerPassword(
  token: string,
  password: string,
): Promise<{ ok?: true; error?: string }> {
  const expired = { error: "That link has expired or was already used. Ask for a new one." };

  const [userId, expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!userId || !signature || !Number.isFinite(expires) || expires < Date.now()) return expired;
  if (password.length < MIN_PASSWORD) return { error: "Use at least twelve characters." };

  const [user] = await controlDb
    .select({ id: partnerUsers.id, passwordHash: partnerUsers.passwordHash })
    .from(partnerUsers)
    .where(and(sql`${partnerUsers.id}::text = ${userId}`, isNull(partnerUsers.deletedAt)))
    .limit(1);
  if (!user) return expired;

  const want = Buffer.from(sign(user.id, expires, user.passwordHash));
  const got = Buffer.from(signature);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return expired;

  const passwordHash = await hashPassword(password);
  const [changed] = await controlDb
    .update(partnerUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(
      and(
        eq(partnerUsers.id, user.id),
        /* The hash the link was signed over, so two tabs cannot both use it. */
        user.passwordHash === null
          ? isNull(partnerUsers.passwordHash)
          : eq(partnerUsers.passwordHash, user.passwordHash),
      ),
    )
    .returning({ id: partnerUsers.id });
  if (!changed) return expired;

  await controlDb
    .update(partnerAuthSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(partnerAuthSessions.partnerUserId, user.id), isNull(partnerAuthSessions.revokedAt)));

  log.info("partner password set", { user: ref(user.id) });
  return { ok: true };
}

/** Everybody on the account: email, name, role, and whether they have chosen a password. */
export async function teamFor(partnerId: string) {
  return controlDb
    .select({
      id: partnerUsers.id,
      email: partnerUsers.email,
      name: partnerUsers.name,
      role: partnerUsers.role,
      invited: sql<boolean>`${partnerUsers.passwordHash} IS NULL`,
    })
    .from(partnerUsers)
    .where(and(eq(partnerUsers.partnerId, partnerId), isNull(partnerUsers.deletedAt)))
    .orderBy(partnerUsers.email);
}

async function auditTeam(action: string, partnerId: string, userId: string, by: string, detail: string) {
  const { audit } = await import("@/lib/audit");
  await audit({
    actor: null,
    category: "admin",
    action,
    resourceType: "partner_user",
    resourceId: userId,
    reason: `partner ${partnerId}, ${detail}, by partner user ${by}`,
  });
}

/**
 * Add a colleague. They get a link to choose their own password; nobody else
 * sets it. The partner id comes from the admin's session, never the form.
 */
export async function inviteColleague(input: {
  partnerId: string;
  email: string;
  name: string;
  role: string;
  byPartnerUserId: string;
}): Promise<{ ok?: true; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "That email address does not look right." };
  const role = (PARTNER_ROLES as readonly string[]).includes(input.role)
    ? (input.role as PartnerRole)
    : "developer";

  let created: { id: string } | undefined;
  try {
    [created] = await controlDb
      .insert(partnerUsers)
      .values({
        partnerId: input.partnerId,
        email,
        name: input.name.trim().slice(0, 120) || null,
        passwordHash: null,
        role,
      })
      .returning({ id: partnerUsers.id });
  } catch {
    /* The unique index spans partners: one message, whichever account holds it. */
    return { error: "There is already an account with that email address." };
  }
  if (!created) return { error: "There is already an account with that email address." };

  const [partner] = await controlDb
    .select({ name: partners.name })
    .from(partners)
    .where(eq(partners.id, input.partnerId))
    .limit(1);

  const { sendPartnerInvite } = await import("@/lib/mail");
  await sendPartnerInvite({
    to: email,
    url: passwordUrl(tokenFor({ id: created.id, passwordHash: null }, INVITE_MS)),
    partnerName: partner?.name ?? "",
  });

  await auditTeam("partner.user.invite", input.partnerId, created.id, input.byPartnerUserId, role);
  return { ok: true };
}

/**
 * Remove a colleague: their sessions end now and their address is free again. Not
 * yourself, and never the last admin, so an account cannot lock itself out.
 */
export async function removeColleague(input: {
  partnerId: string;
  userId: string;
  byPartnerUserId: string;
}): Promise<{ ok?: true; error?: string }> {
  if (input.userId === input.byPartnerUserId) return { error: "You cannot remove yourself." };

  const team = await teamFor(input.partnerId);
  const leaving = team.find((member) => member.id === input.userId);
  if (!leaving) return { error: "That person is not on this account." };
  if (leaving.role === "admin" && team.filter((member) => member.role === "admin").length < 2) {
    return { error: "An account needs at least one admin." };
  }

  await controlDb
    .update(partnerUsers)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(partnerUsers.id, input.userId), eq(partnerUsers.partnerId, input.partnerId)));
  await controlDb
    .update(partnerAuthSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(partnerAuthSessions.partnerUserId, input.userId), isNull(partnerAuthSessions.revokedAt)));

  await auditTeam("partner.user.remove", input.partnerId, input.userId, input.byPartnerUserId, leaving.role);
  return { ok: true };
}
