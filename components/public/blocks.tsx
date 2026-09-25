import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";

import { AudienceRotator } from "@/components/public/audience-rotator";
import { ComponentShowcase } from "@/components/demo/component-showcase";
import { HowItWorks } from "@/components/public/how-it-works";
import { ClaimFlowDemo, ConsentFlowDemo } from "@/components/demo/flow-demo";
import { ClinicDemo, CompanyDemo, TherapistSplitDemo } from "@/components/public/audience-demos";
import { FlowStrip, SeesWhat } from "@/components/visual/primitives";
import { SessionDemo } from "@/components/demo/session-demo";
import { ContentIconMark } from "@/components/public/icons";
import { ContactForm } from "@/components/public/contact-form";
import { Comparison, Vendors } from "@/components/public/comparison";
import { getDemoContent, type DemoContent } from "@/lib/content/demo";
import { getI18n, type Translate } from "@/lib/i18n/server";

/** The dictionary for a named language, when the caller knows which. */
async function stringsForLocale(
  locale: string,
): Promise<{ locale: string; t: Translate }> {
  const { stringsFor } = await import("@/lib/i18n/strings");
  const { t } = await stringsFor(locale);
  return { locale, t: t as Translate };
}
import { getCountries } from "@/lib/settings";
import { PricingTiers } from "@/components/public/pricing-tiers";
import { RadarHero } from "@/components/radar/radar-hero";
import { DarkBand, Glow, Lede, Rise, SiteCard, SiteTitle, btn } from "@/components/public/site-ui";
import { FaqList } from "@/components/public/site-motion";
import { cn } from "@/lib/utils";
import { safeImageUrl } from "@/lib/content/url";
import type { ContentBlock, ContentDemo } from "@/lib/db/schema";

/**
 * Renders CMS content.
 *
 * Blocks are structured data, never HTML. There is no `dangerouslySetInnerHTML`
 * anywhere in this file, and background image URLs are re-validated here even
 * though they were validated on save — a value that reached the database some
 * other way still cannot reach the page.
 */
export async function BlockRenderer({
  blocks,
  locale,
}: {
  blocks: ContentBlock[];
  slug?: string;
  /**
   * 🔴 21R.8 — the language of the *row*, when the caller already knows it.
   *
   * In the running app this is not passed and must not be: the chrome follows
   * the *reader*, which is what `getI18n()` reads from the cookie. That is the
   * right answer even when the row falls back — an Arabic reader on an
   * English-only legal page should still get Arabic buttons around it.
   *
   * It exists for the render check, which has no cookie: it picks a row by
   * locale and would otherwise assert about Arabic content wrapped in whatever
   * language a script happened to default to, which is a test of the script.
   */
  locale?: string;
}) {
  /*
   * 18.13 — the words inside the live components are content too, read once
   * here and handed down. One query for the whole page rather than one per
   * showcase item, and the components stay props-only: nothing below this line
   * can reach a database, which is what makes a real product component safe on
   * an anonymous page.
   */
  /*
   * 🔴 28.1 — the demo is read in the SAME language the chrome is.
   *
   * It used to ask the runtime, which throws outside a request, so every
   * script-rendered Arabic page fell through to the English constant: Arabic
   * paragraphs around a transcript panel holding an English conversation.
   * That is worse than a screenshot, because it looks like the product cannot
   * do Arabic. The locale arrives as a prop for exactly this reason (C84), so
   * the demo takes it too.
   */
  const demo = await getDemoContent(locale);

  /*
   * 🔴 21R.8 — the reader's language, resolved once here and handed down.
   *
   * The CMS blocks were translated from sprint 19; the *chrome* around them
   * was not, so an Arabic page rendered Arabic paragraphs between English
   * buttons — including the two buttons under the crisis panel. Read once,
   * like `demo` above, because nothing below this line may reach a database
   * or ask the runtime what language it is (C84).
   */
  const i18n = locale ? await stringsForLocale(locale) : await getI18n();
  const t = i18n.t;

  return (
    <>
      {blocks.map((block, i) => (
        <Block
          key={i}
          block={block}
          first={i === 0}
          demo={demo}
          t={t}
          locale={i18n.locale}
        />
      ))}
    </>
  );
}

