import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { auditPhi } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { PAYG_COPILOT_MESSAGES } from "@/lib/billing/plans";
import { getSubscription } from "@/lib/billing/service";
import { db } from "@/lib/db";
import {
  copilotMessages,
  copilotThreads,
  patients,
  sessions,
  type Citation,
} from "@/lib/db/schema";

/**
 * PAYG gets a taste of the copilot; Unlimited gets all of it.
 *
 * The number itself lives in the plan matrix, because it is advertised on the
 * pricing page as part of what $6 buys. Two constants would mean the page and
 * the enforcement could disagree, and the one that loses that argument is the
 * customer.
 */
export const PAYG_MESSAGES_PER_PATIENT_PER_MONTH = PAYG_COPILOT_MESSAGES;

function scope(actor: Actor) {
  return actor.role === "super_admin"
    ? eq(copilotThreads.organizationId, actor.organizationId)
    : and(
        eq(copilotThreads.organizationId, actor.organizationId),
        eq(copilotThreads.therapistId, actor.userId),
      );
}

/**
 * Find or create the thread for a patient.
 *
 * Ownership of the *patient* is checked first — the thread is reached through
 * the patient, never by id from a URL, so there is no way to open a thread
 * belonging to someone else's caseload.
 */
export async function getOrCreateThread(actor: Actor, patientId: string) {
  const [patient] = await db
    .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName })
    .from(patients)
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.organizationId, actor.organizationId),
        actor.role === "super_admin" ? undefined : eq(patients.therapistId, actor.userId),
      ),
    )
    .limit(1);

  if (!patient) return null;

  const [existing] = await db
    .select()
    .from(copilotThreads)
    .where(eq(copilotThreads.patientId, patientId))
    .limit(1);

  if (existing) return { thread: existing, patient };

  const [created] = await db
    .insert(copilotThreads)
    .values({
      patientId,
      organizationId: actor.organizationId,
      therapistId: actor.userId,
    })
    .onConflictDoNothing({ target: copilotThreads.patientId })
    .returning();

  if (created) return { thread: created, patient };

  const [raced] = await db
    .select()
    .from(copilotThreads)
    .where(eq(copilotThreads.patientId, patientId))
    .limit(1);
  return raced ? { thread: raced, patient } : null;
}

/** The inbox: one row per patient, most recently active first. */
export async function listThreads(actor: Actor) {
  return db
    .select({
      threadId: copilotThreads.id,
      patientId: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      lastMessageAt: copilotThreads.lastMessageAt,
      messageCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${copilotMessages}
        WHERE ${copilotMessages.threadId} = ${copilotThreads.id}
      )`,
      lastMessage: sql<string | null>`(
        SELECT m.content FROM ${copilotMessages} m
        WHERE m.thread_id = ${copilotThreads.id}
        ORDER BY m.created_at DESC LIMIT 1
      )`,
      sessionCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${sessions}
        WHERE ${sessions.patientId} = ${patients.id} AND ${sessions.status} = 'completed'
      )`,
    })
    .from(copilotThreads)
    .innerJoin(patients, eq(patients.id, copilotThreads.patientId))
    .where(scope(actor))
    .orderBy(desc(copilotThreads.lastMessageAt), desc(copilotThreads.createdAt))
    .limit(200);
}

export async function getMessages(actor: Actor, threadId: string) {
  const [owned] = await db
    .select({ id: copilotThreads.id })
    .from(copilotThreads)
    .where(and(scope(actor), eq(copilotThreads.id, threadId)))
    .limit(1);
  if (!owned) return [];

  return db
    .select()
    .from(copilotMessages)
    .where(eq(copilotMessages.threadId, threadId))
    .orderBy(desc(copilotMessages.createdAt))
    .limit(100)
    .then((rows) => rows.reverse());
}

export async function appendMessage(input: {
  threadId: string;
  role: "therapist" | "copilot" | "session_note" | "correction";
  content: string;
  citations?: Citation[];
  sessionId?: string | null;
}) {
  const [message] = await db
    .insert(copilotMessages)
    .values({
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      citations: input.citations ?? [],
      sessionId: input.sessionId ?? null,
    })
    .returning();

  await db
    .update(copilotThreads)
    .set({ lastMessageAt: new Date() })
    .where(eq(copilotThreads.id, input.threadId));

  return message!;
}

/**
 * Quota.
 *
 * Counted per patient per calendar month, and only therapist questions count —
 * the copilot's own answers and the notes saved automatically from a live
 * session are not billable actions the therapist chose to take.
 */
export async function checkQuota(
  actor: Actor,
  threadId: string,
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const subscription = await getSubscription(actor.organizationId);
  if (subscription.plan === "unlimited") return { allowed: true, used: 0, limit: null };

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [row] = await db
    .select({ used: sql<number>`COUNT(*)::int` })
    .from(copilotMessages)
    .where(
      and(
        eq(copilotMessages.threadId, threadId),
        eq(copilotMessages.role, "therapist"),
        gte(copilotMessages.createdAt, startOfMonth),
      ),
    );

  const used = row?.used ?? 0;
  return {
    allowed: used < PAYG_MESSAGES_PER_PATIENT_PER_MONTH,
    used,
    limit: PAYG_MESSAGES_PER_PATIENT_PER_MONTH,
  };
}

