/**
 * 🔴 76.8 — THE MODULE SUBSTITUTIONS, INSTALLED BEFORE ANYTHING ELSE LOADS.
 *
 * ## The bug class this closes for good
 *
 * A verifier that renders real components has to replace two modules that
 * cannot load outside a renderer: `next/link`, which builds a React context at
 * import time, and `server-only`, whose whole implementation is a throw unless
 * the `react-server` export condition is set.
 *
 * `stubModules()` did that, and it was always slightly wrong, because a
 * function can only run AFTER the file's own static imports have already
 * resolved. `verify-sprint17.ts` imports `dbFor` at the top, `lib/db/index.ts`
 * begins with `import "server-only"`, and that throw happened before the first
 * line of `main()`. The workaround was to set `--conditions=react-server` on
 * the script, which silenced `server-only` and quietly swapped React for its
 * server build — which has no `createContext`.
 *
 * So the day a rendered component reached for the i18n provider, the verifier
 * died on an import, and the obvious fix was a third stub for that provider.
 * That fix answers one component and waits for the next one.
 *
 * ## Why a preload instead
 *
 * `--import` runs this before the entry module is even resolved, so the
 * substitutions are in place for every static import in the graph. The script
 * then runs on the FULL React build like `render-check` and `verify:sprint21r`
 * already do, `createContext` exists, and no component-specific stub is needed
 * for this one or for any component added later.
 *
 * Deliberately two exact module ids, for the reason `_render.ts` gives: a
 * broad mock would let a real failure be answered by a stub.
 */
import { createRequire } from "node:module";
import Module from "node:module";

const require = createRequire(import.meta.url);
const link = require.resolve("./_stub-link.tsx");
const empty = require.resolve("./_stub-empty.ts");

const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "next/link") return link;
  if (request === "server-only") return empty;
  return original.call(this, request, ...rest);
};
