# How changes reach production (from 2026-10-01)

The night run's standing orders are retired. This repository is built with AI coding agents under the
founder's direction, and every change now reaches production through a pull request.

1. Work on a branch, never directly on `main`. Open a pull request into `main` that says what changed,
   why, how it was tested, and anything that needs the founder.
2. GitHub Actions runs `npm run ci` on every pull request (typecheck, every unit suite that needs no
   database, the prose ratchet and every static verifier) and `npm run ci:db` (the database suites
   on a throwaway Postgres). A red CI blocks the merge.
3. Before merging, the change is reviewed (an AI code review of the diff, recorded on the pull
   request as an AI review, never presented as a human one). Findings are fixed or answered first.
4. Before a merge that will deploy, run the full local gates (`npm run gates`, with the secrets file),
   apply production migrations first with `npm run on:production -- db:migrate`, then store new
   settings with `npm run on:production -- settings:seed`.
5. Merge with a merge commit. Only `main` deploys (see `vercel.json`); nothing pushes to `main` by
   any other route.
6. Product, clinical, legal and money decisions are proposed in the pull request and recorded in
   `docs/DECISIONS.md`; clinical wording and safety thresholds need review by a qualified
   clinician before real patients use them. Anything that needs the founder (keys, legal data, real
   money, regulators) goes under "Needs the founder" in the same file.
7. Never touch production except through `npm run on:production -- <command>` and its allow-list.
   No secret is ever committed: the repository is public.
8. The founder reads short tables. Report what shipped, what was decided and what needs them.

## Where to read next

| For | Read |
| --- | --- |
| What the product is and how to run it | `README.md` |
| How the code fits together | `docs/ARCHITECTURE.md` |
| Environments, migrations, the allow-list, known hazards | `docs/OPERATIONS.md` |
| Which check to run, and the traps in checks | `docs/TESTING.md` |
| What each user can do today | `docs/PRODUCT.md` |
| Security controls and open gaps | `docs/SECURITY-AND-PRIVACY.md` |
| Demo casts and logins | `docs/DEMO.md` |

House rules: no em or en dashes anywhere a person reads (`verify:sprint24`); invented people use
`example.com`; never `source .env.local` (scripts load it themselves).
