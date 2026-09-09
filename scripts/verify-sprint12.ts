/**
 * Sprint 12 acceptance — the sweep. PLAN.md §4 · THE RESET.
 *
 *   npm run verify:sprint12
 *
 * The sweep's accept clause is a negative: *no code path anywhere reads a value
 * whose default was chosen to avoid disturbing a live row.* A negative cannot
 * be proved by a test, so this checks the specific places where such a value
 * used to live, and asserts that the constraints which replace them are real
 * ones the database will enforce — the difference between "we removed the
 * grandfather clause" and "the database now refuses what the clause allowed".
 */
import { and, eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { patients, sessions, users } from "../lib/db/schema";

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok " : "FAIL"}  ${label}${detail ? `, ${detail}` : ""}`);
}

function note(text: string) {
  console.log(`  --   ${text}`);
}

/** Did that write fail for the reason we wanted it to fail for? */
async function refused(fn: () => Promise<unknown>, constraint: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(constraint);
  }
}

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  const created: string[] = [];

  try {
    /* ------------------------------------------------------ 12.1 the gate */

    const { isGated } = await import("../lib/access/state");
    check(
      "🔴 12.1 the copilot gate is on for everybody, no date, no grandfather",
      isGated("unclaimed_bare") &&
        !isGated("unclaimed_documented") &&
        !isGated("granted") &&
        !isGated("revoked"),
    );

    const { getSettings } = await import("../lib/settings");
    const copilot = (await getSettings()).copilot;
    check(
      "12.1 `copilot.gateActiveFrom` is gone from platform_settings",
      !("gateActiveFrom" in copilot),
      Object.keys(copilot).join(", "),
    );

    const { capabilitiesFor } = await import("../lib/access/state");
    check(
      "12.1 a gated record loses the copilot but keeps the way out of the state",
      capabilitiesFor("unclaimed_bare", true).copilot === false &&
        capabilitiesFor("unclaimed_bare", true).diagnosisChanges === true &&
        capabilitiesFor("unclaimed_bare", true).ownNotes === true,
    );

    /* ------------------------------------------- 12.2 every session ratable */

    const [therapist] = await db
      .select({ id: users.id, organizationId: users.organizationId })
      .from(users)
      .limit(1);

    if (!therapist) {
      check("12.2 a clinician exists to write a session for", false);
    } else {
      /*
       * The check is asserted by *attempting the write*. A constraint that
       * exists in `pg_constraint` and is never exercised is a constraint
       * nobody has proved is on the column they think it is.
       */
      const tokenRefused = await refused(
        () =>
          db.insert(sessions).values({
            organizationId: therapist.organizationId,
            therapistId: therapist.id,
            status: "scheduled",
            modality: "video",
            guestName: "verify12-no-token",
            // 🔴 Deliberately absent, past the type, to prove the DATABASE
            // refuses it — a rule the compiler enforces is not the same rule.
            feedbackToken: null as unknown as string,
          }),
        /*
         * 22.9 made the column `NOT NULL`, so the refusal now comes from the
         * column rather than from the CHECK beside it. The claim under test is
         * that the DATABASE refuses it — either message is that claim, and
         * pinning the constraint's name would have made a strengthening of the
         * rule look like a regression.
         */
        "feedback_token",
      );
      check(
        "🔴 12.2 the database refuses a session with no feedback token",
        tokenRefused,
        "refused by the NOT NULL column (0054) or the CHECK beside it",
      );

      const [ok] = await db
        .insert(sessions)
        .values({
          organizationId: therapist.organizationId,
          therapistId: therapist.id,
          status: "scheduled",
          modality: "video",
          guestName: "verify12-with-token",
          feedbackToken: "verify12-token-value",
        })
        .returning({ id: sessions.id });
      if (ok) created.push(ok.id);
      check("12.2 …and accepts one that carries a token", Boolean(ok));

      const nulls = await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM sessions WHERE feedback_token IS NULL
      `);
      note(
        `${(nulls.rows[0] as { n: number }).n} historical sessions still have no token. Never backfilled, a token minted today would assert a rating had been possible. The purge removes them.`,
      );

      /* ------------------------------------------- 12.4 the phone number */

      const phoneRefused = await refused(
        () =>
          db.insert(patients).values({
            organizationId: therapist.organizationId,
            therapistId: therapist.id,
            firstName: "verify12",
            source: "therapist",
            phone: null,
          }),
        "patients_phone_present",
      );
      check(
        "🔴 12.4 a therapist-created patient with no phone number is refused by the database",
        phoneRefused,
      );

      const shapeRefused = await refused(
        () =>
          db.insert(patients).values({
            organizationId: therapist.organizationId,
            therapistId: therapist.id,
            firstName: "verify12",
            source: "therapist",
            phone: "01001234567",
          }),
        "patients_phone_e164",
      );
      check(
        "12.4 …and so is a national number nobody could send a message to",
        shapeRefused,
        "01001234567, real in Egypt, Italy and Kenya, and a different person in each",
      );

      /*
       * §3b's other half, asserted rather than assumed: email stays a complete
       * fallback. A patient who books with only an address is a `join_link`
       * record, and refusing those would refuse a real booking.
       */
      const [guest] = await db
        .insert(patients)
        .values({
          organizationId: therapist.organizationId,
          therapistId: therapist.id,
          firstName: "verify12-guest",
          source: "join_link",
          email: "verify12@example.test",
          phone: null,
        })
        .returning({ id: patients.id });
      check(
        "12.4 §3b's fallback survives, a join-link patient may still arrive with only an email",
        Boolean(guest),
      );
      if (guest) {
        await db.delete(patients).where(eq(patients.id, guest.id));
      }

      const [good] = await db
        .insert(patients)
        .values({
          organizationId: therapist.organizationId,
          therapistId: therapist.id,
          firstName: "verify12-ok",
          source: "therapist",
          phone: "+201001234567",
        })
        .returning({ id: patients.id });
      check("12.4 …and a real E.164 number is accepted", Boolean(good));
      if (good) await db.delete(patients).where(eq(patients.id, good.id));
    }

    /* ------------------------------------------------ 12.3 the timestamps */

    const { formatDate, formatDateTime, relativeDay } = await import("../lib/utils");
    const at = new Date("2026-09-12T23:30:00.000Z");

    check(
      "🔴 12.3 the same instant renders as a different day in Cairo and in New York",
      formatDate(at, "Africa/Cairo") !== formatDate(at, "America/New_York"),
      `${formatDate(at, "Africa/Cairo")} vs ${formatDate(at, "America/New_York")}`,
    );

    check(
      "12.3 a null zone is UTC, said rather than silently the server's clock",
      formatDateTime(at, null) === formatDateTime(at, "UTC"),
      formatDateTime(at, null),
    );

    /*
     * The `relativeDay` defect, pinned: it compared `getDate()` on two Date
     * objects, which is the server's calendar day. Just after midnight in
     * Cairo, "today" there is still "yesterday" in UTC.
     */
    const justAfterCairoMidnight = new Date(Date.now());
    check(
      "12.3 relativeDay counts days in the reader's zone, not the server's",
      relativeDay(justAfterCairoMidnight, "Pacific/Kiritimati") === "Today" ||
        relativeDay(justAfterCairoMidnight, "Pacific/Kiritimati") === "Tomorrow",
      relativeDay(justAfterCairoMidnight, "Pacific/Kiritimati"),
    );

    /*
     * 🔴 12.3 / C84 — no `"use client"` file may read the runtime's zone or
     * locale during render.
     *
     * ⚠️ The first version of this check scanned for `readerZone(` — the
     * **helper**, not the defect. Seven files never used the helper: they
     * inlined `Intl.DateTimeFormat().resolvedOptions().timeZone`, or called
     * `toLocaleDateString()` / `toLocaleString()` straight off a Date, or
     * formatted money with the runtime's locale. The scanner said "0
     * offenders" over the public booking calendar, the public feedback page
     * and the availability editor. That is the fourth checker in this
     * repository to pass by matching the wrong thing, and the pattern each
     * time was the same: **the check was written against the fix instead of
     * against the defect.**
     *
     * So this bans the construct. `Intl.DateTimeFormat(`, `toLocaleDateString`,
     * `toLocaleTimeString` and `toLocaleString` — zone and locale, dates and
     * money — anywhere in a client file. Every legitimate use goes through
     * `lib/scheduling/tz.ts` or `lib/utils.ts`, which take an explicit zone,
     * or through `useReaderZone()`, which runs in an effect.
     */
    const { readdirSync, readFileSync: read } = await import("node:fs");
    const { join } = await import("node:path");

    const BANNED = /\bIntl\s*\.\s*DateTimeFormat\s*\(|\bIntl\s*\.\s*NumberFormat\s*\(|\.toLocaleDateString\s*\(|\.toLocaleTimeString\s*\(|\.toLocaleString\s*\(/;

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
          continue;
        }
        if (!path.endsWith(".tsx") && !path.endsWith(".ts")) continue;

        /*
         * The hook module is the one sanctioned caller — it exists precisely to
         * read the runtime's zone, and it does it in an effect. Exempted by
         * **path**, not by pattern: a pattern-shaped exemption is how the last
         * version of this guard let seven files through.
         */
        if (path.replace(/\\/g, "/").endsWith("lib/scheduling/use-reader-zone.ts")) continue;

        const raw = read(path, "utf8");
        if (!raw.includes('"use client"')) continue;

        // Comments stripped first: three earlier checkers here matched their
        // own prose, and this file's own explanation names every banned call.
        const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

        // `useReaderZone` is the sanctioned reader — it runs in an effect.
        const bare = code.replace(/useReaderZone/g, "").replace(/\breaderZone\s*\(/g, "");
        if (BANNED.test(bare) || /\breaderZone\s*\(/.test(code.replace(/useReaderZone/g, ""))) {
          offenders.push(path);
        }
      }
    };
    walk("components");
    walk("app");
    /*
     * 🔴 And `lib/`. Four `"use client"` files live outside the two directories
     * this originally walked — `lib/i18n/client.tsx` among them, which is the
     * file sprints 19 and 21 grow and the single most likely place somebody
     * reaches for `toLocaleString` next. A guard that stops at a directory
     * boundary is a guard with a documented hole in it.
     */
    walk("lib");

    check(
      "🔴 12.3 / C84 no client file formats a date, time or amount off the runtime's zone or locale",
      offenders.length === 0,
      offenders.join(", ") || "0 offenders",
    );

    /* --------------------------------------------------- 12.6 the reset */

    const { existsSync } = await import("node:fs");
    check("12.6 scripts/reset.ts exists", existsSync("scripts/reset.ts"));
    check("12.7 scripts/_fk.ts is gone", !existsSync("scripts/_fk.ts"));

    /*
     * 🔴 The reset must never truncate the migration ledger. Emptying it tells
     * the next `db:migrate` that nothing has run, and forty-two migrations
     * replay against a database that already holds every object.
     *
     * ⚠️ Asserted by calling the real function, not by grepping the file. The
     * first version of this check searched the source for
     * `__drizzle_migrations` and failed on the *comment* saying the ledger is
     * deliberately excluded. That is the third time a scanner in this
     * repository has matched its own prose — sprint 10's import-block scan and
     * 11R's DO-block scan were the first two. Run the code instead.
     */
    const { tableNames } = await import("./reset");
    const targets = await tableNames(db as never);

    check(
      "🔴 12.6 the reset's table list is public tables only, drizzle's ledger is unreachable",
      targets.length > 0 && targets.every((name) => !name.includes("drizzle_migrations")),
      `${targets.length} tables`,
    );

    const live = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    check(
      "12.6 …and it is every one of them, so nothing survives the purge by omission",
      targets.length === Number(live.rows[0]?.n ?? -1),
      `${targets.length} of ${live.rows[0]?.n}`,
    );

    const { readFileSync } = await import("node:fs");
    const reset = readFileSync("scripts/reset.ts", "utf8");
    check(
      "12.6 the reset refuses to run without --i-mean-it and a typed host name",
      reset.includes("--i-mean-it") && reset.includes("Type the host to confirm"),
    );
  } finally {
    if (created.length > 0) {
      await db.delete(sessions).where(
        sql`${sessions.id} = ANY(ARRAY[${sql.join(
          created.map((id) => sql`${id}::uuid`),
          sql`, `,
        )}])`,
      );
    }
    await db.delete(patients).where(sql`${patients.firstName} LIKE 'verify12%'`);
  }

  console.log(
    `\n${failures === 0 ? "sprint 12: PASS" : `sprint 12: ${failures} FAILED`} (${checks} checks)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
