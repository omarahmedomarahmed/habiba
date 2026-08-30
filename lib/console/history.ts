import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { patients, sessionNotes, sessions, users } from "@/lib/db/schema";
import { fullName } from "@/lib/utils";

/**
 * One clinician's session and note history, as a CSV.
 *
 * Structured columns rather than prose: the recipient of a records request
 * needs to filter and sort, and a wall of formatted text is the least useful
 * shape to hand them.
 *
 * Transcripts are deliberately not included. A session transcript is the
 * patient's speech, not the clinician's record, and a request about a clinician
 * is not a warrant for everything every one of their patients said. If those
 * are needed they are a separate, narrower request against named sessions.
 */
export async function buildClinicianHistory(therapistId: string): Promise<{
  clinicianName: string;
  csv: string;
  summary: string;
} | null> {
  const [clinician] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      createdAt: users.createdAt,
      verificationStatus: users.verificationStatus,
    })
    .from(users)
    .where(eq(users.id, therapistId))
    .limit(1);

  if (!clinician) return null;

  const rows = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      durationMinutes: sessions.durationMinutes,
      autoEndedReason: sessions.autoEndedReason,
      status: sessions.status,
      modality: sessions.modality,
      priceCents: sessions.priceCents,
      paymentStatus: sessions.paymentStatus,
      recordingConsent: sessions.recordingConsent,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientEmail: patients.email,
      guestName: sessions.guestName,
      guestEmail: sessions.guestEmail,
      noteStatus: sessionNotes.status,
      noteApprovedAt: sessionNotes.approvedAt,
      patientNoteStatus: sessionNotes.patientStatus,
      patientNoteApprovedAt: sessionNotes.patientApprovedAt,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .leftJoin(sessionNotes, eq(sessionNotes.sessionId, sessions.id))
    .where(eq(sessions.therapistId, therapistId))
    .orderBy(desc(sessions.createdAt))
    .limit(5000);

  const header = [
    "session_id",
    "created_at",
    "started_at",
    "ended_at",
    "duration_minutes",
    "ended_automatically",
    "status",
    "modality",
    "price_usd",
    "payment_status",
    "recording_consent",
    "patient_name",
    "patient_email",
    "clinical_note_status",
    "clinical_note_signed_at",
    "patient_summary_status",
    "patient_summary_released_at",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        iso(row.createdAt),
        iso(row.startedAt),
        iso(row.endedAt),
        row.durationMinutes ?? "",
        row.autoEndedReason ?? "",
        row.status,
        row.modality,
        (row.priceCents / 100).toFixed(2),
        row.paymentStatus,
        row.recordingConsent ?? "",
        fullName(row.patientFirstName, row.patientLastName, "") || row.guestName || "",
        row.patientEmail ?? row.guestEmail ?? "",
        row.noteStatus ?? "",
        iso(row.noteApprovedAt),
        row.patientNoteStatus ?? "",
        iso(row.patientNoteApprovedAt),
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const completed = rows.filter((r) => r.status === "completed").length;
  const name = fullName(clinician.firstName, clinician.lastName, clinician.email);

  return {
    clinicianName: name,
    csv: lines.join("\n"),
    summary: [
      `${name} (${clinician.email}), account opened ${clinician.createdAt.toISOString().slice(0, 10)}, licence status: ${clinician.verificationStatus}.`,
      `${rows.length} sessions on record, ${completed} completed.`,
      "One row per session. Transcripts are not included.",
    ].join(" "),
  };
}

function iso(value: Date | null): string {
  return value ? value.toISOString() : "";
}

/**
 * A field a spreadsheet will read back as text.
 *
 * The leading apostrophe on `=`, `+`, `-` and `@` is not decoration: a cell
 * beginning with one of those is executed as a formula by Excel and Sheets, so
 * a name typed as `=cmd|...` in a patient record would become a payload the
 * moment somebody opened the attachment.
 */
function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}
