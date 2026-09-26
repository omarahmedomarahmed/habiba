"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

import { useT } from "@/lib/i18n/client";
import { groupOf } from "@/lib/nav/clinician";
import { cn } from "@/lib/utils";

/**
 * 🔴 RULING 14b: THE PAGES A GROUP HOLDS, AS A ROW OF TABS AT THE TOP OF EACH.
 *
 * The navigation lists six places; this row is how every page inside one stays
 * a tap away. It is drawn from the same list the sidebar and the phone bar
 * render (`lib/nav/clinician.ts`), so a page cannot be in a group and missing
 * from its tabs. Nothing is drawn for a group of one, or in the live room.
 *
 * It sits in the portal's top bar, and the selection is a navy pill that
 * slides to the page you chose, as in the approved mockups.
 */
export function SectionTabs({ cleared = true }: { cleared?: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const group = groupOf(pathname, cleared);
  const members = group?.members ?? [];
  if (members.length < 2 || pathname.endsWith("/room")) return null;

  /* The longest match wins, so /sessions/new stays on Sessions and /notes on Notes. */
  const within = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const active = [...members].filter((m) => within(m.href)).sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav aria-label={t(group!.label)} className="px-4 pb-3 sm:px-6 lg:py-3">
      <ul className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {members.map((member) => {
          const on = active?.href === member.href;
          return (
            <li key={member.href} className="shrink-0">
              <Link
                href={member.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  on ? "text-white" : "bg-white text-navy-500 ring-1 ring-navy-100 hover:text-navy-700",
                )}
              >
                {on ? (
                  <motion.span
                    layoutId="section-tab"
                    transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.9 }}
                    className="absolute inset-0 rounded-full bg-navy-600"
                  />
                ) : null}
                <span className="relative">{t(member.label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
