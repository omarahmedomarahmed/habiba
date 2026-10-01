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
| Therapist | `users` (role `therapist`) | `24t_session` | `lib/auth/guard.ts` | 30 minute idle counted from the person's own requests, not polls (`lib/auth/activity.ts`), 8 hour ceiling, a started session finishes (`lib/auth/session.ts`). Optional authenticator app, asked for at sign-in once on. Must be verified to practise (`requireVerified`) |
| Our staff | `users` (roles `staff`, `manager`, `super_admin`) | `24t_session` | `lib/auth/guard.ts` | Second step required: authenticator app or a recovery code, never an emailed code. One without an app enrols on the step page after six digits emailed to their own address prove the inbox (`lib/auth/enrolment-proof.ts`, `lib/auth/totp.ts`, `lib/auth/second-factor.ts`) |
| Patient | `patient_accounts` for a `people` row | `24t_patient` | `lib/patient-auth/` | Phone or email, password or one-time code |
| Clinic manager and staff | `clinic_managers`, `clinic_roles` | `24t_clinic` | `lib/clinic-auth/` | Capabilities checked on the resource (`lib/clinic-auth/capabilities.ts`); up to two custom roles. Optional authenticator app (`portal_second_factors`) |
| Company | `sponsor_users` | `24t_sponsor` | `lib/sponsor-auth/` | Roles `admin`, `viewer` |
| Partner | `partner_users`, `partner_api_keys` | `24t_partner` | `lib/partner-auth/` | Roles `admin`, `developer`; the API takes a key. Optional authenticator app (`portal_second_factors`) |
| Token holder | the link row | none | the page | `/join`, `/pay`, `/welcome`, `/records`, `/feedback`: the token is the whole credential |

A person who is both a clinician and a clinic manager holds two linked principal rows and
one active session at a time: switching revokes the side being left before minting the other,
and is audited (`lib/clinic-auth/switch.ts`). Invitations and resets for operator-created
accounts are single-use links in `account_links` (`lib/auth/account-links.ts`).

| Sign-in rule | Where |
| --- | --- |
| Every `next` after a sign-in, a bounce or a second step passes one same-origin check (no `//`, no backslash, no control character) | `lib/auth/safe-redirect.ts` |
| Every password door and the patient code doors count guesses per network and per account, atomically; an unknown address counts the same way, so no message says whether an account exists. A proved code or a reset clears the password count (ruling B2.2) | `lib/auth/attempts.ts`, `lib/rate-limit.ts` (`accountAttempt`), `lib/patient-auth/code-attempts.ts` |
| The idle timeout counts a person's own requests. Polls send `x-24t-background: 1`; prefetches and `router.refresh()` do not count; a session in progress keeps its room alive with `keepSessionAlive` (ruling B2.5) | `lib/auth/activity.ts`, `lib/auth/session.ts` |
| An optional authenticator app for clinicians, clinic managers and partner users, added after typing the password again; once on, a right password returns a challenge, not a session (ruling B2.4) | `lib/auth/portal-second-step.ts`, `portal_second_factors` (migration 0189) |
| A lost app: a super_admin resets a staff member's from Team; a super_admin or manager resets a clinician's, clinic manager's or partner user's from Sign-in security; a sole super_admin uses the audited break glass `factor:reset` (`docs/OPERATIONS.md`) | `lib/auth/factor-reset.ts`, `scripts/reset-second-factor.ts` |

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
(trigger), one invoice per session, `users.verification_status` derived by trigger,
`audit_log` append-only with no fixture door and TRUNCATE refused (migrations 0184, 0189), the
ledger's posting keys, no UPDATE and balance at commit (0188, under Money), and every crisis
alert keeping a session, a person or the journal it came from even after a delete (0194).

The app and the migrations still share the database owner role, which could drop those
triggers; a restricted app role is founder item F-ROLE in `docs/DECISIONS.md`.

## The AI layer

Every model call goes through `lib/ai/client.ts`, which logs usage as metadata only (no prompt
or completion text) to `ai_request_logs` and prices it from `platform_settings.aiRates`. There is
no mock fallback: without `OPENAI_API_KEY` the call fails.

| Task | Model | File | What is sent |
| --- | --- | --- | --- |
| Transcription | `gpt-4o-mini-transcribe` | `lib/ai/transcribe.ts` | Audio chunks of a consented session. Arabic chunks are transcribed twice, pinned to each language, and the more confident kept (ruling N19) |
| Draft note | `gpt-4o` | `lib/ai/note-writer.ts`, `lib/ai/notes.ts` | The session transcript, and how the clinician says the patient is addressed (`patients.address_as`) |
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
- **A failed note is a failure, not a blank draft.** A reply cut off (`finish_reason` of
  `length`), filtered, unreadable or with no clinical text throws `UnusableNoteError`
  (`lib/ai/note-writer.ts`); the note is marked failed and the clinician sees "try again" and
  "write it myself".
- **A translation follows the note.** `session_notes.content_en_source` holds the md5 of the
  content the English copy was made from; every read goes through
  `lib/notes/fresh-translation.ts`, so an edited note shows and exports no stale English until
  it is translated again on signing (migrations 0191, 0195).
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

