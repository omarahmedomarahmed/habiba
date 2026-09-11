import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ResidencyNotice } from "@/components/patient/residency-notice";
import { regionLabel } from "@/lib/db/region";
import { residencyFor } from "@/lib/data/residency";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Where your record is kept", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Where your record is kept. PLAN.md 30.3, C118.
 *
 * 🔴 A page rather than a one-time modal. The fact is permanent and so is the
 * screen: a person can come back and check where their therapy records are,
 * which is the difference between a consent flow and a disclosure.
 */
export default async function ResidencyPage() {
  const actor = await requirePatient();
  const { locale } = await getI18n();
  const state = await residencyFor(actor.personId, locale);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <Link
        href="/patient"
        className="tap-target -ms-2 flex w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Link>

      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        Where your record is kept
      </h1>

      <ResidencyNotice
        crosses={state.crosses}
        agreedAt={state.agreedAt ? formatDate(state.agreedAt, actor.timezone) : null}
        wording={state.wording}
        homeLabel={regionLabel(state.homeRegion, locale)}
        servingLabel={regionLabel(state.servingRegion, locale)}
      />
    </main>
  );
}
