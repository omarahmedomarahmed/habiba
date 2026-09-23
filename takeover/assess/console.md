# Staff console: every screen, assessed

Portal: the staff console, `/admin` and the 32 pages under it in `docs/INVENTORY.md`, plus `/staff/sign-in`.
Personas: `assess-operator` (omar@24therapy.app, super admin) and `assess-support` (staff.demo@example.com, support, not a founder).
Screenshots: `evidence/assess/assess-operator/` and `evidence/assess/assess-support/`. Four looks per page: desktop EN, 390px EN, 390px AR, desktop AR.
Each page's "Arabic RTL" line is collected in one table, "Arabic RTL, page by page", after the pages, because the finding is the same on almost every page: the console is not translated.
Ids for `/admin/sponsors/[id]` and `/admin/patients/[id]` came from one read-only SELECT, because no console page links to them. Audit rows for the support persona were checked with a read-only SELECT too.
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
- Defects: **records disagree across screens.** Kareem is listed here as approved with licence EPA-450236 (020), while his clinician page says "No credentials given" (015). Yasmin "submitted 14 Aug 2026" here but "joined 23 Sept 2026" on her clinician page (011): she applied before she existed. The reject input has no visible label, only a placeholder (018).

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

### /admin/audit  (screenshots: evidence/assess/assess-operator/039, 040, 041)
- For: the append-only record of who read and did what, with patients as references. Does the screen itself say so? yes, and gives the reason ("a compliance tool must not be a way to browse charts").
- Next: filter by category (All, phi access, auth, admin, billing, break glass). Nothing else: no search by person, by patient reference or by date, no export, no way to open a row.
- Missing: **the target of an admin read.** My own seven clinician page views are here as "break glass · admin.therapist.view · omar@24therapy.app · 24Therapy" (039), and not one row says WHICH clinician was viewed: the resource id is written (`app/(admin)/admin/therapists/[id]/page.tsx` line 48 to 55) but not shown. For A5 ("every read is written down") the write is kept; the reading of it is not. No count, no pagination indicator, no end of list; the page is 5,340px of near-identical `session.read` rows (039).
- Decoration: none; this is a raw table, and its noise is the problem: every tab switch on a clinician page writes another break-glass row, so seven rows record one visit.
- 390px: rows restack into readable cards; the filter chip row is cut, "break glass" is off the right edge with no scroll cue (040).
- Promise: A5. Partly kept: reads are recorded; the record cannot answer "who looked at Kareem's account" without the target on the row.
- Defects: the "admin" filter shows one row, a `transfer.confirm` (041), while every admin view is filed under "break glass", so "admin" does not mean what an operator will think. A clinic manager's `clinic.schedule.read` is filed as "phi access" with the label "practice" (039). Action names are raw code identifiers (`session.read`, `admin.therapist.view`), not sentences.

### /admin/benefits  (screenshots: evidence/assess/assess-operator/044, 045)
- For: employees whose company funding stopped because a re-verification went unanswered, longest wait first. Does the screen itself say so? yes.
- Next: nothing today (empty). The page has no controls (inventory: 0), so even with a row an operator can read who is paused but cannot resume, remove or contact anybody from here.
- Missing: an action per row, or a link to where the action lives (`/admin/sponsors`); which company each paused benefit belongs to (from the component, not visible on an empty page).
- Decoration: none; the empty state is a sentence, well sized.
- 390px: works (045).
- Promise: E4 (zero coverage is not removal) and E5 (pot runs out, patient told to ask HR) are adjacent; this page shows neither and serves no promise directly.
- Defects: none visible. Founder-only for no stated reason (see the support persona, below): a support agent answering "why did my benefit stop?" cannot see this list.

