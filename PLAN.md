# 24Therapy — build plan

Working document. Sessions share it through git: the commit is the only channel
between them, so write here and commit whenever you decide something.

**Baseline:** `main` · migrations `0000–0028` · 109 tests across eight suites
(60 run without a database, 49 need one).
**Hazards:** `HAZARDS.md` — read once before your first commit.

---

## What this product is

A therapist opens a session. Everything said is transcribed, a clinical note is
written and signed, and a plain-language copy goes to the patient. A copilot
answers questions about that patient, citing the transcript rather than
guessing. Patients find therapists on a live globe, or book them ahead.

**What we are building now:** the patient stops being a row inside one clinic
and becomes a person who owns their record, carries it between therapists, and
decides who may read it.

Sessions are in Arabic and English, usually mixed inside one sentence. Egypt
first, then MENA.

---

## §1 · VERDICT

> **Auditing session: fill this in before writing product code. Replace this
> block. Short tables, no prose.**

```
Status: NOT YET AUDITED
Auditor:
Date:
Commit audited:
```

| Question | Answer |
|---|---|
| Does the plan match the codebase? | |
| Already built that the plan thinks is missing? | |
| Wrong, impossible, or costlier than stated? | |
| What has the plan missed? | |
| Is the sprint order right? | |
| Any decision you disagree with, with evidence? | |
| **Verdict: proceed / proceed with changes / stop** | |

---

## §2 · CONCERNS

> Append one row per objection. Never delete a row — a resolved concern is more
> useful than a missing one. `blocker` stops a sprint · `major` changes the
> design · `minor` is worth noting.

| # | Sprint | Concern | Severity | Raised by | Status |
|---|---|---|---|---|---|
| — | — | *(none yet)* | — | — | — |

---

## §3 · THE MODEL

Read this before any sprint. Every sprint below assumes it.

### Patient records have two states

| | **Unclaimed** | **Claimed** |
|---|---|---|
| What it is | The therapist's own file, like paper in a drawer | A person's portable profile |
| Who reads it | Only the therapist who made it | The patient, plus whoever they grant |
| Shareable | 🔴 **Never** | Only with consent |
| Mergeable | 🔴 **Never** | Yes, the patient confirms |

**46 of 56 existing patients have no email.** Unclaimed is the normal state, not
the edge case. Nothing unclaimed may be shared, because there is nobody to ask.

### How a record gets claimed

| Step | |
|---|---|
| 1 | Therapist adds a patient with **email or phone** |
| 2 | That person later signs up with the same email or phone |
| 3 | We ask: *"Have you ever seen Dr X?"* — yes / no |
| 4 | If yes, they confirm the **first and last name on file**, shown redacted — `H••••• A•••••` |
| 5 | Correct → **Claim account** → verification sent by email or WhatsApp |
| 6 | Verified → the uploaded history merges into their profile |
| 7 | 🔴 **We ask whether the therapist keeps access. Default is OFF.** The patient chooses |
| 8 | If they say no, that therapist keeps only what they uploaded themselves — no new sessions, no live profile |

A first-time signup may match **several** unclaimed profiles. Same flow, one at
a time.

### The copilot has four states per patient

| State | What the therapist gets |
|---|---|
| **Unclaimed, documented** | Full copilot over what they uploaded. **5 message credits**, unlocked only after adding the patient **and** a diagnosis **and** written or dictated history |
| **Claimed, access granted** | Full copilot — live profile, files, diagnosis, sessions |
| **Claimed, access revoked** | 🔴 **Degraded.** Their own transcripts, their own notes, docs they uploaded, and the old chat — readable but no longer connected. **No** live profile, **no** files, **no** diagnosis changes. Banner explains it. "Request access" with a note, rate-limited |
| **No relationship** | This session's transcript only |

**Revoking stops new reading. It cannot un-read what was already seen** — the
old chat stays. Say that plainly to the therapist; do not alarm the patient with
it.

### Consent lives in the room, and moves

Two controls, side by side, both visible, both changeable mid-session:

| Control | |
|---|---|
| **Record this session** | Off → on at any moment |
| **Share my profile** | Off → on at any moment |

