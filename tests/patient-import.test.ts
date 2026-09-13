import assert from "node:assert/strict";
import { test } from "node:test";

import { parseImport } from "../lib/data/patient-import";

/**
 * The CSV importer's parser. PLAN.md 55.11, 42.8, C64.
 *
 * `parseImport` is pure on purpose — no database, no `Actor`, no writes — so the half of the
 * importer that decides what a file MEANS is testable without a fixture, and the half that
 * writes takes rows rather than a file.
 *
 * ## 🔴 What these tests are actually defending
 *
 * The importer's failure mode is not a crash. It is a mis-read file producing thirty charts
 * with the wrong names or numbers on them, silently, for real people. Every case below is one
 * of those:
 *
 *   - a quoted comma, which `split(",")` turns into a surname in the email column
 *   - a local number, which is most of this book (§3b) and which the first draft refused
 *   - a notes column, which must be NAMED as dropped rather than quietly ignored
 */

const EG = "EG";

test("a quoted comma does not become a second column", () => {
  const result = parseImport(
    ['name,last name,phone', '"Nour, the elder",Hassan,+201001234567'].join("\n"),
    EG,
  );

  assert.ok(!("error" in result));
  assert.equal(result.rows.length, 1);
  /*
   * The name keeps its comma. `split(",")` would have made "Nour" the first name and " the
   * elder" the surname, pushing Hassan into the phone column and the number out of the row.
   */
  assert.equal(result.rows[0]!.firstName, "Nour, the elder");
  assert.equal(result.rows[0]!.lastName, "Hassan");
  assert.equal(result.rows[0]!.phone, "+201001234567");
});

test("a doubled quote inside a quoted field is one literal quote", () => {
  const result = parseImport(['name,phone', '"Ali ""Abu"" Hassan",+201001234567'].join("\n"), EG);

  assert.ok(!("error" in result));
  assert.equal(result.rows[0]!.firstName, 'Ali "Abu" Hassan');
});

test("🔴 C64 a local number is expanded using the country the clinician chose", () => {
  const result = parseImport(["name,phone", "Nour,01001234567"].join("\n"), EG);

  assert.ok(!("error" in result));
  assert.equal(result.rows.length, 1, "a national number must not be refused");
  /*
   * 🔴 This is the case my first draft got wrong, and it is the common one. That draft wrote its
   * own normaliser accepting only `+` and `00` prefixes, which looked safe because it guessed
   * nothing — and refused every `01…` number in an Egyptian clinician's export, which is nearly
   * all of them. The importer would have reported almost every row as a bad number.
   */
  assert.equal(result.rows[0]!.phone, "+201001234567");
});

test("🔴 C64 the same digits under a different country are a different person", () => {
  const egypt = parseImport(["name,phone", "Nour,01001234567"].join("\n"), "EG");
  const italy = parseImport(["name,phone", "Nour,01001234567"].join("\n"), "IT");

  assert.ok(!("error" in egypt));
  assert.ok(!("error" in italy));
  assert.notEqual(
    egypt.rows[0]!.phone,
    italy.rows[0]!.phone,
    "if these matched, the country selector would be decoration",
  );
});

test("a number already in international form keeps its own country code", () => {
  /* The file's country is Egypt; this row is a British number and must stay one. */
  const result = parseImport(["name,phone", "Nour,+447700900123"].join("\n"), EG);

  assert.ok(!("error" in result));
  assert.equal(result.rows[0]!.phone, "+447700900123");
});

test("a row with no readable number is refused with a reason, not imported blank", () => {
  const result = parseImport(
    ["name,phone", "Nour,+201001234567", "Mona,12", "Omar,"].join("\n"),
    EG,
  );

  assert.ok(!("error" in result));
  assert.equal(result.rows.length, 1, "only the good row crosses");
  assert.equal(result.problems.length, 2);
  /* A reason a clinician can act on, from `e164Problem`, rather than the word "invalid". */
  for (const problem of result.problems) assert.ok(problem.reason.length > 10);
});

test("🔴 the columns it drops are NAMED, so a notes column is not silently lost", () => {
  const result = parseImport(
    [
      "First Name,Last Name,Email,Phone,Notes,Diagnosis,Risk flag",
      "Nour,Hassan,nour@example.com,+201001234567,Doing better this week,F41.1,low",
    ].join("\n"),
    EG,
  );

  assert.ok(!("error" in result));
  assert.equal(result.rows.length, 1);

  /*
   * 🔴 The four that cross, and the three that do not. Clinical text in a record needs a
   * clinician who approved that exact wording (§7), and nobody approved a spreadsheet cell.
   */
  assert.deepEqual(result.rows[0], {
    line: 2,
    firstName: "Nour",
    lastName: "Hassan",
    email: "nour@example.com",
    phone: "+201001234567",
  });

  assert.deepEqual(result.ignoredColumns.sort(), ["Diagnosis", "Notes", "Risk flag"]);
});

test("the same number twice in one file is reported rather than imported twice", () => {
  const result = parseImport(
    ["name,phone", "Nour,+201001234567", "Nour Hassan,+20 100 123 4567"].join("\n"),
    EG,
  );

  assert.ok(!("error" in result));
  assert.equal(result.rows.length, 1, "punctuation differences are the same number");
  assert.equal(result.problems.length, 1);
});

test("a file with no name column or no phone column is refused as a whole", () => {
  const noName = parseImport(["email,phone", "a@b.com,+201001234567"].join("\n"), EG);
  const noPhone = parseImport(["name,email", "Nour,a@b.com"].join("\n"), EG);

  assert.ok("error" in noName);
  assert.ok("error" in noPhone);
});

test("an address that is not one is dropped, and the row still crosses", () => {
  /*
   * §3b: 56 of 66 patients have no email. A bad address must not cost a chart, which is why
   * this is a drop rather than a problem.
   */
  const result = parseImport(["name,email,phone", "Nour,none,+201001234567"].join("\n"), EG);

  assert.ok(!("error" in result));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.email, null);
});

test("CRLF, a BOM and a missing final newline are all read", () => {
  const result = parseImport(
    "﻿name,phone\r\nNour,+201001234567\r\nMona,+201001234568",
    EG,
  );

  assert.ok(!("error" in result));
  assert.equal(result.rows.length, 2, "Excel writes a BOM and CRLF, and both landed on row one");
  assert.equal(result.rows[0]!.firstName, "Nour", "the BOM must not stick to the first header");
});

test("the line numbers match what a spreadsheet shows", () => {
  const result = parseImport(
    ["name,phone", "Nour,+201001234567", "Mona,nonsense"].join("\n"),
    EG,
  );

  assert.ok(!("error" in result));
  /* Header is line 1, so the first data row is line 2. */
  assert.equal(result.rows[0]!.line, 2);
  assert.equal(result.problems[0]!.line, 3);
});
