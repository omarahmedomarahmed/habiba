import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The server pass and the client pass must render the same string. 12.3.
 *
 * ## The defect this pins
 *
 * 12.3 gave every date formatter a required `zone` argument, and six client
 * components filled it from `readerZone()` in a `const` at module scope:
 *
 *     "use client";
 *     const zone = readerZone();
 *
 * Next.js server-renders client components. `Intl` is defined in Node, so on
 * the server that expression evaluates to the *server's* zone — UTC on Vercel —
 * and in the browser to the reader's. The HTML said one day and the hydrated
 * DOM said another: a React hydration mismatch on every timestamp, console
 * errors, and a visible flash of the wrong date for anybody east of UTC. The
 * type system had forced a zone argument and the value passed was wrong on one
 * of the two passes.
 *
 * ## How this test works
 *
 * `process.env.TZ` can only be set before the first `Intl` call in a process,
 * so each render runs in its **own child process** — one at `TZ=UTC`, standing
 * in for the Vercel server, one at `TZ=Africa/Cairo`, standing in for the
 * reader's browser. Both render the real component through `react-dom/server`,
 * and the two strings must be byte-identical.
 *
 * The second test is the control: the same render, with the zone read from the
 * runtime instead of taken as a prop, **must** differ. Without it a passing
 * first test proves only that the harness runs.
 */

const RENDER = String.raw`
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { formatDate, formatDateTime, relativeDay } from "../lib/utils";
import { readerZone } from "../lib/scheduling/tz";

const AT = new Date("2026-09-12T23:30:00.000Z");

/** The shape every client component uses now: the zone arrives as a prop. */
function AsProp({ zone }: { zone: string | null }) {
  return (
    <div>
      <span>{formatDate(AT, zone)}</span>
      <span>{formatDateTime(AT, zone)}</span>
      <span>{relativeDay(AT, zone)}</span>
    </div>
  );
}

/** The shape that caused the bug: the zone read from whatever runtime this is. */
function FromRuntime() {
  const zone = readerZone();
  return (
    <div>
      <span>{formatDate(AT, zone)}</span>
      <span>{formatDateTime(AT, zone)}</span>
    </div>
  );
}

const which = process.argv[2];
process.stdout.write(
  which === "prop"
    ? renderToStaticMarkup(<AsProp zone="Africa/Cairo" />)
    : renderToStaticMarkup(<FromRuntime />),
);
`;

function renderUnder(tz: string, which: "prop" | "runtime"): string {
  const dir = mkdtempSync(join(tmpdir(), "hydration-"));
  const file = join(process.cwd(), "tests", `.hydration-render.${process.pid}.tsx`);
  try {
    writeFileSync(file, RENDER);
    return execFileSync("node", ["--import", "tsx", file, which], {
      env: { ...process.env, TZ: tz },
      encoding: "utf8",
    });
  } finally {
    rmSync(file, { force: true });
    rmSync(dir, { recursive: true, force: true });
  }
}

test("🔴 a date rendered from a prop is identical on the server pass and the client pass", () => {
  // UTC stands in for the Vercel server; Cairo for the reader's browser.
  const server = renderUnder("UTC", "prop");
  const browser = renderUnder("Africa/Cairo", "prop");

  assert.equal(
    server,
    browser,
    "the server-rendered HTML and the hydrated markup differ — this is a React hydration mismatch",
  );

  // And the string is the *reader's* day, not the server's. 23:30Z on the 12th
  // is 01:30 on the 13th in Cairo.
  assert.match(server, /13 Sept 2026/);
});

test("…and the control: reading the zone from the runtime during render does differ", () => {
  const server = renderUnder("UTC", "runtime");
  const browser = renderUnder("Africa/Cairo", "runtime");

  // If this ever passes, the harness has stopped exercising the difference and
  // the test above proves nothing.
  assert.notEqual(
    server,
    browser,
    "expected the two runtimes to disagree — without that the first test is vacuous",
  );
  assert.match(server, /12 Sept 2026/);
  assert.match(browser, /13 Sept 2026/);
});

test("readerZone() answers on the server — it does not return null there", () => {
  /*
   * The mistaken premise, pinned. The comment on `readerZone` used to say it
   * returned null during server rendering, so a caller could fall through to a
   * fallback. `Intl` is defined in Node and answers, so there is no null and
   * no fall-through, and six components were built on that sentence.
   */
  // A file rather than `node -e`, which has no directory to resolve a
  // relative import against.
  const file = join(process.cwd(), "tests", `.hydration-zone.${process.pid}.ts`);
  let out: string;
  try {
    writeFileSync(
      file,
      'import { readerZone } from "../lib/scheduling/tz";\nprocess.stdout.write(String(readerZone()));\n',
    );
    out = execFileSync("node", ["--import", "tsx", file], {
      env: { ...process.env, TZ: "UTC" },
      encoding: "utf8",
    }).trim();
  } finally {
    rmSync(file, { force: true });
  }

  assert.equal(out, "UTC");
  assert.notEqual(out, "null");
});
