/**
 * What a clinic principal may do. PLAN.md 63.3 to 63.7, C325, C326, C353.
 *
 * ## 🔴 C353 — THE VOCABULARY IS A CLOSED LIST IN CODE, AND THAT IS THE RULING
 *
 * A capability set stored as editable JSON is an escalation vector the moment the
 * check reads it back: whoever can write the row can write `"everything"` into it
 * and the check will happily not find the capability it was looking for and,
 * depending on how it was written, let them through.
 *
 * So the list lives here. A stored role holds STRINGS; `parseCapabilities`
 * discards every one that is not in this array, and `can` asks a set built that
 * way. An unknown capability is refused rather than ignored, and adding one needs
 * a deploy, which is correct for a permission.
 *
 * ## 🔴 C325 — A NAVIGATION FILTER IS NOT A PERMISSION
 *
 * These are checked in the data layer, on the resource, not in a layout deciding
 * which links to draw. `can` is exported so a screen can hide a control it would
 * be refused anyway, but every function in `lib/data/clinic.ts` asks for itself.
 *
 * ## 🔴 NO CAPABILITY HERE REACHES A CLINICAL BYTE
 *
 * There is no `notes.read`, no `transcript.read`, no `record.read` and no
 * `risk.read`, and that is not an omission to be filled in later: 63.11 says
 * clinic staff never reach a record, a note, a transcript, a copilot or a risk
 * alert, and the way to keep a rule like that is to have no name for the thing.
 * `verify:principals` proves it against the 58.6 matrix rather than against this
 * comment.
 */

export const CLINIC_CAPABILITIES = [
  /** Who is coming and when: names and appointment times, never a note. */
  "schedule.read",
  /** The clinician list and their verification status. */
  "people.read",
  /** The practice's bills, aggregated under C263's floor. */
  "bills.read",
  /** Earnings totals, per therapist and combined. Never a withdrawal. */
  "earnings.read",
  /** Usage and activity reports, under the same floor. */
  "reports.read",
  /** 🔴 Clinic staff and the custom roles. Delegable, and it is the edge of it. */
  "team.manage",
  /** 🔴 63.7 — buying seats. NEVER delegable: this is money. */
  "seats.manage",
  /** 🔴 63.7 — inviting and removing clinicians. NEVER delegable: membership. */
  "clinicians.manage",
  /** 🔴 C334 — taking data out of the building. Audited and watermarked. */
  "export",
] as const;

export type ClinicCapability = (typeof CLINIC_CAPABILITIES)[number];

const VOCABULARY = new Set<string>(CLINIC_CAPABILITIES);

/**
 * 🔴 63.7 — WHAT A CUSTOM ROLE MAY NEVER HOLD, whoever creates it.
 *
 * > *Only `clinic_admin` may buy a seat or invite a therapist. Money and
 * > membership are never delegable.*
 *
 * C326 says a custom role's capabilities are a subset of its creator's, and the
 * creator is always the clinic admin, who holds everything. That subset rule
 * alone would therefore permit delegating both of these, which is why this second
 * list exists: the rule is not "no more than the admin", it is "no more than the
 * admin AND never these two".
 *
 * A practice manager who can add seats can add a seat every month and nobody
 * reads the invoice. A practice manager who can invite a clinician can commit
 * the practice to paying for that clinician's sessions (54.7).
 */
export const NEVER_DELEGABLE: readonly ClinicCapability[] = ["seats.manage", "clinicians.manage"];

/** Everything a custom role is allowed to be given, which is the rest of it. */
export const DELEGABLE: readonly ClinicCapability[] = CLINIC_CAPABILITIES.filter(
  (capability) => !NEVER_DELEGABLE.includes(capability),
);

