# How six months happens in one afternoon

**Read this before wave one. Everything else depends on it.**

## The problem, stated exactly

Agents act now. They cannot wait six months, and a database whose rows were all written in the
same hour is not half a year of trading, it is one busy hour.

Every screen that means anything in this product reads a date: the therapist's earnings this
month, the employer's weekly spend, the patient's session history, the practice's bill for the
period, the seat that was not billed because the month was already paid for.

**There is no clock seam in this codebase.** `lib/` alone calls `new Date()` in hundreds of
places. Introducing one would be a refactor of every module in the product, done to serve a test,
and the largest single change in the repository's history. That is the wrong trade and it is not
what we are doing.

## The answer: act now, then age the rows

Agents act live, through the real product, at real speed. **Between waves, a script moves the
rows that wave created backwards in time.** After six waves the database holds six months of
history that was produced by real interactions with the real product, minute by minute, and then
aged.

| Wave | Ages back by | Lands at |
|---|---|---|
| 1 | **180** days | month 0 |
| 2 | **150** days | month 1 |
| 3 | **90** days | month 3 |
| 4 | **60** days | month 4 |
| 5 | **30** days | month 5 |
| 6 | **not at all** | month 6, which is today |

Each wave is aged **only after its capture is taken**, so the frames show the product as it
looked to that person on that day.

### Two things the six month runway makes possible

1. **A monthly bill needs months behind it to show a second period.** Wave 1 goes back 180 days
   precisely so `C1`'s seats and `T1`'s plan have six billing periods behind them at the end, and
   so wave 1's cohort reaches its **fourth month in wave 4** and is billed at full price. Do not
   shorten it for tidiness: the full price invoice is the point of the whole run.
2. **The pot has to run dry at the right moment.** `E1`'s pot is funded in wave 2 and empties in
   wave 4, which is about three months of simulated time. Fund it for what three months of that
   cast's sessions actually cost rather than for a round number, or it either never empties or
   empties on the first day.

## The one rule that keeps it honest

> **A timestamp in the past is a record of something that happened, and it moves.**
> **A timestamp in the future is a deadline, and it does not.**

That single rule is the whole design, and it is right for every column in this schema without
anybody having to list them:

| Column | At shift time | What happens | Why that is correct |
|---|---|---|---|
| `sessions.created_at` | past | moves back | The session happened two months ago |
| `sessions.ended_at` | past | moves back | So did its ending |
| `session_payments.created_at` | past | moves back | The money moved then |
| `ai_request_logs.created_at` | past | moves back | **And this one matters**: it is the expense side of `/admin/vault`'s month table, and a spend row left at today's date puts six months of model cost into one month |
| `manual_payments.decided_at` | past | moves back | The operator confirmed it in March |
| `availability_slots.starts_at` for a past hour | past | moves back | It was a Tuesday in March |
| `availability_slots.starts_at` for a future hour | future | **stays** | It is next Tuesday, and it still is |
| `subscriptions.current_period_end` | future | **stays** | The plan still renews on the 14th |
| `sponsor_pots.expires_at` | future | **stays** | The pot expires when the contract says |
| `person_invites.expires_at` | past | moves back | That link died months ago, correctly |
| `history_grants.expires_at` for a live grant | future | **stays** | The patient's 24 hours are still running |
| `therapist_verifications.reviewed_at` | past | moves back | The first rejection was in month 0 and the approval in month 1, and `T4`'s story is only legible if those are months apart |

**Do not write a column allow list.** A list is a thing somebody forgets to update the day a
migration adds a column, and this schema has over a hundred tables. The script discovers every
`timestamp with time zone` column from `information_schema` and applies the rule. A column added
next year is aged correctly by a script nobody edited.

Two columns prove the point. `therapist_verifications.rejection_count` is an integer, not a
timestamp, so it is untouched and should be. Its companion `documents_cleared_at` is a past
timestamp and moves with the decision it records. **Neither needed anybody to think about it.**

## The script exists, and its verifier proves it

```
npm run verify:age          8 checks, on whichever database DATABASE_URL names
```

Two of those eight are the rule itself, run against a real row: a `person_invites` row with
`created_at` in the past and `expires_at` ten days out, aged by thirty days, then read back to
confirm the first moved by exactly thirty and the second did not move at all.

### How it is used

```
npm run on:production -- age -- --marker wave1 --start       BEFORE the wave acts
  … the wave acts, and is captured …
npm run on:production -- age -- --marker wave1 --days 180    AFTER its capture is taken
```

`--start` writes `.simulation-wave1.json` with the instant the wave began. Only rows created at
or after that instant are moved, which is how wave two's ageing does not shift wave one a second
time. `--dry` shows what would move and writes nothing.

**The marker file is also the refusal.** Ageing a wave twice would put it a year back and nothing
in the data would say so, so the second attempt is refused by name, **before any UPDATE runs**,
and `verify:age` proves the refusal happens first.

## What it does, in order

1. **Refuse production by name unless it is reached through `npm run on:production`**, which is
   how the run ages its own database. Bare, it operates on whatever `DATABASE_URL` names, which
   is dev, and the six month clock never starts.
2. **Discover** every `timestamp with time zone` and `timestamp` column in `public`, from
   `information_schema.columns`. Never a hand written list.
3. **Shift** each one by the interval, **only where the value is already in the past**, and only
   on rows whose primary creation timestamp is at or after the marker.
4. **Print what it did**, per table: rows touched, columns touched, and the count of values left
   alone for being in the future. A silent shift is unverifiable.
5. **Refuse to run twice on the same marker.**

## The four things to check after every shift

```
npm run on:production -- verify:migrations
```

Every CHECK constraint in this schema is validated, and several are about ordering: `ended_at`
after `started_at`, a period end after its start. **If the ageing broke one, the database says
so.** That is not a bonus, it is the best evidence available that the shift was coherent.

Then, on screen:

1. **`/admin/vault`**, after the first shift. The month table should show two months rather than
   one, and the older month should carry **both** its income and its model spend. If the spend
   all sits in the current month, `ai_request_logs` was not aged and the expense half of every
   figure in the report is wrong.
2. **`/admin/tv`**, which reads a week and a month. After the shift, last week's numbers should
   have emptied out into the month behind them.
3. **The invoice list**, which is how you know wave 1's cohort has actually reached month 4.

## What this does not fake

Nothing. Every row was produced by the product, through its own code paths, by an agent pressing
the button a person would press. The only thing that is not real is *when*, and the rule above
keeps even that internally consistent.

**Say so in the report.** The run's honesty is the reason it is worth anything: a reader who
thinks these sessions happened over six months of wall clock time has been misled, and a reader
who understands they happened in one afternoon and were then aged coherently has been told
something true and useful.
