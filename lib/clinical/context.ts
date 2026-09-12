/**
 * What the evidence layer tells the note generator. PLAN.md 34.1.
 *
 * ## 🔴 The failure this file is designed against
 *
 * Grounding a note in retrieved facts is the classic way to introduce
 * confident statements about the wrong patient. The model is handed a list of
 * assertions in the same context window as the transcript, and a language model
 * has no structural distinction between "this was said today" and "this was
 * true in March" — so unless the difference is made loud, it writes prior
 * context into the Subjective as if the patient had just said it. The note then
 * reads as an eyewitness account of things that did not happen in the room.
 *
 * Three defences, in order of strength:
 *
 *   1. **Only current, active facts are sent.** Stale, superseded, unsupported
 *      and disputed rows never enter the prompt at all (C166 ranks them, 33.5
 *      marks them). The cheapest way not to repeat a wrong fact is not to send
 *      it.
 *   2. **Every line carries its age and its source, in words.** "as of 3 weeks
 *      ago, from a document" is harder to restate as today's observation than
 *      a bare bullet is.
 *   3. **The prompt forbids asserting them.** Facts are for understanding what
 *      is being referred to, never for filling a section. The rule is stated
 *      above the schema (H2), because an instruction below the schema loses.
 *
 * And then it is **measured**: `evals/suites/grounding.ts` runs the same
 * sessions with facts attached and compares the unsupported-claim rate, with a
 * deliberately poisoned condition where the facts belong to somebody else.
 */

import { currencyOf } from "./currency";

/**
 * Domains a session measures again from scratch, so a stored value is a rival
 * account rather than background. See C170 at the filter below.
 */
const RE_OBSERVED_EACH_SESSION = new Set(["presentation", "function", "risk"]);

export type ContextFact = {
  domain: string;
  field: string;
  value: string;
  sourceType: "clinician" | "document" | "patient" | "ai";
  status: string;
  verifiedAt: Date | string | null;
  effectiveAt: Date | string;
};

/** How a source is described to the model, in words rather than as a rank. */
const SOURCE_WORDS: Record<ContextFact["sourceType"], string> = {
  clinician: "recorded by the clinician",
  document: "from a document on file",
  patient: "stated by the patient",
  ai: "drawn from an earlier session by this system and NOT confirmed by a clinician",
};

/**
 * 🔴 Which facts a model is allowed to see at all.
 *
 * A disputed fact is one a clinician has already said is wrong. Sending it
 * would invite the note to repeat the thing the clinician rejected, which is
 * worse than having no evidence layer: it would make disagreeing with the
 * system useless, and the disagreement is the feature.
 */
