"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { groupOf } from "@/lib/nav/clinician";
import { cn } from "@/lib/utils";

/**
 * One place in the desktop sidebar. It lights up on every page of its group
 * (ruling 14b), the same rule the phone bar reads as active, so the two never
 * disagree about where the clinician is.
 */
export function SidebarLink({
  href,
  icon,
  cleared = true,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  cleared?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const on = groupOf(pathname, cleared)?.href === href || pathname === href;
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "relative flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        on
          ? "bg-brand-500 text-navy-700 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.9)]"
          : "text-white/75 hover:bg-white/5 hover:text-white",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </Link>
  );
}
