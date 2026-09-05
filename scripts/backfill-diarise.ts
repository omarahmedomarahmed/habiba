/**
 * Re-run attribution over sessions that predate the H11 fix.
 *
 *   npx tsx scripts/backfill-diarise.ts --dry
 *   npx tsx scripts/backfill-diarise.ts
 *
 * ## Why this is needed
 *
 * `diariseSession` used to read only the first 160 segments of a session and
 * silently drop the rest, and it skipped any session that had a single
 * patient-labelled row — so a video call whose track dropped halfway had its
 * whole second half left `unknown` for good. Both are fixed going forward.
 * Neither fix reaches a transcript that was written last month.
 *
 * ## H10, and why it is not optional here
 *
 * Neon's instant-restore history bills at ~$0.20/GB-month, roughly ten times
 * the cost of the rows themselves — so a bulk UPDATE writes an expensive tail
 * of history for something nobody will ever restore to. The hazard note says to
 * set retention to 0 before a bulk load and restore it after.
 *
 * This script does **not** change retention itself. Doing that needs the Neon
 * control plane rather than a SQL connection, and a script that silently
 * reconfigured a customer's backup policy — and then died before restoring it —
 * would be a far worse hazard than the one it was avoiding. It refuses to run
 * until told the step has been taken, and prints exactly what to do.
 */
import { asc, eq, sql } from "drizzle-orm";

import { connect, schema } from "./db";

const { transcriptSegments, sessions } = schema;

const DRY = process.argv.includes("--dry");
const RETENTION_ACKED = process.argv.includes("--retention-is-zero");

async function main() {
  const { pool, db } = connect();

  try {
    /*
     * Which sessions are actually affected, measured rather than assumed.
     *
     * Two populations, and they are different problems:
     *   - `stranded`: has unknown rows and no patient rows at all. In-person,
     *     or a video call where the patient never connected.
     *   - `partial`: has unknown rows *and* patient rows. The dropped-track
     *     case, which the old two-track guard refused to touch.
     */
    const candidates = await db
      .select({
        sessionId: transcriptSegments.sessionId,
        organizationId: transcriptSegments.organizationId,
        therapistId: sessions.therapistId,
        total: sql<number>`COUNT(*)::int`,
        unknown: sql<number>`COUNT(*) FILTER (WHERE ${transcriptSegments.speaker} = 'unknown')::int`,
        patient: sql<number>`COUNT(*) FILTER (WHERE ${transcriptSegments.speaker} = 'patient')::int`,
      })
      .from(transcriptSegments)
      .innerJoin(sessions, eq(sessions.id, transcriptSegments.sessionId))
      .groupBy(transcriptSegments.sessionId, transcriptSegments.organizationId, sessions.therapistId)
      .having(sql`COUNT(*) FILTER (WHERE ${transcriptSegments.speaker} = 'unknown') > 0`)
      .orderBy(asc(transcriptSegments.sessionId));

    const stranded = candidates.filter((c) => c.patient === 0);
    const partial = candidates.filter((c) => c.patient > 0);
    const segments = candidates.reduce((n, c) => n + c.unknown, 0);
    const overCap = candidates.filter((c) => c.total > 160);

    console.log(
      `${candidates.length} session(s) with unattributed segments — ` +
        `${stranded.length} with no patient track, ${partial.length} where a track dropped.\n` +
        `${segments} unattributed segment(s) in total.\n` +
        `${overCap.length} session(s) longer than the old 160-segment cap.`,
    );

    if (DRY) {
      for (const c of candidates.slice(0, 20)) {
        console.log(
          `  ${c.sessionId.slice(0, 8)}…  ${c.unknown}/${c.total} unknown` +
            `${c.patient > 0 ? "  (track dropped)" : ""}${c.total > 160 ? "  (over the old cap)" : ""}`,
        );
      }
      console.log("\ndry run — nothing written");
      return;
    }

    if (!RETENTION_ACKED) {
      console.error(
        [
          "",
          "Refusing to run: H10 has not been acknowledged.",
          "",
          "Set the Neon project's instant-restore history retention to 0 first,",
          "then re-run with --retention-is-zero, then put retention back:",
          "",
          "  neon projects update <project-id> --history-retention-seconds 0",
          "  npx tsx scripts/backfill-diarise.ts --retention-is-zero",
          "  neon projects update <project-id> --history-retention-seconds 86400",
          "",
          `This would write roughly ${segments} rows.`,
          "",
        ].join("\n"),
      );
      process.exitCode = 1;
      return;
    }

    const { diariseSession } = await import("../lib/ai/diarise");

    let touched = 0;
    let updated = 0;
    const skipped: Record<string, number> = {};

    for (const c of candidates) {
      const result = await diariseSession({
        sessionId: c.sessionId,
        organizationId: c.organizationId,
        userId: c.therapistId,
      });
      touched += 1;
      updated += result.updated;
      if (result.skipped) skipped[result.skipped] = (skipped[result.skipped] ?? 0) + 1;
      console.log(
        `  ${c.sessionId.slice(0, 8)}…  ${result.updated} attributed` +
          `${result.skipped ? `  (skipped: ${result.skipped})` : ""}`,
      );
    }

    console.log(
      `\n${touched} session(s) processed, ${updated} segment(s) attributed.` +
        (Object.keys(skipped).length > 0 ? ` Skipped: ${JSON.stringify(skipped)}` : ""),
    );
  } finally {
    await pool.end();
  }
}

main();
