/**
 * 🔴 80.1: PRINTS THE PROMISES DOCUMENT.
 *
 *     npm run prove
 *     npm run prove > /tmp/promises.md     # to keep a copy
 *
 * The argument lives in `_prove-doc.ts` along with every line the document is
 * built from. Until 2026-10-01 this wrote `docs/VALUE-STATEMENTS.md`; the
 * promises live in `scripts/_value-statements.ts`, so a committed copy of them
 * was retired and this prints them instead. `docs/DEMO.md` says which seeded
 * position proves each one, and `verify:prove` holds that page to the array.
 */
import { COUNTS, document } from "./_prove-doc";

console.log(document().join("\n"));
console.error(
  `\n  ${String(COUNTS.promises)} promises, ${String(COUNTS.positions)} positions\n`,
);
