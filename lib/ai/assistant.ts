import "server-only";

import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  assistantMessages,
  assistantThreads,
  patients,
  sessionNotes,
  users,
} from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

import { MODELS, logUsage, openai } from "./client";

/**
 * The general copilot. PLAN.md 10.1–10.6.
 *
 * 🔴 **Read the import list above. That is the feature.**
 *
 * 10.2: *roster only — no clinical content in context. The guarantee comes
 * from what is absent, not from what the prompt says.* So this module reads
 * `patients` for names and dates and `session_notes` for a **count**, and
 * imports nothing else clinical at all — no `transcriptSegments`, no
 * `personDocuments`, no `copilotMessages`. Nothing it selects can carry a
 * sentence anybody said: the one column it touches on a clinical table is
 * `status`, inside a `COUNT(*)`. So no prompt bug, no jailbreak and no future
 * edit to the system message can put a transcript in the context.
 *
 * The test for anything a future edit wants to add here: is it already on a
 * screen the clinician can open with no consent check? If not, it does not
 * belong in a context that answers general questions.
 *
 * A prompt that *said* "do not mention clinical details" would be worth
 * nothing: the model would have the details and be asked not to use them,
 * which is the arrangement that fails under pressure. This one cannot fail
 * that way because there is nothing to withhold.
 */

const SYSTEM = `You are the assistant on a therapist's home screen. You help them run their practice.

WHAT YOU HAVE:
Their roster — patient names, when they last saw each person, and how many notes are waiting to be signed. That is all. There is no appointment schedule in this product yet; if they ask what is coming up, say so rather than guessing.

WHAT YOU DO NOT HAVE, AND MUST NEVER PRETEND TO:
Any clinical content whatsoever. No transcripts, no session notes, no diagnoses, no documents, no risk information, nothing anybody said in a session. If asked about what a patient talked about, how they are doing, what their diagnosis is, or anything that would require reading their record, say plainly that you cannot see clinical material here and point them at that patient's own copilot, which can.

You are not being coy. You genuinely do not have it, and saying "I am not allowed to tell you" would be a lie that sounds like you know.

HOW TO WRITE:
- Short. A therapist between sessions, not an essay.
- Use patient names exactly as they appear in the roster below. Do not abbreviate them, do not translate them, do not guess at a spelling. Never mention a name that is not in the roster.
- Practical: who is next, what is outstanding, what to do first.
- You do not give clinical advice about a specific patient, because you cannot see their record.

Answer in plain text, in the same language as the question.`;

/* ------------------------------------------------------------- the roster -- */

export type RosterRow = {
  patientId: string;
  name: string;
  lastSessionAt: Date | null;
  nextSessionAt: Date | null;
  draftNotes: number;
};

/**
 * The clinician's own caseload — names, dates and one count. Nothing else.
 *
 * Scoped like every other patient read: their organisation, and their own
 * caseload unless they are a super admin.
 */
export async function buildRoster(actor: {
  userId: string;
  organizationId: string;
  role: string;
}): Promise<RosterRow[]> {
  const rows = await db
    .select({
      patientId: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      lastSessionAt: patients.lastSessionAt,
      /*
       * Notes waiting to be signed — `session_notes.status = 'draft'`, which is
       * the state a clinician actually has to clear. A count, not a note: it
       * cannot carry a sentence anybody said.
       *
       * `${patients}."id"`, not `${patients.id}`: Drizzle only prefixes a
       * column with its table when a join forces it, and a bare `id` inside a
       * correlated subquery binds to the inner table. That exact mistake made
       * every clinician's caseload show zero sessions — see `listPatients`.
       */
      draftNotes: sql<number>`(
        SELECT COUNT(*)::int FROM ${sessionNotes} n
         WHERE n.patient_id = ${patients}."id"
           AND n.status = 'draft'
      )`,
    })
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, actor.organizationId),
        actor.role === "super_admin" ? undefined : eq(patients.therapistId, actor.userId),
        isNull(patients.deletedAt),
      ),
    )
    .orderBy(desc(patients.lastSessionAt))
    .limit(200);

  return rows.map((row) => ({
    patientId: row.patientId,
    name: [row.firstName, row.lastName].filter(Boolean).join(" ").trim(),
    lastSessionAt: row.lastSessionAt,
    /*
     * C57 — "next appointment" cannot be answered yet. There is no
     * `scheduled_for` column: `sessions` records what happened, not what is
     * planned, and scheduling is sprint 11. Null rather than a guess, and the
     * roster block below simply omits the phrase — a copilot that says
     * "nothing booked" for a practice with no booking system is stating a fact
     * about our schema as though it were a fact about their week.
     */
    nextSessionAt: null,
    draftNotes: row.draftNotes,
  }));
}

