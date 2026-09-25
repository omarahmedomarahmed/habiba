import type { Metadata } from "next";
import Link from "next/link";

import { ClinicDemo } from "@/components/public/audience-demos";
import { ArrowRight } from "lucide-react";

import { AudienceHero } from "@/components/public/audience-hero";
import { btn } from "@/components/public/site-ui";
import { cn } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { CLINIC_APPLY } from "@/lib/routing";

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
    <main>
      {/*
        🔴 76.84 — the same band the homepage gives a clinic, on the page that
        is about clinics. `ClinicConsole` inside it is the real `/clinic` one.

        🔴 The call to action used to point at `/signup`, which is
        `app/(auth)/signup`: the INDIVIDUAL therapist signup. The main button on
        the page headed "seats you buy" created a solo practice account, and the
        page linked to `/clinic/apply` nowhere at all. The only public route to
        the clinic enquiry was one line inside
        `components/public/pricing-tiers.tsx:293`. `/for-companies` has always
        had the equivalent right, which is how this went unnoticed: the two
        pages were never read side by side.
      */}
      <AudienceHero
        eyebrow={t("marketing.clinics.eyebrow")}
        heading={t("marketing.clinics.title")}
        body={t("marketing.clinics.lede")}
        cta={{ label: t("marketing.companies.cta"), href: CLINIC_APPLY }}
        secondary={{ label: t("nav.contact"), href: "/contact" }}
        demo={<ClinicDemo />}
      />

      {/*
        The four questions as the mockups' cards, two by two, each one the
        answer a practice manager would otherwise have to ask for.
      */}
      <section className="bg-navy-50 px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-2">
            <Question n={1} q={t("marketing.clinics.q1")} a={t("marketing.clinics.a1")} />
            <Question n={2} q={t("marketing.clinics.q2")} a={t("marketing.clinics.a2")} />
            <Question n={3} q={t("marketing.clinics.q3")} a={t("marketing.clinics.a3")} />
            <Question n={4} q={t("marketing.clinics.q4")} a={t("marketing.clinics.a4")} />
          </div>

          {/* What is not built yet, said as plainly as what is. */}
          <div className="mt-4 flex flex-col gap-5 rounded-[28px] bg-navy-900 p-6 text-white sm:flex-row sm:items-center sm:p-8">
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-bold">{t("marketing.clinics.notYetTitle")}</p>
              <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-white/85">
                {t("marketing.clinics.notYet")}
              </p>
            </div>
            <Link href="/integrations" className={cn(btn.light, "shrink-0")}>
              {t("nav.integrations")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Question({ n, q, a }: { n: number; q: string; a: string }) {
  return (
    <section className="rounded-[28px] bg-white p-6 ring-1 ring-navy-100 shadow-[0_20px_50px_-40px_rgba(10,35,66,0.5)] sm:p-7">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy-900 text-[15px] font-bold tabular-nums text-brand-300">
        {n}
      </span>
      <h2 className="mt-5 text-[19px] font-bold leading-snug tracking-tight text-navy-700">{q}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-navy-500">{a}</p>
    </section>
  );
}
