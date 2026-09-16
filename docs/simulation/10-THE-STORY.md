# The story, the people in it, and who knows whom

**Everything the other ten files leave to an agent's imagination.** The cast says who each
person is and what they exist to prove. This says what they are actually going through, week by
week, for six months, and which facts are planted where.

---

## 🔴 Why this file is not decoration

`07-THE-EXAM.md` asks the copilot four questions whose answers live in four different months:

> `R1` What did he say in his **first** session?
> `R2` What did he write in his **journal** in month 3?
> `R3` What did his therapist conclude in the note from **month 4**?
> `R4` What has changed between month 1 and now?

**None of those is scoreable unless somebody decided in advance what the answer is.** A run
where twenty agents improvise sixty two sessions produces a record nobody can mark: `R1` has no
right answer, `R4` has no direction, and the exam reports a number that means nothing.

So each person below has an **arc**, and inside each arc are **planted facts**: specific,
checkable, deliberately unremarkable details placed in a named session. The exam marks against
them. An agent playing that person reads their row and says those things.

**And they are all invented.** Nobody below is a composite of a real person, a real case or a
real presentation. They are ordinary clinical shapes, written for this file, because a
simulation of a therapy platform needs sessions with something in them and the alternative is
sixty two conversations about the weather.

---

## The story, in one page

**Month 0.** Two clinicians and nobody else. Dr Amira has a practice of one in Cairo and no way
to be paid except by hand. Dr Karim in Alexandria sits on the radar at night and takes whoever
arrives. Layla finds him at eleven at night with no account at all, has a session in Arabic, and
only afterwards decides she wants to keep the record. Salma books Dr Yassin the ordinary way,
through a calendar, and discovers that paying for therapy in Egypt means a bank transfer and a
wait. Dr Omar is rejected twice and his documents are deleted.

**Month 1.** Nile Practice opens with three seats, and Dr Amira gives up her own subscription to
take one of them. Cairo Foundry becomes the first employer to put money behind its staff, at
100%, and Mostafa starts coming every week because nothing stops him. Hoda tries to enrol with
a staff number the employer's system has never heard of, is refused, and gets in with her work
email instead.

**Month 3.** Alexandria Textiles arrives at 10%, which is the number that makes the arithmetic
visible: their employee Nadia pays most of it herself. Ziad has three sessions and never once
makes an account. Helio Health starts opening sessions through the API. Layla revokes Dr Karim's
access to her record, and it stops that second.

**Month 4. The month everything is about.** The beta ends. The first full price invoice goes out
with no discount line on it. Dr Yassin subscribes and pays by bank transfer and is still metered
until a person confirms the money. Dr Karim looks at $80 and lets it lapse. Cairo Foundry's pot
runs to nothing mid month and Mostafa's screen tells him to ask HR rather than showing him a
payment error. Nadia is hired away by Delta Logistics and, for one week, two employers are
paying for her and neither can learn the other exists.

**Month 5.** Dr Yassin cancels, which is the single most important observation in the run and is
one observation rather than a rate. Dr Sameh joins, never subscribes, and proves that a
clinician under twenty sessions a month is right to stay metered.

**Month 6.** Nothing new happens. Six months of rows are read back: the books, the copilot exam,
the fitted cost model, and what a founder could have seen from one screen the whole time.

---

## Who knows whom

