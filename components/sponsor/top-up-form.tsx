"use client";

import Link from "next/link";

import { buttonClass, Card } from "@/components/clinician/kit";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { Money } from "@/components/ui/money";
import { rich, slot } from "@/lib/i18n/rich";

/**
 * Adding to the pot. PLAN.md 53.11, 53.12, 53.13, C233.
 *
 * ## 🔴 W1-01: NO FORM, BECAUSE NOTHING BEHIND IT TAKES A PAYMENT
 *
 * This was an amount field and a button that credited the pot with no charge.
 * Until a checkout charges first, the card rail says how to add money instead:
 * ask us, and we send bank transfer details.
 *
 * ## 🔴 C233: THE TERMS ARE STILL BESIDE IT
 *
 * `terms` stays a REQUIRED prop: a page cannot render the way in without having
 * the refund policy and the expiry to hand.
 */
export function TopUpForm({
  minimumCents,
  terms,
}: {
  minimumCents: number;
  /** 🔴 Required. A top-up screen without the terms is the thing C233 forbids. */
  terms: { refundPolicy: string; expiresLabel: string };
}) {
  const t = useT();

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-[17px] font-bold text-navy-700">{t("sponsor.topUp")}</h2>
      <p className="mt-1 text-sm leading-relaxed text-navy-400">
        {rich(t("sponsor.topUpBody", { min: slot(0) }), [<Money cents={minimumCents} />])}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-navy-400">{t("sponsor.potCardOff")}</p>

      {/* 🔴 C233: beside the way in. Not a link, not a tooltip, not a footer. */}
      <div className="mt-4 rounded-2xl bg-navy-50 p-4 ring-1 ring-navy-100">
        <p className="text-xs font-semibold text-navy-600">{t("sponsor.refundTerms")}</p>
        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-navy-400">
          {terms.refundPolicy}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-navy-400">
          {t("sponsor.expiresOn", { date: terms.expiresLabel })}
        </p>
      </div>

      <Link
        href="/contact"
        className={cn(buttonClass("primary", "md"), "mt-4")}
      >
        {t("sponsor.potAskUs")}
      </Link>
    </Card>
  );
}
