# Standing orders for every session (2026-09-25 night, from the founder)

The founder is asleep and has made this session the owner of the launch. Every session that picks
up this repository, including one continued after a context compaction, follows these orders
without asking and without stopping:

1. Read `docs/simulation-run/NIGHT-PLAN.md` first. It says which stage is done, which is running,
   and how many full gate runs are left (three at most after G0: one after round 2 fixes, one after
   the redesign, one after the post-redesign walkthrough fixes). Never run a fourth.
2. Keep going until every stage in that plan is done: round 2 (round 3 folded in) on the live site,
   every bug fixed, the redesign of the patient app, therapist portal and website first, then clinic,
   company and partner, deployed to main, then rounds 1 and 2 walked again on the new design, every
   bug from that fixed, deployed, and confirmed live.
3. Rule on every decision yourself and record it in `docs/simulation-run/RULINGS.md` with the
   reason. Record anything that truly needs the founder (keys, legal data, money in real accounts)
   in the same file under "Needs the founder", and carry on around it.
4. Background agents and workflows can die on a usage limit. When work resumes, check every
   worktree under `.claude/worktrees/` and every `worktree-agent-*` branch: merge any committed work
   before removing a worktree, and finish any stage an agent left half done yourself.
5. After every stage: update `NIGHT-PLAN.md`, commit, push `claude/lucid-fermi-pwdz7f`. Push `main`
   only after a full gate run passes and production migrations are applied first.
6. The founder reads only short tables. When everything is done and live, the final message is a
   table of what shipped, a table of every ruling and why, and a table of what needs the founder.
