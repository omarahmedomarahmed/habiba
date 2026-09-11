import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PatientSessionList } from "@/components/patient/session-list";
import { sessionsForPatient } from "@/lib/data/patient-view";
import { localeTag } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Your sessions", robots: { index: false } };
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
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function PatientSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const actor = await requirePatient();

  const { tab } = await searchParams;
  const active: TabKey = TABS.some((t) => t.key === tab) ? (tab as TabKey) : "all";

  const [sessions, i18n] = await Promise.all([sessionsForPatient(actor.personId), getI18n()]);

  const shown = sessions.filter((session) => {
    if (active === "upcoming") return session.group === "today" || session.group === "upcoming";
    if (active === "past") {
      return session.group === "past_scheduled" || session.group === "past_instant";
    }
    return true;
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <Link
        href="/patient"
        className="tap-target -ms-2 flex w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Link>

      <h1 className="text-xl font-bold tracking-tight text-slate-900">Your sessions</h1>

      <nav aria-label="Which sessions">
        <ul className="flex gap-1.5 rounded-2xl bg-slate-100 p-1">
          {TABS.map((entry) => (
            <li key={entry.key} className="flex-1">
              <Link
                href={`/patient/sessions?tab=${entry.key}`}
                aria-current={entry.key === active ? "page" : undefined}
                className={cn(
                  "block rounded-xl py-2 text-center text-sm font-semibold",
                  entry.key === active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
                )}
              >
                {entry.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <PatientSessionList
        sessions={shown}
        zone={actor.timezone}
        locale={localeTag(i18n.locale)}
      />
    </main>
  );
}
