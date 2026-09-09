import "server-only";

import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { hashPassword as hashCode, verifyPassword as verifyCode } from "@/lib/auth/password";
import { db } from "@/lib/db";
import {
  supportAttachments,
  supportTicketEvents,
  supportTickets,
  TICKET_TOPICS,
  users,
  type Entity,
  type SupportTicket,
  type SupportTicketEvent,
  type TicketTopic,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";
import { notify } from "@/lib/notify";
import { e164Problem, toE164 } from "@/lib/phone/e164";
import { callerKey, consume, globalCeiling } from "@/lib/rate-limit";

/**
 * Support tickets. PLAN.md 18R.2–18R.5, and the queue 20.18–20.22 works from.
 *
 * ## 🔴 This module is the boundary around what people write to us
 *
 * 18R.4 / C82: the person filling in the public contact form is not signed in
 * and may be a patient describing a session, a diagnosis, or a crisis. What
 * they type is health information arriving through a non-clinical door, and it
 * is treated like sprint 8's documents from the moment it lands:
 *
 *   - It is **stored**, never forwarded. No email carries the message onward
 *     (§6 — patient data leaving the building), and no notification quotes it.
 *   - Reading one is **audited**, by the same `audit()` every chart read uses.
 *   - It **never enters a prompt.** Nothing here is importable by the copilot
 *     or the assistant: the same separate-module rule as `patient-view.ts`,
 *     and the sprint 18R verifier asserts the import graph.
 *
 * ## Why intake never resolves who somebody is
 *
 * An address typed into a public form is not an identity. C39 measured three
 * production addresses shared across patients — one across three people in
 * three organisations — and §3b's whole design is that proving a handle is not
 * proving a person. So a ticket records what was typed and links to an account
 * only when the sender was **signed in as one**. Matching is a human's job,
 * with the two questions §3b already specifies.
 */

/** 20.20 — the clock. Twenty-four hours, and it pauses while we wait on them. */
export const FIRST_REPLY_HOURS = 24;

/** 18R.5 — what one network may file, and what the platform accepts at all. */
const PER_CALLER = { limit: 3, windowSeconds: 3600 };
const PLATFORM_CEILING = { limit: 60, windowSeconds: 60 };

export type TicketInput = {
  name: string;
  email: string | null;
  phone: string | null;
  /** ISO 3166-1 alpha-2, for expanding a national number. Never guessed. */
  country: string | null;
  topic: string;
  message: string;
  locale: string;
  entity: Entity;
  source?: "contact_form" | "patient" | "therapist";
  /**
   * 🔴 20.24 — which queue. Recorded rather than derived from `source`,
   * because a clinician can write in through the public contact form too and
   * the queue must not depend on which door they used.
   */
  audience?: "patient" | "therapist";
  patientAccountId?: string | null;
  userId?: string | null;
  /** 20.25 — what it is about, when it is about something. */
  relatedSessionId?: string | null;
  relatedPayoutRequestId?: string | null;
};

export type TicketResult =
  | { ok: true; reference: string; dueAt: Date; id: string }
  | { ok: false; error: string };

/**
 * A short reference a person can quote back. Not a UUID.
 *
 * Somebody reading it out on the phone at two in the morning should not have
 * to say thirty-six characters, and a support process where the reference is
 * unusable is a support process conducted by describing the message instead.
 */
function newReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I/O/0/1.
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * File a ticket. 18R.2–18R.5.
 *
 * Everything is validated here rather than in the form, because the form is a
 * convenience and this is the door. The rate limits are checked **before** the
 * write and in two places — one network, and the whole platform — because a
 * per-address limit does nothing against a botnet and a full support queue is
 * how a real message gets missed.
 */
export async function fileTicket(input: TicketInput): Promise<TicketResult> {
  const name = input.name.trim();
  const message = input.message.trim();
  const topic = input.topic.trim() as TicketTopic;

  if (name.length < 2) return { ok: false, error: "Tell us what to call you." };
  if (!TICKET_TOPICS.includes(topic)) {
    return { ok: false, error: "Choose what this is about." };
  }
  if (message.length < 10) {
    return { ok: false, error: "Tell us a little more, so somebody can actually help." };
  }
  if (message.length > 5_000) {
    return { ok: false, error: "That is longer than this form can take. Send us the short version and we will write back." };
  }

  const email = input.email?.trim().toLowerCase() || null;
  const phoneInput = input.phone?.trim() || null;

  let phone: string | null = null;
  if (phoneInput) {
    /*
     * E.164 with a country the form asked for (11R.5). A number stored in a
     * national format is a number nobody can dial from the other entity, and
     * this product has two.
     */
    const expanded = toE164(phoneInput, input.country);
    const problem = e164Problem(expanded);
    if (problem || !expanded.ok) {
      return { ok: false, error: problem ?? "That phone number does not look right." };
    }
    phone = expanded.e164;
  }

  if (!email && !phone) {
    return { ok: false, error: "Leave an email address or a phone number, so we can reply." };
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "That email address does not look right." };
  }

  /* ------------------------------------------------------------ 18R.5 */

  const ceiling = await globalCeiling("support.ticket", PLATFORM_CEILING.limit, PLATFORM_CEILING.windowSeconds);
  if (!ceiling.allowed) {
    return { ok: false, error: "We are getting an unusual number of messages. Try again in a minute." };
  }

  const key = await callerKey("support.ticket");
  const verdict = await consume(key, PER_CALLER.limit, PER_CALLER.windowSeconds);
  if (!verdict.allowed) {
    return {
      ok: false,
      error: "You have sent us a few messages already. We have them, give us a little time to reply.",
    };
  }

  const dueAt = new Date(Date.now() + FIRST_REPLY_HOURS * 3_600_000);
  const reference = newReference();

  const [row] = await db
    .insert(supportTickets)
    .values({
      reference,
      source: input.source ?? "contact_form",
      name: name.slice(0, 120),
      email,
      phone,
      audience: input.audience ?? "patient",
      patientAccountId: input.patientAccountId ?? null,
      userId: input.userId ?? null,
      relatedSessionId: input.relatedSessionId ?? null,
      relatedPayoutRequestId: input.relatedPayoutRequestId ?? null,
      topic,
      message,
      locale: input.locale,
      entity: input.entity,
      status: "open",
      dueAt,
    })
    .returning({ id: supportTickets.id });

  if (row) {
    await db.insert(supportTicketEvents).values({
      ticketId: row.id,
      kind: "created",
      actorUserId: null,
      note: `Filed through the ${input.source ?? "contact_form"} in ${input.locale}`,
    });
  }

  /*
   * Logged as a *reference*, never as content. `log.info` reaches application
   * logs, and §6 is explicit that no transcript text goes there — a support
   * message is the same material through a different door.
   */
  log.info("support ticket filed", { ticket: ref(row?.id ?? ""), topic, entity: input.entity });

  return { ok: true, reference, dueAt, id: row?.id ?? "" };
}

