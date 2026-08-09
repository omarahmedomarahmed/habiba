import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SessionRoom } from "@/components/session/session-room";
import { requireUser } from "@/lib/auth/guard";
import { markSessionNotificationsRead } from "@/lib/data/notifications";
import { getSession, getTranscript } from "@/lib/data/sessions";
import { env, features } from "@/lib/env";
import { fullName } from "@/lib/utils";
import { createMeetingToken } from "@/lib/video";

export const metadata: Metadata = { title: "Session", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  const { id } = await params;

  const row = await getSession(actor, id);
  if (!row) notFound();

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
  const therapistName = fullName(actor.firstName, actor.lastName, "Therapist");
  let videoUrl: string | null = null;
  let videoToken: string | null = null;
  if (row.session.modality === "video" && row.session.videoRoomUrl && row.session.videoRoomName) {
    videoToken = await createMeetingToken({
      roomName: row.session.videoRoomName,
      userName: therapistName,
      isOwner: true,
      minutes: 180,
    });
    videoUrl = row.session.videoRoomUrl;
  }

  const patientLabel =
    fullName(row.patient?.firstName, row.patient?.lastName, "") ||
    row.session.guestName ||
    "New patient";

  return (
    <SessionRoom
      sessionId={row.session.id}
      patientLabel={patientLabel}
      therapistName={therapistName}
      modality={row.session.modality}
      initialStatus={row.session.status}
      videoRoomUrl={videoUrl}
      videoToken={videoToken}
      videoConfigured={features.video}
      joinUrl={row.session.joinToken ? `${env.appUrl}/join/${row.session.joinToken}` : null}
      priceCents={row.session.priceCents}
      paymentStatus={row.session.paymentStatus}
      patientAlreadyJoined={Boolean(row.session.patientJoinedAt)}
      initialLines={transcript.map((segment) => ({
        id: segment.id,
        speaker: segment.speaker,
        text: segment.text,
      }))}
    />
  );
}
