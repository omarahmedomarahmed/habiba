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

test("the contact form acknowledges with the reference and a way back, and nothing they wrote (B33)", async () => {
  /*
   * Against the database: files a ticket under one of the two new topics
   * (0178) from an example.com address, which the outbox keeps rather than
   * sends, then reads the acknowledgement, opens the ticket with its own link
   * and code, and removes everything. The old code sent nothing, so the
   * outbox read below is the control.
   */
  const { eq, like } = await import("drizzle-orm");
  const { controlDb: db } = await import("../lib/db");
  const { simOutbox, supportTicketEvents, supportTickets } = await import("../lib/db/schema");
  const { fileTicket, readByToken } = await import("../lib/data/support");

  const address = `b33-${Date.now()}@example.com`;
  const words = "A private sentence about my employer that must not travel.";
  const filed = await fileTicket({
    name: "Contact Example",
    email: address,
    phone: null,
    country: null,
    topic: "a_company",
    message: words,
    locale: "en",
    entity: "us",
  });
  try {
    assert.equal(filed.ok, true, filed.ok ? "" : filed.error);
    if (!filed.ok) return;
    const kept = await db.select().from(simOutbox).where(eq(simOutbox.toAddress, address));
    assert.equal(kept.length, 1, "no acknowledgement reached the sender");
    const body = `${kept[0]!.subject ?? ""} ${kept[0]!.body}`;
    assert.match(body, new RegExp(filed.reference));
    assert.doesNotMatch(body, /private sentence/, "the acknowledgement quotes the message");

    const token = /\/support\/([A-Za-z0-9_-]+)/.exec(body)?.[1];
    const code = /\b(\d{6})\b/.exec(kept[0]!.body)?.[1];
    assert.ok(token && code, "the acknowledgement carries no link or no code");
    const opened = await readByToken({ token: token!, code: code! });
    assert.equal(opened.ticket?.reference, filed.reference, "the link and code do not open the ticket");
  } finally {
    await db.delete(simOutbox).where(eq(simOutbox.toAddress, address));
    const rows = await db.select({ id: supportTickets.id }).from(supportTickets).where(like(supportTickets.email, address));
    for (const row of rows) {
      await db.delete(supportTicketEvents).where(eq(supportTicketEvents.ticketId, row.id));
      await db.delete(supportTickets).where(eq(supportTickets.id, row.id));
    }
  }
});

test("every queue button is on the record", () => {
  const actions = read("app/(admin)/admin/support/actions.ts");
  for (const fn of ["takeTicket", "waitOnThem", "extend", "moveToWhatsapp", "close", "reply"]) {
    assert.match(bodyOf(actions, fn), /await audit\(/, `${fn} is not audited`);
  }
});

test("board 957: a close right after a reply keeps the link already sent and sends no second one", async () => {
  const { liveAccessRecent } = await import("../lib/data/support");
  const now = new Date("2026-09-26T08:00:00Z");
  const day = 86_400_000;
  const issuedAt = (ms: number) => ({ accessToken: "t", accessCodeExpiresAt: new Date(ms + 7 * day) });
  assert.equal(liveAccessRecent(issuedAt(now.getTime() - 4_000), now), true, "sent four seconds ago");
  assert.equal(liveAccessRecent(issuedAt(now.getTime() - 2 * day), now), false, "sent two days ago: tell them again");
  assert.equal(liveAccessRecent({ accessToken: null, accessCodeExpiresAt: null }, now), false);
  assert.equal(liveAccessRecent(issuedAt(now.getTime() - 8 * day), now), false, "expired");

  const source = readFileSync("lib/data/support.ts", "utf8");
  assert.match(source, /if \(code\) await tellAnswered\(ticket, link, code\)/);
});

test("board 958: the reply box and the close summary ask for different things", () => {
  const queue = readFileSync("components/admin/support-queue.tsx", "utf8");
  assert.match(queue, /name="reply"[^>]*placeholder=\{t\("asupport\.answerHint"\)\}/);
  assert.match(queue, /name="summary"[^>]*placeholder=\{t\("asupport\.replyHint"\)\}/);
});
