# Taking over 24Therapy

**You are replacing the session that wrote this. Read section 1, then sections 2 and 3,
then stop reading documents and start reading code.**

---

## 1 · Do not trust this document about the code

The session that wrote this was compacted several times. A large part of what it "knew"
arrived as a summary of earlier sessions rather than as something it read. It read perhaps a
few dozen files carefully, and those were mostly the files it happened to be changing.

**It did not read this repository. Neither has anybody else.**

So this document is split by what kind of claim each thing is, because they are not equally
trustworthy:

| Section | What it holds | Trust |
|---|---|---|
| 3 | Things that destroy production | **Hard rules.** Obey before verifying |
| 4 | External state: Neon, Vercel, DNS | **Only source.** Not derivable from the repo |
| 5 | The business: money, prices, plan | **Only source**, and still check it with the founder |
| 6 | The gate economy | Measured, and cheap to re-measure |
| 7 | How to read the repository | Method, not fact |
| 8 | Claims about the code | **Zero trust. Every line is a hypothesis to test** |

Anything in section 8, and anything you find in any `.md` file in this repository including
this one, is **a claim somebody made at some point**. Some were true when written and are not
now. Some were never true. The comments in the source are the same: this codebase documents
its own defects in prose, at length, and **a comment describing a fix is not evidence the fix
is still there**.

### The pattern that should govern how you work

Every single thing in this product was built, found to have a hole, patched, and the patch
opened another hole that was found later. That is not pessimism, it is the observed history.
Three examples from the last two days alone, each of which passed every gate:

1. The video room's Content Security Policy was written by reading the installed
   `@daily-co/daily-js` package. The package is a loader; the thing that runs is a 1.8MB
   bundle downloaded at join time, naming a host the package never mentions. An enforcing
   policy would have broken every call in production.
2. A fix for "the patient's app shows nothing after an invitation" was written, gated,
   deployed, and **did not work**, because the database CHECK still refused the four new
   values. The insert threw, a `try/catch` logged it at warn, the email sent, and the gate
   passed on every run because it reads source and a TypeScript union is not a constraint.
3. The gate written to prevent the document in section 7 from going stale **could not fail**,
   because importing the generator ran it and regenerated the file before the comparison.

In all three, the code was locally correct and the gate was locally correct. **Reading two or
three files about one subject and concluding you understand it is how all three happened.**

### So your first task, and it is the whole job until it is done

**The goal, in the founder's words: know this platform, and be aware of every single line of
code.** Not a sample, not the files that look important. `app`, `lib`, `components`,
`scripts`, `tests`, `drizzle`, `evals`, directory by directory. That is **1,106 files and
about 280,000 lines**, and the comments are a large fraction of it because this codebase
argues with itself in prose.

🔴 **And here is the arithmetic nobody should pretend away.** 280,000 lines is roughly three
to four million tokens. **No context window holds that**, including yours. A session that
simply reads from `app/` to `tests/` will have forgotten the first third by the time it
reaches the last, and will not know it has, which is worse than not having read it.

So "aware of every line" is achieved by **reading plus leaving a trail that survives you**:

1. Take one directory at a time, in the order in section 7.
2. When a directory is finished, write what you learned into a working map before opening the
   next one: what each file is for, what it assumes, what it decides, and the two lists
   (**stale** and **suspect**). One line per file is enough for most; the money, auth and
   session paths deserve more.
3. **The map is the deliverable of the reading phase.** It is what you re-read after a
   compaction, and it is what makes the second pass cheap. Keep it outside `docs/` while it
   is working notes.
4. Anything you write into that map is a claim you made, subject to the same rule as
   everything else here: it becomes a fact when you have clicked it.

A session that does this can genuinely say it has seen every line and can find its way back to
any of them. A session that reads straight through cannot, and will not know the difference.

