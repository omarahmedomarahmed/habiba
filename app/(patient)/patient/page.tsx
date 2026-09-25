import type { Metadata } from "next";
import Link from "next/link";

import { Download, FileText, Globe2, NotebookPen, Search, ShieldCheck, Star } from "lucide-react";
import { eq, sql } from "drizzle-orm";

import { Badge, Card } from "@/components/ui";
import { PatientAvatar } from "@/components/patient/avatar";
import { CategoryGrid } from "@/components/patient/category-grid";
import { ExploreRail } from "@/components/patient/explore-rail";
import { TherapistCard } from "@/components/patient/therapist-card";
import { StateBanner } from "@/components/visual/primitives";
import { categories, exploreTherapists, RATING_BAR, topRated } from "@/lib/data/discover";
import { radarCount } from "@/lib/data/radar";
import { pendingRequestsFor } from "@/lib/data/grants";
import { openAssignmentsForPerson } from "@/lib/data/assessments";
import { nextStepFor } from "@/lib/data/homework";
import { sessionDoors, sessionsForPatient } from "@/lib/data/patient-view";
import { PatientSessionList } from "@/components/patient/session-list";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patients, people } from "@/lib/db/schema";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(patient)/patient/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/*
 * 🔴 "Home", because that is what this screen is. It carried the title
 * "Your sessions" while rendering a greeting, a search, who is free now,
 * an explore rail, categories and the record card, and the actual session
 * list lives at /patient/sessions. Option A gives that list its own tab,
 * which only reads correctly once this one stops claiming to be it.
 */
/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.home"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The patient's home. PLAN.md 25.1.
 *
 * ## 🔴 What changed, and why it is not a tidy-up
 *
 * This was a column of five cards, each of which was a sentence and a link.
 * That is a site map, not a home screen, and it made the app feel like an
 * administrative back end for a record rather than somewhere you go to find
 * help. It now has the shape people expect: who you are, one thing to search
 * with, what is waiting on you, what to do next, who is good, and your
 * sessions.
 *
 * ## Everything on it is still a fact
 *
 * The temptation in a screen like this is a rail of "recommended for you" that
 * is really "whoever we queried first", and a category grid where most tiles
 * lead nowhere. `lib/data/discover.ts` refuses both: a category appears only
 * when a verified clinician has listed it, and the top-rated rail renders only
 * for clinicians who have cleared the same five-rating bar the rest of the
 * product uses. When nothing clears it, the rail is absent rather than padded.
 *
 * 🔴 It still shows **no clinical content**. §6: a patient never sees a
 * transcript or a clinical note, enforced server-side.
 */