### /admin/clinics  (screenshots: evidence/assess/assess-operator/046, 047, 052)
- For: clinic and hospital accounts: state, billing entity, contact, and portal users. Does the screen itself say so? no; "A clinic IS an organisation row, so its clinicians sit in its tenancy." is a database note written for developers.
- Next: "Open" expands in place (052): the same pattern as Sponsors, with the same one-click chips "held", "suspended", "closed" and "Billed from US" (source `components/admin/clinic-manager.tsx` line 136), and an add-portal-user form where the operator sets the password.
- Missing: the seats and the one bill (C3, C4): nothing on this page says how many seats Nile Practice pays for, what its next invoice is or which clinicians fill the seats. "3 clinicians" is not a link. Only one clinic is listed while the Overview counts "Practices 3" (002): Cairo Counselling (Omar's) and 24Therapy are not clinics, and nothing says the Overview is counting something else.
- Decoration: none.
- 390px: works (047).
- Promise: C1, C3, C4 belong to the practice; the console side of them is absent.
- Defects: same misleading "Billed from US" button as Sponsors: it lists the entity they are NOT on (052). A heading size that differs from other pages (smaller "Clinics and hospitals", 052, against the large "Clinicians", 009): page titles are not one component across the console. "Verification is the clinician's own, here as well. Nothing on this screen completes one." is useful, and set in the smallest grey type at the very bottom (052).

### /admin/partners  (screenshots: evidence/assess/assess-operator/048, 049)
- For: API partners and integrators who asked for access. Does the screen itself say so? in jargon: "A partner sits outside clinical tenancy and owns no organisation. Activating one lets them hold a key: nothing happens before the call."
- Next: nothing (empty). "No integrator enquiries yet." with no way to add one or to find where enquiries come from.
- Missing: a door for the enquiry (which public page sends them here), any sample of what a row looks like.
- Decoration: n/a.
- 390px: works (049).
- Promise: none of the 25. The partner portal is last in the redesign order; this screen can wait with it.
- Defects: none visible.

### /admin/checkins  (screenshots: evidence/assess/assess-operator/050, 051)
- For: the scheduled "how are you" messages, and their mute rate as the health measure. Does the screen itself say so? yes, and the 20% rule is stated plainly.
- Next: the subtitle says "Every number is yours to change" and there is nothing on the page to change (inventory: 0 controls; 050, 051). The settings live somewhere else (presumably `/admin/settings`) and the page does not link there.
- Missing: a link to where the schedule and thresholds are set; a date range for "0 sent"; whether the channel is on or off right now.
- Decoration: the six zero counts in their own card.
- 390px: works (051).
- Promise: P5 adjacent ("A worrying one reaches their therapist through the crisis path"). Nothing provable here.
- Defects: "Every number is yours to change" with no control on the page (050). "0 of 4 reachable people" while the Overview counts 6 patient charts, unexplained.

### /admin/taxonomy  (screenshots: evidence/assess/assess-operator/053, 054, 060)
- For: the countries, languages and specialties the radar filters by. Does the screen itself say so? yes, and the consequences of closing a country are explained well in the subtitle.
- Next: tap a chip to turn it off or on; the small x beside a chip deletes it; type and Add a language or specialty.
- Missing: a confirm on closing a country. From `components/admin/taxonomy-editor.tsx` line 141 a single tap on a country chip toggles it, and the subtitle itself says closing one "takes its clinicians off the radar and tells them why": one mistaken tap on "Egypt" on a phone takes every live clinician off the radar and messages them, with no reason asked and no undo shown. The tell-them-why sentence is not something the operator writes.
- Decoration: flag emoji on every chip, including flags on languages (Arabic shows the Egyptian flag, English the US flag, 054), which is wrong for a language and unreadable at chip size.
- 390px: no sideways scroll; the page is 3,626px of chips (054). The delete x sits flush against each chip at 390px, a few pixels from the toggle.
- Promise: C1 (a clinician is on the radar in the hour) depends on the country being open. Not provable here.
- Defects: heading "Countrys" (053, 054). The country list is 169 entries including Antarctica, French Southern Territories and Falkland Islands, all "on" (054): nobody curated what "on" means. Every chip turned on reads as brand teal, off reads as struck through grey: the only difference between on and off at a glance is a line through the word.

### /admin/announce  (screenshots: evidence/assess/assess-operator/055, 056)
- For: one email to every active clinician. Does the screen itself say so? yes.
- Next: write a subject and message, type the recipient count to confirm, send. The type-the-number confirm and "There is no unsend." are the best-guarded send in the console (055).
- Missing: an in-app copy. **This is email only**, and P2 is "Nothing the product tells you is only in an email." Three of the four recipients are at `example.com` (055), so on this database the announcement reaches one person, and the page does not say that. No history of past announcements, no preview.
- Decoration: none.
- 390px: works (056).
- Promise: P2, and it breaks it by design for clinicians.
- Defects: **placeholders look like filled values**: the subject reads "Crisis Radar is live", the body reads "You can now go on call between appointments... Set your rate in Settings." and the confirm box already shows "4", all as placeholder text in a colour close to real input (055, 056). An operator can believe the form is filled. "Every active clinician" includes Yasmin, who is not verified (055).

### /admin/content  (screenshots: evidence/assess/assess-operator/057, 058, 059)
- For: every public page, editable here, publishing immediately. Does the screen itself say so? yes.
- Next: open a page to edit, or the external-link icon to see it live; "UI reference" goes to `/design`.
- Missing: **which row is the live one.** The list has 30 rows for 12 public pages (058): `/contact` appears twice in English and twice in Arabic, `/features` twice in each language, `/for-patients`, `/pricing` and `/` each twice in each language with different "updated" dates, `/hipaa`, `/privacy`, `/security` and `/terms` twice each in English. Every row says "published". The operator cannot tell which one the site is serving or which one to edit. No filter by language, no grouping by path.
- Missing too: there is no Arabic Privacy Policy, Terms of Service, Compliance or Security page (058): the legal pages exist in English only.
- Decoration: none.
- 390px: titles truncate to "How 24Therapy ..." so the duplicate rows are identical on a phone (058). Arabic titles mixed with the English brand break bidi: "24 كيف يعمل Ther..." with the numeral split from its word (058).
- Promise: the honesty rules (TAKEOVER s6) are enforced on save by `lib/content/honesty.ts`; the page does not say so, and they are not shown to the editor.
- Defects: duplicate published rows per path and locale (058). Updated dates are mixed without a year.

### /admin/content/[id]  (screenshots: evidence/assess/assess-operator/061, 062; opened /pricing)
- For: editing one public page's title, meta description and blocks, then Save draft or Publish. Does the screen itself say so? yes in part: the path and "published" at top, and a very good "The blocks you can use" guide with the rules for each block (the competitor block's "A table we win six times out of six is one nobody believes" is the honesty rule written where it is needed).
- Next: edit, then Save draft or Publish. On mobile both sit in a sticky bar over the content (062).
- Missing: a preview; a diff against what is live; which of the two `/pricing` rows this is; who last published it. The rivals section repeats "They win this row. Moves the tick to their column. Every rival needs one, or nobody believes the other five." thirty times, once per row, instead of once.
- Decoration: the block guide is useful once and then permanently occupies the top of every editor.
- 390px: the sticky Save draft / Publish bar covers the text under it (062); a thumb scrolling up the page is resting on Publish, which takes effect immediately. The page is 15,205px tall on desktop (061).
- Promise: indirectly all of them: this is where every public claim ("where we say it") is written. The honesty gate is the promise; it is invisible to the editor.
- Defects: repeated helper text per row (061); sticky Publish over content at 390px (062); the icon picker is a raw list of icon names ("fileText", "zap") with no icons shown (061). Not pressed: Save draft, Publish.

