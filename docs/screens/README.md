# Screens

Every screen in the product, captured by `npm run screens`. PLAN.md 18.10–18.12.

## Regenerate, never edit

```
npm run demo:seed        # synthetic clinicians, invented people
npm run dev              # or point SCREENS_URL at a deployment
npm run screens          # public + therapist + patient
npm run screens -- --admin   # …and admin, which is NOT committed
```

The sweep **refuses to run** against a database holding patients or notes
outside a demo organisation (18.11). A screenshot in a repository is permanent
in a way a database row is not: the purge in sprint 22 empties tables, and it
will never reach a PNG in git history.

`admin/` is gitignored (18.12). An admin console shows many patients at once
and is a map of the whole system.

## Why pictures at all

They are for the repository — a reviewer, a new engineer, a founder writing a
deck. The **public site does not use them**: it renders the real components
against synthetic fixtures, because a screenshot is a promise that expires
silently and a live component cannot go stale (C80, 18.8).
