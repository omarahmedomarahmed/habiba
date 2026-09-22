# Taking over 24Therapy

**You are replacing the session that wrote this. Read sections 1 to 3, then start section 8,
and do not write a line of product code until section 8 and section 9 are finished.**

---

## 1 · What you are here to do

**Redesign this entire product, and close the holes you find doing it.**

Every app and every user-facing portal, drawn again as it should be rather than as it grew:
the patient app, the clinician's workspace and room, the clinic portal, the company portal,
the partner portal, the public site, and the console we run it from. A better flow, better
screens, and a coherent design rather than eleven sprints of accretion.

The deliverable of that work is **`/design`, completely rewritten by you**: its content, its
sub-pages, its wireframes and its UI screens, as samples the founder approves from before
anything is built for real. Section 10 has what `/design` is today and what it has to become.

**That is the goal. Everything before it is how you earn the right to do it.** You cannot
redesign a screen you have not understood, and you cannot understand this one by looking at
it, because every promise it makes is enforced somewhere in 280,000 lines you have not read.

The order is fixed and it is not negotiable:

| | | |
|---|---|---|
| 1 | **Read the claims** | Every `.md`. What this product says it is and what it values |
| 2 | **Read the code** | All of it. What is actually true |
| 3 | **Walk it** | Sign in as the demo cast, drive real flows, prove each claim as a person would |
| 4 | **Assess** | Every user-facing page you passed through, judged for the redesign |
| 5 | **Redesign** | Rewrite `/design`. Fix the holes you found |

The founder has said it plainly: **no work without reading first.** That includes the four
defects in section 12, however urgent they look from here.

---

## 2 · Do not trust this document about the code

The session that wrote this was compacted several times. A large part of what it "knew"
arrived as a summary of earlier sessions rather than as something it read. It read perhaps a
few dozen files carefully, and those were mostly the files it happened to be changing.

**It did not read this repository. Neither has anybody else.**

So this document is split by what kind of claim each thing is, because they are not equally
trustworthy:

| Section | What it holds | Trust |
|---|---|---|
| 3 | Things that destroy production | **Hard rules.** Obey before verifying |
| 5 | External state: Neon, Vercel, DNS | **Only source.** Not derivable from the repo |
| 6 | The business and what we value | **Only source**, and still check it with the founder |
| 7 | The gate economy | Measured, and cheap to re-measure |
| 8 to 11 | How to read, walk, assess and redesign | Method, not fact |
| 12 | Claims about the code | **Zero trust. Every line is a hypothesis to test** |

Every `.md` in this repository, including this one, is **a claim somebody made on a date**.
Some were true when written and are not now. The comments in the source are the same: this
codebase documents its own defects in prose, at length, and **a comment describing a fix is
not evidence the fix is still there**.

### The pattern that should govern how you work

Every single thing in this product was built, found to have a hole, patched, and the patch
opened another hole found later. That is the observed history, not pessimism. Four examples
from the last two days, each of which passed every gate:

1. The video room's Content Security Policy was written by reading the installed
   `@daily-co/daily-js` package. The package is a loader; the thing that runs is a 1.8MB
   bundle downloaded at join time, naming a host the package never mentions. An enforcing
   policy would have broken every call in production.
2. A fix for "the patient's app shows nothing after an invitation" was written, gated,
   deployed, and **did not work**, because the database CHECK still refused the four new
   values. The insert threw, a `try/catch` logged it at warn, the email sent, and the gate
   passed on every run because it reads source and a TypeScript union is not a constraint.
3. The gate written to keep `docs/VALUE-STATEMENTS.md` fresh **could not fail**, because
   importing the generator ran it and regenerated the file before the comparison.
4. `therapist_radar.demo` granted a heartbeat exemption in three separate expressions, so a
   seeded clinician was permanently "available now" on a radar whose entire promise is
   somebody free this minute. Fixing that exposed a fifth defect one layer up: the patient's
   directory read a cached status column and called people online who had closed their laptop.

In all of them the code was locally correct and the gate was locally correct. **Reading two or
three files about one subject and concluding you understand it is how every one of them
happened.**

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

Reversed, the new code meets the old schema. That rule is in the allow-list entry itself.

### The deploy flow

