"use client";

import { AlertTriangle, Phone, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { CrisisLine } from "@/lib/crisis/line";

/**
 * Clinician-facing risk alert. Shows the level and, optionally, the phrases
 * that triggered it.
 *
 * There is deliberately no patient-facing variant of this component. What a
 * patient sees lives in `PatientSupportNotice` below and shares no props with
 * this one, so a level or an indicator cannot leak across by someone reusing
 * the wrong component or spreading the wrong object.
 */
export function RiskBanner({
  level,
  indicators = [],
  onDismiss,
  className,
  line = null,
}: {
  level: "moderate" | "elevated" | "high" | "critical";
  indicators?: string[];
  onDismiss?: () => void;
  className?: string;
  /**
   * 🔴 21R.8 / C98 — the crisis line for **this reader's country**, or null.
   *
   * This used to be `tel:988` for everybody. 988 is the United States
   * lifeline; dialled from Cairo it reaches nothing, and a button that looks
   * like help and is not is worse than no button. Null renders the sentence
   * instead of the number, which is true everywhere.
   */
  line?: CrisisLine | null;
}) {
  const t = useT();
  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-900">
            {t("risk.detected", { level })}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-red-800">
            {t("risk.assess")}
          </p>
          {indicators.length > 0 ? (
            <p className="mt-2 text-xs text-red-700">
              {t("risk.matched")}{" "}
              <span className="font-medium">{indicators.join(", ")}</span>
            </p>
          ) : null}
          {line ? (
            <a
              href={`tel:${line.tel}`}
              className="tap-target mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {t("risk.call", { label: line.label })}
            </a>
          ) : (
            <p className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold text-red-900">
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {t("risk.noLine")}
            </p>
          )}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("risk.dismiss")}
            className="tap-target -m-2 flex items-center justify-center rounded-lg p-2 text-red-400 hover:bg-red-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * What a patient on a join link sees. Support and a phone number — no risk
 * level, no matched phrases, no clinical framing. This is a product safety
 * invariant, and it is asserted by a test.
 */
export function PatientSupportNotice({
  className,
  line = null,
}: {
  className?: string;
  /** 🔴 C98 — the same rule, on the surface where it matters most. */
  line?: CrisisLine | null;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3.5",
        className,
      )}
    >
      <p className="text-sm leading-relaxed text-teal-900">
        {t("crisis.therapistHere")}{" "}
        {line ? (
          /*
            37L.2 — one row with the number in a slot. Arabic does not put the
            phrase "at any time" where English does, and two half-sentences
            either side of an anchor cannot be translated at all.
          */
          t("crisis.canCallOrText", { label: "\u0000" })
            .split("\u0000")
            .flatMap((part, index) =>
              index === 0
                ? [part]
                : [
                    <a key="n" href={`tel:${line.tel}`} className="font-semibold underline">
                      {line.label}
                    </a>,
                    part,
                  ],
            )
        ) : (
          <>{t("crisis.localNumberFree")}</>
        )}
      </p>
    </div>
  );
}
