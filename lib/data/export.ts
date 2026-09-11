import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { audit, auditPhi } from "@/lib/audit";
import { log, safeErrorMessage } from "@/lib/logger";
import { personIdForPatient } from "@/lib/data/people";
import { env } from "@/lib/env";
import type { Actor } from "@/lib/auth/session";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  dataExports,
  notifications,
  EXPORT_TTL_HOURS,
  organizations,
  patients,
  riskAssessments,
  sessionNotes,
  therapistVerifications,
  sessions,
  transcriptSegments,
  users,
  NOTE_LANGUAGES,
  RTL_LANGUAGES,
  type NoteContent,
} from "@/lib/db/schema";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/data/export.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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

/**
 * 26.9 / C127 — the code a third party can check.
 *
 * Twelve unambiguous characters in three groups, because it is read off a
 * printed cover page and typed into a public form, sometimes by a solicitor's
 * assistant. Same alphabet as the wall code: no O, no 0, no I, no 1.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function mintVerificationCode(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i += 1) {
    if (i > 0 && i % 4 === 0) out += "-";
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

/** What lands in the patient's inbox as a URL path. */
export function exportPath(token: string): string {
  return `/records/${token}`;
}

/* ------------------------------------------------------------- creating -- */

export type ExportRequest =
  | {
      ok: true;
      token: string;
      email: string;
      patientName: string;
      expiresAt: Date;
      /** 26.9 / C127 — printed on the cover page, checkable on a public page. */
      verificationCode: string;
    }
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

  /*
   * A cap on how often one patient's inbox can be sent their own record.
   *
   * Not a security boundary — everyone who can press this button can already
   * read the chart. It is there so that a stuck button, or a clinician
   * clicking twice while nothing appears to happen, does not put six copies of
   * a medical record into somebody's email.
   */
  const { consume, subjectKey } = await import("@/lib/rate-limit");
  const allowed = await consume(subjectKey("patient:export", patient.id), 4, 3600);
  if (!allowed.allowed) {
    return {
      ok: false,
      error: "That record has already been sent several times in the last hour. Try again later.",
    };
  }

  const email = (overrideEmail ?? patient.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return {
      ok: false,
      error:
        "No email address on file for this patient. Add one to their record first, the link only ever goes to them.",
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

  const personId = await personIdForPatient(patient.id);
  const verificationCode = mintVerificationCode();

  await db.insert(dataExports).values({
    organizationId: patient.organizationId,
    patientId: patient.id,
    personId,
    tokenHash: HASH(token),
    verificationCode,
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
      body: `We sent ${[patient.firstName, patient.lastName].filter(Boolean).join(" ")} a copy of their full record, sessions, notes and transcripts, to the address on their chart. Nobody here read it. It was done at their request or yours; if that is a surprise, reply to this and we will look into it.`,
      actionUrl: `/patients/${patient.id}`,
    });
  }

  /*
   * 🔴 26.10 — every export raises an admin alert.
   *
   * Not a permission and not a delay: the link has already been sent. It is a
   * record leaving the platform, and the one thing an operator must never
   * learn about from a subpoena is that a full chart went to an inbox and
   * nobody here knew. The alert names nothing clinical.
   */
  await alertStaffOfExport({
    patientName: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
    to: email,
    byRole: actor.role,
    code: verificationCode,
  }).catch((error) => {
    log.error("export admin alert failed", { reason: safeErrorMessage(error) });
  });

  return {
    ok: true,
    token,
    email,
    patientName: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
    expiresAt,
    verificationCode,
  };
}

/** 26.10 — the operators, told. No diagnosis, no note, no transcript. */
async function alertStaffOfExport(input: {
  patientName: string;
  to: string;
  byRole: string;
  code: string;
}): Promise<void> {
  const staff = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "super_admin"))
    .limit(10);

  if (staff.length === 0) return;

  await db.insert(notifications).values(
    staff.map((person) => ({
      userId: person.id,
      kind: "system" as const,
      title: "A full record extract left the platform",
      body: `A record extract for ${input.patientName} was sent to ${input.to}, requested by a ${input.byRole}. Extract code ${input.code}. Nobody here read it. This is a notice, not a request.`,
      actionUrl: `/admin`,
    })),
  );
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

  return buildExport(row.patientId, row.expiresAt, {
    personId: row.personId,
    verificationCode: row.verificationCode,
  });
}

/**
 * Assemble the record at read time.
 *
 * Nothing is pre-rendered and stored, which is the point: there is no copy of
 * a chart sitting in a bucket, and a patient who opens the link a day later
 * sees the record as it stands rather than as it stood.
 */
