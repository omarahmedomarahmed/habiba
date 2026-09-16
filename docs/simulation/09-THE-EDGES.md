# The money edges

**Forty eight things that go wrong with money, every one of which happened to somebody real
somewhere, and every one of which this run has to put the product into on purpose.**

Waves 1 to 6 in `01-THE-CAST.md` are a business trading for six months. This file is the other
half: the states that business produces when somebody pays twice, pays late, pays the wrong
amount, changes their mind halfway, or works for two employers at once.

They are **not extra scenes**. Every one of them attaches to a person who is already in the
cast, in a wave they are already in. A forty ninth person would be a row in a database; a
forty ninth thing going wrong to a person who is already here is a Tuesday.

---

## Why this file exists, and it is not a hypothesis

Sprint 76 found four defects in one family, by hand, in one afternoon:

> **A covered employee was charged twice.** An employer covered half a session, the pot paid
> their half at booking, and all three surfaces that priced the session afterwards asked the
> patient for the whole thing. On a rail with no processor that is money taken twice with
> nothing to reverse it.

And then, looking for more of the same shape:

> **The card rail quoted one number and charged another.** The payment screen showed $22.80
> and Stripe asked for $11.40.
>
> **The patient's transfer was posted to no account at all.** `session_payments` allows one row
> per session and the pot had already written it, so the confirmation hit a conflict, logged a
> warning and returned. The money arrived in the bank and the ledger never heard.
>
> **So the VAT vanished.** Derived by subtracting the full price from a part payment, which is
> negative, which clamps to zero. Tax we hold and genuinely owe, recorded as nothing.

Every one lived in the path with the most moving parts in this product, and **the gate that
claimed to cover it had a section heading that described a test which did not exist**. Twelve
of the cases below are now in `npm run verify:edges` and run on every gate pass. The rest are
here because a verifier can hold an invariant and only a person can find out that a screen
does not say enough for somebody to act on it.

---

## The rule for this file

**Every case below is reported on, including the ones that pass.**

`REPORT.md` grows a table with one row per case: the case, who hit it, what the screen said,
the row id, and `held` or `broke`. A run that reports only the breakages is a run where a
reader cannot tell the difference between "we checked and it was fine" and "nobody looked".

That is the same rule as `DID / SAW / ROW` in `00-START-HERE.md`, applied to a checklist
instead of to an action.

---

## Group A · the covered employee

The family sprint 76 found. `P3` Mostafa is covered at 100% by `E1`; `P5` Nadia at 10% by `E2`
and then by `E3`; `P4` Hoda at whatever `E1` is paying that month.

| # | Case | Who | What must hold |
|---|---|---|---|
| `CV1` | **Charged twice** | `P5` in wave 3 | The pot pays 10% at booking and her screen asks for the other 90% plus VAT on the 90%. Not the price. The line items say which is which |
| `CV2` | **Quoted one number, charged another** | `P5` | The figure on the payment screen equals the figure the checkout or the transfer sheet asks for, to the cent, in both currencies |
| `CV3` | **The money arrives and the books never hear** | `P5` in wave 3 | After the operator confirms, the ledger holds a `vat_payable` leg for the tax on HER share and a cash leg for the money. Read off `/admin/vault`, not queried |
| `CV4` | **The tax on a part payment** | `P5` | 14% of her share, never 14% of the price and never zero |
| `CV5` | **Fully covered asks for nothing** | `P3`, every session | No payment screen at all. He books and joins. If he is ever shown a bank account, that is the finding |
| `CV6` | **0% is not removal** | `E2-HR` in wave 5, **new to the cast** | Mariam moves the slider to 0% rather than removing anybody. `P5` keeps her badge and her place on the roster and owes the whole price. She is not un-enrolled and no screen says she was removed. C345, and the notice period applies because this is a reduction |
| `CV7` | **Coverage lowered after booking** | `E2` in wave 5 | A session booked at 10% is still 10% when she pays for it, even though the pot now says 0%. A price somebody was shown is a price they are owed |
| `CV8` | **Coverage raised after booking** | `E1` in wave 4 | The same rule the other way, and it is allowed to be different: being asked for less than you agreed to needs no notice period |
| `CV9` | **The pot runs to nothing mid session-week** | `B4`, wave 4 | The booked session keeps its coverage, the next booking is offered the ordinary pay link, and the patient's screen says **ask HR**, not "payment error" |
| `CV10` | **Two employers at once** | `P5`, wave 4 `B2` | Exactly one pot pays per session, the same rule picks which every time, and **neither employer can learn the other exists**. The worst defect this run can find |
| `CV11` | **Where every pot cent went** | `E1-HR`, `OP` | `/admin/sponsors/<id>` lists one row per sponsored session with the share, the date and the clinician. **It names no patient.** If a patient's name is on that screen, stop and report it immediately under rule 3 of `00-START-HERE.md` |
| `CV12` | **The clinician is paid on the full price** | `T2`, wave 3 | A half-covered session is not a cheaper session. Her earnings screen shows the fee on $20, not on $10, and our cut is on $20 too |