Commit on local `main`, push to the working branch, then to remote `main` to deploy:

```
git push -u origin HEAD:claude/24therapy-rebuild-research-fkjen7
git push origin HEAD:main
```

**Deploy only when the gates are green and the founder has said to.**

### House rules, from the founder, not negotiable

- **Never an em dash or an en dash.** `verify:sprint24` enforces it, and it scans string
  literals as well as comments, because a console line an operator reads is copy too.
- Short tables, plain words, no filler.
- Bank details stay placeholders. Task 52 puts real ones in the week before launch.
- Every invented person is at `example.com`. Five real inboxes are named in
  `scripts/_demo-cast.ts`.
- No model identifier in a commit message, a PR, a code comment, or anything pushed.

---

## 4 · What this product is

An AI clinical-documentation and on-demand-therapy platform, launching in Egypt at
`24therapy.app`. Five kinds of user, six sign-in doors, six different cookies, and they are
genuinely separate principals: a therapist's session cannot become a patient's.

| Who | Signs in at | Gets |
|---|---|---|
| Patient | `/patient/login` | An app: sessions, their record, journal, homework, a crisis button |
| Therapist | `/login` | A caseload, a video room, an AI note written from the transcript, a copilot |
| Clinic manager | `/clinic/sign-in` | Seats, one bill for the practice, earnings per clinician |
| Company | `/sponsor/sign-in` | A funded pot that pays a share of staff sessions, and no clinical data |
| Us | `/staff/sign-in` | Verification queue, transfer queue, payouts, the board, the ledger |

Plus a partner portal (`/partner/sign-in`) for EHR integration, the least finished of them.

Three things make this product unusual, and each is load-bearing:

1. **There is no card processor in Egypt.** Every payment is a bank transfer a human checks.
   The row in `manual_payments` is the only record that anybody verified anything.
2. **The employer must never learn who is in therapy.** The company portal has no query that
   could return a patient name, a session time or an attendance list. The published pot
   balance only updates once five sessions have passed, so an employer cannot difference it.
3. **The patient owns the record, not the clinician.** Summaries are append-only, versioned,
   and follow the person between practices. Consent is granted per clinician and revocable.

---

## 5 · External state, which is not in the repository

**This section is the reason this document exists.** None of it can be derived from the code.

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

Things that cost a session to learn:

- `suspend_timeout_seconds` has a **floor of 300s on this plan**.
- `active_time_seconds` runs about 4x `compute_time_seconds` at 0.25 CU.
- Compute bled for days because `CACHE_SECONDS` in `lib/content/service.ts` was **300, exactly
  equal to the suspend timeout**, so the cache expired precisely as the compute slept and woke
  it again forever. It is 1800 now and `verify:sprint21r` refuses the value 300.
- Only 6 of 35 gates touch a database. One (`settings:compare`) touches all three.
- A snapshot delete is permanent. Neon has no undelete.

### Vercel, project `habiba` (`prj_gl3PhgBsoR3J7L5H2ddHwWgzp2CR`)

Team `team_RZRihzvgqAscDaNXv7bh6oE7`.

| Variable | Production | What it does |
|---|---|---|
| `CSP_ENFORCE` | `1` | **Enforcing.** Report-only ONLY when the value is exactly `0` |
| `SIMULATION_RUNNING` | **removed, preview only** | See below |
| `DATABASE_URL` | production branch | |
| `RESEND_API_KEY`, `EMAIL_FROM` | set | Email |
| `DAILY_API_KEY` | set | Video |
| `OPENAI_API_KEY` | set | The model |
| `BLOB_*` | set | Receipts and uploads, store `store_qT6jXjmeT2xllpNo` |
| `STRIPE_*` | set | Present, but Egypt runs on the transfer rail |
| `CRON_SECRET` | set | Six cron jobs |

### 🔴 TWO LAUNCH BLOCKERS, FOUND AND CLOSED ON 2026-09-22

Both were found by reading the Vercel configuration against the running site, not from any
file. The history matters because the second nearly took the radar with it.

**1. `24therapy.app` served `Disallow: /` to every crawler.** `app/robots.ts` does that
whenever `SIMULATION_RUNNING` is set, deliberately, so a simulation could not be indexed. The
variable was still set long after there was any simulation. It is off production now and
`robots.txt` serves `Allow: /`.