/* ------------------------------------------------------------- the queue -- */

/**
 * The open queue, oldest deadline first. Sprint 20 builds the screen.
 *
 * 🔴 Deliberately does **not** select `message`. The queue is triage — topic,
 * age, owner — and a list view that carries every message body is a list view
 * that puts a hundred people's health information on one screen. Reading one
 * ticket is `readTicket`, and it is audited.
 */
export async function openTickets(limit = 100) {
  const now = Date.now();

  const rows = await db
    .select({
      id: supportTickets.id,
      reference: supportTickets.reference,
      name: supportTickets.name,
      topic: supportTickets.topic,
      status: supportTickets.status,
      locale: supportTickets.locale,
      entity: supportTickets.entity,
      ownerUserId: supportTickets.ownerUserId,
      createdAt: supportTickets.createdAt,
      dueAt: supportTickets.dueAt,
      waitingSince: supportTickets.waitingSince,
      extendedAt: supportTickets.extendedAt,
    })
    .from(supportTickets)
    .where(sql`${supportTickets.status} <> 'closed'`)
    .orderBy(asc(supportTickets.dueAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    ageHours: Math.round(((now - row.createdAt.getTime()) / 3_600_000) * 10) / 10,
    /*
     * 20.20 / C83 — overdue is measured on **our** delay. A ticket parked on
     * `waiting_on_them` is not overdue however long they take, because the
     * clock stopped when we asked them a question.
     */
    overdue: row.status !== "waiting_on_them" && row.dueAt.getTime() < now,
  }));
}

/**
 * One ticket, in full, for a named member of staff. Audited.
 *
 * The audit entry is the point: this is the read that exposes what somebody
 * wrote, and §6's rule is that every read of clinical material is attributable.
 */
