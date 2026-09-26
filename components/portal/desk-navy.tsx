"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "motion/react";

import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/clinician/kit";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { NeverBar } from "@/components/visual/primitives";
import { cn } from "@/lib/utils";

import type { DeskSection } from "./desk";

/**
 * 🔴 THE DESK IN THE APPROVED LOOK (`app/design/_ds/portal.tsx`).
 *
 * The same shell as `Desk`, drawn the way the therapist portal now is: a navy
 * rail with the teal selection, the company's name in a card at its foot, and a
 * sliding navy pill for the sections on a phone. `Desk` renders this when a
 * chrome asks for `look="navy"`, so every rule it documents holds here too:
 *
 * - the wall is in the rail, on screen the whole time, and at the foot of the
 *   page below `lg` where there is no rail, in a card of its own;
 * - the language switch is in the rail, and in the header on a phone;
 * - the rail, the header and the footer are `print:hidden`, so the joining
 *   code poster prints alone.
 */
export function NavyDesk({
  nav,
  bare,
  name,
  badge,
  sections,
  current,
  actions,
  never,
  routed,
  children,
}: {
  nav: boolean;
  bare: boolean;
  name: string | null;
  badge?: string | null;
  sections: readonly DeskSection[];
  current: (section: DeskSection) => boolean;
  actions?: React.ReactNode;
  never: { label: string; items: string[] };
  /** False off-route, where the switch has no router to call. */
  routed: boolean;
  children: React.ReactNode;
}) {
  /* On a phone the current section may sit past the edge of the pill row; bring it into view. */
  const pills = useRef<HTMLElement>(null);
  const here = sections.find(current)?.href;
  useEffect(() => {
    const on = pills.current?.querySelector<HTMLElement>('[aria-current="page"]');
    on?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [here]);

  return (
    <div className="min-h-dvh bg-navy-50 lg:flex">
      {nav ? (
        <aside className="relative hidden overflow-hidden bg-navy-900 text-white print:hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col">
          <div
            aria-hidden
            className="pointer-events-none absolute -start-24 -top-24 h-64 w-64 rounded-full opacity-70 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
          />
          <div className="relative px-6 pt-6 pb-6">
            <Logo ink="white" height={26} />
          </div>

          <nav aria-label={never.label} className="relative flex-1 space-y-1 overflow-y-auto px-4">
            {sections.map((section) => {
              const on = current(section);
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                    on
                      ? "bg-brand-500 text-navy-700 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.9)]"
                      : "text-white/75 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {section.icon ? <span className="shrink-0">{section.icon}</span> : null}
                  <span className="min-w-0 flex-1 truncate">{section.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* 🔴 The wall, on screen the whole time rather than below the fold. */}
          <div className="relative px-4 pt-4">
            <NeverBar label={never.label} items={never.items} tone="dark" />
          </div>

          <div className="relative m-4 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              {name ? <Avatar name={name} size={36} /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{name}</p>
                {badge ? <p className="truncate text-xs text-white/70">{badge}</p> : null}
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1 text-white/80">
              {actions}
              {routed ? <LanguageSwitch tone="dark" /> : null}
            </div>
          </div>
        </aside>
      ) : null}

      <div className="min-w-0 flex-1">
        {nav ? (
          <header className="sticky top-0 z-20 border-b border-navy-100 bg-white/90 backdrop-blur-xl lg:hidden print:hidden">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-navy-500">
              <Logo ink="navy" height={22} />
              <span className="min-w-0 truncate text-sm font-bold tracking-tight text-navy-600">{name}</span>
              {badge ? (
                <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-semibold text-navy-500 ring-1 ring-navy-100">
                  {badge}
                </span>
              ) : null}
              <span className="ms-auto flex items-center gap-1">
                {actions}
                {routed ? <LanguageSwitch /> : null}
              </span>
            </div>

            {/* `shrink-0` on every pill: a sideways scroller only scrolls if its children refuse to shrink. */}
            <nav
              ref={pills}
              aria-label={never.label}
              className="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {sections.map((section) => {
                const on = current(section);
                return (
                  <Link
                    key={section.href}
                    href={section.href}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "relative inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                      on ? "text-white" : "bg-white text-navy-500 ring-1 ring-navy-100 hover:text-navy-700",
                    )}
                  >
                    {on ? (
                      <motion.span
                        layoutId="desk-tab"
                        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.9 }}
                        className="absolute inset-0 rounded-full bg-navy-600"
                      />
                    ) : null}
                    <span className="relative">{section.label}</span>
                  </Link>
                );
              })}
            </nav>
          </header>
        ) : null}

        {bare ? children : <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8 lg:px-10">{children}</div>}

        {/* No rail below `lg`, so the wall goes to the foot of the page, in a card of its own. */}
        {nav ? (
          <footer className="mx-auto max-w-5xl px-4 pb-10 lg:hidden print:hidden">
            <div className="rounded-3xl bg-navy-900 p-1">
              <NeverBar label={never.label} items={never.items} tone="dark" />
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
