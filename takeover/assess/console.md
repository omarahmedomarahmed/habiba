# Staff console: every screen, assessed

Portal: the staff console, `/admin` and the 32 pages under it in `docs/INVENTORY.md`, plus `/staff/sign-in`.
Personas: `assess-operator` (omar@24therapy.app, super admin) and `assess-support` (staff.demo@example.com, support, not a founder).
Screenshots: `evidence/assess/assess-operator/` and `evidence/assess/assess-support/`. Four looks per page: desktop EN, 390px EN, 390px AR, desktop AR.
Rule held throughout: looked, never acted. No confirm, reject, approve, send, refund, discount, ban, publish, unlock or save was pressed.

## Pages

### /admin  (screenshots: evidence/assess/assess-operator/002, 003)
- For: an at-a-glance count of the business (practices, clinicians, charts, sessions, AI cost, money collected). Does the screen itself say so? no, just "Overview"
- Next: nothing on it is a link. No card leads anywhere; the operator must go to the nav. What needs deciding today (the support ticket and the verification shown as badges in the nav) is not on the overview at all. Not obvious.
- Missing: any "waiting on you" list (transfers to confirm, payouts, verifications, number changes, tickets); links from each tile to its page; a date for the numbers.
- Decoration: the AI usage chart is a flat teal block with no axis, no labels, no bars that can be read (002, 003). The dotted underline on money amounts suggests a tooltip nobody will find.
- 390px: the 29-item nav becomes one sideways-scrolling strip with three and a half items visible and no hint there are 26 more; "Back to portal" disappears entirely under the language pill (003).
- Promise: none directly; it is the door to A1 to A4 and does not open it (no queue counts).
- Defects: desktop, the language pill sits on top of "Back to portal", which reads "Back to por" (002). Billing card says "Stripe is the ledger of record" while TAKEOVER s9 says there is no card processor behind the Egyptian rail and every payment waits on a person: the sentence is either stale or misleading for the rail that actually carries the money (002). The nav is 29 flat items in three rows on desktop with no grouping (money, people, content, founder).

### /admin/support  (screenshots: evidence/assess/assess-operator/004, 005, 006)
- For: two support queues (patients, therapists), oldest deadline first. Does the screen itself say so? yes, "Two queues, because they are two jobs. Oldest deadline first."
- Next: take a ticket, say you are waiting on them, extend once, mark moved to WhatsApp, or close with a summary. The buttons are obvious; what to write is not, because the operator cannot read the ticket.
- Missing: **there is no way to open a ticket.** The card says "Open it to read what they wrote. That read is logged." and nothing on the card opens anything: clicking the reference does nothing (006), and `components/admin/support-queue.tsx` renders no link, button or disclosure for the body. An operator can close a ticket and "send the link" with a written summary of what was done without ever having seen what the person asked. This screen does NOT let an operator decide; it only lets them change a status. Also missing: who the person is beyond a name (no link to `/admin/patients/[id]`), the channel they came in on, any history.
- Decoration: "How the queues are doing" repeats the tab count (1 open, 1 nobody owns) in a whole card.
- 390px: works, no sideways scroll; the four actions wrap into an uneven grid of pills and inputs with no visible grouping, "Waiting on them" breaks over two lines inside its pill, and the close textarea placeholder is clipped mid sentence ("never in an email" cut at the bottom edge) (005).
- Promise: A5 (every read written down): the page claims the read is logged but offers no read, so the promise cannot be tested here. P2 in spirit (the reply reaches the person in the app, "never in an email") is stated.
- Defects: dead instruction "Open it to read" with no control (004, 006). The final, irreversible "Close and send the link" is the only filled teal button, while the reversible steps are quiet: emphasis is on the wrong action, and it sits directly under a free text box with nothing between them (004). "Arrived 23 Sept 2026" is Cairo time (23:43 UTC on the 22nd) and says so nowhere; no time of day, only a date and an age in decimal hours ("0.3h old") (004).

### /admin/numbers  (screenshots: evidence/assess/assess-operator/007, 008)
- For: approving a patient's change of phone number, the identity their record hangs on. Does the screen itself say so? yes, and well.
- Next: with a request, call the new number, write how you checked, Approve, or Refuse with a reason they read (from `components/admin/number-queue.tsx`). Today the queue is empty, so the decision UI could not be seen live.
- Missing: the empty state says "No number changes waiting." and nothing else: no last approved change, no link to the audit of past ones. From the source, a row shows old and new number and the reason, which is enough to decide; it has no link to the patient's account.
- Decoration: the 90 day rule sits in its own full card above an empty queue; it is policy, useful once, then furniture.
- 390px: works (008). The nav does not show which page you are on, at either width: "Numbers" is not highlighted and on mobile the strip does not scroll to it.
- Promise: A5 in spirit (the identity change is decided by a person and "they read" the refusal, the A3 pattern). Cannot be proved on an empty queue.
- Defects: none visible beyond the nav with no active state (008).

