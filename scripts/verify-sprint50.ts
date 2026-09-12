/**
 * Sprint 50 acceptance: the switches that do nothing.
 *
 *   npm run verify:sprint50
 *
 * ## The defect, and the two measurements that were wrong about it
 *
 * The founder switched a country off in admin, the audit log recorded it, and
 * the country stayed on the map and stayed clickable. Two rulings were written
 * from that, and the build session measured both:
 *
 *   - **C218** said `country_settings.enabled` was "written, audited, and read
 *     by nobody". It is read: `getCountrySettings` returns `null` when it is
 *     false, and `lib/billing/connect.ts` and `app/pay/[token]/actions.ts`
 *     both refuse the charge with a sentence. The grep found nothing because
 *     it searched for the column rather than for its accessor. C219's original
 *     instruction to delete the column would have left the payment rail open
 *     in a country we had just closed.
 *   - **C219** said `app/api/radar/route.ts` "contains no country condition of
 *     any kind". True, and a measurement of the wrong file: the route is a
 *     rate limiter around `listRadar` and has no `where` at all. The query is
 *     in `lib/data/radar.ts`, and it had no condition either, so the substance
 *     held and the evidence did not.
 *
 * So there are two switches now, each named for its question, and this proves
 * each does its own job and not the other's.
 *
 * ## 🔴 Why every check here is two-sided
 *
 * "The closed country returns zero rows" is exactly what a radar that returns
 * nothing at all reports, forever, and a broken query is a much more likely
 * way to make that number zero than a working filter is. Every absence below
 * is bracketed by the presence that gives it meaning: the rows are there, they
 * go away when the country closes, and they **come back** when it reopens.
 *
 * And the cache is part of the test rather than a nuisance around it. The
 * board is a per-instance TTL cache (C254), so a verifier that closed a
 * country and read the radar without invalidating would pass or fail on
 * timing. `setTaxonomyEnabled` drops the board itself (50.1c); this asserts
 * that it does, because if it does not, the operator meets the original
 * symptom again with a cache in place of the missing query.
 */
import { eq } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

const COUNTRY = "EG";

