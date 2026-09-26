"use client";

import { useState, useTransition } from "react";
import { Check, RotateCw, X } from "lucide-react";
import { motion } from "motion/react";

import type { TryResult } from "@/app/(partner)/partner/webhooks/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * 🔴 W2-X03: ONE TRY, AND WHAT THEIR ENDPOINT SAID, beside the button that asked.
 *
 * Used for "Send a test event" on an endpoint and "Redeliver" on a delivery. The
 * answer is the HTTP status or the network error, which is what a developer
 * fixing their receiver needs, and it is shown where they pressed rather than on
 * another page. The arrow turns while the try is in flight, as in the mockup.
 */
export function TryButton({
  action,
  id,
  labelKey,
}: {
  action: (id: string) => Promise<TryResult>;
  id: string;
  labelKey: MessageKey;
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TryResult | null>(null);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await action(id)))}
        className="tap-target inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-navy-600 ring-1 ring-navy-100 transition-colors outline-none hover:bg-navy-50 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
      >
        <motion.span
          className="inline-flex"
          animate={pending ? { rotate: 360 } : { rotate: 0 }}
          transition={pending ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }}
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
        </motion.span>
        {t(labelKey)}
      </button>
      {result ? (
        <span
          role="status"
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold ring-1 ring-inset",
            result.ok ? "bg-brand-50 text-brand-800 ring-brand-100" : "bg-red-50 text-red-700 ring-red-200",
          )}
        >
          {result.ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
          {result.ok ? t("dev.delivered") : t("dev.failed")}
          {result.status ? ` ${result.status}` : ""}
          {result.error ? ` ${result.error}` : ""}
        </span>
      ) : null}
    </div>
  );
}
