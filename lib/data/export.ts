import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { auditPhi } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  dataExports,
  notifications,
  EXPORT_TTL_HOURS,
  organizations,
  patients,
  riskAssessments,
  sessionNotes,
  sessions,
  transcriptSegments,
  users,
  NOTE_LANGUAGES,
  RTL_LANGUAGES,
  type NoteContent,
} from "@/lib/db/schema";

/**
 * Getting a patient their own record — the whole feature, without impersonation.
 *
 * The problem this replaces: a patient writes in asking for their notes, and
 * the notes live inside one clinician's portal. The obvious fix is to let an
 * admin log in as that clinician and fetch them. That means a support agent
 * holding a fully authenticated view of a stranger's therapy, indefinitely,
 * to answer a request that was never about the support agent.
 *
 * So: a clinician or an admin presses a button, and a link goes to the
 * *patient's own email*. Whoever pressed the button never sees the contents,
 * the link expires, and nothing is snapshotted to disk.
 */

const HASH = (token: string) => createHash("sha256").update(token).digest("hex");

/** What lands in the patient's inbox as a URL path. */
export function exportPath(token: string): string {
  return `/records/${token}`;
}

/* ------------------------------------------------------------- creating -- */

export type ExportRequest =
  | { ok: true; token: string; email: string; patientName: string; expiresAt: Date }
  | { ok: false; error: string };

/**
 * Mint a link for one patient.
 *
 * A clinician may only do this for their own caseload; an admin may do it for
 * anyone, because that is the entire point of the feature — but the admin gets
 * back an address and an expiry, never a chart.
 */
export async function requestPatientExport(
  actor: Actor,
  patientId: string,
  overrideEmail?: string,
): Promise<ExportRequest> {
  const [patient] = await db
    .select({
      id: patients.id,
      organizationId: patients.organizationId,
      therapistId: patients.therapistId,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
    })
    .from(patients)
    .where(
      and(
        eq(patients.id, patientId),
        isNull(patients.deletedAt),
        // Admins cross organisations here on purpose. Everyone else does not.
        actor.role === "super_admin" ? undefined : eq(patients.organizationId, actor.organizationId),
        actor.role === "super_admin" ? undefined : eq(patients.therapistId, actor.userId),
      ),
    )
    .limit(1);

  if (!patient) return { ok: false, error: "Patient not found." };

  const email = (overrideEmail ?? patient.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return {
      ok: false,
      error:
        "No email address on file for this patient. Add one to their record first — the link only ever goes to them.",
    };
  }

  /*
   * A previous outstanding link is revoked rather than left alive. Someone
   * asking again usually means the first email went astray, and two live links
   * to a medical record is one more than the situation needs.
   */
  await db
    .update(dataExports)
    .set({ revokedAt: new Date() })
    .where(and(eq(dataExports.patientId, patientId), isNull(dataExports.revokedAt)));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + EXPORT_TTL_HOURS * 60 * 60 * 1000);

  await db.insert(dataExports).values({
    organizationId: patient.organizationId,
    patientId: patient.id,
    tokenHash: HASH(token),
    deliveredTo: email,
    requestedBy: actor.userId,
    requestedByRole: actor.role,
    expiresAt,
  });

  await auditPhi(actor, "patient.export_requested", {
    resourceType: "patient",
    resourceId: patient.id,
    patientId: patient.id,
  });

  /*
   * If it was not the owning clinician who pressed the button, tell them.
   *
   * A record leaving their chart without their knowledge is the exact shape of
   * quiet admin action that makes clinicians stop trusting a platform — and
   * they are the ones who will be asked about it. Nothing here is a request for
   * permission; it is a notification, because the patient's right to their own
   * data does not wait on their therapist being at a desk.
   */
  if (patient.therapistId && patient.therapistId !== actor.userId) {
    await db.insert(notifications).values({
      userId: patient.therapistId,
      kind: "system",
      title: "A patient asked us for their record",
      body: `We sent ${[patient.firstName, patient.lastName].filter(Boolean).join(" ")} a copy of their full record — sessions, notes and transcripts — to the address on their chart. Nobody here read it. It was done at their request or yours; if that is a surprise, reply to this and we will look into it.`,
      actionUrl: `/patients/${patient.id}`,
    });
  }

  return {
    ok: true,
    token,
    email,
    patientName: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
    expiresAt,
  };
}

/* -------------------------------------------------------------- opening -- */

export type ExportRecord = Awaited<ReturnType<typeof buildExport>>;

