/**
 * 🔴 WALKTHROUGH DEVIATION W2, recorded rather than hidden.
 *
 * 37R.20 asks for the risk assessment on a session: the indicators, the
 * quotes, and the prior-risk panel. The transcription provider is mocked on
 * this deployment (no OpenAI credits), so every transcript line reads
 * "Transcribed chunk N" and no risk language can reach the scanner through the
 * microphone.
 *
 * This writes transcript segments that a real session would have produced, and
 * nothing else. The assessment itself is then run by the product's own
 * `assessSessionRisk`, whose keyword floor needs no model at all — which is
 * the half that ships and the half that must never be dark.
 */
import { eq } from "drizzle-orm";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";
import { sessions, transcriptSegments } from "../lib/db/schema";

const db = dbFor(DEFAULT_REGION);

const LINES: Array<[string, "therapist" | "patient"]> = [
  ["How has the week been since we last spoke?", "therapist"],
  ["Honestly it has been the worst one yet. I have not slept properly at all.", "patient"],
  ["Tell me about the nights.", "therapist"],
  ["I lie there and I keep thinking everyone would be better off without me.", "patient"],
  ["Thank you for telling me that. Have you thought about acting on it?", "therapist"],
  ["I have been counting the tablets in the cupboard. I know how many there are.", "patient"],
];

async function main() {
  const sessionId = process.argv[2]!;
  const [session] = await db
    .select({ id: sessions.id, organizationId: sessions.organizationId })
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!session) throw new Error(`no session ${sessionId}`);

  await db.delete(transcriptSegments).where(eq(transcriptSegments.sessionId, sessionId));

  let sequence = 1;
  for (const [text, speaker] of LINES) {
    await db.insert(transcriptSegments).values({
      sessionId,
      organizationId: session.organizationId,
      sequence,
      speaker,
      text,
      startMs: (sequence - 1) * 8000,
      endMs: sequence * 8000,
    });
    sequence += 1;
  }

  console.log(`seeded ${LINES.length} transcript lines on ${sessionId} (W2: transcription is mocked here)`);
}

void main();