| Rule | |
|---|---|
| Answered yes before joining | No prompt. Nothing shown |
| Answered no | Prompt stays, with what they gain: their own profile, notes that travel, revoke anyone |
| Turns it on at minute 10 | 🔴 **Minutes 0–10 were never recorded and do not exist.** The note is stamped *"recording began at 10:32; earlier conversation not captured"* |
| Wants to turn it off | Cannot. End the session; answer no next time |

### Money

| Line | Rule |
|---|---|
| **Session bill** | Therapist pays for the AI used, at whichever rate their bundle bought |
| **Platform cut** | **15% of any session the patient paid for.** Free links take no cut |
| **VAT** | By country. Egypt **14%**. **The patient pays it, on top of everything** |
| Worked example | $30 session → patient pays **$34.20** · $4.20 VAT · $4.50 our cut · $25.50 to the therapist · plus the therapist's own session bill |
| Refunds | Our cut is refunded. **VAT is not** |
| Price cap | **$500** per session. Currently **$1,000** in code — lower it |
| Free links | Allowed. No cut, but the session bill still applies |
| In-person | Always free. Paid at the clinic, we take nothing |

### Pricing — one rate, bought in a minimum quantity

Not subscriptions. A therapist buys sessions at a rate, and the rate is set by
how many they buy at once.

| Tier | Rate | Minimum | Costs them |
|---|---|---|---|
| **PAYG** | **$4.00**/session | 0 | pay as they go |
| **Starter** | **$3.00**/session | 10 sessions | $30 |
| **Growth** | **$2.00**/session | 30 sessions | $60 |

Above a minimum they buy as many as they like at the same rate — a slider, not
a fixed pack.

| Rule | |
|---|---|
| Credits expire | **12 months** |
| Downgrade | Keep every unused credit. They are consumed first, then the new rate applies |
| Buying more at a better rate | Allowed any time. It does not touch the existing balance |
| Copilot per patient | **10 messages per session**, rolls over on that patient, expires 12 months |
| Unclaimed patient | **5 credits**, unlocked by documenting them |
| General chat | **50 messages per calendar month**, across any number of threads |

**Margin at each rate**, against a measured cost of ~$0.97 for a 60-minute
session — transcription, note, in-session copilot and video:

| Tier | Charge | Cost | Margin |
|---|---|---|---|
| PAYG | $4.00 | $0.97 | **$3.03 · 76%** |
| Starter | $3.00 | $0.97 | **$2.03 · 68%** |
| Growth | $2.00 | $0.97 | **$1.03 · 52%** |

The 15% cut on paid sessions is on top of all three.

### Production today — none of the above is live

| | Now | Target |
|---|---|---|
| PAYG rate | **$6.00** (`plans.ts`) | $4.00 |
| Plans | `payg` + `unlimited $99/mo` | PAYG · Starter · Growth |
| Platform cut | **10%** (`PLATFORM_FEE_BPS = 1000`) | 15% |
| Price cap | **$1,000** | $500 |

**Move every therapist to PAYG, including unlimited subscribers.** They are demo
accounts under test by real clinicians — no real revenue, nobody to notify. The
ledger holds 2 rows and no payment has ever been taken, so nothing real breaks.

🔴 **Every figure above lives in an admin-editable table, not in code.** Rates,
tiers, included sessions, copilot limits, VAT per country, the cap.

---

## §4 · SPRINTS

**Ordered by who is waiting.** Therapists are live on this product today, so
their pain ships first — sprints 2 and 3 are fixes to things they use every day.
Revenue comes next. The patient-side rebuild is foundation work with nothing
visible until sprint 13, which is why it sits after the parts that pay for it.

Admin is **last**, on purpose: it exists to verify and correct everything else,
and it cannot verify what does not yet exist.

### Sprint 1 — Settings foundation · ~4 days

Everything downstream reads these. Anything hardcoded here is rewritten in 15.

- [ ] **1.1** `platform_settings` — rates, tiers, included sessions, copilot
      limits, price cap. Seeded with §3's numbers
- [ ] **1.2** `country_settings` — VAT rate, currency, allowed payment methods
- [ ] **1.3** Typed accessor with a safe fallback. **No pricing constant may
      remain in code**
- [ ] **1.4** Fix `lib/ai/client.ts` — the transcribe rate ignores `input.model`
      (H12)
