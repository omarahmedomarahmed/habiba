# In-person sessions paid through 24Therapy

Design for rulings 5b, 5c and 13 in `docs/DECISIONS.md`. Every number here is
a setting with the default shown.

## The three ways a patient arrives in person

1. **Booked in advance** (calendar or radar, in person). Paid before the
   session like any online booking. Nothing new about the money; the slot and
   the booking gain a place (online or in person).
2. **Walks in, pays the therapist directly.** "Cash, start now." Free through
   us. $1 + $3 to a pay-as-you-go therapist. Exists today.
3. **Walks in, pays through us** (their own money or their company benefit).
   New. This document is mostly about this one.

## Flow 3: the therapist starts it

1. `/sessions/new`, where = in person.
2. Pick the patient from the list, or add one: name plus phone or email.
3. **How is this session paid?**
   - **Paid you directly (cash).** Start now. Pay-as-you-go notice: "$1, and $3
     if the patient turns AI on, on your bill after the session."
   - **Patient pays through 24Therapy.** The price is prefilled with the
     therapist's one price. The therapist confirms.
4. We create the session with a pay link and show a **QR code** on the
   therapist's screen. The same link goes to the patient by SMS or WhatsApp and
   email.
5. The patient scans the QR on their own phone. That scan is the **"patient
   connected"** moment: it proves the patient is physically there and agrees
   to the bill. Their app shows the session with the bill pending (the orb).
6. After "patient connected", **the therapist can start the session even if
   the bill is not paid yet.** This is the only case where a session starts
   unpaid.
7. The patient pays within the payment window (**6 hours**), either:
   - now, with their own money (card or transfer), or
   - after enrolling with their employer and verifying, so the benefit covers
     its share. Email-code and ID-number enrolment is instant today, so 6 hours
     is enough.
8. Paid: our 15% is taken as on any paid online session. Pay-as-you-go $1 + $3
   applies as always.

## Flow 4: the patient brings their own therapist

1. An employee enrols with their company in the patient app.
2. "Invite my therapist" shows a **QR code** and can send it by SMS, WhatsApp
   or email.
3. The therapist scans it:
   - **Has an account:** the patient lands in their list with **24-hour
     access**, pending the patient's approval on their phone.
   - **No account:** sign up (first session free), with this patient already
     in the list, then ID and licence verification.
4. Once verified, the therapist starts an in-person session for this patient
   and picks "Patient pays through 24Therapy" (flow 3 from step 4).

## Challenges, and what I recommend

**A. A session that starts unpaid can stay unpaid.** We are the agent, so the
debt is the patient's to the therapist; we only collect. Recommend:
- After the window the bill does **not** vanish. It stays on the patient's
  billing as owed, with two reminders.
- The therapist can close it at any time with "They paid me directly", which
  turns it into a cash session.
- Our 15% is only ever taken on money that actually arrives. The $1 + $3 is
  owed regardless, because the session happened.
- No sweep may ever cancel a session that has started or ended. Today's two
  sweeps only touch scheduled sessions; a new check will lock that in.

**B. Company money on a session with no video is the biggest fraud risk.** A
therapist and a patient could invent in-person sessions to drain a company
pot. Online sessions leave a room log; in-person leaves nothing unless the
patient allows recording. Recommend:
- The pot pays only after the **patient** confirms on their own phone (the QR
  scan or the link). The therapist can never trigger the pot alone.
- A cap on pot-paid in-person sessions per patient per week (**2**).
- The price charged to a pot can be the therapist's listed price or lower,
  never higher.
- Retroactive cover only inside the payment window: an enrolment made days
  later cannot pay for an old session (**6 hours**, same setting).

**C. The price.** You wrote "enter the amount". Rulings 6 and 5d say one price.
Recommend: prefilled with their one price, may be lowered (a discount), never
raised above it.

**D. A brand-new therapist cannot be verified while the patient waits in the
room.** Verification is a human checking an ID and a licence; that takes
hours, not minutes. Everything licensed hangs on it: the database refuses to
grant record access to an unverified therapist, and only verified clinicians
may practise here. Recommend:
- The new therapist signs up and is placed in the fast verification queue,
  with an alert to the admins. No two-person rule on verification (ruling 13),
  so one admin can clear it.
- **Their first session with that patient waits until they are verified.**
  Alternative: allow the first session as cash only, with no recording and no
  company money. I do not recommend it, because it puts an unverified person in
  front of a patient under our name.

**E. Access.** A patient QR scan gives the therapist 24-hour access, pending
the patient's approval. This reuses the existing grant model (24h grants
already exist). The therapist's own session notes stay theirs after the 24
hours, as today.

## Open questions for you

