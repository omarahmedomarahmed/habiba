# Execution plan — Personal Profile programme

Working document. Two sessions share it through git: one writes the plan,
another audits and builds, and both read the same file rather than talking past
each other.

- **Narrative version** (shareable, for humans outside the repo):
  https://claude.ai/code/artifact/f239c137-b334-46f3-9839-636367cea2b6
- **History, measurements and traps:** `DEVLOG.md`
- **This file:** what to build, in what order, and where to object.

**Baseline:** `main` @ `4a85e8c` · migrations `0000–0028` · Sprint 0 shipped ·
**109 tests across eight suites** — 60 run without a database, 49 need one.

*The "69 across six suites" this line used to claim was wrong. `radar.test.ts`
(27) and `e2e.test.ts` (13) were never in the standing check, and the 27 cover
`claimTherapist` — the exact primitive 1C.3 and 1D depend on. Found by the
audit, not by me.*

---

## How to use this file

| You are | You do |
|---|---|
| **Auditing** | Fill in §1 VERDICT. Raise anything in §2 CONCERNS. Do not edit the sprints |
| **Building** | Only after the verdict is read. Tick items in §3. Append to §4 as you go |
| **Reviewing** | Read §2 and §4 |

Commit whenever you write here. The commit is the notification — there is no
other channel between sessions.

---

# §1 · VERDICT

```
Status: AUDITED — source read, nothing executed (see C1)
Auditor session: claude/24therapy-rebuild-research-fkjen7
Date: 3 Sep
Commit audited: 3e2df61
```

**What was and was not run.** Dependencies installed after the first pass, so
the static checks *were* run and are reported below. There is still no
`.env.local`, so nothing that touches the database ran. See **C1**.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean — confirms DEVLOG's claim |
| `test` / `alarm` / `clock` / `toasts` / `transcribe` | ✅ **60/60** — 23 · 7 · 12 · 8 · 10 |
| `npm run build` | ⚠️ **compiles and typechecks clean in 29.7 s**, then fails collecting page data: `Missing required environment variable: DATABASE_URL`. Env-blocked, not code-blocked |
| `test:ledger` | ❌ 0 pass / 10 fail, all `DATABASE_URL`. *(DEVLOG says 9 tests; the runner reports 10 failures)* |
| `information_schema` migration checks | ❌ not run — **trap T1 is unverified this session** |
| Every claim in Sprint 1 needing real audio or real rows | ❌ not run |

So: the tree is healthy and the plan's *static* baseline is confirmed.
Everything the plan asks to be **measured** still is not.

| Question | Answer |
|---|---|
| Does the plan match the codebase? | Structurally yes. Every file, line number and absence it names is real — `client.ts:140`, `middleware.ts:62-67`, `ROLES` without `patient`, `Actor.organizationId: string`, no `people`/`historyGrants`/`availability_slots`/`scheduledAt`. It is wrong mainly about **how much already exists** and about **three cost estimates**. |
| What is already built that the plan thinks is missing? | **Ten more, on top of DEVLOG's list** — see table A. Two whole tickets (**1B.6, 1D.7**) are shipped; **1D.2/1D.6** are ~70% shipped; **5.4's** citation machinery already exists and resolves. |
| What is wrong, impossible, or costlier than stated? | Seven items — see table B. Two are `blocker` (**C1**, **C4**), three `major`. **1D.5 is a payments redesign**, `1.1`'s acceptance criterion is unachievable as written, and `3.2`'s nullable-org branch silently destroys a uniqueness guarantee. |
| What has the plan missed? | Table C. Chiefly: no worker infrastructure exists for 5.3; blob URLs are secrets, not access control, so 5.9's watermark/audit is bypassable; `copilot_threads` is one-per-patient **globally**, which blocks 7.5 and collides with Sprint 2; and Sprint 4 says nothing about what a grant does when a session is reassigned by 1D.4. |
| Is the sprint order right? | **Nearly. One real fault: 1B before 3.** 1B.3 builds a guest booking calendar; Sprint 3 gives patients accounts and rewires that same entry point. 1B is also `blocked` on Resend, which is not a code task. Move 1B after 3. Proposed: **1 → 1C → 2 → 3 → 4 → 1B → 1D → 5 → 5B → 6 → 7 → 8**. 2→3→4 as foundation is correct and I would not touch it. |
| Any settled decision you disagree with, with evidence? | **One, partly.** DEVLOG: *"Going offline is ungated and carries no penalty — not a risk."* True for the act it describes. But `suspendFromRadar` already penalises the **adjacent** act, and 1C.3 + 1B.5 would make going offline **automatic**. See **C9**. Deepgram, pinned language, `gpt-4o-transcribe`, emotion labels, couples therapy: **not re-opened, no new measurement offered.** |
| **Verdict** | ⚠️ **PROCEED WITH CHANGES.** Sprint 1 can start on 1.3/1.4/1.5 today. **1.1 and 1.2 cannot start until C1 is resolved** — neither can be done without database access, and 1.2 is a measurement ticket by its own wording. Re-scope 1D before Sprint 1D. Take the *separate identity* branch of 3.2, not the nullable one. |

