import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forms";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <AuthShell
      who="therapist"
      kind="signin"
      title={t("tauth.resetTitle")}
      subtitle={t("tauth.resetBody")}
      promise={t("auth.therapist.promise")}
      points={[t("auth.therapist.p1"), t("auth.therapist.p2"), t("auth.therapist.p3")]}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
