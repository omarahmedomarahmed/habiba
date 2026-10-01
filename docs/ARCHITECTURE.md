# Architecture

Written from the code on 2026-10-01. When this page and the code disagree, the code is right
and this page is the bug.

## Shape

One Next.js App Router application (`app/`), one Vercel project, one Neon Postgres database.
No separate API service and no WebSocket server: the room uploads an audio chunk every few
seconds and polls for state, and live panels poll.

| Route group | Who | What lives there |
| --- | --- | --- |
| `app/(public)` | Anyone | Marketing pages from the CMS (`[slug]`), the radar map, therapist profiles (`t`), for-clinics/companies/therapists, developers, licence `verify` |
| `app/(auth)` | Clinicians, staff | `/login`, `/signup`, password reset, `/staff/sign-in` and its second step |
| `app/(app)` | Therapists | Dashboard, patients, sessions, notes, copilot, assistant, bookings, earnings, billing, on-call, connect, settings, support, onboarding |
| `app/(room)` | Therapist in session | The live session room (`sessions/[id]/room`) |
| `app/(patient)` | Patients | The patient app under `/patient` plus the patient's session pages |
| `app/(clinic)` | Clinic managers and staff | `/clinic`: people, seats, bills, earnings, records, team, export |
| `app/(sponsor)` | Company HR | `/sponsor`: pot, ledger, people, code, domains, team, settings |
| `app/(partner)` | Partner developers | `/partner`: keys, webhooks, deliveries, usage, team |
| `app/(admin)` | Our staff | `/admin`: verifications, transfers, payouts, support, settings, content, audit, usage, financial model |
| `app/api` | Machines | `cron/[job]`, session upload and state, partner `v1`, HR `v1`, gateway and payout callbacks, meetings, EHR callback, uploads |
| Top level | Token holders | `pay/[token]`, `join/[token]`, `records/[token]`, `feedback/[token]`, `welcome/[token]`, `support/[token]`, `j/[code]`, `sos` |
| `app/design`, `app/dev` | Internal | Design mockups; payment simulators that answer 404 on the live deployment (ruling 22) |

## Authentication, per principal

Every principal has its own table and its own opaque, httpOnly session cookie. A sponsor,
clinic manager or partner is never an `Actor` (the clinician type). `lib/routing.ts` decides
which cookie owns which path; the real check is the guard on every page.

| Principal | Table | Cookie | Guard | Notes |
| --- | --- | --- | --- | --- |
| Therapist | `users` (role `therapist`) | `24t_session` | `lib/auth/guard.ts` | 30 minute idle, 8 hour ceiling, a started session finishes (`lib/auth/session.ts`). Must be verified to practise (`requireVerified`) |
| Our staff | `users` (roles `staff`, `manager`, `super_admin`) | `24t_session` | `lib/auth/guard.ts` | Second step required: authenticator app or emailed code (`lib/auth/totp.ts`) |
| Patient | `patient_accounts` for a `people` row | `24t_patient` | `lib/patient-auth/` | Phone or email, password or one-time code |
| Clinic manager and staff | `clinic_managers`, `clinic_roles` | `24t_clinic` | `lib/clinic-auth/` | Capabilities checked on the resource (`lib/clinic-auth/capabilities.ts`); up to two custom roles |
| Company | `sponsor_users` | `24t_sponsor` | `lib/sponsor-auth/` | Roles `admin`, `viewer` |
| Partner | `partner_users`, `partner_api_keys` | `24t_partner` | `lib/partner-auth/` | Roles `admin`, `developer`; the API takes a key |
| Token holder | the link row | none | the page | `/join`, `/pay`, `/welcome`, `/records`, `/feedback`: the token is the whole credential |

A person who is both a clinician and a clinic manager holds two linked principal rows and
one active session at a time: switching revokes the side being left before minting the other,
and is audited (`lib/clinic-auth/switch.ts`). Invitations and resets for operator-created
accounts are single-use links in `account_links` (`lib/auth/account-links.ts`).

## Data model

`lib/db/schema.ts` declares about 140 tables; `drizzle/` holds the migrations in order, and
`drizzle/meta/_journal.json` is the list the runner applies.

