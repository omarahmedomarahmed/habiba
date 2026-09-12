import type { Metadata } from "next";
import Link from "next/link";

import { PatientBack } from "@/components/patient/back";
import { Card } from "@/components/ui";
import {
  historyForPerson,
  instrumentNames,
  openAssignmentsForPerson,
} from "@/lib/data/assessments";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "A few questions", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * What is waiting to be answered, and what they answered before. PLAN.md 56.3,
 * 56.6, 56.9.
 *
 * ## 🔴 The whole patient-facing reading of a score is on this page
 *
 * And it is a number and a date. No band, no label, no arrow, no colour, no
 * "higher than last time". C113 rules that a machine never tells a person what
 * is wrong with them, and "Moderately severe" beside a number on a phone at
 * eleven at night is exactly that sentence with arithmetic in front of it.
 *
 * The band is not filtered out here. `historyForPerson` never selects one, so
 * there is nothing on this page to render wrongly — the same construction as
 * `openStepsFor` in the homework page, and for the same reason.
 *
 * Person-scoped rather than patient-scoped: somebody seeing two clinicians has
 * two `patients` rows and one set of their own answers.
 */
export default async function AssessmentsPage() {
  const actor = await requirePatient();
  const { t, locale } = await getI18n();

  const [open, history] = await Promise.all([
    openAssignmentsForPerson(actor.personId),
    historyForPerson(actor.personId),
  ]);

  const names = await instrumentNames([
    ...new Set([...open, ...history].map((row) => row.instrumentId)),
  ]);

  const nameOf = (instrumentId: string) => {
    const name = names.get(instrumentId);
    return name?.[locale] ?? name?.en ?? "";
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-1">
        <PatientBack />
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("passess.title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("passess.body")}</p>
      </div>

      {open.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">{t("passess.none")}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("passess.noneBody")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {open.map((assignment) => (
            <Card key={assignment.id} className="border border-brand-200 p-4">
              <p className="text-base leading-relaxed font-medium text-slate-900">
                {nameOf(assignment.instrumentId)}
              </p>
              <Link
                href={`/patient/assessments/${assignment.id}`}
                className="tap-target mt-3 inline-flex h-11 items-center rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white hover:bg-teal-600"
              >
                {t("passess.start")}
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* ------------------------------------------------ 56.9 · their own trend -- */}

      <div className="mt-2">
        <h2 className="text-sm font-semibold text-slate-900">{t("passess.historyTitle")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{t("passess.historyBody")}</p>
      </div>

      {history.length === 0 ? (
        <p className="text-sm leading-relaxed text-slate-600">{t("passess.historyNone")}</p>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <Card key={entry.id} className="flex items-baseline justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {nameOf(entry.instrumentId)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {/*
                    37L.9 / C84 — through `formatDate`, in the reader's own
                    zone and their own locale. An `Intl.DateTimeFormat` built
                    here reads the runtime's zone, which is Vercel's, and the
                    date beside somebody's score would be the wrong day either
                    side of midnight.
                  */}
                  {formatDate(entry.completedAt, actor.timezone, locale)}
                </p>
              </div>
              {/*
                🔴 A number, in the same weight as every other number on the
                page. Not large, not coloured, not next to an arrow. The
                moment it is styled by its value it has become a verdict.
              */}
              <div className="text-end">
                <p className="text-xs text-slate-500">{t("passess.scoreLabel")}</p>
                <p className="text-base font-semibold text-slate-900">{entry.score}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
