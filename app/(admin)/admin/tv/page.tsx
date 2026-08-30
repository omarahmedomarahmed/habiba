import type { Metadata } from "next";

import { TotalView } from "@/components/admin/total-view";
import { Gate } from "@/components/admin/gate";
import { requireRole } from "@/lib/auth/guard";
import { elevated, keyState } from "@/lib/console/gate";
import {
  auditStream,
  clinicianRoster,
  conversationFor,
  counts,
  liveSessions,
  peopleByEmail,
  radarNow,
  sessionDetail,
  sessionsFor,
  timeline,
} from "@/lib/console/reads";

export const metadata: Metadata = {
  title: "Total View",
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; person?: string; session?: string; hours?: string }>;
}) {
  await requireRole("super_admin");
  const params = await searchParams;

  const state = await elevated();
  if (!state) return <Gate configured={await keyState()} />;

  const hours = Math.min(720, Math.max(1, Number(params.hours) || 24));

  const [now, live, radar, events, people, roster, audits] = await Promise.all([
    counts(),
    liveSessions(),
    radarNow(),
    timeline({ sinceHours: hours }),
    peopleByEmail(params.q),
    clinicianRoster(),
    auditStream(120),
  ]);

  const person = params.person ? people.find((p) => p.key === params.person) : undefined;
  const [conversation, personSessions, detail] = await Promise.all([
    person ? conversationFor(person.patientIds) : Promise.resolve([]),
    person ? sessionsFor(person.patientIds) : Promise.resolve([]),
    params.session ? sessionDetail(params.session) : Promise.resolve(null),
  ]);

  return (
    <TotalView
      until={state.until.toISOString()}
      hours={hours}
      query={params.q ?? ""}
      counts={now}
      live={live.map((row) => ({
        id: row.id,
        startedAt: row.startedAt?.toISOString() ?? null,
        extended: Boolean(row.extendedAt),
        modality: row.modality,
        person:
          [row.patientFirstName, row.patientLastName].filter(Boolean).join(" ") ||
          row.guestName ||
          "—",
        personEmail: row.patientEmail ?? row.guestEmail,
        clinician: [row.therapistFirstName, row.therapistLastName].filter(Boolean).join(" "),
        clinicianEmail: row.therapistEmail,
        recording: !row.recordingPausedAt,
        segments: row.segments,
        lastActivityAt: row.lastActivityAt ? new Date(row.lastActivityAt).toISOString() : null,
      }))}
      radar={radar.map((row) => ({
        userId: row.userId,
        name: [row.firstName, row.lastName].filter(Boolean).join(" "),
        email: row.email,
        status: row.status,
        where: [row.city, row.country].filter(Boolean).join(", "),
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
        suspended: Boolean(row.suspendedUntil && row.suspendedUntil > new Date()),
        rateCents: row.rateCents,
        demo: row.demo,
      }))}
      events={events.map((event) => ({
        at: event.at.toISOString(),
        kind: event.kind,
        who: event.who,
        what: event.what,
        ref: event.ref,
      }))}
      people={people.map((p) => ({
        key: p.key,
        email: p.email,
        names: p.names,
        therapists: p.therapists,
        sessionCount: p.sessionCount,
        messageCount: p.messageCount,
        patientIds: p.patientIds,
      }))}
      selectedPerson={person?.key ?? null}
      conversation={conversation.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        at: m.createdAt.toISOString(),
        clinician: [m.therapistFirstName, m.therapistLastName].filter(Boolean).join(" "),
      }))}
      personSessions={personSessions.map((s) => ({
        id: s.id,
        status: s.status,
        modality: s.modality,
        startedAt: s.startedAt?.toISOString() ?? null,
        durationMinutes: s.durationMinutes,
        autoEndedReason: s.autoEndedReason,
        clinician: [s.therapistFirstName, s.therapistLastName].filter(Boolean).join(" "),
        noteStatus: s.noteStatus,
        patientStatus: s.patientStatus,
        summary: s.summary,
      }))}
      roster={roster.map((r) => ({
        id: r.id,
        name: [r.firstName, r.lastName].filter(Boolean).join(" "),
        email: r.email,
        status: r.status,
        verificationStatus: r.verificationStatus,
        sessionCount: r.sessionCount,
        patientCount: r.patientCount,
        lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
      }))}
      audits={audits.map((a) => ({
        id: a.id,
        at: a.createdAt.toISOString(),
        category: a.category,
        action: a.action,
        who: [a.actorFirstName, a.actorLastName].filter(Boolean).join(" ") || a.actorEmail || "—",
        reason: a.reason,
      }))}
      detail={
        detail
          ? {
              id: detail.session.id,
              clinician: [detail.therapistFirstName, detail.therapistLastName]
                .filter(Boolean)
                .join(" "),
              person:
                [detail.patientFirstName, detail.patientLastName].filter(Boolean).join(" ") ||
                detail.session.guestName ||
                "—",
              startedAt: detail.session.startedAt?.toISOString() ?? null,
              endedAt: detail.session.endedAt?.toISOString() ?? null,
              durationMinutes: detail.session.durationMinutes,
              consent: detail.session.recordingConsent,
              note: detail.note?.content ?? null,
              noteStatus: detail.note?.status ?? null,
              patientStatus: detail.note?.patientStatus ?? null,
              transcript: detail.transcript.map((t) => ({
                id: String(t.id),
                speaker: String(t.speaker),
                text: String(t.text),
              })),
              risks: detail.risks.map((r) => ({
                id: r.id,
                level: r.level,
                detail: r.recommendedAction ?? r.indicators.join(', '),
                at: r.createdAt.toISOString(),
              })),
            }
          : null
      }
    />
  );
}