---

## Group B · the transfer rail, where there is no processor

Nothing here has a webhook, a chargeback or an automatic anything. The row in `manual_payments`
is the only record that a person checked something.

| # | Case | Who | What must hold |
|---|---|---|---|
| `RA1` | **Paid and closed the browser** | `P6` Ziad, wave 3 | He opens the sheet, reads the account number, sends the money from his banking app and closes the tab without pressing Submit. The `awaiting_proof` row exists, the red bar is in his portal next time he opens the link, and he finishes from there |
| `RA2` | **Cancelled the payment** | `T3`, wave 4 | He opens the sheet for his lapsed bill, decides not to pay it this month, and presses **Cancel this payment**. The cart clears, the red bar goes, nothing is charged, and the invoices stay due. This is the same `T3` who lets the month lapse in `M2`, and the cancel is HOW he lapses rather than a separate scene. New in 76.34 and nothing has exercised it |
| `RA3` | **Confirmed twice** | `OP`, any wave | An operator presses Confirm, the page does not obviously change, they press it again. The second press moves no money, settles no second invoice and writes no second ledger leg |
| `RA4` | **A transfer with a reference nobody can find** | `E1-HR`, wave 4 `B3` | Rejected with a sentence in the operator's own words. HR reads that sentence **verbatim** |
| `RA5` | **Rejected twice** | `E1-HR`, wave 4 | The second rejection asks for fresh evidence rather than repeating the first |
| `RA6` | **Sent more than owed** | `T6`, wave 6 | His free month ended, so wave 6 is his first real bill. He transfers a round 1,000 EGP against 570. The operator can see the difference, the invoice settles, and the surplus is **not** silently kept: it is a line somebody has to decide about |
| `RA7` | **Sent less than owed** | `T3`, wave 4 | A part payment against a bill. The invoices it does cover settle oldest first, the rest stay due, and his screen says which |
| `RA8` | **Money with no claim at all** | `OP`, wave 4 | A bank line an operator cannot match to anything. `/admin/transfers` open carts is where they look, and the run must produce at least one such line for them to work |
| `RA9` | **A part payment of a chosen list** | `T3`, wave 4 | He picks four of eleven due invoices. The sheet says which four and the total is summed from what was found, never from what was asked for |
| `RA10` | **Two live claims for one thing** | `P2`, wave 1 | She opens the sheet twice. There is one open payment, not two, and an operator sees one amount |
| `RA11` | **The claim outlives the session** | `P2`, wave 1 | She transfers, the operator is slow, and she comes back an hour later. The receipt she uploaded is shown back to her, not an empty upload form. A payer who cannot tell whether it registered sends it again |
| `RA12` | **Confirmed after the session already ended** | `T3`, wave 4 | The money still settles and the books still balance. Nothing about the session changes |

---

## Group C · the plan, the seats and the month it stops being free

| # | Case | Who | What must hold |
|---|---|---|---|
| `PL1` | **Upgrade shows the details first** | `T2`, wave 4 | Tapping a tier card SELECTS it. The panel says the monthly figure, what happens to the per-session fee, how cancelling works and which rail takes the money, and only then is there a button that spends anything. New in 76.34 |
| `PL2` | **Confirm and pay lands on the account number** | `T2`, wave 4 | One act: the bill is raised and the sheet opens. Not a line item appearing somewhere further down a page |
| `PL3` | **Still metered until an operator confirms** | `T2`, wave 4 | The gap between sending the money and being on the plan is the design. His next session in that gap bills at the metered rate and he can see why |
| `PL4` | **Full price, no discount line** | `M1`, wave 4 | The single most important frame in the run |
| `PL5` | **Lapse demotes nobody** | `T3`, wave 4 | The obligation is never settled, it is marked lapsed, and `entitledTier` puts him back on metered by itself. No account is suspended |
| `PL6` | **A seat leaves mid month** | `S1`, wave 4 | The clinic's next bill is lower by exactly one seat and Dr Tarek lands on metered by himself |
| `PL7` | **A seat is added mid month** | `S2`, wave 4 | The quote for the days remaining is shown **before** she agrees, and that exact figure is billed. A quote that is not what happens is not a quote |
| `PL8` | **Cancel keeps the month** | `churn`, wave 5 | `T2` cancels and the month he paid for runs to its end. The screen says the date |
| `PL9` | **Downgrade to pay as you go** | `T6`, wave 6 | He never subscribed, so this is him being shown the choice and declining it: the confirmation panel says the AI fee applies and what it costs, and he presses **Not now**. Nothing is added to his cart |
| `PL10` | **Paying a bill twice** | `T6`, wave 6 | Two transfers against one bill, the second sent after the first was confirmed. It settles nothing and is visible to an operator as money with no claim |

