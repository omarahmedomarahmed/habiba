import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 WHERE CHROMIUM ACTUALLY IS, RESOLVED RATHER THAN CONFIGURED.
 *
 * ## The gap this closes, which stood for four sprints
 *
 * Thirteen Playwright tests have been failing in this environment for as long as the standing-gaps
 * list has existed, recorded as "no headless shell". That was wrong. The real error is
 *
 *     Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1234/…
 *
 * and the directory that exists is `chromium_headless_shell-1194`. It is a VERSION MISMATCH between
 * the `playwright` package the repository pins and the browser build the environment ships, not an
 * absent browser. A full Chromium is sitting at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
 * and launches fine.
 *
 * ## 🔴 AND `E2E_CHROMIUM` WAS ALREADY THERE, WHICH IS THE INSTRUCTIVE PART
 *
 * `tests/e2e.test.ts` already read an `E2E_CHROMIUM` env var and passed it as `executablePath`. The
 * hook was correct and nothing set it, so it did nothing for four sprints while the tests failed
 * with a message that named the actual problem.
 *
 * An escape hatch that requires somebody to know it exists is an escape hatch that stays shut. So
 * this RESOLVES: the env var still wins, and without it the directory is searched for whatever
 * build is actually present. A new environment with a different suffix works with no edit.
 *
 * ## Why not pin the package to match
 *
 * Because the mismatch would come back. The environment's browser is provisioned outside this
 * repository and will move again; a version pinned to today's build is a pin that breaks on the next
 * image. Searching for what is there is the thing that keeps working.
 */

/** The env var still wins, because an operator with a specific build should be able to say so. */
const OVERRIDE = "E2E_CHROMIUM";

/**
 * Candidate paths inside a Playwright browsers directory, in preference order.
 *
 * The full browser first and the headless shell second. The shell is smaller and faster, and it
 * cannot do the one thing this sprint needs it to: `chrome-headless-shell` has no support for the
 * fake media-stream flags the session-room captures rely on, so a capture run against it produces a
 * room with no video where the product would show one.
 */
const RELATIVE = [
  join("chrome-linux", "chrome"),
  join("chrome-linux", "headless_shell"),
  join("chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
];

export function chromiumExecutable(): string | undefined {
  const override = process.env[OVERRIDE];
  if (override && existsSync(override)) return override;

  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;

  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return undefined;
  }

  /*
   * `chromium-1194` before `chromium_headless_shell-1194`, and a higher build number before a lower
   * one. Sorted descending so a directory with two builds picks the newer rather than whichever the
   * filesystem happened to list first.
   */
  const ranked = entries
    .filter((entry) => entry.startsWith("chromium"))
    .sort((a, b) => {
      const shell = (name: string) => (name.includes("headless_shell") ? 1 : 0);
      if (shell(a) !== shell(b)) return shell(a) - shell(b);
      const build = (name: string) => Number(name.match(/-(\d+)$/)?.[1] ?? 0);
      return build(b) - build(a);
    });

  for (const entry of ranked) {
    for (const relative of RELATIVE) {
      const candidate = join(root, entry, relative);
      if (existsSync(candidate)) return candidate;
    }
  }

  return undefined;
}

/**
 * Launch options every browser-driving script in this repository shares.
 *
 * 🔴 One place, because there are now four callers (`tests/e2e.test.ts`, `scripts/screens.ts`,
 * `scripts/shoot-room.ts` and the sprint-52 capture) and the first three each had their own idea of
 * how to find a browser. Three ideas is how one of them stays broken.
 *
 * Returns `{}` for the path when nothing is found, so Playwright's own resolution still runs and the
 * error a caller sees is Playwright's rather than ours.
 */
export function launchOptions(extra: { args?: string[] } = {}) {
  const executablePath = chromiumExecutable();
  return {
    ...(executablePath ? { executablePath } : {}),
    args: extra.args ?? [],
  };
}
