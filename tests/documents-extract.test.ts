import assert from "node:assert/strict";
import { test } from "node:test";

import { columnCount, isInterleaved, linesOf, type LayoutItem } from "../lib/documents/layout";
import { makePdf, singleColumn, twoColumn, PAGE_HEIGHT } from "./fixtures/make-pdf";

/**
 * C50, built in 11R.23.
 *
 * Two levels. The heuristic is asserted on synthetic coordinates, where the
 * layout is whatever the test says it is; then the whole path is run against
 * real PDF bytes through the real parser, because a heuristic that is right
 * about numbers and never sees a PDF has proved nothing.
 */

/* --------------------------------------------------------- the heuristic -- */

function row(y: number, xs: { x: number; width: number }[]): LayoutItem[] {
  return xs.map((item) => ({ ...item, y, str: "text" }));
}

test("a single column of prose is one column", () => {
  const items = Array.from({ length: 20 }, (_, i) =>
    row(800 - i * 18, [
      { x: 60, width: 200 },
      { x: 265, width: 210 },
    ]),
  ).flat();

  // The gap between the two runs is 5pt — a word space, not a column boundary.
  assert.equal(columnCount(items), 1);
});

test("🔴 two columns with a gutter down the middle are refused", () => {
  const items = Array.from({ length: 20 }, (_, i) =>
    row(800 - i * 18, [
      { x: 60, width: 180 },
      { x: 340, width: 180 },
    ]),
  ).flat();

  assert.equal(columnCount(items), 2);
  assert.equal(isInterleaved([items]), true);
});

test("one bad page in ten makes the whole document unsupported", () => {
  const good = Array.from({ length: 20 }, (_, i) => row(800 - i * 18, [{ x: 60, width: 400 }])).flat();
  const bad = Array.from({ length: 20 }, (_, i) =>
    row(800 - i * 18, [
      { x: 60, width: 180 },
      { x: 340, width: 180 },
    ]),
  ).flat();

  // Not a majority vote: one interleaved page is one citable passage that
  // reads a dose off the wrong side of the page.
  assert.equal(isInterleaved([good, good, good, bad, good]), true);
});

test("a short page is not judged — there is nothing to measure", () => {
  const items = row(800, [
    { x: 60, width: 180 },
    { x: 340, width: 180 },
  ]);
  assert.equal(columnCount(items), 1);
});

test("a heading beside a left-margin label is not a column boundary", () => {
  // "Date:            12 September" — a wide gap, but it starts at the margin
  // and ends before the middle band.
  const items = Array.from({ length: 20 }, (_, i) =>
    row(800 - i * 18, [
      { x: 60, width: 30 },
      { x: 150, width: 320 },
    ]),
  ).flat();

  assert.equal(columnCount(items), 1);
});

test("lines group by baseline and sort left to right", () => {
  const lines = linesOf([
    { x: 300, y: 700, width: 50, str: "second" },
    { x: 60, y: 700, width: 50, str: "first" },
    { x: 60, y: 640, width: 50, str: "below" },
  ]);

  assert.equal(lines.length, 2);
  assert.deepEqual(
    lines[0]!.map((i) => i.str),
    ["first", "second"],
  );
});

/* ---------------------------------------------------- the whole path -- */

test("a one-column PDF extracts its text", async (t) => {
  const { extractText } = await import("../lib/documents/extract");
  const bytes = makePdf(singleColumn());

  const text = await extractText({
    blobUrl: await writeTemp(t, bytes, "one-column.pdf"),
    mimeType: "application/pdf",
  });

  assert.ok(text, "expected text from a one-column PDF");
  assert.match(text!, /Patient reports low mood/);
  assert.match(text!, /line 20 of the letter/);
});

test("🔴 a two-column PDF extracts nothing at all", async (t) => {
  const { extractText } = await import("../lib/documents/extract");
  const bytes = makePdf(twoColumn());

  const text = await extractText({
    blobUrl: await writeTemp(t, bytes, "two-column.pdf"),
    mimeType: "application/pdf",
  });

  // `null`, which the caller writes as `unsupported` and the screen shows as
  // "Stored, but not searchable". Never the interleaved text.
  assert.equal(text, null);
});

test("a PDF with no text layer is unsupported, like the scan it is", async (t) => {
  const { extractText } = await import("../lib/documents/extract");
  const bytes = makePdf([]);

  const text = await extractText({
    blobUrl: await writeTemp(t, bytes, "empty.pdf"),
    mimeType: "application/pdf",
  });

  assert.equal(text, null);
});

test("a legacy .doc is still stored-only — mammoth reads OOXML, not the binary", async () => {
  const { readabilityOf } = await import("../lib/documents/formats");
  assert.equal(readabilityOf("application/msword"), "stored_only");
  assert.equal(
    readabilityOf("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    "readable",
  );
  assert.equal(readabilityOf("application/pdf"), "readable");
  assert.equal(readabilityOf("image/jpeg"), "stored_only");
});

/**
 * `extractText` reads through `fetchDocument`, which takes the local-uploads
 * path when the URL starts with `/api/uploads/`. Writing there exercises the
 * real read rather than stubbing it.
 */
async function writeTemp(
  t: { after: (fn: () => void | Promise<void>) => void },
  bytes: Uint8Array,
  name: string,
): Promise<string> {
  const { mkdir, writeFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const dir = join(process.cwd(), ".uploads");
  await mkdir(dir, { recursive: true });
  const file = join(dir, name);
  await writeFile(file, bytes);
  t.after(() => rm(file, { force: true }));

  return `/api/uploads/${name}`;
}

// Referenced so the fixture's page height stays honest if it ever changes.
assert.ok(PAGE_HEIGHT > 0);
