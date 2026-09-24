import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W2-C03: the practice's bills include its seat invoices, say what is paid
 * and what is due, and can be paid from the practice's own portal.
 *
 * The rows are proved in verify:sprint54 (seat invoice listed, due figure,
 * and a two-line invoice counted once). This file holds the pay path.
 */

const read = (file: string) => readFileSync(file, "utf8");

test("the bills page lists seat invoices and what is due", () => {
  const page = read("app/(clinic)/clinic/bills/page.tsx");
  assert.match(page, /clinicSeatBills\(/, "seat invoices never reach the page");
  assert.match(page, /dueCents/, "nothing says what is still unpaid");
});

test("a clinic admin can pay, through the card checkout the solo portal uses", () => {
  const file = "app/(clinic)/clinic/bills/actions.ts";
  assert.ok(existsSync(file), "no way to pay a bill from the clinic portal");
  const actions = read(file);
  assert.match(actions, /requireClinicAdmin\(\)/, "paying the practice's bill is the admin's");
  // The invoices are read on the server by organisation, never taken from a browser.
  assert.match(actions, /getDueInvoices\(actor\.clinicOrganizationId\)/);
  assert.match(actions, /createInvoiceCheckout\(/);
  assert.match(actions, /returnPath: "\/clinic\/bills"/, "checkout sends a practice manager to the clinician portal");
});

test("the checkout can return to the page that opened it", () => {
  const stripe = read("lib/billing/stripe.ts");
  const fn = stripe.slice(stripe.indexOf("export async function createInvoiceCheckout"));
  assert.match(fn.slice(0, 2500), /returnPath/, "success and cancel always land on /billing");
});
