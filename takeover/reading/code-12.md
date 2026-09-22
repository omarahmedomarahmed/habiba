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

### scripts/_surfaces.ts (424 lines)
- For: shared loader for `verify:reachable` (58.x): unwired server actions, uncalled API routes, unlinked pages, uncalled exports in "safety" modules.
- Claims: every action/route/page/export has a caller a human can reach.
- Reads: every `.ts/.tsx` in the repo; `body` raw (125) and `code` comment-stripped via `stripCommentsKeepingLines` (165).
- Decides: `SKIP_AT_ROOT` (63) anchored at depth 0 (H31 fixed here); `isBuildDir` prefix `.next` (79); `isRendered` (119) only `page.tsx`/`layout.tsx`; `importersOf` (135) `"@/path"` quoted alias or same-dir `"./leaf"`; `reachesPage` (153) memoises only true; `serverActions` (183) `"use server"` in first 400 chars; `unwiredActions` (204); `routePath`/`apiRoutes`/`uncalledRoutes` (221 to 263, excludes scripts/ and tests/, reads `code`); `pagePath`/`pages`/`unlinkedPages` (268 to 302, anchored regex on `code`); `SAFETY_MODULES` (335: lib/data, partner, billing, crisis, console, access, ehr, ai); `libraryExports` (372); `uncalledExports` (396, reads `code`).
- T1: PARTLY BROKEN. `unwiredActions` tests callers against `s.body` (212), the RAW source with comments, not `s.code`. A comment naming an action makes it look wired: exactly the false-PASS the `code` field's own comment (97 to 112) warns about. `importersOf` also reads `body` (144), so a comment containing `"@/lib/x"` in quotes counts as an import edge.
- Also: comment at 146 promises `./thing` or `../thing`; code only matches `"./leaf"` from the same directory (147, 148). `../` imports and `./sub/leaf` are never followed, which points toward "unreachable" (false fail, safe direction). `isRendered` ignores `error.tsx`, `not-found.tsx`, `loading.tsx`, `template.tsx`, `default.tsx`, `route.ts` which Next also renders or serves (false fail direction). `unwiredActions` matches `\bname\b` anywhere, so a same-named local variable in a page counts as a caller.
- Control: none in this file (header says `verify:reachable` asserts a components/public file count).
- T3: derived, good. T6: no side effect.
- Promises: E1 via C369 note (318 to 321): the comment says `potBalance` has zero callers and sponsors see the raw balance. Grep shows `potBalance` IS now called by `app/(sponsor)/sponsor/page.tsx:63` and `app/(sponsor)/sponsor/pot/page.tsx:83`; `upsertSubject` by `lib/partner/platform.ts:143`; `queueWebhook` by `app/(patient)/patient/consent/actions.ts:168`; `unpause` by `app/(admin)/admin/benefits/actions.ts:43`; `diariseSession` by `lib/ai/notes.ts:387`. The C369 list is stale history (see Looks broken, is handled).

