import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { stripCommentsKeepingLines } from "../scripts/_dashes";

/**
 * W2-A03: transfer exceptions are work on /admin/transfers, never a log line.
 * The database round trip (a cancelled session's transfer raises "bought
 * nothing", a retry runs once, a cart is discarded or expires) is
 * `tests/rail-exceptions-db.test.ts`, which needs migration 0142.
 */

const read = (file: string) => stripCommentsKeepingLines(readFileSync(file, "utf8"));
const around = (source: string, needle: string, after = 900) => {
  const at = source.indexOf(needle);
  assert.ok(at >= 0, `missing: ${needle}`);
  return source.slice(at, at + after);
};

test("every silent case now raises an exception on the row", () => {
  const grants = read("lib/billing/manual-grants.ts");
  for (const [needle, kind] of [
    ["manual session payment confirmed but the session was not pending", "not_payable"],
    ["manual session payment: a payment row already existed", "not_payable"],
    ["manual subscription payment confirmed but nothing was due", "not_payable"],
    ["manual subscription payment left money over", "overpaid"],
  ] as const) {
    assert.match(around(grants, needle), new RegExp(`flagException\\([^)]*"${kind}"`), needle);
  }

  const manual = read("lib/billing/manual.ts");
  assert.match(around(manual, "manual payment confirmed but the grant failed"), /flagException\([^)]*"grant_failed"/);
  assert.doesNotMatch(manual, /Tell an engineer/);
});

test("the transfers page shows them, and an open cart can be discarded and expires", () => {
  const page = read("app/(admin)/admin/transfers/page.tsx");
  assert.match(page, /openExceptions\(\)/);
  assert.match(page, /<RailExceptions/);
  assert.match(read("components/admin/open-carts.tsx"), /discardOpenCart\(row\.id\)/);

  const cron = read("app/api/cron/[job]/route.ts");
  assert.match(around(cron, "async retention()", 2000), /expireOpenCarts\(\)/);
});

/*
 * 🔴 A15: both lists showed `settlesCents`, the dollars, which the console
 * converts at TODAY's rate. An operator matching a bank line needs the pounds
 * the payer was asked to send, which is `amountCents` in `currency`.
 */
test("🔴 A15 exceptions and open carts lead with the figure on the bank line", () => {
  const page = read("app/(admin)/admin/transfers/page.tsx");
  for (const [list, v] of [["<RailExceptions", "e"], ["<OpenCarts", "c"]] as const) {
    assert.match(
      around(page, list, 700),
      new RegExp(`amountLabel: formatMoney\\(${v}\\.amountCents, ${v}\\.currency\\.toUpperCase\\(\\), "en-US"\\)`),
      `${list} is given the payer's own figure`,
    );
  }
  for (const file of ["components/admin/rail-exceptions.tsx", "components/admin/open-carts.tsx"]) {
    const source = read(file);
    const bank = source.indexOf("{row.amountLabel}");
    const usd = source.indexOf("<Money cents={row.settlesCents} />");
    assert.ok(bank >= 0, `${file} renders the bank figure`);
    assert.ok(usd > bank, `CONTROL: ${file} still shows the dollars it settles, after the bank figure and not instead of it`);
  }
});

test("the retry is claimed once, and the cart rules match the payer's own", async () => {
  const lib = read("lib/billing/rail-exceptions.ts");
  const retry = around(lib, "export async function retryGrant(", 900);
  assert.match(retry, /\.update\(manualPayments\)[\s\S]*eq\(manualPayments\.exception, "grant_failed"\)/);
  const discard = around(lib, "export async function discardCart(", 400);
  assert.match(discard, /eq\(manualPayments\.state, "awaiting_proof"\)/);

  const { CART_EXPIRY_DAYS } = await import("../lib/billing/rail-exceptions");
  assert.ok(CART_EXPIRY_DAYS >= 14, "a cart expires before a slow transfer can land");
});
