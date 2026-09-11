import "server-only";

import { and, eq, isNull, lt, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { therapistRadar, therapistVerifications, users } from "@/lib/db/schema";
import { RATINGS_VISIBLE_AFTER, therapistRatings } from "@/lib/data/feedback";
import { activeTaxonomy } from "@/lib/data/taxonomy";

/**
 * What the patient's home screen browses. PLAN.md 25.1.
 *
 * ## 🔴 Nothing here is allowed to be decorative
 *
 * A home screen with categories, a search box and a "top rated" rail is the
 * shape of an app, and it is also the shape of a demo. The difference is
 * whether every number on it is a fact:
 *
 *   - A **category** appears only if a clinician has actually said they work
 *     with it and is verified. A grid of eighteen tiles where fourteen lead to
 *     "nobody found" is a worse experience than four tiles that all work.
 *   - **Top rated** uses the same `RATINGS_VISIBLE_AFTER` bar the rest of the
 *     product uses. Below five rated sessions a clinician has no score to show,
 *     so they are not ranked, not padded out, and not shown with a blank star.
 *     If nobody clears the bar the rail does not render at all. **A rail that
 *     invents an ordering is how a marketplace lies quietly.**
 *
 * Both queries deliberately look past the radar's availability window: a
 * patient browsing on a Tuesday afternoon is choosing somebody, not summoning
 * them. Who is online *this minute* is what the radar is for, and it has its
 * own page.
 */

export type DiscoverTherapist = {
  userId: string;
  name: string;
  credentials: string | null;
  headline: string | null;
  photoUrl: string | null;
  languages: string[];
  specialties: string[];
  rating: { average: number; count: number };
  online: boolean;
};

export type DiscoverCategory = { code: string; label: string; count: number };

/**
 * Verified, not suspended, not deleted, not a fixture.
 *
 * The radar's own `reachable()` also requires a recent heartbeat, which is
 * right for "can I talk to somebody now" and wrong here: a clinician asleep at
 * 3am is still someone a patient can choose.
 */
function listable(now: Date) {
  return and(
    isNull(users.deletedAt),
    eq(users.status, "active"),
    eq(users.role, "therapist"),
    eq(therapistVerifications.state, "approved"),
    eq(therapistRadar.demo, false),
    or(isNull(therapistRadar.suspendedUntil), lt(therapistRadar.suspendedUntil, now)),
  );
}

async function listableRows() {
  const now = new Date();
  return db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      profile: users.profile,
      headline: therapistRadar.headline,
      photoUrl: therapistRadar.photoUrl,
      languages: therapistRadar.languages,
      specialties: therapistRadar.specialties,
      status: therapistRadar.status,
    })
    .from(therapistRadar)
    .innerJoin(users, eq(users.id, therapistRadar.userId))
    .innerJoin(therapistVerifications, eq(therapistVerifications.userId, users.id))
    .where(listable(now))
    .limit(500);
}

/**
 * The rail. Empty is a legitimate answer and the caller must render nothing.
 */
export async function topRated(limit = 6): Promise<DiscoverTherapist[]> {
  const [rows, ratings] = await Promise.all([listableRows(), therapistRatings()]);

  return rows
    .flatMap((row) => {
      const rating = ratings.get(row.userId);
      /* 🔴 The bar. Below it there is no score, so there is no ranking. */
      if (!rating || rating.count < RATINGS_VISIBLE_AFTER) return [];
      return [
        {
          userId: row.userId,
          name: [row.firstName, row.lastName].filter(Boolean).join(" "),
          credentials: row.profile?.credentials ?? null,
          headline: row.headline,
          photoUrl: row.photoUrl,
          languages: row.languages ?? [],
          specialties: row.specialties ?? [],
          rating: { average: Math.round(rating.average * 10) / 10, count: rating.count },
          online: row.status === "online",
        } satisfies DiscoverTherapist,
      ];
    })
    .sort((a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count)
    .slice(0, limit);
}

/**
 * The categories, counted. Only ones somebody actually covers.
 *
 * The label comes from the taxonomy so an admin renaming "Trauma & PTSD" is
 * reflected here, and a category an admin has switched off disappears from the
 * home screen without anyone editing this file.
 */
export async function categories(): Promise<DiscoverCategory[]> {
  const [rows, options] = await Promise.all([listableRows(), activeTaxonomy("specialty")]);

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const specialty of row.specialties ?? []) {
      counts.set(specialty, (counts.get(specialty) ?? 0) + 1);
    }
  }

  return options
    .map((option) => ({
      code: option.code,
      label: option.label,
      count: counts.get(option.code) ?? 0,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Search, over the two things a patient actually types: what is wrong, and
 * what language they want to be heard in.
 *
 * A name is deliberately not searchable. A patient looking for a specific
 * clinician has that clinician's link or their QR code; letting anybody page
 * through the register by name turns a directory of real people into a
 * scraping surface, and the product gains nothing.
 */
export async function search(query: string, limit = 20): Promise<DiscoverTherapist[]> {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const [rows, ratings] = await Promise.all([listableRows(), therapistRatings()]);

  return rows
    .filter((row) =>
      [...(row.specialties ?? []), ...(row.languages ?? []), row.headline ?? ""].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    )
    .map((row) => {
      const rating = ratings.get(row.userId);
      const visible = rating && rating.count >= RATINGS_VISIBLE_AFTER;
      return {
        userId: row.userId,
        name: [row.firstName, row.lastName].filter(Boolean).join(" "),
        credentials: row.profile?.credentials ?? null,
        headline: row.headline,
        photoUrl: row.photoUrl,
        languages: row.languages ?? [],
        specialties: row.specialties ?? [],
        /* No score is shown as no score, never as zero. */
        rating: visible ? { average: Math.round(rating.average * 10) / 10, count: rating.count } : { average: 0, count: 0 },
        online: row.status === "online",
      } satisfies DiscoverTherapist;
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || b.rating.count - a.rating.count)
    .slice(0, limit);
}

/** Used by the count query above and by the sprint 25 verifier. */
export const RATING_BAR = RATINGS_VISIBLE_AFTER;