- [ ] **1.5** Session length 50 → **60 min**: 50 running, then a **10-minute
      countdown shown on both screens**, hard stop at 60. To continue, the
      therapist creates a new session — free or paid — and sends that patient
      the link
- [ ] **1.6** Reprice to §3: PAYG $4, Starter $3/min 10, Growth $2/min 30.
      Platform cut 10% → **15%**. Price cap $1,000 → **$500**
- [ ] **1.7** **Move every therapist to PAYG**, unlimited subscribers included.
      Demo accounts, no real revenue, nobody to notify
- [ ] **1.8** 🔴 **Stop taking custody of therapist money.** `connect.ts:386`
      selects `capture: "platform"` automatically whenever a clinician has no
      Connect account — so we hold their balance today, by default, for exactly
      the therapists least able to chase us for it. Refuse the payment and
      prompt them to finish Connect onboarding instead. **This is remediation,
      not prevention: it is live**
- **Accept:** changing a rate in the database changes what the next session
      bills, with no deploy. And no code path can put a patient's payment
      anywhere but a clinician's own Stripe account.

### Sprint 2 — The room and the shell · ~1 week · 🔴 LIVE PAIN

Therapists use this every day and it is the worst screen in the product.

- [ ] **2.1** 🔴 **Room relayout.** Video is `aspect-video w-full` today, so the
      transcript sits below the fold — a clinician cannot look at their patient
      and read the copilot at the same time. Small video, transcript and copilot
      visible together, no scrolling
- [ ] **2.2** Mobile layout on desktop too — bottom bar, large targets. One
      shell, not two
- [ ] **2.3** Floating orb on every page: dim · teal · 🟡 someone looking ·
      🔴 booked and paying · red steady in session
- [ ] **2.4** Orb expands — status, session rate, clinic-visit toggle, address
- [ ] **2.5** **Keep `/on-call`** as full radar control: settings, session
      history with the price charged at the time, patient record links, access
      state, copilot credits used per session
- [ ] **2.6** Act on the existing `{ kind: "viewing" }` signal — go offline
      before a booking lands. Use `claimTherapist`'s atomic claim; do not invent
      a second mechanism

### Sprint 3 — Attribution · ~1 week · 🔴 LIVE PAIN

In-person transcripts are 92% unattributed. Video is 12%.

- [ ] **3.1** Fix `diarise` batching (H11), then backfill existing transcripts
- [ ] **3.2** Cut audio on pauses, not the 8-second clock. RMS gating already
      exists in `lib/audio/recorder.ts`
- [ ] **3.3** Acoustic descriptors — speaking rate, pause length. **Descriptors,
      never emotion labels**
- [ ] **3.4** Handle a dropped video track: attribution silently stops today
- **Accept:** no transcript line ends mid-word across a 10-session sample.

### Sprint 4 — Paid links · ~1.5 weeks · 💰 REVENUE

The first sprint that earns money.

- [ ] **4.1** Price on session creation. `$0` = today's direct link, unchanged
- [ ] **4.2** `/pay/[token]` — patient picks **country first**, then sees
      currency, exchange rate and their country's methods
- [ ] **4.3** Save the patient's payment preferences
- [ ] **4.4** FX quote fixed for **1 hour**, stored with the payment
- [ ] **4.5** 15% cut + VAT, shown to patient and therapist as separate lines
      with reasons — never one number
- [ ] **4.6** Session type recorded: free link · paid link · radar · scheduled

### Sprint 5 — Person layer · ~1 week · FOUNDATION

- [ ] **5.1** `people` above `patients`; `patients.personId` nullable at first
- [ ] **5.2** `people.claimedAt` — null means unclaimed
- [ ] **5.3** Backfill: every patient becomes its own person. **No merging**
- [ ] **5.4** Match on email **or** phone. Suggest only
- [ ] **5.5** **Server-side rule:** unclaimed can never be shared, granted or
      merged
- 🔴 **Never auto-merge.** A wrong merge puts one person's trauma in a
      stranger's file and a clinician treats them on it.

### Sprint 6 — Patient accounts · ~1 week · FOUNDATION

- [ ] **6.1** Add `"patient"` to `ROLES`
- [ ] **6.2** 🔴 **Separate patient identity table — not a nullable
      `organizationId`.** Nullable voids `users_org_email_unique`, because
      Postgres treats NULLs as distinct: one email, unlimited signups
