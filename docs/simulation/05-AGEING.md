# How six months happens in one hour

**Read this before wave one. Everything else depends on it.**

## The problem, stated exactly

Agents act now. They cannot wait six months, and a database whose rows were all written in
the same hour is not six months of trading, it is one busy hour. Every screen that means
anything in this product reads a date: the therapist's earnings this month, the employer's
weekly spend, the patient's session history, the clinic's bill for the period, the seat that
was not billed because they had already paid for the month.

**There is no clock seam in this codebase.** `lib/` alone calls `new Date()` in 354 places.
Introducing one would be a refactor of every module in the product, done to serve a test,
and it would be the largest single change in the repository's history. That is the wrong
trade and it is not what we are doing.

## The answer: act now, then age the rows

Agents act live, through the real product, at real speed. **Between waves, a script moves
the rows that wave created backwards in time.** After four waves the database holds six
months of history that was produced by real interactions with the real product, minute by
minute, and then aged.

```
  wave 1 acts   →  age everything it made by −180 days  →  that is "month 0"
  wave 2 acts   →  age everything it made by −150 days  →  that is "month 1"
  wave 3 acts   →  age everything it made by  −90 days  →  that is "month 3"
  wave 4 acts   →  nothing to age                       →  that is "today", month 6
```

Each wave is aged **only after its capture is taken**, so the screenshots show the product
as it looked to that person on that day.

## The one rule that keeps it honest

> **A timestamp in the past is a record of something that happened, and it moves.**
> **A timestamp in the future is a deadline, and it does not.**

That single rule is the whole design, and it is right for every column in this schema
without anybody having to list them:

| Column | At shift time | What happens | Why that is correct |
|---|---|---|---|
| `sessions.created_at` | past | moves back | The session happened five months ago |
| `sessions.ended_at` | past | moves back | So did its ending |
| `session_payments.created_at` | past | moves back | The money moved then |
| `availability_slots.starts_at` for a past hour | past | moves back | It was a Tuesday in March |
| `availability_slots.starts_at` for a future hour | future | **stays** | It is next Tuesday, and it still is |
| `subscriptions.current_period_end` | future | **stays** | The plan still renews on the 14th |
| `sponsor_pots.expires_at` | future | **stays** | The pot expires when the contract says |
| `person_invites.expires_at` | past | moves back | That link died months ago, correctly |
| `history_grants.expires_at` for a live grant | future | **stays** | The patient's 24 hours are still running |

**Do not write a column allow-list.** A list is a thing somebody forgets to update the day a
migration adds a column, and this schema has 114 tables. The script discovers every
`timestamp with time zone` column from `information_schema` and applies the rule. A column
added next year is aged correctly by a script nobody edited.

## What `scripts/age.ts` must do

```
npm run age -- --since <marker> --days 180
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
5. **Refuse to run twice on the same marker.** Ageing the same wave twice puts it a year
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

## What this does not fake

Nothing. Every row was produced by the product, through its own code paths, by an agent
pressing the button a person would press. The only thing that is not real is *when*, and
the rule above keeps even that internally consistent.

**Say so in the report.** The simulation's honesty is the reason it is worth anything: a
reader who thinks these sessions happened over six months of wall-clock time has been
misled, and a reader who understands they happened in one hour and were then aged
coherently has been told something true and useful.
