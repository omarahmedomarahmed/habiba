# What the run writes down, and how "no bugs" is proved

Everything the run produces goes in `docs/simulation-run/`. The board, the bugs, the rounds and
the report are committed at the end of each round. The screenshots are not: the founder plays
the console under their own name and the repository is public, so `shots/` is ignored by git
and stays on the machine that ran the round.

| File | Written by | When |
|---|---|---|
| `BOARD.md` | Every agent, through `npm run sim:board` | After every click (`05-THE-BOARD.md`) |
| `BUGS.md` | Whoever hits it, then the lead | The moment it is hit |
| `shots/<round>/<who>-<step>.png` | Every agent | After every step that changes a screen |
| `ROUNDS.md` | The lead | At the end of each round: what ran, what was aged, which crons fired, what they did |
| `REPORT.md` | The lead | At the end of the month |

## A bug entry

```
### B7 · P2 cannot see the paid transfer after it was confirmed
round R3 · step PA12.4 · board row 212 · shot shots/R3/P2-PA12.4.png
expected: /patient/billing lists the session as paid, 1,200 EGP, confirmed
saw:      still "waiting for us to check the transfer" after SU1 confirmed it (board row 209)
where:    lib/billing/manual.ts confirmPayment, or the page reads a stale column
severity: money | privacy | stuck | wrong | cosmetic
status:   open | fixed in <commit> | re-run clean in <round>
```

Severity decides the order of fixing: money and privacy first, then anything that leaves a
person stuck, then wrong text or numbers, then looks.

## Fixing and re-running

A bug is not closed when the code changes. It is closed when the step that found it has been
run again on the live site, after a deploy, and passed. So:

1. The run finishes the round it is in. Nothing is fixed mid-round, so one round's evidence is
   about one version of the product.
2. The fixes go out together, through the normal path: checks, the full gates once, production
   migrations first if any, then `main`.
3. The flows that failed are run again, from their first step, in a re-run round (`R3b`), with
   the same cast. The board and the shots of the re-run sit beside the original.
4. Only when a re-run is clean does the bug's status become `re-run clean`.

## The proof at the end of the month

The run is clean when every line below is true, and `REPORT.md` shows the output of each.

| Proof | Command or screen | Clean means |
|---|---|---|
| Every flow ran | `08-COVERAGE.md` against `BOARD.md` | Every step id in `03-THE-FLOWS.md` has a done row |
| Every edge case ran | `04-THE-EDGES.md` against `BOARD.md` | Every edge id has a done row with the expected result |
| Every login works | `npm run on:production -- verify:cast -- --complete` | Every cast member exists and opens with the run's password |
| The schema held | `npm run on:production -- verify:migrations` | Every CHECK constraint still valid after ageing |
| The money balances | `npm run on:production -- verify:board` and `/admin/vault` | Every ledger transaction balances, the vault month table shows the month |
| The messages went to the right people | `npm run on:production -- sim:inbox -- <address>` for each cast member | Each kind in `03-THE-FLOWS.md` arrived once, in the person's language |
| Nothing leaked | The privacy edges in `04-THE-EDGES.md` | No company screen ever showed a patient name, time or attendance |
| What it cost | `npm run on:production -- spend` | Product AI spend for the month, beside the synthesis cost |
| No open bug | `BUGS.md` | Every entry reads `re-run clean` |

If any line is false, the run is not clean, whatever else went well.
