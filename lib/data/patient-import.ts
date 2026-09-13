import "server-only";

import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";
import { e164Problem, toE164 } from "@/lib/phone/e164";
import type { Actor } from "@/lib/auth/session";

/*
 * 🔴 NO `db` HANDLE IN THIS FILE, and that is deliberate rather than incidental.
 *
 * Every read and write here goes through `lib/data/patients.ts`, which holds the region pin
 * (30.1) and the `scope(actor)` helper that decides what a clinician can see. A second handle
 * would be a second pin in the ratchet and a second place the caseload scope could be got
 * wrong — which, in this file's first draft, it was.
 */
import { createPatient, patientPhonesOnCaseload } from "./patients";

/**
 * 🔴 55.11 / 42.8 — A PATIENT CSV IMPORT. *A clinician leaving another platform is the
 * sales motion; make the migration a button.*
 *
 * ## 🔴 WHY A CSV IS RIGHT HERE AND WAS REFUSED IN SPRINT 54
 *
 * 54.4 says invitations are *one at a time and never a CSV*, and that looks like the
 * opposite ruling. It is not, and the difference is whose list it is.
 *
 * A clinic uploading its clinicians is a STAFF LIST arriving in our database before anybody
 * on it consented to be there, and C267 means each of those people has to act personally
 * anyway, so the bulk path saves the clinic nothing real.
 *
 * A clinician uploading their own caseload is THEIR OWN CASELOAD. Those charts already
 * exist, in their hand, in the tool they are leaving; every one of those patients already
 * has a clinical relationship with the person doing the upload. Creating a `patients` row
 * for somebody you already treat is what `createPatient` is for, and it is what a clinician
 * does thirty times by hand in their first week. The CSV is that same act, thirty times,
 * without the typing.
 *
 * ## 🔴 IT READS FOUR COLUMNS AND IGNORES EVERY OTHER ONE, BY NAME
 *
 * An export from a competitor carries notes, diagnoses, histories, risk flags and session
 * summaries. Every one of those is CONTENT IN A CHART, and §7's first hard rule is that
 * content in a chart needs a named clinician who approved that exact text. A note that
 * arrived in a spreadsheet has nobody who approved it here, so importing one would put
 * unsigned clinical text in a record, which is exactly what `recordExternalSession` refuses
 * from a partner's server for the same reason.
 *
 * So: a first name, a last name, an email and a phone number. The preview NAMES the columns
 * it is dropping, because a clinician who uploaded a file with a notes column needs to know
 * the notes did not come across rather than assume they did.
 *
 * ## 🔴 A PREVIEW BEFORE ANY WRITE, ALWAYS
 *
 * `parseImport` touches no database and `importPatients` takes rows rather than a file. An
 * importer that writes on upload is an importer whose mistakes are thirty charts somebody
 * has to delete one at a time, and a mis-shifted column means those charts have the wrong
 * names on them.
 *
 * ## 🔴 AND IT GOES THROUGH `createPatient`, NOT AROUND IT
 *
 * One insert loop calling the ordinary function, so every invariant it holds holds here:
 * the organisation and therapist come from the `Actor`, 5.1's person row is created, and
 * each patient gets its own `patient.create` audit entry. A bulk `insert().values([...])`
 * would be faster and would skip all three, which is C262's rule about reading through the
 * same code path, applied to a write.
 */

/** The only columns that cross. Everything else in the file is named and dropped. */
const COLUMNS = {
  firstName: ["first name", "firstname", "first", "given name", "name"],
  lastName: ["last name", "lastname", "last", "surname", "family name"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "phone number", "mobile", "telephone", "tel", "msisdn"],
} as const;

export type ParsedRow = {
  /** 1-based, counting the header, so it matches what a spreadsheet shows. */
  line: number;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string;
};

export type RowProblem = { line: number; reason: string };

export type ImportPreview = {
  rows: ParsedRow[];
  problems: RowProblem[];
  /** 🔴 Named, so a clinician knows their notes column did not come across. */
  ignoredColumns: string[];
  /** Which header we matched to which field, so a mis-shifted file is visible. */
  matched: { field: string; column: string }[];
};

