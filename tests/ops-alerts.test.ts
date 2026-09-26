import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { alertBoard, alertStatus, alertWords } from "../lib/observability/alert-words";
import { en } from "../lib/i18n/messages";
import { CRON_INTERVAL_HOURS } from "../lib/observability/heartbeat";

/**
 * 🔴 Board 423: the day-7 alerts were raw keys at the foot of /admin/errors,
 * absent from the /admin overview, and never marked cleared after every job
 * had run again.
 */

test("every scheduled job has words, so no alert is shown as a key", () => {
  for (const job of Object.keys(CRON_INTERVAL_HOURS)) {
    const words = alertWords(`cron-overdue:${job}`);
    assert.equal(words.key, "aops.cronOverdue", job);
    assert.ok(words.job && words.job in en, `${job} has a name in the dictionary`);
  }
  assert.equal(alertWords("digest:one-hand").key, "aops.oneHand");
  assert.equal(alertWords("server-errors").key, "aops.serverErrors");
});

test("an alert is open while its cause stands and cleared once it has gone", () => {
  const standing = new Set(["cron-overdue:billing"]);
  assert.equal(alertStatus("cron-overdue:billing", standing), "open");
  assert.equal(alertStatus("cron-overdue:extract", standing), "cleared");
  assert.equal(alertStatus("digest:one-hand", standing), "report");
});

test("the board is one row per key, with a standing problem that has no email yet", () => {
  const day = (d: number) => new Date(Date.UTC(2026, 8, d));
  const board = alertBoard(
    [
      { key: "cron-overdue:extract", sentAt: day(19) },
      { key: "cron-overdue:extract", sentAt: day(20) },
      { key: "digest:one-hand", sentAt: day(20) },
    ],
    new Set(["cron-overdue:crisis"]),
  );
  assert.deepEqual(
    board.map((row) => [row.key, row.status]),
    [
      ["cron-overdue:crisis", "open"],
      ["cron-overdue:extract", "cleared"],
      ["digest:one-hand", "report"],
    ],
  );
});

test("the overview shows the alerts and the errors page never prints a raw key", () => {
  const overview = readFileSync("app/(admin)/admin/page.tsx", "utf8");
  assert.match(overview, /<OpsAlertsCard /);
  const errors = readFileSync("app/(admin)/admin/errors/page.tsx", "utf8");
  assert.doesNotMatch(errors, /\.map\(\(a\) => a\.key\)/);
  assert.match(errors, /<OpsAlertsList /);
});
