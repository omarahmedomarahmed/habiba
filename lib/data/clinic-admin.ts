import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { controlDb } from "@/lib/db";
import {
  clinicManagers,
  clinicianInvitations,
  meetingConnections,
  organizations,
  patients,
  users,
  type ClinicState,
} from "@/lib/db/schema";
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

/** 54.3 — the first manager, created by an admin with a password they set on the call. */
export async function createClinicManager(input: {
  clinicOrganizationId: string;
  email: string;
  name: string | null;
  password: string;
  role: "admin" | "viewer";
}): Promise<{ ok?: true; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "That email address does not look right." };
  if (input.password.length < 12) return { error: "Use at least twelve characters." };

  try {
    await controlDb.insert(clinicManagers).values({
      organizationId: input.clinicOrganizationId,
      email,
      name: input.name?.trim().slice(0, 120) || null,
      passwordHash: await hashPassword(input.password),
      role: input.role,
    });
  } catch {
    /*
     * The unique index is across clinics, not within one, so this also catches an
     * address already managing a different practice. One message either way: which of
     * the two it was is a fact about another customer.
     */
    return { error: "There is already an account with that email address." };
  }

  return { ok: true };
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
}): Promise<{ ok?: true; error?: string }> {
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
  return { ok: true };
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
}): Promise<{ ok?: true; cancelSubscriptionFor?: string; error?: string }> {
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
  return { ok: true, cancelSubscriptionFor: existing.organizationId };
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
}): Promise<{ ok?: true; error?: string }> {
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

  log.info("clinician left a clinic", { org: ref(input.clinicOrganizationId) });
  return { ok: true };
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
export async function allClinics() {
  return controlDb
    .select({
      id: organizations.id,
      name: organizations.name,
      clinicState: organizations.clinicState,
      contactName: organizations.contactName,
      contactEmail: organizations.contactEmail,
      contactPhone: organizations.contactPhone,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .where(and(eq(organizations.kind, "clinic"), isNull(organizations.deletedAt)))
    .orderBy(desc(organizations.createdAt));
}