function Block({
  block,
  first,
  demo,
  t,
  locale,
}: {
  block: ContentBlock;
  first: boolean;
  demo: DemoContent;
  t: Translate;
  /** The language everything below renders in — the row's, or the reader's. */
  locale: string;
}) {
  switch (block.type) {
    case "hero":
      return <Hero block={block} first={first} t={t} demo={demo} />;
    /*
     * 🔴 Task 137 — the five stacked heroes, collapsed into one.
     *
     * The homepage carried a `hero` block for the radar and four more, one per
     * audience, all on the navy ground. A reader scrolled past three arguments
     * that were not theirs to reach the one that was, and the dark ground
     * spent five times running had stopped meaning anything.
     */
    case "audiences":
      return <Audiences block={block} demo={demo} t={t} />;
    case "howItWorks":
      return <HowItWorksBlock block={block} demo={demo} t={t} />;
    case "features":
      return <Features block={block} />;
    case "showcase":
      return <Showcase block={block} demo={demo} t={t} />;
    case "faq":
      return <Faq block={block} />;
    case "walkthrough":
      return block.which === "claim" ? <ClaimFlowDemo /> : <ConsentFlowDemo />;
    case "competitors":
      return <Comparison block={block} />;
    case "vendors":
      return <Vendors block={block} />;
    /*
     * 🔴 65.20 — THE MARKETING SITE DRAWS THE SAME SHAPES THE PORTALS DO.
     *
     * `FlowStrip` and `SeesWhat` are `components/visual/primitives.tsx`, the vocabulary
     * the patient app, the clinic portal and the sponsor portal all render. A rule
     * described on the public site and drawn inside the product is a rule a reader has
     * to learn twice; these are the same component, so it is not.
     */
    case "flow":
      return (
        <Section heading={block.heading}>
          <FlowStrip steps={block.steps} />
        </Section>
      );
    case "seesWhat":
      return (
        <Section heading={block.heading}>
          <SeesWhat who={block.who} can={block.can} cannot={block.cannot} />
        </Section>
      );
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
      return <PricingTiers compact={block.compact} locale={locale} asPageTitle={first} />;
    /* 🔴 18.3 — help now, on the page, never behind a signup. */
    case "crisis":
      return <Crisis block={block} t={t} />;
    /* 18R.6 — two companies, both always visible. */
    case "companies":
      return <Companies block={block} t={t} />;
    /* 18R.2 — a real form, not a mailto: link. */
    case "contact_form":
      return <ContactBlock block={block} t={t} />;
    default:
      return null;
  }
}

/**
 * 🔴 THE FOUR PANELS ARE BUILT HERE, ON THE SERVER, and handed down as nodes.
 *
 * `AudienceRotator` is a client component and `verify:boundary` refuses a
 * function crossing that line, so it cannot be given `t` and cannot pick its
 * own demos. It is given four finished React trees and a string each. That
 * also means the demos are the same `ComponentShowcase` every other page
 * renders rather than a second way of choosing one.
 */
function Audiences({
  block,
  demo,
  t,
}: {
  block: Extract<ContentBlock, { type: "audiences" }>;
  demo: DemoContent;
  t: Translate;
}) {
  return (
    <AudienceRotator
      eyebrow={t("nav.whichAreYou")}
      stem={block.stem}
      live={{
        checking: t("radar.checking"),
        online: t("radar.online", { count: "{count}" }),
        nobody: t("public.nobodyOnline"),
      }}
      demoNote={t("public.demoNote")}
      cta={
        block.ctaLabel && block.ctaHref
          ? { label: block.ctaLabel, href: block.ctaHref }
          : undefined
      }
      panels={block.panels.map((panel) => ({
        label: panel.label,
        clause: panel.clause,
        body: panel.body,
        href: panel.href,
        hrefLabel: panel.hrefLabel,
        demo: <DemoFor name={panel.demo} demo={demo} t={t} />,
      }))}
    />
  );
}

