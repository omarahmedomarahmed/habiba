# Patient app, screen by screen

Assessor: `assess-patient`, signed in as Mariam (`mariam.demo@example.com`, employer covers part).
Walked 2026-09-22 on https://24therapy.app with `takeover/walk/step.mjs --run assess`.
Screenshots: `evidence/assess/assess-patient/NNN-*-after.png` (signed-out pages under
`evidence/assess-signedout/assess-patient/`). Each page: desktop full, 390px viewport, 390px full,
in English and then Arabic.

## Orbs at the top, because P5 depends on it

(Filled in at the end of the walk; see "Orbs" below.)

## Pages

### /patient  (screenshots: evidence/assess/assess-patient/001, 002, 003, 004)
- For: the app's home, a launcher for everything (radar, homework, therapists, past sessions, record). Does it say so? no; the header says "Hello, Mariam / Your record is yours", which is a slogan, not a purpose.
- Next: "Find someone now" (the teal radar card) is the obvious primary action, and the centre button of the bottom bar repeats it. What a covered patient most needs next (an upcoming session, what her employer pays) is not on this screen at all.
- Missing: no upcoming session block (Mariam has none, and nothing says "you have nothing booked; book one"); no mention of her employer benefit anywhere on home (and no link to /patient/benefit from anywhere in the app, see "No door"); "Your sessions" is a lone centred text link after six long cards, easy to miss; no heading over the record/journal/summary/consent/export list at the bottom.
- Decoration: "Your record is yours" subtitle; the "You turned the AI on for this session" pill repeated on every one of six past-session cards (same text six times, it is a setting not news); the category tiles "Anxiety / Sleep" with icons; the "Rated highest by patients" section that only says "Nobody has 5 rated sessions yet" (an empty state that takes a whole section, a founder complaint).
- 390px: layout fits, no sideways scroll. SOS orb sits at 62% of the viewport on the right edge and on first paint covers the right edge of the second therapist card (Sara Demo) in the "Therapists here" rail (001-sign-in-after, 003). The bottom bar is translucent and "Past appointments" heading shows through it (001). No payment/session orb because Mariam has no open session. Home is very long: six full past-session summaries push the record, journal, summary, consent and export links to the bottom of a 2700px page.
- Arabic RTL: see Arabic pass below.
- Promise: P1 (radar card, then centre button) and P2 (the place a session or payment should surface). P1: home to radar is one tap, kept so far. P3: every past card shows a paragraph of summary text attributed only to "Sara Demo", with no credentials and no "signed" marker; P3 asks for name and credentials, so not kept on this screen.
- Defects: each past session shows "· $75" (003, 004) for a patient whose employer covers part of it; the home card prints the full list price rather than what she paid, contradicting /patient/billing's own "three numbers, never one" rule. The radar card flips between "One therapist is free this minute" (001) and "Nobody is online right now / Book an hour with someone instead" (002) within a minute; fine as live data, but the "Book an hour" text is not a link to a booking. Desktop (002): a 480px phone column centred in a 1280px window with the SOS orb floating 300px away at the far right edge, and the language switch detached at the top right.

### /patient/account  (screenshots: evidence/assess/assess-patient/005, 006, 007)
- For: her name, photo, phone number (change by request), contact details, and links to consent, billing and documents, plus sign out. Does it say so? yes ("Your account and who can see your record.")
- Next: edit a name or ask to change a number; the three link cards lower down. Obvious enough, but the page leads with two forms and pushes the links (including "What you have paid") below the fold.
- Missing: no link to "Your benefit" (/patient/benefit), which is where Mariam's employer cover lives; the billing card copy "You pay your therapist, never us" is wrong for her, since her employer pays part. No title bar or back (acceptable, it is the "You" tab). Phone appears twice (in "Your number" and again in the Phone/Email/Time zone card).
- Decoration: the large "M" initial avatar; the "Not public..." caption is useful, not decoration.
- 390px: no sideways scroll. SOS orb (at 62% height, right edge) sits on the top right corner of the "Your number" card, touching its heading row (006). Language switch pill crowds the "Mariam Demo" heading (they share the top 60px with no gap). Bottom bar is opaque here but in the full capture (007) it cuts across the "Why are you changing it?" textarea; in real scrolling the textarea passes under the bar, fine.
- Arabic RTL: see Arabic pass below.
- Promise: supports P4 ("who can see your record" link). Nothing it breaks, but the time zone is read only with no way to change it.
- Defects: "You pay your therapist, never us" contradicts Mariam's case (employer share) and /patient/billing's own line "Our share" in each breakdown (see billing). Time zone "Cairo" not editable.

