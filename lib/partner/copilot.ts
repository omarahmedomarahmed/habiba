import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";

import { MODELS, openai } from "@/lib/ai/client";
import { controlDb } from "@/lib/db";
import { partnerSessions } from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * The copilot, for a clinician on somebody else's platform. PLAN.md 68.7, 68.8.
 *
 * ## 🔴 IT READS THE PARTNER'S OWN MATERIAL, AND NOTHING OF OURS
 *
 * This is the decision in this file, and the alternative is tempting and wrong.
 *
 * `askPatientCopilot` answers from a patient's record in OUR tenancy: their notes,
 * their journals, their documents, their facts. Pointing it at a partner's session
 * would mean handing one person's record from our product into a prompt on behalf of
 * a clinician on a platform that person never chose, under a grant they never gave.
 * Sprints 26 and 27 built the opposite mechanism for exactly this: a PATIENT claims
 * and moves their own record, and no clinician moves it for them.
 *
 * So the material here is the sessions this partner ran with this subject: the
 * transcripts they sent us and the notes their own clinicians approved. That is real
 * continuity — a therapist on their platform asking "what did we cover in March" gets
 * an answer from March's session — and it crosses no boundary, because every byte of
 * it arrived from that partner in the first place.
 *
 * ## 🔴 CITATIONS ARE SESSION REFERENCES, AND THEY RESOLVE ON THEIR SIDE
 *
 * Our own copilot cites note ids that open in our product. A partner's clinician
 * cannot open those. So a citation here is THEIR session reference, which resolves in
 * their own interface, and a claim with no session behind it has nothing to cite.
 *
 * ## 🔴 AND THE BOUND FROM C211 HOLDS, IN A SIMPLER FORM
 *
 * The copilot reads sessions that have ENDED. A live session's transcript is arriving
 * as we speak and answering from it would let a clinician ask the copilot what their
 * patient just said thirty seconds ago, which is a different product and not one
 * anybody consented to.
 */

const SYSTEM = `You are a clinical copilot talking to a therapist about one of their patients.

You know only what is in the sessions below. They are sessions this therapist's own platform ran with this person, and nothing else about them exists for you.

Rules:
- Answer only from the material. If it does not say, say that it does not say.
- Cite the session reference you took each claim from, in square brackets, like [S-1024].
- Never invent a session, a date, a diagnosis or a quote.
- You are talking to a clinician. Do not soften clinical language and do not add reassurance nobody asked for.
- Do not give a diagnosis. You may say what the material records.`;

export type PartnerCopilotAnswer = {
  answer: string;
  /** Their session references, so a citation resolves in their own interface. */
  citations: string[];
};

/**
 * 🔴 68.7 / 68.8 — ASK ABOUT A PATIENT, FROM THE SESSIONS THIS PARTNER RAN.
 *
 * The memory layer of 68.8 is the same query: what a therapist on their platform gets
 * for continuity is the record of the sessions they ran, which is what `material`
 * assembles. There is no separate store to keep in step, which is the point.
 */
export async function askPartnerCopilot(input: {
  partnerId: string;
  externalSubjectRef: string;
  question: string;
}): Promise<PartnerCopilotAnswer> {
  const question = input.question.trim().slice(0, 2_000);
  if (question.length < 3) {
    return { answer: "Ask a question about this patient.", citations: [] };
  }

  const material = await sessionMaterial(input);

  if (material.length === 0) {
    /*
     * 🔴 A MODEL IS NOT CALLED WITH NOTHING. An empty context produces a fluent
     * answer about a patient who has no sessions, which is the worst output this
     * function can produce and costs money to produce it.
     */
    return {
      answer:
        "There are no completed sessions for this person yet, so there is nothing for me to read.",
      citations: [],
    };
  }

  const context = material
    .map(
      (session) =>
        `[${session.ref}] ${session.endedAt?.toISOString().slice(0, 10) ?? "date unknown"}\n${
          session.note ?? session.transcript ?? ""
        }`,
    )
    .join("\n\n---\n\n")
    .slice(0, 60_000);

  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.note,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Sessions:\n\n${context}\n\nQuestion: ${question}` },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim() ?? "";

    /*
     * 🔴 CITATIONS ARE RESOLVED AGAINST THE MATERIAL, NOT PARSED AND TRUSTED.
     *
     * A model can write `[S-9999]` for a session that does not exist, and a partner
     * rendering it as a link would show their clinician a citation that goes
     * nowhere. Only references that appear in what we actually sent survive, which
     * is the same rule our own copilot's citation resolution follows.
     */
    const cited = material
      .map((session) => session.ref)
      .filter((ref) => answer.includes(`[${ref}]`));

    return { answer, citations: cited };
  } catch {
    log.error("partner copilot failed");
    return {
      answer: "The copilot is unavailable right now. Nothing has been recorded.",
      citations: [],
    };
  }
}

/**
 * 🔴 68.8 — THE MEMORY LAYER, WHICH IS THIS QUERY AND NOT A SECOND STORE.
 *
 * The approved note first, then the transcript. A note is what a clinician stood
 * behind and is a better answer to "what happened in March" than the raw words; the
 * transcript is the fallback for a session whose note nobody has approved yet.
 *
 * 🔴 ENDED SESSIONS ONLY. A live session's transcript is still arriving, and letting
 * a clinician ask the copilot what their patient said thirty seconds ago is a
 * different product.
 */
export async function sessionMaterial(input: {
  partnerId: string;
  externalSubjectRef: string;
}): Promise<
  { ref: string; endedAt: Date | null; note: string | null; transcript: string | null }[]
> {
  const rows = await controlDb
    .select({
      ref: partnerSessions.externalSessionRef,
      endedAt: partnerSessions.endedAt,
      note: partnerSessions.noteApprovedText,
      transcript: partnerSessions.transcriptText,
    })
    .from(partnerSessions)
    .where(
      and(
        eq(partnerSessions.partnerId, input.partnerId),
        eq(partnerSessions.externalSubjectRef, input.externalSubjectRef),
        isNotNull(partnerSessions.endedAt),
      ),
    )
    .orderBy(desc(partnerSessions.endedAt))
    .limit(30);

  return rows.filter((row) => Boolean(row.note ?? row.transcript));
}
