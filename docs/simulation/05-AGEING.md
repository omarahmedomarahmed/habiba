# How three months happens in one hour

**Read this before wave one. Everything else depends on it.**

## The problem, stated exactly

Agents act now. They cannot wait three months, and a database whose rows were all written in
the same hour is not a quarter of trading, it is one busy hour. Every screen that means
anything in this product reads a date: the therapist's earnings this month, the employer's
weekly spend, the patient's session history, the clinic's bill for the period, the seat that
was not billed because they had already paid for the month.

**There is no clock seam in this codebase.** `lib/` alone calls `new Date()` in 354 places.
Introducing one would be a refactor of every module in the product, done to serve a test,
and it would be the largest single change in the repository's history. That is the wrong
trade and it is not what we are doing.

## The answer: act now, then age the rows

Agents act live, through the real product, at real speed. **Between waves, a script moves
the rows that wave created backwards in time.** After three waves the database holds three
months of history that was produced by real interactions with the real product, minute by
minute, and then aged.

```
  wave 1 acts   →  age everything it made by −90 days  →  that is "month 0"
  wave 2 acts   →  age everything it made by −60 days  →  that is "month 1"
  wave 3 acts   →  nothing to age                      →  that is "today", month 3
```

Each wave is aged **only after its capture is taken**, so the screenshots show the product
as it looked to that person on that day.

### 🔴 Three months is a shorter runway, and two things get harder

The six-month version had four waves and −180 days of room. Three months has three waves and
−90. Two consequences worth knowing before you start rather than after:

1. **A monthly bill needs at least two months between it and today** to show a second
   period. Wave 1 is aged to −90 days precisely so that `C1`'s seats and `T2`'s plan each
   have three billing periods behind them by the end. Do not shorten it to −60 for tidiness.
2. **The pot has less time to run dry.** `E1`'s pot is funded in wave 2 and spent in wave 3,
   which is about six weeks of simulated time. Fund it for what six weeks of that cast's
   sessions actually costs rather than for a round number, or it either never empties or
   empties on the first day.

## The one rule that keeps it honest

> **A timestamp in the past is a record of something that happened, and it moves.**
> **A timestamp in the future is a deadline, and it does not.**

That single rule is the whole design, and it is right for every column in this schema
without anybody having to list them:

| Column | At shift time | What happens | Why that is correct |
|---|---|---|---|
| `sessions.created_at` | past | moves back | The session happened two months ago |
| `sessions.ended_at` | past | moves back | So did its ending |
| `session_payments.created_at` | past | moves back | The money moved then |
| `ai_request_logs.created_at` | past | moves back | 🔴 And this one matters: it is the expense side of `/admin/vault`'s month table, and a spend row left at today's date puts three months of model cost into one month |
| `availability_slots.starts_at` for a past hour | past | moves back | It was a Tuesday in March |
| `availability_slots.starts_at` for a future hour | future | **stays** | It is next Tuesday, and it still is |
| `subscriptions.current_period_end` | future | **stays** | The plan still renews on the 14th |
| `sponsor_pots.expires_at` | future | **stays** | The pot expires when the contract says |
| `person_invites.expires_at` | past | moves back | That link died months ago, correctly |
| `history_grants.expires_at` for a live grant | future | **stays** | The patient's 24 hours are still running |
| `therapist_verifications.reviewed_at` | past | moves back | 🔴 The first rejection was in month 0 and the approval in month 1, and `T4`'s story is only legible if those two are months apart |

**Do not write a column allow-list.** A list is a thing somebody forgets to update the day a
migration adds a column, and this schema has 114 tables. The script discovers every
`timestamp with time zone` column from `information_schema` and applies the rule. A column
added next year is aged correctly by a script nobody edited.

**Two columns added this sprint prove the point**: `therapist_verifications.rejection_count`
is an integer and is not a timestamp, so it is untouched and should be. Its companion
`documents_cleared_at` is a past timestamp and moves with the decision it records. Neither
needed anybody to think about it.

## 🔴 `scripts/age.ts` is BUILT, and `npm run verify:age` proves it

It no longer has to be written. It exists, it has its own verifier, and that verifier runs
the gate this document specifies rather than asserting it:

```
npm run verify:age          8 checks, on whichever database DATABASE_URL names
```

Two of those eight are the rule itself, run against a real row: a `person_invites` row with
`created_at` in the past and `expires_at` ten days out, aged by thirty days, and then read
back to confirm the first moved by exactly thirty and the second did not move at all.

### How it is used

```
npm run age -- --marker wave1 --start      BEFORE the wave acts
  … the wave acts, and is captured …
npm run age -- --marker wave1 --days 90    AFTER its capture is taken
```

`--start` writes `.simulation-wave1.json` with the instant the wave began. Only rows created
at or after that instant are moved, which is how wave two's ageing does not shift wave one a
second time. `--dry` shows what would move and writes nothing.

🔴 **The marker file is also the refusal.** Ageing a wave twice would put it half a year back
and nothing in the data would say so, so the second attempt is refused by name, before any
UPDATE runs, and `verify:age` proves the refusal happens first.

## What it does

```
npm run age -- --marker <wave> --days 90
```

1. **Refuse production by name**, and refuse anything that is not the simulation branch.
   Two-sided, like every other write script here.
2. **Discover** every `timestamp with time zone` and `timestamp` column in `public`, from
   `information_schema.columns`. Never a hand-written list.
3. **Shift** each one by the interval, **only where the value is already in the past**, and
   only on rows whose primary creation timestamp is at or after the marker. The marker is
   how a wave's rows are told apart from the previous wave's already-aged ones.
4. **Print what it did**, per table: rows touched, columns touched, and the count of values
   left alone for being in the future. A silent shift is unverifiable.
5. **Refuse to run twice on the same marker.** Ageing the same wave twice puts it half a year
   back and nothing in the data would say so.

### And it must prove itself before it is used

The gate on this script is not that it runs. It is:

- Age a row whose `created_at` is known. Read it back. The difference is exactly the interval.
- Age a table containing one past and one future timestamp **in the same row**. The past one
  moved, the future one did not. This is the rule's own control and without it the script
  could be shifting everything and nobody would know until a subscription renewed in 1824.
- Run `npm run verify:migrations` afterwards. Every CHECK constraint in this schema is
  validated, and several of them are about ordering: `ended_at` after `started_at`, a
  period end after its start. **If the ageing broke one, the database will say so.** That is
  not a bonus, it is the best evidence available that the shift was coherent.
- 🔴 **Open `/admin/vault` after the first shift.** The month table should now show two
  months rather than one, and the older month should carry both its income and its model
  spend. If the spend all sits in the current month, `ai_request_logs` was not aged and the
  expense half of every figure in the report is wrong.

## What this does not fake

Nothing. Every row was produced by the product, through its own code paths, by an agent
pressing the button a person would press. The only thing that is not real is *when*, and
the rule above keeps even that internally consistent.

**Say so in the report.** The simulation's honesty is the reason it is worth anything: a
reader who thinks these sessions happened over three months of wall-clock time has been
misled, and a reader who understands they happened in one hour and were then aged
coherently has been told something true and useful.
