import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Radio, Receipt, ShieldCheck, Wallet } from "lucide-react";

import { eq } from "drizzle-orm";

import { ChangeNumber } from "@/components/patient/change-number";
import { PatientSessionList } from "@/components/patient/session-list";
import { LanguageSetting } from "@/components/settings/language-setting";
import { EmailEditor } from "@/components/patient/email-editor";
import { IdentityEditor } from "@/components/patient/identity-editor";
import { Card } from "@/components/ui";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patientAccounts, people } from "@/lib/db/schema";
import { awaitingChangeCode, lockUntil } from "@/lib/data/phone-change";
import { localeTag } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";
import { patientSignOut } from "@/lib/patient-auth/actions";

import { savePatientLanguage } from "./actions";
import { requirePatient } from "@/lib/patient-auth/guard";
import { zoneLabel } from "@/lib/scheduling/tz";
import { getCountries } from "@/lib/settings";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(patient)/patient/account/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export const metadata: Metadata = { title: "You", robots: { index: false } };

/** 🔴 Ruling 8b: the "You" page is a profile, with editing under Settings. */
const TABS = [
  { key: "overview", label: "pyou.tabOverview" },
  { key: "sessions", label: "pyou.tabSessions" },
  { key: "billing", label: "pyou.tabBilling" },
  { key: "settings", label: "pyou.tabSettings" },
] as const;
type TabKey = (typeof TABS)[number]["key"];
export const dynamic = "force-dynamic";

/**
 * Who they are, and the doors out. PLAN.md 15.1's fifth tab.
 *
 * Deliberately small. §3d gives phone changes a 90-day discipline and a staff
 * queue (20.13–20.17), and sprint 20 puts the request *here* rather than
 * behind a support ticket: the patient starts it, a person checks it, and a
 * code to the new number finishes it. Everything else on this screen is either
 * a handle or a door to something that is genuinely self-service.
 */
