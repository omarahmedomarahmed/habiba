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
