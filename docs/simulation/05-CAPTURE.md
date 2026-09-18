# What is photographed, and where it goes

**Read by every agent.** The frames from this run are committed to the repository and are the
raw material for the video, so they are content as well as evidence.

## The shape on disk

```
docs/simulation-run/
  m0/  m1/  m3/  m6/            one folder per checkpoint
    t1-amira/                   one folder per person, named for who they are
      dashboard.png
      patients.png
      earnings.png
      billing.png
      ...
    p1-layla/
    c1-nile-practice/
    e1-cairo-foundry/
    op-nour/                    the whole console, 25 pages, committed
  tv/
    week-01.png … week-26.png   the board, once a week, all six months
  db/
    m0.md  m1.md  m3.md  m6.md  the database at each checkpoint, in words
  ar/                           the Arabic pass, same shape, named subset only
  REPORT.md                     the findings
  MONEY.md                      the reconciliation from 03-THE-MONEY.md
  DEV-LOG.md                    the CTO's log
  BLOCKED.md                    anything an agent could not get past
  COPILOT.json  COPILOT.md      the exam
  COPILOT-PROGRESSION.md        did it learn, in the copilot's own words
  PHYSICS.json                  the fitted cost model
  SCRIPT-EN.md  SCRIPT-AR.md    the video scripts, written against this run
```

**Name folders for people, not for principals.** `t1-amira/` is a person somebody can follow
across four checkpoints. `therapist-1/` is a row.

## The rule that makes this worth doing

> **The same person, on the same screens, at four points in their history.**

A gallery of every screen at one moment is what the last two walkthroughs produced. It cannot
show the thing that matters about this product: **that a therapist's earnings screen means
something different in month 6 than it did in month 0**, because by then there is a history
behind it.

So the capture list is per person and it is the same list every time.

## What each person's checkpoint captures

| Who | Screens, every checkpoint |
|---|---|
| **Therapist** | Dashboard · patients · one patient's record · sessions · one approved note · bookings · **earnings** · **billing** · settings showing the fee split · radar state |
| **Patient** | Home · sessions · one summary written to them · journal · steps · **billing, showing what they paid and what was covered** · who can read their history · record |
| **Practice** | Overview · people · **team and delegated powers** · schedule · **bills** · earnings · records connection |
| **Employer** | Overview · **the pot meter** · weekly spend · people enrolled · the code · the standing "we never show you" bar |
| **Partner** | Keys · **usage against the limit** · deliveries |
| **Operator** | Every page of the console, and they **are** committed this time. Its own section below |

---

## The whole operator console, committed

C80 has said since sprint 52 that admin frames are **never** committed. Its reason was
disclosure: a console shows many people at once, and this repository is treated as if it will be
public one day, so one real name in one frame cannot be recalled.

**That reason is about real people. This run has none.** Every surname is Demo or Example and
every address is at a domain RFC 2606 reserves, which cannot reach an inbox and therefore cannot
belong to anybody.

So the precondition is **proved rather than assumed**:

```
npm run verify:synthetic
```

It reads every surname and every email column in the schema, discovered from `information_schema`
rather than from a list, and plants a real looking name to watch itself catch one. **No operator
frame is committed until it passes**, and it is run again immediately before the commit, because
a name that arrives after it passed is a name nobody checked.

### The twenty five pages, and the three roles that see them

Most captures photograph a console as the owner and call it done. This one has **three
audiences**:

| Guard | Pages | Who that is |
|---|---|---|
| `requireStaff()` | verifications, payouts, numbers, support, **transfers** | the 24/7 team |
| `requireManager()` | tv | anybody senior enough to read the board |
| `requireRole("super_admin")` | the other nineteen | us |

**Photograph the five staff pages signed in as staff**, not as the owner, or the capture shows
a console nobody on the rota actually sees.

