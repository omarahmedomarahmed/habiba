import { readdirSync, readFileSync } from "node:fs";

/**
 * 🔴 Which model calls are measured, and which are not. PLAN.md 32.2.
 *
 * ## Why a list rather than a promise
 *
 * 32.2 says "every AI change after this reports its numbers". A sentence in a
 * plan does not survive a busy sprint; a check does. So every module that talks
 * to a model is either **covered by a suite** or **named here with a reason**,
 * and `verify:sprint32` fails when a module is neither — which is what happens
 * the day somebody adds `lib/ai/summarise.ts` and no eval.
 *
 * The shape is deliberately the region-pin shape (C157): an unmeasured surface
 * says so out loud, the count is printed, and the committed figure may only go
 * **down**. An unmeasured model call is debt in exactly the way an unrouted
 * database call is, and debt that can grow quietly is how C89 kept coming back.
 *
 * A reason has to say what would have to exist to measure it, not "TODO".
 */

export type Surface = {
  /** The module, relative to the repository root. */
  file: string;
  /** The suite that measures it, or null when nothing does. */
  suite: string | null;
  /** Why not, when not. Must name what is missing. */
  reason?: string;
};

export const SURFACES: Surface[] = [
  { file: "lib/ai/notes.ts", suite: "notes" },
  /* 34.1 — the same module, grounded. Measured separately because the failure
     mode is different: contamination rather than fabrication. */
  { file: "lib/clinical/context.ts", suite: "grounding" },
  { file: "lib/ai/diarise.ts", suite: "attribution" },
  { file: "lib/ai/transcribe.ts", suite: "speech" },
  /* Not in lib/ai, and measured anyway: it is the safety one. */
  { file: "lib/crisis/alerts.ts", suite: "risk" },
  /* 35.1 — the classifier, measured against the floor it has to beat. */
  { file: "lib/ai/risk.ts", suite: "risk-model" },

  {
    file: "lib/ai/copilot.ts",
    suite: null,
    reason:
      "the in-session suggestion line. Needs a gold set of what a good next question is, which is a clinical judgement nobody in this repository is qualified to write down. Deferred until a clinician will sit and label 40 turns.",
  },
  {
    file: "lib/ai/case-copilot.ts",
    suite: null,
    reason:
      "answers about one patient's record, with citations. The citation resolution is already covered by tests/attribution and tests/memory; the ANSWER quality is not, and would need a labelled question set over a synthetic chart. 33 builds that chart, so this waits for it.",
  },
  {
    file: "lib/ai/assistant.ts",
    suite: null,
    reason:
      "the general assistant, which structurally cannot read a clinical record (10.x). Its failure mode is a boundary breach rather than a quality one, and the boundary is proved by verify:sprint24's import-graph guard rather than by a number.",
  },
  {
    file: "lib/ai/profile.ts",
    suite: null,
    reason:
      "the rolling profile, regenerated from sources. Measurable the same way the note is — planted facts across several sessions — and it is a bigger fixture than this sprint has. Named here so it is a line in a report rather than an oversight.",
  },
  {
    file: "lib/ai/diagnoses.ts",
    suite: null,
    reason:
      "reads a diagnosis out of an uploaded document. Needs synthetic referral letters with known codes; the extraction path itself is covered by tests/documents-extract.",
  },
  {
    file: "lib/ai/translate.ts",
    suite: null,
    reason:
      "translates an already-written note. The notes suite measures fact retention within a language; measuring it across the translation needs the same trap list applied to the English copy, which is one sprint's worth of Arabic fixtures away.",
  },
];

/** Modules that talk to a model, found in the source rather than listed. */
export function modelCallSites(roots = ["lib"]): string[] {
  const found: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const source = readFileSync(path, "utf8");
      /* The gateway itself is the thing being called, not a call site. */
      if (path.endsWith("lib/ai/client.ts")) continue;
      if (/openai\(\)\s*\.\s*(chat|audio|responses|embeddings)/.test(source)) found.push(path);
    }
  };

  for (const root of roots) walk(root);
  return found.sort();
}

export function unmeasured(): Surface[] {
  return SURFACES.filter((surface) => surface.suite === null);
}
