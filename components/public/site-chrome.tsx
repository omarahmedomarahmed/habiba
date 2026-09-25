import Link from "next/link";
import { headers } from "next/headers";

import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/lib/brand";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { MobileNav } from "@/components/public/mobile-nav";
import { SignInMenu } from "@/components/public/sign-in-menu";
import { getFooterLinks, getPublicNav } from "@/lib/content/service";
import { getI18n } from "@/lib/i18n/server";
import { localisedPath, splitLocale } from "@/lib/i18n/paths";
import { publicLanguages } from "@/lib/i18n/strings";
import { cn } from "@/lib/utils";

/**
 * The site's header and footer, in one place so every page can carry them.
 * Tasks 152, 153, 154.
 *
 * ## Why this moved out of `app/(public)/layout.tsx`
 *
 * Because the sign in and signup pages have to carry it, and they are not in
 * `(public)`. They are spread across `(auth)`, `(patient)`, `(sponsor)` and
 * `(clinic)`, each with its own layout, and every one of them rendered a
 * centred card on an empty slate ground with a text wordmark in the corner.
 * A person deciding whether to trust us with a therapy record was shown, at the
 * exact moment of deciding, a page that looked like it belonged to a different
 * and much smaller product.
 *
 * ## What the header carries, and what it stopped carrying
 *
 * It used to carry the CMS nav rows plus four calls to action: "Talk now",
 * "Sign in", "I need a therapist" and "Start free, for therapists". Two of
 * those were the same button written for two readers, and "Talk now" pointed at
 * the radar, which is now the single call to action and keeps the live dot.
 * That freed the row for the four audience links, which are the pages that
 * actually answer "what is this, for someone like me".
 *
 * The CMS rows are not lost: they moved to the footer, which is where pricing,
 * features and contact belong once every audience page carries its own pricing
 * section.
 */

/**
 * Pages that are routes rather than rows. PLAN.md 28.5, C149.
 *
 * They carry a claim about what exists, which is not an editorial decision, so
 * they cannot be unpublished from the content editor.
 */
const CODE_PAGES = [
  { href: "/integrations", key: "nav.integrations" },
  { href: "/developers", key: "nav.developers" },
  { href: "/verify", key: "nav.verify" },
] as const;

/**
 * The four audiences.
 *
 * 🔴 Two of these are CMS rows and two are code routes, and a reader cannot
 * tell which is which, which is the point. `/for-patients` is a row because its
 * copy is edited often; `/for-companies`, `/for-clinics` and `/for-therapists`
 * are routes because they render live components out of those portals and a
 * content editor cannot publish a React tree.
 */
const AUDIENCES = [
  { href: "/for-therapists", key: "nav.forTherapists" },
  { href: "/for-patients", key: "nav.forPatients" },
  { href: "/for-companies", key: "nav.forCompanies" },
  { href: "/for-clinics", key: "nav.forClinics" },
] as const;

