import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui";
import type { DoorKey } from "@/lib/auth/doors";
import type { Translate } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/**
 * One shape, used by all four audience pages. Task 155.
 *
 * ## What it replaces
 *
 * Three pages in three shapes. `/for-companies` opened with a navy hero and
 * then became a two column essay; `/for-clinics` opened with the same hero and
 * then became four questions in a narrow column; `/for-patients` is a CMS row
 * whose feature tiles render an icon and a title and **discard the body**, so
 * fourteen claims on that page are a heading with nothing under it. There was
 * no `/for-therapists` at all, which is the audience that pays us.
 *
 * ## The rule that keeps it honest
 *
 * **A feature only gets a band if a working component can go in it.** Not a
 * screenshot, not an illustration: the component the product renders, fed
 * fixtures. A feature with nothing to show gets a line in the ruled list at the
 * foot of the nearest band instead.
 *
 * That rule is what stops this becoming the thing it replaces. A page that
 * renders the product cannot describe a product we do not have: delete the
 * feature and the build breaks, which is the only kind of marketing claim that
 * maintains itself. `components/public/audience-demos.tsx` has been doing this
 * for two sprints and it is the precedent.
 *
 * ## Why the ground alternates
 *
 * Eight bands on one ground read as a list, and a reader scrolls past a list.
 * White, then `slate-50`, and the side the component sits on swaps with it, so
 * the eye has to move to follow the argument. The navy ground is spent twice
 * and only twice, at the top and at the bottom, which is what makes it mean
 * anything: the homepage currently stacks five navy heroes and the ground has
 * stopped meaning anything at all there.
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
            className={cn("px-4 py-14 sm:px-6 sm:py-20", mirrored ? "bg-slate-50" : "bg-white")}
          >
            <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
              {/*
                `lg:order-2` on the text when mirrored, rather than two separate
                markup branches. The DOM order stays "picture, then words" in
                both, so a screen reader and a phone get the same sequence
                every time and only the wide layout swaps.
              */}
              <div className={cn("min-w-0", mirrored && "lg:order-2")}>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
                  [ {String(index + 1).padStart(2, "0")} ] {feature.label}
                </p>
                <h2 className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-navy-500 sm:text-[1.75rem]">
                  {feature.heading}
                </h2>
                <p className="mt-3 max-w-[60ch] leading-relaxed text-slate-700">{feature.body}</p>
                {feature.link ? (
                  <Link
                    href={feature.link.href}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    {feature.link.label}
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                  </Link>
                ) : null}
              </div>

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
 * A ruled list, not a grid of cards with icons. Each one is a fact with no
 * screen behind it, and dressing a fact up as a feature tile is exactly how
 * `/for-patients` ended up with fourteen headings and no product.
 */
export function AlsoIncluded({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="bg-white px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {title}
        </h2>
        <ul className="mt-5 grid gap-x-10 border-t border-slate-200 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item}
              className="border-b border-slate-200 py-3.5 text-sm leading-relaxed text-slate-700"
            >
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
    <section className="bg-slate-50 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
          {label}
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-navy-500 sm:text-[1.75rem]">
          {heading}
        </h2>
        {body ? <p className="mt-3 max-w-[60ch] leading-relaxed text-slate-700">{body}</p> : null}

        <div className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
          {children}
        </div>

        {cta ? (
          <Link href={cta.href} className="mt-6 inline-block">
            <Button size="lg">{cta.label}</Button>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The closing band, and the way to the other three pages.
 *
 * The cross links are a hairline row rather than a grid of cards, because a
 * reader who is on the right page should not be offered three equally weighted
 * alternatives to it. They are for the reader who is on the wrong one.
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
    <section className="bg-navy-500 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-balance text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
          {heading}
        </h2>
        {body ? (
          <p className="mt-3 max-w-xl leading-relaxed text-white/85">{body}</p>
        ) : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href={cta.href}>
            <Button size="lg" variant="teal" full className="sm:w-auto">
              {cta.label}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Button>
          </Link>
          {secondary ? (
            <Link href={secondary.href}>
              <Button size="lg" variant="ghost" full className="text-white hover:bg-white/10 sm:w-auto">
                {secondary.label}
              </Button>
            </Link>
          ) : null}
        </div>

        <div className="mt-12 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-t border-white/15 pt-6">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-white/60">
            {t("nav.notYou")}
          </span>
          {others.map((row) => (
            <Link
              key={row.key}
              href={row.href}
              className="text-sm font-medium text-white/85 hover:text-white"
            >
              {row.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