### /admin/therapists  (screenshots: evidence/assess/assess-operator/009, 010)
- For: every clinician account, with plan, verification state, and a way to verify or suspend. Does the screen itself say so? half: the subtitle "A signal, not a gate: an unverified clinician can still record sessions." explains verification, not the page.
- Next: open a clinician (the arrow next to the name), or press Verify or Suspend on the row.
- Missing: search, filter, sort, count; any reason field on Suspend; any evidence on the row before Verify. The only way into a clinician is a faint grey arrow beside the name.
- Decoration: none; if anything, too little: three badges (plan, state, role) of equal weight.
- 390px: works, no sideways scroll; emails and "11 sessions" truncate with an ellipsis (010). Six solid red Suspend buttons stacked down the page are the loudest thing on the screen (010).
- Promise: C1 (a clinician on the radar with their verification state on the row) and A1 (nothing granted before a person confirms it).
- Defects: **Verify and Suspend are one click, no confirm, no reason, no undo prompt** (`components/admin/clinician-row.tsx` lines 55 to 84 call `verifyUser` and `suspendUser` directly on click). Verify here bypasses `/admin/verifications`, where the documents are: an operator can verify Yasmin (state "pending", with a real application waiting) from this list without seeing a single credential. Suspend needs no sentence, so the clinician is told nothing in the operator's words, the A3 standard held elsewhere. Staff and admin accounts are listed as clinicians: "Sami Demo" is `staff.demo@example.com` (payg, unverified) and `omar@24therapy.app` is "Admin, payg, unverified" with a Verify button (009). Two different "not verified" words, "pending" and "unverified", with no explanation of the difference (009). Two rows named "Omar Abdelgawad" are told apart only by email.

### /admin/therapists/[id]  (screenshots: evidence/assess/assess-operator/011 Yasmin, 012 to 017 Kareem)
- For: one clinician's account: caseload identifiers, session metadata, billing both ways, and managing their verification and access. Does the screen itself say so? mostly: the privacy card says exactly what you can and cannot see ("This visit is in the audit log").
- Next: switch tabs (Patients, Sessions, Copilot, Billing, Manage). From Manage: Verify, Reject, Suspend account, or Email them. From Patients: "Send their record" per patient. From Billing: "Open a row to discount, re-price or void it."
- Missing: for a pending clinician (Yasmin, 011) no link to her application in `/admin/verifications`, although that is the one decision her page exists for. Billing rows do not look openable (no chevron, no hover affordance) despite "Open a row" (014). No way to reach the patient's own account page (`/admin/patients/[id]`) from the caseload.
- Decoration: the four stat tiles each carry an eye icon that says nothing; the privacy explanation is a full card of small grey text shown on every visit.
- 390px: header and tiles fit; the tab strip is cut on the right with Billing and Manage out of sight and no scroll cue (016); every table (caseload, sessions) scrolls sideways inside its card, so "Send their record", "Note" and "Payment" columns are off screen (016, 017).
- Promise: T3 (held earnings and what is owed as two halves), A1, A5 (the visit is audited, stated on screen).
- Defects: **the money tabs contradict each other.** Sessions shows four $75 video sessions, three "paid" and one "pending" (013); Billing says "Paid sessions 0", "Earned (net) $0" and "Nobody has paid them yet" (014). The rate tile says "Rate · 30 min $75" while every session is 50 min at $75 (013, 014). Invoices are titled "Session · from your credit" on an admin page, addressing the operator as the clinician (014). Manage says "No credentials given" beside a green "verified" badge, with Verify greyed out but Reject still live (015): a verified clinician with no credentials on file. "Send their record" and "Send email" are single buttons with no preview of what goes out; the email is sent to an address at `example.com` for three of the six clinicians, so it goes nowhere, and an operator is not told that. T3 is NOT kept here: held earnings and what is owed are not shown as two halves of one number; there is "Earned (net)" and a separate invoice list with no total.

