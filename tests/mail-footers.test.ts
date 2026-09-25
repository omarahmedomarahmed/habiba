import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { stripCommentsKeepingLines } from "../scripts/_dashes";
import { en, ar } from "../lib/i18n/messages";
import { FOOTING_OF_KIND, READERS, footerKeys, footingFor } from "../lib/notify/readers";

/**
 * 🔴 B15, B23, B41, B52: the line under an email fits whoever reads it.
 *
 * Round 1 found a practice manager's invitation, a company's payment receipt,
 * the back office's sign-in code and a patient's reset code all ending "about
 * an appointment you booked", and a clinician's own password reset ending
 * "sent by your therapist".
 */

const lines = (keys: [string, string]) => keys.map((k) => en[k as keyof typeof en]).join(" ");
const BOOKED = en["pmsg.mail.aboutBooking"];
const THERAPIST = en["pmsg.mail.fromTherapist"];

test("a code or a reset says they asked for it, whoever they are", () => {
  for (const kind of ["claim.code", "password.reset_code", "phone.verify", "staff.second_factor_code", "benefit.verify_code"] as const) {
    const text = lines(footerKeys(footingFor(kind)));
    assert.doesNotMatch(text, /appointment|therapist/, kind);
    assert.match(text, /asked for it/, kind);
  }
  /* The clinician's own reset, from `sendPasswordReset`. */
  assert.match(lines(footerKeys({ reader: "clinician", occasion: "asked" })), /asked for it/);
});

test("staff, managers, companies, partners and clinicians never read a patient's footer", () => {
  for (const reader of READERS.filter((r) => r !== "patient")) {
    for (const occasion of ["booking", "therapist", "account", "asked"] as const) {
      const text = lines(footerKeys({ reader, occasion }));
      assert.ok(!text.includes(BOOKED) && !text.includes(THERAPIST), `${reader} ${occasion}: ${text}`);
    }
  }
  /* A company's payment confirmation: the kind's usual reader is a patient, the sender says company. */
  assert.match(lines(footerKeys(footingFor("payment.confirmed", "company"))), /company's account/);
  assert.match(lines(footerKeys(footingFor("renewal.due_soon", "manager"))), /practice's account/);
});

test("CONTROL a patient's booking and their clinician's invitation keep their own lines", () => {
  assert.ok(lines(footerKeys(footingFor("booking.confirmed"))).includes(BOOKED));
  assert.ok(lines(footerKeys(footingFor("claim.invite"))).includes(THERAPIST));
  /* And the old one-size line would have failed the staff check above. */
  assert.ok(lines(["pmsg.mail.aboutBooking", "pmsg.mail.ignore"]).includes(BOOKED));
});

test("every footer line exists in Arabic, and every kind has a reader", () => {
  for (const footing of Object.values(FOOTING_OF_KIND)) {
    for (const key of footerKeys(footing)) assert.match(ar[key], /[؀-ۿ]/, key);
  }
  for (const reader of READERS) {
    for (const key of footerKeys({ reader, occasion: "account" })) assert.match(ar[key], /[؀-ۿ]/, key);
  }
});

test("no email can fall back to a footer nobody chose", () => {
  const mail = stripCommentsKeepingLines(readFileSync("lib/mail.ts", "utf8"));
  assert.match(mail, /function layout\(title: string, body: string, footer: string/);
  assert.doesNotMatch(mail, /footer \?\?/);
  assert.doesNotMatch(mail, /layout\([^)]*,\s*undefined,/);
});
