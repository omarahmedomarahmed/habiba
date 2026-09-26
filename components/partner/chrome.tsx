"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { BookOpen, Gauge, KeyRound, LogOut, Send, Users, Webhook, type LucideIcon } from "lucide-react";

import { signOutPartner } from "@/app/(partner)/partner/sign-in/actions";
import { Logo } from "@/components/brand/logo";
import { Avatar, Glow } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn, SETTLE } from "@/lib/utils";

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
 * out that the answer is "on purpose". On a wide screen it sits in the rail, on screen the
 * whole time; below `lg` there is no rail, so it is at the foot of the page.
 *
 * ## The look
 *
 * The portal shell of the approved mockups (`app/design/_ds/portal.tsx`), the same one
 * the clinician's portal wears: a navy rail whose selection is the teal, a quiet top bar
 * on a phone with the destinations as pills, and a navy-50 ground. Learning one portal
 * teaches the others.
 */

const TABS: { href: string; key: MessageKey; icon: LucideIcon }[] = [
  { href: "/partner", key: "dev.nav.keys", icon: KeyRound },
  { href: "/partner/webhooks", key: "dev.nav.webhooks", icon: Webhook },
  { href: "/partner/deliveries", key: "dev.nav.deliveries", icon: Send },
  /* 🔴 68.15 — the limit they set, what they have spent, and the projection. */
  { href: "/partner/usage", key: "dev.nav.usage", icon: Gauge },
  /* 🔴 W2-X06: colleagues, so a team stops sharing one login. */
  { href: "/partner/team", key: "dev.nav.team", icon: Users },
  { href: "/developers", key: "dev.nav.docs", icon: BookOpen },
];

