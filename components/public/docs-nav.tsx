"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * 🔴 76.78 — THE LEFT NAV OF A DOCUMENTATION PAGE, and it tracks where you are.
 *
 * ## Why it highlights rather than just linking
 *
 * A nav that never moves is a table of contents, and a reader halfway down a
 * long technical page has already lost their place in it. The highlight is the
 * one thing that makes a sidebar worth its width.
 *
 * ## `IntersectionObserver`, not a scroll handler
 *
 * A scroll listener recomputing offsets is the classic way to make a docs page
 * jank on a phone. The observer fires only when a section crosses the band, and
 * the band is the top third of the viewport so a heading "becomes current" as it
 * reaches reading position rather than as it leaves the screen.
 *
 * ## On a phone it is a scrolling strip
 *
 * Not hidden. A reader on a phone needs the map more than a reader on a desk,
 * and a nav that disappears under 1024px is the usual way that gets lost.
 */
export function DocsNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      /* The top third: a heading is "current" when it reaches reading position. */
      { rootMargin: "-80px 0px -66% 0px", threshold: 0 },
    );

    for (const { id } of sections) {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    }
    return () => { observer.disconnect(); };
  }, [sections]);

  return (
    <nav
      aria-label="On this page"
      className="no-scrollbar sticky top-16 z-10 -mx-4 mb-6 overflow-x-auto border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur lg:mx-0 lg:mb-0 lg:h-fit lg:overflow-visible lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none"
    >
      <ul className="flex gap-1 lg:block lg:space-y-0.5">
        {sections.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={id === active ? "true" : undefined}
              className={cn(
                "block shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors lg:whitespace-normal",
                id === active
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