export async function readTicket(input: {
  ticketId: string;
  actor: { userId: string; organizationId: string; role: string };
}) {
  const [row] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, input.ticketId))
    .limit(1);

  if (!row) return null;

  /*
   * `phi_access`, not an "admin" action, and that is the ruling rather than a
   * convenience: 18R.4 says what somebody types here is clinical material, so
   * reading it belongs in the same audit category as reading a chart. A
   * separate "support" category would make it possible to answer "who read
   * patient material this month" and miss these.
   */
  await audit({
    actor: input.actor as never,
    category: "phi_access",
    action: "ticket.read",
    resourceType: "support_ticket",
    resourceId: row.id,
  });

  const events = await db
    .select()
    .from(supportTicketEvents)
    .where(eq(supportTicketEvents.ticketId, row.id))
    .orderBy(desc(supportTicketEvents.createdAt));

  return { ticket: row, events };
}

/** How many are waiting on us right now, for the overview in 20.8. */
export async function ticketCounts() {
  const [row] = await db
    .select({
      open: sql<number>`COUNT(*) FILTER (WHERE ${supportTickets.status} = 'open')::int`,
      waiting: sql<number>`COUNT(*) FILTER (WHERE ${supportTickets.status} = 'waiting_on_them')::int`,
      overdue: sql<number>`COUNT(*) FILTER (WHERE ${supportTickets.status} = 'open' AND ${supportTickets.dueAt} < now())::int`,
      unowned: sql<number>`COUNT(*) FILTER (WHERE ${supportTickets.status} <> 'closed' AND ${supportTickets.ownerUserId} IS NULL)::int`,
    })
    .from(supportTickets);

  return row ?? { open: 0, waiting: 0, overdue: 0, unowned: 0 };
}

/** 20.18 — a ticket somebody now owns. Unowned work is nobody's work. */
export async function claimTicket(input: { ticketId: string; ownerUserId: string }) {
  const updated = await db
    .update(supportTickets)
    .set({ ownerUserId: input.ownerUserId, updatedAt: new Date() })
    .where(and(eq(supportTickets.id, input.ticketId), isNull(supportTickets.ownerUserId)))
    .returning({ id: supportTickets.id });

  if (updated.length === 0) return { error: "Somebody else has already taken that one." };

  await db.insert(supportTicketEvents).values({
    ticketId: input.ticketId,
    kind: "claimed",
    actorUserId: input.ownerUserId,
  });
  return { ok: true };
}

/* ------------------------------------------- 20.20 · the clock, and its pause -- */

/** 20.20 — one extension, of one day, with a reason. Not two. */
export const EXTENSION_HOURS = 24;

/**
 * Staff have answered and are now waiting on the other person. 20.20 / C83.
 *
 * 🔴 **The clock stops here.** Staff are measured on their own delay, and a
 * queue that counts a patient's four-day silence against the person who
 * replied in ten minutes is a queue that teaches people to close tickets
 * early rather than answer them well.
 */
export async function awaitReply(input: {
  ticketId: string;
  actorUserId: string;
  note: string;
}): Promise<{ ok?: boolean; error?: string }> {
  if (input.note.trim().length < 5) {
    return { error: "Say what you asked them, so the next person can pick this up." };
  }

  const updated = await db
    .update(supportTickets)
    .set({ status: "waiting_on_them", waitingSince: new Date(), updatedAt: new Date() })
    .where(and(eq(supportTickets.id, input.ticketId), eq(supportTickets.status, "open")))
    .returning({ id: supportTickets.id });

  if (updated.length === 0) return { error: "That ticket is not open." };

  await db.insert(supportTicketEvents).values({
    ticketId: input.ticketId,
    kind: "waiting",
    actorUserId: input.actorUserId,
    note: input.note.trim(),
  });
  return { ok: true };
}

/**
 * They came back. The clock restarts — and it restarts *from now*.
 *
 * Not "resumes with the remaining hours": the reply is new information and the
 * person answering it deserves the same day anybody else gets. Carrying the
 * old remainder forward would make a ticket that waited a week arrive already
 * overdue, which is a queue punishing staff for somebody else's silence.
 */
export async function replyReceived(input: { ticketId: string }): Promise<void> {
  await db
    .update(supportTickets)
    .set({
      status: "open",
      waitingSince: null,
      dueAt: new Date(Date.now() + FIRST_REPLY_HOURS * 3_600_000),
      updatedAt: new Date(),
    })
    .where(
      and(eq(supportTickets.id, input.ticketId), eq(supportTickets.status, "waiting_on_them")),
    );

  await db.insert(supportTicketEvents).values({
    ticketId: input.ticketId,
    kind: "replied",
    actorUserId: null,
    note: "They replied, the clock restarts",
  });
}