export function PartnerChrome({
  children,
  nav,
  /**
   * 🔴 A door page brings its own chrome, so this one steps out of the way.
   * Task 154.
   *
   * The sign in page now renders the real site header and footer, the same two
   * components the marketing pages use, because a centred card on an empty
   * ground was the last thing a person saw before deciding to trust us. Those
   * are full width. Dropped into this shell's column they would be a site
   * header floating in the middle of a grey page.
   *
   * The layout still WRAPS the door, which is deliberate and unchanged: it
   * calls `get*Actor` rather than `require*`, because a layout that redirected
   * would redirect the door. What changes here is only the container.
   */
  bare = false,
  partnerName,
  email = null,
  role = null,
}: {
  children: React.ReactNode;
  /** Signed out gets the door and no tabs: every tab would bounce them. */
  nav: boolean;
  bare?: boolean;
  partnerName: string | null;
  /** Who is signed in, beside Sign out in the rail. */
  email?: string | null;
  role?: string | null;
}) {
  const t = useT();
  /*
   * 🔴 `?? "/partner"`. `usePathname` returns null outside a router context, and
   * `verify:sprint55` renders this component to sweep its markup, which is exactly the
   * case that found the clinic chrome's missing fallback in sprint 54. The fallback is the
   * portal's own home, so the first tab reads as active.
   */
  const pathname = usePathname() ?? "/partner";
  const isOn = (href: string) => (href === "/partner" ? pathname === "/partner" : pathname.startsWith(href));

  /* On a door the site's own header and footer are full width, so no rail: a signed-in
     developer there still gets the top bar, as before. */
  const railed = nav && !bare;

  const wall = (dark: boolean) => (
    <p className={cn("text-xs leading-relaxed", dark ? "text-white/70" : "text-navy-400")}>{t("dev.noContent")}</p>
  );

  const signOut = (dark: boolean) => (
    <form action={signOutPartner}>
      <button
        type="submit"
        title={t("dev.signOut")}
        aria-label={t("dev.signOut")}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
          dark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-navy-500 ring-1 ring-navy-100 hover:bg-navy-50",
        )}
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );

  return (
    <div className={bare ? undefined : "min-h-dvh bg-navy-50"}>
      {railed ? (
        <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col overflow-hidden bg-navy-900 text-white lg:flex">
          <Glow className="-start-24 -top-24 h-64 w-64 opacity-70" />
          <div className="relative px-6 pt-6 pb-2">
            <Link href="/partner" className="inline-flex items-center">
              <Logo ink="white" height={28} />
            </Link>
            <p className="mt-3 truncate text-[15px] font-bold text-white">{partnerName}</p>
          </div>

          <nav aria-label={partnerName ?? undefined} className="relative mt-4 flex-1 space-y-1 overflow-y-auto px-4">
            {TABS.map((tab) => {
              const on = isOn(tab.href);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                    on ? `bg-brand-500 text-navy-700 ${SETTLE}` : "text-white/75 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {on ? (
                    <motion.span
                      layoutId="partner-rail"
                      transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.9 }}
                      className="absolute inset-0 rounded-xl bg-brand-500 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.9)]"
                    />
                  ) : null}
                  <Icon className="relative h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className="relative min-w-0 flex-1 truncate">{t(tab.key)}</span>
                </Link>
              );
            })}
          </nav>

          {/* 🔴 42.4 / 55.10 — the wall, on screen the whole time rather than below the fold. */}
          <div className="relative px-6 pb-3">{wall(true)}</div>

          <div className="relative m-4 mt-1 flex items-center gap-2.5 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <Avatar name={partnerName ?? email ?? "24"} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-white">{email ?? partnerName}</span>
              {role ? (
                <span className="block truncate text-xs text-white/70">
                  {role === "admin" ? t("dev.roleAdmin") : t("dev.roleDeveloper")}
                </span>
              ) : null}
            </span>
            {signOut(true)}
          </div>
        </aside>
      ) : null}

      <div className={railed ? "lg:ps-64" : undefined}>
        {nav ? (
          <header className={cn("sticky top-0 z-20 border-b border-navy-100 bg-white/85 backdrop-blur-xl", railed && "lg:hidden")}>
            {/* The end of this row is left clear for the language corner, fixed there on every screen. */}
            <div className={cn("flex h-16 items-center gap-3 ps-4", railed ? "pe-[188px]" : "pe-4")}>
              <div className="min-w-0 flex-1">
                <Link href="/partner" className="inline-flex items-center">
                  <Logo ink="navy" height={22} />
                </Link>
                <p className="truncate text-xs font-bold text-navy-500">{partnerName}</p>
              </div>
              {signOut(false)}
            </div>
            {/*
              🔴 `shrink-0` on every pill: a sideways scroller only scrolls if its
              children refuse to get smaller. The selection is a navy pill that
              slides, as in the mockups.
            */}
            <nav aria-label={partnerName ?? undefined} className="px-4 pb-3">
              <ul className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TABS.map((tab) => {
                  const on = isOn(tab.href);
                  return (
                    <li key={tab.href} className="shrink-0">
                      <Link
                        href={tab.href}
                        aria-current={on ? "page" : undefined}
                        className={cn(
                          "relative inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                          on ? `bg-navy-600 text-white ${SETTLE}` : "bg-white text-navy-500 ring-1 ring-navy-100 hover:text-navy-700",
                        )}
                      >
                        {on ? (
                          <motion.span
                            layoutId="partner-tab"
                            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.9 }}
                            className="absolute inset-0 rounded-full bg-navy-600"
                          />
                        ) : null}
                        <span className="relative">{t(tab.key)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </header>
        ) : null}

        {bare ? (
          children
        ) : (
          <main className={cn("mx-auto max-w-5xl pb-12", nav ? "lg:pt-6" : "pt-20 lg:pt-16")}>{children}</main>
        )}

        {/* No rail below `lg`, so the wall goes to the foot of the page. */}
        {nav ? (
          <footer className={cn("mx-auto max-w-5xl px-4 pb-10 sm:px-6", railed && "lg:hidden")}>
            <div className="border-t border-navy-100 pt-4">{wall(false)}</div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
