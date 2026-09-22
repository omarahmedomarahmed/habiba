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
