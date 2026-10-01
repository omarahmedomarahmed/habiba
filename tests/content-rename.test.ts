import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { NON_COPY_KEYS } from "../lib/content/claims";
import { RENAME_SKIPS, renameIn, shapeOf } from "../scripts/_content-rename";

/** content:rename changes copy only, and checks every row before it writes any. */

test("a rename changes copy and leaves links, images, ids and kinds alone", () => {
  const blocks = [
    {
      type: "hero",
      title: "Crisis Radar for everyone",
      ctaHref: "/crisis-radar",
      href: "/crisis-radar",
      backgroundImage: "/img/crisis-radar.png",
      items: [{ id: "crisis-radar", body: "Open Crisis Radar now", url: "https://example.com/crisis-radar" }],
    },
  ];
  const count = { n: 0 };
  const next = renameIn(blocks, "Crisis Radar", "Radar", count) as typeof blocks;
  assert.equal(count.n, 2);
  assert.equal(next[0]!.title, "Radar for everyone");
  assert.equal(next[0]!.items[0]!.body, "Open Radar now");
  assert.equal(next[0]!.ctaHref, "/crisis-radar");
  assert.equal(next[0]!.items[0]!.id, "crisis-radar");
  assert.equal(shapeOf(next), shapeOf(blocks));

  const kind = [{ type: "Crisis Radar", body: "x" }];
  assert.equal((renameIn(kind, "Crisis Radar", "Radar", { n: 0 }) as typeof kind)[0]!.type, "Crisis Radar");
});

test("the skip list is the claims guard's, plus the link, image and id keys", () => {
  for (const key of NON_COPY_KEYS) assert.ok(RENAME_SKIPS.has(key), key);
  for (const key of ["href", "ctaHref", "slug", "url", "src", "image", "backgroundImage", "icon", "id", "type", "demo"]) {
    assert.ok(RENAME_SKIPS.has(key), key);
  }
});

test("every row is checked before any is written, and the writes share one transaction", () => {
  const source = readFileSync("scripts/content-rename.ts", "utf8");
  const refuse = source.indexOf("shape changed, refusing");
  const write = source.indexOf("db.transaction(");
  assert.ok(refuse > 0 && write > refuse, "the refusal must come before any write");
  assert.doesNotMatch(source.slice(0, write), /\.update\(contentPages\)/, "a write before the transaction");
});
