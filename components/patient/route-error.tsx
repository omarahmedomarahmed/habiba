"use client";

import { useEffect } from "react";

import { SosOrb } from "@/components/patient/sos-orb";
import { recoverFromChunkError } from "@/lib/chunk-recovery";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 A ROUTE-LEVEL BOUNDARY, BECAUSE THE ONLY ONE WAS `app/global-error.tsx`.
 *
 * `find app -name error.tsx` returned nothing before `app/(patient)/error.tsx`.
 * The single boundary in the product was the global one, and a global error
 * boundary **replaces the root layout by design**. So any unhandled throw on a
 * patient route swapped the entire document for a hardcoded English "Something
 * went wrong" and a Reset button: no chrome, no language switch, and **no SOS
 * orb.**
 *
 * That is the crisis affordance being removed from the page by the failure,
 * which is exactly the moment it is most likely to be wanted, and in a language
 * the reader may not have. An Arabic-reading patient hit a dead end.
 *
 * It was reachable rather than theoretical: two taps on "I have paid" raised a
 * unique-violation that nothing caught, and it escaped a server action straight
 * through to this path.
 *
 * 🔴 P19: one component, three boundaries. The patient app had this; `/pay`
 * and `/join` sit outside that route group (a link has to work for somebody
 * with no account), so a throw on the two screens where somebody is paying or
 * waiting for their therapist still fell through to the global page. They
 * render this now, with the same words and the same orb.
 *
 * It keeps the orb, speaks the reader's language, and offers the one action
 * that ever helps. Next.js resets the segment rather than reloading, so
 * anything the page can recover from, it does.
 */
export function RouteError({
  error,
  reset,
  where,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Which boundary caught it, for the one console line a log is matched on. */
  where: string;
}) {
  const t = useT();

  useEffect(() => {
    /* 🔴 B7: a script that did not arrive is fetched again, once, before this page is shown. */
    if (recoverFromChunkError(error)) return;
    /*
     * The digest is what ties this to a server log line. Nothing else about the
     * error goes to the browser console: an error message on a patient screen
     * is a message that can carry a name.
     */
    if (error.digest) console.error(`${where} route error`, error.digest);
  }, [error, where]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-base font-semibold text-slate-900">{t("error.title")}</p>
      <p className="max-w-sm text-sm leading-relaxed text-slate-500">{t("error.body")}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
      >
        {t("error.retry")}
      </button>

      {/* 🔴 The whole reason this component exists. */}
      <SosOrb />
    </div>
  );
}
