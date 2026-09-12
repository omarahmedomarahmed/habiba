/*
 * 🔴 30.1 — the CONTROL PLANE: the zone catalogue is a product fact.
 */
import "server-only";

import { eq } from "drizzle-orm";

import { controlDb as db} from "@/lib/db";
import { users } from "@/lib/db/schema";
import { usable } from "@/lib/scheduling/tz";

/**
 * Where a clinician is. PLAN.md 11R.2.
 *
 * ## Why this is a column and not a browser reading
 *
 * The browser knows the zone of the device in front of it, which is right
 * almost always and wrong exactly when it matters: a therapist publishing next
 * week's hours from a laptop that is still on London time while they are in
 * Cairo. More importantly, the **reminder cron has no browser**. It runs at
 * 03:20 with nobody looking at it, and it has to decide whether 05:00 is a
 * reasonable hour to message this person. A column answers that; a
 * `resolvedOptions()` call cannot.
 *
 * ## First write, and why it is not silent
 *
 * When the column is empty we take the browser's answer and store it, and the
 * screen says which zone it used and where to change it. Storing it without
 * saying so would be the product deciding where somebody lives and never
 * mentioning it.
 */

export type ZoneChoice = {
  zone: string;
  /** `stored` — they set it, or we adopted it earlier. `adopted` — we took the
   *  browser's answer just now and saved it. `utc` — we had nothing. */
  source: "stored" | "adopted" | "utc";
};

export async function readTimezone(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return usable(row?.timezone) ? row!.timezone! : null;
}

/**
 * The zone to publish in: the stored one, else the browser's (saved), else UTC.
 *
 * UTC is the last resort and is reported as such, so the caller can say "we do
 * not know where you are" rather than printing an hour that looks local and is
 * not.
 */
export async function clinicianZone(
  userId: string,
  browserZone?: string | null,
): Promise<ZoneChoice> {
  const stored = await readTimezone(userId);
  if (stored) return { zone: stored, source: "stored" };

  if (usable(browserZone)) {
    await writeTimezone(userId, browserZone!);
    return { zone: browserZone!, source: "adopted" };
  }

  return { zone: "UTC", source: "utc" };
}

/** Set it deliberately, from Settings. Refuses a name this runtime cannot use. */
export async function writeTimezone(userId: string, zone: string): Promise<boolean> {
  if (!usable(zone)) return false;

  await db.update(users).set({ timezone: zone, updatedAt: new Date() }).where(eq(users.id, userId));
  return true;
}