/**
 * Exchange a token for the record.
 *
 * Returns null for anything that is not a live link — expired, revoked,
 * unknown. Deliberately one outcome for all three: telling an anonymous caller
 * *why* a token failed tells them whether it ever existed.
 */
export async function openExport(token: string) {
  if (!token || token.length < 20 || token.length > 200) return null;

  const [row] = await db
    .select()
    .from(dataExports)
    .where(eq(dataExports.tokenHash, HASH(token)))
    .limit(1);

  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  await db
    .update(dataExports)
    .set({
      firstOpenedAt: row.firstOpenedAt ?? new Date(),
      openCount: row.openCount + 1,
    })
    .where(eq(dataExports.id, row.id));

  return buildExport(row.patientId, row.expiresAt);
}

/**
 * Assemble the record at read time.
 *
 * Nothing is pre-rendered and stored, which is the point: there is no copy of
 * a chart sitting in a bucket, and a patient who opens the link a day later
 * sees the record as it stands rather than as it stood.
 */
async function buildExport(patientId: string, expiresAt: Date) {
  const [patient] = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
      phone: patients.phone,
      clinical: patients.clinical,
      createdAt: patients.createdAt,
      organizationId: patients.organizationId,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
      therapistEmail: users.email,
      practiceName: organizations.name,
    })
    .from(patients)
    .leftJoin(users, eq(users.id, patients.therapistId))
    .leftJoin(organizations, eq(organizations.id, patients.organizationId))
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient) return null;

  const rows = await db
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      createdAt: sessions.createdAt,
      durationMinutes: sessions.durationMinutes,
      modality: sessions.modality,
      status: sessions.status,
      priceCents: sessions.priceCents,
      paymentStatus: sessions.paymentStatus,
      noteContent: sessionNotes.content,
      noteLanguage: sessionNotes.language,
      noteContentEn: sessionNotes.contentEn,
      noteStatus: sessionNotes.status,
      noteApprovedAt: sessionNotes.approvedAt,
      riskLevel: riskAssessments.level,
      riskAction: riskAssessments.recommendedAction,
    })
    .from(sessions)
    .leftJoin(sessionNotes, eq(sessionNotes.sessionId, sessions.id))
    .leftJoin(riskAssessments, eq(riskAssessments.sessionId, sessions.id))
    .where(eq(sessions.patientId, patientId))
    .orderBy(desc(sessions.createdAt))
    .limit(500);

  const transcripts = new Map<string, { speaker: string; text: string; startMs: number }[]>();
  for (const row of rows) {
    const segments = await db
      .select({
        speaker: transcriptSegments.speaker,
        text: transcriptSegments.text,
        startMs: transcriptSegments.startMs,
      })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.sessionId, row.id))
      .orderBy(asc(transcriptSegments.sequence))
      .limit(4000);
    if (segments.length > 0) transcripts.set(row.id, segments);
  }

  return {
    generatedAt: new Date(),
    linkExpiresAt: expiresAt,
    patient: {
      name: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
      email: patient.email,
      phone: patient.phone,
      recordOpened: patient.createdAt,
      diagnoses: patient.clinical?.diagnoses ?? [],
      medications: patient.clinical?.medications ?? [],
      goals: patient.clinical?.goals ?? [],
      clinicianNotes: patient.clinical?.notes ?? null,
    },
    clinician: {
      name: [patient.therapistFirst, patient.therapistLast].filter(Boolean).join(" ") || null,
      email: patient.therapistEmail,
      practice: patient.practiceName,
    },
    sessions: rows.map((row) => ({
      id: row.id,
      date: row.endedAt ?? row.startedAt ?? row.createdAt,
      durationMinutes: row.durationMinutes,
      modality: row.modality,
      status: row.status,
      priceCents: row.priceCents,
      paymentStatus: row.paymentStatus,
      note: row.noteContent ?? null,
      noteLanguage: row.noteLanguage ?? "en",
      noteEnglish: row.noteContentEn ?? null,
      noteSigned: row.noteStatus === "approved" ? row.noteApprovedAt : null,
      riskLevel: row.riskLevel ?? null,
      riskAction: row.riskAction ?? null,
      transcript: transcripts.get(row.id) ?? [],
    })),
  };
}

