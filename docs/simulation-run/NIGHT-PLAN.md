# The night plan (2026-09-25 into 26)

Written so a compacted or restarted session can pick up exactly where this one is. The
founder's instruction: work without stopping, rule on everything, record every ruling in
`RULINGS.md`, full gates at most three more times, the redesign live with no bugs by morning.

## Standing orders

`CLAUDE.md` at the repository root holds the founder's standing orders for every session: keep going
without asking until every stage below is done, rule and record, merge dead agents' work, three
full gate runs at most after G0. A `send_later` check-in wakes the session every 45 minutes.

## Standing orders

`CLAUDE.md` at the repository root holds the founder's standing orders for every session: keep going
without asking until every stage below is done, rule and record, merge dead agents' work, three
full gate runs at most after G0.

## Gate budget

| Run | When | Status |
|---|---|---|
| G0 | Round 1 fixes, before any of this | running at the time of writing |
| G1 | After round 2 (with round 3 folded in) and its fixes, before main | not run |
| G2 | After the redesign, before main | not run |
| G3 | After the post-redesign walkthrough fixes, before main | not run |

Between gates: `npx tsc --noEmit -p .`, the unit suites and the verifiers each change touches. Never a
fourth full gate.

## Stages

| # | Stage | Status |
|---|---|---|
| S0 | G0 passes; production migrations 0174, 0176, 0178 first; push main; confirm live; Arabic CMS rows that claim clinicians are online fixed through `/admin/content` | in progress |
| S1 | Redesign wave 1 in worktrees, started in parallel: website, patient app, therapist portal, to the `/design` mockups, with the radar globe from the current radar | not started |
| S2 | Round 2 with round 3 folded in, on the live site: every round 1 bug re-walked, then the round 2 and 3 flows, sessions played by one agent per pair, patient audio through the transcribe upload as the patient track | not started |
| S3 | Fix every round 2 bug; G1; migrations; push main; confirm live | not started |
| S4 | Redesign wave 2 (clinic, company, partner); merge waves 1 and 2; G2; push main; confirm live | not started |
| S5 | Walkthrough of rounds 1 and 2 compacted on the new design; fix; G3; push main; confirm live | not started |
| S6 | Report to the founder: rulings table, what needs the founder, what is live | not started |

## Recovery notes

- Agents run in worktrees under `.claude/worktrees/`. A worktree that still exists after its agent
  died holds its work: merge its branch (`worktree-agent-<id>`) before removing it.
- The founder's console login is saved in `.sim-state/FOUNDER.json` for 12 hours from 18:39 UTC.
- The clock file is `.simulation-clock.json`; the board is `docs/simulation-run/BOARD.md`.
