"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { patientAccounts, people } from "@/lib/db/schema";
import { normaliseEmail } from "@/lib/data/people";
import { e164Problem, toE164 } from "@/lib/phone/e164";
import { usable } from "@/lib/scheduling/tz";
import { log } from "@/lib/logger";
import { callerKey, consume } from "@/lib/rate-limit";

import { createPatientSession, destroyPatientSession } from "./session";

export type PatientAuthState = { error?: string };

/**
 * A patient signing up.
 *
 * ## They get a person, not an organisation
 *
 * Signing up creates a `people` row of their own and a `patient_accounts` row
 * that owns it. It does **not** claim anything: whether they have a record with
 * a clinician is a separate question, asked next, and answered by the claim
 * flow. Somebody who signs up and never claims anything still has an account
 * and a person — they simply have no history yet.
 *
 * ## Password rules are shared, not re-invented
 *
 * `validatePassword` and `hashPassword` come from `lib/auth/*` unchanged (6.5).
 * A second password policy is a second thing to get wrong, and the weaker of
 * the two is the one that matters.
 */
export async function patientSignUp(
  _prev: PatientAuthState,
  formData: FormData,
): Promise<PatientAuthState> {
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim() || null;
  /*
   * 11R.12 — expanded with the country the form asked for, or refused.
   *
   * `normalisePhone` stored `01001234567` as typed, which is a number nobody
   * can send anything to: WhatsApp bounces it and nothing can repair it later,
   * because the country it needs was never collected. Refusing at the door is
   * the only version where the stored number is reachable.
   */
  /*
   * 🔴 13.1 / §3b — the number is the identity, so it is required.
   *
   * It was optional through sprints 6–12, which is why `patient_accounts.phone`
   * is a nullable column with a `NOT VALID` presence check (0043) rather than a
   * plain NOT NULL. Nothing may create an account without one from here.
   */
  const rawPhone = String(formData.get("phone") ?? "").trim();
  if (!rawPhone) {
    return {
      error: "A phone number is required — it is how you sign in and how your therapist finds you.",
    };
  }

  const parsed = toE164(rawPhone, String(formData.get("phoneCountry") ?? "") || null);
  if (!parsed.ok) return { error: e164Problem(parsed) ?? "Check that phone number." };
  const phone = parsed.e164;

  /*
   * 13.11 / 13.12 — where they are, as they confirmed it on the form. Refused
   * rather than coerced if this runtime has never heard of it: a zone we cannot
   * format in is a reminder sent at the wrong hour.
   */
  const rawZone = String(formData.get("timezone") ?? "").trim();
  const timezone = rawZone && usable(rawZone) ? rawZone : null;

  if (!email) return { error: "Enter your email address." };
  if (!firstName) return { error: "Enter your first name." };

  const problem = validatePassword(password);
  if (problem) return { error: problem };

  // Signup is a write on an unauthenticated endpoint, so it is rate limited on
  // the caller rather than on the account — there is no account yet.
  const verdict = await consume(await callerKey("patient:signup"), 5, 60 * 60);
  if (!verdict.allowed) {
    return { error: "Too many attempts. Try again in an hour." };
  }

  const existing = await db
    .select({ id: patientAccounts.id })
    .from(patientAccounts)
    .where(and(eq(patientAccounts.email, email), isNull(patientAccounts.deletedAt)))
    .limit(1);

  if (existing.length > 0) {
    /*
     * Deliberately the same wording as a wrong password on sign-in.
     *
     * "That email is already registered" tells anybody with a list of addresses
     * which of them are in therapy. That is a disclosure this product cannot
     * make, and it is worth the small usability cost.
     */
    return { error: "We could not create that account. Try signing in instead." };
  }

  const accountId = await db.transaction(async (tx) => {
    /*
     * Their own person, always a new one (5.3's rule, one sprint on).
     *
     * Even when this email matches a person a clinician already wrote down.
     * Linking the two is a *claim* — a thing this person confirms — and doing
     * it automatically here would merge two records on the strength of an
     * address, which is exactly what C39 measured going wrong.
     */
    const [person] = await tx
      .insert(people)
      .values({ firstName, lastName, email, phone })
      .returning({ id: people.id });

    if (!person) return null;

    const [account] = await tx
      .insert(patientAccounts)
      .values({
        personId: person.id,
        email,
        passwordHash: await hashPassword(password),
        phone,
        timezone,
      })
      .returning({ id: patientAccounts.id });

    return account?.id ?? null;
  });

  if (!accountId) return { error: "We could not create that account. Try again." };

  await createPatientSession(accountId);
  log.info("patient account created");
  redirect("/patient/claim");
}

export async function patientSignIn(
  _prev: PatientAuthState,
  formData: FormData,
): Promise<PatientAuthState> {
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const verdict = await consume(await callerKey("patient:signin"), 10, 15 * 60);
  if (!verdict.allowed) return { error: "Too many attempts. Try again shortly." };

  const [account] = await db
    .select({ id: patientAccounts.id, passwordHash: patientAccounts.passwordHash })
    .from(patientAccounts)
    .where(and(eq(patientAccounts.email, email), isNull(patientAccounts.deletedAt)))
    .limit(1);

  /*
   * One message for "no such account" and "wrong password", and the hash is
   * verified even when there is no account — otherwise the response time tells
   * an attacker which addresses exist.
   */
  const ok = account
    ? await verifyPassword(password, account.passwordHash)
    : await verifyPassword(password, "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali");

  if (!account || !ok) return { error: "That email and password do not match." };

  await createPatientSession(account.id);
  redirect("/patient");
}

export async function patientSignOut(): Promise<void> {
  await destroyPatientSession();
  redirect("/patient/login");
}