### Table A · Already built — do not rebuild *(beyond DEVLOG's list)*

| # | Thing | Where | Ticket it closes or shrinks |
|---|---|---|---|
| A1 | **Mid-session warning, fully shipped and wired** — `WARNING_MINUTES = 5`, stages `closing`/`decision`/`wrapUp` | `lib/session-clock.ts:50`, `<SessionClockBar>` rendered at `components/session/session-room.tsx:410` | **1B.6 — nothing to build** |
| A2 | **No-show detection, penalty ladder and the clinician's email** — auto-files `session_reports.kind="no_show"`, first offence warns, second suspends | `lib/data/feedback.ts:702-792` (`sweepAbandonedPatients`), `:468` `suspensionFor`, `:474` `countNoShows`, `:488` `suspendFromRadar` | **1D.7 — shipped, wording included.** 1D.2, 1D.6 mostly shipped |
| A3 | It is **patient-poll triggered, not cron** — `markAbandonedIfWaiting` from `checkJoinState` | `lib/data/feedback.ts:814` | 1D needs **no scheduler**. Cheaper than it reads |
| A4 | **Two-track speaker attribution, exact** — a video session runs two recorders; `diariseSession` deliberately no-ops when it sees one | `lib/audio/recorder.ts:8-12`, `lib/ai/diarise.ts:98-100` | Scopes all of Sprint 1 attribution to **in-person / dropped-track only** |
| A5 | **Citations that resolve or are discarded** — `[S2:14]` refs validated against real rows; invented refs dropped | `lib/ai/patient-copilot.ts:26-32`, `Citation` type `lib/db/schema.ts:769` | **5.4 is an extension, not new machinery** |
| A6 | **Server-side TTS, same vendor, no new bill** — `gpt-4o-mini-tts` | `app/api/copilot/speak/route.ts` | 5.9's vendor question is answered — but see **C6** for its shape |
| A7 | **Client-side RMS + silence gating already in the recorder** | `lib/audio/recorder.ts:174,187-196` | **1.3 and 1.4 are ~30 lines in an existing file**, not new pipeline |
| A8 | **Refund with `reverse_transfer` + `refund_application_fee`** | `lib/billing/connect.ts:661-665` | The only existing lever for 1D.5 — see **C4** |
| A9 | `findPatientByEmail` | `lib/data/patients.ts:174` | 2.3's match primitive |
| A10 | `offRecordGaps` — gap analysis over segment timing | `lib/data/feedback.ts:440` | 1.4's pause-length descriptor, half done |

Also: **`tests/radar.test.ts` (27) and `tests/e2e.test.ts` (13) exist and are
not in the "69 across six suites" standing check.** Real total is 109. The 27
uncounted ones cover `claimTherapist` — the exact primitive 1C.3 and 1D depend on.

### Table B · Wrong, impossible, or costlier

