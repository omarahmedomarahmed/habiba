import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { etaNumber, parseEtaJson, serializeEta, toEtaJson } from "../lib/billing/eta/serialize";

/**
 * 🔴 The Egyptian Tax Authority signs over a canonical text, and one character
 * of difference is a rejected invoice. These are checked against the SDK's own
 * published example (tests/fixtures/eta, from sdk.invoicing.eta.gov.eg/files).
 */
const doc = readFileSync(new URL("./fixtures/eta/one-doc.json", import.meta.url), "utf8");
const want = readFileSync(new URL("./fixtures/eta/one-doc-serialized.txt", import.meta.url), "utf8").trim();

test("the serialization of the SDK's example document is the SDK's own, byte for byte", () => {
  assert.equal(serializeEta(parseEtaJson(doc)), want);
});

test("a number keeps its written decimals through signing and submission", () => {
  const value = { grossWeight: etaNumber(10.5, 2) };
  assert.equal(serializeEta(value), '"GROSSWEIGHT""10.50"');
  assert.equal(toEtaJson(value), '{"grossWeight":10.50}');
  assert.equal(serializeEta(parseEtaJson(toEtaJson(value))), '"GROSSWEIGHT""10.50"');
});

test("signatures are never part of what is signed", () => {
  assert.equal(serializeEta({ a: "1", signatures: [{ value: "x" }] }), '"A""1"');
});
