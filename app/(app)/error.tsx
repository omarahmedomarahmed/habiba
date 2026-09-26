"use client";

import { useEffect } from "react";

import { useT } from "@/lib/i18n/client";

/**
 * 🔴 T20: THE CLINICIAN PORTAL'S OWN BOUNDARY, for the reason the patient's has one.
 *
 * Without it, a throw on any clinician route fell through to `app/global-error.tsx`,
 * which replaces the root layout by design: the nav went, the language went, and
 * the clinician was left with hardcoded English and a reset button in the middle of
 * a working day. Here the portal's layout stays around the failure, the words are
 * in the reader's language, and "try again" re-renders only this segment.
 *
 * Only the digest reaches the console. An error message in a clinician's portal can
 * carry a patient's name or a line of a note, and the browser console is not a place
 * any of that should be copied to.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    if (error.digest) console.error("portal route error", error.digest);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-16 text-center"
    >
      <p className="text-sm leading-relaxed text-navy-400">{t("common.somethingWrong")}</p>
      <button
        type="button"
        onClick={reset}
        className="tap-target h-10 rounded-xl bg-navy-600 px-4 text-sm font-semibold text-white"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}
