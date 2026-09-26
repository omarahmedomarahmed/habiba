import type { Metadata } from "next";

import { KeyRound, ShieldCheck, Webhook } from "lucide-react";

import { IconTile } from "@/components/clinician/kit";
import { PartnerApplyForm } from "@/components/partner/apply-form";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.buildOn24Therapy") };
}
export const dynamic = "force-dynamic";

/**
 * 55.2 — the integrator's door, open to a stranger and listed in `lib/routing.ts` as the
 * one open route inside `/partner`.
 *
 * 🔴 The three rulings that decide whether an integrator wants this are on the page BEFORE
 * they ask for a call, not in a contract afterwards:
 *
 *   C255 — we answer one question about one person and never read your directory.
 *   C277 — your clinician's access to a record is the patient's grant, and the patient can
 *          revoke it and leave, including leaving you.
 *   42.4 — a webhook carries an event and an id, never content.
 *
 * A platform that finds any of those unacceptable should find it out here, in one screen,
 * rather than three weeks into an integration.
 */
export default async function PartnerApplyPage() {
  const { t } = await getI18n();

  /*
    🔴 C277 and 42.4, said to the buyer before they buy.

    `devs.useCase1Body` used to lead this block and described employment
    verification, which is no longer a partner product: an HR connection is
    the sponsor's own, on their own integrations page. The C255 sentence it
    carried about never syncing a directory went with it, because on this
    page it now describes a thing this key cannot do.

    Three promises, each on its own line with its own mark, rather than one
    paragraph of three: a buyer scanning for the deal-breaker finds it.
  */
  const promises = [
    { icon: ShieldCheck, text: t("devs.useCase3Body") },
    { icon: Webhook, text: t("dev.noContent") },
    { icon: KeyRound, text: t("devs.keysNote") },
  ];

  return (
    <div className="grid gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-10 lg:py-6">
      <div className="lg:pt-4">
        <h1 className="text-[30px] leading-tight font-bold tracking-tight text-navy-700 sm:text-[36px]">
          {t("dev.apply.title")}
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-navy-500">{t("dev.apply.body")}</p>

        <ul className="mt-8 hidden space-y-4 lg:block">
          {promises.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3.5">
              <IconTile tone="dark">
                <Icon className="h-5 w-5" aria-hidden />
              </IconTile>
              <p className="pt-0.5 text-sm leading-relaxed text-navy-500">{text}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <PartnerApplyForm />
      </div>

      {/* On a phone the promises follow the form, as they always have. */}
      <ul className="space-y-4 rounded-3xl bg-navy-900 p-5 lg:hidden">
        {promises.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" aria-hidden />
            <p className="text-sm leading-relaxed text-white/80">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