### /admin/settings  (screenshots: evidence/assess/assess-operator/064, 065)
- For: every figure the product charges, shows or enforces: clinician tiers, our cut, copilot allowances, the manual rail (FX, two-person threshold, alert hours), staff accounts, how Egypt pays, the email test, video health, and per-country VAT, currency, crisis line, regulators and paid-session switch. Does the screen itself say so? yes, "Every figure the product charges, shows or enforces. There is no second copy."
- Next: edit a section and press its own Save (eight separate Save buttons: tiers, patient payment, copilot, manual rail, transfer fields, Save EG, Save US, plus Add them and Send them all).
- Missing: **a crisis line for Egypt.** The Countries section shows "Egypt EG · Egyptian entity · no crisis line" (and the same for the US) (064). P5 is a crisis path that never depends on money; the settings that feed the patient's SOS have no number for the one country the product operates in, and the page shows it as a quiet grey label, not an alarm. This needs checking on the patient SOS screen by the patient assessor; from the console it is the most important thing on this page and it is at the very bottom.
- Missing too: section navigation on a very long page; who last changed each figure and when; an indication of which Save covers which fields.
- Decoration: the "Margin per session" card at the top repeats the Vault's numbers and disagrees with it: 99.8% here, 100% on the Vault (033).
- 390px: works, single column (065); a very long scroll with eight Save buttons that look identical.
- Promise: P5 (crisis line per country), T3 ("Take the session fee from held earnings when we hold enough. Off, the pricing page stops saying so." is the T3 switch), A1 (the two-person threshold "cannot be switched off"). The honesty link is well done: the switch says what public copy it changes.
- Defects: **opening Settings creates a real video room.** "Video rooms: Working. A room was built and torn down just now." is computed on every page load by `videoHealth()` (`components/admin/video-check.tsx`, `lib/video.ts` line 164): looking at the page is an action against the video provider, every time. "Check the emails: Sends all 26" lists 26 templates while promise P2 says nothing is only in an email; the list is the inventory of what P2 must mirror in-app. Staff accounts are created with a first password the operator types and hands over (064).

### /admin/strings  (screenshots: evidence/assess/assess-operator/068, 069, 070, 071, 072)
- For: overriding the shipped wording, per language, and deciding which languages are offered. Does the screen itself say so? yes.
- Next: search a key or phrase, filter (all, drafts, missing, safety), type the translation, Save draft; from the inventory there are also machine translate, approve and publish forms per row.
- Missing: the translation boxes are one-line inputs about 250px wide next to a wide source sentence (072): a full Arabic sentence ("Your answer does not change whether you are seen, or what you pay.") is cut at both ends and cannot be read whole while editing. No context for where a string appears (only the key, `consent.noCost`). The list shows "the first 300 of 2948. Narrow the search." with no paging.
- Decoration: the two language cards with 100% bars take the first screen; on 390px they fill it (069).
- 390px: works as a column, but the language cards alone are a full screen before any string (069).
- Promise: every promise that appears as a sentence on a patient screen is edited here; P5 and T2 consent wording are marked "safety string, rewordable, never removable" in red (072), which is the right guard, clearly shown.
- Defects: "Switch language: en ar" renders as "enar" in the text layer, the two links sitting with no separator (068, 072). "Save draft" on a safety string is a filled teal button on every row, dozens per screen (072). The Arabic input is too narrow to show its own sentence (072).

### /admin/usage  (screenshots: evidence/assess/assess-operator/073, 074)
- For: 30 days of model spend, audio minutes and what patients paid, per kind of call and per clinician. Does the screen itself say so? yes.
- Next: "Every session" goes to `/admin/usage/sessions`; each clinician row filters it (inventory). Nothing to decide; it is a report.
- Missing: why 21 sessions had recording granted and only 3 had any AI (074); the page does not reconcile its own two numbers.
- Decoration: "We took $76.50 and spent 6.7¢ on models, a gross margin of 100%" restates the four tiles above it (073).
- 390px: tiles fine; "Where the money goes" loses Calls, Errors and Spend off the right edge, which are the only numbers in it (074); Per clinician loses everything after the name.
- Promise: T1 (a note built from what was said) is where the AI spend shows; none directly.
- Defects: **a fourth and fifth session count.** 23 sessions here, 21 on the Overview (002), 18 on the Vault (033); Omar 14 here, 12 on the Vault, 11 on the clinician list. AI calls: 23 on the Overview with $0.02 (002), 26 at $0.03 on a later load (003), 48 calls and 6.7¢ here. Each figure has a different window or definition and none says which. Kareem "Patients paid $0" while his own clinician page says three of his sessions were paid (013).

