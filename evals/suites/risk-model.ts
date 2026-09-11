import { classifyRisk } from "@/lib/ai/risk";
import { scanForCrisisLanguage } from "@/lib/crisis/alerts";
import { levelFor, shouldAlert } from "@/lib/crisis/level";

import { RISK_CASES } from "../cases";
import { riskScore } from "../metrics";
import type { Measurement } from "../report";

/**
 * Does the classifier beat the phrase list? PLAN.md 35.1, 35.2.
 *
 * ## 🔴 88.2% is the floor, and it is measured per language
 *
 * The keyword list scores 88.2% sensitivity over 17 positives, 76.9%
 * specificity over 13 negatives, Arabic 87.5%. Sprint 35 exists because a
 * phrase list will keep chasing the register forever — the two cases it still
 * misses are a person describing letters left in a drawer and *لا يوجد سبب
 * يجعلني أكمل*, neither of which contains a phrase anybody could have listed.
 *
 * So this measures three systems on the same cases, and reports all three:
 *
 *   1. **The model alone**, so its own contribution is visible rather than
 *      hidden inside an ensemble.
 *   2. **The keyword floor alone**, unchanged, as the number to beat.
 *   3. **What actually ships**: the floor with the model on top, which is the
 *      only configuration a patient ever meets.
 *
 * Never averaged across languages (C159). An overall number is where a zero
 * hides, and that is not a hypothetical here: it is how Arabic sensitivity sat
 * at 0% through 21 tests and 31 verifiers.
 *
 * ## What the cases are and are not
 *
 * Single utterances, not sessions. The classifier is built to read a whole
 * transcript and see a plan assembled across four turns, and this measures it
 * on one line at a time — which is **harder** than its real input for the
 * positives and **easier** for the negatives, since a real session gives the
 * context that distinguishes an idiom from a disclosure. The number is a
 * comparison against the phrase list on identical input, not a claim about
 * session-level accuracy.
 */
export const riskModel = {
  name: "risk-model",
  needsModel: true,

  async run(): Promise<Measurement[]> {
    const modelFlagged = new Set<string>();
    const combinedFlagged = new Set<string>();
    let unquoted = 0;
    let findingsTotal = 0;
    const evidence: string[] = [];

    for (const example of RISK_CASES) {
      const transcript = `Patient: ${example.text}`;
      const classification = await classifyRisk(transcript);

      unquoted += classification.unquoted;
      findingsTotal += classification.findings.length + classification.unquoted;

      /* The model on its own: no keyword hits passed in. */
      const modelLevel = levelFor(classification.findings, []);
      if (shouldAlert(modelLevel)) modelFlagged.add(example.id);

      /* What ships: the floor underneath it. */
      const hits = scanForCrisisLanguage(example.text);
      if (shouldAlert(levelFor(classification.findings, hits))) combinedFlagged.add(example.id);

      if (example.risk && !shouldAlert(modelLevel) && classification.findings.length > 0) {
        evidence.push(`${example.id}: found ${classification.findings.map((f) => f.indicator).join("+")} but the ladder says ${modelLevel}`);
      }
    }

    const keywordFlagged = new Set(
      RISK_CASES.filter((c) => scanForCrisisLanguage(c.text).length > 0).map((c) => c.id),
    );

    const arabic = RISK_CASES.filter((c) => c.language === "ar");
    const english = RISK_CASES.filter((c) => c.language === "en");

    const model = riskScore(RISK_CASES, (id) => modelFlagged.has(id));
    const combined = riskScore(RISK_CASES, (id) => combinedFlagged.has(id));
    const keyword = riskScore(RISK_CASES, (id) => keywordFlagged.has(id));
    const combinedAr = riskScore(arabic, (id) => combinedFlagged.has(id));
    const combinedEn = riskScore(english, (id) => combinedFlagged.has(id));

    const named = (ids: string[]) => (ids.length === 0 ? "none" : ids.join(", "));

    return [
      {
        key: "risk.model.sensitivity",
        label: "model alone, sensitivity",
        value: model.sensitivity,
        direction: "up",
        unit: "rate",
        tolerance: 0.06,
        detail: `missed: ${named(model.missed)}`,
      },
      {
        key: "risk.model.specificity",
        label: "model alone, specificity",
        value: model.specificity,
        direction: "up",
        unit: "rate",
        tolerance: 0.08,
        detail: `false alarms: ${named(model.falseAlarms)}`,
      },
      {
        /*
         * 🔴 The number the founder set: the keyword list is the floor, and
         * what ships must not be worse than it. Reported beside the model's own
         * so an improvement cannot be claimed from an ensemble that is really
         * the old list doing the work.
         */
        key: "risk.combined.sensitivity",
        label: "🔴 what ships, sensitivity",
        value: combined.sensitivity,
        direction: "up",
        unit: "rate",
        tolerance: 0.06,
        detail: `keyword floor alone: ${(keyword.sensitivity * 100).toFixed(1)}% · still missed: ${named(combined.missed)}`,
      },
      {
        key: "risk.combined.specificity",
        label: "🔴 what ships, specificity",
        value: combined.specificity,
        direction: "up",
        unit: "rate",
        tolerance: 0.08,
        detail: `keyword floor alone: ${(keyword.specificity * 100).toFixed(1)}% · false alarms: ${named(combined.falseAlarms)}`,
      },
      {
        key: "risk.combined.sensitivity.en",
        label: "  …in English",
        value: combinedEn.sensitivity,
        direction: "up",
        unit: "rate",
        tolerance: 0.06,
      },
      {
        key: "risk.combined.sensitivity.ar",
        label: "  …in Arabic",
        value: combinedAr.sensitivity,
        direction: "up",
        unit: "rate",
        tolerance: 0.06,
        detail: `missed: ${named(combinedAr.missed)}`,
      },
      {
        /*
         * 🔴 How often the classifier quotes a sentence that is not there.
         *
         * Invisible by construction — a dropped finding leaves no trace in the
         * output — so it is counted at the point of dropping. It is the first
         * number to look at when the model is swapped, and a rise in it means
         * the guard is doing more work rather than less.
         */
        key: "risk.model.unquoted",
        label: "findings dropped for a quote that is not there",
        value: findingsTotal === 0 ? 0 : unquoted / findingsTotal,
        direction: "down",
        unit: "rate",
        tolerance: 0.05,
        detail: `${unquoted} of ${findingsTotal} findings${evidence.length ? ` · ${evidence.join(" · ")}` : ""}`,
      },
    ];
  },
};
