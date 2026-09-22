# Verification: EXPERIENCE (id prefix UX)

What people see and where they get stuck, in every portal. Verified 2026-09-22 by reading the
code (read only; nothing executed against a database, network or npm script). Sources are the
sixteen code notes and three digests in `takeover/reading/`. MAP "Confirmed by the coordinator"
items are carried in as CONFIRMED with their MAP number and not re-verified.

---

### UX-1 · 26 of 29 notify() call sites write no in-app row (P2 kept only for its three named events)
- Verdict: CONFIRMED
- Sources: code-13 Promise evidence P2 and Suspect (verify-notices per file), code-05 Promise evidence P2, code-04 Promise evidence P2, code-03 Promise evidence P2, code-07 Promise evidence P2, SIMULATION-digest 6
- Promise: P2
- Who is hurt and how: a patient who loses or never receives the email or WhatsApp (most Egyptian patients have no email, WhatsApp is not approved) has nothing in the app for a booking confirmation, a reminder, a cancellation, a claim invitation, a claim or sign-in code, a transfer "submitted" receipt, a history answer, a consent grant, a support reply or a record export. Only the three things P2 names (invitation, payment confirmed, session started) land in the app.
- Evidence: 29 product call sites of `notify(` in app/ and lib/ (components/radar/presence.tsx:300-324 is an unrelated browser `notify` helper). Only three pass `notice:`: lib/sessions/started-notice.ts:101, lib/data/session-invite.ts:148, lib/billing/payment-notices.ts:237 (the confirmed half; the submitted send at :191 has none). The row is written only when both `to.personId` and `message.notice` are present (lib/notify/index.ts:301). Patient-facing sends with no in-app home include: app/api/cron/[job]/route.ts:530 (booking.reminder) and :580 (booking.cancelled), app/(app)/bookings/actions.ts:121 (booking.confirmed), app/(app)/patients/actions.ts:231 (claim.invite), app/(public)/t/[id]/book/actions.ts:154, app/(patient)/sessions/[id]/recovery-actions.ts:120,164, lib/data/portability.ts:348 (consent.granted), :535 (history.answered), lib/data/support.ts:549, lib/data/export.ts:1101, lib/checkins/send.ts:126. Partial patch checked: portability facts are visible on /patient/consent (grants and asks lists), so those two are PARTLY covered by a screen, not a notice. The gate `scripts/verify-notices.ts` counts per FILE (82-85), so one wired call hides unwired ones in the same file (payment-notices.ts is counted wired although :191 is not).
- Severity: S2
- Fix sketch: give every patient-facing kind a `notice` (booking.confirmed/reminder/cancelled, claim.invite, payment.submitted, support.closed, record.export, history.answered), pass `personId` where the caller has it, and change verify-notices to count per call, not per file, with a planted unwired call in a wired file as its control.
- Decision it came from: 79.1 (the seam and the ratchet, baseline 18 files) chose "a ratchet rather than a wall".

### UX-2 · /patient/notices, /patient/messages and /patient/residency have no door
- Verdict: CONFIRMED
- Sources: code-08 Broken 7, Stale 4, Stale 5, Unclaimed (c); code-03 per-file (badge function has no caller)
- Promise: P2
- Who is hurt and how: the in-app notice log P2 depends on exists, but no screen links to it, so a notice written there is seen only by someone who types the URL. The check-in opt-out screen (messages) and the cross-border consent screen (residency) are equally unreachable, so a patient cannot turn check-ins off or give or withdraw the consent the wording asks for.
- Evidence: grep of app, components, lib for `patient/notices`, `patient/messages`, `patient/residency` finds only each route's own files and the component that imports its action (components/patient/notices.tsx:5, checkin-switch.tsx:5, residency-notice.tsx:6). `noticesFor` has one caller, app/(patient)/patient/notices/page.tsx:40. No href to any of the three in components/patient/bottom-nav.tsx, app/(patient)/patient/page.tsx or account/page.tsx. The comments that claim a door are stale: messages/page.tsx:39 ("reached from the account screen"), notices/page.tsx:33 ("main view").
- Severity: S2
- Fix sketch: a bell or "Messages" row on /patient home and /patient/account linking /patient/notices with an unread count; links to /patient/messages and /patient/residency from /patient/account. Prove with verify:surfaces `unlinkedPages` (it should already flag these; check why it does not).
- Decision it came from: 79.1 built the log; nobody added the door.

### UX-3 · Cross-border consent is recorded and read by nothing
- Verdict: CONFIRMED
- Sources: code-03 Suspect (residency), code-10 Unclaimed (c), code-08 Suspect 16, code-01 Unclaimed
- Promise: none (C118 data residency; legal)
- Who is hurt and how: an Egyptian patient is told "You can withdraw at any time", but agreeing, never agreeing and withdrawing all change nothing: their record is served from the US either way. And the page that asks is unreachable (UX-2), so almost nobody is asked.
- Evidence: `cross_border_consents` is read only by `residencyFor` (lib/data/residency.ts:111-121) for the residency page itself; grep of app, lib, components finds no session, note, upload or AI path that reads it. lib/data/residency.ts:20-25 states the ruling that makes this defensible only "because the people it affects are told ... and agree". Also app/(patient)/patient/residency/actions.ts:21 falls back to locale "en" on error, so the stored record of which language was read can be wrong.
- Severity: S1 (legal: a consent record with no mechanism behind it)
- Fix sketch: decide with counsel whether processing waits for consent; if so, gate session creation and uploads for an `eg` person on a live consent row, and link the page (UX-2). Drop the "en" fallback (refuse instead).
- Decision it came from: C118 / PLAN 30.3 "build the seam, point Egypt at the US instance, ship".

### UX-4 · Phone change: the code screen does not exist, and the request then blocks every retry
- Verdict: CONFIRMED
- Sources: code-03 Broken (phone change dead end), code-03 Promise evidence P2
- Promise: P2 (refusal told nowhere); none directly
- Who is hurt and how: a patient who asks to move their account to a new number is sent a code "Enter it in the app", and there is no place in the app to enter it. Their request sits forever; any new request is refused with "You already have a change in progress. A person is looking at it." If staff refuse it, the patient is never told why.
- Evidence: `completeChange` (lib/data/phone-change.ts:299) has no caller in app/, components/ or lib/. The code is sent to the NEW phone only, `email: null` (phone-change.ts:277-286), so with WhatsApp not configured (lib/notify/index.ts skips whatsapp when `!whatsappConfigured()`) it reaches no channel at all. `changeHistory` (:371) and `refusedReason` have no reader outside this file; /patient/account shows only `lockUntil` (account/page.tsx:13).
- Severity: S2
- Fix sketch: a code field on /patient/account while a request is `verifying`, calling a server action around `completeChange`; show `changeHistory` (status and refusal reason) on the same card; send the code to the account's current email as well until WhatsApp is live.
- Decision it came from: sprint 20 (20.16, 20.17) built the staff half.

### UX-5 · A support ticket moved to WhatsApp can never be closed; the console cannot open a ticket
- Verdict: CONFIRMED
- Sources: code-03 Broken (WhatsApp ticket), code-09 Broken 8, code-03 per-file (support reply only by link)
- Promise: P2 (reply reachable only by emailed link); A5 (audited read has no door)
- Who is hurt and how: once staff press "Moved to WhatsApp", the ticket stays open and overdue forever and the person never gets the link to the reply. Separately, staff are asked to write "what was done" and close tickets they have no control to read.
- Evidence: `closeTicket` refuses while `whatsappSummary` is under 20 characters (lib/data/support.ts:512-517), and the DB CHECK `support_tickets_whatsapp_summarised` refuses it too (drizzle/0049_back_office.sql:56-63). Nothing writes `whatsapp_summary` (grep of .ts/.tsx/.sql: schema, the read and the CHECK only). The close form has only `summary` (components/admin/support-queue.tsx:274-283). The admin `openTicket` (app/(admin)/admin/support/actions.ts:46) has no caller; the only `openTicket` used is the public reader's (app/support/[token]/actions.ts:25).
- Severity: S2
- Fix sketch: when `movedToWhatsapp`, render a "What was agreed on WhatsApp" textarea in the close form and write it in `closeTicket` before the status change; wire an "Open" control to `openTicket`. Proof: verify-sprint20 closes a moved ticket through the action.
- Decision it came from: 20.21 (the rule was added at the DB and service; the input was not).

### UX-6 · A work-email benefit code can never be reissued; the screen tells the person to do something impossible
- Verdict: CONFIRMED
- Sources: code-02 Broken 7
- Promise: E5-adjacent (covered person pays or is stuck); C247
- Who is hurt and how: an employee whose code expired (30 minutes), bounced or went to a mistyped address is stuck on "Waiting for the code you were sent" with no resend. A paused employee is told "Enter your work address again and we will send a new code", and doing so fails with "That could not be activated." Their benefit funds nothing and nobody is told.
- Evidence: `sendEnrolmentCode` has one caller, `enrol` (lib/data/enrolment.ts:482-483). benefit/actions.ts exports checkCode, activateBenefit, confirmCode, choosePrimary, askAboutEmployer, no resend. The row card offers only a code field (components/patient/benefit-form.tsx:125-155) under `benefit.resendPrompt` (lib/i18n/messages.ts:1426). Re-entering the address inserts a second enrolment with the same `identifier_hash`, refused by `enrolments_identifier_unique` (drizzle/0072_corporate.sql:195) and the global index (0085), caught as the generic message (enrolment.ts:~455). An unverified row is not paused, so it is not in the operator's `pausedBenefits` queue (enrolment-verify.ts:341-363) until the sponsor's cycle rolls.
- Severity: S2
- Fix sketch: a `resendCode(enrolmentId, address)` action that checks `hashIdentifier(sponsor, address) === row.identifierHash` and calls `sendEnrolmentCode`; render an address field beside the code field. Proof: a verifier that lets a code expire and reissues it.
- Decision it came from: 53.18b / 53.19 (the plaintext address is never stored, so resending needs it retyped; the retype path was not built).

