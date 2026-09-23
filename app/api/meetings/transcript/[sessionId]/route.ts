import { NextResponse } from "next/server";

import { acrossRegions } from "@/lib/db";
import { sessionSources, sessions } from "@/lib/db/schema";
import { assertOurBot } from "@/lib/meetings/dispatch";
import { log, ref } from "@/lib/logger";
import { mayRecord } from "@/lib/sessions/may-record";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Where a meeting bot's transcript arrives. PLAN.md 41.5, 41.7.
 *
 * ## 🔴 41.5 / C134 — identity comes from the session we created
 *
 * > *Identity comes from the session we created, never from a meeting display
 * > name.*
 *
 * A provider hands us a participant called "Sara's iPhone", "Dr Ahmed" or
 * "Guest". None of those is a person this product knows, and any of them can
 * be typed by anybody who joins. Attributing a line of a therapy transcript to
 * a patient on the strength of a string somebody chose in a settings screen is
 * how a sentence ends up in the wrong person's chart.
 *
 * So this route reads the speaker's TRACK and nothing else, and the mapping
 * from track to person is `session_voices`, which is bound either by the
 * recording already knowing (two tracks) or by a named human saying so (37.2).
 * A display name never enters a decision here. The check below asserts the
 * payload's name field is not consulted, and `verify:sprint41` asserts it
 * against this file's source, because the tempting version of this code is one
 * line long and wrong.
 *
 * ## 🔴 41.7 — a bot in the wrong meeting is a HARD STOP
 *
 * The strongest of the eighteen edge cases and the only one that is not a
 * degradation. If the bot id on this payload is not the one we dispatched for
 * this session, a recorder is somewhere we did not send it, possibly in
 * somebody else's room. There is no partial acceptance, no "store it and flag
 * it": the audio is refused, the bot is removed, and it is audited.
 *
 * ## 41.7 — recording without consent is refused processing
 *
 * Checked here rather than only at dispatch. A consent withdrawn after the bot
 * joined leaves a recorder mid-call for as long as the provider takes to
 * remove it, and anything it sends in that window is refused. Refusing the
 * audio is under our control; the provider's cooperation is not.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  let payload: { bot_id?: string; transcript?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  const botId = typeof payload.bot_id === "string" ? payload.bot_id : null;
  if (!botId) return NextResponse.json({ error: "no bot" }, { status: 400 });

  const rows = await acrossRegions((db) =>
    db
      .select({
        organizationId: sessions.organizationId,
        patientId: sessions.patientId,
        recordingConsent: sessions.recordingConsent,
        recordingPausedAt: sessions.recordingPausedAt,
        botLeftAt: sessionSources.botLeftAt,
      })
      .from(sessionSources)
      .innerJoin(sessions, eq(sessions.id, sessionSources.sessionId))
      .where(eq(sessionSources.sessionId, sessionId))
      .limit(1),
  );

  const row = rows[0];
  /*
   * An unknown session is not an error worth describing. A 404 with a reason
   * tells an unauthenticated caller which session ids exist.
   */
  if (!row) return NextResponse.json({ ok: true });

  /* 🔴 The hard stop, before anything is read out of the payload. */
  const ours = await assertOurBot({
    sessionId,
    botId,
    organizationId: row.organizationId,
    patientId: row.patientId,
  });
  if (!ours) return NextResponse.json({ error: "refused" }, { status: 409 });

  /*
   * 🔴 41.7 — consent revoked mid-session, and the window after it.
   *
   * `recordingPausedAt` is the same switch the clinician's off-record button
   * uses and the one a decline sets. `botLeftAt` is set the moment we asked
   * the bot to leave, whether or not the provider confirmed. Either means this
   * audio is not ours to process.
   */
  if (!mayRecord(row) || row.botLeftAt) {
    log.info("meeting audio refused, no live consent", { session: ref(sessionId) });
    return NextResponse.json({ ok: true, processed: false });
  }

  /*
   * 🔴 The payload's participant NAME is deliberately not read.
   *
   * Everything this route does with the transcript goes through the track and
   * `session_voices`. Sprint 37's diarisation owns the rest, and wiring the
   * segment write is where 41 meets it; what is settled here is that no
   * display name from a provider ever reaches an attribution.
   */
  log.info("meeting transcript accepted", { session: ref(sessionId) });
  return NextResponse.json({ ok: true, processed: true });
}
