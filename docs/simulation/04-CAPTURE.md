# What is photographed, and where it goes

**Read by every agent. The frames from this run are committed to the repository and are the
raw material for the video, so they are content as well as evidence.**

## The shape on disk

```
docs/walkthrough-3/
  m0/  m1/  m3/                 one folder per checkpoint
    t1-amira/                   one folder per person, named for who they are
      dashboard.png
      patients.png
      earnings.png
      billing.png
      ...
    p1-layla/
    c1-nile-practice/
    e1-cairo-foundry/
    op-nour/                    the whole console, 24 pages, committed (C358)
  db/
    m0.md  m1.md  m3.md         the database at each checkpoint, in words
  ar/                            the Arabic pass, same shape, named subset only
  REPORT.md                      the findings
  MONEY.md                       the reconciliation from 03-MONEY.md
  COPILOT.json  COPILOT.md       the exam from 06-COPILOT-EXAM.md
  PHYSICS.json                   the fitted cost model from npm run physics
  SCRIPT-EN.md  SCRIPT-AR.md     the video scripts, rewritten against this run
```

**Name folders for people, not for principals.** `t1-amira/` is a person somebody can follow
across three checkpoints. `therapist-1/` is a row.

## The rule that makes this worth doing

> **The same person, on the same screens, at three points in their history.**

A gallery of every screen at one moment is what the last two walkthroughs produced. It
cannot show the thing that matters about this product: **that a therapist's earnings screen
means something different in month 3 than it did in month 0**, because by then there is a
history behind it.

So the capture list is per person and it is the same list every time.

## What each person's checkpoint captures

| Who | Screens, every checkpoint |
|---|---|
| **Therapist** | Dashboard · patients list · one patient's record · sessions · one approved note · bookings · **earnings** · **billing** · settings/payments showing the fee split · radar state |
| **Patient** | Home · sessions · one summary written to them · journal · steps · **billing, showing what they paid and what was covered** · who can read their history · record |
| **Clinic** | Overview · people · **team and delegated powers** · schedule · **bills** · earnings · records connection |
| **Employer** | Overview · **the pot meter** · weekly spend · people enrolled · the code · the standing "we never show you" bar |
| **Partner** | Keys · **usage against the limit** · deliveries |
| **Operator** | 🔴 **Every page of the console, and they ARE committed this time.** The full list is its own section below |

## 🔴 The whole operator console, and why it is committed this time

C80 has said since sprint 52 that admin frames are **never** committed. Its reason was
disclosure: a console shows many people at once, and this repository is treated as if it
will be public one day, so one real name in one frame cannot be recalled.

That reason is about real people. **This run has none.** Every surname is Demo or Example
and every address is at a domain RFC 2606 reserves, which cannot reach an inbox and
therefore cannot belong to anybody.

So the precondition is **proved rather than assumed**:

```
npm run verify:synthetic
```

It reads every surname and every email column in the schema, discovered from
`information_schema` rather than from a list, and plants a real-looking name to watch itself
catch one. **No operator frame is committed until it passes**, and it is run again
immediately before the commit, because a name that arrives after it passed is a name nobody
checked. `.gitignore` carries the same instruction and the two lines to restore if it ever
fails.

### The twenty-three pages, and the two roles that see them

The console has **two audiences** and most captures forget the second one. Four pages are
`requireStaff()`, which is the 24/7 team; the other nineteen are `requireRole("super_admin")`,
which is us. **Photograph the four staff pages signed in as staff**, not as the owner, or the
capture shows a console nobody on the rota actually sees.

| Page | Seen by | What the frame has to show |
|---|---|---|
| `/admin` | owner | The dashboard with three months behind it, not an empty state |
| `/admin/verifications` | **staff** | The queue, and `T4`'s card at the second rejection with the "Reject and clear" warning on it |
| `/admin/payouts` | **staff** | `T1`'s Egyptian manual payout, before and after the stamp |
| `/admin/numbers` | **staff** | The number-change queue |
| `/admin/support` | **staff** | A ticket answered |
| `/admin/vault` | owner | 🔴 The month table: subscriptions, session fees, income, model spend, left over. The acceptance test in `03-MONEY.md` |
| `/admin/usage` | owner | Cost per session and the consent rate beside it |
| `/admin/financial-model` | owner | 🔴 The thirty-six month forecast, **after Measure and freeze has been pressed**, so the provenance bar at the top shows this database rather than the shipped estimate. See `07-FINANCIAL-MODEL.md` |
| `/admin/therapists` | owner | Five clinicians, one of them twice rejected |
| `/admin/clinics` | owner | Nile Practice, approved, three seats |
| `/admin/sponsors` | owner | Three employers, one pot empty and one at 10% |
| `/admin/benefits` | owner | What a sponsor's people are entitled to |
| `/admin/partners` | owner | Helio Health, its keys and its rate limit |
| `/admin/radar` | owner | The radar command view with `T3` on it |
| `/admin/ratings` | owner | What patients said |
| `/admin/checkins` | owner | The check-in schedule |
| `/admin/audit` | owner | 🔴 The rejection and the deletion, in the log, with the operator's name |
| `/admin/settings` | owner | The rates, the countries, and **Egypt's crisis line now filled in** |
| `/admin/taxonomy` | owner | The categories an operator edits |
| `/admin/content` | owner | The CMS, with the published pages |
| `/admin/strings` | owner | The interface dictionary, overridable |
| `/admin/announce` | owner | An announcement drafted |
| `/admin/errors` | owner | 🔴 Whatever broke during the run. **An empty errors page after three months of agents is a finding, not a pass** |
| `/admin/tv` | manager | The wallboard |

