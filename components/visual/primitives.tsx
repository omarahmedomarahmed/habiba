import type { ReactNode } from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 🔴 65.4 / 65.22 — THE VISUAL VOCABULARY. BUILT ONCE, REUSED, NEVER A ONE-OFF CARD.
 *
 * Six primitives, and the number is the point. A sprint that translates fifty
 * paragraphs into fifty bespoke cards has produced fifty things to maintain and a
 * product that looks assembled: the same rule, on two screens, has to look like the
 * same rule.
 *
 * ## 🔴 65.22 — EVERY VISUAL ELEMENT ENCODES SOMETHING TRUE OR IT DOES NOT SHIP
 *
 * *A numbered 01/02/03 strip over content that is not a sequence, an accent bar that
 * means nothing, an icon chosen because the row looked bare.*
 *
 * So `FlowStrip` numbers its steps because a flow IS a sequence, and `SeesWhat` uses a
 * tick and a cross because "can" and "cannot" are the two states it is about. There is
 * no decorative component here and no `accent` prop on any of them.
 *
 * ## 🔴 65.23 — AND NOTHING HERE HIDES BEHIND AN INTERACTION
 *
 * *Anything a regulator, a payer or a court would expect a person to have seen stays
 * visible without an interaction. Hidden is not minimal, it is gone.*
 *
 * There is no accordion, no tooltip, no "read more" and no `collapsed` prop. A
 * disclaimer that became a tooltip is the failure mode of this whole sprint, and the
 * cheapest way to prevent it is to have nothing that could do it.
 *
 * ## 🔴 65.21 — ARABIC FIRST
 *
 * Every one of these uses logical properties (`ms-`, `me-`, `text-start`) and wraps
 * rather than truncating. A layout designed around an English sentence length breaks
 * on a language that does not have one, and sprint 37L is the record of what that
 * costs when it is retrofitted.
 */

/* ═══════════════════════════════════════════════════════ 1 · state banner ══ */

export type BannerTone = "good" | "warn" | "bad" | "info";

const BANNER: Record<BannerTone, { ring: string; text: string; Icon: typeof Check }> = {
  good: { ring: "border-teal-200 bg-teal-50", text: "text-teal-900", Icon: Check },
  warn: { ring: "border-amber-200 bg-amber-50", text: "text-amber-900", Icon: AlertTriangle },
  bad: { ring: "border-red-200 bg-red-50", text: "text-red-900", Icon: X },
  info: { ring: "border-slate-200 bg-slate-50", text: "text-slate-700", Icon: Info },
};

/**
 * 🔴 ONE LINE AND AN ICON. The commonest replacement for a paragraph in this product.
 *
 * A `detail` is allowed and is deliberately capped by convention rather than by code:
 * the moment a banner needs three sentences it is a paragraph with a coloured
 * background, which is the thing being removed rather than a way of keeping it.
 */
