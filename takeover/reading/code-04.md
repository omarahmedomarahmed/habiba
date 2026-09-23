# Slice 04: money (lib/billing, lib/finance, lib/settings)

Working log. Files entries are written as read; the cross-cutting sections are gathered at the end.

## Files

### lib/billing/bill-lines.ts (80 lines)
- For: turning a clinician's chosen invoice ids into one total plus printed lines for the transfer sheet (76.16).
- Decides: `billLines` (39) pins every id to the organisation and `status = 'due'` in the WHERE (54-58), so a foreign or paid id silently drops out; empty selection means the whole due bill; total summed from rows FOUND (77), never from the request; oldest first (64) to match `grantSubscription`; limit 200 (65).
- Assumes: `payableCents` in `lib/db/schema` (amount minus discount); `grantSubscription` (manual-grants) settles oldest first.
- Promises: CV2 / task 116 (price shown equals price charged): kept for the sheet total, since lines and total come from one query. A1 not touched.
- Notes: lines are pre-tax; tax is not a line (see manual.ts 57-60). Limit 200: a bill of more than 200 due invoices would be silently truncated in both total and lines (unlikely, but the total would under-state).

### lib/billing/cart.ts (197 lines)
- For: opening a transfer "cart" (an `awaiting_proof` manual payment) when the sheet opens, and letting the payer cancel it.
- Decides: `openCart` (51) calls `openManualPayment` then DELETES the same payer's other `awaiting_proof` rows (93-102), never `submitted` ones. `session` payers (guests) are skipped (91): no identity to sweep. `cancelCart` (159) deletes only `awaiting_proof` rows, state in the WHERE (189), scoped by payer identity, and for a guest by `ref_id = sessionId` (185).
- Assumes: `manual_payments_one_payer` CHECK (payer columns mutually exclusive); per-ref partial unique index stops a guest opening two rows for one session.
- Promises: A1 (nothing granted by opening; only a row). A4: indirectly weakens it, see Notes.
- Notes: the sweep deletes an `awaiting_proof` row that may describe money the payer genuinely already sent (they opened sheet A, transferred, then opened sheet B without pressing Submit). The only record an operator would have searched in `openCarts()` for the unmatched bank line is deleted. Same for `cancelCart`: a payer who sent the money then pressed cancel removes the only trace. See Suspect.

### lib/billing/connect.ts (1379 lines)
- For: Stripe Connect Express for clinicians (USD rail): onboarding, balance, payouts, the session checkout, settlement, refunds, release of legacy held earnings, earnings summary, therapist's payment list.
- Decides:
  - `priceProblem` (89): 0 allowed (free), else between settings min and max.
  - `getConnectAccount` (114) default when no row: `rateCurrency: "usd"` (134). Currency default.
  - `createSessionPaymentCheckout` (367): amount from `sessions.price_cents` never the request (357); refuses when clinician has no charges-enabled account (430), the old `capture: "platform"` hold path is closed (404-439); refuses unconfigured country (452); `collectionProblem(country)` (474, C381); reads the pot's frozen split from `session_payments` where `funding_source = 'pot'` (494-507, C311/C312); VAT on the patient's share only, `vatOn(patientGross, country.vatBps)` (521-523), computed forwards; platform cut on FULL gross (522, C313); refuses any country whose rail is not `stripe_usd`/`usd` (543-586); `quoteFor("usd", collectionCurrency)` (600); auto-settle folds the org's due invoices oldest first into the application fee, capped at `net = gross - cut` (617-640); fee converted at the frozen quote (666, C380); writes `session_payments` with `currency: "usd"` (773, 799) and upserts on `session_id` only while `status = 'pending'` (789-813); tags settled invoices with the checkout id (822).
  - `settleSessionPayment` (843): guarded `status = 'pending'` so webhook plus redirect post once (847-860); posts ledger via `postSessionPayment` (877); `markInSession` (897).
  - `refundSessionPayment` (948): pot-funded rows go to `refundToPot` (988-991, C383); Stripe refund with reverse_transfer and refund_application_fee on destination; then status 'refunded' (1019, no state guard in WHERE), `postSessionRefund`, settled invoices back to `due` (1051-1061), session back to `pending`.
  - `releaseHeldEarnings` (1109): amount from ledger `therapist_payable`; `earnings_transfers` row before Stripe transfer (1137); Stripe idempotency key on transfer id (1161); posts `postEarningsTransfer` (1169); currency hard-coded "usd" (1154).
  - `settleInvoicesFromHeld` (1229): whole invoices only, oldest first, `status='due'` guard on update (1262), posts `postInvoiceSettledFromHeld`.
  - `earningsSummary` (1298), `recentPayments` (1353): patient name from chart, never payer name (C243).
- Assumes: `payFromPot` in pot.ts created the `funding_source='pot'` row; `session_payments.session_id` is unique (upsert target); `collectionProblem` in settings/defs.ts; `markInSession` in lib/data/radar.
- Promises: CV1/CV4 (patient charged own share plus VAT on own share): kept in arithmetic here (521-611). CV2: presented total stored on row (777), the pay page must read the same quote. T3: `autoSettle` netting of owed against earned inside the application fee (617-640) and `settleInvoicesFromHeld`: partly (see Broken on covered sessions). E3: kept here by reading the frozen split from the payment row.
- Notes: ledger legs written only via ledger.ts functions (postSessionPayment, postSessionRefund, postEarningsTransfer, postInvoiceSettledFromHeld). The `capture !== "destination"` branch of `payment_intent_data` (739-744) is dead (capture is the constant "destination", 441). `accountBalance` and `requestPayout` count only `usd` balances (302, 335).

### lib/billing/credits.ts (455 lines)
- For: prepaid credit (money, since 46.4) spent against platform and AI fees; tier derivation.
- Decides: `remainingCentsOf` (65) handles pre-46 (sessions) and post-46 (cents) rows; `getCreditBalance` (84) counts active, unexpired rows with value; `spendCredit` (146) picks the soonest-expiring active row, conditional UPDATE `spent_cents + take <= credit_cents` (198) as race guard, bounded to 20 attempts; `createPendingPurchase` (265) freezes `rateCents = tier.aiRateCents`; `activatePurchase` (314) guarded on `status='pending'`, restarts the expiry clock; `currentTier` (375) from lifetime active spend, subscription mirror and `obligationCovering` via `entitledTier`.
- Assumes: plans.ts `entitledTier`, `quoteForSpend`; obligations.ts.
- Promises: none of the 25 directly; affects the price a clinician is charged (CV2 in spirit).
- Notes: see Broken: `spendCredit` stops at an exhausted batch. `expiryFrom` uses local-time `getDate/setMonth` (server TZ dependent, harmless on UTC hosts).

### lib/billing/egypt.ts (167 lines)
- For: the seam for an Egyptian card gateway (64.1). One adapter, `UNCONTRACTED`, which refuses `charge` and `payout` with a reason.
- Decides: `railIsReady` (165) is false while the adapter is `uncontracted`, whatever env says. `whatTheRailNeeds` (78) lists missing EGYPT_GATEWAY_KEY / EGYPT_MERCHANT_ID.
- Assumes: nobody calls `charge`/`payout` expecting success; manual transfer rail (manual.ts) is the real Egyptian money-in path.
- Promises: none directly. Supports README's "collectionProblem refuses Egyptian card payments" claim.
- Notes: the payout refusal comment (124-133) says Egyptian payouts are manual by design (C309) through `payoutRailFor`.

### lib/billing/fx.ts (233 lines)
- For: exchange-rate quotes held for one hour (PLAN 4.4).
- Decides: `quoteFor` (154) identity pair short-circuits with rate 1e6 and source "identity"; reuses an unexpired stored quote if `quoteMaySettle`; `fetchRate` (106) has no providers (`PROVIDERS = []`, 97) so falls to `STATIC_RATES` (usd, egp 50) and refuses static in production (123, C37).
- Assumes: `fx_quotes` table.
- Promises: CV2 in principle (quote honoured one hour).
- Notes: in production any non-USD pair returns null, so any code path that needs an EGP quote in production gets nothing; the manual rail deliberately uses `payouts.egpRateMicro` instead (manual.ts 158-179). The comment at 200-211 about "quoted_at defaults to Postgres now()" describes the old defect; both timestamps are now the Node clock (220-221), consistent.

### lib/billing/invoice.ts (242 lines)
- For: the corporate (sponsor pot top-up) invoice, rendered from ledger legs on every view (C226, C232, C241).
- Decides: `invoiceFor` (59) reads the `pot_topup` / `sponsor_pot` leg pinned to `ref_id = sponsorId` in the WHERE (83-99, no cross-sponsor read); total is the `cash` leg of the same txn (107-116, 160); refuses without legal name, address, tax id (121-125); invoice number is position among this sponsor's top-ups (132-145); VAT derived BACKWARDS from the total at the entity's CURRENT `country_settings.vat_bps` (169-171, 199-205).
- Assumes: `topUpPot`/`grantPotTopUp` post exactly one `sponsor_pot` leg and one `cash` leg per top-up txn; the `vat_payable` leg on the same txn carries the tax.
- Promises: E1 (spend shown to sponsor) indirectly. CV4 spirit "VAT never by subtraction": broken here for the corporate invoice (see Suspect).
- Notes: `currency: leg.currency || sponsor.currency` (181): ledger currency always "usd" by column default (journal never sets it). `countryVatBps` returns 0 for a disabled or missing country row, so disabling Egypt in settings would reprint every past Egyptian invoice with no VAT.

