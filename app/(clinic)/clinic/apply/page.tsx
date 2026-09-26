import type { Metadata } from "next";

import { QuietAuthShell } from "@/components/auth/auth-shell";
import { ClinicApplyForm } from "@/components/clinic/apply-form";
import { SeesWhat } from "@/components/visual/primitives";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.bringYourPracticeTo24Therapy") };
}
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

  /* 🔴 W2-C07: inside the site's header and footer, like every other door. */
  return (
    <QuietAuthShell title={t("clinic.apply.title")} subtitle={t("clinic.apply.body")}>
      <div className="flex flex-col gap-4">
        <ClinicApplyForm />

        {/*
          🔴 C267, C261, 54.9 and 65.11 — SAID TO THE BUYER BEFORE THEY BUY, AS A TABLE.

          This was four paragraphs, 170 words, in one grey box below the form: the thing a
          practice manager most needs before signing is what the portal will and will not
          show them, and it was the third paragraph of four.
        */}
        <div className="space-y-3 border-t border-navy-100 pt-5">
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
          <p className="text-sm leading-relaxed text-navy-500">{t("clinic.cannotVerify")}</p>
        </div>
      </div>
    </QuietAuthShell>
  );
}