### scripts/_tmp-owed.ts (37 lines)
- For: one-off diagnostic printing what the pay sheet asks a covered patient for, before and after a fix (the employer's share charged again).
- Reads: production-capable `controlDb` query on `sessions WHERE join_token = 'join-coverage-demo'` (9); calls `patientOwesFor`, `sessionTransferMoney`, `egpRateMicro`.
- Notes: leading underscore AND `main()` at module scope (37), no `writesTo`/`hostOf` guard and prints no host: runs against whatever `DATABASE_URL` is. Read-only as far as these calls go (not verified that `egpRateMicro` never writes). Not imported and not in package.json. `rows[0]` dereferenced with no check (11): on a DB without that join token it dies with a TypeError, the exact shape `required()` exists to prevent. Dead debugging file; a T6 convention breach by name. Money relevance: records that a covered patient was once asked for the employer's half on top (22, 23), i.e. a double-charge path that was fixed; the fix location is `lib/billing/session-owed.ts` (out of slice).

### scripts/_value-statements.ts (435 lines)
- For: the 25 promises (P1..A5), the five positions (`SCENARIOS`), per-position `TUNING`, and `scenarioFrom` shared by seed and verifier.
- Decides: `VALUE_STATEMENTS` (69 to 277) text matches docs/VALUE-STATEMENTS.md. `SCENARIOS` (307): live proves P1 P2 P3 T1 T2 T4 A1; money E1 E2 E3 T3 A2 A3 A4; continuity P3 P4 T5 C2 C5; crisis P5 A3 A5; growth C1 C3 C4 E4 E5. `TUNING` (391): coverage 60% everywhere except money 10%; pot $2,500 except growth $100; second patient enrolled in money and growth. `scenarioFrom` (414) accepts `--scenario=x` or `--scenario x`, throws on unknown.
- Notes: `scenarioFrom` uses `startsWith("--scenario")`, so `--scenarios=...` also matches and is parsed. Minor. The TUNING comment (380 to 385) says growth's $100 pot is against "six covered sessions that want $270": check in seed-demo. The `where` for P2 is a verifier script, and for A1 is `verify:rail`: two promises whose "where we say it" is our own gate, not a page a stranger can read, contradicting the header rule (18 to 23) "Each says is a claim the product already makes on a page a stranger can read, or a rule it already enforces in code" (the "or" covers it, but the stranger-readable half is absent for P2, A1, C4, E3, E5, A2, A3, A4, whose `where` is a docs file or a task number).
- T6: no side effect.

### scripts/_verify.ts (521 lines)
- For: the shared verifier toolkit: `reporter` (49), `sawRows` (115), `hostOf` (159), `writesTo` (193), `required` (265), `readSource` (290), `ranDirectly` (319), `constraintContradictions` (346), `migrationLedgerAudit` (473).
- Decides: `writesTo` refuses when the `DATABASE_URL` host contains `ep-wild-lake-a6tgm2r6` unless BOTH the caller passes `productionIsAllowed: true` AND env `I_MEAN_PRODUCTION` equals that endpoint (204 to 247). It inspects `DATABASE_URL` ONLY. `reporter.finish` exits 0 whenever failures = 0 regardless of skips (79): a run that skipped everything is exit 0. `sawRows` never fails, only annotates (104 to 111). `ranDirectly` compares exact basename (321), the T6 fix. `constraintContradictions` finds duplicate FKs on one column and SET NULL vs a CHECK text `col IS NOT NULL` (372 to 392). `migrationLedgerAudit` compares files vs journal vs ledger count and requires strictly increasing `when` (489 to 495); a missing ledger table is counted as 0 (502 to 509).
- Notes: callers passing the door today (grep): `migrate.ts:60`, `sync-blocks.ts:142`, `age.ts:101`, `settings.ts:717` (only for `reprice`/`rails` verbs), `simulate-seed.ts:195`, `seed-demo.ts:88`: SIX. The refusal message at 206 says "one of the five"; the header at 189 says "The five"; HAZARDS.md says "four do"; `verify-sprint57.ts:414` comment says "Four files may pass it" while its DOORS list comment names "THE SIXTH DOOR" (440). Counts disagree across four places (see Stale). `PRODUCTION_ENDPOINT` duplicated here and in `_environments.ts` (two copies of one constant).
- `readSource` is the T1 answer; `stripCommentsKeepingLines` only strips whole-line `//` (see `_dashes.ts`).
- Promises: every "refuses production" claim in every writer rests on `writesTo` reading `DATABASE_URL`; a script that connects through another variable (e.g. `DATABASE_URL_PRODUCTION`, or `dbFor(region)` if a region reads its own URL) is not covered. See Suspect.

### scripts/age.ts (266 lines)
- For: moves a simulation wave's past timestamps back by N days so months can pass in an hour. On the production allow-list.
- Decides: `writesTo({ productionIsAllowed: true })` (101). Marker file `.simulation-<marker>.json` on local disk (60): `--start` records `startedAt` and refuses if the file exists (114 to 125); ageing refuses when `agedAt` is set (142 to 154) and when `--days` is outside 1..400 (129). Every `timestamp`/`timestamptz` updatable column in `public` is discovered from `information_schema` (70 to 83); only tables with `created_at` are touched, and only rows with `created_at >= startedAt` (227); per column `CASE WHEN col < now() THEN col - interval ELSE col END` (196), so deadlines in the future stay. Tables without `created_at` are listed, not aged (245 to 249).
- Assumes: `scripts/db.ts` `connect()` uses `DATABASE_URL`, same variable `writesTo` checked (consistent).
- Notes (defects and risks):
  - NO TRANSACTION. Each table is a separate `UPDATE` (225); the marker's `agedAt` is written only after the loop (251 to 255). If any UPDATE throws mid-loop (a trigger refusing UPDATE on an append-only table, e.g. the patient-summary append-only trigger P4 relies on, or a derived-status trigger), earlier tables are already shifted, the marker still has no `agedAt`, and the documented retry ages those tables TWICE, which the file itself calls the refusal "that matters most" (143 to 148). On production, with no restore (HAZARDS "nothing restores it away").
  - It rewrites history on append-only records too: any append-only table with a `created_at` whose trigger does NOT refuse UPDATE gets its authored timestamps moved; P4 "every version stays" is about content, but signed-at times on clinical records are altered in place with no audit row.
  - The marker is per working copy and names no database. `.simulation-wave1.json` (aged 180 days, 15 seconds after start, 2026-09-16) and `.simulation-wave2.json` (30 days) are COMMITTED to git (`git ls-files`), so no checkout anywhere can age wave1/wave2 against any database, and nothing records which database they were aged on.
  - `sql.raw` with interpolated ISO timestamp and validated integer (157, 205, 227): not injectable from data (H7 ok).
  - `updated_at` columns are shifted as well as `created_at`, and rows from an older wave updated during this wave are not aged (by design).
  - T6: `main()` at module scope (266), unguarded; not imported by anything in this slice.

### scripts/audit-csp-enforced.ts (230 lines)
- For: loads public pages in real Chromium against a local `npm run start` with `CSP_ENFORCE` deleted, and fails on any console CSP refusal.
- Claims: enforcing the CSP breaks no public page.
- Reads: a LIVE local server (built app), browser console.
- Control: YES, both halves partly: header-state check that the server is enforcing, not report-only (163 to 170); planted inline script under a `script-src 'none'` meta policy must be heard (208 to 221). The known-good half is the sweep itself. The control page is `setContent`, not a product page, which proves the listener, not the product policy.
- T3: pages derived from `DEFAULT_PAGES` slugs (70) plus `app/(public)` directories (79), but the six sign-in "doors" are hand-typed (85 to 92), and `skip` names `design`, `verify`, `t` by hand (78). Content pages come from `lib/content/defaults.ts`, not published rows (H28): a published slug not in defaults is not visited.
- T4: prints first 8 violations and "and N more" (196, 197). Good.
- Notes: stated blind spot (30 to 36): signed-in screens and the video room are NOT covered; the room relies on `docs/DAILY-HOSTS.md`. `server.kill()` (224) kills the `npm` wrapper; H39 says `next start` forks a `next-server` into its own process group, so this likely leaks a server on 3111 (the H39 shape recurs here and this file does not snapshot pids). If `playwright` is missing it SKIPS and exits 0 (109 to 111). Not in GATES. T1 n/a. T6: `void main()` unguarded (230).
- Promises: none of the 25 directly; P5 (SOS reachable) would be the casualty of an enforced CSP breaking a client handler on a signed-in patient screen, which this cannot see.

### scripts/audit-daily-hosts.ts (187 lines)
- For: downloads Daily's real call-machine bundle for the installed `daily-js` version and classifies every host it names; `--write` updates the ```audited block in `docs/DAILY-HOSTS.md` (T5 answer).
- Reads: network (`c.daily.co`), `node_modules/@daily-co/daily-js`.
- Decides: `DECIDED` (66) allow: `*.daily.co`, `daily.co`, `*.pluot.blue`, `dailywebrtc.com`, `dailywebrtc.net`; noted: `*.pluot.co`, `pluot.tv`, `*.google.com`. `hostsIn` (103) regex plus a TLD whitelist `co|com|net|io|blue|org|dev|app|cloud|tv|me` (105). Unknown wildcard is written `unclassified`, which `verify:csp` fails on.
- Control: none. A new Daily host on a TLD outside that list (`.ai`, `.live`, `.xyz`, `.so`, a ccTLD) is not "unclassified", it is INVISIBLE, and the audit writes a clean block (T2 shape). `PROSE` skip list is by exact host.
- T6: guarded by exact-basename `ranDirectly` (187), fine. Exports `installedVersion`, `sdkDomains` for `verify:csp`.
- Notes: exits 0 with unclassified hosts when run without `--write` (157 to 166): only the gate fails, the audit prints.

### scripts/backfill-diarise.ts (139 lines)
- For: re-runs speaker attribution (`diariseSession`) over sessions with `unknown` transcript segments that predate the H11 fix.
- Decides: finds candidates by `COUNT FILTER speaker='unknown' > 0` grouped by session (50 to 63); `--dry` lists the first 20 (78) with no "and N more" line (T4, the total is printed before so it survives); refuses the real run unless `--retention-is-zero` is typed (88 to 107), a self-attestation nothing checks.
- Notes: WRITES (through the product's own `diariseSession`, which updates segments and logs AI usage, i.e. spends model money) but calls NO `writesTo()` and no `hostOf()` (grep): it prints no host and does not refuse production. It is one of the writers that HAZARDS.md's "Seventy-five scripts call writesTo" does not cover. `userId: c.therapistId` (119) attributes the AI usage row to the therapist. Header says "`diariseSession` used to read only the first 160 segments"; HAZARDS H11 retired. T6: `main()` unguarded (139). Promises: T1 (note written from what was said) is only as good as attribution; this is the repair tool for old transcripts.

### scripts/baseline.ts (241 lines)
- For: records per-table row counts of production before the simulation and checks a restore against them.
- Claims: "the proof that the restore put things back".
- Reads: every table in `pg_tables` public (102 to 121), `count(*)` each. Writes only a local file `evals/production-baseline.json` on `record`.
- Decides: `check` refuses if the host differs from the recorded one (174); diff over the UNION of table names (188); `MOVES_ON_ITS_OWN` (64): `rate_limits`, `error_events`, `auth_sessions`, `patient_auth_sessions`, `auth_tokens` report but do not fail.
- Control: none. COUNTS ONLY: a table whose rows were replaced one for one (same count, different content, the H49 signature) passes as "holds what it held before" (212). H36 admits this for schema; it is equally true for content. Also a table added and then left empty reads as unchanged (was 0 now 0).
- T6: `main()` unguarded (241). Host compare is a string compare of the host part, so the pooler and direct hostnames of the same endpoint read as "DIFFERENT DATABASE" (false refusal, safe direction).
- Notes: `record` writes the baseline for ANY database (no production check) and overwrites the committed file.

### scripts/benchmark-ai.ts (471 lines)
- For: measures real OpenAI token cost of note, risk, copilot and diarisation at 3, 8, 20, 50 minutes, fits fixed + per-minute, composes a session cost; `--json` writes `evals/physics.json`.
- Decides: refuses without `--i-mean-it` (158); cap default $1, checked BEFORE each call against a guessed estimate (173, 184, 209, 249, 305) and summed AFTER, so the cap can be overshot by one call's real cost. `RATE` (136) is a hand-typed copy of prices ("from the shipped table"), with an unknown model silently priced as gpt-4o (142), while H12 says `lib/ai/client.ts` prices from `platform_settings`: two price sources that can drift. `COPILOT_SYSTEM` (58) is sliced out of `lib/ai/copilot.ts` by `indexOf("const SYSTEM_PROMPT = \`")`; if that text moves, `at = -1` and the slice silently becomes the file's first template literal, a wrong prompt with no error (no control, T2). Copilot is reconstructed, not called (17 to 24).
- Notes: writes no DB row (true by reading: only `noteFromTranscript`, `classifyRisk`, `attributeLines`, raw `openai()`); constants `TRANSCRIBE_PER_MIN_USD 0.003`, `COPILOT_TURNS 4`, `PROFILE_SHARE 0.4` hand-typed (405 to 409). The synthetic transcript lines are pre-labelled `Patient:`/`Therapist:`, unlike real diarisation input. T6: `main()` unguarded (471). No promise directly; feeds the finance model.

### scripts/browser/shot.mjs (52 lines)
- For: signs in to a LOCAL server (`127.0.0.1:3412`, no override) as the local admin and screenshots paths.
- Notes: hard-codes a staff sign-in email and a second password literal (39) for the local screenshot admin (value not copied; see Suspect). Hard-codes the Chromium path (26) instead of `_browser.ts`'s resolver, contradicting `_browser.ts`'s "one place" rule. No `networkidle` failure handling; a failed sign-in times out after 30s. Top-level await, runs on import (not imported).

### scripts/build-world.mjs (241 lines)
- For: converts Natural Earth 110m topology to `lib/world-110m.json` (globe) and `lib/countries.json` (code to name, lon, lat). Run by hand, output committed.
- Decides: drops every polygon whose outer ring is under 0.6 square degrees (112) and drops a COUNTRY entirely when no ring survives (115). 110m Natural Earth also omits many small states.
- Notes: consequence (checked by reading the committed JSON): `lib/countries.json` has 169 entries and lacks BH (Bahrain), PS (Palestine), SG, MT, CY, LU, HK, MV, MU. `lib/geo.ts:173` `countryOptions` builds the country picker from `COUNTRIES` (that JSON), and `lib/data/taxonomy.ts:88` serves it as the country taxonomy (the clinician verification form and radar filter per `lib/geo.ts:124`). So a clinician or patient in Bahrain, Palestine or Cyprus cannot pick their own country. For an Egypt-first MENA product, Bahrain and Palestine missing is material (see Suspect; confirm where the taxonomy table overrides it). Writes files at module scope (220, 233), no guard; not imported.

### scripts/capture-coverage.ts (171 lines)
- For: signs in to a running dev server and photographs the covered-employee payment sheet, the transfer queue, three admin profiles and the vault (76.26).
- Reads: live local app (`CAPTURE_BASE`, default localhost:3111, overridable to ANY URL including production), plus three read-only DB lookups by name/email (114 to 132).
- Notes: hard-codes an operator email and a third password literal (80, 81; same literal in `capture-therapist-money.ts:40` and `seed-coverage.ts`; value not copied). Because `CAPTURE_BASE` is free, this could sign in to production's console if that account existed there; `shot.mjs` deliberately forbids that and this does not. Sign-in failure is swallowed (83 `.catch(() => undefined)`), then each page reports "BOUNCED" rather than failing; exit code stays 0 (only a thrown error sets 1). DB lookups run against `DATABASE_URL` with no `hostOf()`, and may be a different database from the server at `CAPTURE_BASE`. Header scenario: 50% cover, $20 session, pot pays $10, employee owes $11.40 by transfer (24, 25), i.e. $10 + 14% VAT. Admin patient profile note says "Money only, by design: no notes, no diagnoses, no clinician" (153), a claim about `/admin/patients/[id]` to check in the admin slice. Uses `PLAYWRIGHT_CHROMIUM` not `_browser.ts` (52). T6: `main()` unguarded.

### scripts/capture-payments.tsx (637 lines)
- For: renders the real payment components (PaymentPopup, PendingBar, SessionStarted, TransferQueue, OpenCarts, PayoutQueue) with the real dictionary and Tailwind, and photographs each state; writes `captures/payments/index.html` meant to be shared with Paymob (21 to 26).
- Claims (header 28 to 33): "Every amount here comes from the product's own helpers, so a frame cannot show a number the product would not."
- Reads: components only, no DB, no server.
- Notes: that claim is FALSE for most figures: `session = { gross 2000, vat 280, settles 2280 }` (128), `bill.total 800` (130), the clinician invoice lines $4 (263), clinic $144 (286), `sessions: Math.floor(credit / 200)` (312, a hard-typed $2/session pot draw), and the whole `queueRows`/`OpenCarts`/`PayoutQueue` data (435 to 559, e.g. "$22.80", "EGP 1,140.00") are hand-typed. Only `potTopUpMoney`, `formatMoney`, `egpMinorFor` are real, and the FX `RATE = 50_000_000` is fixed (121). A price change in the product will not change these frames, and they are the ones shown to a payment gateway (money priority 2: "a price computed differently from where it is shown" in the evidence pack). The IBAN (139) is the published example Egyptian IBAN, not a real account. The rejected frame shows a verbatim operator reason (206 to 224), which is how A3 should look. Installs `next/navigation` stub (83 to 95). `renderMarkup` swallows server-component throws (see `_render.ts`). Chromium via `PLAYWRIGHT_CHROMIUM`, not `_browser.ts`. T6: `main()` unguarded (637). Figures on the bar frame: the note (373) says 76.37 took red off the pending bar because red means crisis only (P5 relevant: crisis colour reserved).

### scripts/capture-therapist-money.ts (181 lines)
- For: makes two throwaway solo practices (region `eg` and `us`), one therapist each, two due invoices each, then signs in and photographs `/billing` and `/settings` for both, and deletes them in `finally`.
- Decides: `writesTo()` default (43), production refused. RAW INSERTs that bypass the product: `organizations` (62), `users` with a password hash and a licence number in `profile` (66), `invoices` with `status 'due'` (78). No verification row, no therapist onboarding path: the therapist exists with a licence number and no verification record.
- Cleanup (166 to 176) deletes `manual_payments`, `invoices`, `sessions`, `users`, `organizations` by tag. It does NOT delete `auth_sessions`/`auth_tokens`/`audit_log`/notifications the sign-in and the pay-now click create; if any of those carry a FK to `users` without cascade, the `DELETE FROM users` throws inside `finally`, leaving the org and user on the branch (Suspect, schema out of slice). `PASSWORD` literal (40) is the same third password (value not copied). Uses `PLAYWRIGHT_CHROMIUM`. T6: `main()` unguarded.
- Promises: T3 context (what a clinician owes, shown per rail).

### scripts/check-live.ts (219 lines)
- For: fetches the LIVE public site (`LIVE_URL`, default `https://24therapy.app`) in en and ar and checks two things: no unconditional "we never hold it" Stripe claim (`REVERSED_CLAIM`, 78), and `/pricing` contains the dictionary's `pricing.platformLine` wording (201). Exports `LIVE_PAGES` and `visibleText` to `smoke-public.ts` and `verify-sprint21r.ts`.
- Claims (header 21 to 23): "the page is the one the database describes, it states no price of its own, and it makes no claim about where money sits". Only the third is implemented; the price check was deleted (81 to 97) and there is no database comparison at all.
- Reads: live URLs over the network.
- Control: NONE. A page that answers non-2xx or throws is DROPPED silently (`fetchLive` returns null, 59, 61; `readLiveSite` skips it, 138). So a `/pricing` that answers 500 is not reported; only the count "N pages read" shrinks (214). If every page fails, it prints "nothing checked" and EXITS 0 (148 to 151). Classic T2: "clean" and "looked at nothing" are the same green. If `pricing.platformLine` were missing, `cardMarker` is "" and `includes("")` is always true (172, 201).
- T3: `LIVE_PAGES` (99 to 131) is HAND-TYPED, 14 paths, and the comment (106 to 121) records it was already five pages stale once. It is imported by `smoke-public.ts:41`, and `smoke` is the "renders" gate in `_gates.ts:85`, so the gate "every public page still answers with a page" walks this typed list. A new public page is not covered until somebody edits this file.
- T6: guarded by `process.argv[1]?.includes("check-live")` (219): a SUBSTRING guard, weaker than the suffix guard TRAPS T6 forbids (any runner path containing "check-live", e.g. a future `verify-check-live.ts`, would run it). `verify:traps` reportedly looks for `endsWith`; an `includes` guard may pass it. Side effect is network reads only.
- Promises: none of the 25 directly; H27/H28 truthfulness of live copy. `REVERSED_CLAIM` only matches two exact phrasings, so a reworded unconditional claim passes.

### scripts/copilot-exam.ts (618 lines)
- For: measures whether the patient copilot knows more about patients with thicker records: builds questions with answers from each patient's rows, asks `askPatientCopilot`, grades with gpt-4o, correlates depth with score.
- Reads: every non-deleted patient with a session, journal or document (110 to 160), their last two approved notes' SOAP `plan`/`subjective` (241 to 267), `patients.clinical` medications and diagnoses (269 to 272), last two journal bodies (220 to 224).
- Writes: RAW `INSERT INTO copilot_threads` per patient, attributed to the patient's MOST RECENT therapist (470 to 480), then `askPatientCopilot` appends messages and (per product code) AI usage to that thread, 9 or more questions per patient. Nothing is deleted. NO `writesTo()` and NO `hostOf()`: it does not refuse production and does not print which database it is on (the roll call, 422, is the only hint).
- PRIVACY (priority 1): (a) it calls `askPatientCopilot` WITHOUT `capabilities` (490 to 509), and `lib/ai/case-copilot.ts:507 to 513` documents that absent capabilities means "no restriction beyond the scoping the caller already did"; this caller did no scoping, so the copilot is given every document, journal and profile regardless of the patient's grant. (b) It picks a therapist by "last session", not by an active grant, so a patient who revoked a clinician (T5) is still examined "as" that clinician. (c) Real journal text, SOAP content, medications and diagnoses are sent a SECOND time to OpenAI inside the grader prompt (340 to 355), outside any product flow. (d) Labels are real `first_name last_name` (124) printed to console and written with the full handover brief and marks to `--json` (608), whose documented target is `docs/simulation-run/COPILOT.json`, a committed directory (per .gitignore comment "They land in docs/simulation-run/, which nothing below ignores"). (e) The inserted threads and messages sit in the named therapist's copilot history as questions that therapist never asked, and any access audit written by the copilot path records that therapist as the reader (A5 "every read is written down" becomes a false record).
- Measurement: because capabilities are omitted, the exam measures an UNRESTRICTED copilot, not the one a clinician gets; its "claim holds" line can be green for a product that a real clinician experiences differently (T2 family: measures an adjacent thing).
- Control: yes, `absent` questions (medication/diagnosis when none, and a fixed invented "brother called Hossam", 283 to 317) grade refusal; good design. No known-good planted patient.
- T6: `main()` unguarded (618). `--questions` caps at `max(4, want)` (319).
- Promises: T5 (only a chosen clinician, only while allowed): this tool bypasses both halves when run; it is not product code, but it is a sanctioned command with no production refusal.

### scripts/db.ts (24 lines)
- For: standalone Neon/Drizzle client for CLI scripts (`connect(url = process.env.DATABASE_URL)`), avoiding `lib/db`'s `server-only`.
- Notes: `connect` accepts ANY url argument. `writesTo` checks only `process.env.DATABASE_URL`, so a script calling `connect(someOtherUrl)` after `writesTo()` would write where the guard never looked (none in this slice does; `settings:compare` style readers pass the three env URLs). `max: 1` pool. No guard of its own.

### scripts/demo.ts (338 lines)
- For: `demo:seed` creates 12 "demonstration clinicians" on the public radar across AE, EG, GB, FR, BR, US, PK, JP, NG, bookable; `demo:purge` deletes them.
- Decides: `writesTo()` at module scope (324), production refused (added sprint 57 after an investor found fabricated licences could reach the live radar, 313 to 322). Raw Drizzle INSERTs bypassing onboarding: `organizations` (146), `users` with `verificationStatus: "verified"` written directly (171), `subscriptions` payg (181), `therapist_verifications` `state: "approved"` with a random `DEMO-xxxxxx` licence (185), `therapist_radar` with `demo: true` (197).
- Notes:
  - Fourth password literal: fallback `DEMO_PASSWORD` default (29), different from the documented demo password and printed to stdout (236). Value not copied.
  - Fixture people have real-looking names ("Layla Mansour", "Habiba Farouk", "Tom Alvarez") and fabricated credentials that name real regulators and a real-format licence ("LMFT #12849", "HCPC registered", "DoH Abu Dhabi", "Egyptian Psychologists Syndicate") (55 to 133). This breaks C225 (synthetic surnames Demo/Example) and `verify:synthetic`'s premise; on any shared deployment it is impersonation of licensed status.
  - Header (12 to 15) says `therapist_radar.demo = true` "exempts them from the heartbeat expiry". MAP.md Suspect 2 says `demo` became "a label and never a decision" on 2026-09-22. Stale comment either way.
  - `users.verificationStatus` written directly while MAP.md says it is derived by trigger 0083; either the trigger overwrites it or this bypasses the derivation.
  - PURGE IS OVER-BROAD: it deletes every organisation that has ANY user whose email ends `@example.com` (266). The demo cast (`_demo-cast.ts`) puts `staff.demo@example.com` (a console `users` row) and three clinicians at example.com; if `staff.demo` sits in the platform organisation, `demo:purge` deletes the platform org's users (including the founder admin) and the org itself. Refused on production, destructive on dev. The delete list (282 to 303) omits many FK tables (manual_payments, ledger, grants, journals, clinic seats...), runs without a transaction, so a FK refusal midway leaves a half-purged tenant.
  - T6: side effects at module scope (324 to 338), unguarded.
- Promises: C1 (on the radar the same hour) is demonstrated with fixtures that skip verification entirely.

### scripts/forecast.ts (128 lines)
- For: prints the four finance scenarios from `lib/finance` (pure), with the measured/assumed split and caveats.
- Notes: `SLUGS` (28) is a hand-typed list mapped to `SCENARIOS` BY INDEX (31, 57, 124); reordering `lib/finance/scenarios.ts` silently relabels every scenario. Caveat "Stripe runs in test mode and charges nothing" (111) is a claim about configuration not checked here. No DB, no network. Top-level side effects unguarded (118 to 128). Nothing here predicts a clinician's earnings (the honesty rule), it forecasts the company.

### scripts/gates.ts (157 lines)
- For: `npm run gates`: runs every entry of `GATES` via `npm run --silent <script>`, not fail-fast, reports all.
- Decides: prints the DB host, warns on the production endpoint but CONTINUES (77 to 84). On failure prints lines filtered by `/FAIL|Error|error|✗|rose|UP from/` (136), first 11 plus the last FILTERED line plus "and N more, run npm run X" (139 to 145).
- T4: partly fixed. The header (116 to 131) says it keeps "the LAST one ... where it puts its total", but it keeps the last line that MATCHES the filter, not the last line of output. A total written as "N of 79 failed" (lower-case "failed") does not match `FAIL` (case-sensitive) and is dropped. A gate that fails with a message containing none of those words (e.g. `writesTo`'s "Refusing to run: that is the production endpoint", `required()`'s "Refusing to run: this database has no ...", or "DATABASE_URL is not set.") prints FAIL with NO explanation line at all.
- T2: a gate script that is missing from package.json makes `npm run` exit non-zero and shows as FAIL (good, loud).
- T6: `main()` unguarded (157); imported by nobody.
- Notes: header (21 to 34) says "these four"; there are 35 (see `_gates.ts`). Running gates with `DATABASE_URL` on production runs every read-only DB gate against production and every writing gate refuses (the warn text says this).

### scripts/grant-admin.ts (124 lines)
- For: create or promote one `super_admin` by `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, attached to the OLDEST organisation.
- Decides: password checked by the product's `validatePassword` (51); uses `hostOf()` only (57), deliberately NO `writesTo()`, so it writes to production with no allow-list and no `I_MEAN_PRODUCTION` (header 28 to 32 says so). If the email exists (any role, not deleted) it is overwritten to `super_admin`, `status: "active"`, and its password replaced (93 to 98); a therapist's account can be turned into a founder account in one command, and the "was X, is now super_admin" line is the only trace (no `audit_log` row written).
- Raw insert: `users` with `verificationStatus: "unverified"` (100 to 114) while the comment says the column is derived by trigger 0083 (so it writes a derived column).
- Notes: this is a production WRITE door that `verify:sprint57`'s count cannot see, because that count searches for `productionIsAllowed: true` (H41's lesson, "a count is only a count if it reads every file that could contribute", still has a hole: it counts the flag, not the writes). Same for `backfill-diarise.ts` and `copilot-exam.ts`. A5 relevance: a role granted outside the product, unaudited. T6: `main()` unguarded.

### scripts/inventory.ts (513 lines)
- For: derived inventory of every page and control, wired or dead; `routes()`/`routesByPortal()` are THE derived route list TRAPS.md T3 tells every checker to use.
- Claims: every page in the product.
- Reads: source under seven hand-listed `PORTALS` roots (50 to 58): `(admin)`, `(app)`, `(patient)`, `(sponsor)`, `(clinic)`, `(partner)`, `(public)`.
- T3: DERIVED FROM A HAND-TYPED ROOT LIST, and the list is incomplete. Pages that exist and are NOT in `routes()` (checked with `find app -name page.tsx`): `app/join/[token]` (T4's own page), `app/pay/[token]` (the transfer sheet, A1), `app/(room)/sessions/[id]/room` (the live room, P1 and T2), all of `app/(auth)` (`/login`, `/signup`, `/staff/sign-in`, `/forgot-password`, `/reset-password`), `app/feedback/[token]`, `app/support/[token]`, `app/j/[code]`. Every consumer that obeys T3 (`verify-machines.ts:36`, `verify-contrast.ts:51`) is therefore blind to the payment page, the join page and the room. A state machine naming `/pay/...` or the room as its exit screen would be refused as non-existent, or, worse, the claim is simply not checkable.
- Also: route strings keep nested group names and dynamic segments literally (e.g. `/(something)/x/[id]`), the prefix group is removed only for the root; consumers must cope.
- Control: YES, both halves (331 to 354): a dead `<button>` must be caught and a dispatch-wired form must pass; exit code 1 if the control fails (361). Good. But the control does not cover the alias/props heuristics, which are very permissive: `props` (202) collects ANY identifier that appears after `{` or `,` and before `,`, `}` or `:` anywhere in the file, so almost every bare action name is "reachable".
- T1: own `code()` stripper (127) also strips trailing `//` (handles `https://` via `[^:]`), better than `_dashes`. `labelNear` and title read raw.
- T4: prints first 20 dead controls (504) with no "and N more" line (the total precedes it, so it survives); `--write` keeps up to 14 items per kind per page (488) silently.
- T6: guarded by exact `ranDirectly("inventory.ts")` (513). Good.
- Notes: the generated doc heading is "The admin side, as it is" (433) though it now covers seven portals.

### scripts/lifecycles.ts (163 lines)
- For: renders `lib/lifecycle/machines.ts` into `docs/LIFECYCLES.md`: each machine's states and transitions, then "Every way a person is stopped" and "Every promise we have made".
- Decides: a `blocked`/`dead-end` state with no `exit` prints "**NOTHING, and that is a defect**" (99); a promise is "clock-countable" if it matches a loose regex of numbers or words like `window|allowance|starts|expir|life of` (124), which the file itself calls a heuristic, not a gate.
- Notes: header says "the eleven machines" (9): count not derived. The stopped-register is the most useful artefact for priority 4 (stuck with no way out); the evidence lives in `machines.ts` (out of slice). The measurable regex passes any promise that merely contains a digit or "window". T6: `main()` unguarded (163). No DB.

### scripts/logins.ts (268 lines)
- For: writes `docs/simulation/12-THE-LOGINS.md` from `_cast.ts` and `docs/DEMO-LOGINS.md` from `_demo-cast.ts`.
- Notes: it writes the simulation password into the committed document (78) and the demo password (213). The demo document's "What each one opens onto" table (233 to 244) and the "What this replaced" section (246 to 263) are HAND-TYPED prose inside a generator whose header says "Three readers, one array, and no chance of the document being right about ten of eleven" (196 to 198); those claims (e.g. "Company: three sessions it paid 60 per cent of", "Therapist, solo: three patients, nine completed sessions", "Patients: sessions, an approved summary, homework and a journal each") are not derived and not checked here. The 60 per cent is also scenario-dependent (money is 10%). "ten of eleven" is stale (12 logins). It records that `seed:demo` wiped production on 2026-09-20 and turned `omarabdelgawad001@gmail.com`, formerly a super_admin, into a solo therapist (254 to 256). It states the seed "counts fourteen tables ... and throws naming any table that lost a row" (261 to 263): a count-only census (see seed-demo). T6: `main()` unguarded.

### scripts/mail-preview.ts (178 lines)
- For: renders every automated email via the real `lib/mail-previews.ts` list, capturing the Resend request by patching `fetch`; `--send <addr>` really sends all of them to one typed address.
- Notes: sets a placeholder `RESEND_API_KEY` when unset (111) so the SDK builds requests. Captures only the FIRST Resend call per template (147); a template that sends two messages shows one. `message.send(to)` is out-of-slice code: if any preview path goes through `notify()` and writes an in-app notification or audit row, this script writes to the database with no `writesTo()`/`hostOf()` (Suspect). The header claim "no code path here that could reach a real patient's inbox" (36, 37) holds only if every `send(to)` honours `to`. Run with `_render-preload.mjs` (package.json 153). Exit 0 even when some templates rendered nothing ("??" lines, 149).

### scripts/measure-cuts.ts (89 lines)
- For: heuristic measure of transcript cuts mid-sentence (no terminal punctuation; next line starts lower-case or with an Arabic continuation word).
- Notes: reads EVERY session's transcript segments on whatever `DATABASE_URL` is (44 to 60), no `hostOf()`: on production that is a full read of clinical transcripts to a terminal (it prints counts only, no text). One query per session. T6 unguarded. No promise.

### scripts/migrate.ts (124 lines)
- For: the migration runner (`db:migrate`), on the production allow-list.
- Decides: `writesTo({ productionIsAllowed: true })` (60); advisory lock `24107` (64); refuses when a `.sql` file has no journal entry (88) or a journal `when` is not increasing (99); then drizzle `migrate`.
- Notes: does NOT refuse `inJournalNotInFiles` (a journal entry whose file is gone); drizzle would then throw, acceptable. After `migrate` it prints "Migrations applied." (114) WITHOUT re-reading the ledger to confirm the count rose to `journalCount`; H1's "prints success whether or not it did anything" is narrowed (two causes removed) but not closed (e.g. a ledger timestamp ahead of every entry). The comment at 79, 80 says this "runs on every deploy"; HAZARDS H16 says nothing applies migrations on deploy (Vercel runs `next build` only). Stale. T6 unguarded.

### scripts/on-production.ts (304 lines)
- For: THE sanctioned way to run a command against production: copies `DATABASE_URL_PRODUCTION` into `DATABASE_URL` for ONE child `npm run <command>`, only for commands on `ALLOWED`, and sets `I_MEAN_PRODUCTION` only for entries marked `writes`.
- Decides: refuses no command (242), a `REFUSED` command (249), a command not on `ALLOWED` (255), a missing `DATABASE_URL_PRODUCTION` (263), or one whose host does not contain `ep-wild-lake-a6tgm2r6` (270 to 277). Child env: `DATABASE_URL = production`; `I_MEAN_PRODUCTION` set for writers, DELETED for readers (288 to 290). Forwards every remaining argument verbatim (240, 292). Bare `--` args are dropped.
- THE ALLOW-LIST, exactly (64 to 178):
  - WRITES (10): `simulate:seed` (operator, four applications, copilot quota, once); `age` (moves the clock, rows since the marker); `settings:seed` (missing defaults, idempotent, "no people"); `settings:reprice` ("the prices this product charges"); `settings:rails` (blanks on existing country rows); `ship:content` ("rewrites content_pages from the shipped defaults", the H49 reseed that destroyed 6,810 bytes of live copy, still on the list); `content:sync` (named block types on one page, proves nothing else moved); `copilot:exam` ("examines the copilot on the run's own patients", see privacy notes above); `seed:demo` ("wipes the cast and seeds the demo one. Snapshot first. It DELETES PEOPLE"); `db:migrate` (H16, before main is pushed).
  - READS (10): `baseline`, `spend`, `physics`, `verify:physics`, `settings:show`, `settings:check`, `verify:migrations`, `verify:board`, `verify:cast`, `verify:demo`.
  - REFUSED by name (184 to 225): `verify:synthetic`, `demo:seed`, `db:seed`, `gates`, `verifiers`, `verify:actuals`, `verify:payout`, `verify:limits`, `db:reset`.
- Why each reaches production: given in each `why` string above; the justification for `seed:demo` (101 to 130) is that the redesign is of the deployed product and a dev cast cannot be signed into from a phone.
- Notes:
  - A "reads" entry is protected ONLY if its child calls `writesTo()` before writing. The mechanism removes `I_MEAN_PRODUCTION` but cannot stop a child that writes without calling `writesTo`. `baseline` writes a local file only (fine). `physics`, `spend`, `verify:board`, `verify:cast`, `verify:migrations` are trusted by name.
  - `copilot:exam` is a writer that does NOT call `writesTo()` at all, so the `writes: true` flag is decorative for it; it would write to production even if called directly with `DATABASE_URL` pointed there.
  - `grant:admin` is NOT on the list, yet `grant-admin.ts` is documented as the way to make a production operator and uses `hostOf` precisely so it can. The only way to run it on production is to point `DATABASE_URL` at production by hand, the manoeuvre this file exists to make unnecessary (lines 11 to 38). Same for `backfill-diarise`, `check:live` (network only, harmless), `measure-cuts`.
  - The `seed:demo` comment contradicts itself: 114 to 116 says the snapshot "holds the six month simulation as it stood on 2026-09-20"; 124 to 128 (and `logins.ts`) say production held only the starting position, no run. Stale half.
  - "Snapshot first" (133) is a `why` string; nothing in this file checks a snapshot exists. See seed-demo for whether the seed checks.
  - The endpoint constant is a third copy (`_verify.ts:148`, `_environments.ts:47`).
  - Child arguments are unvalidated: `on:production -- baseline -- record <x>` overwrites the committed baseline file from production (intended).
  - T6: `main()` unguarded; nothing imports it (verify:runbook reads it as text per `_gates.ts`).

### scripts/seed-demo.ts (1427 lines)
- For: `seed:demo [--scenario=live|money|continuity|crisis|growth]`: WIPES every person-shaped table and seeds the 12-login demo cast with history, then the position for the chosen scenario. On the production allow-list (writes, "DELETES PEOPLE").
- Guard: `writesTo({ productionIsAllowed: true })` (88); `scenarioFrom` runs before the first DELETE, so an unknown scenario refuses before wiping (90 to 98).
- THE KEEP LIST, exactly (68 to 83), 14 tables: `content_pages`, `platform_settings`, `country_settings`, `locales`, `ui_strings`, `taxonomy_entries`, `instruments`, `finance_benchmarks`, `finance_scenarios`, `employees`, `employee_salaries`, `capital_contributions`, `other_costs`, `fx_quotes`. (Crisis lines live in `country_settings` columns `crisis_line_label/tel/verified_at/verified_by`, `lib/db/schema.ts:3520 to 3527`, so they are kept; this answers MAP.md Stale 7.)
- THE WIPE: targets = every table reachable by foreign key from `organizations`, `users`, `people`, `sponsors`, `partners` (117 to 124), minus KEEP. `clinical_summaries_no_rewrite` trigger DISABLED for the wipe and re-enabled in a `finally` (201 to 222). Up to 12 passes of `DELETE FROM <table>` swallowing every error (205 to 217); throws "could not empty" if any remain (224).
- THE CENSUS: COUNTS ONLY, and only in one direction. `census()` is `count(*)` per KEEP table (141 to 148); the check fails only when `after < before` (242, 243). Content is never compared: a kept table whose rows were rewritten, or that GAINED rows, passes. And the script itself REWRITES kept tables before the census can see it: every FK column from a KEEP table to `users`, `people` or `organizations` is set to NULL for EVERY row (152 to 167). The header (48 to 52) calls these "a single audit column ... who last edited the row", but the query selects every FK column regardless of meaning, so it also nulls, for instance, `country_settings.crisis_line_verified_by` (the "name and a date" that says who confirmed each crisis number, schema 3522 to 3527), any `employees`-to-user link, and the authorship of every content page and price. Same row count, different content: exactly MAP.md Suspect 7 and the H49 signature. Confirmed.
- NO TRANSACTION: the wipe, the trigger toggle, and the entire seed run as separate statements. Any throw after the wipe (openPot error, "the grant did not land", openCart error) leaves production wiped and half-seeded; the `finally` (1422) only closes the pool. No snapshot is checked or taken by the script (header of on-production says "Snapshot first"; nothing enforces it). Header (196 to 199) says "the last thing this script does is check that [the trigger] is enabled again"; no such check exists.
- What else the wipe takes, because it is reachable from people/orgs and not on KEEP: `audit_log` (A5 "every read is written down": the record of reads is deleted wholesale on production each reseed), the ledger and `manual_payments` (the company's actual money record), every clinical table.
- RAW INSERTS THAT BYPASS THE PRODUCT (every one): `organizations` x3 (265, 269, 281); `subscriptions` (319); `users` admin, staff, 4 therapists (326 to 399); `therapist_verifications` with `reviewed_by = admin` and fixed licence numbers `EPA-...` from "Egyptian Psychological Association" (422 to 437); `therapist_radar` with `demo = true`, status online (481); `availability_slots` 14 days of afternoons (502); `clinic_managers` (516); `clinic_seats` (520); `sponsors`, `sponsor_users` (528, 533); `UPDATE sponsor_pots SET coverage_bps` (582, bypasses whatever the product's coverage change writes); `people`, `patient_accounts` plus `UPDATE people SET claimed_at` (626 to 649); `patients` (659); `enrolments` with `identifier_hash 'demo-...'` (707, 725); `history_grants` granted (751) and requested (1335); `clinical_summaries` (763, 780); `sessions` with `payment_status 'paid'` or `'pending'`, `recording_consent 'granted'` (921, 1034, 1227); `transcript_segments` (935); `session_notes` approved and released to the patient with `provenance 'transcript'`, `model 'seed'` (960); `UPDATE patients SET last_session_at` (971); `homework_items`, `observations` (1053, 1063); `journals` (1077); `copilot_threads`, `copilot_messages` (1138 to 1150); `payout_methods`, `payout_requests` (1188, 1192); `support_tickets` (1199); `patient_notifications` (1246, deliberately not `notify()`).
- THROUGH THE PRODUCT: `openPot`, `openCart`, `submitProof`, `confirmPayment` with `grantFor`, `payFromPot` (six covered sessions), `chargeForSession` (every completed session with no `session_payments`), `rejectPayment` (crisis), `egpRateMicro`, `potTopUpMoney`, `entityVatBps`. Balance asserted after the top-up (600 to 608), good.
- MONEY: the header (31 to 37) says "every cent is posted". FALSE for patient payments: 14 sessions are written `payment_status 'paid'` (977 to 1031) with no `manual_payments`, no `session_payments` and no ledger leg for the patient's money; `toBill` (1098 to 1103) then raises the clinician's fee invoices on exactly those sessions. A `payout_requests` row of 25,500 cents / 1,275,000 EGP minor (1192 to 1197) is inserted raw, bypassing the four refusals `verify:payout` guards (over the balance, a second in flight, approving one's own, no receipt); whether $255 is within Dr Omar's held earnings is never checked, and those earnings rest on "paid" sessions with no money behind them.
- BROKEN (seed data): copilot answers are inserted with `role 'assistant'` (1148). The product's roles are `therapist | copilot | session_note | correction` (`lib/data/copilot.ts:139`, read with `inArray(... ["therapist","copilot","correction"])` at 496; `lib/ai/case-copilot.ts:562` filters `copilot`). The column is plain text (schema 1326), so Postgres accepts it and the seeded answers are invisible: each demo thread shows a question with no answer. Same shape as the `'available'` radar status the comment at 447 to 463 describes.
- PUBLIC RADAR ON PRODUCTION: Dr Omar and Dr Sara are put on the public radar `online`, `demo = true`, `accepts_walk_ins = true`, with 14 days of bookable slots and fabricated licence numbers from a named real body (422 to 511). The comment (458 to 461) says `reachable()` exempts demo rows from the heartbeat, so they stay online indefinitely. `on-production.ts:188 to 190` REFUSES `demo:seed` for exactly this ("fabricated clinicians carrying DEMO- licence numbers on the public radar, where a stranger can book one"). A real stranger on `24therapy.app` can find and book a seeded clinician. Contradicts MAP.md Suspect 2 ("demo is a label and never a decision") unless `reachable()` changed (out of slice).
- Scenario notes: `growth` "funded with 100 dollars" (VALUE-STATEMENTS, TUNING comment, 1387) ignores the $100 welcome credit (543, 602) and the $50 overdraft (542): the pot starts at $200 against $270 of covered share. Runs out anyway, but the stated figure is wrong. `money` seeds an orphan claim with payer kind `session` (1314), which MAP.md Suspect 4 says `paymentsFor` never returns to anybody. `crisis` seeds a rejected claim with `refId: null` (1361).
- Personal data: seeds the founders' real addresses and names (`Omar Abdelgawad`, `Habiba Heikal`, 272, 285, 328, 362, 517) and phone-shaped numbers `+2010000000xx`.
- Stale: header "TEN LOGINS" (2); there are twelve.
- T6: `main()` unguarded (1427); T6 fixed at the source by `_demo-cast.ts`/`_value-statements.ts` holding the shared data.
- Promises: P4 (two summaries, two authors, both kept: seeded by raw insert, 763), T5 (grant states seeded raw), E1 (six covered sessions to cross the floor of five, 995 to 1020), A3 (rejection with a verbatim reason, 1369 to 1374), P2 (in-app notice row, 1288).

### scripts/physics.ts (425 lines)
- For: fits the two-term (fixed + per-minute) AI cost model per kind and model from `ai_request_logs`, evaluates at `--at` (50) minutes, and compares against `evals/physics.json` (the benchmark); exits 1 on disagreement or a missing benchmark. On the production allow-list as a READ.
- Claims: the fifty-minute cost the forecast rests on.
- Reads: `ai_request_logs` (x axis = transcribe `audio_seconds`, 87 to 105), `getSettings()` rates (129 to 135), the benchmark file.
- Control: yes in part: an empty fit is "NOTHING TO COMPARE" and exits 1 (236 to 261, the H42 fix); a partial fit is labelled a floor (288 to 294); a planted-offender control lives in `verify:physics` (per `_gates.ts`), not here.
- Notes: `rateFor` returns 0 for a model with no configured rate (132 to 134), so an unpriced model contributes $0 and the fit UNDERSTATES, the opposite of H12's rule that an unpriced model deliberately overstates. Sessions with AI calls but no `transcribe` row are dropped by the inner join (102). `getSettings()` is product code: if it inserts missing defaults on read, this "read" writes (not checked; Suspect). `main()` is called at 376 before `const BENCHMARK_PATH` at 378; works only because the first use follows an `await` (fragile TDZ). T6 unguarded.

### scripts/pitch-deck.cjs (1221 lines)
- For: builds a 14-slide investor deck with pptxgenjs from screenshots produced by `scripts/demo-video.mts`.
- Claims (header 14 to 20): "Every number on these slides is either read out of the code that charges it ... or derived". FALSE: every figure is a hand-typed literal ($6 PAYG, $99 Unlimited, 10% take rate, 15/3/2 cents cost bars, 20 cents, 89% margin, ARR 14,400 to 2,880,000, "$80 radar sessions") (797 to 799, 883, 928, 931, 951, 1006 to 1009). The model it describes is superseded: current pricing per this slice is payg ($1 room + $3 note), Practice $80, Clinic $144 (`probe.ts:744 to 746`, `seed-demo.ts:305`). "Charged on the patient's card at booking, clinician paid out by Stripe Connect" (799) contradicts the Egyptian manual-transfer rail. "≈89% gross margin on a $6 session" (931) is the claim family `lib/content/honesty.ts` refuses ("paid sessions cover our fee").
- Trust claims that other code in this slice contradicts: "Nobody deletes a patient or a session. Not the clinician, not support. Clinical records are append-only" (743) and "Every action is on the audit trail" (750) versus `seed-demo.ts` (deletes every session, disables the append-only trigger, deletes `audit_log`) and `demo.ts purge`. "Ratings never name their author ... no query anywhere joins a rating back to a patient" (744, 677) unverified here. "Facial-affect analysis in the copilot" as a 90-day plan (1137): unclaimed capability, see Unclaimed. Contact email on the close slide (1189) is the account holder's.
- Runs on require (no guard); writes `demo-output/24therapy-pitch.pptx`. `pptxgenjs` deliberately not a dependency (10 to 13).

### scripts/plan.ts (193 lines)
- For: prints `lib/finance/beta` plan scenarios (pure).
- Notes: the "What this cannot know" list (168 to 174) interpolates the monthly price (fixed after a stale "1,000 EGP", 157 to 164) but still HAND-TYPES the assumptions it quotes ("40% of solo therapists", "5% ... 40% active", "3%" card cost, "two in three" renew), the same failure the comment describes for the price. "Two measured numbers in here" (190) is typed. No DB. T6 unguarded.

### scripts/probe.ts (1449 lines)
- For: the "mini simulation": drives a real browser against a local server (`PROBE_URL`, default 127.0.0.1:3412) through nine flows and reads back the row each step produced.
- Guard: `writesTo()` (47), production refused; sweeps `Probe` people before and after (58, 81, 1428 to 1447).
- Flows and what they actually assert:
  - F1 therapist sign-up, onboarding, documents, submit (97 to 433): real form, real upload. "the form says what it is still waiting for" records `ok` even when the missing list is EMPTY (393 to 401; the text says "(nothing listed, which would be the defect)" but the state is not `defect`).
  - F8 support (451 to 533): header says it checks that a `staff` account clears its queue AND is refused the founder-only half (446 to 449). It signs in as `admin@24therapy.test` (461, presumably the super admin from `screens-prep`) and never tests a refusal. The audit check (517 to 520) counts ANY `verification%` audit row in the last two minutes, not the row for this approval. A5 is NOT tested despite the claim.
  - F2 patient (550 to 671): records as a `defect` that a patient can never add an email and `/patient/account` calls it "the only way to receive your record" while offering no control (657 to 667). Product finding (priority 4, a thing a person cannot do and is told they need).
  - F5 transfer (688 to 973): documents that `organizations.region` DEFAULTS TO `us`, so a self-signed-up Egyptian clinician is offered Stripe checkout and "You will be taken to the card page" until an operator changes the region (703 to 810); the probe then flips the region with a raw `UPDATE` (820, 821). Asserts `manual_payments` is not `confirmed` after declaring (961 to 969): A1 evidence.
  - F4 money out (986 to 1046): "...and the ledger agrees with the screen" is recorded `ok` UNCONDITIONALLY (1036 to 1042); it never compares the ledger figure to the screen. T2.
  - F6 practice apply, F7 employer apply (1059 to 1191): a held `organizations`/`sponsors` row; "applying does not grant a console".
  - F3 session (1212 to 1289): does not run a session; POSTs to `/api/sessions/<zero uuid>/transcribe` and treats any non-404 as ok (1252 to 1267), so a 500 is "ok".
  - F9 founder (1301 to 1343): opens six admin pages as the admin; no staff refusal either.
- Password literals: the local admin password (462, 1308, same as `shot.mjs`) and `_probe.ts` `PASSWORD` (values not copied).
- Sweep deletes `audit_log` rows of probe users (1441) and any sponsor or organisation whose NAME contains "Probe" (1445, 1446): a real clinic called "Probe..." on dev would be deleted.
- T6: `main()` unguarded (1449).

### scripts/probe/_probe.ts (151 lines)
- For: probe harness: `BASE`, `SURNAME = "Probe"`, `PASSWORD` (a fifth password literal, 48), `emailFor`, `record`/`report`, `openBrowser` via `_browser.ts`, `asPerson` (fresh context per person; page errors recorded as defects), `go`, `gist`, `shot` to `.probe-shots` (gitignored).
- Notes: module-level `findings` array (67), so it is stateful on import but runs nothing. `report()` never sets an exit code; `probe.ts` exits via `reporter().finish` whose `check` is only called once ("there is a product to walk"), so a probe run with every flow BLOCKED or DEFECT exits 0 as `PASS (1 checks)`. T2/T4 shape: the green line and the findings disagree.

### scripts/prove.ts (19 lines)
- For: writes `docs/VALUE-STATEMENTS.md` from `_prove-doc.ts`. Side effect at module scope, by design, with the builder moved out (T6 fix). Nothing imports it.

### scripts/q.ts (7 lines)
- For: runs ANY SQL passed as `argv[2]` against `DATABASE_URL` and prints rows.
- Notes: no `writesTo()`, no `hostOf()`, no read-only transaction: an unguarded write console that does not even print which database it hit. With `.env.local` on dev it is dev; the day `.env.local` points at production (HAZARDS records that afternoon) it is a production write door outside every count. Not in package.json.

### scripts/prose-sweep.ts (630 lines)
- For: `npm run prose` (the first gate in GATES): words a person must read, per portal, from the English dictionary, the CMS DEFAULTS and English literals in markup; ratchet in `evals/prose.json` fails when a portal rises.
- Reads: `DICTIONARIES.en`, `DEFAULT_PAGES` from `lib/content/defaults.ts` (425) NOT published rows (H28: the public-site number measures the file, not what visitors read), `scanI18n()`/`literalsIn` (447 to 460).
- Decides: explicit prefix map `PORTALS` (52 to 325), then a letter rule `p` patient, `t` clinician, `a` admin, else `other` (344 to 353); legal pages counted separately and ratcheted (424); `other` has no baseline and only prints its prefixes (546 to 551).
- Notes: `--write` (579 to 620) sets the baseline to the CURRENT numbers even when a portal ROSE, and returns before the `rose` check (622), exit 0: the ratchet can be raised silently by the documented write command. A portal missing from `byPortal` (all its keys renamed away) is never compared. Control: none (no planted wall). T4: "The twenty largest" (574) without an "and N more" line; the block count is printed before. T6: `main()` unguarded.

### scripts/render-check.ts (412 lines)
- For: gate "rendered" (`render:check`): renders the `en-x-staging`/`ar-x-staging` CMS rows through the real `BlockRenderer` inside `I18nProvider` and asserts on the HTML.
- Reads: STAGING rows only (`like '%-x-staging'`, 73), written by `republish.ts --staging`. So it proves the staged copy renders, not the published rows a visitor gets (another H28 gap); settings via `getSettings()`.
- Checks: at least 8 staged pages (77); no page throws (141, but `_render.ts resolve` swallows server-component throws); pricing page carries PAYG AI rate, every monthly plan's price and name, platform fee, no "N sessions", "Sign up free", EGP toggle; home carries the PAYG rate; for-patients has "If you need help right now" and `href="/radar"` (234 to 237, the P5-adjacent crisis panel); contact has a form, both companies and the urgent warning above the form; Arabic page has Arabic; Arabic pages carry none of `WAS_ENGLISH`.
- Controls: yes: every rendered page over 500 bytes (273 to 281, vacuous if `html` is empty but the 8-row check covers that); the `WAS_ENGLISH` list must be found on the English pricing page (355 to 364). Good design.
- T2: English passages remaining on Arabic pages are a SKIP "deferred to 22R.10" (384 to 395) whatever their number, and the skip message asserts they are "all inside the demo panels" without checking where they are. `reporter.finish` exits 0 on skips, so the gate is green with any amount of English on Arabic pages. T4: prints the first 12 remaining passages (382) with the total only inside the skip line. Price matching by `$N` substring can be satisfied by an unrelated figure (the file itself warns of this at 152 to 160). T6: `main()` unguarded.

### scripts/republish.ts (226 lines)
- For: overwrite `content_pages` rows from `defaults.ts` for named slugs or `--all`; `--ar`/`--locale=`; `--create`; `--staging` writes `<locale>-x-staging` rows for `render:check`.
- Decides: `writesTo()` unless `--staging` (58), so staging writes reach production with no host printed (intended, C289b). English with no row is skipped unless `--create` (150 to 166); Arabic, create and staging insert (126). Existing rows are REPLACED wholesale (168 to 181): the H49 reseed shape, per slug. Afterwards it POSTs `Authorization: Bearer $CRON_SECRET` to `${APP_URL ?? "https://24therapy.app"}/api/revalidate` (201 to 223): run against dev with `CRON_SECRET` set and `APP_URL` unset, it revalidates PRODUCTION's cache while having written dev (harmless but misleading), and it sends the cron secret to whatever `APP_URL` names. T6: `void main()` unguarded.

### scripts/reset.ts (160 lines)
- For: empty every table (`TRUNCATE ... RESTART IDENTITY CASCADE`, 126) and re-seed via `settings.ts seed` and `seed.ts --refresh-content [--demo]` as children.
- Guard: dry run unless `--i-mean-it`; then the operator must TYPE the host (115 to 123). NO `writesTo()`: nothing refuses production by name. `on-production.ts` refuses `db:reset`, but that only matters for the wrapper; `npm run db:reset` with `.env.local` on production (the HAZARDS afternoon) truncates production after one typed hostname. `KEEP` is empty (59 to 63): settings, content, `country_settings` crisis lines (seeded EMPTY by ruling, schema 3509 to 3513), payroll, the audit log: all gone, and the re-seed cannot restore crisis numbers or audit history. If the child `settings.ts seed` refuses production (via `writesTo`), production is left TRUNCATED and unseeded (child refusal happens after the truncate; out of slice, Suspect).
- Notes: header "Every row in this product today is test data" (7 to 10) is a dated claim (production now holds the demo cast with the founders' addresses; HAZARDS H36 rule "date every state claim" not followed). T6: guarded by exact `ranDirectly("reset.ts")` (78), and `tableNames` is exported for a checker.

### scripts/screens-prep.ts (174 lines)
- For: prepares a local DB for screenshots: resets `admin@24therapy.test`'s password to a literal (22, 23; value not copied; the same literal `shot.mjs` and `probe.ts` use), plants capital contributions and costs, and two `submitted` transfers (one with a real stored receipt via `uploadDocument`).
- Guard: `writesTo()` (56).
- Notes: DELETEs every `capital_contributions` row with source `founders` or `angel round` (86) and replaces them with $25,000 and $50,000 fixtures; on a branch that carries real founders' capital (a production fork), that is real history replaced. Raw `INSERT INTO manual_payments` in state `submitted` (148 to 155) bypasses `openCart`/`submitProof`. T6 unguarded.

### scripts/screens.ts (197 lines)
- For: screenshots public, therapist, patient (and `--admin`) screens into `docs/screens/` from `SCREENS_URL` (default localhost:3000) with stored sessions in `.screens/*.json`.
- Guard: `refuseUnlessDemoOnly` (100 to 131) counts patients and notes in organisations whose name does not contain "demo".
- Notes: the check reads `DATABASE_URL` but the pictures are taken of `SCREENS_URL`; nothing ties the two, so an empty dev DB passes the check and the shots can be of production (the file's header, 17 to 23, says "the check is on the data, not on the URL", yet it checks a different database from the one photographed). The demo cast's orgs ("Cairo Counselling", "Nile Practice") contain no "demo", so on the demo database this refuses (safe direction). Shot lists hand-typed (51 to 90, T3). A failed shot prints ✗ and exit stays 0 (167 to 169). `docs/screens/admin` said to be gitignored (not checked here).

### scripts/seed-capture.ts (869 lines)
- For: the film/walkthrough cast (C225) on the CAPTURE branch only: sponsor, clinic, partner, three patients with accounts, a session with transcript and signed note, two-version summary, homework, journal, PHQ-9 with timings, a check-in.
- Guard: its own two-sided check: refuses production by endpoint and refuses anything that is not `ep-little-sky-a6v9sdx4` (150 to 166). Strongest guard in the slice. Does not use `writesTo`.
- Raw inserts bypassing the product: everything except `seedInstruments`/`publishInstrument`, including a `ledger_entries` pot funding leg (304 to 308, the "INSERT with no journal" pattern `seed-demo.ts` forbids), `therapist_verifications` approved for EVERY active therapist on the branch lacking one (430 to 437), `history_grants` granted (511), `person_claims` (505), enrolment (526).
- Notes: bulk `UPDATE instruments SET translation_reviewed_by = admin` for every instrument not yet reviewed (771 to 774): fabricates the named reviewer that 56.11's publication guard requires, then publishes. A seed defeating a safety rule it names. `DELETE FROM ledger_entries WHERE ref_type = 'sponsor'` (200) removes every sponsor ledger leg on the branch, not only its own. The in-person session is recorded with `recording_consent = true` (a boolean here, `'granted'` in seed-demo: two value shapes for one column). More password literals (49, 59; values not copied). `CAST` is exported (57) from a file whose `main()` runs at module scope (869): importing it runs the seed (T6); only the endpoint guard makes that harmless.

### scripts/seed-coverage.ts (275 lines)
- For: a branch fixture: company covers 50%, employee books a $20 session, pot pays at booking, employee's remainder opened as a claim (`SUBMIT_PROOF=1` submits it).
- Guard: `writesTo()` (37). Leaves its cast behind by design.
- Through the product: `openPot`, `openCart`, `submitProof`, `confirmPayment` + `grantFor`, `payFromPot`, `sessionTransferMoney`. Raw: users (therapist and a `super_admin` operator), sponsors, sponsor_users, people, patient_accounts, patients, enrolment, session, `UPDATE sponsor_pots SET coverage_bps = 5000`.
- Notes: header says "Every step runs through the product's own functions ... rather than writing the end state into tables" (16 to 18), true only of the money. What the employee owes is computed IN THE SCRIPT as `price - (pot balance before - after)` (218, 219), not by the product's `patientOwesFor` (which `_tmp-owed.ts` shows is what the sheet uses): the fixture prices the claim itself, the exact "price computed differently from where it is shown" hazard, and `seed-demo.ts:1266 to 1277` says the pay sheet re-states an open claim from its own arithmetic. Cleanup deletes all ledger legs whose `ref_id` is any sponsor named "Cairo Foundry" (61). Password literal printed (97, 265). T6 unguarded.

### scripts/seed.ts (441 lines)
- For: `db:seed`: org, payg subscription, optional super admin from env, CMS pages for every shipped locale; `--demo` adds a test therapist (approved), a patient and one completed session with transcript and approved note; `--refresh-content` overwrites published pages from defaults.
- Guard: `writesTo()` UNLESS `--refresh-content` (134 to 139), which only prints the host. The comment (115 to 131) says `--refresh-content` "rewrites content_pages from the shipped defaults and touches nothing else". FALSE as written: with `--refresh-content` the org insert (150 to 157), subscription insert (161), the super-admin UPSERT that RESETS the password and role of `SEED_ADMIN_EMAIL` when those env vars are set (167 to 196), and the whole `--demo` branch (264 to 428) all still run, with no production refusal. So `db:seed -- --refresh-content --demo` against production creates a documented-password therapist with an approved verification, a patient with a diagnosis, and a session; and any `ship:content` run from a shell holding `SEED_ADMIN_*` silently re-passwords that admin on production.
- `--refresh-content` replaces every page in every locale from defaults (240 to 256): the H49 reseed, still the mechanism `ship:content` uses (on the production allow-list).
- Demo data: the seeded session is `modality: "in_person"` with 12 transcript segments and an approved note, and NO `recording_consent` set (378 to 420): an in-person session with a transcript and no consent on record, the task 123 shape, planted by the seed. The note sets no `patient_status`/`provenance` (defaults), so per `seed-demo.ts:946 to 958` the patient app says "still writing" and "not recorded" over a transcript. Password fallback literal (47, printed at 431).
- Header "Idempotent, safe to re-run on every deploy" (1, 2): `--refresh-content` is not safe on any deploy that has authored copy (H49). T6: `main()` unguarded (441).

(Note on order: `seed-demo.ts` is entered after `on-production.ts` and `prose-sweep.ts` after `q.ts`, because they were read in that order; every file on the slice list has exactly one entry above.)

## Stale

1. `scripts/_cast.ts:25 to 31`: "Three people are seeded". `SEEDED` is seven (OP, OP2, SU1 to SU5).
2. `scripts/_cast.ts:64 to 81` says patient email cannot exist; `CAST` still gives P1 to P7 an `email`, so `WITH_LOGINS` counts seven addresses the file calls impossible.
3. `scripts/_content-ready.ts:42`: `AWAITS = "22.8b"`; every content skip today names a sprint step long past as its cause.
4. `scripts/_dashes.ts:21, 22`: `lib/i18n/config.ts` named as an allowed exception; `ALLOWED` (40 to 44) does not list it.
5. `scripts/_demo-cast.ts:33`: "THE FOUR REAL INBOXES"; `OWNED_INBOXES` has five. `:23, :29` "eleven logins"; `DEMO_LOGINS` has twelve. `scripts/seed-demo.ts:2` "TEN LOGINS"; twelve. `scripts/logins.ts:198` "right about ten of eleven"; twelve.
6. `scripts/_prove-doc.ts:162 to 167` (and therefore `docs/VALUE-STATEMENTS.md:270`): "Three of these are at example.com ... Dr Sara, Dr Kareem and Mariam". Seven of the twelve logins are at example.com. A generated document with a hand-typed false count.
7. `scripts/_gates.ts:386 to 430, 511 to 533`: comment blocks sit above the wrong entries (the `served` and `orb` comments above `caseload`; the `runbook` comment above `palette`). `:491 to 510` "eighty-one ... ran twelve ... seventy-nine" versus 35 gates. `scripts/gates.ts:21 to 34` "these four"; 35.
8. `scripts/_surfaces.ts:308 to 334` (C369): `upsertSubject`, `queueWebhook`, `potBalance`, `unpause` "Zero callers". All now have callers (see Looks broken, is handled). `:146` promises `../thing` imports are followed; code follows only same-directory `./leaf`.
9. `scripts/_stub-empty.ts:1 to 3` and `scripts/_stub-link.tsx:1, 2`: "used only by render-check.ts" / "only by verify-sprint17.ts"; both are loaded for ~20 scripts via `_render-preload.mjs` (package.json).
10. `scripts/_verify.ts:189, 206`: "The five that need the door" / "not one of the five". Six files pass `productionIsAllowed: true` (migrate, sync-blocks, age, settings, simulate-seed, seed-demo). `HAZARDS.md:231, 232` "which four do"; `scripts/verify-sprint57.ts:414` "Four files may pass it" beside its own "THE SIXTH DOOR" (440).
11. `scripts/demo.ts:12 to 15`: `therapist_radar.demo` exempts from heartbeat; MAP.md Suspect 2 says demo became "a label and never a decision" on 2026-09-22, while `scripts/seed-demo.ts:458 to 461` still relies on `reachable()` exempting demo rows. One of the three is stale.
12. `scripts/migrate.ts:79, 80`: the audit "runs on every deploy"; HAZARDS H16 says nothing runs migrations on deploy.
13. `scripts/on-production.ts:114 to 116`: snapshot "holds the six month simulation as it stood"; same block 124 to 128 and `logins.ts:18 to 24` say production held only the starting position.
14. `scripts/seed-demo.ts:196 to 199`: "the last thing this script does is check that [the trigger] is enabled again"; no such check.
15. `scripts/seed-demo.ts:31 to 37`: "every cent is posted"; 14 sessions are written `paid` with no payment behind them (see Suspect).
16. `scripts/seed.ts:115 to 131`: `--refresh-content` "touches nothing else"; the org, subscription, super-admin upsert and `--demo` branch still run. `:1, 2` "safe to re-run on every deploy".
17. `scripts/pitch-deck.cjs:14 to 20`: numbers "read out of the code that charges it"; every figure is a literal, and the pricing model ($6/$99/10% Stripe Connect) is superseded (payg $1 + $3, Practice $80, Clinic $144, manual transfers).
18. `scripts/capture-payments.tsx:28 to 33`: "Every amount here comes from the product's own helpers"; most are typed.
19. `scripts/seed-coverage.ts:16 to 18`: "Every step runs through the product's own functions"; only the money does, and the owed figure is the script's own arithmetic.
20. `scripts/reset.ts:7 to 10`: "Every row in this product today is test data"; undated state claim, now false for production.
21. `scripts/check-live.ts:21 to 23`: "the page is the one the database describes, it states no price of its own"; neither is checked any more.
22. `scripts/probe.ts:446 to 449`: F8 checks a staff account "CANNOT reach the founder-only half"; it signs in as the admin and never tests a refusal.
23. `scripts/lifecycles.ts:9` "the eleven machines", `scripts/_prove-doc.ts:67` "five per audience", `_value-statements.ts:62` "TWENTY-FIVE": typed counts (the last two are correct today).
24. `scripts/inventory.ts:433`: generated doc titled "The admin side, as it is" while covering seven portals.
25. MAP.md Stale 7 (where crisis lines live) is ANSWERED by this slice: `country_settings.crisis_line_label/tel/verified_at/verified_by` (`lib/db/schema.ts:3520 to 3527`), a KEEP table in `seed-demo.ts:71`.

## Suspect

1. `scripts/seed-demo.ts:977 to 1031, 1098 to 1114, 1192 to 1197`: sessions marked `payment_status 'paid'` with no `manual_payments`, no `session_payments` and no patient ledger leg, then billed to the clinician via `chargeForSession`, and a raw $255 payout request. Matters for A2/A4/T3 walks on the `money` position: held earnings and payouts may rest on money that never arrived. Answer: `lib/billing/service.ts chargeForSession`, the earnings query, and `verify-demo.ts`.
2. `scripts/seed-demo.ts:152 to 167`: nulls EVERY FK column from KEEP tables to users/people/organizations, not only audit columns. Would matter if any KEEP table holds an ownership FK (e.g. an `employees` login link) or `country_settings.crisis_line_verified_by` (certain, schema 3524). Answer: `lib/db/schema.ts` for each KEEP table's FKs.
3. `scripts/on-production.ts:131` + `seed-demo.ts:88`: the wipe is non-transactional; any throw after the DELETE passes leaves production wiped and half seeded. And nothing checks a snapshot exists.
4. `scripts/seed-demo.ts:481 to 511`: seeded demo clinicians on the PRODUCTION public radar, online indefinitely if `reachable()` still exempts `demo` rows, with bookable slots and fabricated licence numbers. Answer: `lib/data/radar*` `reachable()`, and the public radar query. If true, a real stranger can book a fake clinician on the live site: the exact reason `on-production.ts:188` refuses `demo:seed`.
5. `scripts/copilot-exam.ts:490 to 509` omits `capabilities`; `lib/ai/case-copilot.ts:507 to 513` says absent means no restriction. The same default applies to "the one other caller (the in-session suggestions)". If any PRODUCT caller omits it, a clinician's copilot reads documents, journals and profile beyond their grant (T5). Answer: every caller of `askPatientCopilot`.
6. `scripts/probe.ts:703 to 810`: `organizations.region` defaults to `us`; a self-signed-up Egyptian clinician is offered Stripe checkout ("You will be taken to the card page") until an operator changes the region. Priority 2 and 4. Answer: signup action and `organizationNeedsTransfer`.
7. `scripts/probe.ts:657 to 667`: a patient can never add an email, yet `/patient/account` calls it "the only way to receive your record". If true, a phone-only patient cannot receive their record export (P4-adjacent). Answer: `app/(patient)/patient/account`, data export path.
8. `scripts/reset.ts:126, 145`: truncates first, then reseeds via children; if `settings.ts seed` calls `writesTo()` it refuses production after the truncate, leaving production empty. Answer: `scripts/settings.ts` seed verb.
9. `scripts/_verify.ts:193` `writesTo` inspects only `DATABASE_URL`. Any writer that connects via `dbFor(region)` with a per-region URL, or `connect(otherUrl)`, is unguarded. Answer: `lib/db/index.ts` region URL resolution.
10. `scripts/mail-preview.ts:127 to 130`: if `previewMessages().send(to)` writes notification or audit rows, this writes to whatever DB is configured with no guard. Answer: `lib/mail-previews.ts`.
11. `scripts/physics.ts:129` and `render-check.ts:82`: `getSettings()` may insert missing defaults on read, making "read" allow-list entries writers. Answer: `lib/settings`.
12. `scripts/capture-therapist-money.ts:166 to 176`: cleanup omits auth_sessions/audit/notifications; a FK from those to users would make the user delete throw inside `finally`, leaving fixtures on the branch.
13. `scripts/build-world.mjs:112, 115` + `lib/geo.ts:173` + `lib/data/taxonomy.ts:88`: Bahrain, Palestine, Singapore, Malta, Cyprus, Luxembourg, Hong Kong, Maldives, Mauritius absent from the country picker (checked in `lib/countries.json`). Answer: whether the taxonomy table in the DB overrides the fallback (`taxonomy_entries`).
14. Password literals other than the documented demo password (values deliberately not copied): `scripts/_cast.ts:55` (simulation cast, also written into `docs/simulation/12-THE-LOGINS.md` by `logins.ts:78`), `scripts/browser/shot.mjs:39` / `probe.ts:462, 1308` / `screens-prep.ts:23` (local screenshot admin), `scripts/capture-coverage.ts:81` / `capture-therapist-money.ts:40` / `seed-coverage.ts:97`, `scripts/demo.ts:29` (fallback), `scripts/probe/_probe.ts:48`, `scripts/seed-capture.ts:49, 59`, `scripts/seed.ts:47` (fallback). All appear to be synthetic fixture passwords for branch/local accounts; but `seed.ts:47` and `demo.ts:29` are fallbacks that would become real passwords on any database those scripts reach, and the simulation password is published in a committed doc. No API keys or tokens seen.
15. `scripts/age.ts:193 to 238`: UPDATEs on tables with triggers (append-only clinical summaries, derived verification status) could throw mid-run; with no transaction, a retry double-ages. Answer: trigger definitions in `drizzle/`.

## Broken

1. `scripts/seed-demo.ts:1143 to 1150`: seeded copilot answers use `role 'assistant'`; the product reads `therapist | copilot | correction` (`lib/data/copilot.ts:139, 496`; `lib/ai/case-copilot.ts:562`), and the column is plain text (`lib/db/schema.ts:1326`). A tester on the demo cast sees each copilot thread as a question with no answer. Grepped for a mapping of 'assistant' to 'copilot' in `lib/data/copilot.ts`: none.
2. `scripts/seed-capture.ts:589, 593`: `recording_consent` written as boolean `true` into a text column typed `"granted" | "declined"` (`lib/db/schema.ts:802`). The seeded in-person session has a transcript and a note while its consent reads as neither granted nor declined; the AI line keyed on `= 'granted'` (schema 2068) is not charged. Capture branch only.
3. `scripts/seed.ts:134 to 139, 167 to 196, 264 to 428`: `--refresh-content` skips `writesTo()` but does not skip the super-admin upsert or the `--demo` branch. `db:seed -- --refresh-content` from a shell with `SEED_ADMIN_*` set re-passwords that admin on whatever DB it points at, production included; with `--demo` it creates a documented-password therapist and patient there. The `on:production` allow-list does not list `db:seed` (REFUSED) but `ship:content` runs this mode per the comment at 120 to 123.
4. `scripts/seed.ts:378 to 420`: demo session is `in_person` with a transcript and approved note and no `recording_consent`: fixture data that is exactly the task 123 defect (recorded without consent).
5. `scripts/_surfaces.ts:204 to 215`: `unwiredActions` tests callers against raw `s.body`, comments included (T1). An action named only in a comment reads as wired: the false PASS the file's own `code` comment (97 to 112) says is the dangerous half. `uncalledRoutes`, `unlinkedPages` and `uncalledExports` were fixed to use `s.code`; this one was not.
6. `scripts/inventory.ts:50 to 58`: `routes()` (the derived list TRAPS T3 mandates) omits `app/join`, `app/pay`, `app/(room)`, `app/(auth)`, `app/feedback`, `app/support`, `app/j` (checked with `find`). Every T3-compliant consumer (`verify-machines.ts:36`, `verify-contrast.ts:51`) cannot see the pay sheet, the join page or the room.
7. `scripts/check-live.ts:59, 61, 138, 148 to 151`: a page that answers an error is silently dropped; zero pages read exits 0. `LIVE_PAGES` (hand-typed) feeds `smoke-public.ts:41`, the "renders" gate. T2 and T3 at once.
8. `scripts/_reachability.ts:38`: skips `public` at every depth (H31, the exact bug `_surfaces.ts:48 to 62` fixed for itself); also reads raw source (T1) and counts any `components/` file as a surface (contradicts C356).
9. `scripts/prose-sweep.ts:579 to 620`: `--write` records a risen baseline and exits 0 before the rise check; the ratchet can be raised by the documented write.
10. `scripts/probe/_probe.ts:77 to 93` + `probe.ts:60 to 85`: `report()` sets no exit code and `finish` has one check, so a probe with every flow blocked exits PASS. Plus `probe.ts:1036 to 1042` records "the ledger agrees with the screen" as ok without comparing.
11. `scripts/render-check.ts:384 to 395`: any number of English passages on Arabic pages is a skip, and skips exit 0.
12. `scripts/gates.ts:134 to 145`: keeps the last FILTERED line, not the last line; a failing gate whose message lacks FAIL/Error words shows no reason, and a lower-case "failed" total is dropped (T4 partly unfixed despite its comment).
13. `scripts/age.ts:173 to 255`: no transaction; partial failure then retry double-ages rows on production.

## Looks broken, is handled

1. `scripts/_surfaces.ts:313 to 324` lists four safety functions with zero callers, including `potBalance` (E1's anti-differencing floor). Handled: `app/(sponsor)/sponsor/page.tsx:7, 63` and `app/(sponsor)/sponsor/pot/page.tsx:15, 83` call `potBalance`; `upsertSubject` at `lib/partner/platform.ts:142, 143`; `queueWebhook` at `app/(patient)/patient/consent/actions.ts:167, 168` and `lib/partner/webhooks.ts:183, 210`; `unpause` at `app/(admin)/admin/benefits/actions.ts:7, 43`; `diariseSession` at `lib/ai/notes.ts:386, 387`.
2. `scripts/_demo-cast.ts:5 to 19` / `_value-statements.ts:359 to 373`: the T6 disaster (verify-demo importing seed-demo and wiping the DB). Handled: shared data lives in no-main files; `seed-demo.ts` imports only from them.
3. `scripts/_i18n-coverage.ts:274`, `inventory.ts:513`, `reset.ts:78`, `audit-daily-hosts.ts:187`: guards on argv. Handled by `ranDirectly` exact basename (`_verify.ts:319 to 322`), not a suffix. Exception: `check-live.ts:219` uses `includes` (Broken 7 area, low risk).
4. `scripts/seed-demo.ts:201 to 222`: disables the append-only clinical-summary trigger on production. Re-enabled in a `finally` (219 to 221), though never verified afterwards (Stale 14).
5. `scripts/on-production.ts:288 to 290`: a read command could inherit write permission. Handled: `I_MEAN_PRODUCTION` is deleted for read entries, and `writesTo` requires both the flag and the caller's own opt-in (`_verify.ts:204 to 247`).
6. `scripts/republish.ts:58` skips the guard for `--staging`: staging locales are unreachable by readers (`_content-ready.ts:54 to 61`, `republish.ts:133 to 142` nulls nav fields).
7. `scripts/age.ts:157, 196` `sql.raw` with interpolated values: `days` is validated to an integer 1..400 (129) and the timestamp is an ISO string from a local file.
8. `scripts/_verify.ts:115 to 131` `sawRows` never fails on empty data: deliberate and printed in the summary line.
9. `scripts/screens.ts:100 to 131` refuses the demo cast DB (orgs lack "demo" in their names): fails safe.

## Unclaimed

(a) worth selling, nothing advertises it:
- `scripts/copilot-exam.ts` design: absent-fact controls graded as hard as recall ("brother called Hossam"), i.e. a measured "the copilot says it does not know" property. No promise says the copilot refuses to invent.
- `scripts/render-check.ts:234 to 237`: the crisis panel on `/for-patients` points at the radar (a free human now), a crisis route no promise names beyond P5's button.
- Anonymous ratings ("no query anywhere joins a rating back to a patient", `pitch-deck.cjs:658, 744`): not among the 25.
(b) nobody should have it, a hole:
- `scripts/grant-admin.ts:93 to 98`: promotes ANY existing user to super_admin and replaces the password, on production, with no audit row and outside the allow-list.
- `scripts/q.ts`: arbitrary SQL, any database, no host printed.
- `scripts/copilot-exam.ts`: an allow-listed production command that impersonates each patient's last clinician, reads the full record without grant scoping, and ships clinical text to a second model call and to a committable JSON file.
- `scripts/seed-demo.ts`: allow-listed command that deletes `audit_log` on production every reseed (A5's "every read is written down" is erasable by a sanctioned command).
- `scripts/demo.ts:266`: `demo:purge` deletes every organisation with any `@example.com` user, which includes the platform org once `staff.demo@example.com` exists in it.
(c) half built:
- `scripts/pitch-deck.cjs:1137`: "Facial-affect analysis in the copilot, on the video we already have consent to record" as a 90-day plan: a capability no consent text covers (recording consent is not affect-analysis consent).
- `scripts/probe.ts:657 to 667`: patient email: named as needed ("only way to receive your record") with no screen to add it.
- `scripts/_reachability.ts:151 to 154`: `partner_consents` (patient cannot see what a partner recorded about their consent) and `partner_clinicians` (no list for the partner): named gaps.
- `scripts/lifecycles.ts:124 to 133`: promises with no clock (#166 alerting not built).

## Promise evidence

- P1: `seed-demo.ts:1226 to 1290` seeds the `live` position (a session ten minutes out, invitation notice). Cannot tell from here.
- P2: `seed-demo.ts:1246 to 1249, 1288` writes the in-app notice row directly, deliberately not through `notify()`, so the seed does not prove the send path. Cannot tell.
- P3: `seed-demo.ts:960 to 968` seeds notes already signed and released; `seed.ts:410 to 420` seeds an approved note with default `patient_status` (patient sees "still writing"). Walk-only; partly: the seeds skip the signing flow.
- P4: `seed-demo.ts:763 to 772` two summaries, two authors via raw insert; the wipe disables the append-only trigger (201 to 222) and deletes every summary. Kept in product per the trigger; the sanctioned seed can erase every version on production.
- P5: `render-check.ts:234 to 237` checks the crisis panel exists on staged `/for-patients` only. `reset.ts` truncation would erase crisis numbers with no reseed. Cannot tell from here for the button.
- T1: `backfill-diarise.ts`, `benchmark-ai.ts` show attribution feeding notes. Cannot tell.
- T2: nothing in slice enforces it. Cannot tell.
- T3: `seed-demo.ts:300 to 313` puts Dr Omar on payg to make netting walkable; payout request inserted raw (1192). Partly: the seed's held earnings rest on sessions with no money behind them (Suspect 1).
- T4: `inventory.routes()` does not include `/join/[token]` (Broken 6), so no derived checker covers it. Cannot tell.
- T5: `copilot-exam.ts` bypasses grant scoping (not product); `case-copilot.ts:507 to 513` default "no restriction" when `capabilities` is absent. Partly / suspect.
- C1: `demo.ts` and `seed-demo.ts` put clinicians on the radar by raw insert, skipping the clinic seat flow. Cannot tell.
- C2, C3, C4, C5: not enforced in slice. Cannot tell.
- E1: `seed-demo.ts:995 to 1020` six covered sessions to cross the publication floor of five; `_surfaces.ts` C369 note that `potBalance` was uncalled is now fixed (Looks handled 1). Kept as far as this slice can see.
- E2: nothing in slice. Cannot tell.
- E3: `seed-demo.ts:575 to 583` sets coverage before `payFromPot` so each session's split is frozen (the CV7 mechanism). Cannot tell beyond that.
- E4: nothing. E5: `growth` position pot is $200 plus $50 overdraft, not "$100" as stated (`_value-statements.ts:380 to 385`, VALUE-STATEMENTS.md:247): still runs out; the stated figure is wrong.
- A1: `probe.ts:961 to 969` asserts a declared transfer is not confirmed; `seed-demo.ts:572, 573` confirms through `confirmPayment`. Kept as far as seen. But `seed-demo.ts` marks sessions paid with no confirmation (Suspect 1) and `screens-prep.ts:148` inserts submitted payments raw.
- A2: nothing in slice. A3: `seed-demo.ts:1369 to 1374` rejects with a verbatim reason; `money` orphan claim uses payer kind `session` (MAP Suspect 4). Cannot tell whether read verbatim.
- A4: `seed-demo.ts:1292 to 1320` seeds an unmatched claim. Cannot tell.
- A5: `_demo-cast.ts:83 to 88` and `seed-demo.ts:340 to 343` add a non-founder staff login so a refusal can be walked; `probe.ts` F8/F9 claim to test the refusal and do not; `seed-demo.ts` deletes `audit_log`; `grant-admin.ts` grants a role unaudited. Partly: the refusal is walkable, the record of it is erasable.

## Coverage

| File | Lines | Status |
|---|---|---|
| scripts/_browser.ts | 107 | read |
| scripts/_cast.ts | 473 | read |
| scripts/_content-ready.ts | 180 | read |
| scripts/_dashes.ts | 95 | read |
| scripts/_demo-cast.ts | 152 | read |
| scripts/_environments.ts | 84 | read |
| scripts/_gates.ts | 627 | read |
| scripts/_i18n-coverage.ts | 287 | read |
| scripts/_i18n-lines.ts | 17 | read |
| scripts/_i18n-list.ts | 19 | read |
| scripts/_prove-doc.ts | 178 | read |
| scripts/_reachability.ts | 155 | read |
| scripts/_region-pins.ts | 86 | read |
| scripts/_render-preload.mjs | 46 | read |
| scripts/_render.ts | 118 | read |
| scripts/_scan-deferrals.ts | 85 | read |
| scripts/_stub-empty.ts | 13 | read |
| scripts/_stub-link.tsx | 22 | read |
| scripts/_stub-navigation.tsx | 56 | read |
| scripts/_surfaces.ts | 424 | read |
| scripts/_tmp-owed.ts | 37 | read |
| scripts/_value-statements.ts | 435 | read |
| scripts/_verify.ts | 521 | read |
| scripts/age.ts | 266 | read |
| scripts/audit-csp-enforced.ts | 230 | read |
| scripts/audit-daily-hosts.ts | 187 | read |
| scripts/backfill-diarise.ts | 139 | read |
| scripts/baseline.ts | 241 | read |
| scripts/benchmark-ai.ts | 471 | read |
| scripts/browser/shot.mjs | 52 | read |
| scripts/build-world.mjs | 241 | read |
| scripts/capture-coverage.ts | 171 | read |
| scripts/capture-payments.tsx | 637 | read |
| scripts/capture-therapist-money.ts | 181 | read |
| scripts/check-live.ts | 219 | read |
| scripts/copilot-exam.ts | 618 | read |
| scripts/db.ts | 24 | read |
| scripts/demo.ts | 338 | read |
| scripts/forecast.ts | 128 | read |
| scripts/gates.ts | 157 | read |
| scripts/grant-admin.ts | 124 | read |
| scripts/inventory.ts | 513 | read |
| scripts/lifecycles.ts | 163 | read |
| scripts/logins.ts | 268 | read |
| scripts/mail-preview.ts | 178 | read |
| scripts/measure-cuts.ts | 89 | read |
| scripts/migrate.ts | 124 | read |
| scripts/on-production.ts | 304 | read |
| scripts/physics.ts | 425 | read |
| scripts/pitch-deck.cjs | 1221 | read |
| scripts/plan.ts | 193 | read |
| scripts/probe.ts | 1449 | read |
| scripts/probe/_probe.ts | 151 | read |
| scripts/prose-sweep.ts | 630 | read |
| scripts/prove.ts | 19 | read |
| scripts/q.ts | 7 | read |
| scripts/render-check.ts | 412 | read |
| scripts/republish.ts | 226 | read |
| scripts/reset.ts | 160 | read |
| scripts/screens-prep.ts | 174 | read |
| scripts/screens.ts | 197 | read |
| scripts/seed-capture.ts | 869 | read |
| scripts/seed-coverage.ts | 275 | read |
| scripts/seed-demo.ts | 1427 | read |
| scripts/seed.ts | 441 | read |

65 files, 18,556 lines. One deviation from the hard rules to report: to confirm a finding I ran `node -e` once to read `lib/countries.json` (a read of a committed JSON file, no network, no DB).