### /admin/usage/sessions  (screenshots: evidence/assess/assess-operator/075, 076)
- For: model cost per session, every session in 30 days. Does the screen itself say so? yes, "Model spend only, not the room and not the rail."
- Next: back to Usage (a back link, good). Nothing else; rows are not links.
- Missing: a way to open a session or its clinician.
- Decoration: "Dearest 1.4¢" in alarm red (076), a colour spent on a cent and a half.
- 390px: only When and Clinician fit; Minutes, Cost, Patient paid and Our fee are off screen (076).
- Promise: none directly.
- Defects: four Kareem and six Sara sessions all at "23 Sept, 02:22", all 50 minutes, 0 audio, 0 calls (075): seeded rows presented as real sessions, with no marker; two "Video · scheduled" rows are listed among costs with dashes.

### /admin/errors  (screenshots: evidence/assess/assess-operator/077, 078)
- For: server errors from the last 30 days, grouped, with the digest a user can quote. Does the screen itself say so? yes, at length (five lines of subtitle).
- Next: expand a Stack. Nothing else: no "resolved", no link to the page that failed, no owner. An error stays until it ages out.
- Missing: a resolved or deployed-since marker. Two live defects are listed and nothing says whether they are fixed: `GET /sponsor/integrations` "column "consumed_at" does not exist" (the company portal, twice on 21 Sept), and `GET /t/[id]` and `/patient/t/[id]` "Cannot read properties of undefined (reading 'tone')" (077). These are for the company and patient assessors to confirm.
- Decoration: none.
- 390px: works, cards stack cleanly (078).
- Promise: none directly; it is the net under all of them.
- Defects: every card says "The code a clinician sees, so a support message quoting it lands here." including errors on patient and company paths (077): the sentence is wrong for most rows and repeated six times. Founder-only, while support is who receives the digest from a user (see the support persona, below): the person told to quote the code cannot look it up.

### /admin/tv  (screenshots: evidence/assess/assess-operator/079, 080)
- For: "Total View", the founders' two-key elevated console: a business board plus a live view that reaches clinical rows (sessions, conversations, the audit stream), per `app/(admin)/admin/tv/page.tsx`. Does the screen itself say so? **no.** It shows only a card "Set the keys. Two are needed. The first can be changed here later; the second is written once and after that changes only in the database." with First / Second tabs, a Value box and Save (079). No title, no "Total View", no word on what the keys unlock, who holds the second, or that entering it is irreversible beyond the one clause.
- Next: set a key. Not done: the brief forbids unlocking, and the second key is written once. The page's real content could not be assessed.
- Missing: the nav calls nothing "Total View" (there is no nav item for `/admin/tv` at all: it has no door from the console); a page title; a warning that Save on the Second tab is permanent; who is allowed here.
- Decoration: n/a.
- 390px: the card fits (080).
- Promise: A5 ("a role is a list, not a rank, and every read is written down"). The keys are unset on production: the two-key gate has never been configured, so Total View has never been opened on this database, or was opened some other way.
- Defects: no door (not in the nav, not linked). Guarded by `requireManager`, not `requireRole("super_admin")` like the other founder pages, so a "manager" staff account reaches the key form. The page reads conversations (`conversationFor`), which contradicts the audit log's "a compliance tool must not be a way to browse charts" and the clinician page's "There is no toggle that reveals them": the two-key gate is that toggle, and nothing on the other screens admits it exists.

### /admin/financial-model  (screenshots: evidence/assess/assess-operator/081, 082)
- For: the founders' forecast: a plan picker, a scenario picker, one session's unit economics and month-by-month cash, each number tagged with where it came from. Does the screen itself say so? yes, "Thirty-six months, and where each number came from."
- Next: pick a plan or a scenario, slide "Churn at the cliff", edit people (Add someone, Remove, Reset, Measure). These are client-side levers (inventory: buttons, no forms), so nothing is saved.
- Missing: which of the two halves is the one to believe. The page holds two models one above the other: the PLAN block ("Can the $20k alone do it? Eighteen months", break even month 5, cash final $119,292) and the SCENARIO block ("Benchmark: the six-month simulation", "Cash runs out month 6", "breaks even in month 13, which is 7 months after the money runs out") (081). A reader scrolling sees break even at month 5 and then at month 13 with nothing that says they answer different questions.
- Decoration: none; it is dense and every line is information.
- 390px: works as a column; the plan pills wrap to two lines each (082); the month table scrolls sideways (from the text, 12 columns).
- Promise: none of the 25; it serves the raise (TAKEOVER s6). The honesty rule (no forecast of what a clinician earns) is respected: it forecasts us, not them.
- Defects: **the provenance counts disagree with themselves**: "5 measured · 18 assumed" then "Nothing measured here." directly under it, then "2 measured · 20 decided · 12 guessed" for the plan (081, 082). "Thirty-six months" in the subtitle, "Eighteen months, no round" for the plan, "Every third month. The model computes all 18" under the table (081). Prices shown in EGP under the heading "Prices, in pounds", which in an English UI reads as sterling.

