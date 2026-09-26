"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Glow } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * The partner portal's own small parts, in the look of `app/design/partner`.
 *
 * ## 🔴 `SecretCard` SHOWS WHAT IT IS HANDED AND NOTHING ELSE
 *
 * A raw key or a signing secret reaches it only as the return value of the action that
 * made it, exactly as before: nothing here fetches, stores or remembers one. The copy
 * button writes to the clipboard the same string that is already on the screen. Reload
 * and it is gone, because there is nowhere it could come back from.
 */
export function SecretCard({ secret, title, note }: { secret: string; title?: string | null; note: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-navy-900 p-5 text-white">
      <Glow className="-end-20 -top-20 h-56 w-56 opacity-50" />
      {title ? <p className="relative text-[15px] font-bold">{title}</p> : null}
      <div className={cn("relative flex flex-wrap items-center gap-2", title && "mt-3")}>
        <code className="min-w-0 flex-1 break-all rounded-xl bg-white/10 px-3 py-2.5 font-mono text-[14px] text-brand-200">{secret}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(secret).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {copied ? <Check className="h-4 w-4 text-brand-300" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          <span aria-live="polite">{copied ? t("common.copied") : t("common.copy")}</span>
        </button>
      </div>
      <p className="relative mt-3 text-[13px] leading-relaxed text-white/70">{note}</p>
    </div>
  );
}

/** A native select dressed as the kit's fields. */
export const SELECT =
  "h-12 w-full rounded-2xl border border-navy-100 bg-white px-4 text-sm text-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none";

/** A checkbox that reads as a chip: teal when on, as the mockups' choices are. */
export function CheckChip({ name, value, children }: { name: string; value: string; children: React.ReactNode }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" name={name} value={value} className="peer sr-only" />
      <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 font-mono text-[13px] font-semibold text-navy-600 ring-1 ring-navy-100 transition-colors peer-checked:bg-brand-500 peer-checked:text-navy-700 peer-checked:ring-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400">
        {children}
      </span>
    </label>
  );
}

/** A small quiet button for the act on a row; `danger` for the one that stops something. */
export function RowButton({
  children,
  danger = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "tap-target inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60",
        danger ? "text-red-700 ring-red-200 hover:bg-red-50" : "text-navy-600 ring-navy-100 hover:bg-navy-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** The box a confirm step sits in, under the row it is about. */
export function ConfirmBox({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 space-y-3 rounded-2xl bg-navy-50 p-3.5 ring-1 ring-navy-100">{children}</div>;
}
