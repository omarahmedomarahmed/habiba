import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";

import { DarkBand, Eyebrow, Lede, Rise, SiteCard, SiteTitle, btn } from "@/components/public/site-ui";
import type { DoorKey } from "@/lib/auth/doors";
import type { Translate } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/**
 * One shape, used by all four audience pages. Task 155, drawn to the mockups'
 * audience template (`app/design/website/_site/audience.tsx`).
 *
 * ## What it replaces
 *
 * Three pages in three shapes. `/for-companies` opened with a navy hero and
 * then became a two column essay; `/for-clinics` opened with the same hero and
 * then became four questions in a narrow column; `/for-patients` is a CMS row.
 * There was no `/for-therapists` at all, which is the audience that pays us.
 *
 * ## The rule that keeps it honest
 *
 * **A feature only gets a band if a working component can go in it.** Not a
 * screenshot, not an illustration: the component the product renders, fed
 * fixtures. A feature with nothing to show gets a card in the list at the foot
 * of the bands instead.
 *
 * That rule is what stops this becoming the thing it replaces. A page that
 * renders the product cannot describe a product we do not have: delete the
 * feature and the build breaks, which is the only kind of marketing claim that
 * maintains itself.
 *
 * ## Why the ground alternates
 *
 * Eight bands on one ground read as a list, and a reader scrolls past a list.
 * White, then navy-50, and the side the component sits on swaps with it, so
 * the eye has to move to follow the argument. The dark ground is spent at the
 * top and at the bottom, which is what makes it mean anything.
 */

export type Feature = {
  /** A short uppercase label, two or three words. Not a sentence. */
  label: string;
  /** The claim, as a sentence. This is the `h2`. */
  heading: string;
  /** Two lines at most. What the reader gets, not what we built. */
  body: string;
  /**
   * The working component. Required, and that is the point: a feature with
   * nothing to render belongs in `alsoIncluded` rather than in a band.
   */
  demo: React.ReactNode;
  /** Optional, and only to a page that exists. */
  link?: { label: string; href: string };
};

export function FeatureBands({ features }: { features: Feature[] }) {
  return (
    <>
      {features.map((feature, index) => {
        const mirrored = index % 2 === 1;
        return (
          <section
            key={feature.heading}
            className={cn("px-5 py-16 sm:px-6 sm:py-24", mirrored ? "bg-navy-50" : "bg-white")}
          >
            <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
              {/*
                `lg:order-2` on the text when mirrored, rather than two separate
                markup branches. The DOM order stays "words, then picture" in
                both, so a screen reader and a phone get the same sequence
                every time and only the wide layout swaps.
              */}
              <Rise className={cn("min-w-0", mirrored && "lg:order-2")}>
                <Eyebrow>
                  <span className="tabular-nums text-navy-400">{String(index + 1).padStart(2, "0")}</span>
                  <span className="mx-2.5 inline-block h-1 w-1 rounded-full bg-navy-200 align-middle" aria-hidden />
                  {feature.label}
                </Eyebrow>
                <SiteTitle className="mt-3 text-[28px] sm:text-[38px]">{feature.heading}</SiteTitle>
                <Lede className="mt-4">{feature.body}</Lede>
                {feature.link ? (
                  <Link
                    href={feature.link.href}
                    className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {feature.link.label}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                  </Link>
                ) : null}
              </Rise>

              <div className={cn("min-w-0", mirrored && "lg:order-1")}>{feature.demo}</div>
            </div>
          </section>
        );
      })}
    </>
  );
}

/**
 * The things that are true and have nothing to render.
 *
 * The mockups' "what you get" cards, with a tick rather than an invented icon:
 * each one is a fact with no screen behind it, and dressing a fact up as a
 * feature with its own illustration is how `/for-patients` ended up with
 * fourteen headings and no product.
 */
export function AlsoIncluded({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="bg-white px-5 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <Eyebrow>{title}</Eyebrow>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item}
              className="flex gap-4 rounded-[24px] bg-navy-50 p-5 text-[16px] leading-relaxed text-navy-600 ring-1 ring-navy-100"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-brand-300">
                <Check className="h-4 w-4" aria-hidden />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * What it costs this audience, and nobody else.
 *
 * Not the four way pricing table. They told us who they are by being on this
 * page, and a table that makes a clinic read the patient column is a table that
 * makes them do our work.
 */
export function CostPanel({
  label,
  heading,
  body,
  children,
  cta,
}: {
  label: string;
  heading: string;
  body?: string;
  /** The priced thing, ideally something the reader can move. */
  children: React.ReactNode;
  cta?: { label: string; href: string };
}) {
  return (
    <section className="bg-navy-50 px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>{label}</Eyebrow>
        <SiteTitle className="mt-3">{heading}</SiteTitle>
        {body ? <Lede className="mt-4">{body}</Lede> : null}

        <SiteCard className="mt-8">{children}</SiteCard>

        {cta ? (
          <Link href={cta.href} className={cn(btn.dark, "mt-8")}>
            {cta.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The closing band, and the way to the other three pages.
 *
 * The mockups' closing call: the dark band, the slow light behind it, one
 * teal button. The cross links sit under it as a quiet row rather than a grid
 * of cards, because a reader who is on the right page should not be offered
 * three equally weighted alternatives to it. They are for the reader who is on
 * the wrong one.
 */
export function AudienceClose({
  who,
  t,
  heading,
  body,
  cta,
  secondary,
}: {
  who: DoorKey;
  t: Translate;
  heading: string;
  body?: string;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  const others = (
    [
      { key: "therapist", href: "/for-therapists", label: t("nav.forTherapists") },
      { key: "patient", href: "/for-patients", label: t("nav.forPatients") },
      { key: "company", href: "/for-companies", label: t("nav.forCompanies") },
      { key: "clinic", href: "/for-clinics", label: t("nav.forClinics") },
    ] as const
  ).filter((row) => row.key !== who);

  return (
    <DarkBand className="px-5 pt-20 pb-10 sm:px-6 sm:pt-28">
      <div
        aria-hidden
        className="pointer-events-none absolute start-1/2 top-[40%] -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-[spin_18s_linear_infinite] rounded-full motion-reduce:animate-none rtl:translate-x-1/2"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(46,196,182,0.0), rgba(46,196,182,0.35), rgba(46,196,182,0.0) 40%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <SiteTitle dark>{heading}</SiteTitle>
        {body ? (
          <Lede dark className="mx-auto mt-4">
            {body}
          </Lede>
        ) : null}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={cta.href} className={cn(btn.primary, btn.lg)}>
            {cta.label}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
          </Link>
          {secondary ? (
            <Link href={secondary.href} className={cn(btn.light, btn.lg)}>
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="relative mx-auto mt-20 flex max-w-7xl flex-wrap items-center justify-center gap-x-2 gap-y-2 border-t border-white/10 pt-6">
        <span className="me-2 text-[13px] font-bold uppercase tracking-[0.16em] text-white/60 rtl:tracking-normal">
          {t("nav.notYou")}
        </span>
        {others.map((row) => (
          <Link
            key={row.key}
            href={row.href}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[14px] font-semibold text-white/85 ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-white"
          >
            {row.label}
            <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
          </Link>
        ))}
      </div>
    </DarkBand>
  );
}
