"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CircleUser, Globe2, ListChecks, Receipt } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The patient's bottom navigation. PLAN.md 15.1.
 *
 * ## The globe is in the centre and it is bigger
 *
 * Not decoration. The radar is the one thing on this app somebody might need
 * *urgently*, and a person in distress should not have to read five labels to
 * find it. It sits under the thumb, it is the only lifted item, and it keeps
 * its emphasis whether or not it is the current page.
 *
 * ## Five, not more
 *
 * Sessions, homework, the globe, billing, account. Everything else lives
 * inside one of those. A patient app with a "more" tab is one where the thing
 * somebody needs is always in the drawer.
 */
const LEFT = [
  { href: "/patient", label: "Sessions", icon: CalendarDays },
  { href: "/patient/homework", label: "Steps", icon: ListChecks },
] as const;

const RIGHT = [
  { href: "/patient/billing", label: "Billing", icon: Receipt },
  { href: "/patient/account", label: "You", icon: CircleUser },
] as const;

export function PatientBottomNav() {
  const pathname = usePathname();
  const on = (href: string) =>
    href === "/patient" ? pathname === "/patient" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Sections"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md items-end justify-between px-2 py-1.5">
        {LEFT.map((item) => (
          <Item key={item.href} {...item} active={on(item.href)} />
        ))}

        <li className="-mt-5">
          <Link
            href="/radar"
            aria-label="Find someone now"
            className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 active:scale-95"
          >
            <Globe2 className="h-6 w-6" aria-hidden />
          </Link>
        </li>

        {RIGHT.map((item) => (
          <Item key={item.href} {...item} active={on(item.href)} />
        ))}
      </ul>
    </nav>
  );
}

function Item({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof CalendarDays;
  active: boolean;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "tap-target flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium",
          active ? "text-brand-600" : "text-slate-500",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
        {label}
      </Link>
    </li>
  );
}
