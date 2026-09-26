"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Shoot P19: the band behind the language corner, shown only once the page
 * has scrolled.
 *
 * At the top of a page the first row (Back, a title) sits beside the corner
 * and must stay readable, so nothing covers it. Once the page moves, whatever
 * scrolls up under the corner fades into the page's own colour before it
 * reaches the controls, instead of reading through them.
 */
export function ScrollScrim() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const read = () => setScrolled(window.scrollY > 8);
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 z-40 h-20 bg-gradient-to-b from-navy-50 via-navy-50/95 to-navy-50/0 transition-opacity duration-150",
        scrolled ? "opacity-100" : "opacity-0",
      )}
      style={{ top: "var(--sim-banner-h, 0px)" }}
    />
  );
}