| # | Ticket | Finding |
|---|---|---|
| B1 | **1.1** | Acceptance criterion **unachievable as written**. `MAX_SEGMENTS = 160` (`diarise.ts:46`); a 50-minute session at 8 s/chunk is ~375 segments, so the tail can *never* be attributed. Separately the two-track guard is all-or-nothing (`diarise.ts:98`) — a video session whose patient track dropped after two minutes has 2 attributed rows, 300 `unknown`, and is skipped forever. **Fix the function, then backfill.** Backfilling first bakes both holes in. |
| B2 | **1.2** | Contradicts its own sprint header (*"No vendor. No new bill. No BAA."*). Speaker embeddings are not in the OpenAI API; Deepgram is closed; self-hosting pyannote/ECAPA is a Python runtime Vercel does not have (**T13**). And per **A4** its value is confined to in-person sessions. Costlier and narrower than stated. |
| B3 | **1.5** | ✅ Confirmed exactly as described. `lib/ai/client.ts:138-142` hardcodes `RATES["gpt-4o-mini-transcribe"]` and never reads `input.model`. Real today. |
| B4 | **3.2 / 3.3** | Take the **separate patient identity**, not nullable `users.organizationId`. Evidence: `users_org_email_unique` is `(organization_id, email)` (`schema.ts:149-151`). **Postgres treats NULLs as distinct**, so a null org silently voids the index and one email can sign up without limit. Blast radius measured: **298 `organizationId` references** across `app/lib/components`, **148** actor-shaped. |
| B5 | **1D.5** | *"not a payments redesign"* — **it is.** The ordinary case is a Stripe **destination charge** (`connect.ts:439-448`): money lands in therapist A's connected account at checkout, before the session. There is no payable to re-point. `session_payments_session_unique` (`schema.ts:1351`) also permits only one payment row per session. **Recommendation with a one-parameter shape:** add `capture_method: "manual"` to `payment_intent_data` at `connect.ts:438` for radar bookings — authorise at booking, capture when the session actually *starts*. Then 1D.5 really is cheap. |
| B6 | **5.2** | Reverses a **documented** security decision without replacing its reasoning: *"PDFs are excluded deliberately: a PDF is a script host"* (`lib/uploads.ts:33-36`). Patient-uploaded PDFs are strictly worse than the clinician case that comment refuses; `.docx` adds macros. And raising the 8 MB cap collides with Vercel's ~4.5 MB request-body limit — see `MAX_BYTES = 4 * 1024 * 1024` in the transcribe route. Needs client-direct-to-blob upload, which is not in the ticket. |
| B7 | **5.3** | *"background worker"* — **there is no worker.** The only async primitives in the tree are `waitUntil()` and three daily Vercel crons (`vercel.json`). This is new infrastructure, not a sprint line item. |

### Table C · Missed entirely

| # | Gap |
|---|---|
| C-a | **`copilot_threads.patient_id` is NOT NULL and uniquely indexed on `patient_id` alone** (`schema.ts:764`) — one thread per patient **across all therapists**, including its `guidance`. Blocks **7.5** outright and collides with Sprint 2's cross-therapist person. |
| C-b | **Blob URLs are unguessable secrets, not access control** (`lib/uploads.ts:16-19`). 5.9's read-only viewer, watermark and audit are all bypassable by anyone holding the URL. The seam is named in that file; the plan does not budget it. |
| C-c | **Sprint 4 says nothing about reassignment.** 1D.4 moves a session to clinician B. Does B inherit A's `historyGrant`? Silence here is a wrong-access bug. |
| C-d | **`lib/consent.ts` already exists** and means *recording* consent. Sprint 4 must not overload the word. |
| C-e | **Data hygiene before Sprint 2's backfill.** ~35 `demo.nadia.*`/`e2e-*` accounts and the ledger test's `ledger-test-*` rows are in production `patients`/`users`. 2.2 gives every one of them a `person`. Purge first. |
| C-f | **1D's threshold disagrees with the code.** Plan and DEVLOG say 5 minutes; `ABANDON_AFTER_MINUTES = 10` (`feedback.ts:685`). Changing it also changes when a clinician gets suspended. One decision, two consequences. |

---

# §2 · CONCERNS

> Anything you disagree with, in any part of the plan. One row each. Append,
> never delete — a resolved concern is more useful than a missing one.

