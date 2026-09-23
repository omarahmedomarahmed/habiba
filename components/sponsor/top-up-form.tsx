"use client";

import Link from "next/link";

import { Card } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * Adding to the pot. PLAN.md 53.11, 53.12, 53.13, C233.
 *
 * ## 🔴 W1-01 — NO FORM, BECAUSE NOTHING BEHIND IT TAKES A PAYMENT
 *
 * This was an amount field and a button that credited the pot with no charge.
 * Until a checkout charges first, the card rail says how to add money instead:
 * ask us, and we send bank transfer details.
 *
 * ## 🔴 C233 — THE TERMS ARE STILL BESIDE IT
 *
 * `terms` stays a REQUIRED prop: a page cannot render the way in without having
 * the refund policy and the expiry to hand.
 */
export function TopUpForm({
  minimumLabel,
  terms,
}: {
  minimumLabel: string;
  /** 🔴 Required. A top-up screen without the terms is the thing C233 forbids. */
  terms: { refundPolicy: string; expiresLabel: string };
}) {
  const t = useT();

  return (
    <Card className="p-5">
      <p className="text-base font-bold tracking-tight text-slate-900">{t("sponsor.topUp")}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {t("sponsor.topUpBody", { min: minimumLabel })}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("w1a.potCardOff")}</p>

      {/* 🔴 C233 — beside the way in. Not a link, not a tooltip, not a footer. */}
      <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <p className="text-xs font-semibold text-slate-700">{t("sponsor.refundTerms")}</p>
        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">
          {terms.refundPolicy}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {t("sponsor.expiresOn", { date: terms.expiresLabel })}
        </p>
      </div>

      <Link
        href="/contact"
        className="mt-4 inline-block text-sm font-semibold text-slate-900 underline"
      >
        {t("w1a.potAskUs")}
      </Link>
    </Card>
  );
}
