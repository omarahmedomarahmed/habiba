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
  const { OPEN_TO_UNVERIFIED, pagesFor } = await import("../lib/nav/clinician");

  assert.ok(OPEN_TO_UNVERIFIED.includes("/support"), "the shell bounces an applicant off /support");
  assert.ok(pagesFor(false).includes("/support"), "an applicant has no link to support");
  // Every link an applicant is shown, groups and their tabs, must be a page the shell lets them open.
  for (const href of pagesFor(false)) {
    assert.ok(
      OPEN_TO_UNVERIFIED.some((prefix) => href.startsWith(prefix)),
      `${href} is linked for an applicant and bounces them`,
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

test("T07 / ruling 14b: six places, and every page still in one of them", async () => {
  const { destinationsFor, pagesFor } = await import("../lib/nav/clinician");
  const cleared = pagesFor(true);

  for (const href of [
    "/dashboard", "/copilot", "/assistant", "/sessions", "/bookings", "/patients", "/notes",
    "/connect", "/earnings", "/billing", "/on-call", "/settings", "/notifications", "/support",
  ]) {
    assert.ok(cleared.includes(href), `${href} is missing from the navigation`);
  }
  // 🔴 Ruling 14b: fourteen places became six, and none was lost on the way.
  assert.equal(destinationsFor(true).length, 6, "the navigation grew past six places");
  assert.ok(cleared.length >= 14, `only ${cleared.length} pages are reachable from it`);
  // An applicant keeps Earnings on the phone as on desktop.
  assert.ok(pagesFor(false).includes("/earnings"));
});

test("ruling 14b: every group's pages are drawn as tabs on each of them", () => {
  const layout = readFileSync("app/(app)/layout.tsx", "utf8");
  const tabs = readFileSync("components/nav/section-tabs.tsx", "utf8");
  assert.match(layout, /<SectionTabs /, "the shell draws no tab row, so grouped pages have no way in");
  assert.match(tabs, /groupOf\(/, "the tab row keeps its own list");
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

/*
 * TE47: the homework and questionnaire actions revalidated
 * `/patients/<id>/homework` and `/patients/<id>/assessments`, which are
 * folders of actions with no page, so the list on /documents stayed stale.
 * Every path a clinician action revalidates must be a page that exists.
 */
test("TE47 every path a clinician action revalidates is a real page", async () => {
  const { existsSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name)) files.push(path);
    }
  };
  walk("app/(app)");

  const matchIn = (dir: string, rest: string[]): boolean => {
    if (!existsSync(dir)) return false;
    if (rest.length === 0 && existsSync(join(dir, "page.tsx"))) return true;
    const [head, ...tail] = rest;
    return readdirSync(dir).some((name) => {
      const path = join(dir, name);
      if (!statSync(path).isDirectory()) return false;
      if (head !== undefined && name === head) return matchIn(path, tail);
      if (head === ":dynamic" && /^\[[^.\]]+\]$/.test(name)) return matchIn(path, tail);
      return /^\(.+\)$/.test(name) && matchIn(path, rest);
    });
  };
  const exists = (route: string) => matchIn("app", route.split("/").filter(Boolean));

  const paths = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(/revalidatePath\(\s*[`"]([^`"]+)[`"]/g)) {
      paths.add(match[1]!.replace(/\$\{[^}]+\}/g, ":dynamic"));
    }
  }
  assert.ok(paths.size > 10, `read ${paths.size} paths, the scan is too narrow`);
  // Control: the old targets are caught, the new one is found.
  assert.equal(exists("/patients/:dynamic/homework"), false);
  assert.equal(exists("/patients/:dynamic/documents"), true);
  const missing = [...paths].filter((path) => !exists(path));
  assert.deepEqual(missing, [], `revalidated but no page: ${missing.join(", ")}`);
});

test("ruling 14b: the clinic's seven pages are four places, every page still in one", () => {
  const chrome = readFileSync("components/clinic/chrome.tsx", "utf8");
  const block = chrome.slice(chrome.indexOf("export const CLINIC_GROUPS"), chrome.indexOf("export const CLINIC_PAGES"));
  for (const href of ["/clinic", "/clinic/people", "/clinic/team", "/clinic/bills", "/clinic/earnings", "/clinic/seats", "/clinic/records"]) {
    assert.ok(block.includes(`href: "${href}"`), `${href} is missing from the clinic's navigation`);
  }
  assert.equal((block.match(/^ {2}\{\s*key: "/gm) ?? []).length, 4, "the clinic's navigation is not four places");
  assert.match(chrome, /<ClinicTabs capabilities=\{capabilities\} \/>/, "grouped clinic pages have no tab row");
});

/* Board 464 (B40 class): /sessions/new took 10.8 s; every clinician page waited on four reads in a row. */
test("board 464 the clinician layout reads the bill, the practice link and its four facts in one round", () => {
  const layout = readFileSync("app/(app)/layout.tsx", "utf8");
  assert.match(layout, /const \[pending, \[linked\], radar, \[me\], state, licence\] = await Promise\.all\(\[\s*pendingFor\(\),/);
  assert.doesNotMatch(layout, /const \[linked\] = await db/);
  const page = readFileSync("app/(app)/sessions/new/page.tsx", "utf8");
  assert.doesNotMatch(page, /await getCountrySettings\("eg"\)/, "the tax row is read alongside, not after");
});
