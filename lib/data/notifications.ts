import "server-only";

import { and, desc, eq, isNull, like } from "drizzle-orm";

import type { Actor } from "@/lib/auth/session";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { notifications } from "@/lib/db/schema";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/data/notifications.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