### UX-7 · Clinician note screen says "Writing your note" forever for a session with no note coming
- Verdict: CONFIRMED
- Sources: code-10 Broken 11
- Promise: T1, P3
- Who is hurt and how: a clinician opening a cancelled or no-show session (or one whose generation was never started) reads "Writing your note. Usually under half a minute." for ever, with no retry button.
- Evidence: components/session/note-review.tsx:110 shows the writing card when `!note && noteStatus !== "failed"`, which includes `noteStatus === "none"` (the default, lib/db/schema.ts:894-897); the poll runs only for `generating` (:99). The session page renders NoteReview for every non-live status (app/(app)/sessions/[id]/page.tsx:66, 238-252), i.e. cancelled and no-show included; only `endSession`/`autoEndSession` set `generating` (lib/data/sessions.ts:518, 609).
- Severity: S3
- Fix sketch: show "writing" only for `generating`; for `none` on a cancelled or no-show session show nothing, and for `none` on a completed one show the failed card with "Write it now". Check: render NoteReview with noteStatus "none".
- Decision it came from: none visible.

### UX-8 · Patient session list says "Your therapist is still writing your summary" for cancelled sessions
- Verdict: CONFIRMED
- Sources: code-03 Suspect (sessionsForPatient)
- Promise: P3
- Who is hurt and how: a patient whose session was cancelled, swept or missed sees, under it, that their therapist is still writing the summary of a session that never happened.
- Evidence: `sessionsForPatient` (lib/data/patient-view.ts:88-125) selects no `status` and filters none; `briefPending: !signed && at.getTime() < now` (:149); components/patient/session-list.tsx:144-149 renders `psessions.writing` (messages.ts:883).
- Severity: S3
- Fix sketch: select `sessions.status`; `briefPending` only for `completed`; label cancelled and no-show rows.
- Decision it came from: none visible.

### UX-9 · P1: the shortest path from the app to a session is at least five taps plus typing, and a paid one cannot finish at all
- Verdict: CONFIRMED (the exact count needs the walk; the floor is readable in code)
- Sources: code-08 Promise evidence P1, code-10 Promise evidence P1, code-11 Promise evidence P1
- Promise: P1
- Who is hurt and how: a signed-in patient who wants somebody now taps the radar banner, picks a clinician, types a first name (the sheet never uses the name we already hold), taps Start, then answers the recording question and taps again before the room. For a paid clinician in Egypt the Start button leads to a bank transfer that an operator must confirm by hand, so "now" is hours.
- Evidence: home banner links /patient/radar only when somebody is live (app/(patient)/patient/page.tsx:210-227); /patient/radar renders RadarConsole (app/(patient)/patient/radar/page.tsx); the sheet requires a typed `name` with no default and an email field (components/radar/booking-sheet.tsx:313-330), then redirects to `payUrl` or `joinUrl` (:139-140); /join puts `ConsentGate` (a choice plus a submit button) before the room for radar arrivals (components/join/join-flow.tsx:190-201, 413-431). The radar books a signed-in patient as a guest (code-08 Handled 1), which is why the name is asked. When nobody is live the banner goes to /patient/browse instead (:228), which is a calendar, not a session.
- Severity: S2
- Fix sketch: prefill the name for a signed-in patient (or skip the field), fold the recording question into the sheet, and let the free path land in the room in three; state honestly on `/` that a paid session starts after the transfer is confirmed. The walk counts taps aloud (VALUE-STATEMENTS P1).
- Decision it came from: C-rulings putting consent on its own screen before the room (join-flow.tsx:333); the manual rail (no processor in Egypt).

### UX-10 · E5: no "ask HR" screen exists; an empty pot silently turns into an ordinary bill
- Verdict: CONFIRMED
- Sources: MAP Suspect 16, code-08 Promise evidence E5, SIMULATION-digest 1 (the "Account on hold" screen does not exist)
- Promise: E5
- Who is hurt and how: an employee whose company pot is empty is simply asked to pay the full price, with no sentence saying their benefit could not pay or who to ask. The company is alerted; the employee is not.
- Evidence: `payFromPot` returns `{ paid: false, reason: "insufficient" }` and alerts only the sponsor (lib/billing/pot.ts:408-441). Every caller still discards the return: lib/data/sessions.ts:279-280, lib/data/scheduling.ts:539-540, app/join/[token]/actions.ts:192-193. No message key for an employee-facing empty pot exists (grep of lib/i18n/messages.ts for "HR", "hold", "pot": only sponsor-side and design keys such as `dpo.whenPotEmpty`, a mockup label). The benefit page has no empty-pot state (components/patient/benefit-form.tsx:100-155). The pay page shows `pay.benefitPaid` only when the pot paid (app/pay/[token]/page.tsx:180).
- Severity: S2
- Fix sketch: store the refusal reason on the session (or re-derive it on /pay from the enrolment and pot), and when it is `insufficient` render one sentence on /pay and /patient/benefit: "Your employer's benefit could not cover this one. You can pay yourself, or ask HR." Proof: the `growth` position walk.
- Decision it came from: 09 CV9 specified it; never built.

### UX-11 · "Your first session is free" everywhere; the decided offer is "month 1 free"
- Verdict: PARTLY
- Sources: MAP Live-site checks (copy vs product), DOCS-digest 5.1, code-06 Suspect 16, code-08 per-file signup
- Promise: none (pricing honesty)
- Who is hurt and how: a clinician reads one free session. The code gives exactly that, so nobody is overcharged against the copy; but the founders' decided offer (a free month, then two at half price) is neither built nor stated, so whichever one the founders mean, the product or the page is wrong.
- Evidence: the code waives the first session per organisation (lib/billing/service.ts:103-133, `trial_session_used`). Copy: lib/content/defaults.ts:417, 834; lib/i18n/messages.ts:170, 456, 2611; app/(auth)/signup/page.tsx:10 (English-only metadata). No month-based discount exists in lib/billing (grep "first month", "customerAge"); DOCS-digest 1 says "Automatic free-month/50% billing: not built", discounts by hand.
- Severity: S3
- Fix sketch: founder decision. Either keep "first session free" and update FINANCIAL-PLAN, or build the age-based offer and change five strings plus the CMS rows.
- Decision it came from: FINANCIAL-PLAN "Offer (DECIDED)" versus sprint-era copy.

### UX-12 · "No per-session fee" and "we take 15% and nothing else" beside a 15% cut and per-session fees
- Verdict: PARTLY
- Sources: MAP Live-site checks, DOCS-digest 5.2, code-11 Suspect (pricing.radarBody, patientPaysNothing)
- Promise: T3-adjacent (pricing honesty)
- Who is hurt and how: a clinician on a plan reads "no per-session fee" and expects nothing off a paid session; 15% still comes off every one. A pay-as-you-go clinician reads that on the radar "we take 15% and nothing else", and the same session is also billed the platform and AI fees.
- Evidence: the cut has no tier exemption (lib/billing/connect.ts:478, lib/billing/pot.ts:457, lib/billing/manual-grants.ts:289, app/pay/[token]/actions.ts:97 all read `settings.session.platformFeeBps`, default 1500, lib/settings/defs.ts:562). Copy: lib/content/defaults.ts:48; lib/i18n/messages.ts:3345, 3722, 3738, 3798 ("no per-session fee"), 192 (`pricing.radarBody` "... and nothing else", rendered components/public/pricing-tiers.tsx:548), 3800 (`pricing.patientPaysNothing`; on the transfer rail the patient pays into our account). True in the narrow sense (the plan removes the metered $1 and $3), which is why PARTLY.
- Severity: S3
- Fix sketch: "no metered fee; 15% of what a patient pays you still applies" on the plan strings; "and the session fee" on radarBody for PAYG. Add these phrases to lib/content/honesty.ts refusals.
- Decision it came from: C209/C223 metered pricing plus the separate 15% cut (C1).

### UX-13 · "No seat fee" printed under per-seat prices on the pricing page
- Verdict: CONFIRMED
- Sources: code-11 Broken (pricing-tiers noFees), MAP Live-site checks, H27 shape
- Promise: C3 (priced per seat)
- Who is hurt and how: a practice owner reads "No seat fee, no setup fee, no minimum" a few hundred pixels below "$72 a seat, a month", and cannot tell which is true.
- Evidence: components/public/pricing-tiers.tsx:539 renders `pricing.noFees` (lib/i18n/messages.ts:187-188) and :384 `pricing.freeBody` (:170); the same component prices seats at :307, :344 (`pr2.seatFrom`, messages.ts:3346) and :531 (`pricing.seatsStep`). Also `ft.costBody` on /for-therapists (messages.ts:456). Arabic copies say the same.
- Severity: S3
- Fix sketch: "Solo: no seat fee, no minimum" or drop the clause; put "no seat fee" in the honesty refusals when a seat band exists.
- Decision it came from: copy written before the clinic plan (H27 pattern).