function HowItWorksBlock({
  block,
  demo,
  t,
}: {
  block: Extract<ContentBlock, { type: "howItWorks" }>;
  demo: DemoContent;
  t: Translate;
}) {
  return (
    <HowItWorks
      heading={block.heading}
      body={block.body}
      items={block.items.map((item) => ({
        audience: item.audience,
        title: item.title,
        body: item.body,
        demo: <DemoFor name={item.demo} demo={demo} t={t} />,
      }))}
    />
  );
}

/**
 * 🔴 ONE PLACE THAT TURNS A DEMO NAME INTO A COMPONENT. Task 137.
 *
 * Before this the names were split across two renderers. `ComponentShowcase`
 * knew the clinical and patient ones; `session-room`, `company`, `clinic` and
 * `fee-split` were handled by hand inside `Hero` and existed nowhere else. So
 * half the product was renderable on one block type and invisible to every
 * other: a `showcase` could not show the session room, and a `howItWorks` tile
 * could not show a clinic console.
 *
 * One function, every name, used by `hero`, `showcase`, `audiences` and
 * `howItWorks` alike. Adding the next demo is one entry in `CONTENT_DEMOS` and
 * one case here, rather than a decision about which blocks may see it.
 *
 * `radar` is deliberately NOT here: the live map is a whole fold with its own
 * section and its own strings, not a panel that slots into a column. `Hero`
 * still branches on it before reaching this, and `ComponentShowcase` maps the
 * name to the patient app's radar tab for everywhere else.
 */
function DemoFor({
  name,
  demo,
  t,
}: {
  name: ContentDemo | undefined;
  demo: DemoContent;
  t: Translate;
}) {
  if (!name || name === "none") return null;

  if (name === "session-room") {
    /*
     * 🔴 76.32 — strings, not `t` itself. `SessionDemo` is a client component
     * and `verify:boundary` refuses a function crossing that line. The content
     * comes from `lib/content/demo.ts` and the chrome from the dictionary, so
     * an Arabic reader does not get an Arabic frame around an English
     * conversation producing an English note.
     */
    return (
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
    );
  }
  if (name === "company") return <CompanyDemo />;
  if (name === "company-pot") return <CompanyDemo initial="pot" />;
  if (name === "company-wall") return <CompanyDemo initial="people" />;
  if (name === "clinic") return <ClinicDemo />;
  if (name === "clinic-people") return <ClinicDemo initial="people" />;
  if (name === "fee-split") return <TherapistSplitDemo />;
  return <ComponentShowcase demo={name} content={demo} />;
}

