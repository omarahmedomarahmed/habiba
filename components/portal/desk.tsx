"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { NeverBar } from "@/components/visual/primitives";
import { cn } from "@/lib/utils";

import { NavyDesk } from "./desk-navy";

/**
 * 🔴 THE DESK. One shell, both admin portals. Option A, /design/company/sample.
 *
 * ## What this replaces, and why it is one component rather than two
 *
 * `SponsorChrome` and `ClinicChrome` were the same 150 lines twice: a white
 * header with a name and a sign out button, a row of horizontal pills that
 * scrolled sideways, a `max-w-4xl` column, and the `NeverBar` in a footer. Two
 * copies of one layout is two places a fix lands and one of them gets it.
 *
 * The `NeverBar` comment in both files had already worked this out for its own
 * case: *"the same rule for a practice and for an employer: one component, two
 * chromes, one place a fix lands."* This is that argument applied to the chrome
 * around it.
 *
 * ## Why a rail and not the pills
 *
 * Option A is called "the desk" because that is what these two are. A practice
 * manager and a benefits administrator sit at a keyboard with a wide screen,
 * come in to do one of six or seven jobs, and need to see which ones exist. A
 * horizontal strip of pills at 896px wide either overflows and scrolls out of
 * sight, or fits by making every label small enough to stop being read.
 *
 * The rail also gives the wall somewhere permanent to live, which is the part
 * that matters most. See `NeverBar` below.
 *
 * ## 🔴 THE WALL IS IN THE RAIL, NOT AT THE BOTTOM OF THE PAGE
 *
 * C240 put "an employer cannot mandate attendance through us" on every screen
 * of the sponsor portal and was right to. It then sat in a `<footer>` under the
 * content, which on a long page means below the fold, which means the person
 * drafting an attendance policy scrolls past it or never reaches it. In the
 * rail it is on screen the whole time, next to the navigation that is the other
 * half of the same statement.
 *
 * Below `lg` there is no rail, so it goes back to the footer, which is the
 * honest fallback rather than a hamburger nobody opens.
 *
 * ## 🔴 AND THE LANGUAGE SWITCH COMES OFF THE GLASS AND INTO THE RAIL
 *
 * 75.3 put the switch in a `fixed top-0 end-0 z-50` corner so it would be in
 * the same place on every signed-in screen, which was right for a phone app
 * with no chrome to put it in. On these two it was a pill floating over
 * whatever the page begins with, and what these pages begin with is the
 * payment bar: the switch sat on top of its Dismiss button.
 *
 * A desk has a rail, and a rail has a bottom, and that is a better same place
 * than a corner of the glass. Below `lg` it rides in the header row instead.
 * Nothing about 75.3's argument changes — always within reach, always in one
 * place — only which place, now that there is furniture to put it on.
 *
 * ## Every string arrives as a prop
 *
 * `components/` is counted by `verify:sprint37l`. A word typed into this file is
 * a word the Arabic portal renders in English, so the two chromes resolve their
 * own keys and hand the results over. `LanguageSwitch` is the exception that
 * proves it: it carries its own two words, in both languages, already.
 */

export type DeskSection = {
  href: string;
  label: string;
  /** True for the portal's root, which `startsWith` would otherwise match always. */
  exact?: boolean;
  /** 🔴 Ruling 14b: the other pages this section holds, so it reads as active on them too. */
  also?: readonly string[];
  /** Drawn beside the label in the navy rail (`look="navy"`); ignored otherwise. */
  icon?: React.ReactNode;
};

