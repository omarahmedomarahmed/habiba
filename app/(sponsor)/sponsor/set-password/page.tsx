import type { Metadata } from "next";

import { SetPasswordForm } from "@/components/sponsor/password-forms";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Set your password", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-S05: a password from a reset or invite link. The token in the link is
 * the whole authorisation (`setSponsorPassword` checks it), so the page itself
 * has no guard and says nothing about which company it belongs to.
 */
export default async function SponsorSetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await getI18n();
  const { t: token } = await searchParams;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-4">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("sponsor.setTitle")}</h1>
      <SetPasswordForm token={token ?? ""} />
    </div>
  );
}