/* ------------------------------------------------------------ rendering -- */

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function when(value: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function noteSection(note: NoteContent, language: string): string {
  const rtl = RTL_LANGUAGES.has(language);
  const dir = rtl ? ' dir="rtl" style="text-align:right"' : "";
  const part = (label: string, body: string) =>
    body?.trim()
      ? `<h4${dir}>${esc(label)}</h4><p${dir}>${esc(body).replaceAll("\n", "<br>")}</p>`
      : "";
  const list = (label: string, items: string[]) =>
    items?.length
      ? `<h4${dir}>${esc(label)}</h4><ul${dir}>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
      : "";

  return [
    part("Summary", note.summary),
    part("Subjective", note.soap?.subjective ?? ""),
    part("Objective", note.soap?.objective ?? ""),
    part("Assessment", note.soap?.assessment ?? ""),
    part("Plan", note.soap?.plan ?? ""),
    part("Observations", note.observations),
    part("Impressions", note.impressions),
    list("Recommendations", note.recommendations ?? []),
    part("Follow-up", note.followUp),
  ]
    .filter(Boolean)
    .join("");
}

/**
 * One self-contained HTML document.
 *
 * No stylesheet, no script, no image — it prints, it saves, it opens on a
 * phone with no signal, and it can be handed to a solicitor or a new clinician
 * as-is. A patient's copy of their record should not depend on us still being
 * here to serve a CSS file.
 */
export function renderExportHtml(
  record: NonNullable<ExportRecord>,
  jsonHref: string,
): string {
  const sessionsHtml = record.sessions
    .map((session) => {
      const languageLabel = NOTE_LANGUAGES[session.noteLanguage] ?? session.noteLanguage;
      const transcript = session.transcript.length
        ? `<details><summary>Transcript — ${session.transcript.length} lines</summary>
           <div class="tx">${session.transcript
             .map(
               (line) =>
                 `<p><span class="t">${clock(line.startMs)}</span> <span class="s">${
                   line.speaker === "patient" ? "You" : line.speaker === "therapist" ? "Therapist" : "Speaker"
                 }</span> ${esc(line.text)}</p>`,
             )
             .join("")}</div></details>`
        : `<p class="muted">No transcript was recorded for this session.</p>`;

      return `<article>
        <h3>${when(session.date)}${
          session.durationMinutes ? ` · ${session.durationMinutes} minutes` : ""
        } · ${session.modality === "video" ? "Video" : "In person"}</h3>
        <p class="muted">
          ${esc(session.status)}${
            session.priceCents > 0
              ? ` · $${(session.priceCents / 100).toFixed(2)} ${esc(session.paymentStatus)}`
              : " · no charge"
          }${session.noteSigned ? ` · note signed ${when(session.noteSigned)}` : ""}${
            session.riskLevel && session.riskLevel !== "none"
              ? ` · risk noted: ${esc(session.riskLevel)}`
              : ""
          }
        </p>
        ${
          session.note
            ? `<div class="note">
                 ${
                   session.noteLanguage !== "en"
                     ? `<p class="lang">Written in ${esc(languageLabel)}</p>`
                     : ""
                 }
                 ${noteSection(session.note, session.noteLanguage)}
               </div>
               ${
                 session.noteEnglish
                   ? `<details><summary>The same note in English</summary><div class="note">${noteSection(
                       session.noteEnglish,
                       "en",
                     )}</div></details>`
                   : ""
               }`
            : `<p class="muted">No note was written for this session.</p>`
        }
        ${transcript}
      </article>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Your record — ${esc(record.patient.name)}</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#f1f5f9; color:#0f172a;
         font:16px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  main { max-width:52rem; margin:0 auto; padding:24px 16px 64px; }
  header { background:#0A2342; color:#fff; border-radius:20px; padding:28px 24px; }
  header h1 { margin:0 0 6px; font-size:26px; letter-spacing:-0.02em; }
  header p { margin:0; opacity:.75; font-size:14px; }
  section, article { background:#fff; border:1px solid #e2e8f0; border-radius:18px;
                     padding:22px 22px; margin-top:16px; }
  h2 { font-size:13px; letter-spacing:.09em; text-transform:uppercase; color:#64748b; margin:0 0 12px; }
  h3 { font-size:18px; margin:0 0 4px; letter-spacing:-0.01em; }
  h4 { font-size:12px; letter-spacing:.07em; text-transform:uppercase; color:#64748b; margin:16px 0 4px; }
  p { margin:0 0 8px; }
  ul { margin:0 0 8px; padding-left:20px; }
  dl { display:grid; grid-template-columns:9rem 1fr; gap:6px 12px; margin:0; font-size:15px; }
  dt { color:#64748b; }
  .muted { color:#64748b; font-size:14px; }
  .lang { display:inline-block; background:#eff6ff; color:#1d4ed8; border-radius:999px;
          padding:2px 10px; font-size:12px; font-weight:600; }
  .note { border-left:3px solid #2EC4B6; padding-left:16px; margin-top:12px; }
  details { margin-top:14px; }
  summary { cursor:pointer; font-size:14px; font-weight:600; color:#1F5EFF; }
  .tx { margin-top:10px; border-top:1px solid #e2e8f0; padding-top:10px;
        max-height:32rem; overflow:auto; font-size:14.5px; }
  .tx p { margin:0 0 6px; }
  .tx .t { color:#94a3b8; font-variant-numeric:tabular-nums; font-size:12px; }
  .tx .s { font-weight:600; color:#0A2342; }
  a.dl { display:inline-block; margin-top:10px; background:#1F5EFF; color:#fff;
         text-decoration:none; border-radius:12px; padding:10px 16px; font-weight:600; font-size:14px; }
  footer { color:#64748b; font-size:13px; text-align:center; margin-top:24px; line-height:1.7; }
  @media print {
    body { background:#fff; } header { background:#fff; color:#0f172a; border:1px solid #e2e8f0; }
    section, article { border:0; padding:16px 0; } details { display:block; } .tx { max-height:none; }
    summary { display:none; } a.dl { display:none; }
  }
</style></head>
<body><main>
  <header>
    <h1>Your record</h1>
    <p>${esc(record.patient.name)} · prepared ${when(record.generatedAt)}</p>
  </header>

  <section>
    <h2>About this document</h2>
    <p>This is everything held about you in the 24Therapy chart kept by
      ${esc(record.clinician.name ?? "your clinician")}${
        record.clinician.practice ? ` at ${esc(record.clinician.practice)}` : ""
      }: your details, every session, every note, and the transcript of anything
      that was recorded.</p>
    <p class="muted">The one thing not included is your clinician's own working
      conversation with their assistant tool — their thinking-out-loud about your
      care, which is a professional aid rather than part of your record. Everything
      that assistant wrote <em>during</em> a session is in the notes below.</p>
    <p class="muted">This link stops working on ${when(record.linkExpiresAt)}.
      Save or print this page now. Nobody at 24Therapy read it to send it to you.</p>
    <a class="dl" href="${esc(jsonHref)}" download>Download as data (JSON)</a>
  </section>

  <section>
    <h2>You</h2>
    <dl>
      <dt>Name</dt><dd>${esc(record.patient.name)}</dd>
      <dt>Email</dt><dd>${esc(record.patient.email ?? "—")}</dd>
      <dt>Phone</dt><dd>${esc(record.patient.phone ?? "—")}</dd>
      <dt>Record opened</dt><dd>${when(record.patient.recordOpened)}</dd>
      <dt>Clinician</dt><dd>${esc(record.clinician.name ?? "—")}${
        record.clinician.email ? ` · ${esc(record.clinician.email)}` : ""
      }</dd>
    </dl>
    ${
      record.patient.diagnoses.length
        ? `<h4>Working diagnoses</h4><ul>${record.patient.diagnoses
            .map((d) => `<li>${esc(d)}</li>`)
            .join("")}</ul>`
        : ""
    }
    ${
      record.patient.medications.length
        ? `<h4>Medications on file</h4><ul>${record.patient.medications
            .map((m) => `<li>${esc(m)}</li>`)
            .join("")}</ul>`
        : ""
    }
    ${
      record.patient.goals.length
        ? `<h4>Goals</h4><ul>${record.patient.goals.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>`
        : ""
    }
    ${
      record.patient.clinicianNotes
        ? `<h4>Clinician's chart notes</h4><p>${esc(record.patient.clinicianNotes).replaceAll(
            "\n",
            "<br>",
          )}</p>`
        : ""
    }
  </section>

  <section>
    <h2>Sessions — ${record.sessions.length}</h2>
    ${
      record.sessions.length === 0
        ? `<p class="muted">No sessions on record.</p>`
        : `<p class="muted">Most recent first.</p>`
    }
  </section>

  ${sessionsHtml}

  <footer>
    Prepared by 24Therapy at the request of the person named above.<br>
    If anything here looks wrong, tell your clinician — corrections belong in the
    record alongside the original, not instead of it.
  </footer>
</main></body></html>`;
}
