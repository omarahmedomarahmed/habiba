import type { Metadata } from "next";
import Link from "next/link";

import { ClinicDemo } from "@/components/public/audience-demos";
import { Card } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "For clinics",
  description:
    "What a clinic gets, what it does not get, and the four questions to ask us before you put your practice on this.",
};

/**
 * The clinic page. PLAN.md 28.5, rebuilt in 65.16.
 *
 * ## 🔴 Written as the questions a clinic should ask, not the features we have
 *
 * A practice manager evaluating this is deciding where their patients' records live. The
 * page that helps them is the one that answers the awkward questions, and the page that
 * wins the meeting is the one with the logo grid. We are shipping the first one.
 *
 * Two of the four answers below are "not yet". They are on the page because a clinic
 * discovering either of them after signing is a clinic we have wasted.
 *
 * ## 🔴 65.14 / 65.21 — WHAT SPRINT 65 CHANGED, AND WHY IT IS NOT A TIDY-UP
 *
 * The four answers were 60 to 80 words each and they were typed into this file. That is
 * two problems in one shape. They were invisible to the prose sweep, which read the
 * dictionary and the CMS; and they were invisible to `verify:sprint37l`, because
 * `app/(public)/` is exempt from it on the stated ground that "the rows are already
 * published in both languages" — true of `[slug]`, which renders the CMS, and false of
 * this file, which renders itself.
 *
 * 🔴 AN EXEMPTION WHOSE REASON DOES NOT APPLY IS AN EXEMPTION NOBODY CHECKED. The answers
 * are in the dictionary now, in both languages, a third of the length, and both gates can
 * see them.
 */
export default async function ForClinicsPage() {
  const { t } = await getI18n();

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
        <div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t("marketing.clinics.title")}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-slate-600">
            {t("marketing.clinics.lede")}
          </p>

          <Question q={t("marketing.clinics.q1")} a={t("marketing.clinics.a1")} />
          <Question q={t("marketing.clinics.q2")} a={t("marketing.clinics.a2")} />
          <Question q={t("marketing.clinics.q3")} a={t("marketing.clinics.a3")} />
          <Question q={t("marketing.clinics.q4")} a={t("marketing.clinics.a4")} />

          <Card className="mt-8 border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">
              {t("marketing.clinics.notYetTitle")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {t("marketing.clinics.notYet")}
            </p>
            <Link
              href="/integrations"
              className="mt-2 inline-block text-sm font-semibold text-brand-600 underline"
            >
              {t("nav.integrations")}
            </Link>
          </Card>
        </div>

        <ClinicDemo />
      </div>
    </main>
  );
}

function Question({ q, a }: { q: string; a: string }) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-bold tracking-tight text-slate-900">{q}</h2>
      <p className="mt-1.5 leading-relaxed text-slate-700">{a}</p>
    </section>
  );
}
