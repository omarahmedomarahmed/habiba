import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";

import { Avatar, Card, EmptyState, PageHeader, buttonClass } from "@/components/clinician/kit";
import { requireUser } from "@/lib/auth/guard";
import {
  formerSessions,
  listSessionsPage,
  sessionHref,
  type SessionListItem,
  type SessionListWhen,
} from "@/lib/data/sessions";
import { fullName, relativeDay } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { SessionBadge } from "@/components/sessions/status-badge";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.sessions"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 T15: UPCOMING AND PAST, EACH PAGED ON ITS OWN.
 *
 * This was one list of the fifty most recently created sessions, so a clinician
 * with a full diary lost next week's appointments off the bottom of it. Now it is
 * two lists from `listSessionsPage`, each with its own page in the URL
 * (`?upcoming=1&past=3`), so paging through last year does not move next week.
 *
 * A search parameter rather than state: a page number in the URL survives a
 * refresh and the back button, and the page stays a server component.
 */
function pageFrom(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ upcoming?: string; past?: string }>;
}) {
  const { locale, t } = await getI18n();
  const actor = await requireUser();
  const params = await searchParams;

  const pages: Record<SessionListWhen, number> = {
    upcoming: pageFrom(params.upcoming),
    past: pageFrom(params.past),
  };

  const [upcoming, past, former] = await Promise.all([
    listSessionsPage(actor, { when: "upcoming", page: pages.upcoming }),
    listSessionsPage(actor, { when: "past", page: pages.past }),
    formerSessions(actor),
  ]);

  /*
   * 🔴 W2-T05: the sessions they ran at a practice that has removed them,
   * grouped by practice. Read only and not links: the notes are the
   * practice's (C266), and the list is what they keep sight of.
   */
  const byPractice = new Map<string, typeof former>();
  for (const row of former) {
    byPractice.set(row.practice, [...(byPractice.get(row.practice) ?? []), row]);
  }

  /* The same URL with one list's page moved, and the other's kept. */
  const hrefFor = (when: SessionListWhen, page: number) => {
    const next = { ...pages, [when]: page };
    const query = (Object.keys(next) as SessionListWhen[])
      .filter((key) => next[key] > 0)
      .map((key) => `${key}=${next[key]}`)
      .join("&");
    return query ? `/sessions?${query}` : "/sessions";
  };

  const row = (session: SessionListItem) => {
    const label =
      fullName(session.patientFirstName, session.patientLastName, "") ||
      session.guestName ||
      t("portal.unnamedPatient");
    const now = session.status === "in_progress";

    return (
      <li key={session.id}>
        <Link
          href={sessionHref(session)}
          className={
            now
              ? "flex items-center gap-3 rounded-2xl bg-navy-900 p-3 text-white shadow-[0_20px_40px_-20px_rgba(46,196,182,0.7)]"
              : "flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-navy-50"
          }
        >
          <Avatar name={label} size={44} />
          <div className="min-w-0 flex-1">
            <p className={now ? "truncate text-[15px] font-bold text-white" : "truncate text-[15px] font-bold text-navy-700"}>{label}</p>
            <p className={now ? "mt-0.5 text-[13px] text-white/75" : "mt-0.5 text-[13px] text-navy-400"}>
              {relativeDay(session.endedAt ?? session.scheduledAt ?? session.createdAt, actor.timezone, locale, t)}
              {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
              {session.modality === "video" ? " · Video" : ""}
            </p>
          </div>

          <SessionBadge status={session.status} noteStatus={session.noteStatus} />
          <ChevronRight className={now ? "h-4 w-4 shrink-0 text-white/60 rtl:rotate-180" : "h-4 w-4 shrink-0 text-navy-300 rtl:rotate-180"} aria-hidden />
        </Link>
      </li>
    );
  };

  const section = (
    when: SessionListWhen,
    title: string,
    list: { items: SessionListItem[]; hasMore: boolean },
  ) => {
    const page = pages[when];
    if (list.items.length === 0 && page === 0) return null;

    return (
      <section aria-labelledby={`sessions-${when}`}>
        <Card className="p-3 sm:p-4">
          <h2 id={`sessions-${when}`} className="flex items-center gap-2 px-2 pt-1 pb-2 text-[17px] font-bold text-navy-700">
            <span
              aria-hidden
              className={when === "upcoming" ? "h-2.5 w-2.5 rounded-full bg-brand-500" : "h-2.5 w-2.5 rounded-full bg-navy-200"}
            />
            {title}
          </h2>
          <ul className="space-y-1">{list.items.map(row)}</ul>
          {page > 0 || list.hasMore ? (
            <nav className="mt-2 flex items-center justify-between gap-3 border-t border-navy-100/70 px-2 pt-2 text-sm font-semibold">
              {page > 0 ? (
                <Link href={hrefFor(when, page - 1)} className="tap-target inline-flex items-center text-brand-700">
                  {t("portal.sessions.prevPage")}
                </Link>
              ) : (
                <span />
              )}
              {list.hasMore ? (
                <Link href={hrefFor(when, page + 1)} className="tap-target inline-flex items-center text-brand-700">
                  {t("portal.sessions.nextPage")}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </Card>
      </section>
    );
  };

  const empty =
    upcoming.items.length === 0 && past.items.length === 0 && pages.upcoming === 0 && pages.past === 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t("portal.sessions.title")}
        action={
          <Link href="/sessions/new" className={`${buttonClass("primary", "md")} hidden lg:inline-flex`}>
            <Plus className="h-4 w-4" aria-hidden /> {t("portal.new")}
          </Link>
        }
      />

      <div className="space-y-5 px-4 sm:px-6">
        {empty ? (
          <Card>
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" aria-hidden />}
              title={t("portal.sessions.none")}
              body={t("portal.sessions.noneBody")}
              action={
                <Link href="/sessions/new" className={buttonClass("primary", "md")}>
                  {t("portal.sessions.start")}
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            {section("upcoming", t("portal.sessions.upcoming"), upcoming)}
            {section("past", t("portal.sessions.past"), past)}
          </>
        )}

        {[...byPractice].map(([practice, rows]) => (
          <section key={practice} className="pt-3">
            <h2 className="text-[17px] font-bold text-navy-700">
              {t("tw2.formerTitle", { name: practice })}
            </h2>
            <p className="mt-0.5 text-sm text-navy-400">{t("tw2.formerBody")}</p>
            <ul className="mt-3 divide-y divide-navy-100/70 rounded-3xl border border-navy-100/80 bg-white">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-700">
                    {fullName(row.patientFirstName, row.patientLastName, "") ||
                      row.guestName ||
                      t("portal.unnamedPatient")}
                  </span>
                  <span className="text-xs text-navy-400">
                    {relativeDay(row.scheduledAt ?? row.createdAt, actor.timezone, locale, t)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
