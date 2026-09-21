# From here to a product that works end to end

Written after five agents walked production for four hours and found eleven defects that 2,175
existing checks had missed. The order below is not arbitrary: it is safety first, then the
instruments that make every later fix provable, then the defects, then the redesign, then the
whole thing verified as one motion by a full cast of agents, and only then the six-month run.

The rule underneath all of it: **a fix is not done until something that would have caught it
exists and has been shown to fail without it.** Every phase ends with a gate, and every gate has
a control.

---

## Phase 0 — Stop the bleeding

Four defects that would hurt a real person. Nothing else starts until these are closed.

| # | What | Why first |
|---|---|---|
| 123 | In-person sessions recorded and transcribed with **no consent**, and the note says they were not recorded | An unconsented clinical recording is the one defect that is a legal problem, not a bug |
| 122 | A modal covering "Go in now" ends in a clinician **banned for three days** for a room they were trying to enter | It took the whole radar down once already tonight |
| 124 | A rejected transfer is a **dead end** and nobody is told — the payer has sent real money and has no route back | Money already left somebody's bank |
| 117 | An anonymous session ends with **no patient record**, permanently, and no AI memory | Unrecoverable by design; every hour makes more of them |

**Gate:** each of the four gets a check that fails when the fix is reverted. No exceptions.

---

## Phase 1 — Build the instruments

Two suites and one gate. This is the phase that changes what every later phase costs, because
after it a defect is caught by a machine rather than by an agent or by you.

### 1a. The structural crawler — one day

Visits all **129 pages** as each of **8 user types** and asserts invariants that do not need
anybody to have thought about that page:

- exactly one `h1`, and it is not the site name
- every nav item resolves to a page that is not a 404 and not a redirect loop
- no link pointing at a route the current user type cannot reach
- no untranslated key, in either language
- no empty state occupying more than a third of the viewport
- no text below the contrast floor
- renders at 390px with no horizontal scroll
- renders in Arabic with RTL correct

**This is the thing that answers "every missing button and title on every page".** The existing
acceptance verifiers cannot, and never will.

### 1b. Journey suites — two days

Every finding from tonight graduates into a deterministic scripted cycle, two browsers, real
sign-ins, asserting against rows. Reuses `.render/drive.mjs` and `.render/pair.mjs`, which
already work. One file per journey, run on demand and before a deploy.

### 1c. The sibling-path gate — half a day

Diff the field set that every creation path writes for the same table, and fail when one path
omits what its siblings set. This single check would have caught three defects already:

