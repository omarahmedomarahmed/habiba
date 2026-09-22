# Prove it: eight people, five positions, every promise walked

**This is the day. Eight testers on eight devices, five reseeds, and at the end of it every
promise in `docs/VALUE-STATEMENTS.md` has either been kept in front of a person or written
down as broken.**

Nothing here is a demo. A demo is somebody showing you the path they know works. This walks
the paths on purpose, including the three we already believe are dead ends, because a promise
is only worth what it is worth on the day it is tested by somebody who did not build it.

---

## Before anybody signs in

### The one rule

**Write down what the screen said, not whether it worked.** `DID / SAW / ROW`, the same rule
`docs/simulation/00-START-HERE.md` sets: what you did, what you saw, and the reference or id
if there was one. "Payment worked" is not evidence. "Pressed Submit, the sheet closed, the orb
went from amber to teal, reference TEST-SPLIT-01" is.

A step that passes gets written down the same as one that fails. A report that records only
the breakages is a report where nobody can tell "we checked and it was fine" from "nobody
looked".

### Two things stop the whole day

1. **A patient's name, session time or attendance appearing anywhere in the company portal.**
   That is the disclosure the entire constraint set exists to prevent. Stop, screenshot, say
   so immediately.
2. **Anything about money on top of the SOS orb.** C235 is that a patient's crisis path never
   depends on money. Same: stop and say so.

Everything else is written down and the walk carries on. A defect is not fixed during the run.

### Who sits where

Eight people, eight browsers. Two of them can be the same machine in a normal window and an
incognito one, but **no two of these may share a browser profile**: the six portals use six
different cookies and signing in as one does not sign you out of another, which is the
boundary working and also the easiest way to confuse yourself all day.

| # | Tester | Signs in at | Address |
| --- | --- | --- | --- |
| 1 | **Operator** (founder) | `/staff/sign-in` | `omar@24therapy.app` |
| 1b | **Support** (same person, second window) | `/staff/sign-in` | `staff.demo@example.com` |
| 2 | **Patient A**, Omar Ahmad | `/patient/login` | `mr.3omar.a7mad@gmail.com` |
| 3 | **Patient B**, Mariam | `/patient/login` | `mariam.demo@example.com` |
| 4 | **Dr Omar**, pay as you go, solo | `/login` | `omarabdelgawad001@gmail.com` |
| 5 | **Dr Sara**, clinic seat | `/login` | `dr.sara.demo@example.com` |
| 6 | **Dr Kareem**, clinic seat | `/login` | `dr.kareem.example@example.com` |
| 7 | **Clinic**, Nile Practice | `/clinic/sign-in` | `habibaheikal27@gmail.com` |
| 8 | **Company**, Habiba Holdings | `/sponsor/sign-in` | `habiba@24therapy.app` |

One password for every one of them: `Demo2026!Therapy`.

🔴 **1b is not a ninth person.** It is the operator's second window, and it exists because
`/security` promises that a role is a list rather than a rank. The only way to see that is to
be refused by it, and until today the cast had one console account and it could open
everything.

🔴 **Three of these cannot receive email.** Dr Sara, Dr Kareem and Mariam are at
`example.com`, which RFC 2606 reserves so a message that escapes a test reaches nobody. They
sign in with the password like everybody else. **Anything you want to check arriving in an
inbox has to be walked on Patient A, Dr Omar, the clinic, the company or the operator**, who
are the five real addresses.

### Reseeding between positions

```
npm run on:production -- seed:demo   -- --scenario=<name>
npm run on:production -- verify:demo -- --scenario=<name>
```

**Everybody signs out first.** The seed deletes people, and a browser holding a cookie for a
row that no longer exists is a session that fails in ways nothing in this document describes.

**Run `verify:demo` every time, with the same name.** It is the only thing that proves the
reseed did what was asked: it checks the coverage, the pot, the enrolments and the rows that
make that position different from the other four. Told the wrong name it goes red, which is
the useful answer rather than a nuisance.

The five, in order. Do not skip ahead: `live` is the flow every other position assumes works.

| | Position | What it puts the product into |
| --- | --- | --- |
| 1 | `live` | A clinician invites a patient to a paid session, and they meet |
| 2 | `money` | The covered employee, the part payment, and money nobody can match |
| 3 | `continuity` | A record moving between clinicians, and one nobody has claimed |
| 4 | `crisis` | Somebody in trouble with an unpaid bill, and every dead end |
| 5 | `growth` | A practice taking somebody on, a pot running dry, a seat leaving |