### /patient/assessments  (screenshots: 008, 009, 010)
- For: questionnaires the therapist sent, and past answers. Says so: yes.
- Next: nothing to do (empty). The empty state does not say what to do instead (go to homework, go home).
- Missing: /patient/assessments/[id] could not be opened: Mariam has no assignment, so the questionnaire itself was not seen (no id exists to reach). The subtitle "Your therapist asked you to answer these" is shown even when nothing was asked.
- Decoration: none; but two separate empty states (a card, then a plain paragraph) for one fact.
- 390px: works. SOS orb floats in empty space, covers nothing (009).
- Arabic RTL: see Arabic pass below.
- Promise: none of P1 to P5 directly; supports the clinician's measurement. A screen to argue for.
- Defects: none seen beyond the doubled empty state.

### /patient/benefit  (screenshots: 011, 012, 013)
- For: activating an employer or university benefit with a code, seeing which benefit is active, and asking whether an employer offers one. Does it say so? Half: the page heading is "Activate your benefit" even for Mariam, who is already enrolled.
- Next: for Mariam, nothing; the page still leads with a code field and an "Activate" button (disabled grey until typed) as if she were not covered.
- Missing: **how much her employer pays.** The only line about her cover is "Your sessions are paid for by Habiba Holdings" (013). The seed puts her at 60% company share (`scripts/seed-demo.ts` 1023 to 1031, through `payFromPot`), so she owes 40% of every $75 session. Neither the share, the pot's state, nor what she owes appears here. No link to /patient/billing. And no link reaches this page from anywhere in the app (it is reached only from the employer's QR code, `app/(sponsor)/sponsor/code/page.tsx` 53): a patient who closes it cannot find it again.
- Decoration: the header "Activate your benefit / Enter the code..." is printed twice, as the page heading and again as the card heading with the same sentence (011).
- 390px: works, no sideways scroll. SOS orb sits on the bottom edge of the code card and the top right corner of "What your organisation can and cannot see" (013). The disabled "Activate" button is grey on white.
- Arabic RTL: see Arabic pass below.
- Promise: E3 and E5 are the employer promises that meet the patient here; E1/E2 (what the company never sees) are described here. The "can and cannot see" card lists three sentences with no marker of which is "can" and which is "cannot": "That you are on the list" (can), "Whether you booked, when, or with whom" (cannot), "Only the payment changes..." (a third topic, what happens if removed). Read top to bottom it can say the company sees whether you booked. Not kept clearly.
- Defects: "Your sessions are paid for by Habiba Holdings" is untrue for a partial cover (011, 013); "Your sessions are then paid for" in the subtitle promises full cover to anyone with a code. Page title says "Activate" to an active member. Doorless page.

