import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { ComponentShowcase } from "@/components/demo/component-showcase";
import { SessionDemo } from "@/components/demo/session-demo";
import { ContentIconMark } from "@/components/public/icons";
import { ContactForm } from "@/components/public/contact-form";
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
  const demo = await getDemoContent();

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
      return <Hero block={block} first={first} t={t} />;
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
      return <PricingTiers compact={block.compact} locale={locale} />;
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

function Hero({
  block,
  first,
  t,
}: {
  block: Extract<ContentBlock, { type: "hero" }>;
  first: boolean;
  t: Translate;
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
        className="pointer-events-none absolute -top-40 -end-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -start-32 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          {/*
            🔴 C95 / 21R.10 — the icon sits WITH the text, never on a line of
            its own.

            It used to render as a block between the eyebrow and the heading,
            so every hero opened with a floating square: the founder found it
            by looking at the live site, which is the whole argument for 22R.
            It now shares a row with the eyebrow, and when there is no eyebrow
            it shares one with the heading itself — so there is no arrangement
            of hero content that puts it alone.

            The row is `flex`, not a margin: `gap` and `items-center` are
            direction-agnostic, so Arabic gets the icon on the right of the
            text without a second rule. Anything using `ms-`/`me-` would have
            been correct too; anything using `ml-`/`mr-` would have looked
            fixed in English and wrong in Arabic, which is where this kind of
            thing hides (19.3).
          */}
          {block.eyebrow ? (
            <div className="flex flex-wrap items-center gap-3">
              {block.icon ? (
                <ContentIconMark name={block.icon} tone="light" />
              ) : null}
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                {block.eyebrow}
              </span>
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-3">
            {block.icon && !block.eyebrow ? (
              <ContentIconMark name={block.icon} tone="light" />
            ) : null}
            {first ? (
              <h1 className="text-balance text-[2.1rem] leading-[1.1] font-bold tracking-tight text-white sm:text-5xl">
                {block.heading}
              </h1>
            ) : (
              <h2 className="text-balance text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl">
                {block.heading}
              </h2>
            )}
          </div>

          {block.body ? (
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/65">
              {block.body}
            </p>
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
                  {t("nav.signIn")}
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

function Features({
  block,
}: {
  block: Extract<ContentBlock, { type: "features" }>;
}) {
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
              <p className="mt-3.5 text-base font-semibold text-slate-900">
                {item.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {item.body}
              </p>
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
                <ContentIconMark
                  name={item.icon}
                  tone={i % 2 === 1 ? "teal" : "brand"}
                />
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
              <dt className="text-base font-semibold text-slate-900">
                {item.q}
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {item.a}
              </dd>
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
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {block.heading}
          </h2>
        ) : null}
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
          {block.body}
        </p>
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
function Crisis({
  block,
  t,
}: {
  block: Extract<ContentBlock, { type: "crisis" }>;
  t: Translate;
}) {
  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-3xl border-2 border-rose-200 bg-rose-50 p-6">
        <h2 className="text-lg font-bold tracking-tight text-rose-900">
          {block.heading ?? t("crisis.headingDefault")}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-rose-900/90">
          {block.body ?? t("crisis.bodyDefault")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link href="/radar">
            <Button>{t("crisis.findSomeone")}</Button>
          </Link>
          <Link href="/for-patients">
            <Button variant="secondary">{t("crisis.whatHappens")}</Button>
          </Link>
        </div>
        <p className="mt-3 text-xs text-rose-900/70">
          {t("crisis.noAccountLine")}
        </p>
      </div>
    </section>
  );
}

/**
 * 🔴 18R.6–18R.7 — the two companies.
 *
 * Every field is content: name, address, phone, email, hours, and what to
 * write to each about. Nothing here is hardcoded, so 19 translates it and 21
 * lets an administrator correct an address without a deploy — which matters,
 * because a wrong address on a page like this is the kind of error nobody
 * files a ticket about, they just stop trusting the company.
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
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        {block.heading ? (
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {block.heading}
          </h2>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {ordered.map((company) => (
            <div
              key={company.title}
              className="rounded-3xl border border-slate-200 bg-white p-5"
            >
              <p className="text-sm font-bold text-slate-900">
                {company.title}
              </p>
              {company.body ? (
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {company.body}
                </p>
              ) : null}

              <dl className="mt-3 space-y-1.5 text-sm">
                {company.address ? (
                  <div>
                    <dt className="text-xs text-slate-400">
                      {t("blocks.address")}
                    </dt>
                    <dd className="whitespace-pre-line text-slate-700">
                      {company.address}
                    </dd>
                  </div>
                ) : null}
                {company.phone ? (
                  <div>
                    <dt className="text-xs text-slate-400">
                      {t("blocks.phone")}
                    </dt>
                    <dd>
                      <a
                        href={`tel:${company.phone.replace(/\s/g, "")}`}
                        className="text-brand-600"
                      >
                        {company.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {company.email ? (
                  <div>
                    <dt className="text-xs text-slate-400">
                      {t("blocks.email")}
                    </dt>
                    <dd>
                      <a
                        href={`mailto:${company.email}`}
                        className="text-brand-600"
                      >
                        {company.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {company.hours ? (
                  <div>
                    <dt className="text-xs text-slate-400">
                      {t("blocks.hours")}
                    </dt>
                    <dd className="text-slate-700">{company.hours}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
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
      ] as const
    ).map((key) => [key, t(key)]),
  );

  return (
    <section className="px-4 py-8 sm:px-6">
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
