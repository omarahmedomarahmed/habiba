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
import { post, read, waitFor } from "./_sim-board";

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

void cli(process.argv.slice(2)).then((code) => process.exit(code));
