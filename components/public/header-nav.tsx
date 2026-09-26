"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { splitLocale } from "@/lib/i18n/paths";
import { cn } from "@/lib/utils";

/**
 * The header's four audience links, and which one is the page being read.
 *
 * ## Why this is a client component now (founder, 26 September)
 *
 * "I'm on the homepage and it's showing For companies highlighted." The
 * header is rendered by `app/(public)/layout.tsx`, and a Next.js layout is NOT
 * rendered again on a client-side navigation: only the page under it is. The
 * highlight was worked out on the server from `x-pathname` at the first page
 * load, so a reader who landed on `/for-companies` and then pressed the logo
 * kept a teal "For companies" pill over the home page for as long as they
 * stayed on the site.
 *
 * So the current page is read here, in the browser, on every navigation.
 * `usePathname()` is the signal that the route changed, and the answer comes
 * from `window.location.pathname`: the Arabic pages are a middleware rewrite,
 * and the address bar (`/ar/for-clinics`) is the only place the real path is
 * written down (see `components/i18n/language-switch.tsx`). The server's
 * `initial` value is what the first paint uses, so a hard load is right before
 * any script runs.
 *
 * An exact match, not `startsWith`: `/` and `/pricing` light nothing.
 */
export function HeaderNav({
  label,
  items,
  initial,
}: {
  label: string;
  /** `href` is the localised link; `path` is the language-free page it opens. */
  items: { href: string; path: string; label: string }[];
  /** The language-free path the server rendered for. */
  initial: string;
}) {
  const routerPath = usePathname();
  const [here, setHere] = React.useState(initial);

  React.useEffect(() => {
    setHere(splitLocale(window.location.pathname).rest);
  }, [routerPath]);

  return (
    <nav aria-label={label} className="ms-3 hidden flex-1 items-center gap-1 lg:flex">
      {items.map((item) => {
        const on = here === item.path;
        return (
          <Link
            key={item.path}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors",
              on
                ? "bg-brand-500 text-navy-700"
                : "text-white/85 hover:bg-white/10 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
