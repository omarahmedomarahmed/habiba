import type { Metadata } from "next";
import Link from "next/link";

import { QuietAuthShell } from "@/components/auth/auth-shell";
import { ClinicSetPasswordForm } from "@/components/clinic/password-forms";
import { clinicTokenView } from "@/lib/clinic-auth/tokens";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.chooseAPassword"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-C04 / W2-C05: the one place a clinic manager's password is chosen,
 * by the manager, from a single-use link: an invitation from their practice's
 * admin or a reset they asked for. Reading the page uses nothing; only
 * setting the password spends the link.
 */
export default async function ClinicSetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { t } = await getI18n();
  const { token = "" } = await searchParams;
  const view = await clinicTokenView(token);

  if (!view) {
    return (
      <QuietAuthShell>
        <p className="text-sm leading-relaxed text-navy-500">{t("clinic.linkInvalid")}</p>
        <Link
          href="/clinic/forgot-password"
          className="mt-3 inline-flex text-sm font-semibold text-brand-700"
        >
          {t("tauth.sendResetLink")}
        </Link>
      </QuietAuthShell>
    );
  }

  return (
    <QuietAuthShell title={t("tauth.chooseNew")} subtitle={`${view.clinicName} · ${view.email}`}>
      <ClinicSetPasswordForm token={token} />
    </QuietAuthShell>
  );
}