- [ ] **6.3** `Actor.organizationId` → `string | null`. **Audit every consumer**
- [ ] **6.4** `requirePatient()` mirroring `requireUser()`
- [ ] **6.5** Signup, signin, reset — reuse `lib/auth/*`
- [ ] **6.6** Fix `middleware.ts` — a signed-in patient lands on the therapist
      dashboard today
- [ ] **6.7** `app/(patient)/` route group
- [ ] **6.8** The claim flow, all eight steps from §3
- [ ] **6.9** Verification by email or WhatsApp

### Sprint 7 — Consent · ~4 days · FOUNDATION

- [ ] **7.1** `historyGrants` — person, therapist, granted, expires, revoked
- [ ] **7.2** Two shapes: **24 hours**, or **open-ended until revoked**
- [ ] **7.3** Request access with a note. Rate-limited against spam
- [ ] **7.4** Patient rejects freely — silently, or with a preset reason
- [ ] **7.5** Revoke in one tap, effective immediately
- [ ] **7.6** Audit every grant, denial, expiry, revocation and read
- [ ] **7.7** Copilot honours the four states in §3
- [ ] **7.8** Two consent controls in the room, per §3. Note stamped when
      recording started late

### Sprint 8 — Personal Profile · ~1.5 weeks

- [ ] **8.1** Documents on the person: upload, type, dictate
- [ ] **8.2** **Accept any format** — PDF, Word, scans, photos. Raise the 8 MB
      cap
- [ ] **8.3** Text we can read is chunked on a worker, not a request handler (H9)
- [ ] **8.4** An image we cannot read is still stored, shown and zoomable, and
      labelled *"image — not searchable"* so nobody assumes the copilot read it.
      **No OCR**
- [ ] **8.5** `[D7:3]` citations that resolve or are discarded
- [ ] **8.6** Click a citation, see the exact passage
- [ ] **8.7** Provenance — which therapist, which date
- [ ] **8.8** Flag a document, phrase or diagnosis as outdated or wrong
- [ ] **8.9** Diagnosis fields — **extract only what is written**, show the
      source sentence, require confirmation. Never inferred from symptoms
- [ ] **8.10** Read-only viewer, watermark, audited. **Server-side speech — the
      text never reaches the browser**

### Sprint 9 — Memory and homework · ~1.5 weeks

- [ ] **9.1** Rolling profile, regenerated from sources after each session and
      document. Dated, cited, **never hand-edited into permanence**
- [ ] **9.2** Dated observation timeline
- [ ] **9.3** Copilot cites history alongside sessions, marking which is which
- [ ] **9.4** **Sessions outrank history.** Surface conflicts, never resolve
- [ ] **9.5** Homework: `NoteContent.patientSteps` already drafts it. Add
      therapist authoring, patient completion, history across sessions
- ⚠️ A completion rate shown to a depressed patient is a scoreboard of their
      failures. Trend to the therapist; next action to the patient.

### Sprint 10 — General copilot · ~4 days

- [ ] **10.1** Chat box on the therapist home
- [ ] **10.2** Roster only — names, next appointment, draft count. **No clinical
      content in context.** The guarantee comes from what is absent, not from
      what the prompt says
- [ ] **10.3** Patient names as links, **validated server-side against the real
      roster** so a hallucinated name can never become one
- [ ] **10.4** Multiple threads: pick, continue, delete
- [ ] **10.5** **50 messages per month**, across all threads
- [ ] **10.6** Preferences on first use — language, voice, playback speed.
      Editable later

### Sprint 11 — Scheduling · ~1.5 weeks

- [ ] **11.1** `availability_slots` — whole hours only, 19:00–20:00, never 19:15
- [ ] **11.2** `sessions.scheduledAt`
- [ ] **11.3** Booking calendar on the public profile
- [ ] **11.4** Radar escape hatch: *"not urgent? see their calendar"*
- [ ] **11.5** Auto-offline as a booked slot approaches
- [ ] **11.6** Mid-session warning about an upcoming booking
- [ ] **11.7** Confirmation and reminder emails
- ⚠️ Needs the Resend domain verified before real patients get reminders. Being
      arranged — build it, do not wait on it.