| Directory | Files | Lines | What it is |
|---|---|---|---|
| `lib` | 244 | 92,074 | Everything that is not a screen. Money, auth, AI, data access, notify |
| `scripts` | 180 | 69,724 | 35 gates, ~76 more verifiers, seeds, the simulation harness |
| `components` | 224 | 54,334 | React, including the marketing blocks and every portal |
| `app` | 271 | 37,099 | Next.js App Router. Eight route groups, one per principal |
| `tests` | 37 | 9,673 | Unit suites, run as one gate |
| `drizzle` | 116 | 9,014 | 116 migrations. The schema's real history |
| `evals` | 13 | 3,954 | Model evaluation and the cost benchmark |

As you read, keep two lists. **Stale**: a comment or a check describing something that is no
longer true, an exemption covering nothing, a baseline nobody has lowered. **Suspect**: a
claim made in a comment that you have not tested and that would matter if false.

**Do not put either list in a document and call it done.** Test the suspects by signing in as
the demo cast and clicking. Section 7 has the accounts and five seeded positions to click
through.

---

## 2 · What this product is

An AI clinical-documentation and on-demand-therapy platform, launching in Egypt at
`24therapy.app`. Five kinds of user, six sign-in doors, six different cookies, and they are
genuinely separate principals: a therapist's session cannot become a patient's.

| Who | Signs in at | Gets |
|---|---|---|
| Patient | `/patient/login` | An app: sessions, their record, journal, homework, a crisis button |
| Therapist | `/login` | A caseload, a video room, an AI note written from the transcript, a copilot |
| Clinic manager | `/clinic/sign-in` | Seats, one bill for the practice, earnings per clinician |
| Company | `/sponsor/sign-in` | A funded pot that pays a share of staff sessions, and no clinical data at all |
| Us | `/staff/sign-in` | Verification queue, transfer queue, payouts, the board, the ledger |

Plus a partner portal (`/partner/sign-in`) for EHR integration, which is the least finished.

The three things that make this product unusual, and each is load-bearing:

1. **There is no card processor in Egypt.** Every payment is a bank transfer a human checks.
   The row in `manual_payments` is the only record that anybody verified anything. No webhook,
   no chargeback, no automatic anything.
2. **The employer must never learn who is in therapy.** The company portal has no query that
   could return a patient name, a session time or an attendance list. The published pot
   balance only updates once five sessions have passed, so an employer cannot difference it.
3. **The patient owns the record, not the clinician.** Summaries are append-only, versioned,
   and follow the person between practices. Consent to read is granted per clinician and
   revocable.

---

## 3 · Things that will destroy production

Read all of these before running anything.

### The repository is PUBLIC

`github.com/omarahmedomarahmed/habiba`. No real secret in any committed file, ever.
`.env.local` is gitignored and is where keys live.

### `npm run seed:demo` DELETES PEOPLE

It wipes roughly a hundred person-shaped tables and reseeds a demo cast. It is the only
command on the production allow-list that deletes people. The Neon snapshot
`br-nameless-dust-a6ae5e4r` is the only undo, and four files name it as such.

### Nothing reaches production except through one door

`.env.local` holds `DATABASE_URL` pointed at **dev**. Production lives in
`DATABASE_URL_PRODUCTION`, and only `scripts/on-production.ts` ever promotes it, for one child
process, for one command on its allow-list.

```
npm run on:production -- <command>
```

**Never point `.env.local` at production.** Sixty scripts call `writesTo()`, most plant a
fixture and delete it in a `finally`, and a `finally` that does not run leaves a fabricated
organisation on the founders' database looking exactly like a real one.

### The dev database is called `sprint-1-settings`

It is the busiest branch in the project and the name is historical. Anybody tidying Neon by
name would delete it and every gate in the repository would go red against nothing at all.

### A migration goes to production BEFORE `main` is pushed

```
npm run on:production -- db:migrate     # first
git push origin HEAD:main               # then
```

Reversed, the new code meets the old schema and the failure is whatever that code does when a
column is missing. That rule is written in the allow-list entry itself.

### The deploy flow

Work is committed on local `main`, then pushed to the working branch, then to remote `main` to
deploy:

```
git push -u origin HEAD:claude/24therapy-rebuild-research-fkjen7    # the working branch
git push origin HEAD:main                                          # the deploy
```

