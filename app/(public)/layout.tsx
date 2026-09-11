import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { Button } from "@/components/ui";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { getFooterLinks, getPublicNav } from "@/lib/content/service";
import { env } from "@/lib/env";
import { getLocale } from "@/lib/i18n/server";
import { alternatesFor, localisedPath } from "@/lib/i18n/paths";
import { publicLanguages } from "@/lib/i18n/strings";

/**
 * Pages that are routes rather than rows. PLAN.md 28.5, C149.
 *
 * They carry a claim about what exists, which is not an editorial decision,
 * so they cannot be unpublished from the content editor.
 */
const CODE_PAGES = [
  { href: "/integrations", label: "Integrations" },
  { href: "/for-clinics", label: "For clinics" },
  { href: "/developers", label: "Developers" },
  { href: "/verify", label: "Check a record extract" },
] as const;

/**
 * 🔴 `hreflang` for every public page, declared once. PLAN.md 31.1.
 *
 * In the **layout**, deliberately. Next merges metadata down the segment
 * chain, so a page that says nothing about alternates inherits this, and a new
 * marketing page is correct on the day it is added rather than on the day
 * somebody notices. The alternative — the same four lines copied into eleven
 * `generateMetadata` functions — is the shape that produced C84 and C150: a
 * rule some call sites remember.
 *
 * A crawler that finds `/ar/pricing` with no link back to `/pricing` treats
 * them as unrelated documents competing with each other, which is worse for
 * both than publishing one.
 */
export async function generateMetadata(): Promise<Metadata> {
  const pathname = (await headers()).get("x-pathname") ?? "/";
  return { alternates: alternatesFor(pathname, env.appUrl) };
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [nav, footer, offered, locale] = await Promise.all([
    getPublicNav(),
    getFooterLinks(),
    // 21.13 — only the languages whose public switch is on.
    publicLanguages(),
    getLocale(),
  ]);

  /*
   * 🔴 Every link out of this chrome keeps the prefix.
   *
   * Without it an Arabic reader is one nav click from `/features` — still in
   * Arabic, because the cookie follows them, but at a URL that says English.
   * They would then share the page they are reading and their friend would
   * open it in a language they may not read. A prefix that does not survive
   * navigation is a prefix that only works for the first page.
   */
  const href = (path: string) => localisedPath(path, locale);

  /* The real path, prefix and all. See the note in `LanguageSwitch`. */
  const pathname = (await headers()).get("x-pathname") ?? "/";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href={href("/")} className="text-[15px] font-bold tracking-tight text-navy-500">
            24Therapy
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.slug}
                href={href(`/${item.slug}`)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
            {/*
              Hard-coded rather than a CMS page, because it is a live route and
              because it is the one link on this header a person in crisis might
              be looking for. It should not be possible to unpublish it by
              accident from the content editor.
            */}
            <Link
              href={href("/radar")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
              Talk now
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {/*
              Without this the Arabic site is unreachable for anyone whose
              browser does not already ask for Arabic — which is most people
              testing it, on a phone set to English.
            */}
            <LanguageSwitch
              className="hidden sm:inline-flex"
              offered={offered.map((row) => ({ code: row.code, nativeName: row.nativeName }))}
              pathname={pathname}
            />
            <Link href={href("/radar")} className="sm:hidden">
              <Button variant="ghost" size="sm" className="text-teal-700">
                Talk now
              </Button>
            </Link>
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            {/*
              🔴 18.4 — two audiences, two first buttons.

              A person in distress and a clinician evaluating software want
              opposite things from this header, and a single "Start free" made
              the patient guess. "I need a therapist" goes to the patients
              section, which has the radar one tap away on every page; "Start
              free" is the clinician's signup and stays the primary action for
              them. Neither is hidden behind the other.
            */}
            <Link href={href("/for-patients")} className="hidden sm:block">
              <Button variant="secondary" size="sm">
                I need a therapist
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Start free, for therapists</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-navy-500">24Therapy</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
                Clinical documentation for therapists. Your notes, written while you work.
              </p>
            </div>

            {/*
              `min-w-0` on a flex item is not optional here.

              A flex item's default `min-width: auto` refuses to shrink below
              its content, so this nav sat 32px wider than the padded column it
              lives in and pushed the last link two pixels past the viewport at
              375px — the whole page scrolling sideways because of one word.
            */}
            <nav aria-label="Footer" className="flex min-w-0 flex-wrap gap-x-5 gap-y-2">
              {nav.concat(footer).map((item) => (
                <Link
                  key={item.slug}
                  href={href(`/${item.slug}`)}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
              {/*
                28.5 — four live routes rather than CMS pages, for the same
                reason the radar link above is hard-coded: each of them states
                what is and is not built, and that state is a fact about the
                code. An editor who could unpublish the page saying "there is
                no API yet" would leave us with no page saying it.
              */}
              {CODE_PAGES.map((item) => (
                <Link
                  key={item.href}
                  href={href(item.href)}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <p className="mt-8 text-xs text-slate-400">
            © {new Date().getFullYear()} 24Therapy. Not a substitute for clinical judgement.
          </p>
        </div>
      </footer>
    </div>
  );
}
