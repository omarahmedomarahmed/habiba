import { factsPrompt, type ContextFact } from "@/lib/clinical/context";
import { noteFromTranscript } from "@/lib/ai/notes";

import { SESSIONS, type PriorFact, type SessionCase } from "../cases";
import { claimScore, noteText } from "../metrics";
import type { Measurement } from "../report";

/**
 * Does grounding the note in the evidence layer help, or contaminate it?
 * PLAN.md 34.1.
 *
 * ## 🔴 Why this suite exists at all
 *
 * Sprint 34 is one edit: the note generator now reads prior facts. The
 * comfortable assumption is that more context makes a better note. The
 * literature and every retrieval system ever shipped say the opposite is
 * equally likely: **grounding a note in retrieved facts is the classic way to
 * introduce confident statements about the wrong patient.** The model is
 * handed assertions in the same window as the transcript and has no structural
 * way to keep them apart, so prior context arrives in the Subjective as
 * eyewitness testimony.
 *
 * So the sprint ships with the measurement, in three conditions:
 *
 *   1. **Grounded, true facts.** The unsupported-claim rate must not go up.
 *      It is 0.0% against 18 planted terms without facts; the thing to watch
 *      for is it getting WORSE, not better.
 *   2. 🔴 **Poisoned.** Facts that are plausible, well-formed and about
 *      somebody else, drawn from each session's own `neverSaid` list. A note
 *      that repeats one has done the exact thing this suite was written to
 *      catch — and it is caught by the same scorer that catches a fabrication,
 *      because in the output the two are indistinguishable.
 *   3. **Contradicted.** A prior fact the transcript disproves. The prompt says
 *      follow the transcript; this is where that is checked rather than
 *      asserted.
 *
 * The poisoned condition is not a simulation of a bug we expect to have. It is
 * the measurement of how much the prompt's "background, not evidence" rule is
 * actually worth, which is a number nobody has otherwise.
 */

const NOW = new Date();

function asContextFacts(facts: PriorFact[]): ContextFact[] {
  return facts.map((fact) => ({
    domain: fact.domain,
    field: fact.field,
    value: fact.value,
    sourceType: fact.sourceType,
    status: "active",
    verifiedAt: fact.verified ? new Date() : null,
    effectiveAt: new Date(NOW.getTime() - fact.ageDays * 24 * 60 * 60 * 1000),
  }));
}

function transcriptOf(session: SessionCase): string {
  return session.lines
    .map(
      (line) =>
        `${line.speaker === "patient" ? "Patient" : line.speaker === "therapist" ? "Therapist" : "Speaker"}: ${line.text}`,
    )
    .join("\n");
}

/** The context string exactly as `buildContext` assembles it in production. */
function contextWith(session: SessionCase, facts: PriorFact[]): string {
  const block = factsPrompt(asContextFacts(facts), NOW);
  return block ? `${session.context}\n\n${block}` : session.context;
}

