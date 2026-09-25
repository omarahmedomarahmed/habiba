import "server-only";

import { env } from "@/lib/env";

import { FAKE_GATEWAY, FAKE_PAYOUTS, fakeSecretSet } from "./fake";
import { PAYMOB_GATEWAY, PAYMOB_PAYOUTS, paymobCollectionNeeds, paymobPayoutsNeeds } from "./paymob";
import type { CollectionGateway, PayoutProvider } from "./types";

/**
 * 🔴 WHICH ADAPTER, AND WHAT IS MISSING WHEN THERE IS NONE. 64.1, rulings 12 and 13b.
 *
 * The one place a provider is chosen. The SETTING names it
 * (`rules.providers.cardGateway` and `.payouts`, on /admin/settings) and the
 * ENVIRONMENT holds its keys, so choosing a provider is an audited settings
 * change and signing in as one is a deployment secret. Each adapter says
 * which of its keys are missing, and an adapter missing any is not handed out.
 *
 * 🔴 THE SIMULATOR IS A DEVELOPMENT SWITCH, NOT A PROVIDER. `EGYPT_GATEWAY=fake`
 * (and `EGYPT_PAYOUTS=fake`) puts it in place of whatever the setting names,
 * exactly as before, and it is refused where a real patient could meet it,
 * whatever an environment variable says. Any other value of those two is a
 * development override for trying an adapter by name, and is ignored on the
 * live deployment, where only the setting names a provider.
 */
type Adapter = {
  collection?: CollectionGateway;
  payouts?: PayoutProvider;
  collectionNeeds?: () => string[];
  payoutsNeeds?: () => string[];
};

const ADAPTERS: Record<string, Adapter> = {
  fake: { collection: FAKE_GATEWAY, payouts: FAKE_PAYOUTS },
  paymob: {
    collection: PAYMOB_GATEWAY,
    payouts: PAYMOB_PAYOUTS,
    collectionNeeds: paymobCollectionNeeds,
    payoutsNeeds: paymobPayoutsNeeds,
  },
};

type Side = "collection" | "payouts";

/** The adapter's name for one side: the simulator switch, else the override off live, else the setting. */
async function providerName(side: Side): Promise<string> {
  const override = side === "collection" ? env.egyptGateway : env.egyptPayouts;
  if (override === "fake") return "fake";
  if (override && !env.liveDeployment) return override;
  const { getSettings } = await import("@/lib/settings");
  const rules = (await getSettings()).rules.providers;
  return (side === "collection" ? rules.cardGateway : rules.payouts).trim().toLowerCase();
}

function needsFor(side: Side, name: string): string[] {
  const noun = side === "collection" ? "card gateway" : "payouts provider";
  if (!name) return [`No ${noun} is named on the settings screen.`];
  if (name === "fake") {
    if (env.liveDeployment) {
      return [
        side === "collection"
          ? "The simulator is switched on here, and it never takes real payments."
          : "The simulator is switched on here, and it never sends real money.",
      ];
    }
    /* 🔴 C23: no built-in secret any more, so a simulator without one is not configured. */
    if (fakeSecretSet(side)) return [];
    return [
      side === "collection"
        ? "The simulator's callback signing secret in EGYPT_GATEWAY_HMAC."
        : "The simulator's callback signing secret in EGYPT_PAYOUTS_HMAC.",
    ];
  }
  const adapter = ADAPTERS[name];
  if (!adapter?.[side]) return [`This build has no adapter for the ${noun} "${name}".`];
  return (side === "collection" ? adapter.collectionNeeds : adapter.payoutsNeeds)?.() ?? [];
}

/** What the card rail still needs, in sentences an operator can act on. */
export async function whatTheGatewayNeeds(): Promise<string[]> {
  return needsFor("collection", await providerName("collection"));
}

/** What automated payouts still need. Manual payouts are the designed path meanwhile (C309). */
export async function whatPayoutsNeed(): Promise<string[]> {
  return needsFor("payouts", await providerName("payouts"));
}

/** The card gateway, or null when anything above is missing. */
export async function collectionGateway(): Promise<CollectionGateway | null> {
  const name = await providerName("collection");
  if (needsFor("collection", name).length > 0) return null;
  return ADAPTERS[name]?.collection ?? null;
}

/** The payouts provider, or null when anything above is missing. */
export async function payoutProvider(): Promise<PayoutProvider | null> {
  const name = await providerName("payouts");
  if (needsFor("payouts", name).length > 0) return null;
  return ADAPTERS[name]?.payouts ?? null;
}

/**
 * A provider's own adapter by its stored name, to answer for an attempt it
 * started: a refund or a status read goes to whoever took the money, even
 * after the setting has moved on to another provider. Still refused without
 * its keys, and the simulator still never on the live deployment.
 */
export function gatewayNamed(name: string): CollectionGateway | null {
  if (name === "fake") return env.liveDeployment ? null : FAKE_GATEWAY;
  if (needsFor("collection", name).length > 0) return null;
  return ADAPTERS[name]?.collection ?? null;
}

/** Payout methods a provider sends to. Stripe payouts are Connect's, never here. */
export const PROVIDER_METHODS = ["instapay", "wallet", "bank"] as const;
