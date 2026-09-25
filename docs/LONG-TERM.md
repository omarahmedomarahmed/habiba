# The long-term list

Everything that is waiting on someone: counsel, an accountant, a provider, or
the founder. Everything here is either already a setting or will be built as
one, so a ruling becomes a settings change, not a rebuild. This list is
repeated at the end of every progress report until it is empty.

## 1. Waiting on counsel

None of these stops us building. Each one stops us **turning on real money**
in the affected area until it is answered.

| Q | Question (short) | What it gates | Setting | Default until answered |
|---|---|---|---|---|
| 1 | Does the agent model hold, and what must the terms say? | How every document is worded, and whose revenue a session is | `tax.sellerModel` | agent |
| 2 | Does the healthcare exemption cover psychologists, online, and company-paid sessions? | VAT on the session price | `tax.sessionVatBps` | 0 |
| 3 | 14% VAT on our fees, invoiced to the therapist? E-receipt if unregistered? | Our fee invoices | `tax.feeVatBps`, `eta.purposes` | 14%, no ETA document for fees yet |
| 4 | Must we register for VAT now; 500k or 250k threshold? | ETA registration timing | none (paperwork) | not registered |
| 5 | Withholding on therapist payouts, and at what rate? | Payout amounts | `tax.payoutWithholdingBps` | 0 |
| 6 | Company withholding on top-ups: on our fee or the whole amount? | Top-up matching | `tax.topupWithholding` | off |
| 7 | Top-up: deposit or invoice on arrival? Whole amount or fee only? | ETA documents for companies | `eta.topupDocument` | B (receipt, ETA invoice on arrival) |
| 8 | Patient payments: our e-receipt and the therapist's own? | Patient receipts | `eta.purposes` | none |
| 9 | May the card fee be passed to the patient, and is it taxable turnover? | The Paymob fee line | `payments.patientPaysCardFee` | on, shown, not yet charged for real |
| 10 | Does a patient wallet with no top-up need a licence? Expiry? Refund on request? | The wallet | `wallet.*` | on, no expiry, refund on request |
| 11 | May we hold therapists' money between payment and payout, or must a licensed provider hold it? | **The biggest one.** How money flows at all | `payments.holdingModel` | we hold (today). The alternative, the provider splits at payment, is built as a seam so we can switch |
| 12 | May we bill Egyptian therapists in USD? Whose exchange rate for ETA? | Fee and subscription currency | `pricing.currency`, `payouts.egpRateMicro` | USD with EGP shown, rate 50 |
| 13 | Data law 151/2020: health data, recordings, AI, hosting outside Egypt | Where data lives, consent wording | `region.*` | as today |
| 14 | Which licences count, and does online therapy need its own licence? | The verification form's list of licence bodies | `verification.licenceBodies` | as today |
| 15 | Our ETA issuer name and activity code | ETA documents | `invoice.entities[eg]` | placeholder |

## 2. Waiting on registration or providers

| Item | What is ready | What is missing |
|---|---|---|
| ETA e-invoicing | Documents, signing seam, simulator, retries, review queue | Registration, client id and secret, an e-seal from Egypt Trust or MCDR, a signing provider |
| Paymob cards | The gateway seam and a test adapter | A Paymob account and keys; the real adapter wired to them |
| Paymob payouts | The payouts seam and a test adapter | Keys; the real adapter |
| Bank details | Editable in settings | The real account (the IBAN on file is the registry example) |

## 3. Built, pending your confirmation

These run on the defaults shown. Any of them can change later in settings.

- In-person paid flow: pay before start (ruled), pot cap 2 a week, price never
  above list, card, benefit and wallet in the room, refund if paid and not
  started, payout-details cooldown 24 hours (`docs/IN-PERSON-PAID.md`).
- Two-person approval on refunds only.
- Free first session: once per practice.
- Renewal notices 7, 3 and 1 days before; renewal raised 7 days before.
- Pay link lifetimes: 12 hours (sessions), 3 hours (radar), start + 4 hours
  (bookings).
- Refund policy: always the full amount; automatic on no-show, clinician
  cancel, or a report. A patient who cancels a paid booking at least 24 hours
  before (`rules.refunds.patientCancelWindowHours`) is refunded in full, a
  company's share back to its pot; later, the money stays with the
  clinician unless they press "Refund anyway" (ruling 16, built).

## 4. Features deferred (from the audits)

- Partner invoices and payment instructions (partners are billed monthly to
  `partner_receivable` but receive no document yet), and partner docs on
  sandbox vs live keys, approval and per-session price. Not needed for launch.
- WhatsApp templates to approve with Meta. **Written, waiting on Meta.** All
  21, with English and Arabic bodies, are in `lib/notify/templates.ts`; the
  ones the launch adds are `phone_verify` (authentication), `payment_rejected`,
  `payout_sent`, `payout_rejected`, `payout_returned`, `support_reply`,
  `checkin_asking`, `session_rescheduled`, `patient_cancelled` and
  `patient_moved`. Approved names go in `WHATSAPP_APPROVED_TEMPLATES`; until a
  template is listed it is never sent, and the email or an in-app notice
  carries the message instead (`verify:whatsapp`). Only `phone_verify` has no
  fallback, by design: the code must reach the new number.

- ~~Patient cancel and reschedule; therapist reschedule.~~ Built (task 40,
  `verify:booking-change`).
- ~~Receipts for patients to download.~~ Built: a printable receipt in
  English or Arabic per payment, from the patient's billing page.
- Personal files (licences, IDs, receipts, support attachments, patient
  photos and documents) are private blobs, read only through authorised
  routes (`verify:blobs`). **Waiting on the operator:** a private Blob store
  and `BLOB_PRIVATE_READ_WRITE_TOKEN`, then `npm run blobs:private -- --apply`
  for older files. Runbook in `docs/NEON-BRANCHES.md`.
- Earnings export for therapists.
- A "today" view for therapists.
- Loading and error screens in every portal.
- Clinic time zone (Cairo) instead of UTC.
- Record export across every therapist a patient saw.
- Payout date and hold reason on earnings.
