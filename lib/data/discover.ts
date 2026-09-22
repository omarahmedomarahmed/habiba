import "server-only";

import { and, eq, isNull, lt, or } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { therapistRadar, therapistVerifications, users } from "@/lib/db/schema";
import { RATINGS_VISIBLE_AFTER, therapistRatings } from "@/lib/data/feedback";
import { HEARTBEAT_STALE_MS } from "@/lib/data/radar";
import { activeTaxonomy } from "@/lib/data/taxonomy";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/data/discover.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
  /**
   * 🔴 80.5 — A DEMONSTRATION ACCOUNT SAYS SO, ON THE SCREEN.
   *
   * The founder's ruling, and it is about honesty rather than tidiness: these
   * are our own accounts standing in a public directory a stranger browses, and
   * a stranger choosing a therapist is entitled to know which of them is a
   * demonstration before they tap one.
   *
   * 80.3 made the flag stop deciding anything. This is the other half: having
   * removed its power, publish it. A column that decides nothing and is shown to
   * nobody would have been a column to delete.
   */
  demo: boolean;
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
    /*
     * 🔴 80.3 — THE `demo` FILTER IS GONE FROM HERE, AND THAT IS THE WHOLE
     * REPAIR THE OLD COMMENT SAID WAS OWED.
     *
     * What used to be here: `SIMULATION_RUNNING ? undefined : demo = false`.
     * One boolean was doing two jobs. `demo` meant "nothing is beating for this
     * row, do not let it go stale" in `reachable()`, in the staleness sweep and
     * on the profile page; this line borrowed it to mean "a fixture, keep it
     * out of the patient's directory". The two meanings disagreed the moment
     * somebody needed both, and the cost was a radar showing two clinicians
     * while the same patient's home page said "No therapist is listed yet".
     *
     * The old comment ended *"the real repair is to split the flag in two, and
     * that is a migration and it is not this commit"*. It needed no migration.
     * The flag is now a LABEL and nothing else: the three heartbeat exemptions
     * came out of `radar.ts`, so presence is measured for every row, and
     * nothing here has to decide whether a fixture is real.
     *
     * 🔴 AND IT NO LONGER DEPENDS ON `SIMULATION_RUNNING`, which was holding
     * the patient's directory up by accident. That variable also serves
     * `Disallow: /` to every crawler from `app/robots.ts`, so the site could
     * not be indexed for as long as the radar had anybody on it. Two unrelated
     * things wired to one switch, and removing the switch to get indexed would
     * have emptied the radar in the same moment with nothing saying why.
     */
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
      lastSeenAt: therapistRadar.lastSeenAt,
      demo: therapistRadar.demo,
    })
    .from(therapistRadar)
    .innerJoin(users, eq(users.id, therapistRadar.userId))
    .innerJoin(therapistVerifications, eq(therapistVerifications.userId, users.id))
    .where(listable(now))
    .limit(500);
}

/**
 * 🔴 80.3 — PRESENT MEANS BEATING, AND THE COLUMN IS A CACHE OF THAT.
 *
 * `therapist_radar.status` is maintained by the radar sweep, so it is only ever
 * as fresh as the last time that cron ran. Three surfaces here read it directly
 * and reported `online: true` for somebody who had closed their laptop.
 *
 * That was survivable while demo rows were exempt from the sweep, because it
 * was wrong in a way nobody was looking at. It stopped being survivable the
 * moment the exemption came off: the live board drops a clinician the instant
 * their heartbeat goes stale, and the directory would have gone on saying
 * "online" about the same person on the same screen. A patient taps somebody
 * the directory says is available and lands on a profile that says offline.
 *
 * `therapistProfile` in `radar.ts` already derives this from the heartbeat.
 * This is the same derivation, in the one place all three shapes share, so
 * there is one answer to "are they there" across the whole product.
 *
 * 🔴 THE ROW STAYS LISTED EITHER WAY. Being asleep is not being absent, which
 * is the rule `listable()` states and the reason the heartbeat is not in its
 * WHERE clause. This decides what the card SAYS, never whether it is drawn.
 *
 * 🔴 `HEARTBEAT_STALE_MS` IS IMPORTED, NOT REDECLARED. The first draft of this
 * wrote `90_000` again, which is the shape of every drift in this repository: a
 * number tuned in one file and stale in the other, so the board and the
 * directory would disagree about the same person by whatever the difference
 * was. `radar.ts` exports it and owns it.
 */