---

# Position 1 · `live`

```
npm run on:production -- seed:demo   -- --scenario=live
npm run on:production -- verify:demo -- --scenario=live
```

**Proves `P1` `P2` `P3` `T1` `T2` `T4` `A1`.**

Every part of this was broken on production inside the last week. The patient was told
nothing, the pay link asked a signed-in person their own name, and the room threw a
client-side exception the clinician could not read. This walk is the proof that it is not.

### 1 · Patient A, before anybody touches anything

Sign in at `/patient/login`. **Do not navigate.**

The seed has left a session ten minutes away, priced and unpaid, and the invitation written
into the app.

- An **amber orb** in the bottom right, above the tab bar. A banknote, meaning money is owed.
- The invitation in the notifications list, not only in an email.

Now open a second tab of the app, then a third page inside it. **The orb has to be on all of
them.** It is drawn by the chrome rather than by each page, because a page that forgets it is
a page somebody opens on the evening of their appointment to find the product has lost it.

> **Proves `P2`, first half.** Write down: was the orb there before you navigated anywhere?
> Was it on every screen?

### 2 · Patient A, opening the payment

Tap the orb. It opens the payment sheet.

- **It must not ask your name.** You are signed in and it knows who you are. It should say
  "Joining as Omar" and nothing else about identity. This was broken last week.
- The line items say what is being paid for: the session, and VAT as its own line.
- The figure in dollars and the figure in pounds are both there.

Now **close the tab without submitting.** Open the app again.

- The amber orb is still there.
- Opening the sheet again shows you the same payment, not a fresh empty one.

> **Proves `RA1`**, paid and closed the browser, which is the most ordinary thing a person
> does on a payment screen and had never been walked. The seed deliberately writes no payment
> row: the sheet prices itself, so a seeded one would be a figure this repository invented
> sitting in front of an operator.

Read the account number, then press **Submit** with the reference `LIVE-01`.

> **Proves `T4`, second half.** Write down the two figures exactly.

### 3 · Operator, and the control before it

**First, ask Patient A to reload.** The orb must still be amber and the session must not be
joinable. That is the control: nothing has been granted yet.

Now `/admin/transfers`. The payment from step 2 is in the queue with reference `LIVE-01`.
Press **Confirm**.

> **Proves `A1`.** There is no processor behind this rail. Nothing is granted until a person
> presses that button, and you just watched the before and the after.

### 4 · Patient A, after the confirmation

Reload.

- The orb is **teal** now, and the shape is a door rather than a banknote.
- A payment confirmation is in the app's notifications, not only in an email.

> **Proves `P2`, second half.**

### 5 · Dr Omar starts the session

`/login`, open Omar Ahmad, start the session. Watch the console if you can. There should be
no "Use after destroy", no "already joined meeting", and no client-side exception.

Reload the room page once while you are in it. It has to come back, not break.

### 6 · Patient A joins, counting

The orb now has a **red dot** on it, which is the only moving thing on the screen. A session
that has started is the one state where a minute matters.

From the app's home screen, count the taps out loud until you are looking at Dr Omar.

> **Proves `P1`.** We say three taps on `/for-patients`. Write down the real number. If it is
> more than three, the number is the finding and the page is the thing that changes.

### 7 · Both of you, off the record

Dr Omar presses off the record. Say something distinctive out loud, both of you, for about a
minute: **"the cat is on the roof"** is fine and is easy to search for afterwards.

Back on the record. Carry on for a minute or two so there is something either side of the
hole.

> **Proves `T2`.** Checked in step 9, not now.

### 8 · Dr Omar ends it

End the session. The draft note should be there **before you stand up**, built from what was
said rather than from a template.

- It says **draft** on it.
- Search the transcript for "cat" and for "roof". **Neither may be there.** Search the note
  for anything about the minute you took off. It must not be there either.

> **Proves `T1` and `T2`.**

### 9 · Patient A, before the note is signed

Open the session in the app **now**, while Dr Omar still has it unsigned.

It must say the therapist is still writing the summary. **It must not show you a draft.**

> **Proves `P3`, first half.** Nothing written by a machine reaches a patient unsigned.

### 10 · Dr Omar signs it

Sign the note and release the summary to the patient.

### 11 · Patient A reads it

The summary is there, and it carries **a clinician's name and their credentials**. Not
"24Therapy", not "your therapist", a person.

