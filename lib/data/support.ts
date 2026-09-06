import "server-only";

import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  supportTicketEvents,
  supportTickets,
  TICKET_TOPICS,
  type Entity,
  type TicketTopic,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
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
  patientAccountId?: string | null;
  userId?: string | null;
};

export type TicketResult =
  | { ok: true; reference: string; dueAt: Date }
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
      error: "You have sent us a few messages already. We have them — give us a little time to reply.",
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
      patientAccountId: input.patientAccountId ?? null,
      userId: input.userId ?? null,
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

  return { ok: true, reference, dueAt };
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