/** The audience slugs, for keeping them out of the footer's other column. */
const AUDIENCE_SLUGS = new Set(AUDIENCES.map((item) => item.href.replace(/^\//, "")));

export async function SiteHeader() {
  const [offered, i18n] = await Promise.all([publicLanguages(), getI18n()]);
  const { locale, t } = i18n;
  const href = (path: string) => localisedPath(path, locale);
  const pathname = (await headers()).get("x-pathname") ?? "/";
  /* The page being read, without its language prefix, so `/ar/for-clinics` lights "For clinics". */
  const here = splitLocale(pathname).rest;

  return (
    /*
      🔴 The mockups' bar: navy glass, and the selection is a teal pill.

      Solid rather than clear-until-scrolled, because this header also sits on
      the sign in pages and the legal documents, which open on white. Over a
      navy hero it reads as the mockup's clear bar does.
    */
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-900/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        {/*
          🔴 The mark alone. The word is gone from beside it.

          The pack's lockup is the mark; "24Therapy" set in the page's own face
          next to it was a second wordmark competing with the first. One
          identity, and it is the one that was drawn.

          `title` stays on the Logo, so the link is still announced as
          "24Therapy" to anybody who cannot see the mark.
        */}
        <Link
          href={href("/")}
          className="flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Logo ink="white" height={28} />
        </Link>

        <nav aria-label={t("nav.mainNav")} className="ms-3 hidden flex-1 items-center gap-1 lg:flex">
          {AUDIENCES.map((item) => {
            const on = here === item.href;
            return (
              <Link
                key={item.href}
                href={href(item.href)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors",
                  on
                    ? "bg-brand-500 text-navy-700"
                    : "text-white/85 hover:bg-white/10 hover:text-white",
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitch
            className="hidden sm:inline-flex"
            tone="dark"
            offered={offered.map((row) => ({ code: row.code, nativeName: row.nativeName }))}
            pathname={pathname}
          />
          <SignInMenu className="hidden sm:block" />

          {/*
            🔴 The one call to action, and it is the product's own front door.

            Hardcoded rather than a CMS page for the reason the old "Talk now"
            link was: it is the one link on this header a person in crisis might
            be looking for, and it should not be possible to unpublish it by
            accident from the content editor.

            Teal ground, navy ink and a navy live dot: white on teal is 2.17:1
            and cannot carry a label, navy on it passes. See docs/BRAND.md.
          */}
          <Link
            href={href("/radar")}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-brand-500 px-3.5 text-[14px] font-semibold text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)] transition-colors hover:bg-brand-400 sm:px-4"
          >
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-navy-700" aria-hidden />
            {t("nav.radar")}
          </Link>

          <MobileNav
            radarHref={href("/radar")}
            links={AUDIENCES.map((item) => ({ href: href(item.href), label: t(item.key) }))}
            offered={offered.map((row) => ({ code: row.code, nativeName: row.nativeName }))}
            pathname={pathname}
          />
        </div>
      </div>
    </header>
  );
}

const LEGAL_KEYS = {
  privacy: "footer.privacy",
  terms: "footer.terms",
  hipaa: "footer.compliance",
  security: "footer.security",
} as const;

export async function SiteFooter() {
  const [nav, footer, offered, i18n] = await Promise.all([
    getPublicNav(),
    getFooterLinks(),
    publicLanguages(),
    getI18n(),
  ]);
  const { locale, t } = i18n;
  const href = (path: string) => localisedPath(path, locale);
  const pathname = (await headers()).get("x-pathname") ?? "/";

  return (
    <footer className="relative overflow-hidden bg-navy-900 text-white">
      <div className="mx-auto max-w-7xl px-5 pb-8 pt-16 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="min-w-0">
            <Link href={href("/")} className="inline-flex items-center">
              <Logo ink="white" height={32} />
            </Link>
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/70">
              {t("nav.tagline")}
            </p>
          </div>

          <FooterColumn title={t("footer.audiences")}>
            {AUDIENCES.map((item) => (
              <FooterLink key={item.href} href={href(item.href)}>
                {t(item.key)}
              </FooterLink>
            ))}
            <FooterLink href={href("/radar")}>{t("nav.radar")}</FooterLink>
          </FooterColumn>

          {/*
            The CMS rows: features, pricing, contact and whatever an editor
            publishes next. They were the header's nav until the four audience
            pages took that row, and this is where they belong now that every
            audience page carries its own pricing section.
          */}
          <FooterColumn title={t("footer.product")}>
            {/*
              🔴 Minus the audience pages.

              `for-patients` is a CMS row, so it comes back from `getPublicNav`
              as well as sitting in `AUDIENCES` above, and the footer printed
              "For patients" twice in two adjacent columns. The audience column
              is the one that owns them, because it is the only one that has all
              four; this column is whatever else an editor has published.
            */}
            {nav
              .filter((item) => !AUDIENCE_SLUGS.has(item.slug))
              .map((item) => (
                <FooterLink key={item.slug} href={href(`/${item.slug}`)}>
                  {item.label}
                </FooterLink>
              ))}
            {CODE_PAGES.map((item) => (
              <FooterLink key={item.href} href={href(item.href)}>
                {t(item.key)}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title={t("footer.legal")}>
            {footer.map((item) => (
              <FooterLink key={item.slug} href={href(`/${item.slug}`)}>
                {/*
                  🔴 B50: the legal rows have no Arabic yet, so their CMS label
                  is English on every Arabic screen with a footer. The four
                  known pages take their name from the dictionary in any
                  language but English, where the editor's label still wins.
                */}
                {locale !== "en" && item.slug in LEGAL_KEYS
                  ? t(LEGAL_KEYS[item.slug as keyof typeof LEGAL_KEYS])
                  : item.label}
              </FooterLink>
            ))}
          </FooterColumn>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <p className="text-[13px] text-white/70">
            © {new Date().getFullYear()} {BRAND}. {t("nav.rights")}
          </p>
          <LanguageSwitch
            tone="dark"
            offered={offered.map((row) => ({ code: row.code, nativeName: row.nativeName }))}
            pathname={pathname}
          />
        </div>
      </div>
      {/* The mockups' great faint wordmark: decoration, and said to nobody. */}
      <p
        aria-hidden
        dir="ltr"
        className="pointer-events-none select-none px-5 pb-2 text-center text-[18vw] font-black leading-none tracking-tighter text-white/[0.04]"
      >
        {BRAND}
      </p>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/60 rtl:tracking-normal">
        {title}
      </p>
      {/*
        `min-w-0` on the column and `break-words` on the links, because a flex or
        grid item's default `min-width: auto` refuses to shrink below its
        content: one long Arabic label used to push the whole page sideways at
        375px.
      */}
      <nav aria-label={title} className="mt-4 flex flex-col gap-2.5">
        {children}
      </nav>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="break-words text-[15px] text-white/80 transition-colors hover:text-white">
      {children}
    </Link>
  );
}

/**
 * The whole chrome around a page that is not in `app/(public)`.
 *
 * The auth pages use this. It is deliberately the same two components the
 * public layout renders, not a lookalike, so a change to the header cannot
 * apply to the marketing site and miss the sign in page.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