| # | Sprint | Concern | Severity | Raised by | Status | Resolution |
|---|---|---|---|---|---|---|
| C1 | 0 / all | **No `.env.local` in the audit container.** *Narrowed after `npm ci`:* static checks all pass — `tsc` clean, 60/60 DB-free tests, build compiles in 29.7 s. What remains impossible: `test:ledger`, `npm run build` past page-data collection, **every `information_schema` check (T1 unverified)**, and every Sprint 1 measurement. 1.1 and 1.2 are still unstartable | `blocker` | audit @ `3e2df61` | **narrowed** `54294af`→ | Needs `DATABASE_URL` + `OPENAI_API_KEY`. Read-only DB is enough for 1.1's verification query; 1.2 needs the AI key and real two-speaker audio |
| C2 | 1.1 | `MAX_SEGMENTS = 160` (`diarise.ts:46`) caps attribution at ~21 min of an 8 s-chunked session. A 50-min session is ~375 segments; the tail can never be attributed. **The acceptance criterion cannot be met by a backfill alone** | `major` | audit | open | Paginate `diariseSession` over segment windows *before* backfilling, or restate the criterion to name the cap |
| C3 | 1.1 | The two-track guard (`diarise.ts:98-100`) is all-or-nothing: **one** `patient` segment skips the whole session. A video call whose patient track dropped at minute 2 keeps ~300 permanently `unknown` rows | `major` | audit | open | Make the guard per-run-of-segments, not per-session |
| C4 | 1D.5 | *"not a payments redesign"* is wrong. Destination charges (`connect.ts:439-448`) put the money in therapist A's connected account **before the session**; there is no payable to re-point, and `session_payments_session_unique` allows one payment row per session. Re-pointing today = refund A + charge the patient again, on a no-show, in crisis | `blocker` | audit | open | Add `capture_method: "manual"` at `connect.ts:438` for radar bookings. Authorise at booking, capture at session start. Then 1D.5 is an UPDATE |
| C5 | 3.2 / 3.3 | Nullable `users.organization_id` **silently voids** `users_org_email_unique` — Postgres NULLs are distinct, so one email could sign up without limit. Not a crash; a data-integrity hole that passes every test | `blocker` | audit | open | Take the *separate patient identity* branch. If nullable is chosen anyway, add a second partial unique index on `(email) WHERE organization_id IS NULL` |
| C6 | 5.9 | The existing TTS route takes **text from the client** (`speak/route.ts:30`) — exactly the shape **T10** forbids. Reusing it as-is ships the trap | `major` | audit | open | New sibling endpoint keyed on document/chunk **id**; text is fetched server-side and never leaves it. Also: `slice(0, 4000)` will not hold a document |
| C7 | 5.1 / 5.9 | Blob URLs are unguessable secrets, **not** access control (`lib/uploads.ts:16-19`). Watermark, read-only viewer and audit are all bypassable by URL | `major` | audit | open | Serve every document read through an authorised route; never hand the blob URL to a browser |
| C8 | 5.2 | Reverses a documented decision (*"a PDF is a script host"*, `uploads.ts:33-36`) with no replacement mitigation, and patient uploads are less trusted than the clinician case it refuses. Raising 8 MB also hits Vercel's ~4.5 MB body limit | `major` | audit | open | Client-direct-to-blob upload; never serve an original inline; `Content-Disposition: attachment`; treat `.docx` separately from PDF |
| C9 | 1C.3 / 1B.5 | **Partial disagreement with a settled decision.** "Going offline is ungated, not a risk" holds for the *manual* act — but `suspendFromRadar` already penalises the adjacent one, and 1C.3/1B.5 make going offline **automatic**. A clinician auto-offlined the instant a patient books can still be counted absent by the 10-minute sweep | `minor` | audit | open | Not re-opening the decision. Asking that auto-offline and `sweepAbandonedPatients` be made aware of each other before 1C.3 ships |
| C10 | 7.4 / 7.5 | `copilot_threads.patient_id` is NOT NULL and uniquely indexed on `patient_id` **alone** (`schema.ts:764`) — one thread per patient globally, shared `guidance` included. Blocks 7.5; collides with Sprint 2 | `major` | audit | open | Nullable `patient_id` + partial unique on `(patient_id, therapist_id) WHERE patient_id IS NOT NULL`. Cheapest as a Sprint 2 migration, not a Sprint 7 one |
| C11 | 5.3 | No worker exists. `waitUntil()` and three **daily** Vercel crons are the whole async surface | `major` | audit | open | Name the mechanism before Sprint 5: resumable cron, QStash, or a separate host |
| C12 | order | **1B before 3.** 1B.3 builds a guest booking calendar that Sprint 3 then rewires for real accounts. 1B is also blocked on Resend, which is not a code task | `major` | audit | open | Proposed order: **1 → 1C → 2 → 3 → 4 → 1B → 1D → 5 → 5B → 6 → 7 → 8** |
| C13 | 1D | Plan says 5 minutes; `ABANDON_AFTER_MINUTES = 10` (`feedback.ts:685`). The same constant governs **when a clinician is suspended** | `minor` | audit | open | One decision, stated once, with both consequences named |
| C14 | 2.2 | ~35 `demo.nadia.*`/`e2e-*` accounts and `ledger-test-*` rows are in production. 2.2 mints a `person` for each | `minor` | audit | open | Purge before the backfill, not after |
| C15 | 4 | Nothing says what happens to a `historyGrant` when 1D.4 reassigns a session. Silence here is a wrong-access bug, not a gap | `major` | audit | open | Decide before 4.1: does B inherit A's grant, or does the patient re-approve? |
| C16 | testing | `tests/radar.test.ts` (27) and `tests/e2e.test.ts` (13) are outside the "69 across six suites" standing check. The 27 cover `claimTherapist` — the primitive 1C.3 and 1D depend on | `minor` | audit | open | Add `test:db` to the standing list before touching radar |