async function buildExport(
  patientId: string,
  expiresAt: Date,
  extra: { personId: string | null; verificationCode: string | null } = {
    personId: null,
    verificationCode: null,
  },
) {
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

  /*
   * 🔴 26.9 — every session, not one clinic's sessions.
   *
   * The extract is the record of somebody's therapy, and somebody who moved
   * practice has two `patients` rows. Scoping to the row the link was minted
   * against would hand a person half their own life and call it complete,
   * which is exactly the failure the person layer exists to prevent.
   *
   * Falls back to the single row when there is no person yet, which is a
   * record created before sprint 5 rather than an error.
   */
  const chartIds = extra.personId
    ? (
        await db
          .select({ id: patients.id })
          .from(patients)
          .where(eq(patients.personId, extra.personId))
      ).map((row) => row.id)
    : [patientId];

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
      noteApprovedBy: sessionNotes.approvedBy,
      sessionTherapistId: sessions.therapistId,
      riskLevel: riskAssessments.level,
      riskAction: riskAssessments.recommendedAction,
    })
    .from(sessions)
    .leftJoin(sessionNotes, eq(sessionNotes.sessionId, sessions.id))
    .leftJoin(riskAssessments, eq(riskAssessments.sessionId, sessions.id))
    .where(inArray(sessions.patientId, chartIds.length > 0 ? chartIds : [patientId]))
    .orderBy(desc(sessions.createdAt))
    .limit(500);

  /*
   * Every transcript in one query, not one query per session.
   *
   * A patient with fifty sessions is fifty round trips otherwise, on a request
   * that already has to assemble a whole chart while somebody waits on a link
   * they were emailed.
   */
  const transcripts = new Map<string, { speaker: string; text: string; startMs: number }[]>();
  if (rows.length > 0) {
    const segments = await db
      .select({
        sessionId: transcriptSegments.sessionId,
        speaker: transcriptSegments.speaker,
        text: transcriptSegments.text,
        startMs: transcriptSegments.startMs,
      })
      .from(transcriptSegments)
      .where(
        inArray(
          transcriptSegments.sessionId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(asc(transcriptSegments.sessionId), asc(transcriptSegments.sequence))
      .limit(60_000);

    for (const segment of segments) {
      const list = transcripts.get(segment.sessionId);
      const line = { speaker: segment.speaker, text: segment.text, startMs: segment.startMs };
      if (list) list.push(line);
      else transcripts.set(segment.sessionId, [line]);
    }
  }

  /*
   * 🔴 26.9 / C127 — who signed each note, with their licence.
   *
   * A note in an extract that says only "signed on 4 March" is a note nobody
   * can trace to a person who can be asked about it. The name and licence are
   * read now rather than snapshotted at signing time, which is a deliberate
   * trade: a clinician who renews a licence number would otherwise leave old
   * notes stamped with a number that no longer resolves. The summary versions
   * below DO snapshot, because those are the patient's own document and must
   * survive the clinician's account being deleted entirely.
   */
  const signerIds = [
    ...new Set(
      rows.flatMap((row) => [row.noteApprovedBy, row.sessionTherapistId].filter(Boolean)),
    ),
  ] as string[];

  const signers = signerIds.length
    ? await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profile: users.profile,
          licenseBody: therapistVerifications.licenseBody,
          licenseNumber: therapistVerifications.licenseNumber,
        })
        .from(users)
        .leftJoin(therapistVerifications, eq(therapistVerifications.userId, users.id))
        .where(inArray(users.id, signerIds))
    : [];

  const signerOf = new Map(
    signers.map((signer) => [
      signer.id,
      {
        name: [signer.firstName, signer.lastName].filter(Boolean).join(" "),
        credentials: signer.profile?.credentials ?? null,
        licenseBody: signer.licenseBody ?? null,
        licenseNumber: signer.licenseNumber ?? null,
      },
    ]),
  );

  /*
   * The three things the old export did not carry, and which are the whole
   * point of "the most complete record of themselves a person can hold":
   * the summary versions they own, what they wrote themselves, and the steps
   * they were asked to try.
   */
  const [summaries, journalEntries, steps, diagnoses] = extra.personId
    ? await Promise.all([
        import("@/lib/data/summaries").then((m) => m.summariesForPerson(extra.personId!)),
        import("@/lib/data/journals").then((m) => m.journalsForPerson(extra.personId!, 500)),
        import("@/lib/data/homework").then((m) => m.listHomework(extra.personId!)),
        import("@/lib/data/diagnoses").then((m) => m.listDiagnoses(extra.personId!)),
      ])
    : [[], [], [], []];

  return {
    generatedAt: new Date(),
    verificationCode: extra.verificationCode,
    linkExpiresAt: expiresAt,
    summaries: summaries.map((version) => ({
      version: version.version,
      body: version.body,
      approvedByName: version.approvedByName,
      approvedByCredentials: version.approvedByCredentials,
      approvedByLicenseBody: version.approvedByLicenseBody,
      approvedByLicenseNumber: version.approvedByLicenseNumber,
      approvedAt: version.approvedAt,
    })),
    journals: journalEntries.map((entry) => ({
      body: entry.body,
      source: entry.source,
      createdAt: entry.createdAt,
    })),
    homework: steps.map((step) => ({
      title: step.title,
      detail: step.detail ?? null,
      status: step.status,
      createdAt: step.createdAt,
    })),
    confirmedDiagnoses: diagnoses
      .filter((diagnosis) => diagnosis.status === "confirmed")
      .map((diagnosis) => ({
        label: diagnosis.label,
        code: diagnosis.code ?? null,
        sourceSentence: diagnosis.sourceSentence,
      })),
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
      /* C127 — the person who stands behind this note, and their licence. */
      signedBy: row.noteApprovedBy ? (signerOf.get(row.noteApprovedBy) ?? null) : null,
      seenBy: row.sessionTherapistId ? (signerOf.get(row.sessionTherapistId) ?? null) : null,
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
  if (!value) return "-";
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
  /*
   * 🔴 C127 — the words "certified" and "proof of diagnosis" never appear in
   * this document, and `verify:sprint26` scans the rendered HTML for them
   * rather than trusting this comment. What the cover page claims is exactly
   * what we can attest: what our records contain, and when.
   */
  const verifyUrl = `${env.appUrl.replace(/^https?:\/\//, "")}/verify`;
  const sessionsHtml = record.sessions
    .map((session) => {
      const languageLabel = NOTE_LANGUAGES[session.noteLanguage] ?? session.noteLanguage;
      const transcript = session.transcript.length
        ? `<details><summary>Transcript, ${session.transcript.length} lines</summary>
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
<title>Your record, ${esc(record.patient.name)}</title>
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
  .code { font:700 22px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.12em;
          background:#f1f5f9; border-radius:12px; padding:12px 16px; display:inline-block; margin:6px 0; }
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
    <h2>What this is</h2>
    <p><strong>This is a record extract.</strong> It sets out what 24Therapy holds
      about you: your sessions, the notes your clinicians wrote and signed, the
      versions of your clinical summary, anything you wrote yourself, the steps you
      were asked to try, and the transcript of anything that was recorded.</p>

    <h2 style="margin-top:18px">What this is not</h2>
    <p>It is <strong>not</strong> a statement that any diagnosis in it is correct, and
      it is not a report written for a court, an employer, an insurer or a school.
      We can say what our records contain and when they were written. We cannot
      vouch for the clinical judgement inside them, and nobody should read this as
      though we have.</p>
    <p class="muted">If you need a document written for a particular purpose, ask
      the clinician who saw you. They can write one, and they will put their name
      on it.</p>
    ${
      record.verificationCode
        ? `<h2 style="margin-top:18px">Checking this is real</h2>
           <p>Anyone you hand this to can confirm that it came from us. They enter
             this code at <strong>${esc(verifyUrl)}</strong>:</p>
           <p class="code">${esc(record.verificationCode)}</p>
           <p class="muted">That page confirms that this platform produced an extract,
             on that date, containing that many sessions and signed notes. It shows no
             name, no diagnosis and nothing anybody wrote.</p>`
        : ""
    }
    <p class="muted" style="margin-top:18px">The one thing not included is your
      clinician's own working conversation with their assistant tool, their
      thinking-out-loud about your care, which is a professional aid rather than
      part of your record. Everything that assistant wrote <em>during</em> a session
      is in the notes below.</p>
    <p class="muted">This link stops working on ${when(record.linkExpiresAt)}.
      Save or print this page now. Nobody at 24Therapy read it to send it to you.</p>
    <a class="dl" href="${esc(jsonHref)}" download>Download as data (JSON)</a>
  </section>

  ${
    record.summaries.length > 0
      ? `<section>
          <h2>Your clinical summary, ${record.summaries.length} version${record.summaries.length === 1 ? "" : "s"}</h2>
          <p class="muted">Newest first. Every version stays: a later one is added
            beside an earlier one, never over it.</p>
          ${record.summaries
            .map(
              (version) => `<div class="note">
                <h4>Version ${version.version} · ${when(version.approvedAt)}</h4>
                <p>${esc(version.body).replaceAll("\n", "<br>")}</p>
                <p class="muted">Approved by ${esc(version.approvedByName)}${
                  version.approvedByCredentials ? `, ${esc(version.approvedByCredentials)}` : ""
                }${
                  version.approvedByLicenseBody
                    ? ` · ${esc(version.approvedByLicenseBody)}${version.approvedByLicenseNumber ? ` ${esc(version.approvedByLicenseNumber)}` : ""}`
                    : ""
                }</p>
              </div>`,
            )
            .join("")}
        </section>`
      : ""
  }

  ${
    record.confirmedDiagnoses.length > 0
      ? `<section>
          <h2>Diagnoses on your record</h2>
          <p class="muted">Each one with the sentence it was taken from, because a
            label on its own is not checkable and the sentence is.</p>
          ${record.confirmedDiagnoses
            .map(
              (diagnosis) => `<div class="note">
                <h4>${esc(diagnosis.label)}${diagnosis.code ? ` · ${esc(diagnosis.code)}` : ""}</h4>
                <p>${esc(diagnosis.sourceSentence)}</p>
              </div>`,
            )
            .join("")}
        </section>`
      : ""
  }

  <section>
    <h2>You</h2>
    <dl>
      <dt>Name</dt><dd>${esc(record.patient.name)}</dd>
      <dt>Email</dt><dd>${esc(record.patient.email ?? "-")}</dd>
      <dt>Phone</dt><dd>${esc(record.patient.phone ?? "-")}</dd>
      <dt>Record opened</dt><dd>${when(record.patient.recordOpened)}</dd>
      <dt>Clinician</dt><dd>${esc(record.clinician.name ?? "-")}${
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
    <h2>Sessions, ${record.sessions.length}</h2>
    ${
      record.sessions.length === 0
        ? `<p class="muted">No sessions on record.</p>`
        : `<p class="muted">Most recent first.</p>`
    }
  </section>

  ${sessionsHtml}

  ${
    record.journals.length > 0
      ? `<section>
          <h2>What you wrote, ${record.journals.length}</h2>
          <p class="muted">Your own journals, in your words, newest first.</p>
          ${record.journals
            .map(
              (entry) => `<div class="note">
                <h4>${when(entry.createdAt)}${entry.source === "dictated" ? " · spoken" : ""}</h4>
                <p>${esc(entry.body).replaceAll("\n", "<br>")}</p>
              </div>`,
            )
            .join("")}
        </section>`
      : ""
  }

  ${
    record.homework.length > 0
      ? `<section>
          <h2>Steps you were asked to try, ${record.homework.length}</h2>
          <ul>${record.homework
            .map(
              (step) =>
                `<li>${esc(step.title)}${step.detail ? `. ${esc(step.detail)}` : ""} <span class="muted">(${esc(step.status)}, ${when(step.createdAt)})</span></li>`,
            )
            .join("")}</ul>
        </section>`
      : ""
  }

  <footer>
    Prepared by 24Therapy at the request of the person named above.<br>
    If anything here looks wrong, tell your clinician, corrections belong in the
    record alongside the original, not instead of it.
  </footer>
</main></body></html>`;
}

/* ---------------------------------------------------------- verifying -- */

export type VerificationResult =
  | {
      known: true;
      issuedAt: Date;
      sessions: number;
      signedNotes: number;
      summaryVersions: number;
    }
  | { known: false };

/**
 * What a third party can check. PLAN.md 26.9, C127.
 *
 * ## 🔴 What this deliberately does not return
 *
 * No name, no diagnosis, no note, no clinician, no organisation, not even
 * whether the code belongs to the person standing in front of them. A code
 * printed on a cover page ends up in a solicitor's file, a landlord's inbox
 * and occasionally on a photocopier, and anything this function returns is
 * returned to whoever has it.
 *
 * What it returns is the narrow thing we can honestly attest and that is
 * actually useful: this platform produced an extract on this date, containing
 * this many sessions and this many signed notes. That distinguishes a real
 * extract from a forged one, which is the entire job, and it attests nothing
 * about whether a diagnosis inside it is correct.
 */
export async function verifyExtract(code: string): Promise<VerificationResult> {
  const normalised = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalised)) {
    return { known: false };
  }

  const [row] = await db
    .select({
      createdAt: dataExports.createdAt,
      patientId: dataExports.patientId,
      personId: dataExports.personId,
    })
    .from(dataExports)
    .where(eq(dataExports.verificationCode, normalised))
    .limit(1);

  if (!row) return { known: false };

  const chartIds = row.personId
    ? (
        await db
          .select({ id: patients.id })
          .from(patients)
          .where(eq(patients.personId, row.personId))
      ).map((chart) => chart.id)
    : [row.patientId];

  const counted = await db
    .select({
      sessionId: sessions.id,
      noteStatus: sessionNotes.status,
    })
    .from(sessions)
    .leftJoin(sessionNotes, eq(sessionNotes.sessionId, sessions.id))
    .where(inArray(sessions.patientId, chartIds.length > 0 ? chartIds : [row.patientId]))
    .limit(2000);

  const summaryVersions = row.personId
    ? await import("@/lib/data/summaries").then((m) => m.summaryCount(row.personId!))
    : 0;

  return {
    known: true,
    issuedAt: row.createdAt,
    sessions: counted.length,
    signedNotes: counted.filter((entry) => entry.noteStatus === "approved").length,
    summaryVersions,
  };
}

