# Clinic portal assessment

Persona `assess-clinic`, signed in as `habibaheikal27@gmail.com` (practice "Nile Practice"), 2026-09-22.
Screenshots under `evidence/assess/assess-clinic/`. Nothing was submitted, invited, removed, released or exported.

Shared chrome, true of every signed-in page: a left rail on desktop (practice name, six links, Sign out, language switch, and a
standing "THIS PORTAL WILL NEVER SHOW YOU" list with red crosses); on 390px the rail becomes a top strip of tabs that scrolls
sideways with no cue, so "Your team" and "Your record system" are cut off at the right edge ("Y..." in EN, "نظام" in AR).
No SOS orb on this portal (deliberate, `app/(clinic)/layout.tsx`). No page in the portal has a breadcrumb; the rail is the only way around.

### /clinic/sign-in  (screenshots: evidence/assess/assess-clinic/001, 002, 004, 005)
- For: the practice manager signs in. Does the screen itself say so? yes ("Your practice", "I run a clinic" chip selected, navy side card "Your therapists, your seats, your billing.")
- Next: type email and password, press Sign in. Obvious. "No account yet? Create one" leads to the enquiry form (/clinic/apply), which is not an account; the words promise something the next page does not do.
- Missing: no "forgot password" link at all. No hint that invited clinicians sign in elsewhere (they belong at the clinician door; a clinician landing here has no pointer).
- Decoration: the "WHICH ARE YOU?" chip row and the "Not what you are?" line below the navy card say the same thing twice. The navy card's three ticks are marketing on a sign-in page; the third ("move a patient between your own clinicians") promises a patient-level action this portal does not have (the portal never shows patients beyond a shortened name and cannot move anyone).
- 390px: works; no sideways scroll. The language switch is not on the mobile header (it is behind the hamburger), so the only visible way to Arabic is inside the menu (002).
- Arabic RTL: layout mirrors correctly (004, 005). Footer "Privacy", "Terms", "Compliance", "Security" stay in English in the Arabic page (004 bottom, 005).
- Promise: none directly; the door to C1 to C5.
- Defects: "Create one" mislabels an enquiry as account creation (001). The navy card's "move a patient between your own clinicians" claim is not backed by any screen in the portal (001). Untranslated footer legal links (004). One 502 console error on load (step 001 output: "Failed to load resource: 502").

### /clinic  "This week"  (screenshots: 006 to 017; empty week 007, 008, 010; populated week 016, 017)
- For: the week's appointments across the practice's clinicians, plus a weekly sessions/spend line. Does the screen say so? yes: H1 "Who is coming, and when", sub "Your clinicians' appointments: a name and a time, because you pay for the hour." The rail link says "This week" but the H1 says something else; two names for one page.
- Next: page weeks with Earlier / Later, or "Download as a spreadsheet". Opening lands on the CURRENT week, which on the demo is empty ("No appointments this week.", 010) while the card below says "Week of 21 Sept 2026 · 5 sessions · Nothing to pay". The first thing the manager sees is an empty week beside a count of five sessions for the same week; the explanatory line ("Counted by the week each session was billed...") is grey small print. There is no "Today" / "back to this week" control once you page away.
- Missing: no time zone on the times (they are rendered in UTC: "16 Sept, 23:22" is 02:22 on the 17th in Cairo, `formatDateTime(at, "UTC")` in `app/(clinic)/clinic/page.tsx`). Rows are not grouped by day or by clinician. No filter by clinician. The "Sessions and spend, by week" card does not follow the Earlier/Later week: it always shows the same list regardless of which week is on screen (016 vs 010).
- Decoration: the two stat tiles "Booked this week 3" and "Clinicians on the rota 2" (016, 017) take two full-width cards on 390px for two single digits that the list directly below already shows. The "THIS PORTAL WILL NEVER SHOW YOU" block repeats on every page.
- 390px: no sideways page scroll; nav strip clipped at the right (016). Earlier / Later buttons: their label sits high in the button, not vertically centred (016, 017). Tiles stack into two tall cards.
- Arabic RTL: direction correct, Earlier/Later mirror correctly (007, 008). "5 جلسة" is wrong Arabic plural (should be "5 جلسات") (007, 008). Clinic name "Nile Practice" stays Latin, acceptable as a proper name. A cancelled row would print the raw status word `cancelled` untranslated in both languages (code: `{row.status}` rendered as-is).
- Promise: C2 (no caseload count, no patient name). **Not kept as written.** Evidence, week of 14 Sept 2026 (016, 017; text in steps 011 to 014):
  - Patient first name plus last initial on every row: "Nadia D", "Tarek D", "Mariam D".
  - Beside each, the clinician's FULL name: "Kareem Example", "Sara Demo".
  - Beside each, the appointment date and time: "16 Sept, 23:22", "17 Sept, 23:22", "18 Sept, 23:22".
  - Countable per clinician: each row pairs one patient with one clinician, so the week's list is a per-clinician caseload by counting (14 Sept: Kareem 1 patient, Sara 2; weeks of 7 Sept, 31 Aug, 24 Aug: Nadia D with Kareem and Mariam D with Sara every week, which exposes a recurring weekly pattern per named patient across weeks by paging Earlier).
  - "Booked this week 3" and "Clinicians on the rota 2" tiles are practice-wide counts, not per clinician, but with two clinicians and three rows the split is trivial.
  - The code (`lib/data/clinic.ts` `shortenForClinic`, C327) says first name plus last initial is the founder's deliberate choice, defended by telling the patient. C2's "Proved when" says no patient name on any screen. The two cannot both stand: the founder must pick.
  - Minor code/comment mismatch: the comment says "van der Berg" becomes "Sarah B"; the code takes the first character of the whole surname string, which gives "Sarah v".
