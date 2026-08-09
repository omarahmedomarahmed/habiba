"use client";

import { AlertTriangle, Phone, X } from "lucide-react";

import { cn } from "@/lib/utils";

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
}: {
  level: "moderate" | "elevated" | "high" | "critical";
  indicators?: string[];
  onDismiss?: () => void;
  className?: string;
}) {
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
            Risk language detected · {level}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-red-800">
            Pause and assess directly. If there is imminent risk, follow your local
            emergency protocol.
          </p>
          {indicators.length > 0 ? (
            <p className="mt-2 text-xs text-red-700">
              Matched: <span className="font-medium">{indicators.join(", ")}</span>
            </p>
          ) : null}
          <a
            href="tel:988"
            className="tap-target mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            Call 988
          </a>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss alert"
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
export function PatientSupportNotice({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3.5", className)}>
      <p className="text-sm leading-relaxed text-teal-900">
        Your therapist is here with you. If you need immediate help right now, you can
        call or text{" "}
        <a href="tel:988" className="font-semibold underline">
          988
        </a>{" "}
        at any time.
      </p>
    </div>
  );
}
