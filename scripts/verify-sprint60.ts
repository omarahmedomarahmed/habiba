/**
 * Sprint 60 acceptance: what the employer covers.
 *
 *   npm run verify:sprint60
 *
 * ## 🔴 The sentence every check here is subordinate to
 *
 * > **A price somebody was shown is a price they are owed.** (C311)
 *
 * The obvious build reads `coverage_bps` off the pot when the money moves. Then
 * an employer lowering their percentage on a Tuesday changes what a patient
 * owes for a session they agreed to on Monday, after seeing a number and
 * accepting it. Every check below is about that sentence or about the wall it
 * must not breach: C244 is unchanged by any of this, and a percentage is a fact
 * about an account rather than about a person.
 */
import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

async function main() {
  const { coverageSplit, coverageNow, SETTINGS_DEFAULTS } = await import("../lib/settings/defs");

  const potSource = readSource("lib/billing/pot.ts");
  const connectSource = readSource("lib/billing/connect.ts");
  const sponsorsSource = readSource("lib/data/sponsors.ts");

  /* ================================================================== */
  /*  60a · the percentage, and the freeze                               */
  /* ================================================================== */

  check(
    "🔴 60.1 coverage is read ONCE at booking and written onto the payment row",
    /coverageNow\(pot, new Date\(\)\)/.test(potSource) &&
      /coverageBps,\s*\n\s*sponsorShareCents/.test(potSource),
    "a price somebody was shown is a price they are owed",
  );

  check(
    "🔴 60.2 / C311 …and the checkout reads the FROZEN row, never the pot",
    /sessionPayments\.coverageBps/.test(connectSource) &&
      !/sponsorPots\.coverageBps/.test(connectSource),
    "an employer lowering their percentage between a booking and a payment changes nothing",
  );

  check(
    "🔴 60.1 the pot is debited the SPONSOR'S SHARE, never the gross",
    /balanceCents\} - \$\{sponsorShare\}/.test(potSource),
    "refusing on the gross turns a funded booking away over a number nobody is asking for",
  );

  check(
    "🔴 60.4 / C344 an increase is immediate and a decrease waits out the window",
    /wanted > pot\.coverageBps/.test(sponsorsSource) &&
      /pendingCoverageFrom: from/.test(sponsorsSource),
    "being asked for less than you agreed to needs no protection; being asked for more does",
  );

  check(
    "🔴 60.3 / C311 …and the window is DATA, with no job whose failure hides it",
    /coverageNow/.test(readSource("lib/settings/defs.ts")) &&
      !/setInterval|cron.*coverage/i.test(sponsorsSource),
    "a task that fails leaves an employer paying a percentage they changed three weeks ago",
  );

  const pot = {
    coverageBps: 6_000,
    pendingCoverageBps: 2_000,
    pendingCoverageFrom: new Date("2026-07-01T00:00:00Z"),
  };
  check(
    "🔴 60.3 CONTROL the pending percentage applies itself by its date",
    coverageNow(pot, new Date("2026-06-30T23:59:00Z")) === 6_000 &&
      coverageNow(pot, new Date("2026-07-01T00:00:01Z")) === 2_000,
    "before the date the agreed figure stands; after it the new one does",
  );

  check(
    "🔴 60.6 / C345 zero per cent is legal and leaves the roster alone",
    coverageSplit({ grossCents: 7_000, coverageBps: 0, vatBps: 0 }).patientCents === 7_000 &&
      !/removedAt|removalReason/.test(
        sponsorsSource.slice(sponsorsSource.indexOf("export async function setCoverage")),
      ),
    "an employer who stops paying keeps somebody on the list; removal is a different act",
  );

  /* ================================================================== */
  /*  60b · the money                                                    */
  /* ================================================================== */

  check(
    "🔴 60.7 / C313 our cut is on the FULL price, not the covered part",
    /sessionMoney\(\{\s*\n?\s*grossCents: gross/.test(potSource),
    "a fee that moved with the split would make a clinician's revenue depend on their patient's employer",
  );

  check(
    "🔴 60.8 / C312 VAT is on the patient's share alone",
    coverageSplit({ grossCents: 10_000, coverageBps: 6_000, vatBps: 1_400 }).vatCents === 560 &&
      /* 0161: the rate is the country's, through the rules (`sessionVatBpsFor`), still on the patient's share. */
      /vatOn\(patientGross, (country\.vatBps|sessionVatBps)\)/.test(connectSource) &&
      /sessionVatBpsFor\(/.test(connectSource),
    "the employer's share was taxed when the pot was funded, in a jurisdiction the patient is not in",
  );

  check(
    "🔴 60.9 / C314 a session with a sponsor share is captured by US, never by the clinician",
    /capture: "platform"/.test(potSource),
    "a destination charge would put the patient's share on the therapist's own Stripe dashboard",
  );

  /*
   * 🔴 THE SUM, over the whole input space rather than at three points.
   *
   * Computing both shares from a percentage gives two numbers that are each
   * defensible and do not always sum, and the cent leaves the books in a
   * direction nobody chose.
   */
  let summed = true;
  for (let gross = 1; gross <= 20_000 && summed; gross += 97) {
    for (let bps = 0; bps <= 10_000; bps += 500) {
      const s = coverageSplit({ grossCents: gross, coverageBps: bps, vatBps: 0 });
      if (s.sponsorCents + s.patientCents !== gross) summed = false;
    }
  }
  check(
    "🔴 60.1 the two shares sum to the gross at every price and every step",
    summed,
    "one is computed and the other is the remainder, and the database refuses the alternative",
  );

  /* ================================================================== */
  /*  60c · what each side sees                                          */
  /* ================================================================== */

  check(
    "🔴 60.15 the patient is told what their benefit covers, and it names no employer",
    /Your benefit covers/.test(connectSource) &&
      !/sponsorName|organisationName/.test(connectSource),
    "C244: a percentage is theirs to know, the organisation behind it is not on a receipt",
  );

  check(
    "🔴 60.17 / C243 nothing about the split reaches a clinical or earnings surface",
    !/coverageBps|sponsorShareCents/.test(readSource("lib/data/sessions.ts")),
    "who paid for a session is not a fact about the clinician's work",
  );

  check(
    "🔴 60.3 the notice window is a setting with a FLOOR, not a number anybody can zero",
    SETTINGS_DEFAULTS.sponsor.coverageNoticeDays >= 7 &&
      /min: 7/.test(readSource("lib/settings/defs.ts")),
    "the setting exists so an operator can be more generous, not so a cut can bite the same afternoon",
  );

  check(
    "🔴 60.1 the five per cent step is a CHECK, not a select box",
    /coverage_bps % 500 = 0/.test(readSource("drizzle/0090_coverage_percentage.sql")),
    "a form can be bypassed and an API cannot be",
  );

  finish("sprint 60");
}

main();
