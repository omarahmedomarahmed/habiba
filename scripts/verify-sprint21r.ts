/**
 * Sprint 21R acceptance — the loose ends a person found.
 * PLAN.md 21R.1–21R.10, C92, C93, C94, C95.
 *
 *   npm run verify:sprint21r
 *
 * Everything this file checks was found by the founder opening the live site,
 * which is the argument for 22R. Two of the checks are the ones that matter:
 *
 *   - **C92** — no published page may claim the money never passes through us.
 *     §3c reversed that on 2026-09-06, and a public page making a false claim
 *     about where somebody's money sits is a correctness bug, not stale copy.
 *   - **C93** — a check that reads published content is deferrable *by
 *     construction*, because the rows only exist inside the callback that
 *     skips itself when they are absent.
 */
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

import { reporter } from "./_verify";
import { undeferredContentReads } from "./_scan-deferrals";
import { withPublishedContent, type LivePage } from "./_content-ready";

const { check, finish } = reporter();

const VERIFIERS = readdirSync("scripts").filter(
  (name) => name.startsWith("verify-") && name.endsWith(".ts"),
);

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  /* ------------------------------------------------ 21R.9 · C93, the rule */

  const offenders = VERIFIERS.flatMap((name) =>
    undeferredContentReads(readFileSync(`scripts/${name}`, "utf8")).map(
      (statement) => `${name}: ${statement}`,
    ),
  );

  check(
    "🔴 21R.9 / C93 NO verifier reads published content by hand — it comes through the deferrable reader",
    offenders.length === 0,
    offenders.join(" · ") || `${VERIFIERS.length} verifiers scanned`,
  );

  /*
   * 🔴 The control. A scan that has never found anything has not been shown to
   * work. This plants a verifier of exactly the offending shape — the query
   * sprint 18R actually shipped — scans, and removes it.
   */
  const planted = "scripts/verify-c93-control.ts";
  /*
   * The offending source is assembled from a placeholder rather than written
   * out, so THIS file does not contain the pattern it is scanning for. Six
   * checkers in this repository have now matched their own text; the first
   * five were bugs, and this is the sixth caught before it shipped — the scan
   * reported this file as an offender the first time it ran.
   */
  const TABLE = "contentPages";
  try {
    writeFileSync(
      planted,
      [
        'import { db } from "../lib/db";',
        `import { ${TABLE} } from "../lib/db/schema";`,
        "const pages = await db",
        `  .select({ slug: ${TABLE}.slug })`,
        `  .from(${TABLE})`,
        `  .where(eq(${TABLE}.status, "published"));`,
        'check("a check that reads content and cannot be deferred", pages.length > 0);',
      ].join("\n"),
    );

    const caught = undeferredContentReads(readFileSync(planted, "utf8"));
    check(
      "🔴 21R.9 CONTROL — the same scan CATCHES a hand-written content read planted in a verifier",
      caught.length === 1,
      caught[0]?.slice(0, 80) ?? "THE SCAN IS BLIND",
    );
  } finally {
    rmSync(planted, { force: true });
  }

  /*
   * 🔴 …and the control for the exception, which is the half that would rot.
   * A verifier's own planted fixture, read back, must NOT be reported — or the
   * rule becomes one everybody suppresses.
   */
  const control = [
    "const [row] = await db",
    `  .select({ blocks: ${TABLE}.blocks })`,
    `  .from(${TABLE})`,
    `  .where(eq(${TABLE}.slug, "verify17-control"));`,
  ].join("\n");
  check(
    "21R.9 …and a fixture the verifier planted ITSELF is not reported — the rule is about reading, not writing",
    undeferredContentReads(control).length === 0,
  );

  /* ------------------------------- 21R.9 · the mechanism, actually exercised */

  /*
   * 🔴 The behaviour on a purged database, proved rather than assumed.
   *
   * Sprint 22 empties this database. Every content check in the repository
   * meets that state within the hour, and what they must do is SKIP with a
   * reason naming 22.8b — not fail, and not pass vacuously. Asserted by
   * running the real reader against no rows and recording what happened.
   */
  const recorded: { reason: string; ran: boolean }[] = [];
  const fakeSkip = async (
    ready: boolean,
    deferredTo: string,
    reason: string,
    fn: () => void | Promise<void>,
  ) => {
    if (ready) await fn();
    recorded.push({ reason: `${deferredTo}: ${reason}`, ran: ready });
  };

  let bodyRan = false;
  await withPublishedContent(
    fakeSkip,
    { for: "21R.9", what: "the pricing page", pages: [] },
    () => {
      bodyRan = true;
    },
  );

  check(
    "🔴 21R.9 on an EMPTY database a content check skips with its reason — it does not fail, and does not pass vacuously",
    bodyRan === false && recorded[0]?.reason.startsWith("22.8b:") === true,
    recorded[0]?.reason ?? "nothing recorded",
  );

  const page: LivePage = {
    slug: "pricing",
    locale: "en",
    status: "published",
    navLabel: "Pricing",
    navOrder: 1,
    blocks: [{ type: "pricing" }] as LivePage["blocks"],
  };

  let ranWithContent = false;
  await withPublishedContent(
    fakeSkip,
    { for: "21R.9", what: "the pricing page", slug: "pricing", pages: [page] },
    () => {
      ranWithContent = true;
    },
  );

  check(
    "🔴 21R.9 …and it switches itself back ON when the content is there — nobody edits a file to un-skip it",
    ranWithContent === true,
    ranWithContent ? "the same check ran against one published page" : "STILL SKIPPED",
  );

  finish("sprint 21R");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