| Area | Main tables | Owned by |
| --- | --- | --- |
| Tenancy | `organizations`, `users` | A practice (solo or clinic) is an organisation; clinicians and staff are users in it |
| The person | `people`, `patient_accounts`, `person_claims`, `person_profiles`, `journals`, `homework_items` | The patient. A `people` row is the person across practices; claimed once they sign in |
| A practice's file | `patients`, `patient_invites`, `patient_clinical_facts` | The practice. One `patients` row per person per practice |
| Sessions | `sessions`, `session_sources`, `transcript_segments`, `session_notes`, `note_addenda`, `risk_assessments`, `session_reminders` | The practice, about one patient |
| Access | `history_grants`, `history_asks`, `cross_border_consents`, `partner_consents` | The person. Grants are person to clinician, `pending`, `granted`, `rejected`, `revoked`, with optional expiry |
| Booking | `availability_slots`, `therapist_radar` | The clinician |
| Money | `ledger_entries`, `session_payments`, `manual_payments`, `invoices`, `invoice_lines`, `payout_requests`, `refund_requests`, `patient_credits`, `wallet_holds` | Us (the books) |
| Companies | `sponsors`, `sponsor_users`, `sponsor_pots`, `sponsor_money_entries`, `enrolments`, `sponsor_email_list` | The company, which never sees clinical rows |
| Clinics | `clinic_managers`, `clinic_roles`, `clinic_staff_assignments`, `clinic_seats` | The practice |
| Partners | `partners`, `partner_api_keys`, `partner_webhooks`, `partner_subjects`, `partner_sessions` | The partner |
| Operations | `platform_settings`, `country_settings`, `settings_history`, `audit_log`, `notifications`, `cron_heartbeats`, `error_events`, `ops_alerts`, `content_pages`, `ui_strings` | Us |

Rules the database enforces rather than the app: a grant only to an approved clinician
(trigger), one invoice per session, `users.verification_status` derived by trigger, and
`audit_log` append-only.

## The AI layer

Every model call goes through `lib/ai/client.ts`, which logs usage as metadata only (no prompt
or completion text) to `ai_request_logs` and prices it from `platform_settings.aiRates`. There is
no mock fallback: without `OPENAI_API_KEY` the call fails.

| Task | Model | File | What is sent |
| --- | --- | --- | --- |
| Transcription | `gpt-4o-mini-transcribe` | `lib/ai/transcribe.ts` | Audio chunks of a consented session. Arabic chunks are transcribed twice, pinned to each language, and the more confident kept (ruling N19) |
| Draft note | `gpt-4o` | `lib/ai/note-writer.ts`, `lib/ai/notes.ts` | The session transcript |
| Risk indicators | `gpt-4o` | `lib/ai/risk.ts`, `lib/data/session-risk.ts` | The transcript; returns indicators with quotes, never a level |
| Speaker split | `gpt-4o-mini` | `lib/ai/diarise.ts` | Transcript segments |
| In-session suggestions | `gpt-4o-mini` | `lib/ai/copilot.ts` | Recent transcript |
| Case copilot | `gpt-4o` | `lib/ai/case-copilot.ts` | One patient's transcripts and documents, each line tagged `[S2:14]` or `[D7:3]` |
| General assistant | `gpt-4o` | `lib/ai/assistant.ts` | The clinician's question and their roster (names, dates, note counts); no clinical content |
| Profile and timeline | `gpt-4o` | `lib/ai/profile.ts` | The person's sessions |
| Diagnoses from documents | `gpt-4o` | `lib/ai/diagnoses.ts` | An uploaded document's text |
| Translation | `gpt-4o` | `lib/ai/translate.ts` | CMS and note text |
| Partner copilot | `gpt-4o` | `lib/partner/copilot.ts` | That partner's own sessions |

- **Citations resolve or are dropped.** The copilot must return the references it was given;
  `keepResolvableCitations` (`lib/documents/chunk.ts`) and `resolveCitations` drop any that do
  not match a real row.