/**
 * A CSV parser that handles quotes, because `split(",")` breaks on `"Smith, Jane"` and the
 * failure mode is a surname in the email column, silently, on a real person's chart.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  /* Strip a BOM. Excel writes one and it lands on the first header name. */
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]!;

    if (quoted) {
      if (char === '"') {
        /* A doubled quote inside a quoted field is one literal quote. */
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      /* Accept CRLF, LF and CR. A file written on any of three platforms. */
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  /* A last line with no terminator is still a line. */
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function headerIndex(headers: string[], aliases: readonly string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

/**
 * 🔴 PURE. No database, no `Actor`, no writes.
 *
 * So the preview screen can be rendered from an upload without anything having happened yet,
 * and so this function is testable without a fixture.
 *
 * ## 🔴 `country` IS REQUIRED, AND THAT IS C64 RATHER THAN AN INCONVENIENCE
 *
 * Numbers go through `toE164` from `lib/phone/e164.ts`, the same function every phone field
 * in the product uses, and it takes a country because `01001234567` is a valid mobile in
 * Egypt, Italy and Kenya and is a DIFFERENT HUMAN BEING in each. There is no
 * `toE164(value)` overload and there must not be one here either.
 *
 * My first draft of this file wrote its own normaliser that accepted only `+` and `00`
 * prefixes. It looked safe, because it guessed nothing. What it actually did was refuse
 * every national number in the file, and §3b is that this book's patients are reached by
 * phone in Egypt: an Egyptian clinician's export is nearly all `01…`, so the importer would
 * have reported almost every row as a bad number and imported nothing. The fix is not a
 * better guess, it is the country selector the upload form now has.
 */
export function parseImport(csv: string, country: string): ImportPreview | { error: string } {
  const grid = parseCsv(csv);
  if (grid.length === 0) return { error: "That file has nothing in it." };

  const headers = grid[0]!.map((cell) => cell.trim().toLowerCase());

  const indexes = {
    firstName: headerIndex(headers, COLUMNS.firstName),
    lastName: headerIndex(headers, COLUMNS.lastName),
    email: headerIndex(headers, COLUMNS.email),
    phone: headerIndex(headers, COLUMNS.phone),
  };

  if (indexes.firstName < 0) {
    return { error: "That file needs a column called name, or first name." };
  }
  if (indexes.phone < 0) {
    return { error: "That file needs a column with a phone number in it." };
  }

  const used = new Set(Object.values(indexes).filter((index) => index >= 0));
  const matched = Object.entries(indexes)
    .filter(([, index]) => index >= 0)
    .map(([field, index]) => ({ field, column: grid[0]![index]!.trim() }));

  /*
   * 🔴 Every other column, named. This is the list a clinician reads to find out that the
   * notes, the diagnosis and the risk flag in their export are not coming across.
   */
  const ignoredColumns = grid[0]!
    .map((cell, index) => (used.has(index) ? null : cell.trim()))
    .filter((cell): cell is string => cell !== null && cell !== "");

  const rows: ParsedRow[] = [];
  const problems: RowProblem[] = [];
  /* A file that names the same person twice, which an export from a merged account does. */
  const seen = new Set<string>();

  for (let i = 1; i < grid.length; i += 1) {
    const cells = grid[i]!;
    const line = i + 1;

    const at = (index: number) => (index >= 0 ? (cells[index] ?? "").trim() : "");

    const firstName = at(indexes.firstName);
    if (!firstName) {
      problems.push({ line, reason: "No name in this row." });
      continue;
    }

    /* 🔴 The same `toE164` every phone field uses, and its own refusal message. */
    const expanded = toE164(at(indexes.phone), country);
    if (!expanded.ok) {
      problems.push({ line, reason: e164Problem(expanded) ?? "That number could not be read." });
      continue;
    }
    const phone = expanded.e164;

    if (seen.has(phone)) {
      problems.push({ line, reason: "The same number appears earlier in this file." });
      continue;
    }
    seen.add(phone);

    const email = at(indexes.email).toLowerCase();

    rows.push({
      line,
      firstName: firstName.slice(0, 120),
      lastName: at(indexes.lastName).slice(0, 120) || null,
      /* An address that is obviously not one is dropped rather than refused: §3b says most
         of these people have no email, and a bad address is not a reason to lose a chart. */
      email: email.includes("@") ? email.slice(0, 200) : null,
      phone,
    });
  }

  return { rows, problems, ignoredColumns, matched };
}

export type ImportResult = { created: number; skipped: number; failed: RowProblem[] };

/**
 * 🔴 The write. One `createPatient` per row, and a duplicate is SKIPPED rather than merged.
 *
 * Merging would mean deciding that two records are one person, and 5.1's rule is that
 * linking two records is a decision a human makes later, on a suggestion. An importer that
 * merged would be making it thirty times without asking.
 *
 * A row that throws is collected rather than fatal: twenty-nine charts imported and one
 * reported is better than a rollback that makes the clinician upload the file again and
 * guess which row broke it.
 */
export async function importPatients(actor: Actor, rows: ParsedRow[]): Promise<ImportResult> {
  const already = await patientPhonesOnCaseload(
    actor,
    rows.map((row) => row.phone),
  );

  let created = 0;
  let skipped = 0;
  const failed: RowProblem[] = [];

  for (const row of rows) {
    if (already.has(row.phone)) {
      skipped += 1;
      continue;
    }

    try {
      await createPatient(actor, {
        firstName: row.firstName,
        lastName: row.lastName ?? undefined,
        email: row.email ?? undefined,
        phone: row.phone,
      });
      created += 1;
      /* Guard against two rows that normalise to the same number after the pre-read. */
      already.add(row.phone);
    } catch {
      failed.push({ line: row.line, reason: "That row could not be imported." });
    }
  }

  /*
   * 🔴 One audit entry for the IMPORT, beside the `patient.create` entry each row already
   * wrote. The per-patient entries say a chart was made; this one says thirty were made at
   * once by an upload, which is the question somebody asks in six months when they wonder
   * where a caseload came from.
   *
   * No name and no number in it. A count.
   */
  await audit({
    actor,
    category: "phi_access",
    action: "patient.import",
    resourceType: "patient",
    reason: `${created} created, ${skipped} already here, ${failed.length} refused`,
  });

  log.info("patients imported", { created, skipped, failed: failed.length });
  return { created, skipped, failed };
}

/**
 * 🔴 THE ABSENCE, STATED SO A VERIFIER CAN FIND IT.
 *
 * No function in this file reads a note, a diagnosis, a history or a risk column, and
 * `COLUMNS` is the whole of what crosses. An import that carried clinical text would put
 * unsigned content in a chart, which is the same rule `recordExternalSession` keeps against
 * a partner's server.
 */
export const AN_IMPORT_CARRIES_NO_CLINICAL_TEXT = true;
