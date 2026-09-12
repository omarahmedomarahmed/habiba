import "server-only";

import { asc, eq } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { observations, personProfiles, type PersonProfile } from "@/lib/db/schema";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/data/memory.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
