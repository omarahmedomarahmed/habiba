import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { organizations, therapistVerifications, users } from "@/lib/db/schema";

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

/** Documents differ by country. This is what we ask for, and why. */
export type DocumentRequirement = {
  key: "idFront" | "idBack" | "licenseDoc" | "headshot";
  label: string;
  hint: string;
  required: boolean;
};

export function documentRequirements(country: string | null): DocumentRequirement[] {
  const idLabel =
    country === "EG"
      ? "National ID (البطاقة) — front"
      : country === "US"
        ? "Driver's licence or passport — front"
        : "Government ID — front";

  return [
    {
      key: "idFront",
      label: idLabel,
      hint: "A clear photo. All four corners visible, no glare over the text.",
      required: true,
    },
    {
      key: "idBack",
      label: "Government ID — back",
      // A passport has no back; demanding one produces a photo of nothing.
      hint: "Skip this if you uploaded a passport page.",
      required: false,
    },
    {
      key: "licenseDoc",
      label: "Practising licence or registration certificate",
      hint: "Whatever your regulator issues — a syndicate card, a licence, a registration certificate.",
      required: true,
    },
    {
      key: "headshot",
      label: "Professional headshot",
      hint: "This one is public: it appears on your radar profile. Plain background, your face clearly visible.",
      required: true,
    },
  ];
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
      specialties: therapistVerifications.specialties,
      languages: therapistVerifications.languages,
      idFrontUrl: therapistVerifications.idFrontUrl,
      idBackUrl: therapistVerifications.idBackUrl,
      licenseDocUrl: therapistVerifications.licenseDocUrl,
      headshotUrl: therapistVerifications.headshotUrl,
      submittedAt: therapistVerifications.submittedAt,
      reviewNote: therapistVerifications.reviewNote,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      organizationName: organizations.name,
    })
    .from(therapistVerifications)
    .innerJoin(users, eq(users.id, therapistVerifications.userId))
    .leftJoin(organizations, eq(organizations.id, therapistVerifications.organizationId))
    .where(eq(therapistVerifications.state, state))
    .orderBy(desc(therapistVerifications.submittedAt))
    .limit(100);
}

export async function pendingReviewCount(): Promise<number> {
  const rows = await db
    .select({ id: therapistVerifications.id })
    .from(therapistVerifications)
    .where(eq(therapistVerifications.state, "submitted"));
  return rows.length;
}

/**
 * Approve or reject.
 *
 * The conditional on `state = 'submitted'` means two administrators clicking at
 * once produce one decision, not two contradictory audit entries.
 */
export async function decideVerification(opts: {
  verificationId: string;
  approve: boolean;
  note: string;
  adminUserId: string;
}): Promise<{ userId: string } | null> {
  const [row] = await db
    .update(therapistVerifications)
    .set({
      state: opts.approve ? "approved" : "rejected",
      reviewedAt: new Date(),
      reviewedBy: opts.adminUserId,
      reviewNote: opts.note.trim() || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(therapistVerifications.id, opts.verificationId),
        eq(therapistVerifications.state, "submitted"),
      ),
    )
    .returning({ userId: therapistVerifications.userId });

  if (!row) return null;

  // Mirror onto the user so every existing read of `verificationStatus` — the
  // clinician list, the radar profile — agrees with the decision.
  await db
    .update(users)
    .set({
      verificationStatus: opts.approve ? "verified" : "rejected",
      updatedAt: new Date(),
    })
    .where(eq(users.id, row.userId));

  return row;
}