### UX-14 · One price labelled "30 minutes" and "One hour" on the same therapist page
- Verdict: CONFIRMED
- Sources: code-11 Broken (therapist-page / public-profile), code-06 Suspect 14 (50-minute fixtures)
- Promise: E3 (price shown is price owed)
- Who is hurt and how: a patient on a therapist's public page sees "30 minutes, starting now $40" in the card and "One hour $40" in the price row under it, and cannot tell what they are buying.
- Evidence: components/radar/public-profile.tsx:131-135 (`radar.thirtyMinutes`, messages.ts:1156) and components/radar/therapist-page.tsx:128-129 (`radar.oneHour`, messages.ts:1158), same `sessionRateCents`. `tpay.rateLabel` tells the clinician the rate is for 30 minutes (messages.ts:2679); lib/marketing/fixtures.ts:263-265 prices 50 minutes. The profile also prints `$${(cents/100).toFixed(0)}` and "Free" as literals (public-profile.tsx:133), and the booking sheet "Pay $X and start now", "Start now", "Connecting…", "Free" (booking-sheet.tsx:53-56, 309), all English and all dollars whatever the clinician's rate currency.
- Severity: S2
- Fix sketch: one duration per product (radar session vs calendar hour) with its own price field, or one label; route every figure through `PriceTag`/`t()`.
- Decision it came from: 16.4 (USD with EGP toggle); radar 30-minute rulings versus calendar hours.

### UX-15 · Arabic clinician calendar says bookable hours are OFF the radar; English says ON it
- Verdict: CONFIRMED
- Sources: code-06 Broken 8
- Promise: none (C1-adjacent)
- Who is hurt and how: an Arabic-reading clinician is told the opposite of an English-reading one about where their opened hours appear.
- Evidence: lib/i18n/messages.ts:2379 "on your profile and the radar"; :5713 "على ملفك وخارج الرادار" ("on your profile and outside the radar"). Rendered at app/(app)/bookings/page.tsx:62.
- Severity: S3
- Fix sketch: decide which is true (the radar is "now"; calendar hours show on the profile), then make both say it. A parity check that back-translates flagged keys would catch the class.
- Decision it came from: none; translation defect.

### UX-16 · The join screen tells three consent stories, and none is what happens
- Verdict: CONFIRMED
- Sources: code-06 Broken 7, code-10 Stale 1, code-10 Broken 19, MAP Confirmed 4
- Promise: T2, P3-adjacent
- Who is hurt and how: inside the session a patient reads "You can change these at any time during the session" and, under it, "Recording cannot stop part-way", while a Stop button sits in the strip above; the new-session form told the clinician the patient "Can stop it at any point". The truth (MAP Confirmed 4) is that the Stop button changes a column the room never reads, so recording continues.
- Evidence: components/join/consent-controls.tsx:56 (`jconsent.changeAnyTime`) and :88-90 (`jconsent.cannotUndo`, rendered `text-[11px] text-white/40`), both inside PatientRoom (components/join/patient-room.tsx:272); the Stop button at patient-room.tsx:343-357; components/session/new-session-form.tsx:222 (`portal.new.consentStop`, messages.ts:2014). The strip then latches "stopped" (patient-room.tsx:309-313) while the minimised orb follows the poll (code-10 Broken 19).
- Severity: S1 (a person is told something false about being recorded)
- Fix sketch: after MAP Confirmed 4 is fixed server side, one sentence: "You can stop recording at any time; what was already said stays in the transcript." Delete `jconsent.cannotUndo`; drive the strip from the poll.
- Decision it came from: 48.10 added Stop; the older one-way wording (consent-controls.tsx:12-18) was not retired.

### UX-17 · The no-show refund message promises a card refund to people who paid by transfer or by their employer
- Verdict: CONFIRMED
- Sources: code-10 Broken 5, code-10 Suspect 10
- Promise: A1/A3 family (money copy), P2
- Who is hurt and how: a patient whose clinician did not come taps "They did not join" and reads "Your payment has been refunded ... The refund reaches your card in a few days." A patient who paid by bank transfer gets nothing back; a covered patient's employer is refunded instead; a patient on a deployment without Stripe gets nothing.
- Evidence: the sentence is unconditional (components/feedback/rating-form.tsx:463-467, English literal). The action swallows every refund failure (app/feedback/[token]/actions.ts:96-108). `refundSessionPayment` returns early when Stripe is not configured (lib/billing/connect.ts:961-962), routes a pot row to the pot (:986-989), and refuses a row with no Stripe intent (:991-993), which is every transfer-rail row (inserted by lib/billing/manual-grants.ts:301). The audit names the therapist as the refunding admin (actions.ts:103).
- Severity: S2
- Fix sketch: return the refund outcome from the action and word the message by rail: card refunded, "we will return your transfer; an operator will contact you" (and create that work item), or "your benefit has been credited". Record the patient's own share for a covered session.
- Decision it came from: the self-service no-show refund predates the manual rail.

