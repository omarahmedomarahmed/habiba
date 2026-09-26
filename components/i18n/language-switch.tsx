"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Languages, Loader2 } from "lucide-react";

import { LOCALE_COOKIE, LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/client";
import { isLocalisable, localisedPath, splitLocale } from "@/lib/i18n/paths";
import { doneNavProgress, startNavProgress } from "@/lib/nav-progress";
import { cn } from "@/lib/utils";

/**
 * Switch language.
 *
 * Each language is written in itself — "العربية", never "Arabic" — because a
 * reader who cannot read the current interface cannot read the word for their
 * own language in it either. That is the entire reason language pickers look
 * the way they do, and it is the thing most often got wrong.
 *
 * `router.refresh()` rather than a reload: the locale lives in a cookie read
 * on the server, so re-rendering the tree is enough, and a full reload in the
 * middle of a session would drop a patient out of a video call to change a
 * label.
 */
/**
 * 🔴 21.13 / 21.15 — what a reader is *offered*.
 *
 * `offered` comes from the server: the languages whose public switch is on. A
 * language being translated does not appear here, and a language switched off
 * disappears from the switcher while anybody already reading it keeps reading
 * it (21.15 — serve and stop advertising).
 *
 * Defaulted to the shipped pair so that a component rendered without the prop
 * — a test, a demo, a page nobody has updated — still offers something rather
 * than nothing.
 */
/**
 * 🔴 31.1 — switching language now changes the URL, where there is one.
 *
 * `pathname` comes from the server, not from `usePathname()`. The Arabic pages
 * are served by a middleware **rewrite**, so the router's idea of the path is
 * the rewritten one (`/pricing`) while the browser's address bar says
 * `/ar/pricing`. Switching on the router's answer would send a reader from
 * Arabic to Arabic and look like a broken button. The layout reads the real
 * path from `x-pathname` and passes it down.
 *
 * On a path that has no translated URL — `/join/<token>`, the signed-in app —
 * the cookie is still the whole mechanism and the switch refreshes in place.
 * Those pages have one address on purpose (C153).
 */
export function LanguageSwitch({
  className,
  offered,
  pathname,
  tone = "light",
}: {
  className?: string;
  offered?: { code: string; nativeName: string }[];
  pathname?: string;
  /** The website's header is navy; everywhere else sits on a light ground. */
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const current = useLocale();
  const router = useRouter();
  const routerPath = usePathname();
  const [pending, startTransition] = useTransition();

  /*
   * The server's `pathname` is right for the first paint and stale after the
   * first client-side navigation: the website header lives in a layout, which
   * is not rendered again when only the page under it changes. So once
   * mounted, and again on every route change, the address bar is read, which
   * is the one place the `/ar/...` prefix of a rewritten page is still written
   * (26 September, the same staleness that lit the wrong header link).
   */
  const [live, setLive] = useState<string | null>(null);
  useEffect(() => {
    setLive(window.location.pathname);
  }, [routerPath]);

  const here = live ?? pathname ?? routerPath ?? "/";

  /*
   * 🔴 Board 567: the cookie is written HERE, in the browser, and the page is
   * rendered once. It was a server action and then a refresh: a server action
   * that sets a cookie already re-renders the page it was called from, so the
   * refresh rendered the patient home a second time, and both buttons sat
   * disabled for twenty seconds while a slow page rendered twice. The cookie is
   * not httpOnly (the server only reads it), so the browser may write it. It is
   * still the preference either way: a reader who chose Arabic on a public page
   * stays in Arabic when they sign in.
   */
  /*
   * 🔴 THE HEADER AND FOOTER STAYED IN THE OLD LANGUAGE. Founder, 26 September.
   *
   * On the website the switch was `router.push("/ar/pricing")`. A client
   * navigation re-renders only the segments that CHANGE, and `/ar/pricing` is
   * a middleware rewrite of `/pricing`: the same route, the same layouts. So
   * Next rendered the page again (the page segment always is) and kept every
   * layout it already had: the root layout with `<html lang dir>` and the
   * translator every client component reads, and the website layout with the
   * header and footer. The page's heading turned Arabic and everything around
   * it stayed English and left to right.
   *
   * Now the whole tree is rendered again with `router.refresh()`, the one
   * request that re-renders every layout from the root, so the chrome,
   * `<html lang dir>` and the client translator arrive in the new language
   * together, in one round trip, with no reload and nothing dropped from a
   * live call. That is every switch in the signed-in apps and the portals, and
   * every switch INTO Arabic on the website: the cookie is written, the
   * unprefixed page is refreshed (the cookie now decides it), and once the
   * Arabic page is on screen `/ar/pricing` is written into the address bar
   * through `history`, which Next's router adopts without a request.
   *
   * 🔴 OUT of an `/ar/...` address on the website it is a full page load of
   * the English address, and that is the one case, measured rather than
   * assumed. A refresh re-renders the address the router is ON, where the
   * prefix beats the cookie, so the router has to leave `/ar/pricing` first.
   * But Next remembers the address every page was drawn at and, on any
   * refresh, fetches that address again for it when it differs from the
   * current one: `/ar/pricing`, in Arabic, laid over the English refresh.
   * Tried as a `pushState` and as a `router.push` before the refresh; both
   * ended in Arabic. The website's pages are public and static and hold no
   * call or form in flight, so a load of `/pricing` costs a reader nothing.
   */
  const [target, setTarget] = useState<Locale | null>(null);
  const addressAfter = useRef<string | null>(null);
  const leaving = useRef(false);
  const choose = (next: Locale) => {
    if (next === current || target !== null) return;
    setTarget(next);
    writeLocaleCookie(next);
    /* The veil at once: the whole page is about to be redrawn in the other language. */
    startNavProgress({ hold: true, veilNow: true });
    addressAfter.current = null;

    if (isLocalisable(here)) {
      const tail = `${window.location.search}${window.location.hash}`;
      const bare = splitLocale(here).rest;
      if (bare !== window.location.pathname) {
        leaving.current = true;
        window.location.assign(`${localisedPath(here, next)}${tail}`);
        return;
      }
      const goal = localisedPath(here, next);
      if (goal !== bare) addressAfter.current = `${goal}${tail}`;
    }
    startTransition(() => router.refresh());
  };

  /* The refresh has landed: the address, the button and the page change indicator settle together. */
  useEffect(() => {
    /* A full page load is under way: the spinner stays until the new document replaces this one. */
    if (pending || target === null || leaving.current) return;
    const to = addressAfter.current;
    addressAfter.current = null;
    if (to && to !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.pushState(null, "", to);
    }
    setTarget(null);
    doneNavProgress();
  }, [pending, target]);

  /* Back to this page from the browser's page cache after that full load: not still switching. */
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !leaving.current) return;
      leaving.current = false;
      setTarget(null);
      doneNavProgress();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full p-0.5",
        dark ? "bg-white/10 ring-1 ring-white/15" : "bg-slate-100",
        className,
      )}
      role="group"
      aria-label={current === "ar" ? "اللغة" : "Language"}
    >
      {/* The globe turns into a spinner the moment a language is pressed, so the press is answered at once. */}
      {target ? (
        <Loader2
          className={cn("ms-2 h-3.5 w-3.5 shrink-0 animate-spin", dark ? "text-brand-300" : "text-brand-700")}
          aria-hidden
        />
      ) : (
        <Languages className={cn("ms-2 h-3.5 w-3.5 shrink-0", dark ? "text-white/85" : "text-slate-600")} aria-hidden />
      )}
      {(offered?.map((row) => row.code as Locale) ?? LOCALES).map((locale) => {
        const loading = target === locale;
        /* The chosen language lights up on the press, not when the page in it has arrived. */
        const selected = target ? loading : locale === current;
        return (
          <button
            key={locale}
            type="button"
            /* Board 567: never disabled, so a slow page cannot leave nothing to press. */
            aria-busy={loading}
            onClick={() => choose(locale)}
            aria-pressed={selected}
            lang={locale}
            data-loading={loading ? "" : undefined}
            className={cn(
              // 44px minimum: this is a real control, not an inline link, and the
              // WCAG exemption for links in a sentence does not cover it.
              "flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
              selected
                ? dark
                  ? "bg-white text-navy-700 shadow-sm"
                  : "bg-white text-slate-900 shadow-sm"
                : dark
                  ? "text-white/85 hover:text-white"
                  : "text-slate-600 hover:text-slate-900",
              loading && "ring-2 ring-brand-400",
            )}
          >
            {LOCALE_NAMES[locale]}
          </button>
        );
      })}
    </div>
  );
}

/** The cookie `app/actions/locale.ts` writes, with the same name and lifetime. */
function writeLocaleCookie(locale: Locale): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${secure}`;
}
