import { noteFromTranscript } from "@/lib/ai/notes";

import { SESSIONS } from "../cases";
import { claimScore, noteText, sectionCoverage } from "../metrics";
import type { Measurement } from "../report";

/**
 * The note. PLAN.md 32.1.
 *
 * Four things, measured on the shipped prompt over synthetic sessions:
 *
 *   1. **Unsupported claims.** Planted terms that appear nowhere in the
 *      transcript — a common SSRI, a diagnosis, a round number of weeks. A note
 *      containing one invented it. A lower bound, not a hallucination rate:
 *      it catches the fabrications somebody thought to plant.
 *   2. **Fact coverage.** Facts the transcript does state, which a competent
 *      note carries. This is the counterweight — a note that says almost
 *      nothing scores perfectly on (1).
 *   3. **Required sections.** An empty box is a box the clinician fills in by
 *      hand at nine at night.
 *   4. **Language.** 🔴 Reported separately for Arabic, because an average
 *      across three cases would hide a note written in English from an Arabic
 *      session — which is not a quality problem, it is a record in the wrong
 *      language, and it is the failure this pipeline has already had once.
 *
 * ## Arabic semantic preservation, and what this does NOT measure
 *
 * It is measured as **fact retention across the language boundary**: the same
 * kind of trap list, in Arabic, scored the same way. That is a real property
 * and a narrow one. What it cannot tell you is whether the Arabic reads like a
 * clinician wrote it — register, not content — and no number here should be
 * quoted as if it could. That judgement needs an Arabic-speaking clinician
 * reading the output, and 32 does not pretend otherwise.
 */
export const notes = {
  name: "notes",
  needsModel: true,

  async run(): Promise<Measurement[]> {
    let unsupportedTotal = 0;
    let trapsTotal = 0;
    let coverageSum = 0;
    let sectionSum = 0;
    let languageRight = 0;
    let arabicCoverage = 0;
    let arabicCases = 0;
    let arabicLanguageRight = 0;

    const invented: string[] = [];
    const blanks: string[] = [];
    const dropped: string[] = [];

    for (const session of SESSIONS) {
      const transcript = session.lines
        .map(
          (line) =>
            `${line.speaker === "patient" ? "Patient" : line.speaker === "therapist" ? "Therapist" : "Speaker"}: ${line.text}`,
        )
        .join("\n");

      const { content, language } = await noteFromTranscript({
        context: session.context,
        transcript,
      });

      /*
       * 🔴 The patient's three fields are scanned with the rest.
       *
       * They are the only part the patient ever reads, so an invented fact
       * there is read by the person it is about. Scoring the clinician's note
       * and skipping theirs would measure the half that gets reviewed.
       */
      const text = noteText(content);
      const claims = claimScore(text, { neverSaid: session.neverSaid, stated: session.stated });
      const sections = sectionCoverage(
        content as unknown as Record<string, unknown>,
        session.requiredSections,
      );

      unsupportedTotal += claims.unsupported.length;
      trapsTotal += session.neverSaid.length;
      coverageSum += claims.coverage;
      sectionSum += sections.coverage;
      if (language === session.language) languageRight += 1;

      if (claims.unsupported.length > 0) {
        invented.push(`${session.id}: ${claims.unsupported.join(", ")}`);
      }
      if (sections.empty.length > 0) blanks.push(`${session.id}: ${sections.empty.join(", ")}`);
      /* Named, not counted: a maintainer has to see WHICH fact the note lost. */
      if (claims.missing.length > 0) dropped.push(`${session.id}: ${claims.missing.join(", ")}`);

      if (session.language === "ar") {
        arabicCases += 1;
        arabicCoverage += claims.coverage;
        if (language === "ar") arabicLanguageRight += 1;
      }
    }

    const cases = SESSIONS.length;

    return [
      {
        key: "notes.unsupported",
        label: "unsupported claims",
        value: trapsTotal === 0 ? 0 : unsupportedTotal / trapsTotal,
        direction: "down",
        unit: "rate",
        /* One planted term in eighteen. Anything more is a real change. */
        tolerance: 0.06,
        detail: invented.length ? invented.join(" · ") : "no planted term appeared in any note",
      },
      {
        key: "notes.coverage",
        label: "stated facts kept",
        value: coverageSum / cases,
        direction: "up",
        unit: "rate",
        /*
         * 🔴 Fifteen facts across three cases, so **one fact is 6.7 points**.
         * Two consecutive runs of unchanged code moved this 13 points. The band
         * is therefore two facts, and the honest fix is not a wider band, it is
         * more cases: a tolerance this loose cannot see a small real regression.
         * Written down here so the next person widens the set rather than the
         * tolerance.
         */
        tolerance: 0.15,
        detail: dropped.length ? `dropped: ${dropped.join(" · ")}` : "every stated fact appeared",
      },
      {
        key: "notes.sections",
        label: "required sections filled",
        value: sectionSum / cases,
        direction: "up",
        unit: "rate",
        tolerance: 0.12,
        detail: blanks.length ? blanks.join(" · ") : "every required section had content",
      },
      {
        key: "notes.language",
        label: "note in the right language",
        value: languageRight / cases,
        direction: "up",
        unit: "rate",
        /* Zero: a note in the wrong language is never within tolerance. */
        tolerance: 0,
      },
      {
        key: "notes.ar.coverage",
        label: "  Arabic facts kept",
        value: arabicCases === 0 ? 1 : arabicCoverage / arabicCases,
        direction: "up",
        unit: "rate",
        /* One Arabic case, five facts: one fact is 20 points. The band is one. */
        tolerance: 0.2,
      },
      {
        key: "notes.ar.language",
        label: "  Arabic stayed Arabic",
        value: arabicCases === 0 ? 1 : arabicLanguageRight / arabicCases,
        direction: "up",
        unit: "rate",
        tolerance: 0,
      },
    ];
  },
};