---

## Group D · the rare ones, which are the reason anybody reads a list like this

Each of these happened to a real practice somewhere. None has ever been put to this product.

| # | Case | Who | What must hold |
|---|---|---|---|
| `RR1` | **The exchange rate moves between the quote and the transfer** | `P2`, wave 5 | She is quoted 570 EGP on Monday and sends it on Thursday after the operator changed the rate. What she owes is what she was quoted. The rate an operator edits must not reprice a claim somebody already acted on |
| `RR2` | **A free session** | `T3`'s radar arrivals | Price zero. No payment screen, no cart, no bar, no invoice, and the room opens |
| `RR3` | **A session is cancelled after the pot paid for it** | `E1`, wave 4 | The employer's share goes back to the pot, on the frozen figures rather than on today's percentage |
| `RR4` | **A patient in crisis with an unpaid session** | `P1`, wave 3 | **C235.** The SOS button works, the crisis line dials, and nothing about money is between her and it. If a payment sheet is ever on top of that orb, stop the run and report it |
| `RR5` | **The first completed session is free and the second is not** | `T6` and `P7`, wave 5 | The trial is the CLINICIAN's and applies once. `T6`'s first completed session raises no fee and his second bills at the metered rate. His billing screen says which was which, and `P7` is charged her session price either way: the trial is our fee, never her price |
| `RR6` | **A patient pays for a session that never happens** | `P4`, wave 5 | Therapist does not arrive. She has paid. Where that money goes and who tells her is the finding, whatever the answer turns out to be |
| `RR7` | **An employer pays for somebody who has left** | `B1`, wave 4 | Funding stops for anything not yet booked. The session already booked keeps what it was booked under, and she is told which |
| `RR8` | **A company's pot expires** | `E2`, wave 6 | The terms carry a date. What happens on it, and whether anybody was warned before it, read off HR's own screen |
| `RR9` | **Two bookings race one nearly empty pot** | `E1`, wave 4, during `B4` | `E1` covers `P3` and `P4`, so it is the only pot with two people on it. Both book within a minute of each other against a balance that can fund one. Exactly one is funded, the other is offered the ordinary link, and the pot is never overdrawn past its bound. C382: the guard is the debit, not the read before it |
| `RR10` | **A therapist with earnings held and a bill due** | `T1`, wave 4 | Her session fees come out of her own earnings rather than being billed as cash she owes us separately. She can see both halves and the netting between them |
| `RR11` | **A payout requested before a payout method exists** | `T1`, wave 3 | She can set where the money goes **before** she wants it, not at the moment she wants it. New in 76.34: the form used to appear only once there was money held |
| `RR12` | **A clinician sets the wrong country and corrects it** | `T5`, wave 4 | Dr Hala picks the United States on her way in, sees three Stripe steps she cannot complete from Cairo, and changes it to Egypt. The Stripe box disappears the moment she picks it and before she saves, the screen says the choice is not kept until she does, and what she already owes does not change. New in 76.34 |
| `RR13` | **A refund after a part payment** | `P5`, wave 6 | Apportioned on the split she was actually shown, never on a percentage that has since moved |
| `RR14` | **The books balance at the end of six months** | the money agent, wave 6 | Every transaction sums to zero, and the trial balance is read off the operator's own screen rather than queried |

---

## What to do when one of them breaks

Rule 5 of `00-START-HERE.md` holds: **a defect is not fixed during the run.** Write it down,
take the screenshot, carry on.

Two exceptions, both already in `00-START-HERE.md` and both likely to come from this file:

1. **`CV10` or `CV11` failing.** An employer learning which of their staff is in therapy is the
   disclosure the whole constraint set exists to prevent. Stop and say so immediately.
2. **`RR4` failing.** A patient in crisis blocked by anything to do with money. Same.

Everything else waits for the report.

---

## The twelve that a gate already holds

`npm run verify:edges` runs these against real rows on every gate pass, each with a planted
control so the check cannot pass by measuring the wrong thing:

`CV1`, `CV2`, `CV4`, `CV5`, `CV6`, `CV7`, `CV9`, `CV11`, `CV12`, `RA3`, `RR2`, `RR14`.

**Running the gate is not a substitute for walking them.** A verifier holds an invariant about
a row; it cannot tell you that the screen above that row does not say enough for a person to
act on. `CV9` is the example: the gate proves the pot refuses the spend and takes nothing, and
only a person can find out whether the patient's screen says "ask HR" or shows them a payment
error.

**And the thirty six that no gate holds are the point of this file.**
