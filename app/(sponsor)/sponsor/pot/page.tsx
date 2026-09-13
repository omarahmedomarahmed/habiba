import type { Metadata } from "next";

import { TopUpForm } from "@/components/sponsor/top-up-form";
import { Card } from "@/components/ui";
import { ledgerPotBalance } from "@/lib/billing/pot";
import { potTerms } from "@/lib/data/sponsor-admin";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { requireSponsor } from "@/lib/sponsor-auth/guard";

export const metadata: Metadata = { title: "Your pot", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The pot. PLAN.md 53.11 to 53.13, C233.
 *
 * 🔴 The form is rendered ONLY when the terms exist. Not disabled, not rendered with
 * a warning: not rendered. C233 says the terms are decided before any deal, so a
 * pot without them is a pot that cannot be topped up, and the database agrees —
 * `sponsor_pots_terms_before_money` refuses a balance above zero without them.
 *
 * Three layers saying the same thing, which is deliberate: the constraint is the
 * rule, `topUpPot` is the readable message, and this is the screen that never asks
 * the question it cannot honour.
 */
export default async function SponsorPotPage() {
  const actor = await requireSponsor();
  const { t, locale } = await getI18n();
  const settings = await getSettings();

  const [balanceCents, terms] = await Promise.all([
    ledgerPotBalance(actor.sponsorId),
    potTerms(actor.sponsorId),
  ]);

  const fmt = (cents: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(cents / 100);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Card className="p-4">
        <p className="text-xs font-medium text-slate-500">{t("sponsor.balance")}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          {fmt(balanceCents)}
        </p>
      </Card>

      {terms?.refundPolicy && terms.expiresAt ? (
        actor.role === "admin" ? (
          <TopUpForm
            minimumLabel={fmt(settings.sponsor.minTopUpCents)}
            terms={{
              refundPolicy: terms.refundPolicy,
              expiresLabel: terms.expiresAt.toISOString().slice(0, 10),
            }}
          />
        ) : (
          /* A viewer reads the balance and the terms and cannot move money. */
          <Card className="p-5">
            <p className="text-xs font-semibold text-slate-700">{t("sponsor.refundTerms")}</p>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">
              {terms.refundPolicy}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {t("sponsor.expiresOn", { date: terms.expiresAt.toISOString().slice(0, 10) })}
            </p>
          </Card>
        )
      ) : (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">{t("sponsor.noPot")}</p>
        </Card>
      )}
    </div>
  );
}
