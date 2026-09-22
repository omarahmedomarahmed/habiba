/**
 * Every clinician on the radar can be drawn on it.
 *
 *     npm run verify:radar-place
 *
 * ## The defect this exists for
 *
 * The public globe was empty for weeks while two clinicians were online in Cairo,
 * the list beside it showed both, and the counter said "2 therapists available
 * now". `scripts/seed-demo.ts` had written `country = 'eg'`, and the globe looks
 * the code up in a map keyed by ISO alpha-2, which is uppercase. `WORLD['eg']`
 * is `undefined`, so there was no dot, and nothing anywhere said so.
 *
 * ## Why a database gate rather than a browser one
 *
 * A screenshot of the globe proves today's rows draw. It does not prove the
 * NEXT row will, and the next row is written by a seed, an admin action or a
 * geocoder, not by the page. The property that matters is about the data:
 *
 *     a clinician who is on the radar has a country the map can find
 *
 * Migration 0114 makes that true for new rows by constraining the column, and
 * `verify:migrations` proves the constraint is VALIDATED rather than merely
 * declared. What neither of those can see is the other half of the pair: the
 * constraint says the code is two uppercase letters, and the map needs the code
 * to be one of the 169 it actually has outlines for. 'ZZ' passes the constraint
 * and draws nothing.
 *
 * So this gate joins the two ends and reports the count, per 76.18.
 */
import { eq, isNotNull } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

