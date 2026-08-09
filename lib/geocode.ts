import "server-only";

import { log, safeErrorMessage } from "@/lib/logger";

/**
 * Turning a typed address into a point on the map.
 *
 * OpenStreetMap's Nominatim, because it needs no key, no billing account and no
 * contract — and because the alternative on a product this early is either a
 * paid Google key in an environment variable somebody forgets to rotate, or
 * asking clinicians to paste coordinates, which they will not do.
 *
 * Two rules come with using it, and both are honoured here: identify yourself
 * in the User-Agent, and do not hammer it. This is called once when a clinician
 * saves an address — not on render, not on search, not on page load.
 *
 * The result is never trusted on its own. It is shown back to the clinician
 * with the address it thinks it found, and nothing is published until they say
 * it is right. A geocoder confidently placing a Cairo clinic in Ohio is a
 * normal Tuesday, and a patient walking to the wrong building is not a bug we
 * get to fix afterwards.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const AGENT = "24Therapy/1.0 (+https://24therapy.app; support@24therapy.app)";

export type GeocodeHit = {
  lat: string;
  lon: string;
  /** What Nominatim thinks the address is — shown back verbatim to confirm. */
  displayName: string;
  country: string | null;
  region: string | null;
  city: string | null;
};

export async function geocode(query: string): Promise<GeocodeHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 4) return [];

  const url = new URL(ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("q", trimmed);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": AGENT, "Accept-Language": "en" },
      // Ten seconds or nothing. A clinician staring at a spinner will press the
      // button again, which is the one thing this service asks you not to do.
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!response.ok) {
      log.warn("geocode rejected", { status: response.status });
      return [];
    }

    const body: unknown = await response.json();
    if (!Array.isArray(body)) return [];

    return body.flatMap((raw): GeocodeHit[] => {
      if (typeof raw !== "object" || raw === null) return [];
      const hit = raw as Record<string, unknown>;
      const lat = typeof hit.lat === "string" ? hit.lat : null;
      const lon = typeof hit.lon === "string" ? hit.lon : null;
      if (!lat || !lon) return [];

      const address = (hit.address ?? {}) as Record<string, unknown>;
      const pick = (...keys: string[]): string | null => {
        for (const key of keys) {
          const value = address[key];
          if (typeof value === "string" && value.trim()) return value.trim();
        }
        return null;
      };

      const countryCode = pick("country_code");

      return [
        {
          lat,
          lon,
          displayName: typeof hit.display_name === "string" ? hit.display_name : trimmed,
          country: countryCode ? countryCode.toUpperCase() : null,
          // Countries disagree about what the first level is called; take
          // whichever one this country actually uses.
          region: pick("state", "region", "province", "governorate", "county"),
          city: pick("city", "town", "village", "municipality", "suburb"),
        },
      ];
    });
  } catch (error) {
    log.warn("geocode failed", { reason: safeErrorMessage(error) });
    return [];
  }
}

/**
 * Coordinates pasted out of a maps app.
 *
 * The escape hatch for everywhere the geocoder is wrong or blank, which for a
 * new clinic on an unmapped street is often. Copying "30.0444, 31.2357" out of
 * Google Maps is something people can actually do, and it beats publishing a
 * pin in the wrong district.
 */
export function parseCoordinates(input: string): { lat: string; lon: string } | null {
  const match = input.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return { lat: lat.toFixed(6), lon: lon.toFixed(6) };
}

/**
 * A link that opens in whatever the patient already uses.
 *
 * Coordinates rather than the address string, when we have them: an address
 * typed by a clinician and re-parsed by Google is a second chance to land in
 * the wrong place, and the clinician already confirmed the point.
 */
export function directionsUrl(input: {
  lat?: string | null;
  lon?: string | null;
  address?: string | null;
}): string | null {
  if (input.lat && input.lon) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${input.lat},${input.lon}`,
    )}`;
  }
  if (input.address?.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      input.address.trim(),
    )}`;
  }
  return null;
}
