import type { Metadata } from "next";

import { AskAboutEmployer, BenefitForm } from "@/components/patient/benefit-form";
import { PatientBack } from "@/components/patient/back";
import { myBenefits } from "@/lib/data/enrolment";
import { localeTag } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";

/** 🔴 53.2 — a benefit title, never a therapy one. Even in the browser tab. */
/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourBenefit"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The patient's own benefit screen. PLAN.md 53.18, 53.19d, C121, C249.
 *
 * 🔴 Signed in only, and nothing is pre-filled for anybody who is not (C121).
 * The confirm step shows the name and phone we already hold, which is the whole
 * reason this cannot be an anonymous flow reached from a QR by a stranger.
 *
 * 🔴 This is the patient's OWN view of their enrolments, so it may say
 * everything: which organisations, which one pays, whether it is paused. The
 * sponsor's view of the same rows is `lib/data/sponsors.ts` and is deliberately
 * narrower. Two queries over one table, with opposite select lists, is what the
 * wall is made of.
 */
export default async function BenefitPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const actor = await requirePatient();
  /* 🔴 W2-P08: the sponsor's QR carries the code, and sign-in now keeps it (W2-P02). */
  const { code } = await searchParams;
  const { t, locale } = await getI18n();

  const benefits = await myBenefits(actor.personId);
  /*
   * 🔴 P17: formatted here, on the server, in the reader's numerals. C84 keeps
   * `Intl` out of a client component, and this is the figure somebody reads
   * to work out what they will still pay.
   */
  const percent = new Intl.NumberFormat(localeTag(locale), {
    style: "percent",
    maximumFractionDigits: 1,
  });

  return (
    <main className="mx-auto flex flex-col min-h-dvh w-full max-w-lg gap-4 px-5 pt-16 pb-10">
      <div className="flex items-center gap-1">
        <PatientBack />
      </div>

      <div>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">
          {t("benefit.title")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-navy-400">{t("benefit.body")}</p>
      </div>

      <BenefitForm
        initialCode={typeof code === "string" ? code.slice(0, 32) : ""}
        benefits={benefits.map((benefit) => ({
          kind: benefit.identifierKind,
          enrolmentId: benefit.enrolmentId,
          sponsorName: benefit.sponsorName,
          isPrimary: benefit.isPrimary,
          paused: benefit.pausedAt !== null,
          /* W2-S11: paused by the organisation, which no code can undo. */
          held: benefit.state === "paused",
          /* 🔴 53.19 — proof, not a pattern. `payFromPot` requires this too. */
          verified: benefit.lastVerifiedAt !== null,
          /* P17: their company's share of each session. Never the pot's balance. */
          coverage:
            benefit.coverageBps === null ? null : percent.format(benefit.coverageBps / 10_000),
        }))}
      />

      {/*
        🔴 61.6 / C349 — people ask this, and refusing to have the question on
        the screen does not make it go away: it makes somebody email support,
        who answers it by hand and becomes the oracle themselves.
      */}
      <div className="mt-4">
        <AskAboutEmployer />
      </div>
    </main>
  );
}
