import type { Metadata } from "next";
import Link from "next/link";

import { getI18n } from "@/lib/i18n/server";

import { PatientResetForm } from "@/components/patient/reset-form";

export const metadata: Metadata = { title: "Get back in", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 21R.4 / C94 — the page that did not exist.
 *
 * A patient locked out of their own clinical record had no route back to it.
 * The code goes over WhatsApp because the phone is the handle that is never
 * missing (§3b); the form itself explains what has been sent and, when the
 * channel is not switched on yet, says so.
 */
export default async function PatientForgotPasswordPage() {
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-8">
      <PatientResetForm />

      <p className="text-center text-sm text-slate-500">
        {t("pauth.areYouTherapist")}{" "}
        <Link href="/forgot-password" className="font-semibold text-brand-600 hover:underline">
          {t("pauth.practiceReset")}
        </Link>
      </p>
    </main>
  );
}
