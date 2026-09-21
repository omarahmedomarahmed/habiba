# The redesign, and how to know it is finished

This answers three questions in order, because the third cannot be answered
before the first two.

1. How do you walk every path of every user type, including the edge cases?
2. What exists today, against what the redesign needs?
3. What breaks, and what does it cost to fix?

Everything here that states a fact about the current code was checked against
the code. Where it was not, it says so.

---

## 1. Walking every path: three instruments, not one

The question was whether this is the simulation or something else. It is
neither one thing nor the simulation alone. There are three instruments and
they answer different questions. Using one and calling it coverage is how a
green run comes to mean nothing.

### The inventory: what EXISTS

Derived from source, never written by hand. `npm run admin:inventory` already
does this for the admin side: 32 pages, 153 controls, what each one is wired
to. It answers *what are all the paths*, and you cannot walk every path until
something has enumerated them.

🔴 **Enumeration must be derived.** A hand written list of routes is wrong the
week after it is written, and every instrument below takes its list of places
to go from this one. `verify:contrast` went green over nine therapist pages it
had never loaded, and separately reported a whole page of money as fine because
`/earnings` was missing from a hand typed array.

**Gap:** the inventory covers admin only. It must cover all five portals.

### The crawler: does every path RENDER, for every kind of person

Breadth. `verify:contrast` already signs in as five people and walks 44
destinations in two languages at two widths. Today it measures contrast; the
same walk should assert the page answers 200, carries its controls, and has no
overlapping or clipped element.

🔴 **A crawler only sees what the data renders.** This is not a small caveat.
A defect in 14 files was invisible on localhost and found on production,
because the demo data had no therapist without a photo. Green means *nothing
visible today was wrong*.

### The simulation: does it hold up over TIME

Depth. Agents behaving like people across months, writing real rows. This is
the only instrument that finds defects made of *duration*: a bill that goes
overdue, a pot that empties, a verification that expires, a subscription that
renews into a changed plan. No crawl finds those, because a crawl has no
yesterday.

### What none of them do: enumerate edge cases

An edge case is not found by walking. It is found by writing down a state
machine and asking which arrows are missing.

**Done.** `lib/lifecycle/machines.ts` holds eleven machines, 48 states and 51
transitions, each anchored to its schema constant so the declaration cannot go
stale without `verify:machines` saying so. `npm run lifecycles -- --write`
renders them into `docs/LIFECYCLES.md`, which ends with the two tables the desk
works from: every way a person is stopped, and every promise we have made. The
gate asserts fifteen things; the five that matter:

| Property | The defect it catches |
| --- | --- |
| The declared states ARE the schema's, both directions | A screen built for a status the database cannot hold |
| A state's kind matches its arrows | A stuck state hiding behind the word "success" |
| Every stopped person has a way out | A rejection that ends the story |
| A path a state names is a real route | A machine that still points at a page the admin rewrite renamed |
| A block only WE can lift says how long | A person waiting on a desk with no stated limit |

#### What it found on the first run

Eleven states failed the kind check, and the finding was not eleven typos. The
vocabulary had two words, `success` and `dead-end`, and they were answering two
different questions at once: can the row still move, and is the person stopped.

Those are independent, and the pair with no name was the one that matters.
There are now five kinds, and `blocked` is the register: **the person is
stopped and the row can still move**. Whether they are stuck or merely delayed
is decided by who owns the arrow out.

That distinction found the real defect. `sponsor:suspended` is the only state
in the product where a person is stopped, the only way out is staff restoring
them, and nothing said how long that takes. It had read as fine for as long as
it sat next to `closed` under one word. It now carries a one working day
promise, which is a commitment the desk has to meet rather than a description
of what happens today.

#### And the second finding, which is #166's brief

Sixteen states carry a promise. Two of them are not promises:

| Lifecycle | State | What it says |
| --- | --- | --- |
| grant | `pending` | until the employer answers |
| sponsor | `held` | until we have called them |

Neither names a span, so nothing can age past it and there is nothing for an
alarm to fire on. A patient waiting on their employer's approval and a company
waiting on our sales call are both in a state with no stated end, which is the
precise shape of the message we do not want to receive. `docs/LIFECYCLES.md`
marks them in its own promise table, computed rather than listed, so they stay
visible while #166 is built rather than being discovered by the first person
who waits a fortnight.