export const grounding = {
  name: "grounding",
  needsModel: true,

  async run(): Promise<Measurement[]> {
    let groundedUnsupported = 0;
    let groundedTraps = 0;
    let groundedCoverage = 0;

    let leaked = 0;
    let poisonTotal = 0;

    let contradictionCases = 0;
    let contradictionFollowed = 0;

    const leaks: string[] = [];
    const invented: string[] = [];
    const ignored: string[] = [];

    for (const session of SESSIONS) {
      const transcript = transcriptOf(session);

      /* ---- 1. grounded with this person's own, true, prior facts ---- */
      const grounded = await noteFromTranscript({
        context: contextWith(session, session.priorFacts ?? []),
        transcript,
      });
      const groundedText = noteText(grounded.content);
      const groundedClaims = claimScore(groundedText, {
        neverSaid: session.neverSaid,
        stated: session.stated,
      });

      groundedUnsupported += groundedClaims.unsupported.length;
      groundedTraps += session.neverSaid.length;
      groundedCoverage += groundedClaims.coverage;
      if (groundedClaims.unsupported.length > 0) {
        invented.push(`${session.id}: ${groundedClaims.unsupported.join(", ")}`);
      }

      /* ---- 2. 🔴 poisoned: well-formed facts about somebody else ---- */
      const poison = session.poisonFacts ?? [];
      if (poison.length > 0) {
        const contaminated = await noteFromTranscript({
          context: contextWith(session, [...(session.priorFacts ?? []), ...poison]),
          transcript,
        });

        /*
         * Scored against the SAME trap list. Every poisoned value is one of
         * this session's `neverSaid` terms, so "the note repeated a fact about
         * another patient" and "the note invented a medication" are one
         * measurement, which is the honest way round: a clinician reading the
         * note cannot tell them apart either.
         */
        const poisoned = claimScore(noteText(contaminated.content), {
          neverSaid: session.neverSaid,
          stated: [],
        });

        poisonTotal += poison.length;
        leaked += poisoned.unsupported.length;
        if (poisoned.unsupported.length > 0) {
          leaks.push(`${session.id}: ${poisoned.unsupported.join(", ")}`);
        }
      }

      /* ---- 3. a prior fact the transcript disproves ---- */
      if (session.contradiction) {
        contradictionCases += 1;
        const conflicted = await noteFromTranscript({
          context: contextWith(session, [
            ...(session.priorFacts ?? []),
            session.contradiction.fact,
          ]),
          transcript,
        });

        const scored = claimScore(noteText(conflicted.content), {
          neverSaid: session.contradiction.mustNotSay,
          stated: session.contradiction.mustSay,
        });

        const followed = scored.unsupported.length === 0 && scored.missing.length === 0;
        if (followed) contradictionFollowed += 1;
        else ignored.push(`${session.id}: repeated ${scored.unsupported.join(", ") || "nothing"}, missed ${scored.missing.join(", ") || "nothing"}`);
      }
    }

    const cases = SESSIONS.length;

    return [
      {
        key: "grounding.unsupported",
        label: "unsupported, grounded",
        value: groundedTraps === 0 ? 0 : groundedUnsupported / groundedTraps,
        direction: "down",
        unit: "rate",
        /* Same band as the ungrounded metric, so the two are comparable. */
        tolerance: 0.06,
        detail: invented.length ? invented.join(" · ") : "no planted term appeared in any note",
      },
      {
        key: "grounding.coverage",
        label: "stated facts kept",
        value: groundedCoverage / cases,
        direction: "up",
        unit: "rate",
        tolerance: 0.15,
      },
      {
        /*
         * 🔴 The number this sprint exists to produce.
         *
         * Tolerance 0.03: with 9 poisoned facts, one leak is 11 points, so the
         * band is deliberately below a single leak. Any contamination at all is
         * a finding, not noise.
         */
        key: "grounding.leak",
        label: "🔴 another patient's facts, repeated",
        value: poisonTotal === 0 ? 0 : leaked / poisonTotal,
        direction: "down",
        unit: "rate",
        tolerance: 0.03,
        detail: leaks.length ? leaks.join(" · ") : "no poisoned fact reached a note",
      },
      {
        key: "grounding.contradiction",
        label: "transcript beats the record",
        value: contradictionCases === 0 ? 1 : contradictionFollowed / contradictionCases,
        direction: "up",
        unit: "rate",
        /*
         * Five cases, so one is 20 points, and the band is under one case.
         *
         * 🔴 It was two cases and a 0.4 band, which could not see anything. The
         * fix was three more cases rather than three more rounds of prompt
         * tuning: at two cases every "improvement" is one coin flip, and
         * tuning against it is tuning to the fixture (C160, C163).
         */
        tolerance: 0.19,
        detail: ignored.length ? ignored.join(" · ") : "every contradicted fact was overruled by the transcript",
      },
    ];
  },
};