export function Desk({
  nav,
  bare = false,
  name,
  badge,
  home,
  sections,
  actions,
  never,
  tone = "slate",
  look = "light",
  children,
}: {
  /** Signed out gets the door and no rail: every link would bounce them. */
  nav: boolean;
  /**
   * 🔴 A door page brings its own chrome, so this one steps out of the way.
   * Task 154.
   *
   * The sign in pages render the real site header and footer, which are full
   * width. Dropped into this shell's column they would be a site header
   * floating in the middle of a grey page. The layout still WRAPS the door,
   * because it calls `get*Actor` rather than `require*`; only the container
   * changes.
   */
  bare?: boolean;
  name: string | null;
  /** A small standing label, such as a read-only role. */
  badge?: string | null;
  /**
   * 🔴 The path to treat as current when there is none.
   *
   * `usePathname` returns null outside a router context, and both portals are
   * rendered by verifiers that sweep their markup for clinical words. Without a
   * fallback this threw on `startsWith`, which is a crash in the gate and would
   * be one anywhere else a chrome renders off-route: a test, a story, an error
   * boundary.
   */
  home: string;
  sections: readonly DeskSection[];
  /** Sign out, and anything else that ends a session. Rendered in both layouts. */
  actions?: React.ReactNode;
  never: { label: string; items: string[] };
  /**
   * The look. `slate` is the desk as it was; `navy` is the clinician portal's
   * shell (a navy rail with the teal selection, a frosted top bar, pills that
   * are navy when chosen), so a practice that also runs sessions meets one
   * product. Only the classes change: the same sections, actions and wall.
   */
  tone?: "slate" | "navy";
  /**
   * The approved navy look (`components/portal/desk-navy.tsx`), for a chrome
   * that has moved across. Everything above holds there too: the wall in the
   * rail, the switch within reach, the chrome out of the print.
   */
  look?: "light" | "navy";
  children: React.ReactNode;
}) {
  /*
   * 🔴 `null` HERE IS "THERE IS NO ROUTER", AND IT IS LOAD-BEARING TWICE.
   *
   * Once for `home`, documented on the prop above. And once for the switch
   * below, which is why the raw value is kept rather than collapsed straight
   * into the fallback: `usePathname` RETURNS null off-route, but `useRouter`
   * THROWS, and `LanguageSwitch` calls the second one. So a render outside a
   * router — `verify:sprint54` sweeping this chrome's markup for clinical
   * words, a test, a story, an error boundary — died on a hook inside a
   * component three levels down, with nothing in the stack naming the shell.
   *
   * Off-route there is also nothing for that switch to DO: it exists to push a
   * localised path and refresh, and both need the router it cannot have. So it
   * is not rendered, which is honest rather than defensive.
   */
  const routed = usePathname();
  const pathname = routed ?? home;
  const current = (section: DeskSection) =>
    (section.exact ? pathname === section.href : pathname.startsWith(section.href)) ||
    (section.also ?? []).some((href) => pathname.startsWith(href));

  if (look === "navy") {
    return (
      <NavyDesk
        nav={nav}
        bare={bare}
        name={name}
        badge={badge}
        sections={sections}
        current={current}
        actions={actions}
        never={never}
        routed={routed !== null}
      >
        {children}
      </NavyDesk>
    );
  }

  const wall = <NeverBar label={never.label} items={never.items} />;
  const switcher = routed === null ? null : <LanguageSwitch />;

  if (tone === "navy") {
    return (
      <ClinicNavyDesk
        nav={nav}
        bare={bare}
        name={name}
        badge={badge}
        home={home}
        sections={sections}
        actions={actions}
        never={never}
        current={current}
        routed={routed !== null}
      >
        {children}
      </ClinicNavyDesk>
    );
  }

  /*
   * W2-S03: the rail, the top bar and the wall are `print:hidden`, so a
   * company printing its joining code poster gets the poster and not the portal.
   */
  return (
    <div className="min-h-dvh bg-slate-50 lg:flex">
      {nav ? (
        <aside className="hidden print:hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:border-e lg:border-slate-200 lg:bg-white">
          <div className="border-b border-slate-100 px-4 py-4">
            <Logo ink="navy" height={22} />
            <p className="mt-2.5 truncate text-sm font-bold tracking-tight text-navy-500">
              {name}
            </p>
            {badge ? (
              <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {badge}
              </span>
            ) : null}
          </div>

          <nav aria-label={never.label} className="flex-1 overflow-y-auto p-2">
            {sections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                aria-current={current(section) ? "page" : undefined}
                className={cn(
                  "mb-0.5 block truncate rounded-xl px-3 py-2 text-[13px] transition-colors",
                  current(section)
                    ? "bg-navy-500 font-semibold text-white"
                    : "font-medium text-slate-600 hover:bg-slate-100 hover:text-navy-500",
                )}
              >
                {section.label}
              </Link>
            ))}
          </nav>

          {/*
            No `ms-auto` on the switch: a 240px rail cannot hold Sign out and
            two language buttons on one line, in either language, so this row
            wraps by design and both items should start at the same edge when
            it does. Pushed right, the wrapped switch sits alone in the middle
            of the rail looking like it belongs to nothing.
          */}
          <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-2 py-2">
            {actions}
            {switcher}
          </div>

          {/* 🔴 The wall, on screen the whole time rather than below the fold. */}
          <div className="px-4 pb-5">{wall}</div>
        </aside>
      ) : null}

      <div className="min-w-0 flex-1">
        {nav ? (
          <header className="border-b border-slate-200 bg-white lg:hidden print:hidden">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <Logo ink="navy" height={22} />
              <span className="truncate text-sm font-bold tracking-tight text-navy-500">
                {name}
              </span>
              {badge ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                  {badge}
                </span>
              ) : null}
              <span className="ms-auto flex items-center gap-1">
                {actions}
                {switcher}
              </span>
            </div>

            {/*
              🔴 `shrink-0` IS LOAD-BEARING, and its absence was visible at 390px.

              A flex item shrinks by default, and `overflow-x-auto` does not stop
              it: the seven pills each squeezed to a seventh of the screen while
              `whitespace-nowrap` kept their text at full width, so the labels
              ran over each other and the current one read "Overv". A sideways
              scroller only scrolls if its children refuse to get smaller.
            */}
            <nav aria-label={never.label} className="flex gap-1 overflow-x-auto px-3 pb-2">
              {sections.map((section) => (
                <Link
                  key={section.href}
                  href={section.href}
                  aria-current={current(section) ? "page" : undefined}
                  className={cn(
                    "tap-target shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold",
                    current(section)
                      ? "bg-navy-500 text-white"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {section.label}
                </Link>
              ))}
            </nav>
          </header>
        ) : null}

        {bare ? children : <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">{children}</div>}

        {/* No rail below `lg`, so the wall goes back to the foot of the page. */}
        {nav ? (
          <footer className="mx-auto max-w-5xl px-4 pb-10 lg:hidden print:hidden">{wall}</footer>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The desk in the clinician portal's clothes (`app/(app)/layout.tsx`): the
 * navy rail with its teal glow and the white mark, the section you are in as
 * a teal pill with navy ink, and on a phone a frosted bar whose pills turn
 * navy when chosen. The wall sits on a white card in the rail so its red
 * crosses read as they do everywhere else.
 *
 * `data-desk="rail"` lets the actions a chrome hands over (Sign out, the
 * switcher) take white ink in the rail and navy ink in the phone bar without
 * a second copy of them.
 */
function ClinicNavyDesk({
  nav,
  bare,
  name,
  badge,
  home,
  sections,
  actions,
  never,
  current,
  routed,
  children,
}: {
  nav: boolean;
  bare: boolean;
  name: string | null;
  badge?: string | null;
  home: string;
  sections: readonly DeskSection[];
  actions?: React.ReactNode;
  never: { label: string; items: string[] };
  current: (section: DeskSection) => boolean;
  routed: boolean;
  children: React.ReactNode;
}) {
  const wall = <NeverBar label={never.label} items={never.items} />;
  return (
    <div className="min-h-dvh bg-navy-50 lg:flex">
      {nav ? (
        <aside className="print:hidden hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-hidden lg:bg-navy-900 lg:text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -start-24 -top-24 h-64 w-64 rounded-full opacity-70 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
          />
          <div className="relative px-6 pt-6 pb-5">
            <Link href={home} className="inline-flex items-center">
              <Logo ink="white" height={28} />
            </Link>
          </div>

          <nav aria-label={never.label} className="relative flex-1 space-y-1 overflow-y-auto px-4">
            {sections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                aria-current={current(section) ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-xl px-3 text-[14px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  current(section)
                    ? "bg-brand-500 text-navy-700 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.9)]"
                    : "text-white/75 hover:bg-white/5 hover:text-white",
                )}
              >
                <span className="min-w-0 truncate">{section.label}</span>
              </Link>
            ))}
          </nav>

          <div className="relative mx-4 rounded-2xl bg-white p-3 [&_div]:border-0 [&_div]:pt-0">{wall}</div>

          <div data-desk="rail" className="group/desk relative m-4 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <p className="truncate text-[13px] font-semibold text-white">{name}</p>
            {badge ? (
              <span className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/85">
                {badge}
              </span>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-1">{actions}</div>
            {routed ? <LanguageSwitch tone="dark" className="mt-2" /> : null}
          </div>
        </aside>
      ) : null}

      <div className="min-w-0 flex-1">
        {nav ? (
          <header className="print:hidden sticky top-0 z-20 border-b border-navy-100 bg-white/85 backdrop-blur-xl lg:hidden">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <Link href={home} className="inline-flex items-center">
                <Logo ink="navy" height={24} />
              </Link>
              <span className="min-w-0 truncate text-sm font-bold text-navy-600">{name}</span>
              {badge ? (
                <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] text-navy-500 ring-1 ring-navy-100">
                  {badge}
                </span>
              ) : null}
              <span className="ms-auto flex items-center gap-1">
                {actions}
                {routed ? <LanguageSwitch /> : null}
              </span>
            </div>
            <nav
              aria-label={never.label}
              className="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {sections.map((section) => (
                <Link
                  key={section.href}
                  href={section.href}
                  aria-current={current(section) ? "page" : undefined}
                  className={cn(
                    "tap-target inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[14px] font-semibold",
                    current(section)
                      ? "bg-navy-600 text-white"
                      : "bg-white text-navy-500 ring-1 ring-navy-100 hover:text-navy-700",
                  )}
                >
                  {section.label}
                </Link>
              ))}
            </nav>
          </header>
        ) : null}

        {bare ? children : <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 lg:px-8 lg:pt-8">{children}</div>}

        {nav ? (
          <footer className="print:hidden mx-4 mb-10 rounded-3xl bg-white p-4 ring-1 ring-navy-100 sm:mx-6 lg:hidden [&_div]:border-0 [&_div]:pt-0">
            {wall}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
