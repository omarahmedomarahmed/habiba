import type { Metadata } from "next";
import Link from "next/link";

import { PartnerSignInForm } from "@/components/partner/sign-in-form";
import { getI18n } from "@/lib/i18n/server";
import { PARTNER_APPLY } from "@/lib/routing";

export const metadata: Metadata = { title: "Your developer account", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The partner's own door. PLAN.md 55.2, 55.3, C264.
 *
 * 🔴 Its own cookie and its own sign-in. 55.3 says a therapist never sees an API key, and
 * the cheapest way to keep that true is for keys to live behind a principal a therapist
 * cannot become: not a permission on a clinician account, a different table read through a
 * different cookie.
 */
export default async function PartnerSignInPage() {
  const { t } = await getI18n();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-8">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("dev.signInTitle")}</h1>

      <PartnerSignInForm />

      <p className="text-center text-xs text-slate-500">
        <Link href={PARTNER_APPLY} className="font-semibold text-teal-700 hover:underline">
          {t("dev.apply.title")}
        </Link>
      </p>
    </div>
  );
}