> **Proves `P3`.**

### 12 · Dr Omar invites a stranger

Open Laila Demo's chart. She has a record, a session behind her and no account. Send her the
session invitation.

Take the link and open it in a **fresh incognito window**, signed in as nobody.

**It must ask for a name.** That is the asymmetry: the same link, opened by the patient it
belongs to, asks nothing, and opened by a stranger, asks who they are.

> **Proves `T4`, first half.** Both halves of one promise, walked twice, in two windows.

---

# Position 2 · `money`

```
npm run on:production -- seed:demo   -- --scenario=money
npm run on:production -- verify:demo -- --scenario=money
```

**Proves `E1` `E2` `E3` `T3` `A2` `A3` `A4`.**

The company now covers **10 per cent** rather than 60, because at 60 the two wrong answers
are close enough that a person reads past the difference. Two people are on one pot. An
unmatched bank line is sitting on the operator's queue.

This is the path with the most moving parts in the product. Sprint 76 found four defects in
it in one afternoon, and every one of them was invisible to the gate that claimed to cover it.

### 1 · Company, and the wall

`/sponsor`. Open **every screen in the portal, one at a time.** The pot, the spend, the
people, the settings, the integrations page.

Write down, for each one:

- Is there a patient name on it?
- Is there a session time or a date a session happened?
- Is there anything that could be read as an attendance list?

> **Proves `E1` and `E2`.** 🔴 **If a patient name appears anywhere, stop the whole day.**

The balance you are shown is a **published** figure rather than a live one, and it only moves
once five sessions have gone by. That is deliberate: a balance that moved after every session
is a balance an employer can difference to work out that somebody went this week.

### 2 · Operator, the same wall from our side

`/admin/sponsors/<id>`. One row per sponsored session: the share, the date, the clinician.

**It names no patient.** Same rule, and this is the screen where it would be easiest to leak
one, because we can see everything.

> **Proves `E1`, second half.**

### 3 · Patient B books a covered session

Mariam, `/patient/login`. Book an hour with Dr Sara from the app.

The price screen must show three numbers and you must write all three down:

| | |
| --- | --- |
| The company's share | 10 per cent of the price |
| Her share | the other 90 per cent |
| VAT | **14 per cent of her 90, never of the price, and never zero** |

> **Proves `CV1` and `CV4`.** The VAT was derived by subtraction once, which is negative on a
> part payment, which clamps to zero. Tax we hold and genuinely owe, recorded as nothing.

### 4 · Patient B opens the sheet

The figure the payment sheet asks for must equal the figure on the price screen **to the
cent, in both currencies**.

> **Proves `CV2`.** This is the one that was wrong: the screen said $22.80 and the charge was
> $11.40.

Leave the sheet open. Do not submit yet.

### 5 · Company changes its mind

`/sponsor`. Move coverage from 10 per cent to 60 while Mariam's session is booked and unpaid.

### 6 · Patient B reloads

Reload the sheet.

**It must still ask for 90 per cent.** The session was booked at 10 and that is what it stays
at. The next one she books is offered at 60.

> **Proves `E3`.** A price somebody was shown is a price they are owed.

### 7 · Patient B pays

Submit with the reference `SPLIT-01`.

### 8 · Operator confirms, twice

`/admin/transfers`. Press **Confirm**. The page will not obviously change.

**Press Confirm again.**

Then `/admin/vault`. There must be:

- exactly one cash leg for the money,
- exactly one `vat_payable` leg, for the tax on **her share**,
- and no second copy of either.

> **Proves `A2`.** Read the legs off the screen rather than querying them.

### 9 · Operator, money with no claim

`/admin/transfers`, the open-carts tab. The seeded line `CIB-TRX-4471902` is there: money that
arrived and matches nothing.

Work it the way you would on a real morning. Write down whether the screen gives you enough to
decide anything.

> **Proves `A4`, second half.** This tab has never had a row in it, so nobody has ever used it.

### 10 · Dr Omar pays part of his bill

`/login`, his billing screen. He is on **pay as you go**: a dollar for the room and three for
the note, raised on every session, and he has nine of them.

Pick **four** invoices out of the list and open the payment.

- The sheet says which four.
- The total is the sum of the four that were found, never a figure typed somewhere else.

> **Proves `RA9`.**

### 11 · Dr Omar sends too much