| Page | Seen by | What the frame has to show |
|---|---|---|
| `/admin` | owner | The dashboard with six months behind it, not an empty state |
| `/admin/tv` | manager | **The board, whole.** Its own weekly series as well |
| `/admin/verifications` | staff | The queue, and `T4`'s card at the second rejection with the "Reject and clear" warning on it |
| `/admin/transfers` | staff | The queue with a real wait in it, and the row that was rejected with its reason |
| `/admin/payouts` | staff | `T1`'s Egyptian manual payout, before and after the stamp |
| `/admin/numbers` | staff | The number change queue |
| `/admin/support` | staff | A ticket answered |
| `/admin/vault` | owner | The month table: subscriptions, session fees, income, model spend, left over. The acceptance test in `03-THE-MONEY.md` |
| `/admin/usage` | owner | Cost per session and the consent rate beside it |
| `/admin/financial-model` | owner | The forecast **after Measure and freeze has been pressed**, so the provenance bar says this database rather than the shipped estimate |
| `/admin/therapists` | owner | Seven clinicians, one of them twice rejected |
| `/admin/clinics` | owner | Nile Practice, approved, three seats, on the `eg` entity |
| `/admin/sponsors` | owner | Three employers, one pot empty and one at 10% |
| `/admin/benefits` | owner | What a sponsor's people are entitled to |
| `/admin/partners` | owner | Helio Health, its keys and its rate limit |
| `/admin/radar` | owner | The radar command view with `T3` on it |
| `/admin/ratings` | owner | What patients said |
| `/admin/checkins` | owner | The check in schedule |
| `/admin/audit` | owner | The rejection and the deletion, in the log, with the operator's name |
| `/admin/settings` | owner | The prices, the pounds per dollar rate, the bank details, and **Egypt's crisis line filled in** |
| `/admin/taxonomy` | owner | The categories an operator edits |
| `/admin/content` | owner | The CMS, with the published pages |
| `/admin/strings` | owner | The interface dictionary, overridable |
| `/admin/announce` | owner | An announcement drafted |
| `/admin/errors` | owner | Whatever broke during the run. **An empty errors page after six months of agents is a finding, not a pass** |

**Twenty five pages, one frame each, at month 6**, plus the money moments and the rejection
cycle below. They go in `docs/simulation-run/m6/op-nour/`, named for the page.

**The console is only worth photographing full.** A dashboard with six months of real trading
behind it is the single most convincing frame this run can produce, and it is the one the last
two walkthroughs never took.

---

## The board, weekly, for six months

The Total View watcher (`02-THE-SWARM.md`) produces its own series, and it is the only part of
the capture that is a time series rather than four checkpoints.

```
docs/simulation-run/tv/week-01.png  …  week-26.png
```

Each week: the whole board, then each of the nine sections expanded and collapsed. **Twenty six
weeks of the same screen** is the only artefact in the run that can answer whether a founder
could have seen a bad month coming.

---

## The money moments, before and after

Named because a still photograph cannot be retaken for them:

1. **The three invoices.** A therapist's **free** first one (zero, and it says why), their
   **half price** one a wave later (list price, discount line and payable amount, all three
   visible), and the **full price** one in wave 4 with **no discount line at all.** The third is
   the single most important frame in the run.
2. **The post beta invoice.** `T5` and `T6` join after the offer closes and get one free month
   then full price. Two people see it, so it reads as a rule.
3. **`E1`'s pot** at healthy, at amber, at red, at zero, and after the top up. **Five frames**,
   plus the patient's "Account on hold, ask HR to activate" screen at the moment it empties.
4. **`T2`'s billing** on the day he moves from metered to a plan by transfer: the bill raised,
   the transfer waiting, and the plan live only after the operator confirms.
5. **`T1`'s payout** request, then the operator's queue, then her stamped record.
6. **`T1`'s earnings against her bill**: $255 net beside an $80 invoice, in one frame if the
   screens allow it.

Automatic promotional billing is **not built**. `discount_cents` and `discount_reason` exist; the
schedule does not. An operator applies each one by hand from `/admin/therapists`. **Record how
long that takes.** It is the first thing to build after the beta.

---

## The rejection cycle, five frames

`T4`'s thirteen steps from `01-THE-CAST.md`, and these five in particular, because between them
they are the whole feature:

