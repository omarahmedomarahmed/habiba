import type { Metadata } from "next";
import Link from "next/link";

import { SponsorSignInForm } from "@/components/sponsor/sign-in-form";
import { getI18n } from "@/lib/i18n/server";
import { SPONSOR_APPLY } from "@/lib/routing";

export const metadata: Metadata = { title: "Your organisation's account", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The sponsor's own door. PLAN.md 53.4, C230, C264.
 *
 * 🔴 Not `/sign-in`, not `/staff/sign-in`, not the patient's. Five doors for five
 * principals, one cookie each, and `lib/routing.ts` is the one table that decides
 * which door a path belongs to. Sharing a door means sharing a cookie, and a
 * cookie that admits an employer to a clinical path is the leak that ends the
 * company.
 */
export default async function SponsorSignInPage() {
  const { t } = await getI18n();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-8">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        {t("sponsor.signInTitle")}
      </h1>

      <SponsorSignInForm />

      {/* No account: the enquiry form, which is the only way one is created. */}
      <p className="text-center text-xs text-slate-500">
        <Link href={SPONSOR_APPLY} className="font-semibold text-teal-700 hover:underline">
          {t("sponsor.apply.title")}
        </Link>
      </p>
    </div>
  );
}
