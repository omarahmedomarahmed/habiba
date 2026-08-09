"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, Home, Plus, Users } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Bottom navigation — the primary navigation on every screen size up to
 * desktop, with Start as a raised centre action because it is the one thing
 * the product exists to do.
 *
 * Four destinations, not thirteen. The old app crammed a five-tab bar plus an
 * eight-item "More" drawer into the same space, which is the interface telling
 * you the product has too many features rather than the navigation being clever.
 * Targets are 44px minimum; the previous bar shipped ~40px.
 */
const ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/notes", label: "Notes", icon: FileText },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  // The live room is full-bleed; navigation would be a way to lose a session.
  if (pathname.endsWith("/room")) return null;

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pt-1">
        {ITEMS.slice(0, 2).map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}

        <Link
          href="/sessions/new"
          aria-label="Start a session"
          className="tap-target -mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30 active:bg-brand-600"
        >
          <Plus className="h-6 w-6" aria-hidden />
        </Link>

        {ITEMS.slice(2).map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </div>
    </nav>
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