### /patient/billing  (screenshots: 014, 015, 016)
- For: "What you paid, and exactly where it went." Says so: yes.
- Next: nothing (no controls). No back link either, unlike most inner pages; the only way out is the bottom bar.
- Missing: **the 40% she owes.** Six cards, all "Sara Demo · Covered · 23 Sept 2026 · Your benefit paid for this one. There is nothing for you to pay." (016). The code renders "Covered" for any row whose `fundingSource` is `pot` (`app/(patient)/patient/billing/page.tsx`, the `row.fundingSource === "pot"` branch) and never reads `patientShareCents`; `lib/billing/pot.ts` ~510 says a partly covered session stays `pending` because "the patient still owes their share". So this screen tells a patient who owes 6 x $30 that she owes nothing. Also missing: the session date (every card shows the payment date, 23 Sept, for sessions held 15 Aug to 19 Sep, so no card can be matched to a session), any open or rejected bill (the account link promises "anything still open"), and a link to /patient/benefit.
- Decoration: the "YOU PAID / The headline figure... YOUR THERAPIST IS PAID / The breakdown..." legend at the bottom explains two figures that appear nowhere on the page for Mariam (016).
- 390px: works, no sideways scroll. The SOS orb covers the end of "There is nothing for you to pay" in the fourth card (016). That is SOS over money, the permitted direction; nothing about money sits over SOS.
- Arabic RTL: see Arabic pass below.
- Promise: P2 (a payment confirmation in the app) and E3/E5 on the patient side. Broken: the app contradicts itself about money in three places: home says "$75" per session, billing says "Covered, nothing to pay", the benefit page says "paid for by Habiba Holdings", and the seed says she owes 40%.
- Defects: false "nothing for you to pay" on partial cover (016); payment date shown instead of session date; no back link; legend describing absent numbers. The credit card text in code ("It comes off your next session automatically, and it lasts until") and the FX line ("charged at ... to the") are hard coded English (not shown for Mariam, read in the source).

### /patient/browse  (screenshots: 017, 018, 019)
- For: finding a therapist by area or by typing. Says so: yes ("Find a therapist").
- Next: tap "Anxiety 2" or "Sleep 2", or type. Obvious, but this is the "Therapists" tab and it shows no therapists: home's "See everyone" link lands here and "everyone" is two pills (018).
- Missing: a list of therapists on arrival (there are only two); an indication of who is free now (the radar knows); price. Most of the 390px screen is empty below the pills.
- Decoration: "Only areas a verified therapist has actually listed. The number is how many." is an explanation of a count, in small grey.
- 390px: works; SOS floats in empty space.
- Arabic RTL: see Arabic pass below.
- Promise: P1 indirectly (an alternative to the radar). Not a shortcut: home > Therapists > category > card > profile is already four taps before any booking.
- Defects: "See everyone" on home leads to a page that shows nobody.

### /patient/claim  (screenshots: 020, 021, 022)
- For: taking ownership of notes a therapist already keeps about you. Says so: yes.
- Next: nothing to claim for Mariam; no next step offered.
- Missing: the empty state has no way forward ("Nothing to claim yet. Nobody has written you down under this number or address." and then nothing: no "ask a therapist you saw", which exists on /patient/consent). It also contradicts home, which labels its link to this page "Claim another record" beside "1 therapist file attached".
- Decoration: none.
- 390px: works (021).
- Arabic RTL: see Arabic pass below.
- Promise: P4. Kept only as a statement.
- Defects: dead end empty state.

### /patient/consent  (screenshots: 023, 024, 025)
- For: who may read your history, requests waiting for an answer, inviting a new therapist by code, and asking a past therapist to add what they hold. Says so: yes ("Who can read your history").
- Next: "Invite a therapist" and "Ask them"; both are clear, but four stacked sections with no summary line make the page long (025, about 1500px at 390).
- Missing: nothing structurally; "Who has access: Nobody can" sits oddly beside home's "1 therapist file attached" (the difference, reading vs holding, is not explained on either screen).
- Decoration: the three step numbered explainer (1 You make a code, 2 They enter it, 3 You decide) before the button; the two "A THERAPIST YOU ALLOW / YOU ASK" tick-and-cross tables. The crosses are red, the same red as SOS, used for something that is good news (things a therapist cannot do).
- 390px: works; SOS orb sits on the heading row of "Who has access" and the top right of its card (025). The "Ask them" button is disabled and pale grey on white, low contrast (025).
- Arabic RTL: see Arabic pass below.
- Promise: P4 ("the patient decides who may read the history"). Kept: nobody has access and the controls to grant are here.
- Defects: red crosses for reassurance; disabled button contrast.

