"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Home, MoreHorizontal, Plus, X } from "lucide-react";

import { switchToClinic } from "@/app/(app)/switch-principal/actions";
import { destinationsFor } from "@/lib/nav/clinician";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

/**
 * Bottom navigation — the primary navigation on every screen size up to
 * desktop, with Start as a raised centre action because it is the one thing
 * the product exists to do.
 *
 * Three destinations plus a sheet, not thirteen tabs. The sheet wins on one
 * condition, which is that it stays short: if it ever needs a scrollbar, the
 * product has too many top-level places to be.
 *
 * 🔴 W2-T07: the destinations are `destinationsFor`, the list the desktop
 * sidebar renders too. This file kept its own two lists, and they drifted: the
 * calendar was desktop-only, support was nowhere, and an applicant on a phone
 * lost Earnings. Labels are keys resolved where they are rendered (37L.2).
 *
 * Targets are 44px minimum; the previous bar shipped ~40px.
 */
export function BottomNav({
  cleared = true,
  clinic = false,
}: {
  cleared?: boolean;
  /** 🔴 63.2 / C352: this human also runs a practice, so the switch is offered. */
  clinic?: boolean;
}) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  const all = destinationsFor(cleared);
  const primary = all.filter((item) => item.primary);
  const more = all.filter((item) => !item.primary);

  // A sheet that survives navigation is a sheet covering the page you just
  // asked for.
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const moreActive = more.some((item) => isActive(item.href));

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
          {all.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={t(item.short ?? item.label)}
              icon={item.icon}
              active={isActive(item.href)}
            />
          ))}
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
              <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                {t("portal.nav.more")}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("common.close")}
                className="tap-target flex items-center justify-center text-slate-500"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {more.map((item) => (
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
                    isActive(item.href) ? "bg-brand-500 text-navy-600" : "bg-slate-100 text-slate-600",
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{t(item.label)}</span>
                  {item.hint ? (
                    <span className="block truncate text-xs text-slate-500">{t(item.hint)}</span>
                  ) : null}
                </span>
              </Link>
            ))}

            {/*
              🔴 63.2 / C352 — THE SWITCHER, and only for a human who has both.
              It was desktop-only, so a practice owner on a phone could not
              reach their practice at all. Same action, same handover.
            */}
            {clinic ? (
              <form action={switchToClinic}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start active:bg-slate-100"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Building2 className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {t("portal.nav.switchToClinic")}
                  </span>
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav
        aria-label={t("portal.nav.primary")}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 pt-1">
          {primary.slice(0, 2).map((item) => (
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
            className="tap-target -mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-navy-600 shadow-lg shadow-brand-500/30 active:bg-brand-600"
          >
            <Plus className="h-6 w-6" aria-hidden />
          </Link>

          {primary.slice(2).map((item) => (
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
              open || moreActive ? "text-brand-700" : "text-slate-500",
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
        active ? "text-brand-700" : "text-slate-500",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span className={cn("text-[10px]", active ? "font-semibold" : "font-medium")}>{label}</span>
    </Link>
  );
}
