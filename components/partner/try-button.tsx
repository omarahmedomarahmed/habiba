"use client";

import { useState, useTransition } from "react";

import type { TryResult } from "@/app/(partner)/partner/webhooks/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 W2-X03 — ONE TRY, AND WHAT THEIR ENDPOINT SAID, beside the button that asked.
 *
 * Used for "Send a test event" on an endpoint and "Redeliver" on a delivery. The
 * answer is the HTTP status or the network error, which is what a developer
 * fixing their receiver needs, and it is shown where they pressed rather than on
 * another page.
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
        className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
      >
        {t(labelKey)}
      </button>
      {result ? (
        <span
          role="status"
          className={
            result.ok ? "text-xs font-semibold text-brand-700" : "text-xs font-semibold text-red-600"
          }
        >
          {result.ok ? t("dev.delivered") : t("dev.failed")}
          {result.status ? ` ${result.status}` : ""}
          {result.error ? ` ${result.error}` : ""}
        </span>
      ) : null}
    </div>
  );
}