Vercel deploys `main`. **Deploy only when the gates are green and the founder has said to.**

### House rules, from the founder, not negotiable

- **Never an em dash or an en dash.** `verify:sprint24` enforces it, and it scans string
  literals as well as comments, because a console line an operator reads is copy too.
- Short tables, plain words, no filler.
- Bank details stay placeholders. The founder's words: it is simulation, real data is not
  needed for simulated people. Task 52 puts real ones in the week before launch.
- Every invented person is at `example.com`. Five real inboxes are named in
  `scripts/_demo-cast.ts` and everything else must be reserved-domain.
- No model identifier in a commit message, a PR, a code comment, or anything pushed.

---

## 4 · External state, which is not in the repository

**This section is the reason this document exists.** None of it can be derived from the code,
and getting it wrong is expensive.

### Neon, project `gentle-waterfall-66476219` (`24therapy-v2`)

Six branches, every one load-bearing. Measured 2026-09-22.

| Branch | Id | Role | Compute used |
|---|---|---|---|
| `main` | `br-curly-dream-a6b0shlz` | **Production.** The domain reads this | 114,152s |
| `sprint-1-settings` | `br-round-star-a6vlxe55` | **Dev.** Every gate runs here | 70,676s |
| `simulation-q1` | `br-fragrant-bonus-a6ngfs07` | The third environment | 23,012s |
| `preview/simulation` | `br-morning-water-a6f5okdq` | Vercel preview, git branch `simulation` | 889s |
| `preview/claude/…-fkjen7` | `br-shiny-sunset-a6zzalsm` | Vercel preview, the working branch | 1,334s |
| `snapshot-six-month-…-2026-09-20` | `br-nameless-dust-a6ae5e4r` | **The only undo for `seed:demo`** | 0s |

Things worth knowing that cost a session to learn:

- `suspend_timeout_seconds` has a **floor of 300s on this plan**. You cannot go lower.
- `active_time_seconds` runs about 4x `compute_time_seconds` at 0.25 CU.
- Compute was bleeding for days. The cause was `CACHE_SECONDS` in `lib/content/service.ts`
  being **300, exactly equal to the suspend timeout**, so the cache expired precisely as the
  compute went to sleep and woke it again forever. It is now 1800 and `verify:sprint21r`
  refuses the value 300.
- Only 6 of 35 gates touch a database. One (`settings:compare`) touches all three. **No gate
  rewrite is needed**; that was investigated and ruled out.
- A snapshot delete is permanent. Neon has no undelete.

### Vercel, project `habiba` (`prj_gl3PhgBsoR3J7L5H2ddHwWgzp2CR`)

Team `team_RZRihzvgqAscDaNXv7bh6oE7`. Production environment variables that change behaviour:

| Variable | Value | What it does |
|---|---|---|
| `DATABASE_URL` | production branch | |
| `RESEND_API_KEY`, `EMAIL_FROM` | set | Email |
| `DAILY_API_KEY` | set | Video |
| `OPENAI_API_KEY` | set | The model |
| `BLOB_*` | set | Receipts and uploads, store `store_qT6jXjmeT2xllpNo` |
| `STRIPE_*` | set | Present but Egypt runs on the transfer rail |
| `CRON_SECRET` | set | Six cron jobs |

### 🔴 TWO LAUNCH BLOCKERS THAT WERE LIVE, AND WERE CLOSED ON 2026-09-22

Both were found by reading the Vercel configuration against the running site, not from any
file, which is why this section exists. **Both are now fixed**, and the history matters
because the second one nearly took the radar with it.

**1. `24therapy.app` served `Disallow: /` to every crawler.** `app/robots.ts` does that
whenever `SIMULATION_RUNNING` is set, deliberately, so a simulation on production could not be
indexed. The variable was still set long after there was any simulation. It is now removed and
`robots.txt` allows crawling.

**2. The Content Security Policy was report-only.** `CSP_ENFORCE=0` on production. The policy
was correct and complete and was watching rather than blocking. The variable is gone and the
policy enforces.

