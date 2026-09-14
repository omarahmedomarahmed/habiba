/**
 * The plan, as tables.
 *
 *   npm run plan              every scenario, summarised
 *   npm run plan -- beta      one of them, month by month, every line
 *
 * Pure: it imports the engine and prints it. No database, no key, no network.
 */
import { runPlan, type BetaMonth, type Plan } from "../lib/finance/beta";
import { count, egp as toEgp, usd } from "../lib/finance/format";
import { EGP_PER_USD, PLANS, PLAN_SLUGS } from "../lib/finance/plans";

const egp = (u: number) => toEgp(u, EGP_PER_USD);

function row(cells: (string | number)[], widths: number[]) {
  return cells.map((c, i) => String(c).padStart(widths[i] ?? 9)).join("");
}

function summarise(plan: Plan, slug: string) {
  const r = runPlan(plan);
  const last = r.months[r.months.length - 1]!;

  console.log(`\n${plan.name}  [${slug}]`);
  console.log(
    `  m${last.month}: ${count(last.companies)} companies · ${count(last.clinics)} clinics · ` +
      `${count(last.therapistAccounts)} therapists · ${count(last.clinicians)} clinicians · ${count(last.sessions)} sessions`,
  );
  console.log(
    `  revenue ${usd(last.revenueUsd)}/mo · gross ${last.grossMarginPct.toFixed(0)}% · ` +
      `net ${usd(last.netUsd)} · cash ${usd(last.cashUsd)}`,
  );
  console.log(
    `  break even ${r.breakEvenMonth ? `m${r.breakEvenMonth}` : "not within the horizon"} · ` +
      `${r.runsOutInMonth ? `🔴 CASH RUNS OUT m${r.runsOutInMonth}` : "cash stays positive"} · ` +
      `blended CAC ${usd(r.blendedCacUsd)} an account`,
  );
  if (r.deepestDeficitUsd > 0) {
    console.log(
      `  🔴 low point m${r.deepestDeficitMonth} at ${usd(r.deepestDeficitUsd)} below zero`,
    );
  }
  console.log(
    `  over the whole plan: revenue ${usd(r.totals.revenueUsd)} · people ${usd(r.totals.peopleUsd)} · ` +
      `marketing ${usd(r.totals.marketingUsd)} · discount given away ${usd(r.totals.discountGivenUsd)} · ` +
      `welcome credit burned ${usd(r.totals.creditBurnUsd)}`,
  );
}

function detail(slug: string) {
  const i = PLAN_SLUGS.indexOf(slug as (typeof PLAN_SLUGS)[number]);
  if (i < 0) {
    console.error(`No plan "${slug}". One of: ${PLAN_SLUGS.join(", ")}`);
    process.exit(1);
  }
  const plan = PLANS[i]!;
  const r = runPlan(plan);

  console.log(`\n${plan.name}`);
  console.log(`${EGP_PER_USD} EGP to the dollar. Opening cash ${usd(plan.openingCashUsd)}.\n`);

  /* ------------------------------------------------------------- accounts -- */
  const w = [4, 10, 8, 11, 11, 10, 10];
  console.log("WHO IS ON THE PLATFORM");
  console.log(row(["mo", "companies", "clinics", "therapists", "clinicians", "patients", "sessions"], w));
  for (const m of r.months) {
    console.log(
      row(
        [
          m.month,
          count(m.companies),
          count(m.clinics),
          count(m.therapistAccounts),
          count(m.clinicians),
          count(m.patients),
          count(m.sessions),
        ],
        w,
      ),
    );
  }

  /* -------------------------------------------------------------- revenue -- */
  const wr = [4, 13, 11, 11, 11, 11, 11];
  console.log("\nWHAT COMES IN");
  console.log(row(["mo", "subscription", "at full", "given away", "session fee", "AI fee", "revenue"], wr));
  for (const m of r.months) {
    console.log(
      row(
        [
          m.month,
          usd(m.subscriptionUsd),
          usd(m.subscriptionAtFullPriceUsd),
          usd(m.discountGivenUsd),
          usd(m.sessionFeeUsd),
          usd(m.aiFeeUsd),
          usd(m.revenueUsd),
        ],
        wr,
      ),
    );
  }

  /* ---------------------------------------------------------------- costs -- */
  const wc = [4, 9, 9, 9, 9, 10, 11, 10, 10];
  console.log("\nWHAT GOES OUT");
  console.log(row(["mo", "AI", "video", "cards", "credit", "people", "marketing", "other", "total"], wc));
  for (const m of r.months) {
    console.log(
      row(
        [
          m.month,
          usd(m.aiCostUsd),
          usd(m.videoCostUsd),
          usd(m.paymentCostUsd),
          usd(m.creditBurnUsd),
          usd(m.peopleUsd),
          usd(m.marketingUsd),
          usd(m.otherUsd),
          usd(
            m.aiCostUsd +
              m.videoCostUsd +
              m.paymentCostUsd +
              m.creditBurnUsd +
              m.operatingCostUsd,
          ),
        ],
        wc,
      ),
    );
  }

  /* --------------------------------------------------------------- result -- */
  const wn = [4, 11, 9, 11, 12];
  console.log("\nWHAT IS LEFT");
  console.log(row(["mo", "revenue", "gross%", "net", "cash"], wn));
  for (const m of r.months) {
    console.log(
      row([m.month, usd(m.revenueUsd), `${m.grossMarginPct.toFixed(0)}%`, usd(m.netUsd), usd(m.cashUsd)], wn),
    );
  }

  console.log(
    `\nbreak even ${r.breakEvenMonth ? `m${r.breakEvenMonth}` : "never"} · ` +
      `${r.runsOutInMonth ? `🔴 cash runs out m${r.runsOutInMonth}` : "cash stays positive"} · ` +
      `blended CAC ${usd(r.blendedCacUsd)} an account`,
  );

  /* The prices, in the currency the customer actually pays. */
  console.log(
    `\nPrices: session ${egp(plan.unit.sessionPriceUsd)} · our cut ${(plan.unit.takeRate * 100).toFixed(0)}% ` +
      `(${egp(plan.unit.sessionPriceUsd * plan.unit.takeRate)}) · AI fee ${egp(plan.unit.aiFeeUsd)} · ` +
      `therapist ${egp(plan.segments.find((s) => s.key === "therapist")?.monthlyUsd ?? 0)}/mo · ` +
      `clinic ${egp(plan.segments.find((s) => s.key === "clinic")?.monthlyUsd ?? 0)}/mo`,
  );

  console.log("\n🔴 What this cannot know, and the beta exists to find out:");
  for (const line of [
    "whether an Egyptian therapist will pay 1,000 EGP a month at all",
    "how many leave the month the discount ends. Assumed 40% of solo therapists",
    "what share of a call centre's staff enrol. Assumed 5%, then 40% of those active monthly",
    "what card and wallet processing actually costs in Egypt. Assumed 3%",
    "whether a company renews once the welcome credit runs out. Assumed two in three",
  ]) {
    console.log(`  · ${line}`);
  }
}

const arg = process.argv[2];

if (arg) {
  detail(arg);
} else {
  console.log(
    "The plan. `npm run plan -- beta` for one of them, month by month.\n" +
      `Slugs: ${PLAN_SLUGS.join(", ")}`,
  );
  PLANS.forEach((p, i) => summarise(p, PLAN_SLUGS[i]!));
  console.log(
    "\n🔴 Two measured numbers in here (the AI cost terms). Everything else is a DECISION or a GUESS.\n" +
      "   lib/finance/plans.ts labels every one. The beta replaces the guesses with counts.",
  );
}
