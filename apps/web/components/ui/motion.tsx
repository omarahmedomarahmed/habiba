"use client";

import { motion, useInView, type Variants } from "framer-motion";
import { useRef, type ReactNode } from "react";

// ─── Shared variants ──────────────────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

// ─── Scroll-triggered reveal component ────────────────────────────────────────

interface RevealProps {
  children: ReactNode;
  variant?: Variants;
  delay?: number;
  className?: string;
  once?: boolean;
}

export function Reveal({
  children,
  variant = fadeUp,
  delay = 0,
  className,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      variants={variant}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Staggered list ────────────────────────────────────────────────────────────

interface StaggerListProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
}

export function StaggerList({ children, className, delay = 0, once = true }: StaggerListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      variants={staggerContainer}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Individual stagger item ───────────────────────────────────────────────────

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  variant?: Variants;
}

export function StaggerItem({ children, className, variant = fadeUp }: StaggerItemProps) {
  return (
    <motion.div variants={variant} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Section header with animated eyebrow + heading ───────────────────────────

interface SectionHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  centered?: boolean;
  light?: boolean;
}

export function SectionHeader({ eyebrow, title, description, centered = true, light = false }: SectionHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      variants={staggerContainer}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={centered ? "text-center" : ""}
    >
      {eyebrow && (
        <motion.div variants={fadeUp} className="mb-4">
          <span className={`inline-flex items-center gap-2 text-sm font-semibold tracking-wide uppercase px-4 py-1.5 rounded-full ${
            light
              ? "bg-white/10 text-white/80 border border-white/15"
              : "bg-[#1F5EFF]/10 text-[#1F5EFF] border border-[#1F5EFF]/20"
          }`}>
            {eyebrow}
          </span>
        </motion.div>
      )}
      <motion.h2
        variants={fadeUp}
        className={`text-4xl sm:text-5xl font-bold leading-tight mb-4 ${
          light ? "text-white" : "text-[#0A2342]"
        }`}
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          variants={fadeUp}
          className={`text-lg leading-relaxed max-w-2xl ${centered ? "mx-auto" : ""} ${
            light ? "text-white/60" : "text-slate-500"
          }`}
        >
          {description}
        </motion.p>
      )}
    </motion.div>
  );
}

// Re-export framer-motion primitives for convenience
export { motion, useInView };

// Reviewed: 2026-06-13 — 24Therapy audit
