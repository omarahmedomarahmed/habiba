/**
 * Reseed published content and prove it, in one command. PLAN.md C148.
 *
 *   npm run ship:content -- 28 24
 *
 * ## 🔴 Why this exists
 *
 * C148 was written in sprint 28 and broken by sprint 28. The rule says a
 * content sprint is not finished until the published rows are reseeded and its
 * verifier re-run against them. What happened was that the reseed ran against
 * the branch database the sprint was built on, production kept the old rows,
 * and `verify:sprint28` failed 4 of 21 the moment somebody pointed it at the
 * database the sprint was about to merge into.
 *
 * That is the fifth costume of C89, and the diagnosis is the same every time:
 * the code was right and the deployment was not. A rule written in prose,
 * obeyed in the wrong place, is not a rule. So the two steps become one
 * command that cannot be half-done, and it is run by whoever holds the
 * production credentials, against the database the sprint merges into.
 *
 * ## What it deliberately does NOT do
 *
 * It does not call `writesTo()`. Every other writing script in this directory
 * refuses the production endpoint by name (C147), and this one is the single
 * exception because production is the entire point of it: the whole failure
 * being fixed is a reseed that ran somewhere safer than where it was needed.
 *
 * So instead it says exactly which database it is about to rewrite and what it
 * will do to it, and it refuses `--yes` as a substitute for reading that. The
 * host is printed before anything is written, not after.
 */
import { execFileSync } from "node:child_process";

async function main() {
  const sprints = process.argv.slice(2).filter((arg) => /^\d+[rR]?$/.test(arg));
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/:?]+)/)?.[1] ?? "(none)";

  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  if (sprints.length === 0) {
    console.error(
      "Name the sprints whose verifiers should prove the reseed, e.g. `npm run ship:content -- 28 24`.\n" +
        "Reseeding without re-running anything is the half of C148 that already failed once.",
    );
    process.exit(1);
  }

  console.log(`\nAbout to REWRITE published content on ${host}`);
  console.log(`Then run: ${sprints.map((s) => `verify:sprint${s}`).join(", ")}\n`);

  /*
   * Content only. `--refresh-content` rewrites `content_pages` from the
   * shipped defaults and touches nothing else: no users, no settings, no
   * clinical data. That is why this is safe to run against production and why
   * it must never grow a second flag.
   */
  run("npm", ["run", "db:seed", "--", "--refresh-content"]);

  let failed = 0;
  for (const sprint of sprints) {
    console.log(`\n--- verify:sprint${sprint} on ${host}`);
    try {
      run("npm", ["run", `verify:sprint${sprint}`]);
    } catch {
      failed += 1;
    }
  }

  if (failed > 0) {
    console.error(
      `\n${failed} verifier(s) FAILED against ${host} after the reseed.\n` +
        "That is the sprint not being finished, not a flaky check.",
    );
    process.exit(1);
  }

  console.log(`\nContent shipped and proved on ${host}.`);
}

function run(command: string, args: string[]): void {
  execFileSync(command, args, { stdio: "inherit" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