- **A patient never converses with a model.** Patients see only text a named clinician
  approved; `verify:sprint24` checks the import graph.
- **The risk ladder is code, not a model** (`lib/crisis/level.ts`). The classifier returns
  indicators (ideation, intent, plan, means, timeframe, previous attempt, self harm, homicidal
  ideation, psychosis, abuse, protective factor). `levelFor` maps them to `none`, `low`,
  `moderate`, `elevated`, `high`, `critical`. The phrase list (`scanForCrisisLanguage` in
  `lib/crisis/alerts.ts`) sets a floor of `elevated` the model can only raise. Protective
  factors never lower a level. `elevated` and above alert.
- **A failed risk check is visible**: `sessions.risk_check_failed_at`, shown to the clinician
  (ruling DD6).
- **Consent gates.** Recording needs the patient's per-session consent (`lib/consent.ts`); the
  AI fee is charged only then. It also needs a confirmation that the patient is 18 or over, on
  the session, the chart or the patient's own account (`lib/data/adult.ts`, ruling B1-6). A withdrawn cross-border consent stops every model call about
  that person while the keyword floor keeps running (`lib/data/ai-consent.ts`, ruling DD3).
  Signup stores the terms version naming the processors (`lib/consent/terms.ts`, ruling DD1).
- **Known gap.** Speaker separation is arithmetic over tracks (`lib/diarisation/`); no
  diarisation provider is called and acoustic diarisation error is not measured.

## Money

All money posts to a double-entry ledger (`lib/billing/ledger.ts`): `journal` refuses a
transaction whose legs do not sum to zero. Accounts: `cash`, `therapist_payable`,
`therapist_receivable`, `platform_revenue`, `platform_expense`, `sponsor_pot`,
`patient_wallet`, `vat_payable`, `fx_difference`, `partner_receivable`. Two entities, `us` and
`eg`; moving money between them is an explicit `entity_transfer`.

| Piece | Where | Shipped default (live values are in `platform_settings`) |
| --- | --- | --- |
| Our fee on a paid session | `lib/settings/defs.ts` `session` | 15 per cent, on sessions paid through us only (ruling 5d) |
| Per-session platform fee | same | $1 every session, $3 more when the patient consented to AI, pay as you go only |
| Plans | `pricing.tiers`, `seatBands` | Pay as you go; Practice $80 a month; Clinic $72 a seat from two seats; plans pay no per-session fee |
| Session price | set by the therapist | One price, 50 minutes (ruling 6) |
| Company pot | `lib/billing/pot.ts` | A prepayment held as a liability; covers a set share of each session |
| Patient wallet | `lib/billing/wallet.ts` | Credit from a cheaper replacement clinician; spent first after the company benefit (ruling 7b) |
| VAT | `country_settings`, `rules.tax` | Sessions exempt (ruling 2); company top-ups standard |
| Card fee | `rules.payments` | Patient pays it on the card share (ruling 12) |
| EGP rate | `payouts.egpRateMicro` | 50 EGP to the dollar, set by hand (ruling 10) |

| Rail | State | Code |
| --- | --- | --- |
| Bank transfer (InstaPay) | Live. The patient declares, staff confirm, nothing is granted before confirmation | `lib/billing/manual.ts` |
| Paymob cards and payouts | Adapter built, waiting for keys | `lib/billing/gateway/` |
| Stripe | Switched off (ruling 17); code left in place | `lib/billing/stripe.ts` |
| Clinician payouts | Manual in EGP by InstaPay or wallet, confirmed by staff | `lib/billing/payouts.ts` |
| ETA e-invoices | Foundation built, waiting for registration | `lib/billing/eta/` |

## Crisis and safety

