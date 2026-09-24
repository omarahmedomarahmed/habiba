import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W2-C02: the practice's seats are run from the practice's portal.
 *
 * W1-02 took the seat control away from seat clinicians (rightly: it was the
 * clinic's money on a clinician's screen), which left the only seat control
 * in the product on a page a clinic admin cannot reach. And inviting or
 * removing a clinician never changed `organizations.seats`, which is what the
 * seat bill is priced on (C4).
 *
 * The rule: the clinic admin changes seats on /clinic/seats through the same
 * two functions the solo stepper uses, and the invite and remove flows quote
 * the change and apply it through them too. No second seat writer.
 */

const read = (file: string) => readFileSync(file, "utf8");

test("a seats page in the clinic portal, for the admin only", () => {
  const page = "app/(clinic)/clinic/seats/page.tsx";
  assert.ok(existsSync(page), "no seats page in the clinic portal");
  assert.match(read(page), /requireClinicCapability\("seats\.manage"\)/);

  const chrome = read("components/clinic/chrome.tsx");
  assert.match(chrome, /href: "\/clinic\/seats"[^}]*needs: "seats\.manage"/);
});

test("the clinic's seat actions reuse the seat functions and ask for seats.manage", () => {
  const actions = read("app/(clinic)/clinic/seats/actions.ts");
  assert.match(actions, /quoteSeatChange\(/);
  assert.match(actions, /applySeatChange\(/);
  const guarded = [...actions.matchAll(/export async function \w+[\s\S]*?requireClinicCapability\("seats\.manage"\)/g)];
  const exported = [...actions.matchAll(/export async function/g)];
  assert.equal(guarded.length, exported.length, "a seat action without the capability");
  // No second writer of the seat count.
  assert.doesNotMatch(actions, /update\(organizations\)/);
});

test("the seat manager takes its actions, so both portals can render it", () => {
  const manager = read("components/billing/seat-manager.tsx");
  assert.doesNotMatch(manager, /from "@\/app\/\(app\)\/billing\/actions"/, "the clinic's screen would call the clinician's actions");
});

test("inviting and removing quote the seat change and apply it", () => {
  const people = read("app/(clinic)/clinic/people/actions.ts");
  const invite = people.slice(people.indexOf("export async function invite"), people.indexOf("export async function cancelInvitation"));
  const remove = people.slice(people.indexOf("export async function remove"));
  assert.match(invite, /applySeatChange\(/, "inviting never buys the seat it needs");
  assert.match(remove, /applySeatChange\(/, "removing never lowers the bill (C4)");

  const page = read("app/(clinic)/clinic/people/page.tsx");
  assert.match(page, /quoteSeatChange\(/, "the admin is not shown the figure before the click");
});
