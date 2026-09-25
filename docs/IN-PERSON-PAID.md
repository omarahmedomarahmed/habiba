# In-person sessions paid through 24Therapy

Design for rulings 5b, 5c and 13 in `docs/DECISIONS.md`. Ruled on
25 September 2026: **pay before start.** No session with a price ever starts
unpaid, online or in person. Every number here is a setting with the default
shown.

## Why it was never built before

- Payment sat in front of the video link, and an in-person session has no
  link, so its price was forced to zero (`sessions/actions.ts`, `createSession`).
- Nothing proves an in-person session happened; the no-show and refund rules
  lean on the video room.
- Company money on sessions nobody can prove is the fraud the pot must be
  protected from.

This design answers all three: the in-person session gets a pay link, payment
comes before the start button, and only the patient can spend company money.

## The three ways a patient arrives in person

1. **Booked in advance** (calendar or radar, in person). Paid before, as online.
2. **Walks in, paid the therapist directly.** "Cash, start now." Free through
   us; $1 + $3 to a pay-as-you-go therapist. Exists today.
3. **Walks in, pays through us.** New, below.

## Flow 3

1. `/sessions/new`, where = in person, pick or add the patient.
2. **"Paid you directly"** starts now, as today. **"Patient pays through
   24Therapy"** fills in the therapist's one price; it can be lowered, never
   raised.
3. A **QR code** appears with the pay link, plus **"Send link"** (SMS, WhatsApp,
   email). The screen shows "Waiting for payment".
4. The patient scans and pays on their own phone: card, company benefit, or
   wallet credit. Enrolling with the employer on the spot and then paying
   counts.
5. Paid: **Start** unlocks by itself. Our 15% and the $1 + $3 apply as on a
   paid online session.

## Flow 4: the patient brings their own therapist

1. An enrolled employee taps "Invite my therapist" and shows a **QR code** (or
   sends it).
2. The therapist scans. With an account: the patient is added to their list
   with a 24-hour access request the patient approves. Without one: sign up
   with the patient already in the list, then verification.
3. **A new therapist's first session waits for verification.** No
   unverified clinician sees a patient under our name. One admin can clear
   it (no two-person rule on verification), with an alert to all admins.
4. Verified: flow 3.

## Loopholes closed

| Loophole | Closed by |
|---|---|
| Session starts and is never paid | Start is locked until paid. No exception. |
| Therapist and patient invent sessions to drain a company pot | Only the enrolled patient, signed in on their own account, can spend the pot. The therapist can never trigger it. A cap per patient per week (setting, default 2). |
| Price inflated to drain a pot | The price is the therapist's listed price or lower, never higher, for every session kind. |
| Bank transfer takes hours, patient waits in the room | Pay-before-start in the room accepts card, benefit and wallet only. Transfer stays for bookings made in advance. |
| Paid through the link and also marked "paid directly" | "They paid me directly" is only offered while unpaid. It voids the link in the same step. A payment that still arrives is refunded automatically and logged. |
| Paid, but the session never started | Paid but not started before the link expires: automatic full refund, to wallet or card (setting). |
| Unpaid link left lying around | Expires with the link lifetime (setting); the session is cancelled. No debt, no reminders. |
| Old session paid later with a new enrolment | Coverage only applies on the pay page before the start; a started or ended session can never be paid by the pot. |
| A sweep cancels a paid or started session | Every sweep keeps its payment and arrival guards. A new check proves a started session is never cancelled. |
| Unverified therapist gains record access through a patient QR | The database already refuses to grant access to an unverified therapist; the request stays pending. |
| One admin can now approve and send a payout alone (ruling 13) | You still cannot approve your own payout (in the database). A change of payout details waits 24 hours before the next payout (setting), and the therapist is told. Every single-person money action is in a daily digest to all admins. |

## Settings added

- `inPerson`: pay through us on, pot cover on, weekly pot cap 2, price above
  list off, in-room methods (card, benefit, wallet), refund if not started on,
  refund to wallet or card.
- `session.lengthMinutes` 50.
- `approvals`: two-person switch per action (refunds on; payouts, top-ups,
  verifications, pot returns off), threshold, payout-details cooldown 24h.
- `tax`, `eta`, `providers`, `links`, `refunds` as listed in `docs/LONG-TERM.md`.

## What changes in the code

- `/sessions/new`: payment question, price, QR screen, "Send link", "Waiting
  for payment", "They paid me directly".
- Room: Start locked until paid (already true for online; extended to in
  person).
- `createSession`: an in-person session with a price gets a pay token.
- `/pay/[token]`: in-person variant; applies company cover and wallet; no
  transfer in the room.
- Sweeps: expire unpaid in-person links; refund paid but never started.
- Patient QR invite, `/connect` open to unverified (pending only), onboarding
  carries the invite.
- Bookings: each hour online, in person or both; practice address; radar
  "in person" filter; booking calendar choice.

## Checks that change

| Check | Change |
|---|---|
| `verify:rail` room-before-session | Exemption, with a reason, for paid in-person sessions. |
| `verify:rail` session-creating files | List any new file. |
| `verify:sprint25` | The form's payment question. |
| `verify:caseload` | Add a paid in-person case. |
| `verify:edges` | Price bounds cover in-person prices. |
| Two-person checks (`sprint16`, `payout`, `gateway`, `month`, `eta`, `sprint69`, `w1b`, `admin-access` test) | Rewritten to test each switch in both positions. |
| New | A priced session never starts unpaid; the pot is never spent without the patient's own account; price never above list; a started session is never cancelled; paid-not-started is refunded; each two-person switch works both ways. |
