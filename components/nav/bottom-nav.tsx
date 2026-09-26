"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Home, MoreHorizontal, Plus, X } from "lucide-react";

import { switchToClinic } from "@/app/(app)/switch-principal/actions";
import { destinationsFor, groupOf } from "@/lib/nav/clinician";
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

  /* 🔴 Ruling 14b: a group reads as active on any page inside it. */
  const current = groupOf(pathname, cleared)?.href ?? null;
  const isActive = (href: string) =>
    current === href || (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

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
        data-bottom-nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3 lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around rounded-[26px] bg-navy-900/95 px-2 py-1 shadow-[0_20px_40px_-16px_rgba(3,11,23,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
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
            className="absolute inset-0 bg-navy-900/45 backdrop-blur-[2px]"
          />
          <div className="safe-bottom animate-fade-rise absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white p-3 pb-28 shadow-[0_-20px_60px_-20px_rgba(3,11,23,0.45)]">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-navy-100" aria-hidden />
            <div className="mb-1 flex items-center justify-between px-2 py-1">
              <p className="text-[17px] font-bold text-navy-700">
                {t("portal.nav.more")}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("common.close")}
                className="tap-target flex items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {more.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 active:bg-navy-50",
                  isActive(item.href) && "bg-brand-50 ring-1 ring-brand-100",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                    isActive(item.href) ? "bg-brand-500 text-navy-600" : "bg-navy-50 text-navy-500",
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-navy-700">{t(item.label)}</span>
                  {item.hint ? (
                    <span className="block truncate text-[13px] text-navy-400">{t(item.hint)}</span>
                  ) : null}
                </span>
              </Link>
            ))}

            {/*
              🔴 63.2 / C352: THE SWITCHER, and only for a human who has both.
              It was desktop-only, so a practice owner on a phone could not
              reach their practice at all. Same action, same handover.
            */}
            {clinic ? (
              <form action={switchToClinic}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start active:bg-navy-50"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-500">
                    <Building2 className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-[15px] font-semibold text-navy-700">
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
        data-bottom-nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3 lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around rounded-[26px] bg-navy-900/95 px-2 py-1 shadow-[0_20px_40px_-16px_rgba(3,11,23,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
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
            className="tap-target -mt-7 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-navy-600 shadow-[0_10px_28px_-8px_rgba(46,196,182,0.9)] ring-4 ring-navy-50 active:bg-brand-600"
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
              "tap-target my-1 flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-colors",
              open || moreActive ? "text-brand-300" : "text-white/70",
            )}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            <span
              className={cn("text-[11px]", open || moreActive ? "font-semibold" : "font-medium")}
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
        "tap-target my-1 flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-colors",
        active ? "bg-white/10 text-brand-300" : "text-white/70",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span className={cn("text-[11px]", active ? "font-semibold" : "font-medium")}>{label}</span>
    </Link>
  );
}