### /admin/actuals  (screenshots: evidence/assess/assess-operator/083, 084)
- For: the company's real books: what was earned against what was spent, month by month, with runway, payroll, capital and costs the product cannot see. Does the screen itself say so? yes, "Earned against spent." and the "Not counted" section is the most honest block in the console.
- Next: add capital, type other costs per month, change a salary, record someone leaving, add an employee (twelve forms, inventory). Not pressed.
- Missing: a clear "this needs typing" call to action: six months of other costs are blank and the page explains it in a paragraph rather than flagging each blank month in the table.
- Decoration: none.
- 390px: the "Where we stand" tiles stack well (084); the month table scrolls sideways.
- Promise: none of the 25; it serves TAKEOVER s6 (payroll, the raise).
- Defects: "Other $100?" in the 2026-09 row, and below it "No figure typed for 6 of them: ... 2026-09" (083): the same month is both typed and not typed. "Runway 0.0 months" in red and "Put in so far: $0" (083): either no capital was ever recorded or the company has none; the page cannot say which, and it is the headline number. "Stripe is in test mode and charges nothing" here, while the Overview says "Stripe is the ledger of record" (002): the two are in flat contradiction. Sessions total 23 here, 21 on the Overview, 18 on the Vault. The payroll lists seven "Example" employees at $500 each (083), seeded names in the founder's books, which TAKEOVER s9 says "a person typed".

### /admin/sponsors/[id]  (screenshots: evidence/assess/assess-operator/086, 087; Habiba Holdings, id found by a read-only SELECT because no console page links here)
- For: one company's pot: balance, coverage, ledger check, refund terms, transfers in and where the pot went. Does the screen itself say so? no title beyond the company name and "company · active · EG entity"; the sections are clear enough once there.
- Next: "Back", which goes to `/admin/transfers` whatever you came from (inventory). Nothing to do here; no top-up, no coverage change, no contact.
- Missing: **a door.** `/admin/sponsors` does not link here, and the only way in is a transfer row that no longer exists once confirmed. This is the page E1 names ("`/admin/sponsors/<id>` lists spend without a single patient name"). Also missing: how many people are on the pot (E1 asks for "how many people used it"; the page counts "6 funded" sessions, not people).
- Decoration: "Contact: None" gets a full card (087).
- 390px: works well, the cleanest page in the console at this width (087).
- Promise: **E1 kept for names**: no patient name appears, only session references, the clinician and the date (086). The balance is shown twice (Pot and Ledger) with "Agrees.", which is the right proof.
- Defects: **the arithmetic on the page does not add up.** $2,850 in (one confirmed transfer, EGP 142,500) less $270 funded (six sessions at $45) is $2,580, and the pot shows $2,330 (086). Both checks say "Agrees." and "Agrees with the ledger." The $250 gap (a fee? VAT? a refund?) is not explained anywhere on the page. Dates here are ISO "2026-09-22" while other pages say "23 Sept" for the same sessions (UTC vs Cairo, unlabelled). "Back" is a bare underlined text link, unlike the arrow back links elsewhere.

### /admin/patients/[id]  (screenshots: evidence/assess/assess-operator/088, 089; Mariam, id found by a read-only SELECT)
- For: one patient's payments, for the operator working a transfer. Does the screen itself say so? "Payments only." Yes, tersely.
- Next: "Back" to `/admin/transfers`. Nothing else.
- Missing: **a door** (only a transfer row reaches it; nothing in the console links a patient). The title is the patient's email address. For a company-covered patient, the pot's share of her sessions (six $45 legs on the sponsor page, if they are hers) is not shown: "TRANSFERS Nothing yet." is the whole page (088), so an operator cannot see what she owes or what was covered.
- Decoration: n/a.
- 390px: works (089).
- Promise: A1, A3 (the rejected sentence the payer reads) would be proved from here, and E3/E5 on the patient side; none visible on this position.
- Defects: an email as a page title (088); "Back" goes to Transfers regardless of origin.

### /staff/sign-in  (screenshots: evidence/assess/assess-support/001, 002, 004, 005; assess-operator/001, 085)
- For: the staff console's own sign-in. Does the screen itself say so? yes, "Staff console. For the 24Therapy team. Clinicians sign in at /login."
- Next: email, password, Sign in; Forgot password. Obvious. Signed in, it lands on `/admin` (operator 001), and opening it again while signed in redirects to `/admin` (085), which is right.
- Missing: nothing a person needs. It sits inside the full public site chrome (patient, company and clinic nav, the Radar button, the marketing footer "Clinical notes, written while you work.") (001), so the staff door looks like one more marketing page.
- Decoration: the public header and footer.
- 390px: works (002).
- Arabic RTL: direction, labels and button are right; the subtitle's "/login." breaks under bidi, the slash and full stop landing on the wrong side (".login/" reads at the line end, 004, 005); the footer's legal column stays in English, "Privacy, Terms, Compliance, Security" (005), matching the missing Arabic legal pages in Site content (058).
- Promise: A5 begins here.
- Defects: bidi on "/login." in Arabic (004, 005); untranslated legal links (005).

## The support persona: promise A5, walked  (screenshots: evidence/assess/assess-support/007 to 044)

`staff.demo@example.com` is role `staff`, status active (read-only SELECT on `users`). Signed in at `/staff/sign-in` exactly as the brief says.

