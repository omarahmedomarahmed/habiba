import type { Metadata } from "next";

import { ComponentShowcase } from "@/components/demo/component-showcase";
import { SessionDemo } from "@/components/demo/session-demo";
import { AlsoIncluded, AudienceClose, FeatureBands } from "@/components/public/audience-page";
import { AudienceHero } from "@/components/public/audience-hero";
import { PricingTiers } from "@/components/public/pricing-tiers";
import { getDemoContent } from "@/lib/content/demo";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "For therapists",
  description:
    "The session is transcribed as it happens and the note is drafted by the time you stand up. You read it, change what is wrong, and sign it.",
};

/**
 * The page for the audience that pays us. Task 155.
 *
 * ## Why this did not exist
 *
 * Companies and clinics each had a page. The therapist's story lived on the
 * homepage, mixed in with three other audiences, and `grep -rn "for-therapists"`
 * over the repository returned nothing. The header now offers four audience
 * pages and three of them existed.
 *
 * ## Every band renders the product
 *
 * Six features, six working components, all of them the ones the app itself
 * renders and all of them fed fixtures out of `lib/content/demo.ts`, which
 * imports nothing and reaches no row. Delete a feature and this page stops
 * building, which is the only kind of marketing claim that maintains itself.
 *
 * ## 🔴 Two things that are deliberately NOT on this page
 *
 * **The calendar.** `components/scheduling/calendar.tsx` renders an empty month
 * and only shows a day's bookings once that day is clicked, and rows are
 * written in exactly one place, so a clinician who books from `/sessions/new`
 * sees an empty calendar in every view. Advertising it would be selling the
 * defect. It is one line in the list at the bottom until task 140 lands.
 *
 * **The room.** It has a 547px empty column beside the transcript for an
 * in-person session and shows statuses that contradict each other. `SessionDemo`
 * is the room's behaviour, not its current layout, which is why the hero uses
 * the demo and not a screenshot. Task 136.
 */
export default async function ForTherapistsPage() {
  const [{ t }, demo] = await Promise.all([getI18n(), getDemoContent()]);

  return (
    <main>
      <AudienceHero
        eyebrow={t("ft.eyebrow")}
        heading={t("ft.title")}
        body={t("ft.lede")}
        cta={{ label: t("ft.cta"), href: "/signup" }}
        secondary={{ label: t("ft.secondary"), href: "#cost" }}
        demo={
          /*
            🔴 Strings, not `t` itself. `SessionDemo` is a client component and
            `verify:boundary` refuses a function crossing that line. Same call
            shape as the homepage hero, deliberately: one demo, one set of
            labels, two places that cannot drift.
          */
          <SessionDemo
            content={demo}
            labels={{
              inProgress: t("hdemo.inProgress"),
              ended: t("hdemo.ended"),
              meta: t("hdemo.meta"),
              play: t("hdemo.play"),
              pause: t("hdemo.pause"),
              replay: t("hdemo.replay"),
              recording: t("hdemo.recording"),
              endSession: t("hdemo.endSession"),
              waiting: t("hdemo.waiting"),
              generated: t("hdemo.generated"),
              disclaimer: t("hdemo.disclaimer"),
              patientLabel: t("hdemo.patientLabel"),
            }}
          />
        }
      />

      <FeatureBands
        note={t("public.demoNote")}
        features={[
          {
            label: t("ft.f1.label"),
            heading: t("ft.f1.heading"),
            body: t("ft.f1.body"),
            demo: <ComponentShowcase demo="transcript" content={demo} />,
          },
          {
            label: t("ft.f2.label"),
            heading: t("ft.f2.heading"),
            body: t("ft.f2.body"),
            demo: <ComponentShowcase demo="note" content={demo} />,
          },
          {
            label: t("ft.f3.label"),
            heading: t("ft.f3.heading"),
            body: t("ft.f3.body"),
            demo: <ComponentShowcase demo="risk" content={demo} />,
          },
          {
            label: t("ft.f4.label"),
            heading: t("ft.f4.heading"),
            body: t("ft.f4.body"),
            demo: <ComponentShowcase demo="copilot" content={demo} />,
          },
          {
            label: t("ft.f5.label"),
            heading: t("ft.f5.heading"),
            body: t("ft.f5.body"),
            demo: <ComponentShowcase demo="patient-sessions" content={demo} />,
            link: { label: t("nav.forPatients"), href: "/for-patients" },
          },
          {
            label: t("ft.f6.label"),
            heading: t("ft.f6.heading"),
            body: t("ft.f6.body"),
            demo: <ComponentShowcase demo="radar" content={demo} />,
            link: { label: t("nav.openRadar"), href: "/radar" },
          },
        ]}
      />

      <AlsoIncluded
        title={t("ft.also")}
        items={[
          t("ft.also1"),
          t("ft.also2"),
          t("ft.also3"),
          t("ft.also4"),
          t("ft.also5"),
          t("ft.also6"),
        ]}
      />

      {/*
        🔴 The two tiers a solo clinician chooses between, and not the third.

        `PricingTiers` filtered rather than a price panel written here. A second
        hand-written price is a second price to keep true, and this repository
        has already paid for that class of defect twice.
      */}
      <div id="cost" className="scroll-mt-20">
        <PricingTiers
          only={["payg", "practice"]}
          heading={t("ft.costHeading")}
          body={t("ft.costBody")}
        />
      </div>

      <AudienceClose
        who="therapist"
        t={t}
        heading={t("ft.closeHeading")}
        body={t("ft.closeBody")}
        cta={{ label: t("ft.cta"), href: "/signup" }}
        secondary={{ label: t("nav.signIn"), href: "/login" }}
      />
    </main>
  );
}
