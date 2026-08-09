"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireUser, requireVerified } from "@/lib/auth/guard";
import { safeImageUrl } from "@/lib/content/url";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  getRadarProfile,
  heartbeat,
  pendingBooking,
  saveRadarProfile,
  setOnline,
  type RadarAttention,
} from "@/lib/data/radar";
import { validateSelections } from "@/lib/data/taxonomy";

export type RadarState = { error?: string; ok?: boolean };

export async function saveRadarSetup(
  _prev: RadarState,
  formData: FormData,
): Promise<RadarState> {
  const actor = await requireUser();

  /*
   * Allowlists, not free text — and the allowlist is now admin-controlled, so
   * it can shrink. What they already had is passed as `keep` so that a country
   * or language being retired never quietly strips it from a live profile.
   */
  const existing = await getRadarProfile(actor.userId);

  const languages = await validateSelections(
    "language",
    formData.getAll("languages").map(String),
    existing?.languages ?? [],
  );

  const specialties = await validateSelections(
    "specialty",
    formData.getAll("specialties").map(String),
    existing?.specialties ?? [],
  );

  const headline = String(formData.get("headline") ?? "").trim().slice(0, 240);
  const country = String(formData.get("country") ?? "").trim().slice(0, 2).toUpperCase();

  // Same URL guard as the CMS uses. A clinician-supplied image URL lands in an
  // `src` on a public page; anything that can break out of the attribute is a
  // stored-XSS hole on the marketing origin.
  const photoUrl = safeImageUrl(String(formData.get("photoUrl") ?? ""));

  await saveRadarProfile(actor, {
    headline: headline || null,
    photoUrl,
    languages,
    specialties,
    country: country || null,
  });

  revalidatePath("/on-call");
  return { ok: true };
}

export async function toggleRadar(online: boolean): Promise<RadarState> {
  // Going on the radar advertises you to strangers in crisis. Not before an
  // administrator has seen a licence.
  const actor = online ? await requireVerified() : await requireUser();
  const result = await setOnline(actor, online);
  if (result.error) return result;

  await audit({
    actor,
    category: "admin",
    action: online ? "radar.online" : "radar.offline",
    resourceType: "user",
    resourceId: actor.userId,
  });

  revalidatePath("/on-call");
  return { ok: true };
}

/**
 * Called by the console every half-minute while the clinician is online, and
 * polled for an incoming booking at the same time.
 *
 * One round trip does both jobs on purpose: a heartbeat that can succeed while
 * the booking check fails would leave someone advertised as available and deaf
 * to the alarm.
 */
export async function radarPing(): Promise<{ attention: RadarAttention | null }> {
  const actor = await requireUser();
  await heartbeat(actor.userId);
  return { attention: await pendingBooking(actor.userId) };
}

/**
 * Which radar events ring.
 *
 * Stored on the profile jsonb, read-modify-write like every other writer to
 * that column — two forms writing one document must both merge or one silently
 * deletes the other's fields.
 */
export async function saveAlertPreferences(input: {
  alertOnView: boolean;
  alertOnBooking: boolean;
}): Promise<RadarState> {
  const actor = await requireUser();

  const [existing] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);

  await db
    .update(users)
    .set({
      profile: {
        ...(existing?.profile ?? {}),
        alertOnView: input.alertOnView,
        alertOnBooking: input.alertOnBooking,
      },
      updatedAt: new Date(),
    })
    .where(eq(users.id, actor.userId));

  revalidatePath("/on-call");
  return { ok: true };
}
