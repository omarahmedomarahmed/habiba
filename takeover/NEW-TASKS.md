# Tasks nobody knew to ask for (task 175)

Kept apart from the 38 inherited tasks (`takeover/TASKS.md`), as the takeover asked. Each one was
found while reading, walking or checking, and none is in the inherited list. Numbering starts
after 176. "Seen" means seen on the live site; "code" means confirmed in the code by two checks.
Details and file references: `takeover/REPORT.md` section 2 and `takeover/walk/RESULTS.md`.

Severity: **S1** hurts a patient's privacy, safety or legal position; **S2** loses or misstates
money; **S3** leaves somebody stuck; **S4** says something untrue.

## Live on 24therapy.app since 2026-09-23 (deploy 1 `1a9a2e1`: 177, 178; deploy 2 `f5b7378`: the rest), full checks 35 of 35

| # | What | Sev | State |
|---|---|---|---|
| 177 | The console password was published in `docs/DEMO-LOGINS.md`, with no second step at sign-in | S1 | Fixed (`68202d5`); production reseeded. Founder to reset own password |
| 178 | The crisis filter read "he" inside "the" as somebody else and silenced real disclosures | S1 | Fixed with a test that fails without the fix (`dbe66c6`) |
| 179 | Company portal: live counts beside the floored balance; per-person check dates and pause | S1 | Fixed (`23c0936`, `496bbf3`). Names kept (founder's decision 4); the per-person date turned out to be the moment each person re-proved employment, not the company's cycle date as its comment claimed, so it went with the pause badge |
| 180 | Record claim by id with no ownership check; the invite showed the phone number and never checked it | S1 | Fixed (`30c5b34`, `443abc9`). Still open: the invite route asks no questions, and a phone number is typed, not proven, until WhatsApp codes work |
| 181 | Anyone with a session id could move or refund an unstarted session | S1 | Fixed (`4e269f1`): only once overdue, with the patient waiting |
| 183 + task 123 | Recording without consent; the patient's Stop could be undone by the clinician | S1 | Fixed (`56e905a`, `952f1e6`) and seen working on a local build: nothing captured before the yes, a transcript after it, nothing after a no. A no now leads to "Write the note yourself" instead of a Try again that could never work |
| - | The contrast check stopped signing in to the company and console portals after 177 | - | Fixed (`13c24c4`), proven against the live site |

## Privacy and safety

| # | What | Sev | Source |
|---|---|---|---|
| 182 | The radar booking sheet is drawn over the SOS button | S1 | code |
| 184 | Total View reads any record unaudited; a clinician's full history can be mailed to any address; the founder is copied on patients' exports | S1 | code |
| 185 | The audit log can be deleted (the seed on production; the six-year job) | S1 | code |
| 186 | Journals and check-in replies are crisis-scanned without telling the patient | S1 | code, founder decision |
| 187 | The meeting bot records everybody in a group call on one person's consent | S1 | code |
| 188 | A partner server can get a full clinician session; partner notes "approved" by any text | S1 | code |
| 189 | Signed notes and released copies can be edited | S1 | code |
| 190 | Any feedback-link holder can trigger a refund and a suspension | S1 | code |
| 191 | A clinician's dashboard shows a colleague's patient's payment | S1 | seen |

## Money

| # | What | Sev | Source |
|---|---|---|---|
| 192 | Full price is booked as cash at booking; the clinician can withdraw it before the session happens; the patient's real payment is never recorded | S2 | seen |
| 193 | Calendar bookings charge the clinician's pounds as dollars; Egyptian VAT is booked to the US company | S2 | code, seen |
| 194 | Invoice payments write nothing to the books; an overpayment is recorded nowhere; the payer cannot say how much they sent | S2 | seen |
| 195 | Two simultaneous presses on "Sent" pay a clinician twice in the books | S2 | code |
| 196 | The founder account (super_admin only) can post any amount to any account, no ceiling, a five-letter reason | S2 | code |
| 197 | Seat billing does not exist (C3, C4) | S2 | seen |
| 198 | The earnings page says bills come out of earnings automatically; they do not (T3) | S2 | seen |

## Stuck

| # | What | Sev | Source |
|---|---|---|---|
| 199 | A bank line nobody claimed looks like an ordinary claim | S3 | seen |
| 200 | Support is sent to the clinician sign-up screen for every console page; refusals not recorded | S3 | seen |
| 201 | A clinician released from a practice loses his patients | S3 | seen |
| 202 | A colleague given access gets "page not found" from the copilot | S3 | seen |
| 203 | A history request is invisible to the patient | S3 | seen |
| 204 | An enrolled employee is not covered by the company pot | S3 | seen |
| 205 | Clinic staff cannot be removed and their admin types their passwords; no password reset for clinic, company or partner | S3 | code |
| 206 | Patient pages with no link (notices, messages, residency); the payment confirmation is not in the app | S3 | seen |
| 207 | A device that cannot play a sound cannot go on the radar | S3 | seen, founder decision |

## Says something untrue

| # | What | Sev | Source |
|---|---|---|---|
| 208 | "Pay $60" asks for $68.40; "$75" shown to a patient whose share differs | S4 | seen |
| 209 | "$100 covers about 8 sessions" (about two); a negative pot with no sentence | S4 | seen |
| 210 | The benefit page tells an enrolled employee to activate it, and promises what the company portal breaks | S4 | seen |
| 211 | "Stops that second" on `/for-patients` (T5) | S4 | seen, founder decision |
| 212 | The in-room report button says it filed a report and files nothing | S4 | code |

## Housekeeping

| # | What | Sev | Source |
|---|---|---|---|
| 213 | Scripts that write production outside the allow-list (make a super admin, run any SQL, create real sessions) | S1 | code |
| 214 | `.walkthrough2/` commits an SQL runner and test passwords (the accounts do not exist on production) | S4 | checked |
| 215 | Crisis re-delivery runs once a day; the README says every five minutes | S1 | code |

## Found while testing the fixes (2026-09-23)

| # | What | Sev | Source |
|---|---|---|---|
| 216 | The note writer sometimes leaves the whole clinical half (SOAP, summary, impressions) empty on the same transcript where another run fills it; the patient's half is always written. Seen twice on a local build with a clinician-only test recording. Needs a real two-voice recording and an eval before anyone calls it a defect or not | S2 | seen, locally |
| 217 | `verify:sprint48` 48.6 fails whenever the same clinician has another room open on the branch; it passed once the room was ended. A check that depends on unrelated rows | S4 | seen |
| 218 | Two comments describing protections the code does not have, the pattern the reviewer named: the company roster's "sponsor's cycle date" (C256) and `verify:sprint7` 7.8 counting every recording start. Both fixed; the kind is worth a sweep | S4 | seen |


## Found after the deploys (2026-09-23)

| # | What | Sev | Source |
|---|---|---|---|
| 219 | A full Postgres connection string, password included, for the Neon branch `simulation-q1` (endpoint `ep-empty-queen-a62vlkkp`) sits in the public history of `docs/SIMULATION-PROMPT.md` and `docs/WALKTHROUGH-PROMPT.md` (commits `0da42112`, `c1d41743`, `0a313033`, `0e23b0d7`, `b300a17d`), and the endpoint was live. Found by the founder. My earlier scan missed it twice over: it only looked for values I already knew, in commits since `main`, and this clone was shallow (124 of 885 commits). The founder is rotating the credential; rotation is the fix, since rewriting public history cannot unpublish it. Every other credential-shaped string in the full history is a placeholder. `takeover/tools/scan-history.py` scans all history for the shape of a credential, with a control that must detect a planted fake first; it needs a full clone | S1 | founder, then scanned |
| 220 | A company on the US entity presses "Add to the pot" and the balance goes up with nothing charged. `addToPot` calls `topUpPot` (`lib/billing/pot.ts`), which journals the cash as received and credits the pot; that balance then pays real sessions. Gated only by an active account with agreed pot terms | S2 | inventory (company), checked by hand |
| 221 | Any clinician on a clinic seat can change the clinic's seat count and cancel, resume or change its plan: `saveSeats`, `cancelPlan`, `resumePlan` (`app/(app)/billing/actions.ts`) check only `requireUser` and act on the actor's organisation, which is the clinic's. Found separately by the clinic and the therapist inventories | S2 | inventory, checked by hand |
| 222 | A signed note can be edited afterwards and the earlier text is lost: `saveNote` has no status check and overwrites `content`. It does write a `note.update` audit row, so the edit is logged but the signed version is gone, against P4 | S1 | inventory (therapist), checked by hand |
| 223 | A session a signed-in patient books for themselves (radar, calendar, join link) creates a new patient row and a new person (`ensurePersonForPatient`), never the signed-in one, so it is missing from their app. The only bridge is the claim flow, which needs a proven email or phone, and a patient cannot add an email | S3 | inventory (patient), checked by hand |
| 224 | `markPayoutSent` posts the payout to the ledger before the guarded status move, and the ledger has no uniqueness on the payout, so two presses at once pay it twice | S2 | inventory (admin), checked by hand |
| 225 | In a video session the patient could not hear the therapist until they agreed to recording, and never after a no. Caused by task 123 (`56e905a`, deploy 2): the room starts off the record without a yes and the call microphone followed off record. Fixed on the branch (`da98d4a`, `callMicMuted`, test fails on the old rule); not yet deployed | S1 | mine, found by the therapist inventory |

The full inventory, 137 pages and surfaces for six user types: `takeover/inventory/*.md`, published as one page with search (`takeover/page/inventory.html`).

## Task 174: /design, rebuilt from the ground up (2026-09-23)

Every earlier page, sample, wireframe and mockup under `/design` was deleted, as the founder asked. In
their place, one motion system (`app/design/_ds/`: rise on enter, spring on press, a sliding pill for
every selection, count-up figures, a pulse only for things live now) and eight interactive pages:
the hub, the website homepage (a three.js globe of who is free now), the patient app (seven screens,
English and Arabic, booking with the price and the consent step), and one flow each for the
therapist, the clinic, the company, our console and the partner. Research and the rules the samples
keep: `takeover/design/RESEARCH.md`. Walked at 1440 and 390 wide: no page errors, no sideways scroll.

They are samples, not product: nothing on `/design` reads or writes the database. The path moved out
of `app/(public)/`, so its exemption in `scripts/_i18n-coverage.ts` moved with it, with the reason.
