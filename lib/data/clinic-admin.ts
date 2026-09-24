import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { controlDb } from "@/lib/db";
import {
  clinicManagers,
  clinicianInvitations,
  invoices,
  meetingConnections,
  notifications,
  organizations,
  patients,
  subscriptions,
  therapistVerifications,
  users,
  type ClinicState,
} from "@/lib/db/schema";
import type { Region } from "@/lib/db/region";
import { log, ref } from "@/lib/logger";

/**
 * Everything that CHANGES a clinic. PLAN.md 54.3 to 54.6, 54.11, C261, C266, C267.
 *
 * Separate from `lib/data/clinic.ts`, which is the wall: that file is what a clinic
 * may READ, and every select list in it is shaped by 54.9. This one is about the
 * practice's own account, its invitations and its people.
 *
 * Two files for the same reason sprint 53 has two: the wall is easier to hold when the
 * functions that could breach it live together and nothing else does.
 */

const INVITE_TTL_DAYS = 14;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * 🔴 54.3 — a practice asks, and the account it creates is HELD.
 *
 * Held exactly as a sponsor's is, and activated by an admin after a call. What is
 * different from a sponsor, and is the whole of C259, is WHAT gets created: an
 * `organizations` row, which is the same kind of row every solo clinician already has.
 *
 * 🔴 IT CREATES NO CLINICIAN AND NO MANAGER PASSWORD. An enquiry produces a row and a
 * phone call. A self-serve path to an active clinic would be a self-serve path to a
 * tenancy containing clinical records.
 */
export async function applyToClinic(input: {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  /* 🔴 63.18 — asked at application rather than on the call. */
  registrationNumber?: string | null;
  registrationAuthority?: string | null;
  intendedClinicians?: string[];
}): Promise<{ ok?: true; error?: string }> {
  const name = input.name.trim().slice(0, 200);
  const contactName = input.contactName.trim().slice(0, 120);
  const contactEmail = input.contactEmail.trim().toLowerCase().slice(0, 200);
  const contactPhone = input.contactPhone.trim().slice(0, 40);

  if (!name) return { error: "Tell us what the practice is called." };
  if (!contactName) return { error: "Tell us who we should speak to." };
  if (!contactEmail.includes("@")) return { error: "That email address does not look right." };
  if (!contactPhone) return { error: "We need a phone number to call you on." };

  /*
   * 🔴 63.18 / C267 — NAMES, TRIMMED, CAPPED, AND NOTHING ELSE.
   *
   * A hundred is the database's ceiling too, so a longer list is refused rather than
   * silently truncated into an application somebody later reads as complete. The
   * value of this field is that the operator knows the size of the onboarding; a
   * list quietly cut to a hundred would tell them the wrong size.
   */
  const clinicians = (input.intendedClinicians ?? [])
    .map((clinician) => clinician.trim().slice(0, 120))
    .filter(Boolean);

  if (clinicians.length > 100) {
    return { error: "That is more clinicians than we can take on one application. Call us." };
  }

  /*
   * A slug, because `organizations.slug` is NOT NULL and unique among live rows. Built
   * from the name and suffixed with randomness rather than a counter: a counter needs a
   * read before the write, and two practices called "Nile Clinic" signing up in the
   * same second is exactly the race a unique index exists to lose safely.
   */
  const slug = `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)}-${randomBytes(3).toString("hex")}`;

  await controlDb.insert(organizations).values({
    name,
    slug,
    kind: "clinic",
    /* 🔴 54.3 — held, and the database refuses a clinic with no state at all. */
    clinicState: "held" as ClinicState,
    contactName,
    contactEmail,
    contactPhone,
    /*
     * 🔴 UNVERIFIED BY US, and the column comment says so. It is what they typed,
     * and the operator on the call checks it against the register. Storing it does
     * not make it a credential, which is the same distinction C267 draws about a
     * clinician's licence one table over.
     */
    registrationNumber: input.registrationNumber?.trim().slice(0, 120) || null,
    registrationAuthority: input.registrationAuthority?.trim().slice(0, 200) || null,
    intendedClinicians: clinicians,
  });

  log.info("clinic enquiry received");
  return { ok: true };
}

/**
 * 🔴 54.3 — an admin activates. There is no self-serve path to `active`.
 *
 * `getClinicActor` has `clinic_state = 'active'` in its WHERE clause, so suspending a
 * practice signs every manager out on their next request with no second mechanism to
 * keep in step.
 *
 * 🔴 AND IT TOUCHES NOTHING ELSE. Suspending a clinic closes the portal. It does not
 * cancel a session, suspend a clinician, or reach a patient: a commercial dispute with
 * a practice must never arrive in a room, which is C235's rule in a different setting.
 */