| Control | Where |
| --- | --- |
| Alert raised from the phrase list or the risk ladder, written before anyone is notified | `lib/crisis/alerts.ts` (`raiseCrisisAlert`) |
| Out of band at once: email, and WhatsApp where a channel and an approved template exist | same, through `notify()` (ruling CR1) |
| Escalation if unacknowledged after `crisis.escalateAfterMinutes` (default 15): clinic colleagues and managers, then the platform's managers and super admins | `lib/crisis/escalation.ts` (rulings CR2, CR3) |
| A higher level inside 10 minutes upgrades the alert and notifies again | `dedupDecision` (ruling CR5) |
| Acknowledge on a signed-in page, never by opening a link | ruling CR1 |
| SOS numbers per country; `/sos` works without JavaScript | `lib/crisis/sos.ts`, `lib/crisis/line.ts`, `app/sos/page.tsx` |
| The crisis path never depends on money | Rule C235; the `crisis` demo position walks it (promise P5, `docs/DEMO.md`) |
| The patient's crisis reply says who was told, in their language | `lib/crisis/patient-message.ts` (ruling CR8) |

## Privacy controls

| Control | Where |
| --- | --- |
| A clinician reads a person's history only under a live grant from that person | `history_grants`, `lib/data/grants.ts`, `lib/access/state.ts` |
| A company sees counts and money, never names, sessions or days; balances publish in steps of `activityFloor` (5) and months are built only from published weeks (ruling N37) | `lib/data/sponsors.ts`, `lib/sponsor/ledger.ts`, `lib/billing/pot.ts` |
| A clinic sees first name and last initial, nothing clinical | `lib/clinic-auth/capabilities.ts` |
| Personal files go to a private Blob store and are read through authorised routes; with no private store they are refused | `lib/uploads.ts` (`PRIVATE_KINDS`) |
| Staff read clinical rows only after giving a reason, for 15 minutes | `lib/audit.ts` (`investigationGrantHolds`) |
| Every read of clinical data is audited; audit rows kept six years | `lib/audit.ts`, `audit_log`, `retention` job |
| Server errors keep the route and stack, never the body, query, headers or cookies | `instrumentation.ts`, `lib/observability/errors.ts` |

## Background jobs

One route, `app/api/cron/[job]/route.ts`, guarded by `CRON_SECRET`. Each run writes a
`cron_heartbeats` row.

| Job | Schedule (`vercel.json`, UTC) | Does |
| --- | --- | --- |
| `crisis` | hourly at :20 | Re-sends undelivered alerts, escalates, sweeps the radar, abandoned patients, unrated and overrun sessions, runs the watchdog |
| `reminders` | hourly at :20 | Booking reminders, check-ins, in-person sweeps, wallet holds and expiry, releases unpaid bookings, partner webhooks, ETA documents, refreshes the tick marker, watchdog |
| `billing` | daily 03:05 | Missing charges, held earnings, aged payouts, enrolment checks, pot reconciliation and alerts, renewals and seat months, partner bills |
| `retention` | daily 03:10 | Audit rows over six years, expired sessions and limits, errors over 30 days, open carts, licence expiry |
| `extract` | daily 03:15 | Reads text out of uploaded documents |
| `tick` | every minute | Crisis escalation, then session reminders at 60, 30, 15 and 5 minutes (ruling N27) |

`licences`, `radar` and `webhooks` are callable by name but not scheduled; their work runs
inside the jobs above.

**The tick marker.** So the every-minute tick does not keep the database awake, it first
reads a small JSON marker from Blob (`lib/data/reminder-marker.ts`, logic in
`lib/sessions/reminder-marker.ts`) holding the next session start and the next crisis
deadline (`crisisDueAt`). It touches the database only when something is due within the next
61 minutes, when the marker is missing, stale or unreadable, or at :20 with the hourly jobs.
Writes are conditional on the version read, and the path is keyed to a hash of the database
host so previews cannot overwrite production's marker (rulings N34, CR4).

## Observability

| What | Where |
| --- | --- |
| Uncaught server errors, scrubbed | `instrumentation.ts` to `error_events` (`lib/observability/errors.ts`), shown at `/admin/errors` |
| Job health and the watchdog email to super admins when a job's last clean run is twice its interval old | `lib/observability/heartbeat.ts` |
| Operations alerts | `ops_alerts`, the admin board |
| AI usage and cost | `ai_request_logs`, `/admin/usage` |
| Logs | `lib/logger.ts`: ids are hashed with `ref()`, error messages pass through `safeErrorMessage` |
| Sentry | Not installed |
