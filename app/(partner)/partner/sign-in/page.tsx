import type { Metadata } from "next";
import Link from "next/link";

import { QuietAuthShell } from "@/components/auth/auth-shell";
import { PartnerSignInForm } from "@/components/partner/sign-in-form";
import { getI18n } from "@/lib/i18n/server";
import { PARTNER_APPLY, PARTNER_FORGOT } from "@/lib/routing";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourDeveloperAccount"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The partner's own door. PLAN.md 55.2, 55.3, C264.
 *
 * 🔴 Its own cookie and its own sign-in. 55.3 says a therapist never sees an
 * API key, and the cheapest way to keep that true is for keys to live behind a
 * principal a therapist cannot become: not a permission on a clinician account,
 * a different table read through a different cookie.
 *
 * `QuietAuthShell` and not `AuthShell`: it carries the site header and footer
 * like every other door, but no switcher. Nobody self serves a partner account
 * and a marketing header offering one reads as a product with a back door. Same
 * reasoning as `/staff/sign-in`.
 */
export default async function PartnerSignInPage() {
  const { t } = await getI18n();

  return (
    <QuietAuthShell title={t("dev.signInTitle")}>
      <PartnerSignInForm />
      {/* 🔴 W2-X06: there was no way back in for a developer who forgot their password. */}
      <p className="mt-4 text-sm">
        <Link href={PARTNER_FORGOT} className="font-semibold text-brand-700 hover:text-brand-800">
          {t("dev.forgot")}
        </Link>
      </p>
      <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
        <Link href={PARTNER_APPLY} className="font-semibold text-brand-700 hover:text-brand-800">
          {t("dev.apply.title")}
        </Link>
      </p>
    </QuietAuthShell>
  );
}
