import type { Metadata } from "next";
import Link from "next/link";

import { Card, PageHeader } from "@/components/clinician/kit";
import { requireUser } from "@/lib/auth/guard";
import { recentNotifications } from "@/lib/data/notifications";
import { getI18n } from "@/lib/i18n/server";
import { cn, formatDateTime } from "@/lib/utils";

import { readAll } from "./actions";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.notifications"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-T06: every notice we wrote for this clinician, of every kind.
 *
 * The dashboard fetched unread rows and kept the crisis ones, so an export
 * ready, a questionnaire back or a history request answered was written,
 * fetched and thrown away. This is where they are read. Crisis rows stay on
 * the dashboard as well, because that is where somebody looks first.
 *
 * Reading the page does not mark anything read on its own: a crisis row is
 * cleared by opening the session it points at (`markSessionNotificationsRead`),
 * and the button below clears the rest when the clinician says so.
 */
export default async function NotificationsPage() {
  const { t, locale } = await getI18n();
  const actor = await requireUser();

  const rows = await recentNotifications(actor);
  const unread = rows.some((row) => !row.readAt);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("tw2.notifications")} />

      <div className="space-y-3 px-4 pb-10 sm:px-6">
        {unread ? (
          <form action={readAll}>
            <button
              type="submit"
              className="tap-target h-9 rounded-xl border border-navy-100 bg-white px-3 text-xs font-semibold text-navy-600 hover:bg-navy-50"
            >
              {t("tw2.markAllRead")}
            </button>
          </form>
        ) : null}

        {rows.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-navy-400">{t("portal.dash.empty")}</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-navy-100/70">
              {rows.map((row) => (
                <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      row.readAt ? "bg-transparent" : row.kind === "crisis" ? "bg-red-500" : "bg-brand-500",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm text-navy-700",
                        row.readAt ? "font-medium" : "font-semibold",
                      )}
                    >
                      {row.title}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-navy-400">{row.body}</p>
                    <p className="mt-1 text-xs text-navy-400">
                      {formatDateTime(row.createdAt, actor.timezone, locale)}
                    </p>
                  </div>
                  {row.actionUrl ? (
                    <Link
                      href={row.actionUrl}
                      className="shrink-0 text-sm font-semibold text-brand-700"
                    >
                      {t("tw2.open")}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
