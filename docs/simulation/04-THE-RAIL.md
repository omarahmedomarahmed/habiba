# How money reaches us in Egypt

**Handed to the payments operator.**

There is no card rail. `topUpPot` refuses `entity = 'eg'` and it is right to: we cannot take a
corporate card payment into an Egyptian entity that does not exist yet.

The consequence nobody had costed is that the **entire Egyptian go to market had no way to pay
us.** Three companies, a practice, seven clinicians and every patient behind them. So the
fallback is not a stopgap. Until a gateway arrives it **is** the rail, and this document is how
the run exercises it.

**Most money in Egypt moves by transfer anyway.** Building it properly means the product works
on day one rather than waiting on a licence.

---

## The one sentence the whole thing rests on

> **Nothing happens until a person confirms it.**

There is no processor, no webhook, no chargeback. `manual_payments` is the only record that
anybody checked anything. An unconfirmed transfer is a **claim**, and a product that acts on a
claim about money can be robbed by typing a plausible reference number.

The cost of that ruling is a patient staring at a waiting screen, and it is paid on purpose. The
waiting screen is designed to be closed and come back to.

---

## The rail starts shut, on purpose

Three facts decide who is on it, and **the run starts with all three wrong**, because that is
how a real Tuesday starts.

| What | Where | Who |
|---|---|---|
| The bank details | `/admin/settings` | the payments operator |
| A company's entity: `us` to `eg` | `/admin/sponsors` | the payments operator |
| A practice's region: `us` to `eg` | `/admin/clinics`, or the clinician's own `/settings` for a practice of one | an operator, or the clinician |

Until the first is done, every payer sees **"not on the system yet"**, which is the correct
screen and a terrible one to leave up. Until the second and third are done,
`sponsorNeedsTransfer` and `organizationNeedsTransfer` are false and everybody is offered a card
form that would refuse them.

**The details are not seeded.** A seeded bank account is a bank account committed to a git
repository, and it skips the one screen the whole rail depends on. An operator types the real
ones in on camera, in wave 1, and every empty screen fills in behind them.

**And the details cannot be edited while anybody is mid transfer.** `detailsLockedBy` counts what
is in flight and the save is refused with the count in the message. Changing an account number
while eleven people are transferring against it sends eleven real payments into an account nobody
is checking. **The run must try this and be refused**, in wave 4, while `B3` is in the queue.

---

## The three payers, and they are genuinely different

| Who | Pays for | `ref_id` | What a confirmation does |
|---|---|---|---|
| A **patient** | one session | the session | `sessions.payment_status` flips to `paid`, which is the column the join gate already reads. Their screen goes from waiting to the session |
| A **therapist or practice** | their whole bill | the organisation | Every due invoice is settled oldest first, and the renewal obligation is settled, **which is what actually puts them on a plan** |
| A **company** | its pot | the sponsor | The balance goes up and their staff can book against it immediately |

### The patient is a guest, and the payer is the session

Somebody finds a therapist on the radar at eleven at night, is handed a join link, and is asked
for money. **They have no account and may never make one.** Asking for one before a crisis
session would be the wrong trade, so the payer kind is `session`: no account id at all, and a
`ref_id` that must be present. The session carries the therapist, the price, the time and the
token they held, which identifies them as precisely as anything can.

`P6` Ziad is this person, three times, and he never signs up.

### A therapist's transfer settles the whole bill, not one invoice

The card rail already puts every outstanding invoice into one checkout. One invoice per transfer
would mean a metered therapist making six bank transfers of $4 and an operator matching them by
hand. So the transfer clears the lot, oldest first, and **stops rather than part paying one**: a
half settled invoice is a number two systems disagree about.

---

## What a payer sees, in order

1. **The account details**, with the heading chosen for them. A patient and a therapist read
   **InstaPay / Bank Transfer**, which is the rail they use from their phone. A company's finance
   team reads **Bank Transfer**, because they would be puzzled to file something against a
   consumer brand. Same account underneath.
2. **What to send, in pounds.** Every price in this product is dollars and every payer here sends
   pounds, so the conversion happens once, on the server, at a rate an operator sets and can
   change the afternoon the pound moves. It is stored on the payment beside what it settles, so a
   row can always be read back against the rate that priced it.
3. **"Card payments coming soon"**, under the details, until the day they are.
4. A **reference**, a **receipt**, or both. One of the two is required: neither is unverifiable
   and wastes an operator's afternoon, and demanding both turns away somebody whose banking app
   shows a reference but will not export a receipt.
5. **The waiting screen, which says they may close the page.** Said explicitly, because the
   instinct is to sit and stare at it, and a person who waits is the one who decides this is
   broken. It polls, so the moment an operator confirms, their page moves on by itself.

### The company is the one that types an amount, and it types dollars

A session and an invoice cost what they cost. A pot is the one place the payer chooses, and the
field is in dollars because that is what a pot holds, what the minimum is quoted in, and what the
coverage arithmetic is done in. The screen says the rate underneath, so the finance team is not
converting in their head at a rate we have not agreed to.

---

## What the operator sees, and what they must not do

`/admin/transfers`, oldest first, with the count in the nav badge. Each row carries:

- **what they sent**, in pounds, because that is the line in the bank statement
- **what it settles**, in dollars, beside it in grey, because that is what we will credit
- the **reference**, selectable, because they are searching for it on a second screen
- the **receipt**, opening in a new tab through a route that audits the read
- **how long they have been waiting**, in red past fifteen minutes

Two buttons: **Confirm**, and **Reject**, which is disabled until a reason has been typed.

**There is no third button, deliberately.** An operator cannot edit an amount and cannot reopen
a decision. A record that can be edited after the fact is not a record of what happened.

---

## The seven things the run must put through it

| # | Wave | What | The property |
|---|---|---|---|
| `R1` | 1 | The operator types the bank details in, and moves everybody onto `eg` | Screens that said "not on the system yet" fill in |
| `R2` | 2 | `E1` Cairo Foundry funds its pot by transfer | The pot does not move until Confirm. **Watch the balance before and after** |
| `R3` | 2 | `P2` Salma pays for a session by transfer | She joins the session **the moment** the operator clears it, without reloading |
| `R4` | 3 | `P6` Ziad pays as a guest, with no account at all | The payer is the session. He never signs up, three times |
| `R5` | 4 | `T2` subscribes by transfer | No checkout. A bill, a transfer, and **he is metered until it is confirmed** |
| `R6` | 4 | `B3`: a transfer that never arrives is rejected with a reason | HR reads that reason **verbatim** and sends a real one |
| `R7` | 4 | The details are edited while `R6` is in the queue | **Refused, with the count in the message** |

### And one that is an absence

`R8`: at no point in the run does anybody's balance, plan or session move **before** an operator
pressed Confirm. The money agent checks this at the end of every wave by comparing confirmation
timestamps against the thing they unlocked.

An absence assertion, so it needs its control: `R2` is watched moving the pot **after** a
confirmation, so a check that would pass because nothing ever moved cannot hide here.

---

## What the run should find, if it is honest

This rail has never carried a real payment. The things most likely to be wrong are the ones
nobody has stood in front of:

- A payer who **closes the tab and comes back**, and whether their claim is still there.
- A payer who presses **"I have paid" twice** on a slow connection.
- An operator who **confirms twice**, quickly.
- A receipt that is a **6 MB photograph** taken on a phone on Egyptian mobile data.
- A patient whose session was **cancelled while the transfer was being checked**.
- **Arabic on every one of these screens**, which is the language the person paying reads.

Each of those is a paragraph in the dev log if it goes wrong, and one line in the report if it
does not.