🔴 **AND THEY WERE COUPLED, WHICH IS THE PART THAT WOULD HAVE HURT.** `SIMULATION_RUNNING`
also made `lib/data/discover.ts` skip a `demo = false` filter, so **the demo cast's clinicians
were listed in the patient's directory only because that variable was set.** Removing it to
get indexed would have emptied the directory in the same moment, with nothing anywhere saying
why, and it would have read as a regression in a completely different part of the product.

That was repaired before the variable came off, and the repair is worth knowing about because
it changed a rule:

> **`therapist_radar.demo` is a LABEL and never a decision.** It used to grant a heartbeat
> exemption in three separate expressions, so a seeded clinician was permanently "available
> now" on a radar whose whole promise is somebody who is free this minute. Presence is now
> measured for every row. A demo clinician who is signed in and on shift is online; signed
> out, they are offline. They stay listed in the patient's directory either way, because
> being asleep is not the same as not existing.

`verify:radar-place` holds that rule with a control. If you find `demo` inside an `and()`, an
`or()`, an `eq()` or a `!row.demo`, something has regressed.

`SIMULATION_RUNNING` also widened every rate limit except `global:`. That is gone too, so
production now runs the real limits. `verify:limits` asserts the production default is
untouched and that the global ceiling is never widened even when the flag is set.

### Domain and email

`24therapy.app`, email through Resend.

- SPF is on the **subdomain** `send.24therapy.app`, not the root:
  `v=spf1 include:amazonses.com ~all`. A previous session checked the root, found nothing, and
  told the founder to add something that was already there. Check the subdomain.
- DKIM is published.
- DMARC is `v=DMARC1; p=none; rua=mailto:omarabdelgawad001@gmail.com; sp=none; adkim=r; aspf=r`.
- **Nothing expires.** `scripts/verify-email-dns.ts` carries
  `MONITORING_UNTIL = 2026-10-06`, which is **a reminder in our own test suite**, not a
  deadline anybody set. A previous session alarmed the founder by implying otherwise. The plan
  is: read the `rua` reports until roughly that date, then move to `p=quarantine`.

---

## 5 · The business

Read `docs/FINANCIAL-PLAN.md` for the whole argument; every number there is labelled
**MEASURED**, **DECIDED** or **GUESS**, and the split is currently 2 measured, 20 decided, 12
guessed. Only two numbers in the entire model are measured, and both are terms of the AI cost.

### The raise and the runway

**$20,000**, Egypt, six months. Burn starts at **$6,647/month** and turns positive in month 5.
Month-6 run rate **$9,474**, which is **$113,688 of ARR**. That is the scenario to show an
angel: what their money buys, not what the founders already spent.

### What things cost

| | EGP | USD |
|---|---|---|
| Patient pays the therapist | 1,000 | **$20** |
| Our cut, paid sessions only | 150 | **$3.00** (15%) |
| The room, on **every** session | 50 | **$1.00** |
| The note, where consent was given | 150 | **$3.00** |
| Solo therapist, unlimited | 4,000/mo | **$80/mo** |
| Clinic seat, minimum two | 3,600/mo | **$72/seat** |
| Company or university | 0 | **$0**, they fund a pot |

Break-even between metered and unlimited is **exactly 20 sessions**, and that is why the price
is $80 rather than $100. At $100 the break-even was 25 sessions while this same plan forecasts
a typical therapist doing 20, which meant selling a subscription to people for whom it was the
worse deal.

### The offer

| Month of *their* life | They pay |
|---|---|
| 1 | Free |
| 2 and 3 | 50% |
| 4 onward | Full price |

Anyone joining after month 3 gets one free month and then full price. **Read off each
customer's own age, not the calendar**, which is why the model is cohort-based. Nothing
happens after that: no grandfathering, no second offer.

**A company or university gets $100 of welcome credit in its pot.** That is real cash leaving,
not a discount; our fee comes back, so the true cost is about **$85 per company**. It was $200
and was halved deliberately: the number that matters is how many companies try us, not how
long the first one lasts.

### Payroll

