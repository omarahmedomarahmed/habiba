import type { Metadata } from "next";

import { AlsoIncluded, AudienceClose, CostPanel, FeatureBands } from "@/components/public/audience-page";
import { AudienceHero } from "@/components/public/audience-hero";
import { CompanyDemo } from "@/components/public/audience-demos";
import { Meter } from "@/components/visual/primitives";
import { getI18n } from "@/lib/i18n/server";
import { COMPANY } from "@/lib/marketing/fixtures";
import { egp } from "@/lib/marketing/prices";

export const metadata: Metadata = {
  title: "For companies",
  description:
    "Fund therapy for your people. You see who joined the benefit, never who attended a session, when, or with whom.",
};

/**
 * 🔴 THE SAME PAGE AS `/for-therapists`, FOR THE PERSON WHO PAYS FOR OTHER PEOPLE.
 *
 * *"Unify the For-* pages. The company and clinic pages are empty; the therapist page
 * is the reference for all other pages to look like."* (founder, 26 Sep)
 *
 * So this is the therapist page's shape, band for band: the hero with the audience's
 * own working desk beside it, six numbered bands that each put a real screen beside a
 * claim, the list of what is true and has no screen, what it costs, and the closing
 * band with the way to the other three pages.
 *
 * ## Every band is the same console, opened where the claim is
 *
 * `CompanyDemo` is `/sponsor` as Dalia Samir at Cairo Foundry sees it, with every
 * section in its rail pressable. A band about the joining code opens it on the joining
 * code; the reader can walk from there to anything else. Nothing on this page says what
 * the portal does that the portal beside it does not show.
 *
 * ## 🔴 The wall is on every screen, not in a paragraph
 *
 * "This portal will never show you" sits at the foot of the console's rail on every
 * band, because it sits there in the real portal. 65.15's pitch, *never learn who went*,
 * is made by the product rather than by a sentence about it.
 */
export default async function ForCompaniesPage() {
  const { t, locale } = await getI18n();
  const money = (pounds: number) => egp(pounds * 100, locale);

  return (
    <main>
      <AudienceHero
        eyebrow={t("marketing.companies.eyebrow")}
        heading={t("marketing.companies.title")}
        body={t("marketing.companies.lede")}
        cta={{ label: t("marketing.companies.cta"), href: "/sponsor/apply" }}
        secondary={{ label: t("ft.secondary"), href: "#cost" }}
        demo={<CompanyDemo />}
        note={t("public.demoNote")}
      />

      <FeatureBands
        note={t("public.demoNote")}
        features={[
          {
            label: t("marketing.companies.f1.label"),
            heading: t("marketing.companies.f1.heading"),
            body: t("marketing.companies.f1.body"),
            demo: <CompanyDemo initial="pot" />,
          },
          {
            label: t("marketing.companies.f2.label"),
            heading: t("marketing.companies.f2.heading"),
            body: t("marketing.companies.f2.body"),
            demo: <CompanyDemo initial="code" />,
          },
          {
            label: t("marketing.companies.f3.label"),
            heading: t("marketing.companies.f3.heading"),
            body: t("marketing.companies.f3.body"),
            demo: <CompanyDemo initial="people" />,
          },
          {
            label: t("marketing.companies.f4.label"),
            heading: t("marketing.companies.f4.heading"),
            body: t("marketing.companies.f4.body"),
            demo: <CompanyDemo initial="ledger" />,
          },
          {
            label: t("marketing.companies.f5.label"),
            heading: t("marketing.companies.f5.heading"),
            body: t("marketing.companies.f5.body"),
            demo: <CompanyDemo initial="settings" />,
          },
          {
            label: t("marketing.companies.f6.label"),
            heading: t("marketing.companies.f6.heading"),
            body: t("marketing.companies.f6.body"),
            demo: <CompanyDemo initial="team" />,
          },
        ]}
      />

      <AlsoIncluded
        title={t("ft.also")}
        items={[
          t("marketing.companies.also1"),
          t("marketing.companies.also2"),
          t("marketing.companies.also3"),
          t("marketing.companies.also4"),
          t("marketing.companies.also5"),
          t("marketing.companies.also6"),
        ]}
      />

      {/*
        What it costs a company is what its people's sessions cost, at the share it
        chose, and the sentence under the heading is the portal's own (`sponsor.cov.quoted`).
        The figure is Cairo Foundry's pot, as the meter on `/sponsor/pot` draws it.
      */}
      <div id="cost" className="scroll-mt-20">
        <CostPanel
          label={t("ft.secondary")}
          heading={t("marketing.companies.costHeading")}
          body={t("sponsor.cov.quoted")}
          cta={{ label: t("marketing.companies.cta"), href: "/sponsor/apply" }}
        >
          <Meter
            usedLabel={money(COMPANY.leftEgp)}
            ofLabel={`${t("sponsor.funded")}: ${money(COMPANY.putInEgp)}`}
            fraction={COMPANY.spentEgp / COMPANY.putInEgp}
            note={t("marketing.companies.costNote")}
          />
        </CostPanel>
      </div>

      <AudienceClose
        who="company"
        t={t}
        heading={t("marketing.companies.closeHeading")}
        body={t("marketing.companies.closeBody")}
        cta={{ label: t("marketing.companies.cta"), href: "/sponsor/apply" }}
        secondary={{ label: t("nav.signIn"), href: "/sponsor/sign-in" }}
      />
    </main>
  );
}