**Severity:** `blocker` stops the sprint · `major` changes the design ·
`minor` worth noting.

---

# §3 · SPRINTS

Order carries information. 2 → 4 are foundation and nothing after them can
start early.

### Sprint 0 — ✅ SHIPPED (`0c94942`, `5534dea`)

- [x] Transcription language flows from the session; omitted when unknown
- [x] `sessions.transcriptLanguage` + audited server action + in-room control
- [x] Anti-hallucination prompt follows the language
- [x] Arabic hallucination artefacts filtered (`الحمد لله` deliberately not)
- [x] In-session notes verified pinned and reset-safe — no code needed
- [x] Corrections box relabelled, placeholder fixed
- [x] `tests/transcribe.test.ts` — 10 tests

### Sprint 1 — Attribution · ~1 week

**No vendor. No new bill. No BAA.** Deepgram tested and rejected — see DEVLOG.

- [ ] **1.1** Backfill `diariseSession` over existing transcripts.
      *Today: ran 2× against 29 notes; 317 of 333 lines never touched.*
      **Accept:** every session with ≥4 segments has attribution or a logged
      reason. Verify by query, not by the script's own output.
- [ ] **1.2** **Measure therapist voice enrollment before building it.**
      Enroll one voice, test against real two-speaker audio, report numbers.
      **Accept:** a table of accuracy figures in §4. If weak, stop and keep
      honest `unknown` — do not ship it anyway.
- [ ] **1.3** VAD chunking — cut on pauses, not the 8-second clock.
      **Accept:** no transcript line ends mid-word in a 10-session sample.
      Measured against the current ~1 lost word per boundary.
- [ ] **1.4** Acoustic descriptors: speaking rate, pause length, volume shifts.
      **Descriptors only — never emotion labels.**
- [ ] **1.5** Fix `lib/ai/client.ts:140` — the transcribe rate ignores
      `input.model`. Wrong today regardless of provider.

### Sprint 1B — Scheduled sessions · ~1.5 weeks

- [ ] **1B.1** `availability_slots` — whole hours only. 19:00–20:00, never 19:15
- [ ] **1B.2** `sessions.scheduledAt`. The status exists; the timestamp does not
- [ ] **1B.3** Booking calendar on the public profile — fixed slots, no free text
- [ ] **1B.4** Radar escape hatch: "not urgent? see their calendar"
- [ ] **1B.5** Auto-offline as a booked slot approaches
- [ ] **1B.6** Mid-session warning — hook the existing `lib/session-clock.ts`
- [ ] **1B.7** Booking confirmation + reminder emails
- [ ] **1B.8** Patient session log — past, today, upcoming

