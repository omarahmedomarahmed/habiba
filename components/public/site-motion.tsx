"use client";

import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The website's motion, from the mockups' one vocabulary: rise on enter, a
 * spring on press, and a pulse only for what is live. `reducedMotion="user"`
 * turns every movement into a fade for a reader whose device asks for less.
 */
const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;

/**
 * Questions, one open at a time, the first open on arrival. The answers are in
 * the markup whether open or not, so a crawler and a screen reader reading the
 * whole page still get every one.
 */
export function FaqList({ items }: { items: Array<{ q: string; a: string }> }) {
  const [open, setOpen] = useState<number | null>(items.length ? 0 : null);
  return (
    <MotionConfig reducedMotion="user">
      <ul className="space-y-3">
        {items.map((item, i) => {
          const on = open === i;
          return (
            <li
              key={item.q}
              className={cn(
                "overflow-hidden rounded-2xl ring-1 transition-colors",
                on ? "bg-navy-900 text-white ring-navy-900" : "bg-navy-50 text-navy-700 ring-navy-100",
              )}
            >
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(on ? null : i)}
                  aria-expanded={on}
                  className="flex w-full items-center gap-3 p-5 text-start text-[17px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                >
                  <span className="flex-1">{item.q}</span>
                  <motion.span animate={{ rotate: on ? 180 : 0 }} transition={spring} className="shrink-0">
                    <ChevronDown className="h-5 w-5" aria-hidden />
                  </motion.span>
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {on ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <p className="px-5 pb-5 text-[16px] leading-relaxed text-white/85">{item.a}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              {!on ? <p className="sr-only">{item.a}</p> : null}
            </li>
          );
        })}
      </ul>
    </MotionConfig>
  );
}
