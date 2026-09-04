import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { auditPhi } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  copilotMessages,
  copilotThreads,
  patients,
  sessions,
  NOTE_LANGUAGES,
  type Citation,
} from "@/lib/db/schema";


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
 * ## What this used to be, and why it was wrong
 *
 * A flat allowance per patient per **calendar month**, reset on the 1st. §3 asks
 * for something different in kind, not merely a different number: **ten messages
 * per session, per patient, rolling over on that patient**, expiring after
 * `pricing.creditExpiryMonths`. Moving the figure into `platform_settings`
 * would not have converted one into the other, so the counting changed too.
 *
 * The difference is the therapist's, not ours. Under the old rule somebody who
 * saw a patient weekly and somebody who saw them once got the same ten
 * questions, and both lost whatever they had not spent at midnight on the 31st.
 * Under this one the allowance is earned by the work: each completed session
 * with that patient earns ten questions about that patient, and they keep until
 * they lapse.
 *
 * ## The window
 *
 * Earned and used are counted over the *same* twelve months. Counting a
 * lifetime of questions against a year of sessions would let an old thread
 * start out already over its limit.
 *
 * Only therapist messages count. The copilot's own answers and the notes saved
 * automatically from a live session are not questions the therapist chose to
 * ask.
 */
export async function checkQuota(
  actor: Actor,
  threadId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const settings = await getSettings();
  const perSession = settings.copilot.messagesPerPatientPerSession;

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - settings.pricing.creditExpiryMonths);

  // Which patient this thread is about. The thread is already scoped to the
  // actor by `getOrCreateThread`; this read is by id because the caller has
  // just been through that check.
  const [thread] = await db
    .select({ patientId: copilotThreads.patientId })
    .from(copilotThreads)
    .where(and(eq(copilotThreads.id, threadId), scope(actor)))
    .limit(1);

  if (!thread) return { allowed: false, used: 0, limit: 0 };

  const [earnedRow] = await db
    .select({ sessions: sql<number>`COUNT(*)::int` })
    .from(sessions)
    .where(
      and(
        eq(sessions.patientId, thread.patientId),
        eq(sessions.organizationId, actor.organizationId),
        eq(sessions.status, "completed"),
        gte(sessions.createdAt, since),
      ),
    );

  const [usedRow] = await db
    .select({ used: sql<number>`COUNT(*)::int` })
    .from(copilotMessages)
    .where(
      and(
        eq(copilotMessages.threadId, threadId),
        eq(copilotMessages.role, "therapist"),
        gte(copilotMessages.createdAt, since),
      ),
    );

  /*
   * A patient with no completed session yet.
   *
   * §3 gives an undocumented patient nothing and a documented unclaimed one
   * five credits, unlocked by adding a diagnosis and a history. That
   * distinction needs the `people` table and the claimed/unclaimed state from
   * sprint 5, which does not exist yet — so until it does, the floor is the
   * `unclaimedPatientCredits` setting for every patient, which is the more
   * generous of the two readings and cannot lock a therapist out of a patient
   * they have only just added.
   */
  const earned = Math.max(
    settings.copilot.unclaimedPatientCredits,
    (earnedRow?.sessions ?? 0) * perSession,
  );
  const used = usedRow?.used ?? 0;

  return { allowed: used < earned, used, limit: earned };
}

/**
 * What language this thread's answers come back in.
 *
 * A setting rather than a correction. Telling the copilot "answer in Arabic"
 * through the corrections box is teaching it a fact about a patient it does not
 * have, and it was measured as unreliable besides — see the prompt assembly in
 * `lib/ai/patient-copilot.ts`.
 */
export async function setReplyLanguage(
  actor: Actor,
  threadId: string,
  language: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (language !== "auto" && !(language in NOTE_LANGUAGES)) {
    return { error: "That is not a language the copilot can write in." };
  }

  const updated = await db
    .update(copilotThreads)
    .set({ replyLanguage: language })
    .where(and(scope(actor), eq(copilotThreads.id, threadId)))
    .returning({ id: copilotThreads.id });

  return updated.length > 0 ? { ok: true } : { error: "Thread not found." };
}

/**
 * Drop one standing correction.
 *
 * Corrections accumulate, which is right — but nothing could remove one, so a
 * line that had gone stale ("all answers in arabic", written before the
 * language setting existed) stayed in the prompt forever and could contradict a
 * newer instruction. Asking the model to arbitrate between two of the
 * therapist's own instructions is a worse answer than letting them delete the
 * one they no longer mean.
 *
 * Matched on the line's own text rather than an index: the list is re-rendered
 * from a text column, and an index from a stale page would delete the wrong
 * line.
 */
export async function removeGuidanceLine(
  actor: Actor,
  threadId: string,
  line: string,
): Promise<{ ok?: boolean; error?: string }> {
  const [thread] = await db
    .select()
    .from(copilotThreads)
    .where(and(scope(actor), eq(copilotThreads.id, threadId)))
    .limit(1);
  if (!thread?.guidance) return { error: "Nothing to remove." };

  const target = line.trim();
  const kept = thread.guidance
    .split("\n")
    .filter((row) => row.replace(/^-\s*/, "").trim() !== target);

  await db
    .update(copilotThreads)
    .set({ guidance: kept.join("\n").trim() || null })
    .where(eq(copilotThreads.id, threadId));

  return { ok: true };
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
  //
  // `replyLanguage` deliberately survives. It is a setting about how this
  // clinician works with this patient, not a thing said in a conversation, and
  // clearing the chat should not silently put their answers back into English.
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
