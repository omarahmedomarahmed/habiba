# Audit 07 - Money across borders

Beat: two legal entities, two currencies, VAT, FX, and the Egyptian rail that
does not exist yet. Sprints 59 and 64, plus everything about money already
live: `lib/billing/fx.ts`, `money.ts`, `ledger.ts`, `invoice.ts`, `payouts.ts`,
`connect.ts`, `pot.ts`; `lib/settings/defs.ts`; `lib/db/schema.ts`;
`app/(app)/earnings/**`; `app/(admin)/admin/payouts/**`; `app/pay/[token]/**`.

Method: read the code for every finding below, then searched PLAN.md §2 (C1
to C366) for a matching concern before writing it up. Where I say a control
held, I name what I searched and what a violation would have looked like.
For C357 specifically, I grepped every caller in `lib/` and `app/` rather
than trusting the plan's own description of it.

---

## 1. `hasNoRail` has zero callers outside one admin page and one verifier - confirmed independently

**Attack 1, C357, live today.**

| Field | Detail |
|---|---|
| What | `hasNoRail` is read in exactly two places in the entire repository, and neither is on the path a clinician or a patient ever takes. |
| Where | `lib/settings/defs.ts:785-787` defines it. `grep -rn "hasNoRail" lib app` returns only `app/(admin)/admin/settings/page.tsx:46,107` and `scripts/verify-sprint16.ts`. I also grepped `lib/data` (radar, booking, verification) directly for `hasNoRail`, `collectionProvider` and `payoutMethods.length` - zero matches. |
| Who is harmed | Any clinician whose country has no `collectionProvider` and no `payoutMethods`. |
| Severity | blocker |
| Already known? | C357, ruled - sprint 59 (59.6-59.8, all unchecked). This confirms the ruling's own diagnosis is accurate and the fix is not built. |

Control I checked to make sure this wasn't a false negative: I searched for
any OTHER name the gate might hide under (`noRail`, `rail check`,
`collectionProvider ===`) across `lib/data/radar.ts`, the booking actions,
and the signup/verification flow. Nothing. A search that read nothing would
also report zero matches, so the corroborating fact is what I traced next.

---

## 2. The full trace: signup, radar, booking and payout for a no-rail clinician

