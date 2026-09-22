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