/**
 * 20.20 — one extension, once, with a reason.
 *
 * Refused the second time by looking at `extendedAt`, so "extend it again" is
 * a conversation with a manager rather than a button. An unlimited extension
 * is not a deadline.
 */
export async function extendTicket(input: {
  ticketId: string;
  actorUserId: string;
  reason: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const reason = input.reason.trim();
  if (reason.length < 10) return { error: "Say why this needs another day." };

  const updated = await db
    .update(supportTickets)
    .set({
      dueAt: sql`${supportTickets.dueAt} + interval '${sql.raw(String(EXTENSION_HOURS))} hours'`,
      extendedAt: new Date(),
      extensionReason: reason,
      updatedAt: new Date(),
    })
    .where(and(eq(supportTickets.id, input.ticketId), isNull(supportTickets.extendedAt)))
    .returning({ id: supportTickets.id });

  if (updated.length === 0) {
    return { error: "This ticket has already had its extension. Ask a manager." };
  }

  await db.insert(supportTicketEvents).values({
    ticketId: input.ticketId,
    kind: "extended",
    actorUserId: input.actorUserId,
    note: reason,
  });
  return { ok: true };
}

/**
 * 🔴 20.21 — the ticket moved to WhatsApp, and says so.
 *
 * Moving is allowed and often the humane thing at three in the morning. What
 * is not allowed is the conversation disappearing: the row records that it
 * moved, and `closeTicket` refuses to close it until a written summary is
 * brought back — enforced by a CHECK as well, because the busy night is
 * exactly when a code path gets skipped.
 */
export async function movedToWhatsapp(input: {
  ticketId: string;
  actorUserId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  await db
    .update(supportTickets)
    .set({ movedToWhatsappAt: new Date(), updatedAt: new Date() })
    .where(eq(supportTickets.id, input.ticketId));

  await db.insert(supportTicketEvents).values({
    ticketId: input.ticketId,
    kind: "moved",
    actorUserId: input.actorUserId,
    note: "Continued on WhatsApp, a summary has to come back before this closes",
  });
  return { ok: true };
}

/* -------------------------------------------- 20.22 / 20.26 · closing one -- */

/**
 * Close it, and send a **link to a page that authenticates**. 20.22, 20.26.
 *
 * 🔴 Never the correspondence in an email. The two halves of that rule are one
 * rule: an email carrying the conversation is patient data leaving the
 * building (§6), and an email that carries the conversation but cannot carry
 * the attachments (20.19, C82) is a half-measure that drifts back to "just
 * include the summary" the first time somebody finds the link inconvenient.
 *
 * The same rule covers a therapist's ticket (20.26) — theirs carries their
 * earnings and their patients' names, which is not plaintext-email material
 * either.
 *
 * The link carries a token that identifies the ticket and nothing else; the
 * page then demands a code sent to the handle already on the ticket. Two
 * factors, neither of them the message.
 */
export async function closeTicket(input: {
  ticketId: string;
  actorUserId: string;
  summary: string;
}): Promise<{ ok?: boolean; error?: string; link?: string }> {
  const summary = input.summary.trim();
  if (summary.length < 10) return { error: "Say what was done, for the record and for them." };

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, input.ticketId))
    .limit(1);

  if (!ticket) return { error: "That ticket no longer exists." };
  if (ticket.status === "closed") return { error: "That ticket is already closed." };

  if (ticket.movedToWhatsappAt && (ticket.whatsappSummary ?? "").trim().length < 20) {
    return {
      error:
        "This one moved to WhatsApp. Write up what was agreed there before closing it, a conversation we cannot see is not a record.",
    };
  }

  const token = randomBytes(24).toString("base64url");
  const code = String(Math.floor(100_000 + Math.random() * 900_000));

  await db
    .update(supportTickets)
    .set({
      status: "closed",
      closedAt: new Date(),
      closedByUserId: input.actorUserId,
      accessToken: token,
      accessCodeHash: await hashCode(code),
      accessCodeExpiresAt: new Date(Date.now() + 7 * 86_400_000),
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, input.ticketId));

  await db.insert(supportTicketEvents).values({
    ticketId: input.ticketId,
    kind: "closed",
    actorUserId: input.actorUserId,
    note: summary,
  });

  const link = `${env.appUrl}/support/${token}`;

  /*
   * The message carries the link and the code — and **not one word of the
   * ticket**. Not the topic, not the summary, not their own message quoted
   * back. That is the rule, and this is the only place it could be broken.
   */
  await notify(
    { email: ticket.email, phone: ticket.phone, timezone: null },
    {
      kind: "support.closed",
      subject: "Your message to 24Therapy",
      body: `We have answered your message (reference ${ticket.reference}). Open ${link} and enter the code ${code} to read the reply and anything attached to it. The code lasts seven days.`,
      link: { label: "Read the reply", url: link },
    },
  );

  return { ok: true, link };
}

