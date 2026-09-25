import type { Metadata } from "next";
import Link from "next/link";

import { getI18n } from "@/lib/i18n/server";

import { PatientResetForm } from "@/components/patient/reset-form";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.getBackIn"), robots: { index: false } };
}
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
    <main className="mx-auto flex flex-col min-h-dvh w-full max-w-lg gap-6 px-5 pt-16 pb-10">
      <PatientResetForm />

      <p className="text-center text-sm text-navy-400">
        {t("pauth.areYouTherapist")}{" "}
        <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">
          {t("pauth.practiceReset")}
        </Link>
      </p>
    </main>
  );
}
