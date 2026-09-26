import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { decodeEntities, htmlToText } from "../lib/mail-text";
import { PARTNER_EXPIRED, PARTNER_SIGN_IN, orgBounce, orgExpiredLanding, routeDecision } from "../lib/routing";

const read = (file: string) => readFileSync(file, "utf8");

/* ---------------------------------------------- board 640 / 648 (PT17, PT18) -- */

/**
 * Nadim removed by Tamer, and Tamer after his own password reset: both held a
 * partner cookie whose session was dead, and /partner and /partner/sign-in sent
 * each other back and forth twice a second. The chain now ends at the form.
 */
test("640 / 648: a revoked partner session reaches the sign-in form, never a loop", () => {
  const stale = { partner: true, expired: false };

  // The door itself, with the cookie still held, is what looped: it sends them home.
  assert.deepEqual(routeDecision(PARTNER_SIGN_IN, stale), { kind: "redirect", to: "/partner", keepNext: false });

  // So the guard never sends a cookie holder there; it sends them to the handler...
  const bounce = orgBounce("partner", true);
  assert.equal(bounce, PARTNER_EXPIRED);
  assert.deepEqual(routeDecision(bounce, stale), { kind: "pass" }, "the handler is reachable with the cookie");

  // ...which clears the cookie and lands on the form with expired=1, which renders.
  const landing = orgExpiredLanding("partner");
  assert.equal(landing, `${PARTNER_SIGN_IN}?expired=1`);
  assert.deepEqual(routeDecision(PARTNER_SIGN_IN, { partner: true, expired: true }), { kind: "pass" });
  assert.deepEqual(routeDecision(PARTNER_SIGN_IN, { partner: false, expired: true }), { kind: "pass" });

  // A session is dead for a removed member and for a reset (revoked) one alike.
  const session = read("lib/partner-auth/session.ts");
  assert.match(session, /isNull\(partnerAuthSessions\.revokedAt\)/);
  assert.match(session, /isNull\(partnerUsers\.deletedAt\)/);
  assert.match(session, /store\.delete\(PARTNER_COOKIE\)/, "revoking must delete the cookie");
  assert.match(read("app/(partner)/partner/session-expired/route.ts"), /await revokePartnerSession\(\)/);
  assert.match(read("lib/partner-auth/guard.ts"), /redirect\(orgBounce\("partner", hasCookie\)\)/);
});

/* ------------------------------------------------------------- board 641 -- */

test("641: an escaped organisation name reads as itself in the text part", () => {
  const html = `<head><title>x</title></head><p>You have been added to Helio Health&#39;s developer account as &quot;Admin&quot; &amp; more.</p>
    <a href="https://24therapy.example/partner/reset?token=a&amp;b">Set the password</a>`;
  const text = htmlToText(html);
  assert.match(text, /Helio Health's developer account as "Admin" & more\./);
  assert.doesNotMatch(text, /&#39;|&quot;|&amp;/);
  assert.match(text, /Set the password: https:\/\/24therapy\.example\/partner\/reset\?token=a&b/);
  // `&amp;` is decoded last, so an escaped entity stays the text of one.
  assert.equal(decodeEntities("&amp;lt;"), "&lt;");
});

test("641: every email goes out with that text part", () => {
  const mail = read("lib/mail.ts");
  assert.match(mail, /const text = htmlToText\(opts\.html\);/);
  assert.match(mail, /html: opts\.html,\s*text,/);
  assert.match(read("scripts/sim-inbox.ts"), /htmlToText\(r\.body\)/);
});

test("641 / CL8.3: choosing a password lands on a door that says it is set", () => {
  assert.match(read("app/(partner)/partner/sign-in/actions.ts"), /redirect\("\/partner\/sign-in\?set=1"\)/);
  assert.match(read("app/(partner)/partner/sign-in/page.tsx"), /set === "1" \? <PasswordSet/);
  assert.match(read("app/(clinic)/clinic/set-password/actions.ts"), /redirect\(`\$\{CLINIC_SIGN_IN\}\?set=1`\)/);
  assert.match(read("app/(clinic)/clinic/sign-in/page.tsx"), /set === "1" \? <PasswordSet/);
});

test("CL8.3: a clinic invitation asks for a first password, not a new one", () => {
  const page = read("app/(clinic)/clinic/set-password/page.tsx");
  assert.match(page, /view\.purpose === "invite" \? "welcome\.firstTitle" : "tauth\.chooseNew"/);
  assert.match(page, /first=\{view\.purpose === "invite"\}/);
  const form = read("components/clinic/password-forms.tsx");
  assert.match(form, /first \? "welcome\.password" : "tauth\.newPassword"/);
  assert.match(form, /first \? "welcome\.save" : "tauth\.updatePassword"/);
});
