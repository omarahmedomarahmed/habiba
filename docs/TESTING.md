# Testing

There is no linter; the static analysis is the typecheck plus the checks below. Every check is
an npm script, so one command runs one check.

## The two passes

| Pass | Command | Needs | Runs |
| --- | --- | --- | --- |
| Static | `npm run ci` | Nothing but the repository (and Chromium for the alarm suite) | `typecheck`, every `test:*` suite except the database ones, `prose`, and the static verifiers listed in `scripts/ci.ts` |
| Full | `npm run gates` | `.env.local` with `DATABASE_URL` on the dev branch | Every gate in `scripts/_gates.ts`, which includes `suites` (every unit suite), `verifiers` (every `verify:*` that is not a gate) and the build-and-serve checks |

GitHub Actions runs `npm run ci` on every pull request and on `main`
(`.github/workflows/ci.yml`). `npm run gates` is run locally before a merge that deploys; it
takes a long time, so between edits run only the narrow check for what you touched.

`npm test` alone runs the safety and due diligence suites (`tests/safety.test.ts`,
`tests/due-diligence.test.ts`, `tests/due-diligence-consent.test.ts`).

## Running one check

```
npm run -s verify:runbook           # a verifier
npm run -s test:ledger              # a unit suite (this one needs the dev database)
npm run -s prose                    # the prose ratchet
npm run on:production -- verify:migrations   # read-only checks allowed on production
```

## Verifier families

| Family | Examples | Reads |
| --- | --- | --- |
| Structure and boundaries | `verify:principals`, `verify:boundary`, `verify:reachable`, `verify:raw-sql`, `verify:machines`, `verify:sprint24` (no model output reaches a patient) | Source |
| Copy and language | `prose`, `verify:claims`, `verify:notices`, `verify:sprint37l` (i18n ratchet), `verify:message-language`, `verify:palette`, `verify:contrast` | Source, dictionaries, rendered pages |
| Security | `verify:csp`, `verify:blobs`, `verify:staff-2fa`, `verify:limits` | Source, database |
| Money | `verify:money`, `verify:cycle`, `verify:edges`, `verify:month`, `verify:payout`, `verify:wallet`, `verify:rail`, `verify:gateway`, `verify:entitlement`, `verify:finance`, `verify:plan` | Database fixtures they plant and remove |
| Documents | `verify:runbook` (`docs/simulation/`, README, `docs/*.md` paths), `verify:traps` (this page's trap list), `verify:prove` (`docs/DEMO.md`), `verify:claims` (the hazards table in `docs/OPERATIONS.md`), `verify:csp` (the video host audit in `docs/SECURITY-AND-PRIVACY.md`) | Markdown |
| A seeded database | `verify:cast`, `verify:demo`, `verify:event-demo`, `verify:synthetic`, `verify:board` | The database it is pointed at; skipped by `verifiers` |
| The running site | `smoke`, `verify:served`, `render:check`, `check:live`, `verify:email-dns` | A build, the live site, or live DNS |
| History-named | `verify:sprintNN`, `verify:w1b`, `verify:w2*`, `verify:r1-portal` | The rules a past sprint or fix wave wrote, still enforced |

Ratchets only move one way: `evals/prose.json` (words per portal), `scripts/_i18n-coverage.json`
(English left in markup), `evals/cases.json` and `evals/unmeasured.json` (AI evals). Raising a
number is a decision made in a diff, with the reason written beside the number in that file and
in the pull request.

## Known flaky or conditional checks

| Check | Why it can go red without a product defect |
| --- | --- |
| Anything that signs in | The sign-in limiter is at its production setting locally (H50). Run once; wait 15 minutes after "Too many attempts" |
| Repo-walking verifiers | An agent worktree under `.claude/worktrees/` is scanned as source (H51) |
| `verify:email-dns` | Asks live DNS; fails from 2026-10-06 while DMARC is still `p=none` (deliberate deadline) |
| `verify:served`, `smoke`, `render:check` | Need a build and free port 3199; a killed run leaves a server behind |
| `verify:contrast` | Under load the harness, not the product, is slow; it asks the server log which it was |
| `verify:cast`, `verify:demo`, `verify:event-demo` | True only on a database seeded with that cast |
| `settings:compare` | Reports an absent environment while `DATABASE_URL_SIMULATION` is unset |

## Adding a check

| To add | Do |
| --- | --- |
| A unit suite | `tests/<name>.test.ts` and a `test:<name>` script. `suites` fails on a test file no script runs. If it needs a database, add it to `NEEDS_DATABASE_SUITES` in `scripts/ci.ts` |
| A verifier | `scripts/verify-<name>.ts` using `reporter()` and `readSource()` from `scripts/_verify.ts`, and a `verify:<name>` script. `verifiers` picks it up automatically. If it needs no database, add it to `STATIC_VERIFIERS` in `scripts/ci.ts` so CI runs it |
| A gate | An entry in `GATES` in `scripts/_gates.ts` with a one-line reason |
| A script that writes | Call `writesTo()` so it refuses production; only `scripts/on-production.ts` lets a command through |

## Traps in the checks

Each trap below was walked into more than once. `npm run verify:traps` fails if a trap here
has no check in `scripts/verify-traps.ts`. The question to ask of any new check: if the
thing it checks were completely broken, would this line go red?

### T1 · A checker reads source with its comments in

This codebase documents a defect by naming it, so a scanner hunting for a pattern matches the
comment that explains the fix. Strip comments before any scan of source: use `readSource` from
`scripts/_verify.ts`, which keeps line numbers. Enforced by `verify:sprint37l2` (C205);
`verify:traps` asserts that check is still wired and covers scanners that walk a directory.

### T2 · A checker with nothing proving it can fail

Absences pass just as happily against a scanner that matched nothing. Every check gets a
control: a planted offender it must catch and, where it could fire on everything, a known-good
case it must leave alone. The count of verifiers without a control may only fall.

### T3 · A list of the product's own routes, typed by hand

A hand-typed route list is wrong the week after it is written. Derive routes from
`inventory.routes()` (`scripts/inventory.ts`).

### T4 · A report that truncates and drops the line saying it truncated

A checker prints its total last, so cutting from the front removes the number that would
reveal the cut. Keep the first lines and the last line, and say how many were left out.

### T5 · A dependency that downloads the rest of itself

`@daily-co/daily-js` is a loader; the client it downloads names hosts the package never
mentions. Audit the artifact that runs, pin the audit to a version, and fail when the version
moves: `npm run audit:daily-hosts -- --write` records it in `docs/SECURITY-AND-PRIVACY.md`, and
`verify:csp` enforces it.

### T6 · A script that runs when it is imported

Scripts call `main()` at module scope, so importing one runs it. Anything two scripts share
lives in an underscore file with no `main()` and no side effect (`scripts/_cast.ts`,
`scripts/_demo-cast.ts`, `scripts/_gates.ts`, `scripts/_value-statements.ts`). Never guard a
side effect on what `process.argv[1]` ends with.

### Recorded but not checkable

- A check bound to a syntax rather than a property: ask whether an improvement would still pass.
- A check that reads one of the N files that implement a thing: ask whether this is the only place.
- A check looking for an answer in the wrong medium (copy versus a component).
- A gate measuring the harness instead of the product.