🔴 **Blocked on you, not on code:** Resend's domain is unverified, so exactly
one address on earth receives mail. A booking confirmation nobody receives is a
broken booking.

### Sprint 1C — Therapist shell · ~4 days

- [ ] **1C.1** Mobile shell on desktop too — bottom bar, larger targets
- [ ] **1C.2** Floating radar orb on every page. States: dim · teal pulse ·
      🟡 amber *someone is looking* · 🔴 red *booked, paying* · red steady
      *in session*
- [ ] **1C.3** Act on the existing `{ kind: "viewing" }` signal — go offline
      before the booking lands. Use `claimTherapist`'s atomic claim; **do not
      invent a second mechanism**

*Going offline is ungated and carries no penalty. Nobody earns anything while
online, so there is nothing to gain by hiding.*

### Sprint 1D — No-show recovery · ~1 week

- [ ] **1D.1** 0–5 min: "your therapist is joining shortly". No blame
- [ ] **1D.2** After 5 min: *report no-show* + *find someone now*
- [ ] **1D.3** Live radar **inside the waiting room** — never send a patient in
      that state back to a search screen
- [ ] **1D.4** Session reassignment. **Genuinely new — nothing transfers a
      session today**
- [ ] **1D.5** Payable re-points to whoever attended. The ledger already holds
      and releases; this is not a payments redesign
- [ ] **1D.6** Reliability score from no-shows, on the public profile
- [ ] **1D.7** Tell the reported clinician, once, plainly

### Sprint 2 — Person layer · ~1 week · FOUNDATION

🔴 **Measured 3 Sep: 46 of 56 patients have no email address.** 31 of 35
therapist-created, 15 of 21 from join links. A patient without an account is
not the edge case — it is the normal case, and the plan previously assumed the
opposite.

**Two states, and the difference is who is allowed to share the record.**

| | Unclaimed | Claimed |
|---|---|---|
| What it is | The therapist's own file, like paper in a drawer | A real person's portable profile |
| Who can read it | Only the therapist who made it | The patient, plus whoever they grant |
| Shareable with another therapist | 🔴 **Never** | Only with consent |
| Mergeable with another record | 🔴 **Never** | Yes — the patient confirms |
| Consent model applies | No. It is their own file | Yes |
| Therapist can add history documents | Yes | Yes, with access |

**Why unclaimed can never be shared:** without it, a therapist could upload
somebody's entire clinical history, hand it to another clinician, and that
person would never learn it happened. Locking sharing behind claiming is the
whole protection. There is nobody to ask, so nothing may be shared.

- [ ] **2.6** `people.claimedAt` — null means unclaimed
- [ ] **2.7** Claim flow: therapist adds an email → invite → patient signs up →
      *"Your therapist has a record for you. Is this you?"* → accept
- [ ] **2.8** Two other routes in: the patient signs up alone and is offered a
      suggested match, or claims at a session they joined by link
- [ ] **2.9** **Hard rule, enforced server-side:** an unclaimed record cannot be
      shared, granted, merged, or appear in another therapist's view
- [ ] **2.10** A record never claimed stays private forever. That is a valid
      end state, not a failure — it is exactly how the product works today

- [ ] **2.1** `people` table above `patients`. `patients.personId` nullable first
- [ ] **2.2** Backfill: every patient becomes its own person. **No merging**
- [ ] **2.3** Match *suggestions* only, surfaced to the patient
- [ ] **2.4** "Is this you?" confirmation. Records stay separate until accepted
- [ ] **2.5** Audit every link and unlink

🔴 **Trap T9 — the unrecoverable one.** Never auto-merge on email, phone or
name. A wrong merge puts one person's trauma in a stranger's file and a
clinician treats them on it. Failing to merge is an annoyance.

### Sprint 3 — Patient accounts · ~1 week · FOUNDATION

- [ ] **3.1** Add `"patient"` to `ROLES`
- [ ] **3.2** `users.organizationId` nullable, or a separate patient identity
- [ ] **3.3** `Actor.organizationId` → `string | null`. **Audit every consumer
      — widest blast radius in the plan.** A missed call site is a
      data-isolation bug, not a crash
