import { attributeLines } from "@/lib/ai/diarise";

import { SESSIONS } from "../cases";
import { diarisationError, type Speaker } from "../metrics";
import type { Measurement } from "../report";

/**
 * Who said it. PLAN.md 32.1, 3.4.
 *
 * Runs the **shipped** `attributeLines` — its prompt, its batching, its
 * straddle floor — over synthetic sessions whose speakers are known, and
 * reports the error rate over the lines it chose to answer for, the lines it
 * refused, and the straddles it caught.
 *
 * ## 🔴 Why the refusal rate is a headline number and not a footnote
 *
 * A wrong label is written into a clinical record as if it were certain: a
 * disclosure attributed to the clinician, an intervention attributed to the
 * patient. The product's position is that a half-correct label is worse than
 * none, and that position is only meaningful if the cost of it is visible. A
 * change that halves the error rate by refusing a third of the transcript is
 * not an improvement, and the only way to see that is to print both.
 */
export const attribution = {
  name: "attribution",
  needsModel: true,

  async run(): Promise<Measurement[]> {
    let correct = 0;
    let wrong = 0;
    let refused = 0;
    let lines = 0;
    let straddlesCaught = 0;
    const byCase: string[] = [];

    for (const session of SESSIONS) {
      const texts = session.lines.map((line) => line.text);
      const gold = session.lines.map((line) => line.speaker) as Speaker[];

      const result = await attributeLines(texts);
      const predicted = result.labels.map((label) => label ?? "unknown") as Speaker[];
      const score = diarisationError(gold, predicted);

      correct += score.correct;
      wrong += score.wrong;
      refused += score.refused;
      lines += score.lines;
      straddlesCaught += result.straddles;

      byCase.push(`${session.id} ${score.wrong}/${score.correct + score.wrong} wrong`);
    }

    const answered = correct + wrong;

    return [
      {
        key: "attribution.der",
        label: "attribution error",
        value: answered === 0 ? 1 : wrong / answered,
        direction: "down",
        unit: "rate",
        /*
         * One line in a forty-line set is 2.5%, and the model is not quite
         * deterministic at temperature 0. Two lines of movement is real.
         */
        tolerance: 0.06,
        detail: byCase.join(" · "),
      },
      {
        key: "attribution.refused",
        label: "  lines refused",
        value: lines === 0 ? 0 : refused / lines,
        direction: "down",
        unit: "rate",
        tolerance: 0.1,
        detail: `${refused} of ${lines} lines left unattributed`,
      },
      {
        key: "attribution.straddles",
        label: "  straddles caught",
        value: straddlesCaught,
        direction: "up",
        unit: "count",
        /* Deterministic: it is a regex over the text, not a model decision. */
        tolerance: 0,
      },
    ];
  },
};
