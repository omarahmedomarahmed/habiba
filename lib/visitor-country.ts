import "server-only";

import { headers } from "next/headers";

import { DIALLING_CODES } from "@/lib/phone/e164";

/**
 * The country a signed-out visitor is browsing from. Due diligence F21.
 *
 * Vercel's edge stamps `x-vercel-ip-country` on every request. It is a guess
 * about a network, not a fact about a person, so it is only ever used for a
 * default somebody can see and change (the zone a calendar is drawn in).
 *
 * 🔴 Egypt when the header is missing, malformed, or names a country this
 * product does not serve (anything without a dialling code in `DIALLING_CODES`).
 * The walkthrough found a visitor with no usable location defaulted to a
 * country we have nothing for; the first market is the honest default.
 */
export function countryFromGeoHeader(
  raw: string | null | undefined,
  supported: Readonly<Record<string, unknown>> = DIALLING_CODES,
): { code: string; known: boolean } {
  const code = (raw ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(code) && code in supported) return { code, known: true };
  return { code: "EG", known: false };
}

export async function visitorCountry(): Promise<{ code: string; known: boolean }> {
  try {
    return countryFromGeoHeader((await headers()).get("x-vercel-ip-country"));
  } catch {
    return countryFromGeoHeader(null);
  }
}
