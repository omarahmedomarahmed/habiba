/**
 * Sprint 34 acceptance: the note reads the record. PLAN.md 34.1.
 *
 *   npm run verify:sprint34
 *
 * ## What this checks, and what `npm run evals -- --suite grounding` checks
 *
 * This verifies the **plumbing and the filters**: that a real person's facts
 * reach a real prompt through the routed read, that the four classes of fact a
 * model may never see are absent from the rendered block, and that the rule
 * forbidding their use sits above the schema rather than below it.
 *
 * The **numbers** — whether grounding made the note better or worse — are the
 * grounding suite's job, and they are the reason this sprint is not one line.
 *
 * 🔴 Asserted on the RENDERED BLOCK, not on the filter function (C156). A
 * filter that is correct and a prompt that prints the row anyway is the shape
 * of the Arabic-consent bug, and the only way to see it is to read the string
 * the model will read.
 */
import { eq } from "drizzle-orm";

import { factsPrompt } from "../lib/clinical/context";
import { recordFact, factsFor } from "../lib/data/facts";
import { normaliseLanguage } from "../lib/ai/notes";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";
import { patientClinicalFacts, people, users } from "../lib/db/schema";
import { reporter, required, writesTo } from "./_verify";
import { readFileSync } from "node:fs";

const { check, finish } = reporter();
const db = dbFor(DEFAULT_REGION);
const TAG = "verify34";

