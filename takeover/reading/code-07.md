# Slice 07: app-clinician-api

Reader notes, written as I go. Page entries carry a "Screen" line for the redesign: what the
screen is for, what a person does next, empty states, which promise it serves.

## Files

### app/(app)/assistant/actions.ts (126 lines)
- For: server actions for the general (non-patient) copilot: `ask`, `startThread`, `removeThread`, `savePrefs`.
- Decides: `ask` (34) trims, caps 2000 chars, scopes the thread by `threadFor(actor.userId, threadId)` (42), checks `assistantAllowance` BEFORE the model call and BEFORE storing the question (45-53), stores therapist message then model answer with server-resolved `mentions` (75-86). Model failure returns a generic sentence (96) but the question row was already appended (57), so a failed ask leaves an unanswered question in the thread and did not spend allowance (allowance counts presumably answered messages; cannot tell from here).
- Assumes: `lib/ai/assistant.ts` has no import that reaches transcripts/notes/documents (page comment 21-23). Mentions are resolved against "the real roster", so the general assistant does know patient NAMES.
- Promises: none of the 25 directly. Supports the README invariant "patient never talks to a model" (clinician-only surface).
- Notes: `savePrefs` (117) accepts `language` and `voiceSpeed` unvalidated at this layer; validation, if any, is in `saveAssistantPrefs`.

### app/(app)/assistant/page.tsx (77 lines)
- For: the general copilot chat page.
- Screen: a clinician asks general clinical/admin questions not tied to one patient. Next action: type a question. Empty state: none by design; a first visit silently creates a thread (41) so the page is never empty. Monthly allowance (used/limit) is passed to the chat. A one-time preferences prompt (voice, language) shows until `prefs.setAt` is set (61). Promise: none.
- Decides: `thread` from the URL is used as `threadId` unchecked (41); `messagesIn(actor.userId, ...)` is user-scoped so a foreign id renders an empty chat, and `ask` refuses it.
- Notes: a GET of this page with no threads WRITES a thread row (side effect on render).

### app/(app)/billing/actions.ts (465 lines)
- For: the clinician/clinic bill: subscription upgrade, cancel/resume, Stripe invoice checkout, Egyptian transfer declaration, seat quotes and changes, invoice picker quote, open/cancel cart.
- Decides: `startSubscription` (56) is deliberately NOT exported (76.34); only a tier key crosses the wire. Egyptian orgs (`organizationNeedsTransfer`) get `subscribeByTransfer` which raises an invoice; the plan starts on operator confirmation (A1). `cancelPlan` (109) no confirm, reversible by `resumePlan` (117). `payInvoices` (128) Stripe checkout for any list of ids, org-scoped inside `createInvoiceCheckout`. `declareBillTransfer` (165) re-asks the rail (177), reads the amount from the open cart or `billingSummary().outstandingCents` (197-199), never from the form; uploads optional proof; `declarePaid` with purpose `subscription`, refId = organisation. `quoteSeats` / `saveSeats` (258/291) two-step, `fromSeats` guards against a stale quote. `quoteInvoices` (343) prices EGP server-side, writes nothing. `openBillPayment` (380) opens an `awaiting_proof` cart for the chosen invoices. `upgradeAndPay` (443) raise bill then open cart. `cancelBillPayment` (460) payer-scoped, refuses past awaiting_proof (claimed in lib).
- Assumes: `billLines` WHERE pins org and due state (406-408 comment); partial unique index on manual_payments = one claim in flight per org (157); `cancelCart` refuses past awaiting_proof.
- Promises: A1 kept here (subscription by transfer starts only on confirm, 69, claimed); T3 not here.
- Notes: `quoteSeats`/`saveSeats` have no role check at this layer: any user of the org (a clinic seat therapist?) can change the clinic's seat count if `applySeatChange` does not check role. See Suspect. `declareBillTransfer` if the cart covers four of eleven invoices and `livePaymentFor` returns null (cart cancelled in another tab), it declares the WHOLE outstanding (199); the sheet the payer read may have said the smaller figure.

### app/(app)/billing/page.tsx (374 lines)
- For: "what you owe 24Therapy": plan card, seat manager (clinic), Egyptian transfer bill picker + sheet, first-free and credit banners, link to /earnings, ledger both directions.
- Screen: the clinician opens it to pay. Next action: on the Egyptian rail, pick invoices then open the transfer sheet (BillPicker), or cancel an open payment; on card, pay from the ledger picker; upgrade plan. Empty states: no billing feature -> amber "noPayments" (138); no outstanding -> no sheet at all; first session free banner (277). Promise: T3 partly (a pointer showing held and earned, 312-319, not the netting; the netting is on /earnings), A1/A3 via the rail sheet.
- Decides: `?checkout=` any non-"cancelled" value calls `confirmCheckout(checkout)` on render (42-44) and ALWAYS shows the green "paid" banner (127-131) regardless of whether confirmation succeeded. Rail chosen once by `organizationNeedsTransfer` (92); audience "clinic" iff `seatBill.seats > 0` (101, 256). Ledger `payable={!needsTransfer}` hides the Stripe picker on the transfer rail (341).
- Assumes: `confirmCheckout` verifies the Stripe session belongs to this org and is paid (not visible here). `manualEntry` renders rejection reasons (not visible here).
- Notes: the payments list carries `patientName` (359) on the clinician's own page, which C243 permits only for the reader; it is the patient not the payer, so the sponsor is not revealed here unless patientName falls back to a payer name (lib/billing/connect `recentPayments`, not in slice).

### app/(app)/bookings/actions.ts (148 lines)
- For: the clinician's calendar actions: publish hours, close an open hour, invite an existing patient into an open hour.
- Decides: `openHoursOn` (24) -> `publishHours` actor-scoped. `closeHour` (46) conditional on status open. `invitePatient` (81): `getPatient` caseload check (87), `accessFor` refuses only state "revoked" (91); then `bookSlot` with the patient id; then `notify` email/WhatsApp with link `${env.appUrl}/sessions/${sessionId}` (127). A failed delivery returns ok plus an error sentence (139-145).
- Promises: P2 at risk: the invitation is email/WhatsApp only from this action; whether it also lands in the patient's app depends on `notify` writing an in-app row (not here). The link `/sessions/<id>` is the THERAPIST portal route (`app/(app)/sessions/[id]`), see Suspect.
- Notes: `bookSlot` with `patientId` given, the unclaimed / no-relationship states are allowed (only revoked refused).

### app/(app)/bookings/page.tsx (87 lines)
- For: "Your calendar", the month/week calendar of published hours and bookings.
- Screen: the clinician answers "what does my Thursday look like", opens hours, closes hours, invites a patient into an open hour. Empty state: delegated to `components/scheduling/calendar`. Promise: none directly; supports P2/T4 upstream.
- Decides: 60 days of hours (47); `bookedNames` gives patient names for booked slots only (79).
- Notes: whether bookings are visible without expanding a day is decided by `components/scheduling/calendar.tsx` (not in slice); see Suspect entry for what I found by grep.

### app/(app)/connect/actions.ts (67 lines)
- For: portability: redeem a patient's invite code (`useInviteCode`), answer a patient's request for history (`answerHistoryAsk`).
- Decides: redeem creates a pending request, returns first name only (18-20); works before verification, grant cannot activate until approval (DB, 22-24, trigger 0060). Decline needs a reason, DB refuses without (47); patient reads it verbatim.
- Promises: P4 (patient decides who reads) supported, kept as far as this layer shows.

### app/(app)/connect/page.tsx (45 lines)
- For: where a clinician meets patient-initiated portability: redeem code, answer history asks.
- Screen: next action: type the code a patient gave you; answer each pending history ask (add or decline with reason). Empty state: in `HistoryAsks` component (not in slice). Promise: P4.
- Notes: ask name falls back to the English literal "A former patient" (37), not translated.

### app/(app)/copilot/[patientId]/page.tsx (162 lines)
- For: the per-patient copilot thread.
- Screen: a clinician asks about one patient, sees answers with citations, corrects it, picks reply language/voice; back link to the profile. Access banner above the chat when degraded (91-101). Collapsed history of sessions (102-136). Empty state: no history -> history card omitted; chat component handles empty thread. Promise: T5.
- Decides: `copilotViewFor(actor, patientId)` null -> 404 (39-40), the scope check.
- Notes: session history `noteSummary.summary` shown in the list (125) even for drafts? `getPatientHistory` decides; a draft summary in the clinician's own portal is fine for P3.

