import type { Metadata } from "next";
import Link from "next/link";

import { SponsorHeading } from "@/components/sponsor/heading";
import { SetPasswordForm } from "@/components/sponsor/password-forms";
import { getI18n } from "@/lib/i18n/server";
import { sponsorPasswordLinkLive } from "@/lib/data/sponsor-users";
import { SPONSOR_FORGOT } from "@/lib/routing";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.setYourPassword"), robots: { index: false } };
}
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

  /* 🔴 Board 357: a spent link says so on arrival, as the clinic's does. */
  if (!(await sponsorPasswordLinkLive(token ?? ""))) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 py-4">
        <SponsorHeading title={t("sponsor.setTitle")} />
        <p className="text-sm leading-relaxed text-navy-500">{t("clinic.linkInvalid")}</p>
        <Link href={SPONSOR_FORGOT} className="text-sm font-semibold text-brand-700">
          {t("tauth.sendResetLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-4">
      <SponsorHeading title={t("sponsor.setTitle")} />
      <SetPasswordForm token={token ?? ""} />
    </div>
  );
}
