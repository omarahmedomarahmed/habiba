import type { Metadata } from "next";

import { Board } from "@/components/admin/board";
import { TotalView } from "@/components/admin/total-view";
import { Gate } from "@/components/admin/gate";
import { requireManager } from "@/lib/auth/guard";
import { elevated, keyState } from "@/lib/console/gate";
import {
  auditStream,
  clinicianRoster,
  counts,
  liveSessions,
  peopleByEmail,
  radarNow,
  timeline,
} from "@/lib/console/reads";
import { wholeBoard } from "@/lib/console/board";

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
  await requireManager();
  const params = await searchParams;

  const state = await elevated();
  if (!state) return <Gate configured={await keyState()} />;

  const hours = Math.min(720, Math.max(1, Number(params.hours) || 24));

  const [board, now, live, radar, events, people, roster, audits] = await Promise.all([
    /*
     * 🔴 76.1 — THE BUSINESS BOARD, above the live console.
     *
     * The console below answers "what is going on right now" and reaches
     * clinical rows, which is why the whole page is behind the elevation gate.
     * This answers "how is the business doing", reads nothing clinical, and is
     * what a founder actually opens this page for on an ordinary Tuesday.
     */
    wholeBoard(),
    counts(),
    liveSessions(),
    radarNow(),
    timeline({ sinceHours: hours }),
    peopleByEmail(params.q),
    clinicianRoster(),
    auditStream(120),
  ]);

  /*
   * W1-14: a person's sessions and copilot conversation, and a session's
   * transcript, note and risks, are NOT read here. The screen asks for a reason
   * first and fetches them through `openPerson` and `openSession`, which write
   * a `phi_access` row before returning. A read made while rendering is a read
   * nobody gave a reason for, repeated on every refresh.
   */
  const person = params.person ? people.find((p) => p.key === params.person) : undefined;

  return (
    <div className="space-y-6">
      <Board initial={board} />
      <TotalView
      until={state.until.toISOString()}
      hours={hours}
      query={params.q ?? ""}
      counts={now}
      live={live.map((row) => ({
        id: row.id,
        startedAt: row.startedAt?.toISOString() ?? null,
        modality: row.modality,
        person:
          [row.patientFirstName, row.patientLastName].filter(Boolean).join(" ") ||
          row.guestName ||
          "-",
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
        sessionRateCents: row.sessionRateCents,
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
        who: [a.actorFirstName, a.actorLastName].filter(Boolean).join(" ") || a.actorEmail || "-",
        reason: a.reason,
      }))}
      session={params.session ?? null}
    />
    </div>
  );
}
