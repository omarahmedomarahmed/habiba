import type { Metadata } from "next";
import Link from "next/link";

import { CompanyDemo } from "@/components/public/audience-demos";
import { Button } from "@/components/ui";
import { FlowStrip, SeesWhat } from "@/components/visual/primitives";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "For companies",
  description:
    "Fund therapy for your people and never learn who went. The wall is the product, and this page renders it.",
};

/**
 * 🔴 65.16 / 65.20 — THE AUDIENCE THAT HAD NO PAGE.
 *
 * > *Every audience gets a real page, not a section. `/for-companies`, `/for-clinics`,
 * > `/for-patients`, `/developers`, each laid out properly rather than as a wall under a
 * > heading.*
 *
 * A therapist had a page, patients had a page, clinics had a page and developers had a
 * page. The employer funding all of it had two sentences on the pricing page. Sprint 53
 * built the whole sponsor portal and nothing on the public site ever said so.
 *
 * ## 🔴 THE WALL IS THE PITCH, WHICH IS 65.15's OWN WORDING
 *
 * *Bring mental health to your people, and never learn who went. C227 and C244 are the
 * product, and they are the pitch.* An HR director choosing between vendors is choosing
 * who will be able to tell them which of their staff is in therapy, and the answer here
 * is nobody. So the comparison is the first thing on the page rather than a paragraph
 * under the features.
 *
 * ## 🔴 65.17 — AND THE PANEL BESIDE IT IS THE REAL PORTAL
 *
 * `CompanyDemo` renders `SpendHeatmap`, the component `/sponsor` itself renders, with
 * one suppressed week in it because that is what C229 does to a small figure. Nobody had
 * to write a sentence claiming we suppress small numbers: the chart does it.
 *
 * ## 🔴 65.21 — AND IT IS IN THE DICTIONARY, NOT IN THIS FILE
 *
 * `/for-clinics` and `/integrations` are hand-built pages under `app/(public)/`, which
 * `scripts/_i18n-coverage.ts` exempts on the stated ground that "the rows are already
 * published in both languages". That is true of `[slug]` and false of these: their text
 * is typed into the markup and exists in English only. This page is built the other way
 * round so it cannot join them.
 */
export default async function ForCompaniesPage() {
  const { t } = await getI18n();

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
        <div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t("marketing.companies.title")}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-slate-600">
            {t("marketing.companies.lede")}
          </p>

          <div className="mt-8">
            <SeesWhat
              who={t("sponsor.apply.seesWho")}
              can={[
                t("sponsor.apply.seesCount"),
                t("sponsor.apply.seesSpend"),
                t("sponsor.apply.seesWeekly"),
              ]}
              cannot={[
                t("sponsor.neverIndividual"),
                t("sponsor.neverAttendance"),
                t("sponsor.neverClinical"),
              ]}
            />
          </div>

          <div className="mt-8">
            <FlowStrip
              steps={[
                {
                  title: t("marketing.companies.step1"),
                  detail: t("marketing.companies.step1Body"),
                },
                {
                  title: t("marketing.companies.step2"),
                  detail: t("marketing.companies.step2Body"),
                },
                {
                  title: t("marketing.companies.step3"),
                  detail: t("marketing.companies.step3Body"),
                },
              ]}
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sponsor/apply">
              <Button size="lg">{t("marketing.companies.cta")}</Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="secondary">
                {t("nav.contact")}
              </Button>
            </Link>
          </div>
        </div>

        <CompanyDemo />
      </div>
    </main>
  );
}
