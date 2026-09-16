# Running the simulation on production, and putting it back

The six month run happens on the **production deployment**, the **production Neon branch**,
the **real domain** and the **real keys**. Nothing about it is a rehearsal environment. It
is undone afterwards by restoring a snapshot taken before it started.

| | |
| --- | --- |
| Deployment | `habiba`, production target, `main` |
| Domain | `https://24t.vercel.app`, public, 200 to anybody |
| Neon branch | `main` (`br-curly-dream-a6b0shlz`), endpoint `ep-wild-lake-a6tgm2r6` |
| Snapshot to restore to | `snap-broad-shape-a649n5le`, taken 2026-09-16 after migration 0109 |
| Baseline | `evals/production-baseline.json`, 116 tables, 195 rows |

## Why production, and the correction that matters

A simulation on a preview deployment with a forked database is evidence about a
configuration nobody will ever run. The point of six months of invented trading is to find
out whether **the thing being launched** works, and that is the production deployment, on
its real domain, holding the real keys.

Two facts were offered as making this safe. **One of them was wrong**, and the error is
worth keeping written down because it is the shape of the mistakes this repository keeps
finding.

- ✅ **Production is empty.** 195 rows across 116 tables: one organisation, two users, no
  patients, no payments. Measured.
- ❌ **"Production is not publicly reachable."** This was read off Vercel's SSO setting,
  which protects everything `all_except_custom_domains`, and inferred rather than tested.
  `24t.vercel.app` is attached to the project and answers **200 to anybody**, no sign-in.
  `robots.txt` allows `/radar` and the radar page carries `index, follow` on purpose.

So during a run, nine invented clinicians with `DEMO-` licence numbers sit on a public,
crawlable page. That is the disclosure `scripts/demo.ts` warns about in its own header.

**A setting is not a test.** The fix below was built because the claim was checked.

## 🔴 The public half is real, and that is the point

The run is meant to walk the journeys a real patient walks, which means the links have to
work for somebody with no account and no Vercel login. They do:

    /                      200
    /pricing               200
    /join/<token>          200

That is what makes this worth doing on production, and it is also exactly why the
indexing has to be shut off while it happens.

## The order, and it matters

### 1 · Snapshot

`snap-broad-shape-a649n5le`. Done, and it is the SECOND one: the first was taken before
migration 0109 added `delivery_attempts`, so restoring it would have rolled the schema back
under code that expects the table. A snapshot is only a restore point for the schema it was
taken on.

This is what turns "delete everything afterwards" from a hand-written sweep across 116
tables, in dependency order, past an append-only audit log, into one restore. The sweep is
the version that leaves a row behind, and a row left behind sits on the founder's board
forever.

### 2 · Baseline

    npm run baseline -- record snap-broad-shape-a649n5le

Done: 116 tables, 195 rows. Every table read out of `pg_tables` at run time rather than
from a list somebody maintains, because the row that survives a bad cleanup is always the
one nobody was thinking about.

### 3 · 🔴 `SIMULATION_RUNNING=1` on production

While it is set, `robots.txt` disallows everything and every page in the product carries a
violet strip naming the database it is on.

It does not stop a person who has the URL, and nothing can short of taking the site down,
which the run needs up. What it stops is the permanent half: an index entry outlives both
the run and the restore.

Unset it afterwards. Leaving it on is loud rather than silent, on purpose.

### 4 · `RESEND_API_KEY` off, and what still gets recorded

🔴 **Nothing blocks.** `notify()` logs one line and returns `{ sent: false, reason }`, and
every caller shows the link on screen regardless: an invitation, a claim link and a join
link are all returned to the clinician whether or not a message went out. No flow waits on
delivery, no flow fails on it.

🔴 **And every attempt is now written down**, which it was not until migration 0109. Each
call appends to `delivery_attempts`: the kind, whether a phone and an address existed, which
channels accepted it, and the reason nothing did. Not the body, because every kind is
already constrained to carry no clinical content and this is not the place to start hoarding
message text.

That table is what makes the run's evidence about messaging worth anything. Without it,
"the patient was never told" and "we never tried" look identical afterwards, and with email
deliberately off that is sixty patients' worth of the product going unmeasured.

Already done. `notify()` degrades cleanly without it and logs `no channel available`, so
every flow still runs and the code path is still exercised. With it set, sixty invented
patients send real email to a reserved domain that always bounces, and a few dozen bounces
in an afternoon is a deliverability signal against the domain you launch on.

Put it back afterwards, and note the consequence for the run: **no message reaches anybody
by email.** Every link a patient needs is passed on screen, which the product supports and
which `11-THE-RECORD.md` walk `R9` depends on. WhatsApp templates are mostly unapproved, so
the same applies there.

### 5 · Run it, with real keys

The write scripts refuse the production endpoint by name. The door is deliberately awkward
and has to name the endpoint, so typing it is a sentence rather than a flag:

    I_MEAN_PRODUCTION=ep-wild-lake-a6tgm2r6

Everything else is the real thing. Real OpenAI key, so the model spend is the real model
spend and `/admin/usage/sessions` reports real money. Real Daily key, so the rooms are real
rooms. Real blob token, so uploaded identity documents and transfer receipts are really
stored. That is the whole reason for running here.

### 6 · 🔴 Capture EVERYTHING before restoring

**The restore destroys the evidence along with the mess.** Every frame, every figure off
`/admin/usage/sessions`, the board, the money reconciliation, the copilot exam, the edge
ledger from `09-THE-EDGES.md` and the record ledger from `11-THE-RECORD.md` have to exist
outside the database first. `05-CAPTURE.md` says what and when; this is the one run where
finishing capture late costs the whole thing.

`npm run verify:synthetic` cannot be pointed at production and that is correct, not a gap:
it plants a real-looking person as a control before deleting it, and planting one on
production is the thing none of this is willing to do.

### 7 · Restore

Restore `snap-broad-shape-a649n5le` onto `main`.

### 8 · Prove it went back

    npm run baseline -- check

116 tables, 195 rows, every one exactly where it started, or it names the tables that
differ and exits non-zero. A restore nobody checked is a belief: Neon reports a restore as
done when the branch is ready, which says nothing about the rows in it.

`rate_limits` and `error_events` are reported separately and do not fail it. Production is
publicly reachable, so a crawler bumps the first and any runtime error appends to the
second, both without the simulation having done anything. A check that goes red for a
reason somebody explains away once gets the same shrug the next time, when it is real.

### 9 · Unset the switch, rotate, then the bank details

In that order. `SIMULATION_RUNNING` off, `RESEND_API_KEY` back on, keys rotated, and the
bank details typed into `/admin/settings` **last**, because they are written by hand and
are not in the snapshot, so anything entered before step 7 is wiped by the restore.

## Do we need our own domain?

Not for this. `24t.vercel.app` is public and serves every page a patient touches, so the
run can test the real journeys today.

It is worth having before launch, for reasons this run does not depend on: email
deliverability needs a verified sending domain, and `24t.vercel.app` is not a name to put
on a clinical product. Attaching one later changes `APP_URL` and nothing else.

## What the `simulation` branch is now for

It stays, with its boot guard and its violet strip. It is where the second pass and the
adjusted re-run happen without touching production again. Production is for the run that
has to be about the real thing.
