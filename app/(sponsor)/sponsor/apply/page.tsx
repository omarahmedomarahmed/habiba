import type { Metadata } from "next";

import { SponsorApplyForm } from "@/components/sponsor/apply-form";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Cover therapy for your people" };
export const dynamic = "force-dynamic";

/**
 * 53.5 — the corporate door, open to a stranger and listed in `lib/routing.ts`
 * as the one open route inside `/sponsor`.
 *
 * 🔴 The account it creates is HELD. Nothing is active, no pot exists, no code is
 * minted and no portal user is created, because all three are things an operator
 * does after the call (53.6) and the pot cannot hold money before the refund and
 * expiry terms are agreed (C233).
 */
export default async function SponsorApplyPage() {
  const { t } = await getI18n();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {t("sponsor.apply.title")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("sponsor.apply.body")}</p>
      </div>

      <SponsorApplyForm />

      {/*
        🔴 C240 and the wall, said to the buyer BEFORE they buy.
        Somebody drafting an attendance policy should find out here that it
        cannot be enforced through us, not after a contract is signed.
      */}
      <div className="space-y-2 rounded-2xl bg-white p-5 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200">
        <p>{t("sponsor.rosterBody")}</p>
        <p>{t("sponsor.whyWeekly")}</p>
        <p>{t("sponsor.noAttendance")}</p>
      </div>
    </div>
  );
}
