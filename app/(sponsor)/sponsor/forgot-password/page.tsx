import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/sponsor/password-forms";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-S05 — the way back in for a company user who forgot their password.
 * A door, like the sign-in page: open signed out (`lib/routing.ts`).
 */
export default async function SponsorForgotPasswordPage() {
  const { t } = await getI18n();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-4">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("sponsor.forgotTitle")}</h1>
      <ForgotPasswordForm />
    </div>
  );
}