1. **50 minutes including the 10-minute countdown?** Today the clock runs 50
   minutes, then a 10-minute countdown, then stops at 60. I recommend: 50
   minutes total (countdown from minute 40), bookings still on the hour, with a
   10-minute gap between patients.
2. **The price in flow 3:** prefilled and lowerable, never higher (C)?
3. **Unpaid after the window** stays owed, with the therapist able to mark it
   cash (A)?
4. **New therapist from a patient QR** waits for verification before the first
   session (D)?

## What changes in the code

**Routes and screens**
- `/sessions/new`: the payment question for in person, price, QR screen,
  "patient connected".
- `/sessions/[id]/room`: an in-person session can start after "patient
  connected" while unpaid.
- `/pay/[token]`: an in-person variant with the window, and it applies company
  cover (the pay page does not call it today).
- `/join/[token]`: an in-person link goes to paying, not to a video room.
- `/patient` home orb, `/patient/billing`, `/patient/account` become the new
  profile with tabs (ruling 8b).
- `/patient/consent`: "Invite my therapist" gains a QR.
- **New** route for a therapist scanning a patient's QR (sign in or sign up,
  then connect with a 24-hour grant).
- `/connect` opens to unverified therapists. Today it redirects them to
  onboarding, even though the code says redeeming works before verification.
- `/onboarding` carries the patient's invite through signup.
- `/bookings` and the hours editor: each hour is online, in person, or both.
- `/t/[id]` and the booking calendar: pick in person or online, show the
  address.
- Radar: an "in person" filter.
- `/settings`: practice address and "accept in-person bookings" (today these
  live in the on-call practice form).
- `/admin/settings`: the new settings blocks.
- Admin payouts, refunds, verifications and pot returns: follow the
  two-person switches.

**Data**
- `sessions`: how it is paid (cash, through us) and when the patient
  connected.
- `availability_slots`: place (online, in person, both).
- A language column for patients and therapists.
- Patient invite codes gain a QR-scannable link.
- Migrations dropping the two-person database constraints that the new switches
  turn off. The rule "you cannot approve your own payout" stays in the
  database; the rest moves into code behind switches.

**Settings added**
- `inPerson`: payment window hours (6), start before paid (on), pot cover for
  in person (on), weekly pot cap (2), price above list allowed (off).
- `session.lengthMinutes` (50).
- `approvals`: two-person switch per action (refunds on; payouts, top-ups,
  verifications and pot returns off), plus the threshold that already exists.
- `tax`: session VAT (0), fee VAT (14%), withholding (0), seller model (agent),
  top-up document (B).
- `eta`: document types, version, item codes, retries, which purposes get a
  document.
- `providers`: card gateway, payouts, ETA signer (names only; keys stay in the
  environment).
- `links`: pay and join link lifetimes.
- `refunds`: policy.

## Verifiers and tests this breaks

**Two-person switches**
- `verify:sprint16` asserts:
  - an approver cannot approve their own payout;
  - an editor cannot approve;
  - the editor constraint refuses a direct SQL update.

  The own-approval check stays; the other two are rewritten to test the
  switch in both positions.
- `verify:payout`, `verify:gateway` and `verify:month`: the parts that use a
  second person, rewritten for both switch positions.
- `verify:eta` (pot return asker cannot send): now depends on the switch.
- `verify:sprint69` ("a single reviewer decided alone" throws), and
  `verify:w1b`: now depend on the switch.
- `tests/admin-access.test.ts`: every payout action must call the two-person
  check. It will call the switch instead.
- `verify:sprint14` (refunds) stays as it is while refunds keep the rule on.

**In-person paid**
- `verify:rail`:
  - every clinician session path must build a video room before creating the
    session;
  - no unlisted file creates sessions;
  - every cancel must check payment and arrival.

  In-person paid sessions need an exemption with a reason, and any new file
  that creates sessions must be listed.
- `verify:caseload`: creates in-person sessions at price 0. Still true for cash;
  a paid case is added.
- `verify:sprint25`: the new-session form fields. Updated for the payment
  question.
- `verify:edges` (price bounds): extended to in-person prices.
- `tests/safety.test.ts` (no-show proof is false for in person): unchanged.

**Session length and wording**
- Every copy key that says 30 minutes, half hour or one hour (about 20 keys in
  English and Arabic). The prose ratchet in `evals/prose.json` must be adjusted
  to match the net change exactly.
- `verify:sprint11` (booked hour): unchanged if bookings stay on the hour.

**New checks to add**
- An in-person session that has started or ended is never cancelled by any
  sweep.
- The pot never pays an in-person session without the patient's own
  confirmation.
- A pot-paid in-person price never exceeds the listed price.
- Every two-person switch is honoured in both positions.
- Every setting named above exists, is editable and is audited.
