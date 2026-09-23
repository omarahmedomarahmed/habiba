# Tasks nobody knew to ask for (task 175)

Kept apart from the 38 inherited tasks (`takeover/TASKS.md`), as the takeover asked. Each one was
found while reading, walking or checking, and none is in the inherited list. Numbering starts
after 176. "Seen" means seen on the live site; "code" means confirmed in the code by two checks.
Details and file references: `takeover/REPORT.md` section 2 and `takeover/walk/RESULTS.md`.

Severity: **S1** hurts a patient's privacy, safety or legal position; **S2** loses or misstates
money; **S3** leaves somebody stuck; **S4** says something untrue.

## Done on this branch, waiting for the full checks and the founder's yes to deploy

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