/**
 * 🔴 THE CAPABILITIES THAT ARE SCOPED TO A THERAPIST, which is C325's example.
 *
 * > *Assistant 1 assigned to therapist A is refused therapist B's calendar on the
 * > same route.*
 *
 * Holding one of these is not permission to see everybody: it is permission to
 * see the clinicians this staff member is assigned to. A staff member with no
 * assignments sees nothing under these, which is the safe direction for an empty
 * list to point. The clinic admin is not scoped, because scoping the person who
 * manages the practice to a subset of it is a different product.
 */
export const THERAPIST_SCOPED: readonly ClinicCapability[] = [
  "schedule.read",
  "earnings.read",
  "reports.read",
];

/**
 * 🔴 EVERY CAPABILITY, for the clinic admin, DERIVED rather than listed.
 *
 * A second hand-written list would be a second place to forget, and the failure
 * is silent in the dangerous direction: an admin who cannot do something is a
 * support ticket, and a list that drifts the other way is an escalation.
 */
export const ADMIN_CAPABILITIES: readonly ClinicCapability[] = CLINIC_CAPABILITIES;

/**
 * 🔴 C353 — A STORED LIST BECOMES A CAPABILITY SET ONLY THROUGH HERE.
 *
 * Anything not in the vocabulary is dropped, not passed through and not an error
 * that stops a sign-in: a role carrying one stale capability after a rename must
 * not lock a practice manager out of the product, and it must not grant the stale
 * one either.
 */
export function parseCapabilities(stored: unknown): ClinicCapability[] {
  if (!Array.isArray(stored)) return [];
  const out: ClinicCapability[] = [];
  for (const item of stored) {
    if (typeof item !== "string") continue;
    if (!VOCABULARY.has(item)) continue;
    if (!out.includes(item as ClinicCapability)) out.push(item as ClinicCapability);
  }
  return out;
}

/**
 * 🔴 C326 — WHAT IS WRONG WITH A PROPOSED ROLE, in a sentence, at WRITE time.
 *
 * Render time is too late by definition: a role that exists with a capability its
 * creator lacks is an escalation whether or not a screen draws a button for it.
 *
 * Returns a sentence rather than throwing, because the caller is a form and the
 * person reading it chose the capabilities from a list we drew.
 */
export function roleProblem(input: {
  name: string;
  capabilities: readonly string[];
  /** What the person creating this role holds. Always the admin's set today. */
  creatorHolds: readonly ClinicCapability[];
}): string | null {
  const name = input.name.trim();
  if (name.length < 2) return "Give the role a name.";
  if (name.length > 40) return "That name is too long.";

  const parsed = parseCapabilities(input.capabilities);

  /*
   * 🔴 THE UNKNOWN ONE IS REFUSED, NOT DROPPED, and the difference matters here
   * even though `parseCapabilities` drops it.
   *
   * Dropping is right when READING a stored row, because the alternative is
   * locking somebody out over a rename we did. Refusing is right when WRITING
   * one, because a capability nobody can spell arrived from something other than
   * the form we drew, and saving a role that silently does less than the request
   * asked for is how somebody believes a permission is in place.
   */
  if (parsed.length !== new Set(input.capabilities).size) {
    return "That role asks for something this product does not have a permission for.";
  }

  if (parsed.length === 0) return "Choose at least one thing this role can do.";

  const overreach = parsed.filter((capability) => !input.creatorHolds.includes(capability));
  if (overreach.length > 0) {
    return "You cannot give a role something you do not have yourself.";
  }

  const undelegatable = parsed.filter((capability) => NEVER_DELEGABLE.includes(capability));
  if (undelegatable.length > 0) {
    return "Buying seats and inviting clinicians stay with you. They cannot be given to a role.";
  }

  return null;
}

/**
 * 🔴 THE CHECK ITSELF. Deliberately boring, and deliberately not a lookup by
 * name into stored JSON.
 *
 * `held` comes from `parseCapabilities` or from `ADMIN_CAPABILITIES`, so a string
 * that is not in the vocabulary cannot be in it, and asking about one returns
 * false rather than matching something.
 */
export function can(held: readonly ClinicCapability[], wanted: ClinicCapability): boolean {
  return held.includes(wanted);
}