async function main() {
  writesTo();

  const { controlDb } = await import("../lib/db");
  const { taxonomyEntries, therapistRadar, users } = await import("../lib/db/schema");
  const { listRadar } = await import("../lib/data/radar");
  const { closedCodes, setTaxonomyEnabled } = await import("../lib/data/taxonomy");
  const { getCountrySettings } = await import("../lib/settings");

  const actor = required(
    (await controlDb.select({ id: users.id }).from(users).limit(1))[0],
    "user to attribute a taxonomy change to",
  );

  /* ------------------------------------------------ the fixture, restored -- */

  const seeded = required(
    (
      await controlDb
        .select({ userId: therapistRadar.userId, country: therapistRadar.country })
        .from(therapistRadar)
        .limit(1)
    )[0],
    "therapist on the radar",
  );

  const before = await controlDb
    .select({
      status: therapistRadar.status,
      country: therapistRadar.country,
      lastSeenAt: therapistRadar.lastSeenAt,
    })
    .from(therapistRadar)
    .where(eq(therapistRadar.userId, seeded.userId));
  const original = required(before[0], "radar row to restore afterwards");

  const restore = async () => {
    await controlDb
      .update(therapistRadar)
      .set({
        status: original.status,
        country: original.country,
        lastSeenAt: original.lastSeenAt,
      })
      .where(eq(therapistRadar.userId, seeded.userId));
    await setTaxonomyEnabled("country", COUNTRY, true, actor.id);
    await controlDb.delete(taxonomyEntries).where(eq(taxonomyEntries.code, COUNTRY));
  };

  try {
    /*
     * A live clinician in a known country, so there is something to hide.
     *
     * `lastSeenAt` is part of the fixture and not decoration: `reachable()`
     * requires a heartbeat inside the staleness window, so a row that is
     * merely `status: "online"` is still absent from the board. The first run
     * of this verifier set the status and not the beat, and every check on the
     * board read zero rows. Its CONTROL is the reason that showed up as four
     * failures rather than as one passing assertion about an empty radar.
     */
    await controlDb
      .update(therapistRadar)
      .set({ status: "online", country: COUNTRY, lastSeenAt: new Date() })
      .where(eq(therapistRadar.userId, seeded.userId));
    await setTaxonomyEnabled("country", COUNTRY, true, actor.id);

    /* ------------------------------------------ 50.1b · the country filter -- */

    const open = await listRadar();
    const onBoardWhenOpen = open.some((row) => row.userId === seeded.userId);

    check(
      "🔴 CONTROL the clinician IS on the radar while their country is open",
      onBoardWhenOpen,
      `${open.length} on the board`,
    );

    await setTaxonomyEnabled("country", COUNTRY, false, actor.id);

    const closed = await listRadar();
    const onBoardWhenClosed = closed.some((row) => row.userId === seeded.userId);

    check(
      `🔴 50.1b / 50.2 closing ${COUNTRY} takes its clinicians off the radar`,
      !onBoardWhenClosed,
      `${closed.length} on the board`,
    );

    /*
     * 🔴 50.1c / C254 — and it took effect without anybody waiting.
     *
     * The two reads above are milliseconds apart, well inside the board's
     * two-second TTL. If `setTaxonomyEnabled` did not drop the cache, the
     * second read would have returned the first read's rows and this check
     * would be the one that failed, rather than the country filter appearing
     * not to work in production for two seconds at a time on each instance.
     */
    check(
      "🔴 50.1c / C254 the change is visible immediately, so the cache is dropped on save",
      !onBoardWhenClosed && onBoardWhenOpen,
      "closed and re-read inside the 2s board TTL",
    );

    await setTaxonomyEnabled("country", COUNTRY, true, actor.id);

    const reopened = await listRadar();

    check(
      "🔴 CONTROL reopening it puts them back, so the zero above was the filter and not a broken query",
      reopened.some((row) => row.userId === seeded.userId),
      `${reopened.length} on the board`,
    );

    /* -------------------------------- 🔴 a clinician with no country stays -- */

    /*
     * `notInArray` on a nullable column is null-propagating: `NULL NOT IN
     * ('EG')` is NULL, not true, so the obvious one-line filter silently
     * removes everybody who has not filled in their profile. That is a far
     * worse failure than the one this sprint fixes, and it would look like
     * nothing at all in every test that seeds a country.
     */
    await controlDb
      .update(therapistRadar)
      .set({ country: null, lastSeenAt: new Date() })
      .where(eq(therapistRadar.userId, seeded.userId));
    await setTaxonomyEnabled("country", COUNTRY, false, actor.id);

    const unset = await listRadar();

    check(
      "🔴 a clinician who has set no country is never hidden by a closed one",
      unset.some((row) => row.userId === seeded.userId),
      "NULL NOT IN ('EG') is NULL, not true, so the naive filter would drop them",
    );

    /* ----------------------------------------- 50.1 · the money switch lives -- */

    /*
     * The other half of the rewritten ruling. This is asserted through the
     * ACCESSOR, because reading the column is what C218 did and what made it
     * wrong: the column's value is not the question, the answer the payment
     * path gets is.
     */
    const priced = await getCountrySettings(COUNTRY);

    check(
      "🔴 50.1 / C218 closing a country on the radar does NOT close the till",
      priced !== null && priced.code === COUNTRY,
      priced
        ? `${COUNTRY} still prices in ${priced.currency}, which is a separate operator decision`
        : `${COUNTRY} has no country_settings row in this database`,
    );

    const stillClosed = await closedCodes("country");
    check(
      "🔴 50.1 …and the two switches are genuinely separate, not one read twice",
      stillClosed.has(COUNTRY) && priced !== null,
      "visibility closed, money open, at the same moment",
    );

    /*
     * Both consumers still exist. Named by file, because the whole reason
     * C219 nearly deleted this column is that nobody could find them.
     */
    const connect = readSource("lib/billing/connect.ts");
    const payAction = readSource("app/pay/[token]/actions.ts");

    check(
      "🔴 50.1 the money switch keeps both of its payment consumers",
      /getCountrySettings\(/.test(connect) && /getCountrySettings\(/.test(payAction),
      "lib/billing/connect.ts and app/pay/[token]/actions.ts",
    );
  } finally {
    await restore();
  }

  /* ------------------------------------------------------ 50.4 · languages -- */

  /*
   * A hidden language is stripped from what is published, and the clinician's
   * row is untouched. Asserted on the shaping rule rather than by hiding a
   * language for real, because the destructive half of that test is the same
   * machinery already proved above and the thing worth pinning here is that
   * the filter is on the OUTPUT and not on the row.
   */
  const radarSource = readSource("lib/data/radar.ts");

  check(
    "🔴 50.4 a hidden language is filtered out of what is published, not deleted from the profile",
    /languages: \(row\.languages \?\? \[\]\)\.filter\(/.test(radarSource) &&
      !/delete[\s\S]{0,40}therapistRadar\.languages/.test(radarSource),
    "the clinician keeps the row and stops being matched on it",
  );

  /*
   * And the country condition is in the query, not in the route. This is the
   * shape of C219's error preserved as a check: the route has no `where` at
   * all, so anybody measuring it will keep finding nothing there.
   */
  const route = readSource("app/api/radar/route.ts");

  check(
    "50.1b the country condition lives in queryBoard, where the query is",
    /closedCodes\("country"\)/.test(radarSource) && !/where\(/.test(route),
    "app/api/radar/route.ts is a rate limiter around listRadar and has no where clause",
  );

  finish("sprint 50");
}

void main();
