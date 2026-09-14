/**
 * 🔴 C354 — DOES EVERY PUBLIC PAGE ACTUALLY RENDER?
 *
 *   npm run build && npm run smoke
 *
 * ## Why this did not exist and had to
 *
 * `/pricing` returned **500 to every visitor in production** for seven sprints
 * (C353). Nothing in this repository asked the one question that would have
 * found it in a second, because every instrument asked a cleverer one:
 *
 * | | |
 * |---|---|
 * | `tsc` | Types were correct. It was a runtime serialisation rule |
 * | `npm run build` | The page is rendered on demand, so the build never rendered it |
 * | 60-odd `verify:sprint*` | Each reads source for its own sprint's rules |
 * | `verify:sprint21r` | Read the LIVE site and reported it red for seven sprints, and the red line was explained away each time |
 * | `verify:boundary` | Catches this defect's exact shape, and only that shape |
 *
 * So this one asks the stupid question, against the real build, with a real
 * database behind it: **fetch every public page and every locale, and demand a
 * 200 with words on it.**
 *
 * ## It refuses to be satisfied by an empty page
 *
 * A 200 is not enough. Next can serve a 200 whose body is an error boundary, and
 * a page that renders its shell and loses its content is the more common failure
 * of the two. So each page must also carry **more than 200 characters of visible
 * text** with the markup stripped, which the error shell does not.
 *
 * ## It never runs against production
 *
 * It starts a server itself, on a spare port, against whatever `DATABASE_URL`
 * points at, and `writesTo()` refuses the production endpoint by name. It writes
 * nothing either way: every request is a GET.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { reporter, writesTo } from "./_verify";
import { LIVE_PAGES, visibleText } from "./check-live";
import { LOCALE_COOKIE } from "../lib/i18n/config";

const { check, finish } = reporter();

const PORT = Number(process.env.SMOKE_PORT ?? 3210);
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForReady(timeoutMs = 60_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/api/revalidate`, { signal: AbortSignal.timeout(4000) });
      if (response.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function main() {
  writesTo();

  /*
   * 🔴 SKIPPED OUT LOUD, never silently passed.
   *
   * This runs inside `npm run gates`, which is often run without a build in
   * front of it. Exiting 1 would make people stop running gates; exiting 0 with
   * nothing printed would make this the fourth instrument in this repository to
   * pass by measuring nothing. So it says, in one line, that it did not run and
   * what to type.
   */
  if (!existsSync(".next/BUILD_ID")) {
    console.log("\n  --   SKIPPED, there is no build to smoke. `npm run build` first.\n");
    console.log("smoke: SKIPPED");
    return;
  }

  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  /*
   * 🔴 The server's own stderr is kept and printed for any page that fails.
   * A 500 with no reason is a line in a report nobody can act on, and the
   * reason is always in this stream: it is where React prints the throw.
   */
  let log = "";
  server.stdout?.on("data", (chunk: Buffer) => (log += chunk.toString()));
  server.stderr?.on("data", (chunk: Buffer) => (log += chunk.toString()));

  try {
    const ready = await waitForReady();
    check("the built app starts", ready, ready ? `serving on ${PORT}` : "it never became ready");
    if (!ready) {
      console.error(log.slice(-4000));
      return;
    }

    const failures: string[] = [];
    let checked = 0;

    for (const page of LIVE_PAGES) {
      for (const locale of page.locales) {
        checked++;
        let status = 0;
        let text = "";
        try {
          const response = await fetch(`${BASE}${page.path}`, {
            headers: { cookie: `${LOCALE_COOKIE}=${locale}` },
            redirect: "follow",
            signal: AbortSignal.timeout(30_000),
          });
          status = response.status;
          text = visibleText(await response.text());
        } catch (error) {
          failures.push(`${page.path}[${locale}] threw: ${String(error).slice(0, 80)}`);
          continue;
        }

        if (status !== 200) failures.push(`${page.path}[${locale}] ${status}`);
        else if (text.length < 200) {
          /*
           * 🔴 The half a status code cannot answer. Next serves the error
           * boundary with a 200 in some configurations, and a page that keeps
           * its shell and loses its content looks healthy from the outside.
           */
          failures.push(`${page.path}[${locale}] 200 but only ${text.length} characters of text`);
        }
      }
    }

    check(
      "🔴 C354 every public page renders, in every language it ships in",
      failures.length === 0,
      failures.length === 0 ? `${checked} pages, all with real content` : failures.join(" · "),
    );

    check(
      "🔴 CONTROL the smoke actually fetched something, rather than an empty list",
      checked >= 10,
      `${checked} page-and-locale pairs, from LIVE_PAGES`,
    );

    if (failures.length > 0) {
      console.error("\n--- server output ---\n");
      console.error(log.slice(-6000));
    }
  } finally {
    server.kill("SIGTERM");
  }

  finish("smoke");
}

main();