| Frame | What it has to show |
|---|---|
| `t4-omar/rejected-1-his-screen.png` | The operator's reason, **word for word**, on his own onboarding page |
| `op-nour/reject-and-clear-warning.png` | The reviewer's card, before the second no, saying what the second no will do |
| `t4-omar/documents-gone.png` | Empty slots with a sentence explaining that **we** removed them, not that they failed to upload |
| `t4-omar/invited-but-refused.png` | Inside a practice, holding a seat, and still refused at the gate |
| `t4-omar/approved-at-last.png` | Working, with the count still at two |

---

## The database at each checkpoint, in words

`db/m6.md` is not a dump. It is the answer to *what did this business look like in month six*,
written from real queries:

- Therapists on the platform, verified, on the radar, **and rejected**
- Which way each one pays us: **on a plan, or metered**
- Patients, with and without accounts
- Sessions: total, by therapist, by rail, transcribed versus not
- Money: collected, held, paid out, our share, **and what the models cost that month**
- Employers: pots funded, spent, remaining, coverage rates
- Practices: seats, bills
- **And the three numbers that are easy to get wrong**: how many patients have an account, how
  many sessions had recording on, and how many notes are still unapproved

---

## Arabic, and the language switch

The product is **English first with an Arabic switch on every page of every portal.** That is a
decision about the market: most Egyptians expect an app in English and want the choice, not a
forced Arabic page.

So the Arabic pass is **not a full second run.** A full Arabic pass of twenty customers at four
checkpoints is twice the frames for a tenth of the new information.

Arabic captures:

1. **The patient app and the public site in full, at month 6.**
2. **`P1` Layla at every checkpoint**, because she uses this product only in Arabic and her
   history is the only honest test of whether six months of it reads correctly right to left.
3. **The switch itself, on one page of every portal.** Patient, therapist, practice, sponsor,
   partner, admin and the session room. Seven frames, and they exist to prove the corner is
   actually there rather than there on the pages somebody remembered.
4. **Layla's SOS sheet, in Arabic, showing Egypt's line.** The number is 105 and under it the
   instruction to press 1 for Arabic and then 1 for mental health, in Arabic. Until this sprint
   that sheet had no number on it at all for an Egyptian reader. **The single most important
   thing in the Arabic pass.**

Every Arabic frame is checked for three things: direction, dates, and whether any English leaked
through. **Dates are a known gap** and are expected to be wrong. Photograph them anyway: a known
gap with no picture of it never gets fixed.

---

## Volume, and the cap

Roughly 30 screens per checkpoint across the cast, four checkpoints, plus the 25 console pages at
month 6, the 26 weekly board frames, the money moments, the rejection cycle and the Arabic
subset.

**Expect 400 to 550 frames.** If it heads past 700 the capture is photographing states rather
than people, and the fix is fewer screens per person rather than fewer people.

Phone width for the patient app and the public site. Desk width for the consoles. A practice
manager reading a bill at 390px is not how anybody reads a bill.

---

## The video scripts

`docs/walkthrough-archive/SCRIPT-EN.md` and `SCRIPT-AR.md` were written against a product with
one therapist and one patient in it. **They are stale and they are replaced, not edited**, by
scripts written against what this run actually produced.

Five cuts, each a story the run can tell honestly because it happened:

| Cut | The story | Frames it is built from |
|---|---|---|
| **The patient** | Layla finds somebody free at 2am with no account, and six months later owns her record and takes a therapist's access back | `p1-layla/` at m0, m1, m3, m6 and the Arabic pass |
| **The therapist** | Amira's free first month, and her month 6 earnings screen with a payout on it and a bill she can cover | `t1-amira/` across all four |
| **The employer** | A pot funded, spent, run dry, topped up, and never once naming a person | `e1-cairo-foundry/` and the five pot frames |
| **The wall** | What a practice and an employer are shown, side by side with what they are never shown | The standing bars, the two column comparisons, the failed attempts |
| **The gate** | A clinician turned down twice, invited by a practice, and still not let near a patient until somebody checked his licence | The five `t4-omar/` frames |

Write them from the frames that exist. **A script describing a shot nobody took is what these
two files became last time.**

---

## The discipline on every frame

- Taken **after** the action and after the page settles.
- Named for what it shows, not for the step number.
- **Never retouched, never staged.** A frame showing a bug is worth more than a frame showing the
  product working, and both go in the folder.
- If a screen is broken, photograph the broken screen. **That is the whole point.**