### UX-18 · Patient billing says "Covered. There is nothing for you to pay." for a partly covered session
- Verdict: CONFIRMED
- Sources: code-08 Broken 6, code-08 Suspect 11
- Promise: E3, E4
- Who is hurt and how: at 10 per cent cover the patient paid 90 per cent, and their billing screen says "Covered" and "Your benefit paid for this one. There is nothing for you to pay." with no amount. For an uncovered session the three lines under the total (therapist fee, VAT, 24Therapy's share) add to more than the total, because the fee line is part of the therapist line.
- Evidence: app/(patient)/patient/billing/page.tsx:148-150 and :169-172 branch on `fundingSource === "pot"` only; `patientShareCents` is never selected (:58-80); lib/billing/pot.ts:541-559 writes `fundingSource: "pot"` with the patient's share for partial cover. Strings messages.ts:674-675. Lines at :174-184: headline is gross + VAT (:151-155), rows are gross, VAT and platform fee. The FX note " · charged at ... to the ..." is an English literal (:160-162).
- Severity: S2 (covered case), S4 (the three lines)
- Fix sketch: select `patientShareCents`; show "Covered in part: you paid X" when it is above zero; label the fee row "of which 24Therapy" and indent it.
- Decision it came from: 53.21 / C226 (covered rendering) assumed full cover.

### UX-19 · White on teal survives in the clinician earnings card and three emails; the palette gate cannot see either
- Verdict: CONFIRMED (and wider than the reader found)
- Sources: code-11 Broken (earnings.tsx:187), code-11 Suspect (verify-palette same-line blind spot), MAP Suspect 12
- Promise: none (legibility; WCAG 1.4.3)
- Who is hurt and how: the "Payout dashboard" button on the clinician's earnings card, and the main button in the session invitation email ("Pay X and join"), the rating reminder and the walk-in directions email, are white text on the brand teal: hard to read in sunlight on a phone, and failing the product's own rule.
- Evidence: measured with node from the tokens in app/globals.css (brand-500 #2ec4b6, navy-600 #091e39): white on brand-500 2.17:1; white on brand-500 under the `bg-navy-600/10` tint 2.57:1 (components/billing/earnings.tsx:114 ground, :187 `text-white`). Emails: lib/mail.ts:295, :416, :548 use `background:#2EC4B6;color:#fff` (2.17:1), while :359 and :457 correctly use navy ink. The gate matches ground and ink on the SAME line (scripts/verify-palette.ts:229-235) and reads .tsx only, so it sees neither. Related grey-thin text: the consent footnote `text-[11px] text-white/40` on the room's navy (components/join/consent-controls.tsx:88) measures 3.65-3.79:1. Focus rings: the global ring is brand-700, 5.61:1 (app/globals.css:224), so MAP Suspect 12's ring concern is HANDLED globally; two local `focus:ring-brand-500`/`teal-500` rings remain at 2.17:1 (components/join/join-flow.tsx:498, components/radar/therapist-console.tsx:650).
- Severity: S3
- Fix sketch: `text-navy-600` on earnings.tsx:187; `color:#0A2342` on the three email buttons; `text-white/70` or larger for the footnote; brand-700 on the two rings. Extend verify-palette to lib/mail.ts and to a parent-ground check (walk up to the nearest `bg-` in the JSX tree), with earnings.tsx:187 as its planted control.
- Decision it came from: the teal became brand-500 (globals.css:19); rules followed "mostly".

### UX-20 · "Go in" to a live session sits under the language switch at phone width
- Verdict: CONFIRMED (from geometry; one screenshot at 390px settles it)
- Sources: code-10 Broken 8, code-10 390px notes
- Promise: P1, P2
- Who is hurt and how: when a session goes live, the patient's red "Your session has started / Go in" strip appears at the very top of every screen, and on a phone the language pill is painted over its "Go in" button and takes the tap, so tapping "Go in" can switch the app to Arabic instead.
- Evidence: the strip is the first child of the chrome with no top offset (app/(patient)/layout.tsx:79-80; components/patient/chrome.tsx:64-65), full width at 390px (`max-w-md`), about 60px tall, "Go in" at the inline end (components/patient/session-started.tsx:47-73). `LanguageCorner` is `fixed top-0 end-0 z-50` with a `pointer-events-auto` pill of two 44px-high buttons (components/i18n/language-corner.tsx:37-41, language-switch.tsx:79-99), so it occupies roughly y 8-56px at the same end.
- Severity: S2
- Fix sketch: give the chrome a top inset equal to the pill (or put the pill in the bottom sheet on phones), and keep the strip below it. Check with a 390px screenshot of a live session.
- Decision it came from: 75.3 (switch in the same corner of every screen) and 76.17 (strip at the top).

### UX-21 · On a phone the public site has no language switch at all
- Verdict: CONFIRMED
- Sources: code-11 Broken (mobile-nav / site-chrome)
- Promise: none (launch market is Arabic-speaking and phone-first)
- Who is hurt and how: an Arabic reader whose phone browser is set to English lands on the English site and has no control to change it; the mobile menu sheet, whose own comment lists "a language switch" among its targets, does not contain one.
- Evidence: components/public/site-chrome.tsx:109-113 renders `LanguageSwitch` with `hidden sm:inline-flex`; components/public/mobile-nav.tsx has no LanguageSwitch (its header comment at 15-16 says it carries one); `LanguageCorner` is rendered by the portal, room and pay layouts only, not app/(public)/layout.tsx; the footer has no switch. Partial patch: Accept-Language picks the language on first visit (lib/i18n/server.ts:14), so a phone set to Arabic is served Arabic.
- Severity: S3
- Fix sketch: add `LanguageSwitch` as a row in the mobile sheet (and in the footer). Check at 390px.
- Decision it came from: task 154 moved the switch into the site header.

### UX-22 · Arabic text left-aligned where the code asks for "end" inside dir="rtl"
- Verdict: CONFIRMED
- Sources: code-10 Broken 13, code-10 RTL defects
- Promise: none (RTL)
- Who is hurt and how: the patient's own session summary in Arabic (on the feedback page and in the clinician's preview), and Arabic copilot suggestions in the room, are pushed to the left edge, the wrong side for Arabic.
- Evidence: components/clinical/patient-brief-card.tsx:49 and components/session/copilot-toasts.tsx:136-141 set `dir="rtl"` and `text-end` together; under rtl, end is left. Other RTL defects in the same notes, not re-checked line by line: physical `rounded-br-sm` bubble (components/copilot/chat.tsx:584), `->` arrow (import-patients.tsx:89), phone numbers in `font-mono` without `dir="ltr"` (auth-form.tsx:106-108, change-number.tsx:57), raw ISO dates on patient account, consent codes, linked platforms, partner usage, /verify (code-08 RTL summary).
- Severity: S3
- Fix sketch: `text-start` (or nothing) inside a `dir` wrapper; `dir="ltr"` on phone numbers and codes; format dates through `formatDate`.
- Decision it came from: none; per-component slips in an otherwise logical-property codebase.

### UX-23 · Hard-coded English on screens an Arabic reader sees, collected
- Verdict: CONFIRMED (sampled; the notes' lists stand)
- Sources: code-08 RTL summary, code-10 "Hard-coded English, collected", code-11 Stale (Working… literals), code-06 Broken 15, code-08 per-file (auth), code-05 Broken 14
- Promise: none (C150 locale all the way down)
- Who is hurt and how: an Arabic-reading patient or clinician meets English in the moments that matter most: the refund and report confirmations, the booking sheet's pay button, every time printed with a caveat, the sign-in notices, and every server error in every portal.
- Evidence (each opened): app/(auth)/login/page.tsx:10-17 (three notices); app/(auth)/reset-password/page.tsx:25-31; components/radar/booking-sheet.tsx:53-56 ("Connecting…", "Pay $X and start now", "Start now"), :309 ("Free"); components/radar/public-profile.tsx:133 ("Free", literal `$`); components/feedback/rating-form.tsx:463-480 (both report confirmations and headings); components/join/patient-room.tsx:738 ("Sending…", "Send"); components/patient/benefit-form.tsx:337 ("Ask"); app/(patient)/patient/billing/page.tsx:160-162 (FX line); lib/scheduling/tz.ts:184-185 (English caveat appended to an Arabic-formatted date); lib/data/enrolment.ts ("That could not be activated...") and lib/data/support.ts:501-516 (server errors, English only); lib/mail.ts:392-425 (session invitation email, English only). The i18n ratchet (H23) cannot see string literals inside ternaries (code-11 Stale), which is how most of these survived.
- Severity: S3
- Fix sketch: move each literal to messages.ts with an Arabic row; make server actions return message keys; extend the ratchet to ternary and template literals in JSX.
- Decision it came from: C150; the ratchet's syntax limit.

### UX-24 · Staff sign-in renders an empty h1 and a second h1
- Verdict: CONFIRMED
- Sources: code-10 Broken 16, code-10 Stale 3
- Promise: A5-adjacent (the staff door)
- Who is hurt and how: a screen-reader user on /staff/sign-in hears an empty heading first; the page has two top-level headings.
- Evidence: app/(auth)/staff/sign-in/page.tsx:35 `title=""`; components/auth/auth-shell.tsx:216 renders `<h1>{title}</h1>` unconditionally; components/auth/forms.tsx:132-134 renders a second h1.
- Severity: S4
- Fix sketch: pass `title={t("tauth.staffConsole")}` and make the form's heading a `p`, or render the shell h1 only when title is non-empty.
- Decision it came from: none.

### UX-25 · The SOS button cannot be opened from a keyboard, and a shaky tap can fail to open it
- Verdict: CONFIRMED
- Sources: code-10 Broken 6
- Promise: P5
- Who is hurt and how: a person in crisis using a keyboard, switch access or a screen reader presses the focused SOS button and nothing happens. A trembling finger that moves even one pixel during the tap is read as a drag, so the sheet with the crisis line does not open.
- Evidence: components/patient/sos-orb.tsx:141-166: the sheet opens only in `onPointerUp` when `dragging` is false; there is no `onClick`, so Enter or Space (which fire click, not pointer events) do nothing; any `pointermove` with the button down sets `dragging = true` (:147-150) with no distance threshold.
- Severity: S1
- Fix sketch: open on `onClick` (suppressed only after a real drag), and treat a move under about 10px as a tap. A keyboard control in verify-session-orb or an e2e press of Enter on the orb proves it.
- Decision it came from: the draggable orb (remembered side and height).

### UX-26 · The radar booking sheet, with its price and pay button, covers the SOS button, in the patient app too
- Verdict: CONFIRMED (wider than the reader found)
- Sources: code-10 Broken 7, code-10 Promise evidence P5
- Promise: P5
- Who is hurt and how: while a patient looks at a clinician's price on the radar, the crisis button is underneath a money screen. The reader thought the patient app was safe; it is not, because /patient/radar opens the same sheet.
- Evidence: components/radar/booking-sheet.tsx:170-176 portals a `fixed inset-0 z-[100]` dialog to body; the SOS orb is `z-[70]` (sos-orb.tsx:161) on /radar (app/(public)/radar/page.tsx:55) and, through the patient chrome, on /patient/radar (app/(patient)/patient/radar/page.tsx renders RadarConsole, which opens this sheet).
- Severity: S1
- Fix sketch: SOS at a z-index above every sheet (for example 110), or the sheet at 60; add a check that no `fixed` layer in radar/billing exceeds the SOS z-index.
- Decision it came from: C235 (SOS on top) was held for the chrome's own layers only.

### UX-27 · The in-room "Tell us what happened" report says "sent" and files nothing
- Verdict: CONFIRMED
- Sources: code-10 Broken 4
- Promise: P5-adjacent (safety report); A5 (on the record)
- Who is hurt and how: a patient who reports their clinician from inside the session is told it went to us; nothing is filed and nobody reads it.
- Evidence: components/join/patient-room.tsx:731-735 calls `reportSession({ token, ... })` with the room's JOIN token and sets `sent` without reading the result; `fileReport` looks the session up by `sessions.feedbackToken` (lib/data/feedback.ts:345-354), a separate secret, and returns "This link is no longer valid." The only other caller passes the feedback token (components/feedback/rating-form.tsx:458) and does show the error.
- Severity: S1
- Fix sketch: pass the feedback token into PatientRoom (join-flow already has `feedbackToken`), and show the action's error instead of "sent". A test that files a report from the room and reads the row back.
- Decision it came from: the two-token design (feedback token split from join token) was not carried into the room.

### UX-28 · Screens that say "Saved" or keep spinning whatever happened
- Verdict: CONFIRMED
- Sources: code-10 Broken 20, code-10 Broken 17
- Promise: none
- Who is hurt and how: a clinician's assistant preferences say "Saved" after a failed save; a patient's check-in switch shows the new state even when the server refused it; a document's "Read aloud" button stays disabled on "Reading…" after any server error until the page is reloaded.
- Evidence: components/assistant/prefs-settings.tsx:120-124 (`await savePrefs(...)` then `setSaved(true)` unconditionally); components/patient/checkin-switch.tsx:22-26 (optimistic, never reverts); components/documents/document-list.tsx:128-132 (`if (!response.ok) return;` leaves `speaking` true; only the catch resets it). Not re-opened: prefs-prompt.tsx:56-57, patient-room.tsx:593-594, copilot/chat.tsx:973-978.
- Severity: S3
- Fix sketch: read each action's result; reset `speaking` in a `finally`.
- Decision it came from: none.

### UX-29 · The paid session invitation email promises Stripe and a card receipt to people who can only pay by bank transfer
- Verdict: CONFIRMED
- Sources: code-05 Broken 14
- Promise: A1-adjacent (how you pay); P2
- Who is hurt and how: the first money sentence an Egyptian patient reads says "Payment is handled securely by Stripe and goes to your therapist. You will get a receipt by email." Neither is true on the transfer rail: they pay 24Therapy by bank transfer and wait for an operator.
- Evidence: lib/mail.ts:417-421, English only, with a `$` amount; called from app/(app)/sessions/actions.ts:279. Same email's button is white on teal (UX-19).
- Severity: S2
- Fix sketch: word the payment line by rail (`organizationNeedsTransfer`), in the recipient's locale.
- Decision it came from: the email predates the manual rail.

### UX-30 · A rejected bank transfer is told to nobody; a guest can never see why (carried in)
- Verdict: CONFIRMED (MAP Confirmed 7; not re-verified)
- Sources: code-04 Broken 8, code-07 Broken 4, code-09 Broken 9, code-11 Unclaimed (c), MAP Suspect 4
- Promise: A3, P2
- Who is hurt and how: a payer whose transfer is rejected sees their pending bar vanish and is sent nothing; a guest who reopens the pay link sees the bank details again with no reason, which invites a second transfer. The operator is told "they have been told why".
- Evidence: MAP Confirmed 7 (lib/billing/manual.ts:670+, manual-entry.ts:338-352, pay-by-transfer.tsx:258, app/(admin)/admin/transfers/actions.ts:72); `paymentsFor` returns [] for a `session` payer (manual.ts:431).
- Severity: S2
- Fix sketch: a `payment_rejected` notice through `notify` with the reason and a retry link; `paymentsFor` for session payers by token; correct the operator's sentence.
- Decision it came from: task 124 open.

### UX-31 · The domain proof link sends the company's IT contact to a sign-in page they cannot pass
- Verdict: CONFIRMED
- Sources: code-08 Broken 5, code-08 Stale 16
- Promise: none (sponsor onboarding; blocks E-promises for that company)
- Who is hurt and how: a company proving it owns its email domain asks its IT contact (postmaster@) to click a link; unless that person is a portal admin they land on the sponsor sign-in, so the domain is never proved and no joining code can be issued.
- Evidence: link built at lib/data/sponsor-domains.ts:112 as `/sponsor/domains/confirm/<id>?t=`; the sponsor principal's `openRoutes` is only `/sponsor/apply` (lib/routing.ts:292-300); `routeDecision` redirects any unsigned request under an owned prefix to the sign-in (:371-385), applied by middleware.ts:91. The page itself was written to need no account (app/(sponsor)/sponsor/domains/confirm/[id]/page.tsx:12-24).
- Severity: S2
- Fix sketch: add `/sponsor/domains/confirm` to the sponsor `openRoutes`; the page's HMAC token is already the authorisation. Check: an unsigned request renders the confirm page.
- Decision it came from: 61.4 / C320 built the page open; 53.4 routing shut it.

### UX-32 · No password reset in the clinic, company or partner portals
- Verdict: CONFIRMED
- Sources: code-08 Unclaimed (c)
- Promise: none
- Who is hurt and how: a practice manager, an HR contact or a partner admin who forgets their password has no "forgot password" link and no reset path; the only way back is to ask us, and the password we set was typed by an operator on a call.
- Evidence: the sign-in actions check email and password only (app/(clinic)/clinic/sign-in/actions.ts, app/(sponsor)/sponsor/sign-in/actions.ts:27-34); lib/clinic-auth, lib/sponsor-auth and lib/partner-auth hold no reset code (grep "reset"); first users are created with "a password an operator sets on the call" (app/(admin)/admin/sponsors/actions.ts:129, clinics/actions.ts:80, partners/actions.ts:58). Clinic staff passwords are typed by the clinic admin (code-08 Suspect 6).
- Severity: S2
- Fix sketch: reuse the clinician reset (token by email, rate-limited) per principal table; force a change at first sign-in for operator-set passwords.
- Decision it came from: sprints 53-55 shipped the portals with operator-created users.

### UX-33 · Patient password reset: the code may never arrive, and "Ask for another code" probably goes nowhere
- Verdict: PARTLY
- Sources: code-08 Suspect 13, code-10 Suspect 7, code-10 Unclaimed (c) (no resend on code screens)
- Promise: none
- Who is hurt and how: a phone-only patient asks for a reset code; it is recorded as WhatsApp, and WhatsApp is not switched on, so nothing is sent. The screen does warn this and offers "tell us", which is the partial patch. The "Ask for another code" link points at the page they are already on.
- Evidence: lib/patient-auth/reset.ts:141-159 (`channel = account.phone ? "whatsapp" : "email"`, notify skips WhatsApp when not configured); the warning `preset.channelDownLead` / `preset.tellUs` (lib/i18n/messages.ts:1036-1038) is the handled half. components/patient/reset-form.tsx:124-128 links `/patient/forgot-password`, the route that renders this same client component; a same-URL client navigation normally keeps `useActionState`, so the code screen stays. UNTESTABLE HERE for that last part: the walk taps the link and sees whether the handle screen returns.
- Severity: S3
- Fix sketch: a "Send another code" button that resets the form state (key the form) and a "wrong number?" way back; same on code sign-in and handle proof (components/patient/code-signin-form.tsx:49-93, prove-handle.tsx:65-85).
- Decision it came from: C43 (WhatsApp first) before the WhatsApp key existed.

### UX-34 · "Open your session" in booking emails takes a patient to the clinician sign-in
- Verdict: CONFIRMED
- Sources: code-07 Suspect 1, code-07 per-file (bookings actions)
- Promise: P2, T4-adjacent
- Who is hurt and how: a patient booked into a calendar hour gets a message whose only button, "Open your session", opens `/sessions/<id>`, which is the clinician portal; they are sent to the clinician login and have no way into their session from the message.
- Evidence: app/(app)/bookings/actions.ts:127 and app/(public)/t/[id]/book/actions.ts:160 link `${appUrl}/sessions/${id}`; the reminder cron does the same (app/api/cron/[job]/route.ts:541, per code-07). `/sessions` is a clinician prefix (lib/routing.ts:46); app/(patient)/sessions/[id]/ has only recovery-actions.ts, no page; the only page is app/(app)/sessions/[id]/page.tsx. The same id is the capability for unauthenticated recovery (MAP Confirmed 3), so this link is also the leak that makes that exploit easy.
- Severity: S2
- Fix sketch: link the join token (`/join/<token>`) or `/patient/sessions`; stop putting the session id in messages once MAP Confirmed 3 is fixed.
- Decision it came from: none visible.

### UX-35 · A clinician's journal crisis alert opens a page that does not exist
- Verdict: CONFIRMED
- Sources: code-03 Broken (journals.ts:191)
- Promise: P5-adjacent
- Who is hurt and how: a clinician who gets "X wrote something that may need a call" and taps it lands on a 404, at the moment they most need the patient's record.
- Evidence: lib/data/journals.ts:185-192 writes `actionUrl: /people/${personId}`; app/(app) has no `people` route (assistant, billing, bookings, connect, copilot, dashboard, earnings, notes, on-call, onboarding, patients, sessions, settings, support, switch-principal) and nothing rewrites `/people/`. The title and body are English literals. (The separate defect that open-ended grant holders are never alerted, journals.ts:167-172, belongs to the safety domain.)
- Severity: S1
- Fix sketch: resolve the clinician's own `patients.id` for that person and link `/patients/<id>`; a verifier that follows every `actionUrl` written by lib to an existing route.
- Decision it came from: C123 journal scanning.

### UX-36 · Every non-founder staff account lands on "Verify your practice" (A5)
- Verdict: CONFIRMED
- Sources: code-09 Broken 1, code-09 Broken 11
- Promise: A5
- Who is hurt and how: a support or operations person signs in to the staff console and is shown the clinician licence-upload screen; nothing says why, and the refusal is not recorded.
- Evidence: staff sign-in sends back-office roles to `/admin` (lib/auth/actions.ts:278-285); `/admin` is `requireRole("super_admin")` (app/(admin)/admin/page.tsx:13); `requireRole` redirects to `/dashboard` with no audit (lib/auth/guard.ts:75-78); the clinician layout sends anyone not cleared to `/onboarding` (app/(app)/layout.tsx:117-119; `isCleared` is super_admin or approved, lib/data/verification.ts:166-168); onboarding bounces only super_admin (app/(app)/onboarding/page.tsx:28). The pages staff may use (transfers, support: `requireStaff`) exist but the landing does not reach them.
- Severity: S2
- Fix sketch: send back-office roles to the first page their role allows (transfers or support); make `requireRole` in /admin redirect to that page with a one-line reason, and write an `access.refused` audit row.
- Decision it came from: A5 as written ("redirected rather than shown an error").

### UX-37 · Patient booking calendar silently shows only the first ten days with slots
- Verdict: CONFIRMED
- Sources: code-10 Broken 15
- Promise: none
- Who is hurt and how: a patient looking for a later hour sees nothing after the tenth day with openings and is not told there are more.
- Evidence: components/scheduling/booking-calendar.tsx:224 `days.slice(0, 10)` with no "more" control or sentence. The name, email and note fields on the same form are placeholder-only (:139-179, see UX-44).
- Severity: S3
- Fix sketch: a "Show later days" button or a sentence with the count left out.
- Decision it came from: none.

### UX-38 · Clinician money screens that print the wrong figure
- Verdict: CONFIRMED
- Sources: code-11 Broken (seat-manager, therapist-console, payouts)
- Promise: T3, C4
- Who is hurt and how: (a) removing seats reads "2 seats costs $144 a month, up from $216"; (b) the go-on-call screen tells a clinician "You keep" rate minus 10 per cent while 15 per cent is taken; (c) a clinician pricing in pounds reads "You keep $1,275, fee $225" for a 1,500 EGP rate.
- Evidence: (a) components/billing/seat-manager.tsx:94-98, English literal "up from" whatever the direction; (b) components/radar/therapist-console.tsx:221-223 hard-codes 1000 bps against `platformFeeBps` default 1500 (lib/settings/defs.ts:562); (c) components/settings/payouts.tsx:469-471 formats with `formatUsd` regardless of the chosen rate currency.
- Severity: S2 ((b) and (c) mislead a pricing decision), S3 (a)
- Fix sketch: "down from" when to < from; pass the fee bps from settings to the console; format with the rate's currency.
- Decision it came from: C1 moved the fee from 10% to 15%; the console kept the old number.

### UX-39 · Editing a clinic role shows the wrong ticks and saving strips its permissions
- Verdict: CONFIRMED
- Sources: code-11 Broken (clinic/team.tsx)
- Promise: none (clinic staff)
- Who is hurt and how: with one role defined, a practice admin presses Edit, sees the role's name with every permission unticked (or the old ticks), presses Save, and the role loses what it could do.
- Evidence: components/clinic/team.tsx:161-190: the form is already mounted while fewer than two roles exist; only the name Input is keyed on `editing?.id` (:170); the checkboxes use `defaultChecked` with no key (:183-187), so React does not update them when `editing` changes.
- Severity: S2
- Fix sketch: `key={editing?.id ?? "new"}` on the form element.
- Decision it came from: 63.3 (form stays mounted below two roles).

### UX-40 · The session summary is held behind a rating and an email address
- Verdict: CONFIRMED
- Sources: code-11 Suspect (feedback-card "rates you to unlock their summary"), code-10 Promise evidence P2 (summary promised by email)
- Promise: P3, P2
- Who is hurt and how: after a radar or link session the patient is asked to "Rate the session and get my summary"; the signed summary appears only after three star ratings and a typed email address. A patient with no email (most, per the code's own counts) cannot get their summary on that page.
- Evidence: components/feedback/rating-form.tsx:130-160 renders the brief only in the `done` branch; `canSubmit` requires `email.includes("@")` (:186); the room's end card says `room.rateAndGet` (messages.ts:133, components/join/join-flow.tsx:210-221); components/radar/feedback-card.tsx:56 tells clinicians patients rate "to unlock their summary". A signed-in patient also sees it on /patient/sessions (UX-8's list), which is the partial patch for account holders only.
- Severity: S2
- Fix sketch: show the signed brief first, ask for the rating after; make the email optional.
- Decision it came from: the comment at join-flow.tsx:203-208 ("their summary is behind the form").

### UX-41 · "Add an email to get your record" leads to an account page with no way to add an email
- Verdict: CONFIRMED
- Sources: code-12 Suspect 7, code-10 Unclaimed (c) (export only by email), code-10 Promise evidence P2
- Promise: P4, P2
- Who is hurt and how: a phone-only patient asks for a copy of their record, is told it goes by email only and pressed to "Add an email", and the account page it links to has no email field. They can never get their record.
- Evidence: components/patient/export-record.tsx:28-44 links `/patient/account` with `precord.addEmail` (messages.ts:640-641); app/(patient)/patient/account/page.tsx renders IdentityEditor (name, photo), ChangeNumber and links, and account/actions.ts exports only askToChangeNumber, saveOwnName, saveOwnPhoto, removeOwnPhoto; no action anywhere writes `patient_accounts.email` for an existing account (lib/patient-auth/handle.ts proves an existing handle only).
- Severity: S2
- Fix sketch: an "add email" field on /patient/account that stores it unverified and proves it with `requestHandleCode`; or an in-app download for a signed-in patient.
- Decision it came from: C128 (export by email only, never WhatsApp).

### UX-42 · Copy that contradicts T2: "We can look at the session record, including any period the recording was paused"
- Verdict: CONFIRMED (as a contradiction; which half is true depends on MAP Confirmed 4)
- Sources: code-10 Suspect 9
- Promise: T2
- Who is hurt and how: a patient reporting abuse is told staff can see the paused periods, which either tells them their off-record minute was kept (true today for the patient's own Stop, MAP Confirmed 4) or overclaims (false for the clinician's toggle, which uploads nothing). Either way it contradicts "nothing in that minute is kept".
- Evidence: components/feedback/rating-form.tsx:479-480 (English literal); T2 on `/`.
- Severity: S3
- Fix sketch: after the recording fix, say "We can see when the recording was paused, not what was said."
- Decision it came from: none.

### UX-43 · Arabic contact page prints an admin instruction as the company address; the competitor table quotes different rival prices in each language
- Verdict: PARTLY (true of the shipped defaults; the live page is CMS data)
- Sources: code-06 Broken 9, code-06 Broken 10
- Promise: none (published copy)
- Who is hurt and how: an Arabic visitor to the contact page may read "Set the registered address from admin, content, contact" as our address; the same competitor is "about $69" in English and "from $59" in Arabic under one checked-on date.
- Evidence: lib/content/defaults-ar.ts:794, 802 (instruction) versus lib/content/defaults.ts:992, 1001 (empty, so hidden); rendered by components/public/blocks.tsx:859-865 when `address` is non-empty. Prices: defaults.ts:82 versus defaults-ar.ts:82 (TherapyNotes), and :120, :158. UNTESTABLE HERE for the live page: fetch `/ar/contact` and `/ar` comparison block from 24therapy.app (H28, the live wording is published rows).
- Severity: S3
- Fix sketch: empty the Arabic address defaults; generate both tables from one price list.
- Decision it came from: translation of defaults.

### UX-44 · Controls with no accessible name
- Verdict: CONFIRMED (for the ones listed; a scan, not an audit)
- Sources: brief item "unlabelled controls" (no single reader entry; code-11 and code-10 390px notes)
- Promise: none (WCAG 1.3.1, 4.1.2)
- Who is hurt and how: a screen-reader user hears "edit text" with no name on the booking form, the abuse report box, the in-room report, the benefit domain box, the claim-challenge name box and the patient's lock-out reason; the phone-change and payout-withdraw fields have visible labels that are not tied to their inputs.
- Evidence (scripted scan of app/ and components/, then each opened): placeholder-only fields at components/scheduling/booking-calendar.tsx:139, 145, 173; components/feedback/rating-form.tsx:484, 492; components/join/patient-room.tsx:720; components/patient/benefit-form.tsx:319; components/patient/claim-challenge.tsx:116; components/patient/record-access.tsx:125, 183. `Field` renders `<label htmlFor={htmlFor}>` as a sibling (components/ui/index.tsx:98-103), so a Field without `htmlFor` labels nothing: components/patient/change-number.tsx (2 fields), components/billing/withdraw.tsx (4), components/admin/transfer-fields-editor.tsx (2), components/public/contact-form.tsx (1 of 6). Icon-only button with no name: components/admin/total-view.tsx:486 (search). Checked and fine: every `Logo` link (default title, components/brand/logo.tsx:91, 118-123), the SOS orb (`crisis.orbLabel`), the language switch group.
- Severity: S3
- Fix sketch: an `id` plus `htmlFor` (or `aria-label={t(...)}`) on each; make `Field` generate an id with `useId` and clone it onto its child so the class cannot recur; add a verifier that fails on an input with only a placeholder.
- Decision it came from: none.

### UX-45 · Check-ins say "Reply with the word stop and they end"; replies go nowhere and the opt-out screen has no door
- Verdict: CONFIRMED
- Sources: code-05 Broken 2, code-05 Broken 11, code-08 Broken 7
- Promise: P2-adjacent; the lifecycle has no way out
- Who is hurt and how: a person who replies "stop" keeps getting unprompted check-ins (the no-repeat rule is also broken, so the same message repeats); the only other way to stop them, /patient/messages, is linked from nowhere (UX-2). (The crisis half, a reply like "I want to die" reaching nobody, is for the safety domain.)
- Evidence: `handleReply` (lib/checkins/receive.ts:59) has no caller in app/ or lib/ and there is no inbound email or WhatsApp route under app/api (admin, copilot, cron, documents, ehr, hr, meetings, partner, patient, radar, revalidate, sessions, stripe, uploads); the cron still sends (per code-05, app/api/cron/[job]/route.ts:346) with `howToStop` appended (lib/checkins/send.ts:124). `lastBody` includes the appended opt-out, so `wording.ts:68` never matches (code-05 Broken 11, not re-run).
- Severity: S2
- Fix sketch: until an inbound route exists, replace "reply stop" with a link to /patient/messages (and link that page from the account screen), or stop sending.
- Decision it came from: 44.1 / C97.

### UX-46 · "Go in now" for a booked clinician sits under a sound prompt that cannot be closed while the booking rings
- Verdict: CONFIRMED
- Sources: code-07 Broken 3
- Promise: P1 (the clinician's half of "somebody now")
- Who is hurt and how: a clinician whose browser blocked sound gets a full-screen prompt the moment a patient books; its only button ("I will fix it") does nothing while the booking rings, and the "Go in now" card is underneath. The patient waits, and the no-show sweep then counts it against the clinician (task 122).
- Evidence: components/radar/presence.tsx:620 `fixed inset-0 z-[200]`; `forced={ringing}` (:424); when `sound === "blocked"` only the close button renders (:655-675) and `close` sets `dismissed`, but the guard is `if (dismissed && !forced) return null` (:615), so a forced prompt stays. The booking card is `z-[60]` (code-07: :454, :516).
- Severity: S2
- Fix sketch: when blocked, let close hide it even while forced, and render the "Go in now" button inside the prompt itself.
- Decision it came from: "An unarmed alarm during an actual booking is not a suggestion" (:423).

### UX-47 · A risk suggestion in the room can be pushed out of sight by newer suggestions
- Verdict: CONFIRMED
- Sources: code-10 Broken 9
- Promise: P5-adjacent (clinician side)
- Who is hurt and how: the card saying the patient said something about harm is meant to stay until dismissed; three newer suggestions hide it and six delete it, mid-session.
- Evidence: components/session/copilot-toasts.tsx:26-30 (risk "does not expire"); `mergeToasts` puts new cards first and truncates to `MAX_VISIBLE * 2` (:183); only `MAX_VISIBLE` render (:69), with no pinning of `risk`.
- Severity: S2
- Fix sketch: sort risk cards first and exclude them from truncation.
- Decision it came from: the MAX_VISIBLE rule without the risk exception it names.

### UX-48 · Green "paid" banner on clinician billing whether or not the payment was confirmed
- Verdict: CONFIRMED
- Sources: code-07 Suspect 4
- Promise: A1-adjacent (nothing granted before confirmation; here nothing is granted, but the screen says paid)
- Who is hurt and how: any return to /billing with `?checkout=<anything>` shows "paid" even when `confirmCheckout` returned false (no Stripe client, unknown or unpaid checkout).
- Evidence: app/(app)/billing/page.tsx:41-43 ignores the boolean from `confirmCheckout` (lib/billing/stripe.ts returns false at :574, :581); the banner at :127-131 keys on the query string only.
- Severity: S3
- Fix sketch: render the banner from the returned value (and from the subscription row), not the URL.
- Decision it came from: confirm-on-redirect for preview environments.

### UX-49 · The patient's session orb can point at a dead session for ever
- Verdict: CONFIRMED
- Sources: code-03 Suspect (openSessionForPatient no time bound)
- Promise: P2 (orb while a door is open)
- Who is hurt and how: a scheduled session that nobody attended (paid or free, never started) keeps an orb on every patient screen, "ready" or "owes", linking to its join page, weeks later; and when two are open it shows the most recently created, not the next one.
- Evidence: lib/data/patient-view.ts:208-243 filters status `scheduled | in_progress`, `endedAt IS NULL`, join token present, with no time bound and no check of `joinTokenExpiresAt`, ordered by `createdAt desc`. The sweeps that cancel sessions (lib/data/radar.ts:1225, scheduling.ts:786, sessions.ts:668) cover unpaid or cancelled cases only; nothing closes a paid or free scheduled session that passed unattended.
- Severity: S3
- Fix sketch: bound on `scheduledAt` (or `joinTokenExpiresAt`) and order by the soonest upcoming.
- Decision it came from: 79.3 (orb for an open session).

### UX-50 · "What they hold has been added to the record you own" when nothing was added
- Verdict: PARTLY
- Sources: code-03 Suspect (answerAsk)
- Promise: P4
- Who is hurt and how: a patient who asked a former therapist to add their history is told it was added and is in their profile. The act only flips a status. Some of that material may already be person-level (so visible), which is the partial half; notes the clinician holds are not moved.
- Evidence: lib/data/portability.ts:488-516 updates `history_asks` only; :535-549 sends the "added" sentence (English literal; the in-app version is `pask.added`, messages.ts:932).
- Severity: S3
- Fix sketch: either make "added" grant or copy something concrete, or word it "They agreed; anything they had on your shared record is already in your profile."
- Decision it came from: C108 ("a guaranteed answer").

### UX-51 · Clinician calendar publishes hours in UTC when no zone is stored
- Verdict: CONFIRMED (visible on screen, so S3)
- Sources: code-10 Broken 14
- Promise: none (scheduling)
- Who is hurt and how: a Cairo clinician with no stored zone opens 18:00 on /bookings and publishes a 21:00 appointment; /on-call adopts the browser zone for the same person, so the two screens disagree.
- Evidence: app/(app)/bookings/page.tsx:66 `zone={actor.timezone ?? "UTC"}`; availability-editor adopts the browser zone (code-10: :78-81, 165). The zone is printed (calendar.tsx:196-198).
- Severity: S3
- Fix sketch: adopt and store the browser zone on first visit, as /on-call does.
- Decision it came from: none.

### UX-52 · Clinic job invitations use the patient record-claim WhatsApp template
- Verdict: PARTLY (latent until WhatsApp is approved; the email is right)
- Sources: code-08 Suspect 10
- Promise: none
- Who is hurt and how: once WhatsApp is switched on, a clinician invited to a practice would get the patient template "{{1}} has invited you to set up your 24Therapy account" with no variable filled and no link, instead of the job invitation.
- Evidence: app/(clinic)/clinic/people/actions.ts:59-67 sends `kind: "claim.invite"` with no `variables`; lib/notify/whatsapp.ts:76-83 maps `claim.invite` to `claim_invite`, one variable, no URL. No in-app notice is written (no `notice`), so there is no in-app mislabel.
- Severity: S3
- Fix sketch: a `clinic.invite` kind with its own template (or email only).
- Decision it came from: kind reused at sprint 54.

### UX-53 · Cosmetic defects on marketing and radar screens
- Verdict: CONFIRMED
- Sources: code-11 Broken (blocks company-wall, radar-console panel, world-radar), code-07 Broken 9, code-10 390px notes
- Promise: none
- Who is hurt and how: a visitor sees a company console with no tab lit and an empty pane wherever the `company-wall` demo is used; clinicians with no country are drawn in the mid-Atlantic; the clinician calendar shows counts only until a day is opened.
- Evidence: components/public/blocks.tsx:319 maps `company-wall` to `CompanyDemo initial="people"`, and CompanyConsole renders only overview/pot/code/settings (components/demo/portal-demo.tsx:520-540); lib/geo.ts:204 `project(-30, 20)` for an unknown country; components/scheduling/calendar.tsx:231-242 (per code-07). Not re-opened: radar-console.tsx:360-366 panel collapse; bottom nav at six items during a live session (bottom-nav.tsx:104-112).
- Severity: S4
- Fix sketch: add a people tab or map `company-wall` to an existing one; skip unknown countries on the map.
- Decision it came from: none.

### UX-54 · Partner portal "cannot mint an employment-verification key"
- Verdict: WRONG (the reader read stale comments)
- Sources: code-11 Broken (partner/key-list.tsx:151-192), code-11 Unclaimed (c)
- Promise: none
- Who is hurt and how: nobody. The scope was moved out of the partner portal on purpose; a partner cannot tick it because it is not offered.
- Evidence: the form lists `API_SCOPES` (components/partner/key-list.tsx:170), and `API_SCOPES` (lib/db/schema.ts:7725-7763) does not contain `employment:verify`, which is a separate sponsor list (:7765+). `mintKey`'s sponsor check was removed 2026-09-14 (lib/partner/keys.ts:94-106). What remains true is Stale: the comments at app/(partner)/partner/actions.ts:35-39 and key-list.tsx:70-75, 183, and the unused `sponsors` prop (code-08 Stale 1, code-11 Stale).
- Severity: S4 (stale comments only)
- Fix sketch: delete the stale comments and the `sponsorId` plumbing from the partner form and action.
- Decision it came from: sprint 66 ("employment:verify came home", drizzle/0097_sponsor_key.sql).

### UX-55 · "Signing discards a failed edit" in the note review
- Verdict: WRONG (unreachable today)
- Sources: code-10 Broken 12
- Promise: T1
- Who is hurt and how: nobody through this path: the only place NoteReview is rendered passes `approvals={false}`, so its sign buttons (and `handleApprove`) never render. Signing happens in SessionApproval.
- Evidence: components/session/note-review.tsx:165-169 (the defect as written); :355 and :455 hide both sign buttons when `approvals === false`; the single call site app/(app)/sessions/[id]/page.tsx:238-239 passes `approvals={false}`. UNTESTABLE HERE, a related question for the walk: with the note editor open and unsaved, press Sign in SessionApproval above it and see whether the unsaved text is lost without a warning.
- Severity: S4 (dead code)
- Fix sketch: delete `handleApprove` and the hidden buttons, or save-then-sign in SessionApproval.
- Decision it came from: 26.3 / C112 (one approval surface).

### UX-56 · Rating link falls back to the join token, which the feedback page cannot resolve
- Verdict: HANDLED
- Sources: code-10 Suspect 13
- Promise: P3
- Who is hurt and how: nobody in practice: the fallback cannot fire for a real session.
- Evidence: components/join/join-flow.tsx:217 `feedbackToken ?? token`; `sessions.feedback_token` is NOT NULL (lib/db/schema.ts:699) and every session writer sets it (lib/data/sessions.ts:257, 337; lib/data/scheduling.ts:462; lib/partner/writeback.ts:121); the page passes `feedbackTokenForJoin(token)` (app/join/[token]/page.tsx:149), null only for a token shorter than 16 characters or an unknown one.
- Severity: S4
- Fix sketch: drop the fallback (link nowhere rather than to a wrong page).
- Decision it came from: the two-token design.

### UX-57 · Money layers inside the patient chrome stay under the SOS button
- Verdict: HANDLED (except the radar sheet, UX-26)
- Sources: code-10 Looks handled 4, 5, 6; code-11 Suspect (payment-popup z-60)
- Promise: P5
- Who is hurt and how: nobody on these layers: the session orb, the payment orb, the leave sheet and the minimised room all sit below the SOS orb.
- Evidence: SOS `z-[70]` (components/patient/sos-orb.tsx:161); session orb `z-[60]` (components/patient/session-orb.tsx:63); payment orb `z-[60]` (components/billing/payment-popup.tsx:305, on /pay, outside the chrome); leave sheet `z-[60]` (components/patient/bottom-nav.tsx:150); minimised room `z-[65]` (components/join/patient-room.tsx:191). The exception is the radar booking sheet at `z-[100]` (UX-26).
- Severity: none
- Fix sketch: a verifier that fails on any `fixed` layer at or above the SOS z-index outside the crisis components.
- Decision it came from: C235.

### UX-58 · A crashed patient page keeps the SOS button
- Verdict: HANDLED (the patient group only)
- Sources: code-08 Looks handled 6, code-08 Promise evidence P5
- Promise: P5
- Who is hurt and how: nobody inside /patient; a crash there still shows SOS. Which crisis line it shows with no phone or country passed is for the safety domain (code-08 Suspect 14).
- Evidence: app/(patient)/error.tsx:5, 60 renders `<SosOrb />`. app/global-error.tsx and app/not-found.tsx do not (grep), as the note says.
- Severity: none here
- Fix sketch: render SosOrb in global-error and not-found too.
- Decision it came from: the error boundary fix recorded in code-08.

### UX-59 · The feedback page shows the patient's summary without checking it is signed
- Verdict: HANDLED (for the signed check; see the caveat)
- Sources: code-10 Looks handled 1, code-10 Suspect 2
- Promise: P3
- Who is hurt and how: nobody sees an unsigned brief here: the data layer blanks it until signed and the page says "still writing" instead.
- Evidence: lib/data/feedback.ts:155-158 passes `brief`, `briefSteps`, `briefNext` only when `signed`, and `notePending: !signed`; components/feedback/rating-form.tsx:139-144 shows `prating.stillWriting`. Caveat, not re-verified here and owned by the content domain: the same line falls back to `noteContent.summary`, the clinician-facing field, when `patientBrief` is empty (code-05 Broken 9).
- Severity: none for the signed gate
- Fix sketch: drop the `?? summary` fallback.
- Decision it came from: P3 / 47.x.

---

## Table

| Id | Title (short) | Verdict | Severity |
|---|---|---|---|
| UX-1 | 26 of 29 notify() sites write no in-app row | CONFIRMED | S2 |
| UX-2 | /patient/notices, messages, residency have no door | CONFIRMED | S2 |
| UX-3 | Cross-border consent read by nothing | CONFIRMED | S1 |
| UX-4 | Phone change has no code screen, blocks retries | CONFIRMED | S2 |
| UX-5 | WhatsApp ticket can never close; console cannot open a ticket | CONFIRMED | S2 |
| UX-6 | Work-email benefit code can never be reissued | CONFIRMED | S2 |
| UX-7 | Clinician note screen stuck on "Writing" | CONFIRMED | S3 |
| UX-8 | Patient list "still writing" for cancelled sessions | CONFIRMED | S3 |
| UX-9 | P1: five taps plus typing; paid path cannot finish | CONFIRMED | S2 |
| UX-10 | E5: no "ask HR" screen | CONFIRMED | S2 |
| UX-11 | First session free vs month 1 free | PARTLY | S3 |
| UX-12 | "No per-session fee" / "nothing else" beside the 15% cut | PARTLY | S3 |
| UX-13 | "No seat fee" under per-seat prices | CONFIRMED | S3 |
| UX-14 | 30 minutes vs one hour at one price | CONFIRMED | S2 |
| UX-15 | Arabic calendar says off the radar | CONFIRMED | S3 |
| UX-16 | Three consent stories on the join screen | CONFIRMED | S1 |
| UX-17 | No-show refund promises a card refund | CONFIRMED | S2 |
| UX-18 | Patient billing "Covered" for partial cover | CONFIRMED | S2 |
| UX-19 | White on teal: earnings button and three emails | CONFIRMED | S3 |
| UX-20 | "Go in" under the language pill at 390px | CONFIRMED | S2 |
| UX-21 | No language switch on the public site on phones | CONFIRMED | S3 |
| UX-22 | text-end inside dir=rtl left-aligns Arabic | CONFIRMED | S3 |
| UX-23 | Hard-coded English, collected | CONFIRMED | S3 |
| UX-24 | Staff sign-in empty h1 | CONFIRMED | S4 |
| UX-25 | SOS not keyboard operable; shaky tap fails | CONFIRMED | S1 |
| UX-26 | Radar booking sheet covers SOS, patient app too | CONFIRMED | S1 |
| UX-27 | In-room abuse report says sent, files nothing | CONFIRMED | S1 |
| UX-28 | "Saved" and "Reading…" whatever happened | CONFIRMED | S3 |
| UX-29 | Invite email promises Stripe to transfer payers | CONFIRMED | S2 |
| UX-30 | Rejected transfer told to nobody (MAP Confirmed 7) | CONFIRMED | S2 |
| UX-31 | Domain proof link redirects to sign-in | CONFIRMED | S2 |
| UX-32 | No password reset in clinic, company, partner portals | CONFIRMED | S2 |
| UX-33 | Patient reset code may not arrive; "another code" link | PARTLY | S3 |
| UX-34 | "Open your session" emails open the clinician portal | CONFIRMED | S2 |
| UX-35 | Journal crisis alert links to a 404 | CONFIRMED | S1 |
| UX-36 | Non-founder staff land on "Verify your practice" | CONFIRMED | S2 |
| UX-37 | Booking calendar hides days after the tenth | CONFIRMED | S3 |
| UX-38 | Seat "up from", 10% "You keep", EGP printed as $ | CONFIRMED | S2 |
| UX-39 | Clinic role edit strips permissions | CONFIRMED | S2 |
| UX-40 | Summary held behind rating and email | CONFIRMED | S2 |
| UX-41 | "Add an email" leads nowhere; record export impossible | CONFIRMED | S2 |
| UX-42 | "We can look at paused periods" contradicts T2 | CONFIRMED | S3 |
| UX-43 | Arabic contact address is an admin instruction; prices differ | PARTLY | S3 |
| UX-44 | Controls with no accessible name | CONFIRMED | S3 |
| UX-45 | "Reply stop" goes nowhere; opt-out has no door | CONFIRMED | S2 |
| UX-46 | Sound prompt covers "Go in now" while ringing | CONFIRMED | S2 |
| UX-47 | Risk suggestion pushed out of sight | CONFIRMED | S2 |
| UX-48 | "Paid" banner regardless of confirmation | CONFIRMED | S3 |
| UX-49 | Session orb points at a dead session for ever | CONFIRMED | S3 |
| UX-50 | "Added to your record" when nothing moved | PARTLY | S3 |
| UX-51 | Calendar publishes in UTC with no stored zone | CONFIRMED | S3 |
| UX-52 | Clinic invite uses the patient WhatsApp template | PARTLY | S3 |
| UX-53 | Cosmetic: empty demo tab, mid-Atlantic dots, counts only | CONFIRMED | S4 |
| UX-54 | Partner cannot mint employment key | WRONG | S4 |
| UX-55 | Signing discards a failed edit | WRONG | S4 |
| UX-56 | Rating link falls back to join token | HANDLED | S4 |
| UX-57 | Chrome money layers under SOS | HANDLED | none |
| UX-58 | Patient error page keeps SOS | HANDLED | none |
| UX-59 | Feedback brief shown only when signed | HANDLED | none |
