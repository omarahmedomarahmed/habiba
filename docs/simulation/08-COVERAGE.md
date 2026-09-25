# Coverage: every page, file, job, money path and message, placed

This is the proof that the run tests everything, written before it runs. `npm run verify:runbook`
holds the parts a machine can check: every page in `app/` is a step in `03-THE-FLOWS.md` or
excused below, every cron job is fired in `02-THE-MONTH.md`, and every step or edge id any
document names is defined.

## How it was read

| Pass | What | Files |
|---|---|---|
| 1 | Five readers, one per area (patients, therapists, clinics and companies, the console, money and jobs and partners), each following every page to every action and library function it reaches | 677 distinct files |
| 2 | Three readers given exactly the source files the first pass never opened, each mapping every file to a step, a new step, or "no user-visible behaviour" | 276 files |
| | Every `.ts` and `.tsx` file under `app/`, `lib/` and `components/`, except the 35 files of the internal `/design` mockups | 953 of 953 |

Pass 2 found 40 new steps and 87 new edge cases, merged into `03-THE-FLOWS.md` and
`04-THE-EDGES.md`, and the bugs listed under "What the reading found".

## Pages not walked on the live site

| Page | Why |
|---|---|
| `/design`, `/design/patient`, `/design/therapist`, `/design/clinic`, `/design/company`, `/design/console`, `/design/partner`, `/design/website`, `/design/website/patients`, `/design/website/therapists`, `/design/website/clinics`, `/design/website/companies`, `/design/website/partners` | Internal mockups for the redesign, not part of the product. `WB19` opens the hub once to confirm it is not linked from the product |

Every other page is a step in `03-THE-FLOWS.md`.

## What the reading found

Found by reading the code, before anything ran. Each is confirmed or cleared on the live site by
the step in the last column, and then goes in `BUGS.md` with what the screen actually showed.
Nothing here is fixed until the run has confirmed it, so the fix is tested against a failure
somebody saw.

### Fixed before the run, because the run could not happen without them

| # | What | Fixed by |
|---|---|---|
| F1 | A phone-only person's messages (sign-in codes, reminders) never reached the outbox while WhatsApp is unconfigured | `lib/notify/index.ts`: kept whenever the simulation runs. `verify:outbox` |
| F2 | An address at a subdomain of example.com would have been emailed for real | `lib/notify/outbox.ts`. `verify:outbox` |
| F3 | Future deadlines never came due in a compressed month | `sim:clock` moves the whole database. `verify:clock` |
| F4 | The staff seed expected applicants on the US entity; Egypt is the default | `scripts/simulate-seed.ts` |

### To confirm on the live site

| # | Severity | What the code does | Confirmed by |
|---|---|---|---|
| K1 | money | A plan bought by bank transfer is due at once; the next billing run lapses it, and a transfer confirmed after that clears the bill but never turns the plan on (`lib/billing/service.ts:920`, `:1123`) | `TE40`, `TH14` in R4 |
| K2 | safety | "Verify" on `/admin/therapists` skips the verification process: no document check, no second reviewer, no email (`lib/data/admin.ts:149`) | `AD16` in R5 |
| K3 | money | Ledger adjustments need a second super admin, and the team page can only create staff or managers, so with one founder nothing ever posts (`approval-actions.ts:26`) | `AD11` in R5 |
| K4 | money | A "credit without proof" approval hangs forever if its cart is discarded or cleared by retention | `AD6` in R5 |
| K5 | money | A confirmed transfer whose follow-on step fails keeps no audit row (`transfers/actions.ts:40`) | `AD5` |
| K6 | privacy | The company overview shows the session count and balance while fewer than five people are enrolled, so a small company learns who went (`sponsor/page.tsx:78`, `:87`) | `CO10`, `EE8` |
| K7 | privacy | The clinic's monthly AI fee shows even when the session count is held back, which can reveal one patient's recording consent; the week export's State column shows more than the screen | `CL9` |
| K8 | safety | A journal entry with crisis wording alerts only clinicians with 24-hour access, not those with open-ended access (`lib/data/journals.ts:171`) | `PE55` in R3 |
| K9 | stuck | Arrival ratings are never saved: the room sends the join token where the feedback token is expected, and the screen still says thank you (`patient-room.tsx:599`) | `PA16.7` |
| K10 | stuck | A signed-in patient paying by transfer is told nothing when it is submitted or confirmed unless a receipt email was typed (`payment-notices.ts:148`) | `PA12` in R1 |
| K11 | record | After a rejoin or in two tabs, transcript lines are dropped silently though they show on screen (`session-room.tsx:183`, `transcript.ts:101`) | `TE11` |
| K12 | safety | Cancelling a radar session releases the claim even when the cancel did not match, so one clinician can reset another's radar status (`sessions/actions.ts:480`) | `TH16` |
| K13 | money | Partner production approval needs a documents link nothing ever writes, so no live keys and no partner bill; and a posted partner bill cannot be paid (`partner-admin.ts:291`) | `PT6` in R3 |
| K14 | money | A seat added mid-month is charged the full month; reducing seats twice keeps only the last credit, and the credit is never applied; a cancelled invitation does not release its seat; a tampered invitation can buy 50 seats (`seats.ts:73`, `service.ts:820`, `people/actions.ts:60`) | `ME87`, `CE14`, `CE10` |
| K15 | money | A radar session part-paid from a company pot and abandoned keeps the company's share forever; re-booking on the radar cancels the hold without returning it | `ME43`, `ME44` |
| K16 | money | Retrying a failed grant after the session was marked paid tells staff to refund an overpayment (`ME3`); earnings netted against a balance are booked to the US entity (`service.ts:256`); expired wallet credits stay owed (`ME24`); the in-person refund-to-wallet setting is never read | `ME3`, `ME24`, `AD10` |
| K17 | wrong | No renewal reminders are sent: the billing job counts bills due in 7, 3 and 1 days and messages nobody (`route.ts:349`) | day 28 in `02-THE-MONTH.md` |
| K18 | wrong | Setting homework or a questionnaire sends the patient nothing, and the lists may need a reload | `TH11`, `PA21` |
| K19 | stuck | An invite link is used up even when the record was already claimed by someone else; sessions booked before claiming stay out of the claimed app; the sign-in code and the add-email code cancel each other | `PE42`, `PE43`, `PA23` |
| K20 | money | Cancelling a booking with a submitted transfer leaves the transfer in the queue, and confirming it marks nothing paid | `PE24` |
| K21 | wrong | Words left in English under Arabic: "Confirm", "Save", the `/verify` page, the change page title, risk alerts, pot and payout alerts | `PE66`, `PA23` |
| K22 | wrong | The copilot banner says "per month" for an allowance earned per session; the "patient was waiting" email says Crisis Radar for any session; the pay-as-you-go notice hard-codes $1 and $3 | `TH10`, `PA17` |
| K23 | wrong | The 10-character reason rule is missing on five actions, and a pot return cancel needs one person and no reason | `AE53` |
| K24 | gap | There is no way for a patient to delete their account | `PA29` in R6 |
| K25 | gap | Four money paths have no caller: entity transfers, credit purchases, card top-ups of a company pot, and the summary-ready message | none; listed so nobody looks for them |
| K26 | wrong | A double billing run in one day sends the one-person digest twice; one error in the booking release step stops webhooks for the hour | `ME` cron edges |

### Things the run must work around, not bugs

| # | What | How the run handles it |
|---|---|---|
| W1 | The crisis radar allows one unpaid booking per network, and every agent shares one network, so one agent's radar booking cancels another's | Only one agent books on the radar at a time; the board serialises it (`PA11` waits on the previous radar booking being paid or ended) |
| W2 | Staff second steps last 12 hours, and each address may ask for three codes in ten minutes | Staff sign in once per round, one at a time, reading codes from the outbox |
| W3 | A work email domain cannot be proved by DNS for example.com | Enrolment uses the staff email list; the domain proof is walked to its refusal (`CO6`) |
| W4 | Announcements go to every active clinician | Posted only in R5, when every active clinician is invented |
| W5 | The founder's real inbox gets the sign-in codes, the daily digest and watchdog alerts during the run | Expected; the founder is told before each round |

### Found reading the remaining files

- app/session-expired/route.ts:34: always redirects to `/login`, so an idle staff member bounced from `/admin/...` lands on the clinician door and is refused there, while the cookie-less path in lib/auth/guard.ts:87 correctly uses `/staff/sign-in`.
- components/documents/document-list.tsx:132: when the speak route answers non-OK the function returns without `setSpeaking(false)`, leaving "Read aloud" disabled on "Reading…" until reload.
- components/documents/document-list.tsx:170 and :290: "Flagged: " with the raw reason enum and "Open {title}" are hardcoded English.
- components/billing/payment-history.tsx:89 and :107: "A patient" and "of" are hardcoded English on /earnings.
- components/clinical/risk-banner.tsx:67: the level is passed as the raw enum into `risk.detected`, so Arabic readers see "high" in English (RiskAssessment translates the same value through LEVEL_LABEL).
- components/clinical/patient-brief-card.tsx:51: `text-end` together with `dir="rtl"` aligns an Arabic brief to the left.
- app/(room)/not-found.tsx:4: RouteNotFound uses dark slate text, rendered on the room layout's `bg-navy-600`, so the 404 heading is unreadable.
- components/auth/auth-shell.tsx:216: QuietAuthShell renders `<h1>` even when `title` is empty, which the staff pages pass, contrary to its own doc comment.
- app/api/meetings/transcript/[sessionId]/route.ts:117-118: answers `processed: true` but writes no transcript segment, so a provider believes audio was stored.
- app/api/documents/[id]/speak/route.ts:110: a paid speech model call per press with no rate limit.
- lib/data/patients.ts:123 (and lib/data/radar.ts:605): a malformed id reaches a uuid column unchecked; likely an error boundary instead of a 404 (TE56 confirms).
- components/demo/clinical-demo.tsx:160: NoteDemo passes the literal "demo" as the patient label instead of `hdemo.patientLabel`.
- components/demo/patient-app.tsx:454: the demo adds 14% VAT to a radar session, while PA12.1 says sessions are VAT exempt by default; the marketing figure is higher than what the product charges.
- components/demo/flow-demo.tsx:196: "This is not me" in the claim walkthrough advances as if the reader said yes; the product declines instead.
- components/demo/portal-demo.tsx:334: the clinic demo rota shows a video or in-person column the real `/clinic` rota does not show (CL9.1).
- components/clinical/risk-banner.tsx:116: `PatientSupportNotice` has no caller (dead code; no user impact).
- app/robots.ts:41-57: outside the simulation the disallow list omits `/patient`, `/pay/`, `/feedback/`, `/records/`, `/support/`, `/welcome/`, `/clinic`, `/sponsor`, `/partner`; those rely on per-page noindex only.

- lib/checkins/receive.ts:59: `handleReply` has no caller and the app has no inbound message route, yet every check-in ends "Reply with the word stop and they end." (lib/i18n/messages.ts:2617), so a STOP reply never mutes and a crisis reply to a check-in is never scanned or escalated.
- lib/checkins/receive.ts:177: if it is ever wired, `mostRecentSessionFor` orders by `scheduled_at DESC`, which puts NULL (start-now in-person sessions) first and includes cancelled sessions, so the alert can go to the wrong clinician.
- lib/ai/case-copilot.ts:474: `profileFor` discards its `before` bound (`void before`), so a profile rebuilt during a live session reaches the in-room copilot despite its "only what came before" rule (TE62).
- lib/ai/case-copilot.ts:277: the copilot context takes the OLDEST 12 sessions (`asc(createdAt)` with `limit(12)`), so for a long-running patient the newest sessions are never read.
- lib/console/pot-trace.ts:106: joining session payments to a sponsor through the person's enrolments lists another sponsor's funded sessions and duplicates rows after re-enrolment, breaking "Where the pot went" and the "Agrees" check (AE58, AE59).
- app/(admin)/admin/settings/actions.ts:175 and :204: `saveSession` and `savePayouts` do not revalidate `/pricing` (a `revalidate = false` page), so the published fee, cut and EGP figures go stale (ME99).
- components/public/audience-demos.tsx:83: the therapist fee split demo hardcodes 15% while /pricing shows `platformFeeBps` from settings.
- lib/content/defaults-ar.ts:794: the Arabic contact page's default company addresses are an instruction to the admin, rendered publicly as the address (ME101).
- components/public/site-chrome.tsx:110: the language switch is hidden below 640 px and `components/public/mobile-nav.tsx` has none, so phone visitors cannot switch language on the public site (ME98).
- app/api/patient/avatar/[personId]/route.ts:95: `mayRead` checks only the patients row, not a live grant, so a clinician the patient chose not to keep still sees the patient's own photo (PE80).
- lib/access/state.ts:214-247: access banners and the three decline reasons are English literals, shown untranslated in the Arabic clinician and patient UI (PE82).
- lib/consent.ts:81: `lateRecordingStamp` (the 7.8 "recording began late" notice) and `RECORDING_CONSENT` are never used, so a recording turned on minutes into a session carries no notice.
- lib/crisis/context.ts:240: present-tense markers are matched as substrings ("now" inside "know", "snow"), which cancels third-party and resolved-past suppression and over-alerts (TE63).
- lib/ai/assistant.ts:66: the system prompt says "There is no appointment schedule in this product yet" while the roster it is given carries each patient's next session date, so the assistant may deny upcoming sessions.
- lib/content/demo.ts:472: an Arabic reader gets an English CMS `demo` row in preference to the built-in Arabic fallback when no Arabic row exists.
- lib/console/board.ts:380: the TV activity card counts every row with `actor_user_id` as "staff", which includes clinicians; `companiesBoard` counts all sessions of actively enrolled people, not pot-funded ones.
- components/radar/radar-hero.tsx:207: the home hero quotes "From {price}" in dollars via `formatUsd` while the cards under it use `Money` (pounds in the app).
- components/ui/money.tsx:82: `stopPropagation` on the amount means a tap on the price of a radar card toggles the currency and does not open the booking sheet.
- components/radar/public-radar.tsx: exported but imported nowhere (dead code beside `radar-console.tsx`).
- components/partner/webhook-list.tsx:87: endpoint "Disable" has no confirm step although key revoke was given one for the same reason (ME103).

- lib/data/session-risk.ts:245-270: `priorRiskFor` filters on `therapistId` only, so "Before this session" shows other patients' risk alerts as this patient's history (edge TE75).
- components/assessments/patient-questionnaire.tsx:107: questions render `text[locale]`, so an Arabic reader gets the unreviewed Arabic PHQ-9 and GAD-7 drafts that `lib/data/instrument-seeds.ts:73-81` keeps at `locales: ["en"]` precisely so they never reach a patient (edge PE87).
- lib/i18n/strings.ts:302: completeness percent is rounded before `lib/i18n/authoring.ts:218` compares it with 100, so a language missing a handful of strings can go public (edge AE65).
- lib/settings/index.ts:211-212 and 233-234: every country save re-stamps the crisis line as verified by whoever saved, even when the number was not touched, which erases who actually checked it (edge AE68).
- lib/data/session-voices.ts:39: `recordVoices` has no caller and nothing in `lib/diarisation/` is wired, so the Voices panel of TH6.14 can never show a voice or its "This is me" controls (edge TE77).
- lib/ehr/file-note.ts:70 and lib/data/ehr.ts:290: `fileNote`, `recordLaunch` and `readPatientName` have no caller and there is no launch route, yet lib/integrations/registry.ts:146-147 tells visitors the flow "works end to end against a sandbox" and an approved note "is filed back".
- lib/data/clinic-visibility.ts:107: `clinicAffiliations` has no caller, so the clinic label that is supposed to tell a patient on a radar card that the clinician works inside a practice is never shown.
- lib/data/vault.ts:429: MRR is `payingOrgs * 9900`, a hard-coded $99 that ignores the tier prices set in AD14.1 (edge AE70).
- lib/data/actuals.ts:496: `monthRange` keeps the first 36 months from the earliest record and stops, so after three years the newest months drop off `/admin/actuals` (latent).
- lib/mail-previews.ts:151-485: 26 previews go out where AD14.8 and the settings page comment say 14, several preview links point at routes that do not exist, and some copy differs from the real sends (benefit code "lasts 15 minutes" against the 30 minute code of PA25.2) although the header says the copy is lifted from the call sites (edge AE69).
- lib/documents/formats.ts:102-120: searchability labels are English literals, not dictionary keys, so they stay English under Arabic; extraction state `none` is labelled "Searchable".
- docs/simulation/03-THE-FLOWS.md TH11.3 says "image up to 8 MB"; the document uploader allows 25 MB and PDF, Word and text (lib/documents/formats.ts:30, components/documents/add-document.tsx:168).
- lib/data/note-record.ts:297-376: `signNote` and `releasePatientCopy` return ok and write an approval audit row even when nothing changed (already signed or released).
- lib/data/capital.ts:303-325: `setOtherCost` with 0 for a month that has no row writes a `cost.set` audit line for a cost that was never stored.
- lib/partner/notes.ts:146-177: `deliverSummary` has no guard on `summary_delivered_at`, so a second delivery silently replaces a summary the patient may already have read.
- lib/lifecycle/machines.ts:341-381: the declared claim state "locked" says it "unlocks on its own", but the product needs the clinician's "Let them try again" (TH5.5), and the "grant" machine describes employer approval that no screen offers; the verifier checks a description that does not match the product.
- lib/data/timeline.ts: no caller anywhere; dead module (not a defect on the live site, listed so nobody schedules a step for it).
</content>
</invoke>


## Money paths

Every way money moves, and the flow that moves it on the live site.

