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
