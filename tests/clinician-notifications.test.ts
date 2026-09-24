import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W2-T06: a clinician's notifications have somewhere to be read.
 *
 * The dashboard fetched the three newest unread rows and kept only the crisis
 * ones. Everything else (an export ready, a history request answered, a
 * questionnaire back) was fetched and thrown away, `markAllRead` had no
 * caller, and there was no list anywhere. Worse, three newer non-crisis rows
 * pushed an unread crisis alert out of the three that were fetched.
 */

test("there is a notifications page, and it reads every kind", () => {
  const page = "app/(app)/notifications/page.tsx";
  assert.ok(existsSync(page), "no notifications page");
  const source = readFileSync(page, "utf8");
  assert.match(source, /recentNotifications\(/, "the page does not read the list");
  assert.doesNotMatch(source, /\.filter\([^)]*kind/, "the page filters kinds away again");
});

test("something can mark them read", () => {
  const actions = "app/(app)/notifications/actions.ts";
  assert.ok(existsSync(actions), "no action");
  assert.match(readFileSync(actions, "utf8"), /markAllRead\(/, "markAllRead still has no caller");
});

test("the dashboard asks for crisis alerts by kind, so newer rows cannot hide one", () => {
  const dashboard = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
  assert.match(dashboard, /unreadNotifications\(actor, \d+, "crisis"\)/);
  assert.match(dashboard, /href="\/notifications"/, "the dashboard does not lead to the list");
});

test("the list is a destination on both screens", async () => {
  const { destinationsFor } = await import("../lib/nav/clinician");
  assert.ok(destinationsFor(true).some((item) => item.href === "/notifications"));
});
