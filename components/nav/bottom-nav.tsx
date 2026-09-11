"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  KeyRound,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

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
/*
 * 37L.2 — keys, not words.
 *
 * These were English strings in a module-level constant, which is the shape
 * this project keeps finding: copy in a place no translator is looking and no
 * hook can reach. The label is resolved where it is rendered.
 */
const PRIMARY = [
  { href: "/dashboard", label: "portal.nav.home", icon: Home },
  { href: "/sessions", label: "portal.nav.sessions", icon: CalendarDays },
  { href: "/patients", label: "portal.nav.patients", icon: Users },
] as const satisfies readonly { href: string; label: MessageKey; icon: typeof Home }[];

const MORE = [
  {
    href: "/copilot",
    label: "portal.nav.copilot",
    icon: MessageSquare,
    hint: "portal.nav.hintCopilot",
  },
  /*
   * Named for what it is *not* allowed to see, because the two copilots are
   * one tap apart and a clinician who asks the wrong one gets a refusal
   * instead of an answer. "Assistant · your practice" beside "Copilot · ask
   * about a patient" is the whole distinction.
   */
  {
    href: "/assistant",
    label: "portal.nav.assistant",
    icon: Sparkles,
    hint: "portal.nav.hintAssistant",
  },
  { href: "/notes", label: "portal.nav.notes", icon: FileText, hint: "portal.nav.hintNotes" },
  /* 27.2 / 27.7 — the two things a patient starts and a clinician answers. */
  { href: "/connect", label: "portal.nav.connect", icon: KeyRound, hint: "portal.nav.hintConnect" },
  {
    href: "/on-call",
    label: "portal.nav.crisisRadar",
    icon: Radio,
    hint: "portal.nav.hintRadar",
  },
  {
    href: "/earnings",
    label: "portal.nav.earnings",
    icon: Wallet,
    hint: "portal.nav.hintEarnings",
  },
  {
    href: "/billing",
    label: "portal.nav.billing",
    icon: CreditCard,
    hint: "portal.nav.hintBilling",
  },
  {
    href: "/settings",
    label: "portal.nav.settings",
    icon: Settings,
    hint: "portal.nav.hintSettings",
  },
] as const satisfies readonly {
  href: string;
  label: MessageKey;
  icon: typeof Home;
  hint: MessageKey;
}[];

export function BottomNav({ cleared = true }: { cleared?: boolean }) {
  const pathname = usePathname();
  const t = useT();
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
        aria-label={t("portal.nav.primary")}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 pt-1">
          <NavItem
            href="/onboarding"
            label={t("portal.nav.verify")}
            icon={ShieldCheck}
            active={isActive("/onboarding")}
          />
          <NavItem
            href="/billing"
            label={t("portal.nav.billing")}
            icon={CreditCard}
            active={isActive("/billing")}
          />
          <NavItem
            href="/settings"
            label={t("portal.nav.settings")}
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
            aria-label={t("portal.nav.closeMenu")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-navy-500/50 backdrop-blur-sm"
          />
          <div className="safe-bottom animate-fade-rise absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-3 pb-24">
            <div className="mb-1 flex items-center justify-between px-2 py-1">
              <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                {t("portal.nav.more")}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("common.close")}
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
                    isActive(item.href) ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500",
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{t(item.label)}</span>
                  <span className="block truncate text-xs text-slate-500">{t(item.hint)}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <nav
        aria-label={t("portal.nav.primary")}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 pt-1">
          {PRIMARY.slice(0, 2).map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={t(item.label)}
              active={isActive(item.href)}
            />
          ))}

          <Link
            href="/sessions/new"
            aria-label={t("portal.dash.start")}
            className="tap-target -mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30 active:bg-brand-600"
          >
            <Plus className="h-6 w-6" aria-hidden />
          </Link>

          {PRIMARY.slice(2).map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={t(item.label)}
              active={isActive(item.href)}
            />
          ))}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={t("portal.nav.more")}
            className={cn(
              "tap-target flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5",
              open || moreActive ? "text-brand-600" : "text-slate-400",
            )}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            <span
              className={cn("text-[10px]", open || moreActive ? "font-semibold" : "font-medium")}
            >
              {t("portal.nav.more")}
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
