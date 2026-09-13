"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import {
  importPatients,
  parseImport,
  type ImportPreview,
  type ParsedRow,
  type RowProblem,
} from "@/lib/data/patient-import";
import { patientPhonesOnCaseload } from "@/lib/data/patients";

/**
 * 55.11 / 42.8 — the importer's two steps, and they are two ACTIONS rather than one.
 *
 * 🔴 A PREVIEW THAT DOES NOT WRITE, THEN A WRITE THAT DOES NOT PARSE.
 *
 * The file is parsed and shown; nothing is created until a second submit. An importer that
 * wrote on upload would make a mis-shifted column into thirty charts with the wrong names on
 * them, deleted one at a time by the clinician who trusted it.
 *
 * The parsed rows travel back to the browser and return in the second submit as JSON. That is
 * the deliberate choice over a server-side draft table: a draft table is a place somebody
 * else's caseload sits half-imported, and the rows are the clinician's own data going back to
 * the clinician's own browser. Re-validated on the way in either way, because a round trip
 * through a form is a round trip through something a caller can edit.
 */

export type PreviewState = {
  error?: string;
  preview?: ImportPreview;
  /** Which of the parsed numbers this clinician already has a chart for. */
  duplicates?: string[];
  country?: string;
};

export async function preview(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  const actor = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  /*
   * 🔴 A ceiling, because this arrives as a string in memory. Two megabytes is tens of
   * thousands of rows, which is far more than a caseload and far less than a problem.
   */
  if (file.size > 2 * 1024 * 1024) return { error: "That file is too big to be a caseload." };

  const country = String(formData.get("country") ?? "").trim();
  if (!country) return { error: "Choose the country these numbers are in." };

  const parsed = parseImport(await file.text(), country);
  if ("error" in parsed) return { error: parsed.error };

  /*
   * 🔴 Read before the write and shown in the preview. Importing somebody a clinician
   * already has produces a second chart for one person, which is a session history split in
   * half with no error anywhere.
   */
  const already = await patientPhonesOnCaseload(
    actor,
    parsed.rows.map((row) => row.phone),
  );

  return { preview: parsed, duplicates: [...already], country };
}

export type CommitState = {
  error?: string;
  created?: number;
  skipped?: number;
  failed?: RowProblem[];
};

export async function commit(_prev: CommitState, formData: FormData): Promise<CommitState> {
  const actor = await requireUser();

  let rows: ParsedRow[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]")) as ParsedRow[];
  } catch {
    return { error: "Upload the file again." };
  }

  if (!Array.isArray(rows) || rows.length === 0) return { error: "There was nothing to import." };
  if (rows.length > 2000) return { error: "That is more people than one caseload." };

  /*
   * 🔴 RE-VALIDATED, because this came back through a form and a form is editable.
   *
   * Each field is re-read and re-typed here rather than trusted, and the phone is re-tested
   * against E.164 because `createPatient` throws on one that is not, and a throw inside the
   * loop is a row reported rather than a crash. Shape, not identity: the organisation and the
   * therapist come from the `Actor` inside `createPatient`, so a tampered payload can only
   * ever create a patient on the tamperer's own caseload.
   */
  const safe: ParsedRow[] = [];
  for (const row of rows) {
    if (typeof row?.firstName !== "string" || typeof row?.phone !== "string") continue;
    if (!/^\+[1-9][0-9]{6,14}$/.test(row.phone)) continue;
    safe.push({
      line: typeof row.line === "number" ? row.line : 0,
      firstName: row.firstName.slice(0, 120),
      lastName: typeof row.lastName === "string" ? row.lastName.slice(0, 120) || null : null,
      email: typeof row.email === "string" && row.email.includes("@") ? row.email.slice(0, 200) : null,
      phone: row.phone,
    });
  }

  if (safe.length === 0) return { error: "None of those rows could be read." };

  const result = await importPatients(actor, safe);

  revalidatePath("/patients");
  return { created: result.created, skipped: result.skipped, failed: result.failed };
}