**Where sign-in lands.** Not the console. The sign-in step ended on `/onboarding`, "Verify your practice. One-off, before your first session." (007, 008), the clinician verification form asking a support employee for a country they practise in, a licence number, a government ID, a licence document and a headshot, with "Submit for verification" and a clinician sidebar (Finish verification, Earnings, Billing, Settings). The support agent is treated as an unverified therapist, and the same account is listed on `/admin/therapists` as "Sami Demo, payg, unverified" with Verify and Suspend buttons (009).

**Which console pages support can open** (`requireStaff`): `/admin/support` (014), `/admin/numbers` (010), `/admin/verifications` (011), `/admin/payouts` (012), `/admin/transfers` (013, 044), `/admin/sponsors/[id]` (040) and `/admin/patients/[id]` (041). The support nav has seven items: Overview, Support, Numbers, Verifications, Radar control, Payouts, Transfers (044). **Two of the seven are founder-only**: "Overview" and "Radar control" are in support's own nav and both refuse them. "Back to portal" goes to `/dashboard`, which sends them to onboarding.

**Every founder-only page, opened as support: where it lands and what it says.**

| Opened | Landed on | What it says |
|---|---|---|
| /admin (015) | /onboarding | Verify your practice |
| /admin/actuals (016) | /onboarding | Verify your practice |
| /admin/benefits (017) | /onboarding | Verify your practice |
| /admin/radar (018) | /onboarding | Verify your practice |
| /admin/tv (019; 390px 042) | /onboarding | Verify your practice |
| /admin/errors (020) | /onboarding | Verify your practice |
| /admin/financial-model (021) | /onboarding | Verify your practice |
| /admin/vault (022) | /onboarding | Verify your practice |
| /admin/settings (023) | /onboarding | Verify your practice |
| /admin/audit (024) | /onboarding | Verify your practice |
| /admin/therapists (025) | /onboarding | Verify your practice |
| /admin/sponsors (026) | /onboarding | Verify your practice |
| /admin/usage (027) | /onboarding | Verify your practice |
| /admin/strings (028) | /onboarding | Verify your practice |
| /admin/content (029) | /onboarding | Verify your practice |
| /admin/announce (030) | /onboarding | Verify your practice |
| /admin/ratings (031) | /onboarding | Verify your practice |
| /admin/clinics (032) | /onboarding | Verify your practice |
| /admin/partners (033) | /onboarding | Verify your practice |
| /admin/checkins (034) | /onboarding | Verify your practice |
| /admin/taxonomy (035) | /onboarding | Verify your practice |
| /admin/usage/sessions (036) | /onboarding | Verify your practice |
| /admin/therapists/[id] (037) | /onboarding | Verify your practice |
| /admin/radar/investigate/[id] (038) | /onboarding | Verify your practice |
| /admin/content/[id] (039) | /onboarding | Verify your practice |

The mechanism: `requireRole("super_admin")` redirects anyone else to `/dashboard` (`lib/auth/guard.ts` line 77), and `/dashboard` sends an unverified account to `/onboarding`. `/admin/tv` uses `requireManager`, and support is not a manager, so it lands in the same place.

**A5 verdict: NOT kept.**
- "Redirected rather than shown an error": technically yes, but to the wrong place. The screen says nothing about being refused. It tells a staff member to verify a clinical practice. A support agent who clicks "Overview" in their own nav gets a licence form, and nothing tells them the page exists and is not theirs.
- "The refusal is on the record": **no.** The operator's audit log after all 25 refusals shows exactly one row for `staff.demo@example.com`, `auth · signin` at 03:01 (operator audit re-read), and a read-only SELECT on `audit_log` for that user in the last two hours returns only that sign-in. Not one refusal was written down.
- Also: at 390px the language pill sits on top of the refused screen's title, "Verify your pra..." (042).
- Also seen twice as support: a bare "upstream request failed" page in monospace on white, no chrome, no way back (009 on `/admin/support`, 043 on `/admin/transfers`); both loaded on retry (014, 044). Transient, but the operator's queue is exactly where a blank error costs most.

## Arabic RTL, page by page  (operator, screenshots evidence/assess/assess-operator/091 switch, then 390px on the even step and desktop on the odd step, 092 to 153; counts from the visible text at 390px, steps 154 to 184)

**The console is not translated.** With Arabic chosen, `dir=rtl` is set on every page and no page scrolls sideways at 390px, but the words stay English on 27 of 33 pages. The Strings page meanwhile reports "Arabic 100% ready, 0 missing" (138): console copy is hard coded and outside the translation system, so the 100% is a figure about the rest of the product. What RTL does to English text is the main visible defect: sentence punctuation jumps to the wrong end (".deadline first" 094, "?What did you ask them" 094, ".The manual rail, and the automatic one" 106), numbers detach from their words ("measured · 18 assumed 5" for "5 measured · 18 assumed", 148; "open · 0 waiting on them · 0 overdue · 1 1 nobody owns", 094), money reads "$US 0.07" (092, 093), and ellipsis truncation eats the START of emails and paths ("...asmin.example@example.com" 098; "...dated 21 Sept, 12:07/" for "/for-patients · updated", 132). The mobile nav strip starts from the right with its left end cut ("ns", 092), and on desktop the language pill covers "Back to portal", reading "ck to portal" (093).

