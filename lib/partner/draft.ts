import "server-only";

/*
 * 🔴 58.6 / C336 — `note-writer` AND NOT `notes`, and the import path is the ruling.
 *
 * `lib/ai/notes.ts` stores what it writes, so it imports four clinical data modules.
 * This route holds a PARTNER's API key, and importing that file put eight paths from
 * a third party's credential into our clinical data layer on the 58.6 matrix.
 * `note-writer` is the same prompt and the same model call with no database in it.
 */
import { noteFromTranscript } from "@/lib/ai/note-writer";
import { log } from "@/lib/logger";
import { sectionsText } from "@/lib/notes/formats";

/**
 * The draft, written with the same pipeline ours is. PLAN.md 68.6.
 *
 * ## 🔴 `noteFromTranscript` AND NOT A SECOND PROMPT
 *
 * This is the same function `generateNoteContent` calls, with the same system prompt,
 * the same model and the same normalisation. A partner's clinician reads a note
 * written by the product we sell, not by a cheaper version of it, and the eval suite
 * that measures our notes measures theirs.
 *
 * A second prompt here would be the C84 shape: a copy of a pipeline that drifts from
 * it silently, with an eval suite reporting a number about code nobody runs.
 *
 * ## 🔴 AND THE CONTEXT IS EMPTY, WHICH IS A FACT RATHER THAN A GAP
 *
 * Our own notes are written with a context built from the patient's record: prior
 * sessions, facts, the clinician's own memory. A partner's patient usually has no
 * record with us at all (68.10 makes unclaimed the normal case), so there is nothing
 * to build one from and passing an invented one would be worse than passing none.
 *
 * Where the person HAS claimed their record, `memory:read` is the route that carries
 * that continuity across, and it goes to their clinician rather than into a prompt:
 * a person's history reaching a model on somebody else's platform without them ever
 * having chosen that platform is not a thing we get to do quietly.
 */
export async function writeSessionNote(transcript: string): Promise<string | null> {
  const text = transcript.trim();
  if (text.length < 40) return null;

  try {
    const { content } = await noteFromTranscript({ context: "", transcript: text });

    /*
     * 🔴 FLATTENED TO TEXT, because it lands in somebody else's chart.
     *
     * Our own note is a structured `NoteContent` rendered by our own components. A
     * partner has their own chart with their own shape, and handing them our JSON
     * would mean every integrator writing a renderer for a structure we may change.
     * SOAP headings in plain text is the format every clinical system on earth can
     * already accept.
     */
    /*
     * 🔴 W2-F01: flattened by the one reader every chart outside ours uses, so
     * a note in any format lands with its own headings. The draft is SOAP, as
     * it always was: a partner's clinician has no format setting with us.
     */
    return sectionsText(content);
  } catch {
    /*
     * Null rather than a throw. The route renders the transcript and an empty draft,
     * which is a screen their clinician can still work from: a 500 would make a
     * model having a bad afternoon look like our API being down.
     */
    log.error("partner note draft failed");
    return null;
  }
}

/**
 * 🔴 68.9 — THE PATIENT'S SUMMARY, WHICH IS NOT THE NOTE.
 *
 * The SOAP note is a professional document full of differential impressions and risk
 * language; sending it to the person it is about is how a clinician ends up
 * explaining the word "guarded" over the phone. `patientBrief` and `patientSteps` are
 * written in the same generation pass, addressed to the patient, and they are what
 * this returns.
 *
 * Their clinician still reviews and edits it before anybody sees it (the summary
 * route refuses delivery until the note is approved), so this is a draft in exactly
 * the sense the note draft is.
 */
export async function writePatientSummary(transcript: string): Promise<string | null> {
  const text = transcript.trim();
  if (text.length < 40) return null;

  try {
    const { content } = await noteFromTranscript({ context: "", transcript: text });

    const steps = content.patientSteps.filter((step) => step.trim().length > 0);

    return [
      content.patientBrief.trim(),
      steps.length > 0 ? steps.map((step) => `- ${step.trim()}`).join("\n") : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  } catch {
    log.error("partner summary draft failed");
    return null;
  }
}
