"use client";

import { useEffect } from "react";

import { useT } from "@/lib/i18n/client";

/**
 * 🔴 T20: THE CLINIC PORTAL'S OWN BOUNDARY.
 *
 * Without it, a throw on any clinic route (a `ClinicRefused` from a call site that
 * skipped its guard, a database that did not answer) fell through to
 * `app/global-error.tsx`, which replaces the root layout: no rail, no language
 * switch, and English whatever the manager reads in. Here the clinic's chrome stays,
 * the words are theirs, and "try again" re-renders only this segment.
 *
 * No crisis orb, for the reason `app/(clinic)/layout.tsx` gives: this is an
 * administrator at a desk. And only the digest reaches the console, because an
 * error message on this side can carry a patient's name from the rota.
 */
export default function ClinicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    if (error.digest) console.error("clinic route error", error.digest);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-16 text-center"
    >
      <p className="text-sm leading-relaxed text-slate-600">{t("common.somethingWrong")}</p>
      <button
        type="button"
        onClick={reset}
        className="tap-target h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}
