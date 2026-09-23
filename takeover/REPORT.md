# The report (task 176)

Written 2026-09-23, after reading every document and every line of code (task 171), walking
the product on the live site as the demo cast (task 172) and looking at 145 screens in two
languages at two widths (task 173). Nothing in `/design` has been touched yet; this report comes
first, as `docs/TAKEOVER.md` s10b asks.

Where things are:

- The walk, step by step, with what I did, what I saw and which database row proves it:
  `takeover/walk/RESULTS.md`. Screenshots before and after every step are in `evidence/`
  (kept out of the public repository on purpose).
- The screens, one by one: `takeover/assess/` (patient, clinician, clinic, company, console,
  public).
- What the code does, file by file: `takeover/reading/code-01.md` to `code-16.md`.
- Every claim the readers made, checked a second time against the code: `takeover/verify/`
  (354 entries: 257 confirmed, 52 partly, 30 handled elsewhere, 9 wrong, 5 could not be tested).
- The 38 tasks I inherited, rebuilt: `takeover/TASKS.md`.
- The tasks nobody knew to ask for (task 175), kept apart as you asked: `takeover/NEW-TASKS.md`.

---

## First: the stop condition

On the company portal, `/sponsor/people` shows **"Mariam Demo"** by name with a "Last checked"
date and an "End their benefit" button, while the sidebar beside it says the portal will never
show "any individual, ever". The overview page shows live counts ("Sessions paid for 6", "Spent
so far $270") that go up by one each time somebody books. A name on one page plus a live count
on another tells a company when a named employee went to therapy.

`docs/PROVE-IT.md` says to stop the walk if this is ever seen. I stopped and asked you. You
decided to record it and carry on. Nobody real is affected: the only people on the site are the
demo cast. It is at the top of this report, as agreed, and at the top of the fix list.

---

## 1. How many of the 25 promises hold

I only counted a promise as held if I saw it hold on the live site with my own eyes. If it held
in one place and failed in another, I counted it as partly. A promise I could not test counts as
untested, not as held.

| Promise | In one line | Verdict | What decided it |
|---|---|---|---|
| P1 | Three taps from opening the app to being in a session | **held** | Three taps: orb, "Yes, you may record", "Go in" |
| P2 | Nothing only in an email; the orb shows while money is owed or a door is open | partly | The orb is right everywhere. But the invitation sits on a page nothing links to, and the payment confirmation is not in the app at all |
| P3 | Nothing written by the machine reaches you unsigned; the summary names the clinician and their credentials | partly | "Still writing" before signing is right. The signed summary gives no "Dr", no credentials, nothing saying who wrote it |
| P4 | One record, every version kept under its author's name; the patient decides who reads it | partly | Versions and authors are right and the share code works. A request from Dr Kareem is waiting in the database and the patient's screen says nobody has asked |
| P5 | A crisis path that never depends on money | partly | On the payment page the SOS button sits on top, as it should. In the code, the radar booking sheet sits on top of SOS. I could not open that sheet on the live site to see it |
| T1 | A draft note from the transcript before you stand up, marked draft until signed | **held** | Draft within seconds, from what was said |
| T2 | Off the record: nothing said in that minute is kept, and the note does not mention it | **held** | Words spoken off the record never appeared in the transcript or the note (the clinician's button; see T2 note below) |
| T3 | What you owe comes out of what you earned before a payout | broken | The earnings page says bills are cleared from held earnings automatically, while the bills sat unpaid until paid by transfer |
| T4 | The invite link works for a stranger (asks a name) and for a signed-in patient ("Joining as") | **held** | Both seen |
| T5 | The copilot answers only the clinician the patient chose, cites its source, and stops when access is taken back | partly | Citations work. Taking access back narrows what it reads within five seconds, but it keeps answering, while `/for-patients` says it "stops that second". A second clinician in the same practice who was given access gets a "page not found" |
| C1 | A seat added is on the radar the same hour | untested | Going live needs a test sound to play, which my test browser cannot do. This is my equipment, not proof of a fault |
| C2 | No caseload count and no patient name anywhere in the clinic portal | broken | First name, last initial, time and clinician appear on `/clinic` and in its download |
| C3 | One bill per practice, priced per seat | broken | There is no seat line on any bill; nothing is charged per seat |
| C4 | A seat released mid-month: the next bill is lower, the clinician moves to pay as you go, nobody suspended | broken | No seat line to lower, and the released clinician lost his patient ("0 on your caseload") |
| C5 | Earnings per clinician visible, patients not | **held** | Per-clinician totals, no patient |
| E1 | The company sees funded, spent and how many; never who or when; the balance is published, not live | broken | Live counts beside names with dates (the stop condition) |
| E2 | No company screen can show a note, a session time or attendance | broken | Same screens |
| E3 | A price somebody was shown is a price they are owed | partly | Changing the company's coverage did not reprice a booked session (held). But the button says "Pay $60" and the sheet asks EGP 3,420, which is $68.40 with VAT |
| E4 | Coverage at 0% is not removal | partly | The person stays on the list; nothing tells them what changed |
| E5 | An empty pot pays nothing, the ordinary pay link appears, and the patient is told to ask HR | partly | The pot paid nothing and the pay link appeared. "Ask HR" appears nowhere, and the benefit page told an enrolled patient to "activate your benefit" |
| A1 | Nothing is granted before a person confirms the money | **held** | The session stayed shut until the operator confirmed |
| A2 | Pressing Confirm twice moves the money once | partly | Two presses 1 ms apart moved the money once and wrote one audit row. The second screen said "Confirmed" instead of "already done" |
| A3 | A rejection's reason reaches the payer word for word | partly | Word for word, but only on a page the payer has to find alone; nothing is sent. The seeded rejection is attached to nothing, so its payer can never see it |
| A4 | Money nobody claimed is work, never silently kept | broken | An overpayment was kept and written down nowhere. A bank line nobody claimed looks exactly like an ordinary claim |
| A5 | A role is a list; a refused screen sends you somewhere sensible; the refusal is on the record | broken | The support account was sent to the clinician sign-up screen for every page, including its own home, and nothing recorded the refusals |

**The arithmetic.**

- Held: P1, T1, T2, T4, C5, A1 = **6**
- Partly: P2, P3, P4, P5, T5, E3, E4, E5, A2, A3 = **10**
- Broken: T3, C2, C3, C4, E1, E2, A4, A5 = **8**
- Untested: C1 = **1**
- 6 + 10 + 8 + 1 = 25.

Strictly, **6 of 25 are kept: 24%.** Counting each "partly" as half, (6 + 10 / 2) / 25 = 11 / 25
= **44%**. Leaving the untested one out, 6 of 24 is 25%. I would quote the 24%.

**About T2.** My first two tries were my mistakes and I threw them out (in one the speech started
too early; in the other my script pressed the language switch instead of "Off record"). The third
run held. The patient's own Stop button is a different path and is broken in the code: see
section 2.

---

## 2. What is broken, and why

Ranked by who gets hurt and how badly. "Seen" means I saw it happen on the live site; "code"
means two readers and I confirmed it in the code but I did not make it happen.

### Hurts a patient's privacy or safety

1. **A named employee's therapy is visible to their employer** (seen, E1 and E2). Why: the
   company's roster was built as a list of people, and the overview reads live totals
   (`lib/billing/pot.ts:997`) while its own comment (`app/(sponsor)/sponsor/page.tsx:50-56`)
   explains why the balance must not be live. The patient's benefit page promises the opposite
   ("Not a date, not a count"), so the patient is also misled.
2. **Recording without consent** (seen, task 123). In an in-person session nobody is asked, the
   microphone records and the transcript is made. The note page then says "Not recorded. This is
   the clinician's own account" over a note drafted from that recording. Also in the code: the
   patient's own Stop button and a later "no" set a flag that the room never reads, and the
   transcription route checks neither consent nor that flag. This is the one legal defect.
3. **A record can be claimed by the wrong person** (seen). The invite link showed the patient's
   phone number to whoever opened it, asked no questions, and gave the record to an account whose
   phone was never checked. In the code, the claim takes a person's id from the browser with no
   check that it belongs to the one claiming it.
4. **Anyone with a session id can move or refund a session that has not started** (code). The
   no-show rescue was meant for five minutes after a missed start; it has no time check and no
   sign-in check.
5. **The crisis filter silenced real disclosures** (code, fixed on this branch). It read "he"
   inside words like "the" as somebody else, so "The thought of suicide is on my mind" was
   treated as about another person. Fixed and tested (commit `dbe66c6`); not yet on the live
   site.
6. **The SOS button can be covered** (code). On the radar booking sheet, the sheet is drawn above
   the SOS button. The payment page is correct.

### Hurts somebody's money

7. **Full price is booked as cash the moment a session is booked** (seen). The clinician's share
   is credited before the patient has paid, and shows as "Available now" to withdraw. When the
   patient's money really arrives, their share is never written down.
8. **Egyptian pounds are charged as dollars** (code). Sessions booked through the calendar are
   priced in the clinician's pounds but stored as dollars. And Egyptian VAT is booked to the US
   company (seen).
9. **Invoice payments never reach the books** (seen). The operator confirmed EGP 800 against four
   bills: the bills became paid, and no ledger entry was written. EGP 200 of overpayment is
   recorded nowhere. The payer has no box to say how much they sent.
10. **Two simultaneous presses on "Sent" pay a clinician twice in the books** (code). The payout
    writes the ledger before it checks it has not already been sent.
11. **"Pay $60" asks for $68.40** (seen). The VAT is added on the sheet and never shown on the
    button.
12. **The earnings page promises bills are taken from earnings automatically** (seen, T3). They
    were not.
13. **No seat billing exists** (seen, C3 and C4). A practice pays nothing per seat, though the
    homepage sells it.

### Leaves somebody stuck

14. **A rejected bank transfer is a dead end** (seen, A3 and task 124). Nothing is sent, the orb
    disappears, a guest never sees the reason, and the operator is told "they have been told why",
    which is false.
15. **A bank line nobody claimed looks like any other claim** (seen, A4). This is exactly how I
    confirmed one by mistake during the walk (recorded in RESULTS, then redone on a fresh seed).
16. **The support account cannot use its own console** (seen, A5). Every page sends it to the
    clinician sign-up screen, and the refusals are not written down.
17. **A clinician released from a practice loses his patients** (seen, C4).
18. **A second clinician who was given access to a patient cannot use it** (seen, T5): the
    copilot answers "page not found".
19. **A request to read a patient's history is invisible to the patient** (seen, P4).
20. **The console cannot send a patient a new claim link** (seen, task 105).

### Says something untrue

21. The top-up screen says $100 "covers about 8 sessions"; at the demo's coverage it covers about
    two.
22. A negative pot shows "-$25" and "113%" with no sentence saying what that means.
23. The benefit page tells an enrolled employee to "activate your benefit".
24. The booking screen asks a signed-in patient for her name, email and phone, and defaults her
    country to the US.
25. A clinician's dashboard showed a colleague's patient's payment ("Session with Sara Demo,
    EGP 4,275" on Dr Yasmin's screen).

### Already fixed on this branch, waiting for your go-ahead to deploy

- The crisis filter (item 5).
- **The console password was published.** `docs/DEMO-LOGINS.md` printed the password that opens
  the founder's and the staff console accounts, with no second step at sign-in. The seed now gives
  those three accounts a private password that lives only outside the repository, and the demo
  check proves the published one no longer opens them (commit `68202d5`). Production was reseeded
  with it. **What you need to do:** on the sign-in page for `omar@24therapy.app` and
  `habiba@24therapy.app`, use "Forgot password" and set your own. The staff demo account can stay
  as it is.

Also checked: a committed test file (`.walkthrough2/people.json`) holds passwords for four
`.test` accounts. None of those accounts exists on the live site, so they open nothing. The file
should still go.

---

## 3. What looks broken but is handled elsewhere

The second-pass checkers found 30 of these. The ones worth knowing, because each one would
otherwise look like a defect to the next person who reads the code:

- **Confirming a transfer twice** is safe: the confirm only goes through if the row is still
  waiting (`lib/billing/manual.ts:519-528`). I saw it hold on the live site (A2).
- **The copilot's access check** looks like it trusts a default, but its only caller works out
  access again for every question (`lib/ai/case-copilot.ts`, WALL-25, CLIN-19). I saw access
  narrow within five seconds.
- **Suspended clinicians on the radar**: the list that feeds the radar leaves them out
  (`lib/data/discover.ts:112`, SESS-12).
- **The demo flag on clinicians** is only a label; it opens nothing (SESS-15).
- **The payment orb and the SOS button**: every money layer in the patient screens sits under SOS
  (UX-57), and the patient error page keeps SOS (UX-58). Only the radar sheet breaks this.
- **The feedback brief** is blank until the note is signed (UX-59, CLIN-16).
- **Reloading the room** brings you back into the same session (SESS-27).
- **Break-glass reads in the console** are written to the audit log (WALL-31).
- **Routing between the six portals**: each sign-in cookie opens only its own portal (ID-37).
- **The seed's wipe** can only delete, never swap a row, so the count check it runs is enough
  (CHK-19).

---

## 4. What the code does that nobody promised

The 25 promises cover perhaps a third of what the code does. The rest sorts into three kinds.

### Worth selling (built, working, and nobody says so)

- **Every clinical fact traces to its sentence.** A fact about a patient carries the transcript
  line it came from, and contradictions between sessions are shown side by side.
- **Diagnoses only when written word for word**, with the source sentence.
- **Per-question timing on PHQ-9 and GAD-7**: the clinician can see a patient spent ninety
  seconds on the suicide question; the patient sees their own history and never a score band.
- **Homework** that shows the clinician the trend and the patient only the next step.
- **No-show rescue**: if the clinician does not come, a cheaper replacement now with the
  difference kept as credit, or a full refund including our fee (once it is locked down, item 4).
- **Crisis reading in Arabic, Egyptian dialect and Franco-Arab.**
- **Egypt's crisis line 105** with its phone menu printed on the button in both languages.
- **Money out has four refusals** (more than held, a second request in flight, approving your own,
  sent without a receipt), two people for any payout, and receipts that cannot be deleted.
- **Nothing cancels a session somebody has paid for or joined.**
- **A caseload spreadsheet import** that refuses to bring clinical columns across.
- **Wall QR codes** for a clinic's reception desk; **walk-in clinics** on the radar with
  directions.
- **The clinician alarm** (sound, notifications, flashing tab) when a patient books or waits.
- **A public verified page** for each clinician, with the regulator, the month and a reliability
  score.
- **An honest comparison with competitors**, rows we lose included.
- **A company joining-code poster** and two-step domain proof.
- **A record extract anyone can check is genuine** without learning who it is about.
- **Walk-ins land on the caseload**: an in-person session with only a first name makes a chart.

### A hole (nobody should have it)

- **"Total View" in the console**: the founder account reads any patient's transcripts, notes,
  copilot conversations and risk flags by name search, and each read is not written down.
- **Mail a clinician's full history to any address** typed into a box, with every patient's name
  and email; and the founder is copied on patients' record exports.
- **Staff can post any amount to any account** in the books with a five-letter reason.
- **The audit log can be deleted**: the demo seed deletes it on production every reseed, and a
  nightly job deletes rows after six years. "Every read is written down" can be undone.
- **Scripts that can write production outside the allow-list**: one makes any user a super admin
  and replaces their password with no audit row; others run any SQL, or create and book real
  sessions on whatever address they are pointed at.
- **Patients' journals and check-in replies are scanned for crisis** and a clinician is alerted,
  and the journal page is forbidden to say so. It may be right to scan; it is not right to hide it.
- **The meeting bot records everybody** in a couples or group call on one person's consent.
- **A partner's server can get a full clinician session** on demand, and partner notes count as
  "approved" with any non-blank text.
- **Signed notes can be edited**, released copies included.
- **The in-room "report" button says it filed a report and files nothing.**
- **Any holder of a feedback link can trigger a refund and a suspension.**
- **Clinic admins type their staff's passwords**, and clinic staff cannot be removed.
- **A patient complaint opens the session transcript to our staff**, which no promise tells the
  patient.
- **Partner operators see our whole list of corporate customers.**

### Half built (a door with no room, or a room with no door)

- **The partner platform**: transcripts, notes, memory and copilot sold as a metered API with
  limits and billing. No promise, no audience, and keys it cannot mint.
- **Connecting a practice's records system**: you can connect, but no note is ever filed into it.
- **Telling voices apart**: all the logic, no provider, so the voices panel is always empty.
- **Check-ins**: sent, never received; stop words by reply do not work; no WhatsApp template.
- **Zoom, Meet and Teams transcripts** are accepted and thrown away.
- **Patient pages with no link to them**: notices, messages, residency.
- **No password reset** for the clinic, company or partner portals.
- **WhatsApp codes for phone-only patients** wait on Meta's approval, so they cannot reset a
  password or prove their number.
- **Two availability editors** with different time-zone rules; only one can cancel.
- **Support tickets moved to WhatsApp can never be closed.**
- **Clinic seat billing**: the quote and the proration exist, reachable only from the clinician
  portal, and nothing bills.
- **The stuck register** that would list everybody who is stuck is empty by design until task 163.
- **Eighteen kinds of message** go by email only, with no place in the app.

---

## 5. What I would do differently

1. **One rule for money, written once.** Money is booked in at least four places, each a little
   differently (booking, the transfer confirm, invoices, the pot). Items 7 to 11 all come from
   that. I would make one function that every rail calls, and one check that the books balance
   after every walk position, not only in the tests.
2. **Consent as a gate, not a flag.** Today consent is a field that screens read if they remember
   to. I would make the microphone, the transcription route and the meeting bot all refuse to run
   without a recorded yes, so forgetting is impossible.
3. **Promise the company only what the database cannot leak.** A company should get a published,
   rounded summary on a schedule, never a list of people with dates, and never a live count. I
   would build the company portal on that summary table alone, so a new screen cannot leak by
   accident.
4. **Fewer portals, finished.** The partner platform, the records-system connection, voices and
   check-ins are each half built. I would hide them until they are whole, and put that effort into
   the five people who use the product today: patient, clinician, clinic, company, operator.
5. **Every screen reachable, and every message in the app.** Pages with no link and messages that
   exist only in an email break P2. A test should fail when a page has no door.
6. **Tests that walk, not only tests that read.** The gates passed while the walk found eight
   broken promises. The walk harness in `takeover/walk/` (a screenshot before and after every
   click, a shared board, two browsers at once) should become the gate for money and consent.
7. **The console for the people who run it.** Support cannot open its own console, and several
   staff screens have founder-only buttons. An operator should see, in one list, everybody who is
   stuck and how long they have waited.

---

## 6. Where Phase 0 stands

The four defects that hurt a real person (TAKEOVER s11):

| Task | What | Where it stands |
|---|---|---|
| 123 | In-person sessions recorded without consent | Seen on the live site, and wider than written: the patient's Stop and a later "no" do not stop the recording either |
| 122 | A pop-up over "Go in now" ends in a 3-day ban | Confirmed in the code, and wider: opening an invite early can get a calendar clinician warned and then suspended |
| 124 | A rejected transfer is a dead end | Seen on the live site; the operator is also told something false |
| 117 | An anonymous session ends with no patient record | Confirmed in the code |

None is fixed yet. They come first after the design samples are approved, or before them if you
prefer (see decision 1 below).

---

## 7. Decisions only you can make

1. **Fix first or design first?** The order you gave is report, then design, then fixes. Items 1
   to 4 in section 2 hurt a patient's privacy. I would fix those four before the design work, and
   deploy them once the full checks pass and you say so. Your call.
2. **The clinic and names (C2).** The homepage promises no patient name in the clinic portal. A
   practice manager needs to know who is coming to the front desk. Either the promise changes
   ("first name and time, for the front desk only") or the schedule goes.
3. **"Stops that second" (T5).** Taking access back cuts the copilot off from the patient's
   profile at once, but it still answers from the clinician's own session notes. Either the page
   says that, or the copilot stops answering altogether.
4. **What the company sees (E1).** Keep a roster of names (needed for "End their benefit"), or
   move to codes only? Either way the live counts go.
5. **The pricing copy.** The site says "first session free", "no per-session fee" and "No seat fee"
   in places, and the homepage sells per-seat billing. They cannot all be true.
6. **In-person consent.** Who says yes, and where? Options: the patient taps yes on the
   clinician's screen; or the clinician confirms they asked, and the patient gets a message to
   agree or withdraw. I would do the first.
7. **Scanning journals.** Keep scanning and say so on the journal page, or stop scanning.

---

## 8. What comes next

- The design samples (task 174), portal by portal, the patient app first.
- The tasks nobody knew to ask for: `takeover/NEW-TASKS.md`.
- Then the fixes, worst first. Nothing goes to the live site until the full checks pass and you
  say yes.
