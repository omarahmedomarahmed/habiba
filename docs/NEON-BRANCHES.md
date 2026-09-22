# The Neon branches, and what each one is for

Six branches on project `gentle-waterfall-66476219` (`24therapy-v2`), and every
one of them has a job. This file exists because that was not written down
anywhere, so deciding which were safe to delete meant reading `.env.local`,
listing every compute endpoint, mapping endpoints back to branches, and
grepping four documents for the one snapshot a script names.

**🔴 Before deleting any branch, read the last section. A snapshot delete
cannot be undone and one of these is the only way back from `seed:demo`.**

---

## The three environments

These are task 66's "three environments, identical settings, one connection
string each". All three appear in `.env.local` and all three are load-bearing.

| Branch | Id | Endpoint | What it is |
| --- | --- | --- | --- |
| `main` | `br-curly-dream-a6b0shlz` | `ep-wild-lake-a6tgm2r6` | **Production.** The deployed product and the domain read this |
| `sprint-1-settings` | `br-round-star-a6vlxe55` | `ep-aged-dust-a6huadss` | **Dev.** `npm run gates` runs here. The name is historical and the usage is not: it is the busiest branch in the project |
| `simulation-q1` | `br-fragrant-bonus-a6ngfs07` | `ep-empty-queen-a62vlkkp` | The third environment, for a run that must not touch either of the others |

🔴 **`sprint-1-settings` is the dev database despite its name.** Anybody
tidying by name would delete it and every gate in the repository would go red
against nothing at all.

## The two Vercel previews

Created by the Neon integration, one per git branch that has a deployment.
Vercel recreates one if it is deleted and the branch is still being pushed to,
but the preview is broken until it does.

| Branch | Id | Git branch |
| --- | --- | --- |
| `preview/simulation` | `br-morning-water-a6f5okdq` | `simulation` |
| `preview/claude/24therapy-rebuild-research-fkjen7` | `br-shiny-sunset-a6zzalsm` | the working branch |

Delete one of these only when its git branch is finished with.

## The snapshot, and it is the only one

| Branch | Id | Taken |
| --- | --- | --- |
| `snapshot-six-month-simulation-2026-09-20` | `br-nameless-dust-a6ae5e4r` | 2026-09-20 20:07 UTC |

🔴 **This is the undo for `seed:demo`, and four places say so:**
`scripts/on-production.ts` (the allow-list entry that permits the only command
able to delete people), `scripts/logins.ts`, `docs/DEMO-LOGINS.md` and
`docs/simulation/12-THE-LOGINS.md`.

`seed:demo` wipes the cast off production. The entry authorising it names this
branch as condition one of three. Deleting it does not merely lose a backup, it
retroactively removes the argument that made that command safe to run.

---

## What was deleted, and why it was the only candidate

`snapshot-before-demo-seed-2026-09-20` (`br-rapid-sea-a6jkrfx2`), taken two
hours after the one above and named by nothing in the codebase. Two snapshots
of the same pre-wipe production, one of which no script could restore from
because no script knew its id.

Deleted on 2026-09-22, on the founder's decision, after the alternatives were
put side by side. The documented one stays.

## Before deleting anything here

1. **Check `.env.local` first.** Three of these six are live connection
   strings and none of their names says so.
2. **Map endpoints, not names.** `list_postgres_endpoints` gives
   `branch_id` per endpoint, which is the only honest way to tell a branch
   something reads from one nothing does.
3. **Grep the repository for the branch id.** A branch a script names is a
   branch a script depends on.
4. **A snapshot delete is permanent.** Neon has no undelete.
