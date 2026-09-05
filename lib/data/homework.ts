import "server-only";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { homeworkItems, sessions, type HomeworkItem, type HomeworkState } from "@/lib/db/schema";

/**
 * Homework. PLAN.md 9.5, and the warning that shapes the whole module:
 *
 * > ⚠️ A completion rate shown to a depressed patient is a scoreboard of their
 * > failures. **Trend to the therapist; next action to the patient.**
 *
 * ## Where that rule lives
 *
 * Here, in two deliberately asymmetric functions, rather than in a component
 * that renders fewer fields:
 *
 *   `nextStepFor`   the patient's side. Returns **one** open item and nothing
 *                   else — no counts, no history, no rate. There is no shape
 *                   in its return type that a screen could accidentally render
 *                   as a score.
 *   `homeworkTrend` the clinician's side. Counts, streaks of skipping, the lot.
 *
 * A single `listHomework(role)` would have been shorter and would have put the
 * decision in whichever caller got it wrong. Two functions means the patient's
 * screen *cannot* show a completion rate, because it never receives one.
 */

/* ------------------------------------------------------------- the patient -- */

export type NextStep = {
  id: string;
  title: string;
  detail: string | null;
  dueAt: Date | null;
  /** How many other things are waiting. Deliberately capped — see below. */
  othersWaiting: number;
};

/**
 * The one thing to do next. Nothing else.
 *
 * `othersWaiting` is a count and not a list, and it is the only number the
 * patient sees. It exists because "and 4 more" is orientation, not judgement —
 * a person needs to know whether they are looking at the whole picture. It is
 * capped at 9 so a long backlog reads as "9+" rather than as "you are 23
 * behind".
 *
 * Oldest first: the thing set longest ago is the thing most likely to be
 * blocking, and a stack that reorders itself is a stack nobody finishes.
 */
export async function nextStepFor(personId: string): Promise<NextStep | null> {
  const open = await db
    .select({
      id: homeworkItems.id,
      title: homeworkItems.title,
      detail: homeworkItems.detail,
      dueAt: homeworkItems.dueAt,
    })
    .from(homeworkItems)
    .where(and(eq(homeworkItems.personId, personId), eq(homeworkItems.status, "open")))
    .orderBy(asc(homeworkItems.createdAt))
    .limit(10);

  const [first] = open;
  if (!first) return null;

  return { ...first, othersWaiting: Math.min(9, open.length - 1) };
}

/**
 * Everything open, for the patient's own list.
 *
 * Still no rate, no history and no skipped items. A person who wants to see
 * more than the next step may — what they may not be shown is the tally of
 * what they did not do, which is what `status != 'open'` would give them.
 */
export async function openStepsFor(personId: string) {
  return db
    .select({
      id: homeworkItems.id,
      title: homeworkItems.title,
      detail: homeworkItems.detail,
      dueAt: homeworkItems.dueAt,
      createdAt: homeworkItems.createdAt,
    })
    .from(homeworkItems)
    .where(and(eq(homeworkItems.personId, personId), eq(homeworkItems.status, "open")))
    .orderBy(asc(homeworkItems.createdAt))
    .limit(50);
}

export type CloseResult = { ok: true } | { ok: false; error: string };

/**
 * The person closes a step. 🔴 Only they ever can.
 *
 * There is no clinician-facing counterpart to this function, and that is the
 * point: a therapist marking somebody's homework done is a therapist recording
 * something they do not know. The conditional UPDATE is scoped to the person's
 * own rows, so a borrowed id closes nothing.
 *
 * `skipped` is offered beside `done` with equal weight. A person who did not
 * do a thing has told us something clinically useful, and a control that
 * offers only "done" turns every unfinished week into silence.
 */
export async function closeStep(input: {
  itemId: string;
  personId: string;
  accountId: string;
  outcome: Extract<HomeworkState, "done" | "skipped">;
  note?: string | null;
}): Promise<CloseResult> {
  const now = new Date();

  const [updated] = await db
    .update(homeworkItems)
    .set({
      status: input.outcome,
      completedAt: now,
      completedByAccountId: input.accountId,
      patientNote: input.note?.trim() || null,
      updatedAt: now,
    })
    .where(
      and(
        eq(homeworkItems.id, input.itemId),
        eq(homeworkItems.personId, input.personId),
        eq(homeworkItems.status, "open"),
      ),
    )
    .returning({ id: homeworkItems.id });

  if (!updated) return { ok: false, error: "That step is already closed." };

  await audit({
    actor: null,
    patientAccountId: input.accountId,
    category: "clinical",
    action: `homework.${input.outcome}`,
    resourceType: "homework_item",
    resourceId: updated.id,
  });

  return { ok: true };
}

/* ----------------------------------------------------------- the clinician -- */

export type HomeworkTrend = {
  open: number;
  done: number;
  skipped: number;
  /** Consecutive most-recent closures that were skips. The clinical signal. */
  skipStreak: number;
  /** Null when nothing has ever been closed — not zero, which reads as "never". */
  completionRate: number | null;
};

/**
 * The trend, for the clinician only.
 *
 * `completionRate` is `null` rather than `0` for a patient who has closed
 * nothing. Zero reads as "they fail everything"; null is "there is nothing to
 * say yet", and those are different clinical facts.
 *
 * `skipStreak` is here because it is the number that actually means something.
 * A rate of 40% could be four good weeks and six bad ones in any order; three
 * skips in a row is a conversation to have on Thursday.
 */