export async function setClinicState(
  clinicOrganizationId: string,
  state: ClinicState,
): Promise<{ ok?: true; error?: string }> {
  const [org] = await controlDb
    .select({ kind: organizations.kind })
    .from(organizations)
    .where(eq(organizations.id, clinicOrganizationId))
    .limit(1);

  if (!org) return { error: "That practice no longer exists." };
  if (org.kind !== "clinic") {
    /*
     * 🔴 A solo practice has no clinic state and the database refuses to give it one.
     * Caught here so the message is a sentence rather than a constraint name: this is
     * the mistake an operator makes when two rows look alike in a list.
     */
    return { error: "That is a solo practice, not a clinic. It has no state to set." };
  }

  await controlDb
    .update(organizations)
    .set({ clinicState: state, updatedAt: new Date() })
    .where(eq(organizations.id, clinicOrganizationId));

  log.info("clinic state changed", { org: ref(clinicOrganizationId), state });
  return { ok: true };
}

/**
 * 54.3: the first manager, created by an operator. 🔴 W2-A06: with no
 * password; its owner sets one from the emailed link.
 */
export async function createClinicManager(input: {
  clinicOrganizationId: string;
  email: string;
  name: string | null;
  role: "admin" | "viewer";
}): Promise<{ ok?: true; error?: string; id?: string; email?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "That email address does not look right." };

  try {
    const [row] = await controlDb
      .insert(clinicManagers)
      .values({
        organizationId: input.clinicOrganizationId,
        email,
        name: input.name?.trim().slice(0, 120) || null,
        passwordHash: null,
        role: input.role,
      })
      .returning({ id: clinicManagers.id });
    return { ok: true, id: row?.id, email };
  } catch {
    /*
     * The unique index is across clinics, not within one, so this also catches an
     * address already managing a different practice. One message either way: which of
     * the two it was is a fact about another customer.
     */
    return { error: "There is already an account with that email address." };
  }
}

/**
 * 🔴 54.4 / 54.5 / 54.6 — INVITE ONE CLINICIAN. BY EMAIL AND PHONE.
 *
 * One at a time and never a CSV. A bulk upload is a staff list arriving in our database
 * before anybody on it consented to be there, and C267 means every one of them has to
 * act personally anyway, so the bulk path saves the clinic nothing real.
 *
 * ## 🔴 C267 — THIS FUNCTION CANNOT VERIFY ANYBODY, AND THAT IS THE POINT
 *
 * It writes one `clinician_invitations` row. It does not create a user, does not set a
 * verification status, and there is no argument it could be given that would. The
 * invited clinician verifies themselves exactly as a solo one does; the clinic sees
 * pending and can chase.
 *
 * Returns the raw token exactly once, to be put in the invitation message. Only its
 * hash is stored, so a leaked database is not a set of working invitation links.
 */
export async function inviteClinician(input: {
  clinicOrganizationId: string;
  byManagerId: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
}): Promise<{ token?: string; invitationId?: string; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "That email address does not look right." };

  /*
   * 🔴 An address that already holds an account HERE is refused, and the reason is
   * C261 rather than tidiness.
   *
   * A clinician who wants both a clinic account and private work keeps a SEPARATE solo
   * account — which means a separate address, because `users` is unique on
   * (organisation, email) and a single address in two organisations is exactly the
   * ambiguity that makes "which account am I signing into" unanswerable at the door.
   */
  const [existing] = await controlDb
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.email, email),
        eq(users.organizationId, input.clinicOrganizationId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (existing) return { error: "That clinician is already on your account." };

  /* A resend supersedes the live invitation rather than colliding with its index. */
  await controlDb
    .update(clinicianInvitations)
    .set({ state: "revoked" })
    .where(
      and(
        eq(clinicianInvitations.organizationId, input.clinicOrganizationId),
        eq(clinicianInvitations.email, email),
        eq(clinicianInvitations.state, "sent"),
      ),
    );

  const token = randomBytes(32).toString("base64url");

  const [created] = await controlDb
    .insert(clinicianInvitations)
    .values({
      organizationId: input.clinicOrganizationId,
      email,
      phone: input.phone?.trim() || null,
      firstName: input.firstName?.trim().slice(0, 80) || null,
      lastName: input.lastName?.trim().slice(0, 80) || null,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      invitedByManagerId: input.byManagerId,
    })
    /*
     * 🔴 The ID comes back so the caller can AUDIT it. Never the token: that is
     * the secret in the invitation link, and an audit log is read by operators,
     * exported, and kept for years. A row naming it would be a row anybody with
     * log access could use to join a practice.
     */
    .returning({ id: clinicianInvitations.id });

  log.info("clinician invited");
  return { token, invitationId: created?.id };
}

