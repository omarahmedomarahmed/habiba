# Verification: MONEY

Verifier for the money domain: lib/billing, lib/finance, lib/settings, pots and coverage, the
manual transfer rail, invoices, seats and clinic bills, payouts, refunds, VAT, FX, ledger,
credit, prices shown vs charged, earnings and netting, and every money action in the admin
console. Promises A1 A2 A3 A4 T3 C3 C4 E3 E4 E5 and the money half of E1.

Sources gathered from the Broken, Suspect and "Looks broken, is handled" sections of all
sixteen code notes and the three digests. Every entry below was opened in the code by this
verifier unless it says CONFIRMED (MAP n), which is carried in from the coordinator's list.
Pure arithmetic was run with `node --import tsx` where it settled a claim; nothing touched a
database or the network.

Written 2026-09-22 against commit 8acf13b.

---

## Carried in from the coordinator (MAP "Confirmed by the coordinator")

### MONEY-1 · The company home page shows live spend and a live session count beside the delayed balance
- Verdict: CONFIRMED (MAP 5)
- Sources: MAP Confirmed 5, code-03 Broken (E1 published balance), code-08 Broken 3, MAP Suspect 1
- Promise: E1
- Who is hurt and how: an employer who reloads the company page on two days sees "sessions in total" tick up by one and "spent" rise by one session's share, which dates an employee's session to the day, the exact thing the delayed balance exists to hide.
- Evidence: app/(sponsor)/sponsor/page.tsx:195-207 renders `potTotals` (lib/billing/pot.ts:997), a live COUNT and SUM with no floor, beside `potBalance` (lib/data/sponsors.ts:241-326) which only moves every five sessions.
- Severity: S1 (privacy wall)
- Fix sketch: render the spent and sessions figures from the same published snapshot `potBalance` uses (or drop them); a check that inserts one pot spend and asserts neither figure moves until the fifth.
- Decision it came from: C377 published balance; the totals card predates it and was never re-pointed.

### MONEY-2 · Two simultaneous presses of "Mark sent" on a payout post the payout twice in the books
- Verdict: CONFIRMED (MAP 6)
- Sources: MAP Confirmed 6, code-04 Broken 7, code-09 Suspect 1, code-09 Console map
- Promise: A2 (analogue for payouts)
- Who is hurt and how: two operators (or one double click that reaches the server twice) pressing Sent together record the clinician's payout twice, so the books say we paid out twice and the clinician's held balance goes negative; one press also returns an error with its leg already written.
- Evidence: lib/billing/payouts.ts:362-392 posts `postManualPayout` before the compare-and-set `move`; `journal` (lib/billing/ledger.ts:70-104) has no dedupe and no unique index covers (kind, ref). Detection only after the fact: `duplicatePayouts` (ledger.ts:979).
- Severity: S1 (money double-moved in the books)
- Fix sketch: do the guarded `move` first and post only when it matched, inside one transaction; or a unique partial index on ledger_entries (txn_kind, ref_type, ref_id) where txn_kind = 'manual_payout'. Prove with two concurrent calls in a verifier and assert one leg.
- Decision it came from: C309 manual payouts; the guard comment at payouts.ts:255-260 describes the intent the order breaks.

### MONEY-3 · A rejected transfer tells nobody; guests never see the reason; the operator is told it was sent
- Verdict: CONFIRMED (MAP 7)
- Sources: MAP Confirmed 7, MAP Suspect 4, code-04 Broken 8 and Stale 2 and 3, code-09 Broken 9 and Stale 16, code-07 Broken 4, code-06 Broken 11 (no lifecycle for the rail)
- Promise: A3, P2
- Who is hurt and how: a patient or company whose transfer is rejected gets no email and no in-app notice; the "money in flight" bar simply disappears. A guest who paid from a link sees the bank details again with no reason, which invites a second transfer. The operator reads "Rejected, and they have been told why."
- Evidence: lib/billing/manual.ts:670-694 (stores reason, sends nothing); lib/billing/pending.ts:139 (rejected rows never returned); lib/billing/manual.ts:431 (`paymentsFor` returns [] for a `session` payer); lib/billing/manual-entry.ts:338-352 (the only place the sentence is shown); app/(admin)/admin/transfers/actions.ts:72 (false confirmation).
- Severity: S2
- Fix sketch: a `noticePaymentRejected` in payment-notices.ts that sends the stored reason verbatim (email to `guest_email` for a session payer, in-app for accounts), `paymentsFor` answers a session payer by `ref_id`, and the operator message says what was actually sent. Walk: reject with a sentence, read it on the payer's screen and inbox.
- Decision it came from: task 124 (known, unscheduled).

---

## Verified by this pass

### MONEY-4 · A covered patient who pays their share by card is charged and nothing records it
- Verdict: CONFIRMED
- Sources: code-04 Broken 1
- Promise: E3, CV2 (price shown is price charged)
- Who is hurt and how: an employee whose company covers part of a session pays the rest by card; Stripe takes the money, but the session stays "not paid", the patient is asked to pay again, and the clinician's books never hear of it.
- Evidence: lib/billing/pot.ts:520-560 writes the one `session_payments` row at booking with `status: "paid"`, `fundingSource: "pot"`. lib/billing/connect.ts:764-813 upserts the card row on `session_id` with `setWhere: status = 'pending'`, so it updates nothing and the result is not checked; Stripe checkout still opens (669). `settleSessionPayment` (connect.ts:847-860) looks up by `stripeCheckoutSessionId`, finds nothing, posts nothing, never marks the session paid or calls `markInSession`. Only caller: app/pay/[token]/actions.ts:144 (checks only `paymentStatus === "paid"`, which a partly covered session never is, pot.ts:597-602). Side effect: any due invoices tagged with that checkout id (connect.ts:822-826) are flipped to `paid` by stripe.ts:433-458 with no ledger leg, because the settlement was meant to be inside `postSessionPayment`.
- Severity: S1 (money taken with no record; patient asked twice)
- Fix sketch: on a session that already has a pot row, update THAT row with the checkout id and card fields (a separate `patient_checkout_id` column or a second payment table keyed by session and payer), and fail loudly if the write matched nothing. Check: book a 60% covered US-rail session, complete a test checkout, assert the session is paid and one ledger txn exists.
- Decision it came from: 60.1 / C312 (one payment row per session, unique `session_id`), 76.33 fixed the same collision on the transfer rail only.

### MONEY-5 · At high coverage our fee is larger than what the patient is charged, so the card payment cannot start
- Verdict: CONFIRMED (proved by running the arithmetic)
- Sources: code-04 Broken 2
- Promise: E3, E4 adjacent
- Who is hurt and how: an employee whose company covers 90% of a $50 session is asked for $5 but Stripe is told our fee is $7.50; Stripe refuses a fee above the charge and the patient sees "Could not start the payment."
- Evidence: lib/billing/connect.ts:521-522 (fee on the full gross), 611 (charge = share plus VAT), 666 (`applicationFee = cut + settlement`), 731. Ran `sessionMoney({grossCents:5000, feeBps:1500})` and `coverageSplit({grossCents:5000, coverageBps:9000})` via `node --import tsx`: cut 750, patient share 500. Any coverage above 85% (minus settled invoices) triggers it. Also note the pot path already booked the full fee and the clinician's full net as held earnings at booking (pot.ts:654-671), so charging the fee again here on the destination rail would take it twice even when it fits.
- Severity: S2 (a person stuck)
- Fix sketch: on a session with a pot row, the card charge carries no application fee (our cut was booked at booking) or at most the fee attributable to the patient's share; cap at the charge. Test with 90% coverage.
- Decision it came from: C313 (cut on the full price), written for the pot path and copied into the card path.

### MONEY-6 · A partly covered session credits the clinician the whole price before the patient has paid their share
- Verdict: CONFIRMED (new; not raised by a reader)
- Sources: this verifier, found while checking code-04 Broken 1 and 3
- Promise: T3, E3
- Who is hurt and how: when a company covers part of a session, the books immediately record the full session price as cash in and the clinician's full take-home as earnings we hold for them. If the patient never pays their share (the session is swept or abandoned), the clinician can still be paid out money that never arrived; our cash figure is overstated by the unpaid share.
- Evidence: lib/billing/pot.ts:620-651 posts cash -sponsorShare, then 654-671 calls `postSessionPayment` with `grossCents: gross` (full price), `capture: "platform"`, which posts cash +gross and therapist_payable -(gross - cut) (lib/billing/ledger.ts:410-456). Net cash on the books: +patientShare that has not arrived. The later transfer grant posts only VAT (lib/billing/manual-grants.ts:244-285). Nothing reverses this when a partly covered session is cancelled unpaid.
- Severity: S1 (money paid out that never arrived)
- Fix sketch: post only the sponsor's share at booking (cash in = 0 net, a receivable from the patient for the rest), and recognise the patient share when it arrives on either rail. A ledger test: book a 10% covered session, assert `heldForTherapist` rises by the sponsor share's portion only until the patient pays.
- Decision it came from: C313 and 76.33 ("everything about the SESSION was posted at booking", manual-grants.ts:229-241).

### MONEY-7 · Refunding a covered session gives the company the whole price and unwinds nothing else
- Verdict: CONFIRMED
- Sources: code-04 Broken 3; code-09 Looks-handled 5 (partly)
- Promise: E1 (the pot figure), A2 analogue
- Who is hurt and how: refunding a session the company covered 10% of puts ten times what it spent back in the company's pot, while the clinician's held earnings and our fee stay booked and the patient's own share is never returned. Two refunds pressed together both credit the pot.
- Evidence: lib/billing/pot.ts:786-803 credits and journals `payment.grossCents` (full price, written at 529) instead of `sponsorShareCents`; no `postSessionRefund`, no reset of `sessions.payment_status` (connect.ts:988-991 returns before 1019-1066). Status is read at 736 and flipped only at 805-808, so concurrent calls both credit. Reached from app/(admin)/admin/actions.ts:451 (vault refund), lib/data/recovery.ts:326 (patient self-refund) and app/feedback/[token]/actions.ts:97 (no-show report). All three go through `refundSessionPayment`, which first returns "Payments are not configured on this deployment." when Stripe is absent (connect.ts:961-962), so on a deployment with no Stripe a pot session cannot be refunded at all.
- Severity: S1 (money double-moved)
- Fix sketch: flip the row `paid -> refunded` first as the claim (conditional UPDATE, return if nothing matched), credit `sponsorShareCents`, post `postSessionRefund` for the session legs, and move the pot branch above the Stripe check. Test: refund a 10% covered $20 session, pot rises by $2, held earnings fall back.
- Decision it came from: C383 (pot refunds) written against a fully covered session.

