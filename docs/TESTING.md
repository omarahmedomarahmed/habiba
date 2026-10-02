# Testing

There is no linter; the static analysis is the typecheck plus the checks below. Every check is
an npm script, so one command runs one check.

## The two passes

| Pass | Command | Needs | Runs |
| --- | --- | --- | --- |
| Static | `npm run ci` | Nothing but the repository (and Chromium for the alarm suite) | `typecheck`, every `test:*` suite except the database ones, `prose`, and the static verifiers listed in `scripts/_ci-lists.ts` |
| Database | `npm run ci:db` | A Postgres on this machine behind Neon's WebSocket proxy (`DATABASE_WS_PROXY`), migrated and seeded | Every suite in `NEEDS_DATABASE_SUITES` (`scripts/_ci-lists.ts`) except `test:e2e`, including `test:ledger` and `test:tenancy` (clinician A cannot reach clinician B's chart, sessions, transcript, notes, files, profile, copilot thread or export; each refusal paired with B's own call). Refuses any database host that is not local |
| Full | `npm run gates` | `.env.local` with `DATABASE_URL` on the dev branch | Every gate in `scripts/_gates.ts`, which includes `suites` (every unit suite), `verifiers` (every `verify:*` that is not a gate) and the build-and-serve checks |

GitHub Actions runs both on every pull request and on `main` (`.github/workflows/ci.yml`): the
static pass, and a "Database checks" job that starts `postgres:18` (Neon runs 18) with
`ghcr.io/neondatabase/wsproxy` in front of it, runs `db:migrate`, `settings:seed` and
`db:seed`, then `npm run ci:db`. No secret is involved. To run the database pass locally:

```
docker network create ci
docker run -d --network ci --network-alias postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ci -p 5432:5432 postgres:18
docker run -d --network ci -e APPEND_PORT=postgres:5432 -e ALLOW_ADDR_REGEX='.*' -p 5488:80 ghcr.io/neondatabase/wsproxy:latest
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/ci DATABASE_WS_PROXY=localhost:5488
npm run db:migrate && npm run settings:seed && SEED_ADMIN_EMAIL=ci-admin@example.com SEED_ADMIN_PASSWORD=<any> npm run db:seed && npm run ci:db
```

Variables set in the shell win over `.env.local`, so this never reaches dev. `npm run gates` is run locally before a merge that deploys; it
takes a long time, so between edits run only the narrow check for what you touched.

When a run needs the secrets file, keep it outside the repository (it is public) and load it in a
subshell so no value is expanded onto a command line, where `ps` and shell history would show it:
`(set -a; . ~/24therapy-secrets.env; set +a; npm run gates)`. Never `env $(xargs < file) ...`.

