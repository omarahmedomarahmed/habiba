"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutClinic } from "@/app/(clinic)/clinic/sign-in/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The clinic's navigation. PLAN.md 54.9, 54.12, §3f.
 *
 * ## 🔴 THREE DESTINATIONS, AND THE LIST IS PART OF THE WALL
 *
 * This week, your clinicians, your bills. There is no patient list, no search, no
 * session, no note, no caseload and no way to open an individual. A navigation bar is
 * a map of what a product lets somebody do, so the shortness of this one is a design
 * decision rather than an unfinished screen.
 *
 * 🔴 There is no "patients" tab and there never will be. The nearest thing is a NAME
 * ON A SCHEDULE ROW, which is not a link, because there is nowhere for it to go.
 *
 * ## 🔴 THE SENTENCE ABOUT WHAT THIS PORTAL CANNOT SHOW IS IN THE CHROME
 *
 * On every screen, not on a help page. The person who needs to read it is a practice
 * manager wondering where the notes are, and they will not click through to find out
 * that the answer is "nowhere, on purpose".
 */

const TABS: { href: string; key: MessageKey }[] = [
  { href: "/clinic", key: "clinic.nav.overview" },
  { href: "/clinic/people", key: "clinic.nav.people" },
  { href: "/clinic/bills", key: "clinic.nav.bills" },
];

export function ClinicChrome({
  children,
  nav,
  clinicName,
}: {
  children: React.ReactNode;
  /** Signed out gets the door and no tabs: every tab would bounce them. */
  nav: boolean;
  clinicName: string | null;
}) {
  const t = useT();
  /*
   * 🔴 `?? "/clinic"`, and this was found by RENDERING it rather than by reading it.
   *
   * `usePathname` returns null outside a router context, and `verify:sprint54` renders
   * this component to sweep its markup for clinical words (54.9). Without the fallback it
   * threw on `pathname.startsWith`, which is a crash in the verifier and would also be a
   * crash anywhere else this is rendered outside a route: a test, a story, an error
   * boundary. The fallback is the portal's own home, so the first tab reads as active,
   * which is the correct thing for a chrome with no path to highlight.
   */
  const pathname = usePathname() ?? "/clinic";

  return (
    <div className="min-h-dvh bg-slate-50">
      {nav ? (
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="text-sm font-bold tracking-tight text-slate-900">{clinicName}</span>
            <form action={signOutClinic} className="ms-auto">
              <button
                type="submit"
                className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                {t("clinic.signOut")}
              </button>
            </form>
          </div>

          <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2">
            {TABS.map((tab) => {
              const active =
                tab.href === "/clinic" ? pathname === "/clinic" : pathname.startsWith(tab.href);
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
          {/* 🔴 54.9 — on every screen of this portal, in the chrome. */}
          <p className="border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
            {t("clinic.neverSees")}
          </p>
        </footer>
      ) : null}
    </div>
  );
}