| | $/month |
|---|---|
| Founder, product and engineering | 500 |
| Founder, clinical and operations | 500 |
| Sales, companies and universities | 500 |
| Sales, clinics and therapists | 500 |
| Marketing | 500 |
| Support, the transfer queue ×2 | 1,000 |
| **Total** | **$3,500** |

Plus **$1,000/month** marketing, $120 hosting, $150 tools, and one-offs: $600 of video
production and $1,200 company formation.

The assumption the whole plan turns on: **one founder sells full time from month one.** It
costs nothing because they already draw their $500, and it buys 50% more selling capacity. It
is also the assumption most likely to be wrong, because a founder selling is a founder not
building and the model has no line for what stops being built.

**Two support staff are forced by the payment rail, not chosen.** Every payment is a bank
transfer somebody checks while a person waits on a spinner to join a therapy session.

### Two claims the product is forbidden from making

`lib/content/honesty.ts` refuses both at `savePage`, and `verify:sprint28` scans the published
rows as well, because the code being right has never been the same as the database serving the
right thing.

1. **That paid sessions cover our fee.** Fifteen per cent of a $20 session is $3 against a $4
   fee. It is arithmetically false and it writes itself into a pricing page because it sounds
   like the deal. What is true is **netting**: what you owe comes out of what you earn.
2. **Any forecast of what a clinician will earn.** "Get booked" is fine. "Earn up to", "pays
   for itself", "fill your calendar" are predictions about somebody else's business.

---

## 6 · The gate economy, and please stop running all of them

**`npm run gates` takes 25 minutes.** The session before you ran it far too often and wasted
hours. It runs 35 gates, one of which runs 76 more verifiers and another of which runs 37 unit
suites.

**Run the narrow thing.** Almost every check is individually runnable and takes seconds.

| You changed | Run |
|---|---|
| Any script in `scripts/` | `npm run verify:traps`, plus that script |
| A verifier's scanning logic | `npm run verify:sprint37l2` (C205, the comment-stripping rule) |
| Anything with words a person reads | `npm run verify:sprint24` (dashes), `npm run prose` |
| Public marketing copy | `npm run verify:claims`, `npm run render:check` |
| A schema file or a migration | `npm run verify:migrations`, `npm run verify:raw-sql` |
| Money, billing, the rail | `npm run verify:edges`, `verify:cycle`, `verify:rail` |
| The CSP, middleware, the video room | `npm run verify:csp` |
| The demo cast or a seed | `npm run verify:demo -- --scenario=<name>` |
| A document with a count in it | `npm run verify:runbook` |
| A promise or the test walk | `npm run verify:prove` |
| Types only | `npx tsc --noEmit -p tsconfig.json` |

**Run the full pass twice**: once before you believe you are finished, and once before a
deploy. Not between edits.

`scripts/_gates.ts` is the list, and `verify:runbook` reads `GATES.length` out of it, so
adding a gate makes every document claiming a gate count go red until it is updated. That is
deliberate.

### How a check is supposed to be written here

`docs/TRAPS.md` has six traps, each with enforcement in `verify:traps`, and the gate fails if
the document describes a trap nothing enforces. Learn all six before writing a check. The
shape they share:

> A checker reports on something ADJACENT to what it claims to check, and the report reads the
> same either way. A green line meaning "clean" and a green line meaning "I looked at nothing"
> are the same green line.

The question to ask of any check you write is not *is this rule right*. It is: **if the thing
I am checking were completely broken, would this line go red?** If you cannot answer yes, it
needs a control before it needs anything else. 19 of 106 verifiers still have no control, and
that number may only fall.

---

## 7 · How to read this repository, and how to check what you read

### The order

1. **`scripts/_gates.ts` and `docs/TRAPS.md`** first, together. They tell you what this
   codebase thinks is true about itself and what it has learned about being wrong.
2. **`lib/db/schema.ts`** and then every migration in `drizzle/` in order. The schema file is
   the intent; the 116 migrations are what actually happened, and section 1's second example
   is what the gap between them costs.
3. **`lib/`** by subdirectory. `billing` and `data` are the largest risk. `notify`, `auth`,
   `ai`, `security`, `settings`, `finance`, `content`, `i18n`.