```
                          NILE PRACTICE  (C1, 3 seats)
                          ┌──────────────────────────────┐
                          │  C1-M Hana ·  practice manager│  sees schedules and bills
                          │  C1-S Fatma · staff, delegated│  some powers, not others
                          ├──────────────────────────────┤
   T1 Dr Amira ──────────▶│  seat 1   (joins in month 1) │  her patients follow her
   C1-A Dr Tarek ────────▶│  seat 2   (leaves in month 4)│  his notes stay with the practice
   T4 Dr Omar ───────────▶│  seat 3   (still gated)      │  invited ≠ licensed
                          └──────────────────────────────┘

   SOLO, NEVER IN A PRACTICE
   T2 Dr Yassin   · subscribes by transfer m4, cancels m5
   T3 Dr Karim    · the radar. Lapses in m4 and stays lapsed
   T5 Dr Hala     · joins m4. One free month, then full price
   T6 Dr Sameh    · joins m5. Never subscribes at all

   PATIENTS, AND WHO THEY SEE
   P1 Layla   ──▶ T3 Karim                    (revokes his access in m3)
   P2 Salma   ──▶ T2 Yassin, then T1 Amira    (asks for her history to follow her)
   P3 Mostafa ──▶ T1 Amira, then C1-A Tarek   (two clinicians, one record)
   P4 Hoda    ──▶ T1 Amira, then T4 Omar      (once he is finally approved)
   P5 Nadia   ──▶ T2 Yassin, then T5 Hala
   P6 Ziad    ──▶ T3 Karim                    (three times, no account, ever)
   P7 Yousra  ──▶ T6 Sameh

   WHO PAYS FOR WHOM
   E1 Cairo Foundry     100% ──▶ P3 Mostafa, P4 Hoda        (empties in m4)
   E2 Alexandria Tex.    10% ──▶ P5 Nadia                    (drops to 0% in m5)
   E3 Delta Logistics        ──▶ P5 Nadia, from m4           (hires her away)
   nobody                    ──▶ P1, P2, P6, P7              self pay, every time

   🔴 P5 IS ON E2 AND E3 AT ONCE FOR ONE WEEK IN MONTH 4.
   Exactly one pot pays per session, and neither employer may learn the other exists.
   If one line of that is wrong it is the worst defect this run can find.
```

### The connections that are tested rather than described

| Connection | Tested by | And it must fail where |
|---|---|---|
| `C1-M` Hana to any clinical note | wave 2 | **She must fail.** A practice manager sees schedules and bills and never a note |
| `E1-HR` Dalia to who attended | wave 2 and 4 | **She must fail.** She sees money and never a name |
| `C1` the practice to `T1`'s existing patients | wave 2 | They follow her; the practice still never sees their notes |
| `T4` Dr Omar to a patient, while invited but unlicensed | wave 2 | **He must fail.** An invitation is not evidence of a licence |
| `P1` Layla to `T3` after she revokes | wave 3 | **He must fail**, that second. The notes he already wrote stay his |
| `D1` Helio Health to any patient it did not bring | wave 3 | **It must fail** |
| `E2` to the fact that `E3` exists | wave 4 | **Both must fail**, in both directions |

**Seven of the connections in this run are absences.** A screenshot of a screen without a button
on it is evidence, and it is most of what this section produces.

---

## The seven patients, month by month

Each row is what an agent playing that person actually says. **The bold facts are planted** and
the exam marks against them.

---

### `P1` Layla Demo · Arabic only · self pay · 11 sessions

**Presenting:** cannot sleep before a family visit. Has never seen a therapist and did not
plan to see one tonight.

| Month | Sessions | What is going on | Planted |
|---|---|---|---|
| 0 | 1 | Finds Dr Karim on the radar at 23:40. Says she has not slept properly since her sister announced a wedding and the family will all be in one flat for four days | 🔴 **`R1` for Layla: "since my sister's wedding was announced"**, in her first session, in Arabic |
| 1 | 2 | The wedding is closer. Describes lying awake rehearsing conversations with an aunt. Agrees to a wind down routine and keeps it twice of seven | **two nights of seven** |
| 3 | 3 | The wedding has happened and was fine, which she finds annoying. Sleep is better on the nights she keeps the routine. **Revokes Dr Karim's access to her record in month 3** and says why: she wants to choose who reads it, not to complain about him | 🔴 **`R2` for Layla:** her month 3 journal entry says *"the wedding was fine and I am annoyed about that"* |
| 4 | 2 | The price of everything is on her mind. She pays her own way and the sessions are the first thing she counts. Keeps coming | |
| 5 | 2 | Sleep steady. Comes fortnightly out of habit rather than need, and says so | |
| 6 | 1 | Closes. Asks for her record as a file | |

**Her one crisis moment:** in month 0, before the session starts, she opens the SOS sheet to
see what it is, reads the Egyptian line and the menu instruction in Arabic, and closes it.
**She is not in crisis.** The frame is of a person checking that the button is real, which is
what most people actually do with it, and it is the only way to photograph `105, press 1 then 1`
in the language it has to be read in.

---

### `P2` Salma Example · self pay by transfer · 5 sessions · two therapists

