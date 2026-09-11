import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { generateCopilot, shouldRunCopilot } from "@/lib/ai/copilot";
import { transcribeChunk } from "@/lib/ai/transcribe";
import { AuthorizationError, assertSameOrigin, requireUserApi } from "@/lib/auth/guard";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { sessions } from "@/lib/db/schema";
import { recordSessionSuggestions } from "@/lib/data/copilot";
import { appendTranscriptSegment } from "@/lib/data/transcript";
import { recordIngestUse, sourceForIngest } from "@/lib/data/session-sources";
import { bearerFrom, ingestDecision } from "@/lib/ingest/token";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/api/sessions/[id]/transcribe/route.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * A chunk is ~8 seconds of 16 kHz mono audio (~256 KB) and transcribes in
 * roughly one to two seconds. Sixty is generous; it exists so a stuck upstream
 * call fails fast rather than holding the clinician's connection open.
 */
export const maxDuration = 60;

/** Reject anything much larger than a chunk should ever be. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params;

    /*
     * 🔴 36.2 — THREE doors, and this is the third.
     *
     * A browser fetch from our own page (same origin + a clinician's cookie)
     * is doors one and two, unchanged. A bot has neither: no origin, and it
     * must never hold a person's session. So a session-scoped bearer token is
     * the third, and it is narrower than either of the others.
     *
     * The order matters. The token branch is taken **only** when a bearer is
     * presented, so a browser request cannot fall into it by accident and a
     * bot cannot fall out of it into the clinician path. Nothing about the two
     * existing doors is weakened; there is simply a third, with less behind it.
     */
    const bearer = bearerFrom(request.headers.get("authorization"));

    let session: {
      id: string;
      status: string;
      organizationId: string;
      therapistId: string;
      patientId: string | null;
      transcriptLanguage: string | null;
    } | null = null;
    /** Who to bill the model call to, and whether the copilot may run. */
    let actorUserId: string;
    let viaToken = false;

    if (bearer) {
      const found = await sourceForIngest(sessionId);
      const decision = ingestDecision({
        sessionId,
        header: request.headers.get("authorization"),
        source: found?.source ?? null,
      });

      if (!decision.ok) {
        /*
         * One status and one word for every refusal. The reason is logged and
         * never returned: "expired" versus "wrong_session" tells a prober which
         * session ids exist, and a bot has nothing useful to do with either.
         */
        log.warn("ingest token refused", { session: ref(sessionId), reason: decision.reason });
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      session = found!.session;
      actorUserId = found!.session.therapistId;
      viaToken = true;
    } else {
      await assertSameOrigin();
      const actor = await requireUserApi();
      actorUserId = actor.userId;

      // Ownership is checked here, not inferred from the URL. The transcript is
      // the rawest PHI in the system.
      const [row] = await db
        .select({
          id: sessions.id,
          status: sessions.status,
          organizationId: sessions.organizationId,
          therapistId: sessions.therapistId,
          patientId: sessions.patientId,
          transcriptLanguage: sessions.transcriptLanguage,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.id, sessionId),
            eq(sessions.organizationId, actor.organizationId),
            eq(sessions.therapistId, actor.userId),
          ),
        )
        .limit(1);

      session = row ?? null;
    }

    if (!session) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "not_live" }, { status: 409 });
    }

    const form = await request.formData();
    const file = form.get("audio");
    const sequenceRaw = Number(form.get("sequence") ?? 0);
    const durationRaw = Number(form.get("duration") ?? 8);
    const speakerRaw = String(form.get("speaker") ?? "unknown");
    // On a video call each participant is captured on their own track, so the
    // client knows exactly who is speaking. In person there is one microphone
    // in a room and honestly saying "unknown" beats guessing wrong in a chart.
    const speaker =
      speakerRaw === "therapist" || speakerRaw === "patient" ? speakerRaw : "unknown";

    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "no_audio" }, { status: 400 });
    }
    // The old handler set no multer limits and no body parser limit anywhere,
    // so an arbitrarily large upload was buffered straight into memory.
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }
    if (!Number.isFinite(sequenceRaw) || sequenceRaw < 1) {
      return NextResponse.json({ error: "bad_sequence" }, { status: 400 });
    }

    const text = await transcribeChunk({
      audio: await file.arrayBuffer(),
      mimeType: file.type || "audio/wav",
      durationSeconds: Number.isFinite(durationRaw) ? durationRaw : 8,
      organizationId: session.organizationId,
      userId: actorUserId,
      sessionId: session.id,
      // Null until somebody sets it in the room, and null means "detect it".
      // Either is better than the "en" that used to be hardcoded one layer
      // down, which asserted English over every Arabic session on the platform.
      language: session.transcriptLanguage,
    });

    if (!text) {
      return NextResponse.json({ text: "", sequence: sequenceRaw, crisis: false });
    }

    const result = await appendTranscriptSegment({
      sessionId: session.id,
      organizationId: session.organizationId,
      therapistId: session.therapistId,
      patientId: session.patientId,
      sequence: sequenceRaw,
      speaker,
      text,
      startMs: (sequenceRaw - 1) * 8000,
      endMs: sequenceRaw * 8000,
    });

    /*
     * 🔴 The third door appends audio and NOTHING else.
     *
     * The copilot is a clinician's panel: it reads the chart, writes into their
     * thread, and belongs to a person who is in the room. A bot is not in the
     * room and has no person, so the token branch never runs it — and because
     * the suggestions are also the response body, a token holder never receives
     * clinical text back either. What goes in is audio; what comes out is a
     * sequence number.
     *
     * The response to the chunk upload is otherwise the push channel. The
     * client is already talking to the server every few seconds, so a crisis
     * flag, a new segment and any copilot suggestion ride back on a request
     * that was happening anyway — which is why this app needs no WebSocket.
     */
    const suggestions =
      !viaToken && result.inserted && shouldRunCopilot(sequenceRaw)
        ? await generateCopilot({
            sessionId: session.id,
            organizationId: session.organizationId,
            userId: actorUserId,
          })
        : [];

    if (viaToken) {
      await recordIngestUse(session.id, session.organizationId, session.patientId);
      /*
       * 🔴 And the body a bot gets back carries no clinical text.
       *
       * `text` is what the patient just said and `crisis` is a clinical
       * judgement about them. Neither belongs in a response to a machine that
       * authenticated with a token somebody could leave in a log. The audio
       * went in; the acknowledgement comes out.
       */
      return NextResponse.json({ sequence: sequenceRaw, accepted: true });
    }

    // Anything surfaced in the room is written into that patient's copilot
    // thread, so the panel during a session and the chat afterwards are one
    // continuous conversation rather than two disconnected features.
    if (suggestions.length > 0) {
      await recordSessionSuggestions({
        organizationId: session.organizationId,
        therapistId: session.therapistId,
        patientId: session.patientId,
        sessionId: session.id,
        suggestions,
      });
    }

    return NextResponse.json({
      text,
      speaker,
      sequence: sequenceRaw,
      crisis: result.crisis,
      suggestions,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    log.warn("transcribe route failed", { reason: safeErrorMessage(error) });
    return NextResponse.json({ error: "transcription_failed" }, { status: 500 });
  }
}
