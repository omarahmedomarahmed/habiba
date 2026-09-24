import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { patientNotifications } from "@/lib/db/schema";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The patient's own notification log. PLAN.md 53.20, C231.
 *
 * ## 🔴 Append only, and dismissal is not deletion
 *
 * There is no delete here and there is not going to be one. `dismissNotice`
 * stamps `dismissed_at`, which takes the row out of the main view and leaves it
 * in the log. A person who taps the wrong thing at speed has not destroyed the
 * record of why their sessions stopped being paid for, which is the one entry
 * they are most likely to want back.
 *
 * ## 🔴 The row carries no prose and no employer
 *
 * `message_key` is a `MessageKey`, resolved at render through the same three
 * layer resolver as every other string in the product: the admin's override,
 * then the shipped language, then English. So a notice written in March is in
 * Arabic in April if the person switches, and an admin can reword all of them
 * at once. The alternative — a `body` column holding a sentence — would have
 * frozen the wording of the most sensitive message this product sends at the
 * moment it was sent, in one language.
 *
 * There is no `sponsor_id` on this table either, which is C231's amendment
 * rather than an omission. The schema comment states the reasoning.
 */

export type Notice = {
  id: string;
  /**
   * 🔴 Typed as `MessageKey` at the boundary, not at the render.
   *
   * The column is `text`, so the cast happens exactly once, here. A component
   * that took a bare `string` and cast at the call to `t` would let any future
   * writer put an arbitrary key in the table and discover it as a blank line on
   * a patient's screen.
   */
  messageKey: MessageKey;
  /** W1-28b: a clinician's reason for cancelling, when this notice is one. */
  reason: string | null;
  dismissedAt: Date | null;
  createdAt: Date;
};

/**
 * Every notice this person has, dismissed ones included, newest first.
 *
 * Scoped on `person_id` from the session and nothing else. A `people` row is
 * the person; the several `patients` rows underneath it are their relationships
 * with organisations, and a notice about a benefit belongs to the person across
 * all of them.
 */
export async function noticesFor(personId: string): Promise<Notice[]> {
  const rows = await controlDb
    .select({
      id: patientNotifications.id,
      messageKey: patientNotifications.messageKey,
      reason: patientNotifications.reason,
      dismissedAt: patientNotifications.dismissedAt,
      createdAt: patientNotifications.createdAt,
    })
    .from(patientNotifications)
    .where(eq(patientNotifications.personId, personId))
    .orderBy(desc(patientNotifications.createdAt), asc(patientNotifications.id))
    .limit(200);

  return rows.map((row) => ({
    id: row.id,
    messageKey: row.messageKey as MessageKey,
    reason: row.reason,
    dismissedAt: row.dismissedAt,
    createdAt: row.createdAt,
  }));
}

/** How many are still asking to be read. Drives the badge, nothing else. */
export async function undismissedCount(personId: string): Promise<number> {
  const rows = await controlDb
    .select({ id: patientNotifications.id })
    .from(patientNotifications)
    .where(
      and(
        eq(patientNotifications.personId, personId),
        isNull(patientNotifications.dismissedAt),
      ),
    );

  return rows.length;
}

/**
 * 🔴 A stamp, never a delete, and scoped to the person in the WHERE.
 *
 * `person_id` is a condition of the update rather than a check before it, so a
 * borrowed notice id dismisses nothing. Already dismissed rows are excluded, so
 * a double tap does not move the timestamp.
 */
export async function dismissNotice(personId: string, noticeId: string): Promise<void> {
  await controlDb
    .update(patientNotifications)
    .set({ dismissedAt: new Date() })
    .where(
      and(
        eq(patientNotifications.id, noticeId),
        eq(patientNotifications.personId, personId),
        isNull(patientNotifications.dismissedAt),
      ),
    );
}