Transfer a **round number bigger** than the four came to. If they came to $16, send $20.
Submit with the reference `OVER-01`.

### 12 · Operator confirms the overpayment

Confirm it.

- The four invoices settle.
- The difference is **visible to you as a line somebody has to decide about.**
- It is not silently kept.

> **Proves `A4`, first half.** Write down exactly what the screen said about the surplus. If it
> said nothing, that is the finding.

### 13 · Operator rejects one

Open any waiting payment and **reject** it with a specific sentence in your own words. Make it
specific enough to act on, for example: *"The reference on the screenshot is NBE-99120 and
nothing with that reference reached the account. Send the bank's own receipt rather than the
app screen."*

### 14 · The payer goes looking for it

Whoever you just rejected signs in and looks for that sentence.

**Read it back verbatim.** Write down where you found it and how long you spent looking.

> **Proves `A3`.** 🔴 Task 124 says this is currently a dead end and nobody is told at all.
> Both cannot be true. Find out which.

### 15 · Dr Omar's earnings

His earnings screen. Held earnings on one side, what he owes on the other, and the netting
between them.

> **Proves `T3`.** What you owe comes out of what you earn before it reaches your account.
> That is the true version of the claim `lib/content/honesty.ts` refuses, and it is a genuinely
> good property, so it has to actually be on the screen.

### 16 · Dr Sara was paid on the full price

Dr Sara's earnings, and the clinic's view of them.

A half-covered session is **not a cheaper session**. Her fee is on the whole price, and our
cut is on the whole price too.

> **Proves `CV12`.**

---

# Position 3 · `continuity`

```
npm run on:production -- seed:demo   -- --scenario=continuity
npm run on:production -- verify:demo -- --scenario=continuity
```

**Proves `P3` `P4` `T5` `C2` `C5`.**

Portability is the claim the whole patient site rests on, and it is the one thing that cannot
be shown on a database where everybody saw one person. Tarek's record has two versions by two
clinicians at two practices, and a third clinician is waiting on his answer.

For this position **Patient B signs in as Tarek**, `tarek.demo@example.com`. Same password.

### 1 · Tarek reads his own record

`/patient/login`, the Record tab.

**Two summaries**, each under its author's name:

| Version | Written by | At |
| --- | --- | --- |
| 1 | Dr Omar Abdelgawad | Cairo Counselling |
| 2 | Dr Sara Demo | Nile Practice |

The first one is not deleted, edited or replaced. It is still there, and it still says who
wrote it.

> **Proves `P4`, first half.** Every version of your summary stays, under its author's name.

### 2 · Tarek answers a request

There is a request from **Dr Kareem** waiting on his screen. Read what it asks for, and what
it says he would be able to see.

Grant it.

### 3 · Dr Kareem asks the copilot

`/login` as Dr Kareem, open Tarek, ask the copilot something about him.

The answer has to carry **the sentence it came from**, attached to the answer, from a session
you can open.

> **Proves `T5`, first half.** It puts what it read in front of the clinician with the source
> attached. It does not talk to the patient and there is no screen in the patient app that
> types to a model.

### 4 · Tarek takes it back

Revoke Dr Kareem's grant.

### 5 · Dr Kareem asks again, and somebody times it

Ask the copilot the next question. **Time it.**

It has to stop **now**, not at the end of the session and not tomorrow.

> **Proves `T5`, second half.** "Take it back and it stops that second" is on the public page.
> Write down the actual gap in seconds.

### 6 · Dr Sara is unaffected

Dr Sara still has her own grant and it was never touched. She can still read the history.

> **Proves the separable half of `P4`:** grant each separately, take either back on its own.
> A psychiatrist and a therapist on one record is the same mechanism.

### 7 · The clinic looks at its own people

`/clinic/sign-in`. Open every screen.

- **Is there a caseload count anywhere?** A number of patients per clinician, on any row.
- **Is there a patient name anywhere?**

Then find earnings per clinician, which there must be, because the practice pays them.

> **Proves `C2` and `C5`.** The practice pays its clinicians; it does not supervise their
> patients, and the portal is built so it cannot.

### 8 · Dr Omar invites somebody who has never been here

Laila Demo's chart. She has a record, a session, an email and no account, and she has never
claimed it.

Send her the claim invitation.

### 9 · Somebody walks the claim

Open the link in a fresh incognito window.

**It asks two questions before letting anybody in**, because a phone number is not a person.

Write down what the two questions were, and whether somebody who is not Laila could answer
them.

