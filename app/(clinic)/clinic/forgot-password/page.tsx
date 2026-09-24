import type { Metadata } from "next";

import { QuietAuthShell } from "@/components/auth/auth-shell";
import { ClinicForgotForm } from "@/components/clinic/password-forms";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-C05: the practice's reset door. A clinic manager or staff member who
 * forgot their password had no way back in short of asking us, and an
 * operator setting one for them is the thing W2-C04 exists to stop.
 */
export default async function ClinicForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <QuietAuthShell title={t("tauth.resetTitle")} subtitle={t("tauth.resetBody")}>
      <ClinicForgotForm />
    </QuietAuthShell>
  );
}