| id | payer -> payee | trigger (route + control) | rail | ledger kinds and tables written (function file) | what each party sees after | flow that must exercise it |
|---|---|---|---|---|---|---|
| MO1 | Patient -> practice/clinician (Egypt session) | /pay/[token] page load calls `openSessionPayment` (opens the cart); form "Declare transfer" (reference text + optional proof upload) -> `declareSessionTransfer`; staff /admin/transfers "Confirm" -> `confirm(paymentId, expected)` | Bank transfer / InstaPay checked by staff | manual_payments awaiting_proof -> submitted (`openManualPayment`, `submitProof`, lib/billing/manual.ts:206,330) -> confirmed (`confirmPayment` :515). Grant `grantSession` (lib/billing/manual-grants.ts:78): `claimSessionPaid` sets sessions.payment_status paid (lib/billing/session-owed.ts:22), spends any wallet hold (MO7), then `postPatientSettlement` (:150) inserts session_payments (funding_source card, capture platform, currency usd) and posts `session_payment`: cash +(gross+vat), vat_payable -vat, platform_revenue -fee, therapist_payable -net (lib/billing/ledger.ts:485-532) | Patient: payment.submitted then payment.confirmed notice (email, WhatsApp if approved template, in-app pnotice.paymentConfirmed) with join link; /pay/[token] shows "submitted" then "confirmed" banner for 48h (lib/billing/pending.ts:79,151). Clinician: held balance up by net on /earnings. Staff: row leaves the queue; one-hand digest next billing run | Patient books an EG clinician, pays by transfer, staff confirms. Also reject path (MO1r below) and confirm without proof (two people) |
| MO1r | (no money) | /admin/transfers "Reject" with reason (>= MIN_REASON) -> `rejectPayment` (lib/billing/manual.ts:724) | Transfer | manual_payments rejected, no ledger | Patient: payment.rejected with the reason; /pay shows the rejection and lets them declare again | Declare a transfer with a wrong reference, reject, redeclare |
| MO1w | Patient -> practice, staff credits without proof | /admin/transfers "Received without proof" -> `confirmUnclaimed`; second person completes from approvals (`secondPersonGate` kind transfer_without_proof, rules.approvals.transferWithoutProof default true) | Transfer | awaiting_proof -> submitted -> confirmed (`confirmWithoutProof` lib/billing/manual.ts:650), then the grant as MO1; pending_approvals row asked -> done | As MO1; audit payment.confirmed_without_proof | Two staff users; the first gets "Asked. A second person completes it" |
| MO2 | Patient -> practice (Egypt session, card) | /pay/[token] "Pay by card" -> `payByCard` -> `createGatewaySessionCheckout` (lib/billing/gateway/session.ts:45); Paymob posts /api/gateway/callback (HMAC) -> `applyGatewayEvent` (:216); return page calls `confirmGatewayReturn` | Paymob card (EGP), card fee on top (rules.payments 2.75% + 3 EGP, lib/settings/defs.ts:780) | session_payments pending upsert (capture platform, presented_currency egp, fx frozen); gateway_payments created -> paid (claim :254). `claimSessionPaid`, session_payments paid, `session_payment` as MO1, plus `card_fee` (cash +fee, cash -fee, platform_expense +fee, platform_expense -fee, :407) | Patient: card page, then room opens (`markInSession`). No payment.confirmed notice on this rail. Clinician: held balance up | Only if Paymob is configured on live; otherwise the page shows `?card=unavailable` |
| MO3 | Patient -> clinician's Stripe account, fee to us (non-Egypt) | /pay/[token] "Pay" -> `startPayment` -> `createSessionPaymentCheckout` (lib/billing/connect.ts:375); Stripe webhook /api/stripe/webhook checkout.session.completed -> `settleSessionPayment` (:963) | Stripe Checkout, destination charge, USD | session_payments pending -> paid; `session_payment` destination shape: cash +application fee, platform_revenue -(fee - settled invoices), therapist_receivable -(settled invoices) (lib/billing/ledger.ts:440-482); invoices auto-settled from the fee get status paid (lib/billing/stripe.ts:450-481) | Patient: Stripe receipt; clinician: money in their own Stripe balance (not "held") | Not on live unless STRIPE_ENABLED. Note: the checkout charges `patientGross` and ignores any wallet hold (connect.ts:529) and marks the session paid directly, not through `claimSessionPaid` (connect.ts:987-990), so a wallet hold is never spent or released (see ME22) |
| MO4 | Company pot -> clinician (sponsored session, company share) | Booking paths call `payFromPot(sessionId, {byPersonId})` (lib/billing/pot.ts:268): /t/[id] book via `bookSlot` (lib/data/scheduling.ts), /radar `bookFromRadar` (signed-in patient), /join/[token], /pay/[token] "Use my benefit" -> `coverWithBenefit`, clinician-created sessions (lib/data/sessions.ts) | Company pot (prepaid) | sponsor_pots.balance_cents debited (conditional UPDATE :596-615), session_payments inserted (funding_source pot, sponsor_share, patient_share, coverage_bps), enrolments.provisional_sessions_used +1 for a provisional enrolment. Ledger `session_payment` in one txn: sponsor_pot +share, cash -share (ref_type sponsor), then the pot leg of `postSessionPayment` (cash +potGross, platform_revenue -potFee, therapist_payable -potNet). sponsor_money_entries weekly row (only if the enrolment was told, ledger_told_at). If fully covered, sessions.payment_status paid (:712-717) | Patient: price shows the benefit line negative, or nothing to pay. Company: /sponsor/pot balance down; weekly anonymous money entry. Clinician: held up by the pot net | Enrolled employee books; also a pot too small ("insufficient"), expired pot ("expired"), paused/unverified enrolment (`benefitShortfall` shows why), in-person cap (rules.inPerson.potSessionsPerWeek=2) |
| MO5 | Employee -> clinician (patient share of a sponsored session) | Same as MO1/MO2/MO3 on a session that already has a pot row | Transfer, Paymob or Stripe | Transfer: `postPatientSettlement` finds the prior pot payment, adds VAT onto session_payments.vat_cents and calls `bookEmployeeShare` (lib/billing/employee-share.ts:30): `session_payment` employee leg (cash +share+vat, vat_payable -vat, revenue -fee, payable -net). Paymob: `applyGatewayEvent` pot branch (session.ts:279-285) same, plus card_fee. Stripe: `settleCoveredShare` (connect.ts:1041) | Patient: paid; company: nothing new | Partial coverage (e.g. coverage 50%) and the employee pays the rest by transfer |
| MO6 | Patient wallet -> clinician (wallet hold) | After the pot, booking paths and `coverWithBenefit` call `holdWallet(sessionId)` (lib/billing/wallet.ts:131); rules.wallet.enabled default true | Patient wallet (credits from MO9) | patient_credits.spent_cents drawn oldest-expiring first, wallet_holds held (unique per session, race returns 0). `patientOwesFor` subtracts it so every screen and rail asks for less. If the wallet covers all: `claimSessionPaid` + `postPatientSettlement(settlesCents 0)` | Patient: /pay shows "from your wallet" line; transfer amount is smaller | Patient who got a wallet credit in MO9 books again |
| MO7 | (spend) | `claimSessionPaid` on any rail calls `spendHold` (wallet.ts:230) | Wallet | wallet_holds held -> spent; `wallet_spend`: patient_wallet +w, cash -w (the rail booked the full share as cash) | Wallet balance on the patient side is already lower since the hold | Any MO1/MO2 payment on a session with a hold |
| MO8 | (release) | Hourly reminders cron `sweepWalletHolds` (wallet.ts:303) for held holds whose session is cancelled, not_required or price <= 0; `refundSplit` calls `releaseHold` | Wallet | wallet_holds held -> released, patient_credits.spent_cents given back. No ledger (nothing was booked) | Wallet balance restored | Cancel an unpaid session that had a hold, then run reminders |
| MO9 | Clinician/us -> patient wallet and company pot (repricing to a cheaper replacement) | Patient on /sessions/[id] after a no-show chooses a replacement -> `reassignSession` (lib/data/recovery.ts:225). Guards: not started, no recovery outcome, overdue (NO_SHOW_AFTER_MINUTES=5), replacement rate <= price | If unpaid: none, price follows the replacement (:329-360). If paid: pot and wallet | Paid: session_payments moved to the replacement; `session_repriced` moves the full net between clinicians (payable +old, payable -new, :400-408). If cheaper and rules.wallet.enabled: `returnPartToPot` (`session_repriced` sponsor_pot -toPot, cash +toPot, pot.ts:1019), `session_repriced` payable +lessNet, revenue +lessFee, cash -difference (:437-446), session_payments gross/fee/net/shares reduced, sessions.price_cents = rate, `creditWallet` (`wallet_credit` cash +toWallet, patient_wallet -toWallet; patient_credits row, expires per rules.wallet.expiryMonths, 0 = 100 years) | Patient: booking.confirmed to the replacement clinician, wallet credit visible; company: pot balance up by its part; absent clinician's held drops, replacement's rises | No-show round: patient waits, picks a cheaper clinician, then books again to spend the wallet (MO6) |
| MO10 | Us -> patient (full refund on the original rail) | `refundSessionPayment` (lib/billing/connect.ts:1136) from: /admin (super_admin) `refundPatient`; no-show "refund" `refundNoShow` (recovery.ts:492); clinician cancel `afterClinicianCancel` (lib/data/clinician-cancel.ts:33); patient cancel inside the free window (rules.refunds.patientCancelWindowHours=24, lib/data/booking-change.ts:106); late cancel agreed by clinician `agreeLateRefund`; feedback report no_show (/feedback/[token]); in-person not started (MO20) | Paymob refund, Stripe refund, or wallet-only | Paymob: `refundThroughGateway` -> `refundAttempt` claims refunding_at then gateway refund, gateway_payments refunded, `card_fee` returned (cash -fee, platform_expense +fee, session.ts:431). Then session_payments refunded, `session_refund` (cash -(gross+vat), vat_payable +vat, revenue +fee, payable +net, ledger.ts:536), sessions.payment_status back to pending, `returnSpentHold` (MO11). Stripe: refunds.create with reverse_transfer, same posting, invoices settled from it back to due. Wallet-only paid session: no rail call | Patient: booking.cancelled or pnotice.lateRefunded; recovery_outcome refunded or cancelled (cancelled when nothing went back to the patient). Clinician: held down | Each refund trigger at least once; the no-show path both paid and unpaid |
| MO10q | Us -> patient (queued refund of a transfer) | Any MO10 trigger where the payment has no card intent -> `openRefundRequest` (lib/billing/refunds.ts:106); staff /admin/payouts refund queue: "Take" `claimRefund`, destination + proof `markRefundSent` (:268), "Arrived" `confirmRefund`, "Cancel" `cancelRefund` | Staff bank transfer | refund_requests owed -> sent -> confirmed (or cancelled). At sent, one transaction: session_payments refunded, `session_refund` (or `postReversalOf` for pot rows), sessions.payment_status pending, recovery_outcome refund_owed -> refunded; then `returnSpentHold` | Patient: nothing is sent at "sent" (no notify in refunds.ts); only the booking.cancelled message earlier says a refund is owed. Staff: queue with EGP to send (from the confirmed transfer) | Transfer-paid session cancelled by the clinician; two staff: one records the destination, the other sends (rules.approvals.refunds default true) |
| MO11 | (wallet part of a refund) | `returnSpentHold` after every refund (wallet.ts:279) | Wallet | wallet_holds spent -> returned; a fresh patient_credits row; kind `wallet_credit` (cash +w, patient_wallet -w). The declared kind `wallet_return` is never written | Wallet balance back; the rail refund is smaller by w | Refund a session partly paid by wallet |
| MO12 | Us -> company pot and employee (split refund of a sponsored session) | `refundSessionPayment` on a pot row -> `refundSplit` (connect.ts:1404) | Pot plus the employee's rail | `refundToPot` (pot.ts:885, row locked FOR UPDATE, idempotent by a negative sponsor_pot leg on the spend txn): sponsor_pots +share, `session_payment` txn reused: sponsor_pot -share, cash +share; sponsor_money_entries kind refund. Employee half: queue (MO10q), gateway or Stripe. Then session_payments refunded, `postReversalOf` negates every session_payment/session_refund/session_repriced leg of that payment (ledger.ts:666), wallet returned and released | Company: pot up, refund entry in its weekly view. Employee: their rail refund or queued. If the pot step fails a `pot_share` refund request is queued | Cancel a 50% covered session paid by transfer |
| MO13 | Us -> company pot (queued pot share) | Staff "Return to the pot" on a `pot_share` refund request -> `returnPotShare` (refunds.ts:192), two people if rules.approvals.refunds | Pot | refundToPot then the rest through `refundSessionPayment` | As MO12 | Force a pot error (no pot row) is not doable on live; exercise only if a pot_share row appears |
| MO14 | Us -> company pot (unconfirmed booking released) | Hourly reminders `releaseUnconfirmedBookings` (lib/data/scheduling.ts:878): booked slot, session pending, price > 0, created more than 24h ago (UNCONFIRMED_AFTER_MS), starts more than 2h ahead, no declared transfer and no recent card attempt | Pot | `refundToPot` of the pot share, slot back to open, session cancelled | Patient: booking.cancelled "released" with a /radar link (in-app pnotice.released) | Book a slot, never pay; age the round by >= 1 day; run reminders |
| MO15 | Clinician -> us (per-session platform and AI fee, pay as you go) | Session end `finishSession` (lib/session-finish.ts:38) -> `chargeForSession` (lib/billing/service.ts:70); nightly backstop `reconcileMissingCharges` (48h window) | Invoice to the practice | invoices + invoice_lines (platform, ai if recording consent). First session: `subscriptions.trial_session_used` claim, invoice waived 0. Session credits: `spendCredit` then invoice included 0. Held earnings (settings.payouts.netFeeFromHeldEarnings): invoice paid + `fee_netted` (payable +fee, revenue -fee, entity forced us, service.ts:256). Otherwise invoice due + `invoice_raised` (therapist_receivable +x, revenue -x). Then `settleInvoicesFromHeld` (connect.ts:1669): `invoice_settled` payable +x, receivable -x | Clinician: /billing shows the bill, "first session on us", or "taken from your earnings"; held balance lower | Every completed session; check the first is waived |
| MO16 | Practice/clinician -> us (bills by transfer) | /billing `openBillPayment` + `declareBillTransfer`; /clinic/bills `openClinicBillPayment` + `declareClinicBillTransfer`; staff confirm | Transfer (EG practices, `organizationNeedsTransfer`) | manual_payments purpose subscription, ref_id = organization. `grantSubscription` (manual-grants.ts:467) pays due invoices oldest first that fit, `invoice_settled` cash +x, receivable -x each; overpaid/nothing-due raise a rail exception; then `settleOldestObligationByTransfer` (service.ts:1114) marks the oldest due obligation paid if the transfer covers it | Payer: payment.submitted/confirmed; bills paid on /billing or /clinic/bills | Clinician with a due bill pays by transfer; clinic manager pays the practice bills |
| MO17 | Practice -> us (bills by Stripe) | /billing `payInvoices` -> `createInvoiceCheckout` (stripe.ts:315); webhook | Stripe | invoices paid, `invoice_settled` | Stripe receipt | Stripe only |
| MO18 | Practice -> us (monthly plan by transfer) | /billing `upgradeAndPay(tierKey)` -> `startSubscription` -> `subscribeByTransfer` (service.ts:867) then `openBillPayment` | Transfer | renewal_obligations due with due_at = period_start = now (:916-921), invoice due + `invoice_raised`; paid through MO16 | Clinician: plan shown as paid once the obligation is paid (`entitledTier`, plans.ts:121); AI and platform lines become 0 | Subscribe on day 1, staff confirms the same day (see ME30: the obligation lapses at the next 03:05 run if not confirmed first) |
| MO19 | Practice -> us (plan renewal, transfer) | Daily billing cron `raiseManualRenewals` (service.ts:964): paid, auto_renew obligations whose period_end is within 7 days and no next month yet; `setManualRenewal(false)` voids the next month and its invoice | Transfer | next renewal_obligations (amount = seat bill if seats > 0 else tier price) + invoice due + `invoice_raised` | Nothing is sent: `obligationsDueWithin` is only counted in the cron result (route.ts:349), no reminder exists (ME31) | Only if a period_end falls inside the run (future dates do not age) |
| MO20 | Patient -> clinician (in-person paid through us) | Clinician creates an in-person session with "paid through us" (lib/data/sessions.ts:416, rules.inPerson.payThroughUs); patient pays on /pay like MO1/MO2 before the session can start. Hourly `sweepInPerson` (lib/data/in-person.ts:24) | Transfer or card; cash in the room is outside the product (price forced to 0) | Unpaid and link expired: session cancelled. Paid, not started, link expired (rules.inPerson.refundIfNotStarted): `refundSessionPayment` to the original rail, session cancelled. rules.inPerson.refundTo = "wallet" is stored but never read | Patient: link dead; refund as MO10 | In-person paid session that never starts; needs the 12h link (rules.links.sessionLinkHours) to pass in real time |
| MO21 | Us -> clinician (manual EGP payout) | Clinician /earnings `savePayoutDestination` (instapay, wallet, bank) and `requestWithdrawal` -> `requestPayout` (lib/billing/payouts.ts:179, advisory lock, one open request). Staff /admin/payouts: take, approve (`approvePayout`, `moreThanHeld`, 24h cool-down after details edited by someone else), mark sent with bank reference (`markPayoutSent`, `plausibleTransferReceipt`), or "send via provider" (`sendViaProvider` + /api/payouts/callback), confirm arrival, or mark returned, or reject | Staff bank transfer or Paymob Send | payout_requests requested -> approved -> sent -> confirmed; payout_request_events per move. At sent (inside the move transaction): `manual_payout` payable +x, cash -x, entity eg. Returned: `manual_payout_returned` mirror. EGP amount and rate frozen at request | Clinician: payout.sent (EGP amount), payout.rejected (reason), payout.returned; /earnings history and available = held minus requested/approved (lib/billing/available.ts). Staff: payout.overdue after 12h (MO21 alert) | Clinician withdraws on day 3, staff approve and send on day 7, one returned |
| MO22 | Us -> clinician Stripe (release held earnings) | Daily billing `releaseAllHeldEarnings`; /admin `releaseTherapistEarnings` | Stripe Connect transfer | earnings_transfers pending -> paid/failed; `earnings_transfer` payable +x, cash -x | Clinician: Stripe balance | Stripe only |
| MO23 | Company -> pot (top-up by transfer) | /sponsor/pot (sponsor admin) `openPotPayment(creditCents)` then `declarePotTransfer`; staff confirm | Transfer into the EG entity | manual_payments purpose pot_topup, ref_id = sponsor. `grantPotTopUp` (manual-grants.ts:598): claims granted_at, sponsor_pots +net, `pot_topup` cash +settles, vat_payable -vat, sponsor_pot -net (entity from sponsor), `publishTopUp`, ETA invoice opened for eg (`openTopUpInvoice`, eta/issue.ts:38) | Company admin: payment.submitted/confirmed; /sponsor/pot balance and invoice; ETA invoice "waiting" until configured | Every sponsor tops up in round 1; a second top-up later resets the low alert |
| MO24 | Company -> pot (top-up by card) | Stripe payment_intent.succeeded with metadata.purpose pot_topup -> `topUpPot` (pot.ts:1223) | Stripe, US entity only | `pot_topup` then balance update | - | Unreachable: nothing in the code creates such an intent |
| MO25 | Us -> company pot (welcome credit) | Admin opens the pot with terms (`openPot`-style function in lib/data/sponsor-admin.ts ~360) | Gift | sponsor_pots balance = credit; `pot_topup` platform_expense +credit, sponsor_pot -credit; publishTopUp | Company: balance from day one | Admin opens each sim company's pot |
| MO26 | Pot -> company (return unused money) | Company /sponsor/pot `askForMoneyBack` (ops.returnAsked to back office); staff /admin/sponsors `requestPotReturn` (net cents + EGP to send + reason), `sendPotReturn` (bank reference; second person if rules.approvals.potReturns, default false), or `cancelPotReturn` | Staff bank transfer | pot_returns requested -> sent; sponsor_pots -net; `pot_return` cash -(net+vat), vat_payable +vat, sponsor_pot +net; ETA credit note (`openCreditNoteForReturn`) | Company: balance down; credit note waiting | Day 28 or 30 wind-down of one company |
| MO27 | (pot expiry) | sponsor_pots.expires_at passes | none | Nothing moves: `payFromPot` refuses ("expired"), the balance stays as a liability until MO26. `alertPots` warns 30 days before | Company: sponsor.pot_expiring email | Needs an expires_at inside the real window |
| MO28 | Partner platform -> us (monthly usage bill) | Daily billing `billAllPartners` (lib/partner/billing.ts:246) bills the previous calendar month once | Receivable only | `invoice_raised` partner_receivable +x, platform_revenue -x, deterministic txn id per partner-month (:129), advisory lock | Partner /partner/usage shows last month's posted bill (`closedMonthBill`). No collection path exists: partner_receivable is never settled | Live partner sessions (blocked, see PT and ME50) |
| MO29 | Admin -> books (hand adjustment) | /admin/vault `adjustLedger` (super_admin), second person (rules.approvals.ledgerAdjustments default true) | Books | `adjustment`: account +x, platform_revenue or platform_expense -x; txn_id = form key (replay safe, 10 minute twin guard) | Vault | One adjustment by two admins |
| MO30 | Admin -> practice bill (discount, edit, void) | /admin `applyInvoiceDiscount` -> `discountInvoice` (`invoice_written_off` expense +x, receivable -x); `editInvoice` (`adjustment` receivable/revenue by the payable delta); `applyUpcomingDiscount` / seat reduction -> `setUpcomingDiscount` | Books | invoices.discount_cents / status | Clinician: lower bill. The upcoming discount is shown on /billing but only a credit purchase consumes it (ME33) | Seat reduction on a clinic; discount a due bill |
| MO31 | Clinic -> us (seats) | /billing `saveSeats`, /clinic/seats, /clinic/people -> `applySeatChange` (lib/billing/seats.ts:94) | Invoice | organizations.seats (conditional on the old count); proration up: `billSeatProration` invoice due + `invoice_raised`; down: upcoming discount | Clinic: prorated bill due | Clinic adds seats day 1, removes one day 14 |
| MO32 | Entity transfer | `postEntityTransfer` (ledger.ts:1082) | Books | `entity_transfer` with `fx_difference` | - | Unreachable: no caller |
| MO33 | Practice -> us (credit purchase) | `createCreditCheckout` (stripe.ts:96) | Stripe | session_credits pending -> active, `recordCreditPurchaseInvoice` | - | Unreachable: no caller |

Fees shown to patients (what the /pay page must show, app/pay/[token]/page.tsx and actions.ts `priceFor`):

