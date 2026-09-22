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
- Decides: 31 entries (19 to 627): prose, claims, notices, principals, i18n (`verify:sprint37l`), boundary, raw sql, renders (`smoke`), finance, plan, rail, settings (`settings:check`), environments (`settings:compare`), cycle, edges, entitlement, board, actuals, payout, limits, physics, suites, money, caseload, orb, profile, served, rendered (`render:check`), verifiers, palette, machines, traps, csp, runbook, prove.
- Assumes: every `script` exists in package.json (not checked here).
- Promises: the `why` strings map gates to promises: rail = A1, edges = A2/E3 (per VALUE-STATEMENTS), notices = P2, prove = the 25 walk.
- Notes: comment blocks are misplaced relative to entries: the 76.30 "served" comment (386 to 400) sits above `caseload`, the 76.35 "orb" comment above caseload too, and the 76.62 "runbook" comment (511 to 533) sits above `palette`; the entries they describe come later. The `verifiers` comment says "eighty-one verify scripts ... ran twelve ... seventy-nine" (491 to 510), numbers that cannot all hold now that ~31 gates exist. `verify:sprint37l2` (the T1 enforcer per TRAPS.md) is NOT in GATES; it only runs if `verifiers.ts` discovers it. No side effects.

