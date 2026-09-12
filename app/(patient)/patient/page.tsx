import type { Metadata } from "next";
import Link from "next/link";

import { Download, FileText, Globe2, NotebookPen, Search, ShieldCheck, Star } from "lucide-react";
import { eq, sql } from "drizzle-orm";

import { Badge, Card } from "@/components/ui";
import { PatientAvatar } from "@/components/patient/avatar";
import { TherapistCard } from "@/components/patient/therapist-card";
import { categories, topRated } from "@/lib/data/discover";
import { pendingRequestsFor } from "@/lib/data/grants";
import { openAssignmentsForPerson } from "@/lib/data/assessments";
import { nextStepFor } from "@/lib/data/homework";
import { sessionsForPatient } from "@/lib/data/patient-view";
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


export const metadata: Metadata = { title: "Your sessions", robots: { index: false } };
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

  const [waiting, next, openAssessments, sessions, cats, best, person, attached, i18n] =
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
    // 15.3 — their own sessions, in four groups, through the one query whose
    // select list is the 15.8 enforcement.
    sessionsForPatient(actor.personId),
    categories(),
    topRated(4),
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
        <Card className="border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-semibold text-teal-900">{t("home.claimedTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed text-teal-900/90">
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
        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        {t("home.searchPlaceholder")}
      </Link>

      {/* ------------------------------------------------------------ the globe */}

      <Link
        href="/patient/radar"
        className="flex items-center gap-3 rounded-2xl bg-brand-500 px-4 py-3.5 text-white shadow-sm active:scale-[0.99]"
      >
        <Globe2 className="h-6 w-6 shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{t("home.findNow")}</span>
          <span className="block text-xs text-white/80">
            {t("home.findNowBody")}
          </span>
        </span>
      </Link>

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
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">
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
            className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:underline"
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
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">
            {t("home.beforeNext")}
          </p>
          <p className="mt-1.5 text-base leading-relaxed font-medium text-slate-900">
            {t("passess.title")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("passess.body")}</p>
          <Link
            href="/patient/assessments"
            className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:underline"
          >
            {t("passess.start")}
          </Link>
        </Card>
      ) : null}

      {/* --------------------------------------------------------- categories */}

      {cats.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-slate-900">{t("home.areas")}</h2>
          <ul className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
            {cats.slice(0, 8).map((category) => (
              <li key={category.code} className="shrink-0">
                <Link
                  href={`/patient/browse?q=${encodeURIComponent(category.code)}`}
                  className="block rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700"
                >
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------------- the top rail */}

      {best.length > 0 ? (
        <section>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
            {t("home.ratedHighest")}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {t("home.ratedHighestBody")}
          </p>
          <ul className="mt-2.5 space-y-2.5">
            {best.map((therapist) => (
              <li key={therapist.userId}>
                <TherapistCard therapist={therapist} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- sessions */}

      <PatientSessionList
        sessions={sessions}
        zone={actor.timezone}
      />

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
          <Link href="/patient/claim" className="text-sm font-semibold text-brand-600">
            {person?.claimedAt ? t("home.claimAnother") : t("home.haveRecords")}
          </Link>
          <Link href="/patient/profile" className="text-sm font-semibold text-brand-600">
            {t("home.openProfile")}
          </Link>
        </div>
      </Card>

      {/* 26.5 / 26.1 — the two things on this app that are unambiguously theirs. */}
      <Link
        href="/patient/journal"
        className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
      >
        <NotebookPen className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        {t("home.journal")}
      </Link>

      <Link
        href="/patient/summary"
        className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
      >
        <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        {t("home.summary")}
      </Link>

      <Link
        href="/patient/consent"
        className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        {t("home.whoCanRead")}
      </Link>

      {/* 26.9 — the whole thing, in one document they can keep. */}
      <Link
        href="/patient/record"
        className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
      >
        <Download className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        {t("home.getCopy")}
      </Link>
    </main>
  );
}
