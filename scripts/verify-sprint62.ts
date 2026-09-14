/**
 * Sprint 62 acceptance: seats, and the rate that is retroactive.
 *
 *   npm run verify:sprint62
 *
 * ## 🔴 The sentence this whole sprint is subordinate to
 *
 * > **Reaching a band reprices EVERY seat.** (C323)
 *
 * The founder's table only works one way round:
 *
 *     1 to 2 seats   included   $179
 *     3 to 4 seats   $90 each   $270 · $360
 *     5 or more      $80 each   $400 · $480 · …
 *
 * A marginal reading gives $179 + 2×$90 + $80 = $439 at five seats against a
 * published $400, and the gap grows with every seat. That is not a rounding
 * argument: it is a clinic being billed a number that never appears on the table
 * it read. `tests/seats.test.ts` checks the arithmetic against the founder's own
 * figures; this file checks the things arithmetic cannot see — that the figure is
 * shown BEFORE the click, that a seat is not billed twice, and that every screen
 * reads the ladder from `platform_settings` rather than keeping a copy.
 */
import { readSource, reporter, writesTo } from "./_verify";
import { stubModules } from "./_render";

const { check, finish } = reporter();

async function main() {
  /* `server-only` throws on require outside a Server Component (sprints 53, 55). */
  await stubModules();

  const { SETTINGS_DEFAULTS, seatMonthlyCents, seatChange, settingsProblem } = await import(
    "../lib/settings/defs"
  );

  const bands = SETTINGS_DEFAULTS.pricing.seatBands;

  /* ================================================================== */
  /*  62.1 · the count, the ladder, and where both live                  */
  /* ================================================================== */

  const migration = readSource("drizzle/0092_seats.sql");

  check(
    "🔴 62.1 `organizations` carries the seat count, bounded, and defaulting to ZERO",
    /ADD COLUMN IF NOT EXISTS seats integer NOT NULL DEFAULT 0/.test(migration) &&
      /organizations_seats_bounded/.test(migration),
    "defaulting to 1 bills every solo practice for a clinic plan the moment anything reads it",
  );

  check(
    "🔴 62.1 the ladder is a SETTING, so a reprice is a settings write and not a deploy",
    Array.isArray(bands) && bands.length >= 2 && bands.every((b) => typeof b.from === "number"),
    `${bands.length} bands in platform_settings`,
  );

  check(
    "🔴 62.1 / C323 the shipped ladder is the founder's table, to the cent",
    seatMonthlyCents(1, bands) === 17_900 &&
      seatMonthlyCents(2, bands) === 17_900 &&
      seatMonthlyCents(3, bands) === 27_000 &&
      seatMonthlyCents(4, bands) === 36_000 &&
      seatMonthlyCents(5, bands) === 40_000,
    "$179 · $179 · $270 · $360 · $400",
  );

  /*
   * 🔴 THE CONTROL FOR THE WHOLE SPRINT, and it is one number.
   *
   * $439 is what a careful engineer gets by reading the table as marginal, which
   * is how every other seat product in the category prices. If this ever passes,
   * somebody has rewritten the rule to the intuitive version and the public page
   * and the invoice have quietly stopped agreeing.
   */
  check(
    "🔴 62.1 / C323 CONTROL the MARGINAL reading is not what we bill",
    seatMonthlyCents(5, bands) !== 43_900,
    "$439 is the number a marginal reading produces and it appears on no page we publish",
  );

  check(
    "🔴 62.1 a ladder that goes BACKWARDS is refused before it is saved",
    (() => {
      const problem = settingsProblem({
        ...SETTINGS_DEFAULTS,
        pricing: {
          ...SETTINGS_DEFAULTS.pricing,
          bands: undefined,
          seatBands: [
            { from: 1, flatCents: 17_900, perSeatCents: 0 },
            { from: 3, flatCents: 0, perSeatCents: 1_000 },
          ],
        } as (typeof SETTINGS_DEFAULTS)["pricing"],
      });
      return typeof problem === "string" && problem.length > 0;
    })(),
    "three seats at $30 while two cost $179 is a configuration somebody clicks through by accident",
  );

  /* ================================================================== */
  /*  62.2 · the $91 step, named BEFORE the click                        */
  /* ================================================================== */

  check(
    "🔴 62.2 the 2 to 3 step is a $91 jump, not the price of one seat",
    seatMonthlyCents(3, bands) - seatMonthlyCents(2, bands) === 9_100,
    "a clinic expecting $90 and billed $91 more than that is a refund conversation",
  );

  const manager = readSource("components/billing/seat-manager.tsx");

  /*
   * 🔴 THE ORDER OF TWO THINGS IS THE RULING. A slider that changed the count and
   * then said what happened would satisfy every other sentence in this sprint.
   *
   * So: the apply button exists only while a quote does, which is a property of
   * the component rather than a habit of whoever uses it.
   */
  check(
    "🔴 62.2 / 62.3 the figure is quoted BEFORE anything is applied",
    /quoteSeats\(/.test(manager) &&
      /saveSeats\(/.test(manager) &&
      manager.indexOf("quoteSeats(") < manager.indexOf("saveSeats("),
    "the whole ruling is that somebody sees the number and only then presses a button",
  );

  check(
    "🔴 62.2 …and the apply control does not exist until there is a quote to apply",
    /\{quote \?/.test(manager) && /saveSeats\(quote\.fromSeats, quote\.toSeats\)/.test(manager),
    "a button that can be pressed with no quote on screen is the order reversed",
  );

  check(
    "🔴 62.3 the quote states BOTH figures: what is owed now and what the month becomes",
    /toMonthlyLabel/.test(manager) && /proratedLabel/.test(manager),
    "one prorated figure says what somebody is charged and nothing about what they agreed to",
  );

  /* ================================================================== */
  /*  62.3 / 62.4 · retroactive within the period, prorated to the day   */
  /* ================================================================== */

  const periodStart = new Date("2026-06-01T00:00:00Z");
  const periodEnd = new Date("2026-07-01T00:00:00Z");

  const midMonth = seatChange({
    fromSeats: 2,
    toSeats: 3,
    bands,
    now: new Date("2026-06-16T00:00:00Z"),
    periodStart,
    periodEnd,
  });

  check(
    "🔴 62.3 / C351 the difference is computed on the WHOLE monthly figure, not on the seats added",
    midMonth.fromMonthlyCents === 17_900 && midMonth.toMonthlyCents === 27_000,
    "$179 becomes $270 for the rest of the month; it does not gain one seat at $90",
  );

  check(
    "🔴 62.4 / C333 …and only the remaining days are charged",
    midMonth.daysRemaining === 15 &&
      midMonth.daysInPeriod === 30 &&
      midMonth.proratedCents === Math.round((9_100 * 15) / 30),
    `${midMonth.proratedCents} cents for ${midMonth.daysRemaining} of ${midMonth.daysInPeriod} days`,
  );

  /*
   * 🔴 THE LAST EVENING OF THE PERIOD COSTS ONE DAY, NOT ZERO. A floor here means
   * a clinic adds five seats at 23:50 on the last day of every month for nothing.
   */
  const lastEvening = seatChange({
    fromSeats: 2,
    toSeats: 3,
    bands,
    now: new Date("2026-06-30T23:50:00Z"),
    periodStart,
    periodEnd,
  });

  check(
    "🔴 62.4 a change on the last evening of the period is charged one day, never zero",
    lastEvening.daysRemaining === 1 && lastEvening.proratedCents > 0,
    "the seat was available that day, and the alternative is free seats every month end",
  );

  const down = seatChange({
    fromSeats: 5,
    toSeats: 2,
    bands,
    now: new Date("2026-06-16T00:00:00Z"),
    periodStart,
    periodEnd,
  });

  check(
    "🔴 62.5 a REDUCTION comes back negative rather than clamped to zero",
    down.proratedCents < 0,
    "the caller has to be able to say what it is worth; what happens to it is 62.5's decision",
  );

  const seatsSource = readSource("lib/billing/seats.ts");

  check(
    "🔴 62.5 …and the product does not refund it: the seat is released, never credited",
    /releasedAt: new Date\(\)/.test(seatsSource) && !/refund/i.test(seatsSource),
    "a refund means a clinic adds five seats on the first and removes them on the last",
  );

  /* ================================================================== */
  /*  62.6 / 62.7 · nobody pays twice, nobody loses a month they bought  */
  /* ================================================================== */

  check(
    "🔴 62.6 / C355 a seat carries the date it starts costing money",
    /billable_from/.test(migration) && /billableFrom/.test(seatsSource),
    "'is this person on the bill yet' is asked at every renewal",
  );

  /*
   * 🔴 THE PERIOD IS THE JOINING CLINICIAN'S, NOT THE CLINIC'S, and the first
   * version of `takeSeat` read the wrong one.
   *
   * Looking the subscription up on the clinic's organisation dates every seat
   * from the clinic's own renewal, which has nothing to do with the month the
   * joining clinician already paid for. C355 would then be enforced against the
   * wrong calendar while looking correct on every screen.
   */
  check(
    "🔴 62.6 / C355 …and it is read from THEIR organisation, never the clinic's",
    /ownOrganizationId: string \| null/.test(seatsSource) &&
      /eq\(subscriptions\.organizationId, input\.ownOrganizationId\)/.test(seatsSource),
    "the clinic's renewal date is not the month this person already paid for",
  );

  check(
    "🔴 62.6 …and a period end already in the PAST is today, not a date behind us",
    /ends\.getTime\(\) > now\.getTime\(\)/.test(seatsSource),
    "billing from a stale date reads as free seats for as long as the mirror was stale",
  );

  const clinicAdmin = readSource("lib/data/clinic-admin.ts");

  check(
    "🔴 62.6 the ruling is WIRED: accepting an invitation takes a seat",
    /takeSeat\(/.test(clinicAdmin),
    "a seat table nothing writes to is C355 written down and not enforced",
  );

  check(
    "🔴 62.6 …including for somebody who ALREADY pays us, which is the case C355 is about",
    /export async function joinWithExistingAccount/.test(clinicAdmin) &&
      /ownOrganizationId: existing\.organizationId/.test(clinicAdmin),
    "without this they make a second account, pay for two things, and find out later",
  );

  /*
   * 🔴 THE SEAT IS TAKEN BEFORE THE REPARENTING, because `ownOrganizationId` is
   * the practice whose period we are waiting for and the move overwrites it.
   */
  /*
   * 🔴 `\n}\n` AND NOT `\n}`, which is the bug this comment exists to stop
   * somebody reintroducing.
   *
   * `\n}` matches the close of the parameter object in `joinWithExistingAccount(input: {…})`
   * long before the function ends, so the extracted "body" was the signature and
   * every ordering check over it silently compared two -1s. Sprint 61's version
   * of this extraction was correct only because its function's parameters fit on
   * one line. A closing brace followed by a newline is the function's own.
   */
  const joinBody = (() => {
    const start = clinicAdmin.indexOf("export async function joinWithExistingAccount");
    if (start === -1) return "";
    const end = clinicAdmin.indexOf("\n}\n", start);
    return end === -1 ? "" : clinicAdmin.slice(start, end);
  })();

  check(
    "🔴 CONTROL the body extraction found a body, not a signature",
    joinBody.length > 800,
    `${joinBody.length} characters, and an ordering check over an empty body compares two -1s`,
  );

  check(
    "🔴 62.6 …and the seat is taken BEFORE the move, or it reads the wrong organisation",
    joinBody.indexOf("takeSeat(") > 0 &&
      joinBody.indexOf(".update(users)") > 0 &&
      joinBody.indexOf("takeSeat(") < joinBody.indexOf(".update(users)"),
    "the update overwrites the very column the seat's start date is derived from",
  );

  check(
    "🔴 C261 a joining clinician brings NO caseload, and it is a refusal rather than a migration",
    /already has patient records on it/.test(clinicAdmin) &&
      /patients\.organizationId, existing\.organizationId/.test(clinicAdmin),
    "moving a chart between tenancies moves it out from under the grant the patient gave",
  );

  const joinAction = readSource("app/(clinic)/clinic/join/[token]/actions.ts");

  check(
    "🔴 62.7 / C329 their own subscription is cancelled AT PERIOD END on acceptance",
    /cancelSubscriptionFor/.test(clinicAdmin) && /cancelSubscription\(/.test(joinAction),
    "cancelling immediately takes away a month somebody bought",
  );

  check(
    "🔴 62.7 …and the gateway call is NOT in the write path",
    !/from "@\/lib\/billing\/stripe"/.test(clinicAdmin.split("\n").slice(0, 30).join("\n")),
    "a gateway having a bad afternoon must not roll back a person's seat",
  );

  check(
    "🔴 62.5 releasing is wired to a clinician leaving, and before the reparenting",
    /releaseSeat\(/.test(clinicAdmin) &&
      clinicAdmin.indexOf("releaseSeat(") < clinicAdmin.lastIndexOf("organizationId: solo.id"),
    "the other order leaves a departed clinician holding a billable seat",
  );

  check(
    "🔴 62.6 the seat list shows the START DATE, where the question is asked",
    /seatBillableFrom/.test(readSource("components/clinic/people-list.tsx")) &&
      /seatsFor\(/.test(readSource("app/(clinic)/clinic/people/page.tsx")),
    "'why is my bill not what I expected' is a support ticket this line prevents",
  );

  /* ================================================================== */
  /*  62.8 · a failed renewal drops the whole clinic together            */
  /* ================================================================== */

  /*
   * 🔴 THIS ONE IS STRUCTURAL RATHER THAN A FEATURE, and asserting it is the
   * point: entitlement is resolved for an ORGANISATION, so there is no code path
   * that could drop one clinician at a time even if somebody wanted one.
   */
  const credits = readSource("lib/billing/credits.ts");

  check(
    "🔴 62.8 / C330 entitlement is resolved per ORGANISATION, so a clinic drops as one",
    /export async function currentTier\(organizationId: string\)/.test(credits) &&
      !/currentTier\(userId/.test(credits),
    "a per-clinician entitlement is a clinic dropping one therapist at a time",
  );

  check(
    "🔴 62.8 …and it is the period they PAID FOR that decides, not a gateway status",
    /obligationCovering\(organizationId, now\)/.test(credits),
    "C294: a failed renewal takes the next period, never the one already bought",
  );

  /* ================================================================== */
  /*  62.9 / 62.10 · the screens                                         */
  /* ================================================================== */

  const billingPage = readSource("app/(app)/billing/page.tsx");

  check(
    "🔴 62.9 / C332 the upgrade section is REPLACED by a seat manager, never removed",
    /SeatManager/.test(billingPage) && /PlanCard/.test(billingPage),
    "a clinic with no way to add a colleague is a feature that becomes a support queue",
  );

  const pricing = readSource("components/public/pricing-tiers.tsx");
  const ladder = readSource("components/public/seat-ladder.tsx");

  check(
    "🔴 62.10 the public page carries the seat table and the slider",
    /SeatLadder/.test(pricing) && /type="range"/.test(ladder),
    "a price we bill and do not publish is a price nobody can check",
  );

  /*
   * 🔴 THE SLIDER COMPUTES NOTHING, and that is the check that matters.
   *
   * The obvious build passes the bands to the client and does the arithmetic
   * there, which gives this product two implementations of the retroactive rule:
   * one that bills and one that quotes. C60 is what happens when a public page
   * keeps its own copy of a number.
   */
  check(
    "🔴 62.10 …and the client does no seat arithmetic: it indexes a server-built list",
    !/seatMonthlyCents/.test(ladder) && /monthlyByCount\[count - 1\]/.test(ladder),
    "two implementations of one pricing rule is C60 with an extra step",
  );

  check(
    "🔴 62.10 every published figure comes from `platform_settings`, none is typed",
    /settings\.pricing\.seatBands/.test(pricing) &&
      !/17_?900|27_?000|\$179|\$270|\$400/.test(pricing),
    "a number typed into a marketing page is a number nobody rereads after a reprice",
  );

  check(
    "🔴 62.10 the table rows are DERIVED from the bands, so a fourth band needs no edit here",
    /bands\.map\(/.test(pricing) && /next \? next\.from - 1 : null/.test(pricing),
    "a hand-written three-row table silently stays three rows after somebody adds a fourth",
  );

  check(
    "🔴 62.2 …and the retroactive step is stated on the public page too, with live figures",
    /pricing\.seatsStep/.test(pricing) && /boundary/.test(pricing),
    "the clinic reading the table is the person who needs to know the third seat is not $90",
  );

  /* ================================================================== */
  /*  62.11 · the gate                                                   */
  /* ================================================================== */

  const claims = readSource("scripts/verify-claims.ts");

  check(
    "🔴 62.11 `verify:claims` compares published seat prices to `platform_settings`",
    /LEGITIMATE_SEAT_FIGURES/.test(claims) && /seatMonthlyCents/.test(claims),
    "the C291 shape one table over: true when written, false the hour somebody reprices",
  );

  check(
    "🔴 62.11 …in BOTH languages, because the Arabic copy is written rather than translated",
    /\["en", "ar"\]/.test(claims),
    "a gate that reads half the copy reports a clean run on the half it read",
  );

  check(
    "🔴 62.11 …and it is bracketed by a planted offender, which is the §6 rule",
    /CONTROL the rule catches a seat price the ladder does not produce/.test(claims) &&
      /43_?9|\$439/.test(claims),
    "an absence assertion passes just as happily against a rule that matches nothing",
  );

  /* ================================================================== */
  /*  the database, as it actually is                                    */
  /* ================================================================== */

  /* 🔴 C147 — names the host and refuses production before anything connects. */
  writesTo();

  const { sql } = await import("drizzle-orm");
  const { connect } = await import("./db");
  const { pool, db } = connect();

  try {
    const columns = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'clinic_seats'`,
    );
    const names = columns.rows.map((r) => (r as { column_name: string }).column_name);

    check(
      "🔴 H1 `clinic_seats` exists in the database, not only in a migration file",
      ["billable_from", "released_at", "organization_id", "user_id"].every((c) =>
        names.includes(c),
      ),
      names.join(", ") || "no such table",
    );

    const seats = await db.execute(
      sql`SELECT column_name, column_default FROM information_schema.columns
          WHERE table_name = 'organizations' AND column_name = 'seats'`,
    );

    check(
      "🔴 H1 `organizations.seats` exists and defaults to zero",
      seats.rows.length === 1 &&
        /^0/.test(String((seats.rows[0] as { column_default: string }).column_default ?? "")),
      JSON.stringify(seats.rows),
    );

    const indexes = await db.execute(
      sql`SELECT indexname FROM pg_indexes WHERE tablename = 'clinic_seats'`,
    );
    const indexNames = indexes.rows.map((r) => (r as { indexname: string }).indexname);

    check(
      "🔴 one LIVE seat per clinician per clinic, enforced by a partial unique index",
      indexNames.includes("clinic_seats_live_unique"),
      indexNames.join(", "),
    );

    const constraint = await db.execute(
      sql`SELECT convalidated FROM pg_constraint WHERE conname = 'organizations_seats_bounded'`,
    );

    check(
      "🔴 H1 the seat bound is VALIDATED, not merely declared",
      constraint.rows.length === 1 &&
        (constraint.rows[0] as { convalidated: boolean }).convalidated === true,
      JSON.stringify(constraint.rows),
    );
  } finally {
    await pool.end();
  }

  finish("sprint 62");
}

main();