**Twenty-four pages, one frame each, at month 3**, plus the four money moments and the
rejection cycle below. They go in `docs/walkthrough-3/m3/op-nour/` named for the page.

🔴 **The console is only worth photographing full.** A dashboard with three months of real
trading behind it is the single most convincing frame this run can produce, and it is the one
the last two walkthroughs never took.

### And the money moments get their own frames, before and after

These are named because they are the ones a still photograph cannot be re-taken for:

1. `T2`'s held balance, then the same screen after Stripe verifies him.
2. `E1`'s pot at healthy, at amber, at red, at zero, and after the top-up. **Five frames.**
3. `T2`'s billing on the day he moves from metered to monthly.
4. `T1`'s payout request, then the operator's queue, then her stamped record.

### 🔴 And two sequences that are new, and are the reason this run exists

**The rejection cycle.** `T4`'s thirteen steps from `01-SEED.md`, and these five frames in
particular, because between them they are the whole feature:

| Frame | What it has to show |
|---|---|
| `t4-omar/rejected-1-his-screen.png` | The operator's reason, **word for word**, on his own onboarding page |
| `op-nour/reject-and-clear-warning.png` | The reviewer's card, before the second no, saying what the second no will do. 🔴 Committed, like the rest of the console, once `verify:synthetic` passes |
| `t4-omar/documents-gone.png` | Empty slots with a sentence explaining that we removed them, not that they failed to upload |
| `t4-omar/invited-but-refused.png` | 🔴 Inside a practice, holding a seat, and still refused at the gate |
| `t4-omar/approved-at-last.png` | Working, with the count still at two |

**The money, as the operator reads it.** Not a query pasted into a report:

| Frame | What it has to show |
|---|---|
| `op-nour/vault-months.png` | The month table: three rows, subscriptions, session fees, income, model spend, left over. Committed, and transcribed into `MONEY.md` as well, because a figure in a report can be searched and a figure in a screenshot cannot |
| `op-nour/usage-cost-per-session.png` | What a session costs to run, beside the consent rate |

## The database at each checkpoint, in words

`db/m3.md` is not a dump. It is the answer to *what did this business look like in month
three*, written from real queries:

- Therapists on the platform, verified, on the radar, **and rejected**
- Patients, with and without accounts
- Sessions: total, by therapist, by rail, transcribed versus not
- Money: collected, held, paid out, our share, **and what the models cost that month**
- Employers: pots funded, spent, remaining, coverage rates
- Clinics: seats, bills
- **And the three numbers that are easy to get wrong**: how many patients have an account,
  how many sessions had recording on, and how many notes are still unapproved

## Arabic

**Not a full second pass.** A full Arabic run of twenty-two people at three checkpoints is
twice the frames for one tenth the new information.

Arabic captures **the patient app and the public site, in full, at month 3**, plus
**`P1` Layla at every checkpoint**, because she uses this product only in Arabic and her
history is the only honest test of whether three months of it reads correctly right to left.

🔴 **And one frame that did not exist before**: Layla's SOS sheet, in Arabic, showing
Egypt's line. The number is 105 and under it the instruction to press 1 for Arabic and then
1 for mental health, in Arabic. Until this sprint that sheet had no number on it at all for
an Egyptian reader. It is the single most important thing in the Arabic pass.

Every Arabic frame is checked for three things: direction, dates, and whether any English
leaked through. **Dates are a known gap** and are expected to be wrong; photograph them
anyway, because a known gap with no picture of it never gets fixed.

## Volume, and the cap

Roughly 30 screens per checkpoint across the cast, three checkpoints, plus the **24 console
pages at month 3**, the money moments, the rejection cycle and the Arabic subset. **Expect
330 to 480 frames.** If it is heading past 650, the capture is photographing states rather
than people, and the fix is fewer screens per person rather than fewer people.

Phone width for the patient app and the public site. Desk width for the consoles. A practice
manager reading a bill at 390px is not how anybody reads a bill.

## The video scripts, rewritten

`docs/walkthrough-archive/SCRIPT-EN.md` and `SCRIPT-AR.md` were written against a product
that had one therapist and one patient in it. **They are stale and they are to be replaced,
not edited**, by scripts written against what this simulation actually produced.

Five cuts, and each one is a story the simulation can now tell honestly because it happened:

| Cut | The story | Frames it is built from |
|---|---|---|
| **The patient** | Layla finds somebody free at 2am with no account, and three months later owns her record and takes a therapist's access back | `p1-layla/` at m0, m1, m3 · the Arabic pass |
| **The therapist** | Amira's first free session in month 0, and her month-3 earnings screen with a payout on it | `t1-amira/` across all three |
| **The employer** | A pot funded, spent, run dry, topped up, and never once naming a person | `e1-cairo-foundry/` and the five pot frames |
| **The wall** | What a practice and an employer are shown, side by side with what they are never shown | The standing bars, the two-column comparisons, the failed attempts |
| 🔴 **The gate** | A clinician turned down twice, invited by a practice, and still not let near a patient until somebody checked his licence | The five `t4-omar/` frames |

Write them from the frames that exist. **A script describing a shot nobody took is the
thing these two files became last time.**

## The discipline on every frame

- Taken **after** the action and after the page settles.
- Named for what it shows, not for the step number.
- **Never retouched, never staged.** A frame showing a bug is worth more than a frame showing
  the product working, and both go in the folder.
- If a screen is broken, photograph the broken screen. That is the whole point.