- [ ] **3.4** `requirePatient()` mirroring `requireUser()`
- [ ] **3.5** Signup, signin, reset, change password — reuse `lib/auth/*`
- [ ] **3.6** Fix `middleware.ts:64` — a signed-in patient lands on the
      therapist dashboard today
- [ ] **3.7** `app/(patient)/` route group

### Sprint 4 — Consent · ~4 days · FOUNDATION

- [ ] **4.1** `historyGrants` — person, therapist, granted, expires, revoked
- [ ] **4.2** **Two shapes:** 24 hours, or open-ended until revoked
- [ ] **4.3** Patient approval alert; one-tap revoke, effective immediately
- [ ] **4.4** Booking asks whether to grant, consequence stated plainly
- [ ] **4.5** Audit every grant, denial, expiry, revocation and read
- [ ] **4.6** Copilot two modes: session-only (red banner, this transcript
      alone, request-access button) and full history

### Sprint 5 — Personal Profile · ~1.5 weeks

- [ ] **5.1** Documents on the *person*: upload, type, dictate
- [ ] **5.2** Extend `ALLOWED_UPLOAD_TYPES` (PDF, Word) and raise the 8 MB cap
- [ ] **5.3** Chunking on a **background worker** — trap T13, not a request
      handler
- [ ] **5.4** `[D7:3]` citations that resolve or are discarded
- [ ] **5.5** In-page source viewer — click a citation, see the chunk
- [ ] **5.6** Provenance: which therapist, which date. Therapists only
- [ ] **5.7** Flag a document, phrase or diagnosis as outdated or wrong
- [ ] **5.8** Diagnosis fields — **extract only what is written**, show the
      source sentence, require confirmation. Never inferred from symptoms
- [ ] **5.9** Read-only viewer, watermark, audited. **Server-side TTS — the
      text never reaches the browser** (trap T10)

🔴 **Unanswered: OCR.** Most previous-clinician reports are scans or photos.
Chunking and citations need text. No provider chosen. Raise in §2 if this
blocks you.

### Sprint 5B — Homework · ~4 days

*Half exists: `NoteContent.patientSteps` already drafts tasks into the
patient's note. Missing is authoring and completion.*

- [ ] **5B.1** Therapist authors post-session, editing the AI draft
- [ ] **5B.2** Patient marks done, or writes an update back
- [ ] **5B.3** Therapist sees history across sessions and what was done
- [ ] **5B.4** Grouped by session on the patient's profile
- [ ] **5B.5** Gated on the therapist holding profile access

⚠️ A completion rate shown to a depressed patient is a scoreboard of their
failures. Show the therapist the trend; show the patient the next thing to do.

### Sprint 6 — Memory · ~1 week

- [ ] **6.1** Rolling profile, regenerated after each session and document
- [ ] **6.2** Dated observation timeline
- [ ] **6.3** Copilot cites history *alongside* sessions, marking which is which
- [ ] **6.4** **Sessions outrank history.** Surface conflicts, never resolve them
- [ ] **6.5** Therapist flags feed back into regeneration

🔴 **Trap T11.** Never hand-edit the rolling profile into permanence. Always
regenerate from sources, always dated, always cited.

### Sprint 7 — Therapist surfaces · ~1 week

- [ ] **7.1** Patient profile panel + whether access is held
- [ ] **7.2** Cross-therapist session index. **Never the transcript**
- [ ] **7.3** History section reachable from the copilot page
- [ ] **7.4** General copilot: roster-aware, **no clinical content in context**,
      patient links validated server-side against the real roster
- [ ] **7.5** Multiple general threads — pick, continue, delete
- [ ] **7.6** Detect a *fact* typed into the corrections box, offer to move it

### Sprint 8 — Patient app · ~1.5 weeks

- [ ] **8.1** Bottom nav, globe centre and highlighted
- [ ] **8.2** Home: "Welcome, name" + globe hero, expandable to full map
- [ ] **8.3** Sessions, therapists, their own patient-version notes
- [ ] **8.4** Billing — every session as a bill, platform cut shown
- [ ] **8.5** Homework grouped by session
- [ ] **8.6** Consent screen — who has access, which shape, revoke
- [ ] **8.7** **Hard block, server-side:** a patient never sees a transcript or
      a clinical note

