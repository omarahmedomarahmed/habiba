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

## Verification commands

```bash
set -a; . ./.env.local; set +a          # anything touching the database needs this

npx tsc --noEmit                         # types
npm run build                            # the real check
npm test                                 # safety      (23)
npm run test:alarm                       # alarm       (7)
npm run test:clock                       # clock       (12)
npm run test:toasts                      # toasts      (8)
npm run test:transcribe                  # transcribe  (10)
npm run test:ledger                      # ledger      (9)   — needs DATABASE_URL
npm run test:db                          # radar       (27)  — needs DATABASE_URL
npm run test:e2e                         # e2e         (13)  — needs DATABASE_URL
```

`npm run lint` drops into Next's interactive ESLint setup and hangs. Use `tsc`
and `build` instead until that is configured.
