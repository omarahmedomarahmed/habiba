import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DarkBand, Eyebrow, Glow, btn } from "@/components/public/site-ui";
import { cn } from "@/lib/utils";

/**
 * 🔴 76.84 — THE DEDICATED PAGES OPEN THE WAY THE HOMEPAGE OPENS.
 *
 * ## What was wrong
 *
 * The homepage gave a company a navy hero band and the console live beside
 * it; `/for-companies` began with a 30px black heading on white and the same
 * console pushed down the page. The strongest presentation of an audience's
 * own argument was on the page that is about everybody, which is backwards.
 *
 * ## So every audience page opens with this, and the detail sits under it
 *
 * The mockups' audience hero (`app/design/website/_site/audience.tsx`): the
 * dark band with its faint grid, an eyebrow, a large headline, one line of
 * body, two buttons, and the audience's own working console beside it. The
 * hero is the door and the page behind it is the argument.
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
  note,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
  demo: React.ReactNode;
  /** B30: the screen beside the words is an example, said under it. */
  note?: string;
}) {
  return (
    <DarkBand className="px-5 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
      <Glow className="-start-40 top-20 h-[520px] w-[520px] opacity-60" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="min-w-0 animate-[fade-rise_0.5s_ease-out_both]">
          <Eyebrow dark>{eyebrow}</Eyebrow>

          <h1 className="mt-4 text-balance text-[38px] leading-[1.04] font-bold tracking-tight text-white sm:text-[56px]">
            {heading}
          </h1>

          {/*
            🔴 76.83 — `text-white/65` is 4.1:1 on navy, which is under the
            floor for body text. A reader should not have to lean in to read
            the sentence under the headline.
          */}
          <p className="mt-6 max-w-xl text-pretty text-[18px] leading-relaxed text-white/85">{body}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

        {/* The console, on the navy ground, keeps its own light card and ink. */}
        <div className="min-w-0 text-navy-700">
          {demo}
          {note ? <p className="mt-4 text-center text-[13px] text-white/70">{note}</p> : null}
        </div>
      </div>
    </DarkBand>
  );
}
