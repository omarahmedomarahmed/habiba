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
/**
 * One request: stay on the radar, and find out who is knocking.
 *
 * It also returns the clinician's own live status, because they should be able
 * to see what patients see without reloading anything. "Am I actually on?" is
 * the question the whole feature depends on, and the answer used to require a
 * page refresh.
 */
export async function radarPing(): Promise<{
  attention: RadarAttention | null;
  status: "offline" | "online" | "pending" | "in_session";
  suspendedUntil: string | null;
  suspendedReason: string | null;
}> {
  const actor = await requireUser();
  await heartbeat(actor.userId);

  const [attention, profile] = await Promise.all([
    pendingBooking(actor.userId),
    getRadarProfile(actor.userId),
  ]);

  return {
    attention,
    status: (profile?.status ?? "offline") as "offline" | "online" | "pending" | "in_session",
    suspendedUntil: profile?.suspendedUntil?.toISOString() ?? null,
    suspendedReason: profile?.suspendedReason ?? null,
  };
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

/* -------------------------------------------------------------- practice -- */

export type GeocodeResult = {
  error?: string;
  hits?: {
    lat: string;
    lon: string;
    displayName: string;
    country: string | null;
    region: string | null;
    city: string | null;
  }[];
};

/**
 * Look up an address so the clinician can confirm the pin.
 *
 * Rate limited per clinician, not per network. This calls a free public service
 * that asks politely to be used sparingly, and one clinician typing into a
 * search box should not be able to spend the whole platform's goodwill.
 */
export async function findPracticeLocation(query: string): Promise<GeocodeResult> {
  const actor = await requireUser();

  const { consume, subjectKey } = await import("@/lib/rate-limit");
  const allowed = await consume(subjectKey("geocode", actor.userId), 30, 300);
  if (!allowed.allowed) {
    return { error: "Too many lookups. Wait a minute, or paste coordinates instead." };
  }

  const { geocode, parseCoordinates } = await import("@/lib/geocode");

  // Coordinates pasted straight out of a maps app skip the lookup entirely.
  const pasted = parseCoordinates(query);
  if (pasted) {
    return {
      hits: [
        {
          ...pasted,
          displayName: `${pasted.lat}, ${pasted.lon} — the exact point you pasted`,
          country: null,
          region: null,
          city: null,
        },
      ],
    };
  }

  const hits = await geocode(query);
  if (hits.length === 0) {
    return {
      error:
        "Nothing found for that. Try a simpler version — building, street, city — or paste coordinates from your maps app.",
    };
  }
  return { hits };
}

export async function savePractice(input: {
  practiceName: string;
  address: string;
  lat: string;
  lon: string;
  country: string;
  region: string;
  city: string;
  acceptsWalkIns: boolean;
}): Promise<RadarState> {
  const actor = await requireUser();

  const address = input.address.trim().slice(0, 300);
  const { parseCoordinates } = await import("@/lib/geocode");
  const point = parseCoordinates(`${input.lat}, ${input.lon}`);

  if (address && !point) {
    return { error: "Pick a location from the search results before saving." };
  }

  const { savePracticeLocation } = await import("@/lib/data/radar");
  await savePracticeLocation(actor, {
    practiceName: input.practiceName.trim().slice(0, 120) || null,
    practiceAddress: address || null,
    practiceLat: point?.lat ?? null,
    practiceLon: point?.lon ?? null,
    country: input.country.trim().slice(0, 2).toUpperCase() || null,
    region: input.region.trim().slice(0, 120) || null,
    city: input.city.trim().slice(0, 120) || null,
    acceptsWalkIns: input.acceptsWalkIns,
    // Reaching this action at all means they saw the pin and pressed save.
    confirmed: Boolean(address && point),
  });

  revalidatePath("/on-call");
  revalidatePath("/radar");
  return { ok: true };
}

/**
 * Flip clinic visits on or off, and nothing else.
 *
 * `savePractice` demands the whole practice payload — name, address, both
 * coordinates, country, region, city — because it is a form submission. The orb
 * needs to toggle one boolean from anywhere in the product, and rebuilding the
 * whole payload from a floating control is how a half-populated form silently
 * erases somebody's address.
 *
 * Refuses when there is no confirmed address, because `accepts_walk_ins` is
 * what makes the address public: turning it on with nothing to publish invites
 * patients to an empty pin. The schema says the same thing next to the column.
 */
export async function toggleClinicVisits(accepts: boolean): Promise<RadarState> {
  const actor = await requireUser();

  const { setAcceptsWalkIns } = await import("@/lib/data/radar");
  const result = await setAcceptsWalkIns(actor, accepts);
  if (result.error) return result;

  revalidatePath("/on-call");
  revalidatePath("/radar");
  return { ok: true };
}
