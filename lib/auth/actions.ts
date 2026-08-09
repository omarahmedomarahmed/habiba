"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { authTokens, organizations, subscriptions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { sendPasswordReset } from "@/lib/mail";
import { callerKey, consume } from "@/lib/rate-limit";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import {
  createSession,
  destroyCurrentSession,
  getActor,
  revokeAllSessionsForUser,
} from "./session";

export type ActionState = { error?: string; ok?: boolean };

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

/** Per-connection, across every account. Covers credential stuffing. */
const LOGINS_PER_WINDOW = 20;
const LOGIN_WINDOW_SECONDS = 15 * 60;

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  // Random suffix from a CSPRNG rather than a counter or Math.random: the old
  // implementation built org slugs with Math.random, and the slug doubled as an
  // org-join key on public registration — so guessable slugs meant guessable
  // org membership.
  return `${base || "practice"}-${randomBytes(4).toString("hex")}`;
}

/**
 * Sign up. Creates the practice, the clinician and a metered subscription in
 * one transaction, then drops them straight into their first session.
 *
 * Note what is *not* collected: licence number, NPI, practice address,
 * insurance panels, availability, weekly capacity. The old app asked for about
 * thirty-five fields across nine wizard steps before a therapist could reach
 * any part of the product. None of it is needed to record a session, so it is
 * collected later, in settings, if at all.
 */
export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!firstName) return { error: "Please enter your first name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const passwordProblem = validatePassword(password);
  if (passwordProblem) return { error: passwordProblem };

  let userId: string;

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (existing.length > 0) {
      return { error: "An account with that email already exists. Try signing in." };
    }

    const passwordHash = await hashPassword(password);

    userId = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          name: lastName ? `${firstName} ${lastName}` : `${firstName}'s practice`,
          slug: slugify(lastName || firstName),
        })
        .returning({ id: organizations.id });

      const [user] = await tx
        .insert(users)
        .values({
          organizationId: org!.id,
          email,
          passwordHash,
          firstName,
          lastName: lastName || "",
          // The role is assigned here, never read from the form. Public
          // registration used to accept `role` from the request body, which let
          // anyone sign up as an administrator.
          role: "therapist",
        })
        .returning({ id: users.id });

      await tx
        .insert(subscriptions)
        .values({ organizationId: org!.id, plan: "payg", status: "active" });

      return user!.id;
    });
  } catch (error) {
    log.error("signup failed", { reason: safeErrorMessage(error) });
    return { error: "Something went wrong creating your account. Please try again." };
  }

  await createSession(userId);
  await audit({
    actor: null,
    category: "auth",
    action: "signup",
    resourceType: "user",
    resourceId: userId,
  });

  // Straight to the thing they came for.
  redirect("/sessions/new?welcome=1");
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  /*
   * Per-address throttling, on top of the per-account lockout below.
   *
   * The account lockout stops someone guessing one person's password. It does
   * nothing against credential stuffing, where an attacker tries one password
   * against ten thousand addresses and never trips a single account counter.
   * This is the limit that covers that case.
   */
  const attempts = await consume(await callerKey("login"), LOGINS_PER_WINDOW, LOGIN_WINDOW_SECONDS);
  if (!attempts.allowed) {
    return { error: "Too many sign-in attempts from this connection. Try again shortly." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  // Identical message on both branches so the form cannot be used to discover
  // which addresses have accounts.
  const generic = { error: "That email and password combination did not work." };

  if (!user) {
    // Burn comparable time so a missing account is not detectably faster.
    await hashPassword(password);
    return generic;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  if (user.status !== "active") {
    return { error: "This account has been suspended. Contact your administrator." };
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const failures = user.failedLoginCount + 1;
    await db
      .update(users)
      .set({
        failedLoginCount: failures,
        lockedUntil:
          failures >= LOCKOUT_THRESHOLD
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
      })
      .where(eq(users.id, user.id));
    return generic;
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  await createSession(user.id);
  await audit({
    actor: { userId: user.id, organizationId: user.organizationId },
    category: "auth",
    action: "signin",
    resourceType: "user",
    resourceId: user.id,
  });

  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(destination);
}

export async function signOut(): Promise<void> {
  const actor = await getActor();
  await destroyCurrentSession();
  if (actor) {
    await audit({
      actor,
      category: "auth",
      action: "signout",
      resourceType: "user",
      resourceId: actor.userId,
    });
  }
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  // Always report success — otherwise this endpoint enumerates accounts.
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await db.insert(authTokens).values({
      userId: user.id,
      purpose: "password_reset",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await sendPasswordReset({
      to: email,
      url: `${env.appUrl}/reset-password?token=${token}`,
    });
    log.info("password reset requested", { user: ref(user.id) });
  }

  return { ok: true };
}

export async function resetPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  const problem = validatePassword(password);
  if (problem) return { error: problem };

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [row] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.purpose, "password_reset"),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return { error: "That reset link is invalid or has expired. Request a new one." };

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
  });

  // Revoke every existing session. The old implementation reset the password
  // and left all refresh tokens alive, so an attacker's session survived the
  // victim locking them out — precisely the scenario a reset exists to handle.
  await revokeAllSessionsForUser(row.userId);

  await audit({
    actor: null,
    category: "auth",
    action: "password.reset",
    resourceType: "user",
    resourceId: row.userId,
  });

  redirect("/login?reset=1");
}

export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor) return { error: "You are not signed in." };

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");

  const problem = validatePassword(next);
  if (problem) return { error: problem };

  const [user] = await db.select().from(users).where(eq(users.id, actor.userId)).limit(1);
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    return { error: "Your current password is not correct." };
  }

  const passwordHash = await hashPassword(next);
  await db.update(users).set({ passwordHash }).where(eq(users.id, actor.userId));
  await revokeAllSessionsForUser(actor.userId);

  await audit({
    actor,
    category: "auth",
    action: "password.change",
    resourceType: "user",
    resourceId: actor.userId,
  });

  redirect("/login?changed=1");
}
