import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { openai } from "@/lib/ai/client";
import { audit } from "@/lib/audit";
import { getActor } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { documentChunks, personDocuments } from "@/lib/db/schema";
import { optionalPatient } from "@/lib/patient-auth/guard";
import { documentReadDecision } from "@/lib/documents/read-access";
import { log, safeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Read a document aloud — **without the text ever reaching the browser.**
 * PLAN.md 8.10.
 *
 * ## Why this is a different route from `/api/copilot/speak`
 *
 * That one takes text in the request body, which is right for a copilot answer
 * the clinician is already looking at. It is exactly wrong here. 8.10 asks for
 * a **read-only viewer** whose contents cannot be copied out, and a route that
 * accepts `{ text }` requires the client to hold the text in order to speak
 * it — which defeats the viewer entirely.
 *
 * So this takes a **document id**, reads the passages server-side, sends them
 * to the speech model, and returns audio. What the browser holds is an MP3.
 *
 * ## What this does and does not prevent
 *
 * It stops the ordinary paths: select-and-copy, view-source, the network tab,
 * a screen-reader extension scraping the DOM. It does not stop a photograph of
 * the screen, and nothing can. The honest claim is "the text is not in the
 * page", and that is the claim this route makes true.
 *
 * Every read is audited, like the bytes route beside it — being read aloud is
 * still being read.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin();
    const { id } = await context.params;

    const [document] = await db
      .select({
        id: personDocuments.id,
        personId: personDocuments.personId,
        title: personDocuments.title,
        body: personDocuments.body,
        uploadedByUserId: personDocuments.uploadedByUserId,
      })
      .from(personDocuments)
      .where(eq(personDocuments.id, id))
      .limit(1);

    if (!document) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const decision = await documentReadDecision({
      personId: document.personId,
      uploadedByUserId: document.uploadedByUserId,
      actor: await getActor(),
      patient: await optionalPatient(),
    });
    if (!decision.allowed) return NextResponse.json({ error: "not_found" }, { status: 404 });

    /*
     * The text, assembled here and never returned. Chunks rather than `body`
     * so an uploaded document that was extracted can be spoken too — and in
     * passage order, which is the order somebody reading it would use.
     */
    const chunks = await db
      .select({ text: documentChunks.text })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, id))
      .orderBy(asc(documentChunks.sequence));

    const text = (chunks.map((c) => c.text).join("\n\n") || document.body || "")
      .trim()
      // The speech API's own limit. A longer document is spoken up to here
      // rather than refused — a truncated reading is more use than an error.
      .slice(0, 4000);

    if (!text) return NextResponse.json({ error: "nothing_to_read" }, { status: 400 });

    await audit({
      actor: decision.actor,
      patientAccountId: decision.patientAccountId,
      category: "phi_access",
      action: "document.speak",
      resourceType: "person_document",
      resourceId: id,
    });

    const speech = await openai().audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "fable",
      input: text,
      response_format: "mp3",
    });

    return new NextResponse(await speech.arrayBuffer(), {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    log.warn("document speech failed", { reason: safeErrorMessage(error) });
    return NextResponse.json({ error: "speech_failed" }, { status: 500 });
  }
}
