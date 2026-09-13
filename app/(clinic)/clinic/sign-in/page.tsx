import type { Metadata } from "next";
import Link from "next/link";

import { ClinicSignInForm } from "@/components/clinic/sign-in-form";
import { getI18n } from "@/lib/i18n/server";
import { CLINIC_APPLY } from "@/lib/routing";

export const metadata: Metadata = { title: "Your practice", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The clinic's own door. PLAN.md 54.2, C259, C264.
 *
 * 🔴 Its own cookie and its own sign-in even though a clinic IS an organisation.
 * Sharing the clinician cookie would be the one shortcut that undoes this sprint: the
 * clinician principal's routes ARE the clinical product, and a practice manager holding
 * that cookie would be inside it.
 */
export default async function ClinicSignInPage() {
  const { t } = await getI18n();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-8">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        {t("clinic.signInTitle")}
      </h1>

      <ClinicSignInForm />

      <p className="text-center text-xs text-slate-500">
        <Link href={CLINIC_APPLY} className="font-semibold text-teal-700 hover:underline">
          {t("clinic.apply.title")}
        </Link>
      </p>
    </div>
  );
}
