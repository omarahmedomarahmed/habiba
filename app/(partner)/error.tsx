"use client";

import { useEffect } from "react";

import { Button } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";
import { recoverFromChunkError } from "@/lib/chunk-recovery";

/**
 * 🔴 C19: THE PARTNER PORTAL'S OWN ERROR BOUNDARY.
 *
 * Without it a throw on any `/partner` page fell through to
 * `app/global-error.tsx`, which replaces the root layout by design, so the
 * developer lost the portal's rail and language switch along with the page.
 * This one renders inside `PartnerChrome` and in the reader's language.
 *
 * No SOS orb: an engineer at a desk, as the layout says. The message is
 * generic on purpose; only the digest goes to the console, to tie it to a
 * server log line.
 */
export default function PartnerError({
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
    if (error.digest) console.error("partner route error", error.digest);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <p className="max-w-sm text-[15px] leading-relaxed text-navy-500">{t("common.somethingWrong")}</p>
      <Button type="button" onClick={reset}>
        {t("dev.retry")}
      </Button>
    </div>
  );
}
