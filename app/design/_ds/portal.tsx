"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Search } from "lucide-react";

import { cn } from "@/lib/utils";

import { DesignNav, SampleIntro } from "./frames";
import { Press, spring } from "./motion";
import { Avatar, Glow } from "./ui";

/**
 * The one shell every portal uses: a navy sidebar whose selection slides, a
 * quiet top bar, and content that rises in on every change of screen. The
 * therapist, the clinic, the company, our console and the partner all look and
 * move alike, so learning one teaches the others.
 */
export type NavItem<T extends string> = { id: T; label: string; icon: ReactNode; badge?: string };

export function PortalShell<T extends string>({
  product,
  nav,
  active,
  onNav,
  user,
  role,
  children,
}: {
  product: string;
  nav: Array<NavItem<T>>;
  active: T;
  onNav: (id: T) => void;
  user: string;
  role: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[760px] bg-navy-50">
      <aside className="relative hidden w-60 shrink-0 flex-col overflow-hidden bg-navy-900 p-4 text-white lg:flex">
        <Glow className="-left-24 -top-24 h-64 w-64 opacity-70" />
        <p className="relative px-2 text-[20px] font-black tracking-tight">
          24<span className="text-brand-400">T</span> <span className="text-[13px] font-semibold text-white/60">{product}</span>
        </p>
        <nav className="relative mt-8 flex flex-col gap-1">
          {nav.map((item) => {
            const on = item.id === active;
            return (
              <Press
                key={item.id}
                onClick={() => onNav(item.id)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center gap-3 rounded-xl px-3 text-start text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  on ? "text-navy-700" : "text-white/70 hover:text-white",
                )}
              >
                {on ? <motion.span layoutId={`side-${product}`} transition={spring} className="absolute inset-0 rounded-xl bg-brand-500" /> : null}
                <span className="relative">{item.icon}</span>
                <span className="relative flex-1">{item.label}</span>
                {item.badge ? (
                  <span className={cn("relative rounded-full px-2 py-0.5 text-[11px] font-bold", on ? "bg-navy-700 text-white" : "bg-amber-400 text-navy-700")}>
                    {item.badge}
                  </span>
                ) : null}
              </Press>
            );
          })}
        </nav>
        <div className="relative mt-auto flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <Avatar name={user} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{user}</p>
            <p className="truncate text-[12px] text-white/60">{role}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-navy-100 bg-white/80 px-5 py-3 backdrop-blur">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto lg:hidden [scrollbar-width:none]">
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNav(item.id)}
                className={cn(
                  "relative shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold",
                  item.id === active ? "text-white" : "text-navy-500",
                )}
              >
                {item.id === active ? <motion.span layoutId={`top-${product}`} transition={spring} className="absolute inset-0 rounded-full bg-navy-600" /> : null}
                <span className="relative">{item.label}</span>
              </button>
            ))}
          </div>
          <label className="hidden h-10 max-w-sm flex-1 items-center gap-2 rounded-xl bg-navy-50 px-3 text-[14px] text-navy-400 ring-1 ring-navy-100 lg:flex">
            <Search className="h-4 w-4" aria-hidden /> Search
          </label>
          <span className="ms-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-50 text-navy-600 ring-1 ring-navy-100">
            <Bell className="h-[18px] w-[18px]" aria-hidden />
          </span>
        </header>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="p-5 sm:p-7"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** The page around a portal sample: the shared nav, the intro, and the browser window. */
export function PortalPage({
  eyebrow,
  title,
  body,
  tryThis,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  tryThis: string[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(46,196,182,0.14),transparent_55%)] pb-20">
      <DesignNav />
      <SampleIntro eyebrow={eyebrow} title={title} body={body} tryThis={tryThis} />
      <div className="mx-auto max-w-7xl px-3 sm:px-6">{children}</div>
    </div>
  );
}

/** A figure with a label, the unit portals are read in. */
export function Stat({ label, children, note, tone = "light" }: { label: string; children: ReactNode; note?: string; tone?: "light" | "dark" }) {
  return (
    <div className={cn("rounded-3xl p-5", tone === "dark" ? "bg-navy-900 text-white" : "bg-white ring-1 ring-navy-100")}>
      <p className={cn("text-[13px] font-semibold", tone === "dark" ? "text-white/65" : "text-navy-500")}>{label}</p>
      <div className={cn("mt-1 text-[30px] font-bold tabular-nums", tone === "dark" ? "text-white" : "text-navy-700")}>{children}</div>
      {note ? <p className={cn("mt-1 text-[13px]", tone === "dark" ? "text-white/60" : "text-navy-500")}>{note}</p> : null}
    </div>
  );
}

export function H2({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[26px] font-bold text-navy-700">{children}</h2>
      {sub ? <p className="mt-1 text-[15px] text-navy-500">{sub}</p> : null}
    </div>
  );
}
