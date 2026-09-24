import type { Metadata } from "next";

import { QuietAuthShell } from "@/components/auth/auth-shell";
import { PartnerForgotForm } from "@/components/partner/password-forms";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-X06: THE WAY BACK IN, linked from the sign-in page. An open route: the
 * person who needs it is by definition not signed in.
 */
export default async function PartnerForgotPage() {
  const { t } = await getI18n();

  return (
    <QuietAuthShell title={t("dev.forgotTitle")}>
      <PartnerForgotForm />
    </QuietAuthShell>
  );
}
