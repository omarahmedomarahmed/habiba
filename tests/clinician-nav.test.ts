import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W2-T01 and W2-T07: where a clinician can go, on every screen size.
 *
 * T01: an applicant waiting on review had no way to ask us anything, because
 * `/support` was not open to them and nothing linked it. T07: the desktop
 * sidebar and the phone bar were two hand-written lists that disagreed
 * (bookings only on desktop, assistant and connect only on the phone, support
 * nowhere), and three pages were linked from nothing at all.
 *
 * The rule now: one list of destinations, which both navigations render.
 */

test("T01: support is open to a clinician who is not cleared yet", async () => {
  const { OPEN_TO_UNVERIFIED, destinationsFor } = await import("../lib/nav/clinician");

  assert.ok(OPEN_TO_UNVERIFIED.includes("/support"), "the shell bounces an applicant off /support");
  assert.ok(
    destinationsFor(false).some((item) => item.href === "/support"),
    "an applicant has no link to support",
  );
  // Every link an applicant is shown must be a page the shell lets them open.
  for (const item of destinationsFor(false)) {
    assert.ok(
      OPEN_TO_UNVERIFIED.some((prefix) => item.href.startsWith(prefix)),
      `${item.href} is linked for an applicant and bounces them`,
    );
  }
});

test("T01: the under-review card says how to reach us", () => {
  const form = readFileSync("components/onboarding/verification-form.tsx", "utf8");
  const card = form.slice(form.indexOf('{t("tver.underReview")}'));
  assert.match(card.slice(0, 2000), /href="\/support"/, "the waiting screen has no way out");
});

test("T07: the sidebar and the phone bar render the same list", () => {
  const layout = readFileSync("app/(app)/layout.tsx", "utf8");
  const bottom = readFileSync("components/nav/bottom-nav.tsx", "utf8");

  assert.match(layout, /destinationsFor\(/, "the sidebar keeps its own list");
  assert.match(bottom, /destinationsFor\(/, "the phone bar keeps its own list");

  // Neither navigation may add a destination of its own beside the list. The
  // one exception is the raised New session button, which is an action.
  const sidebar = layout.slice(layout.indexOf("<aside"), layout.indexOf("</aside>"));
  const own = [...sidebar.matchAll(/href="(\/[^"]*)"/g)]
    .map((match) => match[1])
    .filter((href) => href !== "/sessions/new" && href !== "/dashboard" && href !== "/settings");
  assert.deepEqual(own, [], "the sidebar links somewhere the phone does not");
  assert.doesNotMatch(bottom, /const (PRIMARY|MORE) = \[/, "the phone bar keeps its own list");
});

test("T07: every destination a clinician needs is on the list", async () => {
  const { destinationsFor } = await import("../lib/nav/clinician");
  const cleared = destinationsFor(true).map((item) => item.href);

  for (const href of ["/bookings", "/assistant", "/connect", "/support", "/earnings"]) {
    assert.ok(cleared.includes(href), `${href} is missing from the navigation`);
  }
  // CONTROL: the list is the whole product, not a handful.
  assert.ok(cleared.length >= 12, `only ${cleared.length} destinations`);
  // An applicant keeps Earnings on the phone as on desktop.
  assert.ok(destinationsFor(false).some((item) => item.href === "/earnings"));
});

test("T07: the practice switch is on the phone too", () => {
  const bottom = readFileSync("components/nav/bottom-nav.tsx", "utf8");
  const layout = readFileSync("app/(app)/layout.tsx", "utf8");
  assert.match(bottom, /switchToClinic/, "a phone user who also runs a practice cannot switch");
  assert.match(layout, /<BottomNav[^>]*clinic=/, "the shell never tells the phone bar");
});

test("T07: the orphan pages are linked", () => {
  const settings = readFileSync("app/(app)/settings/page.tsx", "utf8");
  const onCall = readFileSync("app/(app)/on-call/page.tsx", "utf8");

  assert.match(settings, /href="\/settings\/records"/, "nothing links the record system page");
  assert.match(settings, /href=\{`\/t\/\$\{actor\.userId\}`\}/, "nothing links their own public page");
  assert.match(onCall, /href=\{`\/t\/\$\{actor\.userId\}`\}/, "the radar page does not link their public page");
});