async function main() {
  writesTo();

  const { controlDb } = await import("../lib/db");
  const { therapistRadar } = await import("../lib/db/schema");
  const world = (await import("../lib/world-110m.json")).default as unknown as Record<
    string,
    { n: string; c: [number, number] }
  >;

  const rows = await controlDb
    .select({
      userId: therapistRadar.userId,
      country: therapistRadar.country,
      region: therapistRadar.region,
      city: therapistRadar.city,
      status: therapistRadar.status,
    })
    .from(therapistRadar);

  required(rows[0], "clinician on the radar");

  const placed = rows.filter((row) => row.country !== null);
  const online = rows.filter((row) => row.status === "online");

  /* ------------------------------------------------------------- the rule -- */

  const unfindable = placed.filter((row) => !world[row.country!]);
  check(
    "🔴 every clinician with a country has one the globe can draw",
    unfindable.length === 0,
    unfindable.length === 0
      ? `${placed.length} placed of ${rows.length} on the radar`
      : unfindable.map((row) => `${row.userId.slice(0, 8)} has ${JSON.stringify(row.country)}`).join("; "),
  );

  const notCanonical = placed.filter((row) => row.country !== row.country!.toUpperCase());
  check(
    "…and it is stored in the canonical ISO case, not merely a case the reader forgives",
    notCanonical.length === 0,
    notCanonical.map((row) => JSON.stringify(row.country)).join("; ") || `${placed.length} checked`,
  );

  /*
   * The one that actually broke, stated as the thing a person in crisis needs:
   * somebody advertised as available this minute has a dot to tap.
   *
   * 🔴 A NULL COUNTRY IS NOT A FAILURE HERE, and the first draft of this check
   * said it was. The schema is explicit that a clinician with no country stays
   * on the radar — they are in the list and simply not on the map — so failing
   * on null would be this gate asserting the opposite of a documented decision,
   * and the fix somebody reached for under a red gate would be to hide them.
   * The bug is a country that IS set and cannot be found. Unplaced clinicians
   * are counted instead, so the number is visible without being an error.
   */
  const unplaceable = online.filter((row) => row.country !== null && !world[row.country]);
  const unplaced = online.filter((row) => row.country === null).length;
  check(
    "🔴 nobody is online with a country the radar cannot show, which is advertised and undrawable",
    unplaceable.length === 0,
    unplaceable.length === 0
      ? `${online.length} online, ${online.length - unplaced} drawable, ${unplaced} with no country by choice`
      : unplaceable
          .map((row) => `${row.userId.slice(0, 8)} country=${JSON.stringify(row.country)}`)
          .join("; "),
  );

  /*
   * `region` is free text by design and holds a governorate, so it cannot be
   * constrained. It CAN be checked against the one wrong value the seed put
   * there, which was the country code doing duty as a place name.
   */
  const regionIsCountry = rows.filter(
    (row) => row.region !== null && row.country !== null && row.region.toUpperCase() === row.country,
  );
  check(
    "no region is the country code wearing a place name's column",
    regionIsCountry.length === 0,
    regionIsCountry.map((row) => `${row.city ?? "?"}: region=${JSON.stringify(row.region)}`).join("; ") ||
      `${rows.filter((r) => r.region !== null).length} regions checked`,
  );

  /* ------------------------------------------------------------- CONTROL -- */

  /*
   * The gate has to be able to FAIL, or it is decoration. This is the exact row
   * production carried: a code the constraint would now refuse and the map
   * cannot find. Asserted in memory rather than written, because a gate that
   * plants a bad row in a table with a CHECK on it is a gate that tests the
   * CHECK and leaves a mess when it throws.
   */
  const planted = [...placed, { ...placed[0]!, country: "eg" }];
  check(
    "🔴 CONTROL, the same scan CATCHES the 'eg' that was on production",
    planted.filter((row) => !world[row.country!]).length === 1,
    "one unfindable code among the real ones",
  );

  const stillThere = await controlDb
    .select({ userId: therapistRadar.userId })
    .from(therapistRadar)
    .where(eq(therapistRadar.country, "eg"));
  check(
    "…and the real table has none of them",
    stillThere.length === 0,
    `${stillThere.length} rows still lowercase`,
  );

  const withCountry = await controlDb
    .select({ userId: therapistRadar.userId })
    .from(therapistRadar)
    .where(isNotNull(therapistRadar.country));
  check(
    "76.18 the gate says how many rows it read",
    withCountry.length === placed.length,
    `${rows.length} radar rows, ${placed.length} with a country, ${online.length} online`,
  );

  /* ------------------------------------------------------------------ */
  /*  80.3 · `demo` is a label, and presence is measured for everybody   */
  /* ------------------------------------------------------------------ */

  /**
   * 🔴 THE EXEMPTION THAT WAS IN THREE PLACES AT ONCE.
   *
   * `therapist_radar.demo` used to mean "nothing is beating for this row, do
   * not let it go stale", and three separate expressions honoured that:
   * `reachable()` skipped the heartbeat, the staleness sweep skipped the row,
   * and the public profile computed `stale = !row.demo && !beating`. A fourth
   * place, `discover.ts`, borrowed the same column to mean "a fixture, hide it
   * from the patient's directory", gated on `SIMULATION_RUNNING`.
   *
   * The result was a permanently bookable fixture on a radar whose entire
   * promise is *somebody who is free NOW*, and a patient directory held up by
   * the same environment variable that served `Disallow: /` to every crawler.
   *
   * The founder's ruling: demo clinicians are listed like anybody else, and
   * their presence is real. So the column may now be SELECTED and never
   * decided upon, and this is the fence around that.
   *
   * 🔴 Comments stripped first. T1: the paragraph you are reading names the
   * pattern it forbids, and a scan with comments in would report this file's
   * own explanation as the offence.
   */
  const PRESENCE_FILES = ["lib/data/radar.ts", "lib/data/discover.ts"];

  /** A `demo` mention that is not simply reading the column out. */
  const decidedOn: string[] = [];
  for (const file of PRESENCE_FILES) {
    for (const [index, line] of readSource(file).split("\n").entries()) {
      if (!/\bdemo\b/.test(line)) continue;
      /* `demo: therapistRadar.demo,` is a projection and is allowed. */
      if (/^\s*demo:\s*therapistRadar\.demo,\s*$/.test(line)) continue;
      decidedOn.push(`${file}:${String(index + 1)} ${line.trim()}`);
    }
  }

  check(
    "🔴 80.3 nothing decides presence or listing from the demo flag",
    decidedOn.length === 0,
    decidedOn.length > 0
      ? decidedOn.join(" · ")
      : `${PRESENCE_FILES.length} files, demo is read and never tested`,
  );

  /*
   * 🔴 CONTROL — and the scan can see a line, or the check above is a
   * comparison against a file it failed to open.
   *
   * §6 and T2: an absence assertion with nothing proving it can fire is the
   * shape that produced four green lines about a constraint nobody parsed. The
   * projections are what the rule ALLOWS, so counting them proves the scanner
   * reached the column at all.
   */
  const projections = PRESENCE_FILES.flatMap((file) =>
    readSource(file)
      .split("\n")
      .filter((line) => /^\s*demo:\s*therapistRadar\.demo,\s*$/.test(line)),
  );

  check(
    "🔴 80.3 CONTROL the scanner can see the column it is checking",
    projections.length >= 3,
    `${String(projections.length)} projections found, so 'none tested' means none`,
  );

  finish("radar place");
}

void main();