Heavy runs (`npm run gates`, `verify:served`, `smoke`, `render:check`, `test:e2e`) share port
3199, the `.next` build directory and about 4GB of memory. When more than one agent or terminal
works in the same machine, take a shared lock so they queue instead of colliding, for example
`flock /tmp/24therapy-heavy.lock npm run gates`, and run the served checks on an otherwise quiet
machine: under load `verify:served` and `verify:contrast` time out on the harness, not the
product.

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
| Copy and language | `prose`, `verify:claims`, `verify:claims-defaults` (no shipped default page makes a claim in `lib/content/claims.ts`, and the CMS guard is wired; static, in CI), `verify:cms-claims` (the same rules over the stored `content_pages` rows; read-only, allowed on production), `verify:notices`, `verify:sprint37l` (i18n ratchet), `verify:message-language`, `verify:palette`, `verify:contrast` | Source, dictionaries, rendered pages |
| Security | `verify:csp`, `verify:blobs`, `verify:staff-2fa`, `verify:limits` | Source, database |
| Money | `verify:money`, `verify:cycle`, `verify:edges`, `verify:month`, `verify:payout`, `verify:wallet`, `verify:rail`, `verify:gateway`, `verify:entitlement`, `verify:finance`, `verify:plan` | Database fixtures they plant and remove |
| Migrations | `verify:journal` (the journal only grows at the end against the fork point with `main`; past entries and their SQL unchanged; needs full history, so CI checks out with `fetch-depth: 0`), `verify:migrations` | Git history, the database |
| Documents | `verify:runbook` (`docs/simulation/`, README, `docs/*.md` paths), `verify:traps` (this page's trap list), `verify:prove` (`docs/DEMO.md`), `verify:claims` (the hazards table in `docs/OPERATIONS.md`), `verify:csp` (the video host audit in `docs/SECURITY-AND-PRIVACY.md`) | Markdown |
| A seeded database | `verify:cast`, `verify:demo`, `verify:event-demo`, `verify:synthetic`, `verify:board` | The database it is pointed at; skipped by `verifiers` |
| The running site | `smoke`, `verify:served`, `render:check`, `check:live`, `verify:email-dns` | A build, the live site, or live DNS |
| History-named | `verify:sprintNN`, `verify:w1b`, `verify:w2*`, `verify:r1-portal` | The rules a past sprint or fix wave wrote, still enforced |

Ratchets only move one way: `evals/prose.json` (words per portal), `scripts/_i18n-coverage.json`
(English left in markup), `evals/cases.json` and `evals/unmeasured.json` (AI evals). Raising a
number is a decision made in a diff, with the reason written beside the number in that file and
in the pull request.

## The crisis keyword floor

`npm run test:crisis-lexicon` (`tests/crisis-lexicon.test.ts`) needs no database and no network
and runs in CI. It holds every sentence due diligence found silenced or missed, the near misses
that must stay quiet, the live scan (speaker, questions, the chunk join) and the eval risk and
floor cases (`evals/cases.ts`), so the keyword half of the risk eval now gates a merge.

On 2026-10-01 ruling CR16 (first-person phrases alert even in the past) moved
`risk.specificity` in `evals/baseline.json` from 93.1% to 79.3% on purpose; sensitivity stayed
at 94.4% and the 121-sentence probe went from 49 missed to 0. The reason is beside the number
(`whyRiskSpecificityDD2`). Any further move needs the same: a ruling, a reason in the file, and
the pull request saying so.

## Known flaky or conditional checks

| Check | Why it can go red without a product defect |
| --- | --- |
| Anything that signs in | The sign-in limiter is at its production setting locally (H50). Run once; wait 15 minutes after "Too many attempts" |
| Repo-walking verifiers | An agent worktree under `.claude/worktrees/` is scanned as source (H51) |
| `verify:email-dns` | Asks live DNS; fails from 2026-10-06 while DMARC is still `p=none` (deliberate deadline) |
| `verify:served`, `smoke`, `render:check` | Need a build, free port 3199 and a quiet machine; a killed run leaves a server behind (B4) |
| `verify:journal` | Reports deferred, not failed, on a shallow clone with no `origin/main` to compare against |
| `verify:contrast` | Under load the harness, not the product, is slow; it asks the server log which it was |
| `verify:cast`, `verify:demo`, `verify:event-demo` | True only on a database seeded with that cast |
| `settings:compare` | Reports an absent environment while `DATABASE_URL_SIMULATION` is unset |

## Adding a check

| To add | Do |
| --- | --- |
| A unit suite | `tests/<name>.test.ts` and a `test:<name>` script. `suites` fails on a test file no script runs. If it needs a database, add it to `NEEDS_DATABASE_SUITES` in `scripts/_ci-lists.ts`; CI then runs it in the database job against an empty, migrated and seeded database, so it must plant its own fixtures |
| A verifier | `scripts/verify-<name>.ts` using `reporter()` and `readSource()` from `scripts/_verify.ts`, and a `verify:<name>` script. `verifiers` picks it up automatically. If it needs no database, add it to `STATIC_VERIFIERS` in `scripts/_ci-lists.ts` so CI runs it |
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
