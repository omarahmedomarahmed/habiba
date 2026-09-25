import assert from "node:assert/strict";
import { test } from "node:test";

import { isChunkLoadError, shouldReload } from "../lib/chunk-recovery";

function memory() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}

test("B7: a chunk that did not arrive is recognised in the shapes browsers throw", () => {
  const webpack = Object.assign(new Error("Loading chunk 4821 failed.\n(error: https://x/_next/static/chunks/4821.js)"), { name: "ChunkLoadError" });
  assert.equal(isChunkLoadError(webpack), true);
  assert.equal(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/a.js")), true);
  assert.equal(isChunkLoadError(new Error("Loading CSS chunk 12 failed")), true);
  // CONTROL: an ordinary render error is not reloaded away.
  assert.equal(isChunkLoadError(new Error("Cannot read properties of undefined")), false);
  assert.equal(isChunkLoadError(null), false);
});

test("B7: it reloads once, and a second failure on the same path shows the page", () => {
  const store = memory();
  const chunk = Object.assign(new Error("Loading chunk 1 failed"), { name: "ChunkLoadError" });
  assert.equal(shouldReload(chunk, "/patient/invite/abc", store, 1_000), true);
  assert.equal(shouldReload(chunk, "/patient/invite/abc", store, 5_000), false, "no reload loop");
  assert.equal(shouldReload(chunk, "/patient/invite/abc", store, 40_000), true, "a later visit gets its own retry");
  assert.equal(shouldReload(chunk, "/patient/claim", store, 5_000), true, "per path");
  assert.equal(shouldReload(chunk, "/x", null, 5_000), false, "no storage, no guard, no reload");
  assert.equal(shouldReload(new Error("boom"), "/y", memory(), 5_000), false);
});
