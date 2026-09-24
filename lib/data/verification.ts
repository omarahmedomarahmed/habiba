import "server-only";

import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";

import type { Actor } from "@/lib/auth/session";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { organizations, therapistVerifications, users } from "@/lib/db/schema";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/data/verification.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * The verification gate.
 *
 * A clinician can look around the product before they are verified — seeing
 * what they signed up for is reasonable — but they cannot run a session, go on
 * the radar, or take money until an administrator has seen who they are.
 *
 * The gate is enforced in two places on purpose: `requireVerified()` in the
 * actions that matter, and a redirect in the app shell so nobody wanders into a
 * page that will refuse them. The redirect is UX; the guard is the boundary.
 */

/*
 * Document requirements moved to `lib/regulators.ts`.
 *
 * They have to run in the browser: the onboarding form relabels the upload
 * slots the instant a country is chosen, and a server round trip to find out
 * which ID we want is a step nobody should have to take. Re-exported here so
 * server callers keep their import.
 */
export { documentRequirements, type DocumentRequirement } from "@/lib/regulators";

/**
 * 20.4 / 20.5 — the per-country requirements an administrator has configured.
 *
 * Read once on the server and handed to the onboarding form as a map, because
 * the form has to relabel the instant a country is picked and a round trip
 * there means a clinician photographing the wrong document.
 */
export async function requirementOverrides(): Promise<
  import("@/lib/regulators").RequirementOverrides
> {
  const { getCountries } = await import("@/lib/settings");
  const countries = await getCountries();

  return Object.fromEntries(
    countries.map((country) => [
      country.code,
      {
        regulators: country.regulators,
        idLabelFront: country.idLabelFront,
        idLabelBack: country.idLabelBack,
        licenceLabel: country.licenceLabel,
        sampleImageUrl: country.sampleImageUrl,
      },
    ]),
  );
}

/**
 * Where a clinician stands, as one answer.
 *
 * ## 🔴 C285 — THERE IS ONE SOURCE OF TRUTH AND IT IS THE ONE THE DATABASE ENFORCES
 *
 * There were two, and they disagreed: an administrator pressing "verified" on the clinician list
 * wrote `users.verification_status`, while the gate read `therapist_verifications.state`.
 *
 * The first fix wrote both columns and made THIS function resolve a disagreement in the clinician's
 * favour:
 *
 *     if (row.mirror === "verified") return "approved";
 *
 * so the soft column won. The reasoning was humane — a clinician should not be locked out by a stale
 * mirror — and the consequence was that **anybody with "verified" written onto their user row was
 * cleared to see patients whether or not a human had ever approved them.** A tie-break that favours
 * access is a tie-break that favours the unverified, and `history_grants_require_verified()` was
 * left as the only thing in the system saying so.
 *
 * 0083 makes `users.verification_status` a DERIVED column the database maintains, so there is
 * nothing left to disagree with. This reads the truth directly anyway: a function that answers "is
 * this clinician cleared" should not be reading a cache of the answer, however well maintained,
 * because the cache is the thing that was wrong for thirteen sprints.
 */
