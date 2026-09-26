"use client";

import { useEffect } from "react";

import { Button } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";
import { recoverFromChunkError } from "@/lib/chunk-recovery";

/**
 * 🔴 C19: THE COMPANY PORTAL'S OWN ERROR BOUNDARY.
 *
 * Without it a throw on any `/sponsor` page fell through to
 * `app/global-error.tsx`, which replaces the root layout by design: the
 * company's rail, its name and the language switch went with the page, and
 * what was left was a hard coded English sentence. This one renders inside
 * `SponsorChrome`, so the desk stays around it and the words are the reader's.
 *
 * No SOS orb, for the reason the layout gives: an HR administrator at a desk.
 * The message is generic on purpose, like the global one: an error message is
 * a string we do not control, and nothing about it reaches the screen. Only
 * the digest goes to the console, which is what ties it to a server log line.
 */
export default function SponsorError({
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
    if (error.digest) console.error("sponsor route error", error.digest);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <p className="max-w-sm text-sm leading-relaxed text-navy-400">{t("common.somethingWrong")}</p>
      <Button type="button" onClick={reset}>
        {t("sponsor.retry")}
      </Button>
    </div>
  );
}
