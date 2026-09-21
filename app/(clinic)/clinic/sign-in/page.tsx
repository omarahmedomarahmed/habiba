import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ClinicSignInForm } from "@/components/clinic/sign-in-form";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Your practice", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The clinic's own door. PLAN.md 54.2, C259, C264.
 *
 * 🔴 Its own cookie and its own sign-in even though a clinic IS an organisation.
 * Sharing the clinician cookie would be the one shortcut that undoes that
 * sprint: the clinician principal's routes ARE the clinical product, and a
 * practice manager holding that cookie would be inside it.
 */
export default async function ClinicSignInPage() {
  const { t } = await getI18n();

  return (
    <AuthShell
      who="clinic"
      kind="signin"
      title={t("clinic.signInTitle")}
      promise={t("auth.clinic.promise")}
      points={[t("auth.clinic.p1"), t("auth.clinic.p2"), t("auth.clinic.p3")]}
    >
      <ClinicSignInForm />
    </AuthShell>
  );
}