async function main() {
  writesTo();

  const [reference] = await db
    .select({ organizationId: users.organizationId, id: users.id })
    .from(users)
    .where(eq(users.role, "therapist"))
    .limit(1);
  const clinician = required(reference, "therapist whose organisation the fixtures can join");

  let personId: string | null = null;

  try {
    const [person] = await db
      .insert(people)
      .values({ firstName: `${TAG}-Hana`, phone: "+201555000034" })
      .returning({ id: people.id });
    personId = person!.id;

    const base = {
      personId,
      organizationId: clinician.organizationId,
      evidence: { kind: "clinician" as const, userId: clinician.id },
    };

    /* The one that should reach the model: background a session does not re-measure. */
    await recordFact({
      ...base,
      domain: "social",
      field: "housing",
      value: "lives with a flatmate in Maadi",
      source: "clinician",
      quote: "Entered at the assessment.",
    });

    /* Five that should not, one per rule. */
    await recordFact({
      ...base,
      domain: "presentation",
      field: "sleep",
      value: "early waking most nights",
      source: "clinician",
      quote: "Entered at the assessment.",
    });
    await recordFact({
      ...base,
      domain: "diagnosis",
      field: "primary",
      value: "panic disorder",
      source: "clinician",
      quote: "Entered at the assessment.",
    });
    await recordFact({
      ...base,
      domain: "medication",
      field: "ssri",
      value: "sertraline 50mg",
      source: "ai",
      confidence: 0.9,
      quote: "he mentioned the tablets",
      evidence: { kind: "clinician", userId: clinician.id },
    });
    await recordFact({
      ...base,
      domain: "goal",
      field: "focus",
      value: "finish the course in Shoubra",
      source: "clinician",
      quote: "Said in the first session.",
      /* Older than `goal`'s 90-day half-life. */
      effectiveAt: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000),
    });
    const disputed = await recordFact({
      ...base,
      domain: "function",
      field: "work",
      value: "signed off since March",
      source: "clinician",
      quote: "Typed after the review.",
    });
    await db
      .update(patientClinicalFacts)
      .set({ status: "disputed" })
      .where(eq(patientClinicalFacts.id, disputed.id));

    /* 🔴 The block, built the way `buildContext` builds it, from real rows. */
    const facts = await factsFor(personId);
    const block = factsPrompt(facts, new Date());

    /*
     * 🔴 The FACT LINES, not the whole block.
     *
     * The first version of this scanned the entire string for "panic disorder"
     * and failed, because the block's own instructions say *"a history of panic
     * attacks is not a diagnosis of panic disorder"*. The check was matching
     * the rule that forbids the thing as though it were the thing: C84's shape
     * again, a checker matching its own prose. What a model might restate is a
     * fact line, so a fact line is what is scanned.
     */
    const factLines = block
      .split("\n")
      .filter((line) => /^- [a-z_]+\//i.test(line))
      .join("\n");

    check(
      "🔴 34.1 a person's facts reach the prompt, read from their own region",
      factLines.includes("lives with a flatmate in Maadi"),
      factLines ? `${factLines.split("\n").length} fact lines` : "no facts were sent",
    );

    check(
      "🔴 C170 nothing a session re-measures is sent: the model cannot arbitrate a contradiction",
      !factLines.includes("early waking most nights"),
      factLines.includes("early waking") ? "IT WAS SENT" : "excluded",
    );

    check(
      "🔴 C168 no diagnosis reaches the note generator",
      !factLines.includes("panic disorder"),
      factLines.includes("panic disorder") ? "IT WAS SENT" : "excluded",
    );

    check(
      "🔴 C167 an unverified model guess is not fed back into a model",
      !factLines.includes("sertraline"),
      factLines.includes("sertraline") ? "IT WAS SENT" : "excluded",
    );

    check(
      "33.3 a stale fact is not sent as though it described today",
      !factLines.includes("Shoubra"),
      factLines.includes("Shoubra") ? "IT WAS SENT" : "excluded",
    );

    check(
      "🔴 34.1 a fact the clinician disagreed with is never sent back to the model",
      !factLines.includes("signed off since March"),
      factLines.includes("signed off") ? "IT WAS SENT" : "excluded",
    );

    check(
      "34.1 every line carries its age and its source, so it cannot read as today's observation",
      /\((today|yesterday|[^)]*ago)[^)]*, recorded by the clinician\)/.test(factLines),
      factLines.split("\n")[0] ?? "",
    );

    /* H2 — the rule outranks the content only if it comes first. */
    const rulesAt = block.indexOf("Nothing here may go in the note");
    const firstFactAt = block.indexOf("- social/housing");
    check(
      "🔴 H2 the rules are stated ABOVE the facts, never below them",
      rulesAt >= 0 && firstFactAt > rulesAt,
      `rules at ${rulesAt}, first fact at ${firstFactAt}`,
    );

    /* And the same rule, in the system prompt, above the schema. */
    const notes = readFileSync("lib/ai/notes.ts", "utf8");
    const overrideAt = notes.indexOf("RULE THAT OVERRIDES EVERYTHING BELOW");
    const schemaAt = notes.indexOf("Respond with a single JSON object");
    check(
      "🔴 H2 …and the system prompt states it before the schema, not after",
      overrideAt >= 0 && schemaAt > overrideAt,
      overrideAt < 0 ? "the rule is missing" : "stated first",
    );

    /* ------------------------------------------------------ C169 · the tag */

    check(
      "🔴 C169 a note written in Arabic is Arabic, whatever tag the model returned",
      normaliseLanguage("es", "هذه ملاحظة سريرية مكتوبة بالعربية عن جلسة اليوم مع المريضة وقد تحدثنا عن النوم والقلق") === "ar",
    );

    check(
      "C169 …and a note written in Latin script is not Arabic, whatever it claimed",
      normaliseLanguage("ar", "The patient described early waking and a tight chest before meetings.") === "en",
    );

    check(
      "C169 an unchecked claim still stands when there is no text to check it against",
      normaliseLanguage("fr") === "fr" && normaliseLanguage("zz") === "en",
    );

    /* -------------------------------------------------- the empty case */

    const [fresh] = await db
      .insert(people)
      .values({ firstName: `${TAG}-New`, phone: "+201555000134" })
      .returning({ id: people.id });

    const emptyBlock = factsPrompt(await factsFor(fresh!.id), new Date());
    check(
      "34.1 a person with no record produces NO block, so an ungrounded note is unchanged",
      emptyBlock === "",
      emptyBlock === "" ? "empty" : "a block was built from nothing",
    );
    await db.delete(people).where(eq(people.id, fresh!.id));
  } finally {
    if (personId) {
      await db.delete(patientClinicalFacts).where(eq(patientClinicalFacts.personId, personId));
      await db.delete(people).where(eq(people.id, personId));
    }
  }

  finish("Sprint 34");
}

void main();
