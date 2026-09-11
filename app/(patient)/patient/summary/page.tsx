import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Card } from "@/components/ui";
import { summariesForPerson } from "@/lib/data/summaries";
import { requirePatient } from "@/lib/patient-auth/guard";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Your clinical summary", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The clinical summary tab. PLAN.md 25.10, 26.1, 26.2, C111.
 *
 * ## 🔴 Every version, with its author, forever
 *
 * Not "the latest summary". Therapist A wrote version 1 and therapist B wrote
 * version 2, and both are here with the names on them, because a record that
 * shows only the most recent opinion hides the fact that there was an earlier
 * one and who held it. That is the difference between a record and a status.
 *
 * 26.2: there is no access check on this page beyond being the person it is
 * about. A clinician whose grant was revoked does not un-write what somebody
 * already read, and a product that could retract a version could be made to.
 *
 * ## What is deliberately not here
 *
 * No diagnosis section, no risk language, no impressions. Those are the
 * clinician's document. `summaryProblem` refuses copy that reads like one
 * before it can ever be published, so this page does not have to filter.
 */
export default async function PatientSummaryPage() {
  const actor = await requirePatient();
  const versions = await summariesForPerson(actor.personId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <Link
        href="/patient"
        className="tap-target -ms-2 flex w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Link>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Your clinical summary</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Written by the therapists you have seen, about the course of your therapy rather than one
          session. It is yours. Every version stays, with the name of whoever wrote it, and nobody
          can take one back.
        </p>
      </div>

      {versions.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-900">Nothing here yet</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            A therapist adds a version when there is something worth carrying between sessions.
            Early on there usually is not, and an empty page is the honest answer.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {versions.map((version) => (
            <li key={version.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {version.approvedByName}
                    {version.approvedByCredentials ? (
                      <span className="ms-1.5 text-xs font-medium text-slate-500">
                        {version.approvedByCredentials}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-400">
                    Version {version.version} · {formatDate(version.approvedAt, actor.timezone)}
                  </p>
                </div>

                <p className="mt-2.5 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                  {version.body}
                </p>

                {version.approvedByLicenseBody ? (
                  <p className="mt-3 text-xs text-slate-400">
                    {version.approvedByLicenseBody}
                    {version.approvedByLicenseNumber ? ` ${version.approvedByLicenseNumber}` : ""}
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