* Session line: the clinician's rate (sessions.price_cents, USD cents), shown in EGP at the operator rate for Egypt.
* Benefit line: minus the company share (`sessionLines`, lib/billing/session-owed.ts:165-186).
* Wallet line: minus the held wallet cents.
* VAT line: `sessionVatBpsFor(rules, country.vatBps)` on the patient's own share only.
* Card fee line (card by Paymob only): `cardFeeMinorFor` = round(amount x 275 / 10000) + 300 minor (lib/settings/defs.ts:780), shown with the card total (`cardFeeQuote`, page.tsx:441).
* Transfer: EGP total plus "1 USD = N EGP" (`rateLabel`) and the configured bank fields (`transferDetails`, audience patient).
* The platform fee (settings.session.platformFeeBps) is not shown to the patient; the clinician sees it on /earnings as fees (`earningsSummary`).

---

## Jobs and timers

With `sim:clock`, every deadline below comes due on its simulated day; the "simulated day" column says when to look.

Scheduled on Vercel (vercel.json): crisis at :20 every hour, reminders at :20 every hour, billing 03:05 UTC daily, retention 03:10 UTC daily, extract 03:15 UTC daily. The named jobs `licences`, `radar` and `webhooks` are hand-only. Every run writes cron_heartbeats (route.ts:839-851). Hand firing: `curl -H "Authorization: Bearer $CRON_SECRET" https://24therapy.app/api/cron/<job>`; a wrong secret is 401, an unknown job 404. The live schedule keeps running between rounds, so the hand run is never the only run.

How time passes in the run: `sim:clock` moves every timestamp and date in every table by the same amount (`02-THE-MONTH.md`), so every deadline stored in the database, past or future, comes due on its simulated day. Where a row below says "real time only", "not aged" or "future at ageing", read it this way: a deadline in the database passes on its simulated day; only two things run on real time, an expiry signed inside a link (`EE24`) and the real calendar month (`TE61`).

| job or column | what it does | what it sends | simulated day that must show it | how to verify (screen, sim:inbox, SQL) |
|---|---|---|---|---|
| crisis / sweepUndeliveredAlerts (lib/crisis/alerts.ts:437) | risk_assessments alert_status pending -> delivered, inserts an in-app notifications row (kind crisis) for the clinician | In-app only (no email) | Day 1 (any risk flag whose first delivery failed) | `SELECT alert_status, count(*) FROM risk_assessments GROUP BY 1;` clinician bell |
| crisis / sweepRadar (lib/data/radar.ts:1197) | Releases pending radar claims past pending_until; cancels radar-type sessions still scheduled/pending 10 minutes after creation (CLAIM_MINUTES) with no transfer, no recent card attempt and no session_payments row; sets clinicians offline whose last_seen_at is older than 90s | Nothing | Day 1 (abandoned radar checkout); every round (clinicians go offline after the sim) | `SELECT status, count(*) FROM therapist_radar GROUP BY 1;` `SELECT status FROM sessions WHERE session_type='radar' ...` |
| crisis / sweepAbandonedPatients (lib/data/feedback.ts:891) | Patient joined, never started, 10 minutes: automatic session_reports no_show; second and later offences suspend the clinician from the radar | sendTherapistMessage tmsg.waiting or tmsg.radarOff (clinician locale) | Day 1 and day 7 (repeat offender suspension) | sim:inbox <clinician email>; `SELECT kind, detail FROM session_reports WHERE kind='no_show';` therapist_radar.suspended_until |
| crisis / sweepUnratedSessions (feedback.ts:797) | Completed sessions ended 45 minutes to 72 hours ago with no stars and no rating_reminder_at: stamp and email the patient | sendRatingReminder (patient locale) | Day 1 run after sessions end; day 3 still eligible if the wave was aged by 2 days (48h < 72h); rows aged past 72h are never reminded | sim:inbox <patient email>; `SELECT rating_reminder_at FROM sessions WHERE ...` |
| crisis / sweepOverrunSessions (lib/data/sessions.ts:754) | in_progress sessions older than the clock cap are auto-ended and run through `finishSession` (charge, note, risk) | Whatever finishSession triggers (bill, summary later) | Day 1 (a room left open); after ageing any in_progress row of the wave ends at the next crisis run | `SELECT id FROM sessions WHERE status='in_progress';` must be empty after the run |
| crisis and reminders / watchdog (lib/observability/heartbeat.ts:232) | Scheduled job without a clean run for 2x its interval, or server errors in the last hour, one alert per key per day (ops_alerts) | ops.watchdog to every super_admin (real addresses, not @example.com) | Any day a job was not fired or failed a step | cron_heartbeats; ops_alerts; the admin's real inbox |
| licences (hand) and retention / sweepLicences (lib/data/licence-expiry.ts:35) | Approved licence past its date: state back to submitted, license_expired_at, radar offline, audit. Within 30 days: license_expiry_warned_at | licence.expired / licence.expiring (clinician locale, email only) | Needs a license_expiry near the real date: set one to today+10 for "expiring" and yesterday for "expired" in the cast | sim:inbox <clinician>; `SELECT state, license_expired_at, license_expiry_warned_at FROM therapist_verifications;` |
| billing / reconcileMissingCharges (lib/billing/service.ts:653) | Completed sessions ended in the last 48h with no invoice get charged; missing invoice_lines repaired | Nothing | Day 1 (run the same day; after ageing by >= 2 days the 48h window no longer sees the wave) | `SELECT s.id FROM sessions s LEFT JOIN invoices i ON i.session_id=s.id WHERE s.status='completed' AND i.id IS NULL;` |
| billing / releaseAllHeldEarnings (lib/billing/connect.ts:1640) | Stripe transfer of held balances for clinicians with a Stripe account | Nothing | Not on live without Stripe | earnings_transfers |
| billing / alertAgedPayouts (lib/billing/payouts.ts:1131) | payout_requests requested/approved older than 12h (settings.payouts.alertAfterHours), alerted_at claimed once | payout.overdue to back-office staff (English) | Day 3 (a request made on day 1 and aged 2 days) | sim:inbox <staff>; `SELECT id, alerted_at FROM payout_requests;` |
| billing / sendOneHandDigest (lib/billing/approvals.ts:186) | Money acts in the last 24h: payouts approved and sent by one person, every confirmed transfer, pot returns asked and sent by one person, verifications | ops.oneHandDigest to super_admins | Day 1 onwards (not idempotent: every billing run in the same day sends it again) | super admin inbox |
| billing / pauseUnverified (lib/data/enrolment-verify.ts:250) | Sponsors whose verify cycle (6 months) elapsed: pause active enrolments not verified in 6 months, notice pnotice.verifyNeeded | In-app only | Only if verify_cycle_started_at is set 6 months back (it is aged but by days, not months) | enrolments.paused_at |
| billing / pauseDroppedFromLists (lib/data/sponsor-email-list.ts:112) | Enrolments by listed_email whose address was removed from the company list more than 14 days ago (rules.enrolment.listRemovalGraceDays) are paused, notice pnotice.benefitPaused | In-app only | Day 21 (remove an employee on day 3, age 7+7 days). sponsor_email_list has no created_at, so removed_at is NOT aged: the 14 days must pass in real time unless the removal is set back by hand | enrolments.paused_at; patient app banner |
| billing / reconcilePots (lib/billing/pot.ts:1442) | Compares sponsor_pots.balance_cents with the ledger sum of sponsor_pot legs | Log only | Every round: must return 0 rows | same query on /admin/vault |
| billing / alertPots (lib/billing/pot-alerts.ts:86) | Empty (balance <= 0) or low (< 20% of the last top-up, published balance) once per top-up; expiring within 30 days once per date | sponsor.pot_empty, sponsor.pot_low, sponsor.pot_expiring to sponsor admins (English only) | Day 7 to 14 as pots drain; expiring needs expires_at within 30 real days | sim:inbox <sponsor admin>; `SELECT action, resource_id, created_at FROM audit_log WHERE action LIKE 'sponsor.pot_alert.%';` |
| billing / tellEnrolledAboutLedger (enrolment-verify.ts:411) | Every enrolment not yet told gets pnotice.ledgerTold and ledger_told_at; pot sessions before this are left out of the company money view | In-app only | Day 1 (must run before sponsored sessions, or those sessions never appear in the company weekly view) | enrolments.ledger_told_at; sponsor_money_entries |
| billing / raiseManualRenewals (service.ts:964) | See MO19 | Nothing | Only when a paid period_end is within 7 real days | renewal_obligations |
| billing / obligationsDueWithin(7) (lib/billing/obligations.ts:190) | Counts due obligations; sends nothing | Nothing (dunning is not implemented) | - | cron JSON renewalsDueSoon |
| billing / lapseOverdue (obligations.ts:223) | due obligations whose due_at has passed become lapsed | Nothing | Day 3 for a plan bought by transfer on day 1 and not confirmed before 03:05 UTC (due_at = subscription moment) | `SELECT state, due_at FROM renewal_obligations;` |
| billing / reconcileRenewals (obligations.ts:252) | paid obligations with no settled_ref; paid subscription invoices with no obligation | Log only | Every round; a lapsed-then-paid plan shows up here | cron JSON |
| billing / alertApproachingLimits (lib/partner/usage.ts:238) | Rolls the period, alerts at 80% and 90% of a partner's monthly limit once each | partner.limit_approaching to the partner contact (English) | Blocked on live keys (ME50) | partner_limits.alerted_80_at |
| billing / billAllPartners (lib/partner/billing.ts:246) | Posts the previous calendar month once per partner | Nothing | First billing run after a real month boundary; aged partner_sessions land in whichever calendar month the shift puts them | ledger ref_type partner_month |
| billing / sweepExpiredLaunches (lib/partner/launch.ts:315) | Deletes launch tokens expired more than a day ago (tokens live 120s) | Nothing | Day 3 onwards | partner_launch_tokens count |
| reminders / sweepCheckins (lib/checkins/send.ts:67) | Lease-guarded; sends a check-in per person every settings.checkins.everyHours outside their quiet hours | checkin.asking (person locale) | Day 1 daytime Cairo; day 3 again if everyHours elapsed | sim:inbox <patient>; checkins table |
| reminders / booking reminders (route.ts:615-688) | Booked slots starting 20-24h ahead, or between 30 minutes and 20h ahead, reminded_at null, outside the recipient's quiet hours (22:00-07:00 local) | booking.reminder to the patient (person locale), in-app pnotice.reminder | Day 1 (book for tomorrow and for later today). Future starts_at never age, so a slot booked 5 days ahead is reminded only 20-24h before its real time | sim:inbox <patient>; `SELECT reminded_at FROM availability_slots;` |
| reminders / sweepInPerson (lib/data/in-person.ts:24) | MO20 | booking.cancelled is not sent here | Real time only (join_token_expires_at is future at ageing, 12h) | sessions.status |
| reminders / sweepWalletHolds (lib/billing/wallet.ts:303) | MO8 | Nothing | Any round after an unpaid held session is cancelled | `SELECT state, count(*) FROM wallet_holds GROUP BY 1;` |
| reminders / releaseUnconfirmedBookings (lib/data/scheduling.ts:878) | MO14 | booking.cancelled (pmsg.released) to the patient | Day 3 (booked on day 1, never paid, aged 2 days, start still more than 2h ahead) | sim:inbox <patient>; availability_slots.status open |
| reminders and webhooks / deliverPending (lib/partner/webhooks.ts:429) | Claims each due delivery (attempts+1) and POSTs it signed; retries after 5, 30, 120, 300 then 600 minutes; failed_at after 11 tries | HTTPS POST to partner endpoints | Every round that follows a partner event | /partner/deliveries; partner_webhook_deliveries |
| reminders / advanceEtaDocuments (lib/billing/eta/issue.ts:400) | Opens missing return credit notes; tries every waiting document; polls submitted ones | ETA submission (not on live without credentials) | Day 1 after an EG top-up: the invoice stays waiting with "configuration" | `SELECT kind, state, waiting_for FROM eta_documents;` |
| retention (route.ts:485) | Deletes audit_log older than 6 years, auth_sessions past absolute expiry or idle 2h, spent rate_limits, error_events older than 30 days, open carts (awaiting_proof) older than 30 days, then sweepLicences | Licence messages | Day 30: a cart opened on day 1 and never paid is gone once aged >= 30 days in total. Any aged staff session is purged at the next run (idle) | `SELECT count(*) FROM manual_payments WHERE state='awaiting_proof';` |
| extract (lib/data/documents.ts:550) | Reads text out of up to 20 pending person_documents | Nothing | Day 1 after uploads | person_documents.extraction |
| auth_tokens.expires_at, patient_auth_tokens.expires_at, clinic_auth_tokens.expires_at, staff_email_codes.expires_at, account_links.expires_at | Sign-in, reset and invite links refuse after expiry | - | Real time only (future) | Try an old link: refused |
| auth_sessions / patient_auth_sessions / sponsor_auth_sessions / clinic_auth_sessions / partner_auth_sessions (absolute_expires_at future, last_seen_at past) | Idle limits 2h staff, 4h patient, 30 min sponsor. Ageing moves last_seen_at back, so every cast member is signed out after each ageing | - | Every round: sign in again | Screen redirect to sign-in |
| sessions.join_token_expires_at, video_room_expires_at | Join link dead after 12h (radar 3h); in-person sweep | - | Real time only | /join/[token] expired page |
| therapist_radar.pending_until, suspended_until | Claim release, suspension end | - | pending_until is 10 min, real time; suspension ends in real time | /radar list |
| availability_slots.held_until | A slot hold while booking | - | Real time | - |
| patient_credits.expires_at | Wallet credit expiry; 0 months = 100 years by default | Nothing; an expired credit silently leaves the balance, its liability stays on the ledger (ME24) | Never within the sim at the default | `walletBalanceCents` vs ledger patient_wallet |
| session_credits.expires_at | Practice credit expiry (12 months) | - | Never | - |
| sponsor_pots.expires_at | Funding refused after; expiring alert 30 days before | sponsor.pot_expiring | Only with a near expiry set at pot opening | /sponsor/pot |
| wallet_holds (held, spent, released, returned) | See MO6 to MO11 | - | Rounds with cancellations | SQL above |
| renewal_obligations.due_at, period_start, period_end | Lapse at due_at; renewal raised 7 days before period_end | - | Day 3 lapse (ME30) | SQL above |
| subscriptions.current_period_end | Stripe plan entitlement | - | Stripe only | - |
| person_invites.expires_at, patient_invites.expires_at, clinician_invitations.expires_at, enrolment_verifications.expires_at, enrolment_attestations.expires_at, person_claims.expires_at, history_grants.expires_at, data_exports.expires_at, meeting_connections.expires_at, ehr_connections.expires_at, phone_change_requests.verification_expires_at, support_tickets.access_code_expires_at and due_at, homework_items.due_at | Refused after expiry at read time (no sweep in the cron route) | - | Real time only; ageing moves the matching created_at back but not the deadline | Open the link after the real expiry |
| partner_launch_tokens.expires_at (120s) | Single use, 2 minutes | - | Real time; swept a day later | /api/partner/launch?token= redirects to /login?launch=expired |
| partner_api_keys.revoked_at (future after rotation with overlap 24h or 7 days) | Old key keeps working until then | - | Real time | Call with the old key |
| partner_limits.period_start | Rolled on the next alert run after a month boundary | - | Real month boundary | - |
| partner_webhook_deliveries.next_attempt_at | Retry schedule | - | Past values are aged and stay due | /partner/deliveries |
| manual_payments (awaiting_proof) created_at | Cart expiry 30 days (rail-exceptions.ts:155) | - | Day 30 | SQL above |
| payout_requests.requested_at | Overdue alert at 12h | payout.overdue | Day 3 | SQL above |
| gateway_payments.refunding_at | A refund claim is retried after 10 minutes | - | Real time | - |
| cron_leases.held_until | Check-in lease | - | - | - |
| rate_limits.expires_at | Buckets expire; not aged | - | - | - |

---

### Timers seen from each portal

#### Patients

| what | job or clock | column | which round should see it |
|---|---|---|---|
| Patient session idle and absolute expiry | Request-time, real clock (4 h idle, 7 days absolute) | `patient_auth_sessions.last_seen_at`, `absolute_expires_at` | Every round: after `age` moves `last_seen_at` back more than 4 h, every agent is bounced to `/patient/session-expired` and must sign in again. `absolute_expires_at` is future and is not moved by `age`, so the 7 day cap only bites in real time |
| Sign-in, reset, handle and email codes | Real clock, 15 min | `patient_auth_tokens.expires_at` | Same round only; never survives an `age` step |
| Claim code (email route) | Real clock, 30 min | `person_claims.expires_at` | Same round |
| Invite link to claim | 30 days, real clock | `person_invites.expires_at` | Not moved by `age`; stays valid all month |
| Patient invite code for a therapist | 30 days (QR 10 min) | `patient_invites.expires_at` | QR same round only |
| 24 h history grant | Read-time check | `history_grants.expires_at` | Future, not moved by `age`: it expires only after 24 real hours, so a round 1 grant is still live in round 3 unless a real day passed |
| Booking reminders | `/api/cron/reminders` hourly | slots starting 20 to 24 h ahead and same-day more than 30 min ahead, `availability_slots.reminded_at`; quiet hours held | A round that books a slot for tomorrow and fires `reminders`: outbox `booking.reminder` + in-app `pnotice.reminder` |
| Unpaid booking release | `reminders` | `sessions.created_at` older than 24 h, start more than 2 h away, `payment_status` pending | Round 3 (after aging 2 days) should see an unpaid priced booking from round 1 released with `pnotice.released` |
| In-person sweep | `reminders` | `join_token_expires_at` past | Needs a real past start; future `scheduled_at` is not aged |
| Wallet hold sweep | `reminders` | `wallet_holds.state = held` on cancelled or free sessions | Round after a cancellation |
| Check-ins | `reminders` (`sweepCheckins`) | `checkins`, per-person cadence, quiet hours | Rounds 3+ for unmuted patients with a phone (outbox only if WhatsApp condition holds) |
| Abandoned waiting room | Patient poll at 10 min, backstop `crisis` hourly | `sessions.patient_joined_at`, `started_at` | Any round where a patient waits and the clinician stays away |
| Unrated session reminder | `crisis` hourly, 45 min after end, once | `sessions.rating_reminder_at` | Round after a completed session with an address |
| Feedback link window | Read-time, 72 h from `ended_at` | `sessions.ended_at` | Aging `ended_at` by 3+ days (round 7) shows "This link has expired" |
| Radar link | 3 h from creation (unpaid only) | `sessions.join_token_expires_at` | Future, not aged: expires in real time |
| Booking link | start + 4 h | `sessions.join_token_expires_at` | Real time only |
| Radar claim hold | 10 min | radar claim row | Same round |
| Benefit re-verification | `billing` daily (`pauseUnverified`) | `sponsors.verify_cycle_started_at` + 6 months, `enrolments.last_verified_at` | Not reached in 30 days unless the sponsor cycle start is older than 6 months; unconfirmed enrolments (`last_verified_at` null) are paused once the cycle is due |
| Benefit dropped from list | `billing` (`pauseDroppedFromLists`, 14 day grace) | sponsor email list | Round 21 or 28 if SP removes the person on day 7 or later |
| Pot expiry | Booking-time | `sponsor_pots.expires_at` | Only if SP sets an expiry inside the month |
| Wallet credit expiry | Rule `wallet.expiryMonths` 0 = never | `patient_credits.expires_at` | None by default |
| Record export link | 72 h | export `expires_at` | Real time |
| Rate-limit windows | Database `now()` | `rate_limits` | Not affected by `age` |

Note on `age`: `scripts/age.ts` moves only past timestamps of rows created since the marker, and a future timestamp "is a deadline, and it does not" move. Every expiry above that is written in the future is therefore measured in real time, not in simulated days.

#### Therapists

All cron calls: `GET /api/cron/<job>` with `Authorization: Bearer <CRON_SECRET>`. Jobs available: crisis, reminders, billing, retention, licences, radar, webhooks, extract (`app/api/cron/[job]/route.ts`). `age` moves every timestamp column that is in the past for rows created since the wave marker, and leaves future timestamps alone (`scripts/age.ts`).

