import "server-only";

import { env, features } from "@/lib/env";

/**
 * 🔴 C266 / 43.1c — WHO OWNS A RECORDS CONNECTION, DECIDED IN ONE PLACE.
 *
 * *A connection is owned by the organization, and a solo therapist is an organization of one.*
 *
 * Two homes reach the same flow: a clinic manager from the clinic portal and a solo clinician from
 * settings. Each has its own guard, because a `ClinicActor` and an `Actor` are deliberately
 * different types that cannot be passed to each other's functions (54.2). What they must NOT have
 * is two different answers to "which organisation owns this", so that answer is this file.
 *
 * The clinic manager's id is `clinicOrganizationId`, spelled that way in sprint 54 precisely so
 * that reaching for it is a rename in a diff rather than an autocomplete. This is the one place
 * both spellings meet, and it does nothing but pick the owner.
 */
export type ConnectionOwner = {
  organizationId: string;
  /** Which of the two sentences the screen shows. The only difference between the homes. */
  isClinic: boolean;
};

/**
 * What `features.ehr` is missing, in words, for the screen that must not offer a button that fails.
 *
 * The same construction as 41.3's: a client id with no sealing key cannot hold a connection past
 * its first hour, and a sealing key with no client id is a Connect button that leads to a vendor
 * error page. Either alone is a screen that lies.
 */
export function whatIsMissing(): string {
  if (features.ehr) return "";
  const gaps: string[] = [];
  if (!env.ehrClientId) gaps.push("no client registration");
  if (!env.tokenEncryptionKey) gaps.push("no token sealing key");
  return gaps.join(" and ");
}
