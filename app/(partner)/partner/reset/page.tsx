import type { Metadata } from "next";

import { QuietAuthShell } from "@/components/auth/auth-shell";
import { PartnerChoosePasswordForm } from "@/components/partner/password-forms";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.chooseAPassword"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-X06: WHERE A RESET LINK AND A COLLEAGUE'S INVITATION LAND.
 *
 * The token is only carried to the form here; `setPartnerPassword` checks it when
 * the password is sent, so an expired link says so at the moment it matters.
 */
export default async function PartnerResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { t } = await getI18n();
  const { token } = await searchParams;

  return (
    <QuietAuthShell title={t("dev.setPassword")}>
      <PartnerChoosePasswordForm token={token ?? ""} />
    </QuietAuthShell>
  );
}