**2. The Content Security Policy was report-only.** It enforces now, and
`npm run audit:csp-enforced` is what proved that safe: 21 public pages in a real Chromium under
the enforcing header, no refusal in any console, with a planted unnonced script that had to be
refused so the sweep could not mean nobody was listening.

🔴 **Report-only had never been collecting anything.** The policy carries no `report-uri` and
no `report-to`, so every refusal for as long as it ran went to a console nobody had open.

🔴 **AND THE TWO WERE COUPLED.** `SIMULATION_RUNNING` also made `lib/data/discover.ts` skip a
`demo = false` filter, so the demo cast was listed in the patient's directory **only** because
that variable was set. Removing it to get indexed would have emptied the directory in the same
moment, in a different part of the product, with nothing saying why. That was repaired first,
and the repair changed a rule:

> **`therapist_radar.demo` is a LABEL and never a decision.** Presence is measured for every
> row. A demo clinician signed in and on shift is online; signed out, offline. They stay
> listed in the directory either way, because asleep is not absent.

`verify:radar-place` holds it with a control. `SIMULATION_RUNNING` also widened every rate
limit except `global:`; production now runs the real limits.

### Domain and email

- SPF is on the **subdomain** `send.24therapy.app`, not the root:
  `v=spf1 include:amazonses.com ~all`. A previous session checked the root, found nothing, and
  told the founder to add something already there.
- DKIM is published.
- DMARC is `v=DMARC1; p=none; rua=mailto:omarabdelgawad001@gmail.com; sp=none; adkim=r; aspf=r`.
- **Nothing expires.** `MONITORING_UNTIL = 2026-10-06` in `scripts/verify-email-dns.ts` is a
  reminder in our own test suite, not a deadline anybody set. Read the `rua` reports until
  roughly then, then move to `p=quarantine`.

---

## 6 · The business, and what we actually value

`docs/FINANCIAL-PLAN.md` has the whole argument, every number labelled **MEASURED**,
**DECIDED** or **GUESS**. The split is 2 measured, 20 decided, 12 guessed, and both measured
numbers are terms of the AI cost.

### The raise

**$20,000**, Egypt, six months. Burn starts at **$6,647/month** and turns positive in month 5.
Month-6 run rate **$9,474**, which is **$113,688 of ARR**.

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

Break-even between metered and unlimited is **exactly 20 sessions**, which is why the price is
$80 and not $100. At $100 it was 25 sessions while the same plan forecasts a typical therapist
doing 20, so we would have been selling a subscription to people for whom it was the worse
deal.

### The offer

| Month of *their* life | They pay |
|---|---|
| 1 | Free |
| 2 and 3 | 50% |
| 4 onward | Full price |

Joining after month 3 gets one free month and then full price. **Read off each customer's own
age, not the calendar.** A company gets **$100 of welcome credit**, which is real cash leaving
rather than a discount, about **$85 net**. It was $200 and was halved deliberately: the number
that matters is how many companies try us, not how long the first lasts.

### Payroll

Founder product 500, founder clinical 500, two sellers 500 each, marketing 500, two support
500 each. **$3,500/month.** Plus $1,000/month marketing, $120 hosting, $150 tools, $600 video
production and $1,200 formation as one-offs.

One founder sells full time from month one. It costs nothing and buys 50% more capacity, and
it is the assumption most likely to be wrong, because a founder selling is a founder not
building and the model has no line for what stops being built.

**Two support staff are forced by the payment rail, not chosen.**

### 🔴 The values, and two claims we are forbidden from making

`docs/VALUE-STATEMENTS.md` is **the 25 promises this product makes**, five per audience, each
one a claim already on a page a stranger can read. Read it before you read any code. It is
generated by `npm run prove` from `scripts/_value-statements.ts`, and `verify:prove` fails if
a promise is never walked in `docs/PROVE-IT.md`.

`lib/content/honesty.ts` refuses two claim shapes at `savePage`, and `verify:sprint28` scans
the published rows as well:

1. **That paid sessions cover our fee.** Fifteen per cent of a $20 session is $3 against a $4
   fee. It is arithmetically false and it writes itself into a pricing page because it sounds
   like the deal. What is true is **netting**.