🔴 **The way-out property is the entire "never stuck" problem**, and this is
where the edge cases come from. Task #163 is now a list to fill, not a list to
invent. Twelve declared ways to be stopped: seven where the row is over and the
exit is a fresh one, five where the row can still move. Of those five, three
the person can take themselves, one waits on a clock, and one waits only on us.

### So the order is

```
inventory  ->  state machines  ->  crawler  ->  simulation  ->  deliberate failure
what is     what can happen     does it     does it hold    does it break
there                           render      over months     well
```

Deliberate failure (#149) is last and is the one that gets skipped. It is also
the one that proves the never-stuck work, because it is the only pass that
creates the states staff have to rescue people from.

### Does any of this guarantee it works

No. It raises the floor and shortens the time to knowing. Three times in one
session a check in this repository reported green while looking at nothing: a
crawler signed out and measuring login redirects, a modal hiding the page
behind it, a counter that silently stopped counting. Every one was a passing
test that meant nothing.

The useful question is not *is it perfect*. It is **when it breaks, how fast do
we know, and can the person get unstuck without us.**

---

## 2. What exists, against what the redesign needs

Checked against the code. Anything marked UNVERIFIED was not.

### Company self-serve sign-up

**Spec:** contact name, work email, phone, country, title from a dropdown,
department, company name, password. Instant account. They navigate a portal
where every page says "waiting approval". Admin is notified, calls them,
approves. The banner turns green without a refresh. Then "complete setup".

**Today:** `/sponsor/apply` is an *enquiry form*. It collects a name, kind,
contact name, email, phone and best time to call, and sends it. It creates no
account, no password and no portal state. There is no "signed in but not
approved" anywhere in the product.

**Distance:** large. This is a new account type, a new lifecycle state, and a
third chrome state.

🔴 **And it collides with a documented rule.** `lib/data/sponsor-admin.ts`
carries 74.5: which legal entity bills a customer is *an operator's decision
and not a form field*, because it is a tax question answered by a person who
has seen the paperwork, and it is refused once money has moved. A self-serve
sign-up must not let the company choose or imply its entity. The "waiting
approval" state is actually the right shape for this, as long as entity
assignment stays in the approval step.

### Clinic self-serve sign-up and the therapist upgrade

**Spec:** one sign-up, two modes. "I am a therapist" buys one seat. "I am a
clinic" buys at least two, takes clinic name, address, licence number and
image, and grants access immediately without gating. Separately, an existing
therapist can upgrade: their portal grows clinic tabs, and loses them again
once they assign a clinic admin who accepts.

**Today:** `/clinic/apply` exists and is the same enquiry shape. The upgrade
path does not exist.

**DECIDED: two accounts, one sign-in.** The clinic surfaces stay in
`(clinic)` and never appear inside `(app)`. A person who is both a clinician
and a practice manager holds two principals and switches between them;
`app/(app)/switch-principal` is the mechanism. The therapist portal never grows
a clinic tab, and no shell asks what kind of person is reading it.

What "upgrade" means under that decision: it creates the clinic and the
manager principal, links them to the same sign-in, and drops the person into
the clinic context. It does not change the therapist portal at all.

🔴 **This decision is what keeps the rule below true**, and the rule is the
strongest one in the clinic code.
`app/(clinic)/layout.tsx` states it plainly:

> "The therapist portal minus every clinical surface" is a different product,
> not the same one with things hidden. Reusing `(app)`'s layout with
> conditionals would mean the clinician's shell asking "is this a practice
> manager?" on every render, and the day somebody adds a nav item without
> reading the conditional, a practice manager has a link to a caseload. Hidden
> is one bug away from visible.

The spec's first sketch asked for exactly that conditional: a therapist portal
that sometimes carries clinic tabs. Two accounts behind one sign-in avoids it
entirely, which is why that is the decision above.

🔴 **What still has to be proved, because the decision does not prove it.**
Two principals on one sign-in is only safe if the switch is a real boundary.
Before this ships: a clinic principal must not be able to read a caseload by
holding a therapist session cookie, and `verify:sprint54`'s sweep for clinical
words has to run against the switched state as well as the clinic one. The
decision removes the conditional from the shell; it does not remove the need to
check what each principal can reach.

### Payout when a therapist is inside a clinic

**DECIDED.** The therapist holds their own bank details and requests their own
payout. The clinic sees it and may endorse it. **If the clinic does nothing for
three days the request reaches us anyway.** A clinic cannot hold a clinician's
money by inaction, and a clinic never puts its own account details against
another person's earnings.

🔴 **ESCALATION IS NOT APPROVAL.** After three days the request enters OUR
queue; it does not pay itself. The clinic loses its veto, not the money, and we
still approve every payout by hand. Anything that auto-pays on a timer is a
defect, not a feature.

**What exists today, and it is less than the rule assumes.** `PAYOUT_STATUSES`
is `requested, approved, sent, confirmed, rejected`, and `approved` means *we*
approved it: `approvePayout` is called only from
`app/(admin)/admin/payouts/actions.ts` with an `approverUserId` from staff.

🔴 **There is no clinic step at all.** The clinic's earnings page does not
mention payouts. So this is not "add a timer to an existing hop", it is:

1. A clinic-visible view of its clinicians' payout requests.
2. A clinic decision recorded on the request, distinct from ours.
3. The three day clock, and what the request looks like while it runs.
4. The escalation, which moves it into our queue with the clinic's silence
   recorded as the reason.

The status list needs one more state between `requested` and `approved`, or a
nullable clinic decision on the row. A new state is clearer: `requested` is
what the therapist did, the new one is what the clinic did, `approved` stays
what we did. Three parties, three records, and no column that means two things.

`payout_status_events` already records how a request reached its status, so the
escalation has somewhere honest to say "nobody at the clinic acted for three
days" rather than appearing as a silent state change.

### Bills when a therapist joins a clinic

**Spec:** the clinic covers unlimited from the join date. Past due bills stay
with the therapist, are visible to the clinic, and the therapist can pay them.
A therapist already on $80 solo who joins is not refunded or prorated; future
bills become $72 and are due from the clinic. The therapist may still pay their
own bill if the clinic has not.

**Today:** billing is organisation based (`lib/billing/service.ts`). Whether a
clinician inside a clinic can hold and pay a *personal* past due invoice is
UNVERIFIED and is the first thing to check, because the whole spec rests on it.

Note this already has a neighbour: task #20 covers a therapist leaving a clinic
and dropping to pay as you go, and #21 covers proration when a solo therapist
becomes a clinic mid month. The spec says do *not* prorate. That is a change to
#21's rule, not a new rule, and #21 should be re-read before anything is built.

### The patient profile

**Spec:** the most important surface in the product. Name, an AI summary
assembled only from real sessions and never invented, journals, homework,
assessments, and who has access at the *bottom*. The summary is written by the
AI, shown to the therapist, editable by them after each session, and the
copilot challenges an edit that contradicts the transcript. Every approved
version is kept and shown to the patient as progress.

**Today:** `/patient/profile` exists. The spec's summary lifecycle does not.

🔴 **This is a clinical governance surface, not a profile page.** A record the
patient reads, the therapist edits, and an AI challenges needs: who approved
this version, when, on what evidence, and what the patient may see. The product
already has strong rules about who may read a note and what a clinic may never
see (C260, C262, C263). Any summary that is shown to a patient and derived from
a transcript has to be checked against them before a line is written.

### The patient app radar, and one of these is mine

**Spec:** the in-app radar should be the 3D globe with filters below, not a 2D
map.

**Today, and this needs separating:**

- `/patient/radar` renders `RadarConsole`, which renders the real `Globe`. It
  is correct.
- `components/demo/patient-app.tsx`, the *mockup* on the marketing pages,
  renders `WorldRadar`, the flat dot map.

🔴 **I introduced that.** Earlier in this work I added a radar tab to the
patient mockup and used the flat map rather than the globe. The screenshot that
prompted the note was the marketing mockup, not the app. The app is fine; the
mockup should be switched to `Globe` or the two will keep disagreeing.

### The rest of the patient app

Navy hero instead of teal, horizontal scrolling sections, a 3 by 3 grid of the
nine most common presentations drawn from the radar filters, a bigger lifted
radar button, and pages that stop looking identical to each other. These are
straightforward and mostly in `components/patient/` and `app/(patient)/`. The
palette rules now hold them: `verify:palette` will refuse white on the light
teal, and `verify:contrast` will measure whatever replaces it.

### The admin side

**Spec:** far fewer pages, each with tabs. Users (with a tab per type),
Sessions (filterable), Money (payouts, transfers, AI usage, revenue), and Total
View as the home that shows everything and alerts.

**Today:** 32 pages, 153 controls, none of them dead. Eight pages carry no
controls at all and exist only to show a list. Ten pages carry 118 of the 153
controls between them. `/admin` is a small stats overview and `/admin/tv` is
the Total View, so the spec's "TV is the home" is a move, not a build.

The consolidation the inventory supports:

| New page | Absorbs |
| --- | --- |
| Total View (home) | `/admin`, `/admin/tv` |
| Users | therapists, patients, clinics, sponsors, partners, verifications, benefits |
| Sessions | usage/sessions, ratings, checkins, radar investigate |
| Money | payouts, transfers, vault, actuals, financial-model, usage |
| Content | content, strings, taxonomy, announce |
| System | settings, audit, errors, numbers, support |

32 to 6. Every absorbed page becomes a tab, and no control is dropped without
being named in the commit that drops it.

---

## 3. What breaks

### Gates and verifiers that will fail, and why

| What | Why it breaks | Fix |
| --- | --- | --- |
| `verify:contrast` | Hard coded path list per persona; every renamed admin route 404s, and the check is a failure by design | Take its paths from the inventory instead of a literal |
| `verify:runbook` | Derives counts from `_gates.ts` and documents; a new gate or route count goes stale | Already self correcting, but the docs it reads need updating in the same commit |
| `verify:sprint53` (88 checks) | Sponsor portal structure; a pre-approval state is a new shell state it does not know | Extend rather than relax. The wall checks must still hold in the new state |
| `verify:sprint54` (39 checks) | Renders `ClinicChrome` off route and sweeps for clinical words. A therapist portal with clinic tabs would need this sweep applied to `(app)` too | Widen the sweep before the merge, not after |
| `verify:sprint65` 65.12 | Asserts the wall is in the chrome of both admin portals | A tabbed consolidation must keep the wall in the shell |
| `verify:palette` | File level teal allow list, by path | Update the list when files move |
| `verify:machines` | Every `screen` naming a renamed route fails on the same run as the rename | That is the point; fix the machine in the commit that moves the page |
| `npm run inventory` | Nothing, it derives | Re-run it after every move; the diff is the review |

### The three that are not test problems

🔴 **The clinic and therapist portals are separated on purpose.** The upgrade
flow asks to merge them conditionally. That is the one change in this spec that
can leak a caseload to a practice manager. It needs an architecture decision
before any code.

🔴 **Entity assignment cannot become a form field.** Self-serve company sign-up
must leave it to the approval step, or an Egyptian company lands on the US
entity and is offered a card it cannot use. That exact defect already happened
once (74.5).

🔴 **A patient-visible clinical summary is new governance.** Derived from
transcripts, edited by a therapist, challenged by an AI, shown to the patient.
Before any of it: which existing consent covers showing it, and what happens
when a patient disputes a version.

---

## 4. Order of execution

**Phase 0, know what is there.** DONE. `npm run inventory` walks all seven
portals: 125 pages, 570 controls, none dead. `verify:machines` holds eleven
lifecycles, 48 states, 51 transitions, anchored to the schema and to the route
list, rendered for reading by `npm run lifecycles`. Everything below takes its
list of paths and its list of states from these two.

**Phase 1, the never stuck spine.** #163 stuck register, #164 dead ends,
#165 `/admin/stuck`, #166 the clock, #167 staff unblock. This is what makes
round the clock staffing into a guarantee rather than a rota, and every flow
added later plugs into it.

**Phase 2, the admin consolidation.** 32 pages to 6. Do this before adding
pages, which was the instruction. Users first, then Money, then Sessions, then
Total View as home.

**Phase 3, the flows.** Company self-serve, clinic self-serve, the upgrade, the
payout decision, the bill inheritance. Each one needs its state machine from
Phase 0 first.

**Phase 4, the patient app.** Profile, summary lifecycle, homepage, navy hero,
scrolling sections, the grid, the globe in the mockup.

**Phase 5, prove it.** The nine cycles, #149 first. Then the six months.

Phases 1 and 2 can run beside each other. Phase 3 cannot start before its state
machines exist. Phase 5 is not a phase you skip because the earlier ones went
well.