export async function revokeInvitation(
  clinicOrganizationId: string,
  invitationId: string,
): Promise<{ ok: true }> {
  await controlDb
    .update(clinicianInvitations)
    .set({ state: "revoked" })
    .where(
      and(
        eq(clinicianInvitations.id, invitationId),
        /* Scoped in the WHERE. A borrowed id revokes nothing. */
        eq(clinicianInvitations.organizationId, clinicOrganizationId),
        eq(clinicianInvitations.state, "sent"),
      ),
    );

  return { ok: true };
}

export type InvitationView = {
  invitationId: string;
  clinicName: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

/**
 * 🔴 54.6 / C261 — RESOLVING THE LINK STAMPS `terms_shown_at`.
 *
 * *It is stated in the invitation, before they accept, not discovered afterwards.*
 *
 * The stamp happens HERE, in the function the invitation page calls to render itself,
 * and the database refuses an `accepted_at` on a row where it is null. So the ordering
 * is enforced by a constraint rather than by a component remembering to render a
 * paragraph: to accept at all, the screen carrying the sentence must have been served.
 *
 * It is not proof somebody read it. Nothing is. It is proof we said it, in a column an
 * auditor can read, which is the strongest thing software can offer here.
 */
export async function resolveInvitation(token: string): Promise<InvitationView | null> {
  const [row] = await controlDb
    .select({
      invitationId: clinicianInvitations.id,
      clinicName: organizations.name,
      email: clinicianInvitations.email,
      firstName: clinicianInvitations.firstName,
      lastName: clinicianInvitations.lastName,
    })
    .from(clinicianInvitations)
    .innerJoin(organizations, eq(organizations.id, clinicianInvitations.organizationId))
    .where(
      and(
        eq(clinicianInvitations.tokenHash, hashToken(token)),
        eq(clinicianInvitations.state, "sent"),
        eq(organizations.kind, "clinic"),
        eq(organizations.clinicState, "active" as ClinicState),
      ),
    )
    .limit(1);

  if (!row) return null;

  await controlDb
    .update(clinicianInvitations)
    .set({ termsShownAt: new Date() })
    .where(
      and(
        eq(clinicianInvitations.id, row.invitationId),
        isNull(clinicianInvitations.termsShownAt),
      ),
    );

  return row;
}

/**
 * 🔴 54.5 / C267 — ACCEPTING CREATES AN `unverified` CLINICIAN, AND NOTHING ELSE.
 *
 * *An invited clinician verifies themselves exactly as a solo one does, and the
 * clinic's word is not evidence.*
 *
 * So the user this creates has `verificationStatus: "unverified"`, which is the column
 * default and is passed explicitly anyway because a reader should not have to open the
 * schema to learn whether a hospital's invitation confers a licence. They then walk the
 * same verification flow as anybody who signed up alone, and the clinic watches it
 * happen without being able to touch it.
 *
 * 🔴 The expiry check and the terms check are both in the WHERE clause of the UPDATE
 * that claims the invitation, so an expired link and an unrendered-terms link both
 * simply fail to match. There is no branch to forget.
 */
export async function acceptInvitation(input: {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ ok?: true; userId?: string; error?: string }> {
  if (input.password.length < 12) return { error: "Use at least twelve characters." };
  if (!input.firstName.trim()) return { error: "Tell us your first name." };

  const [invitation] = await controlDb
    .select({
      id: clinicianInvitations.id,
      organizationId: clinicianInvitations.organizationId,
      email: clinicianInvitations.email,
      termsShownAt: clinicianInvitations.termsShownAt,
      expiresAt: clinicianInvitations.expiresAt,
    })
    .from(clinicianInvitations)
    .where(
      and(
        eq(clinicianInvitations.tokenHash, hashToken(input.token)),
        eq(clinicianInvitations.state, "sent"),
      ),
    )
    .limit(1);

  if (!invitation) return { error: "That invitation is no longer valid." };
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { error: "That invitation has expired. Ask the practice for a new one." };
  }
  if (!invitation.termsShownAt) {
    /*
     * 🔴 Unreachable through the screen, because `resolveInvitation` stamps this when
     * the page renders. Checked anyway: the database constraint would refuse the write
     * and the caller would see a constraint name, and this is a sentence instead.
     */
    return { error: "Open the invitation link again before accepting." };
  }

  /*
   * 🔴 A SEAT FIRST. The clinic buys one when it invites somebody with none
   * free; an invitation opened after the seats were reduced finds none, and
   * is told so rather than seated for free.
   */
  const { hasFreeSeat } = await import("@/lib/billing/seats");
  if (!(await hasFreeSeat(invitation.organizationId))) {
    return { error: "This practice has no free seat for you yet. Ask them to add one, then open the invitation again." };
  }

  let createdUserId: string | null = null;

  try {
    const [created] = await controlDb
      .insert(users)
      .values({
        organizationId: invitation.organizationId,
        email: invitation.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName.trim().slice(0, 80),
        lastName: input.lastName.trim().slice(0, 80),
        role: "therapist",
        /* 🔴 C267. The clinic's word is not evidence. */
        verificationStatus: "unverified",
      })
      .returning({ id: users.id });

    createdUserId = created?.id ?? null;
  } catch {
    return { error: "There is already an account with that email address here." };
  }

  if (!createdUserId) return { error: "That could not be completed. Try again." };

  const [claimed] = await controlDb
    .update(clinicianInvitations)
    .set({ state: "accepted", acceptedAt: new Date(), acceptedUserId: createdUserId })
    .where(
      and(
        eq(clinicianInvitations.id, invitation.id),
        /* Still `sent`: two taps on Accept cannot produce two clinicians. */
        eq(clinicianInvitations.state, "sent"),
      ),
    )
    .returning({ id: clinicianInvitations.id });

  if (!claimed) {
    log.warn("invitation accepted twice, second acceptance left a spare user");
    return { error: "That invitation has already been accepted." };
  }

  /*
   * 🔴 62.6 — the seat, and `ownOrganizationId: null` is the fact rather than a
   * placeholder.
   *
   * This branch creates the account. Somebody who has just been created has
   * never paid us for a month, so there is no period to wait out and the seat
   * starts costing the clinic today. The other branch, below, is where C355
   * actually bites.
   */
  const { takeSeat } = await import("@/lib/billing/seats");
  await takeSeat({
    organizationId: invitation.organizationId,
    userId: createdUserId,
    ownOrganizationId: null,
  });

  log.info("clinician accepted a clinic invitation");
  return { ok: true, userId: createdUserId };
}

/**
 * 🔴 62.6 / 62.7 / C355 / C329 — A CLINICIAN WHO ALREADY PAYS US JOINS A CLINIC.
 *
 * The branch above creates an account. This is the one the two rulings are
 * about: somebody who bought Practice three days ago, is invited by a clinic,
 * and must not end up paying twice or losing the month they bought.
 *
 *   - Their seat is not billable until THEIR period ends (`takeSeat`).
 *   - Their own subscription is cancelled AT PERIOD END, and the caller does it,
 *     because it is a network call and this is a write path.
 *
 * ## 🔴 THEY BRING NOTHING, AND A CASELOAD IS A REFUSAL RATHER THAN A MIGRATION
 *
 * Under C261 every patient, session and note belongs to the ORGANISATION, so
 * moving this person's row to the clinic would move their chart out from under
 * the grant each patient gave — the exact move sprints 26 and 27 built the
 * opposite mechanism for, where a PATIENT claims and moves their own record and
 * a clinician never moves it for them.
 *
 * `removeClinician` already settles the mirror image: a therapist who LEAVES
 * does not take the caseload with them. Letting one arrive with a caseload while
 * refusing to let them leave with it would be the same rule pointing two ways.
 *
 * So an account with patients on it is refused, in a sentence that says what to
 * do instead. It is a narrower product than a migration and it is the only
 * version of this that does not silently move clinical records across a tenancy
 * boundary because somebody accepted an invitation.
 */
export async function joinWithExistingAccount(input: {
  token: string;
  email: string;
  password: string;
}): Promise<{ ok?: true; userId?: string; cancelSubscriptionFor?: string; error?: string }> {
  const [invitation] = await controlDb
    .select({
      id: clinicianInvitations.id,
      organizationId: clinicianInvitations.organizationId,
      email: clinicianInvitations.email,
      termsShownAt: clinicianInvitations.termsShownAt,
      expiresAt: clinicianInvitations.expiresAt,
    })
    .from(clinicianInvitations)
    .where(
      and(
        eq(clinicianInvitations.tokenHash, hashToken(input.token)),
        eq(clinicianInvitations.state, "sent"),
      ),
    )
    .limit(1);

  if (!invitation) return { error: "That invitation is no longer valid." };
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { error: "That invitation has expired. Ask the practice for a new one." };
  }
  if (!invitation.termsShownAt) {
    return { error: "Open the invitation link again before accepting." };
  }

  const [existing] = await controlDb
    .select({
      id: users.id,
      organizationId: users.organizationId,
      passwordHash: users.passwordHash,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.email, input.email.trim().toLowerCase()), isNull(users.deletedAt)))
    .limit(1);

  /*
   * 🔴 One message for a wrong address, a wrong password and an account that is
   * not a clinician's, and the work is done either way. The same construction
   * `checkClinicPassword` uses below, for the same reason: a response that is
   * faster for an unknown address is an account enumerator, and this route is
   * reachable by anybody holding an invitation link.
   */
  if (!existing?.passwordHash || existing.role !== "therapist") {
    await hashPassword(input.password);
    return { error: "That email address and password do not match." };
  }

  if (!(await verifyPassword(input.password, existing.passwordHash))) {
    return { error: "That email address and password do not match." };
  }

  /*
   * 🔴 The caseload check, before anything is written. A clinician with patients
   * on their own account cannot be moved without moving records across a
   * tenancy, so they are refused here rather than half-migrated below.
   */
  const [carried] = await controlDb
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.organizationId, existing.organizationId))
    .limit(1);

  if (carried) {
    return {
      error:
        "This account already has patient records on it. Those stay with your own practice and cannot move to a clinic. Ask the practice to invite you on an address with no records, or ask each patient to move their own record across.",
    };
  }

  /* Claimed first, so two taps cannot move one person twice. */
  /*
   * 🔴 A SEAT FIRST. The clinic buys one when it invites somebody with none
   * free; an invitation opened after the seats were reduced finds none, and
   * is told so rather than seated for free.
   */
  const { hasFreeSeat } = await import("@/lib/billing/seats");
  if (!(await hasFreeSeat(invitation.organizationId))) {
    return { error: "This practice has no free seat for you yet. Ask them to add one, then open the invitation again." };
  }

  const [claimed] = await controlDb
    .update(clinicianInvitations)
    .set({ state: "accepted", acceptedAt: new Date(), acceptedUserId: existing.id })
    .where(
      and(
        eq(clinicianInvitations.id, invitation.id),
        eq(clinicianInvitations.state, "sent"),
      ),
    )
    .returning({ id: clinicianInvitations.id });

  if (!claimed) return { error: "That invitation has already been accepted." };

  /*
   * 🔴 THE SEAT BEFORE THE MOVE, because `ownOrganizationId` is the practice
   * whose period we are waiting for and the next statement overwrites it.
   */
  const { takeSeat } = await import("@/lib/billing/seats");
  await takeSeat({
    organizationId: invitation.organizationId,
    userId: existing.id,
    ownOrganizationId: existing.organizationId,
  });

  await controlDb
    .update(users)
    .set({ organizationId: invitation.organizationId, updatedAt: new Date() })
    .where(eq(users.id, existing.id));

  /*
   * 🔴 C352 — THE VERIFICATION ROW MOVES WITH THE PERSON.
   *
   * The statement above moved the clinician. Their verification did not, so it
   * went on pointing at the practice they left, and `reviewQueue` reads the
   * practice name off exactly that column.
   *
   * It is invisible for the ordinary case — an approved clinician is never in
   * the queue again — and it is not invisible for the case this whole path
   * exists for. A clinician rejected on their own account, then invited by a
   * practice, is still rejected: `isCleared` reads the verification state and
   * C267 is the rule that a practice's invitation is not evidence of a licence.
   * So they resubmit, from inside the practice, and the operator reviewing them
   * reads the name of a practice that has nothing to do with the application in
   * front of them.
   *
   * Their documents, their state and their rejection count all stay put, which
   * is the point: joining a practice is not a way to start again.
   */
  await controlDb
    .update(therapistVerifications)
    .set({ organizationId: invitation.organizationId, updatedAt: new Date() })
    .where(eq(therapistVerifications.userId, existing.id));

  log.info("clinician joined a clinic with an existing account", {
    org: ref(invitation.organizationId),
  });

  /*
   * 🔴 62.7 / C329 — returned rather than done, and the caller cancels.
   *
   * At period end, never immediately: they keep the month they bought. It is a
   * network call to a gateway, and a gateway having a bad afternoon must not
   * roll back a person's seat, so it happens after this returns and on its own.
   */
  return { ok: true, userId: existing.id, cancelSubscriptionFor: existing.organizationId };
}

