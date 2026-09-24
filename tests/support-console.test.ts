import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { stripCommentsKeepingLines } from "../scripts/_dashes";

/**
 * W2-A02: a support ticket can be read (audited), replied to, and a ticket
 * moved to WhatsApp can be closed. The database half (a reply waits on them
 * behind a link; a moved ticket closes with its summary) is in
 * `verify:sprint20`.
 */

const read = (file: string) => stripCommentsKeepingLines(readFileSync(file, "utf8"));
const bodyOf = (source: string, fn: string) => {
  const start = source.indexOf(`export async function ${fn}(`);
  assert.ok(start >= 0, `${fn} is missing`);
  return source.slice(start, source.indexOf("\n}\n", start));
};

test("the queue can read a ticket, through the audited read, and only its words reach the browser", () => {
  const queue = read("components/admin/support-queue.tsx");
  assert.match(queue, /openTicket\(row\.id\)/, "nothing on the queue calls the read");

  const open = bodyOf(read("app/(admin)/admin/support/actions.ts"), "openTicket");
  assert.match(open, /await requireStaff\(\)/);
  assert.match(open, /readTicket\(/, "the read that writes the phi_access row");
  assert.doesNotMatch(open, /access(Token|CodeHash)|\.\.\.opened\.ticket|return opened;/, "the sender's token reaches the browser");
});

test("a reply that does not close carries no word of it in the message", () => {
  const reply = bodyOf(read("lib/data/support.ts"), "replyToTicket");
  assert.match(reply, /kind: "replied"/);
  assert.match(reply, /status: "waiting_on_them"/);
  const body = reply.slice(reply.indexOf("body:"), reply.indexOf("link:", reply.indexOf("body:")));
  assert.doesNotMatch(body, /\$\{(reply|ticket\.message|ticket\.topic)\}/);
  assert.match(read("components/admin/support-queue.tsx"), /action=\{replyAction\}/);
});

test("a ticket moved to WhatsApp can be closed, with what was agreed", () => {
  const close = bodyOf(read("lib/data/support.ts"), "closeTicket");
  assert.match(close, /whatsappSummary\?: string|input\.whatsappSummary/);
  assert.match(close, /whatsappSummary: whatsapp/, "the summary is never written");
  assert.match(read("components/admin/support-queue.tsx"), /name="whatsappSummary"/);
  assert.match(bodyOf(read("app/(admin)/admin/support/actions.ts"), "close"), /whatsappSummary:/);
});

test("every queue button is on the record", () => {
  const actions = read("app/(admin)/admin/support/actions.ts");
  for (const fn of ["takeTicket", "waitOnThem", "extend", "moveToWhatsapp", "close", "reply"]) {
    assert.match(bodyOf(actions, fn), /await audit\(/, `${fn} is not audited`);
  }
});