### /admin/verifications  (screenshots: evidence/assess/assess-operator/018, 019, 020)
- For: reading a clinician's licence and approving or rejecting them. Does the screen itself say so? yes, "Nobody meets a patient until someone here has read their licence."
- Next: Approve, or write a reason and Reject ("They see this word for word"). Obvious, and this is one of the few console screens where a decision is framed properly: the reason box is required for reject and says who reads it.
- Missing: **the licence itself.** The component (`components/admin/verification-review.tsx`) can show uploaded documents as images, but Yasmin's card shows only typed fields and says nothing about there being no document (018): the operator is asked to have "read their licence" with nothing to read, and no link to the regulator to check `EPA-517740`. Approved and Rejected tabs do not say who decided or when (020). No link from the card to the clinician's page.
- Decoration: a flag emoji twice on one card (badge and Country row) (018).
- 390px: works; the reason input's placeholder is cut ("They see this word for") and "submitted 14 Aug" is truncated to "submitt..." (019). Approve and Reject sit side by side at the same size, one thumb apart.
- Promise: A1 (nothing granted before a person confirms), A3 pattern for the rejection sentence. Kept in shape; weakened by having no evidence to confirm against.
- Defects: **records disagree across screens.** Kareem is listed here as approved with licence EPA-450236 (020), while his clinician page says "No credentials given" (015). Yasmin "submitted 14 Aug 2026" here but "joined 23 Sept 2026" on her clinician page (011): she applied before she existed. The Approve button is white text on teal-ish fill? No: dark text on teal, readable. The reject input has no visible label, only a placeholder (018).

### /admin/radar  (screenshots: evidence/assess/assess-operator/021, 022, 023, 024, 025)
- For: every clinician on the public radar, live, with state, rating, 30 day sessions and our cut, plus the queue of patient reports. Does the screen itself say so? yes, "Every clinician on the board, live... and nothing said in a session."
- Next: filter, open a clinician (the name opens a modal with rate, payouts, gross, cut, last seen and an editable radar profile, 025), take them off the board (an unlabelled power icon), or Ban (opens a reason box and 24h / 3 days / Until released). Reports tabs: Open, Actioned, Dismissed.
- Missing: Kareem, verified with four sessions, is not on the board at all and nothing says why (021: "2 of 2"). No link from a row or the modal to `/admin/therapists/[id]`. The modal's profile fields have no visible labels (headline, country code, region, city are placeholders or aria only) and "Cairo Governorate" is clipped in its box (025). Rating shows "-" with no explanation.
- Decoration: **the globe.** It takes 550px of a 1280px screen to show two dots inside Egypt (021), and on 390px it is the whole first screen after the tiles (022). It confirms the founder's complaint of a globe that looks empty. "refreshed 1 times · every 3s" is a debugging counter.
- 390px: tiles reflow well; the table scrolls sideways inside its card with State cut, and Rating, 30d, Our cut and the Ban control entirely off screen (022). An operator on a phone cannot ban from here without discovering the sideways scroll.
- Promise: A5 (ban with a reason "They see this"), P1 indirectly (who is free now). Kept for the ban; the reason box is good.
- Defects: **the counts contradict each other.** "ONLINE 0" in the tile, "1 live across 1 country" on the globe, and a row saying "online" with "heartbeat lapsed" in red (021). Sara's State is "pending", the same word the clinician list uses for an unverified applicant, while she is verified; here it apparently means being booked ("BEING BOOKED 1") (021). Both real clinicians are badged DEMO in amber, so an operator cannot tell a demo from a live person at a glance when both are the same. The power icon takes a clinician off the board in one click with no confirm and only a hover title to say what it does (`components/admin/radar-command.tsx` line 476), invisible on touch. "refreshed 1 times" (grammar).

### /admin/radar/investigate/[id]  (screenshots: evidence/assess/assess-operator/026)
- For: the one screen in the console that shows a transcript: one reported session, its off-record gaps with timestamps, reachable only from a patient report, audited before it renders (from the source comment in `app/(admin)/admin/radar/investigate/[id]/page.tsx`). Does the screen itself say so? could not be seen: there are no reports in any tab (023, 024), so there is no id to open.
- Next: back to Radar control (the only link on it, per the inventory). There is no action on the page: an operator reads, then must go back to the report queue to act.
- Missing: nothing reaches it except a report row; with no reports it has no door at all. An unknown id gives the public site's 404 ("We could not find that page", "Back to home") with no console chrome and no way back to Radar control (026), and the step's visible text read back empty.
- Decoration: n/a.
- 390px / Arabic RTL: not assessable without a report; not seen.
- Promise: T2 (the off-record hole is a fact with a timestamp), A5 (audited, `break_glass.investigate` written before render). Not provable on this database position; needs the `crisis` seed or a filed report.
- Defects: the 404 for a bad id drops the operator out of the console to the public home (026).

