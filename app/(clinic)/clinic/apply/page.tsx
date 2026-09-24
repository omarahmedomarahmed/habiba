import type { Metadata } from "next";

import { ClinicApplyForm } from "@/components/clinic/apply-form";
import { SeesWhat } from "@/components/visual/primitives";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Bring your practice to 24Therapy" };
export const dynamic = "force-dynamic";

/**
 * 54.3 — the practice's door, open to a stranger and listed in `lib/routing.ts` as one
 * of the two open routes inside `/clinic`.
 *
 * 🔴 The three rulings that decide whether a practice wants this are on the page BEFORE
 * they ask for a call, not in a contract afterwards:
 *
 *   C267 — you cannot verify your own clinicians for us.
 *   C261 — your clinicians have no private patients on the account you pay for.
 *   54.9 — you will never see anything clinical.
 *
 * A hospital that finds the first two unacceptable should find that out here, in one
 * screen, rather than three weeks into an onboarding.
 */
export default async function ClinicApplyPage() {
  const { t } = await getI18n();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {t("clinic.apply.title")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("clinic.apply.body")}</p>
      </div>

      <ClinicApplyForm />

      {/*
        🔴 C267, C261, 54.9 and 65.11 — SAID TO THE BUYER BEFORE THEY BUY, AS A TABLE.

        This was four paragraphs, 170 words, in one grey box below the form: the thing a
        practice manager most needs before signing is what the portal will and will not
        show them, and it was the third paragraph of four.
      */}
      <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <SeesWhat
          who={t("clinic.apply.seesWho")}
          can={[t("clinic.apply.seesSchedule"), t("clinic.apply.seesBills"), t("clinic.apply.seesTeam")]}
          cannot={[
            t("clinic.neverNote"),
            t("clinic.neverRisk"),
            t("clinic.neverContact"),
            t("clinic.neverBuilt"),
          ]}
        />
        <p className="text-sm leading-relaxed text-slate-600">{t("clinic.cannotVerify")}</p>
      </div>
    </div>
  );
}