2. **Any forecast of what a clinician will earn.** "Get booked" is fine. "Earn up to", "pays
   for itself", "fill your calendar" are predictions about somebody else's business.

**Your redesign must not break either rule, and the checker runs on published rows, so a
beautiful screen that says one of those things will be refused at save time.**

---

## 7 · The gate economy, and please stop running all of them

**`npm run gates` takes 25 minutes.** The session before you ran it far too often and wasted
hours. It runs 35 gates, one of which runs 76 more verifiers and another 33 unit suites.

**Run the narrow thing.** Almost every check is individually runnable and takes seconds.

| You changed | Run |
|---|---|
| Any script in `scripts/` | `verify:traps`, plus that script |
| A verifier's scanning logic | `verify:sprint37l2` (C205, the comment-stripping rule) |
| Words a person reads | `verify:sprint24` (dashes), `prose` |
| Public marketing copy | `verify:claims`, `render:check` |
| A schema file or a migration | `verify:migrations`, `verify:raw-sql` |
| Money, billing, the rail | `verify:edges`, `verify:cycle`, `verify:rail` |
| The CSP, middleware, the room | `verify:csp`, and `audit:csp-enforced` before enforcing |
| The radar or the directory | `verify:radar-place`, `verify:c285` |
| A component or a page | `render:check`, `verify:palette`, `verify:boundary` |
| The demo cast or a seed | `verify:demo -- --scenario=<name>` |
| A document with a count in it | `verify:runbook` |
| A promise or the test walk | `verify:prove` |
| Types only | `npx tsc --noEmit -p tsconfig.json` |

**Run the full pass twice**: once when you believe you are finished, and once before a deploy.

### How a check is supposed to be written here

`docs/TRAPS.md` has six traps, each enforced by `verify:traps`, and the gate fails if the
document describes a trap nothing enforces. Learn all six before writing a check. The shape
they share:

> A checker reports on something ADJACENT to what it claims to check, and the report reads the
> same either way. A green line meaning "clean" and one meaning "I looked at nothing" are the
> same green line.

Ask of any check you write: **if the thing I am checking were completely broken, would this
line go red?** If you cannot answer yes, it needs a control before it needs anything else.

---

## 8 · Step 1 and 2 · Read the claims, then read the code

### First the claims, and this order is deliberate

**Read every `.md` before you open a source file.** They are the claim set: what this product
says it is, what it promises, what it values, and what it has already learned about being
wrong. You cannot judge code against an intent you do not know, and you certainly cannot
redesign a screen without knowing what it was promising.

| Order | File | Why this one |
|---|---|---|
| 1 | `docs/VALUE-STATEMENTS.md` | The 25 promises. The whole point of the product |
| 2 | `docs/TRAPS.md` | What this codebase has learned about being wrong |
| 3 | `HAZARDS.md` | Traps that have already caused defects in the product |
| 4 | `PLAN.md` | The specification. §2 every concern and its ruling, §6 the standing rules. 5,425 lines |
| 5 | `docs/LIFECYCLES.md` | 11 state machines, 48 states, 51 transitions, every way a person gets stuck |
| 6 | `docs/THE-PLAN.md` | Phases 0 to 5 and which task sits in which |
| 7 | `docs/THE-REDESIGN.md` | What exists against what the redesign needs |
| 8 | `docs/FINANCIAL-PLAN.md` | Every number, labelled |
| 9 | `docs/PROVE-IT.md` | The walk you will run in step 3 |
| 10 | `docs/INVENTORY.md` | Every page and control, and whether it is wired |
| 11 | the rest of `docs/` | Including the 17 in `docs/simulation/` |

Keep a list as you go: **every promise, and where it says it is enforced.** That list is what
step 2 checks and step 3 walks.

### Then the code, all of it

**1,106 files, about 280,000 lines.** The comments are a large fraction because this codebase
argues with itself in prose.

