/**
 * The simulation's shared message board: one append-only markdown table every agent reads
 * before each click and writes after it. `docs/simulation/05-THE-BOARD.md` is the protocol.
 *
 *   npm run sim:board -- post <round> <who> <step> <page> "<what I did>" "<what I click next>" [waiting-on-step]
 *   npm run sim:board -- read [--for <who>] [--since <line>]
 *   npm run sim:board -- wait <step> [seconds]
 *
 * `wait` returns as soon as any agent has posted `<step>` as done, and exits 1 on timeout so a
 * waiting agent reports the stall instead of clicking into a state that is not there yet.
 *
 * It only reads and appends one file. It touches no database, so it is safe beside production.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BOARD = process.env.SIM_BOARD ?? "docs/simulation-run/BOARD.md";

const HEADER =
  "# The board\n\n" +
  "Append only. One row per click. Protocol: `docs/simulation/05-THE-BOARD.md`.\n\n" +
  "| # | time | round | who | step | page | did | next | waiting on |\n" +
  "|---|---|---|---|---|---|---|---|---|\n";

export type Entry = {
  n: number;
  time: string;
  round: string;
  who: string;
  step: string;
  page: string;
  did: string;
  next: string;
  waitingOn: string;
};

function ensure(): void {
  if (existsSync(BOARD)) return;
  mkdirSync(dirname(BOARD), { recursive: true });
  writeFileSync(BOARD, HEADER);
}

/** A pipe inside a cell would split the row, and a newline would end it. */
const cell = (s: string) => s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

export function read(): Entry[] {
  ensure();
  const out: Entry[] = [];
  for (const line of readFileSync(BOARD, "utf8").split("\n")) {
    const m = line.match(/^\|\s*(\d+)\s*\|(.*)\|\s*$/);
    if (!m) continue;
    const [time, round, who, step, page, did, next, waitingOn] = m[2]!.split("|").map((c) => c.trim());
    out.push({
      n: Number(m[1]),
      time: time ?? "",
      round: round ?? "",
      who: who ?? "",
      step: step ?? "",
      page: page ?? "",
      did: did ?? "",
      next: next ?? "",
      waitingOn: waitingOn ?? "",
    });
  }
  return out;
}

/**
 * One `appendFileSync` of one short line is a single write(2) on an O_APPEND file, which the
 * kernel keeps whole even when several agents append at once. The row number is advisory: two
 * agents can read the same last number, and the time column breaks the tie.
 */
export function post(e: Omit<Entry, "n" | "time">): Entry {
  ensure();
  const entries = read();
  const row: Entry = {
    n: (entries.at(-1)?.n ?? 0) + 1,
    time: new Date().toISOString().slice(11, 19),
    ...e,
  };
  appendFileSync(
    BOARD,
    `| ${String(row.n)} | ${row.time} | ${cell(row.round)} | ${cell(row.who)} | ${cell(row.step)} | ` +
      `${cell(row.page)} | ${cell(row.did)} | ${cell(row.next)} | ${cell(row.waitingOn)} |\n`,
  );
  return row;
}

/** A step is done when somebody posted it with a `did` that is not a wait or a failure. */
export function isDone(step: string, entries = read()): boolean {
  return entries.some((e) => e.step === step && !/^(WAIT|BLOCKED|BUG)\b/.test(e.did));
}

export async function waitFor(step: string, seconds: number): Promise<boolean> {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    if (isDone(step)) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function cli(argv: string[]): Promise<number> {
  const [verb, ...rest] = argv;
  if (verb === "post") {
    const [round, who, step, page, did, next, waitingOn] = rest;
    if (!round || !who || !step || !page || !did) {
      console.error("post <round> <who> <step> <page> <did> [next] [waiting-on]");
      return 2;
    }
    const row = post({ round, who, step, page, did, next: next ?? "", waitingOn: waitingOn ?? "" });
    console.log(`#${String(row.n)} posted`);
    return 0;
  }
  if (verb === "read") {
    const at = (flag: string) => {
      const i = rest.indexOf(flag);
      return i === -1 ? undefined : rest[i + 1];
    };
    const since = Number(at("--since") ?? 0);
    const who = at("--for");
    for (const e of read().filter((x) => x.n > since)) {
      /* An agent reading "for" itself sees everyone else's rows and any row waiting on it. */
      if (who && e.who === who) continue;
      console.log(`${String(e.n)} ${e.time} ${e.round} ${e.who} ${e.step} ${e.page} :: ${e.did} -> ${e.next}${e.waitingOn ? ` [waits ${e.waitingOn}]` : ""}`);
    }
    return 0;
  }
  if (verb === "wait") {
    const [step, seconds] = rest;
    if (!step) {
      console.error("wait <step> [seconds]");
      return 2;
    }
    const ok = await waitFor(step, Number(seconds ?? 300));
    console.log(ok ? `${step} is done` : `timed out waiting for ${step}`);
    return ok ? 0 : 1;
  }
  console.error("post | read | wait");
  return 2;
}

if (process.argv[1]?.endsWith("sim-board.ts")) {
  void cli(process.argv.slice(2)).then((code) => process.exit(code));
}
