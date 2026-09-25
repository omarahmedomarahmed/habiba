import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * The simulator's /dev pages rested on each page remembering `simulatorOn`,
 * with no role at all on the payouts desk, which answers as the provider and
 * moves a payout.
 */

const read = (file: string) => readFileSync(file, "utf8");

test("every /dev page is a 404 on the live deployment, from its layout", () => {
  const layout = read("app/dev/layout.tsx");
  assert.match(layout, /if \(env\.liveDeployment\) notFound\(\);/);
  // Control: every page under app/dev sits under that layout and still asks the simulator itself.
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name === "page.tsx") pages.push(path);
    }
  };
  walk("app/dev");
  assert.ok(pages.length >= 2, "the scan found the simulator pages");
  for (const page of pages) assert.match(read(page), /simulatorOn\("/, `${page} does not ask the simulator`);
});

test("the payouts desk is the owner's, in the page and in the action", () => {
  const page = read("app/dev/payouts/page.tsx");
  assert.equal((page.match(/await requireRole\("super_admin"\)/g) ?? []).length, 2);
  // And the console only offers it to them.
  assert.match(read("app/(admin)/admin/payouts/page.tsx"), /simulatorOn\("payouts"\) && actor\.role === "super_admin"/);
});