### 10 · The operator goes looking for her

`/staff/sign-in`. **Find Laila's stuck state from the console.** She has a record, she was
invited, and she has not got in.

Write down how long it took and which screen you used.

> 🔴 **This is the honest gap and it is expected to be hard.** There is no screen in the
> console that lists blocked people. Tasks 163 to 167 are that work and they are Phase 1. If
> you find her quickly, say how, because that changes what gets built.

---

# Position 4 · `crisis`

```
npm run on:production -- seed:demo   -- --scenario=crisis
npm run on:production -- verify:demo -- --scenario=crisis
```

**Proves `P5` `A3` `A5`.**

Half of this position is a promise and half of it is an audit of the ways this product
currently strands a person. Both halves get walked, and the second half is the more useful
one.

### 1 · Patient A, owing money, minutes from a session

Sign in. Amber orb, session ten minutes out, nothing paid.

### 2 · The one that stops the day

Open the payment sheet so there is money on the screen. Now find and press **SOS**.

- The crisis button is **reachable**.
- It is **on top** of the payment orb and on top of the sheet.
- It dials **105** without passing anything about money, without asking for a payment, and
  without a sign-in wall.

> **Proves `P5` and `RR4`.** 🔴 **If a payment sheet is ever on top of that orb, stop the day
> and say so.** The two orbs agree on a stacking order on purpose and it is written down in
> both files; this is the walk that finds out whether the rule survived contact.

### 3 · Patient B and the rejected transfer

Mariam signs in. The seed has left a **rejected** transfer on her side, with a real sentence
on it from an operator.

Go and find it. Do not be helped.

Write down: where it was, how long it took, and whether the sentence was there word for word.

> **Proves `A3`.** 🔴 Task 124 says a rejected transfer is a dead end and nobody is told. This
> is the walk that settles it.
>
> 🔴 **And it is seeded in the most favourable form.** `paymentsFor` returns nothing at all for
> a `session` payer, which is what `/pay/:token` writes for a guest, so a guest genuinely cannot
> be told. This rejection is written against her patient ACCOUNT, which is the one shape the
> product could show her. If she still cannot find it, the dead end is wider than task 124 says.

### 4 · The operator's side of the same rejection

Find that rejection in the console.

- Can you tell whether she has seen it?
- Is there a way to tell her again?
- Is there a clock on it, so somebody would notice it ageing?

Whatever the answers are, write them down. All three are Phase 1 questions.

### 5 · The clinician who is waiting

Sign in as `dr.yasmin.example@example.com`. Her portal is empty and that is deliberate: it is
the screen between applying and being let in.

- Does it say **what she is waiting for**?
- Does it say **how long it should take**?
- Is there anything at all she can do?

> A wait with no promise on it is one of the three shapes of "stuck" that `verify:machines`
> looks for in the lifecycles. This is what it looks like to the person doing the waiting.

### 6 · Support is refused, and that is the product working

Sign in at `/staff/sign-in` as **`staff.demo@example.com`**, in the operator's second window.

Try to open, one at a time:

| | |
| --- | --- |
| `/admin/actuals` | what the company earned and spent |
| `/admin/benefits` | the employer side |
| `/admin/radar` | the board of who is online |
| the founders' board | |
| the error log | |

You should be **redirected**, not shown an error and not shown the page.

> **Proves `A5`.** A role is a list, not a rank. Until today the cast had one console account
> and it could open everything, so this boundary had never refused anybody.

### 7 · The support ticket nobody can answer

As the operator, open the support ticket from Laila: her claim link expired and she is asking
for another.

**Can you send her one from the console?**

> Task 105 says no: every automated email is sent from a shell rather than from the console.
> Confirm it or disprove it, on the real screen.

---

# Position 5 · `growth`

```
npm run on:production -- seed:demo   -- --scenario=growth
npm run on:production -- verify:demo -- --scenario=growth
```

**Proves `C1` `C3` `C4` `E4` `E5`.**

The pot was funded with **one hundred dollars** against six covered sessions that wanted two
hundred and seventy, so it genuinely ran out partway through its own history. That is not a
balance somebody typed: `payFromPot` refused the spend and the sessions it refused are still
unpaid.

### 1 · Company reads an empty pot

`/sponsor`. The balance is a figure that cannot fund another session.

Does the screen say so, in words, before somebody finds out by booking?

### 2 · Patient B books against it anyway

Mariam books an hour with Dr Sara.

