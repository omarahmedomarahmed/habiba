/**
 * 🔴 76.30 — THE CHECKS THAT NEED A SERVER, WITH A SERVER.
 *
 *   npm run verify:served
 *
 * ## The gap, which is H20's quieter half a third time
 *
 * `verify:sprint31` holds six checks about localised routing that can only be
 * answered by a running product: that `/ar/pricing` is a page, that it serves
 * Arabic, that it lays out right to left, that a forged `x-locale` header
 * changes nothing, and that neither private path becomes a second address for a
 * record. Every one of them was `deferred to a running server` on every run
 * anybody ever did, because nothing started one.
 *
 * "A gate nobody runs is a gate nobody reads", and a check permanently deferred
 * is worse than a missing one: the pass line says `PASS (5 checks, 1 deferred)`
 * and a reader takes the PASS.
 *
 * ## What this does
 *
 * Boots the product on a spare port against whatever `DATABASE_URL` the caller
 * is already pointed at, waits for it to answer, runs the server-dependent
 * verifiers against it, and shuts it down in a `finally`.
 *
 * 🔴 IT DOES NOT BUILD. `next dev` compiles on demand, which is slower per page
 * and needs no build step, and the alternative is a gate that takes four
 * minutes and therefore is not run. Speed is a correctness property for a gate.
 *
 * 🔴 AND IT READS ONLY. Nothing here writes, so it is safe against any branch,
 * production included, which is the database whose routing most needs asking.
 */