| timer | job or trigger | column and rule | simulated day it should show |
|---|---|---|---|
| Room abandoned by the clinician | crisis (`sweepAbandonedPatients`), also the patient's own poll | `sessions.patient_joined_at` older than 10 min, `started_at` null, status scheduled | day 3 for any day-1 session a patient joined but T1 never started |
| Overrun session | crisis (`sweepOverrunSessions`) and the state poll | `started_at` older than 50 min, status in_progress | day 3 for any session left in progress on day 1 |
| Unrated summary reminder | crisis (`sweepUnratedSessions`) | released copy, 45 min after, inside 72 h feedback window | day 1 (real time) or day 3 (after ageing, the 72 h window may have closed) |
| Undelivered crisis alerts | crisis (`sweepUndeliveredAlerts`) | `risk_assessments.alert_status` pending | any day |
| Radar stale and claims | crisis or radar (`sweepRadar`) | `therapist_radar.last_seen_at` older than 90 s; `pending_until` passed; radar sessions pending more than 10 min | same day |
| Booking reminders | reminders | `availability_slots.starts_at` 20 to 24 h ahead, or more than 30 min and less than 20 h ahead, `reminded_at` null, quiet hours held | the day before each booked hour (real clock) |
| Unconfirmed paid bookings released | reminders (`releaseUnconfirmedBookings`) | session `created_at` older than 24 h, payment pending, slot more than 2 h ahead | day 3 |
| In-person pay link expiry | reminders (`sweepInPerson`) | `sessions.join_token_expires_at` (creation plus 12 h, real) | 12 real hours after creation |
| Session invoice repair | billing (`reconcileMissingCharges`) | completed sessions with `ended_at` in the last 48 h and no invoice | day 1 only (ageing pushes rows out) |
| Renewal obligations | billing (`raiseManualRenewals`, `obligationsDueWithin`, `lapseOverdue`) | `renewal_obligations.due_at` less than or equal to now lapses; renewals raised 7 days before `period_end` (future, not aged) | lapse shows on the first billing run after an upgrade (day 1 or 3); a renewal cannot be reached in one real month |
| Aged payout alert | billing (`alertAgedPayouts`) | payout request older than `payouts.alertAfterHours` | day 3 |
| Held earnings release | billing (`releaseAllHeldEarnings`) | needs a Stripe account id | never for Egyptian clinicians |
| Licence warning and expiry | retention and licences (`sweepLicences`) | `therapist_verifications.license_expiry` text vs the REAL now (not aged), `license_expiry_warned_at`, `license_expired_at` | set the text to force it on any round; note `lib/data/licence-expiry.ts` says it runs in crisis, the route runs it in retention |
| Copilot allowance | on request | completed sessions with `created_at` in the last 12 months | unaffected by the month |
| Assistant allowance | on request | monthly, resets on the 1st | day 7 if the month turns in real time; ageing does not reset it |
| Document extraction | extract | pending documents | any day |
| Support first reply | none (admin queue) | `support_tickets.due_at` = creation plus 24 h | day 3 shows overdue after ageing |

#### Clinics and companies

| timer or job | column or source | rule | simulated day it matters |
|---|---|---|---|
| Clinic and company session idle | clinic_auth_sessions.last_seen_at, sponsor_auth_sessions.last_seen_at | 30 minutes idle, 8 hours absolute (absolute_expires_at); `age` moves last_seen_at, so every round needs a fresh sign-in | Every round |
| Clinician invitation | clinician_invitations.expires_at | created + 14 days; future value, never aged | Day 15 for a day 1 invitation, only in real time |
| Clinic staff invite link | clinic_auth_tokens.expires_at (purpose invite) | 14 days, superseded by "New link" | Day 15, real time only |
| Clinic reset link | clinic_auth_tokens.expires_at (purpose password_reset) | 1 hour | Same round |
| First manager or company user welcome link | account_links.expires_at | 7 days invite, 1 hour reset | Day 8, real time only |
| Company invite and reset links | inside the HMAC token (lib/sponsor/password-link.ts) | 7 days invite, 1 hour reset; not in the database | Day 8, real time only |
| Enrolment email code | enrolment_verifications.expires_at | 30 minutes | Same round |
| Coverage reduction | sponsor_pots.pending_coverage_from | now + 30 days (settings sponsor.coverageNoticeDays), applied lazily by coverageNow at booking or read | Day 31 for a day 1 change: never inside the run |
| Pot expiry | sponsor_pots.expires_at | set by the operator; payFromPot refuses after it | Whatever date the operator sets; set it inside the run to test |
| Expiry warning mail | audit_log action sponsor.pot_alert.expiring, reason = date | inside 30 days of expires_at, on /api/cron/billing | Any round after the pot is inside 30 days |
| Low and empty alerts | sponsor_pots.balance_cents and published_balance_cents, audit_log created_at after the last top-up | /api/cron/billing, once per top-up | After the pot runs down |
| Published balance | sponsor_pots.published_sessions and published_balance_cents | republished on read once 5 more funded sessions exist; top-ups and returns change it at once | After every 5th booking |
| Ledger publication | sponsor_money_entries.week_start (date) | weekly: only weeks that have ended in real time, in batches of 5 | Real Mondays only |
| Staff list grace | sponsor_email_list.removed_at | 14 days (rules.enrolment.listRemovalGraceDays), then pauseDroppedFromLists in /api/cron/billing | Day 15 plus after a removal, `age` moves removed_at so this one is testable |
| Re-verification | sponsors.verify_cycle_started_at, enrolments.last_verified_at | 6 months, pauseUnverified in /api/cron/billing | Not reached in 30 days |
| Ledger notice to enrolled people | enrolments.ledger_told_at | tellEnrolledAboutLedger in /api/cron/billing | First billing run after an enrolment |
| Manual renewals | renewal_obligations.period_end | raiseManualRenewals within 7 days of period end, transfer organisations only | Day 23 plus, only if an obligation exists |
| Pot reconciliation | sponsor_pots.balance_cents against ledger_entries | reconcilePots in /api/cron/billing, logs drift | Any billing run |
| ETA documents | eta_documents state and waiting_for | advanceEtaDocuments in /api/cron/reminders (hourly) | After each confirmed top-up or sent return |
| Open payment carts | manual payment carts | expireOpenCarts in /api/cron/retention | Rounds after a sheet was opened and abandoned |
| Seat billing start | clinic_seats.billable_from | now, or the joiner's own period end | Only for CL4 joiners |
| Seat proration period | subscriptions.current_period_end | null for clinics, so now + 30 days | Every seat change |

Cron jobs: GET /api/cron/<job> with header Authorization: Bearer <CRON_SECRET>; jobs are crisis, licences, billing, radar, retention, reminders, webhooks, extract (app/api/cron/[job]/route.ts). This area depends on billing, reminders and retention.

#### The console

| what | table.column | length | fired by | simulated day it matters |
|---|---|---|---|---|
| staff emailed code | staff_email_codes.expires_at | 10 minutes | none, checked on use | every round, each staff sign in |
| code email rate, guess rate | rate limit rows staff-2fa-email, staff-2fa-verify | 3 per 10 min, 10 per 15 min | none | every round |
| second step freshness | auth_sessions.second_factor_at | 12 hours | none | every round (days 1, 3, 7, 14, 21, 28, 30 all need a new code) |
| session idle and absolute | auth_sessions last seen and created | 2 h idle, 12 h absolute | none; retention cron purges expired | every round |
| password lockout | users.locked_until | 5 failures, 15 min | none | any round |
| login rate per caller | rate limit login | 20 per 15 min | none | day 1 when several agents sign in from one address |
| invite link | account_links.expires_at | 7 days (reset 1 hour) | none | invite on day 1, a day 7 or later redemption fails |
| open cart expiry | manual_payments.created_at (state awaiting_proof) | 30 days | retention cron `expireOpenCarts` | day 30, carts opened on day 1 and aged 30 days disappear |
| waiting badge | manual_payments.submitted_at | red after 15 min | none | every round |
| payout ageing alert | payout_requests.requested_at, alerted_at | 12 h (settings) | billing cron `alertAgedPayouts`, emails first 10 back office users | any request left a round |
| payout details cooldown | payout_methods.edited_at | 24 h | none | round after a detail edit |
| one hand digest | payout_requests.sent_at, manual_payments.decided_at, pot_returns.decided_at, therapist_verifications.reviewed_at | last 24 h | billing cron `sendOneHandDigest`, email to every super_admin (real founder inbox) | every billing run |
| support first reply and extension | support_tickets.due_at | 24 h, one 24 h extension | none (overdue shown) | day 3 onward |
| phone change code and lock | phone_change_requests.verification_expires_at; lock | 24 h; 90 days | none | day 1 to 3 |
| radar suspension | radar ban until | 24 h, 72 h, until released | crisis cron `sweepRadar` | days 1, 3 |
| patient record export link | export token | 72 h | none | day 3 |
| TV elevation | auth_sessions.elevated_until | 20 min | none | any |
| licence expiry sweep | therapist_verifications.license_expired_at, license_expiry_warned_at | per licence date | retention cron and licences job `sweepLicences` | day 28 or 30 if a licence expires inside the month |
| benefit re-verification pause | enrolment rows | per cycle | billing cron `pauseUnverified`, `pauseDroppedFromLists` (grace 14 days) | days 14 to 30, shows on /admin/benefits |
| pot drift and alerts | sponsor_pots vs ledger | daily | billing cron `reconcilePots`, `alertPots` | every billing run |
| ETA documents | eta_documents.state, waiting_for | hourly | reminders cron `advanceEtaDocuments`; "Try again" on /admin/settings | after any Egyptian top-up |
| check-ins | checkin rows, settings.checkins.measured_since | every 24 h default | reminders cron `sweepCheckins` | every round |
| scheduled jobs panel | cron_heartbeats.last_success_at, failed_steps; ops_alerts.sent_at | overdue at 2 x interval | every /api/cron/<job> call; `watchdog` in crisis and reminders | every round: fire crisis, reminders, billing, retention, extract; licences, radar, webhooks appear only after their first call |
| error retention | error_events.created_at | 30 days | retention cron `purgeOldErrors` | day 30 |
| audit retention | audit_log.created_at | 6 years | retention cron | never in the month |

Crons in vercel.json: crisis and reminders at minute 20 hourly, billing 03:05, retention 03:10, extract 03:15 UTC. The route needs `Authorization: Bearer <CRON_SECRET>` (lib/auth/shared-secret.ts bearerMatches), so a browser GET gets 401.

## Messages

Every email and WhatsApp message the product sends. During the run each one is kept in `sim_outbox`, read with `npm run on:production -- sim:inbox -- <address or phone>`.

