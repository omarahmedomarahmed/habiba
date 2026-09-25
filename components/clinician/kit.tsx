import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * THE CLINICIAN PORTAL'S PARTS, in the look of `app/design/_ds` (the approved
 * mockups): a navy ground and ink, the brand teal for the thing you press
 * (always with navy ink on it), amber for money owed and anything waiting,
 * red for SOS and nothing else.
 *
 * Same names and props as `components/ui`, so a page moves across by changing
 * one import and nothing about what it renders or submits.
 */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  full?: boolean;
};

/* Navy ink on the teal, lighter on hover, as `components/ui` measured it. */
export const BUTTON_VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-500 text-navy-600 hover:bg-brand-400 active:bg-brand-600 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.8)]",
  secondary: "border border-navy-100 bg-white text-navy-600 hover:bg-navy-50 active:bg-navy-100",
  ghost: "text-navy-500 hover:bg-navy-50 active:bg-navy-100",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
};

export const BUTTON_SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3.5 text-sm rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm rounded-2xl gap-2",
  lg: "h-13 px-6 text-base rounded-2xl gap-2",
};

/** The classes of a button, for a `<Link>` that should look like one. */
export function buttonClass(variant: NonNullable<ButtonProps["variant"]> = "primary", size: NonNullable<ButtonProps["size"]> = "md") {
  return cn(
    "inline-flex items-center justify-center font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
  );
}

export function Button({ className, variant = "primary", size = "md", full, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonClass(variant, size), "disabled:pointer-events-none disabled:opacity-50", full && "w-full", className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-navy-100/80 bg-white shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)]",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-navy-600">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-navy-400">{hint}</p>
      ) : null}
    </div>
  );
}

const FIELD =
  "w-full rounded-2xl border border-navy-100 bg-white text-navy-700 placeholder:text-navy-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(FIELD, "h-12 px-4 disabled:bg-navy-50 disabled:text-navy-400", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(FIELD, "px-4 py-3 leading-relaxed", className)} {...props} />;
  },
);

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "brand" | "teal";
  className?: string;
}) {
  const tones = {
    slate: "bg-navy-50 text-navy-600 ring-navy-100",
    green: "bg-brand-50 text-brand-800 ring-brand-100",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    brand: "bg-brand-50 text-brand-800 ring-brand-100",
    teal: "bg-brand-50 text-brand-700 ring-brand-100",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          {icon}
        </div>
      ) : null}
      <p className="text-[16px] font-bold text-navy-700">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-navy-400">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** The heading every page opens with: large navy title, one quiet line under it. */
export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-4 pt-6 pb-4 sm:px-6">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[13px] font-semibold text-navy-400">{eyebrow}</p> : null}
        <h1 className="text-[26px] leading-tight font-bold tracking-tight text-navy-700">{title}</h1>
        {subtitle ? <p className="mt-1 text-[15px] leading-relaxed text-navy-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** A figure with a label, the unit the portal is read in. `dark` is for the one that matters most. */
export function Stat({
  label,
  children,
  note,
  tone = "light",
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  note?: React.ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl p-5",
        dark ? "bg-navy-900 text-white" : "border border-navy-100/80 bg-white shadow-[0_1px_2px_rgba(10,35,66,0.04)]",
        className,
      )}
    >
      {dark ? <Glow className="-end-16 -top-16 h-44 w-44 opacity-60" /> : null}
      <p className={cn("relative text-[13px] font-semibold", dark ? "text-white/70" : "text-navy-400")}>{label}</p>
      <div className={cn("relative mt-1 text-[28px] leading-tight font-bold tabular-nums", dark ? "text-white" : "text-navy-700")}>{children}</div>
      {note ? <p className={cn("relative mt-1 text-[13px]", dark ? "text-white/70" : "text-navy-400")}>{note}</p> : null}
    </div>
  );
}

/** A title over a group, with an optional link or action on the other side. */
export function SectionHead({ title, action, className }: { title: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-[17px] font-bold text-navy-700">{title}</h2>
      {action ? <div className="shrink-0 text-sm font-semibold text-brand-700">{action}</div> : null}
    </div>
  );
}

/** A rounded square holding an icon, in a tone. */
export function IconTile({
  children,
  tone = "navy",
  className,
}: {
  children: React.ReactNode;
  tone?: "navy" | "brand" | "amber" | "red" | "dark";
  className?: string;
}) {
  const tones = {
    navy: "bg-navy-50 text-navy-500 ring-navy-100",
    brand: "bg-brand-500 text-navy-600 ring-brand-400",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-600 ring-red-200",
    dark: "bg-navy-700 text-brand-300 ring-navy-600",
  };
  return (
    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
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

/** Initials on a navy-to-teal field chosen from the name, so each person keeps one colour everywhere. */
const TONES = [
  ["#0a2342", "#2ec4b6"],
  ["#15746c", "#9ae9de"],
  ["#07182e", "#5fdccc"],
  ["#4a5d72", "#cbf4ed"],
  ["#0e544e", "#38d0be"],
];

export function Avatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const [from, to] = TONES[hash % TONES.length]!;
  const letters = name
    .replace(/^Dr\.? /, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => [...part][0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.36, backgroundColor: from, backgroundImage: `linear-gradient(135deg, ${from} 35%, ${to})` }}
    >
      {letters}
    </span>
  );
}
