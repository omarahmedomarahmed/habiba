import { scanForCrisisLanguage } from "@/lib/crisis/alerts";

import { RISK_CASES } from "../cases";
import { riskScore } from "../metrics";
import type { Measurement } from "../report";

/**
 * Does the crisis scanner find risk, and does it cry wolf? PLAN.md 32.1.
 *
 * ## 🔴 This suite needs no model, no key and no network
 *
 * `scanForCrisisLanguage` is a phrase list and an `includes` (see the note in
 * `lib/crisis/alerts.ts` on why it is deliberately not in `lib/ai/`). So this
 * runs in a second, for nothing, on every machine — which matters, because the
 * one eval that must never be skipped for cost is the safety one.
 *
 * ## Both numbers, and the misses by name
 *
 * Sensitivity alone is gamed by alerting on everything and specificity alone
 * by alerting on nothing, so neither is ever reported without the other. The
 * near-miss half of the case set — an idiom, a film, a past event described in
 * the past tense — is what stops a change that widens the phrase list from
 * looking like an improvement.
 */
export const risk = {
  name: "risk",
  needsModel: false,

  run(): Measurement[] {
    const flagged = new Set(
      RISK_CASES.filter((c) => scanForCrisisLanguage(c.text).length > 0).map((c) => c.id),
    );
    const named = (ids: string[]) =>
      ids.length === 0 ? "none" : ids.map((id) => `${id}`).join(", ");

    const all = riskScore(RISK_CASES, (id) => flagged.has(id));
    const arabic = riskScore(
      RISK_CASES.filter((c) => c.language === "ar"),
      (id) => flagged.has(id),
    );
    const english = riskScore(
      RISK_CASES.filter((c) => c.language === "en"),
      (id) => flagged.has(id),
    );

    return [
      {
        key: "risk.sensitivity",
        label: "risk sensitivity",
        value: all.sensitivity,
        direction: "up",
        unit: "rate",
        /* A miss is a person. The band is one case in this set and no more. */
        tolerance: 0.05,
        detail: `missed: ${named(all.missed)}`,
      },
      {
        key: "risk.specificity",
        label: "risk specificity",
        value: all.specificity,
        direction: "up",
        unit: "rate",
        tolerance: 0.05,
        detail: `false alarms: ${named(all.falseAlarms)}`,
      },
      {
        key: "risk.sensitivity.en",
        label: "  …in English",
        value: english.sensitivity,
        direction: "up",
        unit: "rate",
        tolerance: 0.05,
      },
      {
        /*
         * 🔴 Reported separately because an average hides it.
         *
         * The product is built for an Arabic-speaking market and the scanner
         * is a list of English phrases. One overall number would read as a
         * middling score rather than as a language that is not covered.
         */
        key: "risk.sensitivity.ar",
        label: "  …in Arabic",
        value: arabic.sensitivity,
        direction: "up",
        unit: "rate",
        tolerance: 0.05,
        detail: `missed: ${named(arabic.missed)}`,
      },
    ];
  },
};