### /admin/payouts  (screenshots: evidence/assess/assess-operator/027, 028)
- For: paying clinicians out, the manual rail (InstaPay, bank) and the automated one, with a ledger balance check on top. Does the screen itself say so? thinly: "The manual rail, and the automatic one."
- Next: Take it on, Approve, or write why not and Reject ("The clinician reads this"). From the source, after Approve come Mark sent and Confirm; the row shows only the next step.
- Missing: **what the operator needs to decide is not on the row.** It shows $255 to EGP 12,750 by InstaPay to `dr.omar@instapay` (027), and nothing about whether Omar has $255 available, what he owes us (T3 netting), when he was last paid, or where the rate of 50 came from and when. There is no link to his clinician page to check. There is no step-by-step view of the four stages (requested, approved, sent, confirmed), so an operator cannot see how far along any payout is or who took it on. No history of completed payouts on this page.
- Decoration: "The books balance" card is useful but reads as decoration because nothing ties it to the payout below: cash is "By entity: US $3,098.40" while the payout is from the "Egyptian entity", and the card does not say whether the Egyptian entity can pay (027).
- 390px: the Reject button runs past the card's right edge (028). Otherwise readable.
- Promise: T3 (the payout is the difference between held and owed): NOT visible here. A1 (a person decides) kept. A3 pattern for rejection kept ("The clinician reads this").
- Defects: the age "48.4h old" is in red with a warning icon but no stated deadline, so red means nothing specific (027). "Take it on" and "Approve" are both live at once: an operator can approve a payout nobody has taken, which makes "take it on" meaningless (027). The reject reason has no label, only a placeholder. Money amounts carry a dotted underline (tooltip) that is not discoverable on touch.

### /admin/transfers  (screenshots: evidence/assess/assess-operator/029, 030)
- For: the manual rail's queue: bank transfers somebody says they have sent, waiting for an operator to find them in the bank and confirm or reject; plus open carts. Does the screen itself say so? yes, "Sent by bank transfer, waiting to be checked."
- Next: today nothing; the queue is empty (029). From `components/admin/transfer-queue.tsx`, a row puts the reference, the amount, Confirm, Reject and "View the evidence" on one surface, and reject opens a sentence box prefilled "No transfer found with that reference. Check it and send again." then "Reject and tell them". That is the right shape for a decision.
- Missing: **A4 has no surface when the queue is empty.** Money that arrives in the bank with no claim is supposed to appear here "as work, with the difference visible"; there is no control on the empty page to record a bank line nobody has claimed, and the only "I have this in the bank" button lives inside an open cart (`components/admin/open-carts.tsx` line 162), so unclaimed money with no cart has nowhere to go. The empty state does not say when the last transfer was confirmed or link to the history (the Vault). This page is also the only door to `/admin/patients/[id]` and `/admin/sponsors/[id]` (both "Back" to here), so with an empty queue those two pages have no door.
- Decoration: none; the empty card is plain and right-sized.
- 390px: works (030).
- Promise: A1, A2, A3, A4. None provable on this position (needs `money` or `crisis`); the empty state keeps nothing.
- Defects: none visible. The prefilled reject sentence (from source) risks every rejection reading the same instead of "a sentence in the operator's own words" (A3).

### /admin/ratings  (screenshots: evidence/assess/assess-operator/031, 032)
- For: what patients said about their therapists and about us, anonymised. Does the screen itself say so? yes, "What patients said, without who said it."
- Next: nothing. The page has no controls at all (inventory: 0), so an unhappy rating leads nowhere: no link to the clinician, no route to Support or Radar reports.
- Missing: any action for "Unhappy with us"; any filter by clinician; with 21 sessions in 30 days (Overview) and 0 rated, nothing says whether patients are being asked at all.
- Decoration: gold stars on "0.0", which reads as a zero-star score rather than "no ratings" (032).
- 390px: works (032).
- Promise: none of the 25 directly. A screen serving no promise, per TAKEOVER s10, is one to argue for or delete; its data would serve better on the clinician page and the radar row (which shows Rating "-").
- Defects: "0.0" with a filled star when there are no ratings (031, 032); should be a dash, as the radar does.

