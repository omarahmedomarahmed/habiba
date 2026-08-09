import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { SessionDemo } from "@/components/demo/session-demo";
import { Button } from "@/components/ui";
import { PLANS, formatUsd } from "@/lib/billing/plans";
import type { ContentBlock } from "@/lib/db/schema";

/**
 * Renders CMS content.
 *
 * Blocks are structured data, never HTML. There is no `dangerouslySetInnerHTML`
 * anywhere in this file, and that is the point: the admin console can author
 * this content, and an admin-authored script tag on the public origin would run
 * in the same cookie scope as the clinician portal.
 */
export function BlockRenderer({ blocks, slug }: { blocks: ContentBlock[]; slug: string }) {
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} first={i === 0} />
      ))}
      {slug === "pricing" ? <PricingCards /> : null}
    </>
  );
}

function Block({ block, first }: { block: ContentBlock; first: boolean }) {
  switch (block.type) {
    case "hero":
      return <Hero block={block} first={first} />;
    case "features":
      return <Features block={block} />;
    case "faq":
      return <Faq block={block} />;
    case "cta":
      return <Cta block={block} />;
    case "prose":
      return <Prose block={block} />;
    default:
      return null;
  }
}

function Hero({ block, first }: { block: Extract<ContentBlock, { type: "hero" }>; first: boolean }) {
  const showDemo = block.demo === "session-room";

  return (
    <section className="relative overflow-hidden bg-navy-500 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          {block.eyebrow ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              {block.eyebrow}
            </span>
          ) : null}

          {first ? (
            <h1 className="mt-5 text-balance text-[2.1rem] leading-[1.1] font-bold tracking-tight text-white sm:text-5xl">
              {block.heading}
            </h1>
          ) : (
            <h2 className="mt-5 text-balance text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl">
              {block.heading}
            </h2>
          )}

          {block.body ? (
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/65">{block.body}</p>
          ) : null}

          {block.ctaLabel && block.ctaHref ? (
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={block.ctaHref}>
                <Button size="lg" variant="teal" full className="sm:w-auto">
                  {block.ctaLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="ghost"
                  full
                  className="text-white hover:bg-white/10 sm:w-auto"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          ) : null}
        </div>

        {showDemo ? <SessionDemo /> : null}
      </div>
    </section>
  );
}

function Features({ block }: { block: Extract<ContentBlock, { type: "features" }> }) {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        {block.heading ? (
          <h2 className="max-w-2xl text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {block.heading}
          </h2>
        ) : null}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((item, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-base font-semibold text-slate-900">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq({ block }: { block: Extract<ContentBlock, { type: "faq" }> }) {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl">
        {block.heading ? (
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {block.heading}
          </h2>
        ) : null}
        <dl className="mt-8 divide-y divide-slate-200 border-t border-slate-200">
          {block.items.map((item, i) => (
            <div key={i} className="py-5">
              <dt className="text-base font-semibold text-slate-900">{item.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Cta({ block }: { block: Extract<ContentBlock, { type: "cta" }> }) {
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-4xl rounded-3xl bg-navy-500 px-6 py-12 text-center sm:px-10">
        <h2 className="text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {block.heading}
        </h2>
        {block.body ? (
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-white/65">
            {block.body}
          </p>
        ) : null}
        <Link href={block.ctaHref} className="mt-7 inline-block">
          <Button size="lg" variant="teal">
            {block.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
      </div>
    </section>
  );
}

function Prose({ block }: { block: Extract<ContentBlock, { type: "prose" }> }) {
  return (
    <section className="px-4 sm:px-6">
      <div className="mx-auto max-w-3xl py-5">
        {block.heading ? (
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{block.heading}</h2>
        ) : null}
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{block.body}</p>
      </div>
    </section>
  );
}

/** Plan cards read from the code matrix, so pricing copy cannot drift from billing. */
function PricingCards() {
  const plans = [PLANS.payg, PLANS.unlimited];

  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
        {plans.map((plan) => (
          <div
            key={plan.key}
            className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6"
          >
            <p className="text-sm font-semibold text-brand-600">{plan.name}</p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight text-slate-900">
                {plan.monthlyCents !== null
                  ? formatUsd(plan.monthlyCents)
                  : formatUsd(plan.perSessionCents!)}
              </span>
              <span className="text-sm text-slate-500">
                {plan.monthlyCents !== null ? "/ month" : "/ session"}
              </span>
            </p>
            <p className="mt-2 text-sm text-slate-600">{plan.tagline}</p>

            <ul className="mt-6 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>

            <Link href="/signup" className="mt-6">
              <Button full variant={plan.key === "unlimited" ? "primary" : "secondary"}>
                {plan.firstSessionFree ? "Start — first session free" : "Choose Unlimited"}
              </Button>
            </Link>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-slate-500">
        A HIPAA business associate agreement is included on both plans. We process protected
        health information on your behalf, so that is an obligation rather than an upgrade.
      </p>
    </section>
  );
}