### Sprint 9 — Wallet, payouts and pricing · UNSIZED · ⛔ NOT APPROVED TO BUILD

Requested 3 Sep: drop Stripe Connect, hold therapist balances ourselves, manual
payouts in local currency, per-country payment providers, new pricing tiers.

🔴 **Do not start this sprint. It carries the largest legal risk in the
product, and the risk is not technical.**

**Holding a therapist's balance and paying it out later makes you a money
transmitter.** Stripe Connect exists precisely so that you never touch the
money: today a patient's payment is a destination charge that lands in the
clinician's own Stripe account, and Stripe carries the licensing, the KYC and
the tax reporting. A wallet moves all of that onto you.

| Where | What holding balances requires |
|---|---|
| USA | Money-transmitter licence in ~48 states. Bonds and capital typically $50k–$1M+, and 1–2 years to obtain |
| Egypt | Payment-service licensing under the Central Bank |
| UAE | Central Bank payment-services regulation |

The company is pre-incorporation. This is not a thing to build and then ask
about.

**Alternatives that get most of what was asked without becoming a money
transmitter:**

| Option | What it gives | What it costs |
|---|---|---|
| **A** Stripe Connect in more countries, with local payout currencies | Local-currency payouts, therapist chooses at cashout | Stripe supports payouts in ~135 currencies. No licensing |
| **B** A licensed local partner per country (Paymob, Paymint, Thunes, Wise Platform) as the payer of record | Local rails, local methods, the partner is licensed | Integration per country; the partner holds the money |
| **C** Wallet as **display only** — balance is what Connect will pay out, we never hold it | The wallet UI, none of the exposure | Payout timing still Stripe's |

**Recommendation: C now, B per country as you expand, never a real wallet
until a lawyer says otherwise.**

The rest of the request has no legal problem and can proceed once the money
question is settled:

- [ ] **9.1** Per-country provider registry, admin-managed
- [ ] **9.2** A provider has many methods (Paymob → Instapay, Vodafone Cash)
- [ ] **9.3** Country locks its own currency — no USD in Egypt, no EGP in the US
- [ ] **9.4** Admin sees integration status per provider, and which countries
      have no active provider
- [ ] **9.5** Provider keys as environment variables, presence checked at boot
- [ ] **9.6** Payout method added in radar settings, on earnings, or during a
      payout
- [ ] **9.7** Exchange rate fixed for 24 hours, stored with every payout so a
      historical payout can always be explained
- [ ] **9.8** New pricing — see the economics note below

⚠️ **Rate risk is now yours.** Quoting a rate for 24 hours means you absorb any
move against you inside that window. EGP has moved more than 5% in a day within
the last two years. Cap the exposure or quote for a shorter window.

### Parked

Research corpus — feasibility validated, ~$35 once + ~$1.50/month. OpenAlex +
PubMed; Google Scholar is unusable (403, and forbidden by terms).

---

# §4 · BUILD LOG

> Append one entry per meaningful change. Newest at the bottom.
> Every quality claim carries its measurement.

| Date | Sprint | What | Commit | Verified how |
|---|---|---|---|---|
| 3 Sep | 0 | Transcription language, notes, corrections copy | `0c94942` | tsc, build, 10 new tests, column confirmed in `information_schema` |
| 3 Sep | 0 | Measured the fix — disproved its own premise | `5534dea` | 5 Arabic clips, 0/5 harm from the old setting |

---

# §5 · STANDING RULES

Violating one of these is a bug regardless of what a ticket says.

| Rule | |
|---|---|
| Therapists can **never** delete a patient or a session | Hard |
| Reset clears the therapist's messages and copilot replies — **never** in-session notes | Hard |
| **No admin impersonation** | Hard |
| **Never reveal who wrote a rating** | Hard |
| A patient never sees a transcript or clinical note — server-side | Hard |
| Only admin can send patient data anywhere, audited, clinician notified | Hard |
| Verify every migration with `information_schema` — trap T1 | Process |
| Measure before claiming. Re-measure what already worked — trap T4 | Process |
| Short tables in replies. Never walls of text | Process |
| Do not re-propose a DEVLOG decision without a new measurement | Process |
