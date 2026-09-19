# Codebase hazards

Traps in this repository that have already caused production defects. Each is a
property of the code or the tooling, not a story about anybody. Read once before
your first commit.

> 🔴 **Every row carries a status.** A hazard log that never retires an entry is a
> false-alarm log, and H20 below is the record of what standing false alarms do to
> the people reading them. `verify:claims` asserts this column exists.

## 🔴 When you find the next one, it goes here

**Any session that touches this repository, including the six month run.** If you hit a
trap in the code or the tooling that cost you more than a few minutes, add a row to the
bottom of the table with the next H number, before you carry on. Two columns: what the trap
is, and the rule that avoids it.

The test for whether something belongs here is **whether it will catch the next person
too.** A property of the code or the tooling belongs here. Something the product does
wrong to a user is a defect, and during the run those go in `docs/simulation-run/DEV-LOG.md`
instead, in the shape `docs/simulation/02-THE-SWARM.md` gives.

Write it at the moment you hit it. The version written a week later is a summary, and the
useful part is the detail: the symptom that misled you, and what the symptom was really
naming. Most of the rows below exist because somebody did that instead of working around it
quietly, and they are the reason the six month run knew about its obstacles before wave 1.

| # | Status | Hazard | Rule |
|---|---|---|---|
| H1 | ⚠️ live | `db:migrate` prints **"Migrations applied."** whether or not it did anything. A `.sql` file missing from `drizzle/meta/_journal.json` is silently skipped | After every migration, query `information_schema.columns` for the column you added. Never trust the success line |
| H2 | ⚠️ live | An instruction placed **after** the JSON schema in a prompt loses to the weight of the context above it | Standing corrections go first, framed as overriding everything below |
| H3 | ⚠️ live | Naming one direction in a language rule makes the model over-switch | Name both directions and forbid a third |
| H4 | ⚠️ live | A fix that repairs case A frequently breaks case B | Always re-measure the case that already worked |
| H5 | ⚠️ live | `Object.is(-0, 0)` is `false`, so a balance derived by negating a sum fails equality | Normalise anything produced by negation |
| H6 | ⚠️ live | `audit()`'s `resourceId` is a **uuid** column. A friendly string raises `invalid input syntax` and 500s the page | Descriptive text goes in `reason` |
| H7 | ⚠️ live | `sql.raw` with values derived from data is an injection vector | Use `inArray` and parameter binding |
| H8 | ⚠️ live | Two `aria-live="polite"` regions on one screen queue behind each other; a short-lived one is announced after it has gone | One polite region per screen. Short-lived content is `assertive` |
| H9 | ⚠️ live | Vercel functions cap at 300s, 800s with Fluid compute | Long jobs go to a worker or a resumable cron, never a request handler |
| H10 | ⚠️ live | Neon instant-restore history bills at **$0.20/GB-month**, ~10× the row cost | Set history retention to 0 before any bulk load, restore after |
| H11 | ✅ fixed | ~~`MAX_SEGMENTS = 160` in `lib/ai/diarise.ts`; a 60-minute session is ~450 segments~~ **RETIRED.** `lib/ai/diarise.ts:63` — *"This used to be `MAX_SEGMENTS = 160`"*. Batched since sprint 37 | Nothing to do. Kept for the history |
| H12 | ✅ fixed | ~~`lib/ai/client.ts` costs a transcribe call against a hardcoded rate and ignores `input.model`~~ **RETIRED.** `lib/ai/client.ts` prices by exact model from `platform_settings`, and an unpriced model deliberately OVERSTATES. Fixed in sprint 49 | Nothing to do. Kept for the history |
| H13 | ⚠️ live | `cost_microcents` is named microcents but the schema documents **thousandths of a cent**. $1 = 100,000 units | Divide by 1e5, not 1e8 |
| H14 | ⚠️ live | Blob URLs are secrets, not access control. Anyone with the URL has the file | Never rely on URL opacity for a document watermark or audit trail |
| H15 | ⚠️ live | Force-pushing a shared branch destroys another session's commits as surely as deleting a message | Merge; never force-push `main` or a branch another session writes to |
| H16 | ⚠️ live | **Nothing applies migrations on deploy.** Vercel's build command is `next build` and no step runs `db:migrate`. Pushing `main` ships code whose tables do not exist, and every page that touches one 500s | Apply the migration to production **before** pushing `main`, and keep every migration additive so the running deployment survives the gap |
| H17 | ⚠️ live | **The migration journal is the source of truth, not the directory.** A `.sql` file with no entry in `drizzle/meta/_journal.json` is skipped and the runner prints success. This shipped once: `0083` existed on disk for a day while production had none of it | `scripts/migrate.ts` now refuses when the two disagree. Never hand-write a journal entry |
| H18 | ⚠️ live | **A generated journal entry can be unreachable.** Drizzle applies a migration only when the last ledger timestamp is **lower** than the entry's `when`. This journal carries synthetic values ahead of the wall clock, so a freshly generated entry lands *behind* its predecessor and is skipped silently | After `drizzle-kit generate --custom`, correct `when` to continue the sequence. `migrationLedgerAudit` checks reachability, not just membership |
| H19 | ⚠️ live | **`drizzle-kit generate` without `--custom` cannot be used here.** `drizzle/meta/` holds only `0000_snapshot.json`; migrations 1 to 82 were journaled by hand, so a plain generate diffs against the original schema and emits a migration recreating eighty-nine existing tables | `--custom` only, until somebody rebuilds the snapshot chain by replaying every migration into a scratch database |
| H20 | ⚠️ live | **A known-failing test is a test nobody reads.** Five e2e tests asserted UI that sprints 41 and 47 deliberately changed and sat red for fifteen sprints behind a standing explanation of "no headless shell" that was itself wrong. They masked a live defect: a therapist could not start a session with a walk-in | A failure carrying a standing explanation gets re-diagnosed on a schedule, or the explanation becomes a lid |
| H21 | ⚠️ live | **`tests/run-e2e.sh` is the harness.** It resolves Chromium and starts a server. `node --test` on that file runs it without either, and the browser error it prints names something other than the real problem | Always `npm run test:e2e`. `scripts/_browser.ts` resolves the browser; prefer the full Chromium over the headless shell, which cannot do fake media streams |
| H22 | ⚠️ live | **A switch an operator can set is proved dead by its ACCESSOR, never by its column name.** `country_settings.enabled` was searched for by field, declared unused and nearly deleted. It is read through `getCountrySettings`, which returns null when false, and two payment call sites then refuse the charge | Grep the function that reads it, and every caller of that function, before removing any operator control |
| H23 | ⚠️ live | **The i18n coverage ratchet is a floor, and knows it twice over.** It counts JSX text plus `aria-label`, `placeholder`, `title`, `alt`, `label` and `hint`. It cannot see a string inside a JSX expression container, so every ternary is invisible, including the pending state of most buttons | Treat zero as "no known English", never "no English". Closing the shape needs a parser, not a wider regex |
| H24 | ⚠️ live | **A pure function can be broken by moving its DATA.** `tierForSpend` walked every tier and kept the last one whose threshold the spend had passed — correct on a $0/$30/$60 ladder. Sprint 57 set every threshold to zero, and the untouched function began handing the $179 plan to anybody who had spent a penny | When a schedule, list or lookup table changes shape, re-read every function that WALKS it. The diff will not show them |
| H25 | ⚠️ live | **A rail can pass by measuring the wrong thing, and a rail is what everything else trusts instead of checking.** `settingsProblem` asked whether any tier had a zero threshold, meaning "a therapist who bought nothing still has a rate". After sprint 57 that is true of every tier including the paid ones, so the rail guarded nothing while still reporting clean | Prove a rail by CONSTRUCTING the configuration it must refuse. An assertion that the good case passes is not a test of a guard |
| H26 | ⚠️ live | **A guard added to every writer severs the sanctioned production paths.** `writesTo()` on `seed.ts` broke `ship:content`, the only way to publish content to production (C148); on `republish.ts` it broke `render:check`, which renders every public page against production (C89). Neither failed loudly — the render check just went thirteen-red for what was really one missing publish | Before adding a refusal, list who legitimately needs past it. Both exceptions are named in the scripts and asserted in `verify:sprint57` |
| H27 | ⚠️ live | **Copy that was true when written is the copy nobody rereads.** "No subscription, no seat fee, no setup fee" was accurate for a year and false the hour a plan shipped. No gate in this repository reads a sentence for truth; every string gate counts whether a string is TRANSLATED | `verify:claims` compares copy to the product — if any tier carries a monthly price, no published string may deny a subscription. Add a rule there whenever a claim depends on a figure |
| H28 | ⚠️ live | **Fixing `lib/content/defaults.ts` changes nothing a visitor sees.** The CMS is authored-content-wins: a slug with a row in `content_pages` is served from that row for ever. Four dangerous claims were fixed in the file and were still live on the site | A copy fix is not finished until `npm run ship:content` has run against production. `verify:sprint57` reads the published ROWS, never the defaults |
| H29 | ⚠️ live | **A verifier that needs two rows and finds one reports the CONSTRAINT as broken.** Three did: sprint 41 took a second session with `OFFSET 1 LIMIT 1`, sprint 49 summed two cost columns over no rows (`NULL !== NULL` is false), sprint 16 launched a production child with an incomplete key list. All three printed a real safety property as FAILED and all three read as environmental for months | A verifier PLANTS what it needs and removes it. Never `LIMIT 1 OFFSET 1`, never a sum over whatever is there, never a child process inheriting the operator's shell (C284, C301) |
| H30 | ⚠️ live | **A gate that cannot run hides its own rot.** `render:check`'s control asserted a phrase the pricing page stopped rendering eleven sprints earlier. Nobody saw it because the script needs `en-x-staging` rows against production and there were none | When a gate has been unrunnable, assume its assertions are stale and re-read them before trusting the first green run (C302) |
| H31 | ⚠️ live | **A skip list matched by name skips that name at EVERY depth.** `["node_modules", ".next", "public"].includes(entry)` also skips `components/public`, which here holds the marketing blocks, the pricing cards and the contact form. A scanner reported an orphan while the file calling it sat in the directory it had skipped | Anchor a skip list at the root, and give any scanner a control asserting it can see a directory it nearly missed (C362) |
| H32 | ⚠️ live | **A server action is a BOUNDARY in the import graph, not an edge.** Following through one makes a public marketing page look like it queries clinical tables, because a booking sheet imports the action that books. `import type` is the same: it vanishes at compile time | Stop at a `"use server"` module and skip `import type` when measuring what a page can reach (C364) |
| H33 | ⚠️ live | **A session is not the only way to be authenticated.** Ten entry points here authenticate by a capability in the URL or a secret in a header: `/join/[token]`, `/records/[token]`, `/feedback/[token]`, `/verify`, the cron route, the EHR OAuth callback | Model capability auth by name rather than allowlisting the pages. A gate that cannot see it pushes somebody to put a login in front of a crisis rating link (C365) |
| H34 | ⚠️ live | **An allowlist written from memory will be wrong, and will read as a decision.** Four of the first five route exemptions named paths that did not exist or routes that were never orphans, each with a confident paragraph | Write an exemption only after the gate has reported the orphan, and keep the stale-entry check that fails when an entry stops being needed (C363, C302) |
| H35 | ⚠️ live | **A command that is run ONCE has a second state, and the documents describe the first.** `simulate:seed` is written to run once on production. It has, so the prompt telling the next session to run it now gets a refusal whose advice is *"for a fresh start, make a new branch"* — correct for an empty database, and it would throw the seeded run away. Six places across three documents still described the before state | When a one-shot command has been run, rewrite the step to the CONFIRMING read (`verify:cast`) and say the refusal is expected. Grep for every other mention of it before calling that done |
| H36 | ⚠️ live | **A permanent state claim goes stale the moment it is written down.** `evals/production-baseline.json`, the snapshot and three tables in the docs all describe 2026-09-17. Migration 0111 and the seed have happened since, so `baseline -- check` now exits 1 by design, and restoring the snapshot would take the schema back to 0110 along with the rows | Date every state claim in the sentence that makes it, and say what has moved since. `baseline -- check` compares ROWS and not tables, so a schema change passes it silently while the new tables are empty |
| H37 | ✅ fixed | **`next dev` and `next build` shared `.next`, so `npm run gates` could not be run twice.** `renders` needs build output; `served` starts `next dev` and recompiled over it. A build over dev output died prerendering `/for-patients` with `TypeError: ... reading 'call'`; dev over build output made `/ar/pricing` answer **500** and the Arabic checks report "0 Arabic characters against 0 Latin". Both read as broken public pages and neither was. The pass went green twice and red on the third run with nothing changed | Fixed in 76.61: `served` compiles into `.next/served` via `NEXT_DIST_DIR`, which `next.config.ts` reads. **Nest a new build directory inside `.next`, never beside it** — `.next-served` at the root was outside every scanner's skip list and `verify:reachable` immediately read the dev server's generated route types as callers (H31) |
| H38 | ✅ fixed | **`db:migrate` was the one write with no guard on it.** Seventy-five scripts call `writesTo()`; the script that changes production's SHAPE did not, so `.env.local` pointed at production plus `npm run db:migrate` migrated it silently. It was also missing from the `on:production` allow-list, so H16's own instruction (migrate production before pushing `main`) had no sanctioned path and `DEPLOY.md` named a command that would have been refused for not existing | Fixed both ways in 76.61: `writesTo({ productionIsAllowed: true })` in the runner, and `db:migrate` on the allow-list. When a guard is added everywhere, list who legitimately needs past it (H26) |
| H39 | ✅ fixed | **`verify:served` leaked its dev server, and the orphan kept compiling.** `npx next dev` forks `next-server` into **its own process group**, reparented to init, so signalling the group missed it — and it **releases the port while still running**, so waiting for the port to come free returned success with a compiler still live. It then rewrote the production build minutes after the gate reported PASS. `smoke-public.ts` carries the same lesson for `next start` (C365) and this file never got it | Snapshot `next-server` pids before spawning, kill the difference after. Never trust a port going quiet as proof a server has stopped, and never assume a fix applied to one spawn site covers the others |
| H40 | ✅ fixed | **Pushing one commit to three branches builds it three times, and two of those builds cannot succeed.** The build is memory-bound (see below); production survives on a warm cache in ~2 minutes while a preview does a full compile and dies. In 24 hours, 19 preview builds burned **4.84 hours** of build time for nothing: 16 `out_of_memory`, 4 of them hitting the 45-minute `BUILD_EXCEEDED_MAXIMUM_TIME` ceiling. Billed $0.52, $2.42 at list | An **Ignored Build Step** on the Vercel project builds `main` only. Push to working branches freely; they cost nothing. Before adding a branch to a push routine, ask what its deployment is FOR — nobody was ever going to open these |
| H41 | ✅ fixed | **A count scoped to a hand-written list cannot count what is not on the list.** The gate asserting *"exactly THREE scripts may be let through to production"* filtered five file names typed into itself. H38 opened a fourth door in `scripts/migrate.ts`, which was not one of the five, so the check went on printing **three, and these are they** while four existed. The number in the message was real; the set it was drawn from was not | Fixed in 76.62: the count reads every `.ts` under `scripts/` and compares the set. **A count is only a count if it reads every file that could contribute to it** (H31, H25), and it needs a control proving the scan is wide — here, that it read 152 scripts and not the 4 it expected |
| H42 | ✅ fixed | **A percentage against an empty measurement is a confident number for "nothing happened".** `physics` compared the run's fitted 50-minute cost against the API benchmark as `(fit - benchmark) / benchmark`. With no rows to fit, `fit` is 0, so it printed **-100%, outside 25%** — which reads as the cost model being catastrophically wrong, and produced three confident and completely wrong diagnoses before anybody checked the row count. The over-correction was worse: suppressing the whole comparison when any one request kind was short of samples hid a 0.7% agreement across the other 97%, because `profile` fires on ~2 sessions in 5 and reaches the sample floor last | Say **"nothing to compare"** when N is zero, and never divide by a measurement you have not asserted is non-empty. When part of a composite is missing, compare what you have and **label it a floor**; dropping the whole comparison loses more than it protects |
| H43 | ✅ fixed | **A comparator with no way to express a decision reads a decision as drift.** `settings:compare` fails on any difference between the three databases. The in-session copilot is deliberately capped at 4 on production to protect the run's $10 of credit, so the gate went red on a choice somebody had made on purpose — and a gate that is red for a good reason is H20 waiting to happen | An allowance names the leaf, the environment, **both** values and the reason. Pinning both sides matters: an allowance that pins one lets the same key drift to a third value unnoticed. Proved with two planted offenders, one per direction |
| H44 | ⚠️ live | **A bulk replace across prose edits the sentences that merely MENTION a command.** Prefixing 32 commands with `on:production --` also rewrote two passages that were describing what a command does, turning one of them self-contradictory. The diff looked uniform and correct, and the damage was in the two lines that were never instructions | Bulk-edit command lines only where they are commands: inside a fenced block, a table cell or a backticked run. Then **read every changed line in prose**, because the tool cannot tell an instruction from a sentence about one |
| H45 | ⚠️ live | **`pkill -f "<pattern>"` matches the shell that is running it.** `pkill -f "next dev"` killed its own shell — the pattern appears in that shell's own command line — and the session died with exit 144, which names nothing | Kill by port (`kill -9 $(lsof -ti:PORT)`) or by exact process name, never by a `-f` pattern containing words you just typed |
| H46 | ⚠️ live | **A symptom that survives `rm -rf` and a clean rebuild is a PROCESS, not a file.** Several rounds went into `.next` corruption that was being re-created after every clean by an orphaned `next dev` left behind by an **earlier command in the same session**. Every fix appeared to work and then stopped working, which is the shape that gets read as flakiness | `ps -eo pid,args \| grep next-server` is the first instrument, not the last. Before blaming a build, ask what is still running, and remember that a rig you started twenty minutes ago is still yours |
| H47 | ✅ fixed | **A document is not checked by anything, so it rots under the product silently.** Eighteen files drive the six month run and nothing had ever read them. A full read found **41 commands pointing at the wrong database** because they were written without the `on:production` prefix — including the one that starts the wave clock, so six months of ageing would have landed on dev with nothing failing — a governing rule denying the run's own shape, and every count disagreeing with something | `verify:runbook` is a gate, and it derives every expectation from the code: the gate count from `GATES`, the production-only commands from the allow-list itself, the cron jobs from the route's map, the edge count by counting the rows in the file that defines them. **A checker holding its own copy of a number stops matching the day somebody tunes the real one** |
| H48 | ⚠️ live | **Sourcing `.env.local` into a shell silently drops the four database URLs.** Each connection string ends `?channel_binding=require&sslmode=require`, and bash reads the unquoted `&` as "run this in the background", so `set -a; . ./.env.local; set +a` assigns them in a subshell that exits. Every other variable loads, so it reads as having worked, and the ones that vanish are the four that decide which database the next command writes to. **This file told people to do it** | Never source it. Every `npm run` script loads it with `node --env-file-if-exists=.env.local`, which parses the file properly. For a one-off, put the file under `scripts/` and run it the same way |

