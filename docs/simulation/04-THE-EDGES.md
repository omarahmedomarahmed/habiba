# Every edge case, with the result the product must give

Each row is set up, acted and checked on the live site like a flow step, and posted to the
board under its id. `expected` is what the code is written to do; if the live site does
something else, that is a bug, and if the code itself is wrong, `08-COVERAGE.md` already says
so under "What the reading found".

| Prefix | Area |
|---|---|
| `PE` | Patients |
| `TE` | Therapists |
| `CE` | Clinics |
| `EE` | Companies |
| `AE` | The console |
| `ME` | Money, jobs, messages and partners, across every portal |


## Patients

| id | setup | action | expected | code reference file:line |
|---|---|---|---|---|
| PE1 | Transfer sheet open | Double tap "Submit" | One `manual_payments` row (partial unique index + `onConflictDoNothing` re-read); second call re-states the same row | lib/billing/manual.ts:248-318 |
| PE2 | Transfer already `submitted` | Press "Pay by card" (or POST `payByCard`) | Card button is hidden; the action redirects back to `/pay/<token>` without checkout | app/pay/[token]/page.tsx:224, app/pay/[token]/actions.ts:372-377 |
| PE3 | Session already paid | Open `/pay/<token>` | Redirect `/join/<token>?booked=1`; in-person paid shows "Paid. Your session can start." | app/pay/[token]/page.tsx:104-116 |
| PE4 | Session paid by the pot in full | Post `declareSessionTransfer` directly | "This session is already paid for." | app/pay/[token]/actions.ts:193 |
| PE5 | Transfer rejected by OP | Reopen pay page | "We could not confirm that transfer" and the form again; no second live row until resubmitted | lib/billing/manual-entry.ts:345-359 |
| PE6 | Unpaid radar link older than `radarLinkHours` (3 h) | Open `/pay/<token>` | 404 (resolveJoinToken returns null) unless a transfer is declared or paid | lib/data/sessions.ts:1127-1128 |
| PE7 | Transfer declared, OP confirms 5 h later on a radar session | Open `/pay` then `/join` | Link still works because a declared transfer holds it open | lib/data/sessions.ts:1127 |
| PE8 | Priced booking unpaid for 24 h, start more than 2 h away, no transfer submitted | Fire `/api/cron/reminders` | Slot released, session cancelled, patient told `booking.cancelled` + `pnotice.released`; pot share returned | lib/data/scheduling.ts:878-938, app/api/cron/[job]/route.ts:716-744 |
| PE9 | Wallet 5 USD, session owes 20 USD | Book | Hold of 5, pay page asks 15 with line "From your wallet"; hold spent when paid | lib/billing/wallet.ts:131-206, lib/billing/session-owed.ts:165-186 |
| PE10 | Wallet covers everything | Book | Session paid at once, `markInSession`, door "Join" | lib/billing/wallet.ts:206-215 |
| PE11 | Wallet hold on a session that the patient then cancels unpaid | Cancel, check wallet | Credits are NOT returned until the hourly `reminders` cron runs `sweepWalletHolds` | lib/billing/wallet.ts:303-318 |
| PE12 | Paid session with a spent wallet hold is refunded | Refund | Wallet part returns as a fresh credit, not to the card | lib/billing/wallet.ts:279-295 |
| PE13 | Pot balance + overdraft below the sponsor share (exhausted mid-month) | Book | `insufficient`: patient pays the full price; no email to the sponsor from the booking (daily `alertPots` instead); amber note on pay page | lib/billing/pot.ts:543-557 |
| PE14 | Two bookings race for the last pot money | Book twice at once | Only one debit succeeds (conditional UPDATE); the other pays normally | lib/billing/pot.ts:596-615 |
| PE15 | Pot `expires_at` in the past | Book | `expired`: patient pays | lib/billing/pot.ts:537-541 |
| PE16 | Provisional enrolment used its 1 session | Book a second | `no_benefit`, ordinary pay link | lib/billing/pot.ts:406-437 |
| PE17 | Enrolment code not yet confirmed (`last_verified_at` null) | Book | Nothing funded; pay note "Waiting for the code you were sent." | lib/billing/pot.ts:372, lib/billing/pot.ts:243-247 |
| PE18 | In-person, pot cover, 2 company-paid in-person sessions in 7 days | "Use my company benefit" | `in_person_cap`, "Your benefit could not pay for this one..." | lib/billing/pot.ts:317-326 |
| PE19 | In-person session; signed out | "Use my company benefit" | Redirect `/patient/login?next=/pay/<token>`, returns there after sign-in | app/pay/[token]/actions.ts:402-405 |
| PE20 | In-person, another patient signed in | "Use my company benefit" | `patient_must_confirm`, nothing spent | lib/billing/pot.ts:314-316 |
| PE21 | Sponsor lowers coverage after booking | Pay | Patient still owes the frozen share from booking | lib/billing/session-owed.ts:95-148 |
| PE22 | Cancel inside the 24 h window, paid by transfer | "Yes, cancel" | "Refund owed. We send it by hand." (queued) | lib/data/booking-change.ts:113-140 |
| PE23 | Cancel under 24 h before start, paid | "Yes, cancel" | `late_cancel = held`, no refund unless T1 agrees | lib/data/booking-change.ts:231, 257-259 |
| PE24 | Cancel an unpaid booking that has a SUBMITTED transfer | "Yes, cancel", then OP confirms | Session cancelled; `claimSessionPaid` refuses (cancelled) so money is confirmed with no paid session and no automatic refund. Verify OP sees it | lib/data/booking-change.ts:218-259, lib/billing/session-owed.ts:22-37 |
| PE25 | Double press "Yes, cancel" | Two requests | Second returns "This session can no longer be changed." | lib/data/booking-change.ts:225-242 |
| PE26 | Move to an hour that was just taken | "Move" | "That time was just taken. Pick another." | lib/data/booking-change.ts:446 |
| PE27 | Move under 24 h before start | POST `moveMyBooking` | "It is too close to the start to move it." | lib/data/booking-change.ts:391 |
| PE28 | Another patient's session id | Open `/patient/sessions/<id>/change` | 404 | lib/data/booking-change.ts:543 |
| PE29 | Another patient's payment id | Open `/patient/billing/receipt/<id>` | 404 | app/(patient)/patient/billing/receipt/[id]/page.tsx:45-46 |
| PE30 | Another patient's assignment id | Open `/patient/assessments/<id>` | 404; `recordAnswer` also refuses | app/(patient)/patient/assessments/[id]/page.tsx:40-41 |
| PE31 | Another person's grant id | `answerRequest` / `revoke` | "That request is no longer waiting for an answer." / "That access has already ended." | lib/data/grants.ts:389, 460 |
| PE32 | Signed out | Open any `/patient/*` except `/patient/invite` | Redirect `/patient/login?next=...` | lib/patient-auth/guard.ts:21-33, lib/routing.ts:66-112 |
| PE33 | Cookie present but session idle over 4 h | Open `/patient` | `/patient/session-expired` then `/patient/login?expired=1&next=/patient` | lib/patient-auth/session.ts:46-47, app/(patient)/patient/session-expired/route.ts |
| PE34 | `next=https://evil` or `//evil` | Sign in | Lands on `/patient` | lib/routing.ts:114-121 |
| PE35 | Wrong sign-in code 6 times | "Sign in" | After 5 wrong the token is spent: "Too many wrong codes. Ask for a new one." | lib/patient-auth/code-signin.ts:195-209, lib/db/schema.ts:4552 |
| PE36 | Code older than 15 min | "Sign in" | "That code is wrong or has expired. Ask for a new one." | lib/patient-auth/code-signin.ts:67, 176-193 |
| PE37 | Sign-in code requested, then an add-email code requested for the same account | Enter the sign-in code | Fails: both use purpose `handle_verify` and the newest token wins | lib/patient-auth/code-signin.ts:179-191, lib/patient-auth/email.ts:84-90 |
| PE38 | Phone of an existing account | Sign up again | "We could not create that account. Try signing in instead." | lib/patient-auth/actions.ts:141-164 |
| PE39 | 6th signup from the same network in an hour (125th in sim) | Sign up | "Too many attempts. Try again in an hour." | lib/patient-auth/actions.ts:117-120 |
| PE40 | Signup with a phone that does not match the invite | Create account | INVITE_MISMATCH sentence, no account created | lib/patient-auth/actions.ts:127-132, lib/data/claims.ts:587-602 |
| PE41 | Invite used by P1; P1 opens it again | Open link | "This link is no longer valid" | lib/data/claims.ts:536-566 |
| PE42 | Person already claimed by someone else | "This is me, claim it" | Invite is marked used (transaction returns, does not throw) and the answer is "That link has already been used." The invite is burned | lib/data/claims.ts:651-672 |
| PE43 | P1 booked or scanned a wall code BEFORE claiming a record (signup person has `patients` rows) | Claim | `bindAccountToPerson` returns "kept": the claimed record's sessions stay on another person and do not appear in P1's app | lib/data/claims.ts:165-171 |
| PE44 | Claim name wrong 3 times | "Confirm" | Record locked for this account | lib/data/challenge.ts:380-427 |
| PE45 | Number proven by nobody | Open `/patient/claim` | No challenge or suggestion shown until "Check the code" | app/(patient)/patient/claim/page.tsx:81-85 |
| PE46 | Join link for a priced unpaid session | "Join session" / post `answerConsent` | Sent to `/pay/<token>`; `admit` refuses "This session has not been paid for yet." | app/join/[token]/actions.ts:73-75, 212-229 |
| PE47 | Reload inside the room | Reload | Resumes (because `patient_joined_at` is set), no second name form | app/join/[token]/page.tsx:224-228 |
| PE48 | Couples: one grants, one declines | Both answer | Decline wins; grant after decline is ignored; bot withdrawn | app/join/[token]/actions.ts:381-415, 465-479 |
| PE49 | Patient pressed "Stop recording" | Clinician resumes | Consent is declined, recording stays off; "Turn on" cannot re-grant after it started | app/join/[token]/actions.ts:716-724, 780-788 |
| PE50 | Waiting 10 min with no clinician | Keep the room open | `markAbandonedIfWaiting` warns T1 (or hourly `crisis` cron if the tab closed) | app/join/[token]/actions.ts:571-577 |
| PE51 | Clinician never joins, 5 min past `scheduled_at` | Wait | Replacement offer or refund; `recordNoShow` against T1 | app/(patient)/sessions/[id]/recovery-actions.ts:172-187, lib/sessions/waiting.ts |
| PE52 | Replacement id not offered | POST `takeReplacement` with any user id | "That clinician is no longer available. Choose again." | app/(patient)/sessions/[id]/recovery-actions.ts:209-210 |
| PE53 | Session ended more than 72 h ago | Open `/feedback/<token>` | "This link has expired" | lib/data/feedback.ts:49, 142-143 |
| PE54 | Rating given on arrival in the room | "Save" | NOT saved: `rateOnArrival` passes the join token to `recordArrival`, which only matches `feedback_token`; the screen shows done anyway (bug) | components/join/patient-room.tsx:599, app/join/[token]/actions.ts:640-647, lib/data/feedback.ts:320-330 |
| PE55 | Patient holds an open ("until I change my mind") grant for T1 | Write a journal entry with crisis wording | NO crisis notification to T1: the filter `gte(expires_at, now)` drops NULL expiries; only 24 h grants alert (bug) | lib/data/journals.ts:171, lib/data/grants.ts:376-379 |
| PE56 | Signed-in patient pays a session by transfer without typing a receipt email | Submit, OP confirms | No `payment.submitted` / `payment.confirmed` message and no in-app `pnotice.paymentConfirmed` (payer kind `session` resolves only `guest_email`) | lib/billing/payment-notices.ts:143-159, 253 |
| PE57 | Two agents on the same network book radar sessions | Agent A books (unpaid), agent B books another clinician | A's session is cancelled and its join token nulled (hold is per network) unless paid or joined | app/(public)/radar/actions.ts:265-343 |
| PE58 | Radar clinician booked 3 times in 15 min | 4th booking | "That clinician has had several booking attempts just now. Try another one." (x25 in sim) | app/(public)/radar/actions.ts:195-202 |
| PE59 | Record export 5th time in an hour (x25 in sim) | "Email me my record" | "You have asked for this a few times in the last hour..." | lib/data/export.ts:1182-1187 |
| PE60 | No proved email | "Email me my record" | Button replaced by "Add an email to get your record" | app/(patient)/patient/record/actions.ts:31, components/patient/export-record.tsx:36 |
| PE61 | Add an address that belongs to another account | "Send me a code" | Screen says a code is on its way; nothing is sent; confirm always fails | lib/patient-auth/email.ts:70-81 |
| PE62 | Number verified less than 90 days ago, account older than 24 h | "Ask to change it" | "Locked until {date}..." | lib/data/phone-change.ts:155-167 |
| PE63 | Benefit work email on a domain the sponsor has not proved | "Activate" | "That does not match what your organisation asks for..." | lib/data/enrolment.ts:361-378 |
| PE64 | Same work email enrolled by another person | "Activate" | "That could not be activated. Check with whoever shared the code." | lib/data/enrolment.ts:439-453 |
| PE65 | Arabic selected | Open `/patient`, `/pay`, `/join`, receipt | `dir="rtl"`, Arabic strings; money and dates formatted server-side in Arabic numerals | lib/i18n/config.ts:18-50, app/(patient)/patient/billing/receipt/[id]/page.tsx:57 |
| PE66 | Arabic selected | Booking calendar, room arrival rating, change page title, receipt title, verify page, journal "spoken", claim fallback "your number" | Hardcoded English: "Confirm"/"Booking…", "Save"/"Saving…", "Change or cancel", "Receipt", whole `/verify` page, " · spoken", "your number" | components/scheduling/booking-calendar.tsx:241, components/join/patient-room.tsx:604, app/(patient)/patient/sessions/[id]/change/page.tsx:13, app/(public)/verify/page.tsx:42-99, app/(patient)/patient/journal/page.tsx:94, app/(patient)/patient/claim/page.tsx:104 |
| PE67 | Language switched with the corner switch only | Receive the next reminder | Message still in the SAVED `people.locale` (the corner sets only the cookie); Settings "Save" updates both | components/i18n/language-switch.tsx:68-74, lib/i18n/preference.ts |
| PE68 | Error thrown on a patient page | Any | "Something went wrong at our end" + "Try again", SOS orb still shown | app/(patient)/error.tsx, app/pay/error.tsx, app/join/error.tsx, components/patient/route-error.tsx |
| PE69 | Unknown `/patient/...` path | Open | "We could not find that page" + "Back to home" | app/(patient)/not-found.tsx |
| PE70 | Wall code revoked | Open `/j/<code>` | "This code is no longer in use" | app/j/[code]/page.tsx:103-117 |
| PE71 | Dead join link after a session ended within 72 h | Open `/join/<token>` | Redirect to `/feedback/<feedbackToken>` | app/join/[token]/page.tsx:73-83 |
| PE72 | Dead join link otherwise | Open | "This link is no longer active" / "Links last 12 hours..." (booking links actually last 4 h after start, radar 3 h) with "Find someone now" and, signed in, "Your sessions" | app/join/[token]/page.tsx:85-110, lib/settings/defs.ts:642 |
| PE73 | Assessment PHQ-9 item 9 answered above 0, changed and answered again | Answer twice | Only one crisis notification per assignment | lib/data/assessments.ts:320-326 |
| PE74 | Journal body over 20,000 characters | "Save this" | "That is longer than we can store." | lib/data/journals.ts:93-94 |
| PE75 | Pot session refunded | Check pay page | Owes nothing (refunded split owed by nobody) | lib/billing/session-owed.ts:132-134 |

