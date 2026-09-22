# Slice 11: components-rest

## Files

### components/billing/bill-picker.tsx (206 lines)
- For: PAYG clinician picks which unpaid invoices one bank transfer covers, then opens `PaymentPopup`.
- Decides: holds ids only; figures come from server `quote(ids)` debounced 500ms (106-114), only after a change (`touched`, 91). All preselected (81). Frozen while live state is submitted/awaiting_proof (99). Picker hidden when one invoice (131). Empty selection shows `bill.pickOne` but `PaymentPopup` still renders with the last quoted figure (185-203).
- Assumes: server `quote` and `onOpen(ids)` recompute from stored rows; `PaymentPopup` storage key.
- Promises: A1 (nothing granted here), price shown = server figure.
- Notes: tokens `text-brand-800` link, `text-brand-700` checkbox, `text-rose-600` error. Invoice rows in USD via `Money`, sheet total in EGP.

### components/billing/earnings.tsx (210 lines)
- For: Stripe-connected clinician earnings card (available, clearing, held, this month, lifetime).
- Decides: not connected + held>0 shows "waiting" + finish setup (61-86); connected shows headline available or "-" when Stripe unreachable (123). Held gets its own amber row (151). Pay out now only when payoutsEnabled and available>0 (172).
- Assumes: `payOutNow`, `openPayoutDashboard` in app/(app)/settings/actions.
- Promises: T3 partly: footer `tearn.lifetimeSettled` states lifetime net, fees and "settled from earnings" (196-205); it is lifetime history, not the per-payout "held vs owed" halves T3 asks for.
- Notes: whole card is `bg-brand-500 text-navy-600` (teal ground, navy ink). Line 187 dashboard button is `bg-navy-600/10 ... text-white` on the teal ground: white on teal, about 2.2:1 (the exact thing globals.css:56-67 says the palette verifier forbids). Line 153 `text-amber-200` icon on teal, invisible. Line 136/140 `bg-white/10` tiles barely visible on teal. Error box `bg-black/20` (166).

### components/billing/ledger.tsx (509 lines)
- For: clinician's one chronological ledger (invoices out, patient payments in) plus a Stripe multi-invoice pay card.
- Decides: Stripe pay card only when `payable` (not Egyptian rail) and due>0 (170). Total for the button label is computed in the browser (115-117) as sum(max(0, amount-discount)); `payInvoices(ids)` charges server-side. History sorted on ISO `sortAt` (142). `PaymentDetail` shows gross, fee (platformFee - settledInvoice), bill settled, net (459-499): this IS the T3 netting presentation per payment.
- Assumes: `payInvoices` re-prices from rows; `patientName` from chart not payer (C243, 53-61).
- Promises: T3 kept per payment row (fee and "bill settled" lines, 468-478). Price shown vs charged: button label is browser arithmetic, charge is server; they agree only if server uses the same discount rule.
- Notes: Badge tones used: green, amber, slate, red, teal, brand. `Badge tone="teal"` in a non-radar file (palette rule says teal-* belongs to radar files; depends on how Badge maps teal, see ui/index). Mixes `formatUsd` (plain) and `Money` (USD with pounds on hover) on the same row. `−` minus sign literal.

### components/billing/pay-by-transfer.tsx (466 lines)
- For: the manual transfer rail UI for all payers: details, submitted (waiting), rejected, unconfigured.
- Decides: submitted state polls `router.refresh()` every 15s (202-206) and shows own receipt back (236-251). Rejected shows operator reason verbatim (267-269) with `transfer.rejectedBody`, and NO form or retry control in that state (258-273). Unconfigured says so (277-288). Amount posted as hidden `amount` = step.creditCents/100 only for pot (404); server recomputes tax. Submit instruction in a red bordered `role="alert"` box (376-381).
- Assumes: `submitProof` enforces reference-or-receipt; server builds `lines`, `amountLabel`, `taxNote`.
- Promises: A3 kept on this screen (verbatim reason). A1 (submitted is waiting, not granted).
- Notes: `role="alert"` on a static instruction re-announces on every render (H8 adjacent). Red used for an instruction although pending-bar.tsx:121-133 argues red is reserved for crisis. Tokens: amber-50/200/900 waiting, rose-50/200/900 rejected, `bg-brand-500 text-navy-600` submit.

### components/billing/payment-history.tsx (215 lines)
- For: therapist list of patient payments (net of gross) and payouts released.
- Decides: patient name from chart, card details removed (13-22, 92-98). Held chip when capture=platform (114).
- Promises: none directly; C243 sponsor anonymity toward therapist kept (no payer name/card).
- Notes: hardcoded English "Patient payments" (81), "A patient" (89), "of" (107), despite `useT`. Local `Chip` duplicates `Badge` from ui (189-215). Doc comment 46-50 still says "The card brand and last four are here" while the code removed them (Stale).

### components/billing/payment-popup.tsx (470 lines)
- For: the one payment sheet for patient, clinician, clinic, company; minimised as button or floating orb.
- Decides: holds no payment state; opens from `localStorage pay:<key>` read in effect (187-193); `onOpen` writes the awaiting_proof row server-side when the sheet opens (200-203, 213). Cancel (two taps) only in states none/awaiting_proof (231-232). Orb `fixed end-3 bottom-24 z-[60]` said to be below SOS (297-305). Sheet stops above bottom nav `pb-20` (351). Backdrop click closes (357-362). Card slot "coming soon" rendered disabled (431-435).
- Assumes: `cancelCart` WHERE state guard; `verify:rail` refuses import by therapist/admin surfaces (60-62); SOS orb z-index above 60 (P5).
- Promises: P5 depends on SOS z-index > 60 (not in slice). A1.
- Notes: cancel confirm button `bg-amber-600 text-white` (263), amber-600 with white is about 3.2:1, under 4.5. `onwardHref` link rendered whenever passed, regardless of live state (459).

