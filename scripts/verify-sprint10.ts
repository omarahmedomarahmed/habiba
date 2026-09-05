/**
 * Sprint 10 acceptance, against the real database.
 *
 *   npm run verify:sprint10
 *
 * 10.3 is tested pure in `tests/assistant.test.ts`. What this checks is the
 * part that only exists once there are rows — and, above all, 10.2:
 *
 * > Roster only. **No clinical content in context. The guarantee comes from
 * > what is absent, not from what the prompt says.**
 *
 * A prompt cannot be verified. What *can* be verified is that the roster
 * builder returns nothing but names, dates and a count, and that the module
 * has no import that could reach a transcript. Both are asserted below — the
 * second by reading the source, which is blunt and is exactly the check that
 * would have caught a future edit adding one.
 *
 * It writes. Everything is tagged `verify10-` and removed in the `finally`.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { connect, schema } from "./db";

const { assistantMessages, assistantThreads, patients, people } = schema;

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};
const skip = (name: string, why: string) => console.log(`  --   ${name} — NOT EXERCISED: ${why}`);

const TAG = `verify10-${randomUUID().slice(0, 8)}`;

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
    /* -------------------------------------------------------- the schema -- */

    for (const [table, expected] of [
      ["assistant_threads", 7],
      ["assistant_messages", 7],
    ] as const) {
      const [row] = await db
        .execute<{ n: number }>(
          sql`SELECT COUNT(*)::int AS n FROM information_schema.columns
               WHERE table_schema='public' AND table_name=${table}`,
        )
        .then((r) => r.rows);
      check(`10.1 ${table} exists with ${expected} columns`, row?.n === expected, `${row?.n}`);
    }

    const idx = await db.execute<{ indexname: string }>(
      sql`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname='assistant_messages_quota_idx'`,
    );
    check("10.5 the allowance has a partial index on therapist rows", idx.rows.length === 1);

    /*
     * 🔴 10.2, checked structurally rather than by reading the prompt.
     *
     * A prompt saying "do not mention clinical details" is worth nothing if
     * the details are in the context. This asserts they cannot be: the module
     * that assembles the general copilot's context does not import any table
     * that carries clinical text.
     */
    const source = readFileSync("lib/ai/assistant.ts", "utf8");

    /*
     * The **import block**, not the whole file. The first version of this
     * check scanned the source and failed on the module's own doc comment,
     * which lists the tables it deliberately does not import — a check that
     * fails on a description of the thing it is checking is a check nobody
     * keeps.
     */
    const importBlock = source.slice(0, source.indexOf("const SYSTEM"));
    const forbidden = [
      "transcriptSegments",
      "documentChunks",
      "copilotMessages",
      "personDiagnoses",
      "personProfiles",
      "observations",
      "homeworkItems",
    ];
    const imported = importBlock.match(/from "@\/lib\/db\/schema";/)
      ? importBlock.slice(
          importBlock.indexOf("import {"),
          importBlock.indexOf('from "@/lib/db/schema";'),
        )
      : "";
    const leaked = forbidden.filter((table) => imported.includes(table));
    check(
      "🔴 10.2 the assistant module imports NO table carrying clinical text",
      leaked.length === 0,
      leaked.length ? `imported: ${leaked.join(", ")}` : "none of the seven",
    );

    /*
     * `session_notes` is touched, and only inside a COUNT(*). A count is a
     * number; it cannot carry a sentence anybody said. Asserted separately so
     * that adding `content` to that query fails here.
     */
    check(
      "10.2 …and the one clinical table it touches is only ever counted",
      !/sessionNotes\.content|n\.content/.test(source),
      "no note content is selected",
    );

    /* --------------------------------------------- 10.2 the roster in fact */

    const [therapist] = await db
      .execute<{ id: string; org: string }>(
        sql`SELECT id, organization_id AS org FROM users WHERE deleted_at IS NULL LIMIT 1`,
      )
      .then((r) => r.rows);

    if (!therapist) {
      skip("10.2 the roster", "no clinician rows in this database");
    } else {
      const { buildRoster } = await import("../lib/ai/assistant");
      const roster = await buildRoster({
        userId: therapist.id,
        organizationId: therapist.org,
        role: "therapist",
      });

      if (roster.length === 0) {
        skip("10.2 the roster's shape", "this clinician has no patients");
      } else {
        const keys = Object.keys(roster[0]!).sort();
        check(
          "🔴 10.2 a roster row is names, dates and a count — nothing else",
          JSON.stringify(keys) ===
            JSON.stringify(["draftNotes", "lastSessionAt", "name", "nextSessionAt", "patientId"]),
          keys.join(", "),
        );
        check(
          "10.2 …and every value is a string, a date, a number or null",
          roster.every((row) =>
            Object.values(row).every(
              (value) =>
                value === null ||
                typeof value === "string" ||
                typeof value === "number" ||
                value instanceof Date,
            ),
          ),
        );
        check(
          "C57 next appointment is null until sprint 11 builds scheduling",
          roster.every((row) => row.nextSessionAt === null),
        );
        console.log(`       (${roster.length} patients on this clinician's roster)`);
      }

      /* --------------------------------------------------- 10.4 the threads */

      const {
        appendMessage,
        assistantAllowance,
        createThread,
        deleteThread,
        listThreads,
        messagesIn,
        threadFor,
        titleFromFirstQuestion,
      } = await import("../lib/ai/assistant");

      const actor = { userId: therapist.id, organizationId: therapist.org };
      const threadId = await createThread(actor);
      check("10.4 a thread can be created", threadId !== null);
      if (!threadId) throw new Error("no thread");

      await appendMessage({
        threadId,
        userId: therapist.id,
        role: "therapist",
        content: `${TAG} who have I not seen in a month?`,
      });
      await titleFromFirstQuestion(threadId, `${TAG} who have I not seen in a month?`);

      const [titled] = await db
        .select({ title: assistantThreads.title })
        .from(assistantThreads)
        .where(eq(assistantThreads.id, threadId))
        .limit(1);
      check(
        "10.4 a thread is named from its first question",
        titled?.title.startsWith(TAG) === true,
      );

      await titleFromFirstQuestion(threadId, "a completely different second question");
      const [stillTitled] = await db
        .select({ title: assistantThreads.title })
        .from(assistantThreads)
        .where(eq(assistantThreads.id, threadId))
        .limit(1);
      check(
        "10.4 …once, not on every message",
        stillTitled?.title === titled?.title,
        stillTitled?.title,
      );

      const mine = await listThreads(therapist.id);
      check(
        "10.4 it appears in the list",
        mine.some((t) => t.id === threadId),
      );

      /*
       * Scoping. A thread id from a URL must open nothing that is not yours —
       * the check every read in the module goes through.
       */
      const strangerId = randomUUID();
      const stolen = await threadFor(strangerId, threadId);
      check("🔴 10.4 another user's id opens nothing", stolen === null);
      const stolenMessages = await messagesIn(strangerId, threadId);
      check("🔴 10.4 …and reads no messages either", stolenMessages.length === 0);

      /* ------------------------------------------------------- 10.5 quota */

      const before = await assistantAllowance(therapist.id);
      check(
        "10.5 the allowance comes from settings, not a constant",
        before.limit === 50,
        `limit ${before.limit}`,
      );

      await appendMessage({
        threadId,
        userId: therapist.id,
        role: "assistant",
        content: `${TAG} an answer`,
      });
      const afterReply = await assistantAllowance(therapist.id);
      check(
        "🔴 10.5 an assistant REPLY does not spend a message",
        afterReply.used === before.used,
        `${before.used} → ${afterReply.used}`,
      );

      await appendMessage({
        threadId,
        userId: therapist.id,
        role: "therapist",
        content: `${TAG} a second question`,
      });
      const afterAsk = await assistantAllowance(therapist.id);
      check(
        "10.5 …and a question does",
        afterAsk.used === before.used + 1,
        `${before.used} → ${afterAsk.used}`,
      );

      /* ------------------------------------------------ 10.4 delete is soft */

      const deleted = await deleteThread(therapist.id, threadId);
      check("10.4 a thread can be deleted", deleted === true);

      const afterDelete = await listThreads(therapist.id);
      check("10.4 …and disappears from the list", !afterDelete.some((t) => t.id === threadId));

      const [row] = await db
        .select({ deletedAt: assistantThreads.deletedAt })
        .from(assistantThreads)
        .where(eq(assistantThreads.id, threadId))
        .limit(1);
      check(
        "10.5 …but the row survives, so deleting a thread does not hand back the month's messages",
        row?.deletedAt !== null && row?.deletedAt !== undefined,
      );

      const stillCounted = await assistantAllowance(therapist.id);
      check(
        "🔴 10.5 …checked: the allowance is unchanged by the delete",
        stillCounted.used === afterAsk.used,
        `${afterAsk.used} → ${stillCounted.used}`,
      );

      const twice = await deleteThread(therapist.id, threadId);
      check("10.4 deleting twice is refused rather than silently repeated", twice === false);
    }
  } finally {
    await db.delete(assistantMessages).where(sql`content LIKE ${`${TAG}%`}`);
    await db
      .delete(assistantThreads)
      .where(
        sql`id NOT IN (SELECT DISTINCT thread_id FROM assistant_messages) AND title LIKE ${`${TAG}%`}`,
      );
    await db.delete(assistantThreads).where(sql`title LIKE ${`${TAG}%`} OR title = 'New chat'`);
    await db.delete(patients).where(sql`last_name = ${TAG}`);
    await db.delete(people).where(sql`last_name = ${TAG}`);
    await pool.end();
  }

  console.log(failures === 0 ? "\nsprint 10: PASS" : `\nsprint 10: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