- Export control (not pressed): a white outline button "Download as a spreadsheet" (`/clinic/export?what=schedule`), shown only if the manager has the export capability, with the line "Every export carries your name and the time you took it, and shows nothing this screen does not." The route (`app/(clinic)/clinic/export/route.ts`) exports a fixed window of 90 days back and 90 days forward, while the screen shows one week, so the file carries about 26 weeks of patient-initial plus clinician plus time rows in one go; "nothing this screen does not" is true of columns, not of volume.
- Defects: empty current week beside "5 sessions" for the same week (010). Times in UTC with no label (017). Usage card ignores the week pager (016). "5 جلسة" (008). Untranslated `cancelled` status (code). Earlier/Later label off-centre (017).

### /clinic/people  "Your clinicians"  (screenshots: 018, 019, 035, 036)
- For: see the practice's clinicians and their verification state, invite one, remove one. Does the screen say so? partly: there is no page H1; the first thing is a card titled "Your clinicians".
- Next: invite (form below) or "Remove from the practice" per row. Obvious, but the destructive action is the only per-row action and is repeated three times at the same weight as body text, directly under each name.
- Missing: no page title. No seat price, no seat count, no word "seat" on the demo (the only seat text in the code, "This seat is not billed until {date}...", appears only for a seat not yet billed), although C1, C3 and C4 are all about seats; the manager cannot tell from here that removing someone releases a paid seat or what it will save. No list of pending invitations visible (the code has a revoke control; none showed on the demo). No link to the public radar to see the clinician is listed (C1 "on the radar the same hour" is not observable from the portal). Remove has an inline confirm step (from code, see below; not pressed).
- Decoration: none much; the email under each name is information.
- 390px: works, no sideways scroll; the email wraps beside the name and the badge drops to its own line, so the three rows have three different shapes (019). "Remove from the practice" is indented relative to the name.
- Arabic RTL: see the Arabic section below.
- Promise: C1 (verification state on the row: yes, "Verified" green, "Verification in progress" amber). C4 (a seat that leaves): the only control is "Remove from the practice", which does not say what happens to the seat, the bill, or the clinician's ability to keep working. C2: no patient counts here. Kept.
- Defects: desktop full-page screenshot shows the white rail stops at the viewport height and the page below it is grey, so the rail looks cut off on a long page (018). Invite form inputs span the full 900px card width on desktop for a first name (018).
- Arabic RTL (035, 036): mirrors correctly; badges "موثّق" and "التوثيق جارٍ" sit at the far left as they should. Latin names and emails left as typed. Works.
- Remove control, described from code and not pressed: the first press opens an inline confirm reading "They move to their own practice now, and any meeting account they connected here is disconnected." (`clinic.removeConfirm`). It says nothing about the seat, the next bill, or that the clinician keeps working, which is exactly what C4 promises.

