import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SessionRoom } from "@/components/session/session-room";
import { requireUser } from "@/lib/auth/guard";
import { markSessionNotificationsRead } from "@/lib/data/notifications";
import { ensureRoom, getSession, getTranscript, unpaidInPerson } from "@/lib/data/sessions";
import { env, features } from "@/lib/env";
import { capSeconds } from "@/lib/session-clock";
import { getSettings } from "@/lib/settings";
import { fullName } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { createMeetingToken } from "@/lib/video";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.session"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  const { id } = await params;

  const row = await getSession(actor, id);
  if (!row) notFound();
  /* 🔴 Pay before start: an in-person session paid through us waits on its payment screen. */
  if (row.session.status === "scheduled" && unpaidInPerson(row.session)) redirect(`/sessions/${id}/collect`);

  // A finished session has a note, not a room.
  if (row.session.status === "completed" || row.session.status === "cancelled") {
    redirect(`/sessions/${id}`);
  }

  const transcript = await getTranscript(actor, id);

  // A radar booking sends the clinician straight here; the alarm banner has
  // been answered, so clear the notification behind it.
  await markSessionNotificationsRead(actor, id);

  // Private Daily rooms cannot be entered without a per-participant token, and
  // the clinician's is minted server-side and never leaves this render.
  const { t } = await getI18n();
  const therapistName = fullName(actor.firstName, actor.lastName, t("portal.session.therapist"));
  let videoUrl: string | null = null;
  let videoToken: string | null = null;
  /*
   * 🔴 79.1 — BUILD THE ROOM IF IT IS NOT THERE.
   *
   * This read `videoRoomUrl && videoRoomName` and silently rendered a black box
   * when either was null, which is what every session created before 79.1 does,
   * and what any session whose four-hour room has expired does. The clinician
   * sat in front of "Setting up the room…" that was never going to finish.
   */
  const built = await ensureRoom(row.session);
  if (built.ok) {
    videoToken = await createMeetingToken({
      roomName: built.name,
      userName: therapistName,
      isOwner: true,
      /*
       * Comfortably past the cap, and no further.
       *
       * It was three hours, chosen when nothing bounded a session. A meeting
       * token that outlives the session's own hard stop by two hours is a key to a
       * room that should already be gone — and the room *is* deleted when the
       * session ends, so this only matters when something has gone wrong,
       * which is exactly when a shorter key is worth having.
       */
      minutes: capSeconds((await getSettings()).clock) / 60 + 15,
    });
    videoUrl = built.url;
  }

  const patientLabel =
    fullName(row.patient?.firstName, row.patient?.lastName, "") ||
    row.session.guestName ||
    t("portal.session.newPatient");

  return (
    <SessionRoom
      sessionId={row.session.id}
      /*
       * 48.1 — the copilot panel is per PATIENT, because the record it reads
       * is the patient's. Null for a guest session with no chart, where there
       * is nothing to ask about and the panel does not render.
       */
      patientId={row.session.patientId}
      patientLabel={patientLabel}
      therapistName={therapistName}
      modality={row.session.modality}
      initialStatus={row.session.status}
      startedAt={row.session.startedAt?.toISOString() ?? null}
      /*
       * 🔴 The instant THIS render happened, so the room's clock hydrates
       * without a mismatch. `components/session/session-room.tsx` carries the
       * argument: one differing text node threw React #418, which remounted
       * the room and destroyed the live call object under the clinician.
       *
       * Safe because this route is `force-dynamic`: the value is computed per
       * request rather than baked into a build.
       */
      serverNow={Date.now()}
      clockLimits={(await getSettings()).clock}
      videoRoomUrl={videoUrl}
      videoToken={videoToken}
      videoConfigured={features.video}
      joinUrl={row.session.joinToken ? `${env.appUrl}/join/${row.session.joinToken}` : null}
      priceCents={row.session.priceCents}
      paymentStatus={row.session.paymentStatus}
      patientAlreadyJoined={Boolean(row.session.patientJoinedAt)}
      /*
        Whether the patient agreed to be recorded.
        ----------------------------------------
        Passed because a refusal the clinician cannot see is worse than
        never having asked: it produces a record saying we knew, next to a
        recording made anyway.
      */
      recordingConsent={row.session.recordingConsent}
      transcriptLanguage={row.session.transcriptLanguage}
      initialLines={transcript.map((segment) => ({
        id: segment.id,
        speaker: segment.speaker,
        text: segment.text,
      }))}
    />
  );
}