export default async function PatientAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const actor = await requirePatient();
  const { tab } = await searchParams;
  const active: TabKey = TABS.some((entry) => entry.key === tab) ? (tab as TabKey) : "overview";

  const [account] = await db
    .select({
      phoneVerifiedAt: patientAccounts.phoneVerifiedAt,
      createdAt: patientAccounts.createdAt,
    })
    .from(patientAccounts)
    .where(eq(patientAccounts.id, actor.accountId))
    .limit(1);

  const [person] = await db
    .select({ avatarUrl: people.avatarUrl })
    .from(people)
    .where(eq(people.id, actor.personId))
    .limit(1);

  const countries = await getCountries();
  const locked = account ? lockUntil(account) : null;
  const { t, locale } = await getI18n();
  const tag = localeTag(locale);

  const [{ myBenefits }, { sessionDoors, sessionsForPatient }, { summariesForPerson }, { walletBalanceCents }, { savedLocale }] =
    await Promise.all([
      import("@/lib/data/enrolment"),
      import("@/lib/data/patient-view"),
      import("@/lib/data/summaries"),
      import("@/lib/billing/wallet"),
      import("@/lib/i18n/preference"),
    ]);
  const [benefits, sessionsList, doors, summaries, walletCents, chosen] = await Promise.all([
    myBenefits(actor.personId),
    sessionsForPatient(actor.personId),
    sessionDoors(actor.personId),
    summariesForPerson(actor.personId),
    walletBalanceCents(actor.personId),
    savedLocale({ personId: actor.personId }),
  ]);
  const doorOf = Object.fromEntries(doors.map((row) => [row.sessionId, row.door]));
  const benefit = benefits.find((b) => b.isPrimary) ?? benefits[0] ?? null;
  const now = Date.now();
  const next = sessionsList
    .filter((s) => !s.cancelled && (s.group === "today" || s.group === "upcoming"))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const past = sessionsList.filter((s) => s.group === "past_scheduled" || s.group === "past_instant");
  const latestSummary = summaries[0] ?? null;

  /* "in 12 minutes", "in 3 hours", "in 2 days", in the reader's language. */
  const relative = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  const startsIn = (at: Date) => {
    const minutes = Math.round((at.getTime() - now) / 60_000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, "hour");
    return relative.format(Math.round(hours / 24), "day");
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      {/* 🔴 Ruling 8b: who they are, and their employer benefit or the way to add one. */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white"
        >
          {(actor.firstName?.[0] ?? "").toUpperCase()}
          {(actor.lastName?.[0] ?? "").toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">
            {actor.firstName} {actor.lastName ?? ""}
          </h1>
          {benefit ? (
            <Link
              href="/patient/benefit"
              className={cn(
                "mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                benefit.pausedAt || benefit.state === "paused"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-emerald-50 text-emerald-800",
              )}
            >
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              {benefit.pausedAt || benefit.state === "paused"
                ? t("pyou.benefitPaused", { name: benefit.sponsorName })
                : t("pyou.benefitBadge", { name: benefit.sponsorName })}
            </Link>
          ) : (
            <Link href="/patient/benefit" className="mt-1 inline-block text-xs font-semibold text-slate-900 underline">
              {t("pyou.enrol")}
            </Link>
          )}
        </div>
      </div>

      <nav aria-label={t("pyou.tabSettings")}>
        <ul className="flex gap-1 rounded-2xl bg-slate-100 p-1">
          {TABS.map((entry) => (
            <li key={entry.key} className="flex-1">
              <Link
                href={`/patient/account?tab=${entry.key}`}
                aria-current={entry.key === active ? "page" : undefined}
                className={cn(
                  "block rounded-xl py-2 text-center text-xs font-semibold",
                  entry.key === active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600",
                )}
              >
                {t(entry.label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {active === "overview" ? (
        <>
          {/* Live now, starting soon, and what is booked after. */}
          <Card className="divide-y divide-slate-100 p-0">
            <p className="px-4 pt-3.5 pb-2 text-sm font-semibold text-slate-900">{t("psessions.upcoming")}</p>
            {next.length === 0 ? (
              <div className="px-4 py-3.5 text-sm text-slate-600">
                {t("pyou.nothingNext")}{" "}
                <Link href="/patient/browse" className="font-semibold text-slate-900 underline">
                  {t("pyou.book")}
                </Link>
              </div>
            ) : (
              next.slice(0, 5).map((session) => {
                const door = doorOf[session.id] ?? null;
                const live = door?.kind === "join" && session.at.getTime() <= now;
                return (
                  <div key={session.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{session.therapistName}</p>
                      <p className={cn("text-xs", live ? "font-semibold text-rose-600" : "text-slate-500")}>
                        {live ? (
                          <span className="inline-flex items-center gap-1">
                            <Radio className="h-3.5 w-3.5" aria-hidden />
                            {t("pyou.liveNow")}
                          </span>
                        ) : (
                          startsIn(session.at)
                        )}
                      </p>
                    </div>
                    {door ? (
                      <Link
                        href={door.href}
                        className="shrink-0 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {door.kind === "join" ? t("psessions.join") : t("pyou.open")}
                      </Link>
                    ) : null}
                  </div>
                );
              })
            )}
          </Card>

          {/* 🔴 Ruling 7: shown only when there is something in it, never as zero. */}
          {walletCents > 0 ? (
            <Card className="flex items-center gap-3 p-4">
              <Wallet className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{t("pyou.wallet")}</p>
                <p className="text-xs text-slate-500">{t("pyou.walletBody")}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                <Money cents={walletCents} />
              </p>
            </Card>
          ) : null}

          <Card className="p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{t("pyou.summary")}</p>
              <Link href="/patient/summary" className="text-xs font-semibold text-slate-900 underline">
                {t("pyou.readAll")}
              </Link>
            </div>
            <p className="mt-2 line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
              {latestSummary ? latestSummary.body : t("pyou.summaryNone")}
            </p>
          </Card>
        </>
      ) : null}

      {active === "sessions" ? (
        past.length === 0 ? (
          <Card className="p-4 text-sm text-slate-600">{t("pyou.noPast")}</Card>
        ) : (
          <PatientSessionList sessions={past} zone={actor.timezone} doors={doorOf} />
        )
      ) : null}

      {active === "billing" ? (
        <>
          {walletCents > 0 ? (
            <Card className="flex items-center justify-between gap-3 p-4">
              <p className="text-sm font-semibold text-slate-900">{t("pyou.wallet")}</p>
              <p className="text-sm font-semibold tabular-nums text-slate-900"><Money cents={walletCents} /></p>
            </Card>
          ) : null}
          <Card className="divide-y divide-slate-100 p-0">
            {sessionsList
              .filter((s) => s.priceCents > 0 && !s.cancelled)
              .slice(0, 8)
              .map((session) => (
                <div key={session.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 truncate text-slate-900">{session.therapistName}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {session.paymentStatus === "paid" ? t("pyou.paid") : t("pyou.owed")}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-900">
                    <Money cents={session.priceCents} currency={session.priceCurrency} />
                  </span>
                </div>
              ))}
          </Card>
          <Link href="/patient/billing">
            <Card className="flex items-center gap-3 p-4 active:bg-slate-50">
              <Receipt className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              <span className="block text-sm font-semibold text-slate-900">{t("pyou.allBilling")}</span>
            </Card>
          </Link>
        </>
      ) : null}

      {active === "settings" ? (
      <>
      <LanguageSetting action={savePatientLanguage} saved={chosen} />

      {/* 25.7 / C115 — name and picture, both theirs. */}
      <IdentityEditor
        personId={actor.personId}
        firstName={actor.firstName}
        lastName={actor.lastName ?? null}
        hasPhoto={Boolean(person?.avatarUrl)}
      />

      <ChangeNumber
        current={actor.phone}
        countries={countries.map((c) => ({ code: c.code, name: c.name }))}
        lockedUntilLabel={locked ? locked.toISOString().slice(0, 10) : null}
        awaitingCode={await awaitingChangeCode(actor.accountId)}
      />

      <Card className="p-4">
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">{t("paccount.phone")}</dt>
            <dd className="font-mono text-slate-800">{actor.phone ?? "-"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">{t("paccount.email")}</dt>
            {/*
              13R.6 — an account may legitimately have no address. Saying so is
              better than an empty line, and the sentence names what adding one
              buys rather than nagging.
            */}
            <dd className="truncate text-slate-800">
              {actor.email ?? t("paccount.notAdded")}
              {actor.email && !actor.emailVerified ? ` · ${t("paccount.emailUnconfirmed")}` : ""}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">{t("paccount.timezone")}</dt>
            <dd className="text-slate-800">
              {actor.timezone ? zoneLabel(actor.timezone) : t("paccount.notSet")}
            </dd>
          </div>
        </dl>

        {/*
          🔴 W2-P03: the sentence above promised an address and nothing could
          add one. Adding it, or proving the one given at signup, is here.
        */}
        <EmailEditor current={actor.email} verified={actor.emailVerified} />
      </Card>

      <Link href="/patient/consent">
        <Card className="flex items-center gap-3 p-4 active:bg-slate-50">
          <ShieldCheck className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">{t("paccount.whoCanSee")}</span>
            <span className="block text-xs text-slate-500">
              {t("paccount.whoCanSeeBody")}
            </span>
          </span>
        </Card>
      </Link>

      {/*
        🔴 W2-P09: four pages that existed and that nothing linked to. Each is
        named by its own page title, so the words are ones the patient meets
        again when they arrive.
      */}
      <Card className="divide-y divide-slate-100 p-0">
        {(
          [
            ["/patient/notices", "pnotice.title"],
            ["/patient/messages", "checkin.settingsTitle"],
            ["/patient/benefit", "benefit.title"],
            ["/patient/residency", "residency.title"],
          ] as const
        ).map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="block px-4 py-3.5 text-sm font-semibold text-slate-900 active:bg-slate-50"
          >
            {t(label)}
          </Link>
        ))}
      </Card>

      <Link href="/patient/profile">
        <Card className="p-4 active:bg-slate-50">
          <span className="block text-sm font-semibold text-slate-900">{t("paccount.ownDocuments")}</span>
          <span className="block text-xs text-slate-500">
            {t("paccount.ownDocumentsBody")}
          </span>
        </Card>
      </Link>

      {/*
        🔴 §6 — a patient never sees a transcript or a clinical note. There is
        deliberately no link here to one, and `lib/data/patient-view.ts` is
        what makes that structural rather than a matter of which links exist.
      */}

      {/*
        🔴 58.1 — THE DOOR OUT, which this page's own header promised and which
        did not exist.

        `patientSignOut` was written, exported, and called by nothing. The
        string `paccount.signOut` was written too, in both languages, and
        rendered by nothing. A patient on a shared or borrowed phone could not
        sign out of their own medical record, and no test, type or verifier in
        this repository could see that, because every one of them asks whether
        code is correct rather than whether a person can reach it.

        `verify:reachable` found it on its first run. A plain form rather than a
        client component: no JavaScript, which on the phones this product is
        actually used on is not a hypothetical.
      */}
      <form action={patientSignOut}>
        <button
          type="submit"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-start text-sm font-semibold text-slate-900 active:bg-slate-50"
        >
          {t("paccount.signOut")}
        </button>
      </form>
      </>
      ) : null}
    </main>
  );
}
