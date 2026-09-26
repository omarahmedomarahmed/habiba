import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { parseSeatBill } from "../lib/billing/seat-label";
import { countForm, countKey } from "../lib/i18n/count-form";
import { ar, en } from "../lib/i18n/messages";
import { format } from "../lib/i18n/server";

/**
 * 🔴 Board 268 / 420 / 424 (and B16 before them): "1 seats", "1 people",
 * "1 clinicians". A count meets a noun through four keys, picked by
 * `countForm`, and a key with forms is never called without it.
 */

test("countForm picks One, Two, the plural and Many", () => {
  assert.equal(countForm(1), "One");
  assert.equal(countForm(2), "Two");
  assert.equal(countForm(0), "");
  assert.equal(countForm(3), "");
  assert.equal(countForm(10), "");
  assert.equal(countForm(11), "Many");
});

test("the rows from the board read right in both languages", () => {
  assert.equal(format(en[countKey("sponsor.rosterCount", 1)], { count: 1 }), "1 person");
  assert.equal(format(en[countKey("aclinic.clinicians", 1)], { count: 1 }), "1 clinician");
  assert.equal(format(en[countKey("clinic.seatBill.seats", 1)], { count: 1 }), "1 seat");
  assert.equal(format(ar[countKey("clinic.seatBill.seats", 1)], { count: 1 }), "مقعد واحد");
  assert.equal(format(ar[countKey("sponsor.rosterCount", 2)], { count: 2 }), "شخصان");
  assert.equal(format(en[countKey("sponsor.rosterCount", 5)], { count: 5 }), "5 people");
});

test("a seat bill's stored English is read back into its parts", () => {
  assert.deepEqual(parseSeatBill("1 seats from 0, for the 5 days left of this month"), {
    kind: "change",
    toSeats: 1,
    fromSeats: 0,
    days: 5,
  });
  assert.deepEqual(parseSeatBill("Seats, 1, monthly"), { kind: "month", seats: 1 });
  assert.deepEqual(parseSeatBill("Practice, 3 seats, monthly"), { kind: "planMonth", plan: "Practice", seats: 3 });
  assert.equal(parseSeatBill("Completed session"), null);
});

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

test("no key that has count forms is called without countKey", () => {
  const counted = Object.keys(en).filter(
    (key) => `${key}One` in en && `${key}Two` in en && `${key}Many` in en,
  );
  const files = [...sources("app"), ...sources("components")];
  const offenders: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const key of counted) {
      if (text.includes(`t("${key}"`)) offenders.push(`${file}: ${key}`);
    }
  }
  assert.deepEqual(offenders, []);
});