The database holds the same rules (migration 0188): `ledger_entries` refuses UPDATE except a
foreign key emptying an account column, each `txn_id` must sum to zero at commit (a deferred
constraint trigger), and a business event's `posting_key` is unique, so a double post fails.
DELETE is left to fixtures and the demo reset; no product code deletes a leg. A card payment's
claim, session and postings are one transaction, and so is a pot spend. Patient payments and
payouts carry `egp_minor` and `fx_rate_micro`, and an EGP payout may not exceed the pounds the
clinician's sessions brought in (proposed rulings DC1 to DC6 in `docs/DECISIONS.md`).

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
| Clinician payouts | Manual in EGP by InstaPay or wallet, confirmed by staff. See the payout rules below | `lib/billing/payouts.ts` |
| ETA e-invoices | Foundation built, waiting for registration | `lib/billing/eta/` |

| Payout rule (proposed rulings DC2 to DC6) | Where |
| --- | --- |
| Maker and checker: whoever confirmed a bank transfer behind a payout does not approve it, and whoever approves does not send (`rules.approvals.payoutSeparation`, on). The four-eyes rules (payee, last editor, second person above a threshold) still apply | `lib/billing/payouts.ts`, `lib/billing/four-eyes.ts` |
| A transfer can be confirmed against the bank statement's amount, and the audit row says which check was made | `lib/billing/manual.ts` |
| Earnings are withdrawable 7 days after the session ended (`rules.earnings.holdDays`) | `stillHeldFor`, `lib/billing/available.ts` |
| A send with no provider answer is `unknown`: not sent again and not marked sent by hand. The hourly job asks the provider again (`recheckUnknownPayouts`); 72 hours of finding nothing is raised on `/admin/errors` (`payout_requests.provider_no_record_since`, 0195). A second staff member, never the sender, may record "Provider confirms it was not sent" (`confirmPayoutNotSent`) | `lib/billing/payout-unknown.ts`, `lib/billing/payouts.ts` |
| EGP guard: a payout is refused when it would send more pounds than the clinician's sessions brought in, using the pounds stored on each leg | `lib/billing/egp-books.ts` |

## Crisis and safety

Detection. The phrase list is the floor; the model can only raise it.

| Piece | Where |
| --- | --- |
| The lexicon: English, Egyptian Arabic, Arabizi and transliterated phrase classes, folded (diacritics, letter variants) before matching | `CRISIS_PATTERNS` and `scanForCrisisLanguage` in `lib/crisis/alerts.ts`, `lib/crisis/fold.ts` |
| Arabic matches whole words with clitics allowed in front (`arabicWords`), so "قدامي" is not "امي" and "وهنتحر" still matches | `lib/crisis/fold.ts` |
| Context rules: a third party or a past or resolved frame quiets only a phrase that names nobody ("suicidal"); a first-person phrase alerts even in the past or said to be over (ruling CR16). A relative quiets only inside the phrase's own clause, and "no longer" or "used to" followed by an inability is not resolved | `lib/crisis/context.ts` (`stillCounts`, `suppressedIn`, `firstPersonIn`) |
| Live sessions: a line labelled the therapist's is not scanned; from an unknown speaker, only a question whose crisis words point at "you" is skipped (ruling CR17) | `scanLiveChunk`, `isQuestionToOther` in `lib/crisis/live.ts` |
| A phrase cut across the 8 second chunk boundary is caught by joining the tail (80 characters) of the previous chunk from the same speaker; a phrase found only in that tail is not raised again | `lib/crisis/live.ts`, `lib/data/transcript.ts` |
| Regression suite: every sentence the due diligence found silenced, the near misses beside them and the eval risk cases, no network | `tests/crisis-lexicon.test.ts` (`test:crisis-lexicon`, in CI) |

Escalation.

| Control | Where |
| --- | --- |
| Alert raised from the phrase list or the risk ladder, written before anyone is notified | `lib/crisis/alerts.ts` (`raiseCrisisAlert`) |
| Out of band at once: email, and WhatsApp where a channel and an approved template exist | same, through `notify()` (ruling CR1) |
| Escalation if unacknowledged after `crisis.escalateAfterMinutes` (default 15): clinic colleagues and managers, then the platform's managers and super admins | `lib/crisis/escalation.ts` (rulings CR2, CR3) |
| Out-of-band sends all failed: escalate at once, recorded on `/admin/errors` | `escalateNowIfExhausted`, `afterFailedSend` (ruling CR11) |
| A journal hit goes through `raiseCrisisAlert` like a session's: one alert per clinician holding a live grant, or straight to the platform on-call when nobody holds one or none was written. The alert row outlives the journal entry and the person (0194) | `lib/data/journals.ts` (ruling CR10, migrations 0192, 0194) |
| A higher level inside 10 minutes upgrades the alert and notifies again | `dedupDecision` (ruling CR5) |
| Acknowledge on a signed-in page, never by opening a link; only the treating clinician, a clinician (role `therapist`) in the same practice or the platform on-call (`manager`, `super_admin`). `staff` may not | `mayAcknowledge` in `lib/crisis/escalation.ts` (rulings CR1, CR12) |
| Break glass for a journal alert no clinician can act on: the on-call gives a reason, one `phi_access` audit row is written, and for 15 minutes the page shows the person's name, phone, email and the journal words, with the `/sos` numbers | `mayBreakGlass`, `crisisContactForOnCall` in `lib/crisis/alerts.ts`, `app/(app)/notifications/alerts/[id]/` (ruling CR15, proposed) |
| A patient who paused AI: no transcription, and the room and the session say live risk detection is off | `sessions.live_risk_off_at` (ruling CR13) |
| SOS numbers per country; `/sos` works without JavaScript | `lib/crisis/sos.ts`, `lib/crisis/line.ts`, `app/sos/page.tsx` |
| The crisis path never depends on money | Rule C235; the `crisis` demo position walks it (promise P5, `docs/DEMO.md`) |
| The patient's crisis reply says who was told, in their language | `lib/crisis/patient-message.ts` (ruling CR8) |

