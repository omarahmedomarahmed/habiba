/**
 * The simulation board's shared half: read, post and wait on one append-only markdown file,
 * with no main(). `scripts/sim-board.ts` is the command. Protocol: `docs/simulation/05-THE-BOARD.md`.
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
