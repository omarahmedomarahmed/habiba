import { FHIR_VERSION, US_CORE_VERSION, type EhrVendor } from "@/lib/db/schema";

/**
 * 🔴 43.2 — WE ARE THE OAUTH **CLIENT**, AND THE SCOPES ARE A SHORT LIST WITH A GUARD ON IT.
 *
 * The same shape as `lib/meetings/providers.ts`, deliberately, because that file's argument
 * transfers and is stronger here: *the point is not that today's entries are correct, but that
 * adding one, or widening one, has to get past this.*
 *
 * ## 🔴 SMART ON FHIR DISCOVERS ITS ENDPOINTS, so there is no authorizeUrl per vendor
 *
 * A hospital's authorise and token URLs come from `/.well-known/smart-configuration` at its own
 * FHIR base, which is why `ehr_connections` stores a base URL per connection rather than a
 * vendor's global one. Two Epic hospitals share no endpoint. That is the one structural
 * difference from the meeting providers and it is why this file carries no URLs at all.
 *
 * ## 🔴 THE SCOPES ARE 43.4's DECISION EXPRESSED AS A REQUEST
 *
 * We ask for what we need to do the job and nothing that would let us build a shadow chart:
 *
 *   `launch/patient`            the patient whose chart the clinician opened us from
 *   `patient/Patient.read`      a display name, which is 43.4's one carved exception
 *   `patient/DocumentReference.write`  filing the note back (43.3)
 *   `offline_access`            refreshing without asking a clinician to reauthorise mid-session
 *
 * 🔴 AND NOT `patient/*.read`, WHICH IS WHAT EVERY EXAMPLE IN EVERY SMART TUTORIAL ASKS FOR.
 *
 * A wildcard read grants the problem list, the medications, the allergies, the labs and every
 * encounter we were not in — the whole of `THEIRS_NEVER_OURS`. A hospital's security review
 * would grant it, because it is the normal request, and from that moment the only thing stopping
 * us holding a duplicate chart is that we happen not to. 43.4 says the chart is theirs; asking
 * for less than we could is how that stays true when somebody is in a hurry.
 *
 * There is also no `user/` scope anywhere. A `user/` scope is everything that user can see in the
 * EHR, across every patient; `patient/` is scoped to the launch context. The difference is a
 * caseload versus one chart.
 */

export type VendorSpec = {
  vendor: EhrVendor;
  /** The name a clinician or an operator calls it. */
  name: string;
  /** Why a connection attempt might fail for reasons nobody here controls. */
  mayBeBlocked: string;
};

export const VENDORS: Record<EhrVendor, VendorSpec> = {
  epic: {
    vendor: "epic",
    name: "Epic",
    mayBeBlocked:
      "Epic requires the hospital to register us in its own App Orchard or Vendor Services tenant before anything will connect. That is the hospital's decision and its timeline, not ours, and it is usually weeks rather than days.",
  },
  cerner: {
    vendor: "cerner",
    name: "Oracle Health (Cerner)",
    mayBeBlocked:
      "Oracle Health tenants each approve applications separately. A connection that works at one hospital tells you nothing about the next one.",
  },
  athena: {
    vendor: "athena",
    name: "athenahealth",
    mayBeBlocked:
      "athenahealth gates API access per practice and per product. A practice may have a licence that does not include the document endpoints this needs, in which case the note cannot file back and we will say so rather than appear to work.",
  },
  smart_sandbox: {
    vendor: "smart_sandbox",
    name: "SMART sandbox",
    mayBeBlocked:
      "The public SMART sandbox serves synthetic patients only. It is here so the flow can be walked end to end without a hospital, and it is not evidence that any real tenant will connect.",
  },
};

/**
 * 🔴 The scopes we request. One list, and `verify:sprint43` asserts against it by name.
 *
 * `launch/patient` rather than `launch`, because `launch` alone lets a vendor decide what context
 * to hand us and some hand an encounter, a user and a patient together.
 */
export const REQUESTED_SCOPES = [
  "launch/patient",
  "patient/Patient.read",
  "patient/DocumentReference.write",
  "offline_access",
  "openid",
  "fhirUser",
] as const;

/**
 * 🔴 THE SCOPE GUARD, as a function rather than a comment.
 *
 * Two rules, and the first is the one a tutorial would break:
 *
 *   - No wildcard. A star in the resource position, or in both positions, is the whole chart.
 *     (Written in words rather than shown: a star followed by a slash closes a block comment,
 *     which is how the first version of this file stopped compiling.)
 *   - No `user/` prefix. That is everything the clinician can see across every patient, which
 *     is a caseload rather than the one chart they launched us from.
 *
 * And a third that is about writing rather than reading: the only resource we may WRITE is
 * `DocumentReference`. A `Condition.write` or an `Observation.write` would mean putting a
 * diagnosis or a measurement into somebody's chart under a clinician's name, and §7's first hard
 * rule is that content in a chart needs a named human who approved that exact text. A note has
 * one. A structured resource we synthesised does not.
 */
const WILDCARD = /\*/;
const USER_PREFIX = /^user\//;
const WRITE = /\.(write|c?ud?|\*)$/;

export function scopesAreMinimal(scopes: readonly string[]): boolean {
  return scopes.every((scope) => {
    if (WILDCARD.test(scope)) return false;
    if (USER_PREFIX.test(scope)) return false;
    if (WRITE.test(scope) && !scope.includes("DocumentReference")) return false;
    return true;
  });
}

export function vendorSpec(vendor: string): VendorSpec | null {
  return (VENDORS as Record<string, VendorSpec>)[vendor] ?? null;
}

/**
 * 🔴 The versions, pinned, and printed wherever a hospital's IT asks.
 *
 * "Latest FHIR" is a contract that moves under a hospital. R4 `4.0.1` and US Core `6.1.0` are
 * the pin 43.2 asks for, and they live in `schema.ts` beside the tables so a migration and a
 * request cannot disagree about which version the data was shaped for.
 */
export const PINNED = { fhir: FHIR_VERSION, usCore: US_CORE_VERSION } as const;
