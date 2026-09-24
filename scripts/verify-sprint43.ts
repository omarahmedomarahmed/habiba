/**
 * Sprint 43 acceptance: SMART on FHIR.
 *
 *   npm run verify:sprint43
 *
 * ## 🔴 The two sentences every check here is subordinate to
 *
 * > **43.1b / C266 — a connection is owned by the ORGANIZATION, and a solo therapist is an
 * > organization of one. A therapist leaving a clinic loses that connection immediately.**
 *
 * > **43.4 — in an EHR the chart is THEIR system of record, not ours.**
 *
 * The first is checked by doing it: a clinic, a connection, a clinician, a departure, and then
 * both halves — the departing clinician resolves nothing AND the clinic's connection is still
 * live. The second is checked against the schema and the import lists, because "we do not store
 * their demographics" is only a promise until there is nowhere to put them.
 *
 * ## 🔴 AND BOTH CONSTRAINT-CONTRADICTION AUDITS RUN HERE, EVERY TIME
 *
 * 0078 left two foreign keys on one column and 0082 fixed six columns where `ON DELETE SET NULL`
 * contradicted a CHECK requiring that column non-null. Sibling shapes, and neither audit sees the
 * other's, so both live in `constraintContradictions` and every sprint verifier calls it. Neither
 * check is about this sprint; they live here because these are the sprints that had to fix them.
 */
import { readdirSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { constraintContradictions, readSource, reporter, required, writesTo } from "./_verify";
import { stubModules } from "./_render";

const { check, finish } = reporter();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "drizzle", "public"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

async function main() {
  writesTo();
  await stubModules();

  /*
   * 🔴 C284 — THIS VERIFIER SUPPLIES ITS OWN SEALING KEY RATHER THAN SKIPPING WITHOUT ONE.
   *
   * *A verifier exercises every branch it claims to cover, in one run, whatever the machine is
   * configured with, and a check count that varies by environment is itself the defect.*
   *
   * The walkthrough below stores a credential, so it needs `TOKEN_ENCRYPTION_KEY`. A deployment
   * without one is normal — `features.ehr` reports it and the Connect screen names it — but a
   * verifier that skipped here would report a smaller number of checks on a developer's machine
   * than in CI, and the sprint-53 lesson is that the smaller number is where a real failure hides.
   *
   * `lib/crypto/secretbox.ts` reads the variable on every call rather than at module load,
   * specifically so this works: its own comment says *read AGAIN inside `secretbox.ts`, because a
   * verifier that sets the variable and then imports would otherwise get whatever the process
   * started with.* This is that verifier.
   *
   * A throwaway key, generated per run, so nothing this seals is readable after the process exits
   * and nothing real is sealed with a key that appears in a source file.
   */
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  }

  const { controlDb: db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { EHR_VENDORS, FHIR_VERSION, US_CORE_VERSION, WRITEBACK_STATES } = await import(
    "../lib/db/schema"
  );
  const { REQUESTED_SCOPES, scopesAreMinimal } = await import("../lib/ehr/vendors");
  const { FORBIDDEN_COLUMN_FRAGMENTS, THEIRS_NEVER_OURS, WE_HOLD, RETENTION } = await import(
    "../lib/ehr/policy"
  );

  const files = walk(process.cwd()).map((f) => f.slice(process.cwd().length + 1));
  const tag = `verify43-${randomBytes(4).toString("hex")}`;

  /* ================================================================== */
  /*  0079 · the lesson, audited across the whole database, every run    */
  /* ================================================================== */

  /*
   * 🔴 BOTH CONSTRAINT-CONTRADICTION AUDITS, from `scripts/_verify.ts`.
   *
   * 0078 left two foreign keys on one column; 0082 fixed six columns where `ON DELETE SET NULL`
   * contradicted a CHECK requiring the column non-null. The two shapes are siblings and NEITHER
   * AUDIT SEES THE OTHER'S, which is why they are one function called from every sprint verifier
   * rather than a query somebody remembers to copy.
   *
   * Read by `conrelid` and `conkey`, never by `conname`. That is the lesson rather than the fix.
   */
  const contradictions = await constraintContradictions((query) =>
    db.execute(sql.raw(query)).then((r) => ({ rows: r.rows as Record<string, unknown>[] })),
  );

  check(
    "🔴 0079 / 0082 no constraint on any column contradicts another, in either known shape",
    contradictions.length === 0,
    contradictions.length === 0
      ? "no duplicate foreign key, and no SET NULL against a NOT NULL check"
      : contradictions.map((c) => `[${c.kind}] ${c.detail}`).join(" | "),
  );

  const attestationFks = await db.execute(sql`
    SELECT pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = 'enrolment_attestations' AND c.contype = 'f'
       AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                              WHERE attrelid = t.oid AND attname = 'answered_by_key_id')]::smallint[]`);

  check(
    "🔴 0079 exactly one FK on enrolment_attestations.answered_by_key_id, and it RESTRICTS",
    attestationFks.rows.length === 1 &&
      String(attestationFks.rows[0]?.def ?? "").includes("ON DELETE RESTRICT"),
    `${attestationFks.rows.length} FK(s): ${attestationFks.rows.map((r) => r.def).join(" | ")}`,
  );

  /* ================================================================== */
  /*  43.1b / C266 · the connection is the ORGANISATION'S               */
  /* ================================================================== */

  /*
   * 🔴 NO user_id COLUMN, read from the database rather than from the schema file.
   *
   * The absence is the ruling: with one, the first convenience anybody adds is "let this clinician
   * use their own", and then a therapist leaving a clinic keeps a credential pointed at the
   * hospital's chart.
   */
  const connCols = (
    await db.execute(sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'ehr_connections'`)
  ).rows.map((r) => String(r.column_name));

  check(
    "🔴 43.1b / C266 ehr_connections has NO user column, in any spelling",
    connCols.length > 0 && !connCols.some((c) => /user/.test(c)),
    connCols.join(", "),
  );

  check(
    "🔴 CONTROL …and it DOES have organization_id, so the absence is not an absent table",
    connCols.includes("organization_id"),
    "an absence check against a table that does not exist passes for the wrong reason",
  );

  /*
   * 🔴 AND `meeting_connections` STILL HAS ONE, which is the other half.
   *
   * A Zoom account genuinely is one person's, so that table carries both. A check asserting only
   * that EHR connections lack a user would pass against a build that had removed the column from
   * both, which would break sprint 41's per-clinician revocation.
   */
  const meetCols = (
    await db.execute(sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'meeting_connections'`)
  ).rows.map((r) => String(r.column_name));

  check(
    "🔴 CONTROL …while meeting_connections still has one, because a Zoom account IS one person's",
    meetCols.includes("user_id") && meetCols.includes("organization_id"),
    "two tables, two owners, both correct",
  );

  /* ================================================================== */
  /*  43.4 · the chart is theirs, enforced by there being nowhere to put */
  /* ================================================================== */

  const ehrCols = (
    await db.execute(sql`
    SELECT table_name, column_name FROM information_schema.columns
     WHERE table_name IN ('ehr_connections', 'ehr_launches', 'ehr_writebacks')`)
  ).rows.map((r) => `${r.table_name}.${r.column_name}`);

  const offending = ehrCols.filter((col) =>
    FORBIDDEN_COLUMN_FRAGMENTS.some((fragment) => col.includes(fragment)),
  );

  check(
    "🔴 43.4 no EHR table has a column for anything on THEIRS_NEVER_OURS",
    ehrCols.length > 0 && offending.length === 0,
    offending.length === 0
      ? `${ehrCols.length} columns across three tables, ${THEIRS_NEVER_OURS.length} kinds of datum refused`
      : offending.join(", "),
  );

  /*
   * 🔴 AND THE SWEEP CATCHES A PLANTED ONE, because an absence check over a fragment list that
   * matched nothing would pass against a list of the wrong fragments.
   */
  check(
    "🔴 CONTROL …and the same sweep catches a planted demographic column",
    ["ehr_launches.patient_dob", "ehr_launches.mrn"].every((planted) =>
      FORBIDDEN_COLUMN_FRAGMENTS.some((fragment) => planted.includes(fragment)),
    ),
    "an absence assertion with no positive control is a check that passes when broken",
  );

  /*
   * 🔴 THE READ-THROUGH RULE IS AN IMPORT LIST, so it is checked as one.
   *
   * `lib/ehr/fhir.ts` is the only module that talks to a hospital's FHIR server, and 43.4's third
   * rule is that what it reads is used in the request and never stored. That is a property of its
   * imports: no database handle, no schema table, no `controlDb`.
   */
  const fhir = readSource("lib/ehr/fhir.ts");

  check(
    "🔴 43.4 lib/ehr/fhir.ts imports no database handle, so a read cannot become a row",
    !/from "@\/lib\/db"/.test(fhir) && !/controlDb|dbFor\(/.test(fhir),
    "read through, never store, as a property of the module's import list",
  );

  check(
    "🔴 CONTROL …and it DOES fetch, so the absence is not an empty module",
    /await fetch\(/.test(fhir) && /READ_THROUGH_IS_NEVER_STORED = true/.test(fhir),
    "it reads a name and files a document, and stores neither",
  );

  /*
   * 🔴 AND `readPatientName` RETURNS A STRING, not a resource.
   *
   * The `Patient` resource it parses carries birthDate, identifier, address, telecom and contact
   * on any real tenant. A function returning the resource would invite a caller to keep them, and
   * the caller would be right that it was convenient. A narrow return type is the decision
   * enforced at every call site rather than once here.
   */
  check(
    "🔴 43.4 readPatientName returns a name, never a Patient resource",
    /Promise<\{ name\?: string; error\?: string \}>/.test(fhir) &&
      !/Promise<\{ patient/.test(fhir),
    "the rest of the resource is in memory for one function and in no row ever",
  );

  check(
    "🔴 43.4 the retention decision is two clocks, and the link is the one that dies",
    RETENTION.linkOutlivesConnection === false &&
      RETENTION.clinicalRecordOutlivesConnection === true &&
      RETENTION.readThroughIsStored === false,
    "what we produced answers to the patient; the mapping answers to the connection",
  );

  check(
    "🔴 43.4 every table WE_HOLD names exists, so the decision is checkable rather than believed",
    WE_HOLD.length > 0,
    `${WE_HOLD.length} kinds of datum we hold, each naming its table`,
  );

  const heldTables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY(${sql.raw(
       `ARRAY[${WE_HOLD.map((h) => `'${h.table}'`).join(",")}]`,
     )})`);

  check(
    "🔴 CONTROL …and the database really has all of them",
    heldTables.rows.length === new Set(WE_HOLD.map((h) => h.table)).size,
    `${heldTables.rows.length} of ${new Set(WE_HOLD.map((h) => h.table)).size} present`,
  );

  /* ================================================================== */
  /*  43.2 · the scopes we do not ask for                                */
  /* ================================================================== */

  check(
    "🔴 43.2 the requested scopes pass the minimality guard",
    scopesAreMinimal(REQUESTED_SCOPES),
    REQUESTED_SCOPES.join(" "),
  );

  /*
   * 🔴 AND THE GUARD REFUSES WHAT EVERY SMART TUTORIAL ASKS FOR.
   *
   * `patient/*.read` is the normal request and a hospital's security review would grant it. From
   * that moment the only thing stopping us holding a duplicate chart is that we happen not to.
   * A `user/` scope is everything the clinician can see across every patient, which is a caseload.
   * A `Condition.write` puts a diagnosis in a chart that no human approved the wording of.
   */
  const planted: [string, string][] = [
    ["patient/" + "*.read", "the wildcard read every tutorial asks for"],
    ["user/Patient.read", "a user scope, which is a caseload rather than one chart"],
    ["patient/Condition.write", "writing a diagnosis nobody signed"],
    ["patient/Observation.write", "writing a measurement nobody signed"],
  ];

  for (const [scope, why] of planted) {
    check(
      `🔴 43.2 the guard refuses ${scope}, which is ${why}`,
      !scopesAreMinimal([scope]),
      "refused at the exchange, not merely unused: an unused permission is one the next author revisits",
    );
  }

  check(
    "🔴 CONTROL …and it accepts the four we actually need, so it is not refusing everything",
    scopesAreMinimal(["launch/patient", "patient/Patient.read", "patient/DocumentReference.write", "offline_access"]),
    "a guard that refuses every scope would pass every check above",
  );

  const smart = readSource("lib/ehr/smart.ts");

  check(
    "🔴 43.2 the granted scopes are re-checked at the exchange, not only at the request",
    /scopesAreMinimal\(granted\)/.test(smart),
    "some tenants grant what an administrator configured rather than what the request said",
  );

  check(
    "🔴 43.2 PKCE S256, always, because the code travels through a browser",
    /createHash\("sha256"\)\.update\(verifier\)/.test(smart) &&
      /code_challenge_method", "S256"/.test(smart),
    "a secret stops a stranger redeeming a captured code; PKCE stops the code being redeemable",
  );

  check(
    "🔴 43.2 the discovered endpoints are re-checked for https AND for the base URL's origin",
    /origin !== baseOrigin/.test(smart),
    "discovery output is a document a hospital serves, so it is data from outside",
  );

  check(
    "🔴 43.2 `aud` is sent, so an authorisation for one hospital cannot be replayed at another",
    /searchParams\.set\("aud"/.test(smart),
    "not optional in SMART, and it is what binds the token to the audience asked for",
  );

  check(
    "🔴 43.2 FHIR R4 and US Core are PINNED, because 'latest' is a contract that moves",
    FHIR_VERSION === "4.0.1" && US_CORE_VERSION === "6.1.0",
    `FHIR ${FHIR_VERSION}, US Core ${US_CORE_VERSION}`,
  );

  check(
    "🔴 43.2 no vendor URL is hard-coded, because two Epic hospitals share no endpoint",
    !/https:\/\/(?!www\.hl7|loinc)/.test(readSource("lib/ehr/vendors.ts")),
    `${EHR_VENDORS.length} vendors, all discovering their own endpoints`,
  );

  /* ================================================================== */
  /*  43.3 · only an approved note files, and the author is never us     */
  /* ================================================================== */

  const fileNote = readSource("lib/ehr/file-note.ts");

  check(
    "🔴 43.3 all three approval conditions are in the WHERE, never checked after the read",
    /eq\(sessionNotes\.status, "approved"\)/.test(fileNote) &&
      /isNotNull\(sessionNotes\.approvedAt\)/.test(fileNote) &&
      /isNotNull\(sessionNotes\.approvedBy\)/.test(fileNote),
    "each of the three has been null on its own in this schema's history",
  );

  check(
    "🔴 43.3 the author is the clinician or nobody, and never this application",
    /authorReference: null/.test(fileNote) && /resource\.author = /.test(fhir),
    "an application-authored note is a note in a chart with no human name on it",
  );

  check(
    "🔴 43.3 DocumentReference is the only resource written, matching the only write scope",
    (fhir.match(/method: "POST"/g) ?? []).length === 1 && /\/DocumentReference`/.test(fhir),
    "a Condition.write would put a diagnosis in a chart that no human approved",
  );

  check(
    "🔴 43.3 the id is read from the body AND the Location header, because vendors differ",
    /fromBody \?\? fromHeader/.test(fhir),
    "a 201 with neither is reported as a failure rather than optimistically marked filed",
  );

  check(
    "🔴 43.3 the writeback states are three, and a filing is idempotent on the note",
    WRITEBACK_STATES.length === 3 && /onConflictDoNothing/.test(fileNote),
    WRITEBACK_STATES.join(", "),
  );

  /* ---- the constraints, read unconditionally rather than attempted (C284) ---- */

  for (const [name, must] of [
    ["ehr_connections_https", "https://"],
    ["ehr_connections_revoked_holds_no_secret", "access_token_sealed"],
    ["ehr_launches_severed_holds_no_foreign_id", "fhir_patient_id"],
    ["ehr_writebacks_filed_names_document", "fhir_document_reference_id"],
  ] as const) {
    const row = await db.execute(sql`
      SELECT pg_get_constraintdef(oid) AS def, convalidated FROM pg_constraint
       WHERE conname = ${name}`);

    check(
      `🔴 43.1 ${name} exists, says what it should, and is VALIDATED`,
      String(row.rows[0]?.def ?? "").includes(must) && row.rows[0]?.convalidated === true,
      String(row.rows[0]?.def ?? "") || "constraint not found",
    );
  }

  /* ================================================================== */
  /*  The planted walkthrough: a clinic, a connection, and a departure   */
  /* ================================================================== */

  const [clinic] = (
    await db.execute(sql`
    INSERT INTO organizations (name, slug, kind, clinic_state)
    VALUES (${tag}, ${tag}, 'clinic', 'active') RETURNING id`)
  ).rows as { id: string }[];

  const clinicId = required(clinic, "organizations row it just inserted").id;

  try {
    const { completeConnection, liveConnection, revokeConnectionsFor, connectionsFor } =
      await import("../lib/data/ehr");
    const { removeClinician } = await import("../lib/data/clinic-admin");

    const connected = await completeConnection({
      organizationId: clinicId,
      vendor: "smart_sandbox",
      fhirBaseUrl: "https://launch.smarthealthit.org/v/r4/fhir",
      issuer: "https://launch.smarthealthit.org",
      accessToken: `${tag}-access`,
      refreshToken: `${tag}-refresh`,
      /* An hour out, so `liveConnection` does not try to refresh against a real server. */
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      scopes: [...REQUESTED_SCOPES],
      tenantLabel: "Verify Hospital",
    });

    check(
      "🔴 43.1 a connection is created and owned by the ORGANISATION",
      Boolean(connected.connectionId),
      connected.error ?? "one row, one owner",
    );

    /* 🔴 The sealed columns are never on a screen's select list. */
    const screenRows = await connectionsFor(clinicId);

    check(
      "🔴 43.1 connectionsFor selects no token column, sealed or otherwise",
      screenRows.length === 1 &&
        !Object.keys(screenRows[0] ?? {}).some((k) => /token|sealed|secret/i.test(k)),
      Object.keys(screenRows[0] ?? {}).join(", "),
    );

    const clinicianEmail = `${tag}@example.com`;
    const [clinician] = (
      await db.execute(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, verification_status,
                         password_hash)
      VALUES (${clinicId}, ${clinicianEmail}, 'Verify', 'FortyThree', 'therapist', 'verified',
              'not-a-hash-this-account-cannot-sign-in')
      RETURNING id`)
    ).rows as { id: string }[];

    const clinicianId = required(clinician, "users row it just inserted").id;

    const before = await liveConnection(clinicId);

    check(
      "🔴 43.1 a clinician under the clinic resolves the clinic's connection",
      before !== null && before.accessToken === `${tag}-access`,
      before ? "unsealed for one request, and never selected onto a screen" : "no connection",
    );

    /*
     * 🔴 43.1b — THE DEPARTURE, AND BOTH HALVES.
     *
     * The first half is the ticket: *a therapist leaving a clinic loses that connection
     * immediately, without a question, because the credential was the hospital's.*
     *
     * The second half is the bug the obvious fix would have introduced. Revoking
     * `ehr_connections` for the organisation on a departure would disconnect the HOSPITAL because
     * one therapist left, taking note filing away from every other clinician under it. So the
     * control is not decoration: it is the assertion that the departure was scoped to the person.
     */
    const removed = await removeClinician({
      clinicOrganizationId: clinicId,
      userId: clinicianId,
    });

    check(
      "🔴 43.1b the departure completes",
      removed.ok === true,
      removed.error ?? "reparented to an organisation of one",
    );

    const [reparented] = (
      await db.execute(sql`SELECT organization_id FROM users WHERE id = ${clinicianId}`)
    ).rows as { organization_id: string }[];

    const soloOrgId = required(reparented, "the reparented user").organization_id;

    check(
      "🔴 43.1b …and they are in a new organisation, not the clinic's",
      soloOrgId !== clinicId,
      "C266's organisation of one",
    );

    const theirs = await liveConnection(soloOrgId);

    check(
      "🔴 43.1b / C266 the departed clinician resolves NO connection, with no code to revoke it",
      theirs === null,
      "ehr_connections has no user_id, so there was never anything of theirs to hold",
    );

    const clinicStill = await liveConnection(clinicId);

    check(
      "🔴 CONTROL …while the CLINIC's connection is still live, because one therapist left",
      clinicStill !== null && clinicStill.accessToken === `${tag}-access`,
      "revoking the organisation's credential on a departure would disconnect the hospital",
    );

    /*
     * 🔴 43.4's SECOND CLOCK, EXERCISED: a revoke severs every link under it.
     *
     * Planted as a launch with a foreign patient id, then revoked, then read back. And the
     * constraint `ehr_launches_severed_holds_no_foreign_id` means a sever that silently did not
     * run would be refused by the database rather than merely unnoticed.
     */
    const connectionId = required(
      (
        await db.execute(sql`
        SELECT id FROM ehr_connections WHERE organization_id = ${clinicId} AND revoked_at IS NULL`)
      ).rows[0] as { id: string } | undefined,
      "the live connection",
    ).id;

    await db.execute(sql`
      INSERT INTO ehr_launches (connection_id, user_id, fhir_patient_id, fhir_encounter_id)
      VALUES (${connectionId}, ${clinicianId}, 'THEIR-PATIENT-12345', 'THEIR-ENCOUNTER-9')`);

    const revoked = await revokeConnectionsFor(clinicId, null, `${tag} verification`);

    check(
      "🔴 43.4 revoking severs the launches under it, and says how many",
      revoked.revoked === 1 && revoked.severed === 1,
      `${revoked.revoked} connection(s), ${revoked.severed} launch(es)`,
    );

    const after = (
      await db.execute(sql`
      SELECT fhir_patient_id, fhir_encounter_id, severed_at, patient_id
        FROM ehr_launches WHERE connection_id = ${connectionId}`)
    ).rows as {
      fhir_patient_id: string | null;
      fhir_encounter_id: string | null;
      severed_at: string | null;
      patient_id: string | null;
    }[];

    check(
      "🔴 43.4 after a revoke, no launch holds a hospital's identifier",
      after.length === 1 &&
        after[0]!.fhir_patient_id === null &&
        after[0]!.fhir_encounter_id === null &&
        after[0]!.severed_at !== null,
      "we must not be able to resolve their patient ids once they have disconnected",
    );

    const credential = (
      await db.execute(sql`
      SELECT access_token_sealed, refresh_token_sealed, revoked_reason
        FROM ehr_connections WHERE id = ${connectionId}`)
    ).rows[0] as {
      access_token_sealed: string | null;
      refresh_token_sealed: string | null;
      revoked_reason: string | null;
    };

    check(
      "🔴 CONTROL …and the row keeps the FACT without keeping the credential",
      credential.access_token_sealed === null &&
        credential.refresh_token_sealed === null &&
        credential.revoked_reason !== null,
      "a note filed through a removed connection must still be explainable a year later",
    );

    /*
     * 🔴 THE CONSTRAINT, EXERCISED AGAINST A PLANTED OFFENDER.
     *
     * A severed launch that still holds a foreign id must be refused by the DATABASE, because
     * `revokeConnectionsFor` running is a behaviour and this is a rule.
     */
    let refused = false;
    try {
      await db.execute(sql`
        UPDATE ehr_launches SET fhir_patient_id = 'PUT-IT-BACK'
         WHERE connection_id = ${connectionId}`);
    } catch {
      refused = true;
    }

    check(
      "🔴 43.4 asserted by the write: a severed launch cannot be given a foreign id back",
      refused,
      "the constraint, exercised rather than read: a sever that did not run looks like one that did",
    );

    /* 🔴 CONTROL — the same UPDATE on a NOT-severed launch is accepted, so the refusal above is
       the constraint doing its job rather than the UPDATE being malformed. */
    const [fresh] = (
      await db.execute(sql`
      INSERT INTO ehr_connections (organization_id, vendor, fhir_base_url, issuer)
      VALUES (${clinicId}, 'epic', 'https://example.org/fhir', 'https://example.org')
      RETURNING id`)
    ).rows as { id: string }[];

    const freshId = required(fresh, "a second connection").id;

    await db.execute(sql`
      INSERT INTO ehr_launches (connection_id, user_id, fhir_patient_id)
      VALUES (${freshId}, ${clinicianId}, 'STILL-LIVE-1')`);

    let accepted = false;
    try {
      await db.execute(sql`
        UPDATE ehr_launches SET fhir_patient_id = 'STILL-LIVE-2'
         WHERE connection_id = ${freshId}`);
      accepted = true;
    } catch {
      accepted = false;
    }

    check(
      "🔴 CONTROL …while a live launch's foreign id can still be updated",
      accepted,
      "otherwise the refusal proves only that the UPDATE was wrong",
    );

    /*
     * 🔴 W1-22: DISCONNECT REVOKES THE CONNECTION THAT WAS CHOSEN, AND NO OTHER.
     *
     * The clinic's Disconnect posted a `connectionId` and the action ignored it,
     * revoking every live connection the practice had. Two live, one chosen.
     */
    const [other] = (
      await db.execute(sql`
      INSERT INTO ehr_connections (organization_id, vendor, fhir_base_url, issuer)
      VALUES (${clinicId}, 'cerner', 'https://example.com/fhir', 'https://example.com')
      RETURNING id`)
    ).rows as { id: string }[];
    const otherId = required(other, "a third connection").id;

    const chosen = await revokeConnectionsFor(clinicId, null, `${tag} one of two`, freshId);
    const stillLive = (
      await db.execute(sql`
      SELECT id FROM ehr_connections WHERE organization_id = ${clinicId} AND revoked_at IS NULL`)
    ).rows as { id: string }[];

    check(
      "🔴 W1-22 disconnecting one connection leaves the other live",
      chosen.revoked === 1 && stillLive.length === 1 && stillLive[0]!.id === otherId,
      `${chosen.revoked} revoked, ${stillLive.length} still live`,
    );

    const clinicActions = readSource("app/(clinic)/clinic/records/actions.ts");
    const panelSource = readSource("components/ehr/records-panel.tsx");
    const clinicPage = readSource("app/(clinic)/clinic/records/page.tsx");

    check(
      "🔴 W1-22 the clinic's disconnect is admin-only, reads the chosen id, and asks first",
      /disconnect\([^)]*formData/.test(clinicActions) &&
        /requireClinicAdmin\(\)[\s\S]{0,400}connectionId/.test(clinicActions) &&
        /canManage=\{actor\.role === "admin"\}/.test(clinicPage) &&
        /(records|w1a|tacct)\.disconnectConfirm/.test(panelSource),
      "one connection, by the admin, after a confirm",
    );

    /*
     * 🔴 AND THE https CHECK, EXERCISED, because the sandbox is deliberately not exempt.
     */
    let httpRefused = false;
    try {
      await db.execute(sql`
        INSERT INTO ehr_connections (organization_id, vendor, fhir_base_url, issuer)
        VALUES (${clinicId}, 'smart_sandbox', 'http://insecure.example.org/fhir', 'https://x.example.org')`);
    } catch {
      httpRefused = true;
    }

    check(
      "🔴 43.1 asserted by the write: an http FHIR base URL is refused, sandbox included",
      httpRefused,
      "an exemption for testing is the exemption that reaches production",
    );

    /* ---- 43.1c · same flow, two homes ---- */

    check(
      "🔴 43.1c the Connect surface exists in the clinic portal AND in settings",
      files.includes("app/(clinic)/clinic/records/page.tsx") &&
        files.includes("app/(app)/settings/records/page.tsx"),
      "two homes for one flow, because a solo therapist is an organisation of one",
    );

    check(
      "🔴 CONTROL …and both reach the SAME module, rather than each having its own",
      ["app/(clinic)/clinic/records/page.tsx", "app/(app)/settings/records/page.tsx"]
        .filter((f) => files.includes(f))
        .every((f) => /lib\/data\/ehr/.test(readSource(f))),
      "two flows would be two places for C266 to be got wrong",
    );
  } finally {
    /* Everything this run made, in dependency order. */
    await db.execute(sql`DELETE FROM ehr_writebacks WHERE connection_id IN
      (SELECT id FROM ehr_connections WHERE organization_id IN
        (SELECT id FROM organizations WHERE name LIKE 'verify43-%'))`);
    await db.execute(sql`DELETE FROM ehr_launches WHERE user_id IN
      (SELECT id FROM users WHERE email LIKE '%verify43-%')`);
    await db.execute(sql`DELETE FROM ehr_connections WHERE organization_id IN
      (SELECT id FROM organizations WHERE name LIKE 'verify43-%')`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE '%verify43-%'`);
    await db.execute(sql`DELETE FROM organizations WHERE name LIKE 'verify43-%'`);
  }

  finish("sprint 43");
}

void main();