### components/billing/pending-bar.tsx (216 lines)
- For: bar across every portal while a manual payment is open, submitted, or just confirmed.
- Decides: confirmed can be dismissed per payment in localStorage (83-114); open/submitted cannot be dismissed. Tapping writes `pay:<storageKey>` so the sheet opens on arrival (99-105). Colours: confirmed `bg-emerald-700 text-white`, open `bg-amber-500 text-amber-950`, submitted `bg-amber-300 text-amber-950` (146-150). Amount `shrink-0` so never truncated (172-175).
- Promises: P2 (in-app, not only email) for payments.
- Notes: comment 179-181 still says "red is unfinished business waiting on the payer", but 121-133 removed red (Stale). Second line `opacity-80` on amber-950 text fine.

### components/billing/plan-card.tsx (436 lines)
- For: clinician plan: PAYG vs monthly unlimited tiers, this month's spend, credit, held earnings, cancel/resume.
- Decides: PAYG = first tier with monthlyCents 0 (125). Tap selects, a separate "confirm and pay" spends (140, 359-429); confirm calls `upgradeAndPay(tier.key)` for BOTH up and down (390), then writes `pay:<key>` and reloads (404-408). C209 line "AI fee never charged when patient declines" (179).
- Assumes: `upgradeAndPay` handles a PAYG (downgrade) key; `cancelPlan`/`resumePlan`.
- Promises: T3 adjacent (held earnings tile, 216-219).
- Notes: PAYG card price shows global `platformFeeCents`, not `tier.unlockCents` (334); `unlockCents` is unused in the component. Current tier card is `border-brand-600 bg-brand-50`, "yours" pill `bg-brand-500 text-navy-600`. `Badge tone="teal"` for credit (184).

### components/billing/seat-manager.tsx (145 lines)
- For: seat slider with a server quote before the button (C323/C333/C351).
- Decides: every move calls `quoteSeats(next)` (52-63); Save calls `saveSeats(from, to)` (134). Removing seats: "does not refund this month ... smaller bill starts at renewal" (108-112).
- Assumes: `quoteSeats`/`saveSeats` in app/(app)/billing/actions recompute server-side and refuse a stale `from`.
- Promises: C3/C4 wording (lower bill at renewal). PL7 retroactive band step described in comment 28-36.
- Notes: ALL copy is hardcoded English (no `useT`). Quote sentence says "up from {from}" even when seats go down (96-98). Range `accent-brand-700`. Rapid slider drags fire one server quote per step with no debounce (52-62), and results can arrive out of order (last-resolved wins, not last-asked).

### components/billing/top-up-stepper.tsx (196 lines)
- For: company pot top-up amount chosen by stepping through server-built rungs (USD big, EGP small, VAT, total to send).
- Decides: state is an index starting at 0 (56); `onChoose(creditCents)` debounced 700ms on every change INCLUDING the first render (62-67). Empty ladder message (73-77).
- Assumes: `openPotPayment` saves the chosen credit as the open payment (app/(sponsor)/sponsor/pot/page.tsx:212).
- Notes: `topup.covers` "covers N sessions" at their own coverage rate (119-126). See Broken: the stepper never restores the saved figure and overwrites it with the floor.

### components/billing/withdraw.tsx (257 lines)
- For: manual payout rail from the clinician side: held, requested, sent, available; destination form; request; history with receipts.
- Decides: request form only when available>0 and a destination exists (167); max = available (177). Rejected payout reason shown (221-223).
- Promises: T3 partly: shows held/requested/sent/available, but no "owed" figure beside held, so the netting (owed out of earned) is not visible here.
- Notes: comment 14 "an English-only surface" while every string goes through `t()` (Stale); `formatUsd` imported unused (15). `ml-auto` (211) not logical property (RTL).

<!-- FILES-END -->

## Design system inventory (slice-specific)

<!-- DS-END -->

## Stale

<!-- STALE-END -->

## Suspect

<!-- SUSPECT-END -->

## Broken

- components/billing/top-up-stepper.tsx:56,62-67. The stepper starts at index 0 (the floor) on every mount and, 700ms later, calls `onChoose(floor)`, which `openPotPayment` saves as the company's open payment (app/(sponsor)/sponsor/pot/page.tsx:211-212; no initial-index prop exists, grep of callers). The comment at 44-48 says the point of `onChoose` is that a finance officer who picked $1,500 and came back tomorrow does not find it reset to the floor; that is exactly what happens, and the saved $1,500 is overwritten with the floor as soon as the sheet renders. If they then submit proof without re-stepping, the hidden `amount` (pay-by-transfer.tsx:404) is the floor while their bank sent $1,500: an operator sees an overpayment (A4 path) for a company that did everything right.
- components/billing/earnings.tsx:187. "Payout dashboard" button renders `text-white` on the `bg-brand-500` card (via `bg-navy-600/10`): white on teal, about 2.2:1, the combination app/globals.css:56-67 says is banned and verified. verify-palette misses it because it matches ground and `text-white` on the SAME line only (scripts/verify-palette.ts:232-235); here the teal ground is on the parent at line 115.
- components/billing/seat-manager.tsx:96-98. Removing seats reads "N seats costs $X a month, up from $Y" with X < Y.

<!-- BROKEN-END -->

## Looks broken, is handled

<!-- HANDLED-END -->

## Unclaimed

<!-- UNCLAIMED-END -->

## Promise evidence

<!-- PROMISE-END -->

## Coverage

<!-- COVERAGE-END -->
