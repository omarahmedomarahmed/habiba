"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";

import { flagOwnContent } from "@/app/(patient)/patient/profile/actions";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 W3: THE FLAG THE PROFILE PAGE DESCRIBED AND NEVER DREW.
 *
 * `pprofile.flag*` explained what flagging a diagnosis does, under a list with
 * no way to do it, while `flagOwnContent` already took a diagnosis. Same three
 * reasons as a document, and the same promise: it marks, it never edits.
 */
export function DiagnosisFlag({ diagnosisId }: { diagnosisId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <p className="mt-1 text-xs font-semibold text-navy-400">{t("pprofile.flagged")}</p>;
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="tap-target inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-navy-400 hover:bg-navy-50"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden />
        {t("tdl.flag")}
      </button>
      {open ? (
        <div className="mt-1 flex flex-wrap gap-2">
          {(["outdated", "wrong", "not_mine"] as const).map((reason) => (
            <button
              key={reason}
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await flagOwnContent({
                    targetType: "diagnosis",
                    targetId: diagnosisId,
                    reason,
                  });
                  if (result.error) setError(result.error);
                  else setDone(true);
                })
              }
              className="tap-target h-9 rounded-lg border border-navy-100 px-3 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
            >
              {reason === "not_mine"
                ? t("tdl.notMine")
                : reason === "outdated"
                  ? t("tdl.outdated")
                  : t("tdl.wrong")}
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