/* ------------------------------------------------ 26.10 · the patient asks */

export type OwnExportResult =
  | { ok: true; email: string; expiresAt: Date; verificationCode: string }
  | { ok: false; error: string; needsEmail?: boolean };

/**
 * A patient asking for their own record. PLAN.md 26.9, 26.10, C128.
 *
 * ## 🔴 Email only, and the button has to say so first
 *
 * C128: never WhatsApp. A full record extract is the most sensitive document
 * this platform produces, and WhatsApp is the channel most likely to be read
 * by somebody else holding the phone, forwarded in one tap, and backed up to a
 * cloud account the person does not control. So it goes to an email address or
 * it does not go.
 *
 * Most patients here have no email (§3b), which is exactly why the ruling
 * continues: they add one **to export**, and the button says that before it is
 * pressed rather than after. `needsEmail` is how the caller knows to say it.
 *
 * The clinician's version of this exists separately and is not reused: that
 * one is scoped by caseload and audited against an actor. This one has no
 * `Actor` at all, because a patient is not a member of an organisation (C41).
 */
export async function requestOwnExport(input: {
  accountId: string;
  personId: string;
  email: string | null;
}): Promise<OwnExportResult> {
  const email = (input.email ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return {
      ok: false,
      needsEmail: true,
      error:
        "We send a record extract to an email address and nowhere else. Add one to your account and it will come straight through.",
    };
  }

  const [chart] = await db
    .select({ id: patients.id, organizationId: patients.organizationId })
    .from(patients)
    .where(and(eq(patients.personId, input.personId), isNull(patients.deletedAt)))
    .orderBy(desc(patients.createdAt))
    .limit(1);

  if (!chart) {
    return {
      ok: false,
      error: "There is nothing in your record to export yet. It fills up as you have sessions.",
    };
  }

  const { consume, subjectKey } = await import("@/lib/rate-limit");
  const allowed = await consume(subjectKey("patient:own-export", input.personId), 4, 3600);
  if (!allowed.allowed) {
    return {
      ok: false,
      error: "You have asked for this a few times in the last hour. Try again a bit later.",
    };
  }

  // One live link at a time, for the same reason as the clinician's version.
  await db
    .update(dataExports)
    .set({ revokedAt: new Date() })
    .where(and(eq(dataExports.patientId, chart.id), isNull(dataExports.revokedAt)));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + EXPORT_TTL_HOURS * 60 * 60 * 1000);
  const verificationCode = mintVerificationCode();

  await db.insert(dataExports).values({
    organizationId: chart.organizationId,
    patientId: chart.id,
    personId: input.personId,
    tokenHash: HASH(token),
    verificationCode,
    deliveredTo: email,
    expiresAt,
  });

  await audit({
    actor: null,
    patientAccountId: input.accountId,
    category: "phi_access",
    action: "patient.export_requested",
    resourceType: "person",
    resourceId: input.personId,
  });

  const { notify } = await import("@/lib/notify");
  await notify(
    /*
     * 🔴 C128 — the phone is deliberately not passed.
     *
     * `notify` falls back to WhatsApp when there is no email, which is right
     * for a reminder and wrong for a medical record. Passing null here means
     * the fallback cannot fire: the ruling is enforced by what this call is
     * given rather than by a branch inside it.
     */
    { email, phone: null, timezone: null },
    {
      kind: "record.export",
      subject: "Your record from 24Therapy",
      body: "You asked for a copy of your record. The link below opens it, and it stops working in three days. Nobody here read it.",
      link: { label: "Open my record", url: `${env.appUrl}${exportPath(token)}` },
    },
  );

  await alertStaffOfExport({
    patientName: "a patient, at their own request",
    to: email,
    byRole: "patient",
    code: verificationCode,
  }).catch((error) => {
    log.error("export admin alert failed", { reason: safeErrorMessage(error) });
  });

  return { ok: true, email, expiresAt, verificationCode };
}
