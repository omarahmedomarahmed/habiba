import "server-only";

import { and, eq } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { dbFor } from "@/lib/db";
import {
  therapistVerifications,
  users,
  type PendingLicence,
  type TherapistProfile,
} from "@/lib/db/schema";

/**
 * 🔴 W1-23: a licence change after approval goes through review.
 *
 * Two forms wrote licence details straight onto an approved clinician: the
 * profile in /settings (credentials, licence type, region, number, all shown to
 * patients) and the onboarding form (regulator, number, expiry, the ones an
 * operator checked). Patients meanwhile read "Licence checked".
 *
 * Once a verification is submitted or approved those fields are locked. A
 * change is a request: `pending_licence` holds the new details and
 * `recheck_submitted_at` puts the row in the operator's queue, while the state
 * stays `approved` so the clinician stays cleared until the operator decides.
 * An approval moves the details in (`decideVerification`); a rejection drops
 * them. The one exception is an EXPIRED licence (W1-16): that row is already
 * back in review and not cleared, and its renewal is written in place.
 */

type Verification = {
  state: string;
  licenseExpiredAt: Date | null;
} | null;

/** Whether the licence fields are no longer the clinician's to write. */
export function licenceLocked(v: Verification): boolean {
  if (!v) return false;
  if (v.licenseExpiredAt) return false;
  return v.state === "submitted" || v.state === "approved";
}

async function verificationOf(actor: Actor) {
  const db = dbFor(actor.region);
  const [row] = await db
    .select()
    .from(therapistVerifications)
    .where(eq(therapistVerifications.userId, actor.userId))
    .limit(1);
  return { db, row: row ?? null };
}

export type ProfileInput = {
  firstName: string;
  lastName: string;
  credentials: string;
  licenseType: string;
  licenseNumber: string;
  licenseState: string;
};

/**
 * The /settings profile. Names always; the four licence fields only while the
 * verification is not yet submitted. Once locked, what was sent for them is
 * ignored and the stored values stand: the form shows them read-only.
 */
export async function writeProfile(
  actor: Actor,
  input: ProfileInput,
): Promise<{ ok: true; licenceLocked: boolean }> {
  const { db, row } = await verificationOf(actor);
  const locked = licenceLocked(row);

  const [existing] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);
  const before = existing?.profile ?? {};

  const profile: TherapistProfile = locked
    ? before
    : {
        ...before,
        credentials: input.credentials.trim() || undefined,
        licenseType: input.licenseType.trim() || undefined,
        licenseNumber: input.licenseNumber.trim() || undefined,
        licenseState: input.licenseState.trim() || undefined,
      };

  await db
    .update(users)
    .set({ firstName: input.firstName, lastName: input.lastName.trim(), profile, updatedAt: new Date() })
    .where(eq(users.id, actor.userId));
  return { ok: true, licenceLocked: locked };
}

export type DetailsInput = {
  country: string | null;
  licenseBody: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  specialties: string[];
  languages: string[];
};

/**
 * The onboarding form's text half. Before submission it writes as it always
 * did. While submitted it is refused. After approval, languages and
 * specialties still save, and a changed licence field becomes a request.
 */
export async function writeVerificationDetails(
  actor: Actor,
  input: DetailsInput,
): Promise<{ ok: true; held: boolean } | { ok: false; reason: "under_review" }> {
  const { db, row } = await verificationOf(actor);
  if (row?.state === "submitted" && !row.licenseExpiredAt) {
    return { ok: false, reason: "under_review" };
  }

  if (row?.state === "approved") {
    await db
      .update(therapistVerifications)
      .set({ specialties: input.specialties, languages: input.languages, updatedAt: new Date() })
      .where(eq(therapistVerifications.userId, actor.userId));

    const change: PendingLicence = {};
    if (input.country !== row.country) change.country = input.country;
    if (input.licenseBody !== row.licenseBody) change.licenseBody = input.licenseBody;
    if (input.licenseNumber !== row.licenseNumber) change.licenseNumber = input.licenseNumber;
    if (input.licenseExpiry !== row.licenseExpiry) change.licenseExpiry = input.licenseExpiry;
    if (Object.keys(change).length === 0) return { ok: true, held: false };

    const asked = await requestLicenceChange(actor, change);
    return { ok: true, held: asked.ok };
  }

  await db
    .update(therapistVerifications)
    .set({
      ...input,
      // Editing after a rejection puts it back in draft, so the queue does not
      // show a stale "rejected" for someone actively fixing it.
      state: row?.state === "rejected" ? "draft" : (row?.state ?? "draft"),
      updatedAt: new Date(),
    })
    .where(eq(therapistVerifications.userId, actor.userId));
  return { ok: true, held: false };
}

/**
 * What the change form opens with: a waiting request's details over the
 * checked ones, so a clinician sees what they asked for rather than losing it.
 */
export async function licenceChangeView(actor: Actor) {
  const { db, row } = await verificationOf(actor);
  const [me] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);
  const asked = row?.pendingLicence ?? {};
  const pick = (key: keyof PendingLicence, now: string | null | undefined) =>
    (key in asked ? asked[key] : now) ?? "";
  return {
    initial: {
      licenseBody: pick("licenseBody", row?.licenseBody),
      licenseNumber: pick("licenseNumber", row?.licenseNumber),
      licenseExpiry: pick("licenseExpiry", row?.licenseExpiry),
      credentials: pick("credentials", me?.profile?.credentials),
      licenseType: pick("licenseType", me?.profile?.licenseType),
      licenseState: pick("licenseState", me?.profile?.licenseState),
    },
    pending: Boolean(row?.recheckSubmittedAt),
    reviewNote: row?.state === "approved" ? (row.reviewNote ?? null) : null,
  };
}

/**
 * Ask for a licence change on an approved verification. Merged over any
 * change already waiting, so two edits before the operator looks are one
 * request. The clinician stays cleared.
 */
export async function requestLicenceChange(
  actor: Actor,
  change: PendingLicence,
): Promise<{ ok: true } | { ok: false; reason: "not_approved" | "no_change" }> {
  const clean = Object.fromEntries(
    Object.entries(change)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim().slice(0, 160) || null : null]),
  ) as PendingLicence;
  if (Object.keys(clean).length === 0) return { ok: false, reason: "no_change" };

  const { db, row } = await verificationOf(actor);
  if (!row || row.state !== "approved") return { ok: false, reason: "not_approved" };

  const now = new Date();
  const [landed] = await db
    .update(therapistVerifications)
    .set({
      pendingLicence: { ...(row.pendingLicence ?? {}), ...clean },
      recheckSubmittedAt: now,
      reviewNote: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(therapistVerifications.userId, actor.userId),
        eq(therapistVerifications.state, "approved"),
      ),
    )
    .returning({ id: therapistVerifications.id });
  if (!landed) return { ok: false, reason: "not_approved" };

  await audit({
    actor,
    category: "auth",
    action: "verification.licence_change",
    resourceType: "verification",
    resourceId: landed.id,
    reason: Object.keys(clean).join(", "),
  });
  return { ok: true };
}
