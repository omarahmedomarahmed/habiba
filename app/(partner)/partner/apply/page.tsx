import type { Metadata } from "next";

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

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("dev.apply.title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("dev.apply.body")}</p>
      </div>

      <PartnerApplyForm />

      {/*
        🔴 C277 and 42.4, said to the buyer before they buy.

        `devs.useCase1Body` used to lead this block and described employment
        verification, which is no longer a partner product: an HR connection is
        the sponsor's own, on their own integrations page. The C255 sentence it
        carried about never syncing a directory went with it, because on this
        page it now describes a thing this key cannot do.
      */}
      <div className="space-y-2 rounded-2xl bg-white p-5 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200">
        <p>{t("devs.useCase3Body")}</p>
        <p>{t("dev.noContent")}</p>
        <p>{t("devs.keysNote")}</p>
      </div>
    </div>
  );
}