export async function addGuidance(actor: Actor, threadId: string, correction: string) {
  const [thread] = await db
    .select()
    .from(copilotThreads)
    .where(and(scope(actor), eq(copilotThreads.id, threadId)))
    .limit(1);
  if (!thread) return null;

  // Appended rather than replaced: corrections accumulate into a standing
  // understanding of this patient rather than overwriting each other.
  const next = [thread.guidance, `- ${correction.trim()}`].filter(Boolean).join("\n").slice(0, 4000);

  await db
    .update(copilotThreads)
    .set({ guidance: next })
    .where(eq(copilotThreads.id, threadId));

  await appendMessage({ threadId, role: "correction", content: correction.trim() });
  return next;
}

/**
 * Save an in-session suggestion into the patient's thread.
 *
 * This is what makes the copilot panel during a session and the chat afterwards
 * the same conversation rather than two disconnected features.
 */
export async function recordSessionSuggestions(input: {
  organizationId: string;
  therapistId: string;
  patientId: string | null;
  sessionId: string;
  suggestions: { kind: string; text: string }[];
}): Promise<void> {
  if (!input.patientId || input.suggestions.length === 0) return;

  const threadId = await threadIdFor(input);
  if (!threadId) return;

  const content = input.suggestions.map((s) => `${s.kind}: ${s.text}`).join("\n");
  await appendMessage({
    threadId,
    role: "session_note",
    content,
    sessionId: input.sessionId,
  });
}

/**
 * Put the finished note into the patient's thread.
 *
 * Called at the end of note generation, which is what guarantees every
 * documented session opens a copilot conversation — including a Crisis Radar
 * booking, where nobody ever pressed "add patient". Without this the inbox
 * inner-joins threads and a patient seen once, from the radar, would simply not
 * be there.
 */
export async function recordSessionNote(input: {
  organizationId: string;
  therapistId: string;
  patientId: string | null;
  sessionId: string;
  summary: string;
}): Promise<void> {
  if (!input.patientId) return;

  const threadId = await threadIdFor(input);
  if (!threadId) return;

  const summary = input.summary.trim();
  await appendMessage({
    threadId,
    role: "session_note",
    content: summary || "Session completed. The note is on the session page.",
    sessionId: input.sessionId,
  });
}

async function threadIdFor(input: {
  organizationId: string;
  therapistId: string;
  patientId: string | null;
}): Promise<string | undefined> {
  if (!input.patientId) return undefined;

  const [thread] = await db
    .select({ id: copilotThreads.id })
    .from(copilotThreads)
    .where(eq(copilotThreads.patientId, input.patientId))
    .limit(1);
  if (thread) return thread.id;

  const [created] = await db
    .insert(copilotThreads)
    .values({
      patientId: input.patientId,
      organizationId: input.organizationId,
      therapistId: input.therapistId,
    })
    .onConflictDoNothing({ target: copilotThreads.patientId })
    .returning({ id: copilotThreads.id });
  if (created) return created.id;

  // Lost the insert race — read the row the winner created.
  const [existing] = await db
    .select({ id: copilotThreads.id })
    .from(copilotThreads)
    .where(eq(copilotThreads.patientId, input.patientId))
    .limit(1);
  return existing?.id;
}

export async function auditThreadRead(actor: Actor, patientId: string, threadId: string) {
  await auditPhi(actor, "copilot.read", {
    resourceType: "copilot_thread",
    resourceId: threadId,
    patientId,
  });
}

/**
 * Reset a copilot conversation, keeping what the copilot observed.
 *
 * The distinction is the whole feature. Two kinds of message live in a thread:
 *
 *  - What the *therapist* and the copilot said to each other — questions,
 *    answers, corrections. This is a conversation. It goes stale, it fills up
 *    with a line of enquiry that turned out to be wrong, and a clinician should
 *    be able to wipe it and start again.
 *
 *  - What the copilot noticed *during a session* (`session_note`). This is
 *    contemporaneous clinical observation, written as the session happened. It
 *    is part of the record and is not the clinician's to delete, any more than
 *    the transcript is.
 *
 * So a reset removes the first and keeps the second, and the copilot rebuilds
 * its picture from the transcripts and its own session notes — which is exactly
 * the memory that should survive.
 */
export async function resetCopilotConversation(
  actor: Actor,
  patientId: string,
): Promise<{ removed: number; kept: number } | null> {
  const found = await getOrCreateThread(actor, patientId);
  if (!found) return null;

  const removed = await db
    .delete(copilotMessages)
    .where(
      and(
        eq(copilotMessages.threadId, found.thread.id),
        inArray(copilotMessages.role, ["therapist", "copilot", "correction"]),
      ),
    )
    .returning({ id: copilotMessages.id });

  const kept = await db
    .select({ id: copilotMessages.id })
    .from(copilotMessages)
    .where(
      and(
        eq(copilotMessages.threadId, found.thread.id),
        eq(copilotMessages.role, "session_note"),
      ),
    );

  // Standing corrections go with the conversation they came from. Keeping them
  // would mean the "fresh start" still carries the instruction that made the
  // clinician want a fresh start.
  await db
    .update(copilotThreads)
    .set({ guidance: null, lastMessageAt: new Date() })
    .where(eq(copilotThreads.id, found.thread.id));

  await auditPhi(actor, "copilot.reset", {
    resourceType: "copilot_thread",
    resourceId: found.thread.id,
    patientId,
  });

  return { removed: removed.length, kept: kept.length };
}
