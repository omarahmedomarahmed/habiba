# Running the simulation on production, and putting it back

The six month run happens on the **production deployment** and the **production Neon
branch**, and is undone afterwards by restoring a snapshot taken before it started.

| | |
| --- | --- |
| Deployment | `habiba`, production target, `main` |
| Neon branch | `main` (`br-curly-dream-a6b0shlz`), endpoint `ep-wild-lake-a6tgm2r6` |
| Snapshot to restore to | `snap-polished-moon-a61n6nbr`, taken 2026-09-16 |
| Baseline | `evals/production-baseline.json`, 115 tables, 194 rows |

## Why production, and why that is defensible here

A simulation on a preview deployment with a forked database is evidence about a
configuration nobody will ever run. The whole point of six months of invented trading is
to find out whether **the thing we are launching** works, and the thing we are launching
is the production deployment talking to the production database.

Two facts make this reasonable rather than reckless, and both were checked rather than
assumed:

- **Production is empty.** One organisation, two users, no patients, no payments, 194
  rows in total across 115 tables. There is no business in there to disturb.
- **It is not publicly reachable.** Vercel Authentication is on for every deployment
  except custom domains, and no custom domain is attached. The seeded clinicians that
  `scripts/demo.ts` warns about being publicly bookable have nobody to be visible to.

Neither fact is permanent. **Re-check both before doing this again**, because the day a
real clinician signs up is the day this stops being a reasonable thing to do.

## The order, and it matters

### 1 · Snapshot first

Already done: `snap-polished-moon-a61n6nbr`. A second run needs its own.

Taking the snapshot is what turns "delete everything afterwards" from a hand-written
sweep across 115 tables, in dependency order, past an append-only audit log, into one
restore. The sweep is the version that leaves a row behind, and a row left behind sits on
the founder's board forever.

### 2 · Record the baseline

Already done: `evals/production-baseline.json`.

    npm run baseline -- record snap-polished-moon-a61n6nbr

Every table, read out of `pg_tables` at run time rather than from a list somebody
maintains, because the row that survives a bad cleanup is always the one nobody was
thinking about: an audit entry, a rate limit counter, a claim attempt.

### 3 · 🔴 Silence outward messages

Unset `RESEND_API_KEY` on production for the duration of the run.

`notify()` degrades cleanly without it and logs `no channel available`, so every flow
still runs and the code path is still exercised. With it set, sixty invented patients get
real email sent to `example.com`, which is reserved and always bounces, and a few dozen
bounces in an afternoon is a deliverability signal against the domain you launch on.

Put it back afterwards.

### 4 · Run it

The write scripts refuse the production endpoint by name. The documented door is the one
the founder authorised, and it is deliberately awkward:

    I_MEAN_PRODUCTION=ep-wild-lake-a6tgm2r6

It has to name the endpoint, so typing it is a sentence rather than a flag.

### 5 · 🔴 Capture EVERYTHING before restoring

**The restore destroys the evidence along with the mess.** Every screenshot, every figure
off `/admin/usage/sessions`, the board, the money reconciliation, the copilot exam result,
the edge ledger and the record ledger have to exist outside the database before step 6.
`05-CAPTURE.md` says what and when; this is the one run where finishing capture late
costs the whole thing.

Note that `npm run verify:synthetic` cannot be pointed at production and that is correct,
not a gap: it plants a real-looking person as a control before deleting it, and planting
one on production is the thing none of this is willing to do.

### 6 · Restore

Restore `snap-polished-moon-a61n6nbr` onto `main`.

### 7 · Prove it went back

    npm run baseline -- check

115 tables, 194 rows, every one exactly where it started, or it names the tables that
differ and exits non-zero. A restore that nobody checked is a belief: Neon reports a
restore as done when the branch is ready, which says nothing about the rows in it.

### 8 · Rotate, then enter the bank details

In that order. The bank details on `/admin/settings` are written by hand and are **not**
in the snapshot, so anything entered before step 6 is wiped by the restore.

## What the `simulation` branch is now for

It stays. `lib/env.ts` still refuses to boot when that branch and the simulation database
disagree, in both directions, and the violet strip still names the endpoint it is on.

It is the place to re-run without touching production: the second pass, the adjusted one
after the first set of results, and anything somebody wants to leave standing for a while.
Production is for the run that has to be about the real thing.
