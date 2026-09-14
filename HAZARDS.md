# Codebase hazards

Traps in this repository that have already caused production defects. Each is a
property of the code or the tooling, not a story about anybody. Read once before
your first commit.

> 🔴 **Every row carries a status.** A hazard log that never retires an entry is a
> false-alarm log, and H20 below is the record of what standing false alarms do to
> the people reading them. `verify:claims` asserts this column exists.

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

## Verification commands

```bash
set -a; . ./.env.local; set +a           # anything touching the database needs this

npx tsc --noEmit                          # types
npm run build                             # the real check
npm test                                  # safety suite
npm run test:e2e                          # e2e, THROUGH its harness
npm run verify:sprintNN                   # per-sprint gates; most refuse production by name
```

`npm run lint` drops into Next's interactive ESLint setup and hangs. Use `tsc` and
`build` instead until that is configured.

Every verifier that touches the database refuses the production endpoint by name.
Do not weaken that guard. Point `DATABASE_URL` at a Neon branch instead.