| Field | Detail |
|---|---|
| What | Nothing stops a clinician in a no-rail country from signing up, getting verified, and appearing on the radar. The first friction they or a patient hit is downstream, and every message shown at that point is either generic or actively misleading about the real cause. |
| Where | Signup/verification: no code in `app/(app)` or `lib/data` reads `country_settings` for the clinician's own country as a gate. Radar: `lib/data/radar.ts` has no reference to `hasNoRail`/`collectionProvider`/`payoutMethods` (grepped, zero matches). Booking with a card: `createSessionPaymentCheckout` (`lib/billing/connect.ts:428-437`) only refuses when `!row.accountId \|\| !row.chargesEnabled`, and the refusal message told to the **patient** is "This therapist has not finished setting up payouts yet... They can finish in Settings. It takes a couple of minutes" (`connect.ts:433-436`) - a false promise when the real reason is a country with no viable rail, not an unfinished checklist. Onboarding itself: `startOnboarding` (`connect.ts:148-197`) never checks the clinician's own `country_settings` row before calling Stripe, and passes no `country` to `accounts.create`, so if Stripe itself refuses, the clinician sees only "Stripe could not start onboarding just now. Try again in a moment" (`connect.ts:195`) - a transient-sounding message for a permanent structural fact. Booking funded by a sponsor pot: `payFromPot` (`lib/billing/pot.ts:108-353`) never checks `stripeAccountId`, `chargesEnabled` or a payout method as a gate at all - it reads them only to *label* the crossing (`payoutRailFor`, line 262-266), never to refuse. A pot-funded session for a clinician with zero payout rail is paid in full and accumulates a held balance with no exit. Payout request: `requestPayout` (`lib/billing/payouts.ts:165-243`) requires `defaultMethodFor` to return a saved method; if none exists the message is the generic "Add a payout method first" (line 179) with no explanation that their country cannot support one. |
| Who is harmed | The clinician, who discovers the problem at payout (the "least humane order" 59.6's own ruling text names) or never discovers it at all if they simply never chase the held balance; and the patient, who is told a false reason for a declined charge and a false time estimate for a fix that cannot happen. |
| Severity | blocker |
| Already known? | C357. The ruling states the humane order is "told why on their own dashboard" at signup (59.6); today's actual order is signup, verification, radar, a possible pot-funded session with a stuck balance, and only then - if ever - an uninformative refusal. This is the ruling's own "what it costs" line made concrete, with the exact wording a real person sees. |

---

## 3. `payoutMethods` per country is decorative - the real gate is one global list

| Field | Detail |
|---|---|
| What | `country_settings.payoutMethods` (the per-country list `hasNoRail` reads) is never consulted when a clinician actually saves a payout method. The real, and only, validation is against `settings.payouts.egyptPayoutMethods` - one platform-wide list, unconnected to the clinician's own country. |
| Where | `lib/billing/payouts.ts:108-111`: `if (input.method !== "stripe" && !settings.payouts.egyptPayoutMethods.includes(input.method))`. `settings.payouts.egyptPayoutMethods` is defined once, globally, at `lib/settings/defs.ts:145,345` (default `["instapay", "wallet"]`), with no per-country dimension. `country_settings.payoutMethods` (`lib/settings/defs.ts:770`) is read only inside `hasNoRail` (line 786) and the admin display - never inside `savePayoutMethod`. |
| Who is harmed | A clinician in a genuinely no-rail country can still save "instapay" or "wallet" as their payout method (the global list permits it regardless of their real country), and a payout can be approved and sent against a destination the three-person queue has no reason to doubt until the transfer bounces at the bank. Conversely, this is the same mechanism finding 7 below depends on. |
| Severity | major |
| Already known? | Sibling of C357 - "an operator FACT that nothing acts on is as dead as an operator switch nothing reads" (59.7's own words, quoting C218). C357's text names `hasNoRail` specifically; this is a second, independent field with the identical defect shape, found by tracing the same code path rather than by re-reading the same finding. |

---

## 4. `collectionProvider` is never read by the payment code - every enabled country goes through Stripe regardless

| Field | Detail |
|---|---|
| What | `createSessionPaymentCheckout`, the one live card-payment path, never checks `country.collectionProvider`. It reads `country.currency` and `country.vatBps` and always builds a Stripe Checkout Session. Egypt is seeded with `collectionProvider: "paymob"`, `currency: "egp"`, `enabled: true` (`lib/settings/defs.ts:799-821`), and there is no paymob integration anywhere in the codebase (`grep -rln "paymob" lib app` returns only the seed file, the schema comment and the admin form - zero adapter code). `getCountries()` (`lib/settings/index.ts:81-89`) selects every row with no filter, and `/pay/[token]` (`app/pay/[token]/page.tsx:60-95`) offers every one of them to the patient. |
| Where | `lib/billing/connect.ts:450-474` (country lookup and quote, no `collectionProvider` check); `connect.ts:507-582` (`checkout.sessions.create` with `currency: country.currency` on both line items); `lib/settings/defs.ts:811` (EG's `collectionProvider: "paymob"`); `lib/settings/index.ts:81-89` (`getCountries`, unfiltered). |
| Who is harmed | A patient who selects Egypt on `/pay/[token]` today would be routed into a Stripe Checkout Session denominated in EGP - a rail §3c says explicitly does not exist ("No Egyptian gateway offers Connect-style destination charges", C309) and that sprint 64 is blocked on paperwork to build. Whether Stripe's API would actually accept this charge I could not verify without live credentials (see "What I could not verify"), but the application code itself contains no refusal. |
| Severity | blocker |
| Already known? | Not named by any C-number I found. C303 corrects a different misconception (there is no "country's Stripe," only entity + presented currency) but does not address that the *collection provider field itself* is unread. This is new: it is the same defect class as C357 (an operator fact nothing acts on) applied to a field C357 does not name. |

---

## 5. The platform's own commission is computed in USD cents and passed unconverted as a Stripe fee in a foreign currency

| Field | Detail |
|---|---|
| What | `application_fee_amount` on the destination charge is `cut + settlement`, both derived from `sessionMoney({ grossCents: gross, ... })` where `gross` is the session price in USD cents. The Checkout Session's line items - and therefore its currency - follow `country.currency`, which can be `"egp"`. `application_fee_amount` is never run through `convertAtRate`, unlike every other money figure in the same function. |
| Where | `lib/billing/connect.ts:458-476` (`gross`, `cut`, `net`, `settlement` all in USD cents); `connect.ts:504` (`applicationFee = cut + settlement`, still USD cents); `connect.ts:527-551` (line items priced via `convertAtRate(gross, quote.rateMicro)` and `convertAtRate(money.vatCents, quote.rateMicro)` - correctly converted); `connect.ts:553-563` (`application_fee_amount: applicationFee` - not converted, in a `payment_intent_data` block whose PaymentIntent currency follows the line items). |
| Who is harmed | The platform. If this path is ever exercised for a non-USD country (see finding 4 - nothing stops it today), Stripe would interpret a USD-cents figure as minor units of the foreign currency, taking roughly a 1/48th-scale commission on an EGP charge instead of the intended amount - a live currency-unit bug sitting directly behind a gate that finding 4 shows does not exist. |
| Severity | blocker |
| Already known? | Not named by any C-number. Not merely a hypothesis: the code path that would trigger it (finding 4) is independently confirmed reachable. |

---

## 6. VAT is computed from the self-declared country, with zero corroboration, in the one live checkout path

**Attack 2: VAT.**

| Field | Detail |
|---|---|
| What | `createSessionPaymentCheckout` takes `payerCountry` as a plain input from the pay page and uses it directly to look up `country.vatBps` - no card country, no IP, no sponsor-country cross-check anywhere in the function. |
| Where | `lib/billing/connect.ts:370-378` (`payerCountry`, documented as "Required, and there is no default... An unconfigured country is refused below" - refused only if unconfigured, never if uncorroborated); `connect.ts:450-460` (`getCountrySettings(opts.payerCountry)` then `sessionMoney({..., vatBps: country.vatBps})`); the same pattern in `app/pay/[token]/actions.ts:45-84` (`priceFor`, the price the patient sees before paying). |
| Who is harmed | The tax authority is under-collected against, and the platform "carries it" per C308's own wording - a patient who picks a low-VAT country pays less than the jurisdiction they are actually in would require, and there is no mechanism today that would ever notice. |
| Severity | blocker |
| Already known? | C308 and C340, ruled - sprint 59. 59.2 and 59.3 (corroboration, re-check at settlement) are unchecked in the plan. This independently confirms the ruling is not built, with exact line numbers for where the self-declared value alone still governs both the price shown and the price charged. |

---

## 7. VAT is never re-checked at settlement, even against the ruling's own stated design

| Field | Detail |
|---|---|
| What | `settleSessionPayment`, the function that marks a payment paid (called from both the webhook and the redirect-confirm path), reads `vatCents` straight off the row written at checkout-creation time. It does not re-derive VAT from anything - not the card's actual country, not a fresh country lookup. |
| Where | `lib/billing/connect.ts:668-723` (`settleSessionPayment` - `postSessionPayment` is called with the stored `row.grossCents`/figures, no VAT recomputation); contrast with C340's text: "VAT uses the declared country at booking and is RE-CHECKED at settlement... A mismatch over a threshold flags to admin." |
| Who is harmed | Same as finding 6 - the tax authority, and by extension the platform if ever audited. |
| Severity | major |
| Already known? | C340, ruled - sprint 59, 59.3 unchecked. Confirms the specific mechanism (settlement-time re-check) that C340's text promises does not exist in the settlement function today. |

---

## 8. VAT has no ledger account, and on a destination charge it is paid straight into the therapist's own Stripe balance

| Field | Detail |
|---|---|
| What | `LEDGER_ACCOUNTS` has no VAT or tax account: `cash, therapist_payable, therapist_receivable, platform_revenue, platform_expense, sponsor_pot` (`lib/db/schema.ts:2059-2079`). On a destination charge, `application_fee_amount` is `cut + settlement` only (finding 5) - it excludes VAT entirely - so the remainder of the charge, VAT included, is transferred by Stripe straight to the therapist's own connected account. Nothing in `postSessionPayment` posts a VAT leg to distinguish it from the session price (`lib/billing/ledger.ts:299-367`). |
| Where | `lib/db/schema.ts:2059-2079` (the account enum); `lib/billing/connect.ts:504,553-563` (fee excludes VAT); `lib/billing/ledger.ts:299-367` (`postSessionPayment`, no `vat` leg anywhere in the file - grepped). The checkout page itself tells the patient the VAT line is "Charged in ${country.name} and paid to the tax authority there" (`connect.ts:546`). |
| Who is harmed | The platform, which has promised on the receipt to remit a tax it never actually holds for the majority of transactions (every "destination" charge, which is every card payment to a Connect-verified therapist - the common case). The therapist unknowingly receives VAT money mixed into ordinary earnings, with nothing on their statement distinguishing it. |
| Severity | blocker |
| Already known? | Not named by any C-number I found. This is a "does the screen tell the truth" defect (audit question 2) sitting directly under the VAT concerns C308/C337/C340 already flag, but about where the money physically goes rather than which country's rate applies - a distinct mechanism none of those rulings address. |

---

## 9. A refund returns 100% of the charge, VAT included - contradicting the codebase's own documented policy

| Field | Detail |
|---|---|
| What | `vatOn`'s own doc comment states the policy: "a refund returns our cut but never the VAT - because the VAT was remitted to a government that is not refunding it because a session was cancelled." `refundSessionPayment` issues a full Stripe refund with no `amount` parameter, which refunds the entire PaymentIntent - gross, VAT and all - every time. |
| Where | `lib/settings/defs.ts:888-891` (the comment stating the policy); `lib/billing/connect.ts:799-812` (`client.refunds.create({ payment_intent: ..., ...})` - no `amount` field anywhere in the call, confirmed by reading the full function). |
| Who is harmed | The platform, which per its own stated design should be out the VAT it already remitted (or, per finding 8, never actually held) on every refund, and is instead refunding money it does not have a mechanism to have withheld. |
| Severity | major |
| Already known? | Not named by any C-number. This is exactly the pattern the audit brief and this repository's own house rule call the second most common defect: a comment asserting a policy the code does not implement. |

---

## 10. `pot.ts`'s `vatBps: 0` is correct for today's binary pot, and cannot survive sprint 60's percentage as written

| Field | Detail |
|---|---|
| What | `payFromPot` claims the full session price or nothing (`if (pot.balanceCents + pot.overdraftCents < gross) return {paid:false,...}`) - there is no partial-coverage branch. Its `vatBps: 0` reasoning ("the taxable supply was the top-up... Passing the patient's country VAT here would tax the employer's money a second time") is sound *only* because the pot pays 100% today. Sprint 60 introduces `coverage_bps` from 0 to 100, and C312's ruling for it is "VAT on the patient's share only" - a wholly different computation requiring a patient-share amount `payFromPot` has no concept of. |
| Where | `lib/billing/pot.ts:108-353` (`payFromPot`, binary paid/not-paid, no coverage fraction anywhere); `pot.ts:192-203` (`vatBps: 0` and its comment); PLAN.md sprint 60 (60.8: "VAT on the patient's share only (C312)... which `pot.ts` already reasons" - unchecked). |
| Who is harmed | Nobody yet, since sprint 60 is unbuilt - but the plan's own line ("which `pot.ts` already reasons") overstates what exists: the *reasoning* the comment gives is sound for a fully-sponsored session, but the *function* has no seam for a partial one. This is a structural rewrite, not a parameter change - the whole claim-and-pay transaction assumes one payer covers the whole price. |
| Severity | major |
| Already known? | C307 and C312, ruled - sprint 60. My reading is that the ruling's premise ("pot.ts already reasons [this]") is true of the comment and not true of the code shape, which is worth flagging before 60 is built on top of it. |

---

## 11. The FX quote shown to the patient can go stale with nothing to warn them

**Attack 3: FX.**

| Field | Detail |
|---|---|
| What | The pay page fetches a quote only when the patient changes their selected country - never on a timer, never before submitting payment. `fx.ts`'s own comment states the reason the hour-long quote exists: "somebody shown '1,440 EGP' and then charged a different number... has been quoted a price we did not keep." Nothing in the pay flow enforces that the number displayed is still the number `createSessionPaymentCheckout` uses once the quote's hour has passed. |
| Where | `components/pay/pay-flow.tsx:57-78` (`useEffect` keyed only on `[country, token]` - no interval, no expiry countdown); `lib/billing/fx.ts:13-20,43-44` (the stated reason, `QUOTE_TTL_MS = 60 * 60 * 1000`); `app/pay/[token]/actions.ts:65,` `lib/billing/connect.ts:469` (two independent calls to `quoteFor`, one for display, one at checkout - they agree only while the earlier quote has not expired). |
| Who is harmed | A patient who takes over an hour between viewing the price and completing checkout (plausible for someone in crisis, or interrupted) sees a different total on Stripe's own checkout page than the one 24Therapy showed them - not a silent overcharge, since Stripe's page reflects the fresh quote before payment, but a broken promise on the page whose entire stated purpose is "reassuring... only if you say so." |
| Severity | minor |
| Already known? | Not named by any C-number. The rate-freezing mechanism itself (C37, the two-call agreement, the display/settlement consistency) is otherwise sound - see the positive control below. |

Control checked: within the TTL, the same stored quote row is reused by both
`priceFor` and `createSessionPaymentCheckout` (`quoteFor`'s live-quote branch,
`lib/billing/fx.ts:156-178`), so the ordinary case (a patient who pays within
the hour) does see the same rate on both screens. I traced this specifically
because the audit brief asks whether display and settlement use the same
rate - they do, except across the boundary above.

---

## 12. No FX-difference ledger account exists, and today's rounding already needs one

| Field | Detail |
|---|---|
| What | `LEDGER_ACCOUNTS` has no FX or rounding-difference account (see finding 8's list). The ledger always posts the exact USD gross/VAT/fee figures; the amount Stripe actually settles is the *converted, rounded* figure (`convertAtRate`, half-away-from-zero rounding in `money.ts:44-47`). Any cent lost or gained in conversion for a non-USD checkout has no account to land in. |
| Where | `lib/db/schema.ts:2059-2079` (no such account); `lib/billing/money.ts:44-47` (`convert`, rounds once); `lib/billing/ledger.ts:299-367` (`postSessionPayment` posts the USD figures, never the presented/converted ones). |
| Who is harmed | The platform's own books - `reconcile()`'s `outOfBalanceCents` check (`ledger.ts:756-802`) can only ever see zero here because the rounding difference was never posted as a transaction leg in the first place; it does not fail loudly, it is simply invisible. |
| Severity | major |
| Already known? | C339, ruled - sprint 59 (59.19, unchecked: "a named ledger account for FX difference... a transfer at a frozen rate does not reconcile to the cent"). The prompt asked me to check whether anything today would already need one - yes: any completed non-USD checkout today has produced an unposted rounding difference, not merely a future risk once 59.19 is skipped. |

---

## 13. `crossingFor` and `entityFor` are defined, tested, and called exactly once in production - never on the live payment path

**Attack 4: the two entities.**

| Field | Detail |
|---|---|
| What | `crossingFor` and `entityFor` (`lib/billing/money.ts:121-183`) are the one place the plan says "which of §3c's four crossings a payment is" is decided. Grepping the whole repository for their call sites finds exactly one production caller: `lib/billing/pot.ts:261`. `createSessionPaymentCheckout`, the primary card-payment path, never calls either - it inserts a `sessionPayments` row with no `crossing` and no `entity` field set at all, so both take their schema defaults (`'usd_stripe_to_connect'`, `'us'`) regardless of what actually happened. |
| Where | `grep -rn "crossingFor(\|entityFor(" lib app tests` - matches only `lib/billing/pot.ts:261`, the function definitions, and `tests/money.test.ts`. `lib/billing/connect.ts:589-638` (`sessionPayments` insert - no `crossing`, no `entity` key in either the insert or the `onConflictDoUpdate` set). |
| Who is harmed | Nobody can currently answer, from `session_payments`, which entity a given card payment belongs to, except by inference from the schema default being right by accident (finding 15). |
| Severity | blocker |
| Already known? | C306, ruled - sprint 59 (59.18, unchecked: "a held balance carries its entity... moving money between entities raises a real ledger transaction"). This is more specific than "not yet built": the abstraction the ruling calls for already exists in `money.ts` and is simply not wired into the one path that needs it. |

I checked whether this is harmless today given that `capture` is hardcoded
to `"destination"` in `createSessionPaymentCheckout` (`connect.ts:439`) - see
finding 15 for why the default happens to be correct only because no
non-Stripe rail is live yet, which is a fact about today, not a property of
the code.

---

## 14. `invoices` (24Therapy's own bills to clinicians) has no entity column at all

| Field | Detail |
|---|---|
| What | The `invoices` table - the record of what a clinician owes 24Therapy for its own subscriptions, credit purchases and session-based bills - has no `entity` column. Every posting function that raises, settles, writes off or card-pays one of these bills (`postInvoiceRaised`, `postInvoiceSettledFromHeld`, `postInvoicePaidByCard`, `postInvoiceWrittenOff`) leaves every leg's `entity` unset, defaulting to `'us'` (`Leg.entity` optional, `journal()` defaults it at `ledger.ts:95`). |
| Where | `lib/db/schema.ts:1706-1755` (full `invoices` column list - no `entity`, confirmed by reading the whole table definition); `lib/billing/ledger.ts:420-505` (all four invoice-posting functions, `grep -n "entity:" lib/billing/ledger.ts` shows it appears only inside `postManualPayout`, `postEntityTransfer` and `postFeeNettedFromHeld` - never in any of the invoice functions). |
| Who is harmed | Anybody trying to answer "how much do Egyptian clinicians owe 24Therapy" - the receivable side of the books has no entity dimension in the *design*, not merely in the implementation. Sprint 59.18 only names "a held balance carries its entity" (the payable side); it does not name the receivable side at all. |
| Severity | major |
| Already known? | Within C306's scope but not named by it - C306's text is about `heldForTherapistOrg` (a payable), not about `invoices`/`therapist_receivable`. New within an existing ruling's blind spot. |

---

## 15. Quantifying "how much money is in the Egyptian entity": unanswerable, and the query that exists today would be actively misleading, not merely incomplete

| Field | Detail |
|---|---|
| What | `reconcile()`'s `cashByEntity`/`heldByEntity` (`lib/billing/ledger.ts:770-791`) group by `ledgerEntries.entity` - which, per findings 13-14, is correctly populated only for manual payouts, entity transfers and fee-netted-from-held postings. Every session payment and every invoice transaction defaults to `'us'`. Running the query today for `entity = 'eg'` would return only the narrow slice of transactions that happen to pass an explicit `entity` argument, not a true balance. |
| Where | `lib/billing/ledger.ts:770-791` (the query); findings 13 and 14 (why its inputs are incomplete); finding 16 below (a case where the `'eg'` figure it *does* produce is actively wrong, not just partial). |
| Who is harmed | Whoever asks the question - founder, counsel, or an auditor. The honest current answer is not "we don't track it," which would be a safe incompleteness; it is "the number the code would print is wrong in a specific, demonstrable direction" (finding 16). |
| Severity | blocker |
| Already known? | C306, ruled - sprint 59 (59.18, unchecked). The prompt asked me to quantify what is unanswerable today - this is that quantification, with the additional finding that the existing partial mechanism is not merely silent but would mislead if used before 59.18 ships. |

---

## 16. A payout's entity is computed from the payout METHOD chosen, never from which entity's ledger actually holds the money being paid out

| Field | Detail |
|---|---|
| What | `requestPayout` sets `const entity: Entity = method.method === "stripe" ? "us" : "eg"` - purely a function of which payout method the clinician picked, with zero reference to `entityFor()` or to where the balance being withdrawn was actually posted. Per finding 13, every held balance today is posted under `entity: 'us'` by default (the only writer to `therapist_payable` that matters in practice, `postSessionPayment`, never sets it). A clinician anywhere - not only in Egypt, since finding 3 shows the payout-method check is global, not country-scoped - who saves an `instapay` or `wallet` payout method and then requests a payout gets that request tagged `entity: 'eg'`, and `postManualPayout` (`ledger.ts:601-632`) then debits **`eg` cash and `eg` therapist_payable** for money that was, per the ledger, held under `us`. |
| Where | `lib/billing/payouts.ts:202-209` (`payoutCurrency`, `entity` computed from `method.method` alone); `lib/billing/money.ts:181-183` (`entityFor`, the function that exists to answer this correctly, never called here - `grep -n "entityFor(" lib/billing/payouts.ts` is empty); `lib/billing/ledger.ts:601-632` (`postManualPayout`, posts `entity: input.entity` verbatim, no cross-check against where the balance actually lives). |
| Who is harmed | The books. This is precisely the shape `reconcile()`'s `unbackedEntity` check exists to catch ("an entity paying out of a bank account that never took the money in," `ledger.ts:748-750,791`) - except here it is self-inflicted by the payout code itself, not an external failure. The first EGP-method payout against a US-held balance would flip `eg` cash negative. |
| Severity | blocker |
| Already known? | Not named by any C-number I found. C306 says a held balance must carry its entity and a cross-entity move must be an explicit `entity_transfer`; this finding shows the payout path bypasses that discipline by construction, computing a *different* entity than the one the money was actually posted under, with no transfer in between. |

---

## 17. Payouts: the two-person and self-approval rules ARE real CHECK constraints, not only application code

| Field | Detail |
|---|---|
| What | Verified independently, as the brief asks: `payout_requests_approver_not_payee`, `payout_requests_approver_not_editor`, and `payout_requests_sent_was_approved` are genuine `CHECK` constraints on the `payout_requests` table, added in the same migration that created the table (so no `NOT VALID` gap - the table was empty when they were added). |
| Where | `drizzle/0047_two_rails.sql:259-292`. Cross-checked against the application-level checks at `lib/billing/payouts.ts:315-323` (`approvePayout`) - both layers agree and neither is decorative. |
| Who is harmed | Nobody - this is a control that held. Stated here so the report does not read as though every control failed. |
| Severity | n/a (control verified) |
| Already known? | C74. The ruling's claim that these are database constraints is correct, not merely asserted. |

---

## 18. A payout can be sent for more than is currently held, because the balance is checked once, at request time, and never again

| Field | Detail |
|---|---|
| What | `requestPayout` checks `amount <= heldForTherapist(...)` once, when the request is created. Neither `approvePayout` nor `markPayoutSent` re-read the current held balance before moving money. If a refund is processed on a *different* session between request and send (`postSessionRefund` reduces `therapist_payable`, `ledger.ts:370-418`), the amount already committed to the payout can exceed what is actually held by the time it is sent, with no check catching it before the transfer. |
| Where | `lib/billing/payouts.ts:165-243` (`requestPayout`, the one-time check); `payouts.ts:301-344` (`approvePayout`, no balance re-check); `payouts.ts:354-421` (`markPayoutSent`, no balance re-check); the only place this would surface is the *next day's* `reconcile()` `negativeHolds` report (`ledger.ts:760-768`), after the money is gone. |
| Who is harmed | The platform, and indirectly the clinician if this ever produces a balance the reconciliation later has to unwind or dispute. |
| Severity | major |
| Already known? | Not named by C74 or any other concern I found. C74's constraints (finding 17) cover *who* approves; nothing covers *whether the amount is still true* by send time. |

---

## 19. `markPayoutSent` posts the ledger transaction before the atomic status transition - a genuine double-post race

| Field | Detail |
|---|---|
| What | `markPayoutSent` reads the request's status with a plain `select()` (not locked), checks `row.status !== "approved"` in application code, and only THEN calls `postManualPayout` - unconditionally, with no idempotency key tied to `requestId`. The atomic, race-safe transition (`move()`, a single `UPDATE ... WHERE status IN (...)`) happens AFTER the ledger post, not before or inside the same guard. Two concurrent calls (two staff members clicking "mark sent" on the same request, or a client retry after a timeout) can both pass the initial read, both post a full `manual_payout` ledger transaction, and only one will win the later atomic transition - the loser's ledger entries are not rolled back even though its own `move()` call returns "That request has already moved on." |
| Where | `lib/billing/payouts.ts:354-393` - the ordering is: `select()` (362-366), status check (368-369), `postManualPayout(...)` (371-378, unconditional), THEN `move({from:["approved"], to:"sent"}, ...)` (380-392). Contrast with `move()` itself (`payouts.ts:247-285`), which IS correctly atomic - the bug is that the atomic guard is checked too late, after the side effect it is meant to gate. |
| Who is harmed | The books, and potentially the clinician if a duplicated `therapist_payable` debit is later corrected by hand. This is not a hypothetical shape: `traceHeld()` in the same file (`ledger.ts:812-849`) contains a purpose-built `duplicatePayouts` detector - "More than one payout against the same request is the double-pay bug" - which only makes sense as a detector for a race that can actually happen. |
| Severity | blocker |
| Already known? | Not named by any C-number. Directly answers the prompt's question 7 ("can a payout be... sent twice?") - yes, at the ledger level, and the codebase's own duplicate-detector is evidence the authors suspected as much without closing the actual race. |

---

## 20. C305's payout screen requirement ("names the rail, the entity... the frozen rate") is not met - the data exists and is dropped before it reaches the component

| Field | Detail |
|---|---|
| What | `payout_requests` carries `entity`, `method`, `fxRateMicro` and `fxQuotedAt` (confirmed in the schema and in `payoutsForTherapist`'s unfiltered `select()`). The earnings page drops three of the four when building props for the `Withdraw` component: only `payoutCurrency` survives the mapping. |
| Where | `lib/db/schema.ts:147-176` (`payout_requests` columns, all four present); `app/(app)/earnings/page.tsx:141-158` (`history: requests.map(...)` - includes `id, amountCents, payoutAmountMinor, payoutCurrency, status, requestedAtLabel, movedAtLabel, proofUrl, rejectedReason, accountName` - no `entity`, no `method`, no `fxRateMicro`/`fxQuotedAt`); `components/billing/withdraw.tsx:45-56` (`WithdrawRow` type - matches the page's mapping, so the component was never given the fields to render even if it wanted to). |
| Who is harmed | The clinician, who per C305's own reasoning should never be shown a payout without seeing the rail, entity and rate that produced it - the exact "manual Stripe payout button would be a false label" concern C305 raises, still true of the one field it does render (currency) with no rate attached. |
| Severity | major |
| Already known? | C305, ruled - sprint 59 (implicitly via 59.21, unchecked: "the screen names the rail, the entity, the currency and the frozen rate"). Confirms the specific fields missing rather than a general "not done yet." |

---

## 21. The renewal obligation is unbuilt, and today's Stripe-only entitlement already shows the failure mode C341 warns about - before Egypt exists

**Attack 5: sprint 59's renewal obligation.**

| Field | Detail |
|---|---|
| What | `entitledTier` reads `sub.currentPeriodEnd`, a column only Stripe's webhooks fill in. Its own comment states the handling of a null value: "A null period end is a subscription Stripe has told us nothing about yet... Honour it." The downgrade branch only fires `if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= now)`. This produces two distinct live failure modes: (a) a missed FIRST webhook leaves `currentPeriodEnd` null forever, and the subscription is honoured as paid indefinitely with no confirmation money ever changed hands; (b) a missed RENEWAL webhook leaves the OLD `currentPeriodEnd` in place, which is now in the past, and the very next read silently downgrades the therapist - exactly the "a missed gateway callback silently ends a therapist's plan" failure C341 names for Egypt, except it is already true for Stripe alone, today. |
| Where | `lib/billing/plans.ts:108-131` (`entitledTier`, both branches). |
| Who is harmed | A therapist on an existing Stripe subscription whose renewal webhook is dropped (a known-possible Stripe failure mode, not exotic) loses their plan status with no obligation row, no reconciler, and no dunning to catch it - sprint 59's whole 59d section is meant to fix this, and 59.13-59.15 are unchecked. |
| Severity | blocker |
| Already known? | C341, ruled - sprint 59, framed around "a non-Stripe rail." This finding shows the identical root defect (entitlement trusting gateway-callback delivery rather than an owned obligation row) is already reachable on the Stripe-only rail that has been live since sprint 1, which the ruling's own framing does not say. |

---

## 22. Sprint 59d's own ticket list names no rule for eight concrete renewal failure modes

| Field | Detail |
|---|---|
| What | 59.13-59.17 specify the obligation row's shape (due date, amount, currency, state), that entitlement reads it, that a reconciler exists, dunning, and proration on a plan change. None of the eight scenarios the audit brief names - partial payment, overpayment, a payment in the wrong currency, a duplicate payment, a refund of a renewal, a plan change mid-period **interacting with the obligation row itself** (as opposed to proration's dollar figure), clock skew between our server and whatever confirms a payment-link renewal, and a due date passing while a payment is already in flight - has a stated rule anywhere in the sprint 59d bullets or in C310/C341's ruling text. |
| Where | PLAN.md sprint 59d (59.13-59.17); C310, C341 (ruling text, both searched for the eight terms above - none present). |
| Who is harmed | Whoever builds sprint 59 against this ticket list as written - each of the eight is a plausible real event for a manual payment-link rail (Egypt has no card-on-file, per C310 itself), and none has a specified state transition. |
| Severity | major |
| Already known? | Within C310/C341's scope but not named by either. This is a specification gap in an existing ruling, found by checking the ruling's text against the audit's own list of attacks rather than restating the ruling. |

---

## 23. Sprint 64's design has no payment-provider abstraction to build on, despite citing one as precedent

**Attack 8: the Egyptian rail.**

| Field | Detail |
|---|---|
| What | 64.1 says "A provider interface with one adapter, never a vendor name in a call site. C37 already refuses a static FX rate for the same reason" - citing `fx.ts`'s `PROVIDERS` array as the pattern to imitate. There is no equivalent structure anywhere for a *payment collection* provider - the only two things resembling it are `country.collectionProvider` (a string field nothing reads, finding 4) and the hardcoded, single-account `getStripe()` client (`lib/billing/stripe.ts:27-32`), which has no notion of a second provider at all. |
| Where | `PLAN.md` 64.1; `lib/billing/fx.ts:69-83` (the actual `Provider` type and `PROVIDERS` array being cited); `grep -rln "paymob\|kashier\|fawry" lib` - zero implementation files; `lib/billing/stripe.ts:27-32` (`getStripe`, one client, one key, no entity or provider parameter). |
| Who is harmed | Whoever scopes sprint 64 against the plan's own confident framing. This repository has a documented history of this exact miscalibration - C10 records the money-model migration for sprint 4 running roughly 2x over its estimate for the same reason (an FX/currency column set assumed to be smaller than it was). Citing `fx.ts` as precedent understates the gap: FX needed one function and a rate table; a payment provider needs a checkout-creation call, a webhook or polling confirmation path, a refund call, and a payout call, none of which exist as an interface today. |
| Severity | major |
| Already known? | Not named by any C-number I found - C10 is the closest analogue (a prior instance of this exact estimation failure) but is about sprint 4, not sprint 64. |

---

## 24. Sprint 64's design does not say whether the Egyptian adapter would repeat two defects this audit found in the existing money code

| Field | Detail |
|---|---|
| What | 64.6 accepts that "every Egyptian session is money we hold" and that the payout queue becomes Egypt's *normal* path, not its exception - explicitly building on `payout_requests` "end to end" (64.5). Nothing in sprint 64's bullets acknowledges that the queue it is about to make load-bearing for an entire country currently contains: the double-ledger-post race on `markPayoutSent` (finding 19), and the payout-entity mismatch computed from method rather than from the held entity (finding 16) - a mismatch that would fire on essentially every Egyptian payout, since every Egyptian clinician's payout method is by definition non-Stripe. Separately, `connect.ts`'s own comment identifies `charges_enabled` vs `payouts_enabled`/transfer-capability as "the classic mistake" (`connect.ts:874-880`) - the design does not say whether the Egyptian adapter's capability check will be built against that lesson or re-learn it. |
| Where | PLAN.md 64.5, 64.6; findings 16 and 19 above; `lib/billing/connect.ts:874-880` (the documented lesson). |
| Who is harmed | Every Egyptian clinician, the first group for whom the manual payout queue is not a contingency but the only rail - inheriting two live, unfixed defects the moment 64 ships, unless 59's payout fixes are sequenced ahead of 64's queue becoming load-bearing. |
| Severity | major |
| Already known? | C309 ("the payout queue becomes the NORMAL path in Egypt... staffed as one") treats this as a staffing/rota question. It does not treat it as a code-correctness precondition, which findings 16 and 19 show it also is. |

---

## What I could not verify

- Whether Stripe's live API would actually accept or reject the EGP-denominated
  Checkout Session described in finding 4 - I read the code path and confirmed
  it is reachable with no application-level gate, but I have no live Stripe
  credentials and did not attempt the call. If Stripe refuses it at the API
  boundary, findings 4 and 5 become "no gate exists, but the vendor's own
  validation happens to save us" rather than "money is mis-routed" - still
  worth closing, since relying on a third party's validation as your only
  safeguard is itself the finding.
- Whether the `COUNTRY_SEED` data in `lib/settings/defs.ts` (Egypt,
  `collectionProvider: "paymob"`, `enabled: true`) matches what is actually
  loaded into the production `country_settings` table today. I read the seed
  source and the schema; I did not and was told not to query the database.
  If production's Egypt row is disabled or has no currency configured, finding
  4's practical reachability narrows to whatever countries an admin has since
  enabled through the settings UI - the code-level absence of a gate stands
  either way.
- Whether `scripts/verify-sprint16.ts` or any other verify script currently
  passes in CI against the live schema - I read these scripts as source to
  confirm what they check (in particular, that `hasNoRail` truly has no other
  caller), but did not execute any script, per the brief's read-only
  instruction and its explicit list of what not to run.
- Whether the double-ledger-post race in finding 19 has ever actually fired
  in production - I found the ordering that makes it possible and the
  purpose-built detector (`traceHeld().duplicatePayouts`) that suggests the
  authors anticipated it, but I have no access to `payout_request_events` or
  `ledger_entries` history to say whether it has happened.
- Whether an Egyptian therapist has ever actually chosen an EGP payout method
  against a US-held balance (finding 16) in real data - the mechanism is
  confirmed from the code; whether it has been exercised is a database
  question I did not run.
