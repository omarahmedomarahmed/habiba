# Execution plan — Personal Profile programme

Working document. Two sessions share it through git: one writes the plan,
another audits and builds, and both read the same file rather than talking past
each other.

- **Narrative version** (shareable, for humans outside the repo):
  https://claude.ai/code/artifact/f239c137-b334-46f3-9839-636367cea2b6
- **History, measurements and traps:** `DEVLOG.md`
- **This file:** what to build, in what order, and where to object.

**Baseline:** `main` @ `547ae5d` · migrations `0000–0028` · Sprint 0 shipped ·
69 tests green across six suites.

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

> **Auditor: fill this in before writing any product code.**
> Replace this block. Keep it short — tables, not prose.

```
Status: NOT YET AUDITED
Auditor session:
Date:
Commit audited:
```

| Question | Answer |
|---|---|
| Does the plan match the codebase? | |
| What is already built that the plan thinks is missing? | |
| What is wrong, impossible, or costlier than stated? | |
| What has the plan missed? | |
| Is the sprint order right? | |
| Any settled decision you disagree with, with evidence? | |
| **Verdict: proceed / proceed with changes / stop** | |

---

# §2 · CONCERNS

> Anything you disagree with, in any part of the plan. One row each. Append,
> never delete — a resolved concern is more useful than a missing one.

| # | Sprint | Concern | Severity | Raised by | Status | Resolution |
|---|---|---|---|---|---|---|
| — | — | *(none yet)* | — | — | — | — |

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
