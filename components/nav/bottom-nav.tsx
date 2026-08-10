"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Radio,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Bottom navigation — the primary navigation on every screen size up to
 * desktop, with Start as a raised centre action because it is the one thing
 * the product exists to do.
 *
 * Four destinations plus a sheet, not thirteen tabs. The product has grown a
 * copilot, a radar and an earnings page since this bar was four items, and the
 * honest options were a cramped eight-tab bar or a short overflow. The sheet
 * wins on one condition, which is that it stays short: if it ever needs a
 * scrollbar, the product has too many top-level places to be.
 *
 * Targets are 44px minimum; the previous bar shipped ~40px.
 */
const PRIMARY = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/patients", label: "Patients", icon: Users },
] as const;

const MORE = [
  { href: "/copilot", label: "Copilot", icon: MessageSquare, hint: "Ask about a patient" },
  { href: "/notes", label: "Notes", icon: FileText, hint: "Drafts waiting for you" },
  { href: "/on-call", label: "Crisis Radar", icon: Radio, hint: "Go online, get booked" },
  { href: "/billing", label: "Billing & earnings", icon: CreditCard, hint: "Invoices and payouts" },
  { href: "/settings", label: "Settings", icon: Settings, hint: "Profile, payouts, licence" },
] as const;

export function BottomNav({ cleared = true }: { cleared?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A sheet that survives navigation is a sheet covering the page you just
  // asked for.
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const moreActive = MORE.some((item) => isActive(item.href));

  // The live room is full-bleed; navigation would be a way to lose a session.
  if (pathname.endsWith("/room")) return null;

  /*
   * An unverified clinician gets a short bar, not no bar.
   *
   * Hiding it entirely was the safe-looking choice — every gated link is a
   * client-side navigation into a page that would bounce them — and it left
   * somebody on a phone with no way to reach settings, which is where signing
   * out lives. Three destinations they are actually allowed is the answer.
   */
  if (!cleared) {
    return (
      <nav
        aria-label="Primary"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 pt-1">
          <NavItem
            href="/onboarding"
            label="Verify"
            icon={ShieldCheck}
            active={isActive("/onboarding")}
          />
          <NavItem
            href="/billing"
            label="Billing"
            icon={CreditCard}
            active={isActive("/billing")}
          />
          <NavItem
            href="/settings"
            label="Settings"
            icon={Settings}
            active={isActive("/settings")}
          />
        </div>
      </nav>
    );
  }

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-navy-500/50 backdrop-blur-sm"
          />
          <div className="safe-bottom animate-fade-rise absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-3 pb-24">
            <div className="mb-1 flex items-center justify-between px-2 py-1">
              <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">More</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="tap-target flex items-center justify-center text-slate-400"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {MORE.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 active:bg-slate-100",
                  isActive(item.href) && "bg-brand-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    isActive(item.href)
                      ? "bg-brand-500 text-white"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                  <span className="block truncate text-xs text-slate-500">{item.hint}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Primary"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 pt-1">
          {PRIMARY.slice(0, 2).map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}

          <Link
            href="/sessions/new"
            aria-label="Start a session"
            className="tap-target -mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30 active:bg-brand-600"
          >
            <Plus className="h-6 w-6" aria-hidden />
          </Link>

          {PRIMARY.slice(2).map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="More"
            className={cn(
              "tap-target flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5",
              open || moreActive ? "text-brand-600" : "text-slate-400",
            )}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            <span className={cn("text-[10px]", open || moreActive ? "font-semibold" : "font-medium")}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "tap-target flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5",
        active ? "text-brand-600" : "text-slate-400",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span className={cn("text-[10px]", active ? "font-semibold" : "font-medium")}>{label}</span>
    </Link>
  );
}