/**
 * 🔴 54.11 / C266 — A THERAPIST LEAVES A CLINIC.
 *
 * > *A therapist leaving a clinic keeps their record of their own patients and loses
 * > the clinic's connections immediately.*
 *
 * ## 🔴 WHAT "KEEPS THEIR RECORD" MEANS, AND WHAT IT DOES NOT
 *
 * This reading is an interpretation and it is worth stating, because the other reading
 * is a serious breach. Under C261 every session on a clinic-attached account is the
 * CLINIC's, keyed on its organisation id along with the patients and the notes. So:
 *
 *   - **The clinic keeps the records.** They stay exactly where they are, still
 *     attributed to the clinician who wrote them. Nothing is deleted and nothing is
 *     rewritten, which is what "untouched" says.
 *   - **The clinician does NOT take the caseload with them.** Moving patient rows
 *     between tenancies would move a chart out from under the grant a patient gave,
 *     which sprints 26 and 27 built the opposite mechanism for: a PATIENT claims and
 *     moves their own record, and a clinician never moves it for them.
 *
 * The clinician gets a fresh organisation of one, which is what a solo practice already
 * is (C266), so they can keep working the same afternoon.
 *
 * ## 🔴 AND THE CONNECTIONS GO, IMMEDIATELY AND WITHOUT A QUESTION
 *
 * *Because the credential was the hospital's.* `ehr_connections` is sprint 43 and does
 * not exist yet; `meeting_connections` does, and it is the same argument: a Google or
 * Teams account connected inside a hospital's workspace is the hospital's, and a
 * clinician who leaves must not keep a token that creates meetings in it.
 */
