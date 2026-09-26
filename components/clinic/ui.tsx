import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * THE CLINIC PORTAL'S OWN PIECES, beside `components/clinician/kit.tsx`, which
 * it borrows the rest from (cards, stats, badges, buttons), so a practice that
 * also runs sessions reads one product. Only what the clinician portal has no
 * need for lives here: a page heading sized for the desk's column, a ring for
 * seats, and a thin bar for a share of a total.
 *
 * No words in this file: every label arrives as a prop, already translated.
 */

/** The heading every clinic page opens with, as the clinician portal's `PageHeader` without its own gutter. */
export function ClinicHead({
  title,
  subtitle,
  action,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** A quiet line under the heading, such as what an export carries. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-bold tracking-tight text-navy-700">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-navy-400">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

/** A ring drawn to a fraction, with a figure inside it. Static: it is read, not watched. */
export function Ring({
  value,
  size = 112,
  stroke = 12,
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" className="stroke-navy-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          className="stroke-brand-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** A thin bar for one row's share of the largest, so a list of figures can be compared at a glance. */
export function Share({ value, className }: { value: number; className?: string }) {
  const shown = Math.max(0, Math.min(1, value));
  return (
    <div aria-hidden className={cn("h-1.5 overflow-hidden rounded-full bg-navy-50", className)}>
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round(shown * 100)}%` }} />
    </div>
  );
}