### lib/billing/ledger.ts (991 lines)
- For: the double-entry books. `journal` is the only writer of `ledger_entries` in this file.
- Decides: `journal` (70) drops zero legs, throws `UnbalancedTransaction` if legs do not sum to 0, one insert; never sets `currency` (column default 'usd') and defaults `entity` to 'us' (95). Balances: `heldForTherapist` (116), `heldForTherapistOrg` (138), `heldBalances` (165), `trialBalance` (192), `unbalancedTransactions` (247), `reconcile` (898), `traceHeld` (954).
- LEDGER ACCOUNTS (schema.ts 2360-2420): `cash`, `therapist_payable`, `therapist_receivable`, `platform_revenue`, `platform_expense`, `sponsor_pot`, `vat_payable`, `fx_difference`.
- TXN KINDS (schema.ts 2423-2451): session_payment, session_refund, invoice_raised, invoice_settled, invoice_written_off, earnings_transfer, adjustment, manual_payout, entity_transfer, fee_netted, pot_topup. No DB CHECK on txn_kind.
- Leg writers in this file (all via `journal`): `postSessionPayment` (318; destination: cash, platform_revenue, therapist_receivable; platform: cash, vat_payable, platform_revenue, therapist_receivable, therapist_payable; THROWS if destination carries VAT, 360), `postSessionRefund` (460), `postInvoiceRaised` (525), `postInvoiceSettledFromHeld` (551), `postInvoicePaidByCard` (571), `postInvoiceWrittenOff` (590), `postEarningsTransfer` (612), `postAdjustment` (636, any account against revenue/expense), `postManualPayout` (705), `postEntityTransfer` (748, with fx_difference), `postFeeNettedFromHeld` (842).
- Assumes: callers post once (idempotency is the caller's job: `journal` has no unique key on ref). Append-only by convention (schema comment), not by a trigger visible here.
- Promises: A2 (no second ledger leg): the ledger itself has NO idempotency key; A2 rests entirely on the state guards of the callers (confirmPayment WHERE state='submitted'; settleSessionPayment WHERE status='pending'). T3: `postFeeNettedFromHeld` and `postInvoiceSettledFromHeld` are the netting legs.
- Notes: `postAdjustment` comment "never invents money from nowhere" (661-662) is only true of the platform's own side; an adjustment to `cash` against `platform_revenue` does create book cash. `postSessionPayment` throw at 360 is on the settle path (connect.ts 877) AFTER `session_payments` was set paid and the session marked paid (847-866): a throw there leaves a paid session with no ledger leg and skips `markInSession`.

### lib/billing/manual-entry.ts (496 lines)
- For: the single entry point every payer screen uses for the transfer rail: whether this payer needs it, the details, what is in flight, the EGP figure, the lines, and the one-call declare.
- Decides: `sponsorNeedsTransfer` (124) is `sponsors.entity === 'eg'`; `organizationNeedsTransfer` (142) is `organizations.region === 'eg'`; `sessionTransferMoney` (183) VAT forwards on the given price at the org region's `vatBps` (0 when country unconfigured, 201), `settlesCents = gross + vat`; `manualEntry` (218) never opens a row; live row wins over the page's figure (305-336, `amountLabel` from `live.settlesCents`); if no live row, looks for the latest REJECTED payment in `paymentsFor(payer)` and returns its `rejectReason` verbatim (338-352); `declarePaid` (363) opens with `currency: "EGP"` (393) and submits proof in one call; `potTopUpLadder` (454) builds every stepper label on the server from `potTopUpMoney` (pot.ts) between `minTopUpCents` and `maxTopUpCents` in `topUpStepCents`.
- Assumes: callers pass the patient's SHARE as `priceCents` (verified: app/pay/[token]/page.tsx 146, actions.ts 237 and 292 pass `patientOwesFor(...).grossCents`); `payouts.egpRateMicro`; settings validation keeps `topUpStepCents > 0` (else the ladder loop at 482 never ends; see settings/defs.ts entry).
- Promises: A3: kept for account payers (351, verbatim `rejectReason`); BROKEN for guests because `paymentsFor({kind:"session"})` returns [] (manual.ts 431), so a rejected guest sees the bank details again with no reason (task 124 confirmed). CV1/CV4: VAT forwards on the share, kept. CV2: kept for the amount (live row wins); `taxNote` in the live branch is recomputed from the caller's current `vatCents` (322) rather than the row, so tax note and amount can disagree after a price change.
- Notes: `lastRejection` (339) matches any purpose when `refId` is null and does not filter by `purpose`; and it finds the newest REJECTED row even if a later payment for the same ref was confirmed. `amountCents` is `egpMinorFor(settles, rate)` at declare time: the pounds figure a sponsor sent is the rate at declaration, the credit is USD settles.

### lib/billing/manual-grants.ts (654 lines)
- For: what a confirmed transfer unlocks (`grantFor`, passed to `confirmPayment` as `onConfirmed` by app/(admin)/admin/transfers/actions.ts 33 and 102).
- Decides:
  - `grantFor` (47): session / payg_session to `grantSession`, subscription to `grantSubscription`, pot_topup to `grantPotTopUp`; unknown purpose throws.
  - `grantSession` (78): flips `sessions.payment_status` pending to paid, guarded in WHERE (84) which is its only idempotency; then if a `session_payments` row exists (pot-covered session, 186-195) posts ONLY a VAT journal (cash +vat, vat_payable -vat, 255-274) and raises `vatCents` on the row; else inserts a `session_payments` row (capture 'platform', `fundingSource: "card"` for a transfer, 348, `currency: "usd"` 309, crossing `egp_local_to_manual` via money.ts) and posts `postSessionPayment` (363).
  - VAT on the transfer rail is derived BY SUBTRACTION: `vatCents = settlesCents - patientShareCents` (227), not computed on the share.
  - `grantSubscription` (414): `ref_id` is the ORGANISATION; settles due invoices oldest first while money remains, `status='due'` in WHERE (442); leftover money only logged (466-478); then `settleOldestObligationByTransfer` (service.ts) with `settlesCents`.
  - `grantPotTopUp` (527): VAT worked BACKWARDS from `settles_cents` at the entity's current rate (575-580); one UPDATE of `sponsor_pots.balance_cents += net` guarded by `NOT EXISTS (payment confirmed AND decided_at < sponsor_pots.updated_at)` (593-604), throws if nothing updated (612); then journals cash +settles, vat_payable -vat, sponsor_pot -net (621-642).
- Ledger leg writers here: `grantSession` (direct `journal` 255, and `postSessionPayment` 363), `grantPotTopUp` (direct `journal` 621). `grantSubscription` writes NO ledger leg.
- Assumes: `payFromPot` wrote the only `session_payments` row for a covered session (unique `session_id`); `postSessionPayment`'s platform branch; `settleOldestObligationByTransfer` in service.ts; `entityVatBps` in pot.ts.
- Promises: A1 kept (grant only from `onConfirmed` after the state flip). A2: kept for session (payment_status guard) and subscription (`due` guard); for pot the guard is the `decided_at < updated_at` comparison (see Suspect). A4: overpayment on a subscription is a `log.warn` only (472), not work on a screen: BROKEN as written here unless /admin/transfers shows it (not in slice). CV3 (books hear the money, VAT on HER share): kept for covered sessions (VAT legs) but by subtraction. CV4: see Suspect on subtraction.
- Notes: none of the journals here set `entity`, so Egyptian transfer money is posted to entity `us` (ledger.ts 95) although it landed in the Egyptian bank; see Broken. The comment "an operator re-runs it" (518-520, 612, and manual.ts 478-481) has no code path: there is no re-run action (grep: only callers are confirm and confirmUnclaimed in app/(admin)/admin/transfers/actions.ts), and a confirmed row cannot be confirmed again.

### lib/billing/manual.ts (715 lines)
- For: the Egyptian manual transfer rail's queue: rows, states (`awaiting_proof`, `submitted`, `confirmed`, `rejected`), who decided and when.
- Decides:
  - `Payer` union (72): user, patient, sponsor, session (guest; carries `organizationId` of the practice, 82, written to the row by `payerColumns` 110-117).
  - `transferDetails` (141): heading "Bank Transfer" for company, "InstaPay / Bank Transfer" otherwise; `unconfigured` when no fields.
  - `egpRateMicro` (176) is the operator's `payouts.egpRateMicro`, deliberately not `quoteFor`; `egpMinorFor` (182) `Math.round(usd * rate / 1e6)`.
  - `openManualPayment` (196): refuses amount or settles <= 0; if a live row (`awaiting_proof` or `submitted`) exists for (purpose, refId) it RE-STATES amount, settles, currency and lines on it (238-265), including on a `submitted` row; else inserts with `onConflictDoNothing` and re-reads (278-308). Currency default `"EGP"` (244, 285).
  - `submitProof` (320): reference or proof required; state in WHERE (343) allows `awaiting_proof` or `submitted` (so re-submitting overwrites reference and proof on a submitted row); then `noticePaymentSubmitted`.
  - `queue` (372, submitted, oldest first, limit 200), `openCarts` (403, awaiting_proof, newest first, limit 200), `waitingCount` (414).
  - `paymentsFor` (423): returns `[]` for a `session` payer (431), task 124 confirmed.
  - `livePaymentFor` (449): only awaiting_proof / submitted.
  - `confirmPayment` (484): single UPDATE `state='submitted'` to `confirmed` with `decided_at = now()` DB clock (519-525); second press gets "That payment is not waiting for a decision." (528); `onConfirmed` (the grant) runs after and its failure does NOT unwind (530-546), returns an error string; then `noticePaymentConfirmed`.
  - `confirmWithoutProof` (596): reason >= 10 chars; moves `awaiting_proof` to `submitted` writing `rejectReason = "Received without proof. " + reason` (614-627); audits `payment.confirmed_without_proof` with `organizationId ?? ""` (647); then `confirmPayment`.
  - `rejectPayment` (670): reason >= 10 chars, trimmed, stored in `reject_reason`; only from `submitted` (689); sends NOTHING to the payer.
  - `detailsLockedBy` (709): count of open rows; details cannot change while any exist.
- Assumes: partial unique index `manual_payments_one_live_per_ref` on (purpose, ref_id) for live states; `manual_payments_one_payer` CHECK; a DB CHECK requiring `reject_reason` on rejected (comment 665); `onConfirmed` supplied by caller (it is optional in the type, 487).
- Promises: A1 kept: nothing in this file grants; grant only inside `confirmPayment` after the state flip. A2 kept at the row: the state guard in WHERE means the second Confirm changes nothing and says so (528). A3: stored verbatim (687) but never pushed to the payer (see Broken). A4: `openCarts` is the unmatched-line search list; overpayment has no field (no "amount that arrived") anywhere on the row.
- Notes: `onConfirmed` is optional: a caller that omitted it would confirm money and grant nothing with an `ok`. Both current callers pass `grantFor`. The comment "an operator can re-run a grant" (478-481) has no implementation. The guest's `organizationId` on the row makes guest payments appear in the clinician's pending bar (see pending.ts).

### lib/billing/money.ts (290 lines)
- For: pure arithmetic for two currencies and two rails (PLAN 3c).
- Decides: `convert` (44) rounds half away from zero; `rateWithSpread` (50); `egpSettlement` (78); `SUPPORTED_CURRENCIES` usd, egp (126); `CURRENCY_BY_ENTITY` us to usd, eg to egp (130); `collectionCurrencyFor` (149) EG is egp else usd (the default for every other country); `collectionRailFor` (154); `crossingFor` (182) six crossings; `holdsMoney` (203) all but `usd_stripe_to_connect`; `isCrossBorder` (219); `entityFor` (242) egp crossings are `eg`, all else `us`; `payoutRailFor` (271) EG always manual, else connect only with account and payouts enabled, no country means manual; `payoutCurrencyFor` (288) stripe usd, else egp.
- Assumes: nothing (pure).
- Promises: supports CV2 (one rounding rule).
- Notes: `entityFor` exists and says an `egp_local_to_manual` payment belongs to entity `eg`, but no ledger writer in this slice calls it: `grantSession` records crossing `egp_local_to_manual` and posts with default entity `us`. The comment at 236-240 ("topUpPot refuses an Egyptian sponsor ... so there is no pot money in the Egyptian entity") is stale: `grantPotTopUp` credits Egyptian sponsors' pots by transfer.

### lib/billing/obligations.ts (286 lines)
- For: renewal obligations, the product's own record of a paid subscription period (C294, C310).
- Decides: `raiseObligation` (57) insert, `onConflictDoNothing` on the period unique index, currency required (usd|egp); `settleObligation` (91) guarded `state='due'`; `obligationCovering` (144) paid beats due, then furthest `period_end`, excludes void; `obligationsDueWithin` (186); `lapseOverdue` (219) due past `due_at` to `lapsed`; `reconcileRenewals` (248) both directions.
- Assumes: `renewal_obligations_period_unique`; `invoices.kind = 'subscription'`; `settled_ref` holds the invoice id as text.
- Promises: none of the 25 directly (clinician plan entitlement).
- Notes: `reconcileRenewals` matches `settled_ref = invoices.id::text`, but the transfer rail settles with `ref: payment.id` (manual-grants.ts 495, the manual_payments id), so every subscription invoice paid by transfer would appear in `invoicesWithNoObligation` if service.ts writes that ref (check service.ts entry).

### lib/billing/payment-notices.ts (257 lines)
- For: the two messages a transfer payer gets: submitted and confirmed (76.14).
- Decides: `recipientFor` (64): sponsor gets the FIRST `sponsor_users` row by sponsor id (73-77) although the comment says "Admins only" (68-72); clinician by email; patient account by email/phone/person; guest by `sessions.guest_email` (130-139). `noticePaymentSubmitted` (177), `noticePaymentConfirmed` (214, with join link and in-app notice for patients). Both swallow errors.
- Assumes: `notify` in lib/notify.
- Promises: P2 (payment confirmation appears in the app): kept only for a patient with `personId` (in-app notice 237); a guest gets email only, a clinician email only. A3: the file says a rejection is "loud elsewhere" (44-46): it is not (see Broken).
- Notes: sponsor recipient is not filtered by role; "Admins only" comment is not what the query does.

### lib/billing/payouts.ts (646 lines)
- For: the manual (Egyptian) payout queue: payout methods, requests, approve, send, confirm, reject, claim, queue, aged alarm.
- Decides: `savePayoutMethod` (92) one default per clinician, currency from method; `requestPayout` (165) amount checked against ledger `heldForTherapist` (170-176), one open request at a time (181-193), rate frozen via `quoteFor` (203, which returns null in production for EGP, so every EGP payout request in production fails with "We cannot price that currency right now"), entity `us` for stripe else `eg` (209); `move` (247) status in WHERE; `approvePayout` (301) not payee, not last editor, two-person above threshold; `markPayoutSent` (354) posts `postManualPayout` BEFORE the guarded `move` (371-392); `rejectPayout` (445) reason >= 5, notifies the clinician with the reason verbatim; `alertAgedPayouts` (604) stamps `alertedAt` in the same UPDATE, notifies up to 10 super_admins.
- Assumes: DB constraints `payout_requests_approver_not_payee`, `_approver_not_editor`, `_sent_was_approved`.
- Promises: T3 (netting): NOT here: `requestPayout` pays out the whole held balance with no reference to what the clinician owes; netting must happen before (service.ts). 
- Notes: nothing in this file ever pays automatically: every transition is a named person. `claimPayout` writes an event with `fromStatus: null, toStatus: "requested"` even when the request is `approved` (505). `manualQueue` computes `owner` and discards it (`void owner`, 551); `ownerName` is always null (570). Aged alert is once per request (`isNull(alertedAt)`), never repeats.

### lib/billing/pending.ts (218 lines)
- For: the "money in flight" bar every portal layout renders (76.4).
- Decides: `pendingPaymentFor` (89) by organisation, sponsor or session; newest row in awaiting_proof / submitted / confirmed (139-143); a confirmed one shows for 48 hours (79, 151-154); REJECTED rows are never returned.
- Assumes: callers: app/(app)/layout.tsx 73 (organisation), app/(sponsor)/layout.tsx 67 (sponsor). No caller passes `kind: "session"` (grep), so a guest has no bar.
- Promises: A3 partly: on rejection the bar simply vanishes (or falls back to an older row). P2: the bar is in-app, kept for clinicians and sponsors.
- Notes: see Broken: guest payments carry the practice's `organizationId`, so they surface in the clinician's own bar. Stale: the comment at 117-124 says `awaiting_proof` is excluded, and the code and the comment below it (125-138) include it.

### lib/billing/plans.ts (316 lines)
- For: pure pricing logic over `platform_settings.pricing.tiers`: which tier a spend earns, entitlement, what a credit purchase buys, what one session costs, money formatting.
- Decides: `tierForSpend` (53) walks ONLY tiers with `monthlyCents === 0` and keeps the last whose `unlockCents <= spent` (H24 fix, sprint 57); falls back to `tiers[0]` when there is no earnable tier; `tierByKey` (64) unknown key falls back to `tierForSpend(tiers, 0)` ("fail closed"); `entitledTier` (121): paid obligation covering now with a priced plan wins, then Stripe mirror (active or past_due, period end in future or null), else earned; `quoteForSpend` (194) credit equals spend; `sessionLines` (224) platform fee on every session, AI fee only when `aiConsented`, both lines at 0 on a monthly tier; `formatUsd` (275), `formatMoney` (297) locale fallback `en-US`.
- Assumes: `parseTiers` sorts ascending and `settingsProblem` requires a zero-threshold tier (settings/defs.ts).
- Promises: T1 adjacent (AI fee only with consent). README contradiction 3 (note fee "consent to recording" vs "AI on"): the code's word is `aiConsented`, a single flag passed in; which consent it is is decided by the caller (service.ts).
- Notes: `tierForSpend` still has the H24 shape for EARNABLE tiers: if two credit tiers ever both carry `unlockCents = 0`, everybody gets the later (cheaper) one. `tierByKey`'s "most expensive" claim (65-66) is only true if the first zero-threshold earnable tier is the dearest; with several zero thresholds it returns the LAST one, the cheapest. `entitledTier` honours a subscription with `currentPeriodEnd = null` indefinitely (173-178).

### lib/billing/pot-alerts.ts (79 lines)
- For: telling a sponsor's admins their pot is empty (E5 back half).
- Decides: `alertSponsorPotEmpty` (32): only `sponsor_users` with role admin and not deleted; message names the company, no person, time or therapist (C243).
- Assumes: called from `payFromPot` on `insufficient` (pot.ts 431-439) only.
- Promises: E1/E2 kept (no name, no time). E5: the sponsor is told; the patient half is the caller's.
- Notes: not called on the race-lost `insufficient` (pot.ts 496-500), so a pot emptied by a concurrent booking alerts nobody. No de-duplication: every refused booking against an empty pot re-sends to every admin.

### lib/billing/pot.ts (1034 lines)
- For: the corporate pot: VAT on top-ups, spending a pot at booking, refunding to a pot, top-up by card, reconciliation, the ledger balance a sponsor is shown.
- Decides:
  - `potTopUpMoney` (133): VAT forwards on the credit, `settles = credit + vat` (76.1).
  - `entityVatBps` (142): `country_settings` by entity, enabled only, 0 otherwise.
  - `payFromPot` (181): one primary, active/provisional, not removed/paused, verified enrolment of an active sponsor (232-260); provisional cap claimed by conditional UPDATE (294-321); `coverageNow` then `coverageSplit` at booking (346-348); sponsor share 0 returns `no_benefit` (350-353, E4); early read check `balance + overdraft < share` returns `insufficient` and alerts (408-442); the REAL guard is the conditional debit `balance + overdraft >= share` in the WHERE (481-494, C382); lost race returns `insufficient` (496-500); payment row insert on unique `session_id` is the idempotency claim, with an unconditional compensating credit on conflict (520-583); session marked paid only when fully covered (597-602); journals the pot leg (sponsor_pot +share, cash -share, 620-651) then `postSessionPayment` platform capture with vat 0 on the FULL gross (654-671).
  - `refundToPot` (718): finds the sponsor through the ledger txn (751-776), credits the pot `payment.grossCents` unconditionally (786-792), journals sponsor_pot -gross, cash +gross reusing the txn id (794-803), then marks the payment refunded guarded on paid (805-808).
  - `topUpPot` (822): refuses `entity = 'eg'` (849), below `minTopUpCents`, no pot, no terms; journals cash +charged, vat_payable -vat, sponsor_pot -net (899-923) then credits the table balance by `amountCents` (the net credit).
  - `reconcilePots` (947), `ledgerPotBalance` (979), `potTotals` (997, counts positive sponsor_pot legs as sessions).
- Ledger leg writers here: `payFromPot` (journal 620 and `postSessionPayment` 654), `refundToPot` (journal 794), `topUpPot` (journal 899).
- Assumes: `sponsor_pots_overdraft_bounded` CHECK (drizzle/0072_corporate.sql 281, added NOT VALID); `session_payments` unique on `session_id`; `coverageNow`/`coverageSplit`/`vatOn` in settings/defs.ts; the overdraft figure is set by `openPot` in lib/data/sponsor-admin.ts 233 (not in this slice; the 5000-cent figure is not in pot.ts).
- Promises: E3 kept at booking (frozen split on the payment row 541-543; later readers read the row). E4 kept here in the sense that 0% only stops the money (returns `no_benefit`, touches no enrolment). E5: pot takes nothing on insufficient and the sponsor is told; the patient's "ask HR" copy is the caller's. Race between two bookings: kept, the guard is the debit. E1/E2: nothing here writes a patient name or session reference into a sponsor-scoped row; the pot leg carries only sponsor id and amount, though its `created_at` is the booking time (see Suspect).
- Notes: VAT on a pot session is 0 by design (C241); the patient's share VAT is added when the patient pays (connect.ts, manual-grants.ts). `potTotals.sessions` counts every positive sponsor_pot leg, so it is a count of spends, and a sponsor sees "how many" (E1). Comment at 470 says the WHERE is `>= gross`; the code is `>= sponsorShare` (fine, stale wording).

### lib/billing/seats.ts (293 lines)
- For: clinic seat pricing: current bill, the quote before a change, applying a change, filled seats, release, taking a seat.
- Decides: `currentSeatBill` (25) prices `organizations.seats` (a purchased COUNT) through `seatMonthlyCents`; `quoteSeatChange` (53) uses the subscription's `currentPeriodEnd`, or now plus 30 days, and a 30-day period (73-74); `applySeatChange` (94) max 500, re-quotes BEFORE the write (107) then a guarded UPDATE on the count the caller was shown (112-121), then bills `proratedCents` via `billSeatProration` (152-160) or sets an upcoming discount for a downgrade (161-168, C331: credit, never refund); `seatsFor` (181) live `clinic_seats`; `releaseSeat` (204) stamps `released_at` only; `takeSeat` (250) `billable_from` = the joiner's own period end if in the future, else now (C355).
- Assumes: `seatChange`, `seatMonthlyCents` in settings/defs.ts; callers app/(app)/billing/actions.ts 264 and 295 (quote and save), lib/data/clinic-admin.ts 466, 598 (takeSeat) and 769 (releaseSeat).
- Promises: PL7 (quote shown before, that figure billed): partly: `applySeatChange` re-quotes at write time with a fresh `now` (107-110) and bills that, not the figure the clinic saw; the only guard is the seat count, so a quote shown on the 10th and accepted on the 20th bills the 20th's proration. C3 (one bill, priced per seat, the seats that were filled): BROKEN as far as this slice shows: the price is `organizations.seats`, a number the manager types, and `clinic_seats` (who actually fills a seat) never feeds it; and no code in lib/ or app/ raises the monthly seat bill at all (grep `seatMonthlyCents`: only defs.ts and this file). C4/PL6 (release lowers the next bill by exactly one seat): BROKEN: `releaseSeat` does not touch `organizations.seats`, and lib/data/clinic-admin.ts 769 calls only `releaseSeat`, so the bill figure is unchanged until a manager re-saves the count. The clinician does land in a new `solo` organisation (clinic-admin.ts 744-777), so "lands on pay as you go by themselves, nobody suspended" is kept.
- Notes: `billableFrom` is written on `clinic_seats` and read by nothing in this slice.

### lib/billing/service.ts (1055 lines)
- For: clinician billing: the default subscription row, charging a completed session, netting, raising invoices, credit purchase invoices, usage, summaries, reconciler, discounts, the transfer-rail subscription and seat proration.
- Decides:
  - `getSubscription` (32) creates `plan: "payg"` when missing.
  - `chargeForSession` (70): AI consent is `sessions.recording_consent === 'granted'` (87-93), so "AI on" and "consented to recording" are ONE flag (settles MAP contradiction 3); first session free claimed by conditional UPDATE (112-121); then `spendCredit` (155); then `netFeeFromEarnings` if outstanding (179-187); else a `due` invoice.
  - `netFeeFromEarnings` (219): only if `payouts.netFeeFromHeldEarnings` and held >= whole fee; raises a `paid` invoice with `postToLedger: false` and posts `postFeeNettedFromHeld` with `entity: "us"` hard-coded (256).
  - `raiseInvoice` (262): `onConflictDoNothing` on `session_id`; lines and ledger only when created; posts `postInvoiceRaised` (therapist_receivable +, platform_revenue -) and, for `paid`, `postInvoicePaidByCard`.
  - `recordCreditPurchaseInvoice` (377): consumes `upcomingDiscountCents` once; posts raised, written-off, paid-by-card.
  - `billingSummary` (539), `sumPayable` (607), `reconcileMissingCharges` (653, 48h window, pass 1 re-runs `chargeForSession`), `reconcileMissingLines` (682).
  - `discountInvoice` (760) clamps, posts only the increase as written off; `setUpcomingDiscount` (812) OVERWRITES any existing upcoming discount (not additive).
  - `subscribeByTransfer` (867): refuses unknown or unpriced tier and any org with a `due` obligation; raises a USD obligation and a `due` subscription invoice; grants nothing (A1 kept).
  - `settleOldestObligationByTransfer` (952): oldest due obligation, refused if `settlesCents < amount` (1002), `settleObligation` via manual with `ref` = the manual payment id.
  - `billSeatProration` (1039): a `due` subscription invoice with the arithmetic in the description.
- Ledger leg writers here (indirect): `raiseInvoice` (postInvoiceRaised, postInvoicePaidByCard), `netFeeFromEarnings` (postFeeNettedFromHeld), `recordCreditPurchaseInvoice`, `discountInvoice` (postInvoiceWrittenOff).
- Assumes: `invoices_session_unique`, `invoice_lines_invoice_kind_unique`, `subscriptions_org_unique`; `settleInvoicesFromHeld` is called at session end (lib/session-finish.ts 84, outside slice).
- Promises: T3 (owed nets against earned before payout): partly kept: netting happens per session only when the setting is on AND held covers the WHOLE fee (238), and at session end via `settleInvoicesFromHeld` (whole invoices only); nothing nets at payout time (payouts.ts `requestPayout` pays the whole held balance). A1 kept for `subscribeByTransfer`.
- Notes: see Broken on the second call of `chargeForSession` (credit spent and netting posted even when the invoice insert lost the conflict).

### lib/billing/session-owed.ts (126 lines)
- For: what a patient still owes after the pot paid its share, and the three lines that explain it (76.27).
- Decides: `patientOwesFor` (52) reads the (single) `session_payments` row's frozen `patientShareCents`, clamps it to `[0, current price]`, falls back to the full price when no split; `sessionLines` (108) session price, minus benefit, plus VAT, empty when nothing covered.
- Assumes: one `session_payments` row per session (unique); callers app/pay/[token]/page.tsx and actions.ts.
- Promises: E3 kept (frozen share, never recomputed from coverage). CV1 kept (patient asked for their share, not the price). C227/C243 kept (no employer named).
- Notes: stale comment 61-65: "ordering by creation and taking the first" but the query has no ORDER BY, and "a refund writes its own row" is false (refunds flip `status` on the same row; the unique index forbids a second). It does not filter by `status`, so a pot row later refunded to the pot (`status = refunded`) still tells the patient they owe only their share.

### lib/billing/stripe.ts (803 lines)
- For: the Stripe client, credit and subscription checkout, invoice batch checkout, the checkout outcome, the webhook, subscription mirror, cancel and resume.
- Decides: `getStripe` (28) null unless `features.billing`; `createCreditCheckout` (96) has NO caller (76.34, left for inbound `credit_purchase`); `createSubscriptionCheckout` (201) validates the tier against settings, cancels a different live plan at period end first (C371), quantity 1, `currency: "usd"`; `createInvoiceCheckout` (315) amounts from `sumPayable` (server), tags invoices with the checkout id; `applyCheckoutOutcome` (360) settles session payments, activates credit, upserts subscription, settles tagged invoices guarded `status='due'` and posts `postInvoicePaidByCard` except for session payments (463); `handleWebhook` (594) claims `stripe_events` BEFORE processing (602-608); `invoice.paid` raises and settles an obligation (663-700) with `settled_ref = invoice.id`; `invoice.payment_failed` sets past_due.
- Ledger leg writers here: `applyCheckoutOutcome` (postInvoicePaidByCard 464), indirectly `settleSessionPayment` and `recordCreditPurchaseInvoice`.
- Assumes: route handler at app/api/... passes raw body; `subscriptions_org_unique`.
- Promises: A2 analogue for card: guarded on `due` and `pending`. C3: the subscription is quantity 1 at `tier.monthlyCents`; seats are not priced into any Stripe object.
- Notes: see Broken on the webhook claim-before-work. `mirrorSubscription` inserts `plan: "payg"` for an unattributed tier (551). `invoice.paid` obligation `plan` falls back to `""` (676) which `entitledTier` will never match, so the obligation grants nothing and the mirror is the only entitlement.

### lib/finance/assumptions.ts (197 lines)
- For: the types of the abstract forecast's inputs, each carrying provenance (measured / assumed / derived).
- Decides: `measured` (41), `assumed` (49) constructors; `inputsOf` (175) flattens one level of each group; `provenanceSplit` (193).
- Assumes: `verify:finance` asserts the import graph (header 24-25).
- Promises: none of the 25. Supports the honesty rule "no forecast of what a clinician will earn" (VALUE-STATEMENTS preamble): nothing here computes a clinician's earnings.
- Notes: `derived` is declared and never produced by any constructor in this slice.

### lib/finance/benchmark.ts (264 lines)
- For: the one read-only DB seam of lib/finance: measure session cost, consent rate, fees and volumes into a frozen snapshot.
- Decides: `take` (68) counts sessions/therapists/patients/AI calls, fits the two-term AI cost via physics.ts, falls back to the 2026-09-14 figures as `assumed` when the fit refuses (167-179); consent rate = completed sessions with `recording_consent = 'granted'` (183-195); fees read from `getSettings()` and labelled `measured` with samples 1 (216-233); default `aiRateCents ?? 300` (229); a standing `couldNotMeasure` list.
- Assumes: `ai_request_logs.cost_microcents` is thousandths of a cent (H13): divides by 100,000 (160).
- Promises: none of the 25.
- Notes: settings values are tagged `measured` though the file's own definition of measured is "computed from rows" (assumptions.ts 10). It imports `@/lib/settings` (103), so lib/finance does READ `platform_settings`, contrary to store.ts's header claim that no finance module "can reach ... platform_settings" (store.ts 5-7); the claim is about writes and reads alike as worded.

### lib/finance/beta.ts (544 lines)
- For: the cohort model of the Egypt beta (prices read off each cohort's own age).
- Decides: `priceMultiplier` (239); `runPlan` (247): churn before arrivals; the cliff moves a share of subscribers to pay-as-you-go rather than deleting them (298-322); revenue = subscriptions + 15% take on EVERY modelled session + $1 base and AI fee on metered sessions (420-431); AI cost on consented sessions only (436); card payment cost on all session value (440-442); marketing vs other spend split by a label regex (456-461); CAC = sales roles plus marketing (516-543).
- Assumes: plans.ts supplies the plan.
- Promises: none of the 25. Honesty rule: this models OUR revenue, not a clinician's earnings, so it does not breach the "no forecast of what a clinician will earn" refusal.
- Notes: comment at 435 says "AI runs on every session, including the ones we gave away" but the line multiplies by `consentRate`; model.ts (202) charges AI cost on every session. The two engines disagree about AI cost by the consent rate (30%). Comment at 414 says the take is "on every PAID session" but `takeUsd` uses all `sessions` (420). The payment-cost line assumes card processing on every session, while the product's Egyptian rail is a manual transfer.

### lib/finance/format.ts (66 lines)
- For: printing dollars, pounds and counts without `Intl` (C84).
- Decides: `usd` (39) cents under $10, whole dollars above, leading minus; `egp` (52); `count` (64).
- Assumes: nothing.
- Promises: none.
- Notes: none.

### lib/finance/model.ts (320 lines)
- For: the abstract 36-month forecast, one pure function.
- Decides: `forecast` (100): growth steps, churn then arrivals; free sessions for new therapists earn nothing; take on paying sessions only; $1 room fee and AI fee on metered share; AI cost on EVERY session (202); runway from the last month's burn; deepest deficit.
- Assumes: assumptions.ts shapes.
- Promises: none of the 25.
- Notes: the comment at 162-170 records that beta.ts was fixed and this engine was not until later; see beta.ts for the remaining disagreement on AI cost.

### lib/finance/physics.ts (359 lines)
- For: the two-term session cost model (fixed + per-minute), fitted on tokens, and the check against the API benchmark.
- Decides: `fit` (136) refuses under 8 samples or spread under 1.5x (133-163); `costAt` (191) returns thousandths of a cent (H13 unit, named "microcents"); `naiveCostAt` (211); `benchmarkCostAt` (284); `agreement` (341) a zero or non-finite benchmark never agrees; tolerance 25%.
- Assumes: rates in cents per million tokens / per audio minute.
- Promises: none.
- Notes: `agreement` with run = 0 and a real benchmark returns drift -1 ("-100%"), the H42 shape; the caller must say "nothing to compare" (H42 marked fixed; the fix is not in this file).

### lib/finance/plans.ts (679 lines)
- For: the operating plan for Egypt (beta, cliff, 18-month runway) as data, with provenance labels.
- Decides: `EGP_PER_USD = 50` (46); unit: $20 session, 15% take, $1 base, $3 AI, 70% consent, 50 minutes, measured AI terms from scenarios.ts; segments COMPANY (arrivals [3,2,2], $100 welcome credit), CLINIC (`monthlyUsd: 72 * 2.5`, 2.5 clinicians), THERAPIST ($80); offer [0, 0.5, 0.5] then full; after the beta one free month; people and spend; `PROVENANCE` list; `withCase` (663) scales churn at full price and steady arrivals.
- Assumes: beta.ts `Plan`.
- Promises: none of the 25.
- Notes: several comments and PROVENANCE rows are stale against the values beside them (see Stale).

### lib/finance/scenarios.ts (388 lines)
- For: the four shipped abstract scenarios (benchmark, real sessions, base, funded) and the measured AI constants.
- Decides: `AI_FIXED_USD = 0.01317`, `AI_PER_MINUTE_USD = 0.00407` (87-88); `SESSION_PRICE_USD = 20` (147); fees 100 cents, 1500 bps, $3 AI typed in and tagged `measured` (112-122); BASE and FUNDED people mirror plans.ts.
- Assumes: plans.ts agrees on every decision; `verify:finance` asserts the session price equality.
- Promises: none.
- Notes: `platformFeeCents`, `platformFeeBps` and `aiFeeUsdPerSession` are hand-typed constants labelled `measured` against `platform_settings`; they do not follow the settings (the benchmark path does). 

### lib/finance/store.ts (117 lines)
- For: read and write `finance_scenarios` and `finance_benchmarks` only.
- Decides: `saveScenario` upsert by slug (56); `allScenarios` (94) shipped four are code, saved rows with a shipped slug are hidden.
- Assumes: `verify:finance`.
- Promises: none.
- Notes: writes only finance tables (kept). A saved row using a shipped slug is silently shadowed by the shipped scenario (107).

### lib/settings/defs.ts (1860 lines)
- For: the shape, defaults and parsers of every platform setting and country setting, plus the pure money arithmetic (VAT, fee, split, coverage, seats, conversion) and the rails' refusals.
- Decides:
  - `SETTINGS_DEFAULTS` (484): tiers payg ($0 unlock, $3 AI, $0/month), practice ($80/month), clinic ($144/month, i.e. two seats) (511-521); seat bands 1 seat $80 flat, 2+ $72 each (548-551); platform fee 1500 bps and $1 (562-563); price 500 to 50,000 cents; `twoPersonThresholdCents` 50,000; `alertAfterHours` 12; `netFeeFromHeldEarnings` true; `transferFields` empty; `egpRateMicro` 50,000,000; invoice entities blank; sponsor min top-up $100, step $50, max $5,000, welcome credit cap $100, average session $20, activity floor 5, verify cycle 6, coverage notice 30 days, provisional 1.
  - `int` (692) safe integers with bounds or fallback; `parseSeatBands` (727); `seatMonthlyCents` (756) highest band reached prices every seat (retroactive); `seatChange` (822) proration to the day with `ceil`, one rounding, negative is a credit; `parseTiers` (867) legacy conversion and sort by unlock then monthly; `parseGroup` (939) field by field with floors (fee bps max 9000; platform fee min 1; egp rate 1 to 1000 per dollar; activity floor min 2; coverage notice min 7; step min 100; transfer fields without label or value dropped, max 12, default audience everyone).
  - `settingsProblem` (1262): cap below floor; seat ladder must start at 1 and never go backwards; bands flat XOR per seat; a free tier (0 unlock, 0 monthly) must exist; no tier with both monthly and unlock; platform fee > 0.
  - `radarProblem` (1421), `IMPLEMENTED_COLLECTION_PROVIDERS = ["stripe"]` (1454), `collectionProblem` (1464): disabled country, no provider, or an unimplemented provider (Egypt's `paymob`) is refused with "Ask your therapist for a free link".
  - `COUNTRY_SEED` (1495): EG vat 1400, provider paymob, payout instapay/wallet, entity eg, crisis line NULL; US vat 0, stripe.
  - `parseCountry` (1561): currency DERIVED from entity (1605), entity defaults to `us` for anything not `eg` (1609).
  - `coverageSplit` (1718): sponsor share rounded once, patient share is the remainder, VAT on the patient share only (1733, C312); `coverageNow` (1757) pending coverage applies once its date passes; `vatOn` (1775) `Math.round`; `platformFeeOn` (1787) floor; `sessionMoney` (1810); `convertAtRate` (1834); `presentedTotal` (1848) VAT before conversion.
- Assumes: settings rows parsed on every read (index.ts).
- Promises: CV4 kept in `coverageSplit` (VAT on the share, computed forwards). E3 kept by design of `coverageNow` plus freezing at booking. README claim "collectionProblem refuses Egyptian card payments and points at the free link": kept (1471-1481).
- Notes: `vatOn` rounds half-up to nearest, not "up toward the authority" (comment 1783). The doc block at 1643-1671 ("VAT, and the reason it is its own function") is orphaned above `coverageSplit`, 100 lines from `vatOn`. `seatChange`'s comment (804-807) says "the caller does not apply" a reduction; `applySeatChange` does apply it as an upcoming discount (seats.ts 161-168). `topUpStepCents` comment says its ceiling is "the smallest top-up" (1174-1180); the bound is 1e9.

### lib/settings/index.ts (253 lines)
- For: reading and writing settings and countries (control plane).
- Decides: `getSettings` (44) per-request `cache`, and on ANY DB error returns `SETTINGS_DEFAULTS` (58-71); `getCountries` (81) returns `[]` on error; `getCountrySettings` (98) null unless found and enabled; `writeSettingsGroup` (118) parses before storing, no `settingsProblem` call (caller's job); `writeCountrySettings` (139) re-stamps `crisisLineVerifiedAt` on every save that has a tel; `seedSettings` (206) insert-only.
- Assumes: callers check permission and audit.
- Promises: none directly.
- Notes: a failed settings read silently prices with defaults: `egpRateMicro` 50 whatever the operator set, `transferFields` empty ("not configured"), fee 15%. A failed country read makes `getCountrySettings` null, and `sessionTransferMoney` (manual-entry.ts 201) then quotes an Egyptian session with ZERO VAT, while the card path refuses. See Suspect.

## Ledger accounts and every writer of a ledger leg (slice-wide)

Accounts (lib/db/schema.ts 2360-2420): `cash`, `therapist_payable`, `therapist_receivable`, `platform_revenue`, `platform_expense`, `sponsor_pot`, `vat_payable`, `fx_difference`. Column defaults: `currency` 'usd', `entity` 'us'. The only INSERT into `ledger_entries` is `journal` (ledger.ts 70).

| Function | File:line | Kind | Legs |
|---|---|---|---|
| `journal` | ledger.ts 70 | any | the writer |
| `postSessionPayment` | ledger.ts 318 | session_payment | destination: cash, platform_revenue, therapist_receivable; platform: cash, vat_payable, platform_revenue, therapist_receivable, therapist_payable |
| `postSessionRefund` | ledger.ts 460 | session_refund | reverse of the above |
| `postInvoiceRaised` | ledger.ts 525 | invoice_raised | therapist_receivable, platform_revenue |
| `postInvoiceSettledFromHeld` | ledger.ts 551 | invoice_settled | therapist_payable, therapist_receivable |
| `postInvoicePaidByCard` | ledger.ts 571 | invoice_settled | cash, therapist_receivable |
| `postInvoiceWrittenOff` | ledger.ts 590 | invoice_written_off | platform_expense, therapist_receivable |
| `postEarningsTransfer` | ledger.ts 612 | earnings_transfer | therapist_payable, cash |
| `postAdjustment` | ledger.ts 636 | adjustment | any account, against platform_revenue or platform_expense |
| `postManualPayout` | ledger.ts 705 | manual_payout | therapist_payable, cash (with entity) |
| `postEntityTransfer` | ledger.ts 748 | entity_transfer | cash, cash, fx_difference (NO CALLER in app/ or lib/) |
| `postFeeNettedFromHeld` | ledger.ts 842 | fee_netted | therapist_payable, platform_revenue |
| `payFromPot` | pot.ts 620 (+ postSessionPayment 654) | session_payment | sponsor_pot +share, cash -share |
| `refundToPot` | pot.ts 794 | session_payment | sponsor_pot -gross, cash +gross |
| `topUpPot` | pot.ts 899 | pot_topup | cash, vat_payable, sponsor_pot |
| `grantSession` | manual-grants.ts 255 (+ postSessionPayment 363) | session_payment | cash +vat, vat_payable -vat |
| `grantPotTopUp` | manual-grants.ts 621 | pot_topup | cash, vat_payable, sponsor_pot |
| callers of the post* functions | connect.ts 877, 1033, 1169, 1269; service.ts 251, 344-358, 418-441, 800; stripe.ts 464; payouts.ts 371 | | |

## Every place a currency (or entity) is defaulted

- manual.ts 244, 285: `currency ?? "EGP"` on every manual payment. manual-entry.ts 393: `"EGP"` hard-coded.
- connect.ts 134 `rateCurrency: "usd"` default; 773, 799 `session_payments.currency: "usd"`; 1154 transfer `"usd"`; 302, 335 only `usd` balances counted.
- manual-grants.ts 309, pot.ts 530: `session_payments.currency: "usd"`. manual-grants.ts 575 `sponsor?.entity ?? "us"`.
- ledger.ts 95: `entity ?? "us"` on every leg; schema 2499 `currency` default 'usd' (journal never sets it).
- service.ts 256: netting posted `entity: "us"`; 916 obligation `"usd"`.
- stripe.ts 119, 270, 336: `"usd"`; 684 obligation `"usd"`.
- money.ts 149-151: every country but EG collects `usd`; 288-289: every payout method but stripe is `egp`.
- settings/defs.ts 1605, 1609: country currency derived from entity, entity `us` unless exactly `eg`.
- invoice.ts 181: `leg.currency || sponsor.currency`.
- payouts.ts 209: entity `us` for stripe, else `eg`.
- payment-notices.ts 154: pounds formatted `en-US` for everyone.
- manual-entry.ts 201 / settings: a country with no row is VAT 0.

## Stale

1. lib/billing/pending.ts 117-124: says `awaiting_proof` IS EXCLUDED; the query (139) includes it and the next comment (125-138) says so.
2. lib/billing/payment-notices.ts 44-46: "A rejection is also silent HERE and loud elsewhere: `rejectPayment` already carries the operator's own words". `rejectPayment` (manual.ts 670-694) sends nothing; nothing in app/ or lib/ notifies a rejection (grep `payment.rejected`: none).
3. app/(admin)/admin/transfers/actions.ts 72 (outside slice, verified): "Rejected, and they have been told why." Nobody is told.
4. lib/billing/manual.ts 478-481 and manual-grants.ts 18-19, 518-520, 612: "an operator can re-run a grant" / "Check it before confirming again". No re-run path exists; a confirmed row cannot be confirmed again.
5. lib/billing/payment-notices.ts 68-72: "Admins only"; the query (73-77) takes the first `sponsor_users` row with no role filter.
6. lib/billing/money.ts 236-240: "there is no pot money in the Egyptian entity" because `topUpPot` refuses Egypt. `grantPotTopUp` credits Egyptian sponsors by transfer (manual-grants.ts 527).
7. lib/billing/invoice.ts 193-197: "the only entity it accepts is `us`"; Egyptian pots are funded through the manual rail. Also 211-214 assumes one `sponsor_pot` leg per top-up (true for both writers today).
8. lib/settings/defs.ts 336-338 (invoice group): "The Egyptian half is here and unreachable"; the manual rail reaches it.
9. lib/billing/manual.ts 222-231: "the floor is $5,000"; `minTopUpCents` default is $100 (defs.ts 654).
10. lib/billing/manual-grants.ts 408-412: "IT STOPS RATHER THAN PART-PAYING" / oldest first; the loop `continue`s past an invoice it cannot cover (437) and may settle a newer, smaller one.
11. lib/billing/session-owed.ts 61-65: "ordering by creation and taking the first" (no ORDER BY) and "A refund writes its own row" (it updates the same row; unique index forbids a second).
12. lib/billing/pot.ts 470: "`balance + overdraft >= gross` inside the WHERE"; the code compares against `sponsorShare` (491).
13. lib/settings/defs.ts 804-807: "the caller does not apply" a negative proration; seats.ts 161-168 applies it as a discount. 1643-1671: orphaned doc block for `vatOn`. 1783: "VAT rounds up"; it rounds to nearest. 1174-1180: step "ceiling of the smallest top-up"; not enforced.
14. lib/billing/connect.ts 739-744: the held-capture `payment_intent_data` branch is dead (`capture` is the constant "destination", 441).
15. lib/billing/stripe.ts 96-169 `createCreditCheckout`: no caller (the note says so; kept deliberately). lib/billing/ledger.ts 748 `postEntityTransfer`: no caller in app/ or lib/. lib/billing/money.ts 78 `egpSettlement`: no caller. lib/db/schema purpose `payg_session`: granted in manual-grants.ts 50, written by no caller.
16. lib/billing/payouts.ts 525, 551: `owner` built then `void`ed; `ownerName` always null (570).
17. lib/finance/plans.ts: comments and PROVENANCE rows disagree with the values beside them: COMPANY arrivals [3,2,2] vs PROVENANCE "Two, one, none" (575); CLINIC arrivals [2,3,4] (9) vs "Six over the quarter" (581); THERAPIST [3,5,6] (14) vs "Nine over the quarter" (586); CLINIC header "Four clinicians ... 3,000 EGP a month" (214-219) vs 2.5 clinicians at $72 a seat; THERAPIST header "1,000 EGP a month" (273) vs $80 (4,000 EGP); `payg.perSessionUsd` "alternative to the $100 plan" (588) vs $80; marketing header "Ads: 15,000 EGP a month" (424) vs $600; RUNWAY "the same two salespeople" (516-520) vs three sellers.
18. lib/finance/beta.ts 435: "AI runs on every session, including the ones we gave away" while the line multiplies by `consentRate`; 414 "every PAID session" while `takeUsd` uses all sessions.
19. lib/finance/store.ts 4-8: "no module under lib/finance can reach ... platform_settings"; benchmark.ts 103 reads it via `getSettings`.
20. lib/finance/scenarios.ts 112-122: fee figures typed as constants and labelled `measured` from `platform_settings`; they do not follow the setting.

## Suspect

1. lib/billing/manual.ts 238-265: `openManualPayment` re-states amount, settles and lines on a `submitted` row, keeping the proof and reference the payer already attached. A clinician who submits proof for four invoices and then reopens the picker for eight moves the claim under the operator's feet; `grantSubscription` then credits the new `settles_cents`. Matters for A2/A4 and "price shown equals price charged". Answer: /admin/transfers screen (does it show amount history?) and app/(app)/billing/actions.ts (is openCart called after submit?).
2. lib/billing/cart.ts 93-102 and 187-190: opening a new cart or pressing cancel DELETES `awaiting_proof` rows. `openCarts()` (manual.ts 403) is the list an operator searches for an unmatched bank line (RA8); a payer who transferred without pressing Submit and then opened another sheet or cancelled has erased that trace. A4 partly.
3. lib/billing/manual-grants.ts 593-613: the pot top-up guard is `decided_at < sponsor_pots.updated_at`. Any pot write between the confirmation UPDATE and the grant UPDATE (a booking's debit in `payFromPot` sets `updated_at`) makes a first confirmation read as a replay: the grant throws, the row stays confirmed, and every later retry is refused the same way (updated_at only moves forward). With no re-run path (Stale 4) the company's money is confirmed and never credited. Race window is small; consequence is money kept silently.
4. lib/billing/manual-grants.ts 206, 227: VAT on the transfer rail is `settlesCents - patientShareCents` (subtraction), with `patientShareCents` falling back to the CURRENT `sessions.price_cents`. If the price changed between declaration and confirmation, the difference is posted to `vat_payable` (price lowered) or VAT becomes 0 and cash is posted at the new price, above what arrived (price raised, ledger.ts 424). Where: can `price_cents` change on a pending session (lib/data/sessions.ts)?
5. lib/billing/manual-grants.ts 186-285: ANY existing `session_payments` row is treated as the pot case. A session with an abandoned card checkout row (connect.ts 764, status pending, no split) that is then paid by transfer would post only a VAT journal: no revenue, no therapist_payable, session payment row left `pending`. Where: can one session reach both rails (non-Egyptian payer country on an Egyptian practice)?
6. lib/billing/pot.ts 751-757: `refundToPot` finds "the" txn by `ref_type='session_payment' AND ref_id=payment.id LIMIT 1` with no order; on a covered session paid by transfer, `grantSession` posted a VAT journal with the same ref (manual-grants.ts 255-258) under a different txn id, so the lookup can land on the VAT txn and report "No pot spend is on the books".
7. lib/billing/pot.ts 620-651: the pot spend leg's `created_at` is the booking instant, keyed by sponsor id. Any sponsor surface that lists pot legs with timestamps (lib/data/sponsors.ts `weeklySpend`, not in slice) would reveal WHEN sessions were booked (E1 "never when"). Check the batching the MAP describes (Suspect 1 there).
8. lib/billing/invoice.ts 169-171: corporate invoice VAT is recomputed backwards from the cash leg at TODAY's `country_settings` rate rather than read from the `vat_payable` leg of the same txn; a rate change or disabling the country reprints past invoices with different VAT than the books hold.
9. lib/settings/index.ts 58-71, 81-88 with manual-entry.ts 194-201: a transient DB error on the settings or country read yields defaults (rate 50, no transfer details) or VAT 0 on an Egyptian transfer quote, and the payer declares against it; the row then freezes that figure.
10. lib/billing/connect.ts 1109-1190: `releaseHeldEarnings` reads the held balance, inserts a transfer row and calls Stripe with an idempotency key per ROW; two concurrent callers (the `account.updated` webhook and `refreshAccountStatus`, which fire together when onboarding completes, 234-236 and 263-267) both read the same balance and both transfer it. Also it never nets owed invoices first (T3).
11. lib/billing/connect.ts 1200-1215 (`releaseAllHeldEarnings`, nightly cron route 189): pays held earnings (including pot-funded sessions posted as `capture: "platform"`) to Connect with no person approving and no clinic step. machines.ts 144-145 says "Anything that pays on a timer is a defect" (said of payout requests). If a manual payout request for the same clinician is `approved` and not yet sent, this sweep and `markPayoutSent` both debit the same held balance.
12. lib/billing/manual-entry.ts 17-20: says an Egyptian patient of a US-entity therapist "can pay by card". `collectionProblem` refuses payer country EG (paymob not implemented, defs.ts 1471-1481) and `organizationNeedsTransfer` is false for a US practice, so that patient is offered neither rail unless the pay page lets them pick another country (app/pay/[token], not in slice). Stuck-person risk.
13. lib/billing/obligations.ts 266-283 with service.ts 1015: every subscription invoice paid by transfer is settled with `settled_ref = manual_payments.id`, so `reconcileRenewals` reports each one under `invoicesWithNoObligation` on /admin/vault: a permanent false drift that trains operators to ignore that list.
14. lib/billing/stripe.ts 676: an `invoice.paid` obligation with plan `""` when Stripe carries no lookup key or metadata; `entitledTier` never matches it, so the obligation-first fix (C310) silently does nothing for such subscriptions.
15. lib/billing/manual.ts 647: `confirmWithoutProof` audits with `organizationId: operator?.organizationId ?? ""`; if the audit table's organisation column is a uuid, an operator without an org 500s the override (H6 shape). Check lib/audit.

## Broken

1. **A covered patient paying the rest by card is charged and nothing records it.** connect.ts 789-813: the checkout row is upserted on `session_id` with `setWhere: status = 'pending'`, but the pot row written at booking has `status: "paid"` (pot.ts 557) and owns that unique `session_id`. The upsert updates nothing and the code does not check; Stripe checkout still opens; `settleSessionPayment` later finds no row with that checkout id (847-860), so the session stays `pending`, no ledger leg, `markInSession` never runs. The patient paid and is still asked to pay. Grep for a fallback: none (stripe.ts 368-371 is the only caller).
2. **Same path, the application fee can exceed the charge.** connect.ts 522, 614-640, 666: `cut` is on the FULL gross and auto-settle adds due invoices up to `gross - cut`, while the charge is only the patient's share plus VAT (611). At high coverage (for example 90% of $50: charge $5 plus VAT, fee $7.50) Stripe rejects `application_fee_amount` above the amount and the patient sees "Could not start the payment."
3. **Refunding a pot session gives the sponsor the whole price and unwinds nothing else.** pot.ts 786-803: `refundToPot` credits `payment.grossCents` (full price) to the pot, not `sponsorShareCents`; on a 10% covered session the company gets ten times what it spent. It posts sponsor_pot -gross / cash +gross (cash that never arrived) and does NOT reverse the `postSessionPayment` legs (therapist_payable, platform_revenue) nor reset `sessions.payment_status` (connect.ts 988-991 returns before 1063). The patient's own share (paid by card or transfer) is never refunded. Status is checked by a read (736) and flipped only at the end (805-808), so two concurrent refunds both credit the pot.
4. **A released seat does not lower the bill, and no monthly seat bill exists.** seats.ts 204-221 only stamps `clinic_seats.released_at`; the price reads `organizations.seats` (25-39) which the release path (lib/data/clinic-admin.ts 769) never touches. No code raises the monthly seat charge (grep `seatMonthlyCents`: defs.ts and seats.ts only); the transfer-rail plan charges the clinic tier's flat `monthlyCents` 14,400 (service.ts 909, defs.ts 521) whatever the seat count, and Stripe subscriptions are quantity 1 (stripe.ts 268). C3 and C4 as written are not implemented in billing.
5. **Money paid by transfer against invoices never reaches the books.** manual-grants.ts 414-505: `grantSubscription` flips invoices to `paid` and posts no leg. Each invoice raised `therapist_receivable +` / `platform_revenue -` (service.ts 344-349), so the receivable stays open for ever and cash is short by every Egyptian clinician's payment. The card path posts `postInvoicePaidByCard` (stripe.ts 464); the transfer path has no equivalent (grep: 3 callers, none manual).
6. **Egyptian money is booked to the US entity, so the reconciliation fails on the first Egyptian payout.** Every money-in leg on the manual rail defaults `entity: "us"` (ledger.ts 95; manual-grants.ts 255-274, 363-373, 621-642; service.ts 256 hard-codes "us"), while `postManualPayout` posts the EGP payout with `entity: "eg"` (payouts.ts 209, 376). Egyptian cash goes negative, `reconcile()` lists `eg` in `unbackedEntity` and `balances` reads false (ledger.ts 933-942). `entityFor` (money.ts 242) knows the right answer and is called by nobody.
7. **Manual payout can be booked twice.** payouts.ts 362-392: `markPayoutSent` reads `status === 'approved'`, posts `postManualPayout` (therapist_payable debit, cash credit), THEN runs the guarded `move`. Two operators pressing Sent together both post a ledger leg; one `move` fails and returns an error with its leg already in the books. A reject landing between the read and the move leaves a paid-out ledger leg on a rejected request. The comment at 255-260 describes the guard as preventing exactly this.
8. **A rejected transfer is never told to anybody.** manual.ts 670-694 writes the reason and sends nothing; `pendingPaymentFor` drops rejected rows (pending.ts 139) so the in-app bar vanishes; the only place the sentence appears is the payment sheet via `manualEntry` (manual-entry.ts 338-352), and for a guest (`session` payer) `paymentsFor` returns [] (manual.ts 431), so a guest never sees it anywhere (task 124 confirmed). The admin screen tells the operator "they have been told why" (transfers/actions.ts 72).
9. **Guest patients' transfers appear in the clinician's own payment bar.** manual.ts 110-117 writes the practice's `organizationId` on a guest (`session`) payment (callers app/pay/[token]/page.tsx 165, actions.ts 247, 347). app/(app)/layout.tsx 73 asks `pendingPaymentFor({kind:"organization"})`, which matches on `organization_id` and takes the newest row (pending.ts 97-143). A patient opening the pay sheet puts "Session with Dr X, 1,140 EGP" on the clinician's bar, can hide the clinician's own open bill, and in a multi-clinician organisation shows colleagues another clinician's patient payment and its timing.
10. **Credit stops being spent once the oldest batch is used up.** credits.ts 162-187: `spendCredit` selects the soonest-expiring ACTIVE batch without excluding exhausted ones (no status change on exhaustion anywhere; grep) and `break`s when that batch has 0 left (187). Later batches are never reached, so a clinician whose dashboard shows credit (`getCreditBalance` filters live rows, 113) is billed pay-as-you-go.
11. **A provisional employee loses their one sponsored session to our bookkeeping.** pot.ts 290-321 claims the provisional allowance, then returns `no_pot` (324) and `no_benefit` for 0% coverage (350-353) WITHOUT `releaseProvisional`, contrary to its own rule at 283-286.
12. **A failed Stripe webhook is never retried.** stripe.ts 602-608 records the event id before doing the work; if the work throws, Stripe's retry hits the conflict and returns having done nothing. `invoice.paid` (subscription renewal and obligation) has no other path; `checkout.session.completed` is covered only if the browser comes back through `confirmCheckout`.
13. **A second `chargeForSession` for one session spends credit and nets earnings again.** service.ts 155 and 180-187 run before the invoice insert that is the idempotency (302); when the insert loses the conflict nothing is rolled back, and `netFeeFromEarnings` posts `postFeeNettedFromHeld` (251) whether or not its own `raiseInvoice` created anything. The file's own comment names the race (reconciler vs live completion, 61-64).
14. **Transfer-rail overpayment is a log line, not work (A4).** manual-grants.ts 466-478 `log.warn` only; the row has no field for the amount that actually arrived, so an operator who matches a 1,000 EGP line against a 570 EGP claim has nowhere in the product to record the 430 (RA6).

## Looks broken, is handled

1. Confirm pressed twice: manual.ts 519-528 the state guard in the WHERE means the second press changes nothing and returns "That payment is not waiting for a decision." Grants are guarded again (session: `payment_status='pending'` manual-grants.ts 84; subscription: `status='due'` 442; pot: see Suspect 3). A2 kept at the row.
2. Two bookings racing one pot: the early read (pot.ts 408) is not the guard; the conditional debit (481-494) is, and the payment-row insert on unique `session_id` (520-583) is the idempotency with a compensating credit.
3. Coverage lowered after booking: the split is frozen on the payment row at booking (pot.ts 541-543) and every later reader uses the row (connect.ts 494-521, session-owed.ts 66-84, manual-grants.ts 186-206), never `coverageNow`.
4. A foreign or already-paid invoice id sent from the browser: bill-lines.ts 54-58 and service.ts `sumPayable` 613-622 pin organisation and `due` in the WHERE.
5. `grantPotTopUp` crediting the pot 50 times what was sent (0106): it credits `settles_cents` (USD), not `amount_cents` (manual-grants.ts 522-526, 576-595).
6. Two taps on "I have paid": partial unique index plus `onConflictDoNothing` and re-read (manual.ts 278-308).
7. `tierForSpend` handing the $179 plan to anyone who spent a cent (H24): plans.ts 56 filters to `monthlyCents === 0`, and `settingsProblem` (defs.ts 1323-1326) refuses a tier with both axes.
8. The destination Stripe charge swallowing VAT: ledger.ts 360-364 throws rather than posting (note: after the session is already marked paid, connect.ts 862-877).

## Unclaimed

(a) worth selling, nothing advertises it:
- connect.ts 617-640: a patient's card payment automatically clears the clinician's own due 24Therapy bills inside our fee (auto-settle), a stronger form of T3 than the promise states.
- seats.ts 53-84 with defs.ts 822-865: a to-the-day proration quote before any seat change (PL7), with downgrades turned into next-month credit.
- manual.ts 596-660: the "received without proof" override, which credits money that arrived with no claim, flagged on the row for ever.

(b) nobody should have it, a hole:
- ledger.ts 636-678 via app/(admin)/admin/actions.ts 524: `postAdjustment` lets a staff member post any amount to ANY account (including `cash`, `sponsor_pot`, `therapist_payable`) against revenue or expense with a 5-character reason; the "never invents money" comment is not true of `cash`.
- connect.ts 1200-1215 (nightly cron): automatic payout of held earnings with no person and no clinic endorsement.
- cart.ts 93-102, 187-190: a payer can delete the only trace of a transfer they made but did not claim.

(c) half built:
- ledger.ts 748 `postEntityTransfer` and the `fx_difference` account: no caller, so no cross-border crossing can ever be settled in the books.
- money.ts 78 `egpSettlement` (C76 spread screen): no caller.
- `payg_session` payment purpose: a grant branch and an admin label, no writer.
- stripe.ts 96 `createCreditCheckout`: no caller; credit can still be granted but not bought.
- egypt.ts: the gateway adapter is a refusal; `egyptCollectionProvider: "paymob"` names a provider that does not exist.
- lib/lifecycle/machines.ts 129-160 (outside slice, read to answer the brief): the clinic's 3-day endorsement/escalation step for payouts does not exist; `requested` goes straight to staff approval. Nothing in payouts.ts pays on a timer (kept), but the nightly Connect sweep in connect.ts does.
- `clinic_seats.billable_from` (seats.ts 280-288): written, read by nothing in this slice.

## Promise evidence

- P2 (nothing only in email): payment-notices.ts 237 puts a confirmed payment in the patient's app (patient accounts with a person only); submitted notices are email/WhatsApp only; clinicians get email only; rejections reach no channel. Verdict: partly (confirmation in app for patients; rejection nowhere).
- T3 (owed nets out of earned before payout): service.ts 219-260 (per session, whole fee only, behind a setting), connect.ts 1229-1283 (`settleInvoicesFromHeld`, called at session end), connect.ts 617-640 (auto-settle in the fee). Payout itself (payouts.ts 165-243, connect.ts 1109) pays the whole held balance with no netting step, and transfer-paid invoices never clear the receivable in the ledger (Broken 5). Verdict: partly.
- C3 (one bill, priced per seat, filled seats): seats.ts 25-39 prices a typed count, not filled seats; no recurring seat bill is raised (Broken 4). Verdict: broken as far as this slice shows.
- C4 / PL6 (release lowers next bill by one seat; clinician to PAYG): seats.ts 204-221 does not change the count (Broken 4); the clinician lands in a new solo org (clinic-admin.ts 744-777, kept). Verdict: partly (second half kept).
- PL7 (quote before, that figure billed): seats.ts 107-110 re-quotes at write time rather than billing the figure shown. Verdict: partly.
- E1 (funded, spent, how many; never who or when): pot.ts 979-1016 give balance and spend count from the ledger; nothing in this slice names a person; the pot leg timestamps are booking times (Suspect 7). Verdict: cannot tell from here.
- E3 (price shown is price owed after a coverage change): pot.ts 346-348, 541-543; session-owed.ts 52-91; connect.ts 489-521. Verdict: kept.
- E4 (0% is not removal): pot.ts 340-353 returns `no_benefit` and touches no enrolment; defs.ts 1729 allows 0. Verdict: kept in billing (screens not in slice). Side defect: a provisional allowance is consumed (Broken 11).
- E5 (empty pot: pot takes nothing, ordinary pay link, ask HR): pot.ts 408-442 takes nothing and alerts sponsor admins; the race-lost path (496-500) alerts nobody. Patient copy not in slice. Verdict: partly.
- A1 (nothing granted before confirm): manual.ts has no grant; manual-grants.ts runs only as `onConfirmed` after the flip (manual.ts 519-533); `subscribeByTransfer` raises a due bill only (service.ts 846-853). Verdict: kept.
- A2 (confirm twice moves money once): manual.ts 519-528 plus per-grant guards. Verdict: kept at the confirmation; the analogous payout `markPayoutSent` is not (Broken 7), and the ledger itself has no idempotency key.
- A3 (rejection verbatim to the payer): stored verbatim (manual.ts 687), shown only on the sheet to account payers (manual-entry.ts 351), never to guests, never notified (Broken 8). Verdict: partly.
- A4 (unclaimed money is work): `openCarts` exists (manual.ts 403); rows can be deleted by the payer (Suspect 2); overpayment is a log line and has no field (Broken 14). Verdict: partly.
- CV1/CV4 (patient charged own share plus VAT on own share, never by subtraction): connect.ts 521-523 and manual-entry.ts 183-206 and defs.ts 1733 compute forwards; manual-grants.ts 227 books it by subtraction; invoice.ts 169-171 derives corporate VAT backwards. Verdict: kept at the quote, partly at the books.
- CV2 / task 116 (price shown equals price charged): transfer rail kept (live row wins, manual-entry.ts 305-336; page and action both use `patientOwesFor` + `sessionTransferMoney`); card rail for covered sessions broken (Broken 1, 2).
- README contradiction 3 (AI fee consent): service.ts 87-93 and service.ts 688/723: the AI fee rides on `recording_consent === 'granted'`: one flag.
- README contradiction 2 (how Egyptians pay): `collectionProblem` refuses Egyptian cards (defs.ts 1471-1481) and says "ask for a free link"; the real rail is manual.ts. Both true; README omits the rail.

## Coverage

| File | Lines | Status |
|---|---|---|
| lib/billing/bill-lines.ts | 80 | read |
| lib/billing/cart.ts | 197 | read |
| lib/billing/connect.ts | 1379 | read |
| lib/billing/credits.ts | 455 | read |
| lib/billing/egypt.ts | 167 | read |
| lib/billing/fx.ts | 233 | read |
| lib/billing/invoice.ts | 242 | read |
| lib/billing/ledger.ts | 991 | read |
| lib/billing/manual-entry.ts | 496 | read |
| lib/billing/manual-grants.ts | 654 | read |
| lib/billing/manual.ts | 715 | read |
| lib/billing/money.ts | 290 | read |
| lib/billing/obligations.ts | 286 | read |
| lib/billing/payment-notices.ts | 257 | read |
| lib/billing/payouts.ts | 646 | read |
| lib/billing/pending.ts | 218 | read |
| lib/billing/plans.ts | 316 | read |
| lib/billing/pot-alerts.ts | 79 | read |
| lib/billing/pot.ts | 1034 | read |
| lib/billing/seats.ts | 293 | read |
| lib/billing/service.ts | 1055 | read |
| lib/billing/session-owed.ts | 126 | read |
| lib/billing/stripe.ts | 803 | read |
| lib/finance/assumptions.ts | 197 | read |
| lib/finance/benchmark.ts | 264 | read |
| lib/finance/beta.ts | 544 | read |
| lib/finance/format.ts | 66 | read |
| lib/finance/model.ts | 320 | read |
| lib/finance/physics.ts | 359 | read |
| lib/finance/plans.ts | 679 | read |
| lib/finance/scenarios.ts | 388 | read |
| lib/finance/store.ts | 117 | read |
| lib/settings/defs.ts | 1860 | read |
| lib/settings/index.ts | 253 | read |