### /clinic/bills  "Your bills"  (screenshots: 020, 021, 037, 038)
- For: the practice's invoices, one total per period. Does the screen say so? yes: "Your bills" / "A total for the period, never a line per session: itemising would tell you which patients turned recording on."
- Next: nothing to do; there is no pay, no status, no "download this bill". The only control is "Download as a spreadsheet".
- Missing: the bill has no seats on it. It shows "1 Sept 2026 · 5 sessions · Platform fee $0.00 · AI fee $0.00 · Total $0.00" (020). No seat line, no seat price, no number of seats, no period end date, no status (paid, due, overdue), no invoice number, no way to pay or to see a card on file. "1 Sept 2026" alone does not say whether it is the period start, the issue date or a month.
- Decoration: the justification sentence under the H1 is an argument, not information; it belongs in a help line.
- 390px: works (021). Large empty grey area below one card.
- Arabic RTL (037, 038): mirrored correctly. Money is in Arabic-Indic digits ("US$ ٠٫٠٠") while the date and count on the same card are in Western digits ("1 سبتمبر 2026", "5 جلسة"): two numeral systems on one card. "5 جلسة" wrong plural again.
- Promise: C3 (one bill for the practice, priced per seat, seats on it are the seats filled). **Not kept on screen.** One bill for the practice: yes. Priced per seat: nothing on the screen shows a seat. The "5 sessions" count is the only quantity, so the bill reads as per session, which is the opposite of the promise. C4 (a released seat lowers the next bill by exactly one seat) is unobservable here for the same reason.
- Export control (not pressed): same outline "Download as a spreadsheet" button (`/clinic/export?what=bills`), no watermark sentence under it on this page, unlike /clinic.
- Defects: no seat line (020). Mixed numerals (037). "5 جلسة" (037).

### /clinic/earnings  "Earnings"  (screenshots: 022, 023, 039, 040)
- For: what each clinician has earned here and what they withdrew. Does the screen say so? yes: "What your clinicians have earned" / "Their share of the sessions they ran here, and the withdrawals they made. You cannot withdraw for them."
- Next: nothing; read only. Fine for its job.
- Missing: no period (all time? this month? since joining?). No date on any figure. Kareem Example shows $0.00 although the rota shows him seeing Nadia D every week (011 to 014); nothing explains why (probably covered sessions), and the manager will read it as a bug. No link from a clinician here to their row on /clinic/people.
- Decoration: "COMBINED $382.50" hero card is a full-width card for one number; "No withdrawals yet." repeated three times is an empty state per row.
- 390px: works (023).
- Arabic RTL (039, 040): mirrored; money in Arabic-Indic digits, consistent on this page. Works.
- Promise: C5 (earnings per clinician, not their patients). Kept: per-clinician totals, no patient anywhere. C2 caution: a per-clinician money total is a caseload proxy. The invitation page tells clinicians the practice also sees "What you charge for a session" (`clinic.join.sees.prices`); total divided by price is a session count per clinician. The portal as walked does not show prices anywhere, so that line on the invitation is itself a claim with no screen behind it.
- Defects: unexplained $0.00 for a clinician with weekly bookings (022 vs 017). No period stated.

### /clinic/team  "Your team"  (screenshots: 024, 025, 041, 042)
- For: make staff roles with capabilities and put people in them. Does the screen say so? yes: "Your team" / "Who works here and what each of them can reach. Nobody here reaches anything from inside a session."
- Next: name a role, tick capabilities, "Add this role". Then presumably invite staff by email (that form appears only after a role exists; not seen). Reasonably obvious.
- Missing: the capability list offers "See activity reports", but no activity report page exists in the portal. The yellow note says "Buying seats and inviting clinicians stay with you", but there is no screen anywhere in the portal to buy a seat. The empty state "You have no roles yet" sits above an always-open form rather than behind an "Add a role" button.
- Decoration: the yellow note is useful but styled as a warning.
- 390px: works (025). Nav tab for the current page ("Your team") is cut off at the right edge, so on this page the active tab is barely visible ("Y" in navy).
- Arabic RTL (041, 042): works; checkboxes on the right; text translated.
- Promise: none of C1 to C5 directly; it supports the "admin sees no clinical data" posture. A screen to argue for in a small practice (one person runs it).
- Defects: capability with no destination ("See activity reports"). "Buying seats" refers to a flow that does not exist in the portal.

