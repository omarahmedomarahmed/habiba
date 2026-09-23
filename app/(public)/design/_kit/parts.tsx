import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { money, tx, type Lang } from "./tx";

/**
 * The building blocks every sample screen is made of.
 *
 * Two rules from the assessment are built in rather than remembered:
 * nothing a person must read is smaller than 14px or lighter than navy-400
 * (the founder's "grey and thin text everywhere"), and nothing pressable is
 * teal (teal is live-and-now only; `verify:palette`).
 */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-navy-100 bg-white p-4", className)}>{children}</div>;
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-semibold uppercase tracking-wide text-navy-400">{children}</p>;
}

export function H({ children }: { children: ReactNode }) {
  return <p className="text-[20px] font-bold leading-snug text-navy-600">{children}</p>;
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[15px] leading-relaxed text-navy-500", className)}>{children}</p>;
}

export function Small({ children }: { children: ReactNode }) {
  return <p className="text-[14px] leading-relaxed text-navy-400">{children}</p>;
}

export function Btn({
  children,
  kind = "primary",
  className,
}: {
  children: ReactNode;
  kind?: "primary" | "secondary" | "quiet" | "danger" | "money";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-[16px] font-semibold",
        kind === "primary" && "bg-brand-500 text-navy-600",
        kind === "money" && "bg-amber-400 text-navy-600",
        kind === "secondary" && "border border-navy-200 bg-white text-navy-600",
        kind === "quiet" && "text-navy-600 underline underline-offset-4",
        kind === "danger" && "border border-red-600 bg-white text-red-700",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "owed" | "done" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold",
        tone === "neutral" && "bg-navy-100 text-navy-600",
        tone === "owed" && "bg-amber-100 text-navy-600",
        tone === "done" && "bg-navy-600 text-white",
      )}
    >
      {children}
    </span>
  );
}

export function Row({ left, right, strong = false }: { left: ReactNode; right: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5", strong ? "text-[16px] font-bold text-navy-600" : "text-[15px] text-navy-500")}>
      <span>{left}</span>
      <span className="tabular-nums">{right}</span>
    </div>
  );
}

/**
 * 🔴 ONE WAY TO SAY WHAT SOMETHING COSTS, used on every screen that names a price.
 *
 * The walk found money saying three things at once: "$75" on home, "Covered,
 * nothing for you to pay" on billing, "Pay $60" on a button that then asked for
 * $68.40 (tasks 208, 210, E3). So a price is never a bare number here: it is
 * always the session's price, what the employer covers if anyone does, VAT on
 * the patient's own share, and the one figure the patient will actually send.
 */
export function Price({
  lang,
  price,
  employer,
  coveredPct = 0,
  vatPct = 14,
  compact = false,
}: {
  lang: Lang;
  price: number;
  employer?: string;
  coveredPct?: number;
  vatPct?: number;
  compact?: boolean;
}) {
  const covered = Math.round(price * coveredPct) / 100;
  const share = price - covered;
  const vat = Math.round(share * vatPct) / 100;
  const total = share + vat;
  if (compact) {
    return (
      <p className="text-[15px] text-navy-500">
        {tx(lang, "You pay", "تدفع")} <span className="font-bold text-navy-600 tabular-nums">{money(lang, total)}</span>
        {coveredPct > 0 ? (
          <span className="text-navy-400"> · {tx(lang, `${employer} pays ${coveredPct}%`, `${employer} تدفع ${coveredPct}%`)}</span>
        ) : null}
      </p>
    );
  }
  return (
    <div className="divide-y divide-navy-100 rounded-xl bg-navy-50 px-3">
      <Row left={tx(lang, "Session", "الجلسة")} right={money(lang, price)} />
      {coveredPct > 0 ? (
        <Row
          left={tx(lang, `${employer} pays ${coveredPct}%`, `${employer} تدفع ${coveredPct}%`)}
          right={`−${money(lang, covered)}`}
        />
      ) : null}
      <Row left={tx(lang, `VAT ${vatPct}% on your share`, `ضريبة ${vatPct}% على حصتك`)} right={money(lang, vat)} />
      <Row strong left={tx(lang, "You pay", "تدفع أنت")} right={money(lang, total)} />
    </div>
  );
}

export function Avatar({ initials, live = false }: { initials: string; live?: boolean }) {
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-100 text-[15px] font-bold text-navy-600">
      {initials}
      {live ? <span className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand-500" /> : null}
    </span>
  );
}

/** A line in a list of people or things: who, one fact, and where it leads. */
export function Item({ lead, title, sub, end }: { lead?: ReactNode; title: ReactNode; sub?: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold text-navy-600">{title}</p>
        {sub ? <p className="text-[14px] text-navy-400">{sub}</p> : null}
      </div>
      {end}
    </div>
  );
}