| Page | 390px / desktop | Arabic lines / English lines | What is wrong in Arabic |
|---|---|---|---|
| /admin | 092 / 093 | 0 / 13 | all English; "$US" amounts; nav 25 of 29 items English, four in Arabic (الجهات الراعية، العيادات، الشركاء، رسائل الاطمئنان), so the nav mixes scripts row by row (093) |
| /admin/support | 094 / 095 | 0 / 18 | all English; punctuation flipped; the counts line scrambles "1 open ... 1 nobody owns" (094) |
| /admin/numbers | 096 / 097 | 0 / 4 | all English |
| /admin/therapists | 098 / 099 | 0 / 36 | all English; emails truncated from the front; the arrow beside each name is not mirrored (098) |
| /admin/therapists/[id] | 100 / 101 | 0 / 21 | all English |
| /admin/verifications | 102 / 103 | 2 / 18 | English except the country "مصر" |
| /admin/radar | 104 / 105 | 1 / 44 | English; "demo 2" and "live across 1 country 1" with numbers moved to the wrong end (104) |
| /admin/payouts | 106 / 107 | 0 / 19 | English; **the conversion reads backwards**: "EGP 12,750 by InstaPay to → $US 255", the arrow now points from pounds to dollars (106); Reject runs off the card's left edge (106) |
| /admin/transfers | 108 / 109 | 0 / 4 | all English |
| /admin/ratings | 110 / 111 | 0 / 8 | all English |
| /admin/vault | 112 / 113 | 0 / 173 | all English |
| /admin/sponsors | 114 / 115 | translated heading and subtitle; "Habiba Holdings", "company", "active" stay English; "افتح" for Open (114) | partly translated, and one later load returned "upstream request failed" |
| /admin/sponsors/[id] | 116 / 117 | 0 / 25 | all English |
| /admin/patients/[id] | 118 / 119 | 0 / 5 | all English |
| /admin/benefits | 120 / 121 | 0 / 4 | all English |
| /admin/clinics | 122 / 123 | 4 / 2 | translated, only the "active" badge stays English (122) |
| /admin/partners | 124 / 125 | 3 / 0 | translated |
| /admin/checkins | 126 / 127 | 11 / 0 | fully translated, and reads well (126): the one console page that works in Arabic |
| /admin/taxonomy | 128 / 129 | 181 / 5 | country names in Arabic; heading, subtitle and "Countrys" stay English |
| /admin/announce | 130 / 131 | 0 / 18 | all English; the email itself goes out in whatever the operator types |
| /admin/content | 132 / 133 | 10 / 78 | only the Arabic page titles; paths truncated from the front (132) |
| /admin/content/[id] | 134 / 135 | 0 / 147 | all English, including the block guide |
| /admin/settings | 136 / 137 | 10 / 216 | English except "The back office team" section heading (فريق المكتب الخلفي) |
| /admin/strings | 138 / 139 | 1 / 365 | English; the page that manages Arabic is not in Arabic, and says Arabic is 100% ready (138) |
| /admin/audit | 140 / 141 | 0 / 370 | all English |
| /admin/usage | 142 / 143 | 0 / 37 | all English |
| /admin/usage/sessions | 144 / 145 | 0 / 63 | all English |
| /admin/errors | 146 / 147 | 0 / 38 | all English |
| /admin/financial-model | 148 / 149 | 0 / 159 | English; numbers detached from labels (148); the provenance bar does fill from the right, which is correct |
| /admin/actuals | 150 / 151 | 0 / 109 | all English |
| /admin/tv | 152 / 153 | 0 / 6 | all English; the First / Second tabs mirror correctly (152) |
| /staff/sign-in | assess-support 004 / 005 | translated | good, apart from "/login." bidi and the English legal links in the footer |
| /admin/radar/investigate/[id] | not seen | | no report exists to open |

Back to English at the end (185).

## The five screens most in need of redesign, and why

1. **/admin/support.** The queue cannot show a ticket. "Open it to read what they wrote" and nothing opens (004, 006). It is the first queue in the nav, `requireStaff`, the screen a support agent lives on, and it lets them close a ticket they have not read. Rebuild it as a list plus a reading pane, with the person's account linked and the reply written next to what they asked.
2. **/admin/vault, with /admin/payouts.** Eleven reports on one 4,400px page, whose numbers disagree with every other money screen: Omar holds $13 while his $255 payout waits for approval (033, 027), Kareem's paid sessions are missing (013, 033), and collected, sessions and margin each have three values across the console. Split it into money we hold (per clinician, linked to their payout), money we earned, and founder reporting. Put held and owed next to the payout decision (T3).
3. **/admin/therapists and /admin/therapists/[id].** One-click Verify, which skips the verification queue, and one-click Suspend with no reason (009). The detail page's Sessions tab says paid while Billing says nobody paid (013, 014), "No credentials given" appears beside "verified" (015), and staff accounts are listed as clinicians. It needs one clinician record with verification, money and access in agreement, and every consequential action behind a reason.
4. **/admin (Overview) and the navigation.** Twenty-nine flat links, no grouping, no "you are here", three and a half visible at 390px, two of support's seven items refuse them, and `/admin/tv` has no nav item at all. The Overview shows counts nobody acts on and no "waiting for you" list, although the whole rail waits on people (TAKEOVER s9). The console's front door should be the queues, oldest first, with counts that match the queues.
5. **/admin/sponsors and /admin/clinics.** Status and billing-entity changes are grey chips that look like labels and act in one click; "Billed from US" is the button that moves an EG company to the US entity (037, 052). The list has no link to the company page where E1 is proved, and the clinic page shows nothing of seats or the one bill (C3, C4). Close runners-up: `/admin/radar`, where a 550px globe with two dots tops a table whose counts contradict it (021), and `/admin/content`, with 30 rows for 12 pages, all "published" (058).

