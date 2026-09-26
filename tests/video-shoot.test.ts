import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { readSource } from "../scripts/_verify";
import { ar, en } from "../lib/i18n/messages";
import { lastSequence, lineId, mergeLiveLines } from "../lib/sessions/live-lines";
import { splitGrants } from "../lib/consent/grant-rows";
import { handleChannel } from "../lib/patient-auth/handle-delivery";
import { amountSize } from "../components/billing/top-up-stepper";

/**
 * The demo video shoot on a fresh database (shoot NOTES.md, "What did not
 * work"). Each test names the shot it would have caught.
 */

test("shoot T12: the live panel shows lines saved by any writer, both speakers, once each", () => {
  const mine = [{ id: lineId(1), speaker: "therapist" as const, text: "How was the week?" }];
  /* The poll brings the patient's line (2) and the clinician's own line again (1). */
  const polled = [
    { id: lineId(1), speaker: "therapist" as const, text: "How was the week?" },
    { id: lineId(2), speaker: "patient" as const, text: "Work was heavy." },
  ];
  const merged = mergeLiveLines(mine, polled);
  assert.deepEqual(merged.map((l) => l.id), ["seq-1", "seq-2"]);
  assert.deepEqual(merged.map((l) => l.speaker), ["therapist", "patient"]);
  /* An upload answered after the poll lands in order, not at the end. */
  const late = mergeLiveLines(
    [...merged, { id: lineId(4), speaker: "patient" as const, text: "d" }],
    [{ id: lineId(3), speaker: "therapist" as const, text: "c" }],
  );
  assert.deepEqual(late.map((l) => l.id), ["seq-1", "seq-2", "seq-3", "seq-4"]);
  assert.equal(lastSequence(late), 4);
  assert.equal(lastSequence([]), 0);

  /* The room, the page and the poll all key lines by the stored sequence. */
  const room = readSource("components/session/session-room.tsx");
  assert.match(room, /state\?after=\$\{after\}/, "the room's poll asks for the saved segments");
  assert.match(room, /data\.segments/, "the room reads them");
  assert.doesNotMatch(room, /`s-\$\{data\.sequence\}`/, "the upload path used its own key");
  assert.match(readSource("app/(room)/sessions/[id]/room/page.tsx"), /id: lineId\(segment\.sequence\)/);
  const state = readSource("app/api/sessions/[id]/state/route.ts");
  assert.match(state, /gt\(transcriptSegments\.sequence/, "the state route returns segments after the room's last line");
  assert.match(state, /segments,/);
});

test("shoot T1: the therapist signup prints the terms line once", () => {
  const page = readSource("app/(auth)/signup/page.tsx");
  const form = readSource("components/auth/forms.tsx");
  assert.doesNotMatch(page, /tauth\.terms"/, "the page prints it as well as the form");
  assert.match(form, /tauth\.terms"/, "the form keeps it under Create account");
});

test("shoot C2: the top-up figure shrinks as it grows, and Submit stays in view", () => {
  assert.equal(amountSize("EGP 5,000"), "text-4xl");
  assert.doesNotMatch(amountSize("EGP 100,000"), /text-4xl/, "six figures ran under the + button");
  assert.doesNotMatch(amountSize("EGP 1,000,000"), /text-4xl|text-3xl/);
  assert.match(readSource("components/billing/top-up-stepper.tsx"), /whitespace-nowrap/);
  assert.match(readFileSync("components/billing/pay-by-transfer.tsx", "utf8"), /sticky bottom-0[\s\S]{0,200}<Declare \/>/);
});

test("shoot P12/P13/P19/P20: the session orb carries a real icon, not a box with a side missing", () => {
  const orb = readSource("components/patient/session-orb.tsx");
  assert.doesNotMatch(orb, /border-e-0/, "the drawn door read as a broken glyph");
  assert.match(orb, /<Video /);
  assert.match(orb, /<Banknote /);
  assert.doesNotMatch(readSource("components/billing/payment-popup.tsx"), /h-4 w-6 rounded-\[3px\] border-2/);
});

test("shoot P19: a request still waiting is not 'access that has ended'", () => {
  const { live, ended } = splitGrants(
    [
      {
        id: "asked",
        status: "pending",
        therapistName: "Karim Demo",
        expiresAt: null,
        decidedAt: null,
        revokedAt: null,
      },
    ],
    Date.now(),
  );
  assert.equal(live.length, 0);
  assert.equal(ended.length, 0, "a pending request printed 'Expired' before any grant existed");
});

test("shoot P19: nothing scrolled under the phone's corner reads through it", () => {
  const corner = readSource("components/i18n/language-corner.tsx");
  assert.doesNotMatch(corner, /bg-white\/90/);
  assert.match(corner, /<ScrollScrim \/>/);
  assert.doesNotMatch(readSource("components/patient/notice-bell.tsx"), /bg-white\/90/);
  assert.match(readSource("app/(patient)/layout.tsx"), /<LanguageCorner[\s\S]*?scrim[\s\S]*?\/>/);
});

test("shoot P11: the booking confirmation says the benefit covers it", () => {
  const cal = readSource("components/scheduling/booking-calendar.tsx");
  assert.match(cal, /psessions\.coveredByBenefit/, "the list's own words for a covered session");
  assert.match(cal, /pbook\.coveredPart/);
  assert.match(readSource("app/(public)/t/[id]/book/actions.ts"), /covered: result\.covered/);
  const sched = readSource("lib/data/scheduling.ts");
  assert.match(sched, /const pot = await payFromPot\(created\.id\)/);
  assert.match(sched, /covered,\n/);
  for (const key of ["pbook.coveredPart"] as const) {
    assert.ok(en[key] && ar[key], key);
    assert.doesNotMatch(ar[key], /[A-Za-z]/, `${key} has English left in`);
  }
});

test("shoot T21: with WhatsApp off, the claim is proved by email and claims the account's own record", () => {
  assert.equal(handleChannel({ phone: "+201000000000", email: "m@example.com" }, false), "email");
  assert.equal(handleChannel({ phone: "+201000000000", email: "m@example.com" }, true), "whatsapp");
  assert.equal(handleChannel({ phone: "+201000000000", email: null }, false), "whatsapp");
  assert.equal(handleChannel({ phone: null, email: "m@example.com" }, true), "email");

  const handle = readSource("lib/patient-auth/handle.ts");
  assert.match(handle, /handleChannel\(account, whatsappConfigured\(\)\)/);
  assert.match(handle, /set\(\{ channel: reached\.channel \}\)/, "the token records where the code went");
  assert.match(handle, /await claimOwnPerson\(actor\.accountId\)/);
  assert.match(readSource("lib/patient-auth/email.ts"), /claimOwnPerson\(accountId\)/);
  assert.match(readSource("lib/patient-auth/code-signin.ts"), /claimOwnPerson\(account\.id\)/);
  assert.match(readSource("app/(patient)/patient/claim/page.tsx"), /if \(proven\) await claimOwnPerson/);
  const claims = readSource("lib/data/claims.ts");
  assert.match(claims, /export async function claimOwnPerson/);
  assert.match(claims, /isNull\(people\.claimedAt\)\)\)\s*\.returning/);
  assert.ok(en["pclaim.handleTitleEmail"] && ar["pclaim.handleTitleEmail"]);
});

test("shoot T21: the copilot's gate says what to add and links to both", () => {
  const banner = readSource("components/patient/access-banner.tsx");
  assert.match(banner, /#diagnosis/);
  assert.match(banner, /#history/);
  const chart = readSource("app/(app)/patients/[id]/page.tsx");
  assert.match(chart, /id="diagnosis"/);
  assert.match(chart, /id="history"/);
  assert.match(chart, /gated=\{consent\.gated\}/);
  assert.match(readSource("app/(app)/copilot/[patientId]/page.tsx"), /gated=\{access\.gated\}/);
  for (const key of ["pban.addDiagnosis", "pban.addHistory"] as const) {
    assert.ok(en[key] && ar[key], key);
    assert.doesNotMatch(ar[key], /[A-Za-z]/);
  }
});