- The pot takes **nothing**. Not a partial spend, not an overdraft past its bound.
- She is offered the **ordinary pay link**.
- Her screen says **ask HR**.

> **Proves `E5` and `CV9`.** 🔴 The gate already proves the pot refuses the spend and takes
> nothing. Only a person can find out whether her screen says "ask HR" or shows her a payment
> error, and that is the whole difference between a product and a database.

### 3 · Company sets coverage to zero

`/sponsor`. Move the slider to **0 per cent**. **Do not remove anybody.**

### 4 · Patient B is still an employee

Mariam reloads.

- She **keeps her badge**.
- She **keeps her place on the roster**.
- She owes the **whole price**.
- **No screen says she was removed**, because she was not.

> **Proves `E4` and `CV6`.** C345. Zero is a price, not a deletion, and the notice period
> applies because it is a reduction.

### 5 · Company tops the pot back up

Walk the top-up stepper. Read what it says the money is for, and submit.

### 6 · Operator confirms it

Confirm. The pot is funded, and the ledger has the leg behind it rather than a number that
moved on its own.

### 7 · The clinic takes somebody on

`/clinic/sign-in`. Add **Dr Yasmin** to a seat.

**The quote for the days remaining in the month is shown before you agree**, and that exact
figure is what gets billed. A quote that is not what happens is not a quote.

Write the quoted figure down.

> **Proves `PL7`.**

### 8 · Operator lets her in

`/admin/verifications`. Dr Yasmin's application is waiting. Approve it.

### 9 · Dr Yasmin arrives

Sign in as her. The empty screen from position 4 is no longer empty.

Then open the **public radar** in a window signed in as nobody.

**Is she on it?** We say the same hour.

> **Proves `C1`.** Write down the gap between the approval and the dot appearing.

### 10 · The clinic lets somebody go

Release **Dr Kareem's** seat.

### 11 · Dr Kareem keeps working

Sign in as him.

- He can still see his patient and still hold a session.
- He is on **pay as you go** now, by himself.
- **Nobody suspended him** and no account was locked.

> **Proves `C4` and `PL6`.**

### 12 · The clinic's next bill

`/clinic`, the billing screen.

- **One bill for the practice**, not one per clinician.
- Lower by **exactly one seat** than it was.
- The seats on it are the seats that were actually filled.

> **Proves `C3` and `C4`.** Check the arithmetic against the quote you wrote down in step 7.

### 13 · Two bookings race one pot

The last one, and it needs two people at once.

Both Patient A and Patient B are on the company's pot in this position. Top the pot up to
about **one session's worth of coverage** first, or drain it to there.

**Both book within a minute of each other.**

- Exactly **one** is funded.
- The other is offered the ordinary link.
- The pot is **never overdrawn past its bound**.

> **Proves `RR9`.** C382: the guard is the debit, not the read before it. Two people pressing
> a button at the same second is the only way to find out which one this product actually does.

---

## When the five are done

Two things, in this order.

**1. The report.** One row per step, every position, including the ones that passed. The
statement id, what you did, what you saw, and `held` or `broke`. `docs/VALUE-STATEMENTS.md` is
the list of ids and nothing else needs to be invented.

**2. Put the cast back the way the next person expects it.**

```
npm run on:production -- seed:demo   -- --scenario=live
npm run on:production -- verify:demo -- --scenario=live
```

`live` is the everyday position and the one `docs/DEMO-LOGINS.md` describes. Leaving the
database on `growth`, with a dry pot and a released seat, means the next person to open a
portal finds a product that looks broken and is not.

🔴 **And the undo, if a reseed ever goes wrong.** The Neon snapshot
`br-nameless-dust-a6ae5e4r` holds production as it stood on 2026-09-20.
`docs/NEON-BRANCHES.md` says what it is and what it is the only copy of.

---

## What this day cannot prove, said plainly

Three things, so nobody reads a green report as a bigger claim than it is.

1. **Nothing here proves the product works for a stranger.** Every person in this walk is
   seeded, with history behind them and a password somebody wrote down. The sign-up paths are
   walked in Cycle 5 and not here.
2. **Nothing here proves anything about Arabic or about a 390px phone.** That is Cycle 9. The
   whole of this document is English on a laptop and two phones.
3. **Nothing here proves the product recovers.** Every step above assumes the thing being
   pressed works. Deliberate failure, and what the screen says when it happens, is Cycle 8.
