import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { stripCommentsKeepingLines } from "../scripts/_dashes";
import { en, ar } from "../lib/i18n/messages";

/**
 * 🔴 B42: a message that tells somebody to go somewhere carries the way there.
 *
 * The verification rejection said "Sign in and update your details." and had
 * no link, while the reset email beside it did.
 */

const read = (file: string) => stripCommentsKeepingLines(readFileSync(file, "utf8"));

test("the therapist message renders a button when it is given a link", () => {
  const mail = read("lib/mail.ts");
  const fn = mail.slice(mail.indexOf("export async function sendTherapistMessage("), mail.indexOf("export async function sendPasswordReset("));
  assert.match(fn, /link\?: \{ label: string; url: string \} \| null/);
  assert.match(fn, /opts\.link\s*\?\s*`<a href="\$\{esc\(opts\.link\.url\)\}"/);
});

test("a rejected clinician is sent to onboarding, an approved one to their dashboard", () => {
  const actions = read("app/(admin)/admin/actions.ts");
  const decide = actions.slice(actions.indexOf("export async function decideTherapistVerification("));
  const call = decide.slice(decide.indexOf('t(approve ? "tmsg.verified.subject" : "tmsg.unverified.subject")'));
  assert.match(call.slice(0, 1500), /\{ label: t\("tmsg\.unverified\.open"\), url: `\$\{env\.appUrl\}\/onboarding` \}/);
  assert.match(call.slice(0, 1500), /\{ label: t\("tmsg\.verified\.open"\), url: `\$\{env\.appUrl\}\/dashboard` \}/);
  /* CONTROL the body still promises the sign in the button now delivers. */
  assert.match(en["tmsg.unverified.body"], /Sign in and update your details/);
  assert.match(ar["tmsg.unverified.open"], /[؀-ۿ]/);
});
