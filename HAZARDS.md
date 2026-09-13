# Codebase hazards

Traps in this repository that have already caused production defects. Each is a
property of the code or the tooling, not a story about anybody. Read once before
your first commit.

| # | Hazard | Rule |
|---|---|---|
| H1 | `db:migrate` prints **"Migrations applied."** whether or not it did anything. A `.sql` file missing from `drizzle/meta/_journal.json` is silently skipped | After every migration, query `information_schema.columns` for the column you added. Never trust the success line |
| H2 | An instruction placed **after** the JSON schema in a prompt loses to the weight of the context above it | Standing corrections go first, framed as overriding everything below |
| H3 | Naming one direction in a language rule makes the model over-switch | Name both directions and forbid a third |
| H4 | A fix that repairs case A frequently breaks case B | Always re-measure the case that already worked |
| H5 | `Object.is(-0, 0)` is `false`, so a balance derived by negating a sum fails equality | Normalise anything produced by negation |
| H6 | `audit()`'s `resourceId` is a **uuid** column. A friendly string raises `invalid input syntax` and 500s the page | Descriptive text goes in `reason` |
| H7 | `sql.raw` with values derived from data is an injection vector | Use `inArray` and parameter binding |
| H8 | Two `aria-live="polite"` regions on one screen queue behind each other; a short-lived one is announced after it has gone | One polite region per screen. Short-lived content is `assertive` |
| H9 | Vercel functions cap at 300s, 800s with Fluid compute | Long jobs go to a worker or a resumable cron, never a request handler |
| H10 | Neon instant-restore history bills at **$0.20/GB-month**, ~10× the row cost | Set history retention to 0 before any bulk load, restore after |
| H11 | `MAX_SEGMENTS = 160` in `lib/ai/diarise.ts`; a 60-minute session is ~450 segments | Batch, or the tail is never attributed |
| H12 | `lib/ai/client.ts` costs a transcribe call against a hardcoded rate and ignores `input.model` | Fix before adding any second provider, or billing is silently wrong |
| H13 | `cost_microcents` is named microcents but the schema documents **thousandths of a cent**. $1 = 100,000 units | Divide by 1e5, not 1e8 |
| H14 | Blob URLs are secrets, not access control. Anyone with the URL has the file | Never rely on URL opacity for a document watermark or audit trail |
| H15 | Force-pushing a shared branch destroys another session's commits as surely as deleting a message | Merge; never force-push `main` or a branch another session writes to |
| H16 | **Nothing applies migrations on deploy.** Vercel's build command is `next build` and no step runs `db:migrate`. Pushing `main` ships code whose tables do not exist, and every page that touches one 500s | Apply the migration to production **before** pushing `main`, and keep every migration additive so the running deployment survives the gap |
| H17 | **The migration journal is the source of truth, not the directory.** A `.sql` file with no entry in `drizzle/meta/_journal.json` is skipped and the runner prints success. This shipped once: `0083` existed on disk for a day while production had none of it | `scripts/migrate.ts` now refuses when the two disagree. Never hand-write a journal entry |
| H18 | **A generated journal entry can be unreachable.** Drizzle applies a migration only when the last ledger timestamp is **lower** than the entry's `when`. This journal carries synthetic values ahead of the wall clock, so a freshly generated entry lands *behind* its predecessor and is skipped silently | After `drizzle-kit generate --custom`, correct `when` to continue the sequence. `migrationLedgerAudit` checks reachability, not just membership |
| H19 | **`drizzle-kit generate` without `--custom` cannot be used here.** `drizzle/meta/` holds only `0000_snapshot.json`; migrations 1 to 82 were journaled by hand, so a plain generate diffs against the original schema and emits a migration recreating eighty-nine existing tables | `--custom` only, until somebody rebuilds the snapshot chain by replaying every migration into a scratch database |
| H20 | **A known-failing test is a test nobody reads.** Five e2e tests asserted UI that sprints 41 and 47 deliberately changed and sat red for fifteen sprints behind a standing explanation of "no headless shell" that was itself wrong. They masked a live defect: a therapist could not start a session with a walk-in | A failure carrying a standing explanation gets re-diagnosed on a schedule, or the explanation becomes a lid |
| H21 | **`tests/run-e2e.sh` is the harness.** It resolves Chromium and starts a server. `node --test` on that file runs it without either, and the browser error it prints names something other than the real problem | Always `npm run test:e2e`. `scripts/_browser.ts` resolves the browser; prefer the full Chromium over the headless shell, which cannot do fake media streams |
| H22 | **A switch an operator can set is proved dead by its ACCESSOR, never by its column name.** `country_settings.enabled` was searched for by field, declared unused and nearly deleted. It is read through `getCountrySettings`, which returns null when false, and two payment call sites then refuse the charge | Grep the function that reads it, and every caller of that function, before removing any operator control |
| H23 | **The i18n coverage ratchet is a floor, and knows it twice over.** It counts JSX text plus `aria-label`, `placeholder`, `title`, `alt`, `label` and `hint`. It cannot see a string inside a JSX expression container, so every ternary is invisible, including the pending state of most buttons | Treat zero as "no known English", never "no English". Closing the shape needs a parser, not a wider regex |

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
