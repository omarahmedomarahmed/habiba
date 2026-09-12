"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Languages } from "lucide-react";

import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/client";
import { isLocalisable, localisedPath } from "@/lib/i18n/paths";
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
}: {
  className?: string;
  offered?: { code: string; nativeName: string }[];
  pathname?: string;
}) {
  const current = useLocale();
  const router = useRouter();
  const routerPath = usePathname();
  const [pending, startTransition] = useTransition();

  const here = pathname ?? routerPath ?? "/";

  const choose = (next: Locale) =>
    startTransition(async () => {
      /* The cookie is still the preference, and it is set either way: a reader
         who chose Arabic on a public page stays in Arabic when they sign in. */
      await setLocale(next);
      if (isLocalisable(here)) router.push(localisedPath(here, next));
      else router.refresh();
    });

  return (
    <div
      className={cn("inline-flex items-center gap-1 rounded-full bg-slate-100 p-0.5", className)}
      role="group"
      aria-label={current === "ar" ? "اللغة" : "Language"}
    >
      <Languages className="ms-2 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      {(offered?.map((row) => row.code as Locale) ?? LOCALES).map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending}
          onClick={() => choose(locale)}
          aria-pressed={locale === current}
          lang={locale}
          className={cn(
            // 44px minimum: this is a real control, not an inline link, and the
            // WCAG exemption for links in a sentence does not cover it.
            "flex min-h-11 items-center rounded-full px-3 text-xs font-semibold transition-colors disabled:opacity-50",
            locale === current
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900",
          )}
        >
          {LOCALE_NAMES[locale]}
        </button>
      ))}
    </div>
  );
}
