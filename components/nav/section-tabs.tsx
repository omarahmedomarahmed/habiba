"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <nav aria-label={t(group!.label)} className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
      <ul className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
        {members.map((member) => (
          <li key={member.href} className="flex-1">
            <Link
              href={member.href}
              aria-current={active?.href === member.href ? "page" : undefined}
              className={cn(
                "block rounded-xl px-3 py-2 text-center text-sm font-semibold whitespace-nowrap",
                active?.href === member.href ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {t(member.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