export async function homeworkTrend(personId: string): Promise<HomeworkTrend> {
  const [counts] = await db
    .select({
      open: sql<number>`COUNT(*) FILTER (WHERE status = 'open')::int`,
      done: sql<number>`COUNT(*) FILTER (WHERE status = 'done')::int`,
      skipped: sql<number>`COUNT(*) FILTER (WHERE status = 'skipped')::int`,
    })
    .from(homeworkItems)
    .where(eq(homeworkItems.personId, personId));

  const closed = await db
    .select({ status: homeworkItems.status })
    .from(homeworkItems)
    .where(
      and(eq(homeworkItems.personId, personId), inArray(homeworkItems.status, ["done", "skipped"])),
    )
    .orderBy(desc(homeworkItems.completedAt))
    .limit(20);

  let skipStreak = 0;
  for (const item of closed) {
    if (item.status !== "skipped") break;
    skipStreak += 1;
  }

  const done = counts?.done ?? 0;
  const skipped = counts?.skipped ?? 0;
  const total = done + skipped;

  return {
    open: counts?.open ?? 0,
    done,
    skipped,
    skipStreak,
    completionRate: total === 0 ? null : done / total,
  };
}

/** Every item, with its outcome and the patient's own note. Clinician side. */
export async function listHomework(personId: string): Promise<HomeworkItem[]> {
  return db
    .select()
    .from(homeworkItems)
    .where(eq(homeworkItems.personId, personId))
    .orderBy(desc(homeworkItems.createdAt))
    .limit(100);
}

export type AssignResult = { ok: true; itemId: string } | { ok: false; error: string };

/**
 * A clinician sets a step. 9.5.
 *
 * `source` distinguishes a step the clinician typed from one the note drafted
 * (`NoteContent.patientSteps`). A patient asking "did you actually mean me to
 * do this?" deserves a true answer, and after the fact the two are
 * indistinguishable unless it is recorded at the time.
 */
export async function assignStep(input: {
  actor: Actor;
  personId: string;
  sessionId?: string | null;
  title: string;
  detail?: string | null;
  dueAt?: Date | null;
  source?: "drafted" | "therapist";
}): Promise<AssignResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Write the step itself." };
  if (title.length > 200) return { ok: false, error: "Keep the step to a sentence." };

  const [item] = await db
    .insert(homeworkItems)
    .values({
      personId: input.personId,
      sessionId: input.sessionId ?? null,
      assignedByUserId: input.actor.userId,
      organizationId: input.actor.organizationId,
      title,
      detail: input.detail?.trim() || null,
      dueAt: input.dueAt ?? null,
      source: input.source ?? "therapist",
    })
    .returning({ id: homeworkItems.id });

  if (!item) return { ok: false, error: "That could not be saved." };

  await audit({
    actor: input.actor,
    category: "clinical",
    action: "homework.assign",
    resourceType: "homework_item",
    resourceId: item.id,
  });

  return { ok: true, itemId: item.id };
}

/**
 * Withdraw a step that should not have been set.
 *
 * Deletes rather than closes. A step nobody agreed to is not a skipped step,
 * and leaving it as `skipped` would put a failure on the record that belongs
 * to the clinician's typing rather than to the patient's week. Only an **open**
 * step can be withdrawn — once somebody has answered it, the answer is theirs
 * and stays.
 */
export async function withdrawStep(input: {
  actor: Actor;
  itemId: string;
  personId: string;
}): Promise<boolean> {
  const removed = await db
    .delete(homeworkItems)
    .where(
      and(
        eq(homeworkItems.id, input.itemId),
        eq(homeworkItems.personId, input.personId),
        eq(homeworkItems.status, "open"),
        eq(homeworkItems.assignedByUserId, input.actor.userId),
      ),
    )
    .returning({ id: homeworkItems.id });

  return removed.length > 0;
}

/**
 * The steps a note drafted for one session, and which of them are already live.
 *
 * Used by the clinician's screen to offer "set this one" against each drafted
 * step. Nothing is promoted automatically — see the note at the bottom of
 * migration 0037.
 */
export async function draftedStepsFor(
  sessionId: string,
): Promise<{ title: string; assigned: boolean }[]> {
  const { sessionNotes } = await import("@/lib/db/schema");

  const [note] = await db
    .select({ content: sessionNotes.content })
    .from(sessionNotes)
    .where(eq(sessionNotes.sessionId, sessionId))
    .limit(1);

  const drafted = note?.content?.patientSteps ?? [];
  if (drafted.length === 0) return [];

  const live = await db
    .select({ title: homeworkItems.title })
    .from(homeworkItems)
    .where(eq(homeworkItems.sessionId, sessionId));

  const liveTitles = new Set(live.map((l) => l.title.trim()));
  return drafted.map((title) => ({ title, assigned: liveTitles.has(title.trim()) }));
}

/** The person behind a session, for the clinician's homework panel. */
export async function personForSession(sessionId: string): Promise<string | null> {
  const { patients } = await import("@/lib/db/schema");

  const [row] = await db
    .select({ personId: patients.personId })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .where(and(eq(sessions.id, sessionId), isNull(patients.deletedAt)))
    .limit(1);

  return row?.personId ?? null;
}