| Directory | Files | Lines | What it is |
|---|---|---|---|
| `lib` | 244 | 92,074 | Everything that is not a screen. Money, auth, AI, data, notify |
| `scripts` | 180 | 69,724 | 35 gates, 76 more verifiers, seeds, the simulation harness |
| `components` | 224 | 54,334 | React, including marketing blocks and every portal |
| `app` | 271 | 37,099 | Next.js App Router. Eight route groups, one per principal |
| `tests` | 37 | 9,673 | Unit suites, run as one gate |
| `drizzle` | 116 | 9,014 | 116 migrations. The schema's real history |
| `evals` | 13 | 3,954 | Model evaluation and the cost benchmark |

Order: `lib/db/schema.ts`, then every migration in order, then `lib/` by subdirectory
(`billing` and `data` are the largest risk), then `app/` by route group, then `components/`,
then `scripts/` (a verifier only makes sense once you know what it verifies), then `tests/`
and `evals/`.

### 🔴 The arithmetic nobody should pretend away

280,000 lines is roughly three to four million tokens. **No context window holds that,
including yours.** A session that reads straight through will have forgotten the first third
by the end and will not know it has, which is worse than not having read it.

So read a directory at a time and, **before opening the next one**, write what you learned
into a working map: what each file is for, what it assumes, what it decides, plus two lists
you keep throughout.

- **Stale**: a comment or check describing something no longer true, an exemption covering
  nothing, a baseline nobody has lowered.
- **Suspect**: a claim you have not tested that would matter if false.

**The map is the deliverable of the reading phase.** It is what you re-read after a compaction
and what lets you find any line again. Keep it outside `docs/` while it is working notes.

---

## 9 · Step 3 and 4 · Walk it as a person, and assess as you go

Reading tells you what the code says. It does not tell you what a person sees. Four of the
five defects in section 2 were found by somebody clicking, not by somebody reading.

### Sign in as the cast

`docs/DEMO-LOGINS.md` is generated by `npm run logins` from `scripts/_demo-cast.ts`. Twelve
logins, one password, `Demo2026!Therapy`. Five real inboxes; everything else at `example.com`
and unable to receive mail, so anything you want to check arriving in an inbox has to run
through one of the five.

`laila.demo@example.com` has a record on a clinician's list and **no account, deliberately**.
`verify:demo` fails if anything gives her a login.

### Put the database into each of the five positions

```
npm run on:production -- seed:demo   -- --scenario=<name>
npm run on:production -- verify:demo -- --scenario=<name>
```

`live`, `money`, `continuity`, `crisis`, `growth`. Each is a complete starting position.
Always run the verify line: it is the only thing that proves the reseed did what was asked.
Leave the database on `live` when you are done.

### Then walk `docs/PROVE-IT.md` yourself

It is written for eight people on eight devices, and you are one session. **Use agents.** Give
each one a persona from the cast, a browser and a section of the walk, and run the
cross-referenced steps in the order the document sets, because step 4 on one person's screen
depends on step 3 on somebody else's.

Rules that earned their place and carry over:

- **Do not serialise the agents.** The worst defect of an earlier run surfaced precisely
  because five of them shared one address at once.
- **Every claim is corroborated against a row.** `DID / SAW / ROW`: what you did, what you
  saw, and the reference or id. "Payment worked" is not evidence.
- **A retraction is worth more than a clean report.**
- **Write down the passes too.** A report with only breakages cannot distinguish "we checked
  and it was fine" from "nobody looked".

Two things stop the whole walk: a patient's name appearing anywhere in the company portal, and
anything about money on top of the SOS orb. Stop, screenshot, say so.

### 🔴 And assess every screen as you pass through it

**This is step 4 and it happens during step 3, not after.** You are the only person who will
ever see every one of these screens with fresh eyes. For each user-facing page you land on,
write down, while you are looking at it:

- What is this screen **for**, in one sentence, and does it say so?
- What does a person do **next** from here, and is that obvious?
- What is **missing**: a title, an empty state, a way back, a way out of a dead end?
- What is **decoration** rather than information?
- Does it work at **390px**, and in **Arabic with RTL**?
- Which of the 25 promises is this screen responsible for, and does it keep it?

That file is the raw material for the redesign. Without it you will redesign from memory and
from screenshots, which is how a prettier version of the same confusion gets built.

---

## 10 · Step 5 · The redesign, and `/design` is the deliverable

### What `/design` is today

