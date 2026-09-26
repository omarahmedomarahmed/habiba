import type { Metadata } from "next";
import Link from "next/link";

import { QuietAuthShell } from "@/components/auth/auth-shell";
import { PartnerChoosePasswordForm } from "@/components/partner/password-forms";
import { getI18n } from "@/lib/i18n/server";
import { partnerLinkUser } from "@/lib/partner/team";
import { PARTNER_FORGOT } from "@/lib/routing";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.chooseAPassword"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-X06: WHERE A RESET LINK AND A COLLEAGUE'S INVITATION LAND.
 *
 * `setPartnerPassword` checks the token when the password is sent and stays the
 * authority. 🔴 Board 357: the page asks the same question on arrival, so a
 * spent or expired link says so before anybody types a password, as the
 * clinic's does.
 */
export default async function PartnerResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { t } = await getI18n();
  const { token } = await searchParams;

  if (!(await partnerLinkUser(token ?? ""))) {
    return (
      <QuietAuthShell title={t("dev.setPassword")}>
        <p className="text-sm leading-relaxed text-navy-500">{t("clinic.linkInvalid")}</p>
        <Link href={PARTNER_FORGOT} className="mt-3 inline-flex text-sm font-semibold text-brand-700">
          {t("tauth.sendResetLink")}
        </Link>
      </QuietAuthShell>
    );
  }

  return (
    <QuietAuthShell title={t("dev.setPassword")}>
      <PartnerChoosePasswordForm token={token ?? ""} />
    </QuietAuthShell>
  );
}