function Hero({
  block,
  first,
  t,
  demo,
}: {
  block: Extract<ContentBlock, { type: "hero" }>;
  first: boolean;
  t: Translate;
  /** 🔴 76.32 — the demonstration inside the fold, in the reader's language. */
  demo: DemoContent;
}) {
  /*
   * The radar hero is not a panel beside some copy — the live map is the
   * background of the whole fold and the clinicians on it are clickable. So it
   * owns its own <section> rather than being slotted into this one.
   */
  if (block.demo === "radar") {
    return (
      <RadarHero
        heading={block.heading}
        body={block.body}
        eyebrow={block.eyebrow}
        strings={{
          checking: t("radar.checking"),
          online: t("radar.online", { count: "{count}" }),
          private: t("radar.private"),
          noAccount: t("radar.noAccount"),
          fromPrice: t("radar.fromPrice", { price: "{price}" }),
          free: t("radar.free"),
          goOnRadar: t("radar.goOnRadar"),
          full: t("radar.full"),
          finding: t("radar.finding"),
          nobody: t("radar.nobody"),
          nobodyMatching: t("radar.nobodyMatching"),
          appearWhenOnline: t("radar.appearWhenOnline"),
          othersAvailable: t("radar.othersAvailable", { count: "{count}" }),
          showEveryone: t("radar.showEveryone"),
          notEmergency: t("crisis.notEmergency"),
        }}
      />
    );
  }

  const image = safeImageUrl(block.backgroundImage);

  /* The demos this band can draw beside its words. Anything else is words alone, full width. */
  const hasDemo =
    block.demo === "session-room" ||
    block.demo === "patient-app" ||
    block.demo === "company" ||
    block.demo === "clinic" ||
    block.demo === "fee-split";

  return (
    <DarkBand className="px-5 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
      {image ? (
        <>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${image})` }}
          />
          {/* Keeps text contrast usable whatever image an admin chooses. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-900/90 via-navy-900/80 to-navy-900"
          />
        </>
      ) : null}
      <Glow className="-start-40 top-10 h-[520px] w-[520px] opacity-60" />

      <div
        className={cn(
          "relative mx-auto grid max-w-7xl items-center gap-12",
          hasDemo ? "lg:grid-cols-2 lg:gap-16" : "max-w-4xl",
        )}
      >
        <div className="min-w-0 animate-[fade-rise_0.5s_ease-out_both]">
          {/*
            🔴 C95 / 21R.10 — the icon sits WITH the text, never on a line of
            its own. It shares a row with the eyebrow, and when there is no
            eyebrow it shares one with the heading itself, so there is no
            arrangement of hero content that puts it alone.

            The row is `flex` with `gap`, which is direction-agnostic, so
            Arabic gets the icon on the right of the text without a second rule
            (19.3).
          */}
          {block.eyebrow ? (
            <div className="flex flex-wrap items-center gap-3">
              {block.icon ? <ContentIconMark name={block.icon} tone="light" /> : null}
              <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-[13px] font-semibold text-white ring-1 ring-white/15">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                {block.eyebrow}
              </span>
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            {block.icon && !block.eyebrow ? <ContentIconMark name={block.icon} tone="light" /> : null}
            {first ? (
              <h1 className="text-balance text-[38px] leading-[1.04] font-bold tracking-tight text-white sm:text-[56px]">
                {block.heading}
              </h1>
            ) : (
              <h2 className="text-balance text-[30px] leading-[1.1] font-bold tracking-tight text-white sm:text-[44px]">
                {block.heading}
              </h2>
            )}
          </div>

          {block.body ? (
            <p className="mt-6 max-w-xl text-pretty text-[18px] leading-relaxed text-white/85">{block.body}</p>
          ) : null}

          {block.ctaLabel && block.ctaHref ? (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={block.ctaHref} className={cn(btn.primary, btn.lg)}>
                {block.ctaLabel}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </Link>
              <Link href="/login" className={cn(btn.light, btn.lg)}>
                {t("nav.signIn")}
              </Link>
            </div>
          ) : null}
        </div>

        {/*
          🔴 65.15 / 65.17 — THE HERO'S DEMO IS THE AUDIENCE'S OWN COMPONENT,
          fed synthetic fixtures (65.19), so a hero cannot outlive the feature
          it is about.

          🔴 76.32 — AND THE DEMO INSIDE IT SPEAKS THE PAGE'S LANGUAGE. The
          content comes from `lib/content/demo.ts`, the chrome from the
          dictionary. Strings, not `t` itself: `SessionDemo` is a client
          component and `verify:boundary` refuses a function crossing that line.
        */}
        {block.demo === "session-room" ? (
          <div className="min-w-0 text-navy-700">
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
          </div>
        ) : null}
        {/*
          🔴 76.81 — THE PATIENT'S APP, IN A HERO, WORKING. A sequence a reader
          RUNS: open the radar, pick somebody, see the price with the tax on
          it, go in. It books nothing; see the component.
        */}
        {block.demo === "patient-app" ? (
          <div className="min-w-0">
            <ComponentShowcase demo="patient-app" content={demo} />
            {/* B30: the clinicians in it are invented, said under it rather than left to be inferred. */}
            <p className="mt-4 text-center text-[13px] text-white/70">{t("public.demoNote")}</p>
          </div>
        ) : null}
        {block.demo === "company" ? <div className="min-w-0 text-navy-700"><CompanyDemo /></div> : null}
        {block.demo === "clinic" ? <div className="min-w-0 text-navy-700"><ClinicDemo /></div> : null}
        {block.demo === "fee-split" ? <div className="min-w-0 text-navy-700"><TherapistSplitDemo /></div> : null}
      </div>
    </DarkBand>
  );
}

/**
 * 🔴 76.74 — THE GRID IS SIZED BY ITS COUNT.
 *
 * Four tiles in a three-column grid is three and a lonely one; six in a
 * two-column grid is a tall list nobody reaches the bottom of. Four go two by
 * two, six go three by two, and anything else three across, which is the
 * least-bad arrangement for a count nobody planned.
 *
 * The mockups' card: a tinted tile, the icon on a white badge, the claim in
 * bold and the line under it quiet. `item.body` is drawn when it is there and
 * stays editable in the row either way (76.74: not drawing content is
 * reversible; deleting it is not).
 */
function Features({
  block,
}: {
  block: Extract<ContentBlock, { type: "features" }>;
}) {
  const count = block.items.length;
  return (
    <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-7xl">
        {block.heading ? <SiteTitle className="max-w-3xl">{block.heading}</SiteTitle> : null}
        <ul
          className={cn(
            "mt-10 grid gap-4 sm:grid-cols-2",
            count === 4 ? "" : count % 3 === 0 || count > 4 ? "lg:grid-cols-3" : "",
          )}
        >
          {block.items.map((item, i) => (
            <li key={i}>
              <Rise delay={(i % 3) * 0.06} className="h-full">
                <div className="h-full rounded-[26px] bg-navy-50 p-6 ring-1 ring-navy-100">
                  <ContentIconMark name={item.icon} tone="card" />
                  <p className="mt-5 text-[18px] font-bold leading-snug text-navy-700">{item.title}</p>
                  {item.body ? (
                    <p className="mt-2 text-[15px] leading-relaxed text-navy-500">{item.body}</p>
                  ) : null}
                </div>
              </Rise>
            </li>
          ))}
        </ul>
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
  t,
}: {
  block: Extract<ContentBlock, { type: "showcase" }>;
  demo: DemoContent;
  t: Translate;
}) {
  const head = (
    <>
      {block.heading ? <SiteTitle className="max-w-3xl">{block.heading}</SiteTitle> : null}
      {block.body ? <Lede className="mt-4">{block.body}</Lede> : null}
    </>
  );

  /*
   * 🔴 SCREENS BESIDE EACH OTHER, for the case where a reader is comparing two
   * rather than being argued at about one. Side by side, the caption goes
   * under the screen it describes and the section is half as tall.
   */
  if (block.side) {
    return (
      <section className="bg-navy-50 px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          {head}
          <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-8 lg:gap-12">
            {block.items.map((item, i) => (
              <figure key={i} className="m-0 min-w-0">
                <DemoFor name={item.demo} demo={demo} t={t} />
                <figcaption className="mt-6">
                  <ContentIconMark name={item.icon} tone={i % 2 === 1 ? "dark" : "card"} />
                  <h3 className="mt-4 text-[20px] font-bold tracking-tight text-navy-700">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-navy-500">{item.body}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-7xl">
        {head}

        <div className="mt-12 space-y-16 sm:space-y-24">
          {block.items.map((item, i) => (
            <div key={i} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <div className={cn("min-w-0", i % 2 === 1 && "lg:order-2")}>
                <ContentIconMark name={item.icon} tone={i % 2 === 1 ? "dark" : "card"} />
                <h3 className="mt-5 text-balance text-[24px] font-bold leading-tight tracking-tight text-navy-700 sm:text-[30px]">
                  {item.title}
                </h3>
                <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-navy-500">{item.body}</p>
              </div>

              <div className={cn("min-w-0", i % 2 === 1 && "lg:order-1")}>
                <DemoFor name={item.demo} demo={demo} t={t} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The mockups' questions: the heading on one side, one answer open at a time on the other. */
function Faq({ block }: { block: Extract<ContentBlock, { type: "faq" }> }) {
  return (
    <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>{block.heading ? <SiteTitle>{block.heading}</SiteTitle> : null}</div>
        <FaqList items={block.items.map((item) => ({ q: item.q, a: item.a }))} />
      </div>
    </section>
  );
}

function Cta({ block }: { block: Extract<ContentBlock, { type: "cta" }> }) {
  const image = safeImageUrl(block.backgroundImage);

  return (
    <DarkBand className="px-5 py-20 sm:px-6 sm:py-28">
      {image ? (
        <>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${image})` }}
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-navy-900/80" />
        </>
      ) : null}
      {/* The mockups' slow turning light behind the last call on the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute start-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-[spin_18s_linear_infinite] rounded-full motion-reduce:animate-none rtl:translate-x-1/2"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(46,196,182,0.0), rgba(46,196,182,0.35), rgba(46,196,182,0.0) 40%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <SiteTitle dark>{block.heading}</SiteTitle>
        {block.body ? (
          <Lede dark className="mx-auto mt-4">
            {block.body}
          </Lede>
        ) : null}
        <Link href={block.ctaHref} className={cn(btn.primary, btn.lg, "mt-8")}>
          {block.ctaLabel}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Link>
      </div>
    </DarkBand>
  );
}

function Prose({ block }: { block: Extract<ContentBlock, { type: "prose" }> }) {
  return (
    <section className="px-5 sm:px-6">
      <div className="mx-auto max-w-3xl py-5">
        {block.heading ? (
          <h2 className="text-[20px] font-bold tracking-tight text-navy-700">{block.heading}</h2>
        ) : null}
        <p className="mt-2 text-[16px] leading-relaxed text-navy-500">{block.body}</p>
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
 * The mockups' red band, the loudest thing on any page: red is spent on help
 * and on nothing else on this site.
 *
 * The words are editable (they are wrong in some countries and a person who
 * knows better must be able to fix them without a deploy) but the block itself
 * carries no configurable *destination*: a fire exit does not move.
 */
function Crisis({
  block,
  t,
}: {
  block: Extract<ContentBlock, { type: "crisis" }>;
  t: Translate;
}) {
  return (
    <section className="bg-red-600 px-5 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Phone className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-bold tracking-tight sm:text-[22px]">
            {block.heading ?? t("crisis.headingDefault")}
          </h2>
          <p className="mt-1.5 max-w-3xl text-[16px] leading-relaxed text-white">
            {block.body ?? t("crisis.bodyDefault")}
          </p>
          <p className="mt-2 text-[13px] font-semibold text-white">{t("crisis.noAccountLine")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2.5">
          <Link
            href="/radar"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-red-700 transition-transform hover:-translate-y-px"
          >
            {t("crisis.findSomeone")}
          </Link>
          <Link
            href="/for-patients"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/60 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
          >
            {t("crisis.whatHappens")}
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * 🔴 18R.6–18R.7 — the two companies.
 *
 * Every field is content: name, address, phone, email, hours, and what to
 * write to each about. Nothing here is hardcoded, so 19 translates it and 21
 * lets an administrator correct an address without a deploy.
 *
 * International sorts first, the same rule the currency follows (§3c), and
 * **both always render**. A reader who cannot tell which entity they are
 * dealing with has not been told, and the point of naming two companies is
 * that they can choose.
 */
function Companies({
  block,
  t,
}: {
  block: Extract<ContentBlock, { type: "companies" }>;
  t: Translate;
}) {
  const ordered = [...block.items].sort((a, b) => {
    if (a.entity === b.entity) return 0;
    return a.entity === "eg" ? 1 : -1;
  });

  return (
    <section className="bg-navy-50 px-5 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        {block.heading ? <SiteTitle className="text-[26px] sm:text-[34px]">{block.heading}</SiteTitle> : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {ordered.map((company) => (
            <SiteCard key={company.title}>
              <p className="text-[18px] font-bold text-navy-700">{company.title}</p>
              {company.body ? (
                <p className="mt-1.5 text-[15px] leading-relaxed text-navy-500">{company.body}</p>
              ) : null}

              <dl className="mt-5 space-y-3 border-t border-navy-100 pt-5 text-[15px]">
                {company.address ? (
                  <div>
                    <dt className="text-[13px] font-semibold text-navy-400">{t("blocks.address")}</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-navy-600">{company.address}</dd>
                  </div>
                ) : null}
                {company.phone ? (
                  <div>
                    <dt className="text-[13px] font-semibold text-navy-400">{t("blocks.phone")}</dt>
                    <dd className="mt-0.5">
                      <a
                        href={`tel:${company.phone.replace(/\s/g, "")}`}
                        dir="ltr"
                        className="font-semibold text-brand-700 hover:text-brand-800"
                      >
                        {company.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {company.email ? (
                  <div>
                    <dt className="text-[13px] font-semibold text-navy-400">{t("blocks.email")}</dt>
                    <dd className="mt-0.5">
                      <a
                        href={`mailto:${company.email}`}
                        className="break-all font-semibold text-brand-700 hover:text-brand-800"
                      >
                        {company.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {company.hours ? (
                  <div>
                    <dt className="text-[13px] font-semibold text-navy-400">{t("blocks.hours")}</dt>
                    <dd className="mt-0.5 text-navy-600">{company.hours}</dd>
                  </div>
                ) : null}
              </dl>
            </SiteCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 18R.2 — the form, with the country list the product actually supports. */
async function ContactBlock({
  block,
  t,
}: {
  block: Extract<ContentBlock, { type: "contact_form" }>;
  t: Translate;
}) {
  const countries = await getCountries();

  /*
   * 21R.8 — every word of the form, resolved here. Listed by key rather than
   * spread from the dictionary so that a string the form needs and nobody
   * translated is a *type* error in `messages.ts`, not a blank label.
   */
  const strings = Object.fromEntries(
    (
      [
        "contact.urgentLead",
        "contact.urgentBody",
        "contact.radarWord",
        "contact.name",
        "contact.reply",
        "contact.replyHint",
        "contact.country",
        "contact.countryAria",
        "contact.phone",
        "contact.topic",
        "contact.topic.account",
        "contact.topic.billing",
        "contact.topic.my_record",
        "contact.topic.a_session",
        "contact.topic.a_therapist",
        "contact.topic.joining_as_a_therapist",
        "contact.topic.something_else",
        "contact.entity",
        "contact.entityHint",
        "contact.entityUs",
        "contact.entityEg",
        "contact.message",
        "contact.attach",
        "contact.attachHint",
        "contact.send",
        "contact.sending",
        "contact.kept",
        "contact.received",
        "contact.reference",
        "contact.attachmentFailed",
        "room.emailPlaceholder",
      ] as const
    ).map((key) => [key, t(key)]),
  );

  return (
    <section className="bg-navy-50 px-5 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
          <ContactForm
            heading={block.heading}
            body={block.body}
            countries={countries.map((country) => ({
              code: country.code,
              name: country.name,
            }))}
            strings={strings}
          />
      </div>
    </section>
  );
}

/**
 * 🔴 ONE WRAPPER FOR THE TWO PRIMITIVE BLOCKS, and it is deliberately plain.
 *
 * A heading and the component. No card, no gradient, no eyebrow: 65.22's rule is that a
 * visual element encodes something true or it does not ship, and a decorative frame
 * around a diagram encodes nothing except that somebody had a frame.
 */
function Section({ heading, children }: { heading?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-5xl px-5 py-14 sm:px-6 sm:py-20">
      {heading ? (
        <SiteTitle className="mb-8 text-[26px] sm:text-[34px]">{heading}</SiteTitle>
      ) : null}
      {children}
    </section>
  );
}