export function StateBanner({
  tone,
  children,
  detail,
}: {
  tone: BannerTone;
  children: ReactNode;
  detail?: ReactNode;
}) {
  const { ring, text, Icon } = BANNER[tone];

  return (
    <div className={cn("flex gap-3 rounded-2xl border p-4", ring)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", text)} aria-hidden />
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", text)}>{children}</p>
        {detail ? <p className={cn("mt-1 text-sm leading-relaxed", text)}>{detail}</p> : null}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ 2 · flow strip ══ */

/**
 * 🔴 NUMBERED, BECAUSE A FLOW IS A SEQUENCE.
 *
 * 65.22 forbids a numbered strip over content that is not one. This component exists
 * for content that IS: step two cannot happen before step one, and the number is the
 * information rather than the decoration.
 *
 * `done` marks how far somebody has got, which turns a diagram into a status.
 */
export function FlowStrip({
  steps,
  done = -1,
}: {
  steps: { title: string; detail?: string }[];
  /** Index of the last completed step. -1 is none. */
  done?: number;
}) {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:gap-2">
      {steps.map((step, i) => (
        <li key={step.title} className="flex flex-1 gap-3 sm:flex-col sm:gap-2">
          <div className="flex items-center gap-2 sm:w-full">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                i <= done ? "bg-teal-600 text-white" : "bg-slate-900 text-white",
              )}
            >
              {i <= done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            {/* The connector is a line between steps, and the last one has none. */}
            <span
              aria-hidden
              className={cn(
                "hidden h-px flex-1 sm:block",
                i === steps.length - 1 ? "bg-transparent" : "bg-slate-200",
              )}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{step.title}</p>
            {step.detail ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{step.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ══════════════════════════════════════════════════════ 3 · who sees what ══ */

/**
 * 🔴 65.11 — THE MOST IMPORTANT COMPONENT IN THIS FILE.
 *
 * *What a clinic can and cannot see is the single most important thing on the clinic
 * portal and is currently a wall.*
 *
 * Two columns, a tick and a cross, and no prose between them. The same shape serves
 * the sponsor's "you will never see an individual" and the patient's "what your
 * therapist's practice can see", which is three walls replaced by one component.
 *
 * 🔴 THE "NEVER" COLUMN IS THE SAME SIZE AS THE "CAN" COLUMN. A disclosure that
 * itemises the reach and summarises the limit in half a line is a disclosure written
 * to be survived rather than read.
 */
export function SeesWhat({
  who,
  can,
  cannot,
}: {
  who: string;
  can: string[];
  cannot: string[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <p className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {who}
      </p>
      <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
        <ul className="flex flex-col gap-2 bg-white p-4">
          {can.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm text-slate-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-2 bg-white p-4">
          {cannot.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm text-slate-700">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════ 4 · coverage meter ══ */

/**
 * 🔴 65.12 — A POT, ITS TERMS AND ITS EXPIRY, AS A METER WITH THREE STATES.
 *
 * The bar is the fact and the label under it is the consequence. A sponsor reading
 * "$4,120 of $10,000" knows a number; one reading "enough for about 40 more sessions"
 * knows what to do, and that is the question the paragraph was there to answer.
 */
export function Meter({
  usedLabel,
  ofLabel,
  fraction,
  note,
}: {
  usedLabel: string;
  ofLabel: string;
  /** 0 to 1. Clamped, because a figure above the cap renders past the box. */
  fraction: number;
  note?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  const tone = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-brand-500";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-2xl font-bold tabular-nums text-slate-900">{usedLabel}</p>
        <p className="text-sm text-slate-500">{ofLabel}</p>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ofLabel}
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      {note ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{note}</p> : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ 5 · eligibility ══ */

/**
 * 🔴 A CHECKLIST, AND THE UNMET ITEMS SAY WHAT TO DO.
 *
 * "You are not eligible" is a wall. A list where two of five are ticked and the three
 * that are not each carry a next step is the same information and is actionable, which
 * is the difference 65's acceptance criterion is written in.
 */
export function Checklist({
  items,
}: {
  items: { label: string; done: boolean; next?: string }[];
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.label} className="flex gap-2.5">
          {item.done ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
          ) : (
            <span
              aria-hidden
              className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-slate-300"
            />
          )}
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm",
                item.done ? "text-slate-500 line-through" : "font-medium text-slate-900",
              )}
            >
              {item.label}
            </p>
            {!item.done && item.next ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.next}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ══════════════════════════════════════════════════ 6 · before and after ══ */

/**
 * 🔴 TWO STATES OF ONE THING, SIDE BY SIDE.
 *
 * The fee split, the note before and after a clinician's edit, the record before and
 * after a claim. A paragraph explaining a change is almost always two short columns
 * with a label each, and the reader does the comparison themselves in one glance.
 */
export function BeforeAfter({
  beforeLabel,
  before,
  afterLabel,
  after,
}: {
  beforeLabel: string;
  before: ReactNode;
  afterLabel: string;
  after: ReactNode;
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
      <div className="bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {beforeLabel}
        </p>
        <div className="mt-1.5 text-sm text-slate-700">{before}</div>
      </div>
      <div className="bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {afterLabel}
        </p>
        <div className="mt-1.5 text-sm text-slate-700">{after}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ 7 · the split ══ */

export type SplitPart = {
  label: string;
  /** Minor units. Widths are proportional to this, so it has to be the real figure. */
  value: number;
  /** What kind of money this is. Not a colour choice: the three behave differently. */
  kind: "keep" | "fee" | "tax";
};

const SPLIT: Record<SplitPart["kind"], { bar: string; dot: string }> = {
  keep: { bar: "bg-teal-500", dot: "bg-teal-500" },
  fee: { bar: "bg-slate-400", dot: "bg-slate-400" },
  tax: { bar: "bg-amber-400", dot: "bg-amber-400" },
};

/**
 * 🔴 65.10 — THE FEE SPLIT AS A DIAGRAM, NOT A PARAGRAPH ABOUT A DIAGRAM.
 *
 * > *The fee split is a diagram, not a paragraph about a diagram.*
 *
 * One bar, segments proportional to the actual amounts, and the figures underneath. A
 * clinician reading "you keep $51, 24Therapy takes $9 (15%)" has to do the division
 * themselves to find out whether that is a lot; a bar that is 85% teal answers it before
 * they have finished reading the first number.
 *
 * ## 🔴 65.22 — THE WIDTH IS THE INFORMATION
 *
 * Which is the test this component has to pass and a decorative bar would fail: the
 * segments are sized from `value`, so a fee that doubled would look twice as wide. There
 * is no minimum width and no padding to make a small segment "visible", because a
 * segment you can see when it is 2% is a segment that lies at 2%.
 *
 * ## 🔴 AND `tax` IS ITS OWN KIND FOR A REASON
 *
 * VAT is not ours and is not theirs: §3 requires it as a separate line on both sides,
 * and it is a fact about the PATIENT's country rather than the clinician's. A call site
 * that does not know the patient's country yet passes two parts and the bar is honest
 * about being a split of what the clinician charges rather than of what the patient pays.
 */
export function SplitBar({ parts, note }: { parts: SplitPart[]; note?: string }) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  if (total <= 0) return null;

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {parts.map((part) => (
          <div
            key={part.label}
            className={SPLIT[part.kind].bar}
            style={{ width: `${(Math.max(0, part.value) / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", SPLIT[part.kind].dot)} />
            {part.label}
          </li>
        ))}
      </ul>
      {note ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p> : null}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ the icon row ══ */

/**
 * 🔴 65.7 / 65.9 — AN ICON GRID, AND THE ICONS COME FROM DATA.
 *
 * Used by the patient homepage's category grid, whose entries are the taxonomy an
 * admin already edits (65.9), so a new specialty appears without a deploy.
 *
 * 🔴 THE ICON IS A PROP, NOT A LOOKUP TABLE IN THIS FILE. A component holding a map
 * from specialty to icon is a component that has to be edited every time an admin adds
 * one, which is the deploy 65.9 exists to remove.
 */
export function IconGrid({
  items,
}: {
  items: { key: string; label: string; icon: ReactNode; href: string }[];
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.key}>
          <a
            href={item.href}
            className="flex h-full flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              {item.icon}
            </span>
            <span className="text-sm font-medium text-slate-900">{item.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