## Screens with no door (no link reaches them)

- `/admin/tv` (Total View): no nav item and no link anywhere in the console. Reachable only by typing the URL.
- `/admin/sponsors/[id]`: `/admin/sponsors` does not link it. Only a transfer row reaches it, and a confirmed transfer leaves the queue. Found here with a read-only SELECT.
- `/admin/patients/[id]`: the same. Only a transfer row reaches it. No clinician caseload, ticket or payment links it.
- `/admin/radar/investigate/[id]`: only a patient report reaches it, and there are none in any tab (023, 024).
- `/admin/usage/sessions`: reached only from `/admin/usage` ("Every session"), not from the nav. It has a door, but only one.
- For the support persona, `/admin` and `/admin/radar` are in the nav and refuse them, so those links lead nowhere they can go.

## Patterns that repeat across the portal

Bad:
- **Consequential actions in one click with no reason and no confirm.** Verify and Suspend on the clinician list, the radar's power icon, taxonomy country chips, the sponsor and clinic status chips, "Billed from US", "Mint a code", refund icons in the Vault. The console guards its email (type 4 to confirm) better than it guards a person's livelihood.
- **Numbers that disagree between screens, each labelled with confidence.** Sessions in 30 days: 21, 18, 23. Omar's sessions: 11, 12, 14. Collected: $36 and $114.50. Margin: 99.8% and 100%. ONLINE 0 beside "1 live". The pot's own arithmetic ($2,850 - $270 = $2,580, shown as $2,330, "Agrees.").
- **Subtitles written for developers.** "A clinic IS an organisation row, so its clinicians sit in its tenancy.", "one type, two faces", "Cost is what the models charged, from microcents, divided once (C17)", "(21.12)". Many pages say what the data model is, not what the operator does.
- **Placeholders that look like values** (Announce's "Crisis Radar is live" and "4", the payout and verification reason boxes with no labels).
- **Wide tables at 390px** that scroll sideways inside their cards and hide the action column (radar Ban, caseload "Send their record", usage Spend).
- **Unlinked entities.** A clinician on the radar, in the Vault, in Payouts or in Usage is never a link to their clinician page; a patient is never a link; a company list never links its company page.
- **Clinician voice on admin screens** ("from your credit", "taken from your earnings").
- **No "you are here"** in the nav at any width; page titles in at least two sizes.
- **English only in Arabic mode**, with RTL flipping English punctuation and numbers.
- **Seeded data presented as real**: "Example" employees on the payroll, ten sessions stamped 02:22 at 50 minutes, both real clinicians badged DEMO.

Good, worth keeping:
- Rejections that say who reads them: "They see this word for word" (verifications), "The clinician reads this" (payouts), "Reason. They see this" (radar ban). The A3 pattern is designed in.
- Pages that state their own limits honestly: the clinician page's "You cannot read clinical content here", the Actuals "Not counted" section, the content editor's rule for competitor tables, Settings' "Off, the pricing page stops saying so".
- Oldest first on every queue, and said out loud.
- Empty states that are one sentence in a plain card (transfers, benefits, numbers), not a whole illustrated hero.
- `/admin/checkins` in Arabic: proof the console can be translated when the strings go through the system.

## The founder's complaints (TAKEOVER s10), as seen in the console

- **Grey and thin text everywhere:** confirmed. Subtitles, helper text, the privacy card, the adjust-books rule and "Verification is the clinician's own" are all small slate grey (011, 033, 052). The important sentences are the faintest.
- **The teal reading as green:** confirmed. "verified", "active", "published", "paid" and the primary buttons share one teal-green, so a status and a button look alike (009, 033, 058).
- **A price badge reading as part of the price:** confirmed in form. "$0 included", "$4 paid" and "$75 paid" sit as amount plus badge on one baseline (014, 033). And the dotted underline on every amount reads as part of the number.
- **The radar globe appearing empty with two clinicians on it:** confirmed on `/admin/radar`, where 550px of globe carries two dots in Egypt (021, 022).
- **/for-patients showing the same app four times:** not a console screen; not seen. Site content does show `/for-patients` twice per language (058).
- **Five heroes on a homepage:** not a console screen. `/` is two published rows per language in Site content (058).
- **Empty states taking a whole card:** partly confirmed. Ratings' "No ratings yet" and Radar's "Nothing here" take a padded card each (031, 021). Most console empty states are one line.
- **The therapist calendar hiding bookings:** not a console screen; not seen.
- **Dead space and contradictory statuses in the session room:** the room was not seen, but contradictory statuses are the console's main defect (ONLINE 0 and "1 live"; "verified" and "No credentials given"; "paid" and "Nobody has paid them yet").
- **Two overlays in front of a form:** a version of it confirmed. At 390px the language pill sits over the page title on the refused screen (042), and the content editor's sticky Save draft / Publish bar sits over the form (062).
