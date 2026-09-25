import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";

import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
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

    return (
      <li key={session.id}>
        <Link
          href={sessionHref(session)}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 active:bg-slate-50"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-slate-900">{label}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {relativeDay(session.endedAt ?? session.scheduledAt ?? session.createdAt, actor.timezone, locale, t)}
              {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
              {session.modality === "video" ? " · Video" : ""}
            </p>
          </div>

          <SessionBadge status={session.status} noteStatus={session.noteStatus} />
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
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
      <section aria-labelledby={`sessions-${when}`} className="space-y-2">
        <h2 id={`sessions-${when}`} className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
        <ul className="space-y-2">{list.items.map(row)}</ul>
        {page > 0 || list.hasMore ? (
          <nav className="flex items-center justify-between gap-3 px-1 text-xs font-medium">
            {page > 0 ? (
              <Link href={hrefFor(when, page - 1)} className="tap-target text-brand-700">
                {t("portal.sessions.prevPage")}
              </Link>
            ) : (
              <span />
            )}
            {list.hasMore ? (
              <Link href={hrefFor(when, page + 1)} className="tap-target text-brand-700">
                {t("portal.sessions.nextPage")}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    );
  };

  const empty =
    upcoming.items.length === 0 && past.items.length === 0 && pages.upcoming === 0 && pages.past === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("portal.sessions.title")}
        action={
          <Link href="/sessions/new" className="hidden lg:block">
            <Button size="sm">
              <Plus className="h-4 w-4" aria-hidden /> {t("portal.new")}
            </Button>
          </Link>
        }
      />

      <div className="space-y-6 px-4 pb-10 sm:px-6">
        {empty ? (
          <Card>
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" aria-hidden />}
              title={t("portal.sessions.none")}
              body={t("portal.sessions.noneBody")}
              action={
                <Link href="/sessions/new">
                  <Button variant="primary">{t("portal.sessions.start")}</Button>
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
          <section key={practice} className="mt-8">
            <h2 className="text-sm font-semibold text-slate-900">
              {t("tw2.formerTitle", { name: practice })}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{t("tw2.formerBody")}</p>
            <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                    {fullName(row.patientFirstName, row.patientLastName, "") ||
                      row.guestName ||
                      t("portal.unnamedPatient")}
                  </span>
                  <span className="text-xs text-slate-500">
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