| path | missing vs its siblings |
|---|---|
| `bookSlot` | `joinToken` (found tonight), `sessionType`, `priceCurrency` (#126) |

**Gate for the phase:** the crawler reports a clean sweep, the journey suites pass, the
sibling gate fails on a deliberately removed field.

---

## Phase 2 — The remaining defects, by surface

Grouped so one person stays in one part of the code, each group ending in the journey suite that
covers it.

**Money and payments** — #116 price shown ≠ price collected, #125 minimise kills the poll, #126
wrong currency on future bookings, the payer-name fallthrough, the queue's unidentifiable rows
and irreversible confirm.

**The session** — #114 a signed-in patient cannot join their own live session, #115 the join link
does not survive a reload and invites silently fail, #120 the unwinnable "Try again", the
alert that fires on form-open and never on arrival.

**The radar** — the unbounded hold, the profile that says a clinician is taken by you, going
online while suspended, release leaving them offline, #121 the sweep's schedule.

**Scheduling** — cancellation stranding the hour and telling nobody, no reschedule, `/calendar`
404.

**Platform** — #118 skew protection, #119 two ways to become a patient.

---

## Phase 3 — The redesign

In the priority order already set: **patient first, company second, clinic third, partner last.**
Nothing here starts before Phase 2 for that surface is closed, because redesigning a broken
screen produces a prettier broken screen.

1. **The design system at `/design`** — the palette taken from the live site (`#0a2342` ground,
   `#2ec4b6` accent, retiring `#eaf0ff` as a surface), type scale, components, both themes. Every
   later screen is built from it.
2. **The patient app** — Home, Sessions, Therapists, Profile. Journal, history and billing move
   under Profile. An Edit gate. No unprompted change-your-number. Empty states that do not take a
   card. The dark ground and the green.
3. **The in-app radar** — map by default, every therapist including demo ones marked off shift,
   filters by language and specialty, a future booking from a profile, and parity with the public
   radar.
4. **The session room** — the dead space, the contradictory statuses, the two overlays in front of
   the form.
5. **The public homepage** — five heroes collapsed into one with left/right auto-rotation that
   stops on interaction; then "how it works" with two interfaces each for therapist, patient,
   company and clinic, two per row; then pricing, comparison, call to action.
6. **The company portal, in full** — the highest priority after the patient.
7. **The clinic portal.**
8. **The therapist calendar** — bookings visible without expanding a day.
9. **The partner portal** — last.

---

## Phase 4 — Full-cast cycle verification

Now agents, and only now, because agents are for finding what nobody thought to ask. Each cycle
runs with **a real agent per user type in the cycle**, not one agent pretending. Same machinery
that worked tonight: a shared board, the database as the baton, a coordinator whose job is
adjudication rather than assignment.

| # | Cycle | Cast |
|---|---|---|
| 1 | Booking, re-run | patient, therapist, admin, recorder |
| 2 | **Money** | company admin, covered patient, therapist, platform admin, recorder |
| 3 | **Clinical continuity** across three sessions | patient, therapist, recorder — does the copilot actually remember |
| 4 | **Crisis** | patient in distress, therapist, admin, recorder |
| 5 | **Onboarding** | new therapist, verifying admin, new company, new patient, recorder |
| 6 | **Clinic** | clinic manager, two therapists, two patients, admin, recorder |
| 7 | **Partner / EHR** | partner, therapist, patient, recorder |
| 8 | **Deliberate failure** | every type, with the video provider, the model and the database broken in turn |
| 9 | **Arabic, RTL, 390px** | every type |

Rules carried over because they earned their place: nobody serialises the agents (the worst bug
of the night surfaced because five shared one address); every claim is corroborated against a
row; a retraction is worth more than a clean report.

**Gate:** every cycle passes, and every new defect found becomes a journey suite before the next
cycle starts.

---

## Phase 5 — The six-month simulation

Only after Phase 4. Tonight's analysis says it would have died three ways with the code as it
was: the per-network hold cancelling paid sessions deterministically, the no-show sweep banning
clinicians until the radar emptied, and room-less sessions producing none of the AI output the
run exists to measure. Two of those three are fixed; the third is Phase 0.

Run it when the cycles are green, not before, because a simulation measures a product assuming
it works.

---

## What each phase costs

| Phase | Work | Calendar |
|---|---|---|
| 0 | 4 defects, one of them a product decision | 1 day |
| 1 | crawler, journey suites, sibling gate | 3-4 days |
| 2 | ~16 defects in 5 groups | 3-4 days |
| 3 | design system + 8 surfaces | the bulk of it |
| 4 | 9 cycles | 2 days of agent time |
| 5 | the run | as planned |

---

## The task list

Every phase above exists as tasks, with the blocking set so the order is enforced rather than
remembered.

| Phase | Tasks |
|---|---|
| 0 | 123, 122, 124, 117 |
| 1 | 127 crawler, 128 journey suites, 129 sibling gate |
| 2 money | 116, 125, 126, 132 |
| 2 session | 114, 115, 120 |
| 2 radar | 130, 121 |
| 2 scheduling | 131 |
| 2 platform | 118, 119 |
| 3 | 133 design system, 134 patient app, 135 in-app radar, 136 session room, 137 homepage, 138 company, 139 clinic, 140 therapist calendar, 141 partner |
| 4 | 142 booking, 143 money, 144 continuity, 145 crisis, 146 onboarding, 147 clinic, 148 partner, 149 deliberate failure, 150 Arabic and mobile |
| 5 | 151 |

Carried over and unscheduled: 52 real bank details, 104 remaining mockups, 105 email from the
console, 108 the email preview past the patient.
