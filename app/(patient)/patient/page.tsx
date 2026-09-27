import type { Metadata } from "next";
import Link from "next/link";

import { CalendarClock, ChevronRight, Globe2, Search, Star } from "lucide-react";
import { eq } from "drizzle-orm";

import { Logo } from "@/components/brand/logo";
import { Face, Glow, Hero, Panel, primaryButton, Screen, SectionHead } from "@/components/patient/kit";
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
import { sessionsForPatient } from "@/lib/data/patient-view";
import { localeTag } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { people } from "@/lib/db/schema";
import { formatWhen, resolveZone } from "@/lib/scheduling/tz";

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
 * with, where to start, what is waiting on you, what is next, and who is here.
 *
 * ## 🔴 Founder, 26 Sep: home things only
 *
 * The record card and the rows under it (journal, summary, who can read,
 * a copy of the record) were the patient's own things at the bottom of the
 * home screen, and they belong to their profile, so they moved to the You
 * tab's overview. The full session list moved off too: the Sessions tab is
 * that list, and home keeps one card for the next session. The areas grid is
 * three across and sits right under the hero, which carries the logo.
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

  const [waiting, next, openAssessments, sessions, cats, best, explore, liveNow, person, i18n] =
    await Promise.all([
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
      // 15.3 — their own sessions, through the one query whose select list is
      // the 15.8 enforcement. Home reads it for the next one only.
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
      getI18n(),
    ]);

  const pending = waiting.length;
  const { t, locale } = i18n;

  /* The session under way, else the soonest one ahead. The orb opens the same one. */
  const upcoming = sessions
    .filter((s) => s.live || ((s.group === "today" || s.group === "upcoming") && !s.cancelled))
    .sort((a, b) => Number(b.live) - Number(a.live) || a.at.getTime() - b.at.getTime())[0];
  const relative = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: "auto" });
  const startsIn = (at: Date) => {
    const minutes = Math.max(1, Math.round((at.getTime() - Date.now()) / 60_000));
    if (minutes < 60) return relative.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (hours < 48) return relative.format(hours, "hour");
    return relative.format(Math.round(hours / 24), "day");
  };

  return (
    <Screen>
      {/* ------------------------------------------------------ the hero */}

      {/*
        The sample's hero: our mark, who you are, the one thing to search
        with, and who is free now, on the night-navy ground with the teal
        light behind it.

        🔴 Founder, 26 Sep: the 24T mark sits at the top, the same `Logo` the
        site and the portal headers draw, in white. The search moved inside
        the hero so the areas grid can come straight after it.

        🔴 65.7 / 65.8 — THE LIVE CARD COUNTS. It reads `radarCount()`, the
        count C285 fixed to mean the people this product would actually show.
        Above zero it is the number, live. At zero it says so and points at
        the hours that are bookable, which is the thing that is true instead.
      */}
      <Hero className="pt-4 pb-5">
        {/* The language corner is fixed at the top end; the mark takes the start. */}
        <div className="flex h-10 items-center">
          <Logo ink="white" height={22} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Link href="/patient/account" aria-label={t("home.yourAccount")} className="shrink-0">
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

        <Link
          href="/patient/browse"
          className="mt-4 flex h-12 items-center gap-2.5 rounded-2xl bg-white px-4 text-[15px] text-navy-400 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] transition-shadow hover:shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)]"
        >
          <Search className="h-[18px] w-[18px] shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{t("home.searchPlaceholder")}</span>
        </Link>

        {liveNow > 0 ? (
          <Link
            href="/patient/radar"
            className="mt-3 flex items-center justify-between gap-3 rounded-3xl bg-white/[0.07] p-3.5 ring-1 ring-white/12 backdrop-blur transition-colors hover:bg-white/10"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-10 min-w-10 items-center justify-center rounded-full bg-white/10 px-2 text-[15px] font-bold tabular-nums ring-1 ring-white/15">
                {liveNow}
              </span>
              <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-brand-300">
                <span className="live-dot h-2.5 w-2.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                <span className="line-clamp-2 leading-tight">
                  {liveNow === 1 ? t("home.liveOne") : t("home.liveMany", { count: liveNow })}
                </span>
              </span>
            </span>
            <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-brand-500 px-3.5 text-[14px] font-semibold text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)]">
              <Globe2 className="h-4 w-4" aria-hidden />
              {t("home.findNow")}
            </span>
          </Link>
        ) : (
          <Link
            href="/patient/browse"
            className="mt-3 flex items-center gap-3 rounded-3xl bg-white/[0.07] p-3.5 ring-1 ring-white/12 transition-colors hover:bg-white/10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <Globe2 className="h-5 w-5 text-white/80" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">{t("home.liveNone")}</span>
              <span className="block text-[13px] text-white/70">{t("home.liveNoneBody")}</span>
            </span>
          </Link>
        )}
      </Hero>

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

      {/* --------------------------------------------------------- categories */}

      {/*
        🔴 65.7 / 65.9 — an icon grid over the taxonomy; hidden when empty.
        Founder, 26 Sep: three across on a phone, straight under the hero.
      */}
      {cats.length > 0 ? (
        <section className="-mt-1 space-y-2.5">
          <SectionHead title={t("home.areas")} href="/patient/browse" action={t("home.exploreAll")} />
          <CategoryGrid categories={cats.slice(0, 9)} />
        </section>
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

      {/* ------------------------------------------------ the next session */}

      {/*
        🔴 Founder, 26 Sep: one card, the session under way or the next one,
        opening its own page. The whole list is the Sessions tab.
      */}
      {upcoming ? (
        <section className="space-y-2.5">
          <SectionHead title={t("home.nextSession")} href="/patient/sessions" action={t("psessions.title")} />
          <Link
            href={`/patient/sessions/${upcoming.id}`}
            className="flex items-center gap-3 rounded-3xl border border-navy-100/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)] transition-colors hover:bg-navy-50"
          >
            <Face name={upcoming.therapistName} size={44} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[15px] font-bold text-navy-700">{upcoming.therapistName}</span>
                <span
                  className={
                    upcoming.live
                      ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[12px] font-semibold text-red-700"
                      : "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-[12px] font-semibold text-brand-800"
                  }
                >
                  {upcoming.live ? (
                    <span className="live-dot h-2 w-2 rounded-full bg-red-500" aria-hidden />
                  ) : (
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {upcoming.live ? t("psessions.now") : startsIn(upcoming.at)}
                </span>
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-navy-400">
                {formatWhen(upcoming.at, resolveZone(actor.timezone), locale)}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-navy-300 rtl:rotate-180" aria-hidden />
          </Link>
        </section>
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
    </Screen>
  );
}
