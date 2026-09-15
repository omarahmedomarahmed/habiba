import assert from "node:assert/strict";
import test from "node:test";

import {
  SETTINGS_DEFAULTS,
  seatChange,
  seatMonthlyCents,
  settingsProblem,
  type SeatBand,
} from "../lib/settings/defs";

const BANDS = SETTINGS_DEFAULTS.pricing.seatBands;
const TIERS = SETTINGS_DEFAULTS.pricing.tiers;

/** The solo plan, read from the shipped tiers rather than retyped. */
const SOLO = TIERS.find((t) => t.key === "practice")!.monthlyCents;
/** What one seat costs inside a clinic, off the second band. */
const SEAT = BANDS[1]!.perSeatCents;

/**
 * Seats, and the ladder that has to be retroactive. PLAN.md 62.1 to 62.4, C323.
 *
 * ## 🔴 WHY THIS FILE WAS REWRITTEN RATHER THAN REPOINTED
 *
 * Sprint 75 repriced the product and **seven of these twelve tests went red**,
 * every one of them because it asserted a literal from the old ladder: $179 for
 * the first two seats, $90 a seat from three, $80 a seat from five. The product
 * was right and the test was old.
 *
 * That it stayed red is the more interesting half. `npm run gates` does not run
 * this file, so nothing anybody ran on the way to a commit ever printed the
 * failure. **H20, in its quieter form: an unrun gate is a gate nobody reads.**
 * It is now wired into `npm run gates` so a reprice cannot pass unnoticed again.
 *
 * So the numbers below are derived from the shipped settings wherever a
 * relationship exists, and only ONE price is written down as a literal. A test
 * that carries its own copy of every price passes while the product charges
 * something else; a test with no literal at all passes when somebody empties
 * the table.
 */

test("🔴 the shipped ladder, and it is read from the settings rather than retyped", () => {
  /* The one anchor. If this moves, the reprice was deliberate and this line is the place to say so. */
  assert.equal(SOLO, 8_000, "the solo plan is $80 a month");
  assert.equal(SEAT, 7_200, "a clinic seat is $72, ten per cent under solo");
  assert.equal(SEAT, Math.round(SOLO * 0.9), "and that ten per cent is a RULE, not a second number");

  assert.equal(seatMonthlyCents(0, BANDS), 0, "a solo practice has a subscription, not seats");
  assert.equal(seatMonthlyCents(1, BANDS), SOLO, "one seat is the solo price, never nothing");
  assert.equal(seatMonthlyCents(2, BANDS), 2 * SEAT, "the clinic minimum, $144");
  assert.equal(seatMonthlyCents(3, BANDS), 3 * SEAT, "$72 each, retroactively");
  assert.equal(seatMonthlyCents(4, BANDS), 4 * SEAT);
});

/**
 * 🔴 A ONE-SEAT CLINIC IS BILLED THE SOLO PRICE, AND THAT BAND EXISTS ON PURPOSE.
 *
 * A ladder whose first band started at two seats would bill a one-seat clinic
 * nothing at all, and `settingsProblem` refuses exactly that. The first band is
 * the solo price so the gap cannot open.
 */
test("🔴 a clinic that drops to one clinician still pays, and pays the solo price", () => {
  assert.equal(BANDS[0]!.from, 1, "the ladder starts at one seat, not at two");
  assert.equal(seatMonthlyCents(1, BANDS), SOLO);

  const gap: SeatBand[] = [{ from: 2, flatCents: 0, perSeatCents: SEAT }];
  const problem = settingsProblem({
    ...SETTINGS_DEFAULTS,
    pricing: { ...SETTINGS_DEFAULTS.pricing, seatBands: gap },
  });
  assert.ok(problem, "a ladder that starts at two seats bills one seat nothing, and is refused");
});

test("🔴 C323 retroactive, not marginal, and the difference is not a rounding argument", () => {
  /*
   * Marginal at four seats would be the solo price plus three seats:
   * $80 + 3 x $72 = $296, against the retroactive $288. The gap grows with
   * every seat, so a clinic reading the public table would be billed a number
   * that never appears on it.
   */
  const marginal = SOLO + 3 * SEAT;
  assert.equal(marginal, 29_600);
  assert.equal(seatMonthlyCents(4, BANDS), 28_800, "the table wins, and it is $8 apart");
  assert.ok(seatMonthlyCents(4, BANDS) < marginal, "retroactive is always the cheaper of the two");
});