**Presenting:** panic in traffic, which started after a minor collision she was not hurt in.

| Month | Sessions | What is going on | Planted |
|---|---|---|---|
| 0 | 1 | Books Dr Yassin through the calendar, like a dentist. Describes the collision factually and the panic vaguely, which is the usual order | 🔴 **`R1`: "a car went into the back of me on the ring road"** |
| 1 | 1 | Panic twice this month, both on the same stretch of road. Starts noticing she plans routes around it | **the ring road, both times** |
| 3 | 1 | **Asks for her history from a previous therapist.** He is asked, he answers, and she hears back either way. This is a product flow and a story beat at once | |
| 4 | 1 | Moves to Dr Amira because the appointment times work better. Her record goes with her | |
| 5 | 1 | Drove the ring road on purpose, twice, with no panic. Says she has not told anybody because it sounds small | 🔴 **`R3`: the month 4 note concludes the avoidance is narrowing rather than the panic worsening** |

---

### `P3` Mostafa Demo · covered 100% by Cairo Foundry · **20 sessions** · the deep record

**The top of the exam's ladder and the whole long cluster the cost model is fitted from.**
Twenty sessions of eight minutes each. **Never cut him and never shorten his sessions.**

**Presenting:** exhaustion he calls burnout and his employer calls stress. Works in operations
at Cairo Foundry, which is also the company paying for this, and he raises that himself in the
first session.

| Month | Sessions | What is going on | Planted |
|---|---|---|---|
| 1 | 4 | Arrives through a code from HR and immediately asks **who at work can see this**. The answer is nobody, and he needs it said plainly. Describes waking at 5 and checking messages before standing up | 🔴 **`R1`: "can anyone at work see this"**, his first sentence in his first session |
| 1-3 | 7 | The pattern emerges: it is not the hours, it is that nobody decides anything without him. **Mentions his brother in four of the eleven**, always as the person who does the family admin he does not. **Stops mentioning work altogether after the third session**, which is the change the copilot should notice | 🔴 **the brother, four times** · 🔴 **work drops out after session 3** |
| 3 | journal | Writes fourteen entries. The month 3 one is about a Friday he spent doing nothing and did not enjoy | 🔴 **`R2`: "I did nothing on Friday and hated it"** |
| 4 | 5 | **His clinician changes.** Dr Amira moves to Nile Practice and Dr Tarek picks him up, then Tarek leaves the practice and he goes back. Two clinicians, one record, and he should not have to start again | 🔴 **`R3`: the month 4 note says the presentation has narrowed from global exhaustion to a specific difficulty delegating** |
| 4 | | **His employer's pot runs dry mid month.** His screen says **"Account on hold, ask HR to activate"**. He does. It is fixed in three days and he does not miss a session | |
| 5-6 | 4 | Delegated one thing and it went fine, which he reports as if confessing. Ends steady | 🔴 **`R4`: exhaustion → delegation → one delegated task that went fine.** A copilot that names that direction has a memory |

---

### `P4` Hoda Demo · covered by Cairo Foundry · 5 sessions · two therapists

**Presenting:** low mood since a move to Cairo for work, and no friends here yet.

| Month | Sessions | What is going on | Planted |
|---|---|---|---|
| 1 | 1 | **Her enrolment is refused first.** She types a staff number the employer's system does not recognise, reads the refusal, and enrols with her work email instead. Both screens are captured | 🔴 **`R1`: "I moved for the job in March and I still do not know anybody"** |
| 3 | 2 | Joined a run club and went twice. Talks about it more than about the mood | **the run club, twice** |
| 4 | 1 | **Moves to Dr Omar**, who has finally been approved after two rejections and a practice invitation. This is the payoff of the whole `T4` thread and she is the person it happens to | |
| 5 | 1 | Steady. Three people she would now call | |

---

### `P5` Nadia Example · covered 10%, then a second employer · 9 sessions

**The money edges walk through her.** Presenting: recurring stomach pain with nothing found on
two scans, and a GP who used the word stress.

