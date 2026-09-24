import type { InstrumentQuestion } from "@/lib/db/schema";

/**
 * 🔴 W1-10: WHICH QUESTIONNAIRE ANSWERS OPEN THE CRISIS PATH.
 *
 * A patient answering PHQ-9 item 9 ("thoughts that you would be better off
 * dead or of hurting yourself") above zero was saved, and the screen moved on
 * as if nothing had been said. Now such an answer shows the crisis numbers on the
 * screen and tells the clinician, through the crisis notification their
 * dashboard already reads.
 *
 * The marker lives on the question (`risk: { above }`), so a new instrument
 * carries its own. PHQ-9 item 9 is also known here by key, because instrument
 * rows are content in the database and a row seeded before the marker existed
 * must not lose the path. Pure, so the rule is a test rather than a paragraph.
 */
const KNOWN_RISK_ITEMS: Record<string, Record<string, number>> = {
  phq9: { selfHarm: 0 },
};

export function answerSignalsRisk(input: {
  instrumentKey: string;
  question: InstrumentQuestion;
  value: number;
}): boolean {
  const above = input.question.risk?.above ?? KNOWN_RISK_ITEMS[input.instrumentKey]?.[input.question.key];
  return typeof above === "number" && input.value > above;
}