function present(row: { status: string; lastSeenAt: Date | null }, now: Date): boolean {
  if (row.status !== "online") return false;
  return row.lastSeenAt !== null && row.lastSeenAt.getTime() >= now.getTime() - HEARTBEAT_STALE_MS;
}

function shape(
  row: Awaited<ReturnType<typeof listableRows>>[number],
  rating: { average: number; count: number } | undefined,
): DiscoverTherapist {
  return {
    userId: row.userId,
    name: [row.firstName, row.lastName].filter(Boolean).join(" "),
    credentials: row.profile?.credentials ?? null,
    headline: row.headline,
    photoUrl: row.photoUrl,
    languages: row.languages ?? [],
    specialties: row.specialties ?? [],
    /* 🔴 Below the bar there is no score, so the caller is handed a zero count
       and renders nothing rather than a star with no number behind it. */
    rating:
      rating && rating.count >= RATINGS_VISIBLE_AFTER
        ? { average: Math.round(rating.average * 10) / 10, count: rating.count }
        : { average: 0, count: 0 },
    online: present(row, new Date()),
    demo: row.demo,
  };
}

/**
 * 🔴 65.7 / 65.8 — THE EXPLORE RAIL, AND ITS ORDER IS NOT A RANKING.
 *
 * *Explore therapists, a horizontal card rail.* The tempting build sorts by rating and
 * calls the result "recommended", which is `topRated` with a dishonest label, or sorts
 * by nothing in particular and lets whoever the planner returned first own the rail for
 * the life of the product.
 *
 * ## 🔴 65.22 — THE ORDER ENCODES TWO TRUE THINGS AND NOTHING ELSE
 *
 * **Who is online now comes first.** That is a fact about what the reader can do in the
 * next minute, it is already on the card as a badge, and it is the one ordering a
 * patient would choose for themselves.
 *
 * **Everybody else rotates by the day.** A fixed order would mean the four clinicians
 * whose names sort first are the platform's shopfront forever and the rest are a page
 * nobody scrolls to. The rotation is seeded on the date, so it is stable within a day
 * (the server render and any refetch agree) and every listed clinician reaches the rail
 * across a month.
 *
 * 🔴 IT DOES NOT SORT ON RATING. A rail ordered by score with "explore" written over it
 * is a ranking that denies being one, and the product already has a rail that ranks and
 * says so.
 */
export async function exploreTherapists(
  limit = 10,
  today = new Date(),
): Promise<DiscoverTherapist[]> {
  const [rows, ratings] = await Promise.all([listableRows(), therapistRatings()]);

  /*
   * The seed is the calendar day in UTC. Deliberately not `Math.random()`: the page is
   * server rendered and the client refetches, and a rail that reshuffles under somebody
   * mid-tap is a different clinician than the one they aimed at.
   */
  const day = Math.floor(today.getTime() / 86_400_000);
  const place = (userId: string) => {
    let hash = day;
    for (const character of userId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    return hash;
  };

  return rows
    .map((row) => shape(row, ratings.get(row.userId)))
    .sort(
      (a, b) =>
        Number(b.online) - Number(a.online) || place(a.userId) - place(b.userId),
    )
    .slice(0, limit);
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
          online: present(row, new Date()),
          demo: row.demo,
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
        online: present(row, new Date()),
        demo: row.demo,
      } satisfies DiscoverTherapist;
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || b.rating.count - a.rating.count)
    .slice(0, limit);
}

/** Used by the count query above and by the sprint 25 verifier. */
export const RATING_BAR = RATINGS_VISIBLE_AFTER;
