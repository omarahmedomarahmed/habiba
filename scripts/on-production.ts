/**
 * 🔴 76.52 — THE ONE WAY TO POINT A COMMAND AT PRODUCTION, AND THE SHORT LIST
 * OF COMMANDS ALLOWED THROUGH IT.
 *
 *     npm run on:production -- simulate:seed
 *     npm run on:production -- age -- --marker wave1 --start
 *     npm run on:production -- baseline -- record snap-broad-shape-a649n5le
 *
 * ## The problem it solves, which is not the one it looks like
 *
 * The six month run happens on the production deployment and the production
 * database. Two or three commands a wave have to reach that database. The
 * obvious way to arrange that is to put the production connection string and
 * `I_MEAN_PRODUCTION` in `.env.local` and forget about it.
 *
 * 🔴 THAT IS THE TRAP, and it took a triple check to see it.
 *
 * Sixty-one scripts in this directory call `writesTo()`. Most are
 * `verify-sprint*` files that plant a fixture, assert something about it and
 * delete it in a `finally`. Point `.env.local` at production with the door
 * propped open and `npm run gates` — a command anybody types without thinking,
 * because it is the safe one — writes fabricated organisations to the database
 * the founders are keeping. A `finally` that never runs, because the process
 * was killed or the assertion threw, leaves one there.
 *
 * And **this run does not restore afterwards.** That was the earlier plan and
 * the user reversed it: the six months of data stay on production until a person
 * decides to delete them. So a leaked fixture is not swept up by anything. It
 * sits on the board next to the real numbers, looking exactly like them.
 *
 * ## So the arrangement is inverted
 *
 * `.env.local` keeps `DATABASE_URL` pointed at the **dev** branch, which is what
 * every gate, verifier and suite in this repository expects and what keeps them
 * green. Production lives in `DATABASE_URL_PRODUCTION`, and only this script
 * ever promotes it to `DATABASE_URL`, for one child process, for one command on
 * the list below.
 *
 * ## Why an allow-list and not a warning
 *
 * A warning is read once. The list is the mechanism: a command that is not on it
 * does not run, and the error says which one to use instead. Adding to the list
 * means editing this file and writing down why, which is the point.
 *
 * ## Why it checks the endpoint name
 *
 * `DATABASE_URL_PRODUCTION` holding the dev branch would make every command
 * below a command against dev, reported as a command against production. That is
 * the same defect `scripts/_environments.ts` exists to prevent, and it is worth
 * repeating here because this is the script that decides what production means.
 */
import { spawnSync } from "node:child_process";

/** The read-write compute on `main`. The same constant `_verify.ts` refuses by. */
const PRODUCTION_ENDPOINT = "ep-wild-lake-a6tgm2r6";

/**
 * 🔴 EVERY COMMAND THE RUN IS ALLOWED TO POINT AT PRODUCTION, AND NOTHING ELSE.
 *
 * `writes` is not decoration. `I_MEAN_PRODUCTION` is set for those entries only,
 * so a command that reads cannot become a command that writes by being on the
 * same list as one that does.
 */
const ALLOWED: Record<string, { writes: boolean; why: string }> = {
  /* ---------------------------------------------------------------- writing */
  "simulate:seed": {
    writes: true,
    why: "the operator, the four applications and the copilot quota, once, at the start",
  },
  age: {
    writes: true,
    why: "moves the clock at the end of a wave, and only rows created since the marker opened",
  },
  "settings:seed": {
    writes: true,
    why: "fills in missing settings defaults. Idempotent, and it writes no people",
  },
  "settings:reprice": { writes: true, why: "the prices this product charges" },
  "settings:rails": { writes: true, why: "fills blanks on country rows that already exist" },
  "ship:content": {
    writes: true,
    why: "rewrites content_pages from the shipped defaults, and nothing else",
  },
  /*
   * It opens a copilot thread against real patients from the run and asks the
   * model about them, which is a write, and the thread it leaves behind is part
   * of the record rather than a fixture. It belongs on the database the run is
   * on, and nowhere else.
   */
  "copilot:exam": { writes: true, why: "examines the copilot on the run's own patients" },

  /* ---------------------------------------------------------------- reading */
  baseline: { writes: false, why: "counts every row in every table, and writes none of them" },
  spend: { writes: false, why: "what the run has spent against the budget" },
  physics: { writes: false, why: "fits the session cost model over the run's own rows" },
  "settings:show": { writes: false, why: "what production actually holds" },
  "settings:check": { writes: false, why: "whether it holds what it should" },
  "verify:migrations": { writes: false, why: "journal and ledger agree, every CHECK validated" },
  "verify:board": { writes: false, why: "the founders' board, and none of its nine queries writes" },
  "verify:cast": { writes: false, why: "every seeded login exists and can sign in" },
};