4. **`app/`** by route group. Eight of them, one per principal, plus `api`.
5. **`components/`**.
6. **`scripts/`** last of the code, because a verifier only makes sense once you know what it
   is verifying. Read every one, including the ~76 that are not gates.
7. **`tests/`**, `evals/`.

Only then the documents, and read them as **claims made on a date**, not as description.

### The method, which matters more than the order

- **A comment is an argument somebody made once.** They are unusually good here and unusually
  long, and some are stale. Note every one you suspect.
- **Never conclude from one file.** The three failures in section 1 were each locally correct
  code. Ask: *is this the only place that does this?* A check reading one of N files that
  implement a thing is a named trap in `TRAPS.md`.
- **Never conclude from reading alone.** Sign in and click. The five seeded positions below
  exist so you can put the database into a specific state and walk it.
- **A claim and its check are two different things.** `docs/VALUE-STATEMENTS.md` lists 25
  promises this product makes on public pages. Your job includes finding out which are true.

### The demo cast

`docs/DEMO-LOGINS.md` is generated by `npm run logins` from `scripts/_demo-cast.ts`. Do not
hand-edit it. Twelve logins, one password, `Demo2026!Therapy`. Five real inboxes, everything
else at `example.com` and therefore unable to receive mail.

`laila.demo@example.com` has a record on a clinician's list and **no account, deliberately**.
`verify:demo` fails if anything gives her a login, because she is the only unclaimed record
and the claim flow has nothing else to be tested against.

### The five positions

```
npm run on:production -- seed:demo   -- --scenario=<name>
npm run on:production -- verify:demo -- --scenario=<name>
```

`live`, `money`, `continuity`, `crisis`, `growth`. Each is a complete starting position, not a
diff. `docs/PROVE-IT.md` walks eight testers across them. Always run the verify line: it is
the only thing that proves the reseed did what was asked, and it goes red if you name the
wrong one.

**These run against production.** Everybody signs out first. Leave the database on `live` when
you are done, because that is the position `DEMO-LOGINS.md` describes.

---

## 8 · Claims about the code. Every one is a hypothesis

**Nothing below is verified. Treat each as a thing to go and find out.**

### Four defects described as Phase 0, all still open

From `docs/THE-PLAN.md`, found by five agents walking production for four hours. The claim is
that 2,175 existing checks missed all of them.

| # | Claim |
|---|---|
| 123 | In-person sessions are recorded and transcribed with **no consent**, and the note says they were not recorded. Described as the one defect that is a legal problem rather than a bug |
| 122 | A modal covering "Go in now" ends in a clinician **banned for three days** for a room they were trying to enter |
| 124 | A rejected transfer is a **dead end** and nobody is told. Real money has left somebody's bank |
| 117 | An anonymous session ends with **no patient record, permanently** |

🔴 **124 has a live test in `docs/PROVE-IT.md`** under the `crisis` position, seeded in the
most favourable form available, because `paymentsFor` returns nothing at all for a `session`
payer and a guest genuinely cannot be told. If the patient still cannot find the rejection,
the dead end is wider than the task says.

### 44 open tasks

Use the task list, not this document, for the current state. The shape:

- **Phase 1**, declared next: tasks 163 to 167, the "never stuck" spine. A register of every
  way a person can be blocked, a way out named in the product, `/admin/stuck` showing blocked
  **people** rather than queues, a clock on every block, and staff able to unblock anybody on
  the record. **There is currently no screen in the console that lists blocked people.**
- **Phase 1 instruments**: 127 a structural crawler over 129 pages as 8 user types, 128
  journey suites, 129 a sibling-path gate.
- **Phase 2**, roughly 16 defects grouped by surface: money, the session, the radar,
  scheduling, platform.
- **Phase 3, the redesign**, in a priority order the founder set: **patient first, company
  second, clinic third, partner last.** Nothing starts before Phase 2 for that surface closes,
  because redesigning a broken screen produces a prettier broken screen. Task 155 is in
  progress: one shape for all four audience pages.