## Verification commands

```bash
npx tsc --noEmit                          # types
npm run build                             # the real check
npm test                                  # safety suite
npm run test:e2e                          # e2e, THROUGH its harness
npm run verify:sprintNN                   # per-sprint gates; all refuse production by name
```

🔴 **Do not source `.env.local` into your shell, and do not add a step that says to.**
Every `npm run` script here loads it with `node --env-file-if-exists=.env.local`, which
parses the file. `set -a; . ./.env.local; set +a` does not: the four connection strings
carry `?channel_binding=require&sslmode=require`, and the unquoted `&` makes bash run each
of those lines as a **background job**, so the assignment happens in a subshell and never
reaches you. Every other variable in the file loads correctly, so it looks like it worked,
and the four that go missing are the four that decide which database you are about to
write to. Measured: after sourcing, `OPENAI_API_KEY` is set and `DATABASE_URL` is empty.

## The production build is memory-bound, and the cap is the binding constraint

`npm run build` runs with `NODE_OPTIONS=--max-old-space-size=4096` and compiles in ONE
process. It got there the long way round, and the middle of the story is the useful part.

On 2026-09-16 four production deploys died with

```
FATAL ERROR: Ineffective mark-compacts near heap limit
Next.js build worker exited with code: null and signal: SIGABRT
```

