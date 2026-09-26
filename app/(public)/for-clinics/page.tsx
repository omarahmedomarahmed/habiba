import type { Metadata } from "next";

import { AlsoIncluded, AudienceClose, FeatureBands } from "@/components/public/audience-page";
import { AudienceHero } from "@/components/public/audience-hero";
import { ClinicDemo } from "@/components/public/audience-demos";
import { PricingTiers } from "@/components/public/pricing-tiers";
import { getI18n } from "@/lib/i18n/server";
import { CLINIC_APPLY } from "@/lib/routing";

export const metadata: Metadata = {
  title: "For clinics",
  description:
    "Several clinicians, one practice, one set of books, and a wall your practice cannot see through.",
};

/**
 * 🔴 THE SAME PAGE AS `/for-therapists`, FOR A PRACTICE (founder, 26 Sep).
 *
 * *"Unify the For-* pages. The company and clinic pages are empty; the therapist page
 * is the reference for all other pages to look like."*
 *
 * The hero with the practice's own desk beside it, six numbered bands each opening
 * that desk where the claim is, the list of what is true and has no screen, the clinic
 * price out of the one pricing component, and the closing band.
 *
 * ## The desk is Nile Practice, as Hana Mahmoud signs into it
 *
 * `ClinicDemo` is `/clinic` redrawn with the seeded practice: three clinicians on three
 * seats, the week's bookings in first name and last initial, what each clinician earned
 * and one bill. Every group in its rail and every tab inside a group is pressable.
 *
 * ## 🔴 What went, and where it went
 *
 * The four questions and the "not yet" panel were 60 to 80 words each. Their answers
 * are now either a band with the screen that proves them (a practice sees no note: the
 * wall on the rail; a clinician's money is theirs: the earnings band) or a line in the
 * list (notes stay when a clinician leaves; filing into a record system is not built
 * yet, said as plainly as before).
 *
 * 🔴 The call to action goes to `CLINIC_APPLY`, never `/signup`, which is the
 * individual therapist's signup (see the note that used to live here).
 */
export default async function ForClinicsPage() {
  const { t } = await getI18n();

  return (
    <main>
      <AudienceHero
        eyebrow={t("marketing.clinics.eyebrow")}
        heading={t("marketing.clinics.title")}
        body={t("marketing.clinics.lede")}
        cta={{ label: t("marketing.companies.cta"), href: CLINIC_APPLY }}
        secondary={{ label: t("ft.secondary"), href: "#cost" }}
        demo={<ClinicDemo />}
        note={t("public.demoNote")}
      />

      <FeatureBands
        note={t("public.demoNote")}
        features={[
          /*
            The week is the hero's own screen, so the bands start at the next
            thing a practice manager opens: the clinicians.
          */
          {
            label: t("marketing.clinics.f2.label"),
            heading: t("marketing.clinics.f2.heading"),
            body: t("marketing.clinics.f2.body"),
            demo: <ClinicDemo initial="people" />,
          },
          {
            label: t("marketing.clinics.f3.label"),
            heading: t("marketing.clinics.f3.heading"),
            body: t("marketing.clinics.f3.body"),
            demo: <ClinicDemo initial="team" />,
          },
          {
            label: t("marketing.clinics.f4.label"),
            heading: t("marketing.clinics.f4.heading"),
            body: t("marketing.clinics.f4.body"),
            demo: <ClinicDemo initial="earnings" />,
          },
          {
            label: t("marketing.clinics.f5.label"),
            heading: t("marketing.clinics.f5.heading"),
            body: t("marketing.clinics.f5.body"),
            demo: <ClinicDemo initial="bills" />,
          },
          {
            label: t("marketing.clinics.f6.label"),
            heading: t("marketing.clinics.f6.heading"),
            body: t("marketing.clinics.f6.body"),
            demo: <ClinicDemo initial="seats" />,
          },
          {
            label: t("marketing.clinics.f1.label"),
            heading: t("marketing.clinics.f1.heading"),
            body: t("marketing.clinics.f1.body"),
            demo: <ClinicDemo initial="records" />,
          },
        ]}
      />

      <AlsoIncluded
        title={t("ft.also")}
        items={[
          t("marketing.clinics.also1"),
          t("marketing.clinics.also2"),
          t("marketing.clinics.also3"),
          t("marketing.clinics.also4"),
          t("marketing.clinics.also5"),
          t("marketing.clinics.also6"),
        ]}
      />

      {/* The clinic tier out of the one pricing component, as the therapist page shows its two. */}
      <div id="cost" className="scroll-mt-20">
        <PricingTiers only={["clinic"]} heading={t("ft.secondary")} body={t("marketing.clinics.costBody")} />
      </div>

      <AudienceClose
        who="clinic"
        t={t}
        heading={t("marketing.clinics.closeHeading")}
        body={t("marketing.clinics.closeBody")}
        cta={{ label: t("marketing.companies.cta"), href: CLINIC_APPLY }}
        secondary={{ label: t("nav.signIn"), href: "/clinic/sign-in" }}
      />
    </main>
  );
}