### /admin/vault  (screenshots: evidence/assess/assess-operator/033, 034)
- For: all the money in one long page: what we hold for clinicians, unspent sponsor pots, VAT owed, a hand adjustment form, ledger totals, monthly income, traction, model spend, per clinician margin, every invoice and every patient payment with a refund control. Does the screen itself say so? "Money in, money out, what is left." True, and it is eleven screens in one (033 is 4,414px tall on desktop, 034 is 5,227px on a phone).
- Next: refund a patient payment (an unlabelled curved arrow icon on each row), discount an invoice (from the inventory), or post a balanced hand adjustment with a reason. None of these is signposted; an operator arriving to answer "why is Sara owed $382.50" has to scroll past traction metrics to find her payments.
- Missing: headings that split money we hold (a liability) from our revenue and from vanity metrics; any link from a held balance to the clinician or to their payout request; labels on the refund icons (the icon is the only control, 033); any date range control.
- Decoration: "Traction & unit economics" (signups, MRR, ARPU) and the income chart (two teal blocks for one month) are founder reporting sitting in the middle of an operational money page (033). "Held for clinicians $395.50" appears twice, once as a list heading and once as a tile.
- 390px: no page scroll sideways, but the "Income and spend, by month" table runs its columns together into "$76.50$114.50$0.07$114.43" (034), the Per clinician table loses every column after Sessions, and the adjustment form's Account select shows raw ledger names.
- Promise: T3 (held vs owed), A2 (a second confirm makes no second ledger leg: the ledger is here), A4 (unclaimed money). The page states the rule for adjustments well ("A balanced pair, never an edited balance. Audited with your name and your reason.").
- Defects: **the numbers disagree with every other screen.**
  - Omar is holding $13 here (033), and `/admin/payouts` asks the operator to approve a $255 payout to him (027). Nothing on either page says so; an operator can approve paying out twenty times what is held.
  - Kareem has four $75 sessions, three "paid", on his clinician page (013), yet no payment of his appears in Patient payments and he is not in "Held for clinicians" (033).
  - Omar's sessions: 11 on the clinician list (009), 14 in 30 days on the radar (021), 12 here (033).
  - Sessions in 30 days: 21 on the Overview (002), 18 here.
  - Collected: $36 on the Overview (002), $114.50 here, both unqualified.
  - "Activated 0, 0% of signups" directly above its own definition ("a clinician who has completed at least one session") while three clinicians have completed sessions (033).
  - "Gross margin $114.43, 100%" with model spend $0.07 shown next to it.
  - Invoices are worded to the clinician on an admin page: "taken from your earnings", "from your credit" (033).
  - "No Stripe account" in red under each clinician, when payouts go by InstaPay (027): the operator is warned about a rail that is not used.
  - The Account dropdown uses database names (`therapist_payable`, `fx_difference`) (033, 034).
  - Refund is a single icon with no label, and a refund "reverses the transfer and returns our cut"; whether it asks for confirmation could not be checked without pressing it, so it was not pressed.

### /admin/sponsors  (screenshots: evidence/assess/assess-operator/035, 036, 037, 038)
- For: the list of company and university accounts, and for each one its status, billing entity, joining code, pot and portal users. Does the screen itself say so? half: "Corporate and university accounts: one type, two faces, different words on their own screens." explains a data model, not the job.
- Next: "Open" expands the account in place (037). Inside: three grey chips "held", "suspended", "closed"; "Billed from" with a chip "US"; "Mint a code"; and a form to add a portal user with a password the operator types.
- Missing: **no link to the company's own page, `/admin/sponsors/[id]`**, which is where E1 is proved (spend without names). The list does not show what was funded, what was spent or how many people are on the pot, only one balance ($2,330.00) in small grey text (035). Contact, email and phone are all "not given" with no way to fill them here.
- Decoration: "EG" and "company" badges beside the name repeat what the expanded view says again.
- 390px: works, no sideways scroll; the balance and Close wrap to a second line under the name (038).
- Promise: E1, E4, E5 depend on the pot this page opens; the page shows none of them.
- Defects: **one-click state changes dressed as labels.** From `components/admin/sponsor-manager.tsx`: the chips "held", "suspended", "closed" and the "US" chip are buttons that act on click with no confirm. The entity row lists only the entities they are NOT on, so "Billed from  US" reads as a fact (they are billed from the US) when it is the button that moves an Egyptian company to the US entity and onto a different rail (line 190 to 202; the badge "EG" is the real entity) (037). "Mint a code" is one click, and its rotate form "kills every printed poster" per the source comment, with no confirm. "no code" is set in wide monospace like a code value (037). The operator types a portal user's password into the console and hands it over, instead of the person setting their own.