at **3016 MB of a 3108 MB heap**. The obvious reading is "the cap is too small", so it was
raised to 6144, and deploys got worse: the clean V8 abort with a stack in it became

```
Next.js build worker exited with code: null and signal: SIGKILL
```

which is the kernel, not V8, and carries no stack at all.

**Do not raise it.** The cap is per PROCESS, and `NODE_OPTIONS` is inherited by children,
so a build that compiles in a worker gets two heaps allowed the same ceiling. On an 8 GB
container, 6144 means parent and worker may between them ask for 12 GB, and the failure is
intermittent because it depends on who asks first: identical commits built green at 19:20
and were killed at 20:18.

`next.config.ts` sets `experimental.webpackBuildWorker: false` so there is exactly one
compile process. Measured peak RSS across every node process the build starts:

| configuration | peak RSS | result |
| --- | --- | --- |
| worker on, cap 6144 | 2.8 GB locally | SIGKILLed on Vercel anyway |
| worker off, cap 4096 | 4.4 GB | green ← shipped |
| worker off, cap 3072 | 4.0 GB | green, 43s to compile |

**4096 is the one that ships, and 3072 is not**, even though 3072 built green here. The
original V8 abort is evidence that the compile genuinely wants more than a 3 GB heap on a
cold Vercel container; a local build with a warm module graph wanting less does not
overturn it. 4096 is above the number that failed and half of the number that got killed.

