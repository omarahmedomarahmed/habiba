# What to do, with no terminal

You open a new Claude Code session on the web, paste one message, and answer questions when
they come. Nothing below asks you to run a command, edit a file, or export anything.

## 1 · Top up OpenAI with $10

That is the whole budget for the run. `npm run spend` warns at 70% of it and stops past it,
and the plan comes to about $4.80, so there is headroom rather than a licence to add sessions.

## 2 · Collect five things

| | Where it comes from | What it looks like |
| --- | --- | --- |
| OpenAI key | platform.openai.com | `sk-...` |
| Daily key | dashboard.daily.co | a long string |
| Stripe key | dashboard.stripe.com, **test mode** | `sk_test_...` |
| Blob token | Vercel, the project's storage tab | `vercel_blob_rw_...` |
| Auth secret | any 64 hex characters | `a1b2c3...` |

The two database connection strings are already in the prompt and do not change.

**Stripe must be the TEST key.** The run moves money through every path it can find. A live
key would move real money.

## 3 · Open a new session and paste the prompt

Open `docs/SIMULATION-PROMPT.md`, replace the five placeholders in the KEYS block at the top,
and paste **everything from the `# You are the Chief of Staff` line down** into a fresh
session.

The session writes `.env.local` itself as its first act. You never touch a file.

## 4 · What it will do without asking you

- check production is in the state the prompt claims, and say so plainly if it is not
- build the product and run all twenty-four gates against the **dev** branch
- seed production once: the operator, two support staff, the payroll, four applications
- run six months of invented trading, with real keys, on `https://24t.vercel.app`
- move the clock at the end of each wave
- report back at seven fixed points, each short enough to read on a phone

## 5 · The three things it will interrupt you for

1. The spend passes 70% of $10.
2. An agent is blocked and cannot get past a screen.
3. A defect that would lose somebody money or expose a record.

Everything else goes in the log and waits.

## 6 · When it finishes

**Nothing is deleted.** The six months stay on the production database until you decide
otherwise. You can sign in as every person in the run and read their record:
`docs/simulation/12-THE-LOGINS.md` has all eighteen, with one password for all of them.

Two screens are worth opening first, both at `https://24t.vercel.app/admin`:

- **`/admin/actuals`** is the six months in one table: what was earned and what was spent each
  month, counted out of the ledger, the model spend and the payroll. The payroll sits under it
  and you can edit any salary, which changes that month onwards and leaves earlier months
  exactly as they were.
- **`/admin/financial-model`** is the forecast the plan was built on, in the same columns.

Read them side by side. Do not add them up.

## 7 · The one thing only you can do

**Type the real bank details into `/admin/settings`.** The ones on production now are
placeholders. Everything in the run that involves an Egyptian person sending money reads that
screen, so if the account number is wrong the run will faithfully reproduce sixty people
sending money to the wrong place.

## 8 · Afterwards

**Rotate every key.** They were in a chat transcript.

Rotating a key does not touch the data. The records stay, the logins keep working, and
`SIMULATION_RUNNING=1` stays set so every page keeps saying that everybody on it was invented.
That comes off the day the invented people are deleted, and not before.