## Therapists

| id | setup | action | expected | code reference |
|---|---|---|---|---|
| TE1 | approved T1 past the first free session, PAYG, in-person session, consent granted | End session after 3 minutes | durationMinutes 3; billed exactly like a 50-minute one: platform 100 cents plus AI 300 cents (no minimum-duration rule); note generated if the transcript has at least 80 characters | lib/billing/service.ts:70, lib/data/sessions.ts:789 |
| TE2 | same, patient says "No, do not record" | End after 3 minutes | only the platform line (AI fee skipped for anything but granted, including null); note view "Not recorded" with "Write it yourself" only | lib/billing/service.ts:93, components/session/note-review.tsx:156 |
| TE3 | in-person, nobody presses either consent button | Start, speak, End | recorder muted, transcribe returns 409, no AI line, "Not recorded" | lib/sessions/may-record.ts, app/api/sessions/[id]/transcribe/route.ts:140 |
| TE4 | consent granted but the fake wav is silent or under 80 characters of text | End | `EmptyTranscriptError`, noteStatus failed, card "The note could not be written" with "Try again" and "Write it yourself"; still billed with the AI line | lib/ai/notes.ts:181, lib/ai/notes.ts:528 |
| TE5 | first ever completed session of a new org | End | invoice status waived "First session, on us", both lines kept at 0; `trial_session_used` true | lib/billing/service.ts:118 |
| TE6 | video session, patient never joins | T1 presses "Start session" then "End session" | allowed: scheduled can go to in_progress and completed; billed the normal fee; no no-show record (that needs the patient to have joined) | lib/data/sessions.ts:548 |
| TE7 | video session, P2 joined, T1 never presses Start | wait more than 10 minutes, or age then cron crisis | `session_reports` kind no_show; first time a warning email "A patient was waiting for you", second time a radar suspension "You have been taken off the Crisis Radar" (body wording says "booked you on the Crisis Radar" even for non-radar sessions) | lib/data/feedback.ts:874, lib/data/feedback.ts:951 |
| TE8 | booked hour (scheduledAt set), P3 joined, T1 absent 5 minutes | P3 picks T2 | session moves to T2; repriced to T2 rate when unpaid; wallet credit when paid and wallet enabled; refused if T2 charges more | lib/data/recovery.ts:225, lib/data/recovery.ts:303, lib/data/recovery.ts:418 |
| TE9 | same but no cheaper therapist online | P3 "Refund me in full" | `refundNoShow`; P3 "You have been refunded" | lib/data/recovery.ts:492 |
| TE10 | live session, 12 chunks sent, 3 of them silent (not stored) | T1 reloads the room (rejoin) | sequence restarts at the number of stored lines (9), the next 3 chunks collide with existing sequences and are silently dropped by `ON CONFLICT DO NOTHING` although the route still returns the text to the screen. Looks like a bug | components/session/session-room.tsx:183, lib/data/transcript.ts:101 |
| TE11 | same session open in two tabs | both record | two independent sequence counters collide; one tab's chunks are lost | components/session/session-room.tsx:189 |
| TE12 | room already live | press "Start session" twice or goLive from two tabs | idempotent: second call returns early, but audit `session.start` is written twice; patient "started" message only once | app/(app)/sessions/actions.ts:380, lib/data/sessions.ts:594 |
| TE13 | "Start session now" double-clicked on /sessions/new | | button disabled while pending; a scripted double submit makes two sessions and two patient rows | components/session/new-session-form.tsx Submit |
| TE14 | primary note signed or patient copy released | "Redraft" or "Try again" | refused "Signed. Add an addendum." or "Released. Add an addendum."; nothing regenerated | app/(app)/sessions/actions.ts:531, lib/ai/notes.ts:350 |
| TE15 | note draft, consent granted | "Redraft" after correcting speakers | noteStatus generating, then ready; the same format row is overwritten while draft | app/(app)/sessions/actions.ts:493 |
| TE16 | T3 rejected twice | open /onboarding | documents gone, submit disabled; action message explains the second rejection | lib/data/verification.ts:251, app/(app)/onboarding/actions.ts:233 |
| TE17 | T3 submitted | admin tries to decide their own verification | "Not your own." | app/(admin)/admin/actions.ts (own check) |
| TE18 | admin rejects with an empty note | | "Say what is wrong. They see this word for word." | app/(admin)/admin/actions.ts:353 |
| TE19 | T1 submitted | "Change something" while A1 approves | whichever lands first wins, the other matches nothing | app/(app)/onboarding/actions.ts:277 |
| TE20 | T4 approved with Licence expiry text within 30 days of the real date (for example next month's date) | fire /api/cron/retention (or /api/cron/licences) | `licenseExpiryWarnedAt` set, outbox "Licence expires soon", banner on every page; a second run sends nothing | lib/data/licence-expiry.ts:67 |
| TE21 | T4 approved, expiry text already in the past (for example 2026-09-01) | fire /api/cron/retention | state back to submitted with `licenseExpiredAt`, radar set offline, outbox "Licence expired"; T4 is uncleared: every (app) page except the open list redirects to /onboarding, so /sessions/[id] (signing notes) is unreachable, while /sessions/[id]/room still opens because the (room) group has no clearance gate | lib/data/licence-expiry.ts:70, app/(app)/layout.tsx:112, app/(room)/sessions/[id]/room/page.tsx:23 |
| TE22 | T4 expired | edit "Licence expiry" and "Save details", upload | allowed during renewal (licenseExpiredAt set); "Submit for verification" says already submitted; admin approval clears the stamps | app/(app)/onboarding/actions.ts:170 |
| TE23 | unparseable expiry text ("soon") | cron | treated as unknown, never expired | lib/licence.ts |
| TE24 | licence photo is a PDF | Upload | refused by type (images only) | lib/uploads.ts:41 |
| TE25 | P3 booked and paid | P3 cancels inside the 24 h window | payment held, T1 sees "Late cancellations", may "Refund anyway" | lib/data/booking-change.ts:217, lib/data/booking-change.ts:288 |
| TE26 | T1 cancels a paid session | "Cancel this session" with a reason | refund to the payer (transfer-paid share goes to the refund queue); patient told the reason | lib/data/clinician-cancel.ts |
| TE27 | T1 cancels without a reason | "Yes, cancel it" | "Give the patient a short reason." | app/(app)/sessions/actions.ts:464 |
| TE28 | T2 knows T1's session id | calls the abandonSession action with T1's id | cancel matches nothing, but `releaseClaim(sessionId)` is unscoped and flips T1's radar row from pending or in_session back to online. Looks like a bug | app/(app)/sessions/actions.ts:480 |
| TE29 | T2 opens /patients/<T1 patient id>, /copilot/<id>, /sessions/<T1 session id>, /sessions/<id>/room, /sessions/<id>/collect | | 404 (scope is organisation plus therapist) | lib/data/patients.ts:32, lib/data/sessions.ts scope |
| TE30 | T5 clinic seat | /billing actions, /settings/records "Continue" | refused "Your clinic's account is run from the clinic portal."; saving "Where you practise" returns "Your practice is part of a clinic..." after the rate has already been saved | lib/auth/org-account.ts, app/(app)/settings/actions.ts updatePaymentSettings |
| TE31 | unverified T1 | visit /sessions/new, /patients, /on-call, /bookings | redirected to /onboarding; /connect, /settings, /billing, /earnings, /support, /notifications stay open | lib/nav/clinician.ts:53 |
| TE32 | unverified T2 redeems a patient code | "Ask them" | grant pending; "Your licence is still being checked..." | lib/data/portability.ts:237 |
| TE33 | copilot outside a session after 5 questions with no completed session | "Ask" | "You have used all {n} copilot questions for this patient..." (the banner copy says "this month" and "per month" although the quota is per session over 12 months) | lib/data/copilot.ts:272, app/(app)/copilot/actions.ts:77 |
| TE34 | copilot during a live session | "Ask" | free, not counted | app/(app)/copilot/actions.ts:77 |
| TE35 | login | 21 wrong attempts from one connection in 15 minutes | normally refused after 20; with SIMULATION_RUNNING the limit is 500; 5 wrong passwords on one account still lock it 15 minutes | lib/auth/actions.ts:34, lib/rate-limit.ts:97 |
| TE36 | many agents on one IP | uploads (30 per 10 min), support tickets (3 per hour), geocode (30 per 5 min per user) | multiplied by 25 during the simulation; the `global:` ceiling is not | lib/rate-limit.ts:111 |
| TE37 | price outside min 500 cents or max 50,000 cents | "Start session now" or "Save payment settings" | `priceProblem` message | lib/billing/connect.ts priceProblem |
| TE38 | in-person paid through us, price typed above list | | "That is above your price per session. You can lower it, never raise it." | app/(app)/sessions/actions.ts:160 |
| TE39 | Daily key missing on live | "The 24Therapy room" start | "... Nobody has been invited. Start this session in person, or try again once it is fixed." and nothing written | app/(app)/sessions/actions.ts:213 |
| TE40 | Egypt T1 upgrades by transfer | fire /api/cron/billing before A1 confirms | `subscribeByTransfer` sets `dueAt` = now; `lapseOverdue` lapses it at the next billing run; `settleObligation` and `settleOldestObligationByTransfer` only settle state due, so the later confirmed transfer does not activate the plan. Looks like a bug | lib/billing/service.ts:920, lib/billing/obligations.ts:227 |
| TE41 | session in progress, tab closed | wait 50 minutes, then /api/cron/crisis | `sweepOverrunSessions` auto-ends with reason cap; page "Ended automatically at the 50 minute limit." The clock is never moved with a session live, so a session never comes back days long | lib/data/sessions.ts:721, lib/data/sessions.ts:754 |
| TE42 | live session, more than 40 minutes elapsed and no new transcript line for 90 s (for example off record, or consent declined) | state poll | auto-end reason silence "Ended automatically: the room went quiet after the paid time." | lib/session-clock.ts, app/api/sessions/[id]/state/route.ts:77 |
| TE43 | radar pending, patient never pays | 10 minutes or age plus cron crisis | radar claim released to online; radar session cancelled | lib/data/radar.ts:63 |
| TE44 | radar tab closed | 90 s | `sweepRadar` sets offline | lib/data/radar.ts:60 |
| TE45 | completed session with no invoice (after() died) | age more than 2 days, then /api/cron/billing | NOT repaired: the reconciler only looks 48 h back on `endedAt` | lib/billing/service.ts:654 |
| TE46 | crisis phrase in the fake audio ("I want to die") | live session | room RiskBanner; `notifications` kind crisis titled "Risk language detected" (English only, not translated); dashboard red card | lib/crisis/alerts.ts:409 |
| TE47 | homework set or questionnaire sent | | no outbox message at all; the actions revalidate `/patients/<id>/homework` and `/patients/<id>/assessments`, pages that do not exist, so the list on /documents may need a reload | app/(app)/patients/[id]/homework/actions.ts:60, app/(app)/patients/[id]/assessments/actions.ts:68 |
| TE48 | T1 changes language with the corner switch only | then receives a notice | emails still in the saved `users.locale`; only the Settings "Language" select changes messages | lib/i18n/preference.ts, app/actions/locale.ts |
| TE49 | in-person paid-through-us session never paid | the clock moves past 12 hours, then /api/cron/reminders | `sweepInPerson` cancels it | lib/data/in-person.ts:24 |
| TE50 | video session link | patient opens `/join/<token>` after the clock has moved more than 12 hours past its creation | link expired | lib/data/sessions.ts:291 |
| TE51 | the in-room "pay as you go" notice | admin changes platform or AI fee | form still says "$1 per session, and $3 if the patient turns AI on" (hard-coded copy) | components/session/new-session-form.tsx (tnew.paygNotice) |

## Clinics and companies

| id | setup | action | expected | code reference |
|---|---|---|---|---|
| CE1 | Clinician invitation created on day 3, then the clock moves to day 21 | Open /clinic/join/<token> and submit | Page still renders the form (expiry not checked on render); submit says "That invitation has expired. Ask the practice for a new one." | lib/data/clinic-admin.ts:329, :408 |
| CE2 | Invitation cancelled by the admin | Open the link | "That invitation is no longer valid. Ask the practice for a new one." | clinic-admin.ts:343 |
| CE3 | Same email invited twice | Open the first link | First link invalid; only the newest works | clinic-admin.ts:252 |
| CE4 | Email already a clinician of this clinic | Invite again | "That clinician is already on your account." | clinic-admin.ts:249 |
| CE5 | One free seat, two invitations sent while a seat was free | Both accept | Second: "This practice has no free seat for you yet. Ask them to add one, then open the invitation again." and no user is created | clinic-admin.ts:426, lib/billing/seats.ts:309 |
| CE6 | Invitation open | Accept with an 11 character password | "Use at least twelve characters." (the clinic set-password hint elsewhere says 10) | clinic-admin.ts:387, lib/auth/password.ts:58 |
| CE7 | Existing clinician whose own practice has patients | "Sign in and join" | Refused: "This account already has patient records on it..." | clinic-admin.ts:594 |
| CE8 | Existing clinician with a paid period ending in the future | Join | Seat billable_from = their period end; row line "This seat is not billed until {date}..." | lib/billing/seats.ts:298, app/(clinic)/clinic/people/page.tsx:93 |
| CE9 | Invitation open in two tabs | Submit both | Second: "There is already an account with that email address here." or "That invitation has already been accepted." | clinic-admin.ts:448, :466 |
| CE10 | No free seat (form carries seatFrom and seatTo) | Tamper seatTo to seatFrom + 50 and submit | Should buy one seat; code accepts up to 50 more and raises the proration invoice for all of them | app/(clinic)/clinic/people/actions.ts:60 |
| CE11 | Two admin tabs on /clinic/seats | Save in both | Second: "The seat count changed while you were looking at this. We have refreshed the figures: check them and try again." | seats.ts:126 |
| CE12 | 3 clinicians hold seats | Set seats to 2 | "3 clinicians hold seats. Remove somebody first, then reduce the seats." | seats.ts:106 |
| CE13 | Clinic with no subscriptions.current_period_end (every new clinic) | Add a seat on day 20 | Expected by the spec: prorated to the days left. Code uses now plus 30 days as period end, so days remaining is always 30 and the full monthly difference is charged; invoice text "... for the 30 days left of this month" | seats.ts:73, lib/billing/service.ts:1201 |
| CE14 | Seats reduced twice in one month | Reduce 4 to 3, then 3 to 2 | Credit should total two seat-days; setUpcomingDiscount overwrites, so only the second credit survives. Screen says "Removing seats refunds nothing this month". The discount is consumed only by a credit purchase invoice, which a clinic never makes | service.ts:820, service.ts:386, components/billing/seat-manager.tsx |
| CE15 | Clinic with seats, day 30 | Look for a monthly seat invoice on /clinic/bills | Spec: a monthly seat bill. Code raises recurring seat invoices only for transfer organisations with a paid renewal obligation (none exists for a clinic that never bought a tier), so no monthly seat invoice is expected to appear. Confirm on day 30 | service.ts:964, :1003 |
| CE16 | Invitation that bought a seat | "Cancel the invitation" | Seat stays bought and billed; admin must lower it on /clinic/seats | people/actions.ts:130 |
| CE17 | Clinician assigned to a staff member | Remove the clinician | Clinician gone from the list; the assignment row is not deleted, so the staff row may still name them under "Whose work they cover" | lib/data/clinic-team.ts:231, clinic-admin.ts:723 |
| CE18 | Seat invoice due, never paid, through day 30 | Keep booking sessions | Invoice stays "Due"; no suspension exists in code; operator cannot change the clinic region while anything is due | lib/data/clinic-admin.ts:975 |
| CE19 | eg clinic | POST payClinicBills directly | "Your practice pays by bank transfer. Write to us for the details." | app/(clinic)/clinic/bills/actions.ts:31 |
| CE20 | Nothing due | Declare a clinic transfer | "Nothing is outstanding." | bills/actions.ts:139 |
| CE21 | Admin picked the newer of two due invoices, declared that amount | Operator confirms | Grant pays due invoices oldest first while they fit, so the older invoice may be the one marked paid | lib/billing/manual-grants.ts:467 |
| CE22 | Staff member with any role | POST invite, saveClinicSeats, payClinicBills, begin (records) | Redirect to /clinic, nothing written | lib/clinic-auth/guard.ts:52, :71 |
| CE23 | Admin builds a role | Tamper capabilities to include seats.manage | "Buying seats and inviting clinicians stay with you. They cannot be given to a role." | lib/clinic-auth/capabilities.ts:168 |
| CE24 | Two roles exist | Add a third (tampered POST) | "You already have two roles. Change one of those, or remove it first." | clinic-team.ts:126 |
| CE25 | Staff with schedule.read and no assignments | Open /clinic, /clinic/earnings | Empty rota and earnings; usage "Not enough activity to report yet" | lib/data/clinic.ts:496 |
| CE26 | Staff holding "Manage this team" | Save assignments on own row (tampered) | "Whoever runs the practice sets yours." | clinic-team.ts:453 |
| CE27 | Staff signed in | Admin removes their role | Next request: no capabilities, every page redirects to /clinic, which shows only headings | lib/clinic-auth/session.ts:231 |
| CE28 | Staff with schedule.read, no export | GET /clinic/export?what=schedule | 403, empty body | app/(clinic)/clinic/export/route.ts:75 |
| CE29 | Signed out | GET /clinic/export?what=bills | 401 | export/route.ts:30 |
| CE30 | Staff without seats.manage or team.manage | Type /clinic/seats, /clinic/team, /clinic/records | Redirect to /clinic | guard.ts:71 |
| CE31 | Sessions booked with a clinic clinician | Look for any clinical surface in /clinic | Only shortened patient name, clinician, time and "Cancelled"; rows are not links; no route under /clinic accepts a patient or session id | app/(clinic)/clinic/page.tsx, lib/data/clinic.ts:309 |
| CE32 | Completed and scheduled sessions in a week | Export the week | CSV "State" carries scheduled, in_progress, completed, cancelled, while the screen shows only "Cancelled"; the file shows more than the screen, contrary to the watermark sentence | lib/data/clinic-export.ts |
| CE33 | Month with 1 to 4 sessions, one recorded with AI | Open /clinic/bills | Count withheld, but the AI fee total is shown, so with one session the practice learns that patient's recording consent | lib/data/clinic.ts:827, app/(clinic)/clinic/bills/page.tsx |
| CE34 | Reset link older than 1 hour or already used | Open /clinic/set-password | "That link is no longer valid." | lib/clinic-auth/tokens.ts:31, :67 |
| CE35 | Staff invited, admin pressed "New link" | Use the first link | Invalid; only the new one works | tokens.ts issueClinicToken |
| CE36 | Unknown email | /clinic/forgot-password | Same "Check your inbox" screen, nothing in the outbox | app/(clinic)/clinic/forgot-password/actions.ts |
| CE37 | Held or suspended clinic | Manager signs in with the right password | "That email address and password do not match." | clinic-admin.ts:911 |
| CE38 | Clinic manager idle 31 minutes, or any clock move | Click anything | Redirect to /clinic/sign-in | session.ts:65 |
| CE39 | Admin with no linked clinician | POST switchToClinician | Redirect /clinic; button not drawn | lib/clinic-auth/switch.ts:63 |
| CE40 | Another clinic's clinician id | POST remove(userId) | "That clinician is not on your account." | clinic-admin.ts:752 |
| CE41 | Any principal with schedule.read | /clinic?week=1999-01-04 or a future week | Allowed, rows for that week only; one phi_access audit row per view | lib/data/clinic.ts:366 |
| EE1 | A pot top-up declared and waiting | Declare again with another amount before the operator decides | Same manual_payments row is updated (one payment per purpose and company); operator confirm with the old amount is refused "It changed or was decided while you looked..." | lib/billing/manual.ts:218, :562 |
| EE2 | Top-up submitted | Operator confirms twice (double click or two operators) | Second: "That payment is not waiting for a decision."; pot credited once; one pot_topup ledger txn | manual.ts:562, manual-grants.ts:664 |
| EE3 | Pot open | Declare $50 or $6,000 (tampered hidden amount) | "The smallest top-up is $100.00." or "The largest top-up we can take on this screen is $5,000.00. Talk to us for more." | app/(sponsor)/sponsor/pot/actions.ts:148, :158 |
| EE4 | Viewer login | POST declarePotTransfer, setCoveragePercent, endBenefit, replaceCode, addGate, uploadStaffList, inviteColleague | Redirect /sponsor, nothing written | lib/sponsor-auth/guard.ts:40 |
| EE5 | Company moved to entity us by an operator | Open /sponsor/pot | "Card payment is not open yet. Ask us for transfer details." with "Ask us"; declare refused "Your account pays by card. Use the form above." | components/sponsor/top-up-form.tsx, pot/actions.ts:194 |
| EE6 | Company active, no pot opened | Open /sponsor/pot | "Your pot is not open yet. We open it with you."; no sheet; coverage form hidden | app/(sponsor)/sponsor/pot/page.tsx:268 |
| EE7 | First confirmed top-up, no sessions yet | Open /sponsor | Balance shows the top-up at once (publishTopUp sets it to the sum of top-ups) | lib/billing/pot.ts:1388 |
| EE8 | Published balance set, then 4 funded bookings | Open /sponsor after each | Balance and "Sessions in total" do not move until the 5th booking, then jump; a top-up in between adds to the published figure at once | lib/data/sponsors.ts:312, pot.ts:1388 |
| EE9 | Balance under one session's company share, overdraft 0 | Employee books | Pot pays nothing ("insufficient"); the employee pays the full price; two bookings racing for the last money: only one is funded | lib/billing/pot.ts:543, :606 |
| EE10 | Session already booked and funded | Pot runs out afterwards | Nothing changes for that session: the pot is debited at booking, not at session time | app/pay/[token]/actions.ts:413, lib/data/scheduling.ts:693 |
| EE11 | Real balance at 0, published balance stale | Fire /api/cron/billing | "Your therapy fund needs topping up" goes out on the real balance, once per top-up; the timing can tell a small company that its last covered booking just happened | lib/billing/pot-alerts.ts:115 |
| EE12 | Published balance under 20% of the last top-up | Fire billing twice | One "running low" mail per admin; second run sends nothing | pot-alerts.ts:53, :123 |
| EE13 | Coverage 50% | Raise to 80% mid-month | Immediate; bookings after pay the new split, earlier bookings keep 50% in the ledger | sponsors.ts:763 |
| EE14 | Coverage 80% | Lower to 50% on day 1 | Pending, effective 30 days later; still 80% on day 30, and 50% after the clock moves to day 31 | sponsors.ts:779 |
| EE15 | Reduction to 50% pending | Set 60% | Treated as another reduction with a fresh 30 day date; setting 85% instead applies at once and clears the pending change | sponsors.ts:745, :763 |
| EE16 | Admin | Tamper percent to 33 | "Coverage is a whole percentage in steps of five, from 0 to 100." | sponsors.ts:710 |
| EE17 | Coverage 0% | Employee books | Pot pays nothing ("no_benefit"); card says "Your people pay for their own. Nothing is drawn from your balance." | pot.ts:462 |
| EE18 | Pot expires_at passed | Employee books | Pot pays nothing ("expired"); overview "Expired {date}. It no longer pays for sessions."; nothing is written off or returned automatically | pot.ts:537 |
| EE19 | Pot expires within 30 days | Fire billing | "Your fund expires {date}" once per date | pot-alerts.ts:153 |
| EE20 | Asked for money back today | Ask again | "You asked today. We reply by email." (limit 1 a day, 25 while SIMULATION_RUNNING); reason under 5 chars: "Say why, in a few words." | pot/actions.ts:313, :316 |
| EE21 | Return asked by operator A | Operator A also sends it | "A second person sends what the first one asked for." when the two person rule is on; amount above the balance: "That is more than the pot holds."; second ask while one waits: "A return for this company is already waiting to be sent." | lib/billing/pot-return.ts:49, :60, :91 |
| EE22 | Return sent | Open /sponsor | Published balance drops by the net at once | pot-return.ts:98 |
| EE23 | Only one company admin | Demote or remove them; remove yourself | "Make somebody else an admin first."; "You cannot remove yourself. Ask another admin." | lib/data/sponsor-users.ts:259, :276 |
| EE24 | Colleague invited on day 3 | Open the link on day 14 | The expiry lives inside the signed link, not the database, so the clock cannot pass it: the link still works. A limitation of compressed time, not a bug. Walked instead by opening a link made 7 real days earlier, if one exists, or skipped with that reason | lib/sponsor/password-link.ts:21, sponsor-users.ts:173 |
| EE25 | Invite link used once | Use it again | Same expired message (the password hash changed) | password-link.ts:67 |
| EE26 | Colleague removed | They sign in; admin re-invites the same email | Sign-in refused; re-invite allowed (unique only among live rows) | lib/db/schema.ts:7325 |
| EE27 | Company roster of 1 to 4 named people | 5 bookings by them | Heatmap stays suppressed, but "Sessions in total 5" and the balance publish anyway, so the company learns that a small named group booked at least five sessions. Expected: suppressed while the roster is under the floor | app/(sponsor)/sponsor/page.tsx:78, :87 |
| EE28 | Published ledger batch | Filter by coverage or a narrow Min and Max price | Aggregates stay floored, but individual rows remain listed with week, price and coverage; a distinctive price or an old coverage value can point at one person | lib/sponsor/ledger.ts:134, lib/data/sponsor-ledger.ts:34 |
| EE29 | A funded session cancelled and refunded | Open the ledger after the week publishes | A refund row appears in the batch, so a cancellation is visible at week granularity | app/(sponsor)/sponsor/ledger/page.tsx:231 |
| EE30 | Company login | Look for a patient name with a session time or attendance anywhere | Roster has names only; ledger has week, price and coverage only; no route takes an enrolment, person or session id (writes are server actions keyed by enrolment id and scoped by sponsor) | lib/data/sponsors.ts:97, :424 |
| EE31 | Entries paid this week | Open /sponsor/ledger after the clock passes the end of the week and the jobs fire | The week publishes and the paid entries appear | lib/sponsor/ledger.ts:54, lib/db/schema.ts:7857 |
| EE32 | Another company's top-up txn id | Open /sponsor/pot/<that id> | 404; a malformed id may render "Something went wrong. Please try again." with "Try again" | lib/billing/invoice.ts:83 |
| EE33 | Another company's ETA document id | GET /sponsor/pot/eta/<id> | 404 "Not available yet."; malformed id 404 "Not found."; signed out 401 "Sign in first." | app/(sponsor)/sponsor/pot/eta/[id]/route.ts:15 |
| EE34 | Signed out | GET /sponsor/ledger/export | 401 "Sign in first." | app/(sponsor)/sponsor/ledger/export/route.ts:22 |
| EE35 | Company login | /sponsor/integrations | Redirect to /sponsor; the server actions in integrations/actions.ts still exist but no page renders them | app/(sponsor)/sponsor/integrations/page.tsx |
| EE36 | A live code | "Create a code" (tampered POST) | "You already have a joining code." | lib/data/sponsor-admin.ts:509 |
| EE37 | Code rotated | Employee uses the old code | "That code is not active. Ask whoever put the poster up for a current one..." | lib/data/enrolment.ts:162 |
| EE38 | 50 refused tries on a code | Open /sponsor/code | "Unusually many. Someone may be guessing; a new code costs a reprint." | lib/data/sponsors.ts:375 |
| EE39 | Staff list rule and list uploaded | Employee enrols with an email not on the list | "That does not match what your organisation asks for..." | enrolment.ts:240 |
| EE40 | Enrolled via the list | Upload a list without them, fire billing on day 14 and day 15 plus | Benefit kept for 14 days from removed_at, then paused with a patient notice | lib/data/sponsor-email-list.ts:112 |
| EE41 | Admin | Upload a list with no valid email, or a file over 2 MB | "No email addresses found." or "That file is too large for a staff list." | app/(sponsor)/sponsor/settings/actions.ts:103 |
| EE42 | No email rule yet | Add "Also an employee ID"; add a fourth rule; remove the email rule while the ID rule exists | "Add a work email domain or a staff list first..."; "You can ask for three things at most."; "Remove the employee ID rule first..." | sponsor-admin.ts:545, :554, :620 |
| EE43 | Domain rule on a domain not fully proved | Employee enrols with that domain | Refused with the generic mismatch text | enrolment.ts domain check |
| EE44 | Domain proof mail resent 3 times in an hour | Send again | "Sent three times this hour. Try later." (75 while SIMULATION_RUNNING) | lib/data/sponsor-domains.ts:82 |
| EE45 | Confirm link | Wrong token, or confirm twice | "That link is not valid, or this domain has already been confirmed..." | sponsor-domains.ts:246, :259 |
| EE46 | Domain already claimed by another company | Add it | "We cannot add that domain here. If your organisation already has an account, talk to whoever set it up." | sponsor-domains.ts:167 |
| EE47 | Paused person | Pause again; resume a person not paused by the company | "That benefit cannot be paused now."; "That benefit is not paused by you." | sponsors.ts:514, :549 |
| EE48 | Person on the roster | "End their benefit" without a reason | Button disabled; tampered reason refused "Pick one of the reasons." | app/(sponsor)/sponsor/people/actions.ts:34 |
| EE49 | Company suspended by an operator | Signed-in login clicks; another signs in | Session stops resolving (redirect to sign-in); sign-in says "That email address and password do not match." | lib/sponsor-auth/session.ts:162, sponsor-admin.ts:678 |
| EE50 | Company login | Change password with the wrong current one | "Your current password is not right." | sponsor-users.ts:215 |
| EE51 | ETA document waiting for the company | Save tax details with an invalid tax number | Error from sponsor.tax.errRin; document stays "Needs tax details" | lib/billing/eta/company.ts |

## The console

| id | setup | action | expected | code reference file:line |
|---|---|---|---|---|
| AE1 | one submitted transfer, S1 and S2 both have /admin/transfers open | both press "Confirm" within a second | one UPDATE wins; the other gets "It changed or was decided while you looked. Reload the queue and check the amount again."; one grant, one ledger post, one email | lib/billing/manual.ts:556-576 |
| AE2 | a confirmed transfer | S1 presses "Confirm" again from a stale tab, or "Retry" on it | state not submitted, nothing moves; Retry only runs on grant_failed | lib/billing/manual.ts:562, lib/billing/rail-exceptions.ts retryGrant |
| AE3 | pot top-up confirmed, grant already credited | "Retry" or a second grant run | granted_at claim finds nothing, pot credited once | lib/billing/manual-grants.ts:664 |
| AE4 | P1 re-declares a different amount while the row is submitted | S1 confirms from the old screen | refused because amount and settles are in the WHERE | lib/billing/manual.ts:563-564 |
| AE5 | S1 rejects a transfer | S2 then presses "Confirm" | "That payment is not waiting for a decision." or the stale message; nothing credited; the payer must open a new payment | lib/billing/manual.ts:743, 562 |
| AE6 | reject reason of 9 characters | press "Reject and tell them" | button disabled below 10; server also refuses "Give a reason they can act on. At least a sentence." | lib/billing/manual.ts:730, lib/admin/reason.ts:18 |
| AE7 | session was cancelled or refunded while its transfer waited | S1 confirms the transfer | payment confirmed, session not revived; "Needs a decision" row "Bought nothing" (or "Overpaid" when already paid) | lib/billing/manual-grants.ts:78-120 |
| AE8 | transferWithoutProof on, S1 asked | S1 presses "Complete" on own request | "Complete" hidden for S1 ("Yours. Another admin completes it."); if forced, gate says "You asked for this one. A second person completes it." | lib/billing/approvals.ts:66 |
| AE9 | S1 asked | S1 presses "Decline" | "Only a second person can decline it." (closeApproval WHERE asked_by <> decider, plus DB constraint) | lib/billing/approvals.ts:92, app/(admin)/admin/approval-actions.ts:46 |
| AE10 | a pending transfer_without_proof approval | someone presses "Discard" on the same cart, or the retention cron expires it after 30 days | the cart row is deleted; later "Complete" returns "That payment is not an open one. Refresh and look again." and the approval stays asked forever | app/(admin)/admin/transfers/exception-actions.ts:66, lib/billing/rail-exceptions.ts:142 and 157, app/(admin)/admin/approval-actions.ts:19 |
| AE11 | S1 opens /admin/settings, /admin/vault, /admin/radar, /admin/team or /admin | page load | redirect to /admin/not-yours?from=..., text "Not your role's page. Recorded.", audit `access.refused` | lib/auth/guard.ts:116-128, lib/admin/access.ts refusalDestination |
| AE12 | S1 calls an owner server action (for example `refundPatient`) from devtools | submit | requireRole refuses and redirects; audit row written | app/(admin)/admin/actions.ts:569, lib/auth/guard.ts:101 |
| AE13 | staff account at /login (practice door) | sign in | "That is a back-office account. The staff console signs in at /staff/sign-in." no session created | lib/auth/actions.ts:258-262 |
| AE14 | clinician T1 at /staff/sign-in | sign in | "That is a practice account. Sign in at /login to reach your caseload." | lib/auth/actions.ts:253-256 |
| AE15 | password only, second step not passed | open any /admin URL | redirect to /staff/second-step?next=... ; route handlers answer 401 "Second step required" | lib/auth/guard.ts:40-43, 165-170 |
| AE16 | emailed code older than 10 minutes | type it, "Continue" | "That code did not work."; audit second_factor.failed | lib/auth/second-factor.ts:194, lib/auth/totp.ts:35 |
| AE17 | code already used once | type it again (same or other tab) | used_at not null, refused | lib/auth/second-factor.ts:193 |
| AE18 | code emailed for session A | use it on session B (other browser) | refused, codes are bound to the session | lib/auth/second-factor.ts:191 |
| AE19 | 4th "Email me a code" inside 10 minutes; 11th guess inside 15 minutes | press | "Too many tries. Wait a few minutes." | lib/auth/second-factor.ts:58-62, 149, 272 |
| AE20 | second step passed 12 hours ago | next request | pending again, redirected to /staff/second-step; sessions also end after 2 h idle or 12 h | lib/auth/totp.ts:32 and 52, lib/auth/session.ts:35-37 |
| AE21 | ledgerAdjustments on (default) and FA is the only super_admin | FA posts an adjustment | "Asked. A second admin posts it."; nobody else can press Complete or Decline because both need super_admin and the team page cannot create one; the adjustment never posts. Turn the switch off to test posting | app/(admin)/admin/actions.ts:661-677, app/(admin)/admin/approval-actions.ts:26 and 43, lib/data/admin-team.ts:155 |
| AE22 | verifications switch on, S1 proposed approve | S1 presses "Approve" again | still a proposal, not a decision | lib/data/verification.ts:298-313 |
| AE23 | verifications switch on, S1 proposed approve | S2 presses "Reject" | S2's answer replaces the proposal, nothing decided; a third reviewer agreeing with S2 decides | lib/data/verification.ts:300 |
| AE24 | staff member S1 also holds the clinician account being reviewed | S1 presses Approve | "Not your own." | app/(admin)/admin/actions.ts:337-350, lib/data/verification.ts:285 |
| AE25 | reject with an empty note | "Reject" | "Say what is wrong. They see this word for word." (only non empty is required, not 10 chars) | app/(admin)/admin/actions.ts:353 |
| AE26 | second rejection | "Reject and clear" | documents deleted from storage, columns nulled, applicant must upload again | lib/data/verification.ts:390-411 |
| AE27 | refund queue row whose amount is above what the payer paid (old row, or edited) | "Mark sent" | "More than they paid."; nothing sent | lib/billing/refunds.ts:315 |
| AE28 | vault refund of a payment already refunded | "Refund $X" | "Only a settled payment can be refunded." There is no amount field, so a larger than paid refund cannot be typed | lib/billing/connect.ts:1172 |
| AE29 | refunds switch on, S1 saved the destination | S1 presses "Mark sent" | "Needs a second person." | lib/billing/refunds.ts:351 |
| AE30 | S1 and S2 both press "Mark sent" on the same refund | concurrent | owed to sent WHERE status owed, one wins, one reversal posted; loser "Moved on. Reload." | lib/billing/refunds.ts:409-424 |
| AE31 | refund cancel asked by S1 | S1 presses "Cancel it" | "Needs a second person." | lib/billing/refunds.ts:554 |
| AE32 | pot share return fails (company share not back) | "Mark sent" on the employee row | "Company share not returned."; use "Return to pot" | lib/billing/refunds.ts:388-397 |
| AE33 | payout request by T1 who is also on staff | T1 presses Approve on own payout | "This money is yours." | lib/billing/four-eyes.ts:41 |
| AE34 | payouts switch on, amount above threshold, nobody took it on | S1 presses "Approve" | "Needs a second person."; after S2 "Take it on" S1 can approve | lib/billing/four-eyes.ts:44-50 |
| AE35 | payouts switch on, S1 approved | S1 presses "Mark sent" | "You approved this one. A second person sends it." | lib/billing/payouts.ts:388-398 |
| AE36 | a staff member edited T1's payout details less than 24 h ago | "Approve" or "Mark sent" | "These payout details changed less than 24 hours ago. This payout can go after ... UTC." | lib/billing/payouts.ts:408-431 |
| AE37 | held balance fell below the request after it was made | "Approve" | "We hold $X for them now, less than this request. Reject it so they can ask again." | lib/billing/payouts.ts:499-517 |
| AE38 | two staff press "Mark sent" on one payout | concurrent | guarded move approved to sent, ledger posted once, loser "That request has already moved on. Reload the queue." | lib/billing/payouts.ts:296-333 |
| AE39 | proof "12345" | "Mark sent" | refused "Enter the bank's reference (6 to 40 characters with 4+ digits) or an https link to the receipt." | lib/billing/payouts.ts:537-541 |
| AE40 | pot return asked for more than the pot | "Ask" | "That is more than the pot holds."; second ask while one is open refused | lib/billing/pot-return.ts:49, 60 |
| AE41 | potReturns switch on, S1 asked | S1 presses "Sent" | "A second person sends what the first one asked for." | lib/billing/pot-return.ts:91 |
| AE42 | pot spent below the asked amount between ask and send | "Sent" | "The pot no longer holds that much. Cancel and ask again." | lib/billing/pot-return.ts:96-105 |
| AE43 | any settings group saved | "Save" or "Save rules" | audit row category admin action settings.<group>; rules reason lists every changed field; history table shows who and when | app/(admin)/admin/settings/actions.ts:76, 121, 199, 272, 386, 460, 523, 660 |
| AE44 | an open cart or submitted payment exists | "Save" on transfer fields | "N payments are in flight against these details. Clear the transfers queue first..." | app/(admin)/admin/settings/actions.ts:408 |
| AE45 | FA on /admin/team | "Reset second step" on own row, or change own role | "Not your own. Another owner resets yours." / "Not changeable here." | lib/auth/second-factor.ts:424, lib/data/admin-team.ts:133-134 |
| AE46 | staff deactivated while signed in | next request | all sessions revoked, bounced to sign in | lib/data/admin-team.ts:180-181 |
| AE47 | invite link older than 7 days, or reset link older than 1 hour | open /welcome/[token] | "The link may be old, or the page has moved." | lib/auth/account-links.ts:50-52 |
| AE48 | ticket already owned by S2 | S1 "Take it on" | "Somebody else has already taken that one." | lib/data/support.ts:327-334 |
| AE49 | announcement with confirm number not typed | "Send to N clinicians" | button disabled until the typed number equals N | components/admin/announcement.tsx armed |
| AE50 | radar ban with a 9 character reason | "24h" | buttons disabled; server "Give a reason of ten characters or more." | app/(admin)/admin/actions.ts:913 |
| AE51 | investigate URL without ?why | open | the reason form is shown, transcript not read, no audit row | app/(admin)/admin/radar/investigate/[id]/page.tsx reasonProblem check |
| AE52 | /admin/transfers/receipt/[id] for a payment with no proof | GET | 404 not_found; with proof every open writes an audit row | app/(admin)/admin/transfers/receipt/[id]/route.ts |
| AE53 | payout reject or "Did not arrive" with a 5 to 9 character reason; refund cancel with 5 characters; vault refund with 1 character; report resolution with 4 characters | submit | accepted, below the console's 10 character rule | lib/billing/payouts.ts:866, 936; lib/billing/refunds.ts:525; app/(admin)/admin/actions.ts:572, 1046 |
| AE54 | transfer confirm whose grant throws | "Confirm" | row stays confirmed, exception grant_failed listed, error "The payment was recorded but the account was not updated. It is under Needs a decision."; no transfer.confirm audit row is written | lib/billing/manual.ts:578-599, app/(admin)/admin/transfers/actions.ts:40 |
| AE55 | TV gate open for 20 minutes | wait past it | back to the gate | lib/console/gate.ts:15 |

## Money, jobs, messages and partners

| id | setup | action | expected | code reference file:line |
|---|---|---|---|---|
| ME1 | Any round | Run the books-balance queries | No unbalanced txn, total 0, cash per entity >= 0 | lib/billing/ledger.ts:121-122, 1232-1278 |
| ME2 | Confirmed transfer | Press Confirm twice (two tabs) | Second: "It changed or was decided while you looked" / "not waiting"; one grant | lib/billing/manual.ts:556-576 |
| ME3 | Transfer confirmed but the grant threw after `claimSessionPaid` succeeded | Staff "Retry" in Needs a decision | `grantSession` finds the session already paid and flags "overpaid: refund this transfer", although nothing was posted to the ledger. Expected: post the settlement. Bug candidate | lib/billing/rail-exceptions.ts:72-95; lib/billing/manual-grants.ts:88-123 |
| ME4 | Pot top-up confirmed | Retry the grant | granted_at claim makes it a no-op | lib/billing/manual-grants.ts:661-666 |
| ME5 | Bill payment transfer larger than the bills | Confirm | Bills that fit are paid, rail exception "overpaid $x over the bill" | manual-grants.ts:534-549 |
| ME6 | Bill payment with nothing due | Confirm | Exception not_payable | manual-grants.ts:516-531 |
| ME7 | Session paid by card while a transfer is pending | Confirm the transfer | Exception overpaid, no second ledger posting | manual-grants.ts:89-124, 402-412 |
| ME8 | Pot session payment | Refund twice (patient cancel and admin) | `refundToPot` returns 0 the second time; `postReversalOf` posts nothing the second time | lib/billing/pot.ts:920-932; ledger.ts:666-692 |
| ME9 | Stripe paid session | Two concurrent refunds | The status update after Stripe has no status guard; the second Stripe call fails and callers queue a refund request | lib/billing/connect.ts:1311-1336; lib/data/booking-change.ts:118-137 |
| ME10 | Paymob paid session | Two concurrent refunds | Second gets "This payment is already being returned"; the automatic callers treat any error as "queue it" and open an owed refund request while the payment is still paid; the queue send later fails with errPaid only if the first finished | lib/billing/gateway/session.ts:352-363; connect.ts:1207-1223; lib/data/clinician-cancel.ts:58-76 |
| ME11 | Refund request owed | Two staff press Sent | Conditional UPDATE owed -> sent, one posting | lib/billing/refunds.ts:403-424 |
| ME12 | Pot-funded refund queued | markRefundSent when the sent transaction fails | `refundToPot` already ran outside the transaction; pot credited, payment still paid; a later send reverses correctly because refundToPot is idempotent | refunds.ts:388-398 |
| ME13 | rules.approvals.refunds on | Same staff records the destination and sends | "arefund.destinationSaved" then errTwo for the same person | refunds.ts:337-353 |
| ME14 | Payout requested | Clinician requests a second | Refused; advisory lock stops a double insert | lib/billing/payouts.ts:196-278 |
| ME15 | Payout approved | Held balance fell (a refund reversed earnings) | approve/send refused by `moreThanHeld` | payouts.ts:499-517 |
| ME16 | Payout details edited by staff | Send within 24h | Refused by the cool-down | payouts.ts:408-431 |
| ME17 | Payout sent via provider | Callback arrives twice | Second is ignored (state no longer sending) | payouts.ts:803-825 |
| ME18 | Payout sent | Mark returned | `manual_payout_returned` mirror; held back to before | ledger.ts:1035-1070 |
| ME19 | Stripe held earnings | Cron and admin release at once | No lock: both insert earnings_transfers for the same held amount with different idempotency keys, a double transfer | lib/billing/connect.ts:1549-1630 |
| ME20 | Session paid | finishSession and reconcileMissingCharges race | Invoice insert is idempotent on session_id, but `spendCredit` runs before it and `fee_netted` is posted even when the invoice already existed, so a race can spend credit twice or net the fee twice | lib/billing/service.ts:155-199, 219-260, 302 |
| ME21 | EG clinician with held earnings and netFeeFromHeldEarnings on | Session fee netted | `fee_netted` is forced to entity us while the held money sits on eg, so us cash/revenue and eg payable disagree | lib/billing/service.ts:251-257 |
| ME22 | Stripe session with a wallet hold | Pay by Stripe | Charged full patient share (wallet ignored) and the hold is never spent or released | lib/billing/connect.ts:529, 987-990 |
| ME23 | Paid session refunded with a wallet part | Refund | Wallet part returns as `wallet_credit`; `wallet_return` kind is declared and never written | lib/billing/wallet.ts:279-295; lib/db/schema.ts:2745 |
| ME24 | Wallet credit expires (non-zero expiryMonths) | Balance read | Credit leaves `walletBalanceCents` but no posting releases patient_wallet; the liability stays forever | wallet.ts:51-57 |
| ME25 | returnSpentHold | Crash between the hold update and `creditWallet` | Hold marked returned with no credit (two writes, no transaction) | wallet.ts:280-293 |
| ME26 | Two tabs hold the wallet on one session | holdWallet twice | Unique hold per session; the loser's draws roll back (WalletRace) | wallet.ts:190-201 |
| ME27 | Pot with overdraft | Two bookings race for the last pot money | Conditional UPDATE; loser gets "insufficient" and its provisional use is released | pot.ts:596-615 |
| ME28 | payFromPot | Crash after the pot debit, before the session_payments insert or journal | Balance and ledger drift; `reconcilePots` reports it next billing run | pot.ts:596-807; 1442-1463 |
| ME29 | Card pot top-up | Webhook redelivered | stripe_events claim dedups; `topUpPot` also checks the cash memo (read then write, not atomic) | lib/billing/stripe.ts:613-631; pot.ts:1313-1352 |
| ME30 | Plan by transfer on day 1 | Staff has not confirmed before 03:05 UTC | `lapseOverdue` lapses the obligation (due_at = subscription time); the later payment pays the invoice but `settleOldestObligationByTransfer` only settles `due`, so the plan never becomes entitled and reconcileRenewals flags an invoice with no obligation. Bug candidate | lib/billing/service.ts:916-921, 1123-1138; lib/billing/obligations.ts:223-228 |
| ME31 | Renewal due in 7, 3, 1 days | Billing cron | Nothing is sent: DUNNING_DAYS_BEFORE is only used to count | app/api/cron/[job]/route.ts:346-350; obligations.ts:44,190-214 |
| ME32 | Transfer smaller than the oldest month | Confirm | Obligation not settled, warn log | service.ts:1164-1171 |
| ME33 | Clinic reduces seats | Next month | Upcoming discount shown on /billing, but only `recordCreditPurchaseInvoice` consumes it and credit purchase has no caller; a second reduction overwrites the first | lib/billing/seats.ts:169-176; service.ts:377-443, 812-825 |
| ME34 | Clinic changes seats while another tab changes them | Save | Conditional on the old seat count; "changed while you were looking" | seats.ts:120-136 |
| ME35 | Seat taken past the paid seats | takeSeat | Advisory lock and INSERT ... WHERE seats > occupied | seats.ts:308-318 |
| ME36 | Rounding, fee split | Pot share 1/3 coverage on an odd price | Pot fee = fee - round(fee x employee...), sums exactly to the fee | lib/billing/split-refund.ts:130-148 |
| ME37 | Rounding, top-up VAT | Transfer top-up with VAT | Net recomputed from the settled total by division; may differ by 1 cent from the ladder's credit | lib/billing/manual-grants.ts:646-651; lib/billing/manual-entry.ts:461-503 |
| ME38 | Rounding, card fee | Paymob fee in EGP converted to USD cents | cardFeeCents is a rounded conversion; the fee legs net to zero regardless | gateway/session.ts:91-95, 407-422 |
| ME39 | Currency display | Operator changes egpRateMicro between declare and confirm | Transfer row keeps the EGP it was opened with, but the notices and pending banner recompute EGP at the new rate, so the message quotes a different figure than the payer sent | lib/billing/payment-notices.ts:169-173; lib/billing/pending.ts:160 |
| ME40 | Currency display | Rate change | Clinicians who priced in EGP get session_rate_cents re-derived | lib/billing/egp-rates.ts:17-27 |
| ME41 | Destination charge with VAT | Stripe country with VAT | `postSessionPayment` throws | ledger.ts:434-438 |
| ME42 | Hand adjustment | Same form submitted twice, or a second tab within 10 minutes | Replay returns ok with no posting; twin refused | ledger.ts:893-950 |
| ME43 | Radar session partly pot-funded | Patient abandons | `sweepRadar` skips it because a session_payments row exists; `releaseUnconfirmedBookings` only covers slot bookings; the pot share is never returned and the session stays scheduled | lib/data/radar.ts:1240-1252; lib/data/scheduling.ts:895-906 |
| ME44 | Patient re-books on the radar | Previous radar hold partly pot-funded and unpaid | Previous session cancelled without returning its pot share | app/(public)/radar/actions.ts:265-335 |
| ME45 | Repricing when the two clinicians are in different regions | reassignSession on a paid session | The first `session_repriced` legs carry two organizations; the txn entity is resolved from the first leg only | lib/data/recovery.ts:400-408; ledger.ts:118-119 |
| ME46 | Repricing a Stripe destination payment | Cheaper replacement | therapist_payable debited although destination money never sat in payable; the replacement's held goes negative (negativeHolds) | lib/data/recovery.ts:437-446 |
| ME47 | In-person paid, not started | Link expires | Refund goes to the original rail; rules.inPerson.refundTo = "wallet" is never read | lib/data/in-person.ts:65-86; lib/settings/defs.ts:644-651 |
| ME48 | Cron idempotency | Run billing twice on one day | Aged payouts, pot alerts, limit alerts, partner bill, renewals and lapses do nothing the second time; `sendOneHandDigest` sends again | lib/billing/approvals.ts:186-255 |
| ME49 | Cron idempotency | Run reminders twice | reminded_at stamps, lease on check-ins, claimed webhook rows, conditional ETA moves; releases are conditional on slot state | route.ts:585-804; lib/partner/webhooks.ts:442-459 |
| ME50 | Partner production | Try to approve a partner | Refused because documents_url has no writer anywhere; live keys, live sessions, billing, limits and live webhooks are unreachable | lib/data/partner-admin.ts:273-296 |
| ME51 | Partner key | 61 calls in a minute | 429 with Retry-After (partner key); a sponsor key is suspended instead | lib/partner/keys.ts:351-400 |
| ME52 | Partner key without a scope | Call a route needing it | 403 "This key does not hold <scope>" and the call still counts toward the per-minute bucket | keys.ts:351, 402-405 |
| ME53 | Revoked, suspended or held-partner key | Any call | 401 "That key is not valid." | keys.ts:301-338 |
| ME54 | Sandbox key | readers, notes, write-back | 403 "Use your live key for records." | lib/partner/api.ts:91,191,357 |
| ME55 | Session ref used with the other environment's key | consent POST | 409; GET says 404 | app/api/partner/v1/consent/route.ts:105-107,167-169 |
| ME56 | Partner at its limit | New live session consent | stopped_reason returned; media 409 | lib/partner/platform.ts:100-109, 286-296 |
| ME57 | Webhook endpoint down | Hourly drain | Retries 5, 30, 120, 300, 600 x6 minutes, failed_at after 11 tries | lib/partner/retry.ts |
| ME58 | The clock moves | Any agent clicks | Every login has aged past its idle limit: the agent is sent to sign in again, and retention purges the old sessions. Expected, which is why everyone signs in at the start of each round | lib/auth/session.ts:35,293-305 |
| ME59 | The clock moves | Open this month's bills | Invoices move with every other table, so each bill keeps its place in the month | lib/billing/service.ts:547-557 |
| ME60 | Top-ups in several rounds | Read invoice numbers after each move | Numbers are counted by creation order, and a uniform move keeps the order, so no issued invoice is renumbered | lib/billing/invoice.ts:195-210 |
| ME61 | A session ended in a round with no invoice | The jobs fire at the end of the round, before the clock moves | The backstop charges it inside its 48 hour window. If the clock moved first, the session would fall outside the window and never be charged, which is why the jobs fire before every move too | service.ts:654 |
| ME62 | Rating reminders | A round gap longer than 3 days | Reminders that fall due inside a gap are skipped, because no job runs inside it. A limitation of compressed time; the reminder is walked inside a round instead (`PA18`) | lib/data/feedback.ts:49,797-836 |
| ME63 | Ageing, pot split lookup | A pot row booked before W2-M01 without the shared txn | `potSpendOf` fallback matches a pot leg within one minute of paid_at; both are aged together, so it still matches | lib/billing/pot.ts:1122-1154 |
| ME64 | Partner sessions across a real month end | Fire billing after the clock crosses the month | The month is billed once, with every session in it | lib/partner/billing.ts:158-199 |
| ME65 | Employee removed from the staff email list on day 7 | The clock moves to day 21, jobs fire | The 14-day grace has passed and the employee loses the benefit | lib/data/sponsor-email-list.ts:112-118 |
| ME66 | Any hold, grant or link with an expiry in the database | The clock moves past it, jobs fire | It has expired, on its simulated day | scripts/sim-clock.ts |
| ME67 | Crisis job | A step throws | The step is named in failedSteps, the rest run, the heartbeat is not clean, the watchdog emails | route.ts:138-146, 839-851 |
| ME68 | Reminders job | `releaseUnconfirmedBookings` throws | Not wrapped in `step`: the job returns 500, webhooks and ETA do not run that hour | route.ts:715-745 |
| ME69 | Payment notice to a company | Sponsor pays by transfer | Recipient is the first sponsor user found, with no role or deleted filter | lib/billing/payment-notices.ts:84-103 |
| ME70 | Refund queue EGP figure | payg_session purpose | The queue only looks up purpose session for the EGP to send | lib/billing/refunds.ts:624-636 |
| ME71 | pot expired | Booking | "expired", provisional use released; balance stays until a pot return | pot.ts:537-541 |
| ME72 | Pot return larger than balance | Request or send | Refused at request and again at send (conditional UPDATE) | lib/billing/pot-return.ts:49,95-104 |
| ME73 | Pot return, two people on | Same person asks and sends | Refused | pot-return.ts:91-93 |

---

## Money promises the run must also produce

These are the product's money promises that no single portal owns. Each is set up across two
or more portals, which is why the board matters most here.

| id | setup | action | expected | code reference |
|---|---|---|---|---|
| ME74 | A patient covered 10% by their company books a priced session | Open the pay page | The pot pays its share at booking; the page asks for the remaining share plus VAT on that share only, and the line items say which is which | lib/billing/pot.ts, app/pay/[token]/page.tsx |
| ME75 | Same booking | Compare the pay page figure with the transfer sheet | The two figures agree to the cent, in EGP and on hover in USD | app/pay/[token]/page.tsx, lib/billing/manual.ts openManualPayment |
| ME76 | Same booking | Read the tax line | 14% of the patient's share, never of the full price and never zero | lib/billing/employee-share.ts |
| ME77 | A company-covered session was held | Open `/admin/sponsors/[id]` as staff | One row per sponsored session with share, date and clinician, and no patient name anywhere | app/(admin)/admin/sponsors/[id]/page.tsx |
| ME78 | A half-covered session was held | Open the clinician's `/earnings` | Earnings and our fee are on the full price, not the patient's half | lib/billing/ledger.ts |
| ME79 | A patient opens the transfer sheet, sends the money from a banking app and closes the tab without pressing Submit | Staff open `/admin/transfers` | The awaiting payment is visible to staff as an open cart with its reference, so the money can still be matched | lib/billing/manual.ts openCarts |
| ME80 | A clinician opens the sheet for a bill and decides not to pay | "Cancel this payment" | The cart clears, nothing is owed twice, and the bill stays due | lib/billing/cart.ts cancelCart |
| ME81 | A company's top-up is rejected, then resubmitted and rejected again | Second rejection | The second reason is the operator's own new words, shown verbatim to the company | lib/billing/manual.ts rejectPayment |
| ME82 | A clinician transfers more than the bill (1,000 EGP against 570) | Staff confirm | Staff can see the difference before confirming; the bill is settled and the surplus is a visible line somebody must decide about, never silently kept | lib/billing/manual.ts confirmPayment |
| ME83 | A clinician transfers less than the bills owed | Staff confirm | The bills it covers settle oldest first, the rest stay due, and the clinician's screen says which | lib/billing/obligations.ts |
| ME84 | A clinician with several due bills picks some of them to pay | Open the sheet | The sheet names the chosen bills and the total is summed from what was found, never from what was asked for | lib/billing/cart.ts openCart |
| ME85 | A patient opens the transfer sheet in two tabs | Submit in both | One open payment, one amount in the staff queue | lib/billing/manual.ts:248-318 |
| ME86 | A patient uploaded a receipt, staff are slow, the patient returns an hour later | Open the pay page | The uploaded receipt is shown back, not an empty upload | lib/billing/manual.ts submitProof |
| ME87 | A clinic adds a seat mid-month | Invite a clinician with no free seat | The price for the rest of the month is shown before the manager agrees, and exactly that figure is billed | lib/billing/seats.ts:73 |
| ME88 | A free session (price zero, from the radar or a first free session) | Book and join | No payment page, no cart, no invoice, and the room opens | lib/billing/pending.ts |
| ME89 | A patient in crisis has an unpaid session | Press the SOS orb | The crisis line and the crisis screen open with no payment step in the way | components/patient |

## Found reading the remaining files

The first reading followed each portal from its pages. These came from reading every file it did not reach.

### Patients

| id | setup | action | expected | code reference |
|---|---|---|---|---|
| PE76 | P1 has a photo (PA23.3); T1 holds a patients row for P1; T2 does not | GET `/api/patient/avatar/<P1 personId>` as P1, as T1, as T2, signed out | P1 and T1: the image, `cache-control: private, max-age=300`; T2 and signed out: 404 `not_found` (same as no photo) | app/api/patient/avatar/[personId]/route.ts:62-66, 95-117 |
| PE77 | Speech model unavailable or the document has no text | "tdl.readAloud" on the profile | Route answers 500 `speech_failed` (or 400 `nothing_to_read`); the button stays disabled on "tdl.reading" until reload (bug) | components/documents/document-list.tsx:126-139, app/api/documents/[id]/speak/route.ts:99, 125 |
| PE78 | Patient copy written in Arabic (rtl) | Open `/feedback/<token>` after T1 released it | Paragraphs should align right; the card sets `dir="rtl"` plus `text-end`, which under rtl aligns left | components/clinical/patient-brief-card.tsx:51 |
| PE79 | Two clinicians online, neither with walk-ins in Egypt | On /radar tap Egypt on the globe, or pick filters so nothing matches | Card "nobody matching" with "{count} others available" using the unfiltered online count, and "Show everyone" which clears every filter | components/radar/filters.tsx:25-32, components/radar/public-radar.tsx:140-153, components/radar/radar-hero.tsx:246-267 |
| PE80 | P1 uploaded a photo (PA23.3), then claimed T1's record with "Let this therapist keep seeing my profile" unticked (PA6.5 / PA7.3) | T1 opens `/patients/<id>`, or GETs `/api/patient/avatar/<P1 personId>` | Expected by PA6.5: no live profile, so no photo. Code: photo still served, because `mayRead` only checks that T1 holds a `patients` row, and the page renders the avatar whenever the record is claimed. Looks like a privacy bug | app/api/patient/avatar/[personId]/route.ts:95-116, app/(app)/patients/[id]/page.tsx:152-176 |
| PE81 | P1 with no timezone saved (PA1.1 field left empty), unmuted, reachable | Fire `/api/cron/reminders` repeatedly | No check-in is ever sent to P1: an unknown zone counts as quiet hours | lib/checkins/policy.ts (hourIn null gives quiet_hours) |
| PE82 | Arabic selected | Open /patient/consent decline step, /t/<id> of a rated clinician, /radar dot tooltips and card rating tooltip, partner apply and sign-in buttons while pending | Hardcoded English: the three decline reasons, "from N rated sessions", "Free", "Practice", "Clinician" fallback, "available now / being booked / in a session", "{avg} from {n} sessions", "N clinicians on the radar", "Working…" | lib/access/state.ts:243-247, components/patient/consent-list.tsx:149, components/radar/public-profile.tsx:89, :126, :136, components/radar/globe.tsx:438, components/radar/therapist-card.tsx:67, components/radar/world-radar.tsx:88, components/partner/apply-form.tsx:14 |
| PE83 | P1 signed in with a `+20` number; run once Monday to Thursday 09:00 to 17:00 Cairo and once outside (Friday or evening) | Open the SOS orb | Inside hours: 105 first with "Press 1 for Arabic, then 1 for mental health." and "Likely open now", then 123 and 112. Outside hours: 123 and 112 first, 105 after them marked "Likely closed now". Never 988 | lib/crisis/sos.ts:63-80, lib/crisis/line.ts:111-155 |
| PE84 | Signed-out guest on `/join/<token>` of an `eg` practice in English; separately a signed-out English reader on `/radar` with no country | Open the SOS orb | Guest: Egypt's lines (placed by practice region). Unplaced reader: every ENABLED country's line, each labelled; a country with no line shows only "your local emergency number" | lib/crisis/line.ts:193-205, lib/crisis/sos.ts:104-110 |
| PE85 | T1 verified and listed with specialties | `/patient/browse?q=<T1 surname>` and `?q=a` | Both empty: "Nobody has listed that yet. Try an area below, or open the radar." (names are not searchable, queries under 2 characters return nothing); `?q=anx` finds T1 by specialty | lib/data/discover.ts:312-343 |
| PE86 | T2 has 4 rated sessions, T1 has 5 or more; a demo account is listed | Open `/patient` | T2 shows no stars and is absent from "Rated highest by patients"; T1 appears there; online clinicians lead "Therapists here"; the demo account carries its demo label | lib/data/discover.ts:172-193, 249-274 |
| PE87 | P1 in Arabic, T1 assigns PHQ-9 | Open `/patient/assessments/<id>` | Expected by the seed (locales `en` only, Arabic unreviewed): English questions. Code renders `text.ar`, so the unreviewed Arabic draft is shown. Record which one appears | components/assessments/patient-questionnaire.tsx:107, lib/data/instrument-seeds.ts:73-81 |
| PE88 | T1 recorded first name "Sara" (and a second record "سارة") | Answer the claim name as "  SARA ", as "سَارَة", then as "Sarah", then blank | First two confirm; "Sarah" counts as a wrong answer toward the lock of 3; blank never matches | lib/data/name-match.ts:30-52, lib/data/challenge.ts |
| PE89 | Session ended within 72 h | On `/feedback/<token>` give only therapist stars; then add session stars; then type "nobody" in the email | "Send" disabled until therapist and session stars exist (and service stars unless "Rate 24Therapy" was used); an email without "@" keeps it disabled; empty email is fine | lib/feedback-options.ts:44-57, components/feedback/rating-form.tsx:213 |
| PE90 | P1 signed in, no file with T1 yet | Book T1 from `/patient/t/<T1>`, later book T1 again from `/radar` | T1's `/patients` shows one file for P1, reused; both sessions appear in P1's `/patient/sessions` | lib/data/people.ts:308-353 |
| PE91 | Signup or add-patient phone field | Enter "0100 123 4567" with Egypt; "00201001234567" with any country; a number with Ireland selected; "12345" | +201001234567 twice; "We cannot send messages to that country yet."; "That number looks too short." | lib/phone/e164.ts:74-141 |
| PE92 | P1 session paid 100% by the pot | Open `/patient/billing/receipt/<paymentId>` directly | 404, the same as another person's payment | lib/data/receipts.ts:91-95 |
| PE93 | T2 online on the radar | Visitor A opens T2's booking sheet; visitor B (other browser) and A's second tab look at the radar | A's first tab can book; B and A's second tab see T2 as being booked (the hold is per tab id in sessionStorage) | lib/viewer.ts:17-34, app/(public)/radar/actions.ts reserveForViewing |
| PE94 | P1 has a live partner link | Press "End this" twice (two tabs) | First ends it; second answers "That connection has already ended."; a borrowed subject id ends nothing | lib/data/partner-links.ts:78-101 |

### Therapists

| id | setup | action | expected | code reference |
|---|---|---|---|---|
| TE52 | T1 signed in, no EHR connection started | Open `/api/ehr/callback` (optionally with `?code=x&state=y`) | 303 to `/settings/records?ehr=expired`; page shows "records.outcomeFailed"; pending cookie consumed; nothing stored | app/api/ehr/callback/route.ts:53-61, components/ehr/records-panel.tsx:140-146 |
| TE53 | T1 with no record system | Open `/settings/records?ehr=connected` by hand | Page shows "records.outcomeConnected" although nothing is connected (the sentence trusts the query) | components/ehr/records-panel.tsx:140 |
| TE54 | T1 signed in | Open `/api/meetings/callback/zoom?code=x&state=y` and `/api/meetings/callback/nope` | Both redirect to /settings/integrations with no message; no `meeting_connections` row; signed out bounces to /login | app/api/meetings/callback/[provider]/route.ts:37-63 |
| TE55 | T2 knows T1's session id | Open `/sessions/<id>/room` | 404 from `app/(room)/not-found.tsx` with "nf.back" to /sessions; the heading is dark text on the navy room ground (bug) | app/(room)/sessions/[id]/room/page.tsx:27, app/(room)/layout.tsx:5, components/patient/route-not-found.tsx |
| TE56 | T1 signed in | Open `/patients/not-a-uuid` (and a visitor opens `/t/not-a-uuid`) | Expected a 404; the id goes straight into an `eq()` on a uuid column, so Postgres likely throws and the portal boundary shows "common.somethingWrong" with "common.retry" (public: RouteError with orb). Record which one appears | lib/data/patients.ts:119-124, lib/data/radar.ts:605, app/(app)/error.tsx, app/(public)/error.tsx |
| TE57 | T1 idle 2 h, then opens `/patients?x=1` | Any request | `/session-expired?next=/patients` then `/login?expired=1&next=%2Fpatients`; after sign-in lands on /patients | lib/auth/guard.ts:69-88, app/session-expired/route.ts:28-42 |
| TE58 | T1 on Arabic, crisis wording in the audio | Live room | RiskBanner title interpolates the raw enum ("high", "critical") inside the Arabic sentence | components/clinical/risk-banner.tsx:67 |
| TE59 | T1 on Arabic, a flagged uploaded document | Open `/patients/[id]/documents`, "tdl.open" on a PDF | Badge reads "Flagged: not mine" and the link reads "Open {title}" in English | components/documents/document-list.tsx:170, 290 |
| TE60 | T1 on Arabic, a paid session with no patient name | Open `/earnings` | Row reads "A patient" and "of $x" in English | components/billing/payment-history.tsx:89, 107 |
| TE61 | T1 has asked 50 questions on /assistant this calendar month (UTC) | Ask a 51st | "You have used all 50 general questions this month. They reset on the 1st..." and no model call. The calendar month is the real one, and the simulated month crosses a real month start, so the allowance resets once during the run | lib/ai/assistant.ts:290-310, app/(app)/assistant/actions.ts:45-52 |
| TE62 | Live video session for a granted, claimed patient (TH8.3) | In another tab add a document or dictation to that patient (TH11.3, which runs `regenerateProfile`), then "Ask" in the room copilot | Expected: "I only know what came before this session". Code: the standing profile rebuilt during the session reaches the in-room copilot because `profileFor` ignores its `before` bound. Looks like a bug | lib/ai/case-copilot.ts:465-476, app/(app)/patients/[id]/documents/actions.ts:78 |
| TE63 | Live session, crisis scan on | Fake audio A: "My brother tried to kill himself years ago, that is over." Fake audio B: "I know my brother tried to kill himself years ago, that is over." | A raises no crisis alert (third party plus resolved past). B raises one, because the present marker "now" is matched as a substring of "know" and cancels the suppression. Over-alerting, not under-alerting | lib/crisis/context.ts:240, :301, :323, lib/crisis/fold.ts (contains) |
| TE64 | T1 approved | POST the `/settings` "Save details" form with a changed licence number (fields are read-only on screen) | Names saved; licence fields unchanged; no `pending_licence` written; only "Change licence" on `/onboarding` creates a request | lib/data/licence-change.ts:38-97 |
| TE65 | T1 added "My format" and made it the default | "Remove" it on `/settings` (The copilot) | Default returns to SOAP; next note is SOAP; notes already written in it keep its name on `/notes` | lib/data/note-formats.ts:146-172, 80-96 |
| TE66 | Session with the primary SOAP note and a second format written via "Also write it as"; patient copy still draft | Sign the second-format note first | The signed note becomes primary; the patient copy offered for release is that note's; signing the SOAP afterwards does not move it back | lib/data/note-record.ts:297-340 |
| TE67 | Completed session, approval card | Type "She was diagnosed with GAD" (or fewer than 20 characters) in "Add a version to their clinical summary", "Publish what is ticked" | Refused: "This reads like a clinical note rather than something written to the patient: "diagnosed with". Rewrite it in the words you would use out loud." or "A summary needs to say something. Write a few sentences."; no version written | lib/data/summaries.ts:49-86, 146-153 |
| TE68 | `/patients/<id>/documents` "Add a file" | Upload a text PDF, a two-column PDF, a phone photo, a .docx, a .zip, and a 26 MB file | Labels "Searchable", "Stored, but not searchable", "Image, not searchable", "Searchable"; the zip refused "We can take a photo, a scan, a PDF, a Word file or plain text."; 26 MB refused "That file is over 25 MB. Try photographing fewer pages at a time." Labels stay English under Arabic | lib/documents/formats.ts:30-120, lib/documents/layout.ts:146, lib/documents/extract.ts:37-99 |
| TE69 | T1 uploaded ID and licence | T2 (clinician) and S1 (staff) GET `/api/uploads/<T1 verification id>.idFront` | T2 refused; S1 gets the image and an audit row is written; a malformed id or unknown kind resolves nothing | lib/documents/identity-access.ts:102-152, lib/documents/identity-rule.ts:15-22 |
| TE70 | T1 added a document to P1; T2 has no file for P1 | T2 GETs `/api/documents/<docId>`; T1's grant is revoked, then T1 GETs a document T1 uploaded | T2 refused; T1 still reads its own upload; P1 signed in reads any of their own documents | lib/documents/read-access.ts:37-92 |
| TE71 | TH8.8 credential issued for session A | POST wav to B's `/api/sessions/<B>/transcribe` with A's token; POST after "Revoke it"; POST 6 h after issue | Each answers 401 `{"error":"unauthorized"}`; a valid post is accepted and counted | lib/ingest/token.ts:106-160, lib/data/session-sources.ts:111-178, app/api/sessions/[id]/transcribe/route.ts:78-91 |
| TE72 | `/on-call` "Your practice" | Type "30.0444, 31.2357" and "Find"; then type "Zam" | Coordinates accepted as the point with no geocoder call; under 4 characters returns no hits | lib/geocode.ts:37-39, 109-119, app/(app)/on-call/actions.ts:203-245 |
| TE73 | T1 live on the radar with a booked hour starting in 14 minutes | Look at `/radar`; later sit in a live session 9 minutes before the next booking | T1 not listed from 15 minutes before until the end of the hour; the room shows the next-booking warning with minutes rounded up | lib/scheduling/hours.ts:47-123, lib/data/scheduling.ts:368, app/api/sessions/[id]/state/route.ts:100 |
| TE74 | Consent granted, fake audio says "I have written letters to my mum and my brother and put them in the drawer" (no crisis keyword) | End the session, open `/sessions/<id>` | Risk card level at least "elevated" when the classifier returns `plan`; with the classifier failing the level is "none" (no keyword). Model-dependent: record, do not fail on it | lib/crisis/level.ts:121-168, lib/data/session-risk.ts:93-147 |
| TE75 | T1 had an elevated alert on P1's session last week; P2's session today raises one | Open P2's `/sessions/<id>` | "Before this session" lists P1's alert as if it were P2's history (bug) | lib/data/session-risk.ts:245-270 |
| TE76 | Unfinished session | "Cancel this session" with a 2-character reason, then with 400 characters | Refused as TE27; the long one is stored and sent trimmed to 300 characters | lib/sessions/cancel-reason.ts:8-13 |
| TE77 | Any completed video session with two tracks | Open `/sessions/<id>` | "Who is speaking" always reads "No separate voices were detected in this session."; "This is me" never appears because nothing writes `session_voices` | lib/data/session-voices.ts:39 (no caller), components/session/voices-panel.tsx:80 |

### Clinics

| id | setup | action | expected | code reference |
|---|---|---|---|---|
| CE42 | Clinic admin signed in (optionally also signed in as a clinician in the same browser) | Open `/api/ehr/callback` | 303 to `/clinic/records?ehr=expired` (the clinic cookie wins over the clinician cookie); failure sentence shown | app/api/ehr/callback/route.ts:51-61 |
| CE43 | A guest joins a clinic clinician's session as `=HYPERLINK("http://x","y")` | Admin downloads the week CSV on `/clinic` | The Who cell starts with a single quote, so the spreadsheet shows text, not a formula; `-12.50` style amounts are left as numbers | lib/csv.ts:13-25 |
| CE44 | Only if `features.ehr` is on (skip on live, where TH17.2 applies) | "Continue" with an `http://` FHIR URL, then a server whose token endpoint is on another host | "That FHIR base URL is not https." and "That server's token endpoint is on a different host from its FHIR base. We will not send a credential there." | lib/ehr/smart.ts:59-129, lib/data/ehr.ts:34-51 |

### The console

| id | setup | action | expected | code reference |
|---|---|---|---|---|
| AE56 | S1 signed in, idle 2 h on /admin/transfers | Click anything | Guard sees the cookie and sends `/session-expired`, which always redirects to `/login?expired=1&next=/admin/transfers`; signing in there is refused "That is a back-office account..." (AE13). Expected: `/staff/sign-in`, as a cookie-less admin gets (bug) | app/session-expired/route.ts:34, lib/auth/guard.ts:86-87, lib/auth/actions.ts:258-262 |
| AE57 | Any visitor | Open `/staff/sign-in` and `/staff/second-step` | Page renders an empty `<h1>` (QuietAuthShell always renders the heading; both pages pass `title=""`) | components/auth/auth-shell.tsx:216, app/(auth)/staff/sign-in/page.tsx:37, app/(auth)/staff/second-step/page.tsx:46 |
| AE58 | P1 enrolled with company C1 (primary, funds sessions) and also enrolled with company C2 | Book a pot-funded session, then open `/admin/sponsors/<C2>` | Expected: nothing under C2. Code: the C1-funded session is listed under C2's "Where the pot went", and C2's "Ledger" card reads "Out by" | lib/console/pot-trace.ts:104-117, :123-133 |
| AE59 | P1 enrolled with C1, benefit ended (CO9.3), then enrolled again with the same code (PA25.2) | Book a pot-funded session, open `/admin/sponsors/<C1>` | Each funded session appears once per enrolment row, so twice, and the spent total doubles ("Out by") | lib/console/pot-trace.ts:104-117 |
| AE60 | FA on /admin/content editor | Save a block with "This subscription pays for itself", then with "Earn up to $500 more", then the Arabic "الاشتراك يغطي نفسه" | First two refused with the honesty message naming the phrase; the Arabic claim is saved, because every rule is an English regex | lib/content/honesty.ts (FEE_CLAIMS, EARNINGS_CLAIMS) |
| AE61 | FA on /admin/content editor | Set a hero `backgroundImage` to `javascript:alert(1)` or `x) ;background:red` and a competitor `logo` to any external URL; save and publish | The background image is silently dropped (no error shown); the competitor logo URL is kept as typed and loads from that host on the public page | lib/content/sanitise.ts (URL_KEYS only backgroundImage), lib/content/url.ts, components/public/comparison.tsx:80-82 |
| AE62 | TV gate open | Open a session or a person with a 9 character reason | "reason too short" (`atv.reasonShort`), nothing returned and no audit row; with 10 characters one phi_access row per read | lib/console/reads.ts:381-446 |
| AE63 | S1 on /admin/transfers, /admin/audit or /admin/patients | Search with one character; open `?page=0`, `?page=-3`, `?page=abc` | One-character search is ignored (full list); every bad page number shows page 1; a `%` or `_` in the search is matched literally | lib/admin/paging.ts:16-31 |
| AE64 | FA on `/admin/strings` (ar) | Save an empty override; tick a `crisis.` key with others and approve; set a new language public at under 100% | "An empty override would blank the button. Clear it instead to restore the shipped wording."; "N of these are crisis, consent or recording strings. Those are approved one at a time, by somebody who has read them."; "{name} is {p}% translated, ... A language goes live complete or not at all." | lib/i18n/authoring.ts:61-75, 216-222, 354-365 |
| AE65 | A new language whose drafts cover all but 5 keys | Tick public and "Save language" | Expected refusal; the check compares a rounded percent (99.7 rounds to 100) so it goes live with 5 English strings (bug) | lib/i18n/strings.ts:292-302, lib/i18n/authoring.ts:216-218 |
| AE66 | FA on `/admin/taxonomy` | Add "Anxiety" again; add "A"; add a country; add a custom specialty "Grief groups" and have T1 pick it | "That is already on the list."; "Too short."; "Countries come from the map itself, ask us to add one."; the custom one appears in the patient category grid only once a verified clinician lists it | lib/data/taxonomy.ts:278-302, lib/data/discover.ts:283-301 |
| AE67 | FA on `/admin/actuals` | Record capital of 0; set an existing month's "Hosting" to 0; S1 opens `/admin/actuals` | "An amount that is not a positive number is not money in."; the hosting line disappears and the audit says `cost.corrected` with the old amount; S1 refused | lib/data/capital.ts:187-326 |
| AE68 | EG crisis line verified by FA last week | S1 or FA saves the EG country card changing only VAT | Expected: crisis line verification date and person unchanged. Code re-stamps `crisis_line_verified_at` and `_by` to the saver on every save (bug) | lib/settings/index.ts:211-212, 233-234 |
| AE69 | FA types an `@example.com` address | "Send them all" | 26 messages reach the outbox (AD14.8 says 14); several preview links point at routes that do not exist (`/reset/DEMO-TOKEN`, `/claim/DEMO-TOKEN`, `/export/DEMO-TOKEN`, `/sponsor/billing`, `/sponsor/confirm/DEMO-TOKEN`) | lib/mail-previews.ts:151-485 |
| AE70 | Pricing tiers changed in AD14.1 | Read the traction tiles on `/admin/settings` | MRR equals paying organisations times $99 whatever the tier prices (hard-coded) | lib/data/vault.ts:395-429 |

### Money, jobs, messages and partners

| id | setup | action | expected | code reference |
|---|---|---|---|---|
| ME90 | Any caller, no auth | POST `/api/meetings/transcript/<random uuid>` with `{"bot_id":"x"}`; with no bot_id; with bad JSON; with a real session id and a wrong bot id | 200 `{ok:true}` for an unknown session (no existence leak); 400 `no bot`; 400 `malformed`; 409 `refused` when the bot is not ours (bot removed, audited). With consent and our bot: `{ok:true, processed:true}` but no transcript segment is written | app/api/meetings/transcript/[sessionId]/route.ts:55-118 |
| ME91 | Sandbox partner session with consent and transcript, note not approved | GET `.../sessions/<ref>/summary`; then POST `.../note` with text and approved_by; GET summary again | First GET 409 "Nobody has approved this session's note yet..."; after approval 200 with a draft (a new model call on every GET); POST summary before approval also refused by `deliverSummary` | app/api/partner/v1/sessions/[ref]/summary/route.ts:58-77, 107-112 |
| ME92 | Key with copilot:chat | POST `/api/partner/v1/copilot` for a clinician never enabled; PUT `{clinician, enabled:true}`; POST again; POST with a missing field | 403 "That clinician has not turned the copilot on..."; PUT returns `{clinician, enabled:true}`; POST answers with citations; missing field 400 "Send subject, clinician and question." | app/api/partner/v1/copilot/route.ts:49-91, 117-131 |
| ME93 | Key with note:review | POST `.../note` with text but no approved_by | 400 "Send text and approved_by..." ; nothing approved | app/api/partner/v1/sessions/[ref]/note/route.ts:112-120 |
| ME94 | Partner with a failed delivery; one admin and one developer login | Open `/partner/deliveries` as each | Both see the row (state Failed or Pending with next try); only the admin sees "dev.redeliver", and not for a disabled endpoint | app/(partner)/partner/deliveries/page.tsx:114 |
| ME95 | Signed out | Open `/partner/reset` with no token, submit a password | Form renders; submit refused by `setPartnerPassword` because the token is empty | app/(partner)/partner/reset/page.tsx:30 |
| ME96 | Live subject who withdrew consent or unlinked (PA20.6) | GET `/api/partner/v1/subjects/<ref>/memory` and POST copilot for that subject | `subjectRefusal` status and sentence before any material is read | app/api/partner/v1/subjects/[ref]/memory/route.ts:44-45, app/api/partner/v1/copilot/route.ts:58-59 |
| ME97 | Visitor on /contact | Send a valid message with an attachment the upload refuses (too large or wrong type) | Ticket still filed: "Received" with reference and hours, plus an amber line that the attachment did not attach; a filled honeypot answers reference "RECEIVED" and files nothing | app/(public)/contact/actions.ts:37-80, components/public/contact-form.tsx:92-117 |
| ME98 | Visitor at 390 px width on any public page | Look for the language switch in the header and in the menu sheet | Not there: the header switch is `hidden sm:inline-flex` and the mobile sheet renders no switch, so a phone reader of the marketing site cannot change language (PA27.4 says every page) | components/public/site-chrome.tsx:109-113, components/public/mobile-nav.tsx:99-137 |
| ME99 | /pricing rendered once | FA changes "Platform fee" or "Our cut (%)" (AD14.2) or the pounds rate (AD14.4), then opens /pricing | Expected: new figures. Code: only `savePricing` calls `revalidatePath("/pricing")`; the page is `revalidate = false`, so the fee, the cut and the EGP toggle stay stale until a pricing save or POST /api/revalidate | app/(admin)/admin/settings/actions.ts:127-128 (only), :175, :204, app/(public)/[slug]/page.tsx:16, components/public/pricing-tiers.tsx:106, :137, :217 |
| ME100 | Simulation running on production (`SIMULATION_RUNNING`) | Open any page on any portal | Violet strip `sim.banner` with the database endpoint at the top of every page; it must be gone once the run is closed | components/simulation-banner.tsx:45-83, app/layout.tsx |
| ME101 | Arabic selected | Open /contact | Expected: registered addresses or nothing. Default content prints the admin instruction "اضبط العنوان المسجل من لوحة الإدارة ← المحتوى ← تواصل." as each company's address (English defaults use an empty address, which hides the row). Check whether the live CMS row still carries it | lib/content/defaults-ar.ts:794, :802, components/public/blocks.tsx:859-868 |
| ME102 | Partner user with role developer | Open /partner, /partner/webhooks, /partner/usage, /partner/team; POST `createKey` or `saveLimit` directly | No create, rotate, revoke, add webhook, disable, limit or invite controls; direct posts refused by `requirePartnerAdmin` | app/(partner)/partner/page.tsx:66, app/(partner)/partner/actions.ts:25-27, :86-87 |
| ME103 | Partner admin with a live endpoint | Press "Disable" on the endpoint | Disabled at once with no confirm step (key revoke asks first); row shows the revoked label and no test button | components/partner/webhook-list.tsx:86-96 |
| ME104 | Partner admin with a sandbox key | Rotate with overlap "Now" (0), then another with 24 h | Overlap 0: old key answers 401 at once. 24 h: both keys work, old row shows "stops at {date}" and no Rotate button; new raw key shown once | components/partner/key-list.tsx:133-218, app/(partner)/partner/actions.ts:59-73 |
| ME105 | Partner admin on `/partner/webhooks` | Register `https://user:pw@hooks.example.com/x`, `https://10.0.0.5/x`, `https://box.internal/x` | "Put no username or password in the address." and "That address is not on the public internet." twice; a public name that later resolves to a private address is not delivered to | lib/net/public-url.ts:58-94 |
| ME106 | Partner user with the developer role | POST create key or register webhook; stay idle 31 minutes | Redirect to `/partner`, nothing written; after idle the next click lands on `/partner/sign-in` | lib/partner-auth/guard.ts:40-44, lib/partner-auth/session.ts:54-131 |
| ME107 | Sandbox key with consent:write | POST consent given at offset_seconds 600; POST another with answered_at tomorrow; POST withdrawn with an older answered_at | Coverage "Recording started 10 minutes into this session. Nothing before that was recorded, and nothing here was written from it."; the future time is clamped to now; the older withdrawal does not win over the later yes | lib/partner/consent.ts:51-145 |
| ME108 | Consent from 600 s | POST audio/mpeg with `X-Audio-Start-Seconds: 0`; POST audio/wav from 0 lasting 900 s; POST a wav entirely before 600 s | 422 "This audio starts before the patient consented, and we can only cut WAV. ..."; the wav is cut and only its last 300 s transcribed; the early wav is accepted and nothing kept | lib/partner/media.ts:46-78, lib/partner/wav.ts:65-86 |
| ME109 | Session with transcript, draft and approved note | POST consent withdrawn, then GET transcript and note | Transcript, draft and summary purged; the approved note stays | lib/partner/media.ts:144-163 |
| ME110 | Session with a draft | POST note approval with no clinician; approve twice; POST summary before any approval | "A note needs the clinician who approved it. ..."; "That note has already been approved."; "Nobody has approved this session's note yet. ..." | lib/partner/notes.ts:90-178 |
| ME111 | Subject that unlinked in PA20.6; another that withdrew; a third with no ended session | POST copilot and GET memory for each | 403 "This person has unlinked from your platform, so nothing about them is read for it."; 403 "This person has withdrawn their consent, so their sessions are not read."; "There are no completed sessions for this person yet, so there is nothing for me to read." | lib/partner/copilot.ts:69-195, app/api/partner/v1/copilot/route.ts:58 |
| ME112 | Sponsor-owned key with employment:verify | POST an identifier nobody enrolled; enrol with it on `/patient/benefit`, POST within minutes, POST again | 404 "There is no live enrolment attempt to answer about. ..."; then `{active, as_of}`; the second call 404 (one attestation answers once) | lib/partner/employment.ts:87-212 |
| ME113 | Any page | Read response headers on `/`, `/patient`, `/join/<token>`, `/sessions/<id>/room` | `content-security-policy` with a new nonce each load and no `unsafe-eval`, except the clinician room which adds it; the Daily room still connects | lib/security/csp.ts:130-247, middleware.ts:137-176 |