test("🔴 62.2 the 1 to 2 step is smaller than one seat, because the first seat is repriced too", () => {
  /*
   * $80 becomes $144 rather than $80 plus $72, because the first seat drops to
   * the clinic rate the moment there are two of them. The slider states it
   * before the click: a practice adding their second clinician and finding a
   * number they did not expect is a support ticket and a refund conversation.
   */
  const step = seatMonthlyCents(2, BANDS) - seatMonthlyCents(1, BANDS);
  assert.equal(step, 6_400, "$64, not $72");
  assert.equal(step, 2 * SEAT - SOLO);
  assert.ok(step < SEAT, "the second seat costs less than a seat, which is the whole point of a band");
});

test("🔴 and every seat after the second costs exactly one seat", () => {
  for (let seats = 2; seats < 20; seats += 1) {
    assert.equal(
      seatMonthlyCents(seats + 1, BANDS) - seatMonthlyCents(seats, BANDS),
      SEAT,
      `seat ${seats + 1} should cost exactly one seat more than ${seats}`,
    );
  }
});

test("the ladder never goes backwards", () => {
  for (let seats = 1; seats < 30; seats += 1) {
    assert.ok(
      seatMonthlyCents(seats + 1, BANDS) >= seatMonthlyCents(seats, BANDS),
      `${seats + 1} seats cost less than ${seats}`,
    );
  }
});

test("🔴 a ladder that DOES go backwards is refused by the settings rail", () => {
  /*
   * The failure this forecloses: three seats at $72 is $216, and a five-seat
   * band at $40 makes five seats $200. A clinic with four clinicians pays less
   * by buying a fifth they do not have, and every one of them would, because it
   * is arithmetic rather than a loophole.
   */
  const bad: SeatBand[] = [
    { from: 1, flatCents: SOLO, perSeatCents: 0 },
    { from: 2, flatCents: 0, perSeatCents: SEAT },
    { from: 5, flatCents: 0, perSeatCents: 4_000 },
  ];

  const problem = settingsProblem({
    ...SETTINGS_DEFAULTS,
    pricing: { ...SETTINGS_DEFAULTS.pricing, seatBands: bad },
  });

  assert.ok(problem, "the rail has to refuse this");
  assert.match(problem!, /backwards/);
});

test("🔴 CONTROL the shipped ladder passes the same rail", () => {
  assert.equal(
    settingsProblem(SETTINGS_DEFAULTS),
    null,
    "a rail that refuses the shipped configuration is a rail nobody can satisfy",
  );
});

test("🔴 62.3 / C351 a seat change is prorated on the WHOLE monthly figure", () => {
  const periodStart = new Date("2026-06-01T00:00:00Z");
  const periodEnd = new Date("2026-07-01T00:00:00Z");
  /* Half way through a 30 day period. */
  const now = new Date("2026-06-16T00:00:00Z");

  const change = seatChange({ fromSeats: 2, toSeats: 3, bands: BANDS, now, periodStart, periodEnd });

  assert.equal(change.fromMonthlyCents, 2 * SEAT);
  assert.equal(change.toMonthlyCents, 3 * SEAT);
  assert.equal(change.daysInPeriod, 30);
  assert.equal(change.daysRemaining, 15);
  /*
   * 🔴 Half of the difference between the two WHOLE figures. The account is
   * repriced, not extended by one seat.
   */
  assert.equal(change.proratedCents, Math.round((SEAT * 15) / 30));
  assert.equal(change.proratedCents, 3_600);
});

test("🔴 …and a 1 to 2 change prorates the SMALLER step, because the first seat repriced", () => {
  /*
   * The case the simulation walks: a practice of one becomes a practice of two
   * on the 15th. Half of $64, not half of $72, because both seats are now on
   * the clinic rate. A quote that is not what happens is not a quote.
   */
  const change = seatChange({
    fromSeats: 1,
    toSeats: 2,
    bands: BANDS,
    now: new Date("2026-06-16T00:00:00Z"),
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-07-01T00:00:00Z"),
  });

  assert.equal(change.fromMonthlyCents, SOLO);
  assert.equal(change.toMonthlyCents, 2 * SEAT);
  assert.equal(change.proratedCents, Math.round(((2 * SEAT - SOLO) * 15) / 30));
  assert.equal(change.proratedCents, 3_200);
});

