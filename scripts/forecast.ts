/**
 * The forecast, from the command line.
 *
 * `npm run forecast` prints all four scenarios. `npm run forecast -- base` prints
 * one of them in full, month by month.
 *
 * ## 🔴 Why this exists when there is a screen
 *
 * Because the screen needs a database and a login, and the thing that most needs
 * to quote these numbers is the simulation's own write-up, which runs in a
 * terminal. `forecast()` is pure, so this file needs neither: it imports the
 * engine, prints it, and touches nothing. If this script ever needs a
 * `DATABASE_URL`, the engine has stopped being pure and `verify:finance` will
 * have said so before this did.
 *
 * ## It prints the provenance split, not just the answer
 *
 * A number without its provenance is the failure this whole module exists to
 * prevent, and a terminal is exactly where somebody copies a figure into a deck
 * without the caveat attached. So the split goes above the table, in the same
 * output, every time.
 */
import { inputsOf, provenanceSplit } from "../lib/finance/assumptions";
import { count, usd } from "../lib/finance/format";
import { forecast } from "../lib/finance/model";
import { SCENARIOS } from "../lib/finance/scenarios";

const SLUGS = ["benchmark", "real-sessions", "base", "funded"] as const;

function summarise(name: string, slug: string) {
  const a = SCENARIOS[SLUGS.indexOf(slug as (typeof SLUGS)[number])]!;
  const p = forecast(a);
  const last = p.months[p.months.length - 1]!;
  const split = provenanceSplit(a);

  console.log(`\n${name}  [${slug}]`);
  console.log(
    `  ${a.months} months · ${split.measured} measured, ${split.assumed} assumed of ${inputsOf(a).length} inputs`,
  );
  console.log(
    `  m${last.month}: ${count(last.therapists)} therapists · ${count(last.sessions)} sessions · rev ${usd(last.revenueUsd)} · gross ${last.grossMarginPct.toFixed(0)}% · net ${usd(last.netUsd)} · cash ${usd(last.cashUsd)}`,
  );
  console.log(
    `  break even ${p.breakEvenMonth ? `m${p.breakEvenMonth}` : "not within the horizon"} · ` +
      `${p.runsOutInMonth ? `🔴 CASH RUNS OUT m${p.runsOutInMonth}` : "cash never goes negative"} · ` +
      `AI per therapist ${usd(last.aiPerTherapistUsd)}`,
  );
  if (p.deepestDeficitUsd > 0) {
    console.log(
      `  🔴 low point m${p.deepestDeficitMonth} at ${usd(p.deepestDeficitUsd)} below zero. ` +
        `Needs ${usd(p.deepestDeficitUsd + a.money.openingCashUsd.value)} to get through, against ${usd(a.money.openingCashUsd.value)} on hand`,
    );
  }
}

function detail(slug: string) {
  const i = SLUGS.indexOf(slug as (typeof SLUGS)[number]);
  if (i < 0) {
    console.error(`No scenario "${slug}". One of: ${SLUGS.join(", ")}`);
    process.exit(1);
  }
  const a = SCENARIOS[i]!;
  const p = forecast(a);
  const split = provenanceSplit(a);

  console.log(`\n${a.name}`);
  console.log(`${split.measured} measured, ${split.assumed} assumed\n`);
  console.log(
    ["mo", "thera", "sess", "revenue", "AI", "gross%", "people", "net", "cash"]
      .map((h, j) => (j === 0 ? h.padStart(3) : h.padStart(9)))
      .join(""),
  );

  for (const m of p.months) {
    console.log(
      [
        String(m.month).padStart(3),
        count(m.therapists).padStart(9),
        count(m.sessions).padStart(9),
        usd(m.revenueUsd).padStart(9),
        usd(m.aiCostUsd).padStart(9),
        `${m.grossMarginPct.toFixed(0)}%`.padStart(9),
        usd(m.peopleUsd).padStart(9),
        usd(m.netUsd).padStart(9),
        usd(m.cashUsd).padStart(9),
      ].join(""),
    );
  }

  console.log(
    `\nbreak even ${p.breakEvenMonth ? `m${p.breakEvenMonth}` : "never"} · ` +
      `${p.runsOutInMonth ? `🔴 cash runs out m${p.runsOutInMonth}` : "cash stays positive"} · ` +
      `runway ${p.runwayMonths === null ? "profitable" : `${p.runwayMonths} months`}`,
  );
  if (p.deepestDeficitUsd > 0) {
    console.log(
      `🔴 low point m${p.deepestDeficitMonth} at ${usd(p.deepestDeficitUsd)} below zero. ` +
        `This plan needs ${usd(p.deepestDeficitUsd + a.money.openingCashUsd.value)}, and has ${usd(a.money.openingCashUsd.value)}.`,
    );
  }

  /*
   * 🔴 The caveats print WITH the numbers, not after somebody asks. A terminal
   * is where a figure gets copied into a deck, and the caveat that arrives
   * separately does not travel with it.
   */
  console.log("\nWhat this cannot know:");
  for (const line of [
    "therapist churn: three months and one cohort cannot establish it",
    "acquisition cost and conversion: there is no marketing in the simulation",
    "payment processing fees: Stripe runs in test mode and charges nothing",
    "video cost: Daily bills per participant minute, and that invoice is not in this database",
  ]) {
    console.log(`  · ${line}`);
  }
}

const arg = process.argv[2];

if (arg) {
  detail(arg);
} else {
  console.log("Four scenarios. `npm run forecast -- base` for one of them, month by month.");
  SCENARIOS.forEach((s, i) => summarise(s.name, SLUGS[i]!));
  console.log(
    "\nEvery figure above is arithmetic on the inputs, not a measurement of a business. The measured half is the unit cost; the rest is a set of assumptions somebody has to defend.",
  );
}
