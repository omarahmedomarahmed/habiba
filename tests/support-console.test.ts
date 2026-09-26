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

test("board 957 a reply and a close moments apart send one link and one code, and that link still opens it", async () => {
  const { reuseAccess, ACCESS_REUSE_MS } = await import("../lib/data/support");
  const now = Date.now();
  const week = 7 * 86_400_000;
  const issued = { accessToken: "t", accessCodeHash: "h", accessCodeExpiresAt: new Date(now - 4000 + week) };
  assert.equal(reuseAccess(issued, new Date(now - 4000), now), true, "four seconds after a reply");
  assert.equal(reuseAccess(issued, null, now), false, "the acknowledgement's link never stands for an answer");
  const late = now - ACCESS_REUSE_MS - 1;
  assert.equal(
    reuseAccess({ ...issued, accessCodeExpiresAt: new Date(late + week) }, new Date(late), now),
    false,
    "an answer later than the window gets its own link",
  );

  const { eq, like } = await import("drizzle-orm");
  const { controlDb: db } = await import("../lib/db");
  const { simOutbox, supportTicketEvents, supportTickets, users } = await import("../lib/db/schema");
  const { fileTicket, replyToTicket, closeTicket, readByToken } = await import("../lib/data/support");
  const [staff] = await db.select({ id: users.id }).from(users).limit(1);
  assert.ok(staff, "no user to act as staff");
  const address = `b957-${Date.now()}@example.com`;
  const filed = await fileTicket({
    name: "Omar Example",
    email: address,
    phone: null,
    country: null,
    topic: "a_company",
    message: "Where is my payout from last week, please?",
    locale: "en",
    entity: "us",
  });
  try {
    assert.equal(filed.ok, true);
    if (!filed.ok) return;
    const [row] = await db.select().from(supportTickets).where(eq(supportTickets.reference, filed.reference));
    const replied = await replyToTicket({ ticketId: row!.id, actorUserId: staff!.id, reply: "Which week was it, please?" });
    assert.ok(replied.ok, replied.error);
    const closed = await closeTicket({ ticketId: row!.id, actorUserId: staff!.id, summary: "Found the payout and sent it on." });
    assert.ok(closed.ok, closed.error);
    const kept = await db.select().from(simOutbox).where(eq(simOutbox.toAddress, address));
    assert.equal(kept.length, 2, `the acknowledgement and ONE answer, got ${kept.length}`);
    const answer = kept.find((k) => /Read the reply|answered/i.test(`${k.subject ?? ""} ${k.body}`)) ?? kept.at(-1)!;
    const token = /\/support\/([A-Za-z0-9_-]+)/.exec(answer.body)?.[1];
    const code = /\b(\d{6})\b/.exec(answer.body)?.[1];
    const opened = await readByToken({ token: token!, code: code! });
    assert.equal(opened.ticket?.status, "closed", "the one link sent opens the closed ticket");
  } finally {
    await db.delete(simOutbox).where(eq(simOutbox.toAddress, address));
    const rows = await db.select({ id: supportTickets.id }).from(supportTickets).where(like(supportTickets.email, address));
    for (const r of rows) {
      await db.delete(supportTicketEvents).where(eq(supportTicketEvents.ticketId, r.id));
      await db.delete(supportTickets).where(eq(supportTickets.id, r.id));
    }
  }
});

test("board 958: the reply box and the close summary ask for different things", () => {
  const queue = readFileSync("components/admin/support-queue.tsx", "utf8");
  assert.match(queue, /name="reply"[^>]*placeholder=\{t\("asupport\.answerHint"\)\}/);
  assert.match(queue, /name="summary"[^>]*placeholder=\{t\("asupport\.replyHint"\)\}/);
});
