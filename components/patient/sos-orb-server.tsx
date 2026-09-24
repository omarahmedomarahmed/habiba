import "server-only";

import { SosOrb } from "@/components/patient/sos-orb";
import type { SosCountry } from "@/lib/crisis/sos";
import { getCountries } from "@/lib/settings";

/**
 * 🔴 W1-09: the crisis lines an operator configured, for the SOS sheet.
 *
 * The orb is a client component and must not fetch, so the server hands it
 * `country_settings` already loaded. `getCountries` answers an empty list when
 * the database is unreachable, and the orb then falls back to the verified
 * table in `lib/crisis/line.ts` rather than to nothing.
 */
export async function sosCountries(): Promise<SosCountry[]> {
  return (await getCountries()).map((row) => ({
    code: row.code,
    name: row.name,
    enabled: row.enabled,
    crisisLineLabel: row.crisisLineLabel,
    crisisLineTel: row.crisisLineTel,
  }));
}

/** The SOS orb, with the configured lines, for a server-rendered page. */
export async function SosOrbServer(props: Omit<React.ComponentProps<typeof SosOrb>, "countries">) {
  return <SosOrb {...props} countries={await sosCountries()} />;
}