export function factsForPrompt<T extends ContextFact>(facts: T[], now: Date): T[] {
  return facts.filter((fact) => {
    if (fact.status !== "active") return false;
    if (!currencyOf(fact, now).current) return false;

    /*
     * 🔴 C167 — an unverified model guess never enters another model's context.
     *
     * This is the rule the first grounded eval run bought. An `ai` fact is, by
     * 33.2, a guess nobody has confirmed. Feeding it back in as prior context
     * is how a guess becomes a fact by repetition: session 3's inference is
     * read as background in session 4, written into the note, and by session 6
     * it has been "in the record" three times and nobody can find the sentence
     * it came from. The evidence layer would be laundering its own output.
     *
     * A clinician verifying it breaks the cycle, and that is exactly what the
     * evidence screen is for: one human agreeing once, and then it is as good
     * as anything else on the chart.
     */
    if (fact.sourceType === "ai" && !fact.verifiedAt) return false;

    /*
     * 🔴 C168 — the note generator is sent no diagnoses at all.
     *
     * Bought by the same run. Every single leak measured in this sprint was
     * diagnosis-shaped: a prior "history of panic attacks" became "panic
     * disorder" in the note, a misfiled document's "major depressive disorder"
     * was repeated as this patient's, and the Arabic postnatal case picked up a
     * label nobody in the room had said. A diagnosis is the highest-consequence
     * thing this product can put in a record and the easiest thing for a model
     * to restate, because restating it reads as competence.
     *
     * It is also the least useful background a note generator has. The prompt
     * already forbids diagnosing; the clinician has the chart, the evidence
     * screen and the diagnosis list a tap away. Nothing in a SOAP note needs a
     * label to describe what happened in the room.
     *
     * The cost, named: a note loses framing that might help it interpret an
     * ambiguous transcript, and a clinician reading the draft will not see the
     * working diagnosis reflected back. That is a smaller harm than a label
     * appearing in a record because it was in the context window.
     */
    if (fact.domain === "diagnosis") return false;

    /*
     * 🔴 C170 — a model cannot arbitrate a contradiction, so it is not asked to.
     *
     * The measurement, over five cases and three runs: when a prior fact
     * disagreed with the transcript, the note followed the **prior fact** 93%
     * of the time. The prompt says "the transcript is what happened" twice,
     * once above the schema. It is worth almost nothing. A model handed two
     * accounts of the same patient does not weigh them; it blends them, and it
     * writes the more confident-sounding one.
     *
     * So the dangerous domains are not sent. `presentation`, `function` and
     * `risk` are precisely what a session re-observes — sleep, work, mood,
     * ideation — which makes a prior value both the least useful context (the
     * transcript is about to say what is true now) and the most likely to be
     * contradicted. What is left is background a session does not re-measure:
     * history, social circumstances, goals, medication.
     *
     * **The cost, named:** the note loses "this is the third week of early
     * waking", which is genuinely useful longitudinal framing and the reason
     * 34.1 exists. It is a smaller loss than a note that says a patient is
     * sleeping through the night on the day they said they are not.
     *
     * **The residual, measured rather than assumed:** `social` facts can still
     * be contradicted and the suite still tests one, so the number is not a
     * measurement of this filter. Whatever it reports is what the model does
     * with the background it still receives.
     */
    if (RE_OBSERVED_EACH_SESSION.has(fact.domain)) return false;

    return true;
  });
}

/**
 * The block that goes into the note prompt.
 *
 * Returns an empty string when there is nothing current to say, so a session
 * for a new patient produces exactly the prompt sprint 33 produced, and the
 * eval can compare the two conditions honestly.
 */
export function factsPrompt(facts: ContextFact[], now: Date): string {
  const usable = factsForPrompt(facts, now);
  if (usable.length === 0) return "";

  const lines = usable.map((fact) => {
    const age = currencyOf(fact, now).label;
    const verified =
      fact.sourceType === "ai" && !fact.verifiedAt ? ", unconfirmed" : "";
    return `- ${fact.domain}/${fact.field}: ${fact.value} (${age}, ${SOURCE_WORDS[fact.sourceType]}${verified})`;
  });

  /*
   * The rules sit ABOVE the list, not below it. H2: an instruction placed after
   * a block of content loses to the weight of the content, and this is the
   * exact shape 24.2's diarisation prompt had to be rewritten for.
   */
  return [
    "KNOWN BEFORE THIS SESSION (background, not evidence)",
    "Read these to understand what the patient refers to. They are NOT things you observed.",
    "- Nothing here may go in the note on its own authority. If the transcript does not say it, it does not go in the note.",
    "- 🔴 If the TRANSCRIPT also says it, write it, sourced from the transcript, in the patient's own terms. Background never makes something MORE true and it must not make you leave out what the session actually covered.",
    "- Never name a diagnosis, a medication or a label that these imply. A history of panic attacks is not a diagnosis of panic disorder.",
    "- If the transcript disagrees with one of these, the transcript is what happened. Write what the transcript says, and note in \"assessment\" that it differs from the record.",
    "- These may belong to the wrong person or be out of date. The transcript is the only thing you observed.",
    "",
    ...lines,
  ].join("\n");
}
