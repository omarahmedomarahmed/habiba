# Slice 12: scripts part 1 of 4

Read-only reading. Every file below was read line by line with the Read tool, comments included.
Verifier template used below: Claims / Reads / Control / T1 / T3 / T4 / T6.

## Files

### scripts/_browser.ts (107 lines)
- For: resolves a Chromium executable for Playwright callers, rather than trusting config.
- Decides: `chromiumExecutable` (53): `E2E_CHROMIUM` env wins if the path exists; else scans `PLAYWRIGHT_BROWSERS_PATH` for `chromium*`, full browser ranked before `headless_shell`, higher build number first (72 to 79). `launchOptions` (101) returns `{}` path when nothing is found so Playwright's own error surfaces.
- Assumes: Playwright directory layout `chromium-NNNN/chrome-linux/chrome`.
- Promises: none directly.
- Notes: no side effect, safe to import (T6 ok). Comment at 94 names four callers including `scripts/shoot-room.ts` (not in this slice, existence not checked here).

### scripts/_cast.ts (473 lines)
- For: the six month simulation cast (not the demo cast): 27 people, their keys, emails, phones, waves, and our own payroll.
- Decides: `SIMULATION_PASSWORD` (55) is a second shared password constant, distinct from the documented demo password (value not copied here; see Suspect). `CAST` (126 to 448), `SEEDED` (451, the 7 staff/operators with `arrives: "seeded"`), `WITH_LOGINS` (454), `PAYROLL` (460, the same 7 at `STARTING_SALARY_CENTS` 50,000 = $500/month each), `firstNameOf`/`lastNameOf` (466, 471).
- Assumes: `simulate:seed` writes SEEDED into `users` and PAYROLL into `employees`; `verify:cast` reads it back; `docs/simulation/12-THE-LOGINS.md` generated from it.
- Promises: A5 indirectly (SU1 to SU5 are `staff`, OP/OP2 `super_admin`, so a refusal can be witnessed).
- Notes: header (1 to 44) says "Three people are seeded"; the list seeds SEVEN (OP, OP2, SU1..SU5). Patients carry both an `email` and a `phone`; the 76.58 comment (64 to 81) says patient sign-up never asks for email and email is null for every self-signed patient, yet `email` is still populated for P1..P7 (so `WITH_LOGINS` includes seven patients whose address "cannot exist" by the file's own admission). No side effects, T6 ok.

### scripts/_content-ready.ts (180 lines)
- For: shared precondition "is published content in this DB", so content checks SKIP (with reason) rather than fail on an empty database.
- Decides: `livePages` (62) reads `content_pages` excluding `%-x-staging` locales; `stagedPages` (84) the reverse; `readiness` (105) filters `status === "published"`, `hasPage`, `hasBlock`; `withPublishedContent` (146) only runs the body when ready, otherwise the skip reporter records `AWAITS = "22.8b"`.
- Assumes: caller's `skipUnless` reporter. `dbFor(DEFAULT_REGION)` at module scope (39): importing this creates a DB handle (no query) at import.
- Promises: none directly; it is the mechanism by which content checks read PUBLISHED ROWS (relevant to H28).
- Notes: a skip is a silent pass shape. If `content_pages` were emptied on production (H49), every content check would print skip, not fail. The skip reason is always the fixed string "22.8b" (a sprint step long past), so a skip today names a stale cause. See Stale.

### scripts/_dashes.ts (95 lines)
- For: the em/en dash ban as a shared module, plus the two comment strippers.
- Decides: `EM_DASH`/`EN_DASH` built from code points (33, 34); `ALLOWED` (40) three paths; `stripComments` (47) and `stripCommentsKeepingLines` (63); `dashesIn` (74) strips comments then flags a dash per line; `dashesInText` (90) for DB values.
- Assumes: callers pass repo-relative paths matching `ALLOWED` exactly.
- Promises: none of the 25 (house style).
- Notes: both strippers are regex, not a parser. `//` inside a string is only stripped when the line STARTS with `//` (51, 68), so trailing `// comment` after code is NOT stripped, and a dash in a trailing line comment would be reported as copy. Block-comment regex will also eat `/*` inside a string literal (e.g. a glob `"app/**/*.tsx"` opens a block comment that runs to the next `*/`), which can silently delete real code from the scan. Header says `lib/i18n/config.ts` is an allowed exception (21); `ALLOWED` (40 to 44) does not list it. See Stale.

### scripts/_demo-cast.ts (152 lines)
- For: the demo cast shared by `seed-demo.ts` and `verify-demo.ts`, with no `main()` (T6 fix).
- Decides: `DEMO_PASSWORD` (30), the documented demo password. `OWNED_INBOXES` (40) FIVE real addresses. `DEMO_LOGINS` (67) twelve logins across four tables (`users` x6, `sponsor_users` x1, `clinic_managers` x1, `patient_accounts` x4). `UNCLAIMED_EMAIL` (152) `laila.demo@example.com` must have no account.
- Assumes: `seed-demo.ts` creates exactly these; `verify:demo` asserts the example.com / owned split.
- Promises: A5 (the `staff.demo` non-founder login, 83 to 88, exists so a refusal can be witnessed); P2 (the email half must be walked on the five owned inboxes).
- Notes: T6 clean (constants only). Real personal gmail addresses of the founders are committed in source (40 to 46); not secrets, but personal data in a public-shaped file. Comments say "FOUR REAL INBOXES" (33) and "eleven logins" (23, 29); the lists hold five and twelve. See Stale.

### scripts/_environments.ts (84 lines)
- For: names the three databases (production, dev, simulation) by variable and Neon endpoint host.
- Decides: `ENVIRONMENTS` (43); `environmentOf(url)` (75) matches by `url.includes(endpoint)`, returns null for unknown; `urlFor` (81).
- Assumes: endpoint ids in HAZARDS.md match (they do: `ep-wild-lake-a6tgm2r6`, `ep-aged-dust-a6huadss`, `ep-empty-queen-a62vlkkp`).
- Promises: none.
- Notes: purpose string for production (49) says "Nothing in this repository writes to it without a typed override", which is true only via the on:production allow-list. Endpoint ids are not secrets (the file says so, 25 to 27). No side effects.

### scripts/_gates.ts (627 lines)
- For: the single list `GATES` that `gates.ts` runs and `verifiers.ts` excludes.
- Decides: 35 entries (19 to 627): prose, claims, notices, principals, i18n (`verify:sprint37l`), boundary, raw sql, renders (`smoke`), finance, plan, rail, settings (`settings:check`), environments (`settings:compare`), cycle, edges, entitlement, board, actuals, payout, limits, physics, suites, money, caseload, orb, profile, served, rendered (`render:check`), verifiers, palette, machines, traps, csp, runbook, prove.
- Assumes: every `script` exists in package.json (not checked here).
- Promises: the `why` strings map gates to promises: rail = A1, edges = A2/E3 (per VALUE-STATEMENTS), notices = P2, prove = the 25 walk.
- Notes: comment blocks are misplaced relative to entries: the 76.30 "served" comment (386 to 400) sits above `caseload`, the 76.35 "orb" comment above caseload too, and the 76.62 "runbook" comment (511 to 533) sits above `palette`; the entries they describe come later. The `verifiers` comment says "eighty-one verify scripts ... ran twelve ... seventy-nine" (491 to 510), numbers that cannot all hold now that 35 gates exist. `verify:sprint37l2` (the T1 enforcer per TRAPS.md) is NOT in GATES; it only runs if `verifiers.ts` discovers it. No side effects.

### scripts/_i18n-coverage.ts (287 lines)
- For: the English-literal counter behind the i18n ratchet (`verify:sprint37l`, gate "i18n").
- Claims: counts English text a reader meets in `.tsx` under `app/` and `components/`.
- Reads: raw `.tsx` source via `readFileSync` (237) then `stripComments` from `_dashes` inside `literalsIn` (94). So T1 is handled for the literal count, but `translates` (242) is computed on the UNSTRIPPED source: a file whose only `t("x.` or `useT()` is in a comment is marked as translating.
- Decides: text nodes `(^|[^=])>([^<>{}]+)<` (112) and attributes `aria-label|placeholder|title|alt|label|hint` (145); `isVisibleEnglish` (154) rejects code shapes, ternaries (190), object-literal entries (215), short/lowercase tokens, Arabic. `EXEMPT` (57) by substring match: admin strings console, strings-editor, page-editor, ALL of `app/(public)/`, `components/public/blocks`. `surfaceOf` (254) buckets.
- Control: none in this file; header says `verify:sprint37l` carries the control for the object-literal shape (212).
- T3: n/a (walks directories). SKIP set (48) is by NAME at every depth (H31 shape): any directory called `build` or `dist` anywhere under app/components would vanish from the count. None exists today (checked with `find`).
- T4: direct-run prints "Worst twenty files" (283) with no line saying how many more files carry literals; the TOTAL line is printed before, so the total survives.
- T6: side effect guarded by `ranDirectly("_i18n-coverage.ts")` (274), a suffix-style guard (see `_verify.ts`); the side effect is console output only, so harmless, but it is exactly the shape TRAPS T6 says `verify:traps` refuses.
- Promises: none of the 25 directly (Arabic parity is house policy). H23 floor caveat applies (ternaries invisible, admitted).

### scripts/_i18n-lines.ts (17 lines)
- For: ad-hoc: print lines of one file that carry English literals.
- Notes: runs at module scope with no guard (6 to 17), reads `process.argv[2]`. Leading underscore + side effect contradicts the T6 rule that underscore files have no side effects. Not imported anywhere and not in package.json (grep), so no live hazard; dead-ish tool. Matching is by first three words of a 24-char prefix (12), approximate.

### scripts/_i18n-list.ts (19 lines)
- For: ad-hoc: list files carrying English, filtered by path fragment.
- Notes: same as above, runs at module scope, not imported, not in package.json. Underscore + side effect (T6 convention breach, harmless today).

### scripts/_prove-doc.ts (178 lines)
- For: builds `docs/VALUE-STATEMENTS.md` text from `_value-statements.ts` and `_demo-cast.ts`; no main (T6 fix for the prove.ts suffix collision).
- Decides: `document()` (61) returns lines; audience sections from `AUDIENCES`, statements from `VALUE_STATEMENTS`, the five positions table from `SCENARIOS`, per-position coverage and pot from `TUNING`, logins from `DEMO_LOGINS`. `COUNTS` (175).
- Assumes: `verify:prove` compares the file on disk to `document()`.
- Promises: frames all 25; the prose (74 to 83) claims `lib/content/honesty.ts` refuses two claims "in savePage and again against the published rows" (not checkable here).
- Notes: the "Three of these are at example.com" paragraph (162 to 167) is HARD-TYPED prose, not derived: `DEMO_LOGINS` holds SEVEN example.com addresses (staff.demo, dr.sara, dr.kareem, dr.yasmin, mariam, tarek, nadia). The generator itself emits a false count into a document described as generated so it cannot drift. Also "five per audience" (67) is typed, not computed. `verify:prove` comparing file to generator cannot catch this, since both come from the same typed sentence (T2 shape: the check is self-referential). TESTERS (53) is also hand-typed. See Stale.

### scripts/_reachability.ts (155 lines)
- For: "can a human reach this table" scan: a table is reachable if a module naming it is transitively imported by a non-API `app/` file or any `components/` file. Used by `verify:sprint51`.
- Claims: table has a human surface.
- Reads: raw source of every `.ts/.tsx` via `readFileSync` (55), comments INCLUDED (T1): a comment naming a table ident makes that file a holder (87), and a comment containing `@/lib/x` makes a file look like an importer (66). Both errors point toward "reachable", i.e. they HIDE orphans.
- Decides: `walk` (36) skips `node_modules`, `.next`, `.git`, `drizzle`, `public` by NAME at every depth (38): this skips `components/public/` (H31 exactly, the file HAZARDS names). `importersOf` (61) matches `"@/" + base` as a substring, so `@/lib/data/session` also matches an import of `@/lib/data/sessions` (prefix collision, again toward "reachable"). Relative imports (`./x`) are never followed. `import type` is not skipped and a `"use server"` boundary is not respected (H32). `isSurface` counts every file under `components/` as a surface even if no page imports it, which C356 (PLAN.md 335) says is exactly wrong ("reachability is transitive from a page.tsx or layout.tsx, never from any component").
- `NO_SCREEN_BY_DESIGN` (102): `patient_auth_sessions`, `partner_consents` (68.2 GAP), `partner_clinicians` (68.6 GAP).
- Control: none in this file (header says the verifier fails on a stale exemption).
- T6: no side effect.
- Promises: none directly. See Suspect and Broken.

### scripts/_region-pins.ts (86 lines)
- For: static count of `pinnedToDefaultRegion("where","reason")` call sites across app, lib, scripts, tests; ratchet in `_region-pins.json`.
- Reads: raw source, comments included (63, T1). A comment quoting a call counts as a pin (overcount, safe direction for a ratchet that fails when the count RISES, but can block a legitimate reduction from showing). `mislabelled` (84) flags `where !== file`.
- Control: none here. T6: no side effect. walk skips only `node_modules` (43).

### scripts/_render-preload.mjs (46 lines)
- For: `--import` preload that redirects `next/link` to `_stub-link.tsx` and `server-only` to `_stub-empty.ts` before any static import resolves.
- Notes: patches `Module._resolveFilename` globally for the process (42). Consequence: every script run with this preload (render:check, mail:preview, verify:sprint17/21r/43/44/53..68, capture:payments) can import `server-only` modules, i.e. the build-time guard that stops server code reaching the client is OFF for those scripts. Fine for scripts, but any verifier that asserted "this module is server-only" by importing it would pass wrongly. Two exact ids, as claimed.

### scripts/_render.ts (118 lines)
- For: render real components to HTML outside Next: `stubModules` (27, same two stubs as the preload, installed at call time), `resolve` (55), `renderMarkup` (112).
- Decides: `resolve` calls every function component as a server component and, on ANY throw, returns the element untouched (82 to 90).
- Notes: that catch swallows a genuine server-component failure (a DB error, a missing column) and hands the element to `renderToStaticMarkup`, which then reports "a component suspended" or renders an empty/fallback, which is a message about the wrong thing (the file's own header warns of exactly this for the React global, 32 to 35). A render check built on this can go green over a server component that threw, if the fallback HTML happens to satisfy its assertion. Header comment (4) says extracted from `render-check.ts`; `stubModules` still exists though the preload (76.8) says it was "always slightly wrong".

### scripts/_scan-deferrals.ts (85 lines)
- For: enforce C93: a verifier must not read `contentPages` except through `withPublishedContent`, unless it is a control reading its own planted row.
- Decides: `stripComments` (32, a THIRD copy of the stripper, block comments and whole-line `//` only), `contentReads` (49) finds `.from(contentPages)`, bounds the statement back to the nearest `const `/`await `/`return ` and forward to `;`; `control` is true when the statement matches `/verify\d*-?control|"verify/i` (73).
- Notes: the control test is loose: any statement that contains the characters `"verify` (e.g. a string literal label or a slug prefix) is treated as a legitimate control, so a real undeferred read of published content passes if its statement happens to contain `"verify`. Only `.from(contentPages)` is detected; `db.query.contentPages.findMany` or raw `sql` on `content_pages` are invisible. No control proving the scanner catches a planted offender in this file.

### scripts/_stub-empty.ts (13 lines)
- For: empty module standing in for `server-only`. Header says "used only by render-check.ts"; it is used by `_render-preload.mjs` for ~20 scripts (package.json). Stale comment.

### scripts/_stub-link.tsx (22 lines)
- For: plain `<a>` in place of `next/link`. Header says "used only by verify-sprint17.ts"; used by `_render.ts` and `_render-preload.mjs` for ~20 scripts. Stale comment.

### scripts/_stub-navigation.tsx (56 lines)
- For: no-op `next/navigation` (useRouter, usePathname "/", useSearchParams, useParams, redirect/notFound throw) for `capture-payments.tsx` only (89).
- Notes: `usePathname` always "/" means any component that highlights by path renders the home state in captures. Deliberately not a spy (21 to 23).