### /clinic/records  "Your record system"  (screenshots: 026, 027, 043, 044)
- For: connect the practice's EHR once. Does the screen say so? yes.
- Next: nothing is possible: "This deployment cannot hold a connection yet. It needs no client registration and no token sealing key." This is a dead end with no alternative, no contact, no date.
- Missing: any action; the vendor picker and connect form from the inventory do not render. The yellow sentence is engineering jargon and grammatically says the opposite of what is meant ("needs no ... key" meaning "has no ... key").
- Decoration: the three-paragraph explanation card for a feature that cannot be used.
- 390px: the content column is narrower than every other page and inset differently (027 vs 021); the active tab "Your record system" is entirely off-screen in the nav strip (027: only "Y" shows, and it is not the highlighted one).
- Arabic RTL (043, 044): the key sentence is half English: "لا يستطيع هذا النشر حفظ ربط بعد. يحتاج no client registration and no token sealing key." with the full stop landing on the wrong side (043). Active tab "نظام" clipped at the left edge.
- Promise: none of C1 to C5. A screen to hide until the deployment can hold a connection, or to argue for.
- Defects: untranslated fragment (043). Developer-facing copy shown to a practice manager (026). Inconsistent page width (026). Active tab off-screen on mobile (027, 043).

### /clinic/apply  "Bring your practice to 24Therapy"  (screenshots: signed in 028, 029, 045, 046; signed out 051, 052, 054, 055, 056)
- For: a practice with no account asks to be called. Does the screen say so? yes: "Tell us about the practice and we will call you. Nothing is set up until we have spoken."
- Next: fill seven fields, "Ask us to call". Obvious.
- Missing: signed out, the page has NO site header, NO logo, NO footer, NO language switch and NO way back to the site (051, 052, 055, 056). A visitor who arrives from "Create one" or from /for-clinics is on a bare form. Signed in, the same page opens inside the portal chrome (028, 029): an existing practice manager is offered a form to bring their practice to 24Therapy, with nothing saying they are already here.
- Decoration: the "A PRACTICE MANAGER HERE" card repeats the ticks and crosses; signed in, the crosses appear twice on one screen (card plus rail footer, 029).
- 390px: works; no sideways scroll (056).
- Arabic RTL (045, 051, 052): translated and mirrored; "24Therapy" inside the Arabic heading sits correctly. On desktop the ticks and crosses split into two narrow columns that wrap every line into two (052).
- Promise: C1's upstream. Honest about C2 in a way the portal is not: it tells a prospective practice "Each clinician's appointments: a name and a time" (056).
- Defects: no header, logo or language control when signed out (051, 056). Offered to a signed-in manager inside the portal (028).

