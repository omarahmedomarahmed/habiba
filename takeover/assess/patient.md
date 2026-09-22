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