import { spawn } from "node:child_process";
import { mkdirSync, openSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

/** A port nothing else in this repository uses. */
const PORT = Number(process.env.SERVED_PORT ?? 3199);
const BASE = `http://localhost:${PORT}`;

/** Where the server's own narration goes. `.render` is gitignored. */
const SERVER_LOG = ".render/served.log";

/** Verifiers whose checks are deferred without one. */
const NEEDS_A_SERVER = ["verify:sprint31", "verify:contrast"];

/*
 * 🔴 THE CONTRAST GATE RUNS THE ENDS OF ITS GRID HERE, NOT ALL OF IT.
 *
 * It measures every word on every destination of all five portals, in two
 * languages at two widths. That is the right thing to run before a release and
 * the wrong thing to put in front of somebody who just wants to know whether
 * their change broke anything, because against `next dev` it is many minutes.
 *
 * So this asks for desktop English and phone Arabic: direction and width both
 * exercised, at a third of the cost. The gate PRINTS that it ran a partial
 * grid, so a green line here cannot be mistaken for the full one.
 */
const PARTIAL: Record<string, string> = { "verify:contrast": "en1280,ar390" };

async function answers(): Promise<boolean> {
  try {
    const response = await fetch(BASE, { signal: AbortSignal.timeout(4_000) });
    return response.status > 0;
  } catch {
    return false;
  }
}

async function main() {
  /*
   * 🔴 IF ONE IS ALREADY UP, USE IT. Somebody running this beside a dev server
   * should not wait forty seconds for a second copy, and a gate that is
   * annoying to run beside normal work is a gate that gets run less.
   */
  const existing = process.env.VERIFY_URL;
  let child: ReturnType<typeof spawn> | null = null;
  /* Taken BEFORE anything is spawned, so the teardown can only kill what this gate made. */
  const before = nextServers();

  if (!existing) {
    console.log(`starting the product on ${PORT}…`);
    /*
     * 🔴 KEEP WHAT THE SERVER SAYS, because `stdio: "ignore"` threw away the
     * only thing that could explain a failure.
     *
     * When the crawler reports a page as "no response", the question is always
     * whether the page threw, the compile threw, or nothing happened at all,
     * and the server's own output answers it in one line. Discarded, the only
     * way to find out is to boot a second server by hand and try to reproduce,
     * which is three rounds of guessing at something the process already knew.
     *
     * It goes to a file rather than to this pass's output, because a dev
     * server narrates every compile and nobody wants that inline. The tail is
     * printed only when something fails.
     */
    mkdirSync(".render", { recursive: true });
    const log = openSync(SERVER_LOG, "w");
    child = spawn("npx", ["next", "dev", "-p", String(PORT)], {
      stdio: ["ignore", log, log],
      /*
       * 🔴 76.61 / C365 AGAIN, IN THE FILE THAT DID NOT GET THE FIX.
       *
       * `smoke-public.ts` carries a long comment about `npx next start` FORKING
       * `next-server`, so `kill()` on this handle signals a wrapper while the
       * grandchild keeps running. It was fixed there and this file, which does
       * the same thing with `next dev`, was left alone.
       *
       * The consequence is worse here than a busy port. An orphaned `next dev`
       * keeps RECOMPILING into `.next` in the background, so it silently
       * rewrites the production build that `npm run smoke` needs, minutes after
       * this gate reported PASS. The next `npm run gates` then fails on
       * `renders` with `EvalError: Code generation from strings disallowed`,
       * naming twenty-four public pages that are perfectly fine.
       *
       * That is why the pass went green twice and red on the third run with
       * nothing changed between them. An intermittent gate is worse than a
       * failing one: it teaches people that red means run it again.
       */
      detached: true,
      env: {
        ...process.env,
        /*
         * The blob token is required in production and this is not production.
         * Without this the boot refuses, which is the guard working and is not
         * what this gate is asking about.
         */
        ALLOW_LOCAL_UPLOADS: "1",
        APP_URL: BASE,
        /*
         * 🔴 76.61 — ITS OWN BUILD DIRECTORY, BECAUSE IT WAS FIGHTING `smoke`
         *            OVER `.next` AND BOTH OF THEM LOST.
         *
         * `smoke` starts the BUILT app and needs `next build` output in
         * `.next`. This starts `next dev`, which compiles on demand into the
         * same directory. Whichever ran second found the other's output, and
         * the run's second `npm run gates` in one working copy then failed on a
         * page nobody had touched: `/ar/pricing` answered 500 here, and a build
         * after this one died prerendering `/for-patients`.
         *
         * Both read as broken public pages and neither is. The pass had gone
         * green twice that afternoon before it went red, which is worse than a
         * gate that simply fails, because the intermittent one teaches people
         * that red means "run it again".
         *
         * 🔴 INSIDE `.next`, NOT BESIDE IT, AND THAT IS H31.
         *
         * The first version used `.next-served` at the root. Every source
         * scanner in this repository skips `.next` by name, none of them had
         * heard of `.next-served`, and `verify:reachable` immediately went red:
         * the dev server's generated route types looked like callers, so
         * `/api/stripe/webhook` and `/api/cron` "stopped being orphans" and the
         * stale-allowlist check fired. It was right to. A new build directory
         * at the root is a new directory every scanner has to be told about,
         * one at a time, and H31 is the record of what that costs.
         *
         * Nested, it inherits every skip list that already exists, `.gitignore`
         * already covers it, and `rm -rf .next` cleans both.
         *
         * `next.config.ts` reads this and falls back to `.next` when it is
         * unset, so nothing else in the repository changes.
         */
        NEXT_DIST_DIR: ".next/served",
      },
    });

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (await answers()) break;
      await new Promise((r) => setTimeout(r, 2_000));
    }

    if (!(await answers())) {
      console.error(`nothing answered at ${BASE} within two minutes.`);
      stop(child, before);
      process.exit(1);
    }

    /*
     * 🔴 WARM THE ROUTES BEFORE ASKING ABOUT THEM, and this is not politeness.
     *
     * `next dev` compiles a route the first time it is requested, which takes
     * tens of seconds for a page like `/pricing`. The root answering means the
     * server is up; it says nothing about `/pricing` being compiled. So the
     * first full pass reported `/pricing status 500`, a canonical tag of
     * `none`, and zero characters of either language on three pages — eleven
     * red lines about a product that is completely fine, produced by a gate
     * asking a compiler questions.
     *
     * That is worse than the gate not existing. Red lines about correct
     * behaviour teach whoever runs the pass to stop reading it, which is H20
     * arriving from the other direction, and it would have taught it on the
     * very first run.
     *
     * Each path is fetched once with a long timeout and the result is thrown
     * away. The verifier then asks its real questions of a warm server.
     */
    /*
     * 🔴 AND THE LIST WAS FOUR PATHS, WRITTEN BEFORE A GATE THAT WALKS 125.
     *
     * Everything above is right and was applied to `verify:sprint31`, which
     * asks about four pages. `verify:contrast` then joined and walks every
     * destination of all five portals, and not one of those was warmed. So the
     * exact defect this comment describes came back in the new gate's shape:
     * `/billing` reported as a 500 on one pass, twelve other pages on the
     * next, and a signed-in browser getting 200 from all of them.
     *
     * A hand typed list of routes is wrong the week after it is written, which
     * is the same sentence `scripts/inventory.ts` opens with. So the routes
     * come from there. Adding a page warms it; deleting one stops warming it;
     * nobody has to remember either.
     *
     * The four originals stay because two of them are not pages this walks: an
     * `/ar/` prefixed route and a sitemap.
     */
    const { routes } = await import("./inventory");
    const WARM = [
      ...new Set([
        "/pricing",
        "/ar/pricing",
        "/patient/journal",
        "/sitemap.xml",
        ...routes().filter((path) => !path.includes("[")),
      ]),
    ];
    console.log(`warming ${String(WARM.length)} routes…`);
    let warmed = 0;
    for (const path of WARM) {
      await fetch(`${BASE}${path}`, {
        signal: AbortSignal.timeout(120_000),
      })
        .then(() => {
          warmed += 1;
        })
        .catch(() => undefined);
    }
    console.log(`  ${String(warmed)} of ${String(WARM.length)} answered`);
  }

  const url = existing ?? BASE;
  console.log(`serving at ${url}\n`);

  let failures = 0;
  /* Everything the child verifiers said, so a failure can be correlated below. */
  let report = "";
  try {
    for (const name of NEEDS_A_SERVER) {
      const run = spawnSync("npm", ["run", "--silent", name], {
        encoding: "utf8",
        env: {
          ...process.env,
          VERIFY_URL: url,
          ...(PARTIAL[name] ? { CONTRAST_RUNS: PARTIAL[name] } : {}),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
      report += out;
      process.stdout.write(out);

      /*
       * 🔴 A DEFERRAL IS A FAILURE HERE, and that is the whole point of this
       * file. Everywhere else "deferred" means an honest "could not ask"; with
       * a server standing right there it means the check still did not run, and
       * a gate that tolerates that is the gate this one exists to replace.
       */
      if (run.status !== 0) failures += 1;
      if (/deferred to a running server/.test(out)) {
        console.error(`\n🔴 ${name} still deferred with a server at ${url}.`);
        failures += 1;
      }
    }
    /*
     * 🔴 AND WHEN SOMETHING FAILED, SAY WHAT THE SERVER WAS DOING.
     *
     * A crawler line reading "no response, twice" is a symptom. The server's
     * last words are the cause: a thrown render names its stack, a compile
     * that never finished names the route it was on, and a server that said
     * nothing at all is itself the answer, because it means the request never
     * reached the product.
     */
    /*
     * 🔴 AND FOR EACH PATH THE BROWSER GOT NOTHING FROM, ASK THE SERVER.
     *
     * "no response, twice" is a symptom with two very different causes, and
     * this repository has been bitten by mistaking each for the other. If the
     * server never logged the request, the product never saw it and the
     * failure is real. If the server logged a 200, the page is fine and the
     * browser gave up waiting, which is the harness.
     *
     * 🔴 IT STILL FAILS EITHER WAY. Turning the second case green would be the
     * red line explained away, which is how `/pricing` stayed a 500 for seven
     * sprints. Turning it into "the billing page is broken" is how people
     * learn to stop reading the pass. So the gate stays red and SAYS WHICH,
     * with the server's own number beside it.
     *
     * What it said on the run that produced this: `GET /favicon.ico 200 in
     * 11170ms` and `GET /patient/account 200 in 33349ms`. A static file taking
     * eleven seconds is not a product defect, it is a machine with `next dev`
     * and a browser on it, and which page crosses the navigation timeout is
     * luck. That is worth printing rather than re-deducing every time.
     */
    if (failures > 0 && child) {
      const log = readFileSync(SERVER_LOG, "utf8");
      const stuck = [
        ...new Set(
          [...report.matchAll(/FAIL\s+\S+ \S+ \S+ (\/\S*) answers, HTTP no response/g)].map(
            (m) => m[1]!,
          ),
        ),
      ];

      if (stuck.length > 0) {
        console.error(`\n🔴 what the server did with the ${String(stuck.length)} path(s) the browser got nothing from:`);
        for (const path of stuck) {
          const seen = [...log.matchAll(new RegExp(`GET ${path.replace(/[/]/g, "\\/")} (\\d+) in (\\d+)ms`, "g"))];
          const last = seen.at(-1);
          console.error(
            last
              ? `   ${path}  the server answered ${last[1]!} in ${last[2]!}ms, ${String(seen.length)} time(s). The page is fine and the browser gave up: this is the harness.`
              : `   ${path}  the server never logged the request, so the product never saw it. This one is real.`,
          );
        }
      }

      const tail = log.trimEnd().split("\n").slice(-12);
      console.error(`\n🔴 the last ${String(tail.length)} lines of ${SERVER_LOG}:`);
      for (const line of tail) console.error(`   ${line}`);
    }
  } finally {
    stop(child, before);
  }

  console.log(
    failures === 0
      ? `\nserved: PASS (${NEEDS_A_SERVER.length} verifier${NEEDS_A_SERVER.length === 1 ? "" : "s"}, nothing deferred)`
      : `\nserved: ${failures} FAILED`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();

/**
 * Every `next-server` running right now, by pid.
 *
 * 🔴 A SNAPSHOT BEFORE, A DIFFERENCE AFTER, so this can only ever kill a
 * process that did not exist before this gate started. Killing every
 * `next-server` on the machine would take out the founder's own `npm run dev`
 * in another terminal, and a gate that does that is a gate people stop running.
 */
function nextServers(): Set<number> {
  const out = new Set<number>();
  for (const entry of readdirSync("/proc")) {
    const pid = Number(entry);
    if (!Number.isInteger(pid)) continue;
    try {
      if (readFileSync(`/proc/${entry}/comm`, "utf8").startsWith("next-server"))
        out.add(pid);
    } catch {
      /* the process exited between the listing and the read */
    }
  }
  return out;
}

/**
 * Stop the dev server and everything it forked.
 *
 * 🔴 THE PROCESS GROUP IS NOT ENOUGH, AND FINDING THAT OUT IS THE WHOLE POINT
 *    OF THIS FUNCTION.
 *
 * `smoke-public.ts` stops `next start` by signalling the group, which works
 * there. `next dev` does not behave the same way: the `next-server` it forks
 * ends up in a group of its own and reparented to init, so the group signal
 * misses it entirely. Worse, **it releases the port while still running**, so
 * waiting for the port to come free returns success while the process is still
 * alive and still recompiling into `.next`.
 *
 * That is the failure this gate had. It reported PASS, left a compiler running,
 * and the production build `npm run smoke` needs was quietly rewritten
 * underneath it minutes later. The next `npm run gates` then failed on
 * `renders` with `EvalError: Code generation from strings disallowed`, naming
 * twenty-four public pages that were all fine.
 *
 * So: signal the group for the wrapper, then kill by DIFFERENCE, which catches
 * the fork wherever it put itself.
 */
function stop(
  child: ReturnType<typeof spawn> | null,
  before: Set<number>,
): void {
  if (child?.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    }
  }

  for (const pid of nextServers()) {
    if (before.has(pid)) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}
