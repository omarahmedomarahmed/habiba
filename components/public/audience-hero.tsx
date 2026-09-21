import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui";

/**
 * 🔴 76.84 — THE DEDICATED PAGES OPEN THE WAY THE HOMEPAGE OPENS.
 *
 * ## What was wrong
 *
 * The homepage gives a company a navy hero band: an eyebrow, a headline at 40
 * to 48px, one line of body, and the sponsor console live beside it. Follow the
 * "How it works for companies" button off that band and `/for-companies` began
 * with a 30px black heading on white and a grey paragraph, with the same
 * console pushed down the page as a second column.
 *
 * So the strongest presentation of an audience's own argument was on the page
 * that is about everybody, and the page that is about THEM opened like an FAQ.
 * A reader who arrived from the homepage felt the page get quieter as they went
 * deeper into it, which is backwards.
 *
 * ## So both pages open with this, and the detail sits under it
 *
 * Same band, same proportions, same console. What follows on each page is what
 * the homepage has no room for: the wall drawn out, the four questions a
 * practice manager should ask, the steps, the application form. The hero is the
 * door and the page behind it is the argument.
 *
 * ## It renders a node rather than picking a demo
 *
 * The caller passes the console it wants. This component stays a server
 * component that imports no demo, so a page that wants the clinic console does
 * not drag the sponsor's fixtures into its bundle, and `verify:boundary` has
 * nothing to complain about: nothing crosses the line here but JSX.
 */
export function AudienceHero({
  eyebrow,
  heading,
  body,
  cta,
  secondary,
  demo,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
  demo: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-navy-500 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -end-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -start-32 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/85">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            {eyebrow}
          </span>

          <h1 className="mt-5 text-balance text-[2.1rem] leading-[1.1] font-bold tracking-tight text-white sm:text-5xl">
            {heading}
          </h1>

          {/*
            🔴 76.83 — `text-white/65` is 4.1:1 on this navy, which is under the
            floor for body text. The heroes in `blocks.tsx` used it and this one
            does not: the whole point of the sweep was that a reader should not
            have to lean in to read the sentence under the headline.
          */}
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/85">{body}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href={cta.href}>
              <Button size="lg" variant="primary" full className="sm:w-auto">
                {cta.label}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </Button>
            </Link>
            {secondary ? (
              <Link href={secondary.href}>
                <Button
                  size="lg"
                  variant="ghost"
                  full
                  className="text-white hover:bg-white/10 sm:w-auto"
                >
                  {secondary.label}
                </Button>
              </Link>
            ) : null}
          </div>
        </div>

        {demo}
      </div>
    </section>
  );
}
