"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutSponsor } from "@/app/(sponsor)/sponsor/sign-in/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The sponsor's navigation. PLAN.md 53.4, 53.25, C240.
 *
 * ## 🔴 Five destinations, and not one of them leads to a person's session
 *
 * Overview, the list, the code, the pot, settings. There is no search, no
 * calendar, no "activity", and no way to open an individual: the roster row is
 * the deepest this portal goes and `lib/data/sponsors.ts` is why — its select
 * list has no session, no booking, no therapist and no date in it.
 *
 * A navigation bar is a map of what a product lets somebody do, so this one is
 * part of the wall rather than decoration on top of it.
 *
 * ## 🔴 C240's sentence is in the chrome, not on a help page
 *
 * *"An employer cannot mandate attendance through us."* It is on every screen of
 * this portal, because the person who needs to read it is the one drafting a
 * policy, and they will not click through to find out that they cannot.
 */

const TABS: { href: string; key: MessageKey }[] = [
  { href: "/sponsor", key: "sponsor.nav.overview" },
  { href: "/sponsor/people", key: "sponsor.nav.people" },
  { href: "/sponsor/code", key: "sponsor.nav.code" },
  { href: "/sponsor/pot", key: "sponsor.nav.pot" },
  /*
   * 🔴 61.1 — proving the domain is a setup task with a state, not a settings
   * field. It gets a tab because it stays visibly unfinished until it is
   * finished (C320) and because somebody has to come back to it days later.
   */
  { href: "/sponsor/domains", key: "sponsor.nav.domains" },
  { href: "/sponsor/settings", key: "sponsor.nav.settings" },
];

export function SponsorChrome({
  children,
  nav,
  sponsorName,
  role,
}: {
  children: React.ReactNode;
  /** Signed out gets the door and no tabs: every tab would bounce them. */
  nav: boolean;
  sponsorName: string | null;
  role: "admin" | "viewer" | null;
}) {
  const t = useT();
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-slate-50">
      {nav ? (
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="text-sm font-bold tracking-tight text-slate-900">{sponsorName}</span>
            {role === "viewer" ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {t("sponsor.nav.overview")}
              </span>
            ) : null}
            <form action={signOutSponsor} className="ms-auto">
              <button
                type="submit"
                className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                {t("sponsor.signOut")}
              </button>
            </form>
          </div>

          <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2">
            {TABS.map((tab) => {
              const active =
                tab.href === "/sponsor" ? pathname === "/sponsor" : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={
                    active
                      ? "tap-target whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      : "tap-target whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  }
                >
                  {t(tab.key)}
                </Link>
              );
            })}
          </nav>
        </header>
      ) : null}

      <div className="mx-auto max-w-4xl px-4 py-8">{children}</div>

      {nav ? (
        <footer className="mx-auto max-w-4xl px-4 pb-10">
          {/* 🔴 C240 — on every screen of this portal, in the chrome. */}
          <p className="border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
            {t("sponsor.noAttendance")}
          </p>
        </footer>
      ) : null}
    </div>
  );
}