/**
 * 🔴 NAMED HERE SO THE REFUSAL CAN EXPLAIN ITSELF, rather than saying "not on
 * the list" about a command somebody had a good reason to try.
 */
const REFUSED: Record<string, string> = {
  "verify:synthetic":
    "it plants a real-looking person as a control before deleting it, and planting one\n" +
    "     on production is the thing none of this is willing to do. Run it against dev.",
  "demo:seed":
    "it puts fabricated clinicians carrying DEMO- licence numbers on the public radar,\n" +
    "     where a stranger can book one. Its own header says so.",
  "db:seed":
    "outside --refresh-content it seeds demo people. Use `ship:content`, which runs the\n" +
    "     content-only mode and proves it with verifiers afterwards.",
  gates:
    "several gates write fixtures. Gates prove the CODE, so they belong on dev, which is\n" +
    "     where .env.local already points. Just `npm run gates`.",
  verifiers: "same as gates: they write fixtures, and dev is where they belong.",
  /*
   * 🔴 LISTED AS A READ WHEN THIS FILE WAS FIRST WRITTEN, AND IT IS NOT ONE.
   *
   * `verify:actuals` plants an organisation, seven ledger legs, four model calls
   * and three employees, then deletes them in a `finally`. It was put on the
   * allow-list as a read because its NAME sounds like a read, which is the whole
   * argument for an allow-list whose entries have to say what they do. It only
   * failed safe because 76.52 shut the door in `writesTo()` as well.
   */
  "verify:actuals":
    "it plants an organisation, ledger legs, model calls and three employees before\n" +
    "     deleting them. Run it against dev.",
  "db:reset": "no.",
};

function main(): void {
  const argv = process.argv.slice(2);
  const command = argv[0];
  /*
   * A bare `--` is dropped so both spellings work:
   *
   *     npm run on:production -- age -- --marker wave1 --start
   *     npm run on:production -- age --marker wave1 --start
   *
   * npm hands this script everything after its own `--`, so the second `--` in
   * the first spelling would otherwise arrive as an argument and be forwarded
   * to `age` as one, where it means nothing.
   */
  const rest = argv.slice(1).filter((arg) => arg !== "--");

  if (!command) {
    console.error("\n  Name a command. For example:\n");
    console.error("      npm run on:production -- simulate:seed\n");
    list();
    process.exit(1);
  }

  if (REFUSED[command]) {
    console.error(`\n  🔴 \`${command}\` must not be pointed at production:\n`);
    console.error(`     ${REFUSED[command]}\n`);
    process.exit(1);
  }

  const entry = ALLOWED[command];
  if (!entry) {
    console.error(`\n  🔴 \`${command}\` is not on the production list, so it does not run.\n`);
    console.error("     If it should be, add it to scripts/on-production.ts and say why.\n");
    list();
    process.exit(1);
  }

  const url = process.env.DATABASE_URL_PRODUCTION ?? "";
  if (!url) {
    console.error("\n  🔴 DATABASE_URL_PRODUCTION is not set.\n");
    console.error("     It belongs in .env.local, beside DATABASE_URL, which stays on dev.\n");
    process.exit(1);
  }

  const host = url.match(/@([^/:?]+)/)?.[1] ?? "(none)";
  if (!host.includes(PRODUCTION_ENDPOINT)) {
    console.error(`\n  🔴 DATABASE_URL_PRODUCTION does not name the production endpoint.\n`);
    console.error(`     It reaches ${host}, and production is ${PRODUCTION_ENDPOINT}.`);
    console.error("     A variable called PRODUCTION holding something else would make every");
    console.error("     command below a command about the wrong database, reported as the right one.\n");
    process.exit(1);
  }

  console.log(`\n  🔴 PRODUCTION. ${host}`);
  console.log(`     ${command}: ${entry.why}`);
  console.log(`     this command ${entry.writes ? "WRITES" : "only reads"}.\n`);

  /*
   * 🔴 The child's environment, not this process's. Nothing after this line
   * inherits a production connection string, so a second command typed later
   * starts from dev again like everything else.
   */
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url };
  if (entry.writes) env.I_MEAN_PRODUCTION = PRODUCTION_ENDPOINT;
  else delete env.I_MEAN_PRODUCTION;

  const run = spawnSync("npm", ["run", command, "--", ...rest], { stdio: "inherit", env });
  process.exit(run.status ?? 1);
}

function list(): void {
  console.error("  Allowed:\n");
  for (const [name, entry] of Object.entries(ALLOWED)) {
    console.error(`      ${entry.writes ? "writes" : "reads "}  ${name.padEnd(18)} ${entry.why}`);
  }
  console.error("");
}

main();