export async function practiceState(
  userId: string,
): Promise<"draft" | "submitted" | "approved" | "rejected" | null> {
  const [row] = await db
    .select({
      userId: users.id,
      state: therapistVerifications.state,
    })
    .from(users)
    .leftJoin(therapistVerifications, eq(therapistVerifications.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return null;
  return row.state ?? null;
}

export async function getVerification(userId: string) {
  const [row] = await db
    .select()
    .from(therapistVerifications)
    .where(eq(therapistVerifications.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function ensureVerification(actor: Actor) {
  const existing = await getVerification(actor.userId);
  if (existing) return existing;

  await db
    .insert(therapistVerifications)
    .values({ userId: actor.userId, organizationId: actor.organizationId, state: "draft" })
    .onConflictDoNothing({ target: therapistVerifications.userId });

  return (await getVerification(actor.userId))!;
}

/**
 * What is still missing, in the order the form asks for it.
 *
 * Returned as a list rather than a boolean so the onboarding page can show
 * progress. "You are not verified" with no indication of what is wrong is the
 * single most common way an onboarding flow gets abandoned.
 */
export function missingFrom(row: {
  country: string | null;
  licenseBody: string | null;
  licenseNumber: string | null;
  specialties: string[];
  languages: string[];
  idFrontUrl: string | null;
  licenseDocUrl: string | null;
  headshotUrl: string | null;
}): string[] {
  const missing: string[] = [];
  if (!row.country) missing.push("Country");
  if (!row.licenseBody?.trim()) missing.push("Regulator or licensing body");
  if (!row.licenseNumber?.trim()) missing.push("Licence number");
  if (row.specialties.length === 0) missing.push("At least one specialty");
  if (row.languages.length === 0) missing.push("At least one language");
  if (!row.idFrontUrl) missing.push("Photo ID");
  if (!row.licenseDocUrl) missing.push("Licence document");
  if (!row.headshotUrl) missing.push("Headshot");
  return missing;
}

/**
 * Can this clinician see patients yet?
 *
 * Super admins are exempt: they are us, and locking the operator out of the
 * product they operate helps nobody.
 */
export function isCleared(actor: Actor, state: string | null): boolean {
  return actor.role === "super_admin" || state === "approved";
}

/* --------------------------------------------------------------- admin -- */

export async function reviewQueue(state: "submitted" | "approved" | "rejected" = "submitted") {
  return db
    .select({
      id: therapistVerifications.id,
      userId: therapistVerifications.userId,
      state: therapistVerifications.state,
      country: therapistVerifications.country,
      licenseBody: therapistVerifications.licenseBody,
      licenseNumber: therapistVerifications.licenseNumber,
      licenseExpiry: therapistVerifications.licenseExpiry,
      /* W1-16: set when the sweep sent an approved clinician back for re-review. */
      licenseExpiredAt: therapistVerifications.licenseExpiredAt,
      /* W1-23: a licence change waiting on an approved clinician. */
      pendingLicence: therapistVerifications.pendingLicence,
      recheckSubmittedAt: therapistVerifications.recheckSubmittedAt,
      specialties: therapistVerifications.specialties,
      languages: therapistVerifications.languages,
      idFrontUrl: therapistVerifications.idFrontUrl,
      idBackUrl: therapistVerifications.idBackUrl,
      licenseDocUrl: therapistVerifications.licenseDocUrl,
      headshotUrl: therapistVerifications.headshotUrl,
      submittedAt: therapistVerifications.submittedAt,
      reviewNote: therapistVerifications.reviewNote,
      /*
       * 🔴 C351 — a reviewer should know they are the second, before they
       * decide rather than after. This is the whole reason the count is not
       * merely an internal gate: the operator whose "no" removes somebody's
       * documents is entitled to see that their "no" is the one that does it.
       */
      rejectionCount: therapistVerifications.rejectionCount,
      documentsClearedAt: therapistVerifications.documentsClearedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      organizationName: organizations.name,
    })
    .from(therapistVerifications)
    .innerJoin(users, eq(users.id, therapistVerifications.userId))
    .leftJoin(organizations, eq(organizations.id, therapistVerifications.organizationId))
    .where(waitingOn(state))
    .orderBy(desc(sql`COALESCE(${therapistVerifications.recheckSubmittedAt}, ${therapistVerifications.submittedAt})`))
    .limit(100);
}

/**
 * The "submitted" tab is everything waiting on an operator: new submissions,
 * and (W1-23) licence changes asked for by clinicians who stay approved.
 */
function waitingOn(state: "submitted" | "approved" | "rejected") {
  return state === "submitted"
    ? or(
        eq(therapistVerifications.state, "submitted"),
        isNotNull(therapistVerifications.recheckSubmittedAt),
      )
    : eq(therapistVerifications.state, state);
}

export async function pendingReviewCount(): Promise<number> {
  const rows = await db
    .select({ id: therapistVerifications.id })
    .from(therapistVerifications)
    .where(waitingOn("submitted"));
  return rows.length;
}

/**
 * Approve or reject.
 *
 * The conditional on `state = 'submitted'` means two administrators clicking at
 * once produce one decision, not two contradictory audit entries.
 */
/**
 * 🔴 C351 — how many rejections before the documents have to be new.
 *
 * Two. The first rejection is a correction: the licence photo was cut off, the
 * name did not match, send it again. The second is a decision, and a decision a
 * person can undo by pressing a button they have already pressed is not one.
 */
export const REJECTIONS_BEFORE_REAPPLYING = 2;

export async function decideVerification(opts: {
  verificationId: string;
  approve: boolean;
  note: string;
  adminUserId: string;
}): Promise<{
  userId: string;
  rejectionCount: number;
  documentsCleared: boolean;
  /** W1-23: this decided a licence change on an approved clinician. */
  recheck?: boolean;
} | null> {
  const now = new Date();

  const [row] = await db
    .update(therapistVerifications)
    .set({
      state: opts.approve ? "approved" : "rejected",
      reviewedAt: now,
      reviewedBy: opts.adminUserId,
      reviewNote: opts.note.trim() || null,
      /*
       * 🔴 C351 — the count moves inside the same UPDATE that makes the
       * decision, and it reads the column rather than a number this process
       * loaded a moment ago. Two operators clearing the queue at once is the
       * ordinary case, not the exotic one, and `count + 1` computed in
       * JavaScript is how the second decision overwrites the first.
       */
      rejectionCount: opts.approve
        ? sql`${therapistVerifications.rejectionCount}`
        : sql`${therapistVerifications.rejectionCount} + 1`,
      /*
       * 🔴 W1-16: an approval is a fresh look at the licence, so the sweep's
       * two stamps start again. A rejection leaves them, as evidence.
       */
      ...(opts.approve ? { licenseExpiredAt: null, licenseExpiryWarnedAt: null } : {}),
      // W1-23: a change asked for before the licence lapsed is decided with it.
      pendingLicence: null,
      recheckSubmittedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(therapistVerifications.id, opts.verificationId),
        eq(therapistVerifications.state, "submitted"),
      ),
    )
    .returning({
      userId: therapistVerifications.userId,
      rejectionCount: therapistVerifications.rejectionCount,
      idFrontUrl: therapistVerifications.idFrontUrl,
      idBackUrl: therapistVerifications.idBackUrl,
      licenseDocUrl: therapistVerifications.licenseDocUrl,
      headshotUrl: therapistVerifications.headshotUrl,
    });

  if (!row) return decideRecheck(opts, now);

  /*
   * 🔴 C351 — THE SECOND NO TAKES THE DOCUMENTS WITH IT.
   *
   * Two things happen here and they are the same thing seen from two sides.
   *
   * From the queue's side it closes the loop `submitForReview` left open: that
   * function asks whether every field is filled in and never whether anything
   * changed, so a rejected applicant could resubmit the identical unreadable
   * licence indefinitely. With the columns empty, `missingFrom` reports them
   * missing and the resubmission is refused by the check that was already
   * there — no new branch, no second rule to keep in step with the first.
   *
   * From the applicant's side it is retention. 29.1 is the whole argument: we
   * are holding a stranger's passport, and once we have twice decided it does
   * not clear them there is no reason left to hold it. The blobs go too, not
   * just the columns; a row pointing at nothing while the file sits in storage
   * is the version of this that looks done and is not.
   *
   * An approval clears nothing. The documents are the evidence for the decision
   * and outlive it.
   */
  const cleared = !opts.approve && row.rejectionCount >= REJECTIONS_BEFORE_REAPPLYING;

  if (cleared) {
    const { deleteDocument } = await import("@/lib/uploads");
    await Promise.all(
      [row.idFrontUrl, row.idBackUrl, row.licenseDocUrl, row.headshotUrl].map((url) =>
        deleteDocument(url),
      ),
    );

    await db
      .update(therapistVerifications)
      .set({
        idFrontUrl: null,
        idBackUrl: null,
        licenseDocUrl: null,
        headshotUrl: null,
        documentsClearedAt: now,
        updatedAt: now,
      })
      .where(eq(therapistVerifications.id, opts.verificationId));
  }

  /*
   * 🔴 C285 — THE MIRROR WRITE IS GONE, AND ITS ABSENCE IS THE FIX.
   *
   * This used to update `users.verification_status` by hand, with a comment explaining that it kept
   * the clinician list and the radar profile in agreement with the decision. It did, for this one
   * code path. Every other way a user row came into being — a seed, a clinic invitation, a script —
   * set the column independently, and nothing reconciled them.
   *
   * 0083's `therapist_verifications_sync_user` trigger does it now, for every path there is and
   * every path there will be. A mirror maintained by whoever remembers to maintain it is not a
   * mirror; it is a second opinion.
   */
  return { userId: row.userId, rejectionCount: row.rejectionCount, documentsCleared: cleared };
}

/**
 * 🔴 W1-23: deciding a licence change on a clinician who is already approved.
 *
 * The row stays `approved` throughout, so the clinician was cleared while this
 * waited. An approval writes the new details into the checked columns (and the
 * profile fields patients read), and is a fresh look at the licence, so the
 * expiry stamps start again. A rejection drops the request and keeps what was
 * checked before. Conditional on the request still being there, so two
 * operators produce one decision.
 */
async function decideRecheck(
  opts: { verificationId: string; approve: boolean; note: string; adminUserId: string },
  now: Date,
): Promise<{ userId: string; rejectionCount: number; documentsCleared: boolean; recheck: true } | null> {
  const waiting = and(
    eq(therapistVerifications.id, opts.verificationId),
    eq(therapistVerifications.state, "approved"),
    isNotNull(therapistVerifications.recheckSubmittedAt),
  );
  const [row] = await db.select().from(therapistVerifications).where(waiting).limit(1);
  if (!row) return null;

  const change = row.pendingLicence ?? {};
  const checked = opts.approve
    ? {
        ...(change.country !== undefined ? { country: change.country } : {}),
        ...(change.licenseBody !== undefined ? { licenseBody: change.licenseBody } : {}),
        ...(change.licenseNumber !== undefined ? { licenseNumber: change.licenseNumber } : {}),
        ...(change.licenseExpiry !== undefined ? { licenseExpiry: change.licenseExpiry } : {}),
        licenseExpiredAt: null,
        licenseExpiryWarnedAt: null,
      }
    : {};

  const [landed] = await db
    .update(therapistVerifications)
    .set({
      ...checked,
      pendingLicence: null,
      recheckSubmittedAt: null,
      reviewedAt: now,
      reviewedBy: opts.adminUserId,
      reviewNote: opts.note.trim() || null,
      updatedAt: now,
    })
    .where(waiting)
    .returning({ userId: therapistVerifications.userId });
  if (!landed) return null;

  const profileFields = (["credentials", "licenseType", "licenseState", "licenseNumber"] as const).filter(
    (key) => change[key] !== undefined,
  );
  if (opts.approve && profileFields.length > 0) {
    const [user] = await db
      .select({ profile: users.profile })
      .from(users)
      .where(eq(users.id, landed.userId))
      .limit(1);
    const profile = { ...(user?.profile ?? {}) };
    for (const key of profileFields) profile[key] = change[key] ?? undefined;
    await db.update(users).set({ profile, updatedAt: now }).where(eq(users.id, landed.userId));
  }

  return { userId: landed.userId, rejectionCount: row.rejectionCount, documentsCleared: false, recheck: true };
}