test("🔴 62.4 the day the change is made is charged, never free", () => {
  const periodStart = new Date("2026-06-01T00:00:00Z");
  const periodEnd = new Date("2026-07-01T00:00:00Z");

  /*
   * Ten minutes before the period closes. A floor would call this zero days and
   * hand out free seats on the last evening of every month.
   */
  const change = seatChange({
    fromSeats: 2,
    toSeats: 5,
    bands: BANDS,
    now: new Date("2026-06-30T23:50:00Z"),
    periodStart,
    periodEnd,
  });

  assert.equal(change.daysRemaining, 1, "the seat was available that day");
  assert.ok(change.proratedCents > 0);
});

test("a reduction comes back as a negative figure rather than a clamp", () => {
  /*
   * Returned signed because the caller has to be able to say "$X back" on the
   * screen. What HAPPENS to a credit is a billing decision (62.5 says a released
   * seat is never refunded) and not something this arithmetic gets to make on
   * the caller's behalf.
   */
  const change = seatChange({
    fromSeats: 5,
    toSeats: 2,
    bands: BANDS,
    now: new Date("2026-06-16T00:00:00Z"),
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-07-01T00:00:00Z"),
  });

  assert.ok(change.proratedCents < 0, "a reduction is a credit, and it is signed");
  assert.equal(change.proratedCents, Math.round(((2 * SEAT - 5 * SEAT) * 15) / 30));
  assert.equal(change.proratedCents, -10_800);
});

test("a change with no days left costs nothing, and does not go negative", () => {
  const change = seatChange({
    fromSeats: 2,
    toSeats: 4,
    bands: BANDS,
    now: new Date("2026-07-05T00:00:00Z"),
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-07-01T00:00:00Z"),
  });

  assert.equal(change.daysRemaining, 0);
  assert.equal(change.proratedCents, 0, "a period that closed bills nothing more");
});

/**
 * 🔴 62.10 — THE PUBLIC LADDER IS DERIVED, AND THIS IS THE DERIVATION.
 *
 * The pricing page builds its rows by walking the bands: each band's range runs
 * to the next band's `from` minus one, and the last one is open ended. The page
 * is a Server Component and cannot be imported here, so the arithmetic it does
 * is checked directly. A third band must produce a third row with no edit on the
 * page, which is the property the test is actually about.
 */
test("🔴 62.10 the public table's rows come out of the bands, whatever the bands are", () => {
  const rows = (bands: SeatBand[]) =>
    bands.map((band, i) => {
      const next = bands[i + 1];
      return {
        from: band.from,
        to: next ? next.from - 1 : null,
        monthlyCents: seatMonthlyCents(band.from, bands),
      };
    });

  assert.deepEqual(rows(BANDS), [
    { from: 1, to: 1, monthlyCents: SOLO },
    { from: 2, to: null, monthlyCents: 2 * SEAT },
  ]);

  /* A third band is a third row, and nothing on the page says "two". */
  const withThird = rows([...BANDS, { from: 10, flatCents: 0, perSeatCents: 6_400 }]);
  assert.equal(withThird.length, 3);
  assert.deepEqual(withThird[1], { from: 2, to: 9, monthlyCents: 2 * SEAT });
  assert.deepEqual(withThird[2], { from: 10, to: null, monthlyCents: 64_000 });
});

/**
 * 🔴 62.2 — THE STEP THE PUBLIC PAGE NAMES, computed rather than written.
 *
 * The page states it at the first band boundary with both figures on it, so the
 * sentence cannot survive a reprice as a wrong number. On the shipped ladder
 * that is seat two, $80 to $144.
 */
test("🔴 62.2 the step named on the pricing page is the first band boundary", () => {
  const boundary = BANDS[1]!.from;
  assert.equal(boundary, 2, "the clinic minimum is two seats");
  assert.equal(seatMonthlyCents(boundary - 1, BANDS), SOLO);
  assert.equal(seatMonthlyCents(boundary, BANDS), 2 * SEAT);
});

/**
 * 🔴 AND THE LADDER MUST NEVER PRICE A CLINIC ABOVE THE SAME PEOPLE ON SOLO
 * PLANS, because that is the moment the clinic product stops being worth buying.
 */
test("🔴 a clinic is never more expensive than the same clinicians paying solo", () => {
  for (let seats = 1; seats < 20; seats += 1) {
    assert.ok(
      seatMonthlyCents(seats, BANDS) <= seats * SOLO,
      `${seats} seats cost more than ${seats} solo plans`,
    );
  }
});