| Month | Sessions | What is going on | Planted |
|---|---|---|---|
| 3 | 3 | Enrols through Alexandria Textiles at 10%. **Pays 90% of every session herself** and mentions the cost in the second one, which is a fact about the product as much as about her | 🔴 **`R1`: "two scans and they found nothing"** |
| 3 | | Her payment screen is the one that proves `CV1` to `CV4`: the split, the VAT on her share only, and the line items that say which is which | |
| 4 | 3 | **Delta Logistics hires her.** For one week two employers are funding her. Her record does not move, her clinician does not change, and **neither company learns the other exists** | 🔴 the `CV10` case, and the worst defect the run can find |
| 4 | | Describes the new job as the first thing in two years she is not dreading | |
| 5 | 2 | **Alexandria Textiles drops to 0%** rather than removing anybody, so she keeps her badge and owes the whole price from them. Delta still covers her. The pain has stopped and she has not noticed until asked | 🔴 **`R3`: the month 4 note links the pain to the job rather than to a diagnosis** |
| 6 | 1 | Closes | 🔴 **`R4`: pain with no cause → a job she dreaded → the pain stopping when the job did** |

---

### `P6` Ziad Example · **no account, ever** · 3 sessions · the thin record

**The exam measures `P3` against him.** He has transcripts and nothing else: no journal, no
documents, no profile, no second therapist. If the copilot is as confident about Ziad as about
Mostafa, the claim that a thicker record makes a better copilot is false, and that is the
finding.

**Presenting:** cannot concentrate since his father's death eight months ago. Says the word
grief once and does not use it again.

| Month | Sessions | What is going on | Planted |
|---|---|---|---|
| 3 | 1 | Arrives on a join link from Dr Karim. **Pays by transfer as the session itself**, which is the payer kind the rail exists for: he has no account for the money to attach to | 🔴 **`R1`: "my father died in January"** |
| 4 | 1 | Same link flow, same transfer, same lack of an account. Talks about his mother's house and what to do with it | |
| 5 | 1 | Third and last. Does not book a fourth and is not chased | |

🔴 **He is also `RA1`:** on one of the three he sends the money from his banking app and closes
the tab without pressing Submit. The red bar is how he finishes it the next time he opens the
link, and if it is not there he has paid us with no claim attached.

---

### `P7` Yousra Demo · self pay · 3 sessions · the metered therapist's patient

**Presenting:** exam stress, in the ordinary sense, in her final year.

| Month | Sessions | What is going on | Planted |
|---|---|---|---|
| 5 | 2 | Sees Dr Sameh, who joined this month and never subscribes. **Her first session is free to HIM, not to her**: the trial is our fee and never her price, and both screens have to say so | 🔴 **`R1`: "finals in June"** |
| 6 | 1 | Exams done. One session to close it out | |

---

## The seven clinicians, and what each one's six months looks like

| Who | Month 0 | 1 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| `T1` Dr Amira | opens, metered, no card rail | **joins Nile Practice**, own subscription cancelled, takes a seat | **requests her payout** by hand | compares one month's earnings against her $80 bill, **net not gross** | | paid out |
| `T2` Dr Yassin | opens, takes Salma by calendar | | Nadia arrives, part covered | **subscribes by transfer.** Still metered until an operator confirms | **cancels at full price.** The one observation the plan turns on | |
| `T3` Dr Karim | the radar, at night, strangers | | Ziad arrives on a link | **lets it lapse.** Nothing demotes him; the obligation is never settled and he is back on metered by himself | still lapsed, still working, still paying $4 a session | |
| `T4` Dr Omar | **rejected, resubmits, rejected again, documents deleted** | invited to Nile Practice and **still cannot see a patient** | uploads fresh documents from inside the practice and is approved | takes Hoda. The count stays at 2 for ever | | |
| `T5` Dr Hala | | | | joins. **Sets her country wrong, sees three Stripe steps she cannot do from Cairo, corrects it to Egypt.** One free month, then $80 | upgrades a practice of one to three on the 15th and is quoted the difference before agreeing | |
| `T6` Dr Sameh | | | | | joins. One free month. Takes Yousra | **first real bill.** Overpays it, pays it twice, and declines the plan with the confirmation panel open |
| `C1-A` Dr Tarek | | invited to Nile Practice, verifies, joins | | **leaves.** Lands on metered by himself, patients follow, notes stay with the practice | | |

---

## Who is seeded, and who is not

**`scripts/simulate-seed.ts` creates four things and no people:** the operator, the platform
settings and content, and the clinic and company **applications** in a pre-approval state.