export async function removeClinician(input: {
  clinicOrganizationId: string;
  userId: string;
}): Promise<{
  ok?: true;
  error?: string;
  /* W2-T05: for the email the caller sends. */
  clinicianEmail?: string;
  clinicName?: string | null;
}> {
  const [clinician] = await controlDb
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.id, input.userId),
        /* Theirs, in the WHERE. A borrowed user id removes nobody. */
        eq(users.organizationId, input.clinicOrganizationId),
        eq(users.role, "therapist"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!clinician) return { error: "That clinician is not on your account." };

  /*
   * 🔴 The connections FIRST, and the reparenting second.
   *
   * If the order were reversed, a crash between the two would leave a clinician in
   * their own new practice still holding a live token into the hospital's workspace,
   * which is the exact state C266 exists to prevent. This way a crash leaves them in
   * the clinic with no connection, which is recoverable and harmless.
   */
  await controlDb
    .update(meetingConnections)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(meetingConnections.userId, input.userId),
        eq(meetingConnections.organizationId, input.clinicOrganizationId),
        isNull(meetingConnections.revokedAt),
      ),
    );

  /*
   * 🔴 43.1b — AND THE EHR CONNECTION NEEDS NO LINE HERE, WHICH IS C266 PAYING OFF.
   *
   * *A therapist leaving a clinic loses that connection immediately, without a question, because
   * the credential was the hospital's.* That is already true the moment the reparenting below
   * runs, and it is true for a structural reason rather than because somebody remembered:
   * `ehr_connections` has no `user_id` at all, so every read of one goes through
   * `liveConnection(organizationId)`, and after the UPDATE their organisation is the new solo row
   * with no connection under it. There is nothing to revoke because there was never anything of
   * theirs to hold.
   *
   * 🔴 AND WRITING THE OBVIOUS LINE HERE WOULD BE THE WORSE BUG.
   *
   * `meeting_connections` is revoked above because a Zoom account genuinely is one person's. The
   * symmetric-looking edit — revoking `ehr_connections` for this organisation — would disconnect
   * the HOSPITAL because one therapist left, taking the note filing away from every other
   * clinician under it. `verify:sprint43` asserts both halves: the departing clinician resolves no
   * connection, AND the clinic's own connection is still live.
   */

  const name = [clinician.firstName, clinician.lastName].filter(Boolean).join(" ");
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "practice"}-${randomBytes(3).toString("hex")}`;

  const [solo] = await controlDb
    .insert(organizations)
    .values({
      name: name || clinician.email,
      slug,
      /* 🔴 `solo`, with no clinic state. An organisation of one, which is C266's phrase. */
      kind: "solo",
    })
    .returning({ id: organizations.id });

  if (!solo) return { error: "That could not be completed. Try again." };

  /*
   * 🔴 62.5 — THE SEAT IS RELEASED, AND NOT REFUNDED.
   *
   * Before the reparenting, so a crash between the two leaves a released seat on
   * a clinician still in the clinic, which costs the practice nothing and is
   * fixed by removing them again. The other order leaves a departed clinician
   * holding a billable seat in an organisation they are no longer in.
   *
   * The clinic keeps paying for the seat until the period ends, which is the
   * whole of C331: refunding here means a practice adds five seats on the first
   * of the month, removes them on the last, and pays for none of them.
   */
  const { releaseSeat } = await import("@/lib/billing/seats");
  await releaseSeat({
    organizationId: input.clinicOrganizationId,
    userId: input.userId,
  });

  await controlDb
    .update(users)
    .set({ organizationId: solo.id, updatedAt: new Date() })
    .where(eq(users.id, input.userId));

  /*
   * 🔴 W2-T05: AND THEY CAN GO ON WORKING, WHICH C266 PROMISED AND NOTHING DID.
   *
   * Three things `signUp` and `joinWithExistingAccount` each do and this did
   * not, so the practice of one was a practice in name only:
   *
   *   - The verification row moves with them, as it does on the way IN. Left
   *     behind, `reviewQueue` names the clinic they left on their next review.
   *   - A pay-as-you-go subscription, the row `signUp` writes, so C4's "lands
   *     on pay-as-you-go by themselves" is a row and not an absence.
   *   - A notice in their own app. They used to find out by signing in to an
   *     empty caseload. `formerSessions` is what they keep sight of.
   */
  await controlDb
    .update(therapistVerifications)
    .set({ organizationId: solo.id, updatedAt: new Date() })
    .where(eq(therapistVerifications.userId, input.userId));

  await controlDb
    .insert(subscriptions)
    .values({ organizationId: solo.id, plan: "payg", status: "active" });

  const [clinic] = await controlDb
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, input.clinicOrganizationId))
    .limit(1);

  await controlDb.insert(notifications).values({
    userId: input.userId,
    kind: "system",
    title: `You have left ${clinic?.name ?? "the practice"}`,
    body: "Your account is a practice of your own now, on pay as you go. The sessions you ran there are listed under Sessions; their notes stay with the practice.",
    actionUrl: "/sessions",
  });

  log.info("clinician left a clinic", { org: ref(input.clinicOrganizationId) });
  return { ok: true, clinicianEmail: clinician.email, clinicName: clinic?.name ?? null };
}

/**
 * Sign a clinic manager in.
 *
 * 🔴 One message for a wrong address and a wrong password, and the hash is computed
 * either way. The same construction as the clinician's and the sponsor's: a response
 * that is faster for an unknown address is an account enumerator, and this one's list
 * is which practices use us.
 */
export async function checkClinicPassword(
  email: string,
  password: string,
): Promise<{ clinicManagerId?: string; error?: string }> {
  const [manager] = await controlDb
    .select({
      id: clinicManagers.id,
      passwordHash: clinicManagers.passwordHash,
      kind: organizations.kind,
      clinicState: organizations.clinicState,
    })
    .from(clinicManagers)
    .innerJoin(organizations, eq(organizations.id, clinicManagers.organizationId))
    .where(
      and(eq(clinicManagers.email, email.trim().toLowerCase()), isNull(clinicManagers.deletedAt)),
    )
    .limit(1);

  if (!manager?.passwordHash) {
    await hashPassword(password);
    return { error: "That email address and password do not match." };
  }

  if (!(await verifyPassword(password, manager.passwordHash))) {
    return { error: "That email address and password do not match." };
  }

  /*
   * A held or suspended practice gets the same refusal, and deliberately not a helpful
   * one: "your practice is suspended" told to whoever holds the address is a fact about
   * a commercial relationship.
   */
  if (manager.kind !== "clinic" || manager.clinicState !== "active") {
    return { error: "That email address and password do not match." };
  }

  await controlDb
    .update(clinicManagers)
    .set({ lastSignInAt: new Date() })
    .where(eq(clinicManagers.id, manager.id));

  return { clinicManagerId: manager.id };
}

/** 54.3 — every clinic, for the admin queue. No clinician, no patient, no session. */
/*
 * 🔴 NOT EXPORTED. `clinicsForAdmin` below is the only reader, and an export with
 * one same-file caller is an API somebody calls instead of the one that carries the
 * counts and the managers.
 */
async function allClinics() {
  return controlDb
    .select({
      id: organizations.id,
      name: organizations.name,
      clinicState: organizations.clinicState,
      /* 🔴 74.6 — which of our companies bills them, and so how they pay. */
      region: organizations.region,
      contactName: organizations.contactName,
      contactEmail: organizations.contactEmail,
      contactPhone: organizations.contactPhone,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .where(and(eq(organizations.kind, "clinic"), isNull(organizations.deletedAt)))
    .orderBy(desc(organizations.createdAt));
}

/**
 * 🔴 74.6 — WHERE A PRACTICE BILLS FROM, SET BY AN OPERATOR.
 *
 * ⚠️ `organizations.region` has existed since C118 and nothing in the product
 * ever wrote it. Every practice was `us`, so `organizationNeedsTransfer` was
 * false for everybody and the whole Egyptian rail was unreachable.
 *
 * A solo clinician answers this for themselves on their own settings page: it
 * is their practice. A CLINIC's jurisdiction is not one clinician's to change,
 * and it is the answer that decides which of our companies invoices a roster of
 * colleagues, so it is an operator's, made once, with the registration document
 * in front of them.
 *
 * 🔴 Refused while money is outstanding. Moving the region under a due invoice
 * changes which rail that invoice is paid on and which company's books it is
 * in, after it was issued. Settle first, then move.
 */
export async function setClinicRegion(
  clinicOrganizationId: string,
  region: Region,
): Promise<{ ok?: true; error?: string }> {
  const [outstanding] = await controlDb
    .select({ n: sql<number>`count(*)::int` })
    .from(invoices)
    .where(
      and(eq(invoices.organizationId, clinicOrganizationId), eq(invoices.status, "due")),
    );

  if ((outstanding?.n ?? 0) > 0) {
    return {
      error: `They have ${outstanding!.n} unpaid invoices. Moving the region now would change which rail those are paid on after we issued them. Settle them first.`,
    };
  }

  const moved = await controlDb
    .update(organizations)
    .set({ region, updatedAt: new Date() })
    .where(and(eq(organizations.id, clinicOrganizationId), eq(organizations.kind, "clinic")))
    .returning({ id: organizations.id });

  if (moved.length === 0) return { error: "That is not a clinic." };

  log.info("clinic region changed", { org: ref(clinicOrganizationId), region });
  return { ok: true };
}

/**
 * 🔴 63.4 / C325 — WHAT OUR BACK OFFICE READS ABOUT A PRACTICE, AND WHY IT IS HERE.
 *
 * Sprint 63 made every function in `lib/data/clinic.ts` take a `ClinicPrincipal` and
 * check a capability on the resource. The admin console is not a clinic principal: it
 * is `super_admin`, which is ours, and it was calling two of those functions with a
 * bare organisation id.
 *
 * The tempting fix is a synthetic principal with every capability. That is a back door
 * with a friendly name: any call site could then construct one, and the capability
 * check that the whole sprint rests on would be a function anybody can satisfy by
 * writing an object literal.
 *
 * So the back office reads from HERE, through `requireRole("super_admin")`, with its
 * own select list. Two principals, two doors, and neither can be mistaken for the
 * other in a diff.
 *
 * 🔴 A COUNT AND NOT A LIST. An operator needs to know whether an onboarding stalled;
 * a list of a customer's clinicians is what somebody screenshots for the customer who
 * asked for it. The managers ARE listed, because managing them is what this screen is
 * for and they are the practice's administrative contacts rather than its clinicians.
 */
export async function clinicsForAdmin() {
  const clinics = await allClinics();
  if (clinics.length === 0) return [];

  const ids = clinics.map((clinic) => clinic.id);

  const counts = await controlDb
    .select({
      organizationId: users.organizationId,
      clinicians: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(
      and(
        inArray(users.organizationId, ids),
        eq(users.role, "therapist"),
        isNull(users.deletedAt),
      ),
    )
    .groupBy(users.organizationId);

  const managers = await controlDb
    .select({
      id: clinicManagers.id,
      organizationId: clinicManagers.organizationId,
      email: clinicManagers.email,
      role: clinicManagers.role,
    })
    .from(clinicManagers)
    .where(and(inArray(clinicManagers.organizationId, ids), isNull(clinicManagers.deletedAt)))
    .orderBy(asc(clinicManagers.email));

  const countBy = new Map(counts.map((row) => [row.organizationId, Number(row.clinicians)]));

  return clinics.map((clinic) => ({
    ...clinic,
    clinicianCount: countBy.get(clinic.id) ?? 0,
    managers: managers
      .filter((manager) => manager.organizationId === clinic.id)
      .map((manager) => ({ id: manager.id, email: manager.email, role: manager.role })),
  }));
}
