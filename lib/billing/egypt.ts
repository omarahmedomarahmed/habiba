import "server-only";

import { whatPayoutsNeed, whatTheGatewayNeeds } from "./gateway";

/**
 * The Egyptian rail, as a seam. PLAN.md 64.1, C37, C309.
 *
 * ## 🔴 SPRINT 64 IS BLOCKED ON PAPERWORK, AND THE CODE AROUND IT IS NOT
 *
 * A licensed Egyptian entity, a merchant account and a signed gateway contract
 * are what the card rail and automated payouts wait for, and no code shortens
 * those. Everything else is built: the two provider contracts
 * (`gateway/types.ts`), the choice of adapter and what is missing without one
 * (`gateway/index.ts`), the session checkout, callback, status read and refund
 * (`gateway/session.ts`), the provider side of a payout (`payouts.ts`), the two
 * signed callback routes, and a simulator that runs all of it in development.
 * Signing a contract means writing one adapter file.
 *
 * ## 🔴 AND IT REFUSES RATHER THAN PRETENDING
 *
 * With no adapter, nothing takes a card: the patient pays by transfer and the
 * clinician is on the manual payout queue, which are the designed paths today
 * (C309), and the operator's screen says what is missing in sentences.
 */

/** Everything the Egyptian card rail and automated payouts still need, for the operator. */
export function whatTheRailNeeds(): string[] {
  return [...whatTheGatewayNeeds(), ...whatPayoutsNeed()];
}

/** Can an Egyptian patient pay by card? Asked by a screen before it offers the option. */
export function railIsReady(): boolean {
  return whatTheGatewayNeeds().length === 0;
}
