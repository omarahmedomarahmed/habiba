import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W2-C06: the record-system connection says how it went, and the rota export
 * is the rota on the screen.
 *
 * `/api/ehr/callback` redirected to `?ehr=connected|refused|expired|signedout|
 * mismatch` and neither records page read it, so a practice that had just
 * been through its hospital's sign-in saw the same screen whether it worked or
 * not. And the watermark promised the export "shows nothing this screen does
 * not" while the route exported a fixed 90 days back and 90 forward against a
 * screen showing one week.
 */

const read = (file: string) => readFileSync(file, "utf8");

test("the week is one function, and it is the same week the screen shows", async () => {
  assert.ok(existsSync("lib/clinic-week.ts"), "the week is computed in two places");
  const { clinicWeek } = await import("../lib/clinic-week");

  // CONTROL: in UTC the bounds are UTC midnights, as they always were.
  const wednesday = clinicWeek("2026-09-23", "UTC");
  assert.equal(wednesday.monday.toISOString(), "2026-09-21T00:00:00.000Z");
  assert.equal(wednesday.next.toISOString(), "2026-09-28T00:00:00.000Z");
  assert.equal(wednesday.prevKey, "2026-09-14");
  assert.equal(wednesday.mondayKey, "2026-09-21");
  assert.equal(wednesday.nextKey, "2026-09-28");

  // T8: in Cairo (UTC+3 in September) the week starts at Cairo's Monday midnight,
  // so a 01:30 Monday session is in that Monday's week and not the one before.
  const cairo = clinicWeek("2026-09-23", "Africa/Cairo");
  assert.equal(cairo.monday.toISOString(), "2026-09-20T21:00:00.000Z");
  assert.equal(cairo.next.toISOString(), "2026-09-27T21:00:00.000Z");
  const earlyMonday = new Date("2026-09-20T22:30:00Z");
  assert.ok(earlyMonday >= cairo.monday && earlyMonday < cairo.next);
  assert.ok(earlyMonday < wednesday.monday, "the UTC week leaves it out, which was the bug");

  // Nonsense falls back to the current week rather than to a range somebody named.
  const now = new Date("2026-09-24T12:00:00Z");
  assert.equal(clinicWeek("not a date", "UTC", now).monday.toISOString(), "2026-09-21T00:00:00.000Z");
  assert.equal(clinicWeek(undefined, "UTC", now).monday.toISOString(), "2026-09-21T00:00:00.000Z");
  // And "today" is the reader's today: 22:30 UTC on Sunday is already Monday in Cairo.
  const sundayNight = new Date("2026-09-27T22:30:00Z");
  assert.equal(clinicWeek(undefined, "Africa/Cairo", sundayNight).mondayKey, "2026-09-28");
  assert.equal(clinicWeek(undefined, "UTC", sundayNight).mondayKey, "2026-09-21");
});

test("the export takes the screen's week and nothing wider", () => {
  const route = read("app/(clinic)/clinic/export/route.ts");
  assert.match(route, /clinicWeek\(url\.searchParams\.get\("week"\), actor\.zone\.name\)/);
  assert.doesNotMatch(route, /90 \* 24 \* 60 \* 60 \* 1000/, "the export still reaches 90 days either way");

  const page = read("app/(clinic)/clinic/page.tsx");
  assert.match(page, /clinicWeek\(/);
  assert.match(page, /\/clinic\/export\?what=schedule&week=\$\{/, "the export link does not carry the week on screen");
});

test("both records pages say how the connection went", () => {
  for (const page of ["app/(clinic)/clinic/records/page.tsx", "app/(app)/settings/records/page.tsx"]) {
    assert.match(read(page), /outcome=\{/, `${page} ignores ?ehr=`);
  }
  const panel = read("components/ehr/records-panel.tsx");
  assert.match(panel, /records\.outcomeConnected/);
  assert.match(panel, /records\.outcomeFailed/);
});
