import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ExportRecord } from "@/components/patient/export-record";
import { requirePatient } from "@/lib/patient-auth/guard";

export const metadata: Metadata = { title: "A copy of your record", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Where a patient gets the whole thing. PLAN.md 26.9, 26.10.
 */
export default async function RecordExportPage() {
  const actor = await requirePatient();

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
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Your whole record</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Everything this platform holds about your therapy, in one document you can keep, print,
          or hand to somebody.
        </p>
      </div>

      <ExportRecord email={actor.email} />
    </main>
  );
}