### app/(app)/copilot/actions.ts (251 lines)
- For: ask the patient copilot, correct it, set reply language, remove a correction, reset the conversation.
- Decides: `askCopilot` (32): `getOrCreateThread` caseload scope (42), `accessFor` checked on EVERY question before quota (55-61), a live session makes the question free and unmetered (75-79, C210), audit read (96), stamp live session id (111-116), pass `capabilities` down (141). `resetCopilot` keeps in-session messages and transcripts (231-235).
- Promises: T5 PARTLY. `accessFor` is re-read per question, so state changes apply on the next question. But `lib/access/state.ts:157-176` gives `copilot: true` in the `revoked` state (degraded to the therapist's own material). The promise says "a revoked grant stops it on the next question"; the code keeps answering over the clinician's own transcripts/notes. Whether "stops" means that is a copy/promise question. The citation half (answer with the source sentence) is in `lib/ai/case-copilot.ts`, not here.
- Notes: `correctCopilot`, `setCopilotLanguage`, `removeCorrection` do not check `accessFor`, only caseload scope; they touch the clinician's own thread, harmless.

### app/(app)/copilot/live/route.ts (43 lines)
- For: polling GET "is this patient in a session now", returns `{live, sessionId}`.
- Decides: `requireUserApi`, `liveSessionForPatient` scoped to caseload and bounded by session clock (C224). no-store.
- Promises: none.

### app/(app)/copilot/page.tsx (118 lines)
- For: copilot inbox, one row per patient with a thread plus "start" list for patients without one.
- Screen: next action: tap a patient. Empty state: no threads and no patients -> "none" card (49-57). Credit banner states messages per patient per session and credit expiry months (42-47). Promise: T5.
- Notes: English literals "sessions on record" (82) and "sessions" badge (107) untranslated.

### app/(app)/dashboard/page.tsx (252 lines)
- For: the clinician home.
- Screen: greets by name and local date; next actions in order: Start a session (primary), a country-has-no-rail warning (88-95), the radar card to go on call, crisis alerts (red, 142-164), drafts waiting (166-183, T1), recent five sessions, plan and outstanding amount. Empty state: no sessions -> EmptyState (193-197). Promise: T1 (drafts count), P5 indirectly (crisis alerts to clinician), T3 no.
- Decides: a session row links to `/sessions/<id>` only when `completed`, else to `/room` (203-207), so a cancelled or no-show session opens the room.
- Notes: "The radar is not open in your country yet" is a hardcoded English string (91). Crisis alert link falls back to `/sessions`.

### app/(app)/earnings/actions.ts (88 lines)
- For: payout destination and withdrawal request on the manual (Egyptian) rail.
- Decides: `savePayoutDestination` (23) method must be in `PAYOUT_METHODS`; stamps `editedByUserId` even for self edits (C74, 41-45). `requestWithdrawal` (63) takes a dollar figure from the form, `Math.round(dollars*100)`; all checks against held/available are in `requestManualPayout` (lib/billing/payouts). NaN input ("abc") becomes `Math.round(NaN)` = NaN cents passed to the lib.
- Promises: T3 depends on `requestManualPayout` refusing more than held minus owed; `lib/billing/payouts.ts` contains no reference to invoices (grep "invoice|settle": only line 352), so the payout request itself does not net outstanding bills. Netting, if any, happens when earnings are credited (`settledInvoiceCents`, ledger), not at payout.

### app/(app)/earnings/page.tsx (204 lines)
- For: "money in": earnings card, "held pays your bills" card, manual withdraw panel, payment and transfer history.
- Screen: a clinician checks whether they can pay rent. Next action: set a payout destination, request a withdrawal of the available amount, or follow "see what you owe" to /billing. Empty state: no billing -> amber notice (83); Withdraw panel hidden unless held > 0, a past request, or the org is on the transfer rail (142). Promise: T3.
- Decides: `availableCents = max(0, held - requested/approved - sent)` (62-68), the only figure with a button. Two different "held" figures on one page: `earnings.heldCents` from `lib/billing/connect.earningsSummary` (EarningsCard, held card) and `held` from `lib/billing/ledger.heldForTherapist` (Withdraw). If those two sources disagree, the page shows two held numbers.
- Promises: T3 PARTLY. The page shows held, and `settledFromEarningsCents` (what earnings already paid off, `components/billing/earnings.tsx:196-200`), but NOT the currently owed amount beside held with the payout as the difference: owed lives on /billing behind a link (118-124). The proof ("held earnings and what is owed as two halves of one number, and the payout is the difference") is not on this screen as written. Available is held minus payouts in flight, not held minus owed.

### app/(app)/layout.tsx (349 lines)
- For: the clinician portal shell: sidebar, bottom nav, pending payment bar, radar presence/orb, clinic switcher, sign out.
- Screen: persistent chrome. Unverified clinicians are redirected to /onboarding unless on /onboarding, /settings, /billing, /earnings (64, 116-119), and gated links are hidden (153-205). PendingBar follows money in flight (280-289, P2-like for clinicians). RadarPresence rings on views/bookings for cleared therapists (298-326).
- Decides: redirect keyed on `x-pathname` from middleware; fails open if missing (111-114), per-page guards then decide. Clinic switch button shown only if a `clinic_managers.linked_user_id` row exists (101-106, 245).
- Assumes: pages call `requireUser` themselves (52-55).
- Notes: `OPEN_TO_UNVERIFIED` uses `startsWith`, so `/settingsX` style paths also pass; harmless. (Locale prefixes are not an issue: `middleware.ts:58-69` redirects any prefixed non-public path to the bare path before this layout renders.)

### app/(app)/notes/page.tsx (91 lines)
- For: the list of recent notes with their status (clinical note and patient copy).
- Screen: next action: open a draft to review and approve. Subtitle counts open notes and ones "held" waiting on the patient copy (19-43). Empty state: no notes -> EmptyState (47-54). Promise: T1 (draft visible), P3 (patient copy status separate).
- Notes: shows `note.content.summary` of drafts in the clinician's own list (78-82): fine for the clinician.

### app/(app)/on-call/actions.ts (293 lines)
- For: radar console actions: profile setup, go online/offline, heartbeat ping, alert prefs, geocode, practice address, walk-in toggle.
- Decides: `toggleRadar(true)` requires `requireVerified` (84); `setOnline` refuses countries with no rail (dashboard comment). `radarPing` (116) heartbeat + pending booking + status + `suspendedUntil`/`suspendedReason` (task 122 surface: a suspension is returned to the client here). `saveRadarSetup` allowlists taxonomy, `safeImageUrl` against stored XSS (64-67). `findPracticeLocation` rate limited 30 per 300s per clinician (198). `savePractice` requires a picked point when an address is given (247). `toggleClinicVisits` refuses without a confirmed address (in lib).
- Notes: `saveAlertPreferences` read-modify-write on `users.profile` jsonb without a transaction (151-167): a concurrent writer of another profile key can be lost (the comment names the risk; it is only half addressed).

### app/(app)/on-call/page.tsx (163 lines)
- For: the Crisis Radar console.
- Screen: next action: go online (TherapistConsole), publish bookable hours (AvailabilityEditor), read radar session history and feedback, set practice address and walk-ins. Empty states: delegated to components. Promise: P1 (the clinician side of "somebody free now"), C1 upstream.
- Notes: `ensureRadarProfile` WRITES a profile row on render if missing (52). Availability is edited in TWO places: here (`schedule-actions.ts`: publish/withdraw/cancel) and `/bookings` (`bookings/actions.ts`: openHoursOn/closeHour/invite). Only this one can CANCEL a booked hour; the /bookings calendar says a booked hour "is cancelled with a message, elsewhere" (`components/scheduling/calendar.tsx:330-336`) and does not link here.

### app/(app)/on-call/schedule-actions.ts (92 lines)
- For: publish hours in the clinician's zone, withdraw an open hour, cancel a booking.
- Decides: `publish` resolves zone via `clinicianZone` (stored, else browser zone adopted, else UTC) and reports source and impossible DST hours (43-62). `withdraw` refuses booked hours (68-71). `cancel` -> `cancelBooking({by: "therapist"})`, hour returns to calendar, patient told via notify (77-92).
- Notes: duplicate of `bookings/actions.ts` `openHoursOn`/`closeHour`, with a different zone rule: `openHoursOn` trusts `input.zone` from the client, `publish` resolves the stored zone first. Two ways to publish the same hours with two zone policies.

### app/(app)/onboarding/actions.ts (205 lines)
- For: clinician verification: save licence details, upload ID/licence/headshot, submit for review.
- Decides: `saveVerificationDetails` (49) refuses only when state is `submitted` (57); rejected -> draft on edit (86). `uploadVerificationDocument` (102) whitelisted fields (108), rate limited 30 per 10 min per caller (113), refuses only `submitted` (117), deletes the previous file after replacing (141). `submitForReview` (157) checks `missingFrom`, distinguishes "we deleted your documents after two rejections" (C351, 176-179), sets submitted then clears `reviewNote` in a second UPDATE (184-192, not atomic).
- Promises: C1 upstream (verification state is what puts a clinician on the radar).
- Notes: server side, an APPROVED verification is editable: neither action refuses `approved`, only the form disables controls (`components/onboarding/verification-form.tsx:153` `locked = submitted || approved`). A direct action POST can replace the licence document, ID, licence number or country of an approved clinician while the row stays `approved` and the old file is deleted (141). See Broken.

### app/(app)/onboarding/page.tsx (160 lines)
- For: "Verify your practice": why we ask, who sees it, the verification form.
- Screen: next action: fill licence details, upload four documents, submit. States: draft, submitted (form locked), rejected with `reviewNote`, approved (form locked, "verified" heading). Super admin redirected to /admin (28). Promise: C1 upstream.
- Decides: document previews use `identityDocumentPath` (a route that asks who is calling) not blob URLs (45-68, H14).
- Notes: `ensureVerification` writes a row on render.

### app/(app)/patients/[id]/assessments/actions.ts (162 lines)
- For: send a questionnaire (in room or as homework), poll progress, read per-item timings.
- Decides: `gate` (27) caseload + refuses `revoked` only. `pollAssessment` (83) returns score and band only once completed (C113). `timingsFor` (126) returns per-item answer times with the instrument's English wording only (157, `text.en`), even for an Arabic clinician.
- Assumes: `assignmentProgress(assignmentId, patientId)` scopes the assignment to the patient; the patient to the clinician via gate.
- Promises: none of the 25 (instruments are Unclaimed).

### app/(app)/patients/[id]/documents/actions.ts (217 lines)
- For: add typed/dictated notes and uploaded files to the PERSON's profile, flag content, propose and decide diagnoses.
- Decides: `writable` (32) caseload + refuses `revoked`; `ensurePersonForPatient`. After a write, profile regenerated in `after()` (76-83, 124-135); extraction nudged with `extractPending(1)`, the cron is the guarantee (H9). `decideDiagnosis` (196) human-only confirm.
- Notes: `writable` does not check `capabilities.diagnosisChanges`; for `revoked` it refuses anyway, and the only other false state is `no_relationship`, unreachable past `getPatient`. OK.

### app/(app)/patients/[id]/documents/page.tsx (333 lines)
- For: the person's profile from the clinician's side: standing profile and timeline, journals, documents, homework, assessments, diagnoses.
- Screen: what a clinician reads in the two minutes before a session. Next action: add a document, set homework, send an assessment (into a live room if one is open), confirm/reject proposed diagnoses. Empty states: no person row -> "noRecord" card (260-264); components own the rest. Revoked -> AccessBanner (193-201). Promise: P4 (patient decides who reads), T5 adjacent.
- Decides: documents filtered to own uploads when `!patientFiles` (139-141); journals only with `patientFiles` (86-87).
- Notes: the standing profile (`profileFor`), timeline (`timelineFor`), diagnoses (`listDiagnoses`, with `documentTitle` and `sourceSentence` of documents the clinician can no longer see), and homework (`listHomework`) are loaded by `personId` ALONE with no capability check (95-97, 88) and rendered in every access state including `revoked`, where `lib/access/state.ts:167-176` sets `liveProfile: false`. The copilot honours `liveProfile` (`lib/ai/case-copilot.ts:161,375,411,455`); this page does not. See Broken. `addedBy` strings are English literals (163-167). `lastSession` query (107-112) is by patient id only, fine because the patient was caseload-checked.

### app/(app)/patients/[id]/evidence/actions.ts (72 lines)
- For: confirm or dispute a fact the system believes.
- Decides: gate caseload + not revoked (22-37); dispute needs a reason of 3+ chars, reason goes to audit not the fact (48-72).

### app/(app)/patients/[id]/evidence/page.tsx (164 lines)
- For: "why the system believes what it believes": every fact with its quote and source, including historical and unsupported ones.
- Screen: next action: confirm or dispute a fact in place. Empty/blocked states: revoked or no person -> one explanatory card (59-73). Promise: T5-adjacent (source sentence attached), P3-adjacent.
- Notes: `whereFrom` strings are English literals (153-162); `revoked` correctly hides facts here, unlike the documents page.

### app/(app)/patients/[id]/homework/actions.ts (82 lines)
- For: set or withdraw a homework step.
- Decides: gate caseload + not revoked; `drafted` provenance when promoted from a note (53-55); answered steps cannot be withdrawn (64-78).
- Notes: revalidates `/patients/<id>/homework`, a path with no page in the slice (no `app/(app)/patients/[id]/homework/page.tsx` exists); the homework UI lives on `/patients/<id>/documents`, which this does not revalidate. See Stale.

### app/(app)/patients/[id]/page.tsx (407 lines)
- For: the patient profile (76.40): who, see them again, ask about them, add to history, what we have done.
- Screen: next action in order: invite to a paid session (InviteToSession), edit contact and clinical fields, ask the inline copilot, add to history, open documents/evidence, manage record access (claim invite), open a past session. Empty states: no sessions -> "historyNone" (350-351); no person -> RecordAccess shows no invite; unclaimed -> initials and "unclaimedNote". Promise: P4 (claimed/unclaimed line, provenance per note via `NoteOrigin` 373-380 incl. `offRecordSeconds`, T2 surfacing), T5 (inline copilot), T4 upstream (invite).
- Decides: avatar only when claimed (133); AddToHistory hidden when revoked (289).
- Notes: `lockedOn(id)` awaited inline in JSX (335). PatientEditor always rendered including when revoked; whether the diagnosis field save is refused is in `patients/actions.ts`.

### app/(app)/patients/actions.ts (356 lines)
- For: create/edit a patient chart, send a claim invite, release a claim lock, cancel an invite, ask for access, invite to a paid session.
- Decides: `addPatient` (32) phone mandatory, E.164 (47-55); same number on the caseload refused unless `duplicate=allow` (74-83, C186); redirect to the new chart. `savePatient` (96) re-parses phone; `AccessRefusedError` from `updatePatient` becomes a message (138-144) (this is where a revoked clinician's diagnosis save is refused, per `patients/[id]/page.tsx:84-86`). No delete of patient or session exists by design (164-180). `createInviteLink` (196) caseload-scoped, token returned once, SENT by notify with no clinical content (231-240), audited. `releaseClaimLock` (267) caseload scope, reason required in lib, audited. `cancelInviteLink` (301) scoped to issuer. `askForAccess` (327) -> `requestAccess`, rate limited in lib. `inviteToPaidSession` (349) thin wrapper over `lib/data/session-invite.ts`.
- Promises: P4 (record handed to its person), T4 upstream (`inviteToSession`), P2 depends on notify.
- Notes: the invite URL is `/patient/invite/<token>` (213), a patient-portal route, not this slice.

### app/(app)/patients/import/actions.ts (117 lines)
- For: caseload CSV import, preview then commit.
- Decides: `preview` (39) 2 MB cap, country required, shows duplicates already on caseload, writes nothing. `commit` (76) re-validates every row from the browser (98-109), 2000 row cap; org/therapist from actor inside `createPatient`.
- Notes: `commit` does not re-check duplicates; `importPatients` reports `skipped`, presumably duplicates (lib).

### app/(app)/patients/import/page.tsx (43 lines)
- For: the importer screen.
- Screen: next action: choose country and file, read the preview, commit. Default country from locale, else EG, always asked (34-39). Promise: none (Unclaimed a: migration tool).

### app/(app)/patients/page.tsx (84 lines)
- For: the caseload list with add form and import link.
- Screen: next action: add a patient (AddPatient), import, open a chart. Empty state: "none" card (47-54). Promise: none directly.
- Notes: "session/sessions" and "last" are English literals (71-72).

### app/(app)/sessions/[id]/actions.ts (205 lines)
- For: session detail panels: ingest upload credential, name/unname a voice, attribute one transcript line by hand.
- Decides: `gate` re-fetches via `getSession(actor, id)` (22-27). `issueUploadCredential` token returned once, hash stored (29-48). `nameVoice` writes `bound_by = operator` only (59-85). `attributeLine` (141) scope pinned in the WHERE (session, org, segment, voice null) (168-179), `speakerInferred=false`, audited as clinical (188-201).
- Notes: `attributeLine`'s WHERE pins organisation, not therapist; `gate` already scoped the session to this clinician, and the segment is pinned to that session, so fine.

### app/(app)/sessions/[id]/page.tsx (346 lines)
- For: the session detail: unfinished session door, risk assessment, one-approval panel, note provenance, note review, source and voices panels, transcript with attribution.
- Screen: after a session: read the risk assessment, review the draft (T1), sign chart / release patient copy / publish a summary version in one act (SessionApproval, C112), correct speaker attribution. Before/during: "unfinished" card with Open room and Cancel (160-186). Empty states: no transcript on a completed session -> "noTranscript" (337-340); no note -> NoteReview with null. Promise: T1 (draft note from transcript, status shown), T2 (`NoteOriginNote` carries `offRecordSeconds` 231-236), P3 (release is a separate irreversible step), P4 (summary versions with approver name 212-221).
- Decides: `live` = scheduled or in_progress (66); risk only when not live (94). Opening the page marks the session's notifications read (46-48).
- Notes: cancelled and no_show sessions are "not live" and get the approval and note panels as if completed. English literals: "Unnamed patient" (54), "Ended automatically at the 50 minute limit" (151), " min", " · Video", " · In person" (137-138), "segments" (302). The modality line says "In person" for every non-video session.

### app/(app)/sessions/actions.ts (799 lines)
- For: the session lifecycle from the clinician side: start, go live, end, abandon, regenerate note, save/approve chart, save/approve patient copy, off-record switch, transcript language, the combined approval.
- Decides: `startNewSession` (55) `requireVerified`; `where` in 5 kinds, modality derived (75-84); `transcribe` tick default on (97) and when off stamps `recordingPausedAt` at creation (247-252); price only for video (109-112); 24T room built FIRST, failure returns before any row is written (161-172, 79.1); external meeting created in the clinician's account, topic never the patient name (210-237), falls back to the 24T room silently on failure (234-236); guest email invite via `after()` with `/join/<joinToken>` (271-287); a newly created chart with a phone gets a claim invite immediately (310-315); redirect to the room. `goLive` (320) audit after transition. `endSession` (355) `completeSession`, then `finishSession` in `after()` (392), shared with cap and empty-room endings. `abandonSession` (399) cancel + releaseClaim. `regenerateNote` (408). `saveNote` (432) and `savePatientNote` (493, three fields only). `approveNote` (463) signs chart. `approvePatientNote` (547) releases patient copy, then `releaseBrief` or `sweepUnratedSessions` (567-584). `setRecordingPaused` (615) org + therapist scoped, audited: the T2 server state. `setTranscriptLanguage` (661) closed set. `approveSession` (734) three writes, partial failure reported.
- Consent and recording (task 123): the comment at 91-95 says "The PATIENT decides, on their own screen". For `in_person` there is no patient screen in this action and none is created; the only switch is the clinician's `transcribe` tick. Whether the in-person room asks for consent is in the room component (next entries). T2: `setRecordingPaused` only stamps `recordingPausedAt`; whether chunks recorded in that window are refused server side is in `app/api/sessions/[id]/transcribe/route.ts` (read below).
- Notes: `saveNote` and `savePatientNote` do not check status: a SIGNED chart and an already RELEASED patient copy can be rewritten in place; status stays approved, `approvedAt` unchanged; audited only. The UI offers both edit buttons after approval (`components/session/note-review.tsx:351` Edit, `:451` Edit copy, neither conditioned on status). No trigger on `session_notes` in drizzle/*.sql forbids it. See Broken. `approvePatientNote` does not check a note exists and returns "Their summary is released" even when the UPDATE matched no row (552-588). `regenerateNote` sets `noteStatus: generating` on a session with a signed note and regenerates, possibly overwriting a signed chart (depends on `generateAndStoreNote`).

### app/(app)/sessions/new/page.tsx (121 lines)
- For: the new-session form.
- Screen: next action: pick patient or type a guest, pick where (24T room, connected Zoom/Meet/Teams, in person), price (when payable), record tick, start. Payable = Stripe charges enabled OR transfer rail (56); VAT shown for Egypt (64, 106); held disclosure when no Stripe (108). Empty state: no patients -> guest fields (component). Promise: P1 (clinician side), T4 upstream, T1 (record tick).
- Notes: "Unnamed" English literal (114).

### app/(app)/sessions/page.tsx (83 lines)
- For: the list of all sessions.
- Screen: next action: open a live session's room or a past session's detail; start a new one. Empty state: EmptyState with Start button (34-46). Promise: T1 via note status badge.
- Notes: " min" and " · Video" literals (66-67).

### app/(app)/settings/actions.ts (306 lines)
- For: profile, copilot voice, timezone, Stripe Connect onboarding/dashboard/payout, session rate + currency + auto-settle + practice region.
- Decides: `updateProfile` (35) explicit field list merged over jsonb (50-62). `saveVoicePreference` (93) allowlist, speed clamped 0.5..2. `saveTimezone` (130) validated in `writeTimezone`. `payOutNow` (179) Stripe payout. `updatePaymentSettings` (201): price stored in the currency typed; EGP converted with `egpRateMicro` for the floor/cap check only, dividing (239-251); `autoSettleFromEarnings` checkbox (261): this is the T3 switch ("take my bill out of my next patient payment"); practice region writable only for `kind = solo` (285-301), which is what turns the Egyptian rail on (74.6: nothing wrote `organizations.region` before).
- Promises: T3 (auto-settle is opt-in per clinician here, 261: so netting is not automatic unless the default is on). P3: the "credentials" shown under a clinician's name are the self-typed `profile.credentials`/`licenseNumber` (56-62), editable at any time and never compared to the verified licence in `therapist_verifications`.
- Notes: `updatePaymentSettings` writes the rate BEFORE the region check; a clinic clinician who submits a region gets an error but the rate and auto-settle were already saved (256-264 then 295-300). `saveVoicePreference` and `updateProfile` both read-modify-write `users.profile` without a transaction.

### app/(app)/settings/codes/actions.ts (34 lines)
- For: mint and revoke clinic-wall QR codes.
- Decides: scoped in `createCode`/`revokeCode` by actor. Revoke has no confirmation by design (21-27).

### app/(app)/settings/codes/page.tsx (76 lines)
- For: "Your QR code": printable server-rendered SVG codes for a clinic wall.
- Screen: next action: create a labelled code, print it, revoke a stale one. Empty state: component. Promise: P1-adjacent (a patient scanning a poster reaches this clinician; `app/j/[code]`).

### app/(app)/settings/integrations/actions.ts (32 lines)
- For: disconnect a meeting provider account. Connect is only via OAuth redirect (`app/api/meetings/connect`), no credential field anywhere (11-19).

### app/(app)/settings/integrations/page.tsx (79 lines)
- For: meeting accounts (Zoom, Meet, Teams).
- Screen: next action: connect via OAuth, or disconnect. Warnings per provider before the attempt (26-33). `features.meetingBots` false -> unavailable state. Promise: none (Unclaimed: external meeting recording).

### app/(app)/settings/page.tsx (297 lines)
- For: settings in five sections: you, getting paid, hours, copilot, security (+ admin link for super_admin).
- Screen: next action: check verification state (the only place a verified clinician sees it, 126-151), edit profile/credentials, QR codes, meeting accounts, payout settings (Stripe or manual method), rate, region, auto-settle, timezone, copilot voice, password. `?payouts=return` re-reads Stripe (45-52), `?payouts=refresh` warns (115-119). Promise: T3 (the "paid" card receives `heldCents` AND `outstandingCents` side by side, 220-222: the closest thing to the T3 proof, but on Settings, not Earnings).
- Notes: two different `held` sources again (`heldForTherapist` here, 97; `earningsSummary.heldCents` on /earnings). The outstanding sum here is its own SQL (57-62) rather than `billingSummary().outstandingCents` used by /billing and /dashboard: a third definition of "what you owe".

### app/(app)/settings/records/actions.ts (79 lines)
- For: the solo clinician's EHR (SMART on FHIR) connection: begin (PKCE, sealed pending cookie, redirect to the hospital), disconnect.
- Decides: org from the session (13-21); vendor cast from the form without validation (25) and passed to `beginConnection`, which presumably validates. Disconnect takes no id (72-77).
- Promises: none (Unclaimed: EHR).

### app/(app)/settings/records/page.tsx (87 lines)
- For: "Your record system": EHR connection, filings, and who files.
- Screen: next action: connect a records server, read filing status, disconnect. A solo practice is told to use a clinic account (44-53). Dates formatted in "UTC" rather than the clinician's zone (67, 75, 78, 81). Promise: none.

### app/(app)/support/actions.ts (55 lines)
- For: a clinician raises a support ticket in the therapist queue.
- Decides: `audience: therapist`, entity hardcoded `us` (38) even for an Egyptian clinician. `relatedSessionId` and `relatedPayoutRequestId` come from the form unverified at this layer (42-43); a clinician could attach another clinician's session id to a ticket (staff would then see it; low risk, depends on `fileTicket`).

### app/(app)/support/page.tsx (98 lines)
- For: a clinician's support page: raise a ticket with a session or payout attached, see own tickets.
- Screen: next action: pick topic, write, attach context, submit; read reference and hours to reply. Empty state: component. Promise: none.
- Notes: payout label is an English literal with the raw status enum and a hardcoded `$` (86).

### app/(app)/switch-principal/actions.ts (41 lines)
- For: clinician -> clinic manager switch.
- Decides: practice read from the manager row keyed on this user (22-24); revokes ALL clinician sessions before minting the clinic session (32-38). Failure redirects to /settings silently (30).
- Promises: A5-adjacent (auth boundary between principals kept here).

### app/(room)/layout.tsx (24 lines)
- For: full-bleed room chrome: no nav, only the language switch (75.3).
- Notes: RadarPresence (booking alarm, orb) is NOT mounted in the room group, so a clinician in a session gets no radar alarm; by design, but a second booking cannot reach them here.

### app/(room)/sessions/[id]/room/page.tsx (121 lines)
- For: the live session room (server half); the behaviour is `components/session/session-room.tsx` (856 lines, not in slice, read for the room questions below).
- Screen: before start: "Waiting for your patient" strip with copy-link and price/paid state, "is in the room, waiting for you" strip, Start session button with the caption `troom.consentFirst`. Live: video (video only), transcript panel, copilot toasts and AskPanel (live + chart only), spoken-language pin, Off record / Resume, End session, caption `troom.noteOnEnd`. Empty state: transcript "ready when you are". Promise: T1, T2, P1 (clinician side), T4 (joinUrl).
- Decides: completed or cancelled -> redirect to detail (25-27); `no_show` is NOT redirected and opens a room. `ensureRoom` builds a missing/expired room (41-48, 79.1); owner token lives cap + 15 min (63). Marks notifications read (33). Passes `recordingConsent` (106-112).
- Room findings (from `components/session/session-room.tsx`):
  - Starting: `handleStart` -> `goLive`, then both recorders start on `live` (333-337). Starting is allowed before the patient has joined or answered consent; the local microphone records from the first second.
  - In-person recording and consent (task 123): an in-person session has no join form, so `recordingConsent` is null, `offRecord` starts false (103, 109) and pressing Start records the room with one microphone labelled `unknown` (254-255). The only consent step is the caption under the Start button (`troom.consentFirst`, 850). Nothing asks the patient, nothing records a consent answer, and nothing blocks recording. Task 123 is live as far as this code shows; the server side (transcribe route) is checked below.
  - Record tick off at creation: `startNewSession` stamps `recordingPausedAt` (sessions/actions.ts:247-252) but the room initialises `offRecord` only from `recordingConsent` (103), so the room shows the red "live" dot and the recorder uploads; one press of Off record then Resume calls `setRecordingPaused(false)` (446) and clears the stamp, turning transcription ON for a session the clinician said not to transcribe.
  - Consent declined AFTER the room loaded: `offRecord` is read once from props; a patient who declines on /join after the clinician opened the room does not mute the running recorders (no poll updates it; the 5 s poll 364-397 carries join/away/status/nextBooking only). Server refusal, if any, is the only guard.
  - Off the record (T2): `toggleOffRecord` (439-447) mutes both recorders client side and fires `setRecordingPaused` without awaiting; "a failed write must never stop the clinician pausing". The client-side mute is what stops audio; the server stamp is what the patient's screen reads.
  - Ending and the draft (T1): `handleEnd` (414-437) flushes both recorders, waits up to 5 s for in-flight chunks, `endSession`, then navigates to the detail page, where the note is generated in `after()` by `finishSession`. The server can end it too (cap / empty room), the poll then navigates (388-391).
  - English literals in the room: "asked not to be recorded..." (559-562), "is in the room, waiting for you to start." (631), "Waiting for your patient", " · paid", "$N to pay before they can join" in USD only (641-645).
- Modal over "Go in now" (asked for in the brief; `components/radar/presence.tsx`, not in slice): the booking card with "Go in now" is `z-[60]` (454, 516). `SoundPrompt` is a full-screen `z-[200]` overlay (620) shown whenever `forced` = a booking is ringing and sound is not "ready" (359, 424, 600-615). Its only exit when the browser has BLOCKED sound is the close button (669-675), whose handler sets `dismissed`, but `if (dismissed && !forced) return null` (615) keeps the overlay up while `forced` is true. So: booking arrives, sound blocked, the overlay covers "Go in now" and the silence control and cannot be dismissed until the booking itself goes away. See Broken.

### app/actions/fx.ts (43 lines)
- For: unauthenticated server action returning a dollar figure formatted in EGP at the operator's rate.
- Decides: input clamped to 0..1e9 cents (41); always formatted "en-US" (42), so an Arabic reader gets Latin digits.
- Notes: reachable by anyone; reveals only the published rate (28-33). Fine.

### app/actions/locale.ts (28 lines)
- For: set the language cookie, unauthenticated, non-httpOnly by design (10-17).
- Notes: comment "patients here never have an account" (17) is stale: patients have accounts and a `/patient/login` (VALUE-STATEMENTS P1..P5). See Stale.

### app/api/admin/radar/route.ts (21 lines)
- For: the admin radar command deck feed, `requireRole("super_admin")` per request, no-store.
- Promises: A5 (role checked per request). Note: `super_admin` only, so a support staff role is refused here with an exception rather than a redirect; that is a JSON route, fine.

### app/api/copilot/speak/route.ts (61 lines)
- For: text-to-speech of a copilot answer.
- Decides: same-origin + `requireUserApi`; text capped 4000 chars; voice allowlist; speed clamped.
- Notes: no rate limit and no cost recording: any signed-in clinician can synthesise arbitrary text (not only copilot answers) unmetered; `lib/ai/client.ts` cost accounting is bypassed because `openai().audio.speech.create` is called directly. See Suspect.

### app/api/copilot/voice/route.ts (55 lines)
- For: dictate a question to the copilot, returns text to edit.
- Decides: same-origin + `requireUserApi`, 4 MB cap, no language pinned on purpose.
- Notes: passes `sessionId: ""` to `transcribeChunk` (44); if that function writes the id into a uuid column (usage/cost rows), an empty string raises `invalid input syntax` (the H6 shape). See Suspect.

### app/api/cron/[job]/route.ts (637 lines)
- For: every scheduled job, one route, authenticated by `CRON_SECRET`.
- Decides: auth (613-623): bearer header OR `?secret=` query string, compared with `!==` (not constant time); refused when `env.cronSecret` is unset, so no secret means every job 401s, never runs open. Every job in the map requires the secret, including the manual `radar` job. `job in JOBS` (625) also accepts prototype keys ("toString", "constructor"); harmless behind the secret.
- Jobs in code vs vercel.json:

  | Job | What it does (in code) | vercel.json | CRON_SECRET |
  |---|---|---|---|
  | crisis | `sweepUndeliveredAlerts`, `sweepRadar`, `sweepAbandonedPatients` (no-show warn/suspend, task 122), `sweepUnratedSessions`, `sweepOverrunSessions` (126-172) | `0 3 * * *` daily | yes |
  | billing | `reconcileMissingCharges`, `releaseAllHeldEarnings`, `alertAgedPayouts`, `pauseUnverified` (sponsor enrolment re-verification), `reconcilePots`, dunning `obligationsDueWithin` + `lapseOverdue`, `reconcileRenewals`, partner `deliverPending` webhooks, `alertApproachingLimits`, `billAllPartners`, `sweepExpiredLaunches`, `sweepCheckins` (175-373) | `5 3 * * *` daily | yes |
  | radar | `sweepRadar` only, manual (392-394) | not scheduled | yes |
  | retention | delete `audit_log` older than 6 years, expired sessions, rate-limit rows, errors older than 30 days (404-421) | `10 3 * * *` daily | yes |
  | reminders | appointment reminders (20-24h band + same day), quiet hours 22-07 recipient zone, then `releaseUnconfirmedBookings` with a notice (482-602) | `20 * * * *` hourly | yes |
  | extract | `extractPending` document text (604-608) | `15 3 * * *` daily | yes |

  Six jobs in code, five scheduled. README (per MAP stale 2) lists three.
- Promises: A4 partly (pot and renewal reconcilers only LOG drift, 231-233, 266-274; the admin screen is claimed to show it). P5 adjacent (crisis alert re-delivery once a day, not "an hour late").
- Notes: reminder and release links point at `${env.appUrl}/sessions/<id>` (541), the clinician route; see Suspect with `bookings/actions.ts:127`. `sweepCheckins` comment says "this job runs HOURLY like the rest" (337) but billing runs once a day, so the per-person cadence `checkins.everyHours` cannot fire more often than daily. `sweepAbandonedPatients` (lib/data/feedback.ts:796-886) is not restricted to radar bookings: ANY `scheduled` session with `patientJoinedAt` set, `startedAt` null, joined more than ABANDON_AFTER_MINUTES ago counts as a no-show and warns, then suspends from the radar, with an email that says "A patient booked you on the Crisis Radar". A calendar patient who opens their /join link early and waits would trigger it. See Suspect (task 122).

### app/api/documents/[id]/route.ts (101 lines)
- For: the only way document bytes reach anybody (H14): checks, audits, streams from blob.
- Decides: `documentReadDecision` for patient (own record) or clinician (`accessFor`, own uploads survive revocation) (51-57); audit BEFORE bytes (59-66); refusal is 404 (57); sandbox CSP, nosniff, no-store (78-90); filename sanitised (98-101).
- Promises: P4 (revocation stops the next byte, 28-29) kept as written.

### app/api/documents/[id]/speak/route.ts (127 lines)
- For: read a document aloud without sending its text to the browser.
- Decides: same-origin, same `documentReadDecision`, audit, first 4000 chars of chunks or body.
- Notes: no rate limit and no cost recording (direct `openai().audio.speech.create`, 110), same as copilot speak.

### app/api/ehr/callback/route.ts (122 lines)
- For: SMART on FHIR OAuth callback, the only place an EHR token is exchanged or stored.
- Decides: `takePending` consumes the cookie either way (24-25, 41); state match (75); the org comes from the LIVE session (clinic cookie first, then clinician) and must equal the cookie's (77-89); tenant label deliberately null (108-116). Failures redirect with `?ehr=<why>`.
- Promises: none (Unclaimed a/c: EHR filing). Auth boundary kept (H33 capability route).

### app/api/hr/v1/employment/route.ts (115 lines)
- For: a SPONSOR's own key asks "does this person work here" for an identifier typed into an enrolment.
- Decides: per-caller throttle 240/min before key read (51); scope `employment:verify`; key must have sponsor and no partner (73-75); `verifyEmployment` answers once per attestation, abnormal rate suspends the key (C265, 26-34); returns `{active, as_of}` only.
- Promises: E1/E2 adjacent: it answers only about an identifier, never sessions. Kept as far as this file shows.

### app/api/meetings/callback/[provider]/route.ts (109 lines)
- For: OAuth callback for Zoom/Meet/Teams.
- Decides: `requireUser`; state cookie `24t_oauth_<provider>` = `state.userId`, deleted on read; all three (code, state, same user) or silent redirect (54-63); token sealed by `saveConnection` (fails without `TOKEN_ENCRYPTION_KEY`, 24-27). Errors swallowed to a redirect (104-108): the clinician lands on settings with no message.

### app/api/meetings/connect/[provider]/route.ts (78 lines)
- For: start the meeting OAuth.
- Decides: `features.meetingBots` gate; `scopesAreMeetingOnly` refuses any calendar scope (C132, 44-50); state cookie 10 min.

### app/api/meetings/transcript/[sessionId]/route.ts (118 lines)
- For: webhook where a meeting bot's transcript arrives.
- Decides: unauthenticated except `assertOurBot(sessionId, botId)` (86-93, hard stop 409); unknown session answers `{ok:true}` so ids are not enumerable (79-84); refuses processing unless `recordingConsent === "granted"` and not paused and bot not left (103-106).
- Notes: after every check it only LOGS "accepted" and returns `processed: true` (116-117). Nothing is written: no segment, no transcript. The external-meeting recording path ends here. Unclaimed (c), half built. Note the consent bar here (`granted` required) is stricter than the 24T room's (null consent records).

### app/api/partner/launch/route.ts (70 lines)
- For: a clinician's browser redeems a single-use partner launch token and is signed in.
- Decides: per-caller throttle 20/min; any failure -> `/login?launch=expired` (no oracle); redirect built from `env.appUrl` (64-69).

### app/api/partner/v1/consent/route.ts (166 lines)
- For: a partner records a consent answer (given/withdrawn, with offset) and learns whether we will record.
- Decides: scope `consent:write`; only two states (85-94); append-only; `openSession` returns recording offset, coverage sentence, stopped reason (124-136). GET returns history.

### app/api/partner/v1/copilot/route.ts (127 lines)
- For: partner copilot question about a subject (POST) and per-clinician opt-in (PUT).
- Decides: scope `copilot:chat`; clinician must have opted in (57-67); usage limit `mayRun` (69-74). PUT lets the PARTNER's server turn a clinician on or off (101-127): the opt-in "on their own profile" (64) is in practice set by the partner's server, not by the clinician.
- Notes: POST does not call `mayAnswer`/consent for the subject; `askPartnerCopilot` scope is by partner + subject ref. T5's "only a clinician the patient chose" does not exist on this path: any opted-in clinician ref of that partner can ask about any subject ref of that partner. See Suspect.

### app/api/partner/v1/launch/route.ts (71 lines)
- For: a partner's server gets a 2-minute single-use URL that signs a clinician in.
- Decides: `withKey(record:read)` (49); `launchClinician` joins the clinician to an org with `partner_id = key.partnerId` and `billing_mode = partner_billed` (lib/partner/launch.ts:125-137), verified only; target from an allow list of four screens, no room (32-35).
- Notes: the header says "There is NO SCOPE for this, deliberately" (37-40) and the code then requires `record:read` (43-49). The second comment explains; the first is stale.

### app/api/partner/v1/notes/[sessionId]/route.ts (43 lines)
- For: pull an approved note for a session (the webhook carries only an id).
- Decides: scope `note:deliver`; `deliverableNote` WHERE has three approval columns and a subject join (26-28).
- Promises: P3/T1 for partner-delivered notes: never a draft, claimed in lib.

### app/api/partner/v1/sessions/[ref]/media/route.ts (93 lines)
- For: partner posts session AUDIO (never video).
- Decides: consent (`mayAnswer`) BEFORE the body is read (42-46); audio/* only (48-54); 25 MB cap declared and actual; transcription starts at OUR consent offset, not a partner field (67-75).

### app/api/partner/v1/sessions/[ref]/note/route.ts (129 lines)
- For: GET the draft note (drafted on first read from the transcript), POST the text a named human approved.
- Decides: scope `note:review`; consent gate; POST needs `text` and `approved_by` (110-118).
- Notes: drafting happens only `if (existing && !existing.draft && !existing.approvedText)` (57): if `noteFor` returns null (no row yet), nothing is drafted and the GET returns `draft: null` forever unless a row is created elsewhere (`openSession`/`ingestPartnerAudio`, not in slice). See Suspect. After a consent withdrawal `mayAnswer` presumably refuses, so the partner can no longer read even the already approved note, although the comment on consent says the therapist "keeps whatever note was already approved".

### app/api/partner/v1/sessions/[ref]/summary/route.ts (113 lines)
- For: GET a patient summary draft (only after the note is approved), POST the approved summary text for delivery.
- Decides: three-layer ordering (20-27, 59-71); DB CHECK claimed.
- Notes: the comment says the draft "is written from `patientBrief` and `patientSteps`" (39) but the code writes it from the whole transcript (`writePatientSummary(transcript)`, 73-74). POST carries no `approved_by`: unlike the note, nothing names the human who approved the summary text (101-108). P3 ("carries a clinician's name") for partner patients is not enforced here.

### app/api/partner/v1/sessions/[ref]/transcript/route.ts (60 lines)
- For: transcript out with coverage sentence and source attribution.
- Decides: scope `transcript:read`, consent gate, `coverage` always present.

### app/api/partner/v1/sessions/route.ts (68 lines)
- For: a partner writes back a session held on their platform (five fields only).
- Decides: scope `session:write`; `writeBackSession` refuses anything but the five fields by signature (15-23). `new Date(startedAt)` unvalidated here (59): an invalid string becomes Invalid Date and is passed on.

### app/api/partner/v1/subjects/[ref]/memory/route.ts (71 lines)
- For: approved notes from this partner's own sessions with a subject (continuity), never our tenancy's record.
- Decides: scope `memory:read`; `sessionMaterial` partner + subject scoped; approved notes only (27-31).
- Notes: no consent (`mayAnswer`) check here; a subject who withdrew consent still has prior approved notes returned. Consistent with "withdrawal does not erase", but worth a decision.

### app/api/partner/v1/subjects/[ref]/readers/route.ts (42 lines)
- For: who may read a subject's record (clinicians with a live grant), never the record.
- Decides: scope `record:read`; `whoMayRead`. No record route exists by design (15-24).

### app/api/patient/avatar/[personId]/route.ts (117 lines)
- For: a patient's photo served through an authenticated proxy (C115).
- Decides: readable by the patient, a super admin, or a clinician with a live `patients` row for that person in their org and as therapist (95-117); 404 otherwise; proxied not redirected (68-75); `private, max-age=300`.
- Notes: `mayRead` does not consult `accessFor`: a clinician whose grant the patient REVOKED still gets the photo, and `patients/[id]/page.tsx:133-157` still renders it when `claimed`. The patient page comment says the photo "arrives ... alongside the revocation that can take the rest away again" (`patients/[id]/page.tsx:62-63`); revocation does not take the photo away. See Broken.

### app/api/radar/profile/[id]/route.ts (38 lines)
- For: one clinician's public live state for their profile page, public, 240/min per network.
- Promises: P1 (public, no login).

### app/api/radar/route.ts (74 lines)
- For: the public radar list, unauthenticated by design, 60/min per network plus a 1000/min global ceiling, no-store.
- Promises: P1, C1 (a clinician on the radar is visible here). `listRadar` decides verification and `.demo` handling (MAP suspect 2; not in slice).

### app/api/revalidate/route.ts (68 lines)
- For: GET the deployed cache version (public); POST invalidate the CMS cache with `CRON_SECRET`.
- Notes: the comment says "Length-independent comparison" (55-56) but the code is `provided.length !== secret.length || provided !== secret` (57), an ordinary early-exit comparison. The header paragraph says "nothing expires on a timer any more" (31) and the next paragraph says entries expire on a five-minute timer since C92 (33). See Stale. Secret also accepted in the query string (52).

### app/api/sessions/[id]/state/route.ts (137 lines)
- For: the room's 5-second poll: status, patient joined, patient away seconds, next booking, the session clock; ends the session server side when the clock says so.
- Decides: scoped to org + therapist (53-58); `autoEndSession` + `finishSession` in `after()` (76-88).
- Notes: header says it is "polled by the clinician's room only while it is waiting for a patient" (25-27); the room polls it for the whole session (session-room.tsx:356-363) and it ends sessions. Stale header. Returns `patientName: row.guestName` (119), a guest's name only.

### app/api/sessions/[id]/transcribe/route.ts (246 lines)
- For: every audio chunk from the 24T room (cookie + same origin) or from an ingest bearer token (third door), transcribed and appended.
- Decides: token path via `ingestDecision` (73-93), one 401 for every refusal; cookie path scoped to org + therapist (99-120); requires `status = in_progress` (126-128); 4 MB cap; speaker whitelisted, default `unknown`; copilot suggestions only on the cookie path; token responses carry no clinical text (206-217).
- Consent and recording: this route NEVER reads `recordingConsent` or `recordingPausedAt`. So:
  - T2 is enforced only by the browser: `SessionRecorder.push` drops frames while muted (`lib/audio/recorder.ts:201`). Nothing server side refuses a chunk sent during an off-record window.
  - A patient's "declined" is enforced only by the room's initial `offRecord` state.
  - The "Record" tick unticked at creation (`recordingPausedAt` stamped, `sessions/actions.ts:247-252`) is read by nothing on this path; the room records, this route transcribes. The comment at `sessions/actions.ts:242-245` ("It is what `answerConsent` and the transcript webhook both already read") is true only of the meeting-bot webhook, which stores nothing.
  - The ingest token path (upload credential / bot) has no consent check at all.
  - Segment times are synthesised from the sequence number (`startMs = (seq-1)*8000`, 178-179), so an off-record gap leaves no gap in the timeline: the "hole" T2 promises is invisible in timestamps.
  See Broken.

### app/api/stripe/webhook/route.ts (35 lines)
- For: Stripe webhook, raw body to `handleWebhook` for signature verification.
- Decides: missing signature 400; any failure 400 (Stripe retries); body never logged.
- Promises: A2 depends on `handleWebhook` idempotency (not in slice).

### app/api/uploads/[...path]/route.ts (81 lines)
- For: serve locally stored uploads when there is no blob token and `ALLOW_LOCAL_UPLOADS=1`.
- Decides: disabled otherwise (26-40); `requireUser` then `localUploadAllowed(rel, actor)` (56-67, 29.1 fix); path traversal refused (59-62); image types only for content-type.
- Notes: a patient's transfer receipt stored locally (`kind: receipt`, `userId: session.id` in pay actions) can only be read by a clinician cookie through this route; a guest payer cannot re-open their own receipt locally. Dev-only.

### app/api/uploads/[id]/route.ts (127 lines)
- For: identity document bytes (clinician verification), owner or super admin only, audited before bytes.
- Decides: `parseIdentityRef`, `identityReadDecision`; local path redirect only for a single leading slash (69-91); sandbox CSP.
- Promises: A5-adjacent (every read written down) kept here.

### app/feedback/[token]/actions.ts (141 lines)
- For: a patient rates a session (and pulls their brief), or reports a problem.
- Decides: `rateSession` (14) throttle 20/10 min, `submitFeedback`, then `releaseBrief` which sends only if the clinician already approved the patient copy (37-47, P3). `reportSession` (59) throttle 10/10 min; `fileReport`; for `no_show` it AUTOMATICALLY refunds the session payment (89-108) and SUSPENDS the clinician from the radar with `suspensionFor(prior)` (110-112), marks the report actioned and emails the clinician (123-137).
- Notes: `fileReport` (lib/data/feedback.ts:338-371) checks only that the feedback token exists: no check that the session did not happen (status completed, `startedAt` set, a transcript exists), no uniqueness on `session_reports` (drizzle/0013_feedback.sql has two plain indexes). So anyone holding a feedback link can report "no_show" on a session that took place, get an automatic refund, and suspend the clinician; repeating the report escalates the suspension (`countNoShows` counts actioned rows). The first report suspends immediately (`suspensionFor(prior)` with prior 0), unlike the sweep, which only warns the first time (`lib/data/feedback.ts:856`). The refund audit names the clinician as the refunding admin (103). See Broken.

### app/feedback/[token]/page.tsx (128 lines)
- For: where a patient lands after a session: rate, read the brief, report a problem; an honest sign-up prompt for guests.
- Screen: next action: rate therapist, session and app; read the summary if the clinician released it ("notePending" otherwise, P3); report no-show/abuse/other. Empty/expired: "feedback.expired" card with the SOS orb still present (37-51, 113-127). Signed-in patients are not asked to sign up (93-104). Promise: P3 (brief only after approval), P5 (orb on both branches).

### app/j/[code]/page.tsx (110 lines)
- For: what a scanned clinic-wall QR code opens: "You are joining <clinician>", then patient sign-up.
- Screen: next action: create an account (or sign in). States: live code, revoked ("ask at the desk"), unknown ("no letter O and no number 0"). SOS orb always. Promise: P1-adjacent, P4 (record becomes yours).
- Notes: the whole page is English literals (51, 67-72, 78-81, 87-98), no `t()`, although it fetches `getI18n()` for the orb. The credentials shown are the self-typed `profile.credentials` (see settings/actions.ts).

### app/join/[token]/actions.ts (850 lines)
- For: the whole patient side of a join link: name, pay redirect, the standalone consent question, admission to the room or an external meeting, waiting-room poll, arrival rating, turning consent on mid-session, the patient's own stop-recording, minimise.
- Decides: `admit` (69) refuses unpaid priced sessions (73-75), forwards to a PROVISIONED external meeting only (45-67, 90-91), `ensureRoom` or a sentence (107-113), non-owner Daily token capped (116-124). `submitJoin` (136) name required, 10 joins per 10 min per caller (169-172), `joinByToken`, `payFromPot` BEFORE the payment read (192-193, 53.21), unpaid -> `/pay/<token>` (201-218), else `needsConsent` (226-227): consent is never bundled with the name (C282). `resumeAfterPayment` (244) re-reads the stored name, re-runs `joinByToken` (idempotent), asks consent if never asked (268-270). `answerConsent` (299) validates, `recordConsent`, admits. `recordConsent` (322) one conditional UPDATE monotonic toward decline (C283, 370-399); decline also stamps `recordingPausedAt` (376-377); grant stamps `recordingStartedAt`; grant dispatches a meeting bot, decline withdraws one (436-468). `checkJoinState` (472) runs the abandonment check in `after()` (560-566) and the cap from the patient's side (578-603); `recording = live && !recordingPausedAt` (608). `turnOnConsent` (659) one-direction, un-pauses (702). `stopRecording` (747) stamps `recordingPausedAt`, withdraws any bot. `setSessionMinimised` (823) only while in progress.
- Consent and recording: `stopRecording`'s comment says "Pausing the transcript is enough when the audio is ours: the 24Therapy room stops sending it" (768-769). Nothing makes that true: the room never reads `recordingPausedAt` (its poll, `app/api/sessions/[id]/state/route.ts:102-130`, does not carry it), and the transcribe route never checks it (`app/api/sessions/[id]/transcribe/route.ts`). The patient's waiting-room indicator (`recording: live && !recordingPausedAt`, 608) then tells them recording stopped while the clinician's microphone keeps uploading and the server keeps transcribing. Same for a decline that lands after the clinician opened the room. Grep of `recordingPausedAt` readers: `lib/data/timeline.ts:70,89`, `lib/console/reads.ts:50`, `app/(admin)/admin/tv/page.tsx:86` (displays), meeting webhook (refuses). See Broken, T2 and task 123.
- T4 / task 115: see page entry.
- Notes: `answerConsent`, `turnOnConsent`, `stopRecording`, `rateOnArrival`, `setSessionMinimised` have no throttle; they write only to the one session the token names. A grant that loses to an earlier decline returns normally and the patient is admitted with no sentence saying their yes did not apply (401-404). `admit` falls back to `joined: true, videoUrl: null` when the token no longer resolves (71), a silent empty state.

### app/join/[token]/page.tsx (274 lines)
- For: the join link page: dead link -> feedback redirect or "link dead"; otherwise the JoinFlow (name, pay, consent, waiting room, room) and NoShowRecovery when a scheduled time has passed.
- Screen: next action for a stranger: type a first name, pay if priced, answer the recording question, wait, enter. For a signed-in patient whose `patients` row is this session's patient: `knownName` (114-125) so JoinFlow says "Joining as ..." (T4). After a finished session: redirect to `/feedback/<token>` (80-81). Empty/error: "room.linkDead" (83-88). SOS orb via PatientChrome always; patient nav only when signed in (239-252). Promise: T4, P1, P5, P2 (live session tab).
- Decides: `?checkout=` confirms Stripe on render, unauthenticated (54-56); `checkout=cancelled` releases the radar claim and the caller's hold (64-69). Resume (task 115) = `guestName` set AND (free or paid) AND (checkout OR booked=1 OR `patientJoinedAt`) (190-194), so a reload after admission resumes rather than asking the name again.
- T4 verdict: kept only when the signed-in person's `personId` is linked to the session's `patient_id` row. A patient invited to a session whose chart was never claimed by their account (unclaimed record, or a chart created for a guest) sees the stranger form while signed in. `knownName` is the account's first name, not the chart's.
- Task 115 verdict: kept when `guestName` is stored. For a session made by `inviteToSession`/`invitePatient` on an existing chart, `guestName` may be null until `joinByToken` writes it (not visible here); if `joinByToken` writes it, reload survives. Cannot fully tell from here.
- Notes: NoShowRecovery shows when `scheduledAt` has passed and not started (218-226); radar sessions with no `scheduledAt` never show it.

### app/pay/[token]/actions.ts (349 lines)
- For: the guest pay page's server side: card quote per country (`priceFor`), Stripe checkout (`startPayment`), Egyptian transfer declaration (`declareSessionTransfer`), open the transfer cart (`openSessionPayment`).
- Decides: every amount from `patientOwesFor` (the frozen patient share after the employer's pot) (86, 234-240, 289-295) (C311/C312, E3); VAT only on the patient's share (89-99); transfer rail re-asked server side (197-199); payer is `{kind: "session"}`, no audit row by design (254-260); cart lines stored with translated labels (301-339).
- Notes: `startPayment` comment says amounts are recomputed "from `sessions.price_cents`" (125-127), superseded by 76.33's `patientOwesFor` in `priceFor`; whether `createSessionPaymentCheckout` uses the patient share is claimed at 70-72. No throttle on the unauthenticated `declareSessionTransfer` (which uploads a file) or `openSessionPayment`.

### app/pay/[token]/page.tsx (279 lines)
- For: pay for a session with no account: Egyptian transfer popup (open on arrival) or the card PayFlow (country first).
- Screen: next action: read the account details and amount, transfer, upload a receipt, submit; or pick country and pay by card. Paid or free -> redirect to `/join/<token>?booked=1` (84-86). Promise: A1 (nothing granted before confirm), A3 (rejection reason), E3/E5 (patient share after the pot, lines show the benefit), P5 (orb on both rails).
- Task 124, what a guest payer can learn about a rejection: NOTHING on this screen. `manualEntry` (lib/billing/manual-entry.ts:283-352) shows a live row if one is `awaiting_proof`/`submitted`; after a rejection there is no live row, so it falls back to `paymentsFor(payer)`, which returns `[]` for `payerKind === "session"` (lib/billing/manual.ts:426-431). `live` becomes `{state: "none"}`: the guest sees the account details again, no rejection, no reason, and may transfer twice. A3 broken for guests. Whether any notice reaches `guestEmail` on rejection is outside this slice.
- Notes: `viewerName` falls back to the page title "pay.title" when there is no guest name (218).

### app/records/[token]/data.json/route.ts (40 lines)
- For: the machine-readable export of a record via an emailed token (portability).
- Decides: `openExport(token)` or 410; attachment with the patient's name slugged into the filename (29).

### app/records/[token]/route.ts (66 lines)
- For: the HTML export of a patient's record, token-authenticated, 3-day expiry, strict CSP.
- Notes: the expired page tells the patient "Ask your therapist to send it again" (53-54), but a clinician has no way to send a record: `app/(app)/patients/actions.ts:150-162` says only an administrator can (`emailPatientRecordToPatient`). English only. See Stale.

### app/session-expired/route.ts (43 lines)
- For: break the expired-cookie redirect loop: destroy the session, redirect to `/login?expired=1&next=...` (only same-origin paths).

### app/support/[token]/actions.ts (60 lines)
- For: a person reads their closed support ticket with the link token plus a code sent to their handle.
- Decides: `readByToken({token, code})`; audit with no actor (34-41); only `closed`/`replied` events shown; times as UTC strings (43).
- Notes: no throttle here on the 6-digit code; depends on `readByToken`.

### app/support/[token]/page.tsx (53 lines)
- For: the page a closed-ticket email links to.
- Screen: next action: enter the code, read the conversation. SOS orb. English literals (36-40). Promise: P2-adjacent (the email carries nothing, the content is in-app).