export default async function PatientHomePage({
  searchParams,
}: {
  searchParams: Promise<{ claimed?: string }>;
}) {
  const actor = await requirePatient();

  /*
   * 🔴 22R — the confirmation the invite page could not show.
   *
   * Claiming through an invite worked and ended on "this link is no longer
   * valid", because a single-use token stops resolving the moment it is used
   * and the page re-rendered on the server. The claim now lands here, where
   * the record it produced is on the screen behind the sentence.
   */
  const { claimed } = await searchParams;

  const [
    waiting,
    next,
    openAssessments,
    sessions,
    cats,
    best,
    explore,
    liveNow,
    person,
    attached,
    i18n,
  ] = await Promise.all([
    // 7.4 — an unanswered request is the one thing on this page waiting on them.
    pendingRequestsFor(actor.personId),
    // 9.5 — one step, and `nextStepFor` cannot return a rate, a streak or a
    // history, which is how the rule is enforced rather than remembered.
    nextStepFor(actor.personId),
    /*
     * 56.6 — what is waiting to be answered. Ids and modes; no score, no band
     * and no history, for the same reason `nextStepFor` cannot return a
     * streak: the shape of the query is the rule.
     */
    openAssignmentsForPerson(actor.personId),
    // 15.3 — their own sessions, in four groups, through the one query whose
    // select list is the 15.8 enforcement.
    sessionsForPatient(actor.personId),
    categories(),
    topRated(4),
    // 65.7 — a rail of who is here, ordered by who is reachable and then rotated.
    exploreTherapists(10),
    /*
     * 65.8 — the live count, and it is the radar's own.
     *
     * C285 already fixed this number once on the public home page: it counted rows this
     * product would not show if anybody clicked. Reusing it rather than writing a second
     * count is the whole point, because the second one is the one that drifts.
     */
    radarCount(),
    db
      .select({ claimedAt: people.claimedAt, avatarUrl: people.avatarUrl })
      .from(people)
      .where(eq(people.id, actor.personId))
      .limit(1)
      .then((rows) => rows[0]),
    /*
     * 🔴 22R — counted in its own query, because the correlated one returned 0.
     *
     * This was a `sql<number>` subquery inside the select above, and on a
     * record with one file attached the screen said "No therapist files are
     * attached to your account yet" while the database, asked directly, said
     * one. A patient reading that has just been told their record is empty on
     * the day they claimed it.
     */
    db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(patients)
      .where(eq(patients.personId, actor.personId))
      .then((rows) => Number(rows[0]?.n ?? 0)),
    getI18n(),
  ]);

  const pending = waiting.length;
  const { t } = i18n;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      {claimed ? (
        <Card className="border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-900">{t("home.claimedTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed text-brand-900/90">
            {claimed === "kept" ? t("home.claimedKept") : t("home.claimedDropped")}
          </p>
        </Card>
      ) : null}

      {/* ------------------------------------------------------- who you are */}

      <header className="flex items-center gap-3">
        <Link href="/patient/account" aria-label={t("home.yourAccount")}>
          <PatientAvatar
            personId={actor.personId}
            hasPhoto={Boolean(person?.avatarUrl)}
            name={actor.firstName}
            size={44}
          />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-tight text-slate-900">
            {t("home.greeting", { name: actor.firstName })}
          </p>
          <p className="truncate text-xs text-slate-500">
            {person?.claimedAt ? t("home.recordYours") : t("home.recordUnclaimed")}
          </p>
        </div>
      </header>

      {/* ---------------------------------------------------------- the search */}

      <Link
        href="/patient/browse"
        className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-500"
      >
        <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        {t("home.searchPlaceholder")}
      </Link>

      {/* ------------------------------------------------------------ the globe */}

      {/*
        🔴 65.7 / 65.8 — THE BANNER FOR WHAT IS LIVE RIGHT NOW, AND IT COUNTS.

        This was a fixed brand-coloured card reading *"Therapists who are online and
        free this minute"*, rendered identically at four in the morning with nobody on
        shift. C288 ruled that the public homepage may not promise a therapist in sixty
        seconds; the same promise inside the app, to somebody who opened it because they
        needed one, is the version that costs something.

        So the banner reads `radarCount()`, which is the count C285 fixed to mean the
        people this product would actually show if anybody tapped. Above zero it is the
        number, live. At zero it says so and points at the hours that are bookable,
        which is the thing that is true instead.
      */}
      {liveNow > 0 ? (
        <Link
          href="/patient/radar"
          className="flex items-center gap-3 rounded-2xl bg-brand-500 px-4 py-3.5 text-navy-600 shadow-sm active:scale-[0.99]"
        >
          <Globe2 className="h-6 w-6 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t("home.findNow")}</span>
            <span className="block text-xs text-navy-600/80">
              {liveNow === 1 ? t("home.liveOne") : t("home.liveMany", { count: liveNow })}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-sm font-bold tabular-nums">
            <span className="live-dot">●</span>
            {liveNow}
          </span>
        </Link>
      ) : (
        <Link
          href="/patient/browse"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 active:scale-[0.99]"
        >
          <Globe2 className="h-6 w-6 shrink-0 text-slate-500" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">
              {t("home.liveNone")}
            </span>
            <span className="block text-xs text-slate-500">{t("home.liveNoneBody")}</span>
          </span>
        </Link>
      )}

      {/* --------------------------------------------------- what is waiting */}

      {pending > 0 ? (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-amber-900">{t("home.askedTitle")}</p>
            <Badge tone="amber">{pending}</Badge>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
            {pending === 1 ? t("home.askedOne") : t("home.askedMany", { count: pending })}
          </p>
          <Link
            href="/patient/consent"
            className="mt-3 inline-flex text-sm font-semibold text-amber-900 underline"
          >
            {t("home.answerNow")}
          </Link>
        </Card>
      ) : null}

      {next ? (
        <Card className="border border-brand-200 p-4">
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
            {t("home.beforeNext")}
          </p>
          <p className="mt-1.5 text-base leading-relaxed font-medium text-slate-900">
            {next.title}
          </p>
          {next.detail ? (
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{next.detail}</p>
          ) : null}
          <Link
            href="/patient/homework"
            className="mt-3 inline-flex text-sm font-semibold text-brand-700 hover:underline"
          >
            {next.othersWaiting > 0
              ? t("home.openAndMore", {
                  count: `${next.othersWaiting}${next.othersWaiting === 9 ? "+" : ""}`,
                })
              : t("home.openIt")}
          </Link>
        </Card>
      ) : null}

      {/*
        🔴 56.6 — an assessment lands where homework lands.

        Not in a new "assessments" tab somebody has to discover. The thing the
        therapist asked for between sessions is one idea to a patient, and
        splitting it across two places is how a set of questions goes
        unanswered for a fortnight. Same card shape, same position, directly
        under the step they were already going to see.

        No score and no band here either: this is a door, not a result.
      */}
      {openAssessments.length > 0 ? (
        <Card className="border border-brand-200 p-4">
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
            {t("home.beforeNext")}
          </p>
          <p className="mt-1.5 text-base leading-relaxed font-medium text-slate-900">
            {t("passess.title")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("passess.body")}</p>
          <Link
            href="/patient/assessments"
            className="mt-3 inline-flex text-sm font-semibold text-brand-700 hover:underline"
          >
            {t("passess.start")}
          </Link>
        </Card>
      ) : null}

      {/* ------------------------------------------------------- explore them */}

      {/*
        🔴 65.7 — EXPLORE THERAPISTS, AND IT COMES BEFORE THE RANKED RAIL.

        A person who has just arrived is finding out whether there is anybody here, not
        choosing between the best four. `exploreTherapists` puts whoever is online first
        and rotates the rest daily, so the rail is a sample of the platform rather than
        a leaderboard with a softer word over it.
      */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{t("home.exploreTitle")}</h2>
          {explore.length > 0 ? (
            <Link href="/patient/browse" className="text-xs font-semibold text-brand-700">
              {t("home.exploreAll")}
            </Link>
          ) : null}
        </div>
        <div className="mt-2.5">
          {explore.length > 0 ? (
            <ExploreRail therapists={explore} />
          ) : (
            /* 🔴 65.8 — an empty platform says it is empty. */
            <StateBanner tone="info">{t("home.nobodyListed")}</StateBanner>
          )}
        </div>
      </section>

      {/* --------------------------------------------------------- categories */}

      {/*
        🔴 65.7 / 65.9 — AN ICON GRID OVER THE TAXONOMY AN ADMIN ALREADY EDITS.

        This was a sideways-scrolling row of grey pills: the least scannable form a list
        of eight things can take, on the one screen whose reader may be in distress.

        🔴 It is hidden when empty rather than given an honest sentence, and that is a
        deliberate difference from the two rails above. Those make a claim about the
        platform, so their absence has to be spoken. This is a shortcut into search, and
        a shortcut that is not offered claims nothing at all.
      */}
      {cats.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-slate-900">{t("home.areas")}</h2>
          <div className="mt-2.5">
            <CategoryGrid categories={cats.slice(0, 8)} />
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------- the top rail */}

      {/*
        🔴 65.8 — FEW RATINGS SAYS FEW RATINGS.

        The rail used to vanish when nobody cleared the bar, which reads to a patient as
        a product that has no ratings feature rather than one that refuses to invent a
        ranking. And it carried a 24-word paragraph explaining the bar, under a heading,
        above a list nobody had scrolled to yet.

        Both are now one line with two numbers in it, and the zero case is on the screen
        rather than absent from it.
      */}
      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
          {t("home.ratedHighest")}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {best.length === 0
            ? t("home.ratedNone", { bar: RATING_BAR })
            : t("home.ratedSome", { count: best.length, bar: RATING_BAR })}
        </p>
        {best.length > 0 ? (
          <ul className="mt-2.5 space-y-2.5">
            {best.map((therapist) => (
              <li key={therapist.userId}>
                <TherapistCard therapist={therapist} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* ---------------------------------------------------------- sessions */}

      <PatientSessionList
        sessions={sessions}
        zone={actor.timezone}
        /* 🔴 W2-P06: every card opens what it is waiting on. */
        doors={Object.fromEntries(
          (await sessionDoors(actor.personId)).map((row) => [row.sessionId, row.door]),
        )}
      />

      {/*
        🔴 58.3 — the link to `/patient/sessions`, which did not exist.

        That page is built, works, and groups a patient's sessions into three
        tabs with the back button and a reload both surviving. Nothing anywhere
        linked to it: it was reachable by typing the URL, which for the person
        it was built for is the same as absent. `verify:reachable` found it on
        its first run, alongside two admin pages in the same state.
      */}
      {sessions.length > 0 ? (
        <Link
          href="/patient/sessions"
          className="block text-center text-sm font-semibold text-brand-700"
        >
          {t("psessions.title")}
        </Link>
      ) : null}

      {/* ------------------------------------------------------- your record */}

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">{t("home.yourRecord")}</p>
          {person?.claimedAt ? (
            <Badge tone="teal">{t("home.yours")}</Badge>
          ) : (
            <Badge tone="slate">{t("home.notClaimed")}</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {attached === 0
            ? t("home.noFiles")
            : attached === 1
              ? t("home.filesAttached", { count: attached })
              : t("home.filesAttachedMany", { count: attached })}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          <Link href="/patient/claim" className="text-sm font-semibold text-brand-700">
            {person?.claimedAt ? t("home.claimAnother") : t("home.haveRecords")}
          </Link>
          <Link href="/patient/profile" className="text-sm font-semibold text-brand-700">
            {t("home.openProfile")}
          </Link>
        </div>
      </Card>

      {/* 26.5 / 26.1 — the two things on this app that are unambiguously theirs. */}
      <Link
        href="/patient/journal"
        className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
      >
        <NotebookPen className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        {t("home.journal")}
      </Link>

      <Link
        href="/patient/summary"
        className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
      >
        <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        {t("home.summary")}
      </Link>

      <Link
        href="/patient/consent"
        className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        {t("home.whoCanRead")}
      </Link>

      {/* 26.9 — the whole thing, in one document they can keep. */}
      <Link
        href="/patient/record"
        className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
      >
        <Download className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        {t("home.getCopy")}
      </Link>
    </main>
  );
}