The first row is the lesson: a local peak well under the container's memory did not predict
the failure, because the failure was two heaps racing rather than one heap being too small.

If it OOMs again, the answer is still not another thousand megabytes. It is that the build
has grown and something in it should be smaller.

`npm run lint` used to drop into Next's interactive ESLint setup and hang there
forever, which is the worst possible failure for a script an agent or a CI job
might type. No linter is installed, so it now says so in one line and exits 1.
The static analysis in this repository is `npm run typecheck` and `npm run gates`.

Every verifier that touches the database refuses the production endpoint by name, unless
the caller asks to be let through and is on the `on:production` allow-list. Do not weaken
that guard, and do not add a door without adding its reason. Point `DATABASE_URL` at a Neon
branch instead.

## The three databases, and the one question `DATABASE_URL` cannot answer

| Environment | Variable | Neon branch | Endpoint |
| --- | --- | --- | --- |
| production | `DATABASE_URL_PRODUCTION` | `main` | `ep-wild-lake-a6tgm2r6` |
| dev | `DATABASE_URL_DEV` | `sprint-1-settings` | `ep-aged-dust-a6huadss` |
| simulation | `DATABASE_URL_SIMULATION` | `simulation-q1` | `ep-empty-queen-a62vlkkp` |

`DATABASE_URL` is the database *this process* talks to. These three are the databases
this product *has*, and they exist because "are all three configured the same way" cannot
be asked by a process that can only see one of them.

    npm run settings:compare