Everybody else **signs themselves up, in the wave they first appear in**, through the real form.

| Wave | Month | Who arrives | Who is already here |
|---|---|---|---|
| 1 | 0 | `OP` (seeded), `T1`, `T2`, `T3`, `T4`, `P1`, `P2` | nobody |
| 2 | 1 | `C1` + `C1-M` + `C1-S` + `C1-A`, `E1` + `E1-HR`, `P3`, `P4` | the seven above. `T1` and `T4` arrive somewhere new rather than being new people |
| 3 | 3 | `E2` + `E2-HR`, `E3` + `E3-HR`, `P5`, `P6`, `D1` | fifteen |
| 4 | 4 | `T5` | twenty two |
| 5 | 5 | `T6`, `P7` | twenty three |
| 6 | 6 | nobody | twenty five |

**A cast seeded into existence never walks the sign up flow**, and sign up is where two of the
last three walkthroughs found their worst defects.

---

## Every flow this run is meant to exercise

Grouped by who does it. **A flow with no name here is a flow nobody checked.**

### The patient

sign up · sign in · sign in with a code · a wrong code refused first · find a therapist on the
radar with no account · book from a calendar · join by link with no account · consent to
recording · **decline** recording · withdraw consent mid session · pay by card · pay by transfer
· open a transfer sheet and abandon it · come back to it from the portal bar · **cancel a
payment** · **minimise a live session to an orb and come back** · read a summary · rate a
session · write a journal entry · claim a record after the fact · ask for history from a
previous therapist · grant access to a new clinician · **revoke access** · export the whole
record · enrol with a staff number · **be refused** · enrol with a work email · open the SOS
sheet and read the crisis line in Arabic

### The clinician

sign up · upload identity, licence and headshot · **be rejected, read the reason verbatim** ·
resubmit · **be rejected again and have the documents deleted** · submit with nothing uploaded
and be refused · accept a practice invitation · **be refused a patient while unlicensed** ·
set a session price in either currency · **set a country, and watch the whole money side
change** · go on the radar · take a stranger · run a session · pause a recording · approve a
note · send a summary · request a payout · set a payout method **before** there is money · see
held earnings netted against a bill · get a full price invoice with no discount line · **choose
a plan and read the details before paying** · pay a bill by transfer · pick which invoices a
transfer covers · **let a month lapse** · cancel a plan · leave a practice

### The practice

apply · be approved · buy seats · invite a clinician · **fail to reach a note** · delegate some
powers to staff and not others · add a seat mid month and be quoted the difference first ·
lose a seat and see the next bill fall by exactly one · **fail to find a control that suspends
somebody**

### The employer

apply · be approved · have a pot opened with terms · **read the session estimate before
pressing Save** · fund it by transfer · have a transfer rejected and read the reason ·
send a real one · set coverage with the slider · **press Edit first** · get the notice period
and be unable to shorten it · drop to 0% without removing anybody · watch a pot empty · be
alerted · top up · **fail to learn who attended**

### The operator

open a country · **type the bank details in by hand** · move customers onto the Egyptian entity
· publish content · approve and reject verifications · work the transfer queue by payer type ·
confirm · **confirm twice** · reject with a reason · open a receipt through the audited route ·
read the open carts · trace every pot cent to a session **without seeing a patient's name** ·
approve a payout · read the trial balance

### The partner

hold a key · open a session through the API · get a note back · **fail to reach a patient it
did not bring** · hit a rate limit

---

## What the run does NOT simulate, and why

| Not simulated | Why |
|---|---|
| A real card payment in Egypt | There is no card rail there. `collectionProblem` refuses the country by name and that refusal is itself captured |
| A real WhatsApp code | The templates are unapproved on this account. Codes are treated as delivered; **the gate they open is still tested** |
| A chargeback or a bank reversal | Neither exists on a manual transfer rail, which is the point of `04-THE-RAIL.md` |
| Sessions longer than eight minutes | The budget. The cost model is fitted from two clusters and extrapolates honestly to fifty |
| More than one observation of churn | One therapist cancels at full price. **One observation is not a rate** and `08-THE-NUMBERS.md` says so |
| Any real person | Every surname is Demo or Example, every address is at `example.com`, and every frame from this run goes into a video |
