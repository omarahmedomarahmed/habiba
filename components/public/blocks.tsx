import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { ComponentShowcase } from "@/components/demo/component-showcase";
import { SessionDemo } from "@/components/demo/session-demo";
import { ContentIconMark } from "@/components/public/icons";
import { getDemoContent, type DemoContent } from "@/lib/content/demo";
import { PricingTiers } from "@/components/public/pricing-tiers";
import { RadarHero } from "@/components/radar/radar-hero";
import { Button } from "@/components/ui";
import { safeImageUrl } from "@/lib/content/url";
import type { ContentBlock } from "@/lib/db/schema";

/**
 * Renders CMS content.
 *
 * Blocks are structured data, never HTML. There is no `dangerouslySetInnerHTML`
 * anywhere in this file, and background image URLs are re-validated here even
 * though they were validated on save — a value that reached the database some
 * other way still cannot reach the page.
 */
export async function BlockRenderer({ blocks }: { blocks: ContentBlock[]; slug?: string }) {
  /*
   * 18.13 — the words inside the live components are content too, read once
   * here and handed down. One query for the whole page rather than one per
   * showcase item, and the components stay props-only: nothing below this line
   * can reach a database, which is what makes a real product component safe on
   * an anonymous page.
   */
  const demo = await getDemoContent();

  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} first={i === 0} demo={demo} />
      ))}
    </>
  );
}

function Block({
  block,
  first,
  demo,
}: {
  block: ContentBlock;
  first: boolean;
  demo: DemoContent;
}) {
  switch (block.type) {
    case "hero":
      return <Hero block={block} first={first} />;
    case "features":
      return <Features block={block} />;
    case "showcase":
      return <Showcase block={block} demo={demo} />;
    case "faq":
      return <Faq block={block} />;
    case "cta":
      return <Cta block={block} />;
    case "prose":
      return <Prose block={block} />;
    /*
     * 17.7 — the prices are a block now, not a special case keyed on the slug.
     *
     * The old renderer appended `PricingCards` when `slug === "pricing"`,
     * which is why the cards could only ever be at the bottom of one page.
     * As a block they can be first (17.2), they can appear on the homepage,
     * and sprint 21's admin can move them — without either page owning a
     * second copy of a number.
     */
    case "pricing":
      return <PricingTiers compact={block.compact} />;
    /* 🔴 18.3 — help now, on the page, never behind a signup. */
    case "crisis":
      return <Crisis block={block} />;
    default:
      return null;
  }
}

function Hero({ block, first }: { block: Extract<ContentBlock, { type: "hero" }>; first: boolean }) {
  /*
   * The radar hero is not a panel beside some copy — the live map is the
   * background of the whole fold and the clinicians on it are clickable. So it
   * owns its own <section> rather than being slotted into this one.
   */
  if (block.demo === "radar") {
    return <RadarHero heading={block.heading} body={block.body} eyebrow={block.eyebrow} />;
  }

  const image = safeImageUrl(block.backgroundImage);

  return (
    <section className="relative overflow-hidden bg-navy-500 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
      {image ? (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${image})` }}
          />
          {/* Keeps text contrast usable whatever image an admin chooses. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-navy-600/95 via-navy-500/85 to-navy-600/95"
          />
        </>
      ) : null}

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

          {block.icon ? <ContentIconMark name={block.icon} tone="light" className="mt-5" /> : null}

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

        {block.demo === "session-room" ? <SessionDemo /> : null}
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
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white/80 p-5 backdrop-blur-sm"
            >
              <ContentIconMark name={item.icon} />
              <p className="mt-3.5 text-base font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * One value at a time, each beside the real component that demonstrates it.
 *
 * Alternating sides so a long page does not read as a column of identical rows.
 */
function Showcase({
  block,
  demo,
}: {
  block: Extract<ContentBlock, { type: "showcase" }>;
  demo: DemoContent;
}) {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        {block.heading ? (
          <h2 className="max-w-2xl text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {block.heading}
          </h2>
        ) : null}

        <div className="mt-10 space-y-14 sm:space-y-20">
          {block.items.map((item, i) => (
            <div
              key={i}
              className="grid items-center gap-6 lg:grid-cols-2 lg:gap-14"
            >
              <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
                <ContentIconMark name={item.icon} tone={i % 2 === 1 ? "teal" : "brand"} />
                <h3 className="mt-4 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  {item.title}
                </h3>
                <p className="mt-2.5 max-w-lg text-[15px] leading-relaxed text-slate-600">
                  {item.body}
                </p>
              </div>

              <div className={i % 2 === 1 ? "lg:order-1" : undefined}>
                <ComponentShowcase demo={item.demo} content={demo} />
              </div>
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
  const image = safeImageUrl(block.backgroundImage);

  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-navy-500 px-6 py-12 text-center sm:px-10">
        {image ? (
          <>
            <div
              aria-hidden
              className="absolute inset-0 bg-cover bg-center opacity-25"
              style={{ backgroundImage: `url(${image})` }}
            />
            <div aria-hidden className="absolute inset-0 bg-navy-600/80" />
          </>
        ) : null}

        <div className="relative">
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


/**
 * 🔴 18.3 — getting help now.
 *
 * Never behind a signup, never a link to a page that then asks for an account,
 * and never softer than the thing it is for. Two routes out: the radar, which
 * is a clinician in minutes, and the local emergency number, which is what to
 * do when minutes are too long.
 *
 * The words are editable (they are wrong in some countries and a person who
 * knows better must be able to fix them without a deploy) but the block itself
 * carries no configurable *destination*: a fire exit does not move.
 */
function Crisis({ block }: { block: Extract<ContentBlock, { type: "crisis" }> }) {
  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-3xl border-2 border-rose-200 bg-rose-50 p-6">
        <h2 className="text-lg font-bold tracking-tight text-rose-900">
          {block.heading ?? "If you need help right now"}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-rose-900/90">
          {block.body ??
            "If you are in immediate danger, call your local emergency number now — this is not an emergency service and nobody here can reach you fast enough. If you can wait a few minutes, the radar has clinicians online this minute and you do not need an account to use it."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link href="/radar">
            <Button>Find someone online now</Button>
          </Link>
          <Link href="/for-patients">
            <Button variant="secondary">What happens in a session</Button>
          </Link>
        </div>
        <p className="mt-3 text-xs text-rose-900/70">
          No account, no card, no form. You give a first name and you are in a session.
        </p>
      </div>
    </section>
  );
}
