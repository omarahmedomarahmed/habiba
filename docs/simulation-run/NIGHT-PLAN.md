# The night plan (2026-09-25 into 26)

Written so a compacted or restarted session can pick up exactly where this one is. The
founder's instruction: work without stopping, rule on everything, record every ruling in
`RULINGS.md`, full gates at most three more times, the redesign live with no bugs by morning.

## Standing orders

`CLAUDE.md` at the repository root holds the founder's standing orders for every session: keep going
without asking until every stage below is done, rule and record, merge dead agents' work, three
full gate runs at most after G0. A `send_later` check-in wakes the session every 45 minutes.

## Gate budget

| Run | When | Status |
|---|---|---|
| G0 | Round 1 fixes, before any of this | ran: 34 of 39 passed; the 5 failed groups fixed and re-run alone (N4) |
| G1 | After round 2 (with round 3 folded in) and its fixes, before main | not run |
| G2 | After the redesign, before main | not run |
| G3 | After the post-redesign walkthrough fixes, before main | not run |

Between gates: `npx tsc --noEmit -p .`, the unit suites and the verifiers each change touches. Never a
fourth full gate.

## Stages

| # | Stage | Status |
|---|---|---|
| S0 | G0, production migrations, main at ac275b63, confirmed live | done (start-clock settings stay on code defaults, N5/N8) |
| S1 | Redesign wave 1 in worktrees, started in parallel: website, patient app, therapist portal, to the `/design` mockups, with the radar globe from the current radar | done, merged into local branch `redesign-integration` (worktree `.claude/worktrees/redesign-integration`) |
| S2 | Round 2 with round 3 folded in, on the live site at day 7 (jobs fired before and after the move, verify:migrations passed) | workflow running (run wf_90d1ff11-9c1, script scratchpad/sim/round2.js) |
| S3 | Fix every round 2 bug; G1; migrations; push main; confirm live | not started |
| S4 | Redesign wave 2 (clinic, company, partner); merge waves 1 and 2; G2; push main; confirm live | partner merged into `redesign-integration`; clinic and company agents running |
| S5 | Walkthrough of rounds 1 and 2 compacted on the new design; fix; G3; push main; confirm live | not started |
| S6 | Report to the founder: rulings table, what needs the founder, what is live | not started |

## Recovery notes

- Agents run in worktrees under `.claude/worktrees/`. A worktree that still exists after its agent
  died holds its work: merge its branch (`worktree-agent-<id>`) before removing it.
- The founder's console login is saved in `.sim-state/FOUNDER.json` for 12 hours from 18:39 UTC.
- The clock file is `.simulation-clock.json`; the board is `docs/simulation-run/BOARD.md`.
