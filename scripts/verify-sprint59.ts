/**
 * Sprint 59 acceptance: one product, two currencies, and the rails that are gates.
 *
 *   npm run verify:sprint59
 *
 * ## 🔴 The sentence this sprint is subordinate to
 *
 * > **An operator FACT that nothing acts on is as dead as an operator switch
 * > nothing reads.** (59.7)
 *
 * C218 ruled that about `country_settings.enabled`. C381 found the same defect
 * again on `collection_provider`, which was written by the seed, edited on an
 * admin screen, asserted by a verifier, and read by no payment code at all.
 * C357 is the third instance and the most expensive: `hasNoRail` has existed
 * since sprint 20 and was read by ONE amber card on an admin screen, so a
 * clinician in a country with no way to take money in and no way to send money
 * out went on the radar, was booked, held the session, and discovered it at
 * payout.
 *
 * Every check below is therefore a pair: the fact is enforced, AND something
 * that should still work still does. An absence assertion over a product that
 * refuses everybody passes.
 */
import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

async function main() {
  const { radarProblem, hasNoRail, collectionProblem, IMPLEMENTED_COLLECTION_PROVIDERS } =
    await import("../lib/settings/defs");
  const { SUPPORTED_CURRENCIES, CURRENCY_BY_ENTITY, collectionCurrencyFor, collectionRailFor, payoutRailFor } =
    await import("../lib/billing/money");

  /* ================================================================== */
  /*  59b · the rail that was a label                                    */
  /* ================================================================== */

  const country = (over: Partial<Parameters<typeof radarProblem>[0] & object> = {}) =>
    ({
      code: "XX",
      name: "Testland",
      vatBps: 0,
      currency: "usd",
      paymentMethods: ["card"],
      collectionProvider: "stripe",
      payoutMethods: ["stripe"],
      entity: "us" as const,
      crisisLineLabel: null,
      crisisLineTel: null,
      regulators: [],
      idLabelFront: null,
      idLabelBack: null,
      licenceLabel: null,
      sampleImageUrl: null,
      enabled: true,
      ...over,
    }) as NonNullable<Parameters<typeof radarProblem>[0]>;

  check(
    "🔴 59.6 / C357 a country with no rail at all refuses radar placement",
    radarProblem(country({ collectionProvider: null, payoutMethods: [] })) !== null,
    "hasNoRail was an amber card on an admin screen and nothing else for four sprints",
  );

  check(
    "🔴 59.6 …and a country with no PAYOUT method refuses it too",
    radarProblem(country({ payoutMethods: [] })) !== null,
    "a clinician we cannot pay must not be put in front of a patient who will pay",
  );

  check(
    "🔴 59.6 …and a country an operator has CLOSED refuses it",
    radarProblem(country({ enabled: false })) !== null,
    "C218's own column, finally read by the surface it was about",
  );

  /*
   * 🔴 59.8 THE CONTROL, and it is the check that matters most here.
   *
   * Every assertion above is a refusal, and a gate that refuses everybody
   * satisfies all three while closing the product. This is the pair.
   */
  check(
    "🔴 59.8 CONTROL a country with a rail still places, so the gate is a gate",
    radarProblem(country()) === null,
    "an absence assertion over a product that refuses everybody passes",
  );

  check(
    "🔴 59.6 …and a clinician with NO country on file is allowed through",
    radarProblem(null) === null,
    "an unknown country is not a known-bad one: refusing it closes the radar on everybody mid-onboarding",
  );

  /*
   * 🔴 The gate is in `setOnline`, on the way ON only.
   *
   * A clinician already on the radar in a country an operator has just closed
   * must be able to stand down. Refusing both directions strands exactly the
   * person the refusal protects.
   */
  const radarSource = readSource("lib/data/radar.ts");

  check(
    "🔴 59.6 setOnline calls the gate, rather than the gate existing unread",
    /radarProblem\(/.test(radarSource),
    "this is the defect the whole sprint is about, so it is asserted at the call site",
  );

  check(
    "🔴 59.6 …and it reads the RAW country row, not the priced one",
    /getCountries\(\)/.test(radarSource) && !/getCountrySettings\(/.test(radarSource),
    "getCountrySettings returns null for a DISABLED country, which radarProblem reads as 'no row, allow'",
  );

  check(
    "🔴 59.6 …and the clinician is told on their own dashboard, not only at the toggle",
    /radarProblem\(/.test(readSource("app/(app)/dashboard/page.tsx")),
    "a refusal that arrives when somebody presses a button arrives after they built a week around it",
  );

  /* ================================================================== */
  /*  59c · two currencies, and neither is a free choice                 */
  /* ================================================================== */

  check(
    "🔴 59.9 there are exactly two currencies, and each entity has one",
    SUPPORTED_CURRENCIES.length === 2 &&
      CURRENCY_BY_ENTITY.us === "usd" &&
      CURRENCY_BY_ENTITY.eg === "egp",
    `${SUPPORTED_CURRENCIES.join(", ")}`,
  );

  check(
    "🔴 59.1 collection currency follows the PATIENT, and a pound country prices in dollars",
    collectionCurrencyFor("EG") === "egp" &&
      collectionCurrencyFor("GB") === "usd" &&
      collectionCurrencyFor("DE") === "usd",
    "adding a country adds a jurisdiction and a document list, never a currency",
  );

  check(
    "🔴 59.5 …and the payout rail follows the CLINICIAN, with Egypt always manual",
    payoutRailFor({ country: "EG", stripeAccountId: "acct_1", payoutsEnabled: true }) === "manual" &&
      payoutRailFor({ country: "GB", stripeAccountId: "acct_1", payoutsEnabled: true }) === "connect",
    "Stripe does not pay out to Egypt, whatever our own row says",
  );

  check(
    "🔴 59.9 the currency column is DERIVED from the entity, not typed by an operator",
    /CURRENCY_BY_ENTITY\[/.test(readSource("lib/settings/defs.ts")),
    "a free text currency is a checkout in a currency with no acquirer behind it",
  );

  check(
    "🔴 C381 …and only an IMPLEMENTED collection provider is used",
    IMPLEMENTED_COLLECTION_PROVIDERS.length === 1 &&
      collectionProblem(country({ collectionProvider: "paymob" })) !== null,
    "Egypt is seeded paymob and there is no paymob integration, so it is refused in words",
  );

  check(
    "🔴 CONTROL …and a Stripe country is NOT refused",
    collectionProblem(country()) === null,
    "a refusal for everybody is not a rail check",
  );

  check(
    "🔴 59.6 CONTROL hasNoRail still answers the question it was written for",
    hasNoRail(country({ collectionProvider: null, payoutMethods: [] })) &&
      !hasNoRail(country()),
    "the predicate is unchanged; what changed is that something reads it",
  );

  /* ================================================================== */
  /*  59d · the renewal obligation                                       */
  /* ================================================================== */

  const { entitledTier } = await import("../lib/billing/plans");
  const { LEDGER_ACCOUNTS, RENEWAL_STATES, RENEWAL_RAILS } = await import("../lib/db/schema");
  const plansSource = readSource("lib/billing/plans.ts");
  const obligationsSource = readSource("lib/billing/obligations.ts");

  check(
    "🔴 59.13 a renewal is a state WE own, not a status a gateway chose",
    RENEWAL_STATES.includes("due") &&
      RENEWAL_STATES.includes("lapsed") &&
      RENEWAL_STATES.includes("void") &&
      !(RENEWAL_STATES as readonly string[]).includes("past_due"),
    `${RENEWAL_STATES.join(", ")}: Stripe's vocabulary is mapped in once, at the adapter`,
  );

  check(
    "🔴 59.13 …and Stripe is ONE rail, beside the Egyptian one",
    RENEWAL_RAILS.includes("stripe") && RENEWAL_RAILS.includes("egypt_gateway"),
    "if the only shape a subscription has is Stripe's, Egypt needs a parallel billing model",
  );

  check(
    "🔴 59.14 entitledTier reads the OBLIGATION before the gateway mirror",
    /input\.obligation/.test(plansSource) &&
      plansSource.indexOf("input.obligation") < plansSource.indexOf("const sub = input.subscription"),
    "a missed callback cannot silently end a plan",
  );

  const now = new Date("2026-06-15T12:00:00Z");
  const { SETTINGS_DEFAULTS } = await import("../lib/settings/defs");
  /* The real shipped tiers, so the check cannot drift from the product's own shape. */
  const tiers = SETTINGS_DEFAULTS.pricing.tiers;
  const covering = {
    plan: "practice",
    state: "paid" as const,
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-07-01T00:00:00Z"),
  };

  check(
    "🔴 59.14 a paid obligation survives a mirror that says cancelled",
    entitledTier({
      tiers,
      obligation: covering,
      subscription: { plan: "practice", status: "cancelled", currentPeriodEnd: null },
      lifetimeSpentCents: 0,
      now,
    }).key === "practice",
    "the clinician paid; our endpoint being down is not their problem",
  );

  check(
    "🔴 59.14 CONTROL …and a DUE obligation grants nothing",
    entitledTier({
      tiers,
      obligation: { ...covering, state: "due" },
      subscription: null,
      lifetimeSpentCents: 0,
      now,
    }).key === "payg",
    "entitlement is the period PAID for, not the period invoiced",
  );

  check(
    "🔴 59.16 dunning exists and runs before the lapse, not after it",
    /DUNNING_DAYS_BEFORE/.test(obligationsSource) &&
      /export async function lapseOverdue/.test(obligationsSource),
    "sprint 57 named the absence of dunning and shipped without it",
  );

  const cronSource = readSource("app/api/cron/[job]/route.ts");
  check(
    "🔴 59.16 …and the cron calls both, reminders first",
    /obligationsDueWithin/.test(cronSource) &&
      /lapseOverdue/.test(cronSource) &&
      cronSource.indexOf("obligationsDueWithin") < cronSource.indexOf("lapseOverdue"),
    "lapsing first would end a plan on the morning of its due date and then remind somebody about it",
  );

  check(
    "🔴 59.15 the reconciler looks BOTH ways",
    /paidWithNoReference/.test(obligationsSource) &&
      /invoicesWithNoObligation/.test(obligationsSource),
    "asking one direction is how a discrepancy survives",
  );

  check(
    "🔴 59.15 …and it is on a SCREEN, not in a log nobody tails",
    /reconcileRenewals/.test(readSource("app/(admin)/admin/vault/page.tsx")),
    "C232's lesson from the sponsor pot, applied to subscriptions",
  );

  check(
    "🔴 59.13 raising is idempotent and settling is guarded, because gateways repeat deliveries",
    /onConflictDoNothing/.test(obligationsSource) &&
      /eq\(renewalObligations\.state, "due"\)/.test(obligationsSource),
    "an upsert would reset an already-paid obligation and re-bill somebody",
  );

  /* ================================================================== */
  /*  59e · two entities, and the difference between them                */
  /* ================================================================== */

  check(
    "🔴 59.19 / C339 there is a named account for the FX difference",
    (LEDGER_ACCOUNTS as readonly string[]).includes("fx_difference"),
    "a transfer at a frozen rate does not reconcile to the cent, and the gap is not margin",
  );

  const ledgerSource = readSource("lib/billing/ledger.ts");
  check(
    "🔴 59.19 …and the entity transfer posts it rather than absorbing it",
    /account: "fx_difference"/.test(ledgerSource) && /arrivedCents/.test(ledgerSource),
    "absorbed into platform_revenue it reads as margin we earned rather than a movement we did not choose",
  );

  check(
    "🔴 59.18 a held balance carries its entity, so the two are never one figure",
    /entity: leg\.entity/.test(ledgerSource),
    "money in the Egyptian entity is not money in the US one, whoever it is owed to",
  );

  finish("sprint 59");
}

main();