- **Phase 4**: nine agent-driven cycles, tasks 142 to 150.
- **Phase 5**: the six-month simulation, task 151. It has never run. Everything in
  `docs/simulation/` describes a run that was prepared for and never made, and
  `docs/simulation/12-THE-LOGINS.md` says so at the top.

### The founder's UI concerns, as best this session understood them

Unverified, and worth confirming directly rather than from here: grey and thin text swept off
every page; the teal reading as green; a price badge reading as part of the price; the radar
globe appearing empty with two clinicians on it; `/for-patients` showing the same app four
times over eleven sections; a homepage of five heroes collapsed into one; empty states taking
a whole card; the therapist calendar hiding bookings until a day is expanded.

The palette is `#0a2342` ground and `#2ec4b6` accent, `#eaf0ff` retired as a surface.
`verify:palette` enforces which ramp each job uses, after 277 class names had drifted and 18
buttons carried white on teal at 2.17:1.

### Things this session suspects are stale and did not chase

- `docs/simulation/` is 17 documents about a run that never happened. `verify:runbook` keeps
  their counts honest against the code but cannot tell you they describe a plan rather than a
  history.
- `docs/walkthrough-archive/` is explicitly marked stale: written for a product with one
  therapist and one patient in it.
- `HAZARDS.md` and `PLAN.md` (5,425 lines) were not read by this session at all.
- `UNWIRED_BASELINE = 18` in `verify:notices` means 18 `notify()` call sites still write
  nothing a patient can find in the app. The number may only fall and lowering it is the work.
- Two unions in `verify:migrations` report **no CHECK on this database**:
  `manual_payments_state` and `manual_payments_purpose`. That may be correct or may be a gap.

---

## 9 · Where the real documents are

Read these as claims, after the code, not before.

| File | What it holds |
|---|---|
| `PLAN.md` | The specification. §2 is every concern and its ruling, §6 the standing rules. 5,425 lines |
| `HAZARDS.md` | Traps that have caused defects in the product |
| `docs/TRAPS.md` | Traps in the **checkers**, each enforced by `verify:traps` |
| `docs/LIFECYCLES.md` | 11 state machines, 48 states, 51 transitions, and every way a person gets stuck |
| `docs/INVENTORY.md` | Every page and control, with whether it is wired. Generated |
| `docs/NEON-BRANCHES.md` | Which branch is what. Read before deleting any |
| `docs/DAILY-HOSTS.md` | Every host the video room really talks to, read out of the downloaded bundle |
| `docs/EMAIL-DNS.md` | What is published for the domain and what each gap costs |
| `docs/FINANCIAL-PLAN.md` | The operating plan, every number labelled |
| `docs/THE-PLAN.md` | Phases 0 to 5, and which task is in which |
| `docs/THE-REDESIGN.md` | What exists against what the redesign needs |
| `docs/VALUE-STATEMENTS.md` | The 25 promises. Generated by `npm run prove` |
| `docs/PROVE-IT.md` | Eight testers, five positions, the walk that proves them |
| `docs/DEMO-LOGINS.md` | Who is on production now. Generated by `npm run logins` |
| `docs/simulation/` | 17 documents driving a six-month run that has never been made |

---

## 10 · The first week

1. **Read the code.** All of it, in the order in section 7, building the map as section 1
   describes. This is the job, not a preliminary to it. The founder has said plainly: **no
   work without reading first.** That includes the four defects in section 8, however urgent
   they look from here.
2. **Do not run `npm run gates` while reading.** Nothing you are doing can break it, and it
   costs 25 minutes every time.
3. **When the reading is done**, put the database into each of the five positions and walk
   `docs/PROVE-IT.md` yourself. That is where a claim becomes a fact.
4. **Bring the founder four lists**: promises that are true, promises that are not, things
   nobody had noticed, and things in these documents that are no longer true.
5. **Then** Phase 0, because four defects that hurt a real person outrank everything else
   including the redesign. By then you will know whether they are still real, which is the
   point of doing it in this order.

The founder is not technical. Explain in plain words, say what to click, never imply a
deadline that does not exist, and when something is broken say so plainly rather than
softening it.
