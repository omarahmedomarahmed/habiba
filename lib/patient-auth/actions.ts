"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull, or, sql } from "drizzle-orm";

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
  /*
   * 13R.6 / §3b — the address is optional now. The number below is not.
   *
   * Sprint 13 required both and called the phone "the identity", which is half
   * the rule: the phone is the handle that is never *missing*, and the address
   * is a second real way in for the people who have one.
   */
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
      error: "A phone number is required. It is how you sign in and how your therapist finds you.",
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

  if (!firstName) return { error: "Enter your first name." };

  /*
   * 🔴 25.12 / C119 — a password is optional, and only checked when there is one.
   *
   * One handle is enough to be a full patient user. A guest who joined a
   * session on a phone number should not be stopped at a form asking them to
   * invent a password while their therapist waits; a code to the number they
   * already have is both easier and the stronger factor. Somebody who types a
   * password still gets the shared policy, unchanged (6.5) — the weaker of two
   * policies is the one that matters, so there is still only one.
   */
  if (password) {
    const problem = validatePassword(password);
    if (problem) return { error: problem };
  }

  // Signup is a write on an unauthenticated endpoint, so it is rate limited on
  // the caller rather than on the account — there is no account yet.
  const verdict = await consume(await callerKey("patient:signup"), 5, 60 * 60);
  if (!verdict.allowed) {
    return { error: "Too many attempts. Try again in an hour." };
  }

  /*
   * Both handles checked, and refused with the same sentence.
   *
   * "That email is already registered" tells anybody with a list of addresses
   * which of them are in therapy; the same is true of a number, and more so —
   * a number is guessable in a way an address is not.
   */
  const existing = await db
    .select({ id: patientAccounts.id })
    .from(patientAccounts)
    .where(
      and(
        isNull(patientAccounts.deletedAt),
        or(
          email ? eq(patientAccounts.email, email) : sql`false`,
          eq(patientAccounts.phone, phone),
        ),
      ),
    )
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
        passwordHash: password ? await hashPassword(password) : null,
        phone,
        timezone,
      })
      .returning({ id: patientAccounts.id });

    return account?.id ?? null;
  });

  if (!accountId) return { error: "We could not create that account. Try again." };

  await createPatientSession(accountId);
  log.info("patient account created");

  /*
   * 🔴 22R — the invite the form carried is not dropped on the floor.
   *
   * `/patient/signup?invite=<token>` renders the token as a hidden field, and
   * this function never read it: a patient who followed the link their
   * therapist handed them was dropped into the *matching* route instead, which
   * asks for a code by email or WhatsApp. Most patients here have no email
   * (§3b, C43) and WhatsApp is waiting on Meta, so the screen they reached said
   * "we could not send your code — check the email address on your account",
   * to somebody who has no email and is holding the very invite it then
   * suggests they ask for. That is a dead end on the primary way into this
   * product, and it took signing up as a patient to see it.
   *
   * The redirect goes to the invite page rather than redeeming here on
   * purpose: §3 step 7 asks whether the therapist keeps access, the default is
   * OFF, and the patient chooses. Claiming silently at signup would answer a
   * consent question on their behalf.
   */
  const inviteToken = String(formData.get("inviteToken") ?? "").trim();
  redirect(inviteToken ? `/patient/invite/${encodeURIComponent(inviteToken)}` : "/patient/claim");
}

/**
 * Sign in by **either** handle. 13R.9 / §3b.
 *
 * One field, labelled "phone number or email", because asking somebody to
 * remember which one they signed up with is asking them to remember a decision
 * they made once, months ago, on a form.
 *
 * 🔴 One failure message for every outcome — no such account, wrong password,
 * and the handle being an address rather than a number. An error that named
 * which handle was wrong would tell somebody holding a list of addresses which
 * of them belongs to a person in therapy.
 */
export async function patientSignIn(
  _prev: PatientAuthState,
  formData: FormData,
): Promise<PatientAuthState> {
  const handle = String(formData.get("handle") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!handle || !password) {
    return { error: "Enter your phone number or email, and your password." };
  }

  const verdict = await consume(await callerKey("patient:signin"), 10, 15 * 60);
  if (!verdict.allowed) {
    /* 22R — the wait in minutes, for the same reason as the clinician's door. */
    const minutes = Math.max(1, Math.ceil(verdict.retryAfter / 60));
    return {
      error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  /*
   * Which handle is this? Decided by shape, not by asking.
   *
   * A number is expanded with the country the form offers; an address is
   * lower-cased. A string that is neither still runs the timing-safe path
   * below rather than returning early, because an early return on "that is not
   * a handle" is itself an oracle.
   */
  const asPhone = toE164(handle, String(formData.get("handleCountry") ?? "") || null);
  const asEmail = handle.includes("@") ? normaliseEmail(handle) : null;

  const [account] = await db
    .select({ id: patientAccounts.id, passwordHash: patientAccounts.passwordHash })
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

  /*
   * One message for "no such account", "wrong password" and "this account has
   * no password", and the hash is verified even when there is no account, so
   * the response time does not tell an attacker which handles exist.
   *
   * 🔴 25.11 — an account with no password is not an error the person typing
   * can see. They have one way in, a code to their handle, and the sign-in
   * page offers it to everybody rather than only to the people it would work
   * for. Saying "that account has no password" here would answer, to anybody
   * holding a phone number, whether that number belongs to a guest.
   */
  const INVALID = "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali";
  const ok = account?.passwordHash
    ? await verifyPassword(password, account.passwordHash)
    : await verifyPassword(password, INVALID);

  if (!account || !ok) return { error: "That does not match an account. Check and try again." };

  await createPatientSession(account.id);
  redirect("/patient");
}

export async function patientSignOut(): Promise<void> {
  await destroyPatientSession();
  redirect("/patient/login");
}
