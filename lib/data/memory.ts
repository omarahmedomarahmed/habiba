import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { observations, personProfiles, type PersonProfile } from "@/lib/db/schema";

/**
 * Reading the rolling profile and the timeline. PLAN.md 9.1 / 9.2.
 *
 * Thin on purpose: the writing side is `lib/ai/profile.ts`, and there is no
 * update path here at all. A module that could edit a profile is a module
 * somebody wires to a text box, and 9.1 forbids exactly that.
 */

export async function profileFor(personId: string): Promise<PersonProfile | null> {
  const [row] = await db
    .select()
    .from(personProfiles)
    .where(eq(personProfiles.personId, personId))
    .limit(1);
  return row ?? null;
}

/** The dated timeline, oldest first. 9.2. */
export async function timelineFor(personId: string) {
  return db
    .select({
      id: observations.id,
      observedAt: observations.observedAt,
      text: observations.text,
      source: observations.source,
      ref: observations.ref,
    })
    .from(observations)
    .where(eq(observations.personId, personId))
    .orderBy(asc(observations.observedAt))
    .limit(200);
}

/**
 * Is the profile behind its sources?
 *
 * Shown rather than hidden. A clinician reading a standing profile is
 * entitled to know it was built before the session they just finished — a
 * profile that quietly lags is a profile that gets trusted for something it
 * cannot know.
 */
export function isStale(
  profile: PersonProfile | null,
  actual: { sessions: number; documents: number },
): boolean {
  if (!profile) return false;
  return profile.sessionCount < actual.sessions || profile.documentCount < actual.documents;
}
