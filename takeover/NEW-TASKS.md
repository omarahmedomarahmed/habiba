# Tasks nobody knew to ask for (task 175)

Kept apart from the 38 inherited tasks (`takeover/TASKS.md`), as the takeover asked. Each one was
found while reading, walking or checking, and none is in the inherited list. Numbering starts
after 176. "Seen" means seen on the live site; "code" means confirmed in the code by two checks.
Details and file references: `takeover/REPORT.md` section 2 and `takeover/walk/RESULTS.md`.

Severity: **S1** hurts a patient's privacy, safety or legal position; **S2** loses or misstates
money; **S3** leaves somebody stuck; **S4** says something untrue.

## Done on this branch, waiting to deploy

| # | What | Sev | State |
|---|---|---|---|
| 177 | The console password was published in `docs/DEMO-LOGINS.md`, with no second step at sign-in | S1 | Fixed (`68202d5`); production reseeded. Founder to reset own password |
| 178 | The crisis filter read "he" inside "the" as somebody else and silenced real disclosures | S1 | Fixed with a test that fails without the fix (`dbe66c6`) |

## Privacy and safety

| # | What | Sev | Source |
|---|---|---|---|
| 179 | The company portal names employees with dates beside live counts (the stop condition) | S1 | seen |
| 180 | A record can be claimed with no questions, by an unverified account, and the invite shows the phone number to whoever opens it; the claim has no ownership check | S1 | seen, code |
| 181 | Anyone with a session id can move or refund an unstarted session (no time or sign-in check) | S1 | code |
| 182 | The radar booking sheet is drawn over the SOS button | S1 | code |
| 183 | The patient's Stop and a later "no" do not stop recording; transcription checks neither (wider than task 123) | S1 | code |
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
