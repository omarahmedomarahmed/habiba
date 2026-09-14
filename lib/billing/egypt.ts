import "server-only";

import { env } from "@/lib/env";
import { log } from "@/lib/logger";

/**
 * The Egyptian rail, as a seam. PLAN.md 64.1, C37, C309.
 *
 * ## 🔴 SPRINT 64 IS BLOCKED ON PAPERWORK AND THIS TICKET IS NOT
 *
 * 64.2 to 64.8 need a licensed Egyptian entity, a merchant account and a signed
 * gateway contract. No amount of code shortens those. 64.1 is the one ticket that
 * needs none of them:
 *
 * > **A provider interface with one adapter, never a vendor name in a call site.**
 *
 * ## 🔴 WHY THE SEAM IS WORTH BUILDING BEFORE THE CONTRACT
 *
 * C37 already refuses a static FX rate for the same reason this exists: a vendor name
 * in a call site is a vendor decision spread across forty files, and the day it
 * changes somebody greps for a string. The seam is cheap now and expensive later,
 * and the cost of building it now is that it is honest about having no adapter behind
 * it yet.
 *
 * ## 🔴 AND IT REFUSES RATHER THAN PRETENDING
 *
 * `chargeInEgp` and `payoutInEgp` do not throw and do not return a fake success. They
 * return a REFUSAL naming what is missing, in the shape `lib/ehr/owner.ts` uses for
 * exactly the same situation: a feature whose blocker is a contract rather than a
 * bug, where the honest thing is a sentence an operator can act on rather than a
 * stack trace that reads like a defect.
 *
 * A caller that treated "not contracted" as an error would put an Egyptian patient in
 * front of a crash. A caller that treated it as success would take money nobody can
 * settle. The third answer is a refusal with a reason, and it is the one the payment
 * screens already know how to render.
 */

export type EgpRefusal = {
  ok: false;
  /** What an operator must do. Never "try again": nothing here is transient. */
  missing: string;
};

export type EgpCharge = { ok: true; reference: string };
export type EgpPayout = { ok: true; reference: string };

/**
 * 🔴 THE INTERFACE. One adapter today, and the name of the gateway appears in exactly
 * one implementation of it rather than in any call site.
 */
export type EgyptianRail = {
  /** A name for logs and for an operator's screen. Never branched on. */
  readonly name: string;
  /** 64.2 / 64.3 / 64.4 — money in, in EGP, from a patient or a sponsor. */
  charge(input: {
    amountMinor: number;
    reference: string;
    description: string;
  }): Promise<EgpCharge | EgpRefusal>;
  /** 64.5 — money out, to InstaPay or an EGP wallet. */
  payout(input: {
    amountMinor: number;
    identifier: string;
    accountName: string;
    reference: string;
  }): Promise<EgpPayout | EgpRefusal>;
};

/**
 * 🔴 WHAT IS MISSING, IN ONE FUNCTION, SO EVERY REFUSAL SAYS THE SAME THING.
 *
 * Exported so an admin screen can render it beside a country toggle rather than
 * discovering it when somebody in Cairo tries to pay. The same reasoning
 * `whatIsMissing` in `lib/ehr/owner.ts` records: the blocker is a contract, and the
 * person who can clear it reads a screen rather than a log.
 */
export function whatTheRailNeeds(): string[] {
  const needs: string[] = [];

  if (!env.egyptGatewayKey) {
    needs.push(
      "A signed contract with an Egyptian payment gateway, and its key in EGYPT_GATEWAY_KEY.",
    );
  }
  if (!env.egyptMerchantId) {
    needs.push(
      "A merchant account under the licensed Egyptian entity, and its id in EGYPT_MERCHANT_ID.",
    );
  }

  return needs;
}

/**
 * 🔴 THE ONE ADAPTER, AND IT IS NOT CONTRACTED YET.
 *
 * Deliberately not named after a vendor. The gateway will be chosen when the entity
 * is registered, and naming one here before the contract is signed would put a
 * decision nobody has made into a type every call site imports.
 *
 * When the contract exists this file gains a second implementation and
 * `egyptianRail()` returns it. Nothing else in the product changes, which is the
 * whole of 64.1.
 */
const UNCONTRACTED: EgyptianRail = {
  name: "uncontracted",

  async charge(input) {
    const missing = whatTheRailNeeds();
    log.warn("egyptian charge refused, the rail is not contracted", {
      reference: input.reference,
    });
    return {
      ok: false,
      missing:
        missing.join(" ") ||
        "The Egyptian gateway is configured but this build has no adapter for it.",
    };
  },

  async payout(input) {
    /*
     * 🔴 C309 — AND THIS ONE IS LESS URGENT THAN IT LOOKS.
     *
     * *Every Egyptian session is money WE HOLD, so the payout queue is the normal
     * path here and is staffed as one.* A therapist in Egypt is on manual payouts
     * whatever the patient paid in, which is already how `payoutRailFor` routes them:
     * an operator moves the money and stamps the request.
     *
     * So a refusal here does not strand anybody. It means the automated rail is not
     * built, and the manual one, which is the designed path, carries on.
     */
    const missing = whatTheRailNeeds();
    log.warn("egyptian payout refused, the rail is not contracted", {
      reference: input.reference,
    });
    return {
      ok: false,
      missing:
        missing.join(" ") ||
        "The Egyptian gateway is configured but this build has no adapter for it. Egyptian payouts are manual by design (C309), so the queue is the path today.",
    };
  },
};

/**
 * 🔴 THE ONLY WAY A CALL SITE GETS A RAIL, and it takes no vendor name.
 *
 * A caller asks for "the Egyptian rail" and gets whichever one this build has. There
 * is no parameter that could name a gateway and no export of `UNCONTRACTED` itself,
 * so no call site can come to depend on which adapter it is.
 */
export function egyptianRail(): EgyptianRail {
  return UNCONTRACTED;
}

/**
 * 🔴 IS THE RAIL READY? Asked by a screen before it offers EGP as a way to pay.
 *
 * Separate from `whatTheRailNeeds` because a screen wants a boolean and an operator
 * wants a list, and a screen that rendered the list to a patient would show somebody
 * in Cairo an environment variable name.
 */
export function railIsReady(): boolean {
  return egyptianRail().name !== "uncontracted" && whatTheRailNeeds().length === 0;
}
