import type { Metadata } from "next";
import Link from "next/link";

import { PatientSessionList } from "@/components/patient/session-list";
import { PatientBack } from "@/components/patient/back";
import { sessionDoors, sessionsForPatient } from "@/lib/data/patient-view";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n/messages";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourSessions"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * Every session, in three views. PLAN.md 25.8.
 *
 * ## Why the sub-tabs are links and not state
 *
 * `?tab=` rather than `useState`, so the back button works, so a tab survives
 * a reload, and so somebody can be sent to their upcoming list by a link. It
 * also means this page renders identically with JavaScript switched off, which
 * on the phones this product is actually used on is not a hypothetical.
 *
 * ## 🔴 What is still not here
 *
 * No note, no transcript, no diagnosis. The rows come from
 * `sessionsForPatient`, whose select list is the enforcement (15.8), and the
 * only clinical text is the `brief` a clinician wrote *to* the patient and
 * signed.
 */
const TABS = [
  { key: "all", label: "psessions.all" },
  { key: "upcoming", label: "psessions.upcoming" },
  { key: "past", label: "psessions.past" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function PatientSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const actor = await requirePatient();
  const { t } = await getI18n();

  const { tab } = await searchParams;
  const active: TabKey = TABS.some((t) => t.key === tab) ? (tab as TabKey) : "all";

  const [sessions, doors] = await Promise.all([
    sessionsForPatient(actor.personId),
    sessionDoors(actor.personId),
  ]);

  const shown = sessions.filter((session) => {
    if (active === "upcoming") return session.group === "today" || session.group === "upcoming";
    if (active === "past") {
      return session.group === "past_scheduled" || session.group === "past_instant";
    }
    return true;
  });

  return (
    <main className="mx-auto flex min-h-dvh flex-col w-full max-w-lg gap-4 px-5 pt-4 pb-10">
      <PatientBack />

      <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">{t("psessions.title")}</h1>

      <nav aria-label={t("psessions.which")}>
        <ul className="flex gap-1.5 rounded-full bg-white p-1 ring-1 ring-navy-100">
          {TABS.map((entry) => (
            <li key={entry.key} className="flex-1">
              <Link
                href={`/patient/sessions?tab=${entry.key}`}
                aria-current={entry.key === active ? "page" : undefined}
                className={cn(
                  "block rounded-full py-2 text-center text-sm font-semibold",
                  entry.key === active ? "bg-navy-600 text-white shadow-sm" : "text-navy-500 hover:text-navy-700",
                )}
              >
                {t(entry.label as MessageKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <PatientSessionList
        sessions={shown}
        zone={actor.timezone}
        doors={Object.fromEntries(doors.map((row) => [row.sessionId, row.door]))}
      />
    </main>
  );
}