`app/(public)/design/`, about 3,300 lines, `noindex`. A UI reference organised by **who is
looking**, with sub-pages and sample screens for patient, company and clinic, and a wireframe
kit in `components/design/wire.tsx`. Its own header says a gap in an audience's row is a gap
in the product's ability to show itself to that audience.

It grew alongside the product. It is not a design system and it is not a proposal.

### What it has to become

**A complete, new design for every app and every user-facing portal, drawn by you, as samples
the founder approves from.** Not a tidy-up of what exists. The brief, in the founder's words,
is a greater design, a better design, a flow with screens.

That means, for each of the surfaces below: the flow a person actually moves through, the
screens that flow needs, the wireframes, and the real UI. Enough that somebody can look at it
and say yes or no before a line of it is built for real.

| Surface | Priority |
|---|---|
| The patient app: home, sessions, therapists, profile, record, journal, crisis | **First.** The founder set this order |
| The company portal | Second |
| The clinic portal | Third |
| The clinician's workspace: caseload, patient profile, calendar, copilot | |
| The session room | |
| The public site: homepage and the four audience pages | |
| The console we run it from | |
| The partner portal | **Last** |

Carry with you:

- **The palette is `#0a2342` ground and `#2ec4b6` accent**, with `#eaf0ff` retired as a
  surface. `verify:palette` enforces which ramp each job uses, after 277 class names had
  drifted and 18 buttons carried white on teal at 2.17:1.
- **Both languages and 390px are not a later pass.** Arabic is RTL and a headline that fits on
  one line in English wraps to three.
- **The honesty rules in section 6 apply to every word you write on a screen.**
- **Every screen has to serve a promise from `docs/VALUE-STATEMENTS.md`.** A screen serving
  none is a screen to argue for or delete.

### The founder's own UI complaints, so far as this session understood them

Unverified, and worth confirming directly: grey and thin text everywhere; the teal reading as
green; a price badge reading as part of the price; the radar globe appearing empty with two
clinicians on it; `/for-patients` showing the same app four times over eleven sections; five
heroes on a homepage that needed one; empty states taking a whole card; the therapist calendar
hiding bookings until a day is expanded; dead space and contradictory statuses in the session
room; two overlays in front of a form.

### And fix the holes

The reading and the walk will produce a list of defects. **Fix them.** That is explicitly part
of this job and it is why the reading comes first: a hole you patch without understanding the
system is the next hole.

---

## 11 · The task list, and what is missing from it

**The five steps in section 1 are themselves tasks 171 to 175**, blocked in that order so the
sequence is enforced rather than remembered:

| # | |
|---|---|
| 171 | Read every `.md`, then every line of code, and build the map |
| 172 | Walk every flow as the demo cast, with agents, and prove the 25 promises |
| 173 | Assess every user-facing screen while walking it |
| 174 | Rewrite `/design` as a complete new design, as samples to approve |
| 175 | Find the tasks nobody knew to ask for |

Beyond them there are **44 inherited tasks**. They are yours now. Use the live task list
rather than this document for their state; the shape is:

| Group | Tasks |
|---|---|
| **Phase 0**, four defects that hurt a real person | 123, 122, 124, 117 |
| **Phase 1 instruments**: structural crawler over 129 pages as 8 user types, journey suites, sibling-path gate | 127, 128, 129 |
| **Phase 1 spine**, declared next: the never-stuck work | 163 to 167 |
| **Phase 2**, ~16 defects by surface: money, session, radar, scheduling, platform | 114 to 126, 130 to 132 |
| **Phase 3, the redesign** | 133 to 141, and 155 in progress |
| **Phase 4**, nine agent-driven cycles | 142 to 150 |
| **Phase 5**, the six-month simulation, never run | 151 |
| Unscheduled | 52, 104, 105, 108, 156 |

### 🔴 AND THE LIST IS INCOMPLETE, WHICH IS PART OF YOUR JOB

**Every task on it exists because somebody noticed something.** Nobody has read this
repository, so the list describes the defects that happened to be found, not the defects that
exist. Assume there are more.

So as you read, walk and assess, **add what is missing**:

- A promise in `docs/VALUE-STATEMENTS.md` that nothing enforces.
- A lifecycle state in `docs/LIFECYCLES.md` with no way out, which is one of the three shapes
  of "stuck" that `verify:machines` looks for.
