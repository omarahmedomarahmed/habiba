import type { Metadata } from "next";
import Link from "next/link";

import { CalendarDays, Download, FileText, Globe2, Lock, NotebookPen, Search, ShieldCheck, Star } from "lucide-react";
import { eq, sql } from "drizzle-orm";

import { ghostButton, Glow, Hero, Panel, primaryButton, RowLink, Screen, SectionHead } from "@/components/patient/kit";
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
    <Screen>
      {/* ------------------------------------------------------ the hero */}

      {/*
        The sample's hero: who you are, and the one thing to do, on the
        night-navy ground with the teal light behind it.

        🔴 65.7 / 65.8 — THE LIVE CARD COUNTS. It reads `radarCount()`, the
        count C285 fixed to mean the people this product would actually show.
        Above zero it is the number, live. At zero it says so and points at
        the hours that are bookable, which is the thing that is true instead.
      */}
      <Hero>
        <div className="flex items-center gap-3">
          <Link href="/patient/account" aria-label={t("home.yourAccount")}>
            <PatientAvatar
              personId={actor.personId}
              hasPhoto={Boolean(person?.avatarUrl)}
              name={actor.firstName}
              size={48}
              className="ring-2 ring-white/20"
            />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[22px] font-bold tracking-tight">
              {t("home.greeting", { name: actor.firstName })}
            </p>
            <p className="truncate text-[14px] text-white/65">
              {person?.claimedAt ? t("home.recordYours") : t("home.recordUnclaimed")}
            </p>
          </div>
        </div>

        {liveNow > 0 ? (
          <Link
            href="/patient/radar"
            className="mt-5 block rounded-3xl bg-white/[0.07] p-4 ring-1 ring-white/12 backdrop-blur transition-colors hover:bg-white/10"
          >
            <span className="flex items-center gap-2 text-[14px] font-semibold text-brand-300">
              <span className="live-dot h-2.5 w-2.5 rounded-full bg-brand-400" aria-hidden />
              {liveNow === 1 ? t("home.liveOne") : t("home.liveMany", { count: liveNow })}
            </span>
            <span className="mt-4 flex items-center justify-between gap-3">
              <span className="flex h-11 min-w-11 items-center justify-center rounded-full bg-white/10 px-2 text-[16px] font-bold tabular-nums ring-1 ring-white/15">
                {liveNow}
              </span>
              <span className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand-500 px-4 text-[14px] font-semibold text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)]">
                <Globe2 className="h-4 w-4" aria-hidden />
                {t("home.findNow")}
              </span>
            </span>
          </Link>
        ) : (
          <Link
            href="/patient/browse"
            className="mt-5 flex items-center gap-3 rounded-3xl bg-white/[0.07] p-4 ring-1 ring-white/12 transition-colors hover:bg-white/10"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <Globe2 className="h-5 w-5 text-white/80" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-bold">{t("home.liveNone")}</span>
              <span className="block text-[14px] text-white/70">{t("home.liveNoneBody")}</span>
            </span>
          </Link>
        )}
      </Hero>

      {/* ---------------------------------------------------------- the search */}

      <Link
        href="/patient/browse"
        className="flex h-12 items-center gap-2.5 rounded-2xl bg-white px-4 text-[15px] text-navy-400 ring-1 ring-navy-100 transition-shadow hover:ring-navy-200"
      >
        <Search className="h-[18px] w-[18px] shrink-0 opacity-70" aria-hidden />
        {t("home.searchPlaceholder")}
      </Link>

      {/*
        🔴 22R — the confirmation the invite page could not show. The claim
        lands here, where the record it produced is on the screen behind it.
      */}
      {claimed ? (
        <Panel tone="brand">
          <p className="text-[15px] font-bold text-navy-700">{t("home.claimedTitle")}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-navy-600">
            {claimed === "kept" ? t("home.claimedKept") : t("home.claimedDropped")}
          </p>
        </Panel>
      ) : null}

      {/* --------------------------------------------------- what is waiting */}

      {/* 7.4 — an unanswered request is the one thing on this page waiting on them. */}
      {pending > 0 ? (
        <Panel className="ring-2 ring-amber-400">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[16px] font-bold text-navy-700">{t("home.askedTitle")}</p>
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-400 px-2 text-[13px] font-bold text-navy-700">
              {pending}
            </span>
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-navy-500">
            {pending === 1 ? t("home.askedOne") : t("home.askedMany", { count: pending })}
          </p>
          <Link href="/patient/consent" className={`${primaryButton} mt-3 h-11 w-full`}>
            {t("home.answerNow")}
          </Link>
        </Panel>
      ) : null}

      {/* 9.5 — one step, and `nextStepFor` cannot return a rate, a streak or a history. */}
      {next ? (
        <Panel tone="dark">
          <Glow className="-end-16 -top-16 h-48 w-48" />
          <div className="relative">
            <p className="text-[13px] font-semibold tracking-wide text-brand-300 uppercase">
              {t("home.beforeNext")}
            </p>
            <p className="mt-1 text-[17px] leading-snug font-bold">{next.title}</p>
            {next.detail ? (
              <p className="mt-1 text-[14px] leading-relaxed text-white/75">{next.detail}</p>
            ) : null}
            <Link
              href="/patient/homework"
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-white/10 px-3.5 text-[14px] font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
            >
              {next.othersWaiting > 0
                ? t("home.openAndMore", {
                    count: `${next.othersWaiting}${next.othersWaiting === 9 ? "+" : ""}`,
                  })
                : t("home.openIt")}
            </Link>
          </div>
        </Panel>
      ) : null}

      {/*
        🔴 56.6 — an assessment lands where homework lands, same card shape,
        same position. No score and no band here either: this is a door.
      */}
      {openAssessments.length > 0 ? (
        <Panel tone="brand">
          <p className="text-[13px] font-semibold tracking-wide text-brand-700 uppercase">
            {t("home.beforeNext")}
          </p>
          <p className="mt-1 text-[17px] leading-snug font-bold text-navy-700">
            {t("passess.title")}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-navy-500">{t("passess.body")}</p>
          <Link href="/patient/assessments" className={`${primaryButton} mt-3 h-11`}>
            {t("passess.start")}
          </Link>
        </Panel>
      ) : null}

      {/* ------------------------------------------------------- explore them */}

      {/*
        🔴 65.7 — EXPLORE THERAPISTS, AND IT COMES BEFORE THE RANKED RAIL.
        `exploreTherapists` puts whoever is online first and rotates the rest.
      */}
      <section className="space-y-3">
        <SectionHead
          title={t("home.exploreTitle")}
          href={explore.length > 0 ? "/patient/browse" : undefined}
          action={t("home.exploreAll")}
        />
        {explore.length > 0 ? (
          <ExploreRail therapists={explore} />
        ) : (
          /* 🔴 65.8 — an empty platform says it is empty. */
          <StateBanner tone="info">{t("home.nobodyListed")}</StateBanner>
        )}
      </section>

      {/* --------------------------------------------------------- categories */}

      {/* 🔴 65.7 / 65.9 — an icon grid over the taxonomy; hidden when empty. */}
      {cats.length > 0 ? (
        <section className="space-y-3">
          <SectionHead title={t("home.areas")} />
          <CategoryGrid categories={cats.slice(0, 8)} />
        </section>
      ) : null}

      {/* ------------------------------------------------------- the top rail */}

      {/* 🔴 65.8 — FEW RATINGS SAYS FEW RATINGS, in one line with two numbers. */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-[17px] font-bold text-navy-700">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
            {t("home.ratedHighest")}
          </h2>
          <p className="mt-0.5 text-[13px] text-navy-400">
            {best.length === 0
              ? t("home.ratedNone", { bar: RATING_BAR })
              : t("home.ratedSome", { count: best.length, bar: RATING_BAR })}
          </p>
        </div>
        {best.length > 0 ? (
          <ul className="space-y-2.5">
            {best.map((therapist) => (
              <li key={therapist.userId}>
                <TherapistCard therapist={therapist} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* ---------------------------------------------------------- sessions */}

      {/* 15.3 — their own sessions, through the one query whose select list is the 15.8 enforcement. */}
      <PatientSessionList
        sessions={sessions}
        zone={actor.timezone}
        /* 🔴 W2-P06: every card opens what it is waiting on. */
        doors={Object.fromEntries(
          (await sessionDoors(actor.personId)).map((row) => [row.sessionId, row.door]),
        )}
      />

      {/* 🔴 58.3 — the link to `/patient/sessions`, which nothing linked to before. */}
      {sessions.length > 0 ? (
        <Link href="/patient/sessions" className={`${ghostButton} w-full`}>
          <CalendarDays className="h-4 w-4" aria-hidden />
          {t("psessions.title")}
        </Link>
      ) : null}

      {/* ------------------------------------------------------- your record */}

      <Panel>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-600 text-white">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[16px] font-bold text-navy-700">{t("home.yourRecord")}</p>
              {person?.claimedAt ? (
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[12px] font-semibold text-brand-800">
                  {t("home.yours")}
                </span>
              ) : (
                <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-[12px] font-semibold text-navy-500">
                  {t("home.notClaimed")}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[14px] leading-relaxed text-navy-500">
              {attached === 0
                ? t("home.noFiles")
                : attached === 1
                  ? t("home.filesAttached", { count: attached })
                  : t("home.filesAttachedMany", { count: attached })}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
              <Link href="/patient/claim" className="text-[14px] font-semibold text-brand-700">
                {person?.claimedAt ? t("home.claimAnother") : t("home.haveRecords")}
              </Link>
              <Link href="/patient/profile" className="text-[14px] font-semibold text-brand-700">
                {t("home.openProfile")}
              </Link>
            </div>
          </div>
        </div>
      </Panel>

      {/* 26.5 / 26.1 / 26.9 — the things on this app that are unambiguously theirs. */}
      <div className="grid gap-2">
        <RowLink href="/patient/journal" icon={<NotebookPen className="h-5 w-5" aria-hidden />} label={t("home.journal")} />
        <RowLink href="/patient/summary" icon={<FileText className="h-5 w-5" aria-hidden />} label={t("home.summary")} />
        <RowLink href="/patient/consent" icon={<ShieldCheck className="h-5 w-5" aria-hidden />} label={t("home.whoCanRead")} />
        <RowLink href="/patient/record" icon={<Download className="h-5 w-5" aria-hidden />} label={t("home.getCopy")} />
      </div>
    </Screen>
  );
}