### Sprint 12 — No-show recovery · ~1 week

- [ ] **12.1** 0–5 min: *"joining shortly"*. No blame
- [ ] **12.2** At 5 min: report, **and** the live radar inside the room
- [ ] **12.3** Only therapists at **equal or lower** price are offered
- [ ] **12.4** **Nobody suitable online → full refund and an apology.** Never
      leave them in an empty room
- [ ] **12.5** Reassign the session. Nothing transfers a session today
- [ ] **12.6** Paid more than the replacement charges → difference becomes
      patient credit, **expires 12 months**, applied after VAT
- [ ] **12.7** Reliability score from no-shows, on the public profile
- [ ] **12.8** Keep the existing warn → suspend ladder in `lib/data/feedback.ts`

### Sprint 13 — Patient app · ~1.5 weeks

- [ ] **13.1** Bottom nav, globe centre and highlighted
- [ ] **13.2** Home: *"Welcome, name"* + globe, expanding to the full map
- [ ] **13.3** Sessions labelled by type: **upcoming today · scheduled future ·
      past scheduled · past instant from radar**
- [ ] **13.4** Their own patient-version notes
- [ ] **13.5** Homework, grouped by session, with reminders
- [ ] **13.6** Billing — every session as a bill, VAT and platform cut shown,
      plus credits
- [ ] **13.7** Consent screen: who has access, which shape, revoke
- [ ] **13.8** 🔴 **Server-side block: a patient never sees a transcript or a
      clinical note**

### Sprint 14 — Payments by country · ~1.5 weeks

- [ ] **14.1** Provider registry per country, admin-managed. **Build the
      abstraction so adding Paymob or Paymint is configuration, not code** — the
      Egyptian entity and the provider contracts are being arranged in parallel
- [ ] **14.2** A provider has many methods — Paymob → Instapay, Vodafone Cash
- [ ] **14.3** Country locks currency: no USD in Egypt, no EGP in the US
- [ ] **14.4** Keys as environment variables, presence checked at boot
- [ ] **14.5** Payout preferences: country, then available methods
- [ ] **14.6** Wallet screen — **display only**, showing what Connect will pay

🔴 **Do not hold therapist balances.** Closed in sprint 1.8 — this sprint must
not reopen it. Holding money and paying it out later makes this company a money
transmitter: ~48 US state licences with bonds from
$50k, Central Bank licensing in Egypt and the UAE. Stripe Connect exists so we
never touch it. The wallet is a screen over Connect, or a licensed local partner
is the payer of record. **Not our balance sheet.**

### Sprint 15 — Admin · ~2 weeks · LAST

Built last so it can be verified against everything that already exists.

- [ ] **15.1** Edit every pricing figure — rates, tiers, included, copilot caps
- [ ] **15.2** VAT and currency per country
- [ ] **15.3** Payment providers per country, integration status, and which
      countries have none
- [ ] **15.4** 🆕 **Verification requirements per country** — authority name,
      licence name, ID number format, sample photo. Hardcoded today
- [ ] **15.5** Therapist credentials by country
- [ ] **15.6** Margin per session from real usage
- [ ] **15.7** Total View extended to everything above
- **Accept:** every number in §3 is editable without a deploy, and admin can see
      and correct anything built in sprints 1–14.

## §5 · BUILD LOG

| Date | Sprint | What | Commit | Verified how |
|---|---|---|---|---|
| — | — | *(none yet)* | — | — |

---

## §6 · STANDING RULES

Breaking one of these is a bug regardless of what any ticket says.

| Rule | |
|---|---|
| Therapists can **never** delete a patient or a session | Hard |
| Reset clears the therapist's messages and copilot replies — **never** in-session notes | Hard |
| **No admin impersonation** | Hard |
| **Never reveal who wrote a rating** | Hard |
| A patient never sees a transcript or clinical note — enforced server-side | Hard |
| Nothing unclaimed is ever shared | Hard |
| Only admin sends patient data anywhere, audited, clinician notified | Hard |
| Verify every migration against `information_schema` (H1) | Process |
| Measure before claiming; re-measure what already worked (H4) | Process |
| Short tables in replies. Never walls of text | Process |
| Never force-push a shared branch (H15) | Process |
