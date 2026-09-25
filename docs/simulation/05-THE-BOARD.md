# The board: how the agents keep time with each other

One append-only file, `docs/simulation-run/BOARD.md`, that every agent reads before each click
and writes after it. A therapist does not press Start until the patient is on the join page.
The admin does not look for a transfer until the patient has uploaded the receipt. The board is
how each agent knows.

## The two rules

1. **Before every click, read.** `npm run sim:board -- read --for <you> --since <last row you saw>`
   shows every row other agents posted since your last read. If a row is waiting on a step you
   own, do that step next.
2. **After every click, write.** One row, even when nothing visible happened.

```
npm run sim:board -- post <round> <you> <step> <page> "<what you did>" "<what you click next>" [<step you wait on>]
```

`<step>` is always an id from `03-THE-FLOWS.md` (`PA4.2`, `TH6.1`). A row without a step id is
noise nobody can wait on.

## Waiting on someone

```
npm run sim:board -- wait <their step> [seconds]
```

returns as soon as any row reports that step done, and exits 1 on timeout (default 300 s). On a
timeout, post a row with `did` starting `BLOCKED`, and the lead decides. Never click ahead into
a state that is not there yet: the resulting error is the simulation's fault, not the product's.

## The words the `did` column starts with

| Word | Meaning | Who reacts |
|---|---|---|
| (anything else) | The step is done, and what the screen showed | Anyone waiting on that step |
| `WAIT` | I am parked until the step in the last column is done | The owner of that step |
| `BLOCKED` | Timed out, or the page refused me for a reason I do not understand | The lead |
| `BUG` | The product did something wrong. The same text goes in `BUGS.md` | The lead, then the fixer |

## A worked exchange

| # | who | step | page | did | next | waiting on |
|---|---|---|---|---|---|---|
| 41 | T1 | TH7.1 | /sessions | WAIT session is booked, patient not in yet | Start session | PA9.2 |
| 42 | P2 | PA9.2 | /join/… | opened the join link, camera and microphone allowed | Join | |
| 43 | T1 | TH7.2 | /sessions/…/room | pressed Start session, P2 visible | End session after one pass | |
| 44 | P2 | PA9.3 | /join/… | in the room, sees T1 | wait for end | TH7.4 |
| 45 | T1 | TH7.4 | /sessions/…/room | pressed End session at 1 min 20 s | Generate note | |
| 46 | P2 | PA9.4 | /feedback/… | redirected to feedback, rated 5 | Submit | |

## What the lead does with it

- Reads the whole board between rounds and checks every `WAIT` was answered.
- Turns every `BUG` row into a `BUGS.md` entry with the row number.
- Uses the row times to spot a step that took much longer than the others, which is a finding
  about speed even when nothing failed.

The board is committed with the run's report, so the order things happened in is part of the
evidence.
