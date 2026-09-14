"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutPartner } from "@/app/(partner)/partner/sign-in/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The partner's navigation. PLAN.md 55.2, 55.3.
 *
 * ## 🔴 FOUR DESTINATIONS, AND THE LIST IS PART OF THE WALL
 *
 * Keys, endpoints, deliveries, docs. There is no patient list, no search, no session, no
 * note and no subject browser. A navigation bar is a map of what a product lets somebody
 * do, so the shortness of this one is a design decision rather than an unfinished screen.
 *
 * 🔴 THERE IS NO "SUBJECTS" TAB AND THERE NEVER WILL BE. `partner_subjects` exists so a
 * partner's own reference for a person can be resolved to ours inside a flow they started.
 * A screen listing them would be the roster three enrolment designs were spent removing,
 * rebuilt as a table with a search box.
 *
 * ## 🔴 THE SENTENCE ABOUT WHAT A DELIVERY CARRIES IS IN THE CHROME
 *
 * On every screen, not on a help page. The developer who needs to read it is the one
 * wondering why the webhook body has three fields, and they will not click through to find
 * out that the answer is "on purpose".
 */

const TABS: { href: string; key: MessageKey }[] = [
  { href: "/partner", key: "dev.nav.keys" },
  { href: "/partner/webhooks", key: "dev.nav.webhooks" },
  { href: "/partner/deliveries", key: "dev.nav.deliveries" },
  /* 🔴 68.15 — the limit they set, what they have spent, and the projection. */
  { href: "/partner/usage", key: "dev.nav.usage" },
  { href: "/developers", key: "dev.nav.docs" },
];

export function PartnerChrome({
  children,
  nav,
  partnerName,
}: {
  children: React.ReactNode;
  /** Signed out gets the door and no tabs: every tab would bounce them. */
  nav: boolean;
  partnerName: string | null;
}) {
  const t = useT();
  /*
   * 🔴 `?? "/partner"`. `usePathname` returns null outside a router context, and
   * `verify:sprint55` renders this component to sweep its markup, which is exactly the
   * case that found the clinic chrome's missing fallback in sprint 54. The fallback is the
   * portal's own home, so the first tab reads as active.
   */
  const pathname = usePathname() ?? "/partner";

  return (
    <div className="min-h-dvh bg-slate-50">
      {nav ? (
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="text-sm font-bold tracking-tight text-slate-900">{partnerName}</span>
            <form action={signOutPartner} className="ms-auto">
              <button
                type="submit"
                className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                {t("dev.signOut")}
              </button>
            </form>
          </div>

          <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2">
            {TABS.map((tab) => {
              const active =
                tab.href === "/partner" ? pathname === "/partner" : pathname.startsWith(tab.href);
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
          {/* 🔴 42.4 / 55.10 — on every screen of this portal, in the chrome. */}
          <p className="border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
            {t("dev.noContent")}
          </p>
        </footer>
      ) : null}
    </div>
  );
}
