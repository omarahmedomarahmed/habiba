/**
 * 🔴 80.1 — WRITES THE PROMISES DOCUMENT.
 *
 *     npm run prove
 *
 * Four lines, because the argument lives in `_prove-doc.ts` along with every
 * line the document is built from. This is the half that has a side effect, and
 * keeping it this small is what lets the gate import the other half without
 * running this one.
 */
import { writeFileSync } from "node:fs";

import { COUNTS, VALUE_STATEMENTS_PATH, document } from "./_prove-doc";

writeFileSync(VALUE_STATEMENTS_PATH, document().join("\n"));
console.log(
  `\n  ${VALUE_STATEMENTS_PATH}: ${String(COUNTS.promises)} promises, ` +
    `${String(COUNTS.positions)} positions\n`,
);
