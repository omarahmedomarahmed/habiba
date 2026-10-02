/**
 * Review fix: who may reset somebody else's authenticator app, and whose.
 * Pure and import-free, so the console form and the tests read the same list.
 */

/** The accounts whose optional app the console can reset. */
export const FACTOR_RESET_TARGETS = ["clinician", "clinic", "partner"] as const;
export type FactorResetTarget = (typeof FACTOR_RESET_TARGETS)[number];

/**
 * A clinician, clinic manager or partner user who lost their phone and their
 * recovery codes is reset by an owner or a manager in the console, audited.
 * Staff are not reset here: theirs is required, and only an owner resets it.
 */
export function mayResetAccountFactor(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "manager";
}

export function isFactorResetTarget(value: unknown): value is FactorResetTarget {
  return typeof value === "string" && (FACTOR_RESET_TARGETS as readonly string[]).includes(value);
}
