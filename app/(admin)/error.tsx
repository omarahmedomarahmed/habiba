"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { recoverFromChunkError } from "@/lib/chunk-recovery";

/**
 * 🔴 A18: THE CONSOLE'S OWN BOUNDARY, so a failed page keeps the console.
 *
 * Without it a throw on any admin page reached `app/global-error.tsx`, which
 * replaces the root layout by design: the nav, the currency switch and the
 * language corner went with it, and an operator halfway through a queue was
 * left on a bare page with one button. This sits inside `(admin)/layout.tsx`,
 * so only the page that failed is replaced and every other queue is one click
 * away.
 *
 * The message stays generic for the reason the global one does: an error on a
 * console page can carry a payer's name or an amount in its text, and the
 * digest is enough to find the server log line. No new words either; the
 * title and the retry are the ones every portal already shows.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    /* 🔴 Board 929 (B7): a script that did not arrive is fetched again, once, before this is shown. */
    if (recoverFromChunkError(error)) return;
    if (error.digest) console.error("admin route error", error.digest);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-base font-semibold text-slate-900">{t("error.title")}</p>
      {error.digest ? <p className="font-mono text-xs text-slate-400">{error.digest}</p> : null}
      <Button type="button" onClick={reset}>
        {t("error.retry")}
      </Button>
    </div>
  );
}
