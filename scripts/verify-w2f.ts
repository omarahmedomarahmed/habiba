/**
 * 🔴 W2-F01 (D7): NOTES IN ANY FORMAT, ALL IN THE SESSION PRICE, ALL ON THE HISTORY.
 *
 *   npm run verify:w2f
 *
 * The founder's decision, held against real rows: a session drafted in a second
 * and a third format leaves its invoice lines identical; each format is its own
 * document with today's lifecycle (draft, signed, locked, addenda); the
 * patient's plain-language copy stays one per session, from whichever note was
 * signed first; an existing SOAP note reads as it always did; and a clinician's
 * own template drafts like any other format.
 *
 * Needs migrations 0128 and 0129. Everything it makes is deleted in a
 * `finally`, and `writesTo()` refuses production by name.
 */
import { sql } from "drizzle-orm";

import { startMockOpenAi } from "../tests/mock-openai";
import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `w2f${Date.now().toString(36)}`;

async function main() {
  writesTo();

  /* The note writer is pointed at the stand-in the e2e suite uses. */
  const mock = startMockOpenAi(4321);
  process.env.OPENAI_BASE_URL = "http://127.0.0.1:4321/v1";
  process.env.OPENAI_API_KEY ||= "sk-mock";

  const { db, pool } = connect();
  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };

  try {
    const org = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug, kind)
      VALUES ('Wave 2F Demo Practice', 'eg', ${fixture}, 'solo') RETURNING id`);
    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`salma.${fixture}@example.com`}, 'Salma', 'Demo', 'therapist', 'x')
      RETURNING id`);
    const actor = {
      userId: therapist.id,
      organizationId: org.id,
      role: "therapist" as const,
      email: `salma.${fixture}@example.com`,
      firstName: "Salma",
      lastName: "Demo",
      verificationStatus: "verified" as const,
      region: "eg" as const,
      timezone: "UTC",
    };

    const started = new Date(Date.now() - 60 * 60_000);
    const session = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, status, modality, feedback_token,
                            started_at, recording_started_at, ended_at, recording_consent)
      VALUES (${org.id}, ${therapist.id}, 'completed', 'in_person', ${`fb-${fixture}`},
              ${started}, ${started}, ${new Date(started.getTime() + 50 * 60_000)}, 'granted')
      RETURNING id`);
    await db.execute(sql`
      INSERT INTO transcript_segments (session_id, organization_id, sequence, speaker, text, start_ms, end_ms)
      VALUES (${session.id}, ${org.id}, 1, 'patient',
              'I slept badly again this week, and the deadline at work kept me up most nights until three.',
              0, 2400000)`);

    /* ============================================================ */
    /*  THE INVOICE: raised when the session ends, before any note   */
    /* ============================================================ */

    const { chargeForSession, getSubscription, reconcileMissingCharges } = await import(
      "../lib/billing/service"
    );
    // Past the free first session, so the lines carry real amounts.
    await getSubscription(org.id);
    await db.execute(sql`
      UPDATE subscriptions SET trial_session_used = true WHERE organization_id = ${org.id}`);
    await chargeForSession({ organizationId: org.id, sessionId: session.id });

    const invoiceState = async () => {
      const { rows } = await db.execute(sql`
        SELECT i.kind, i.status, i.amount_cents, l.kind AS line, l.amount_cents AS line_cents
          FROM invoices i LEFT JOIN invoice_lines l ON l.invoice_id = i.id
         WHERE i.organization_id = ${org.id}
         ORDER BY i.kind, l.kind`);
      return JSON.stringify(rows);
    };

    const { generateAndStoreNote, draftNoteInFormat } = await import("../lib/ai/notes");
    await generateAndStoreNote({
      sessionId: session.id,
      organizationId: org.id,
      therapistId: therapist.id,
      patientId: null,
    });
    const baseline = await invoiceState();

    const soap = await one<{ format: string; is_primary: boolean; sections: unknown; subjective: string }>(sql`
      SELECT format, is_primary, content->'sections' AS sections, content->'soap'->>'subjective' AS subjective
        FROM session_notes WHERE session_id = ${session.id}`);
    check(
      "W2-F01 the session's own note is SOAP, primary, in `soap` and nothing else, as every note was",
      soap?.format === "soap" && soap.is_primary && soap.sections === null && Boolean(soap.subjective),
      `${soap?.format}, primary ${soap?.is_primary}`,
    );

    const { builtInFormat } = await import("../lib/notes/formats");
    const dap = await draftNoteInFormat({
      sessionId: session.id,
      organizationId: org.id,
      therapistId: therapist.id,
      patientId: null,
      format: builtInFormat("dap")!,
    });
    const birp = await draftNoteInFormat({
      sessionId: session.id,
      organizationId: org.id,
      therapistId: therapist.id,
      patientId: null,
      format: builtInFormat("birp")!,
    });
    await reconcileMissingCharges();
    const after = await invoiceState();

    check(
      "🔴 W2-F01 a second and a third format leave the invoice lines IDENTICAL (included in the session price)",
      baseline === after && baseline.includes('"line":"platform"') && baseline.includes('"line":"ai"'),
      after,
    );
    const aiLines = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
       WHERE i.session_id = ${session.id} AND l.kind = 'ai'`);
    check("W2-F01 …and the session still has exactly one AI line", aiLines.n === 1, `${aiLines.n}`);

    const notes = await db.execute(sql`
      SELECT id, format, is_primary, status, content->'sections' AS sections
        FROM session_notes WHERE session_id = ${session.id} ORDER BY created_at`);
    const rows = notes.rows as {
      id: string;
      format: string;
      is_primary: boolean;
      status: string;
      sections: { key: string; label: string; text: string }[] | null;
    }[];
    const dapRow = rows.find((r) => r.format === "dap");
    check(
      "W2-F01 each format is its own document: three notes, one primary, each a draft",
      rows.length === 3 &&
        rows.filter((r) => r.is_primary).length === 1 &&
        rows.every((r) => r.status === "draft") &&
        Boolean(dap.noteId && birp.noteId),
      rows.map((r) => `${r.format}${r.is_primary ? "*" : ""}`).join(","),
    );
    check(
      "W2-F01 a DAP note is drafted into DAP's sections, in DAP's order, from the transcript",
      dapRow?.sections?.map((s) => s.key).join(",") === "data,assessment,plan" &&
        dapRow.sections.every((s) => s.text.length > 0),
      dapRow?.sections?.map((s) => `${s.label}: ${s.text.slice(0, 20)}`).join(" / "),
    );

    let duplicate = false;
    try {
      await db.execute(sql`
        INSERT INTO session_notes (session_id, organization_id, therapist_id, content, format, is_primary)
        VALUES (${session.id}, ${org.id}, ${therapist.id}, '{}'::jsonb, 'dap', false)`);
      duplicate = true;
    } catch {
      duplicate = false;
    }
    check("W2-F01 one note per format per session, held by the database", !duplicate);

    /* ============================================================ */
    /*  THE LIFECYCLE, per format                                    */
    /* ============================================================ */

    const { signNote, saveClinicalNote, addAddendum, releasePatientCopy } = await import(
      "../lib/data/note-record"
    );
    // DAP is signed before SOAP: the copy comes from whichever was signed first.
    const signed = await signNote(actor as never, session.id, dapRow!.id);
    const afterSign = await db.execute(sql`
      SELECT format, is_primary, status FROM session_notes WHERE session_id = ${session.id}`);
    const byFormat = new Map(
      (afterSign.rows as { format: string; is_primary: boolean; status: string }[]).map((r) => [r.format, r]),
    );
    check(
      "🔴 W2-F01 signing DAP first signs DAP alone and moves the patient's copy to it",
      signed.ok &&
        byFormat.get("dap")?.status === "approved" &&
        byFormat.get("dap")?.is_primary === true &&
        byFormat.get("soap")?.status === "draft" &&
        byFormat.get("soap")?.is_primary === false,
      [...byFormat.values()].map((r) => `${r.format}:${r.status}${r.is_primary ? "*" : ""}`).join(","),
    );

    const rewrite = await saveClinicalNote(
      actor as never,
      session.id,
      { soap: { subjective: "", objective: "", assessment: "", plan: "" }, sections: [] } as never,
      dapRow!.id,
    );
    const soapEdit = await saveClinicalNote(
      actor as never,
      session.id,
      {
        soap: { subjective: "Edited SOAP", objective: "", assessment: "", plan: "" },
        summary: "",
        talkingPoints: [],
        observations: "",
        impressions: "",
        recommendations: [],
        followUp: "",
        patientBrief: "",
        patientSteps: [],
        patientNext: "",
      },
      rows.find((r) => r.format === "soap")!.id,
    );
    check(
      "W2-F01 the signed DAP note is locked (W1-03), while the SOAP draft beside it still edits",
      !rewrite.ok && soapEdit.ok,
      `dap ${rewrite.ok ? "rewritten" : "refused"}, soap ${soapEdit.ok ? "saved" : "refused"}`,
    );

    let formatChanged = false;
    try {
      await db.execute(sql`UPDATE session_notes SET format = 'pie' WHERE id = ${birp.noteId}`);
      formatChanged = true;
    } catch {
      formatChanged = false;
    }
    check("W2-F01 a note keeps its format, held by the database", !formatChanged);

    const addendum = await addAddendum(actor as never, session.id, "clinical", "Later thought", dapRow!.id);
    const onDap = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM note_addenda WHERE note_id = ${dapRow!.id}`);
    check("W2-F01 an addendum lands on the format it amends", addendum.ok && onDap.n === 1);

    // Signing SOAP now does not move the copy again: DAP was signed first.
    await signNote(actor as never, session.id, rows.find((r) => r.format === "soap")!.id);
    const still = await one<{ format: string }>(sql`
      SELECT format FROM session_notes WHERE session_id = ${session.id} AND is_primary`);
    check("W2-F01 …and a later signature leaves the copy where the first put it", still.format === "dap");

    const released = await releasePatientCopy(actor as never, session.id);
    let secondCopy = false;
    try {
      await db.execute(sql`
        UPDATE session_notes SET patient_status = 'approved' WHERE id = ${birp.noteId}`);
      secondCopy = true;
    } catch {
      secondCopy = false;
    }
    const copies = await one<{ n: number; format: string }>(sql`
      SELECT count(*)::int AS n, min(format) AS format FROM session_notes
       WHERE session_id = ${session.id} AND patient_status = 'approved'`);
    check(
      "🔴 W2-F01 the patient's plain-language copy stays ONE per session, from the note signed first",
      released.ok && !secondCopy && copies.n === 1 && copies.format === "dap",
      `${copies.n} released, from ${copies.format}`,
    );

    /*
     * 🔴 A second press on a signed note, or on a released copy, changes
     * nothing, and used to write another approval row anyway: the PHI audit
     * then showed two signatures by whoever pressed twice.
     */
    const approvals = async (action: string) =>
      (
        await one<{ n: number }>(sql`
          SELECT count(*)::int AS n FROM audit_log WHERE action = ${action} AND resource_id = ${session.id}`)
      ).n;
    const signedRows = await approvals("note.approve");
    const releasedRows = await approvals("note.patient.approve");
    const signedAgain = await signNote(actor as never, session.id, dapRow!.id);
    const releasedAgain = await releasePatientCopy(actor as never, session.id);
    check(
      "🔴 signing a signed note or releasing a released copy again succeeds and writes no second approval row",
      signedAgain.ok && releasedAgain.ok &&
        (await approvals("note.approve")) === signedRows && (await approvals("note.patient.approve")) === releasedRows,
      `${signedRows} signatures and ${releasedRows} release before, ${await approvals("note.approve")} and ${await approvals("note.patient.approve")} after`,
    );
    check(
      "CONTROL …while each real signature and the release wrote exactly one",
      signedRows === 2 && releasedRows === 1,
      `${signedRows} signatures, ${releasedRows} release`,
    );

    /* ============================================================ */
    /*  THE HISTORY, THE CHART, THE COPILOT                          */
    /* ============================================================ */

    const { notesForSessions } = await import("../lib/data/sessions");
    const history = await notesForSessions(actor as never, [session.id]);
    check(
      "W2-F01 the patient's history lists every note of the session: format, state, author, time",
      history.length === 3 &&
        history.every((n) => n.authorFirstName === "Salma" && n.createdAt) &&
        history.filter((n) => n.status === "approved").length === 2,
      history.map((n) => `${n.format}:${n.status}`).join(","),
    );

    const { noteAsText } = await import("../lib/ehr/file-note");
    const dapContent = await one<{ content: never }>(sql`
      SELECT content FROM session_notes WHERE id = ${dapRow!.id}`);
    const filed = noteAsText(dapContent.content);
    check(
      "W2-F01 record-system filing reads a DAP note under its own headings",
      filed.startsWith("Data\n") && filed.includes("\n\nAssessment\n") && !filed.includes("Subjective"),
      filed.slice(0, 60).replaceAll("\n", " | "),
    );

    /* ============================================================ */
    /*  A CLINICIAN'S OWN TEMPLATE, AND THEIR DEFAULT                */
    /* ============================================================ */

    const { createTemplate, setDefaultFormat, formatsFor } = await import("../lib/data/note-formats");
    const made = await createTemplate(actor as never, {
      label: "Mine",
      sections: "Presenting: what they came with\nWork: what we did",
    });
    const setOk = made.ok ? await setDefaultFormat(actor as never, made.key) : false;
    const { defaultFormat } = await formatsFor(org.id, therapist.id);
    check(
      "W2-F01 a clinician's own template is a format, and can be their default",
      made.ok && setOk && defaultFormat.label === "Mine" && defaultFormat.sections.length === 2,
      defaultFormat.key,
    );

    const second = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, status, modality, feedback_token,
                            started_at, recording_started_at, ended_at, recording_consent)
      VALUES (${org.id}, ${therapist.id}, 'completed', 'in_person', ${`fb2-${fixture}`},
              ${started}, ${started}, ${new Date(started.getTime() + 50 * 60_000)}, 'granted')
      RETURNING id`);
    await db.execute(sql`
      INSERT INTO transcript_segments (session_id, organization_id, sequence, speaker, text, start_ms, end_ms)
      VALUES (${second.id}, ${org.id}, 1, 'patient',
              'Work has been calmer, and I managed the wind-down routine on four of the seven nights.',
              0, 2400000)`);
    await generateAndStoreNote({
      sessionId: second.id,
      organizationId: org.id,
      therapistId: therapist.id,
      patientId: null,
    });
    const own = await one<{ format: string; keys: string }>(sql`
      SELECT format, (SELECT string_agg(s->>'key', ',') FROM jsonb_array_elements(content->'sections') s) AS keys
        FROM session_notes WHERE session_id = ${second.id} AND is_primary`);
    check(
      "W2-F01 a new session's note is drafted in the clinician's default format, from the transcript",
      own?.format === (made.ok ? made.key : "") && own.keys === "s1,s2",
      `${own?.format} ${own?.keys}`,
    );
  } finally {
    mock.server.close();
    const orgs = sql`(SELECT id FROM organizations WHERE slug = ${fixture})`;
    await db.execute(sql`DELETE FROM session_notes WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM transcript_segments WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM invoice_lines WHERE invoice_id IN
      (SELECT id FROM invoices WHERE organization_id IN ${orgs})`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM invoices WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM subscriptions WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM ai_request_logs WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM note_templates WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM sessions WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}@example.com`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
    await pool.end();
  }

  finish("wave 2F");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