reads all three and fails on any difference it has not been told is a decision. It writes
nowhere, so it can be pointed at
production, and it must be: production is the database that most needs asking and the one
a write guard has always refused to let anybody ask. Each variable is checked against the
endpoint above before anything is read, because a variable named for production holding
the dev branch would report dev agreeing with itself.

The first run found four real drifts, including one nothing that reads source could ever
have seen: production's ID-upload labels still carried an em dash, because `settings:seed`
only ever inserts and the corrected default never reached a row that already existed.
`settings:check` now fails on an em dash in any stored string for that reason.

One difference is **allowed by name**: the in-session copilot is capped at 4 on production
to protect the run's model credit, against the shipped 10 elsewhere. The allowance pins the
leaf, the environment, both values and the reason, so the same key at a third value still
fails. H43 is why it exists rather than being argued about on every run.

Set these locally only. Nothing the deployed product does needs to reach a database other
than its own.

## Never run two builds at once, and `.next` corruption reads as a product defect

    Error occurred prerendering page "/features"
    TypeError: Cannot read properties of undefined (reading 'call')
        at Object.c [as require] (.next/server/webpack-runtime.js:1:128)

That is not a defect in `/features`. It is two processes writing `.next` at the same
time: `npm run build` in one shell while `npm run gates` runs `renders` or `served` in
another, both of which build and start the app. The chunk one process wrote is the chunk
the other process replaced, and the page that fails is whichever one loads first.

