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

### /clinic/people  "Your clinicians"  (screenshots: 018, 019)
- For: see the practice's clinicians and their verification state, invite one, remove one. Does the screen say so? partly: there is no page H1; the first thing is a card titled "Your clinicians".
- Next: invite (form below) or "Remove from the practice" per row. Obvious, but the destructive action is the only per-row action and is repeated three times at the same weight as body text, directly under each name.
- Missing: no page title. No seat price, no seat count, no word "seat" at all, although C1, C3 and C4 are all about seats; the manager cannot tell from here that removing someone releases a paid seat or what it will save. No list of pending invitations visible (the code has a revoke control; none showed on the demo). No link to the public radar to see the clinician is listed (C1 "on the radar the same hour" is not observable from the portal). No confirmation wording visible before pressing Remove (not pressed, so unknown).
- Decoration: none much; the email under each name is information.
- 390px: works, no sideways scroll; the email wraps beside the name and the badge drops to its own line, so the three rows have three different shapes (019). "Remove from the practice" is indented relative to the name.
- Arabic RTL: see the Arabic section below.
- Promise: C1 (verification state on the row: yes, "Verified" green, "Verification in progress" amber). C4 (a seat that leaves): the only control is "Remove from the practice", which does not say what happens to the seat, the bill, or the clinician's ability to keep working. C2: no patient counts here. Kept.
- Defects: desktop full-page screenshot shows the white rail stops at the viewport height and the page below it is grey, so the rail looks cut off on a long page (018). Invite form inputs span the full 900px card width on desktop for a first name (018).
