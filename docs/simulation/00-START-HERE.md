# The one-month simulation: start here

**What it is.** An invented cast signs up, pays, meets, writes notes, funds pots, approves,
refunds and pays out on the live site, `https://24therapy.app`, through the real screens, in
seven rounds that stand for one month. Between rounds the rows each round wrote are moved back
in time, so at the end production holds a month of history that the product itself produced.

**What it is for.** To prove, screen by screen and cent by cent, that every flow for every kind
of user works, or to find exactly where it does not, fix it, and run that part again until it
does. Only a clean run opens the redesign.

## The rules

1. **Production, through the door.** The run happens on production. Every command that touches
   the database is `npm run on:production -- <command>`, and its allow-list is the whole list of
   what may run there. `.env.local` stays pointed at dev.
2. **Through the product.** Agents click what a person would click. Nobody writes a row the
   product would write. The only direct writes are the ones this folder names: the empty start,
   the seed of our own staff and the two applications, and the ageing between rounds.
3. **Nobody real is contacted.** Every cast address is `@example.com`, and mail to that domain
   is never sent: it is kept in `sim_outbox` and read with
   `npm run on:production -- sim:inbox -- <address or phone>`. While `SIMULATION_RUNNING=1`,
   WhatsApp is kept there too. The founder's own address is the one real inbox, and only for
   the console sign-in code.
4. **Read the board before every click, write it after.** `05-THE-BOARD.md`.
5. **A bug is written down when it is hit, and fixed between rounds.** `07-THE-RECORD.md`.
6. **No secret in any file.** The repository is public. The run's password is in `_cast.ts`
   because it opens invented accounts only; the founder's is never written anywhere.

## The documents

| File | Read it for |
|---|---|
| `00-LESSONS.md` | What earlier runs hit, once |
| `01-THE-CAST.md` | Who is played, by which agent, signing in where |
| `02-THE-MONTH.md` | The seven rounds: who acts, what is aged, which jobs fire |
| `03-THE-FLOWS.md` | Every flow as numbered steps, per user type |
| `04-THE-EDGES.md` | Every edge case, with the expected result |
| `05-THE-BOARD.md` | How agents keep time with each other |
| `06-THE-AUDIO.md` | The session audio, and why sessions last about a minute |
| `07-THE-RECORD.md` | Bugs, re-runs, and the proof at the end |
| `08-COVERAGE.md` | Every page, job and money path, mapped to the step that tests it |

## Before round one, in this order

| # | Step | Command or place |
|---|---|---|
| 1 | Production is on the latest `main`, migrations applied first | `npm run on:production -- db:migrate`, then push `main` |
| 2 | `SIMULATION_RUNNING=1` on the Vercel production environment, and a deploy after it | Vercel project settings |
| 3 | Snapshot production, so the start can be returned to | Neon snapshot of the production branch |
| 4 | Clear people, keep configuration and the founder's login | `npm run on:production -- seed:demo -- --empty` |
| 5 | Settings present and correct | `npm run on:production -- settings:seed`, then `npm run on:production -- settings:check` |
| 6 | Our own staff, and the practice and employer applications | `npm run on:production -- simulate:seed` |
| 7 | The starting count, to compare the month against | `npm run on:production -- baseline` |
| 8 | Session audio on disk | `npm run sim:speech` |
| 9 | The founder signs in to the console | `/staff/sign-in` with the founder's password, then the six-digit code from the founder's inbox, pasted into the chat |
| 10 | The board is created by the first post | `npm run sim:board -- post R0 LEAD setup / "ready"` |

## After round seven

`07-THE-RECORD.md` lists the proofs. Then remove `SIMULATION_RUNNING` from Vercel and deploy,
so the product sends real messages again.