### MONEY-8 · A released clinic seat does not lower any bill, and no monthly seat bill exists
- Verdict: CONFIRMED
- Sources: code-04 Broken 4 and Promise evidence C3 C4; code-08 Broken 8; code-01 Suspect (0092 two seat counts); code-02 Suspect 1; code-15 Suspect 9
- Promise: C3, C4
- Who is hurt and how: a practice is never billed per seat at all: the only recurring plan bill is the clinic tier's flat $144, whatever the seat count, and releasing a seat changes nothing on any bill. The clinic bills screen shows only per-session fees. The half of C4 that holds: the clinician who leaves lands in their own pay-as-you-go practice and is not suspended.
- Evidence: lib/billing/seats.ts:25-39 prices `organizations.seats` (a typed count); `releaseSeat` (seats.ts:204-221) only stamps `clinic_seats.released_at`; its only caller lib/data/clinic-admin.ts:768-772 never touches `organizations.seats`. `seatMonthlyCents` is read only by seats.ts, defs.ts and the public pricing table (grep). `subscribeByTransfer` raises `tier.monthlyCents` (service.ts:906-928, defs.ts:521 clinic 14400) and Stripe subscriptions are `quantity: 1` (stripe.ts:268). Seat money is only ever billed as a one-off proration on a manual seat change (seats.ts:152-160). lib/data/clinic.ts:664 shows only `session_id IS NOT NULL` invoices on /clinic/bills. Kept half: clinic-admin.ts:744-777 creates a `solo` org.
- Severity: S2 (C3 and C4 are published promises that cannot be walked)
- Fix sketch: one monthly clinic invoice raised from live `clinic_seats` (billable_from <= period start, not released) times `seatMonthlyCents`, shown on /clinic/bills; release lowers the count for the next period. Walk: release a seat, next bill is one seat lower.
- Decision it came from: sprint 62 (seat ladder and proration) and C331 (released, never refunded); the recurring half was never built.

### MONEY-9 · The clinic bill total is doubled for every session with an AI line
- Verdict: CONFIRMED
- Sources: code-02 Broken 2, code-08 Suspect 1
- Promise: C3
- Who is hurt and how: the practice manager sees a monthly total on /clinic/bills (and in the CSV export) larger than the two fee lines beside it, counting every consented session twice.
- Evidence: lib/data/clinic.ts:653-665 `SUM(i.amount_cents - i.discount_cents)` over `invoices LEFT JOIN invoice_lines`; a consented session has two lines (platform, ai; lib/billing/plans.ts `sessionLines`), so its invoice is summed twice. The platform and AI columns are right; only the total is wrong.
- Severity: S2 (a customer misled about what they owe)
- Fix sketch: total from `SUM(l.amount_cents)` or a subquery over invoices alone. Control: a verifier invoice with two non-zero lines asserting total = platform + ai.
- Decision it came from: C259 (sum by kind, never list sessions).

### MONEY-10 · Invoices paid by bank transfer never reach the books
- Verdict: CONFIRMED
- Sources: code-04 Broken 5, code-04 Promise evidence T3
- Promise: T3, A2 (the ledger is what proves money moved once)
- Who is hurt and how: every Egyptian clinician who pays their 24Therapy bill by transfer is marked paid on screen, but the books still say they owe it and that the cash never arrived; the trial balance, the vault and any netting against earnings read a debt that was settled.
- Evidence: lib/billing/manual-grants.ts:414-505 (`grantSubscription`) flips invoices `due -> paid` and settles the obligation; it posts no leg. The raise posted therapist_receivable + / platform_revenue - (lib/billing/service.ts `raiseInvoice`). The card path posts `postInvoicePaidByCard` (lib/billing/stripe.ts:464); grep finds no transfer-rail caller of it or of any other leg writer for invoices.
- Severity: S1 (books wrong by every transfer-paid bill; netting can take the same debt from earnings again)
- Fix sketch: call `postInvoicePaidByCard` (renamed `postInvoicePaid`) for each invoice the grant settled, with entity `eg`. A check: confirm a subscription transfer and assert `therapist_receivable` for that org returns to zero.
- Decision it came from: 74.3 (transfer-rail subscription), which wrote the entitlement half only.

### MONEY-11 · Egyptian money is booked to the US company, so the books fail on the first Egyptian payout
- Verdict: CONFIRMED
- Sources: code-04 Broken 6, code-04 "Every place a currency (or entity) is defaulted", code-04 Unclaimed (c) `postEntityTransfer`
- Promise: T3
- Who is hurt and how: the founders' reconciliation will say the books do not balance from the first manual payout, because every pound that came in through the Egyptian bank was recorded as the US entity's while every payout leaves from the Egyptian entity.
- Evidence: `journal` defaults `entity ?? "us"` (lib/billing/ledger.ts:95); no manual-rail money-in leg sets it (manual-grants.ts:255-274, 363-373, 621-642; service.ts:256 hard-codes "us"). `requestPayout` sets `entity = "eg"` for any non-Stripe method (payouts.ts:209) and `postManualPayout` posts with it (ledger.ts:705-735). `reconcile()` lists an entity with negative cash in `unbackedEntity` and `balances` goes false (ledger.ts:898-942). `entityFor` (money.ts:242) has no caller; `postEntityTransfer` has no caller.
- Severity: S3 (internal books wrong, no person charged wrongly; becomes a finance and tax problem at scale)
- Fix sketch: pass `entity: entityFor(crossing)` (or `eg` for anything on the manual rail) on every leg the manual rail writes. Check: a verifier that confirms one Egyptian session and sends one payout and asserts `reconcile().balances`.
- Decision it came from: PLAN 3c two entities; the manual rail (sprint 74 to 76) never threaded it.

### MONEY-12 · No Egyptian clinician can request a payout on production
- Verdict: CONFIRMED (new detail; the code-04 file note mentioned it but it was never listed as Broken)
- Sources: code-04 lib/billing/payouts.ts file note ("every EGP payout request in production fails"), code-04 fx.ts file note
- Promise: T3 ("the payout is the difference")
- Who is hurt and how: an Egyptian clinician pressing "request payout" to their InstaPay or wallet is told "We cannot price that currency right now. Try again shortly." every time, so the product can never pay them.
- Evidence: lib/billing/payouts.ts:203-206 calls `quoteFor("usd", "egp")` for any non-Stripe method (money.ts:288-289). lib/billing/fx.ts:97 `PROVIDERS = []`, so `fetchRate` falls to static rates and returns null when `env.isProduction` (fx.ts:123-126), which is `NODE_ENV === "production"` (lib/env.ts:289), true on every deployed build; a stored static quote is refused by `quoteMaySettle` (fx.ts:139-141). The same trap was found and fixed for price setting in 76.46 (app/(app)/settings/actions.ts:224-252 now uses `egpRateMicro()`); payouts were not changed. The demo seed writes its $255 payout request by raw SQL, so the walk would not meet this.
- Severity: S2 (every Egyptian clinician stuck; a launch blocker)
- Fix sketch: price payouts with the operator rate `egpRateMicro()` exactly as the transfer rail and settings do, frozen on the request. Check: `requestPayout` under `NODE_ENV=production` with an EGP method returns a row.
- Decision it came from: C37 (refuse static rates in production) plus 16.6 (freeze a rate on the payout), which together close the only door.

### MONEY-13 · A session awaiting a bank-transfer check is cancelled by the 3am sweep, and a later Confirm marks the cancelled session paid
- Verdict: CONFIRMED
- Sources: code-03 Broken (nightly radar sweep), code-06 Suspect 5 (slot hold vs transfer), code-04 Stale 4
- Promise: A1, A4, E3
- Who is hurt and how: a patient who books a paid session (or is sent a paid invitation) and pays by transfer loses the session at 03:00 if nobody has confirmed the transfer yet: the session is cancelled and its link erased. When the operator later confirms, the product records the money and marks the cancelled session "paid", so the patient has paid for nothing and nobody is told. A partly covered session is swept the same way, and the company's share already taken from the pot is not given back.
- Evidence: lib/data/radar.ts:1220-1231 cancels every `scheduled` + `payment_status = 'pending'` session older than 10 minutes (CLAIM_MINUTES, :62) with no `session_type` filter and no check for an open transfer; run from the `crisis` cron daily at 03:00 (app/api/cron/[job]/route.ts:133, vercel.json). lib/billing/manual-grants.ts:81-85 guards only `payment_status = 'pending'`, not `status`, although its comment (74-76) says a cancelled session is "NOT quietly revived". A pot-debited partly covered session stays `pending` (pot.ts:597-602), so it is swept too, with no `refundToPot`.
- Severity: S1 (money kept for a cancelled service)
- Fix sketch: the sweep filters to `session_type = 'radar'` and excludes any session with a live `manual_payments` row or a pot row; `grantSession` adds `status <> 'cancelled'` and, when it matches nothing because of a cancellation, raises the payment as work on /admin/transfers. Check: seed a pending transfer session 11 minutes old, run the sweep, assert not cancelled.
- Decision it came from: the radar abandoned-checkout sweep (Stripe era) outliving the arrival of a rail that confirms by hand hours later.