## Privacy controls

| Control | Where |
| --- | --- |
| A clinician reads a person's history only under a live grant from that person | `history_grants`, `lib/data/grants.ts`, `lib/access/state.ts` |
| The shared record (AI standing profile, timeline, diagnoses) follows the grant like files and journals: open under a live grant, or for an unclaimed person only while this clinician holds the only chart. A person with a patient account counts as claimed. Revoked, refused, expired or no grant: closed. Homework set by others follows the same rule; otherwise a clinician sees only the steps they set (ruling B1-1) | `maySeeSharedRecord`, `homeworkScopeFor` in `lib/access/state.ts`; `lib/data/memory.ts`, `lib/data/diagnoses.ts`, `lib/data/homework.ts` |
| A partner reads a note, transcript, summary, media, memory or copilot only for a session in one of its own practices and only while the person's link stands (`partner_subjects.revoked_at` empty) (ruling B1-2) | `lib/partner/api.ts`, `lib/partner/platform.ts`, `lib/data/partner-links.ts` |
| A company sees counts and money, never names, sessions or days. Every figure (chart, totals, balance, ledger, CSV) comes from one helper: complete weeks only, a week shows only inside a period of at least `activityFloor` different people (never below 5), and the chart is one contiguous run of weeks so a held-back week looks like an empty one (rulings N37, B1-3) | `companyView` in `lib/sponsor/ledger.ts`, `publishedLedger` in `lib/data/sponsor-ledger.ts` |
| A record link lives 24 hours and opens once: the first open gives 15 minutes to read and download (ruling B1-4) | `lib/data/export.ts`, `app/records/[token]/` |
| A public page row carrying a claim that is false today is never served: the code default is served instead (or the offending blocks hidden), the errors board is told, and the console refuses to save one | `lib/content/claims.ts`, `lib/content/service.ts` |
| A clinic sees first name and last initial, nothing clinical | `lib/clinic-auth/capabilities.ts` |
| Personal files go to a private Blob store and are read through authorised routes; with no private store they are refused | `lib/uploads.ts` (`PRIVATE_KINDS`) |
| Staff read clinical rows only after giving a reason, for 15 minutes | `lib/audit.ts` (`investigationGrantHolds`) |
| Every read of clinical data is audited; audit rows kept six years. No session setting opens the log for rewriting and TRUNCATE is refused (0189); the dev reset never truncates it | `lib/audit.ts`, `audit_log`, `retention` job |
| Webhook delivery connects to the address the SSRF check approved; no second DNS lookup | `pinnedLookup`, `pinnedDispatcher` in `lib/net/public-url.ts` |
| Server errors keep the route and stack, never the body, query, headers or cookies | `instrumentation.ts`, `lib/observability/errors.ts` |

## Background jobs

One route, `app/api/cron/[job]/route.ts`, guarded by `CRON_SECRET`. Each run writes a
`cron_heartbeats` row.

| Job | Schedule (`vercel.json`, UTC) | Does |
| --- | --- | --- |
| `crisis` | hourly at :20 | Re-sends undelivered alerts, escalates, sweeps the radar, abandoned patients, unrated and overrun sessions, runs the watchdog |
| `reminders` | hourly at :20 | Booking reminders, check-ins, in-person sweeps, wallet holds and expiry, card payments not on the books, payouts with no provider answer, releases unpaid bookings, partner webhooks, ETA documents, refreshes the tick marker, watchdog |
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
| Outside check | `.github/workflows/uptime.yml` fetches `/` and `/api/health` (no database) every 15 minutes (`docs/OPERATIONS.md`) |
| Sentry | Not installed |

## CI database seam

The app's driver speaks WebSocket to Neon. When `DATABASE_WS_PROXY` is set, `lib/db/local-proxy.ts`
points the driver at a local plain `ws://` proxy (Neon's `wsproxy`) in front of a stock Postgres,
and refuses any database host that is not on this machine. Unset, nothing changes, so production
is untouched. CI's "Database checks" job uses it (`docs/TESTING.md`).