`rm -rf .next && npm run build` on its own is clean. Sprint 76 lost twenty minutes to this
believing the new admin page had broken the marketing site.

🔴 **And if a clean rebuild does not fix it, stop editing files.** The second process is
often one you started yourself and forgot — a `next dev` from a screenshot rig twenty
minutes earlier, still compiling into `.next` after every `rm -rf`. `ps -eo pid,args | grep
next-server` answers in one line what a morning of reading source will not (H46). The gates
no longer cause this themselves: `verify:served` compiles into `.next/served` and kills the
`next-server` it forked (H37, H39).

## `next start` refuses to boot without a blob token, including locally

`BLOB_READ_WRITE_TOKEN` is in `REQUIRED`, not `RECOMMENDED`, and `ALLOW_LOCAL_UPLOADS=1`
does not satisfy it: that flag governs the upload path, not the boot guard. So a local
`next start`, which runs in production mode, exits with

    Refusing to start, invalid environment:
      - BLOB_READ_WRITE_TOKEN is required in production

Pass any non-empty value to boot for a screenshot. The guard is correct and should not be
loosened: without a real token, therapist verification cannot accept a licence, so nobody
gets on the radar and nobody can start a session, and an Egyptian payer cannot attach the
receipt their bank app produced.

## One command reaches production, and `DATABASE_URL` is not it

    npm run on:production -- <command>

