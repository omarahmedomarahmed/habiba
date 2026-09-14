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

/**
 * Seats, and the ladder that has to be retroactive. PLAN.md 62.1 to 62.4, C323.
 *
 * 🔴 The founder's table is the specification, and it is checked here against
 * the shipped settings rather than against numbers retyped into a test. A test
 * that carries its own copy of the prices passes while the product charges
 * something else.
 */

test("🔴 C323 the founder's table, exactly", () => {
  assert.equal(seatMonthlyCents(1, BANDS), 17_900, "one seat is the clinic plan");
  assert.equal(seatMonthlyCents(2, BANDS), 17_900, "and so is two: they are included");
  assert.equal(seatMonthlyCents(3, BANDS), 27_000, "$90 each, retroactively");
  assert.equal(seatMonthlyCents(4, BANDS), 36_000);
  assert.equal(seatMonthlyCents(5, BANDS), 40_000, "$80 each, retroactively");
  assert.equal(seatMonthlyCents(6, BANDS), 48_000);
});

test("🔴 C323 retroactive, not marginal, and the difference is not a rounding argument", () => {
  /*
   * Marginal at five seats would be $179 + 2×$90 + 1×$80 = $439 against the
   * founder's stated $400. The gap grows with every seat, so a clinic reading
   * the public table would be billed a number that never appears on it.
   */
  const marginal = 17_900 + 2 * 9_000 + 1 * 8_000;
  assert.equal(marginal, 43_900);
  assert.equal(seatMonthlyCents(5, BANDS), 40_000, "the table wins, and it is $39 apart");
});

test("🔴 62.2 the 2 to 3 step is a $91 jump, not a $90 one", () => {
  /*
   * Because $179 becomes $270 rather than $179 plus $90. The slider states it
   * before the click: a clinic adding their third clinician and finding a
   * number they did not expect is a support ticket and a refund conversation.
   */
  assert.equal(seatMonthlyCents(3, BANDS) - seatMonthlyCents(2, BANDS), 9_100);
});

test("no seats is no charge, and the ladder never goes backwards", () => {
  assert.equal(seatMonthlyCents(0, BANDS), 0, "a solo practice has a subscription, not seats");

  for (let seats = 1; seats < 30; seats += 1) {
    assert.ok(
      seatMonthlyCents(seats + 1, BANDS) >= seatMonthlyCents(seats, BANDS),
      `${seats + 1} seats cost less than ${seats}`,
    );
  }
});

test("🔴 a ladder that DOES go backwards is refused by the settings rail", () => {
  /*
   * The failure this forecloses: three seats at $90 is $270, and a five-seat
   * band at $50 makes five seats $250. A clinic with four clinicians pays less
   * by buying a fifth they do not have, and every one of them would, because it
   * is arithmetic rather than a loophole.
   */
  const bad: SeatBand[] = [
    { from: 1, flatCents: 17_900, perSeatCents: 0 },
    { from: 3, flatCents: 0, perSeatCents: 9_000 },
    { from: 5, flatCents: 0, perSeatCents: 5_000 },
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

  assert.equal(change.fromMonthlyCents, 17_900);
  assert.equal(change.toMonthlyCents, 27_000);
  assert.equal(change.daysInPeriod, 30);
  assert.equal(change.daysRemaining, 15);
  /*
   * 🔴 Half of the $91 difference, not half of $90. The account is repriced,
   * not extended by one seat.
   */
  assert.equal(change.proratedCents, Math.round((9_100 * 15) / 30));
  assert.equal(change.proratedCents, 4_550);
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
   * Returned signed because the caller has to be able to say "$41 back" on the
   * screen. What HAPPENS to a credit is a billing decision — 62.5 says a
   * released seat is never refunded — and not something this arithmetic gets to
   * make on the caller's behalf.
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
  assert.equal(change.proratedCents, Math.round(((17_900 - 40_000) * 15) / 30));
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
 * The pricing page builds its three rows by walking the bands: each band's range
 * runs to the next band's `from` minus one, and the last one is open ended. The
 * page is a Server Component and cannot be imported here, so the arithmetic it
 * does is checked directly. A fourth band must produce a fourth row with no edit
 * on the page, which is the property the test is actually about.
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
    { from: 1, to: 2, monthlyCents: 17_900 },
    { from: 3, to: 4, monthlyCents: 27_000 },
    { from: 5, to: null, monthlyCents: 40_000 },
  ]);

  /* A fourth band is a fourth row, and nothing on the page says "three". */
  const withFourth = rows([...BANDS, { from: 10, flatCents: 0, perSeatCents: 7_000 }]);
  assert.equal(withFourth.length, 4);
  assert.deepEqual(withFourth[2], { from: 5, to: 9, monthlyCents: 40_000 });
  assert.deepEqual(withFourth[3], { from: 10, to: null, monthlyCents: 70_000 });
});

/**
 * 🔴 62.2 — THE STEP THE PUBLIC PAGE NAMES, computed rather than written.
 *
 * The page states it at the first band boundary with both figures on it, so the
 * sentence cannot survive a reprice as a wrong number. On the shipped ladder that
 * is seat three, $179 to $270.
 */
test("🔴 62.2 the step named on the pricing page is the first band boundary", () => {
  const boundary = BANDS[1]!.from;
  assert.equal(boundary, 3);
  assert.equal(seatMonthlyCents(boundary - 1, BANDS), 17_900);
  assert.equal(seatMonthlyCents(boundary, BANDS), 27_000);
});
