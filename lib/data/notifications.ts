import "server-only";

import { and, desc, eq, isNull, like } from "drizzle-orm";

import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

/**
 * Notifications, and the thing that clears them.
 *
 * Rows were being written by the crisis alerter and the radar and never marked
 * read by anything, so the dashboard banner was permanent: a clinician who
 * reviewed a risk alert on Monday still saw "a session raised a risk alert"
 * in March. A banner that never goes away is a banner nobody reads, which
 * defeats the entire point of having one for crisis language.
 */

export async function unreadNotifications(actor: Actor, limit = 5) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, actor.userId), isNull(notifications.readAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/**
 * Clear the notifications that point at a session, because the clinician has
 * just opened it — which is exactly what the notification was asking them to do.
 *
 * Matched on `action_url` rather than a foreign key: notifications are
 * deliberately a thin, denormalised table, and the alternative is a nullable
 * `session_id` that every future notification kind has to remember to set.
 */
export async function markSessionNotificationsRead(
  actor: Actor,
  sessionId: string,
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, actor.userId),
        isNull(notifications.readAt),
        like(notifications.actionUrl, `%${sessionId}%`),
      ),
    );
}

export async function markAllRead(actor: Actor): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, actor.userId), isNull(notifications.readAt)));
}