### /clinic/join/[token]  "You have been invited"  (screenshots: signed in 030, 031, 047, 048; signed out 053, 057; only an invalid token was available)
- For: an invited clinician accepts, sets a password or links an existing account. Does the screen say so? For an invalid token it says only "That invitation is no longer valid. Ask the practice for a new one."
- Next: for an invalid token, nothing: no link to sign in, to the site, or to the clinician door. A dead end (053, 057). The message says "no longer valid" for a token that never existed.
- Missing: signed out, no logo, no header, no language switch (053). Signed in as a manager, the invitation page opens inside the manager's portal chrome (031), which is the wrong person's shell.
- Valid-token content, from `lib/i18n/messages.ts` (not seen live): "What {name} will be able to see: Your calendar: who is coming and when; Each patient's first name and last initial; Whether you are on the radar and taking sessions; What you charge for a session; Your earnings totals; A log of withdrawals". This is the second place the product itself tells someone the practice sees patient first name plus last initial, directly against C2's wording. It also promises the practice sees radar status and session prices, neither of which any portal screen shows.
- 390px: works (it is one card).
- Arabic RTL (047, 053): translated, mirrored.
- Promise: C1 (the clinician's side of being added). Not verifiable without a real token.
- Defects: dead end with no way out (053, 057). No logo or language control when signed out.

## Summary

### Five screens most in need of redesign
1. **/clinic (This week).** It is the landing page and it carries the C2 conflict: patient first name plus last initial, beside the clinician's full name, beside a date and time, row by row, pageable back through every week (017). It opens on an empty current week next to "5 sessions" for that week (010), shows UTC times without saying so, has two tall stat tiles for single digits, and a spend card that ignores the week pager. The founder has to decide C2 first; the layout (rota by day and clinician, or aggregate only) follows from that decision.
2. **/clinic/bills.** C3 promises a per-seat bill; the screen shows sessions and fees and no seats at all (020). No status, no pay, no period. It has to be redesigned around seats.
3. **/clinic/people.** The seat is the unit of the business and the word "seat" does not appear. Remove is the only row action and its confirm says nothing about the bill or the clinician continuing to work (C4). No radar link for C1. No page title.
4. **/clinic/records.** A dead end with a developer error message, half untranslated in Arabic (043). Hide it or give it a real state.
5. **/clinic/apply and /clinic/join/[token] signed out.** Bare pages with no logo, header, language switch or way back (051, 053). The join error is a dead end.

### Screens with no door
- /clinic/join/[token]: reached only from an invitation email; nothing in the product links to it (by design, but the invalid-token state has no way out either).
- /clinic/export: no page, reached only by the download buttons (not opened).
- /clinic/apply is linked from /for-clinics, the pricing tiers and "Create one" on the sign-in page, but from no page inside the portal (correctly), yet it opens inside the portal chrome if a signed-in manager lands on it.
- No screen for buying or adding a seat exists, although the team page refers to "Buying seats"; no screen for "activity reports" exists, although a role can be granted it.

### Patterns that repeat
- Good: every page has a plain H1 in the manager's words (except /clinic/people). The "THIS PORTAL WILL NEVER SHOW YOU" list is honest and consistent. Arabic is almost fully translated and RTL mirroring of layout is correct everywhere. No sideways page scroll anywhere at 390px. Money and names are shown plainly; no invented statuses.
- Bad: the 390px nav strip scrolls sideways with no cue and does not scroll the active tab into view, so on Team and Records the current page is off-screen (025, 027, 043). Every page carries an argumentative sub-line explaining why something is NOT shown ("itemising would tell you...", "We publish no figure for a quiet period...") in grey small type, which is the founder's "grey and thin text" complaint. Cards used for single numbers (Booked 3, Rota 2, Combined). Arabic session counts use the singular ("5 جلسة"). Two numeral systems on one card in Arabic (money Arabic-Indic, dates Western). Public door pages lose the site chrome once you leave sign-in. The rail's white background stops at the viewport height on long desktop pages (018).
- The seat, which is what C1, C3 and C4 are about, is invisible across the whole portal.

### Founder complaints (TAKEOVER s10) seen here
- Grey and thin text everywhere: **confirmed**. Sub-lines, explanations, the rail list and card footnotes are all slate-500 at 12px (010, 020, 022).
- Teal reading as green: **confirmed** on "Verified" badges (pale green-teal, reads as green) and the "Send the invitation" and "Add this role" buttons (018, 024).
- Price badge reading as part of the price: not seen (no price badges in this portal).
- Radar globe empty with two clinicians: not seen (the portal never shows the radar; C1 cannot be checked from here).
- Same app shown many times / five heroes: not applicable here.
- Empty states taking a whole card: **confirmed**. "No appointments this week." is a whole card (010); "No record system is connected." is a whole card (026); "No withdrawals yet." sits inside every earnings card (022); "You have no roles yet." (024).
- Calendar hiding bookings until a day is expanded: not applicable; the clinic rota shows rows flat, but opens on the current (empty) week so the bookings are one press away (010).
- Dead space and contradictory statuses: **confirmed** in spirit: "No appointments this week." above "Week of 21 Sept 2026 · 5 sessions" (010); Kareem $0.00 earned beside weekly bookings (022).
- Two overlays in front of a form: not seen; no sound-alarm pop-up appeared on this portal.