All messages go through `notify()` (lib/notify/index.ts:354) unless marked "mail fn". Channel order is WhatsApp then email, and both are tried (the loop does not stop after WhatsApp, :399-421). WhatsApp is attempted only when `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are set and the kind has a template listed in `WHATSAPP_APPROVED_TEMPLATES` (templates.ts:200-221); otherwise no WhatsApp row reaches sim_outbox at all (:392-402). With SIMULATION_RUNNING=1, a WhatsApp that passes those checks is kept in sim_outbox with its kind (whatsapp.ts:79-90). Email to any @example.com address is kept in sim_outbox with channel email, the subject and the HTML body, and kind NULL (mail.ts:87-91), so outbox checks for email match on to_address and subject. Languages: LOCALES = en, ar (lib/i18n/config.ts:18); `wordsFor` reads people.locale for a personId and users.locale for a userId, default en (lib/i18n/preference.ts:20-32).

Outbox check for every row: `npm run on:production -- sim:inbox -- <address or +E164 phone> --last 10`, or `SELECT channel, to_address, subject, kind, created_at FROM sim_outbox WHERE to_address = '<x>' ORDER BY created_at DESC;`

| kind | recipient | trigger | languages | outbox check |
|---|---|---|---|---|
| booking.confirmed | Patient (email, phone, in-app pnotice.booked) | /t/[id] `book` (app/(public)/t/[id]/book/actions.ts:177); clinician books for a patient (app/(app)/bookings/actions.ts:139); replacement accepted (recovery-actions.ts:237, to the replacement clinician by email) | Patient: people.locale, else the page locale; clinician: users.locale. WhatsApp template session_confirmed en/ar | email subject pmsg.sessionWith; WhatsApp kind booking.confirmed with 2 variables |
| booking.reminder | Patient | reminders cron (route.ts:660) | people.locale | subject pmsg.sessionWith; in-app pnotice.reminder |
| booking.cancelled | Patient | reminders release (route.ts:726); clinician cancel (clinician-cancel.ts:117); late refund agreed (booking-change.ts:324); no-show refund from the patient page (recovery-actions.ts:305) | people.locale | subject pmsg.released.subject or the cancel subject |
| booking.rescheduled | Patient | clinician moves a booking (booking-change.ts:504) | people.locale | in-app pnotice.rescheduled |
| booking.patient_cancelled | Clinician (email, WhatsApp from users.profile.phone, in-app) | patient cancels (booking-change.ts:160,274) | users.locale | template patient_cancelled |
| booking.patient_moved | Clinician | patient moves (booking-change.ts:524) | users.locale | template patient_moved |
| session.started | Clinician or patient (started-notice.ts:108) | the other side is in the room | recipient locale | template session_started |
| session.invite | Patient | clinician sends the link (app/(app)/sessions/[id]/actions.ts:263; lib/data/session-invite.ts:154) | people.locale | in-app pnotice.sessionInvited |
| session.summary_ready | Patient | declared in the type and template; no caller found in lib or app (the summary goes by mail fn sendSessionReport) | - | none expected |
| claim.code | Patient | claim, code sign-in, email verify, handle (app/(patient)/patient/claim/actions.ts:93, lib/patient-auth/code-signin.ts:145, email.ts:104, handle.ts:121) | people.locale | 6 digit code parsed by sim:inbox |
| claim.invite | Patient | clinician or clinic invites a patient to claim (app/(app)/patients/actions.ts:240, app/(clinic)/clinic/people/actions.ts:96) | people.locale | template claim_invite |
| clinic.removed | Clinician | clinic removes a clinician (clinic/people/actions.ts:177) | users.locale, email only | subject |
| clinic.staff_invite | Clinic staff invitee | clinic/team/actions.ts:48 | English | subject |
| checkin.asking | Patient | reminders cron check-ins (lib/checkins/send.ts:178) | people.locale | template checkin_asking |
| payout.sent | Clinician | `recordSent` (payouts.ts:634) | users.locale | amount in EGP from the frozen request |
| payout.rejected | Clinician | `rejectPayout` (:981), body = staff reason | users.locale subject, reason as typed | subject tmsg.payout.rejectedSubject |
| payout.returned | Clinician | `markPayoutReturned` (:912) | users.locale; the WhatsApp variable is USD while the template text implies the withdrawal amount | subject tmsg.payout.returnedSubject |
| payout.overdue | Back-office staff (BACK_OFFICE_ROLES, up to 10) | billing cron `alertAgedPayouts` | English | subject "A payout has been waiting too long" |
| ops.oneHandDigest | super_admin | billing cron | English | subject "N money actions by one person in the last day" |
| ops.returnAsked | Back-office staff | company asks for money back (app/(sponsor)/sponsor/pot/actions.ts:334) | English | subject |
| ops.watchdog | super_admin | hourly watchdog | English | real inbox (addresses are not @example.com) |
| licence.expired, licence.expiring | Clinician (email only) | retention or licences job | users.locale | subject tlic.* |
| support.closed | Ticket owner (email or phone with access code) | lib/data/support.ts:585 | person, user or ticket locale | template support_reply, 3 variables |
| phone.verify | New phone number (WhatsApp only) | lib/data/phone-change.ts:289 | people.locale | WhatsApp only, so nothing in the outbox unless templates approved |
| password.reset_code | Patient | lib/patient-auth/reset.ts:158 | people.locale | code |
| staff.second_factor_code | Staff (email preferred) | lib/auth/second-factor.ts:287 | English | code |
| record.export | Patient (email only) | lib/data/export.ts:1250 | people.locale | link |
| consent.granted, history.answered | Patient | lib/data/portability.ts:398, 595 | people.locale | subject |
| benefit.verify_code | Employee's work email (email only) | lib/data/enrolment-verify.ts:130 | people.locale | code |
| sponsor.domain_confirm | Company mailbox | lib/data/sponsor-domains.ts:116 | English | link |
| sponsor.enquiry_received | Company contact | /for-companies -> /sponsor/apply (lib/data/sponsor-admin.ts:99) | caller supplies the words | subject |
| sponsor.enquiry | Back-office staff | same (:177) | English | subject |
| sponsor.invite, sponsor.password_reset | Company user | lib/data/sponsor-users.ts:130,157 | English | link |
| sponsor.pot_empty, sponsor.pot_low, sponsor.pot_expiring | Every sponsor admin | billing cron `alertPots` | English only (hard-coded, pot-alerts.ts:65-76, 234) | subject "Your therapy fund ..." |
| partner.limit_approaching | Partner contact email and phone | billing cron | English | subject "<name>: 80% of this month's session limit" |
| payment.submitted | Payer of a transfer: patient account, guest (session guest_email), clinician user, first sponsor user of the company | `submitProof` (lib/billing/payment-notices.ts:195) | Person or user locale; guest and company in English | amount in EGP at the CURRENT rate, en-US format (payment-notices.ts:169) |
| payment.confirmed | Same payer | `confirmPayment` and `retryGrant` (payment-notices.ts:229) | as above | join link for a session payment |
| payment.rejected | Same payer | `rejectPayment` | as above | reason text |
| (mail fn) sendSessionReport | Patient | clinician approves the patient summary (lib/data/feedback.ts) | REPORT_STRINGS en, ar, fr, es by session language | subject "Your session summary" |
| (mail fn) sendRatingReminder | Patient | crisis cron unrated sweep | people.locale | feedback link /feedback/<token> |
| (mail fn) sendTherapistMessage | Clinician | abandoned patient sweep, feedback report, admin "email therapist" and "announce to all" | users.locale for sweeps, plain text for admin | subject |
| (mail fn) sendPasswordReset | Staff, clinic manager, partner user | lib/auth/actions.ts, lib/clinic-auth/tokens.ts, lib/partner/team.ts:78 | English | reset link (partner: /partner/reset?token=, 1 hour) |
| (mail fn) sendPartnerInvite | Partner colleague | /partner/team invite (lib/partner/team.ts:207) | English | link valid 7 days |
| (mail fn) sendNotification via emailAccountLink | New partner, sponsor, clinic or staff account | admin creates the user (lib/auth/account-links.ts:180) | English | aaccess.linkSubject |
| (mail fn) sendClaimCode, sendSessionInvite, sendRecordExport, sendClinicianHistory, sendWalkInDirections | Patient / clinician | claim, sessions list invite, admin exports, /radar "email me directions" | per function | subject |
| in-app only | Patient (patient_notifications) | pnotice.verifyNeeded, pnotice.benefitPaused, pnotice.ledgerTold, pnotice.messageFallback (when nothing could be sent) | people.locale on render | `SELECT kind, message_key FROM patient_notifications WHERE person_id = ...` |
| in-app only | Clinician (notifications) | crisis alert retry | English title | notifications.kind='crisis' |

---

## Not testable on the live site

#### Patients

| what | reason |
|---|---|
| Card payment on a non-Egyptian practice (`PayFlow` "Pay {amount}") | Real Stripe checkout on production; no simulated gateway there |
| Card payment on an Egyptian practice ("Pay by card") | Needs a live Paymob configuration; the fake gateway and `/dev/gateway` are refused when `VERCEL_ENV=production` (`app/dev/simulator.ts`, `lib/billing/gateway/index.ts`) |
| Replying "stop" to a check-in | Inbound WhatsApp |
| Journal dictation ("Say it instead") | Browser SpeechRecognition; headless Chrome with fake audio has no recogniser |
| Real video content | Fake audio can reach the Daily room, but nothing checks what is heard; the room needs `DAILY_API_KEY` or `ensureRoom` refuses |
| Meeting bot recording | External provider (Recall) is billed per bot hour and joins real meetings |
| Refunds through the card rail | Depend on the card processor |
| Six month benefit re-verification | Needs half a year of sponsor cycle |
| Account deletion | No patient control exists |
| Printing a receipt to PDF | Browser print dialog |

#### Therapists

- Card payments (Stripe checkout on /billing, `payInvoices`, Paymob card on /pay): real money; Stripe is off unless `STRIPE_ENABLED=true`, and the fake gateway is refused on the live deployment (`lib/billing/gateway/index.ts`).
- Stripe Connect onboarding, "Pay out now", "Stripe dashboard", `releaseAllHeldEarnings`: need a real Stripe account.
- Meeting accounts (Zoom, Google Meet, Teams) and the recording bot: real OAuth and `features.meetingBots`.
- Record system (EHR) connection: a real FHIR server and `features.ehr`.
- WhatsApp capture when no template is approved or WhatsApp is not configured: `notify()` never calls the sender, so nothing reaches `sim_outbox` for that channel.
- Real video between two browsers when `DAILY_API_KEY` is missing: the room shows "Video is not configured"; the patient's fake audio is never transcribed on the clinician side.
- Monthly renewals, 30-day licence runway and anything keyed to a future timestamp: `age` never moves future values.
- A 50-minute session in full, and the silence end after 40 minutes: sessions run a few minutes; use ageing plus the crisis cron instead.
- Dictation and read-aloud quality with synthetic voices (possible, but the result is not meaningful).
- Password reset emails to real inboxes (only kept for example.com).

#### Clinics and companies

| item | reason |
|---|---|
| Card payment of clinic bills ("Pay {amount}") and card return ?checkout= | Needs STRIPE_ENABLED and a key; every enquiry-made clinic is region eg and never sees the card button; the fake gateway is refused on the live deployment |
| Joining with an existing paid account's subscription cancel | Calls Stripe cancelSubscription; without Stripe the join works and the cancel only logs |
| Company card top-up | Card is off ("Card payment is not open yet"); topUpPot needs a Stripe payment intent |
| ETA e-invoice issuing and PDF | ETA_MODE=fake and the fake signer are refused on the live deployment; preprod or prod would file real tax documents |
| EHR records connection | Needs a registered vendor and a reachable FHIR server |
| Domain DNS proof | Nobody can publish a TXT record on example.com; agreement_approved_at has no writer in the app, so a domain rule can never be proved and domain enrolment cannot complete |
| Anything that emails back-office staff (sponsor enquiry tellBackOffice, "Ask" for money back) | Goes to the real platform staff inboxes, not sim_outbox |
| 6 month re-verification pause | Longer than the run |
| Recurring monthly seat bill | No code path raises one for a clinic without a renewal obligation (see CE15) |
| "Switch to your clinician account" | Needs a clinic manager linked to a clinician (a therapist who upgraded), created outside this area |
| Integrations (HR keys, employment verification) | Page redirects to /sponsor |
| Exact rate limit thresholds | Multiplied by 25 while SIMULATION_RUNNING=1 |

#### The console

| item | reason |
|---|---|
| /dev/gateway/[ref] and /dev/payouts | `simulatorOn` returns false when env.liveDeployment, the pages 404. If they ever render on production, stop: they have no role guard and would sign fake gateway and payout callbacks |
| "Send via provider" and provider callbacks | needs a configured payouts provider; production likely shows the Egypt "no automated payouts yet" card. Use "Mark sent" |
| Stripe refunds and "Release now" | need Stripe Connect accounts; the manual rail is what runs in Egypt |
| /admin/announce "Send to N clinicians" | sends to every active clinician including real ones; only @example.com is captured by sim_outbox. Do not press unless every active clinician is invented |
| ledger adjustment with two people | only one super_admin exists and the team page can only create staff or manager (AE21). Test with the switch off, or do not post |
| emails to FA | the founder's inbox is real: second step codes, one hand digest, watchdog alerts, payout overdue alerts all reach it |
| ETA real issuance | needs ETA_MODE, client id, signer; the settings card lists what is missing |
| authenticator app enrolment | needs a TOTP generator; an enrolled staff member can no longer use emailed codes, and only FA can reset it |
| Total View | needs both keys known to FA |
| real WhatsApp | only sent when configured; with SIMULATION_RUNNING=1 it goes to sim_outbox |
| cron by hand from a browser | needs the CRON_SECRET bearer header |
| deleting documents on a second rejection | really deletes blobs; use invented applicants only |

#### Money, jobs and partners

| item | reason |
|---|---|
| Stripe paths MO3, MO17, MO22, MO24, MO33, Stripe subscriptions, Connect onboarding | `features.billing` needs STRIPE_SECRET_KEY and STRIPE_ENABLED=true (lib/env.ts:481-483); MO24 and MO33 have no caller at all |
| Paymob card MO2 and Paymob Send payouts | Only if the production env has the Paymob keys; the fake gateway and fake payouts are refused on the live deployment (lib/billing/gateway/index.ts:57-65), and a real card charges real money |
| ETA e-invoices and credit notes | Needs ETA credentials and a signer; the fake is refused on live, so documents stay waiting |
| Partner live traffic, partner billing MO28, limit alerts, live webhooks | No partner can be approved for production (documents_url has no writer, ME50); a webhook also needs a public HTTPS receiver outside the product |
| Entity transfer MO32 | No caller |
| Watchdog and ops emails | Sent to the real super_admin addresses, not @example.com |
| Deadlines in the future (join links, pot expiry, wallet credit expiry, invites, launch tokens, key overlap, licence dates, list removal grace) | Ageing never moves a future timestamp; they pass only in real time or with a cast row created with a near deadline |
| Month-boundary jobs (partner bill, partner limit period roll, "this month" figures) | Depend on the real calendar month, not on ageing |
| Vercel schedule isolation | The live crons keep firing on their own between hand runs, so a "first run" of a job cannot be isolated |
| Real bank transfers and payouts | Staff confirm invented references; no money moves |
| lib/finance/** | Forecast only (financial model screen); it reads a benchmark and writes finance_scenarios and finance_benchmarks, never money tables |

---

| what | reason |
|---|---|
| Real WhatsApp delivery | Every WhatsApp message is kept in the outbox while the simulation runs, so delivery through Meta is never exercised |

## Every file, and what tests it

### Second pass, part 1

| file | covered by | note |
|---|---|---|
| app/(app)/error.tsx | TE56 (new) | Clinician portal error boundary: "common.somethingWrong" plus "common.retry", only the digest in the console. Reached by a malformed id in a clinician URL (TE56) |
| app/(app)/loading.tsx | none (no behaviour) | Grey skeleton with a screen reader "common.loading" while any clinician page loads; nothing to assert beyond it appearing |
| app/(app)/not-found.tsx | TE29 | `notFound()` inside the clinician portal (another therapist's patient or session) renders RouteNotFound with "Back" to /dashboard and the SOS orb |
| app/(auth)/error.tsx | none (no behaviour) | Sign-in pages error boundary (RouteError, where="auth"); no reproducible throw on these pages from the outside |
| app/(auth)/loading.tsx | none (no behaviour) | Skeleton for the sign-in pages |
| app/(auth)/not-found.tsx | none (no behaviour) | No page in (auth) calls `notFound()`, so this boundary is unreachable; unknown URLs fall to app/not-found.tsx |
| app/(partner)/error.tsx | none (no behaviour) | Partner portal error boundary, "common.somethingWrong" plus "dev.retry"; no reproducible throw |
| app/(partner)/loading.tsx | none (no behaviour) | DeskLoading skeleton |
| app/(partner)/not-found.tsx | none (no behaviour) | No page in (partner) calls `notFound()`; unreachable |
| app/(partner)/partner/apply/page.tsx | PT1 | Apply page with the three rulings (C255, C277, 42.4) printed under the form |
| app/(partner)/partner/deliveries/page.tsx | PT15, ME94 (new) | Delivery log: event, state Delivered / Failed / Pending with "next try", status, attempts, opaque subject id, URL; "Redeliver" only for role admin and a non-disabled endpoint |
| app/(partner)/partner/forgot/page.tsx | PT18 | QuietAuthShell around PartnerForgotForm |
| app/(partner)/partner/page.tsx | PT4, PT5, PT19 | Key list; mint only when role admin; shows "stops at" for a rotated key |
| app/(partner)/partner/reset/page.tsx | PT18, ME95 (new) | Carries `?token=` to the form; an empty token renders the form anyway |
| app/(partner)/partner/sign-in/page.tsx | PT3 | Links "dev.forgot" and "dev.apply.title" under the form |
| app/(partner)/partner/team/page.tsx | PT17 | Team list, `canEdit` for admin only, "you" marker on own row |
| app/(partner)/partner/webhooks/page.tsx | PT15 | Endpoint list; secret never selected |
| app/(public)/error.tsx | TE56 (new, public half) | Public site boundary with the SOS orb; reached by /t/<malformed id> |
| app/(public)/layout.tsx | WB23 (new) | Site header and footer, USD-first money display, hreflang alternates from `x-pathname` |
| app/(public)/loading.tsx | none (no behaviour) | Skeleton inside the site main |
| app/(public)/not-found.tsx | WB6, PA28.3 | `/t/<unknown id>` and an unknown CMS slug render RouteNotFound with "Back" to / |
| app/(room)/error.tsx | none (no behaviour) | Room boundary, white text on the navy room ground; no reproducible throw |
| app/(room)/loading.tsx | TH8.1 | Dark skeleton shown while the room builds the Daily room and meeting token (seconds); visible on every room open |
| app/(room)/not-found.tsx | TE29, TE55 (new) | Another therapist's /sessions/<id>/room; renders the light-ground RouteNotFound on the navy room ground (see Bugs) |
| app/api/documents/[id]/speak/route.ts | TH11.6 (new), PA22.5 (new), PE77 (new) | "Read aloud" for a document: server assembles chunks (max 4000 chars), audits `document.speak` (phi_access), returns MP3; 404 for no access, 400 nothing to read, 500 on model failure |
| app/api/ehr/callback/route.ts | TE52 (new), CE42 (new) | Callback after the vendor; on live `features.ehr` is off so only the refusal paths are reachable: no pending cookie redirects to `<home>?ehr=expired` |
| app/api/meetings/callback/[provider]/route.ts | TE54 (new) | OAuth return for Zoom/Meet/Teams; every failure redirects to /settings/integrations silently |
| app/api/meetings/transcript/[sessionId]/route.ts | ME90 (new) | Unauthenticated bot webhook; bot id must match the dispatched one (409 otherwise), consent re-checked, but nothing is written (see Bugs) |
| app/api/partner/v1/copilot/route.ts | PT10, ME92 (new) | POST needs subject, clinician, question; refused subject, clinician not enabled (403), limit (409); PUT turns a clinician on or off |
| app/api/partner/v1/notes/[sessionId]/route.ts | PT13 | `deliverableNote`, live only, approved only |
| app/api/partner/v1/sessions/[ref]/note/route.ts | PT9, ME93 (new) | GET drafts on first read from the transcript; POST needs text and approved_by |
| app/api/partner/v1/sessions/[ref]/summary/route.ts | PT9, ME91 (new) | GET refuses 409 until the note is approved, then writes a fresh draft with a model call on every GET; POST delivers |
| app/api/partner/v1/sessions/[ref]/transcript/route.ts | PT9 | Transcript, recording_from_seconds, coverage sentence, source "transcript" |
| app/api/partner/v1/subjects/[ref]/memory/route.ts | PT10, ME96 (new) | Approved notes of this platform's sessions only, after `subjectRefusal` |
| app/api/partner/v1/subjects/[ref]/readers/route.ts | PT11 | `whoMayRead`, live key only |
| app/api/patient/avatar/[personId]/route.ts | PE76 (new) | Photo proxy: the patient, a clinician with a live patients row in their own org, or super_admin; everyone else 404; `private, max-age=300` |
| app/global-error.tsx | none (no behaviour) | Only when the root layout itself throws; bilingual text and crisis numbers inline. Not reachable on purpose from the live site |
| app/layout.tsx | PA27.4, PE65 | `lang` and `dir` from the locale, admin string overrides for client components, operator EGP rate into MoneyDisplayProvider, SimulationBanner |
| app/manifest.ts | WB22 (new) | `/manifest.webmanifest`, start_url /patient, standalone |
| app/not-found.tsx | WB24 (new) | Any unmatched URL (including a mistyped /pay, /join, /patient path): "nf.title", "nf.back" to /, SOS orb |
| app/records/[token]/data.json/route.ts | WB18 | JSON download, 410 "This link is no longer active." when dead |
| app/robots.ts | WB21 (new) | During the simulation `Disallow: /` for everything |
| app/session-expired/route.ts | TH1.8 (new), AE56 (new) | Clinician and staff idle expiry: revokes, deletes cookie, always redirects to /login?expired=1 (see Bugs) |
| app/sitemap.ts | WB20 (new) | `/`, `/radar` and every published CMS slug except home, once per locale with alternates; revalidates hourly |
| components/admin/currency-switch.tsx | AD1.5 | USD / EGP buttons in the console header |
| components/auth/auth-shell.tsx | TH1.1, TH1.4, PA1.1, PA2.1, CL1.5, CO1.3, AD1.1, PT3, WB25 (new), AE57 (new) | AuthShell with the four-door switcher and the flip link; QuietAuthShell for staff and partner |
| components/billing/ledger.tsx | TH14.1, TH14.5, TH14.7 (new) | Stripe pay card only when `payable` (not on the eg rail); history rows expand to invoice detail and usage breakdown |
| components/billing/payment-history.tsx | TH15.4 (new), TE60 (new) | /earnings "patient payments" list and Stripe transfers |
| components/billing/pending-bar.tsx | TH14.3, CO7.1, TH14.8 (new), CO7.5 (new) | Bar in the clinician and sponsor layouts; confirmed stage can be dismissed per browser |
| components/brand/logo.tsx | none (no behaviour) | SVG mark with an accessible name |
| components/clinical/note-card.tsx | TH6.10, WB26 (new) | Read-only note; a missing section says "tnc.notWritten" |
| components/clinical/patient-brief-card.tsx | TH6.11, PA18.1, PE78 (new) | Patient copy on the clinician review and on /feedback |
| components/clinical/risk-assessment.tsx | TH12.4 (new) | Risk card on /sessions/[id] after `assessSessionRisk` |
| components/clinical/risk-banner.tsx | TE46, TE58 (new) | Room banner with call button; PatientSupportNotice in the same file has no caller |
| components/clinical/transcript-panel.tsx | TH6.4, TH6.5, TH6.7, TH8.4 | "Listening…", "Recording" / "Paused", speaker labels |
| components/demo/clinical-demo.tsx | WB26 (new) | Transcript, note and risk demos on /features and /for-therapists |
| components/demo/component-showcase.tsx | WB26 (new), WB27 (new) | Picks the demo surface and frame per CMS block name |
| components/demo/device-frame.tsx | WB26, WB27, WB28 (new) | Browser and phone frames; default phone tabs are English but never rendered (every phone caller passes tabs or nav=false) |
| components/demo/fixtures.ts | none (no behaviour) | English fallback transcript and note for the demos when CMS demo content is missing |
| components/demo/flow-demo.tsx | WB28 (new) | Claim and consent walkthroughs on /for-patients |
| components/demo/patient-app.tsx | WB27 (new) | Navigable patient app mockup on /, /for-patients |
| components/demo/portal-demo.tsx | WB29 (new) | Clinic and company console mockups on /for-clinics, /for-companies |
| components/demo/session-copilot.tsx | WB26 (new) | Copilot demo inside the session demo and on /features |
| components/demo/session-demo.tsx | WB26 (new) | Hero session demo on /, /for-therapists, /features |
| components/documents/document-list.tsx | PA22.1, TH11.3, TH11.6 (new), TH11.7 (new), PA22.5 (new), TE59 (new) | Open, Read aloud, Flag with three reasons, watermarked image viewer |
| components/documents/document-panel.tsx | TH11.3, TH11.7 (new) | Clinician documents page wrapper; flag goes to `flagContent` |
| components/forms/phone-field.tsx | PA1.1, PA10.1, TH5.1, TH5.2 | Country select plus "phone.readAs" hint after blur |
| components/forms/timezone-field.tsx | PA1.1 | Detected zone preselected, "phone.zoneShown" line |
| components/marketing/state-dot.tsx | TH19.3, WB14 | Coloured dot per integration state; decorative |
| components/money/display.tsx | AD1.5, WB3 | Context only: which currency leads and the EGP rate |
| components/money/price-tag.tsx | WB3, PA9.3, WB30 (new) | Click toggles EGP and USD; hover or focus peeks the other figure |
| components/nav/bottom-nav.tsx | TH6.16 (new), TH20.3 (new), TE31 | Phone-width clinician bar: two items, "+" to /sessions/new, rest, "More" sheet; hidden on /room |
| components/nav/section-tabs.tsx | TH6.16 (new) | Group tabs under the header; hidden on /room and for single-member groups |
| components/notes/provenance-client.tsx | PA18.4 (new) | Patient-side note origin badge in the session list |
| components/notes/provenance.tsx | TH6.17 (new), PA18.4 (new) | "note.origin.transcript / partial / clinician" badges and the explaining line on /sessions/[id] |

### Second pass, part 2

| file | covered by | note |
|---|---|---|
| components/partner/apply-form.tsx | PT1 | Pending label "Working…" is hardcoded English (see PE82 list). Five fields, all required; success card replaces the form. |
| components/partner/chrome.tsx | PT3, PT4, PT15, PT16, PT17 (tabs), new PT21 (Sign out) | Six tabs: Keys, Webhooks, Deliveries, Usage, Team, Docs. Footer sentence `dev.noContent` on every signed-in screen. Sign out had no step. |
| components/partner/key-list.tsx | PT4, PT5, PT19, new ME102, ME104 | Revoke and Rotate both open a confirm step with Cancel; rotate overlap select defaults to 7 days (options 7 days, 24 h, 0). Raw key shown once from the action result. Controls hidden unless role admin. "Working…" hardcoded English. |
| components/partner/password-forms.tsx | PT18 | Forgot form swaps to `dev.linkSent`; choose-password field `minLength=12`. |
| components/partner/sign-in-form.tsx | PT3 | No sign-up link by design. "Working…" hardcoded English. |
| components/partner/team-list.tsx | PT17, new ME102 | Remove asks first; server errors (last admin, yourself) shown inline under the row. Invite role defaults to Developer. |
| components/partner/try-button.tsx | PT15 ("Send test" on an endpoint, "Redeliver" on a delivery) | Shows "Delivered"/"Failed" plus HTTP status or network error beside the button. |
| components/partner/usage-meter.tsx | PT16, ME56 | Amber stop card first when stopped; bar turns amber at 80%, red at 90%; projection sentence; last month bill card; limit input only for admin. |
| components/partner/webhook-list.tsx | PT15, new ME103 | Secret shown once. "Disable" is a single tap with no confirm (unlike key revoke). Amber note `devs.needsLink` above the event list. "Working…" hardcoded. |
| components/patient/avatar.tsx | PA23.3 (patient's own photo), TH5.2 (clinician patient page), new PE80 | Image comes from `/api/patient/avatar/<personId>`, whose `mayRead` checks only that the clinician holds a `patients` row, not a live grant. |
| components/patient/booking-change.tsx | PA19.2, PA19.3, PA19.4, PE25, PE26, PE27 | Move select + "Move"; "Cancel session" then confirm "Yes, cancel"/"Keep it"; done card with refunded / queued / held line. |
| components/patient/route-loading.tsx | no user-visible behaviour beyond a loading skeleton | Grey blocks while a patient, /pay, /join, /feedback, /j, /support, /welcome page loads; keeps the SOS orb (PA27.1) on /pay and /join during load. |
| components/portal/desk-loading.tsx | no user-visible behaviour | Loading skeleton for sponsor and partner route groups. |
| components/portal/desk.tsx | CL1.5, CO1.3 (rail), CO13.2 (read-only badge) | Shared clinic/sponsor chrome: rail at lg, pills below lg, language switch in the rail, NeverBar wall in the rail (footer below lg), all `print:hidden` (CO4.1 "Print this"). |
| components/public/audience-demos.tsx | WB2 | Demo consoles fed fixtures. TherapistSplitDemo hardcodes a 15% fee (see Bugs). |
| components/public/audience-hero.tsx | WB2 | Hero band of the four audience pages. |
| components/public/audience-page.tsx | WB2 | Feature bands, "also included" list, cost panel, closing band with links to the other three audience pages. |
| components/public/audience-rotator.tsx | WB1 | Home hero rotates four audience panels every 6 s, stops for good on any hover/tap/focus, no rotation under reduced motion. |
| components/public/blocks.tsx | WB1, WB3, WB4, PA28.3 | CMS block renderer. Hero with a CTA always adds a second button "Sign in" to `/login` (clinician door) even on patient-facing pages. Crisis block links /radar and /for-patients. |
| components/public/comparison.tsx | WB1, WB3 (competitors block) | One tab per competitor; conceded rows flip the tick. |
| components/public/contact-form.tsx | WB5, new ME97 | Warning above the form links the radar; honeypot `website`; attachment failure is non fatal and shown as an amber line under the reference. |
| components/public/docs-nav.tsx | WB14 | Sticky "on this page" nav on /developers. |
| components/public/how-it-works.tsx | WB1 | Eight demo tiles. |
| components/public/icons.tsx | no user-visible behaviour | Icon allowlist; unknown CMS icon renders Sparkles. |
| components/public/mobile-nav.tsx | WB1 at phone width, new WB31, new ME98 | Sheet with four audience links, radar link and the four sign-in doors; it has no language switch. |
| components/public/pricing-tiers.tsx | WB3, new ME99 | Every figure from settings: platform fee, AI rate, tiers, seat bands, cut %, EGP rate (operator rate), credit months, netting line only when `netFeeFromHeldEarnings`. |
| components/public/seat-ladder.tsx | WB3, ME87 | Slider indexes server-computed monthly figures; starts at 3 seats. |
| components/public/seat-slider.tsx | WB3 | Same, inside the clinic card. |
| components/public/sign-in-menu.tsx | new WB31 | Header "Sign in" menu with four doors (therapist, patient, company, clinic); no staff or partner door by design. |
| components/public/site-chrome.tsx | WB1, WB2, PA27.4, new ME98 | Header: four audience links (md+), language switch and sign-in menu (sm+ only), radar CTA always. Footer: audiences, CMS rows plus /integrations, /developers, /verify, legal rows. |
| components/radar/filters.tsx | PA11.1 ("Show everyone"), new PA11.3, new PE79 | Chips built only from who is on the radar now, each with a count computed against the other filters; country chip from the globe; in-person chip; "Clear filters". |
| components/radar/globe.tsx | PA11.1, TH19.2, AD15.1, WB1 | Drag, wheel zoom, tap a country to filter, tap a dot to open booking. Dot tooltip text is hardcoded English. |
| components/radar/public-profile.tsx | PA9.3, PA9.4, WB6, new PA11.2 | Clinician page body: live availability pill (polls `/api/radar/profile/<id>` every 5 s), "Start now" opens the radar BookingSheet when online, disabled with off-shift/busy text otherwise, "Copy link". Several English literals (see Bugs). |
| components/radar/public-radar.tsx | not reached | Not imported anywhere in app/ or components/ (dead code); /radar uses `radar-console.tsx`. |
| components/radar/radar-hero.tsx | WB1, new WB32 | Home hero IS a live radar: polls `/api/radar` every 4 s, filters, cards open the booking sheet on the home page. "From {price}" uses `formatUsd` (dollars) while cards use `Money`. |
| components/radar/radar-list.tsx | PA11.1 ("List" view) | Row per clinician: all languages, next open hour in the reader's zone or "no hours published", rating or "no rating", price per half hour. |
| components/radar/therapist-card.tsx | PA11.1, TH19.2, WB8 | Status pill ("Available", "Being booked", "In session", or "Held for you" for your own hold), walk-ins, clinic label, demo-account label. Rating tooltip is hardcoded English. |
| components/radar/types.ts | no user-visible behaviour | Type of a radar entry. |
| components/radar/world-radar.tsx | TH16.3 (on-call board), WB1 (patient-app demo) | Dot map; `aria-label` "N clinicians on the radar" hardcoded English. |
| components/session/video-call.tsx | TH8.4, TE39, TH6.7 | Daily call object; camera toggle; Off record mutes the outgoing call too; "Waiting for your patient to join" until a remote participant arrives; join failure message `troom.videoConnect`. |
| components/sessions/status-badge.tsx | TH6.15, TH8.9 (/sessions, /patients/[id], /notes badges) | Live / Not started / Cancelled / Writing / Note failed / Note ready; note badge Draft / Summary held / Approved. |
| components/settings/section.tsx | TH3.1 | Settings section headings and jump chips. |
| components/simulation-banner.tsx | new ME100 | Violet strip on every page when on the simulation branch or `SIMULATION_RUNNING`, naming the database endpoint. |
| components/sponsor/integrations.tsx | CO13.1, EE35 (page hidden) | Only rendered by `hidden.tsx`, so the HR key cannot be minted from any page; PT20 therefore has no UI path for a sponsor key. |
| components/sponsor/spend-heatmap.tsx | CO10.1, EE27 | Suppressed weeks hatched, zero weeks palest; five shade steps. |
| components/ui/index.tsx | no user-visible behaviour | Button, Card, Field, Input, Textarea, Badge, EmptyState, PageHeader primitives. |
| components/ui/money.tsx | ME75, PA10.2 | Amount in the reader's currency, other currency on hover/tap. The tap handler stops propagation, so on a radar card a tap on the price does not open the booking sheet. |
| components/visual/primitives.tsx | no user-visible behaviour of its own | StateBanner, FlowStrip, SeesWhat, Meter, Checklist, BeforeAfter, NeverBar, SplitBar, IconGrid; exercised through CL3.2, CO7.1, WB2 and others. |
| instrumentation.ts | AD19.1 (error groups) | Records every server error (path, method, digest; never body/query/cookies). |
| lib/access/state.ts | TH5.6, TH10.2, TE29, PA20.1, PA20.2, TH13.2 | Four access states and capabilities. `explain()` banners and `REJECTION_REASONS` are English only (see PE82). |
| lib/admin/paging.ts | AD3.3, AD5.1, AD5.7, new AE63 | 50 per page, search ignored under 2 chars, bad `page` falls back to 1. |
| lib/ai/assistant.ts | TH10.5, new TE61 | Roster only (names, last/next session date, draft note count); 50 questions per calendar month (`generalMessagesPerMonth`). |
| lib/ai/case-copilot.ts | TH10.2, TH10.3, TH8.5, TE34, new TE62 | Isolation, citation resolution, live-session time bound. Two defects in the bound and the session window (see Bugs). |
| lib/ai/client.ts | AD19.2 (usage and cost), every AI step | Logs metadata only; missing key throws `AiUnavailableError` (no fake note). |
| lib/ai/copilot.ts | TH6.5 | In-room suggestions every 3 segments over the last 14; failures return nothing. |
| lib/ai/diagnoses.ts | TH11.4 | Proposals only, verbatim sentence check, no duplicate of an existing proposal. |
| lib/ai/diarise.ts | TH6.8, TH6.14, new TH6.18 | After a session, `unknown` lines get inferred speakers ("inferred" tag); lines with a question followed by an answer stay unknown. |
| lib/ai/note-writer.ts | TH6.8, TH3.7, TH6.13, PT9 | Note prompt and coercion; `patientSteps` capped at 4. |
| lib/ai/profile.ts | TH11.3, TH6.8 (rebuilt after each note) | Standing profile from the person's documents and the 8 newest sessions of every clinician holding a row for that person. |
| lib/ai/risk.ts | TH6.8, TH12.2, TE46 | Indicators with verbatim quotes; unquoted findings dropped. |
| lib/ai/transcribe.ts | TH6.5, TH6.6, TE10 | Drops stock hallucinations ("Thank you.", "[music]"...). |
| lib/ai/translate.ts | AD18.3 ("machine translate") | Keeps only translations that preserve every `{placeholder}`. |
| lib/alarm.ts | TH16.3, TH16.4 | Web Audio alarm, browser notification permission, title flashing. A headless agent can only check the state, not hear it. |
| lib/assistant/roster.ts | TH10.5 | Links patient names in answers to their page. |
| lib/audio/recorder.ts | TH6.5, TH8.4, TE3, TE10 | Chunks are pause-aligned (2 to 8 s), not fixed 8 s; fragments under 1 s and all-silent chunks are never uploaded, which changes the premise of TE10. |
| lib/audit.ts | AD3.3, every audited step | One actor per row. |
| lib/auth/doors.ts | new WB31 | Four doors; signup variants of company and clinic go to the apply forms. |
| lib/auth/org-authority.ts | TH14.6, TE30 | Only a solo organisation may run its own account. |
| lib/brand.ts | no user-visible behaviour | The constant "24Therapy". |
| lib/checkins/policy.ts | PA26.1, AD18.5, new PA26.4, new PE81 | Halt, unreachable, muted, quiet hours in the person's zone (unknown zone counts as quiet), cadence floor 6 h. |
| lib/checkins/receive.ts | not reached | `handleReply` has no caller and there is no inbound message route (see Bugs). |
| lib/checkins/wording.ts | new PA26.4 | 12 wordings, never the same as the last one; `isStopWord` is only used by the unreachable `handleReply`. |
| lib/clinic-week.ts | CL9.1, CL9.3, CE41 | Week bounded by the reader's zone midnights; nonsense `week` falls back to this week. |
| lib/clinical/context.ts | TH6.8 | "Known before this session" block in the note prompt; drops unconfirmed AI facts, diagnoses and per-session domains. |
| lib/clinical/currency.ts | TH11.5 | Age labels on facts ("3 weeks ago", "(not current)"), English and Arabic. |
| lib/clinical/patient-copy.ts | PA18.1, TH6.11 | Only `patientBrief` is ever emailed. |
| lib/consent.ts | TH6.3 (consent version stamp) | Only `RECORDING_CONSENT_VERSION` is used; `RECORDING_CONSENT` and `lateRecordingStamp` are unused (see Bugs). |
| lib/console/board.ts | AD19.3 | TV board totals (money, companies, clinics, therapists, sessions, AI, payments, patients, activity). Two mislabelled counts (see Bugs). |
| lib/console/history.ts | new AD19.8 | CSV of every session of one clinician with patient names and emails. |
| lib/console/pot-trace.ts | AD7.8, ME77, new AE58, AE59 | "Where the pot went" and the "Agrees / Out by" check, joined through the person's enrolments. |
| lib/console/reads.ts | AD19.3, new AD19.6, AD19.7, AE62 | Live sessions, radar, timeline, people search, audited session and person reads (reason at least 10 chars). |
| lib/content/defaults-ar.ts | WB1, WB3, WB4 in Arabic, new ME101 | Arabic home, for-patients, features, pricing, contact. Contact company addresses are an admin instruction string. |
| lib/content/demo.ts | WB1, WB2 | Demo content for the marketing demos, CMS slug `demo` or built-in fallback per language. |
| lib/content/honesty.ts | AD18.2 ("honesty check"), new AE60 | English regexes only. |
| lib/content/registry.ts | no user-visible behaviour | Which locales ship default pages (content sync plumbing). |
| lib/content/sanitise.ts | AD18.2, new AE61 | Whitelists keys per block type, caps lengths, validates `backgroundImage` only. |
| lib/content/service.ts | PA28.3, AD18.2, WB4 | Page read cached 30 min under tag `cms`; Arabic falls back to English; a draft row answers 404; "Save draft" on a live page keeps the live page. |
| lib/content/url.ts | AD18.2, AE61 | Image URL allowlist (same-origin path or http(s), no quotes or parentheses). |
| lib/crisis/context.ts | TE46, PA21.1, new TE63 | Third-party and resolved-past suppression, overridden by present-tense markers. |
| lib/crisis/fold.ts | TE46, PA21.1, TE63 | Arabic folding and word matching used by the crisis scan. |

### Second pass, part 3

| file | covered by | note |
|---|---|---|
| lib/crisis/level.ts | TH6.8 (`assessSessionRisk` after End), TE46 | Pure ladder: keyword hit is a floor at "elevated", model can only raise. Plan-only case is new edge TE74 |
| lib/crisis/line.ts | PA27.1, AD14.7 | Verified table EG 105 (Mon to Thu 09 to 17 Cairo) plus 123/112; configured line wins; `LAST_RESORT_HELP` feeds the crash page. Hours ordering is new edge PE83 |
| lib/crisis/sos.ts | PA27.1 | Decides which numbers the SOS sheet lists and in what order. New edges PE83, PE84 |
| lib/crypto/secretbox.ts | TH17.1, TH17.2, CL11.2 | AES-GCM sealing; with no `TOKEN_ENCRYPTION_KEY` meetings and EHR refuse to connect, which is the live state those steps check |
| lib/csv.ts | CL9.3, CO10.2 | Formula-injection escaping of CSV cells. New edge CE43 |
| lib/data/actuals.ts | AD19.5 | `/admin/actuals` monthly table and position card. Latent bug listed |
| lib/data/capital.ts | AD19.5 | Capital and other costs, super_admin only. New edge AE67 |
| lib/data/checkins.ts | PA26.1, AD18.5, hourly `reminders` cron | Candidates are every live patient account; mute is idempotent; admin sees counts only |
| lib/data/clinic-visibility.ts | not reached by any step | `/patient/record` card "What {practice} can see" is unscripted: new step PA22.6. `clinicAffiliations` has no caller (bug list) |
| lib/data/copilot-view.ts | TH10.2 | Shared loader for `/copilot/<id>` and the embedded thread on `/patients/<id>` |
| lib/data/diagnoses.ts | TH11.4, PA22.1 | Confirm is conditional on `proposed`; only confirmed diagnoses reach the patient profile |
| lib/data/discover.ts | PA9.1, PA9.2 | Home rails and search. Name search, short query and rating bar are new edges PE85, PE86 |
| lib/data/ehr.ts | TH17.2, CL11.2 | Connection lifecycle; on live `features.ehr` is off so only the "cannot hold a connection" sentence is reachable. `recordLaunch` has no caller (bug list) |
| lib/data/facts.ts | TH11.5 | Evidence layer; journal evidence can never produce a diagnosis or risk fact (enforced before insert) |
| lib/data/instrument-seeds.ts | TH11.2, PA21.3 | PHQ-9 and GAD-7 seeded English-only; Arabic drafts still render (bug list, edge PE87) |
| lib/data/licence-change.ts | TH2.1, TH2.11, TH3.1 | Locks licence fields once submitted or approved. Tampered save is new edge TE64 |
| lib/data/meeting-connections.ts | TH17.1 | Store, revoke and open meeting credentials; unreachable on live without Recall and the sealing key |
| lib/data/memory.ts | TH11.3 | Standing profile and timeline on `/patients/<id>/documents`; `isStale` drives the "behind its sources" note |
| lib/data/name-match.ts | PA6.4 | Case, space and diacritic folding for the claim name question. New edge PE88 |
| lib/data/note-formats.ts | TH3.7, TH6.13 | Own templates archived not deleted; default falls back to SOAP. New edge TE65 |
| lib/data/note-record.ts | TH6.10, TH6.11, TH6.12, TE14 | Signed halves lock; addenda. Primary moves to first signed format: new edge TE66 |
| lib/data/notices.ts | PA26.2 | Append-only notices, dismiss is a stamp scoped by person |
| lib/data/notifications.ts | TH12.1, TH12.2 | Unread by kind, mark all read, clear on opening the session |
| lib/data/org-kind.ts | TE30, TH14.6 | Used by `requireOrgAccount`, dashboard and layout to refuse billing to a clinic seat |
| lib/data/partner-links.ts | PA20.6 | Unlink scoped by person. Double unlink answers "That connection has already ended." (new edge PE94) |
| lib/data/payroll.ts | AD19.5 | Employees and salary rows, super_admin only; leaving month still paid |
| lib/data/people.ts | PA1.2, PA6.5, PA10.1, PA11.1, PA16.1 | `redactName`, `findMatches`, and `patientRowForPerson` (one file per person per clinician). New edge PE90 |
| lib/data/receipts.ts | PA24.2, PE29 | Receipt only for the patient's own paid or refunded share; fully covered pot payment has none (new edge PE92) |
| lib/data/session-risk.ts | TH6.8, TE46 | Risk assessment after End. "Before this session" history is not patient scoped (bug list, edge TE75) |
| lib/data/session-sources.ts | TH8.8 | Ingest credential issue and revoke; lookup by URL session id. New edge TE71 |
| lib/data/session-voices.ts | TH6.14 | `bindVoice` and `unbindVoice` are wired; `recordVoices` has no caller so no voice ever exists (bug list, edge TE77) |
| lib/data/summaries.ts | TH6.11, PA22.2 | Append-only versions; `summaryProblem` refusals are new edge TE67 |
| lib/data/taxonomy.ts | AD18.4, TH16.1, TH2.1, PA9.1 | Admin overrides over built-in lists; add refusals are new edge AE66 |
| lib/data/timeline.ts | not reached by any step | No caller anywhere in app, lib or components: dead code, nothing to simulate |
| lib/data/timezone.ts | TH3.4, TH4.1 | Stored zone, else browser zone adopted and saved, else UTC |
| lib/data/usage.ts | AD19.2 | `/admin/usage` and `/admin/usage/sessions` aggregates in microcents |
| lib/data/vault.ts | AD10.1, AD11.1, AD14 (settings traction tiles) | Ledger summary and traction; MRR is hard-coded (bug list, edge AE70) |
| lib/data/verified.ts | WB6, TH19.2, PT11, PT12 | Verified flag, regulator and approval month read from the approved row; licence number never published |
| lib/db/directory.ts | no user-visible behaviour | Region lookup for routing; both regions are one database today |
| lib/db/index.ts | no user-visible behaviour | Pools, `dbFor`, `controlDb`, `acrossRegions` |
| lib/db/qualified.ts | no user-visible behaviour | SQL helper for correlated subqueries |
| lib/db/region.ts | PA26.3 | `crossesBorder` and `regionLabel` drive the residency screen; rest is plumbing |
| lib/diarisation/align.ts | no user-visible behaviour | Pure alignment arithmetic with no production caller (tests only) |
| lib/diarisation/provider.ts | no user-visible behaviour | Type-only seam; no provider implemented |
| lib/diarisation/turns.ts | no user-visible behaviour | Pure turn arithmetic with no production caller |
| lib/diarisation/voices.ts | TH6.14 | Only `speakerFor` is reached (via `session-voices.ts`); binding and display helpers are unwired |
| lib/documents/chunk.ts | TH11.3, TH10.2 | Chunking and `[D7:3]` citation resolution behind the copilot; covered by its callers |
| lib/documents/extract.ts | TH11.3 | PDF, docx and text extraction; column layouts marked unsupported. New edge TE68 |
| lib/documents/formats.ts | TH11.3 | 25 MB limit, accepted types, searchability labels. New edge TE68; doc correction listed |
| lib/documents/identity-access.ts | AD4.1, TH2.2 | Audited route for licence and ID images. New edge TE69 |
| lib/documents/identity-rule.ts | AD4.1 | Owner or back office only; pure helper of the above |
| lib/documents/layout.ts | TH11.3 | Two-column detection; part of edge TE68 |
| lib/documents/read-access.ts | PA22.1, TH11.3 | `/api/documents/<id>` and read-aloud decision. New edge TE70 |
| lib/ehr/fhir.ts | not reached by any step | FHIR reads and DocumentReference filing; no caller reaches them (bug list) |
| lib/ehr/file-note.ts | not reached by any step | `fileNote` has no caller; approved notes never file (bug list) |
| lib/ehr/owner.ts | TH17.2, CL11.2 | `whatIsMissing` is the sentence shown on live when EHR is not configured |
| lib/ehr/pending.ts | TH17.2, CL11.2 | Sealed OAuth cookie; only reachable once `features.ehr` is on |
| lib/ehr/policy.ts | no user-visible behaviour | Constants read by `verify:sprint43` only |
| lib/ehr/smart.ts | TH17.2, CL11.2 | Discovery and token exchange behind "Continue"; refusals only reachable with EHR configured (new edge CE44) |
| lib/ehr/vendors.ts | TH17.2, CL11.2 | Vendor names in "Which system" and the scope guard |
| lib/feedback-options.ts | PA18.1 | Tag lists and `ratingReady` gate on "Send". New edge PE89 |
| lib/geo.ts | PA11.1, TH19.2, TH16.1, TH2.1 | Radar map dots, country names in the reader's language, language and specialty allowlists |
| lib/geocode.ts | TH16.2, WB9 | Nominatim lookup, pasted coordinates, directions link. New edge TE72 |
| lib/globe.ts | PA11.1, TH19.2 | Pure projection maths for the radar globe; no behaviour to test beyond the map rendering |
| lib/i18n/authoring.ts | AD18.3 | Draft, publish, clear, machine drafts, language launch gate. New edges AE64, AE65 |
| lib/i18n/client.tsx | PA23.2, PE65, AD18.3 | Client translator applies published overrides; covered by any Arabic step |
| lib/i18n/last-resort.ts | PE68 | Words on `app/global-error.tsx` in both languages |
| lib/i18n/paths.ts | not reached by any step | `/ar/...` public URLs, canonical and hreflang: new steps WB33, WB34 |
| lib/i18n/rich.tsx | no user-visible behaviour | Splits translated text around a `<Money>` node; covered by callers |
| lib/i18n/server.ts | PA23.2, PE67, TH3.2 | Locale order URL, cookie, Accept-Language. Accept-Language path is new step WB35 |
| lib/i18n/strings.ts | AD18.3 | Override cache, completeness; rounding bug listed (edge AE65) |
| lib/ingest/token.ts | TH8.8 | Bearer door refusals. New edge TE71 |
| lib/integrations/registry.ts | TH19.3, WB14 | Public integrations states; the "clinic systems" entry overclaims (bug list) |
| lib/lifecycle/machines.ts | no user-visible behaviour | Spec for `scripts/verify-machines.ts`; some state descriptions do not match the product (bug list) |
| lib/logger.ts | no user-visible behaviour | Log scrubbing |
| lib/mail-previews.ts | AD14.8 | Sends 26 previews, not 14; see edge AE69 |
| lib/marketing/fixtures.ts | WB1, WB2 | Invented data for the marketing mockups; nothing stored |
| lib/meetings/create.ts | TH17.1 | Zoom meeting creation from `/sessions/new`; unreachable on live without a connected account |
| lib/meetings/dispatch.ts | PA16.2, PA16.5, PE48 | `sendBotForConsent` and `withdrawBot` run on every consent answer and return quietly on live (no external source) |
| lib/meetings/providers.ts | TH17.1 | Provider names and "may be blocked" sentences on `/settings/integrations` |
| lib/meetings/recall.ts | TH17.1 | Returns "Meeting recording is not switched on..." on live |
| lib/money/admin-currency.ts | AD1.5 | Cookie parse for the console currency switch |
| lib/money/convert.ts | AD1.5, PA12.1, ME75 | USD and EGP conversion and formatting used everywhere a price shows |
| lib/money/text.ts | ME39, PA12.2 | Amounts inside messages and action results |
| lib/net/public-url.ts | PT15 | Webhook URL checks. Credential and internal-host cases are new edge ME105 |
| lib/partner-auth/guard.ts | PT3, PT4 | Developer role cannot mint. New edge ME106 |
| lib/partner-auth/session.ts | PT3, PT18 | 30 min idle, 8 h absolute; held or suspended partner has no portal. Part of ME106 |
| lib/partner/consent.ts | PT7 | Consent log and coverage sentence. New edge ME107 |
| lib/partner/copilot.ts | PT10 | Partner copilot and memory refusals. New edge ME111 |
| lib/partner/draft.ts | PT9 | Note and summary drafts from transcript; under 40 characters gives no draft |
| lib/partner/employment.ts | PT20 | Attestation rule. New edge ME112 |
| lib/partner/media.ts | PT8, PT7 | Consent boundary cut and purge on withdrawal. New edges ME108, ME109 |
| lib/partner/notes.ts | PT9 | Approval and summary delivery rules. New edge ME110 |
| lib/partner/wav.ts | PT8 | Pure WAV cutter used by ME108 |
| lib/phone/e164.ts | PA1.2, PA7.2, TH5.1, PA23.5 | Number expansion and refusal sentences. New edge PE91 |
| lib/regulators.ts | TH2.1 | Regulator chips and document labels per country |
| lib/request.ts | no user-visible behaviour | IP and user agent for audit rows |
| lib/scheduling/hours.ts | TH4.1, PA10.1, TH8.4 | Hold length, radar auto-offline before a booking, in-room booking warning. New edge TE73 |
| lib/scheduling/tz.ts | TH4.1, TH4.6, PA10.1, CL9.1 | Zone resolution, quiet hours 22 to 07 for reminders, week bounds for the clinic rota |
| lib/scheduling/use-reader-zone.ts | PA19.2, PA10.1 | Client hook; dates render in the reader's zone after mount |
| lib/security/csp.ts | every page | Nonce CSP; only the clinician room gets `unsafe-eval`. New edge ME113 |
| lib/sessions/cancel-reason.ts | TH8.9, TE27 | Reason 3 to 300 characters. New edge TE76 |
| lib/sessions/off-record.ts | TH6.7 | Off record mutes first, resume waits for the server |
| lib/settings/changes.ts | AE43, AD14.5 | Field-by-field change lines for the settings history |
| lib/settings/index.ts | AD14.1 to AD14.7, WB3 | Settings read, write and history; crisis line re-stamp bug listed (edge AE68) |
| lib/settings/payout-changes.ts | AD14.4 | Audit line for the payouts form |
| lib/transcript/descriptors.ts | TH6.5 | Words per minute and pause stored per transcript line; no screen asserts them |
| lib/utils.ts | no user-visible behaviour | Formatting helpers covered by every date on screen |
| lib/video.ts | TH8.1, TE39, PA16.2, AD14.9 | Private Daily rooms, meeting tokens, health check |
| lib/viewer.ts | PA11.1 | Per-tab radar viewer id. New edge PE93 |
| middleware.ts | PE32, PE33, AD1.1 | Route decisions, CSP nonce, `/ar` rewrite and `/en` redirect. New steps WB33, WB34 and edge ME113 |

### First pass, Patients (190 files)

<details><summary>The list</summary>

```
app/(patient)/layout.tsx
app/(patient)/error.tsx
app/(patient)/loading.tsx
app/(patient)/not-found.tsx
app/(patient)/patient/page.tsx
app/(patient)/patient/account/page.tsx
app/(patient)/patient/account/actions.ts
app/(patient)/patient/assessments/page.tsx
app/(patient)/patient/assessments/[id]/page.tsx
app/(patient)/patient/assessments/actions.ts
app/(patient)/patient/benefit/page.tsx
app/(patient)/patient/benefit/actions.ts
app/(patient)/patient/billing/page.tsx
app/(patient)/patient/billing/receipt/[id]/page.tsx
app/(patient)/patient/browse/page.tsx
app/(patient)/patient/claim/page.tsx
app/(patient)/patient/claim/actions.ts
app/(patient)/patient/claim/challenge-actions.ts
app/(patient)/patient/consent/page.tsx
app/(patient)/patient/consent/actions.ts
app/(patient)/patient/forgot-password/page.tsx
app/(patient)/patient/homework/page.tsx
app/(patient)/patient/homework/actions.ts
app/(patient)/patient/invite/[token]/page.tsx
app/(patient)/patient/journal/page.tsx
app/(patient)/patient/journal/actions.ts
app/(patient)/patient/login/page.tsx
app/(patient)/patient/messages/page.tsx
app/(patient)/patient/messages/actions.ts
app/(patient)/patient/notices/page.tsx
app/(patient)/patient/notices/actions.ts
app/(patient)/patient/profile/page.tsx
app/(patient)/patient/profile/actions.ts
app/(patient)/patient/radar/page.tsx
app/(patient)/patient/record/page.tsx
app/(patient)/patient/record/actions.ts
app/(patient)/patient/residency/page.tsx
app/(patient)/patient/residency/actions.ts
app/(patient)/patient/session-expired/route.ts
app/(patient)/patient/sessions/page.tsx
app/(patient)/patient/sessions/[id]/change/page.tsx
app/(patient)/patient/sessions/[id]/change/actions.ts
app/(patient)/patient/signup/page.tsx
app/(patient)/patient/summary/page.tsx
app/(patient)/patient/t/[id]/page.tsx
app/(patient)/sessions/[id]/recovery-actions.ts
app/pay/[token]/page.tsx
app/pay/[token]/actions.ts
app/pay/error.tsx
app/pay/loading.tsx
app/join/[token]/page.tsx
app/join/[token]/actions.ts
app/join/error.tsx
app/join/loading.tsx
app/j/[code]/page.tsx
app/j/[code]/actions.ts
app/j/[code]/error.tsx
app/j/[code]/loading.tsx
app/feedback/[token]/page.tsx
app/feedback/[token]/actions.ts
app/feedback/[token]/error.tsx
app/feedback/[token]/loading.tsx
app/welcome/[token]/page.tsx
app/welcome/[token]/actions.ts
app/welcome/[token]/error.tsx
app/welcome/[token]/loading.tsx
app/support/[token]/page.tsx
app/support/[token]/actions.ts
app/support/[token]/error.tsx
app/support/[token]/loading.tsx
app/(public)/t/[id]/page.tsx
app/(public)/t/[id]/book/actions.ts
app/(public)/[slug]/page.tsx
app/(public)/verify/page.tsx
app/(public)/verify/[code]/page.tsx
app/(public)/radar/actions.ts (bookFromRadar)
app/api/cron/[job]/route.ts (crisis, billing enrolment steps, reminders)
lib/patient-auth/actions.ts
lib/patient-auth/code-signin.ts
lib/patient-auth/email.ts
lib/patient-auth/guard.ts
lib/patient-auth/handle.ts
lib/patient-auth/reset.ts
lib/patient-auth/session.ts
lib/notify/index.ts
lib/notify/outbox.ts
lib/notify/whatsapp.ts (sendWhatsapp)
lib/notify/templates.ts (templateStatus)
lib/notify/email.ts (sendNotificationEmail)
lib/mail.ts (send)
lib/data/patient-view.ts
lib/sessions/doors.ts
lib/sessions/patient-link.ts
lib/sessions/waiting.ts
lib/billing/pot.ts (benefitShortfall, payFromPot)
lib/billing/wallet.ts
lib/billing/session-owed.ts
lib/billing/manual-entry.ts
lib/billing/manual.ts (openManualPayment to livePaymentFor)
lib/billing/payment-notices.ts
lib/billing/egypt.ts
lib/billing/gateway/index.ts
app/dev/simulator.ts
lib/data/sessions.ts (resolveJoinToken, joinByToken)
lib/data/feedback.ts (feedbackContext to fileReport, releaseBrief)
lib/data/recovery.ts (recoveryDue, reassignSession credit)
lib/data/scheduling.ts (bookSlot, cancelBooking, releaseUnconfirmedBookings, reminders window)
lib/data/booking-change.ts
lib/scheduling/cancel-window.ts
lib/data/challenge.ts (openChallenges, answerSeen, answerName)
lib/data/claims.ts (bindAccountToPerson, inviteFits, redeemInvite, TTLs)
lib/data/grants.ts (decideGrant, revokeGrant, applyClaimDecision)
lib/data/portability.ts (TTLs, notices)
lib/data/phone-change.ts (requestPhoneChange, lockUntil)
lib/data/journals.ts (writeJournal, alertGrantHolders)
lib/data/assessments.ts (risk flag)
lib/assessments/risk.ts
lib/data/enrolment.ts (enrol)
lib/data/enrolment-verify.ts (TTLs, pauseUnverified)
lib/data/therapist-codes.ts (connectByCode)
lib/data/in-person.ts (sweepInPerson)
lib/data/export.ts (requestOwnExport limits)
lib/data/residency.ts (recordCrossBorderConsent)
lib/i18n/preference.ts
lib/i18n/config.ts
lib/i18n/messages.ts (English block, keys cited)
lib/rate-limit.ts (consume, simulation multiplier)
lib/routing.ts (patient routes, landing, bounce)
lib/env.ts (SIMULATION_RUNNING, liveDeployment)
lib/settings/defs.ts (rule defaults)
lib/db/schema.ts (constants cited)
scripts/age.ts (header and column selection)
components/patient/auth-form.tsx
components/patient/code-signin-form.tsx
components/patient/reset-form.tsx
components/patient/session-list.tsx
components/patient/prove-handle.tsx
components/patient/claim-challenge.tsx
components/patient/claim-flow.tsx
components/patient/keeps-access.tsx
components/patient/invite-flow.tsx
components/patient/consent-list.tsx
components/patient/invite-therapist.tsx
components/patient/ask-history.tsx
components/patient/linked-platforms.tsx
components/patient/change-number.tsx
components/patient/email-editor.tsx
components/patient/identity-editor.tsx
components/patient/diagnosis-flag.tsx
components/patient/journal-writer.tsx
components/patient/checkin-switch.tsx
components/patient/notices.tsx
components/patient/notice-bell.tsx
components/patient/residency-notice.tsx
components/patient/export-record.tsx
components/patient/print-button.tsx
components/patient/benefit-form.tsx
components/patient/benefit-note.tsx
components/patient/connect-code-form.tsx
components/patient/chrome.tsx
components/patient/sos-orb.tsx
components/patient/sos-orb-server.tsx
components/patient/session-orb.tsx
components/patient/session-started.tsx
components/patient/bottom-nav.tsx
components/patient/back.tsx
components/patient/route-error.tsx
components/patient/route-not-found.tsx
components/patient/therapist-card.tsx
components/patient/explore-rail.tsx
components/patient/category-grid.tsx
components/settings/language-setting.tsx
components/i18n/language-switch.tsx
components/documents/own-profile-panel.tsx
components/homework/patient-steps.tsx
components/assessments/patient-questionnaire.tsx
components/support/ticket-reader.tsx
components/auth/welcome-form.tsx
components/radar/therapist-page.tsx
components/radar/radar-console.tsx
components/radar/booking-sheet.tsx
components/scheduling/booking-calendar.tsx
components/pay/pay-flow.tsx
components/billing/payment-popup.tsx
components/billing/pay-by-transfer.tsx
components/join/join-flow.tsx
components/join/patient-room.tsx
components/join/consent-controls.tsx
components/session/no-show-recovery.tsx
components/feedback/rating-form.tsx
```

</details>

### First pass, Therapists (188 files)

<details><summary>The list</summary>

```
lib/nav/clinician.ts
app/(app)/layout.tsx
app/(auth)/layout.tsx
app/(auth)/signup/page.tsx
app/(auth)/login/page.tsx
app/(auth)/forgot-password/page.tsx
app/(auth)/reset-password/page.tsx
components/auth/forms.tsx
lib/auth/actions.ts
lib/auth/guard.ts
lib/auth/org-account.ts
app/(app)/onboarding/page.tsx
app/(app)/onboarding/actions.ts
components/onboarding/verification-form.tsx
components/onboarding/licence-change-form.tsx
lib/data/verification.ts
lib/data/licence-expiry.ts
lib/licence.ts
app/(admin)/admin/actions.ts
app/api/cron/[job]/route.ts
app/(app)/dashboard/page.tsx
app/(app)/sessions/page.tsx
app/(app)/sessions/new/page.tsx
components/session/new-session-form.tsx
app/(app)/sessions/actions.ts
lib/session-finish.ts
lib/data/sessions.ts
lib/billing/service.ts
lib/billing/plans.ts
lib/ai/notes.ts
app/(app)/sessions/[id]/page.tsx
app/(app)/sessions/[id]/actions.ts
app/(app)/sessions/[id]/collect/page.tsx
components/session/collect-payment.tsx
components/session/session-approval.tsx
components/session/cancel-session.tsx
components/session/note-review.tsx
components/session/source-panel.tsx
components/session/voices-panel.tsx
components/session/note-formats.tsx
components/session/ask-panel.tsx
components/session/copilot-toasts.tsx
components/session/session-clock-bar.tsx
components/session/no-show-recovery.tsx
components/clinical/attribute-transcript.tsx
lib/notes/formats.ts
app/(room)/layout.tsx
app/(room)/sessions/[id]/room/page.tsx
components/session/session-room.tsx
app/api/sessions/[id]/transcribe/route.ts
app/api/sessions/[id]/state/route.ts
lib/session-clock.ts
lib/sessions/may-record.ts
lib/sessions/started-notice.ts
lib/settings/defs.ts
lib/data/transcript.ts
lib/crisis/alerts.ts
lib/data/recovery.ts
scripts/demo-full.mts
scripts/shoot-room.ts
scripts/walkthrough.ts
scripts/age.ts
app/(app)/patients/page.tsx
app/(app)/patients/actions.ts
app/(app)/patients/[id]/page.tsx
app/(app)/patients/[id]/documents/page.tsx
app/(app)/patients/[id]/documents/actions.ts
app/(app)/patients/[id]/evidence/page.tsx
app/(app)/patients/[id]/evidence/actions.ts
app/(app)/patients/[id]/homework/actions.ts
app/(app)/patients/[id]/assessments/actions.ts
app/(app)/patients/import/page.tsx
app/(app)/patients/import/actions.ts
lib/data/patients.ts
lib/data/session-invite.ts
lib/data/homework.ts
lib/data/assessments.ts
lib/data/patient-import.ts
components/patients/add-patient.tsx
components/patients/import-patients.tsx
components/patient/invite-to-session.tsx
components/patient/patient-editor.tsx
components/patient/record-access.tsx
components/patient/access-banner.tsx
components/patient/add-to-history.tsx
components/homework/clinician-homework.tsx
components/assessments/clinician-assessments.tsx
components/documents/add-document.tsx
components/documents/diagnosis-list.tsx
components/memory/standing-profile.tsx
components/clinical/evidence-panel.tsx
app/(app)/copilot/page.tsx
app/(app)/copilot/[patientId]/page.tsx
app/(app)/copilot/actions.ts
app/(app)/copilot/live/route.ts
app/api/copilot/speak/route.ts
app/api/copilot/voice/route.ts
lib/data/copilot.ts
components/copilot/chat.tsx
app/(app)/notes/page.tsx
app/(app)/bookings/page.tsx
app/(app)/bookings/actions.ts
components/scheduling/calendar.tsx
components/scheduling/late-cancellations.tsx
components/scheduling/availability-editor.tsx
components/scheduling/booking-calendar.tsx
lib/data/scheduling.ts
lib/data/booking-change.ts
lib/data/clinician-cancel.ts
lib/data/in-person.ts
app/(app)/on-call/page.tsx
app/(app)/on-call/actions.ts
app/(app)/on-call/schedule-actions.ts
components/radar/therapist-console.tsx
components/radar/practice-form.tsx
components/radar/presence.tsx
components/radar/orb.tsx
components/radar/session-history.tsx
components/radar/feedback-card.tsx
lib/data/radar.ts
lib/data/feedback.ts
app/(app)/billing/page.tsx
app/(app)/billing/actions.ts
components/billing/plan-card.tsx
components/billing/bill-picker.tsx
lib/billing/obligations.ts
lib/billing/manual-entry.ts
lib/billing/gateway/fake.ts
lib/env.ts
app/(app)/earnings/page.tsx
app/(app)/earnings/actions.ts
components/billing/withdraw.tsx
components/billing/earnings.tsx
lib/billing/payouts.ts
lib/billing/connect.ts
app/(app)/settings/page.tsx
app/(app)/settings/actions.ts
components/settings/language-setting.tsx
components/settings/settings-forms.tsx
components/settings/payouts.tsx
components/settings/timezone-settings.tsx
components/settings/note-format-settings.tsx
lib/i18n/preference.ts
lib/i18n/messages.ts
app/actions/locale.ts
components/i18n/language-switch.tsx
components/i18n/language-corner.tsx
app/(app)/settings/codes/page.tsx
app/(app)/settings/codes/actions.ts
components/settings/wall-codes.tsx
app/(app)/settings/integrations/page.tsx
app/(app)/settings/integrations/actions.ts
components/settings/meeting-accounts.tsx
app/api/meetings/connect/[provider]/route.ts
app/(app)/settings/records/page.tsx
app/(app)/settings/records/actions.ts
components/ehr/records-panel.tsx
app/(app)/connect/page.tsx
app/(app)/connect/actions.ts
components/clinical/connect-panel.tsx
lib/data/portability.ts
app/(app)/assistant/page.tsx
app/(app)/assistant/actions.ts
components/assistant/assistant-chat.tsx
components/assistant/prefs-prompt.tsx
components/assistant/prefs-settings.tsx
app/(app)/notifications/page.tsx
app/(app)/notifications/actions.ts
app/(app)/support/page.tsx
app/(app)/support/actions.ts
components/support/therapist-support.tsx
components/support/ticket-reader.tsx
lib/data/support.ts
app/(app)/switch-principal/actions.ts
app/(public)/verify/page.tsx
app/(public)/verify/[code]/page.tsx
app/(public)/radar/page.tsx
app/(public)/integrations/page.tsx
app/(public)/integrations/[slug]/page.tsx
app/api/documents/[id]/route.ts
app/api/uploads/[id]/route.ts
app/api/uploads/[...path]/route.ts
components/join/join-flow.tsx
lib/notify/index.ts
lib/notify/outbox.ts
lib/notify/whatsapp.ts
lib/rate-limit.ts
lib/uploads.ts
```

</details>

### First pass, Clinics and companies (143 files)

<details><summary>The list</summary>

```
app/(clinic)/layout.tsx
app/(clinic)/error.tsx
app/(clinic)/loading.tsx
app/(clinic)/not-found.tsx
app/(clinic)/clinic/page.tsx
app/(clinic)/clinic/apply/actions.ts
app/(clinic)/clinic/apply/page.tsx
app/(clinic)/clinic/bills/actions.ts
app/(clinic)/clinic/bills/page.tsx
app/(clinic)/clinic/earnings/page.tsx
app/(clinic)/clinic/export/route.ts
app/(clinic)/clinic/forgot-password/actions.ts
app/(clinic)/clinic/forgot-password/page.tsx
app/(clinic)/clinic/join/[token]/actions.ts
app/(clinic)/clinic/join/[token]/page.tsx
app/(clinic)/clinic/people/actions.ts
app/(clinic)/clinic/people/page.tsx
app/(clinic)/clinic/records/actions.ts
app/(clinic)/clinic/records/page.tsx
app/(clinic)/clinic/seats/actions.ts
app/(clinic)/clinic/seats/page.tsx
app/(clinic)/clinic/set-password/actions.ts
app/(clinic)/clinic/set-password/page.tsx
app/(clinic)/clinic/sign-in/actions.ts
app/(clinic)/clinic/sign-in/page.tsx
app/(clinic)/clinic/team/actions.ts
app/(clinic)/clinic/team/page.tsx
app/(sponsor)/layout.tsx
app/(sponsor)/error.tsx
app/(sponsor)/loading.tsx
app/(sponsor)/not-found.tsx
app/(sponsor)/sponsor/page.tsx
app/(sponsor)/sponsor/apply/actions.ts
app/(sponsor)/sponsor/apply/page.tsx
app/(sponsor)/sponsor/code/actions.ts
app/(sponsor)/sponsor/code/page.tsx
app/(sponsor)/sponsor/domains/actions.ts
app/(sponsor)/sponsor/domains/page.tsx
app/(sponsor)/sponsor/domains/confirm/[id]/page.tsx
app/(sponsor)/sponsor/forgot-password/page.tsx
app/(sponsor)/sponsor/integrations/actions.ts
app/(sponsor)/sponsor/integrations/hidden.tsx
app/(sponsor)/sponsor/integrations/page.tsx
app/(sponsor)/sponsor/ledger/page.tsx
app/(sponsor)/sponsor/ledger/export/route.ts
app/(sponsor)/sponsor/people/actions.ts
app/(sponsor)/sponsor/people/page.tsx
app/(sponsor)/sponsor/pot/actions.ts
app/(sponsor)/sponsor/pot/page.tsx
app/(sponsor)/sponsor/pot/[txn]/page.tsx
app/(sponsor)/sponsor/pot/eta/[id]/route.ts
app/(sponsor)/sponsor/set-password/page.tsx
app/(sponsor)/sponsor/settings/actions.ts
app/(sponsor)/sponsor/settings/page.tsx
app/(sponsor)/sponsor/sign-in/actions.ts
app/(sponsor)/sponsor/sign-in/page.tsx
app/(sponsor)/sponsor/team/actions.ts
app/(sponsor)/sponsor/team/page.tsx
app/(admin)/admin/clinics/actions.ts
app/(admin)/admin/clinics/page.tsx (headings only)
app/(admin)/admin/sponsors/actions.ts
app/api/cron/[job]/route.ts
components/clinic/apply-form.tsx
components/clinic/chrome.tsx
components/clinic/join-form.tsx
components/clinic/password-forms.tsx
components/clinic/pay-bills.tsx
components/clinic/people-list.tsx
components/clinic/sign-in-form.tsx
components/clinic/team.tsx
components/sponsor/apply-form.tsx (controls)
components/sponsor/ask-money-back.tsx (controls)
components/sponsor/chrome.tsx (tabs and controls)
components/sponsor/code-card.tsx (controls)
components/sponsor/confirm-act.tsx (controls)
components/sponsor/confirm-domain.tsx
components/sponsor/coverage-form.tsx (controls)
components/sponsor/domain-list.tsx
components/sponsor/expiry-notice.tsx (controls)
components/sponsor/gate-settings.tsx (controls)
components/sponsor/password-forms.tsx (controls)
components/sponsor/roster-list.tsx (controls)
components/sponsor/sign-in-form.tsx (controls)
components/sponsor/staff-list.tsx (controls)
components/sponsor/tax-details.tsx (controls)
components/sponsor/team.tsx (controls)
components/sponsor/top-up-form.tsx
components/billing/seat-manager.tsx
components/billing/bill-picker.tsx (controls)
components/billing/payment-popup.tsx (controls)
components/billing/pay-by-transfer.tsx (controls and form)
components/billing/top-up-stepper.tsx (controls)
components/ehr/records-panel.tsx (controls)
lib/clinic-auth/capabilities.ts
lib/clinic-auth/guard.ts
lib/clinic-auth/session.ts
lib/clinic-auth/switch.ts
lib/clinic-auth/tokens.ts
lib/data/clinic.ts
lib/data/clinic-admin.ts
lib/data/clinic-team.ts
lib/data/clinic-export.ts
lib/sponsor-auth/guard.ts
lib/sponsor-auth/session.ts
lib/sponsor/gate.ts
lib/sponsor/domain-mailboxes.ts
lib/sponsor/password-link.ts
lib/sponsor/ledger.ts (parts)
lib/data/sponsors.ts
lib/data/sponsor-admin.ts
lib/data/sponsor-users.ts
lib/data/sponsor-domains.ts
lib/data/sponsor-email-list.ts
lib/data/sponsor-ledger.ts
lib/data/sponsor-integrations.ts (exports)
lib/data/enrolment.ts (lookupCode, enrol)
lib/data/enrolment-verify.ts (code, pauseUnverified, tellEnrolledAboutLedger)
lib/billing/seats.ts
lib/billing/service.ts (subscription, due invoices, summary, discounts, renewals, proration)
lib/billing/stripe.ts (client, invoice checkout, confirm)
lib/billing/manual-entry.ts (rails, declarePaid, ladder)
lib/billing/manual.ts (open, confirm)
lib/billing/manual-grants.ts (grantFor, subscription, pot top-up)
lib/billing/pot.ts (payFromPot, topUpPot, publishTopUp, totals)
lib/billing/pot-alerts.ts
lib/billing/pot-return.ts
lib/billing/invoice.ts (invoiceFor, topUpHistory)
lib/billing/eta/index.ts
lib/billing/eta/company.ts
lib/billing/eta/issue.ts (states, printoutFor)
lib/auth/account-links.ts
lib/auth/password.ts (validatePassword)
lib/notify/outbox.ts
lib/notify/whatsapp.ts (simulation branch)
lib/notify/email.ts (header)
lib/mail.ts (invented address branch)
lib/routing.ts (doors and open routes)
lib/rate-limit.ts (callerKey, simulation multiplier)
lib/env.ts (simulation, Stripe, ETA flags)
lib/settings/defs.ts (seat bands, sponsor settings, seatChange)
lib/i18n/messages.ts (English strings)
lib/db/schema.ts (enums, defaults, indexes)
scripts/age.ts
```

</details>

### First pass, The console (163 files)

<details><summary>The list</summary>

```
app/(admin)/layout.tsx
app/(admin)/error.tsx
app/(admin)/loading.tsx
app/(admin)/not-found.tsx
app/(admin)/admin/page.tsx
app/(admin)/admin/actions.ts
app/(admin)/admin/approval-actions.ts
app/(admin)/admin/actuals/page.tsx
app/(admin)/admin/actuals/actions.ts
app/(admin)/admin/announce/page.tsx
app/(admin)/admin/audit/page.tsx
app/(admin)/admin/benefits/page.tsx
app/(admin)/admin/benefits/actions.ts
app/(admin)/admin/checkins/page.tsx
app/(admin)/admin/checkins/actions.ts
app/(admin)/admin/clinics/page.tsx
app/(admin)/admin/clinics/actions.ts
app/(admin)/admin/content/page.tsx
app/(admin)/admin/content/[id]/page.tsx
app/(admin)/admin/errors/page.tsx
app/(admin)/admin/financial-model/page.tsx
app/(admin)/admin/financial-model/actions.ts
app/(admin)/admin/not-yours/page.tsx
app/(admin)/admin/numbers/page.tsx
app/(admin)/admin/numbers/actions.ts
app/(admin)/admin/partners/page.tsx
app/(admin)/admin/partners/actions.ts
app/(admin)/admin/patients/page.tsx
app/(admin)/admin/patients/[id]/page.tsx
app/(admin)/admin/payouts/page.tsx
app/(admin)/admin/payouts/actions.ts
app/(admin)/admin/payouts/refund-actions.ts
app/(admin)/admin/radar/page.tsx
app/(admin)/admin/radar/investigate/[id]/page.tsx
app/(admin)/admin/ratings/page.tsx
app/(admin)/admin/security/page.tsx
app/(admin)/admin/security/actions.ts
app/(admin)/admin/settings/page.tsx
app/(admin)/admin/settings/actions.ts
app/(admin)/admin/sponsors/page.tsx
app/(admin)/admin/sponsors/[id]/page.tsx
app/(admin)/admin/sponsors/actions.ts
app/(admin)/admin/strings/page.tsx
app/(admin)/admin/strings/actions.ts
app/(admin)/admin/support/page.tsx
app/(admin)/admin/support/actions.ts
app/(admin)/admin/taxonomy/page.tsx
app/(admin)/admin/team/page.tsx
app/(admin)/admin/team/actions.ts
app/(admin)/admin/therapists/page.tsx
app/(admin)/admin/therapists/[id]/page.tsx
app/(admin)/admin/transfers/page.tsx
app/(admin)/admin/transfers/actions.ts
app/(admin)/admin/transfers/exception-actions.ts
app/(admin)/admin/transfers/receipt/[id]/route.ts
app/(admin)/admin/tv/page.tsx
app/(admin)/admin/tv/actions.ts
app/(admin)/admin/tv/board-actions.ts
app/(admin)/admin/usage/page.tsx
app/(admin)/admin/usage/sessions/page.tsx
app/(admin)/admin/vault/page.tsx
app/(admin)/admin/verifications/page.tsx
app/(auth)/staff/sign-in/page.tsx
app/(auth)/staff/second-step/page.tsx
app/dev/simulator.ts
app/dev/gateway/[ref]/page.tsx
app/dev/payouts/page.tsx
app/actions/admin-currency.ts
app/api/cron/[job]/route.ts
app/api/admin/radar/route.ts
app/welcome/[token]/page.tsx
components/auth/second-step-form.tsx
components/auth/forms.tsx
components/auth/welcome-form.tsx
components/admin/verification-review.tsx
components/admin/transfer-queue.tsx
components/admin/receipt-modal.tsx
components/admin/pending-approvals.tsx
components/admin/rail-exceptions.tsx
components/admin/open-carts.tsx
components/admin/confirm-with-reason.tsx
components/admin/payout-queue.tsx
components/admin/refund-queue.tsx
components/admin/held-balances.tsx
components/admin/ledger-adjust.tsx
components/admin/vault-invoice-row.tsx
components/admin/vault-payment-row.tsx
components/admin/pot-returns.tsx
components/admin/sponsor-manager.tsx
components/admin/clinic-manager.tsx
components/admin/partner-manager.tsx
components/admin/paused-benefits.tsx
components/admin/checkins-editor.tsx
components/admin/number-queue.tsx
components/admin/support-queue.tsx
components/admin/team-manager.tsx
components/admin/second-factor-setup.tsx
components/admin/settings-editor.tsx
components/admin/rules-editor.tsx
components/admin/eta-issuer-editor.tsx
components/admin/transfer-fields-editor.tsx
components/admin/mail-check.tsx
components/admin/video-check.tsx
components/admin/announcement.tsx
components/admin/page-editor.tsx
components/admin/taxonomy-editor.tsx
components/admin/strings-editor.tsx
components/admin/radar-command.tsx
components/admin/report-queue.tsx
components/admin/clinician-row.tsx
components/admin/therapist-panel.tsx
components/admin/gate.tsx
components/admin/total-view.tsx
components/admin/board.tsx
components/admin/financial-model.tsx
components/admin/plan-tables.tsx
components/admin/payroll-editor.tsx
components/admin/bank-editor.tsx
components/admin/position-card.tsx
components/admin/competitor-editor.tsx
components/admin/actuals-table.tsx
components/admin/list-controls.tsx
lib/admin/access.ts
lib/admin/reason.ts
lib/auth/guard.ts
lib/auth/actions.ts
lib/auth/second-factor.ts
lib/auth/second-step-actions.ts
lib/auth/totp.ts
lib/auth/session.ts
lib/auth/account-links.ts
lib/auth/shared-secret.ts
lib/billing/approvals.ts
lib/billing/four-eyes.ts
lib/billing/manual.ts
lib/billing/manual-grants.ts
lib/billing/rail-exceptions.ts
lib/billing/payment-notices.ts
lib/billing/payouts.ts
lib/billing/refunds.ts
lib/billing/split-refund.ts
lib/billing/connect.ts
lib/billing/pot-return.ts
lib/billing/service.ts
lib/billing/ledger.ts
lib/billing/eta/index.ts
lib/billing/eta/issue.ts
lib/data/verification.ts
lib/data/admin.ts
lib/data/admin-team.ts
lib/data/sponsor-admin.ts
lib/data/clinic-admin.ts
lib/data/support.ts
lib/data/phone-change.ts
lib/data/radar-admin.ts
lib/console/gate.ts
lib/settings/defs.ts
lib/observability/heartbeat.ts
lib/observability/errors.ts
lib/notify/outbox.ts
lib/mail.ts
lib/i18n/messages.ts
lib/db/schema.ts
```

</details>

### First pass, Money, jobs and partners (152 files)

<details><summary>The list</summary>

```
app/api/cron/[job]/route.ts
lib/billing/ledger.ts
lib/billing/wallet.ts
lib/billing/session-owed.ts
lib/billing/pending.ts
lib/billing/available.ts
lib/billing/egypt.ts
lib/billing/egp-rates.ts
lib/billing/service.ts
lib/billing/manual.ts
lib/billing/manual-entry.ts
lib/billing/manual-grants.ts
lib/billing/pot.ts
lib/billing/pot-return.ts
lib/billing/pot-alerts.ts
lib/billing/employee-share.ts
lib/billing/split-refund.ts
lib/billing/refunds.ts
lib/billing/connect.ts
lib/billing/stripe.ts
lib/billing/payouts.ts
lib/billing/obligations.ts
lib/billing/seats.ts
lib/billing/plans.ts
lib/billing/credits.ts
lib/billing/cart.ts
lib/billing/rail-exceptions.ts
lib/billing/payment-notices.ts
lib/billing/approvals.ts
lib/billing/four-eyes.ts
lib/billing/transfer-receipt.ts
lib/billing/bill-lines.ts
lib/billing/money.ts
lib/billing/fx.ts
lib/billing/invoice.ts
lib/billing/gateway/index.ts
lib/billing/gateway/types.ts
lib/billing/gateway/session.ts
lib/billing/gateway/fake.ts
lib/billing/gateway/paymob.ts (skimmed: needs, HMAC, adapters)
lib/billing/eta/index.ts
lib/billing/eta/issue.ts
lib/billing/eta/company.ts
lib/billing/eta/types.ts
lib/billing/eta/document.ts
lib/billing/eta/serialize.ts
lib/billing/eta/fake.ts
lib/billing/eta/client.ts (skimmed)
lib/finance/assumptions.ts (header and exports)
lib/finance/benchmark.ts (header and exports)
lib/finance/beta.ts (header and exports)
lib/finance/format.ts (header and exports)
lib/finance/model.ts (header and exports)
lib/finance/physics.ts (header and exports)
lib/finance/plans.ts (header and exports)
lib/finance/scenarios.ts (header and exports)
lib/finance/store.ts
app/api/stripe/webhook/route.ts
app/api/gateway/callback/route.ts
app/api/payouts/callback/route.ts
app/api/revalidate/route.ts
app/api/partner/v1/consent/route.ts
app/api/partner/v1/sessions/route.ts
app/api/partner/v1/sessions/[ref]/media/route.ts
app/api/partner/v1/sessions/[ref]/end/route.ts
app/api/partner/v1/launch/route.ts
app/api/partner/launch/route.ts
app/api/hr/v1/employment/route.ts
app/api/radar/route.ts (limits)
app/api/radar/profile/[id]/route.ts (limits)
lib/db/schema.ts (ledger accounts and kinds, API scopes, all timestamp columns)
lib/data/recovery.ts
lib/data/sponsor-admin.ts (pot opening, enquiry)
lib/data/in-person.ts
lib/data/booking-change.ts (refund and notices)
lib/data/clinician-cancel.ts (grep)
lib/data/sessions.ts (in-person pricing, overrun sweep)
lib/data/scheduling.ts (reminders, release)
lib/data/radar.ts (sweepRadar)
lib/data/feedback.ts (sweeps)
lib/data/licence-expiry.ts
lib/data/enrolment-verify.ts (sweeps)
lib/data/sponsor-email-list.ts (sweep)
lib/data/documents.ts (extract)
lib/data/partner-admin.ts
lib/session-finish.ts
lib/crisis/alerts.ts (sweep)
lib/observability/heartbeat.ts
lib/observability/errors.ts (purge)
lib/auth/session.ts (purge)
lib/auth/account-links.ts (email link)
lib/rate-limit.ts (purge)
lib/checkins/send.ts (sweep)
lib/licence.ts (standing)
lib/settings/defs.ts (rules defaults, card fee)
lib/env.ts (billing flag)
lib/partner/billing.ts
lib/partner/usage.ts
lib/partner/keys.ts
lib/partner/route.ts
lib/partner/api.ts
lib/partner/platform.ts
lib/partner/writeback.ts
lib/partner/webhooks.ts
lib/partner/retry.ts
lib/partner/team.ts
lib/partner/launch.ts (exports, sweep)
lib/notify/index.ts
lib/notify/outbox.ts
lib/notify/email.ts
lib/notify/whatsapp.ts
lib/notify/templates.ts
lib/mail.ts
lib/i18n/message-words.ts
lib/i18n/preference.ts
lib/i18n/config.ts (locales)
lib/content/defaults.ts (pricing page)
scripts/age.ts
scripts/sim-inbox.ts
app/pay/[token]/actions.ts
app/pay/[token]/page.tsx (fee lines)
app/(admin)/admin/actions.ts (refund, release, adjust, invoice edit)
app/(admin)/admin/transfers/actions.ts
app/(admin)/admin/partners/actions.ts
app/(app)/billing/actions.ts (transfer and seats)
app/(clinic)/clinic/bills/actions.ts
app/(sponsor)/sponsor/pot/actions.ts
app/(partner)/layout.tsx
app/(partner)/partner/actions.ts
app/(partner)/partner/apply/actions.ts
app/(partner)/partner/sign-in/actions.ts
app/(partner)/partner/webhooks/actions.ts
app/(partner)/partner/team/actions.ts
app/(partner)/partner/usage/page.tsx (grep)
app/(public)/page.tsx
app/(public)/[slug]/page.tsx
app/(public)/t/[id]/page.tsx
app/(public)/t/[id]/book/actions.ts
app/(public)/radar/page.tsx
app/(public)/radar/actions.ts
app/(public)/contact/actions.ts
app/(public)/developers/page.tsx (grep)
app/(public)/for-companies/page.tsx (grep)
app/(public)/for-clinics/page.tsx (grep)
app/(public)/for-therapists/page.tsx (grep)
app/(public)/verify/page.tsx (grep)
app/(public)/integrations/page.tsx (grep)
app/j/[code]/actions.ts (grep)
app/welcome/[token]/actions.ts (grep)
app/support/[token]/actions.ts (grep)
app/join/[token]/actions.ts (grep)
app/records/[token]/route.ts (grep)
```

</details>