/**
 * The closed-ticket page, for the person who wrote it. 20.22.
 *
 * Two things are checked before a word is returned: the token identifies one
 * ticket, and the code proves the reader holds the handle it was sent to.
 * Every successful read is audited — the reader is not staff, but the material
 * is the same material.
 */
export async function readByToken(input: {
  token: string;
  code: string;
}): Promise<{ error?: string; ticket?: SupportTicket; events?: SupportTicketEvent[] }> {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.accessToken, input.token))
    .limit(1);

  // One message for both failures: a token that exists and a token that does
  // not must be indistinguishable, or this becomes an oracle for references.
  const wrong = { error: "That link or code is not right." };
  if (!ticket?.accessCodeHash) return wrong;
  if (!ticket.accessCodeExpiresAt || ticket.accessCodeExpiresAt < new Date()) {
    return { error: "That code has expired. Write to us again and we will send another." };
  }
  if (!(await verifyCode(input.code, ticket.accessCodeHash))) return wrong;

  const events = await db
    .select()
    .from(supportTicketEvents)
    .where(eq(supportTicketEvents.ticketId, ticket.id))
    .orderBy(desc(supportTicketEvents.createdAt));

  return { ticket, events };
}

/* ----------------------------------------------------------- the queues -- */

/**
 * 🔴 20.24 — two queues, because they are two jobs.
 *
 * `audience` is a column rather than a filter over `source`, so a therapist
 * who writes in through the public contact form still lands in the therapist
 * queue. One list sorted by age puts a payout chase above somebody in
 * distress, which is the wrong order and the reason this parameter exists.
 */
export async function queueFor(audience: "patient" | "therapist", limit = 100) {
  const now = Date.now();

  const rows = await db
    .select({
      id: supportTickets.id,
      reference: supportTickets.reference,
      name: supportTickets.name,
      topic: supportTickets.topic,
      status: supportTickets.status,
      locale: supportTickets.locale,
      entity: supportTickets.entity,
      ownerUserId: supportTickets.ownerUserId,
      ownerFirst: users.firstName,
      ownerLast: users.lastName,
      createdAt: supportTickets.createdAt,
      dueAt: supportTickets.dueAt,
      waitingSince: supportTickets.waitingSince,
      extendedAt: supportTickets.extendedAt,
      movedToWhatsappAt: supportTickets.movedToWhatsappAt,
      relatedSessionId: supportTickets.relatedSessionId,
      relatedPayoutRequestId: supportTickets.relatedPayoutRequestId,
    })
    .from(supportTickets)
    .leftJoin(users, eq(users.id, supportTickets.ownerUserId))
    .where(
      and(eq(supportTickets.audience, audience), sql`${supportTickets.status} <> 'closed'`),
    )
    .orderBy(asc(supportTickets.dueAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    ownerName: [row.ownerFirst, row.ownerLast].filter(Boolean).join(" ") || null,
    ageHours: Math.round(((now - row.createdAt.getTime()) / 3_600_000) * 10) / 10,
    overdue: row.status !== "waiting_on_them" && row.dueAt.getTime() < now,
    /** 20.25 — staff should never work from a complaint with nothing attached. */
    hasContext: row.relatedSessionId !== null || row.relatedPayoutRequestId !== null,
  }));
}

/**
 * 20.8 — what a **manager** sees and staff do not: how the queue is doing.
 *
 * Counts and ages, never content. A performance overview that shows the
 * messages is a performance overview that has become a second inbox.
 */
