"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import { safeImageUrl } from "@/lib/content/url";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  heartbeat,
  pendingBooking,
  saveRadarProfile,
  setOnline,
  type RadarAttention,
} from "@/lib/data/radar";
import { RADAR_LANGUAGES, RADAR_SPECIALTIES } from "@/lib/geo";

export type RadarState = { error?: string; ok?: boolean };

export async function saveRadarSetup(
  _prev: RadarState,
  formData: FormData,
): Promise<RadarState> {
  const actor = await requireUser();

  // Allowlists, not free text. These strings are rendered on a public page to
  // anonymous visitors, so "whatever the form sent" is not an option.
  const languages = formData
    .getAll("languages")
    .map(String)
    .filter((value) => (RADAR_LANGUAGES as readonly string[]).includes(value));

  const specialties = formData
    .getAll("specialties")
    .map(String)
    .filter((value) => (RADAR_SPECIALTIES as readonly string[]).includes(value));

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
  const actor = await requireUser();
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