### /patient/homework  (screenshots: 026, 027, 028)
- For: the small steps agreed with the therapist, marked done or not. Says so: yes ("What to try").
- Next: press "I did this" or "I could not do this one" (not pressed: both record something). Obvious.
- Missing: who set each step and when, and until when (no therapist name, no date, no "before your next session" although home's card says "To try before your next session"); what happens after pressing (no history of what was marked); "Four nights. Pick them now." asks to pick nights but offers no way to pick them. The INVENTORY lists a link to /patient/assessments on this page; it did not show for Mariam (no assignment).
- Decoration: "Nobody is counting." (the buttons are a count).
- 390px: works. SOS orb covers the top right corner of the third card, next to "Two times, written down" (028); the buttons sit below it and remain reachable.
- Arabic RTL: see Arabic pass below.
- Promise: none of P1 to P5 directly. Supports the clinical relationship; worth keeping but it should say who asked.
- Defects: the first card has a teal border and the others do not, with no explanation (028).

### /patient/journal  (screenshots: 029, 030, 031)
- For: private notes between sessions, typed or dictated. Says so: yes.
- Next: write and "Save this" (not pressed). Obvious.
- Missing: nothing essential. Past entries have a date but no way to edit or delete one (seen: none offered).
- Decoration: none; the "Who can open this" card is information and it is good (it states the current truth: nobody).
- 390px: **the SOS orb sits on the writing box.** At 390 the orb's default place (62% of the height, right edge) lands on the lower right of the textarea, just above "Say it instead" (030). Somebody writing in the journal has a red button over the field they are typing into; the orb is draggable, but nothing says so.
- Arabic RTL: see Arabic pass below.
- Promise: P4 in spirit ("shown to nobody unless you choose"). Kept.
- Defects: SOS over the textarea (030). The entry date "23 Sept, 02:22" is the seed time (today), fine.

### /patient/messages  (screenshots: 032, 033, 034)
- For: turning check-in messages ("how are you?") on or off, and what happens to replies. Says so: partly; the title names the messages but not how they arrive (SMS, WhatsApp, email?), from whom, or how often.
- Next: "Send them" / "Do not send them" (not pressed). Which one is currently on is not stated: "Send them" is navy filled and "Do not send them" pale, which reads as a primary and a secondary button rather than a current state (033).
- Missing: the current setting in words; the channel and frequency; a door: nothing in the app links to this page (no reference to `/patient/messages` anywhere in `app/`, `components/` or `lib/`).
- Decoration: none; the tick/cross card is the useful part (a reply that sounds like danger shows help and tells the therapist; otherwise nobody reads it; no machine interprets it).
- 390px: works; SOS floats below the buttons, covers nothing (033).
- Arabic RTL: see Arabic pass below.
- Promise: P5 in part (a reply that sounds like danger points to help) and P3 ("never given to a machine to interpret"). Kept in words.
- Defects: React hydration error #418 in the console on this page (032 to 034 run); ambiguous on/off state; doorless.

### /patient/notices  (screenshots: 035, 036, 037)
- For: the in-app list of things that happened (invitations, payments, sessions starting), the P2 inbox. Says so: no; the page is "What has happened" and one line, "Nothing to tell you." (036).
- Next: nothing.
- Missing: a door (no link to `/patient/notices` anywhere in the app: not on home, not in the bottom bar, not on account); a subtitle saying what would appear here. And content: six sessions were paid from her employer's pot today, each leaving her a 40% share, and none of that is a notice.
- Decoration: none.
- 390px: works; almost the whole screen is empty.
- Arabic RTL: see Arabic pass below.
- Promise: P2 ("nothing only in an email"). This is where P2 should be kept and it cannot be: it holds nothing, and nobody can find it.
- Defects: doorless; empty while a payment event exists; a 502 on one resource load on the desktop look (035 run).

### /patient/profile  (screenshots: 038, 039, 040)
- For: documents a clinician added about her (letters, prescriptions, reports), readable and flaggable by her. Says so: yes, though "Your profile" is the wrong name for a document list (the account page calls the same link "Your own documents", home calls it "Open your profile").
- Next: nothing. The empty state says "Letters, prescriptions, scans and old reports belong here." and there is no way to put one here: the upload control was removed on purpose (`components/documents/own-profile-panel.tsx` 17 to 30). The account card that leads here still says "Anything you have uploaded or written down about yourself."
- Missing: an honest empty state ("your therapist adds these"); the journal card "Want to say how things have been? Write a journal instead" does not look like a link (no arrow, no link colour) though it is one (040).
- Decoration: the journal nudge card, as placed.
- 390px: works (040).
- Arabic RTL: see Arabic pass below.
- Promise: P4 ("travels with you, you decide who reads it"). Kept in words; nothing to see.
- Defects: three names for one page (Your profile / Your own documents / Open your profile); empty state invites an action that does not exist; account copy promises uploads that were removed.

### /patient/radar  (screenshots: 041, 042, 043)
- For: who is free right now, on a globe and as a list, to start a session now (P1). Says so: no title; the only header is a pill "2 therapists on shift". "Find someone now", the name home gives it, appears nowhere on the page.
- Next: tap a therapist row (chevron). Obvious enough on mobile, where the list is visible under the globe.
- Missing: a title; a back link (it is the centre tab, so tolerable); on 390 the "Not an emergency service. If you are in immediate danger..." line is in the text but not visible in the viewport or the full capture (under the bottom bar, 042/043); for Mariam, the price she would actually pay (rows show list prices $60 and $75, never her 40% share).
- Decoration: the globe. At 390 it takes the top 60% of the screen and shows two overlapping teal dots on Egypt, a few pixels each (042): the founder's "radar globe appearing empty with two clinicians on it" is confirmed. Chips "Demo account" and "Practice" on each row.
- 390px: **the SOS orb sits on the "Everyone on shift" tab** of the 2 free / Everyone on shift switch, covering its right end (042); that tab is still pressable on its left half. No sideways scroll. The two therapist cards reach the bottom bar; with a third therapist the list would scroll under it.
- Arabic RTL: see Arabic pass below.
- Promise: P1. Home (1 tap, the teal card or centre button) > radar > therapist row (2) > profile or booking; continued under /patient/t/[id].
- Defects: desktop (041): the language switch covers the end of the hint "Drag to spin, tap a country to ..." (clipped mid sentence); the bottom bar crosses the two side panels; "Omar Abdelgaw..." truncated in the list although there is space. "Demo account" chip is shown to patients on production.

### /patient/record  (screenshots: 044, 045, 046)
- For: emailing yourself a copy of your whole record, and what the practice (Nile Practice) can and cannot see. Says so: yes ("Your whole record ... in one document you can keep"). Home's link calls it "Get a copy of everything"; the page title (metadata) is "A copy of your record"; the heading "Your whole record": three names.
- Next: "Email me my record" (not pressed: it sends). Clear.
- Missing: a download in the app. The only route is an email, and Mariam's address is `@example.com`, so for her (and six other demo accounts) the copy goes nowhere; for a real patient it is P2's "only in an email" in reverse. What her EMPLOYER can see is not here (it is on /patient/benefit, which has no door).
- Decoration: two tick and cross tables (red crosses again); "Not hidden behind a setting: it is not built."
- 390px: works. SOS orb covers the right end of "Emailed to mariam.demo@example.com and nowhere else" (046), just above the Email button, which stays clear.
- Arabic RTL: see Arabic pass below.
- Promise: P4 (one record, every version) and C2's patient side (what the practice sees). "That they are paying for your hour" under NILE PRACTICE reads, to a patient whose employer pays, as if the practice pays for her session; it means the practice pays the therapist. Misleading on the one screen about who sees what.
- Defects: "the day and time of each appointment" starts lowercase on its own line (the "And:" label does not render in the text, 046); three names for one page; practice-pays line.

### /patient/residency  (screenshots: 047, 048, 049)
- For: asking a patient whose record "belongs to Egypt" to agree to it being held in the United States. Says so: yes, plainly.
- Next: "I understand, and I agree" (not pressed: it records consent). There is no "No" and no statement of what happens if she does not agree; "You can withdraw at any time" but no withdraw control shows until after agreeing.
- Missing: a door. Nothing in the app links here (no reference to `/patient/residency` outside its own files), so a consent the product says it asks "explicitly" is on a page nobody is sent to. Mariam has not agreed, and her record is already in the US. A decline option.
- Decoration: none.
- 390px: works (048).
- Arabic RTL: see Arabic pass below.
- Promise: none of P1 to P5; a legal duty rather than a promise. Worth keeping, but it must be reached.
- Defects: "kept in United States" / "servers in United States" (missing "the"); React hydration error #418 on this page (048 run); doorless; consent with only a yes.

### /patient/sessions  (screenshots: 050, 051, 052; Upcoming tab: see the extra looks below)
- For: every session, past and upcoming, in tabs All / Upcoming / Past. Says so: yes.
- Next: nothing. Cards are not links: no way from a past session to its summary, its receipt, or what she owes on it; no "book again with Sara".
- Missing: payment state per session. Each card says "· $75" (051) while the session is 60% covered and 40% owed (`lib/billing/pot.ts` ~510, session stays `pending`); there is no "you owe $30" and no pay link anywhere. No upcoming session and, on "All", no empty line saying so. Who signed the summary text (P3).
- Decoration: "You turned the AI on for this session" pill on every card (six times); the calendar icon before each name; "Sessions you booked." subtitle (she did not book these; her therapist did).
- 390px: works, no sideways scroll. The SOS orb sits across the right edge of the second card and its summary text (051). The list is the same component and the same six cards as home, so home and this tab duplicate each other.
- Arabic RTL: see Arabic pass below.
- Promise: P2 (a session starting, a payment confirmed, in the app) and P3 (signed summaries). P2: no payment state at all on this screen. P3: the summary paragraphs carry only "Sara Demo", no credentials, no "signed on".
- Defects: list price shown instead of her share; nothing owed shown while money is owed; times "02:22 (Cairo)" are seed artifacts but show that nothing sanity-checks a session at 2 am.

### /patient/summary  (screenshots: 053, 054, 055)
- For: the clinical summary, version by version, under each author's name. Says so: yes.
- Next: nothing to do; reading. No link back to the sessions it summarises or to "who can read your history".
- Missing: "signed" wording (the card shows name, credential, version and date, which is enough for P3, but it never says signed or draft); a way to flag or question a line.
- Decoration: none. This is the best-made page in the portal: one card, one author, one date.
- 390px: works (055). SOS floats below the card, covers nothing.
- Arabic RTL: see Arabic pass below.
- Promise: P3 and P4. P3 kept here: "Dr Sara Demo, Clinical psychologist, Version 1, 20 Sept 2026". Note that the same clinician is "Sara Demo" (no title) on home, sessions, billing and the radar; only here is she "Dr".
- Defects: in the accessible text, name and credential run together ("Dr Sara DemoClinical psychologist").

### /patient/invite/[token]  (screenshots: 056, 057, 058; a made-up token, since no real invite exists for Mariam)
- For: opening a therapist's invitation to take over your record. With a bad token it says "This link is no longer valid. Used, expired, or taken back. Ask your therapist for a new one." (057)
- Next: ask the therapist; there is no button (no "go home", no "open your sessions", no way to contact the therapist). The bottom bar is the only exit.
- Missing: a way forward; the valid-invite state (create account / sign in / "Joining as") could not be seen without a real token.
- Decoration: none.
- 390px: works; card centred vertically, the SOS orb sits just under its bottom right corner (057).
- Arabic RTL: see Arabic pass below.
- Promise: P2 (an invitation appears in the app) and T4's patient side. Not testable here without a real invitation.
- Defects: a token that never existed is told it was "used, expired, or taken back", which is not true; dead end card.

### /patient/t/[id]  (screenshots: 070 (from browse), 071 desktop, 072 390 full; Sara Demo's page, /patient/t/561c6496-7cef-4933-8059-42a6727ede64)
- For: one therapist's page: who they are, start now, or book an hour. Says so: yes, by its content (no heading beyond the name).
- Next: "Start a session now" (teal, not pressed: it opens the booking sheet and holds the clinician) or pick an hour slot (not pressed). Clear.
- Missing: her credential ("Clinical psychologist" is on the summary page but not here); what Mariam would pay after her employer's share (the page shows $75 twice and EGP 3,750, never her 40%); what a slot press does before it does it.
- Decoration: 60 identical slot buttons over ten days (14:00 to 19:00 every day), three per row, making the page 2200px at 390 (072); "Copy this page's link" as a full width button directly under the main action.
- 390px: **the SOS orb sits on the bottom right corner of "Start a session now" and the right end of "Copy this page's link"** (070). No sideways scroll.
- Arabic RTL: see Arabic pass below.
- Promise: P1 (start now) and E3 (a price shown is a price owed). E3 is at risk for Mariam: "30 minutes, starting now $75" and "One hour $75" are both shown, the same price for half and a whole hour, and neither is her share.
- Defects: same $75 for 30 and 60 minutes (070); headline "Trauma and grief, Arabic and English" while "Works with: Anxiety, Sleep" (070) and the browse card says the same; "Sara Demo" with no "Dr" here but "Dr Sara Demo" on /patient/summary.

### The radar booking sheet (reached from /patient/radar by pressing a therapist row; screenshot 076)
- For: the profile and "Pay $X and start now" in one sheet, without leaving the radar.
- **Opening it is not looking.** Pressing a row reserves the clinician for 60 seconds ("They now show as busy to everyone else", `pbook.heldBody`; `HOLD_SECONDS = 60` in `components/radar/booking-sheet.tsx` 36). I pressed Sara's row twice while assessing (073, 076). On the second press the sheet showed Sara to me as "Being booked. Someone is on this profile now" (076), apparently my own hold from 073 (the headless browser closed without releasing it), and the header dropped to "1 therapist on shift" while the tab still said "2 free". The hold lapses on its own after 60 seconds; I did not press anything inside the sheet.
- **SOS is covered.** The sheet is portalled into `document.body` at `z-[100]` (`booking-sheet.tsx` 172), above the SOS orb's `z-[70]`. In 076 the SOS orb is gone from the screen. In the bookable state the same sheet carries "Pay $75 and start now" and a "Held for you · 60s" countdown: money, on top of SOS. The only way back to SOS is to close the sheet.
- Missing in the sheet: the price she would actually pay after cover; a credential line (shown only if `entry.credentials`, blank for Sara).
- Defects: "See their full profile" goes to `/t/<id>`, the public page, not `/patient/t/<id>`, so a signed-in patient leaves the patient app's chrome from here.

### The SOS sheet (opened from the orb on /patient/journal; screenshot 074)
- Opens in one tap, no network: "Help now. These are phone numbers, not a chat." A red Egypt card "نجدة 105 مصر · Egypt, Press 1 for Arabic, then 1 for mental health", then "Anywhere else, call your local emergency number." It chose Egypt from Mariam's +20 number, correctly. It covers the lower half of the screen and dims the rest, including the language switch. Nothing about money appears in it. This is the one crisis surface that fully keeps P5.