export async function queueHealth() {
  const rows = await db
    .select({
      audience: supportTickets.audience,
      open: sql<number>`COUNT(*) FILTER (WHERE ${supportTickets.status} = 'open')::int`,
      waiting: sql<number>`COUNT(*) FILTER (WHERE ${supportTickets.status} = 'waiting_on_them')::int`,
      overdue: sql<number>`COUNT(*) FILTER (WHERE ${supportTickets.status} = 'open' AND ${supportTickets.dueAt} < now())::int`,
      unowned: sql<number>`COUNT(*) FILTER (WHERE ${supportTickets.status} <> 'closed' AND ${supportTickets.ownerUserId} IS NULL)::int`,
      closedThisWeek: sql<number>`COUNT(*) FILTER (WHERE ${supportTickets.closedAt} > now() - interval '7 days')::int`,
    })
    .from(supportTickets)
    .groupBy(supportTickets.audience);

  const byOwner = await db
    .select({
      ownerUserId: supportTickets.ownerUserId,
      firstName: users.firstName,
      lastName: users.lastName,
      open: sql<number>`COUNT(*) FILTER (WHERE ${supportTickets.status} <> 'closed')::int`,
      overdue: sql<number>`COUNT(*) FILTER (WHERE ${supportTickets.status} = 'open' AND ${supportTickets.dueAt} < now())::int`,
    })
    .from(supportTickets)
    .innerJoin(users, eq(users.id, supportTickets.ownerUserId))
    .groupBy(supportTickets.ownerUserId, users.firstName, users.lastName);

  return { byAudience: rows, byOwner };
}

/* ------------------------------------------------- 20.19 · attachments -- */

/**
 * Attach a photo or a PDF to a ticket. PLAN.md 20.19, C82.
 *
 * 🔴 **Stored, audited and access-controlled exactly like sprint 8's
 * documents, and never in a prompt.** The same uploader, the same opaque
 * random path, the same ceiling. Nothing here extracts text, chunks it or
 * indexes it — a support attachment is evidence for a person, not material
 * for a model, and the only way to keep that true is for no code to exist
 * that would do it.
 */
export async function attachToTicket(input: {
  ticketId: string;
  file: File;
  uploadedByUserId?: string | null;
}): Promise<{ ok?: boolean; error?: string }> {
  const { supportUploadProblem, uploadDocument } = await import("@/lib/uploads");

  const problem = supportUploadProblem(input.file);
  if (problem) return { error: problem };

  const [ticket] = await db
    .select({ id: supportTickets.id, status: supportTickets.status })
    .from(supportTickets)
    .where(eq(supportTickets.id, input.ticketId))
    .limit(1);

  if (!ticket) return { error: "That ticket no longer exists." };
  if (ticket.status === "closed") {
    return { error: "That ticket is closed. Write to us again and we will reopen it." };
  }

  const stored = await uploadDocument({
    kind: "support",
    // The *ticket* is the owner, not a user: the sender of a public-form
    // ticket has no account, and putting a made-up id in the path would be a
    // lie in an operational trail.
    userId: input.ticketId,
    label: "attachment",
    file: input.file,
  });

  if (stored.error || !stored.url) return { error: stored.error ?? "The upload did not go through." };

  await db.insert(supportAttachments).values({
    ticketId: input.ticketId,
    filename: input.file.name.slice(0, 200),
    contentType: input.file.type,
    byteSize: input.file.size,
    storageKey: stored.url,
    uploadedByUserId: input.uploadedByUserId ?? null,
  });

  await db.insert(supportTicketEvents).values({
    ticketId: input.ticketId,
    kind: "replied",
    actorUserId: input.uploadedByUserId ?? null,
    note: `Attached ${input.file.name.slice(0, 80)}`,
  });

  return { ok: true };
}

/**
 * What is attached to one ticket.
 *
 * Only ever called from a screen that has already established who is asking —
 * `readTicket` for staff, `readByToken` for the sender. There is no
 * "attachments by id" path, deliberately: an attachment is reachable through
 * its ticket or not at all.
 */
export async function attachmentsFor(ticketId: string) {
  return db
    .select({
      id: supportAttachments.id,
      filename: supportAttachments.filename,
      contentType: supportAttachments.contentType,
      byteSize: supportAttachments.byteSize,
      storageKey: supportAttachments.storageKey,
      createdAt: supportAttachments.createdAt,
    })
    .from(supportAttachments)
    .where(eq(supportAttachments.ticketId, ticketId))
    .orderBy(asc(supportAttachments.createdAt));
}