### MONEY-14 · Every session price is read as US cents, whatever currency the clinician priced in
- Verdict: CONFIRMED (wider than the reader's claim)
- Sources: code-03 Broken (`bookSlot` prices in the wrong currency); this verifier for the wider half
- Promise: E3 ("a price somebody was shown is a price they are owed")
- Who is hurt and how: an Egyptian clinician who sets their rate to 1,500 EGP in Settings (an option the screen offers) has every session priced at $1,500. A patient paying by transfer is quoted about 85,500 EGP (1,500 dollars plus 14% VAT at 50 to the dollar) for a 1,500 EGP session. On calendar bookings the patient's own session list also labels the price in dollars.
- Evidence: app/(app)/settings/actions.ts:207-263 stores the typed number in the typed currency (`sessionRateCents` 150000, `rateCurrency` egp) and converts only for the floor check. lib/data/sessions.ts:259,267 copy `priceCents` and set `priceCurrency`; lib/data/scheduling.ts:487 copies `priceCents` and never sets `priceCurrency` (default `usd`, schema.ts:722). Every money reader ignores `price_currency`: `sessionTransferMoney` (manual-entry.ts:183-206) treats `priceCents` as USD cents, `openSessionPayment` converts it to pounds at the operator rate (app/pay/[token]/actions.ts:341-345), `grantSession` and `payFromPot` post it as USD (manual-grants.ts:287-373, pot.ts:326-560). The only reader of `price_currency` is the label in components/patient/session-list.tsx:120. The walk will not meet this: the demo seed prices everybody in USD (scripts/seed-demo.ts:359-398).
- Severity: S1 (a patient overcharged about fifty times, or unable to pay)
- Fix sketch: either remove the EGP option until prices carry a currency end to end, or convert at session creation to a USD `price_cents` with the EGP figure kept for display. Check: set a clinician to 1,500 EGP, create a session, read the transfer quote.
- Decision it came from: 16.5 (price in either currency, stored as typed) and 76.46, which fixed the save and not the readers.

### MONEY-15 · An overpayment on the transfer rail is a log line, and there is nowhere to record money that arrived with no claim
- Verdict: CONFIRMED
- Sources: code-04 Broken 14 and Promise evidence A4, code-09 Broken 3 and Promise evidence A4, code-11 Broken (top-up stepper, the path that produces overpayments)
- Promise: A4
- Who is hurt and how: a clinician or company who sends more than the bill has the difference silently kept; an operator who sees a bank line nobody claimed has no screen to log it on, and there is no refund path for a transfer. The A4 walk ("an overpayment and an unmatchable bank line both appear on /admin/transfers as work, with the difference visible") cannot pass.
- Evidence: lib/billing/manual-grants.ts:466-478 `log.warn` only; the `manual_payments` row has no "amount received" column (manual.ts:196-308 writes `amount_cents` and `settles_cents`, both the claim). Confirm credits the claimed `settlesCents`; `confirmWithoutProof` credits the open cart's figure (manual.ts:596-660). A transfer payment has no Stripe charge, so `refundSessionPayment` refuses it (connect.ts:993-995). /admin/transfers (transfers/page.tsx, transfer-queue.tsx) shows claims and open carts only.
- Severity: S2
- Fix sketch: a `received_cents` column the operator types on Confirm, an `overpaid` state or work item when it exceeds `settles_cents`, and an "unmatched line" record the operator can create from a bank statement. Walk per A4.
- Decision it came from: the rail was built claim-first (76.x); RA6 and RA8 are ungated edges (MAP Suspect 17).

### MONEY-16 · Opening a new payment sheet, or pressing Cancel, deletes the only record of a transfer the payer may already have made
- Verdict: CONFIRMED
- Sources: code-04 Suspect 2 and Unclaimed (b), code-09 Suspect 4; code-11 Looks-handled (cancel hidden once proof is in) is a different case and holds
- Promise: A4
- Who is hurt and how: a payer who opens the sheet, sends the money from their bank app, and then opens the sheet again for a different amount (or presses Cancel) erases the open row an operator would have searched when an unclaimed bank line arrives; the money becomes unmatchable.
- Evidence: lib/billing/cart.ts:93-102 hard-DELETEs the payer's other `awaiting_proof` rows on every `openCart`; cart.ts:185-190 DELETEs on cancel. No archive, no audit. `openCarts()` (manual.ts:403) is the only list an operator can match against.
- Severity: S2
- Fix sketch: mark such rows `abandoned` (new state, kept, searchable by amount and payer) rather than deleting them.
- Decision it came from: 76.13 (the cart opens when the sheet opens).

### MONEY-17 · After any rejected top-up, a company can never open a new transfer, and "send the reference again below" has nothing below it
- Verdict: CONFIRMED (new; found while checking code-11's stepper claim)
- Sources: this verifier; related to MAP Confirmed 7 (A3) and code-04 lib/billing/manual-entry.ts file note (`lastRejection` ignores later confirmations)
- Promise: A3, E5 (the pot can never be refilled)
- Who is hurt and how: a company whose top-up was rejected once opens its pot page and sees only the rejection card, told to "Send the reference again below, or reply to us." There is no form, no stepper and no way to start a new payment, then or months later, even after a later top-up was confirmed. Its employees are asked to pay in full when the pot runs dry.
- Evidence: lib/billing/manual-entry.ts:338-352 returns `live: rejected` whenever there is no live row and ANY past rejection exists (`paymentsFor` newest first, `find` ignores later confirmed rows). components/billing/pay-by-transfer.tsx:258-272 renders only the card for `rejected`; the stepper that opens a new row (via `onChoose`, :398-410) lives in the details branch below it. The company sheet has no `onOpen` (app/(sponsor)/sponsor/pot/page.tsx:194-213), unlike the clinician (app/(app)/billing/page.tsx:238) and session (app/pay/[token]/page.tsx:216) sheets, whose `onOpen` opens a live row that then outranks the rejection. Message text: lib/i18n/messages.ts:1846.
- Severity: S2 (a customer stuck with no way out)
- Fix sketch: render the rejection card ABOVE the normal form rather than instead of it, and have `lastRejection` consider only rejections newer than the newest confirmed payment for that ref. Walk: reject a company top-up, reload /sponsor/pot, a new top-up must be startable.
- Decision it came from: 76.x rejection display (A3), written for payers whose sheet opens a row on open.

### MONEY-18 · The company top-up stepper overwrites the amount they chose with the minimum each time the sheet opens
- Verdict: CONFIRMED
- Sources: code-11 Broken (top-up-stepper.tsx:56,62-67)
- Promise: A4, E1 (the pot is credited less than was sent)
- Who is hurt and how: a finance officer who picked $1,500, went to their bank and came back finds the sheet at the $100 floor; 700 ms later the saved open payment is overwritten with the floor. If they submit their proof without stepping back up, the claim says $100 while $1,500 left their bank; confirm credits $100 and the rest is silently kept (MONEY-15).
- Evidence: components/billing/top-up-stepper.tsx:56 `useState(0)`, :62-67 calls `onChoose(chosen.creditCents)` after 700 ms on mount; no prop sets the initial step (only caller pay-by-transfer.tsx:399-410). `openPotPayment` (app/(sponsor)/sponsor/pot/actions.ts:280-316) re-states the open row through `openCart` -> `openManualPayment` (lib/billing/manual.ts:238-265). The component's own comment (:44-48) states the opposite intent.
- Severity: S2 (money under-credited)
- Fix sketch: pass the live row's credit as the initial step and do not call `onChoose` until the user presses a step button. Walk: choose $1,500, reload, figure must still read $1,500.
- Decision it came from: 76.13 (save the settled choice on the server).

### MONEY-19 · A grant that fails after Confirm leaves money confirmed and nothing granted, with no way to re-run it
- Verdict: CONFIRMED
- Sources: code-09 Suspect 2 and Unclaimed (c) 5, code-04 Stale 4
- Promise: A1, A4
- Who is hurt and how: if the step that unlocks what was paid for throws (for example MONEY-20's pot race), the operator reads "The payment was recorded but the account was not updated. Tell an engineer." The payment is confirmed for ever, a second Confirm is refused, no console control re-runs the grant, the confirmation is not audited, and the payer is not told.
- Evidence: lib/billing/manual.ts:530-546 (grant error returns before the notice, confirmation not unwound); app/(admin)/admin/transfers/actions.ts:25-36 returns before `audit`. Callers of `grantFor`: only transfers/actions.ts:33 and :102 (grep). Comments promising a re-run: manual.ts:478-481, manual-grants.ts:18-19, 518-520, 612. Separately, several "nothing happened" grant outcomes return success and send "confirmed" to the payer: `grantSession` on a session no longer pending (manual-grants.ts:87-97) and `grantSubscription` with nothing due (451-463).
- Severity: S2 (a person paid and got nothing until an engineer acts)
- Fix sketch: a `grant_state` column (pending, granted, failed with error) on `manual_payments`, a "Re-run grant" button on /admin/transfers for `confirmed` + `failed`, and the confirm audit written before the grant. Grants that find nothing to do surface as work rather than success.
- Decision it came from: C360 (the queue does not own what it unlocks); the re-run half was never built.

### MONEY-20 · A company's first top-up can be confirmed and never credited if a booking touches the pot at the same moment
- Verdict: CONFIRMED (a narrow race)
- Sources: code-04 Suspect 3
- Promise: A1, A2
- Who is hurt and how: the replay guard on pot top-ups compares the confirmation time to the pot's last-changed time. If any booking debits the pot between the operator's Confirm and the credit (milliseconds), or the app server's clock runs ahead of the database's, the first confirmation reads as a repeat, the pot is not credited, and every retry is refused the same way.
- Evidence: lib/billing/manual-grants.ts:593-613 (`NOT EXISTS ... p.decided_at < sponsor_pots.updated_at`, throws when nothing matched). `decided_at` is the database clock (manual.ts:519-525) but `payFromPot` stamps `updated_at` with the app's clock (`new Date()`, pot.ts:486, 576, 790); the 78.6 comment (manual.ts:490-516) says both sides are now the database's clock, which is true only for the grant's own write. Recovery needs MONEY-19's missing re-run.
- Severity: S2 (money confirmed and not credited; rare)
- Fix sketch: make the idempotency explicit: a `granted_at` column on `manual_payments` set in the same statement as the credit (`UPDATE ... WHERE granted_at IS NULL`), and drop the timestamp comparison.
- Decision it came from: 78.6 (clock fix) on top of the original timestamp guard.

### MONEY-21 · A guest's transfer shows up in the clinician's own payment bar
- Verdict: CONFIRMED
- Sources: code-04 Broken 9, code-04 lib/billing/pending.ts file note
- Promise: P2, C2 (a colleague's patient payment in a shared practice)
- Who is hurt and how: the moment a guest patient opens the pay sheet, the clinician's "money in flight" bar shows that patient's session payment in pounds, which can hide the clinician's own open bill; in a clinic organisation every clinician sees another clinician's patient paying.
- Evidence: lib/billing/manual.ts:110-117 writes the practice's `organizationId` on a `session` payer's row (callers app/pay/[token]/actions.ts:247, 347). lib/billing/pending.ts:97-143 matches `organization_id` and takes the newest row in `awaiting_proof`, `submitted` or `confirmed`. app/(app)/layout.tsx:73 calls it with `kind: "organization"`.
- Severity: S2
- Fix sketch: filter the organisation bar to `payer_kind IN ('user')` (the clinic's own payments); guests get their own bar by `refId` on the pay page.
- Decision it came from: 0105 (session payer carries the practice for routing).

### MONEY-22 · The payer can change the amount on a claim after sending proof
- Verdict: CONFIRMED (for the clinician's bill); the 0107 half is WRONG
- Sources: code-04 Suspect 1, code-01 Suspect (0107 line_items outside the one-live-per-ref guard)
- Promise: A2, A4, CV2
- Who is hurt and how: a clinician who submitted proof for four of eleven invoices and later simply opens the payment sheet again (even just to read "we are checking") has the waiting claim silently rewritten to the whole current bill, with their old proof still attached. An operator who confirms by the screen settles eleven invoices on four invoices' money.
- Evidence: lib/billing/manual.ts:238-265 re-states `amount_cents`, `settles_cents` and `line_items` on a live row in `awaiting_proof` OR `submitted`, keeping the proof. components/billing/payment-popup.tsx:200-213 calls `onOpen` on every open, whatever the state; the clinician's `onOpen` is `openBillPayment([])` (app/(app)/billing/page.tsx:238, actions.ts:370-392), which prices the WHOLE due bill (`billLines` with no ids). The company and guest sheets re-state with the same figure, so they are harmless. On the second claim (0107): the per-ref partial unique index keys on (purpose, ref_id), and for a subscription the ref is the organisation, so two live rows cannot coexist for one clinician; the "one invoice in two transfers" route does not exist today.
- Severity: S2
- Fix sketch: `openManualPayment` re-states only `awaiting_proof`; a submitted row is immutable. Walk: submit proof for a bill, add a session, reopen the picker, read the queue amount.
- Decision it came from: 76.16 (the row's own total wins).

### MONEY-23 · "Refunded" is said to patients and clinicians when nothing was refunded, and one tap refunds a session that happened
- Verdict: CONFIRMED
- Sources: code-10 Broken 5, code-07 Broken 5, code-09 Suspect 11, code-10 Suspect 10, code-06 Suspect 15, MAP Confirmed 3 (money half: the recovery refund)
- Promise: A1 family, P2
- Who is hurt and how: (a) a patient who paid by bank transfer and reports a no-show, or takes the "refund me" option in recovery, is told the refund "reaches your card in a few days" and the clinician is emailed "They have been refunded"; nothing is refunded, because a transfer payment has no card charge and the error is thrown away. (b) The no-show report works on any session, including one that took place: the feedback link a patient receives after a completed session refunds the card payment and suspends the clinician, repeatably.
- Evidence: app/feedback/[token]/actions.ts:89-108 ignores the `{error}` that `refundSessionPayment` returns (it does not throw) and then emails the clinician "They have been refunded" (:126-134); components/feedback/rating-form.tsx:464-467 shows the refund sentence unconditionally. lib/data/recovery.ts:285-340 marks the session `cancelled` + `refunded` first and only logs a failed refund. `refundSessionPayment` refuses a transfer payment (lib/billing/connect.ts:993-995: no Stripe charge) and refuses everything when Stripe is not configured (:961-962). lib/data/feedback.ts:338-371 `fileReport` checks only that the feedback token exists; no session status or join check. The "therapist id as admin" claim (code-10 Suspect 10) is narrower than stated: `adminUserId` reaches only Stripe metadata `refundedBy` (connect.ts:1008), not the audit log. A second refund of the same card payment is refused by the status read (connect.ts:971) for sequential presses.
- Severity: S1 (a patient told money was returned that was not; money given away on a completed session)
- Fix sketch: the refund functions return a result the callers branch on, and the copy says what happened; a manual-rail refund becomes an operator work item on /admin/transfers; `fileReport` for `no_show` requires `status = 'scheduled'`, no `started_at`, and the scheduled time passed, one report per session.
- Decision it came from: 14.4 automatic no-show refunds, written for the Stripe rail.

### MONEY-24 · A pot refund can fail with "No pot spend is on the books" on a session whose patient paid their share by transfer
- Verdict: CONFIRMED (nondeterministic)
- Sources: code-04 Suspect 6
- Promise: none directly (E1 pot figure)
- Who is hurt and how: refunding a partly covered session whose patient's share arrived by transfer can refuse with a false message, depending on which ledger row the database returns first.
- Evidence: lib/billing/pot.ts:751-757 picks the first ledger row with `ref_type = 'session_payment' AND ref_id = payment.id`, no ORDER BY. For such a session there are two transactions with that ref: `postSessionPayment` from the booking (same txn as the pot leg) and the VAT journal from lib/billing/manual-grants.ts:255-274 (its own txn). If the VAT txn is returned, the pot-leg lookup (pot.ts:761-776) finds nothing.
- Severity: S3
- Fix sketch: look up the pot leg directly (`account = 'sponsor_pot' AND ref_type = 'sponsor'` in any txn that also holds a `session_payment` leg for this payment), or store the booking txn id on the payment row.
- Decision it came from: C383 (no sponsor id on `session_payments`, C244).

### MONEY-25 · A transfer that covers the plan's price on paper starts the month even when it was spent on older bills first
- Verdict: CONFIRMED (new)
- Sources: this verifier, reading `grantSubscription` for code-04 Stale 10
- Promise: none of the 25; affects what a clinician is charged
- Who is hurt and how: a clinician owing $20 of session fees and an $80 plan who sends $80 has the $20 settled, the $80 plan invoice left due, and the month granted anyway, because the grant compares the whole transfer, not what was left, with the plan price. The plan invoice then stays owed while the plan is active. Separately, the loop skips an invoice it cannot cover and settles a newer smaller one, contrary to its comment "IT STOPS RATHER THAN PART-PAYING" (manual-grants.ts:408-412, 437).
- Evidence: lib/billing/manual-grants.ts:432-449 spends `remaining` oldest first with `continue`; :492-504 passes `settlesCents: payment.settlesCents` (the whole amount); lib/billing/service.ts:1002 compares that to the obligation amount.
- Severity: S3
- Fix sketch: pass `remaining` plus whatever the loop applied to the plan's own invoice, or settle the obligation only when its invoice was among those settled.
- Decision it came from: 74.3 and the "$80 a month, repeatable" fix at service.ts:985-1000.

### MONEY-26 · Every subscription paid by transfer (and every seat proration) shows as drift on the renewals reconciliation
- Verdict: CONFIRMED
- Sources: code-04 Suspect 13
- Promise: none (operator trust in the vault)
- Who is hurt and how: the "invoices with no obligation" list on /admin/vault fills with every Egyptian plan payment and every seat change, a permanent false alarm that trains operators to ignore it.
- Evidence: lib/billing/obligations.ts:266-283 matches `o.settled_ref = invoices.id::text`; the transfer rail settles with `ref: payment.id`, the `manual_payments` id (manual-grants.ts:494, service.ts:1014); seat prorations are `kind: "subscription"` invoices with no obligation at all (service.ts:1048-1054).
- Severity: S3
- Fix sketch: record the settled invoice id on the obligation (or a join table) on both rails, and exclude proration invoices by a distinct kind.
- Decision it came from: C294/C310 obligations, designed around the Stripe invoice id.

### MONEY-27 · The admin pot trace can list one session under two companies, or twice under one
- Verdict: CONFIRMED
- Sources: code-09 Suspect 3, code-06 Suspect 6
- Promise: E1 (admin half: `/admin/sponsors/<id>` spend)
- Who is hurt and how: on /admin/sponsors/<id> a person who moved employer, or was removed and re-enrolled, has each pot-funded session attributed to every company they were ever enrolled with (or listed twice), so the spend total and the "pot spend agrees" check are wrong, and a company is shown as having paid for a session it did not fund.
- Evidence: lib/console/pot-trace.ts:106-119 joins `enrolments` on `person_id` and `sponsor_id` only; the uniqueness is partial (`enrolments_person_sponsor_unique ... WHERE removed_at IS NULL`, drizzle/0072_corporate.sql:198-199), so removed rows still join. The payer sponsor is recorded only on the ledger (`ref_type = 'sponsor'`, pot.ts:631-632), which this query does not read. Same shape in lib/console/board.ts:149-158.
- Severity: S3
- Fix sketch: attribute through the ledger txn (pot leg `ref_id` = sponsor) as `refundToPot` already does.
- Decision it came from: C243/C244 (no sponsor column on the payment).

### MONEY-28 · Bank details cannot be changed once any payer has opened a payment sheet, and open sheets never expire
- Verdict: CONFIRMED
- Sources: code-09 Suspect 5 and Stale 23 and Unclaimed (c) 4
- Promise: A4 adjacent
- Who is hurt and how: every guest who opens a paid invitation creates an open payment; nothing expires it and only the payer can cancel it, so the founders can never change the bank account on file without crediting or deleting strangers' abandoned rows by hand. The settings screen says "Clear the transfers queue first", which the console cannot do.
- Evidence: lib/billing/manual.ts:709-714 counts `awaiting_proof` as in flight; app/(admin)/admin/settings/actions.ts:401-407 refuses while any exist; app/pay/[token]/actions.ts:273-349 opens a row whenever the sheet opens; grep finds no expiry of `awaiting_proof` anywhere in app/ or lib/; the console's only action on an open cart is "credit without proof" (manual.ts:596).
- Severity: S2 (operator stuck; a changed bank account is a real event)
- Fix sketch: lock only on `submitted`, or expire untouched `awaiting_proof` rows after a set age into an `abandoned` state (see MONEY-16) and let an operator retire one.
- Decision it came from: the details lock (settings/actions.ts) predating 76.13's open-on-sight carts.

### MONEY-29 · The operator's overdraft box has no ceiling and the amounts given away are not audited
- Verdict: PARTLY
- Sources: code-09 Suspect 7, code-09 Console map (/admin/sponsors)
- Promise: E1
- Who is hurt and how: a founder who types 50000 instead of 500 in the overdraft box lets a company spend $50,000 it has not paid. The audit row for opening a pot records neither the overdraft nor the welcome credit.
- Evidence: app/(admin)/admin/sponsors/actions.ts:104-112 converts with `Math.round(Number(...) * 100)`; lib/data/sponsor-admin.ts:297 clamps only `Math.max(0, ...)`; the DB CHECK bounds balance against overdraft, not the overdraft itself (drizzle/0072_corporate.sql:280-282). Audit: sponsors/actions.ts:116-122 has no amounts. The NaN half is handled in effect: a non-number gives `Math.max(0, NaN) = NaN` (ran it under node), which the integer column refuses, so it errors rather than storing garbage; the welcome credit has a ceiling (`maxWelcomeCreditCents`, sponsor-admin.ts:280).
- Severity: S3 (founder-only)
- Fix sketch: an overdraft ceiling in settings, refuse non-finite input with a sentence, and put both amounts in the audit reason.
- Decision it came from: C239 (per-sponsor overdraft).

### MONEY-30 · In a clinic, one clinician's earnings are taken to pay the whole practice's bills
- Verdict: CONFIRMED (new)
- Sources: this verifier, while checking T3 (code-04 Promise evidence T3, code-07 Suspect 10)
- Promise: T3, C5
- Who is hurt and how: at the end of every session, the product pays every due bill of the clinician's ORGANISATION out of that one clinician's held earnings. In a clinic that means Dr Sara's earnings pay the clinic's monthly plan, its seat charges and Dr Kareem's session fees. On the card rail the same happens inside the patient's payment. The product's own comment says this is the thing it must never do.
- Evidence: lib/billing/connect.ts:1229-1283 `settleInvoicesFromHeld(therapistId)` reads `heldForTherapist(therapistId)` (one person) and then every `due` invoice `WHERE organization_id = therapist.organizationId` (the practice), posting `postInvoiceSettledFromHeld` against that one clinician's payable. Called after every session by lib/session-finish.ts:78-84. Card rail: connect.ts:621-640 folds the organisation's due invoices into one clinician's application fee. The rule it breaks is written at lib/billing/ledger.ts:127-137 ("netting it against one clinician's personal balance inside a two-person practice would quietly take one clinician's earnings to pay the other's session"), which is why `heldForTherapistOrg` exists; neither netting path uses it.
- Severity: S1 (money moved from the wrong person)
- Fix sketch: net only invoices raised for that clinician's own sessions (`invoices.session_id` whose session's `therapist_id` is them), never plan or seat invoices, and only on a solo organisation for anything else. A verifier with two clinicians in one clinic proving B's held balance is untouched by A's bill.
- Decision it came from: C69 / 16.6a / 46.5 netting, written when every organisation was one person.

### MONEY-31 · Netting happens per session, but a payout never subtracts what is owed
- Verdict: PARTLY
- Sources: code-04 Promise evidence T3 and payouts.ts file note, code-07 Suspect 10, code-09 Promise evidence T3, code-14 Broken 8 (the netting control cannot fail)
- Promise: T3
- Who is hurt and how: the promise is that what a clinician owes comes out of what they earn before it reaches their account, and that the earnings screen shows both halves. What holds: a session's own fee is taken from held earnings when the whole fee is covered (lib/billing/service.ts:219-260, behind a setting that defaults on), and due bills are swept from held earnings at each session end (but see MONEY-30). What does not: `requestPayout` lets a clinician withdraw the whole held balance while bills are due (lib/billing/payouts.ts:165-176), the earnings screen computes "available" as held minus requested minus sent with no owed figure (app/(app)/earnings/page.tsx:68), and transfer-paid bills never clear the receivable (MONEY-10). "Held" comes from two functions and "owed" from three separate queries (earnings page, settings/page.tsx:57-62, billing) that can disagree.
- Severity: S2 (the T3 walk cannot pass as written)
- Fix sketch: `requestPayout` caps at held minus the clinician's own due invoices and settles those first; the earnings screen shows held, owed, and the difference from one function.
- Decision it came from: C69 netting at charge time; payouts (16.x) built separately.

### MONEY-32 · A paid invoice can be voided in the console with no refund and no ledger entry
- Verdict: CONFIRMED
- Sources: code-09 Broken 2 and Unclaimed (b) 5, code-09 Console map
- Promise: A2 family (the books must match what happened)
- Who is hurt and how: a founder voiding a paid invoice (to "undo" a charge) leaves the clinician's money kept and the books still showing it as revenue and receivable; voiding a due invoice likewise leaves the receivable open for ever.
- Evidence: app/(admin)/admin/actions.ts:405-414 accepts `status: "void"` on a paid invoice (only `due` from `paid` is refused) and sets `paidAt = null`; no `postInvoiceWrittenOff` or refund follows; the reason goes to the audit only (:418-425). components/admin/therapist-panel.tsx:733-741 offers Void unless already void.
- Severity: S3 (founder-only; books wrong)
- Fix sketch: refuse void on `paid` (point at a refund), and post `postInvoiceWrittenOff` when a due invoice is voided.
- Decision it came from: the invoice editor predates the ledger.

### MONEY-33 · Console money screens: raw pounds on the patient page, a founder-only link on the staff queue, AI cost 1,000 times too small on the board
- Verdict: CONFIRMED (three small defects, one entry)
- Sources: code-09 Broken 10, code-09 Broken 11, code-06 Broken 4
- Promise: A4 (the queue must be workable by staff), none for the board
- Who is hurt and how: (a) /admin/patients/<id> prints "sent 150000 EGP" for 1,500 pounds. (b) A staff member working /admin/transfers who taps a clinician payer is sent to a founder-only page and bounced to the clinician onboarding screen. (c) The founders' board shows model spend a thousand times smaller than it is, so "income minus AI" looks far better than it is.
- Evidence: (a) app/(admin)/admin/patients/[id]/page.tsx:98 `sent {p.amountCents} {p.currency}`; the fix exists on transfers/page.tsx:185-191 and sponsors/[id]:195-199. (b) app/(admin)/admin/transfers/page.tsx:149 links `/admin/therapists/<id>`, which is `requireRole("super_admin")` (therapists/[id]/page.tsx:40) while the queue is `requireStaff` (:35). (c) lib/console/board.ts:101, 238, 286-287 divide `cost_microcents` by 1,000,000; every other reader divides by 1,000 to get cents (lib/data/vault.ts:66, 234, 409, 460).
- Severity: S3
- Fix sketch: use the shared money formatter on (a); link staff to a staff-readable payer view on (b); divide by 1,000 on (c).
- Decision it came from: 76.28 fixed (a) on two pages and missed the third; H13 fixed (c) in the vault only.

### MONEY-34 · A patient whose employer covered part of a session reads "Covered" with no amount; the three lines under a paid session do not add up
- Verdict: CONFIRMED
- Sources: code-08 Broken 6, code-08 Suspect 11
- Promise: E3, CV1
- Who is hurt and how: at 10% cover a patient who paid 90% of a session reads "Covered" on their own billing page. For a session they paid in full, "Therapist fee" shows the whole price (which already includes our share), then VAT, then "Platform share" again, so the lines sum to more than the headline.
- Evidence: app/(patient)/patient/billing/page.tsx:149-151 and 170-174 branch on `fundingSource === "pot"` and never select `patientShareCents`; pot.ts:541-559 writes `fundingSource: "pot"` on every covered session, full or partial. Lines at page.tsx:176-187 print `gross`, `vat`, `fee`, where `gross` already contains `fee` (schema: therapist net = gross minus fee).
- Severity: S3
- Fix sketch: show "Your benefit covered X%; you paid Y" from the frozen split; label the first line "Session price" and show the fee as a part of it.
- Decision it came from: C226/C243 (covered, never name the employer).

### MONEY-35 · Any clinician in a clinic can change the clinic's seat count, raising charges on the practice or writing it a credit
- Verdict: CONFIRMED
- Sources: code-07 Suspect 3, code-11 Suspect (seat manager stale quotes), code-04 Promise evidence PL7
- Promise: C3, PL7
- Who is hurt and how: the seat actions check only that somebody is signed in as a clinician; any seated clinician can add seats (a prorated bill on the practice) or remove them (a credit against the practice's next bill, which also silently replaces any credit an operator had set).
- Evidence: app/(app)/billing/actions.ts:255-307 `quoteSeats` and `saveSeats` call `requireUser()` and act on `actor.organizationId`; lib/billing/seats.ts:94-171 has no role check; `setUpcomingDiscount` overwrites (lib/billing/service.ts:812). PL7 (quote shown is billed) is partly kept: the write is guarded on the seat count the clinic was shown (seats.ts:112-127), but the proration is re-quoted at write time with a fresh date (seats.ts:107-110), so a quote accepted days later bills that day's figure.
- Severity: S2
- Fix sketch: seat changes belong to the clinic manager principal (lib/clinic-auth) with the `seats.manage` capability; `setUpcomingDiscount` adds rather than replaces.
- Decision it came from: sprint 62 put the seat control on the therapist billing page before clinic managers existed (sprint 63).

### MONEY-36 · When the pot runs out the patient is simply asked to pay; the "ask HR" screen does not exist
- Verdict: CONFIRMED (settles MAP Suspect 16)
- Sources: MAP Suspect 16, SIMULATION-digest CV9 row, code-04 Promise evidence E5 and pot-alerts.ts file note
- Promise: E5
- Who is hurt and how: an employee booking against an empty pot is shown the ordinary pay link with no word that their benefit has run out or that HR can top it up; they may pay out of pocket for a benefit they were promised. What holds: the pot takes nothing and the company's admins are emailed. What does not: a booking that loses the race for the last of the pot alerts nobody, and every refused booking re-sends the alert to every admin.
- Evidence: every caller discards `payFromPot`'s reason (app/join/[token]/actions.ts:192-193, lib/data/sessions.ts:280, lib/data/scheduling.ts:540); grep of app/, components/ and lib/i18n finds no patient-facing copy for an empty or exhausted benefit (the only "when the pot runs out" string is the demo portal, messages.ts:3409). Alert: pot.ts:431-439 on the early read only; the race-lost return (pot.ts:496-500) sends nothing; pot-alerts.ts has no de-duplication.
- Severity: S2 (a person misled into paying)
- Fix sketch: return the reason to the booking and pay screens and show "Your company's benefit has run out for now. You can pay yourself, or ask your HR team." on `insufficient`; alert on the race-lost path; one alert per pot per day.
- Decision it came from: CV9 (09-THE-EDGES) specified it; C243 kept the sponsor alert free of names (kept).

### MONEY-37 · Setting coverage to zero stops the money and removes nobody
- Verdict: HANDLED (for billing); walk note below
- Sources: code-04 Promise evidence E4, code-03 Looks-handled (setCoverage audited)
- Promise: E4
- Who is hurt and how: nobody; 0% is legal and `payFromPot` returns `no_benefit` without touching the enrolment, so the person keeps their badge and roster place and pays the whole price.
- Evidence: lib/billing/pot.ts:340-353; lib/data/sponsors.ts:600 allows 0; setCoverage writes only `sponsor_pots`. Side defect: a provisional employee's one allowance is consumed on this path (MONEY-38). Walk note for E3 and E4: a DECREASE (including to 0%) is scheduled, not immediate: it bites after `sponsor.coverageNoticeDays` (default 30, minimum 7; lib/data/sponsors.ts:636-647, lib/settings/defs.ts:1757-1773 `coverageNow`). A walk that lowers coverage and books "the next one" the same afternoon will see the OLD share on both, by design; the walk must move the pending date or read `pendingCoverageFrom`.
- Severity: S4
- Fix sketch: none in code; fix the walk script.
- Decision it came from: C345 and C344 (decrease needs notice).

### MONEY-38 · An unconfirmed employee's one sponsored session is used up by a booking the pot never funded
- Verdict: CONFIRMED
- Sources: code-04 Broken 11
- Promise: E4, E5
- Who is hurt and how: someone matched by HR but not yet confirmed has an allowance of one covered session. If their company has no pot yet, or covers 0%, the booking still uses the allowance and does not give it back, so when the pot opens they must pay for their first session.
- Evidence: lib/billing/pot.ts:290-321 claims the allowance; the returns at :324 (`no_pot`) and :350-353 (`no_benefit`) do not call `releaseProvisional` (defined at :397, used at :410, :498, :581), contrary to the function's own rule at :276-286.
- Severity: S3
- Fix sketch: move the pot and coverage checks above the claim, or call `releaseProvisional` on both returns.
- Decision it came from: 61.9 / C350.

### MONEY-39 · Coverage is frozen when the pot pays, which for an invitation to a not-yet-linked patient is at join, not at booking
- Verdict: PARTLY
- Sources: code-08 Suspect 2 and Looks-handled 1 and 9, code-04 Looks-handled 3
- Promise: E3
- Who is hurt and how: for most bookings the company's share is fixed when the session is booked and every later reader uses the frozen figure (kept). But an invitation sent to somebody whose record is not yet linked to their benefit is paid from the pot only when they open the link and join; a coverage decrease whose notice date falls between the invitation and the join reprices it.
- Evidence: kept: pot.ts:346-348 and 541-543 freeze the split; connect.ts:494-521, session-owed.ts:52-91 and manual-grants.ts:186-206 read the row. Gap: `payFromPot` runs at creation (sessions.ts:280, scheduling.ts:540) and again at join (app/join/[token]/actions.ts:192-193); at creation a guest has no `personId`, so it returns `no_benefit` and the split is decided at join with `coverageNow` at that moment.
- Severity: S3 (narrow: needs a scheduled decrease landing inside the window)
- Fix sketch: store the coverage in force at booking on the session (or the notice date check against `scheduled_at`) and pass it to the later `payFromPot`.
- Decision it came from: C311 (frozen at booking).

### MONEY-40 · Nothing is granted before a person confirms; pressing Confirm twice moves the money once
- Verdict: HANDLED
- Sources: code-04 Looks-handled 1, 5 and 6 and Promise evidence A1 A2, code-09 Looks-handled 3 and Promise evidence A1 A2, code-01 Looks-handled (manual_payments CHECKs exist)
- Promise: A1, A2
- Who is hurt and how: nobody on the transfer rail's happy path. Opening a sheet or submitting proof creates only a row; the grant runs only as `onConfirmed` after the `submitted -> confirmed` compare-and-set; a second Confirm returns "That payment is not waiting for a decision." Two taps on "I have paid" land on one row.
- Evidence: lib/billing/manual.ts:519-528 (state in the WHERE, DB clock); grants guarded again (manual-grants.ts:81-85 session, :439-443 invoices, :593-613 pot, which has its own race, MONEY-20); `subscribeByTransfer` raises a due bill only (service.ts:867-935); open is `onConflictDoNothing` plus the partial unique index (manual.ts:278-308); state and purpose CHECKs in drizzle/0102:68-71. Limits that are elsewhere in this file: the ledger has no database-level idempotency (MONEY-41), payouts are not safe against a double press (MONEY-2), and grants that find nothing to do report success (MONEY-19).
- Severity: S4
- Fix sketch: none.
- Decision it came from: C360, 78.6.

### MONEY-41 · The ledger has no database-level guard: no unique reference, no append-only rule
- Verdict: CONFIRMED
- Sources: code-04 ledger.ts file note, code-01 Suspect (0024 legs sum to zero and append-only unenforced), code-14 Suspect 3 (verifiers delete legs freely)
- Promise: A2 ("no second ledger leg")
- Who is hurt and how: every "posted once" guarantee rests on the caller's own status check; any caller that posts before its guard (MONEY-2) or runs twice (MONEY-13, MONEY-23) writes a second set of legs, and nothing stops a script from editing or deleting the books.
- Evidence: `journal` (lib/billing/ledger.ts:70-104) checks only that legs sum to zero in memory. drizzle/0024_ledger.sql, 0047, 0054, 0111: no trigger on `ledger_entries`, and the only unique index nearby is `earnings_transfers_stripe_unique`. scripts/verify-sprint16.ts:647-650 deletes ledger rows database-wide.
- Severity: S3
- Fix sketch: a partial unique index on (txn_kind, ref_type, ref_id) for the kinds that must be once-only (manual_payout, earnings_transfer, invoice_settled, session_payment per ref), and a trigger refusing UPDATE and DELETE outside a named maintenance role.
- Decision it came from: 16.8 (the books), idempotency left to callers by design.

### MONEY-42 · Held Stripe earnings can be sent twice, and the nightly sweep pays out with no person approving
- Verdict: CONFIRMED (USD rail only; needs Stripe configured)
- Sources: code-04 Suspect 10 and 11 and Unclaimed (b)
- Promise: T3, A2
- Who is hurt and how: when a clinician finishes Stripe onboarding the webhook and the settings page both release held earnings at the same moment; each creates its own transfer row and its own idempotency key, so Stripe sends the balance twice. The nightly job also pays held earnings to any connected clinician with nobody pressing anything, and does not subtract a manual payout already approved for the same money, and does not net what they owe.
- Evidence: lib/billing/connect.ts:1109-1190 reads the balance, inserts a new `earnings_transfers` row, then transfers with key `earnings-release-${transfer.id}` (unique per call). Concurrent callers: connect.ts:235 (webhook) and :265 (refresh on return). Nightly: app/api/cron/[job]/route.ts:175-189 -> `releaseAllHeldEarnings` (connect.ts:1200-1215).
- Severity: S2 (money double-moved, gated on the USD rail being live)
- Fix sketch: claim first: a conditional insert keyed on (therapist, held-balance snapshot) or an advisory lock per clinician; subtract approved manual payouts; net due invoices first.
- Decision it came from: 16.x Connect release, written before manual payouts existed.

### MONEY-43 · A failed Stripe webhook is never retried
- Verdict: PARTLY
- Sources: code-04 Broken 12
- Promise: none directly (USD rail entitlement)
- Who is hurt and how: if the work behind a Stripe event throws, the event id is already recorded, so Stripe's retry is ignored. For a completed checkout the browser redirect (`confirmCheckout`) covers it when the payer comes back; for renewals (`invoice.paid`) and subscription changes nothing else applies them, so a clinician who paid can stay on the wrong plan.
- Evidence: lib/billing/stripe.ts:602-608 inserts `stripe_events` before processing, with no transaction. Redirect cover: app/(app)/billing/page.tsx:42-44 and app/join/[token]/page.tsx:54-56 call `confirmCheckout` (stripe.ts:572-583), which re-reads the checkout from Stripe (safe to call with any id). The reconciler `reconcileRenewals` reports but does not repair.
- Severity: S3
- Fix sketch: record the event id in the same transaction as the work, or delete it on failure so the retry runs.
- Decision it came from: "Stripe redelivers" guard.

### MONEY-44 · A second charge run for one session spends credit and takes from earnings again
- Verdict: CONFIRMED (a race)
- Sources: code-04 Broken 13
- Promise: T3
- Who is hurt and how: if the nightly reconciler and a live session end charge the same session at once, the clinician's credit is spent twice or their held earnings are netted twice; only the invoice is deduplicated.
- Evidence: lib/billing/service.ts:155 (`spendCredit`) and :179-187 (`netFeeFromEarnings`, which posts `postFeeNettedFromHeld` at :251 whether or not its `raiseInvoice` created a row) run before the invoice insert that is the idempotency (`onConflictDoNothing` on `session_id`). Callers: lib/session-finish.ts:78 and the reconciler service.ts:653-669 (sessions with no invoice yet, 48 h window). The file's own comment (61-64) names this race.
- Severity: S3
- Fix sketch: claim the invoice row first (insert a `pending` invoice), then spend credit and net only if the claim won.
- Decision it came from: 46.x credit and netting added ahead of the idempotent insert.

### MONEY-45 · Prepaid credit stops being spent once the oldest batch is used up
- Verdict: CONFIRMED (latent: nothing can buy credit today)
- Sources: code-04 Broken 10, code-04 Unclaimed (c) `createCreditCheckout`
- Promise: none
- Who is hurt and how: a clinician holding two credit batches is billed pay-as-you-go once the first is spent, while their dashboard still shows credit.
- Evidence: lib/billing/credits.ts:163-187 selects the soonest-expiring `active` batch and `break`s when it has nothing left; nothing ever marks a batch exhausted (grep of `sessionCredits` status writes). The only writer of credit rows is `createPendingPurchase` via `createCreditCheckout`, which has no caller (stripe.ts:154, grep), so only rows that already exist are affected.
- Severity: S4
- Fix sketch: filter to batches with remaining value in the WHERE (or mark them spent).
- Decision it came from: 46.4 credit as money.

### MONEY-46 · A session with an abandoned card checkout, later paid by transfer, is booked as if an employer had paid
- Verdict: PARTLY
- Sources: code-04 Suspect 5
- Promise: T3
- Who is hurt and how: if a session has any `session_payments` row (for example an abandoned card checkout from before the practice switched to the Egyptian rail), a transfer confirmation posts only a VAT entry: the clinician's earnings and our fee are never recorded and the old row stays `pending`.
- Evidence: lib/billing/manual-grants.ts:186-195 reads any row for the session and :244-285 treats it as the pot case without checking `fundingSource = 'pot'` or `status = 'paid'`. Reachable only when one session meets both rails: the pay page offers one rail per practice (app/pay/[token]/actions.ts:197-199), and a solo clinician can switch region in settings (app/(app)/settings/actions.ts:266-280) after a card attempt.
- Severity: S3 (narrow)
- Fix sketch: branch on `fundingSource === 'pot'`; otherwise replace a `pending` card row.
- Decision it came from: 76.33.

### MONEY-47 · VAT on the transfer rail is derived by subtraction
- Verdict: HANDLED
- Sources: code-04 Suspect 4 and Promise evidence CV1/CV4
- Promise: CV4 (VAT never by subtraction), E3
- Who is hurt and how: nobody found. The reader's worry was that a price change between declaration and confirmation would post the difference as VAT. No code path changes `sessions.price_cents` after creation (grep of every `priceCents:` write: only inserts), and the quote side computes VAT forwards on the share (lib/billing/manual-entry.ts:183-206). The subtraction (manual-grants.ts:227) therefore recovers exactly the VAT that was quoted. The backward VAT on pot top-ups (manual-grants.ts:575-580) was checked by running the round trip for every credit from $1 to $1,000 at 14%: forward and backward agree to the cent.
- Evidence: see above.
- Severity: S4
- Fix sketch: none needed; a comment tying the subtraction to the immutability of `price_cents` would keep it true.
- Decision it came from: 75.7.

### MONEY-48 · A company's invoice is re-printed with today's VAT rate, not the rate the books hold
- Verdict: CONFIRMED
- Sources: code-04 Suspect 8 and invoice.ts file note
- Promise: E1 (what the company is shown it paid)
- Who is hurt and how: if the VAT rate changes, or the country is switched off in settings, every past top-up invoice re-renders with a different VAT split (or none), disagreeing with the tax the books recorded and with what the company already filed.
- Evidence: lib/billing/invoice.ts:160-171 derives VAT backwards from the cash leg using `countryVatBps(sponsor.entity)` (:199-205), which reads the CURRENT enabled `country_settings` row and returns 0 when disabled; the `vat_payable` leg of the same txn is not read.
- Severity: S3
- Fix sketch: read the txn's `vat_payable` leg for the VAT line.
- Decision it came from: C226/C241 invoice rendered from the ledger.

### MONEY-49 · A momentary database error prices payments with default settings
- Verdict: CONFIRMED
- Sources: code-04 Suspect 9 and lib/settings/index.ts file note
- Promise: E3, CV2
- Who is hurt and how: if the settings read fails, the pay screen quotes at the default 50 pounds to the dollar and 15% fee whatever the operator set; if the country read fails, an Egyptian session is quoted with no VAT. The payer declares against that figure and the claim freezes it.
- Evidence: lib/settings/index.ts:58-71 (`getSettings` returns `SETTINGS_DEFAULTS` on any error), :81-88 (`getCountries` returns []), so `getCountrySettings` is null and `sessionTransferMoney` uses `vatBps = 0` (lib/billing/manual-entry.ts:201). The card path refuses an unknown country (connect.ts:474-475); the transfer path does not.
- Severity: S3
- Fix sketch: money paths call a strict reader that throws; the transfer quote refuses an Egyptian practice with no country row.
- Decision it came from: the settings reader's "never take the site down" fallback.

### MONEY-50 · An Egyptian clinician's patients are sent to the card rail until the clinician finds the region setting
- Verdict: PARTLY
- Sources: code-04 Suspect 12, code-12 Suspect 6
- Promise: P1-adjacent (a person stuck at the pay step)
- Who is hurt and how: a new practice is `us` by default, so its patients get the card screen; a patient choosing Egypt is refused with "Ask your therapist for a free link". The remedy exists: a solo clinician can set "where you practise" in Settings, which switches the practice to the transfer rail. A clinic cannot change it itself ("Ask us").
- Evidence: lib/db/schema.ts:155 `region` default `us`; lib/billing/manual-entry.ts:142 `organizationNeedsTransfer` is `region === 'eg'`; lib/settings/defs.ts:1464-1481 refuses Egypt on the card rail; app/(app)/settings/actions.ts:266-286 sets region for `kind = 'solo'` only.
- Severity: S2
- Fix sketch: set region from the clinician's verified country at approval, and ask for it at signup.
- Decision it came from: 74.6.

### MONEY-51 · The invitation email names a dollar price and promises Stripe, even to an Egyptian patient and to a covered employee
- Verdict: CONFIRMED
- Sources: code-05 Broken 14
- Promise: E3 ("a price somebody was shown is a price they are owed"), E1/C243 adjacency
- Who is hurt and how: the first money sentence an Egyptian patient reads says "$60" and "Payment is handled securely by Stripe and goes to your therapist. You will get a receipt by email." They will be asked for pounds by bank transfer to us, with VAT. A covered employee is told the full price, not their share.
- Evidence: lib/mail.ts:398-421: `amount` is always `$` from `priceCents` (the full price), the Stripe sentence is unconditional for any paid session.
- Severity: S2 (misled about what they will pay and to whom)
- Fix sketch: build the email line from the same `patientOwesFor` plus rail decision the pay page uses.
- Decision it came from: the Stripe-era invite template.

### MONEY-52 · Several screens show a price computed differently from what is charged
- Verdict: CONFIRMED (four small defects, one entry)
- Sources: code-11 Suspect (booking sheet VAT), code-11 Broken (therapist-console 10%), code-11 Broken (payouts.tsx formatUsd on EGP), code-11 Broken (seat-manager "up from")
- Promise: E3, CV2
- Who is hurt and how: (a) the radar booking sheet says "Pay $X and start now"; an Egyptian patient is then asked for pounds plus 14% VAT. (b) The clinician's radar console shows "You keep" at a hard-coded 10% fee while the real fee is 15%. (c) A clinician who prices in pounds sees "You keep $1,275, fee $225" for 1,500 EGP. (d) Removing seats reads "costs $144 a month, up from $216".
- Evidence: (a) components/radar/booking-sheet.tsx:53-56, 306-309 (`formatUsd(sessionRateCents)`, no VAT). (b) components/radar/therapist-console.tsx:221-222 (`* 1000 / 10_000`) vs lib/settings/defs.ts:562 (1500 bps). (c) components/settings/payouts.tsx:469-471 (`formatUsd` whatever `currency`). (d) components/billing/seat-manager.tsx:96-98.
- Severity: S3
- Fix sketch: (a) show the total including VAT in the payer's currency from the server; (b) read `platformFeeBps`; (c) format in the chosen currency; (d) "down from" when lower.
- Decision it came from: none recorded; each screen does its own arithmetic.

### MONEY-53 · The pricing page says "no seat fee" beside a per-seat clinic price, and "your patient never pays us anything"
- Verdict: PARTLY (copy; the code side is as described)
- Sources: code-11 Broken (pricing.noFees), code-11 Suspect (radarBody "and nothing else"), code-11 Suspect (patientPaysNothing), MAP live-site checks (no seat fee, no per-session fee)
- Promise: C3 (what a practice was sold)
- Who is hurt and how: a practice reads "No seat fee, no setup fee, no minimum" and a per-seat ladder on the same page. An Egyptian patient does pay us: they transfer to our account, including VAT we remit.
- Evidence: lib/i18n/messages.ts:170, 187-192 (English), 4020, 4037-4041 (Arabic), 3800 and 7000 (`patientPaysNothing`). Per-seat pricing: components/public/pricing-tiers.tsx:167-213. The rail: app/pay/[token]/actions.ts:183-263. Probably the sentences mean pay-as-you-go; they do not say so.
- Severity: S3
- Fix sketch: scope each sentence to the plan it describes; a founder wording decision.
- Decision it came from: H27 has the same shape.

### MONEY-54 · Partner sessions opened before consent are never billed, and a month is priced at bill time
- Verdict: CONFIRMED
- Sources: code-05 Broken 12, code-05 Suspect 8
- Promise: none of the 25 (partner revenue)
- Who is hurt and how: us: a partner session whose first open came before consent stays `billable = false` for ever, so every session opened that way is free; a price change mid-month reprices sessions already held.
- Evidence: lib/partner/platform.ts:80 decides `billable` at insert; the conflict update (:94-100) sets `recordingFromSeconds` and `stoppedReason` but not `billable`. lib/partner/billing.ts:63-65 reads `partnerSessionCents` from settings at bill time; the debt is posted to `therapist_receivable` (:146-159).
- Severity: S3
- Fix sketch: `billable = excluded.billable OR partner_sessions.billable` on conflict; freeze the price on the session row; a `partner_receivable` account.
- Decision it came from: 68.2 partner flow.

### MONEY-55 · Receipts over 2 MB cannot be submitted, although the upload rule promises 25 MB
- Verdict: CONFIRMED
- Sources: code-06 Broken 6
- Promise: A1, A3 (a payer who cannot submit proof)
- Who is hurt and how: a payer whose banking app screenshot is 3 to 6 MB gets a framework error instead of either success or the product's own sentence about file size.
- Evidence: next.config.ts:59 `serverActions: { bodySizeLimit: "2mb" }`; receipts go through server actions (app/pay/[token]/actions.ts:201-219, app/(app)/billing/actions.ts, app/(sponsor)/sponsor/pot/actions.ts); lib/uploads.ts:93-107 allows 25 MB.
- Severity: S2
- Fix sketch: upload receipts through a route handler (or client-side direct upload) and pass the key to the action; or raise the limit for these actions.
- Decision it came from: the 2 MB PHI body limit predates receipt upload.

### MONEY-56 · After one abandoned card checkout, the pay page quotes the session at $0 and Stripe then charges the full price
- Verdict: CONFIRMED (new; found while checking code-04's session-owed.ts note)
- Sources: this verifier; code-04 lib/billing/session-owed.ts file note (no status filter)
- Promise: E3, CV2
- Who is hurt and how: a patient who opens the card payment, backs out, and returns sees the session priced at nothing (no price, no VAT) on the pay page, while pressing Pay takes them to Stripe for the full price. A covered session refunded to the pot keeps telling the patient they owe only their share.
- Evidence: `session_payments.patient_share_cents` is `NOT NULL DEFAULT 0` (lib/db/schema.ts:2247). The card checkout row does not set it (lib/billing/connect.ts:764-788). `patientOwesFor` reads any row for the session with no filter on `fundingSource` or `status`, and its `null` fallback can never fire (lib/billing/session-owed.ts:61-80), so it returns `grossCents: 0`. Both quote paths use it: `priceFor` (app/pay/[token]/actions.ts:86-114) and the transfer quote on the page (app/pay/[token]/page.tsx:128-133). The charge ignores it (`createSessionPaymentCheckout` reads only `fundingSource = 'pot'` rows, connect.ts:494-521).
- Severity: S2 (price shown is not the price charged)
- Fix sketch: `patientOwesFor` reads only `fundingSource = 'pot' AND status = 'paid'` rows; the card insert writes the share it is charging.
- Decision it came from: 76.27 / 76.33 (quote from the frozen split), which assumed only pot rows exist before payment.

### MONEY-57 · Staff see, per funded session, the date and the clinician under an employer's name
- Verdict: PARTLY
- Sources: code-09 Promise evidence E1 and Unclaimed (b) 7
- Promise: E1 (admin half)
- Who is hurt and how: the E1 proof asks only that `/admin/sponsors/<id>` list spend without a patient name, and it does (a session-id prefix, not a name). But the same page gives any staff member each funded session's date and clinician under the company, which is the sponsor-to-session join C244 says no screen, the console included, may show.
- Evidence: app/(admin)/admin/sponsors/[id]/page.tsx:237-248 (date, clinician, coverage per row), guarded by `requireStaff` (:43); lib/console/pot-trace.ts:125-135; the rule: lib/billing/pot.ts:701-710.
- Severity: S3 (staff-only)
- Fix sketch: aggregate by month on the admin page; keep the per-session trace behind the founder elevation with an audited reason.
- Decision it came from: C232 (every pot cent traces), in tension with C244.

### MONEY-58 · The founders' ledger adjustment can post any amount to any account, once per press
- Verdict: PARTLY
- Sources: code-04 Unclaimed (b) (`postAdjustment`), code-09 Console map (ledger adjustment not idempotent)
- Promise: A2
- Who is hurt and how: an adjustment is a deliberate founder tool, and it is audited with a reason; but a double press posts twice, and it can create book cash or pot balance ("never invents money" holds only for the platform's own side).
- Evidence: app/(admin)/admin/actions.ts:505-530 (`requireRole("super_admin")`, audited with account and amount); lib/billing/ledger.ts:636-678. The only screen passes `therapistId: null` (components/admin/ledger-adjust.tsx:131).
- Severity: S4
- Fix sketch: an idempotency key per form render; refuse `cash` and `sponsor_pot` without a second founder.
- Decision it came from: 16.8.

### MONEY-59 · Smaller money findings, each checked
- Verdict: see each line
- Sources: as listed
- Promise: as listed
- Who is hurt and how, evidence and verdict, one line each:
  - CONFIRMED S4 · payment notices to a company go to its first portal user, not its admins, although the comment says "Admins only" (lib/billing/payment-notices.ts:68-77; code-04 Stale 5).
  - CONFIRMED S4 · `manual_payments.currency` defaults to uppercase "EGP" where everything else is lowercase, with no CHECK (lib/billing/manual.ts:244, 285; code-01 Suspect 0102). Only display reads it today.
  - CONFIRMED S4 · a patient posting a foreign enrolment id to "choose primary" leaves themselves with no primary benefit, so the pot silently stops paying (lib/data/enrolment.ts:512-527; code-02 Suspect 11). Only reachable by a hand-made request.
  - CONFIRMED S4 · a failed Stripe cancellation when a clinician joins a clinic is only logged, so their own plan can renew once more (app/(clinic)/clinic/join/[token]/actions.ts:72-80; code-08 Suspect 7). Transfer-rail plans do not auto-renew, so Egyptian clinicians are unaffected.
  - CONFIRMED S4 · the demo seed marks sessions paid with no payment row and no ledger leg, and writes a payout request by raw SQL, so the `money` walk sees held earnings only from pot sessions (scripts/seed-demo.ts:975-1013; code-12 Suspect 1). The walk cannot meet MONEY-12 or MONEY-14.
  - CONFIRMED S4 · two unit tests that claim to hold the pot race and the transfer-rail pot credit exercise functions written inside the test and would stay green if the product regressed (tests/safety.test.ts:709-741, tests/transfer-rail.test.ts:177-193; code-16 Broken 3 and 4).
  - PARTLY S4 · `postSessionPayment` throws on a destination charge carrying VAT after the session was already marked paid, leaving it with no ledger leg (lib/billing/ledger.ts:360-364, connect.ts:862-877; code-04 Looks-handled 8). Only reachable if an operator sets VAT on a Stripe country.
  - PARTLY S4 · the billing page shows the green "paid" banner for any `?checkout=` value; the confirmation itself re-reads Stripe and is safe (app/(app)/billing/page.tsx:42-44, 125-129; lib/billing/stripe.ts:572-583; code-07 Suspect 4).
  - PARTLY S3 · choosing Pay as you go on the plan card calls `upgradeAndPay("payg")`, which creates no payment (the reader's worry is WRONG: `subscribeByTransfer` refuses an unpriced tier, lib/billing/service.ts:880-882) but answers "That is not a plan you can subscribe to" instead of downgrading (components/billing/plan-card.tsx:380-391; code-11 Suspect).
  - CONFIRMED S4 · `renewal_obligations.settled_ref` is not unique and `session_credits` has no spent-within-credit CHECK (code-01 Suspect 0089, 0066); nothing exploits either today.
  - WRONG · `fx_rate_micro` int4 overflow (code-01 Suspect 0032): overflow needs a rate above about 2,147 per dollar; the settings parser caps the pound rate at 1,000 (lib/settings/defs.ts `parseGroup`), and USD pairs are identity.
- Evidence: inline above.
- Severity: as listed
- Fix sketch: per line; none is urgent.
- Decision it came from: n/a.

---

## Looks broken, is handled

### MONEY-60 · Handled on inspection (reader claims that a patch elsewhere settles)
- Verdict: HANDLED
- Sources and patches, one line each:
  - code-04 Suspect 15, `confirmWithoutProof` audits with `organizationId ?? ""` into a uuid column: `users.organization_id` is NOT NULL (lib/db/schema.ts:288-290), so the fallback never fires for a real operator.
  - code-04 Suspect 14, Stripe `invoice.paid` obligation with plan "": our checkout sets `subscription_data.metadata.tierKey` (lib/billing/stripe.ts:290-292), which the handler reads; only subscriptions made outside the product would carry "".
  - MAP Suspect 9 and code-11 Looks-handled, weekly spend heatmap revealing a week: `applyActivityFloor` hides every week until five sessions accumulate and carries them forward (lib/data/sponsors.ts:137-163). What defeats it is the live total beside it, MONEY-1.
  - code-04 Looks-handled 2 and code-16 Broken 3's subject, two bookings racing one pot: the conditional debit is the guard (lib/billing/pot.ts:481-500) and the unique `session_id` insert the idempotency with a compensating credit (:520-583).
  - code-04 Looks-handled 4, a foreign or paid invoice id from the browser: pinned to organisation and `due` in the WHERE (lib/billing/bill-lines.ts:54-58, service.ts `sumPayable`).
  - code-04 Looks-handled 5, pot credited in pounds: `grantPotTopUp` credits `settles_cents` (USD), not `amount_cents` (lib/billing/manual-grants.ts:576-596).
  - code-04 Looks-handled 7, `tierForSpend` giving a paid plan for a cent: filtered to `monthlyCents === 0` (lib/billing/plans.ts:56) and `settingsProblem` refuses a tier with both axes (lib/settings/defs.ts:1323-1326).
  - code-10 Suspect 11 and code-11 Suspect (ledger.tsx), browser arithmetic for VAT and invoice totals: both use the server's own formulas (half-up VAT, floor fee, amount minus discount; components/session/new-session-form.tsx:97-108, components/billing/ledger.tsx:114-117), and the server recomputes the charged figure (manual-entry.ts `sessionTransferMoney`, service.ts `sumPayable`).
  - code-11 Looks-handled, cancel deleting a submitted claim: `cancelCart` deletes only `awaiting_proof` (lib/billing/cart.ts:185-190).
  - MAP live-site Suspect, "Your first session is free": the clinician's first session fee is waived by a one-time conditional claim (lib/billing/service.ts:112-131). Whether the copy means the clinician or the patient is a wording question.
  - code-01 Looks-handled, `manual_payments` state and purpose CHECKs: present (drizzle/0102:68-71).
  - lib/finance (slice 04): no Broken or Suspect entries were raised; readers recorded stale comments only (code-04 Stale 17-20). Nothing in lib/finance forecasts a clinician's earnings.
- Severity: S4

---

## Summary table

| Id | Verdict | Severity |
|---|---|---|
| MONEY-1 | CONFIRMED (MAP 5) | S1 |
| MONEY-2 | CONFIRMED (MAP 6) | S1 |
| MONEY-3 | CONFIRMED (MAP 7) | S2 |
| MONEY-4 | CONFIRMED | S1 |
| MONEY-5 | CONFIRMED | S2 |
| MONEY-6 | CONFIRMED | S1 |
| MONEY-7 | CONFIRMED | S1 |
| MONEY-8 | CONFIRMED | S2 |
| MONEY-9 | CONFIRMED | S2 |
| MONEY-10 | CONFIRMED | S1 |
| MONEY-11 | CONFIRMED | S3 |
| MONEY-12 | CONFIRMED | S2 |
| MONEY-13 | CONFIRMED | S1 |
| MONEY-14 | CONFIRMED | S1 |
| MONEY-15 | CONFIRMED | S2 |
| MONEY-16 | CONFIRMED | S2 |
| MONEY-17 | CONFIRMED | S2 |
| MONEY-18 | CONFIRMED | S2 |
| MONEY-19 | CONFIRMED | S2 |
| MONEY-20 | CONFIRMED | S2 |
| MONEY-21 | CONFIRMED | S2 |
| MONEY-22 | CONFIRMED | S2 |
| MONEY-23 | CONFIRMED | S1 |
| MONEY-24 | CONFIRMED | S3 |
| MONEY-25 | CONFIRMED | S3 |
| MONEY-26 | CONFIRMED | S3 |
| MONEY-27 | CONFIRMED | S3 |
| MONEY-28 | CONFIRMED | S2 |
| MONEY-29 | PARTLY | S3 |
| MONEY-30 | CONFIRMED | S1 |
| MONEY-31 | PARTLY | S2 |
| MONEY-32 | CONFIRMED | S3 |
| MONEY-33 | CONFIRMED | S3 |
| MONEY-34 | CONFIRMED | S3 |
| MONEY-35 | CONFIRMED | S2 |
| MONEY-36 | CONFIRMED | S2 |
| MONEY-37 | HANDLED | S4 |
| MONEY-38 | CONFIRMED | S3 |
| MONEY-39 | PARTLY | S3 |
| MONEY-40 | HANDLED | S4 |
| MONEY-41 | CONFIRMED | S3 |
| MONEY-42 | CONFIRMED | S2 |
| MONEY-43 | PARTLY | S3 |
| MONEY-44 | CONFIRMED | S3 |
| MONEY-45 | CONFIRMED | S4 |
| MONEY-46 | PARTLY | S3 |
| MONEY-47 | HANDLED | S4 |
| MONEY-48 | CONFIRMED | S3 |
| MONEY-49 | CONFIRMED | S3 |
| MONEY-50 | PARTLY | S2 |
| MONEY-51 | CONFIRMED | S2 |
| MONEY-52 | CONFIRMED | S3 |
| MONEY-53 | PARTLY | S3 |
| MONEY-54 | CONFIRMED | S3 |
| MONEY-55 | CONFIRMED | S2 |
| MONEY-56 | CONFIRMED | S2 |
| MONEY-57 | PARTLY | S3 |
| MONEY-58 | PARTLY | S4 |
| MONEY-59 | mixed (7 CONFIRMED, 3 PARTLY, 1 WRONG) | S3/S4 |
| MONEY-60 | HANDLED (12 claims) | S4 |

Counts over the 60 entries: CONFIRMED 46 (3 carried from MAP), PARTLY 9, HANDLED 4 (MONEY-60 groups 12 handled claims), mixed 1 (MONEY-59: 7 CONFIRMED, 3 PARTLY, 1 WRONG line). No whole entry is WRONG; one WRONG line sits in MONEY-59 and one WRONG half in MONEY-22. By severity: S1 10, S2 22, S3 21, S4 7.