function rosterBlock(roster: RosterRow[]): string {
  if (roster.length === 0) return "The roster is empty. They have no patients yet.";

  const lines = roster.map((row) => {
    const bits = [
      row.lastSessionAt
        ? `last seen ${row.lastSessionAt.toISOString().slice(0, 10)}`
        : "never seen",
      row.nextSessionAt ? `next ${row.nextSessionAt.toISOString().slice(0, 10)}` : null,
      row.draftNotes > 0 ? `${row.draftNotes} note(s) to sign` : null,
    ].filter(Boolean);
    return `- ${row.name} — ${bits.join(", ")}`;
  });

  return `THE ROSTER (${roster.length} patients). Names and dates only:\n${lines.join("\n")}`;
}

/* ---------------------------------------------------------------- asking -- */

export type AssistantAnswer = {
  answer: string;
  mentions: { patientId: string; name: string }[];
};

/**
 * Ask the general assistant.
 *
 * The mentions are resolved **after** the model answers, by scanning its prose
 * for roster names (`lib/assistant/roster.ts`). The model is never asked for a
 * link or an id, so it has no way to produce one that points at somebody who
 * is not on this clinician's roster.
 */
export async function askAssistant(opts: {
  threadId: string;
  userId: string;
  organizationId: string;
  role: string;
  question: string;
  history: { role: "therapist" | "assistant"; content: string }[];
}): Promise<AssistantAnswer> {
  const started = Date.now();
  const roster = await buildRoster({
    userId: opts.userId,
    organizationId: opts.organizationId,
    role: opts.role,
  });

  const historyText = opts.history
    .slice(-8)
    .map((m) => `${m.role === "therapist" ? "Therapist" : "You"}: ${m.content}`)
    .join("\n");

  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.note,
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            rosterBlock(roster),
            historyText ? `Earlier in this conversation:\n${historyText}` : "",
            `They ask: ${opts.question}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: null,
      kind: "copilot",
      model: MODELS.note,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
      status: "success",
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() ||
      "I could not put an answer together just now.";

    const { mentionsIn } = await import("@/lib/assistant/roster");
    return { answer, mentions: mentionsIn(answer, roster) };
  } catch (error) {
    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: null,
      kind: "copilot",
      model: MODELS.note,
      durationMs: Date.now() - started,
      status: "error",
      errorCode: error instanceof Error ? error.name : "unknown",
    });
    log.error("assistant failed", { thread: ref(opts.threadId), reason: safeErrorMessage(error) });
    throw error;
  }
}

/* --------------------------------------------------------- 10.5 the quota -- */

export type Allowance = { allowed: boolean; used: number; limit: number };

/**
 * 50 a month, across every thread. 10.5.
 *
 * The number comes from settings (sprint 1's rule: nothing after sprint 1
 * hardcodes a limit), and the window is the **calendar month** rather than a
 * rolling thirty days — a clinician who has run out should be able to answer
 * "when does this reset?" without arithmetic.
 *
 * Only `therapist` rows count. An assistant reply is not a message the
 * clinician spent, and counting both would silently halve the allowance.
 */
export async function assistantAllowance(userId: string): Promise<Allowance> {
  const settings = await getSettings();
  const limit = settings.copilot.generalMessagesPerMonth;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [row] = await db
    .select({ used: sql<number>`COUNT(*)::int` })
    .from(assistantMessages)
    .where(
      and(
        eq(assistantMessages.userId, userId),
        eq(assistantMessages.role, "therapist"),
        gte(assistantMessages.createdAt, monthStart),
      ),
    );

  const used = row?.used ?? 0;
  return { allowed: used < limit, used, limit };
}

/* -------------------------------------------------------------- 10.4 CRUD -- */

export async function listThreads(userId: string) {
  return db
    .select({
      id: assistantThreads.id,
      title: assistantThreads.title,
      updatedAt: assistantThreads.updatedAt,
    })
    .from(assistantThreads)
    .where(and(eq(assistantThreads.userId, userId), isNull(assistantThreads.deletedAt)))
    .orderBy(desc(assistantThreads.updatedAt))
    .limit(50);
}

export async function createThread(actor: {
  userId: string;
  organizationId: string;
}): Promise<string | null> {
  const [thread] = await db
    .insert(assistantThreads)
    .values({ userId: actor.userId, organizationId: actor.organizationId })
    .returning({ id: assistantThreads.id });
  return thread?.id ?? null;
}

/** Scoped by user on every read — a thread id from a URL opens nothing else. */
export async function threadFor(userId: string, threadId: string) {
  const [thread] = await db
    .select()
    .from(assistantThreads)
    .where(
      and(
        eq(assistantThreads.id, threadId),
        eq(assistantThreads.userId, userId),
        isNull(assistantThreads.deletedAt),
      ),
    )
    .limit(1);
  return thread ?? null;
}

export async function messagesIn(userId: string, threadId: string) {
  const thread = await threadFor(userId, threadId);
  if (!thread) return [];

  return db
    .select({
      id: assistantMessages.id,
      role: assistantMessages.role,
      content: assistantMessages.content,
      mentions: assistantMessages.mentions,
      createdAt: assistantMessages.createdAt,
    })
    .from(assistantMessages)
    .where(eq(assistantMessages.threadId, threadId))
    .orderBy(asc(assistantMessages.createdAt))
    .limit(200);
}

export async function appendMessage(input: {
  threadId: string;
  userId: string;
  role: "therapist" | "assistant";
  content: string;
  mentions?: { patientId: string; name: string }[];
}): Promise<void> {
  await db.insert(assistantMessages).values({
    threadId: input.threadId,
    userId: input.userId,
    role: input.role,
    content: input.content,
    mentions: input.mentions ?? [],
  });

  await db
    .update(assistantThreads)
    .set({ updatedAt: new Date() })
    .where(eq(assistantThreads.id, input.threadId));
}

/**
 * Name a thread from its first question, once.
 *
 * Conditional on the title still being the default, so a thread does not
 * rename itself every time somebody types. Trimmed to something that fits in a
 * list rather than summarised by a model — a second model call to title a chat
 * is a cost with no reader.
 */
export async function titleFromFirstQuestion(threadId: string, question: string): Promise<void> {
  const title = question.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!title) return;

  await db
    .update(assistantThreads)
    .set({ title })
    .where(and(eq(assistantThreads.id, threadId), eq(assistantThreads.title, "New chat")));
}

/** 10.4 — soft delete. See the schema comment for why it is not a row removal. */
export async function deleteThread(userId: string, threadId: string): Promise<boolean> {
  const deleted = await db
    .update(assistantThreads)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(assistantThreads.id, threadId),
        eq(assistantThreads.userId, userId),
        isNull(assistantThreads.deletedAt),
      ),
    )
    .returning({ id: assistantThreads.id });

  return deleted.length > 0;
}

/* ---------------------------------------------------- 10.6 the preferences -- */

export type AssistantPrefs = {
  language: string;
  voice: "british_female" | "american_male" | "american_female" | "british_male";
  voiceSpeed: number;
  /** Null until they have been asked. Drives the first-use prompt. */
  setAt: Date | null;
};

/**
 * 10.6 — language, voice and playback speed, asked once and editable later.
 *
 * Stored on the existing `users.profile` jsonb rather than in a new table.
 * These are three scalars on the person who owns them, and a table with one
 * row per user and three columns is a join for no reason.
 */
export async function assistantPrefs(userId: string): Promise<AssistantPrefs> {
  const [row] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const profile = row?.profile ?? {};
  return {
    language: profile.assistantLanguage ?? "auto",
    voice: profile.voice ?? "british_female",
    // Clamped on read as well as on write: a value that got into the column
    // some other way must not reach the speech API as a 400.
    voiceSpeed: Math.min(2, Math.max(0.5, profile.voiceSpeed ?? 1)),
    setAt: profile.assistantPrefsSetAt ? new Date(profile.assistantPrefsSetAt) : null,
  };
}

export async function saveAssistantPrefs(
  userId: string,
  prefs: { language: string; voice: AssistantPrefs["voice"]; voiceSpeed: number },
): Promise<void> {
  const [row] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await db
    .update(users)
    .set({
      profile: {
        ...(row?.profile ?? {}),
        assistantLanguage: prefs.language,
        voice: prefs.voice,
        voiceSpeed: Math.min(2, Math.max(0.5, prefs.voiceSpeed)),
        assistantPrefsSetAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