- A screen with no task covering what is wrong with it.
- A surface with no gate, where a defect would be silent.
- A stale comment, exemption or baseline from your reading list.
- Anything in this document that turns out not to be true.

Bring the founder the additions separately from the inherited list, so they can see what a
full read found that four months of building did not.

---

## 12 · Claims about the code. Every one is a hypothesis

**Nothing below is verified. Treat each as a thing to go and find out.**

### Four defects described as Phase 0, all still open

From `docs/THE-PLAN.md`, found by five agents walking production for four hours. The claim is
that 2,175 existing checks missed all of them.

| # | Claim |
|---|---|
| 123 | In-person sessions recorded and transcribed with **no consent**, and the note says they were not recorded. Described as the one defect that is a legal problem rather than a bug |
| 122 | A modal covering "Go in now" ends in a clinician **banned for three days** |
| 124 | A rejected transfer is a **dead end** and nobody is told. Real money has left a bank |
| 117 | An anonymous session ends with **no patient record, permanently** |

🔴 **124 has a live test** in `docs/PROVE-IT.md` under `crisis`, seeded in the most favourable
form available, because `paymentsFor` returns nothing at all for a `session` payer and a guest
genuinely cannot be told. If the patient still cannot find the rejection, the dead end is
wider than the task says.

### Things this session suspects are stale and did not chase

- `docs/simulation/` is 17 documents about a run that **never happened**.
  `docs/simulation/12-THE-LOGINS.md` says so at the top. `verify:runbook` keeps their counts
  honest against the code but cannot tell you they describe a plan rather than a history.
- `docs/walkthrough-archive/` is explicitly marked stale: written for a product with one
  therapist and one patient in it.
- `UNWIRED_BASELINE = 18` in `verify:notices`: 18 `notify()` call sites still write nothing a
  patient can find in the app. The number may only fall.
- Two unions report **no CHECK on this database** in `verify:migrations`:
  `manual_payments_state` and `manual_payments_purpose`. Correct, or a gap.
- 19 of 106 verifiers still have **no control**, so 19 of them cannot be shown to fail.
- Task 121 says the radar sweep is **scheduled as if it were only cosmetic**, and the
  directory fix of 2026-09-22 leaned on that sweep being late. Worth checking early.

---

## 13 · Where the real documents are

| File | What it holds |
|---|---|
| `PLAN.md` | The specification. 5,425 lines |
| `HAZARDS.md` | Traps that have caused defects in the product |
| `docs/TRAPS.md` | Traps in the **checkers**, each enforced by `verify:traps` |
| `docs/VALUE-STATEMENTS.md` | The 25 promises. Generated by `npm run prove` |
| `docs/PROVE-IT.md` | Eight testers, five positions, the walk that proves them |
| `docs/LIFECYCLES.md` | 11 state machines and every way a person gets stuck |
| `docs/INVENTORY.md` | Every page and control, with whether it is wired. Generated |
| `docs/NEON-BRANCHES.md` | Which branch is what. Read before deleting any |
| `docs/DAILY-HOSTS.md` | Every host the video room really talks to |
| `docs/EMAIL-DNS.md` | What is published for the domain and what each gap costs |
| `docs/FINANCIAL-PLAN.md` | The operating plan, every number labelled |
| `docs/THE-PLAN.md` | Phases 0 to 5 |
| `docs/THE-REDESIGN.md` | What exists against what the redesign needs |
| `docs/DEMO-LOGINS.md` | Who is on production now. Generated by `npm run logins` |
| `docs/simulation/` | 17 documents driving a run that has never been made |

---

## 14 · The shape of the whole job

1. **Read every `.md`.** The claims, the values, the rulings, the traps.
2. **Read every line of code**, directory by directory, writing the map as you go.
3. **Walk the product** as the demo cast, with agents, across the five positions, proving each
   of the 25 promises the way a person would.
4. **Assess every screen** you pass through, while you are looking at it.
5. **Rewrite `/design`** as a complete new design for every app and portal, as samples to
   approve from.
6. **Fix the holes**, and add the tasks nobody knew to ask for.

The founder is not technical. Explain in plain words, say what to click, never imply a
deadline that does not exist, and when something is broken say so plainly rather than
softening it.
