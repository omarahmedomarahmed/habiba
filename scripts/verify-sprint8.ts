/**
 * Sprint 8 acceptance, against the real database.
 *
 *   npm run verify:sprint8
 *
 * The pure rules are tested in `tests/documents.test.ts`. What this checks is
 * everything that only exists once there are rows: that ordinals are unique per
 * person, that a citation resolves to *that person's* document and never to
 * somebody else's, that the degraded state really withholds documents from the
 * copilot's context, and that a diagnosis cannot be written without the sentence
 * it came from.
 *
 * It writes. Everything is tagged `verify8-` and removed in the `finally`, and
 * it refuses to run against the production endpoint.
 */
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { connect, schema } from "./db";

const { auditLog, documentChunks, patientAccounts, patients, people } = schema;

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};
const skip = (name: string, why: string) => console.log(`  --   ${name} — NOT EXERCISED: ${why}`);

const TAG = `verify8-${randomUUID().slice(0, 8)}`;

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/:?]+)/)?.[1] ?? "(none)";
  console.log(`writing to ${host}\n`);
  // `ep-wild-lake-a6tgm2r6` is production. Refused by name.
  if (host.includes("ep-wild-lake-a6tgm2r6")) {
    console.error("Refusing to run: that is the production endpoint.");
    process.exit(1);
  }
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const { pool, db } = connect();

  try {
    /* ------------------------------------------------- 8.x the schema is real */

    for (const [table, expected] of [
      ["person_documents", 18],
      ["document_chunks", 6],
      ["person_diagnoses", 12],
      ["content_flags", 10],
    ] as const) {
      const [row] = await db
        .execute<{ n: number }>(
          sql`SELECT COUNT(*)::int AS n FROM information_schema.columns
               WHERE table_schema='public' AND table_name=${table}`,
        )
        .then((r) => r.rows);
      check(`8.1 ${table} exists with ${expected} columns`, row?.n === expected, `${row?.n}`);
    }

    /*
     * 🔴 8.9's structural guarantee. A diagnosis row with no source sentence
     * cannot exist, so "the model inferred it" is impossible rather than
     * merely discouraged.
     */
    const [nullable] = await db
      .execute<{ is_nullable: string }>(
        sql`SELECT is_nullable FROM information_schema.columns
             WHERE table_schema='public' AND table_name='person_diagnoses'
               AND column_name='source_sentence'`,
      )
      .then((r) => r.rows);
    check(
      "8.9 a diagnosis CANNOT be stored without its source sentence",
      nullable?.is_nullable === "NO",
      `is_nullable=${nullable?.is_nullable}`,
    );

    const idx = await db.execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes WHERE schemaname='public'
        AND indexname IN ('person_documents_ordinal_unique','document_chunks_sequence_unique','person_documents_pending_idx')
    `);
    const names = new Set(idx.rows.map((r) => r.indexname));
    check("8.5 ordinals are unique per person", names.has("person_documents_ordinal_unique"));
    check(
      "8.5 chunk sequences are unique per document",
      names.has("document_chunks_sequence_unique"),
    );
    check("8.3 the worker queue has a partial index", names.has("person_documents_pending_idx"));

    /* ------------------------------------------------------- 8.1 / 8.3 adding */

    const { addTextDocument, documentContext, resolveRef, writeChunks, raiseFlag } =
      await import("../lib/data/documents");

    const personA = await newPerson(db);
    const personB = await newPerson(db);
    // One account per person — `patient_accounts_person_unique` — so this is
    // made once and reused rather than created wherever it happens to be needed.
    const accountA = await newAccount(db, personA);

    const first = await addTextDocument({
      personId: personA,
      source: "typed",
      title: "History",
      body: "Referred by Dr Nour in March. Impression: generalised anxiety disorder, moderate. Sleeping four hours a night.",
    });
    check("8.1 a typed document is stored", first.ok === true);
    if (!first.ok) throw new Error(first.error);
    check("8.5 …and gets ordinal 1", first.ordinal === 1, `${first.ordinal}`);

    const second = await addTextDocument({
      personId: personA,
      source: "dictated",
      title: "Session recall",
      body: "Talked about her brother. She has not seen him since the funeral.",
    });
    check(
      "8.5 the next document gets ordinal 2, not a reused one",
      second.ok && second.ordinal === 2,
    );

    // A different person starts again at 1 — the D-number is per person.
    const other = await addTextDocument({
      personId: personB,
      source: "typed",
      title: "Someone else",
      body: "This belongs to a different human being entirely and must never be cited as D1 of person A.",
    });
    check("8.5 a second person's numbering is independent", other.ok && other.ordinal === 1);

    const chunks = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, first.documentId));
    check("8.3 typed text is chunked immediately", (chunks[0]?.n ?? 0) >= 1);

    /* -------------------------------------------------- 8.6 a citation opens */

    const resolved = await resolveRef(personA, { ordinal: 1, sequence: 1 });
    check("8.6 [D1:1] resolves to the passage", resolved?.title === "History", resolved?.title);
    check(
      "8.6 …and the passage text is really in the document",
      Boolean(resolved && resolved.text.includes("Dr Nour")),
    );

    /*
     * The isolation property. Person B also has a D1:1 — resolving person A's
     * ref must never reach it, or one patient's citation would open another's
     * record.
     */
    const crossed = await resolveRef(personB, { ordinal: 1, sequence: 1 });
    check(
      "🔴 8.6 the SAME ref resolves to a different document for a different person",
      crossed !== null && resolved !== null && crossed.documentId !== resolved.documentId,
    );
    check(
      "8.5 a ref that does not exist resolves to nothing rather than to something",
      (await resolveRef(personA, { ordinal: 99, sequence: 99 })) === null,
    );

    /* ------------------------------------- 8.3 re-extraction never leaves stragglers */

    await writeChunks(first.documentId, personA, "One short passage now.");
    const after = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, first.documentId));
    check(
      "8.3 re-chunking replaces the set — no stale passage keeps a live number",
      after[0]?.n === 1,
      `${after[0]?.n} chunk(s)`,
    );

    /* ------------------------------------------------------------- 8.8 flags */

    const [chunk] = await db
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, first.documentId))
      .limit(1);

    const flagged = await raiseFlag({
      personId: personA,
      targetType: "chunk",
      targetId: chunk!.id,
      reason: "outdated",
      byAccountId: accountA,
    });
    check("8.8 a passage can be flagged", flagged.ok === true);

    const crossFlag = await raiseFlag({
      personId: personB,
      targetType: "chunk",
      targetId: chunk!.id,
      reason: "wrong",
    });
    check(
      "🔴 8.8 somebody cannot flag a passage in another person's record",
      crossFlag.ok === false,
    );

    /*
     * A flag never deletes. The passage is still there, and it is still in the
     * copilot's context — marked, because "this is outdated" is information the
     * copilot needs, not a reason to hide the words.
     */
    const stillThere = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(documentChunks)
      .where(eq(documentChunks.id, chunk!.id));
    check("8.8 flagging deletes nothing", stillThere[0]?.n === 1);

    const context = await documentContext(personA);
    check(
      "8.8 …and the flag travels with the passage into the prompt",
      context.text.includes("FLAGGED"),
    );

    /* --------------------------------- 8.9 the refusal that makes this safe */

    const { verbatimIn } = await import("../lib/ai/diagnoses");
    const source = "Impression: generalised anxiety disorder, moderate.";
    check(
      "8.9 a verbatim sentence is accepted",
      verbatimIn(source, `Seen 3 March. ${source} Sleep poor.`),
    );
    check(
      "🔴 8.9 an inferred sentence is refused",
      !verbatimIn("The patient has depression.", "He has been low for months and sleeps badly."),
    );

    /* ------------------------------------- 8.10 / C47 the degraded state bites */

    const [therapist] = await db
      .execute<{ id: string; org: string }>(
        sql`SELECT id, organization_id AS org FROM users WHERE deleted_at IS NULL LIMIT 1`,
      )
      .then((r) => r.rows);

    if (!therapist) {
      skip("8.10 the consent boundary on documents", "no clinician rows in this database");
    } else {
      const patientId = await newPatient(db, therapist.id, therapist.org, personA);

      // Claim the person, keeping nobody. That is the revoked state.
      await db
        .update(people)
        .set({ claimedAt: new Date(), claimedByAccountId: accountA })
        .where(eq(people.id, personA));

      const { accessFor } = await import("../lib/data/grants");
      const actor = {
        userId: therapist.id,
        organizationId: therapist.org,
        role: "therapist" as const,
      };

      const access = await accessFor(actor as never, patientId);
      check(
        "8.10 an unclaimed-then-claimed person leaves the clinician degraded",
        access.state === "revoked",
        access.state,
      );
      check(
        "8.10 …with no right to the patient's files",
        access.capabilities.patientFiles === false,
      );

      /*
       * C47's closure, measured rather than asserted: with `liveProfile` false
       * the copilot's own document assembly returns **nothing**, so the material
       * never enters the prompt. A model cannot leak what it was not given.
       */
      const { __documentsForTest } = await import("../lib/ai/patient-copilot");
      const withheld = await __documentsForTest(patientId, access.capabilities);
      check(
        "🔴 C47 a revoked clinician's copilot is handed NO documents",
        withheld.text === "",
        `${withheld.text.length} chars`,
      );

      const granted = await __documentsForTest(patientId, {
        ...access.capabilities,
        liveProfile: true,
      });
      check(
        "C47 …and a granted one is handed the passages, with markers",
        granted.text.includes("[D1:1]"),
        `${granted.text.length} chars`,
      );

      // And the read route's rule, through the same shared decision function.
      const { documentReadDecision } = await import("../lib/documents/read-access");
      const refused = await documentReadDecision({
        personId: personA,
        uploadedByUserId: null,
        actor: actor as never,
        patient: null,
      });
      check("8.10 the bytes route refuses a revoked clinician", refused.allowed === false);

      const own = await documentReadDecision({
        personId: personA,
        // §3: they keep what they uploaded themselves.
        uploadedByUserId: therapist.id,
        actor: actor as never,
        patient: null,
      });
      check("8.10 …but still serves what they uploaded themselves", own.allowed === true);

      const stranger = await documentReadDecision({
        personId: personB,
        uploadedByUserId: null,
        actor: actor as never,
        patient: null,
      });
      check("8.10 a person they have no record for is a flat refusal", stranger.allowed === false);
    }
  } finally {
    await db
      .delete(auditLog)
      .where(
        sql`resource_id IN (SELECT id FROM person_documents WHERE person_id IN (SELECT id FROM people WHERE last_name = ${TAG}))`,
      );
    await db.delete(patients).where(sql`last_name = ${TAG}`);
    await db.delete(patientAccounts).where(sql`email LIKE ${`${TAG}%`}`);
    // documents, chunks, diagnoses and flags all cascade from people.
    await db.delete(people).where(sql`last_name = ${TAG}`);
    await pool.end();
  }

  console.log(failures === 0 ? "\nsprint 8: PASS" : `\nsprint 8: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

type Db = ReturnType<typeof connect>["db"];

async function newPerson(db: Db): Promise<string> {
  const [row] = await db
    .insert(people)
    .values({ firstName: "Verify", lastName: TAG })
    .returning({ id: people.id });
  return row!.id;
}

async function newAccount(db: Db, personId: string): Promise<string> {
  const [row] = await db
    .insert(patientAccounts)
    .values({
      personId,
      email: `${TAG}-${randomUUID().slice(0, 6)}@example.invalid`,
      passwordHash: "x",
    })
    .returning({ id: patientAccounts.id });
  return row!.id;
}

async function newPatient(
  db: Db,
  therapistId: string,
  organizationId: string,
  personId: string,
): Promise<string> {
  const [row] = await db
    .insert(patients)
    .values({
      organizationId,
      therapistId,
      personId,
      firstName: "Verify",
      lastName: TAG,
      source: "therapist",
    })
    .returning({ id: patients.id });
  return row!.id;
}

main();
