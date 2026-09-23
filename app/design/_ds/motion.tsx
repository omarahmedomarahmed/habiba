"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  animate,
  motion,
  MotionConfig,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type HTMLMotionProps,
  type Variants,
} from "motion/react";

/**
 * The one motion vocabulary every design sample shares (takeover/design/RESEARCH.md):
 * rise on enter, spring on press, a sliding pill on select, numbers that count,
 * and a pulse only for things that are live. `reducedMotion="user"` turns every
 * transform into a fade for anyone whose device asks for less motion.
 */
export const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;
export const soft = { type: "spring", stiffness: 180, damping: 26 } as const;

export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={spring}>
      {children}
    </MotionConfig>
  );
}

export const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: soft },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

/** A block that rises into place the first time it scrolls into view. */
export function Rise({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ ...soft, delay }}
    >
      {children}
    </motion.div>
  );
}

/** A list whose children arrive one after another. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={stagger} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function Item({ children, className, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div className={className} variants={rise} {...rest}>
      {children}
    </motion.div>
  );
}

/** Anything pressable: a spring squeeze on press, a small lift on hover. */
export function Press({ children, className, ...rest }: HTMLMotionProps<"button">) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.965 }}
      whileHover={{ y: -1 }}
      transition={spring}
      className={className}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/**
 * A whole number with thousands commas, the same on every device. The runtime's
 * locale is never asked (sprint 12.3), so the server and the phone agree.
 */
export function grouped(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** A number that counts to its value the first time it is seen, and to every new value after. */
export function Count({
  value,
  format = (n) => grouped(n),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (n) => format(n));

  useEffect(() => {
    if (!seen) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [seen, value, reduce, mv]);

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

/** The only loop allowed: something that is live right now. */
export function LivePulse({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-2.5 w-2.5 ${className}`}>
      <motion.span
        className="absolute inset-0 rounded-full bg-brand-400"
        animate={{ scale: [1, 2.4], opacity: [0.55, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
      />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
    </span>
  );
}
