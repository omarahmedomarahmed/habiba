"use client";

import { useId, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search as SearchIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { Press, soft, spring } from "./motion";

/**
 * The shared parts every sample is built from, so a chip, a sheet or a ring
 * looks and moves the same in the app, the portals and the website.
 * Colours: navy ground and ink, brand teal to press (always with navy ink on
 * it), amber for money owed, red for SOS alone.
 */

export function Btn({
  children,
  kind = "primary",
  className,
  onClick,
  disabled,
}: {
  children: ReactNode;
  kind?: "primary" | "dark" | "ghost" | "money" | "light";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Press
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:opacity-50",
        kind === "primary" && "bg-brand-500 text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)] hover:bg-brand-400",
        kind === "dark" && "bg-navy-600 text-white hover:bg-navy-500",
        kind === "ghost" && "border border-navy-200 bg-white/70 text-navy-600 backdrop-blur hover:bg-white",
        kind === "light" && "border border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/15",
        kind === "money" && "bg-amber-400 text-navy-700 hover:bg-amber-300",
        className,
      )}
    >
      {children}
    </Press>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-navy-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)]", className)}>
      {children}
    </div>
  );
}

/** A row of choices where the selection is a pill that slides, never a jump. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  dark = false,
  className,
}: {
  options: Array<{ id: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (id: T) => void;
  dark?: boolean;
  className?: string;
}) {
  const layoutId = useId();
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Press
            key={option.id}
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              dark
                ? active ? "text-navy-700" : "bg-white/8 text-white/85 ring-1 ring-white/12"
                : active ? "text-white" : "bg-white text-navy-600 ring-1 ring-navy-100",
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                transition={spring}
                className={cn("absolute inset-0 rounded-full", dark ? "bg-brand-500" : "bg-navy-600")}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </Press>
        );
      })}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  dark = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  dark?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex h-12 items-center gap-2.5 rounded-2xl px-4 transition-shadow focus-within:ring-2 focus-within:ring-brand-400",
        dark ? "bg-white/10 text-white ring-1 ring-white/15 backdrop-blur" : "bg-white text-navy-600 ring-1 ring-navy-100",
      )}
    >
      <SearchIcon className="h-[18px] w-[18px] shrink-0 opacity-70" aria-hidden />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none",
          dark ? "placeholder:text-white/60" : "placeholder:text-navy-400",
        )}
      />
      <AnimatePresence>
        {value ? (
          <motion.button
            type="button"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            onClick={() => onChange("")}
            aria-label="Clear"
            className="rounded-full p-1"
          >
            <X className="h-4 w-4" aria-hidden />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </label>
  );
}

/** A left-and-right scroller: snaps to cards, no scrollbar, content bleeds to the edge. */
export function Rail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHead({ title, action, dark = false }: { title: string; action?: string; dark?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <p className={cn("text-[17px] font-bold", dark ? "text-white" : "text-navy-700")}>{title}</p>
      {action ? <span className={cn("text-[14px] font-semibold", dark ? "text-brand-300" : "text-navy-500")}>{action}</span> : null}
    </div>
  );
}

/** A sheet that springs up inside its frame. It never covers the frame's bottom bar. */
export function Sheet({
  open,
  onClose,
  children,
  bottom = 0,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Pixels to leave free at the bottom, so the bar and its SOS stay visible and reachable. */
  bottom?: number;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-x-0 top-0 z-30 bg-navy-900/45 backdrop-blur-[2px]"
            style={{ bottom }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 z-40 max-h-[82%] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-5 pt-3 shadow-[0_-20px_60px_-20px_rgba(3,11,23,0.45)] [scrollbar-width:none]"
            style={{ bottom }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90) onClose();
            }}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-navy-200" />
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

/** A progress ring that draws itself. */
export function Ring({
  value,
  size = 96,
  stroke = 10,
  children,
  track = "rgba(10,35,66,0.08)",
  color = "var(--color-brand-500)",
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  track?: string;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          viewport={{ once: false }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** A small line chart whose line draws in. */
export function Spark({
  points,
  width = 220,
  height = 64,
  color = "var(--color-brand-500)",
  fill = true,
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const step = width / (points.length - 1);
  const y = (v: number) => height - 6 - ((v - min) / (max - min || 1)) * (height - 12);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const id = useId();
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill ? (
        <motion.path
          d={`${d} L${width},${height} L0,${height} Z`}
          fill={`url(#${id})`}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
      ) : null}
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx={(points.length - 1) * step}
        cy={y(points[points.length - 1]!)}
        r={4}
        fill={color}
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ ...soft, delay: 1 }}
      />
    </svg>
  );
}

const TONES = [
  ["#0a2342", "#2ec4b6"],
  ["#15746c", "#9ae9de"],
  ["#07182e", "#5fdccc"],
  ["#4a5d72", "#cbf4ed"],
  ["#0e544e", "#38d0be"],
];

/** Initials on a navy-to-teal field chosen from the name, so each person keeps one colour everywhere. */
export function Avatar({ name, size = 44, live = false, ring = false }: { name: string; size?: number; live?: boolean; ring?: boolean }) {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const [from, to] = TONES[hash % TONES.length]!;
  const initials = name
    .replace(/^Dr\.? /, "")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", ring && "ring-2 ring-white")}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {initials}
      {live ? (
        <span className="absolute -bottom-0.5 -end-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
        </span>
      ) : null}
    </span>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-400",
        on ? "bg-brand-500" : "bg-navy-200",
      )}
    >
      <motion.span layout transition={spring} className={cn("h-6 w-6 rounded-full bg-white shadow", on && "ms-auto")} />
    </button>
  );
}

/** A toast that slides in from the top of its frame and leaves on its own. */
export function Toast({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ y: -40, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={spring}
          className="absolute inset-x-4 top-3 z-50 flex items-center gap-2 rounded-2xl bg-navy-700 px-4 py-3 text-[14px] font-semibold text-white shadow-xl"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** A soft teal light behind whatever matters most on a surface. */
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute rounded-full blur-3xl", className)}
      style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
    />
  );
}
