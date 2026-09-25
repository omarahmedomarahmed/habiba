/**
 * 🔴 0161 — which position of the rule switches a check tests.
 *
 * The approval switches, the cooldown and the tax rules are settings now, so a
 * verifier that asserts "two people" says so rather than inheriting whatever
 * the dev database holds. The override lives in this process only and nothing
 * is written, so an early `process.exit` cannot leave the shared row changed.
 *
 * No imports on purpose: some checks set environment variables at the top of
 * the file before the application loads, and importing `lib/settings` here
 * would load it first.
 */

/** Every approval switch on and no cooldown: the position the older checks were written for. */
export const TWO_PEOPLE_EVERYWHERE = {
  approvals: {
    payouts: true,
    refunds: true,
    potReturns: true,
    verifications: true,
    transferWithoutProof: true,
    ledgerAdjustments: true,
    payoutDetailsCooldownHours: 0,
  },
};

export function setRulesForThisCheck(patch: Record<string, object> | null): void {
  (globalThis as Record<string, unknown>).__24tRulesOverrideForChecks = patch ?? undefined;
}