Seventy-five scripts call `writesTo()`, and most of them plant a fixture and delete it in a
`finally`. `writesTo()` refuses the production endpoint unless the CALLER asks to be let
through, which four do: `settings`, `simulate-seed`, `age` and `migrate`. `verify:sprint57`
asserts it is exactly those four, and it now counts them by reading **every** file under
`scripts/` rather than a list typed into the check — see H41 for what the list version
missed.

The six month run leaves its data on production and **nothing restores it away**, so a
fixture that escapes a `finally` is permanent and sits on the founders' board looking like
a real row. That is why the override moved out of `writesTo()` and into an allow-list with
a reason beside every entry.

Keep `DATABASE_URL` pointed at dev. Every gate, verifier and unit suite expects a branch
they may write to.

## A killed gate run leaves its server on 3199, and the next run reads empty pages

`verify:served` boots the product on **3199** and photographs it. Interrupting `npm run
gates` leaves that server alive, and the next run's own server cannot bind the port and
exits — but the OLD one is still answering, from whatever build was on disk when it
started. Three checks then fail with

    0 Arabic characters against 0 Latin

which reads as a product defect and is a stale process. `pkill -f "next start"` does not
find it: the process is named `next-server`. Kill it by port or by that name:

    kill -9 $(lsof -ti:3199)
    ps -eo pid,args | grep next-server

The same thing bites a local screenshot server on any other port, and it is worse there
because the symptom is a **ChunkLoadError** — the stale process serves a build id whose
static chunks were deleted by the next `npm run build`, so every page renders "Something
went wrong" and the cause looks like the code.

## Screenshot the page and read it, because three defects a sprint hide from every gate

Three in sprint 76 alone, and no gate in this repository could see any of them:

- `$3,500 7` — a wage bill and a headcount adjacent in a right-aligned column of figures,
  which reads as $35,007.
- `$25,000the money we started with` — a right-aligned money column against left-aligned
  text with no padding between them. The header rendered as `AmountNote`.
- `1 month, from 2026-09` over a balance of $75,000 that had plainly not arrived in one
  month, because capital was not one of the sources the month range was taken from.

    npm run build && npm run screens:prep
    node scripts/browser/shot.mjs <out-dir> /admin/actuals

🔴 The rig runs `next dev`, NOT `next start`, and the reason is two entries above this
one: `next start` demands a blob token, a fake one turns `LOCAL_UPLOADS` off, and
`documentUrl` then refuses every `/api/uploads/...` path — so a receipt sitting on disk
renders as "the store could not produce it". `next dev` also reads `.env.local`, whatever
the shell unsets, so a real token there wins and fixtures should be stored through
`uploadDocument` rather than written to `.uploads/` by hand.
