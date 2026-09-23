# Public site and partner portal, assessed

Persona `assess-public`, signed out throughout, run `assess`. Screenshots are under
`evidence/assess/assess-public/`. Walked 2026-09-22 against https://24therapy.app.
Four looks per page: desktop English, 390px English, 390px Arabic, desktop Arabic. No form
was submitted anywhere. Opening the radar's booking sheet and the radar's List tab were the
only presses, and neither changes anything.

Working notes (filled in page by page below):

- A transient 502 on a Next.js chunk turned `/radar` into "Something went wrong" once
  (002); the retry loaded. The same 502 appears in the console on `/for-clinics` and `/hipaa`.
- The radar count moved between 0, 1 and 2 across loads because other walkers were going on
  and off shift. What I describe is what each screenshot shows.

### /  (screenshots: evidence/assess/assess-public/006 desktop EN, 040 390 EN, Arabic below)
- For: telling four kinds of visitor what 24Therapy is and sending each to their door. Does the screen itself say so? Partly. The headline "24Therapy is the record layer for the person who owns it" is a category statement, not what a visitor gets; the paragraph under it is entirely about the patient radar, while the page underneath is mostly for clinicians, clinics and companies.
- Next: "Open the radar" (patient) or "How it works for patients". The four audience tabs under the hero (Patients, Therapists, Clinics, Companies) swap the hero phone, but a therapist has to know to press "Therapists"; the only therapist call to action is "Create your account" at the very bottom, 12,000px down at 390.
- Missing: an SOS orb (there is none on the homepage at either width, while /radar has one); a label on the hero phone saying its three "FREE NOW" clinicians (Dr Nour Demo, Dr Karim Example, Dr Salma Demo) are invented. That sentence exists only in section 02 ("running on invented data"), so the first thing a patient sees is three fake clinicians marked free now. A clinic or company visitor has no call to action anywhere on the page.
- Decoration: the "[ 01 ] WHICH ARE YOU?" and "[ 02 ] HOW IT WORKS" monospace bracket eyebrows; the browser-chrome dots and fake URL bars on every mockup; the stock 9:41 status bar; the dotted background grid.
- 390px: works, no sideways scroll. Problems: the dark transcript mockup is mostly empty navy (a 400px dark block with two lines in it); the clinic "One set of books" table crushes at 390, "Dr Karim Example" and "Omar S." wrap over three lines and the rows clip at the card edge; the competitor tabs (SimplePractice, TherapyNotes, Upheal, then Mentalyc and Lyra Health off-screen) scroll sideways with no cue.
- Arabic RTL: see the Arabic section below.
- Promise: P1 (the radar card says "Three taps from opening it to being in a session"), T1, T2, C1, C2, C3, C5, E1, E2 are all first stated here. Keeps: T1 and T2 are demonstrated honestly. Breaks C2 on its own page: the "One set of books" clinic mockup has a PATIENT column with "Mariam A.", "Omar S.", "Laila F.", "Tarek M.", "Dina H.", "Adam R." in the clinic portal, directly under the card that says the practice "does not supervise their patients". The "What you will never see" company card renders a sidebar and an EMPTY main panel, so the promise E2 is illustrated by a blank.
- Defects:
  - Company card "What you will never see" has an empty right panel at desktop and at 390 (006, 040).
  - Clinic mockup shows patient names (006 tile 3, 040), contradicting C2 and /for-clinics "a wall your practice cannot see through".
  - "4 CLINICIANS of 11 seats" beside "$792 billed": 11 x $72 is $792, so the mockup bills for 7 empty seats, while C3 is proved only when "the seats on it are the seats that were filled".
  - "HIPAA BAA included" on two pricing cards contradicts /hipaa, which says no BAA is signed and the product "is not yet HIPAA compliant".
  - Pricing appears in full on the homepage (three cards, a comparison table, a second "Sign up free"), duplicating /pricing.
- Claims and honesty (lib/content/honesty.ts): nothing here would be refused; no fee-cover sentence and no earnings forecast. Time promises and absolutes, quoted:
  - "Three taps from opening it to being in a session."
  - "Add a clinician and they are on the radar the same hour."
  - "SOAP note in under a minute"
  - "No card, no onboarding wizard. Sign up and start a session in under a minute."
  - "Prices change; if one of these is out of date, tell us and it is corrected the same day."
  - "Take it off the record for a minute and nothing in that minute is kept."
  - "it says draft on every screen until you sign it."
  - "You never see who went, and there is no screen behind this one that does."
  - "Your patient never pays us anything."
  - "No account, no waiting list, no form about your insurance." / "No account, no card, no form. You give a first name and you are in a session."

### /for-patients  (screenshots: 007 desktop EN, 041 390 EN, Arabic below)
- For: telling somebody in therapy that the record is theirs and that they can find a clinician now. Does the screen say so? yes, "Your therapy record, and it is actually yours".
- Next: "See who is online now" (to /radar) or "Sign in". Obvious. There is no "Create an account" for a patient on this page at all, only "Sign in", even though the FAQ says an account is needed to keep your history.
- Missing: an SOS orb (none at either width, on the page written for patients); a way to try the claim and grant flows other than the Back/Next stepper; any mention on the hero phone that its three "FREE NOW" clinicians are invented.
- Decoration: the shield icon and "For patients" pill above the heading; the lightning and people icons on the two feature cards; five phone frames.
- 390px: no sideways scroll. "The phone beside this is the app" is wrong at 390, where the phone is below. The hero phone and the "What it actually looks like" phone are the SAME radar screen stacked one after the other (041 sheet 0), so a phone user scrolls past the identical mockup twice in a row. The claim and grant phones are mostly white space below two cards (041 sheet 1). The footer links are 12px grey.
- Arabic RTL: see the Arabic section below.
- Promise: P3 ("You never talk to the AI", "Nothing written by a machine reaches you unsigned") and P4 ("It moves with you", "One record, however many therapists") are stated here, T5 too. Said clearly; this page cannot prove them. P5 is not served: no orb.
- Defects:
  - The app is drawn five times over eleven sections: hero radar phone, "What it actually looks like" radar phone (identical), sessions phone, claim phone, grant phone (007, 041). The founder's "same app four times over eleven sections" is still true and now five.
  - "Every session, note and summary, emailed to you, never over WhatsApp." contradicts /integrations/whatsapp ("Every message this product sends goes through one function that tries WhatsApp and email, and sends on both where both exist. Most patients here have no email address at all") and P2 ("Nothing the product tells you is only in an email").
  - "It is still there in three years. Nothing is deleted and nothing expires." contradicts /hipaa: "Clinical records are retained until deleted by the practice."
  - "No screen in the patient app types to a model, and the import graph is what stops it." is engineering jargon aimed at a patient.
  - The step-through widgets start at "Step 1 of 5" with a disabled Back and a small Next; the phone beside them only changes when Next is pressed, which nothing invites.
- Claims and honesty: nothing honesty.ts would refuse. Time promises and absolutes, quoted:
  - "hand it to the next therapist in one tap, and take that back just as fast."
  - "nothing in it asks you for an account." (the same hero has a "Sign in" button)
  - "Take it back and it stops that second."
  - "Nothing is deleted and nothing expires."
  - "There is no chatbot here, and there will not be one"
  - "After five minutes you are offered somebody else at the same price or less, or your money back."
  - "No, and there is no screen anywhere that ends in them having access."
  - "You are sent a message every time one starts" and "ending it takes one tap."
  - "stopping it takes one tap and no explanation."

### /for-therapists  (screenshots: 008 desktop EN, 042 390 EN, Arabic below)
- For: selling the clinician the transcript, the note, risk flags, the copilot and the radar. Says so: yes, "Finish the note before you leave the room."
- Next: "Start free" (to /signup), repeated at the bottom with "Four fields and you are in". Obvious. "What it costs" jumps to the pricing cards further down.
- Missing: nothing structural; it has a "Not what you are?" footer that routes to the other audiences, which the homepage lacks.
- Decoration: the six "[ 0N ] SECTION" monospace eyebrows; browser-chrome dots and fake URLs on every mockup; the "For therapists" pill.
- 390px: no sideways scroll. The transcript mockup is a tall navy block with two lines and ~250px of nothing (042 sheet 0). The copilot mockup renders twice (once in the hero room, once in section 04) and the phone mockups repeat the patient pages (sessions phone, radar phone with the same three invented clinicians).
- Arabic RTL: see below.
- Promise: T1, T2 (said and demonstrated), T5 (copilot "reaches your notes on this patient and no further"), T3 is not mentioned here at all (no word about netting; only "Withdraw what you have earned").
- Defects:
  - The risk-alert mockup's fake URL bar reads "24therapy.app/radar" (042 sheet 0, also on /features); a risk alert lives in the session room, not on the public radar.
  - "HIPAA BAA included" on the Therapist card, contradicting /hipaa.
  - "Nothing rides on the recording question" under the $80 button is unexplained.
- Claims and honesty: honesty.ts would NOT refuse anything here, but one heading is a near miss of the earnings rule: "Fill a free half hour from the radar." The checker only matches "fill your calendar/diary/caseload"; this is the same forecast (that the radar will bring you a booking) in words it does not catch. Also "Go on the radar and take a session in the next minute" on /login. Time promises and absolutes, quoted:
  - "the note is drafted by the time you stand up."
  - "SOAP note in under a minute"
  - "It is a draft and it says so, on every screen, until a clinician has read it."
  - "Take it off the record for a minute and nothing in that minute is kept."
  - "It reaches your notes on this patient and no further."
  - "a patient never pays us anything for the software."

### /for-clinics  (screenshots: 009 desktop EN, 043 390 EN, Arabic below)
- For: telling a practice manager that seats, verification and one bill live here, and the clinical record does not. Says so: yes, "Several clinicians, one practice, one set of books".
- Next: "Talk to us", which actually goes to /clinic/apply (an application form), and "Contact" (/contact). A button labelled "Talk to us" that opens an application is mislabelled; the manager does not know they are starting a sign-up.
- Missing: the price. The page never says $72 a seat, a month; a manager has to find /pricing from the footer. No sign-in link for an existing practice (the hero has none; /clinic/sign-in is reachable only from the Sign in menu). The page is short (2,700px at 390): hero, one mockup, five questions.
- Decoration: browser-chrome dots, the "For clinics" pill.
- 390px: no sideways scroll, but the mockup table crushes: "APPOINTMENTS" runs into the next tile, clinician names wrap over three lines, the third row is cut at the card bottom (043).
- Arabic RTL: see below.
- Promise: C1, C2, C3, C5. C2 is BROKEN by the page's own hero mockup: a PATIENT column with "Mariam A.", "Omar S.", "Laila F.", "Tarek M.", "Dina H.", "Adam R.", directly under "a wall your practice cannot see through". /clinic/sign-in adds "See the rota and move a patient between your own clinicians", which is the opposite of the wall. C3 is muddied by "4 clinicians of 11 seats, $792 billed".
- Defects: patient names in the clinic mockup (009, 043); "Talk to us" goes to /clinic/apply; no price.
- Claims and honesty: nothing honesty.ts would refuse. Absolutes, quoted:
  - "The clinician treating them. Not a colleague, not a practice manager, not us, and there is no administrative override."
  - "Their access ends with their account, and their patients hand the record on themselves."
  - Honest and good: "A clinic-level export into your own system is not built." and "Egyptian data staying in Egypt is designed and not live."

### /for-companies  (screenshots: 010 desktop EN, 044 390 EN, Arabic below)
- For: telling an employer they fund a pot and never learn who went. Says so: yes, "Cover therapy for your people, and never learn who went".
- Next: "Talk to us" (to /sponsor/apply, again an application behind a conversation label) or "Contact". Twice each.
- Missing: any price or the $100 welcome credit (TAKEOVER s6); how a pot is topped up (the Egyptian rail is manual, which a buyer would want to know); a sign-in link for an existing company.
- Decoration: the "What has been spent, by week" chart is eight coloured squares of identical height with no axis and no figure, one hatched (044). It shows nothing.
- 390px: works. Stat tiles fit; "LEFT IN YOUR POT" wraps to two lines.
- Arabic RTL: see below.
- Promise: E1, E2 stated plainly and well ("You watch the money, not the people", "Weekly totals, with small figures suppressed"). A weakness in E1 as drawn: "Where the money went" lists each named therapist and what they were paid ($840, $660, $540, $360). With a small staff and one clinician who speaks a rare language, a per-therapist total can identify who went; the page does not say this list is suppressed for small figures the way the weekly totals are.
- Defects: "USED IT 40 this month" is a monthly figure on a page promising "A weekly figure, never a daily one" (not a contradiction, but the dashboard shows monthly and the copy promises weekly); /sponsor/sign-in says "Watch the pot, the spend and the take-up, month by month", a third cadence.
- Claims and honesty: nothing honesty.ts would refuse. Absolutes, quoted:
  - "We tell you what it cost, and nothing else."
  - "You never see who went, and there is no screen behind this one that does."
  - "Any individual, ever" (under "never show you")
  - "Spendable on sessions here, never withdrawable as cash"

### /pricing  (screenshots: 011 desktop EN, 045 390 EN, 074 the EGP reveal at 390, Arabic below)
- For: the clinician's price, in two ways, plus the clinic seat price. Says so: yes, "One product, priced two ways".
- Next: "Sign up free" (x3), "Talk to us" for a clinic (to /clinic/apply). Obvious.
- Missing: nothing for a patient or a company, which is right, but the page does not say so; a company visitor who lands here from the footer finds nothing about pots.
- Decoration: the second full-width "Sign up free" under the three cards; the "How we compare" section is a sixth block on a page that already has cards, a matrix and a seat ladder.
- 390px: no page scroll sideways, but the "What is in each" matrix is wider than the screen and clips the Therapist and Clinic columns at the card edge with no scroll cue (045 sheet 0: "THE", "$80", "Noth", "Inclu"). The competitor tabs clip the same way.
- Arabic RTL: see below.
- Promise: T3 is here, and stated correctly as netting: "While we hold your earnings the session fee comes out of them. Where Stripe pays you directly, we bill you instead." and "Can I pay my 24Therapy bill out of my earnings? Yes. When we are holding your earnings the session fee comes out of them automatically." Kept in words.
- Defects:
  - THE PRICE BADGE: every USD price has a dotted underline and hides the EGP figure behind a hover or tap. Tapping "$80" (074) swaps the big figure to "EGP 4,000" and pops a small navy "$80" badge that sits on top of the "One clinician" subtitle, overlapping it. The badge reads as part of the price. Founder complaint confirmed. On a touch screen nothing says the price can be tapped.
  - "HIPAA BAA included" appears on two cards and as a row of ticks in the matrix, and the FAQ on /features says "Is a BAA included? Yes, on every plan." /hipaa says "not yet HIPAA compliant" and lists every BAA as "not yet signed". This is the most serious false claim on the public site.
  - "What does the session rate actually include? ... plus the copilot questions about that patient shown on the cards above". No card shows a number of copilot questions.
  - "It lasts as long as the pricing page says" is written on the pricing page itself; the figure ("Credit lasts 12 months") is in a different block.
  - "Your first completed session is free either way" (here) vs "Your first session is free" (home, /for-therapists): the word "completed" matters and is only here.
- Claims and honesty: honesty.ts refuses nothing here. The fee rule is respected: there is no claim that a session covers the fee; "Divide the monthly price by what one session with AI costs you" gives the break-even without forecasting income. "Get booked on the Crisis Radar. Patients find you and book you" is the allowed form. Time promises and absolutes, quoted:
  - "SOAP note in under a minute"
  - "Prices change; if one of these is out of date, tell us and it is corrected the same day."
  - "Your patient never pays us anything." (the booking sheet on /radar charges the patient "$75", which goes to the clinician; true, but the sentence reads as "free for patients")
  - "Nothing is deleted, nothing is locked, and every note, patient and recording stays exactly where it was."
  - "We do not cut anything off mid-month over a card that expired."
  - "Where you have a Stripe account the money is charged straight into it and we never hold it."

### /features  (screenshots: 014 desktop EN, 048 390 EN, Arabic below)
- For: the clinician's feature list. Says so: yes, but with an overclaim, "The whole product is one screen".
- Next: "Start free for therapists" (/signup) or "Sign in" (/login). Obvious.
- Missing: it is almost a copy of /for-therapists: same hero room mockup, transcript, copilot, risk alert, note, patient sessions phone. A reader who has seen one has seen the other; neither page says why both exist.
- Decoration: an icon tile above every heading (microphone, brain, warning, document); fake URL bars.
- 390px: no sideways scroll. The copilot mockup is ~250px of white with one sentence (048 sheet 0).
- Arabic RTL: see below.
- Promise: T1, T2, T5 described. "Alerts go to you and only to you" is the risk promise.
- Defects:
  - "Is a BAA included? Yes, on every plan." is false against /hipaa.
  - Risk-alert mockup's URL reads "24therapy.app/radar".
  - "The whole product is one screen" is contradicted by the same page listing a patient app, a profile, homework and a separate note view.
- Claims and honesty: nothing honesty.ts would refuse. Absolutes and time promises, quoted:
  - "The whole product is one screen"
  - "so each line is attributed with certainty" / "so two similar voices are never confused."
  - "One tap stops capture without ending the session. Nothing recorded, nothing transcribed, nothing stored."
  - "Alerts go to you and only to you."
  - "A dropped chunk costs a few seconds of transcript, not the session."
  - "Is a BAA included? Yes, on every plan."
  - "Every line traceable to the session it came from."

### /contact  (screenshots: 013 desktop EN, 047 390 EN, Arabic below)
- For: writing to a person, and knowing which legal entity you deal with. Says so: yes, "Write to a person".
- Next: fill the form and press Send (not pressed). Obvious.
- Missing: a phone number (the page's own template has a `tel:` link, INVENTORY, and none renders); a stated reply time, which is honest but leaves "a clock on it" meaning nothing to the reader.
- Decoration: the envelope icon and "Contact" pill; "Who are you writing to?" is a required-looking choice between two entities followed by "Both reach the same team.", so the choice does nothing.
- 390px: works. "What is this about?" defaults to "Something else" rather than asking. The native "Choose File / No file chosen" control is unstyled.
- Arabic RTL: see below.
- Promise: none of the 25 directly; it is the way out of every dead end, and it states the crisis limit well ("Do not send anything urgent here ... If you need somebody now, open the radar").
- Defects: no phone number; the entity selector is noise.
- Claims and honesty: nothing honesty.ts would refuse. Response-time sentences, quoted:
  - "Every message here goes into a queue somebody owns, with a name against it and a clock on it."
  - "This reaches a person during working hours, not in the next ten minutes."
  - "Sunday to Thursday, 09:00-18:00 UTC" / "Sunday to Thursday, 10:00-19:00 Cairo"
  - "read only by the person answering you, and never used to train anything."

### /security  (screenshots: 012 desktop EN, 046 390 EN, Arabic below)
- For: how the product is built to protect data. Says so: yes.
- Next: nothing; there is no link to /hipaa from the body, only in the footer as "Compliance".
- Missing: the "We say what is not finished" card promises "The compliance work still in progress is named on this page rather than implied to be done", and this page names none of it; it is on /hipaa.
- Decoration: a double header. The page renders a plain "Security / How 24Therapy is built and operated." header and then a second dark hero "Compliance · Security" with the lock icon (046). Same on /hipaa ("Compliance" then "HIPAA, in progress"), /privacy and /terms.
- 390px: works; long grey paragraphs.
- Arabic RTL: the English page carries an Arabic notice ("This page is in English because the legally binding text is the English text...") set in a left-aligned LTR paragraph, so its full stop lands at the wrong end and the lines ragged-right (046). In the Arabic view see below.
- Promise: A5 ("A role is a list, not a rank, and every read is written down") is stated here word for word. Stated; not provable from this page.
- Claims and honesty: nothing refused. Response time and absolutes, quoted:
  - "Email security@24therapy.app. We will acknowledge within two business days."
  - "Opening a chart appends a row to a log nobody can edit, including us."
  - "Signing out, changing a password or resetting a password revokes every existing session immediately."
  - "Application logs contain request identifiers, never transcript text, note content, patient names or crisis indicators."
  - "There is no session replay and no client-side analytics."

### /hipaa (footer "Compliance")  (screenshots: 015 desktop EN, 049 390 EN, Arabic below)
- For: where the company stands on HIPAA. Says so: yes, and it is the most candid page on the site.
- Next: nothing; no link to contact for the "region inside your jurisdiction is available on request".
- Missing: the "table below" it refers to ("Until every row in the table below reads signed") is a paragraph of prose, not a table.
- Decoration: double header as /security.
- 390px: works. Long unbroken paragraphs; the subprocessor list is one 350-word paragraph that should be a list.
- Arabic RTL: English only with the Arabic notice, as /security.
- Promise: none of the 25, but it is the page that makes three others false: "HIPAA BAA included" (/pricing, /, /for-therapists), "Is a BAA included? Yes, on every plan." (/features), "Each of these is a subprocessor covered by a business associate agreement." (/privacy).
- Defects:
  - "Until every row in the table below reads signed, do not put protected health information into this product." The product is live and taking therapy sessions; the rest of the site invites clinicians and patients to do exactly that.
  - "Clinicians cannot delete a patient or a session" here vs /privacy "Clinicians can export or delete a patient record from the patient page. Deletion removes the chart" vs /for-patients "Nothing is deleted and nothing expires" vs "Clinical records are retained until deleted by the practice" on this same page. Four statements, three answers.
- Claims and honesty: nothing refused. Quoted: "sessions expire after 30 minutes of inactivity and 8 hours absolute"; "We will tell you the day that changes rather than leaving you to check."; "Database point-in-time recovery currently covers the last 24 hours".

### /privacy  (screenshots: 016 desktop EN, 050 390 EN, Arabic below)
- For: the privacy policy. Says so: yes.
- Next: nothing.
- Missing: anything addressed to a patient who booked from the radar without an account.
- Decoration: double header.
- 390px: works.
- Arabic RTL: English only with the notice.
- Promise: P4 and the ownership story, which it contradicts (below).
- Defects:
  - Placeholder text live on production: "This page is a starting point maintained by your administrator, not legal advice. Review it with counsel before you accept a real patient." (same sentence on /terms).
  - "Each of these is a subprocessor covered by a business associate agreement." is false against /hipaa ("none of them is signed yet").
  - "Clinicians can export or delete a patient record from the patient page." contradicts /hipaa and the patient-owns-the-record story.
- Claims and honesty: nothing refused. Absolutes quoted: "Nobody else at 24Therapy reads a note unless you ask us to look at something."; "are never used to train anything."; "we do both rather than pointing at a clinician."

### /terms  (screenshots: 017 desktop EN, 051 390 EN, Arabic below)
- For: the clinician's terms. Says so: yes, "The agreement between 24Therapy and the clinicians who use it."
- Next: nothing.
- Missing: terms for patients, companies and clinics, all of whom pay or book here.
- Decoration: double header.
- 390px: works. Arabic: English only with the notice.
- Promise: T1 in legal form ("Every note ... requires review and approval by the licensed clinician"). Good and honest about crisis detection: "They can miss risk and can raise false alarms. They do not contact emergency services".
- Defects: the same "starting point maintained by your administrator, not legal advice" placeholder.
- Claims: "can be cancelled at any time".

### /radar  (screenshots: 003 and 018 desktop EN, 004/005 List tab, 052 390 EN, 075 booking sheet, Arabic below)
- For: finding a verified clinician who is free this minute and being in a session. Says so: only as "2 therapists on shift" and "Drag to spin, tap a country to filter"; there is no heading that says what this page is or what happens when you press a name. The page title in the tab is "Crisis Radar, talk to a therapist now"; the page itself never says "crisis" or "talk now".
- Next: press a clinician row, which opens the booking sheet (075): first name, optional email, "Pay $75 and start now". Obvious once found; the list sits in a side panel on desktop and under the globe on 390.
- Missing: an empty state that helps. With nobody on shift (003) the page says "No one on shift", "0 showing", "Nobody matching that is on shift", "0 other clinicians are available right now." and a "Show everyone" button that shows the same nothing. No "book an hour instead", no link to browse clinicians who are off shift, no crisis line in the empty state itself (only the one-line footer "Not an emergency service"). For a page a person may reach in distress, the empty state is four ways of saying nobody.
- Decoration: the globe. At 1280 it takes ~560px square in the middle of the screen for two dots that sit on top of each other in Cairo (018); at 390 it takes the whole first screen with ~200px of empty navy above it (052). "Drag to spin" is an instruction for the decoration.
- 390px: no sideways scroll. The SOS orb sits over the globe's right edge and, on the list, close to the row chevrons but not on them (052). The list is under a collapsible "2 free / Everyone on shift" sheet.
- Arabic RTL: see below.
- Promise: P1 (three taps to a session: row, name, pay; that is three if the payment is instant, and it is not on the Egyptian rail) and P5 (the SOS orb is present here and on /t). C1 (a clinic seat appears here with its verification state): the rows show "Practice" and "Demo account" chips but NO verification state; the "Licence checked" line exists only on /t.
- Defects:
  - THE GLOBE READS EMPTY WITH TWO CLINICIANS: both dots are in Egypt and overlap into one mark, on a globe turned to show Europe and Africa (018, 052). Founder complaint confirmed.
  - Opening the booking sheet is not neutral: it shows "Held for you · 60s ... They now show as busy to everyone else. Finish, or close this page." (075). A signed-out visitor who merely opens a clinician's row takes them off the radar for everybody for a minute. I opened Sara Demo's sheet three times during this walk (twice to find the /t link, once for 075), so Sara was held three times for 60s. Anyone can empty the radar by opening sheets.
  - The booking sheet says "Stripe takes the payment, we never see your card." Egypt has no card processor (TAKEOVER s9); an Egyptian patient is told about a rail that is not theirs.
  - "Demo account" chips on live public rows (Omar Abdelgawad, Sara Demo). Honest, but a real patient sees two demo accounts as the entire supply.
  - The English language filter uses the US flag.
  - The count moved 0, 1, 2 across my loads; a transient 502 once replaced the whole page with "Something went wrong ... Try again" (002).
- Claims: "Not an emergency service. If you are in immediate danger, call your local emergency number." Good. "Held for you · 60s" is a time promise to the patient.

### /t/561c6496-7cef-4933-8059-42a6727ede64 (Sara Demo)  (screenshots: 019 desktop EN, 053 390 EN, Arabic below)
- For: one clinician's public profile, with "start now" and bookable hours. Says so: yes by its shape (name, "Available now", languages, price).
- Next: "Start a session now" or pick an hour in "Book a session". Obvious. "Copy this page's link" is a good second action.
- Missing: a way back to the radar (no back link; only the header "Radar" button); what happens after picking an hour.
- Decoration: the "SD" initials tile.
- 390px: works, but the SOS orb sits on top of the right end of "Copy this page's link" (053). The hour grid is 8 days x 6 identical slots, 14:00 to 19:00, a 1,500px wall of buttons at 390.
- Arabic RTL: see below.
- Promise: C1 verification state is here: "Licence checked with Egyptian Psychological Association, August 2026 / We checked their documents. We do not rate their clinical work." Good and honest. "Turned up to 100% of 7 booked sessions." is a real, checkable figure.
- Defects:
  - "30 minutes, starting now $75" and "One hour $75" on the same page: the same price for half the time, with nothing saying why.
  - The headline "Trauma and grief, Arabic and English" disagrees with "Works with: Anxiety, Sleep" directly under it.
  - No "Demo account" label here, although the radar row carries one.
- Claims: "Available now"; "Turned up to 100% of 7 booked sessions."

### /integrations  (screenshots: 020 desktop EN, 054 390 EN, Arabic below)
- For: which outside systems connect, and honestly which do not. Says so: yes, "Most of the names below say not built, and they are on this page anyway".
- Next: a card to its detail page, or "Ask for consent" to /developers. At 390 the section tabs ("What connects today", "HR systems", "Record systems", "G...") scroll sideways and clip.
- Missing: nothing structural.
- Decoration: a letter tile ("W", "S", "B") on each of ~40 cards where a logo would be.
- 390px: no page scroll; tabs clip (054).
- Arabic RTL: see below.
- Promise: none directly; it is the most honest page on the site.
- Defects:
  - "Your clinic's own system ... An approved note files into the record system you already use" is listed under "Partly working", while /for-clinics says "Pushing a note into the record system you already use ... marked as not built."
  - Epic, Oracle Health, athenahealth "BUILT, NO TENANT YET" in amber beside grey "NOT BUILT": three states and two colours, and the amber reads like a warning.
- Claims: "We never receive a name, a department, a salary or a leaver reason, and there is nowhere in our database to put one."

### /integrations/whatsapp  (screenshots: 021 desktop EN, 055 390 EN, Arabic below)
- For: what WhatsApp does today. Says so: yes, "Partly working".
- Next: "All integrations" back link. Good, it has a way back.
- Missing: nothing.
- 390px: works.
- Promise: P2. It says "Every message this product sends goes through one function that tries WhatsApp and email, and sends on both where both exist" and "Until one is approved that particular message does not arrive, and the screen that depends on it says so in those words". This supports P2 and contradicts /for-patients "never over WhatsApp".

### /developers  (screenshots: 022 desktop EN, 056 390 EN, Arabic below)
- For: the partner API. Says so: yes, "Build on the clinical record layer".
- Next: /partner/apply ("Ask us to call"). There is no link to /partner/sign-in anywhere on this page.
- Missing: a sign-in door for an existing partner.
- Decoration: none; it is dense and specific.
- 390px: no page scroll, but every code block clips on the right with no visible scroll affordance (056: "GET /api/partner/v1/subjects/YOUR-REF/readers" cut, JSON lines cut mid-word).
- Arabic RTL: see below.
- Promise: T5 and P3 carried to partners ("Never a draft. Never model output nobody signed."); A5 ("An audit trail on both sides").
- Claims and time promises, quoted:
  - "single use, two minutes, then a one-hour session for that clinician"
  - "You set a number of sessions a month and we never go past it. We alert your contact at 80% and again at 90%."
  - "a revoked grant closes that door in the same instant it closes ours."
  - "If what you want is not here, it is not because we have not got round to it."
  - "there is no overage charge"

### /verify  (screenshots: 023 desktop EN, 057 390 EN, Arabic below)
- For: checking a record extract's code. Says so: yes.
- Next: type a code and "Check it" (not pressed). Obvious.
- Missing: an example of where the code is on the cover page; what the result will look like.
- 390px: works; the page is a heading, a sentence and a field, then the footer.
- Promise: P4 (the extract "anybody can verify", /for-therapists).
- Defects: none seen.

### /login  (screenshots: 031 desktop EN, 065 390 EN, Arabic below)
- For: a clinician signing in. Says so: "Welcome back / Sign in to your practice." Yes.
- Next: Sign in; "Forgot password?"; "No account yet? Create one". Obvious.
- Missing: nothing, but two audience choosers on one screen: "WHICH ARE YOU?" chips at the top and "Not what you are? I am a patient · I run a company · I run a clinic" at the bottom.
- Decoration: the navy panel "Your notes, written while you work." with three ticks, repeated on /signup and /forgot-password.
- 390px: works; the navy panel drops under the form.
- Arabic RTL: see below.
- Promise: none of the 25 directly (it is T1's door).
- Defects: /for-patients's hero "Sign in" button links HERE, to the clinician's "Sign in to your practice", not to /patient/login. A patient following the patient page's own sign-in lands on the wrong door.
- Claims: "Go on the radar and take a session in the next minute" (a time promise and close to an earnings forecast: it promises a patient will be there).

### /signup  (screenshots: 032 desktop EN, 066 390 EN, Arabic below)
- For: a clinician creating an account. Says so: "Start your first session / Four fields, then you are in. Your first session is free."
- Next: Create account (not pressed). Obvious.
- Missing: which of the two plans you are starting on; the page says nothing about pay as you go vs $80.
- 390px: works.
- Defects: the consent sentence is printed TWICE, once centred and once left-aligned, one under the other: "By creating an account you agree to our terms and privacy policy, and you obtain your patients' consent to recording." (032, 066).
- Claims: "Four fields, then you are in."; "Your first session is free." (pricing says "first completed session").

### /forgot-password  (screenshots: 033 desktop EN, 067 390 EN, Arabic below)
- For: a clinician resetting a password. Says so: "Reset your password / We will email you a link."
- Next: Send reset link (not pressed); "Back to sign in"; "Looking for your own sessions? Sign in as a patient". Good: it has a way back and a way sideways.
- Missing: a reset by phone; /integrations/whatsapp says most patients have no email, and clinicians in Egypt may be the same.
- 390px: works.
- Defects: none seen.

### /patient/login  (screenshots: 034 desktop EN, 068 390 EN, Arabic below)
- For: a patient signing in, by password or by a code. Says so: "Your sessions / Sign in to see your notes, your homework and who can read your record."
- Next: Sign in, or "Send me a code". Obvious.
- Missing: the site header. This page has its own bar with only the logo and the language control (no Radar button, no menu), unlike every other sign-in page.
- Decoration: the navy panel with three ticks.
- 390px: the SOS orb sits ON the right end of the Password field (068). A patient typing a password taps next to an emergency button.
- Arabic RTL: see below.
- Promise: P5 (the orb is present, and reachable). P1 is advertised here: "See who is online and be in a session in under a minute".
- Defects:
  - SOS orb over the password input at 390 (068).
  - Console: "Minified React error #418" (hydration mismatch) on load (034).
  - The language control appears twice in the text layer ("English العربية" at the top of the page and again in the header).
- Claims: "See who is online and be in a session in under a minute"; "No password needed."

### /staff/sign-in  (screenshots: 035 desktop EN, 069 390 EN, Arabic below)
- For: our own staff. Says so: "Staff console / For the 24Therapy team. Clinicians sign in at /login."
- Next: Sign in; "Forgot password?". Obvious.
- Missing: "/login" is printed as plain text, not a link.
- 390px: works. It carries the full public header and footer, which is odd for a console door but harmless.
- Promise: A1 to A5 start here.
- No door: nothing on the public site links here (deliberate, per the sign-in menu's own comment).

### /clinic/sign-in  (screenshots: 036 desktop EN, 070 390 EN, Arabic below)
- For: a practice manager. Says so: "Your practice".
- Next: Sign in; "No account yet? Create one" (to /clinic/apply).
- Missing: "Forgot password?" (the clinician and staff doors have one; this does not).
- 390px: works.
- Promise: C1 to C5. The side panel breaks C2: "See the rota and move a patient between your own clinicians". A manager who can move a patient is a manager who can see the patient.
- Claims: "A seat per therapist, prorated the day they join or leave" (C4 says the next bill is lower by exactly one seat; "prorated the day they leave" is a different promise); "One bill for the clinic, not one per clinician".

### /sponsor/sign-in  (screenshots: 037 desktop EN, 071 390 EN, Arabic below)
- For: a company's account. Says so: "Your organisation's account".
- Next: Sign in; "No account yet? Create one" (to /sponsor/apply).
- Missing: "Forgot password?".
- 390px: works.
- Promise: E1, E2. Side panel: "Add employees and set what a session costs the company" (the public pages say people enrol themselves: "Your people enrol themselves"); "Watch the pot, the spend and the take-up, month by month" (the marketing says weekly); "Nobody at the company ever sees a clinical note" (good, E2).

### /partner/sign-in  (screenshots: 038 desktop EN, 072 390 EN, Arabic below)
- For: a developer partner signing in. Says so: "Your developer account", nothing more.
- Next: Sign in; "Build on 24Therapy" (to /partner/apply).
- Missing: a sentence saying what this account is; a "Forgot password?"; any door to it. /developers links only to /partner/apply and the header "Sign in" menu lists therapist, patient, company and clinic only. This page has NO DOOR.
- 390px: works; a form in a card inside a card.
- Promise: none of the 25 (the partner portal is outside the promise list).

### /partner/apply  (screenshots: 039 desktop EN, 073 390 EN, Arabic below)
- For: asking for an API key via a call. Says so: "Build on 24Therapy / Tell us what you want to build and we will call you. Keys are issued after we have spoken."
- Next: "Ask us to call" (not pressed).
- Missing: EVERYTHING AROUND THE FORM. No site header, no logo, no footer, no link back to /developers or anywhere else; only a language switch floating top right (073). A dead end with one button.
- 390px: works otherwise.
- Promise: none of the 25.
- Claims: "There is no self-serve key, and a therapist never sees one."; "so a leaked endpoint URL leaks nothing."

### /design and its six sub-pages (to be rewritten; described as found)
Screenshots: 024 to 030 desktop EN, 058 to 064 390 EN, Arabic below. All carry the full public header and footer, and all are `noindex`; nothing on the public site links to any of them (no door, deliberately: "Not linked from anywhere and not indexed").

- **/design** "UI reference", labelled INTERNAL. 11,400px at 1280. Section 01 "The frames" is two empty frames reading "any desk screen" and "any phone screen"; section 02 onward is every marketing component again (transcript, note, risk alert, copilot, profile, "fee split: You keep $51, 24Therapy takes $9 (15%)"), organised by audience. The browser frame's example URL is "24therapy.app/admin/actuals" on a public page. The same components as /, /for-therapists and /features, a fourth time.
- **/design/patient** "The patient app, drawn three ways, before anybody builds one" (9,400px): wireframes A four tabs, B three tabs, C two surfaces, per screen. It says both "Nothing here is built yet." and "Option A · Four tabs is what is being built ... It is wired in components/patient/bottom-nav.tsx." Engineer file paths on a public page.
- **/design/patient/sample** three phones side by side, one per option. Under them, "What is the same in all three: The SOS control is on every screen and is never behind a tab." NONE of the three sample phones shows an SOS control (026). It also claims "Teal means a thing you press, and it carries navy ink, never white." while the Option A/B cards are a teal ground with navy text, consistent.
- **/design/company** "The company portal, drawn three ways": A The desk (chosen), B Two questions, C One board, as ASCII-ish wireframes ("▓ spend by week").
- **/design/company/sample** three rendered desktop screens. The fake URL is "app.24therapy.com/sponsor", a domain the product does not use (live is 24therapy.app). Option A says "Runs out 4 March" while the wireframe page says "empties 31 March" for the same pot.
- **/design/clinic** "The clinic portal, drawn three ways": A The desk (chosen). Option B's wireframe says "No patient names on this screen"; Option A's does not.
- **/design/clinic/sample** Option A renders a PATIENT column with "Mariam A.", "Omar S.", "Laila F.", "Tarek M.", "Dina H.", the chosen design for the clinic portal, against C2. Fake URL "app.24therapy.com/clinic" again.
- For: an internal design review; they say so. Next: the links between the three reviews work ("The wireframes, all twelve screens", "Company portal", "Clinic portal").
- 390px: the three-across samples stack into one column; the wireframe comparison tables ("Option / The idea / What it costs you") clip on the right, the third column "What it costs you" is off-screen and the second is cut mid-word (059; the company and clinic reviews use the same table). The wireframes carry an SOS orb on every phone; the rendered samples on the /sample pages do not.
- Promise: none directly; they are where the redesign will be argued. They currently argue for a clinic portal that shows patient names.

## Arabic, RTL, every page

Screenshots: 390px Arabic is 077 (home) to 110 (partner/apply) in the same page order as the English runs; desktop Arabic is 111 (home) to 144. The switch is a cookie (076 pressed the control; 145 switched back to English). Every page came back `dir=rtl` with no sideways page scroll at either width. Layout mirrors properly: nav order, the hero arrow ("كيف يعمل للمرضى ←"), the steppers' Next/Back arrows, the sheet close buttons. What does not work, page by page:

- **Every page:** the footer's "TRUST AND LEGAL" column is translated as a heading ("الثقة والشروط") but its four links stay English: "Privacy", "Terms", "Compliance", "Security" (077 onward). The SOS orb moves from the right edge to the LEFT edge in RTL, so where it covers something it now covers a different control.
- **/ (077, 111):** the demo data is English inside Arabic sentences: "Mon 09:00", "Tue 10:00", "2 March", "Sessions, week of 23 February" becomes "جلسات أسبوع 23 February", "TRANSCRIPT", "ملاحظة الجلسة، demo", "Arabic, English, French" under clinicians. Latin initials break under bidi: "Mariam A." renders as "Mariam .A" and "Laila F." as ".Laila F" (077 sheet 1). Prices render "$US 1", "$US 80", "$US 216" with the currency marker on the wrong side (077 sheet 1, 082). Numerals are mixed: "50 دقيقة" in western digits on the home phone, "٣٠ دقيقة" in Arabic-Indic digits on the radar row (089).
- **/for-patients (078, 112):** fully translated, and the best Arabic page. Phone mockups mirror their status bar (battery and signal on the left, 9:41 on the right), which no real phone does. The five phones problem is the same in Arabic.
- **/for-therapists (079), /features (085):** translated except "TRANSCRIPT" in the mockup.
- **/for-clinics (080), /for-companies (081):** translated; clinic mockup still English day names and patient names.
- **/pricing (082, 116):** translated; "$US 80" price format; the comparison matrix now clips on the LEFT at 390 (the Therapist and Clinic columns are off-screen to the left, 082 sheet 0). Competitor names stay Latin, correctly.
- **/contact (084):** the Country options "Egypt" and "United States" are English; entity names "24Therapy Inc.", "24Therapy Egypt" stay Latin (fine).
- **/security, /hipaa, /privacy, /terms (083, 086, 087, 088):** English by design with the Arabic notice. But the page headers ("Security", "How 24Therapy is built and operated.", "Compliance", "Legal", "Privacy Policy") are English too, so an Arabic reader gets no Arabic title for the page they are on.
- **/radar (089, 123):** translated chrome, but the filter chips "English", "Arabic", "Anxiety", "Sleep" and the row's "Arabic · English", "Anxiety", "Sleep" are English (taxonomy not localised). "حساب تجريبي" (demo account) is translated. The globe shows one dot in Egypt on a mostly empty globe (089, 123).
- **/t/[id] (090, 124):** mostly UNTRANSLATED: "Available now", "Trauma and grief, Arabic and English", "Start a session now", "Copy this page's link", "Egyptian Psychological Association", "Turned up to 100% of 7 booked sessions.", "One hour with Sara · $75", "Arabic, English", "Anxiety, Sleep". Only the row labels ("يتحدث", "يعمل مع", "مقره"), the "30 minutes, starting now" bar and the day headings are Arabic. At 390 the SOS orb now sits on the LEFT end of "Copy this page's link" (090). This is the page a clinician hands out.
- **/integrations (091) and /integrations/whatsapp (092):** ENTIRELY English under an Arabic header: headings, descriptions, "NOT BUILT", "Partly working", "All integrations". Only the nav is Arabic.
- **/developers (093):** translated prose; code stays English, correctly. Code blocks clip at 390 as in English.
- **/verify (094):** ENTIRELY English: "Check a record extract", the paragraph, and "Check it". The one page a third party in Egypt uses to check a patient's extract.
- **Auth pages (102 to 110):** translated, including partner sign-in and partner apply. /patient/login at 390 puts the SOS orb over the left edge of the password field and the Sign in button (105). /signup still prints the consent sentence twice.
- **/design and sub-pages (095 to 101):** mostly English (the wireframe labels and review prose are not translated: 306 of 401 lines on /design/patient are Latin). Expected for an internal page; noted because it will be rewritten.

## The five screens most in need of redesign

1. **/radar.** It is the patient's crisis door and the product's first promise (P1), and today it is a decorative globe with one or two overlapping dots, an empty state that says "nobody" four ways with no alternative offered, no verification state on the rows (C1), English taxonomy chips in Arabic, and a booking sheet that silently takes the clinician off the radar for everyone the moment a stranger opens it. Lead with the list and the next action; make the empty state offer "book an hour" and a crisis line; do not hold on open.
2. **/ (home).** One hero, but it is a category statement over a patient paragraph, followed by eight mockups, a full pricing section, a comparison table, a crisis box and a CTA band: ~6,800px desktop, ~12,000px at 390. Two of its eight mockups contradict the promises they illustrate (patient names in the clinic portal; an empty company panel for "What you will never see"). Clinic and company visitors have no call to action.
3. **/for-patients.** The app drawn five times in eleven sections (two identical radar phones back to back), no SOS orb on the page for patients, the hero "Sign in" going to the clinician's /login, and three claims that other public pages contradict (email never WhatsApp; nothing is deleted).
4. **/pricing** (and the pricing blocks copied onto /, /for-therapists). The hidden EGP behind a dotted underline and a pop-over badge that overlaps the plan name; a matrix that clips at 390 in both directions; and "HIPAA BAA included" on every card, which /hipaa says is not true.
5. **/t/[id].** The page a clinician gives out is mostly English in Arabic, shows "$75" for both 30 minutes and one hour, a headline that disagrees with its own "works with", an SOS orb over its share button, and a 1,500px wall of identical hour buttons.

Close behind: the four legal pages (double headers, English-only headers in Arabic, and a template placeholder "This page is a starting point maintained by your administrator, not legal advice" live on /privacy and /terms), and /partner/apply (no chrome at all, a dead end).

## Screens with no door

- **/partner/sign-in:** nothing public links to it. /developers links only to /partner/apply; the header "Sign in" menu offers therapist, patient, company and clinic.
- **/staff/sign-in:** no public link (deliberate).
- **/design and all six sub-pages:** no public link (deliberate, says the page).
- **/for-patients's "Sign in"** is a door to the WRONG room: it goes to /login (clinicians).
- **/clinic/sign-in and /sponsor/sign-in** are reachable only through the header menu; /for-clinics and /for-companies do not link them.
- **/partner/apply** has doors in but no door out: no header, footer or back link.
- **/t/[id]** is reachable only by opening a radar row (which places a 60-second hold) and pressing "See their full profile".

## Patterns across the portal

Good:
- The honesty rules hold. No page says paid sessions cover the fee, and no page forecasts earnings in a shape `lib/content/honesty.ts` catches. T3 is stated as netting on /pricing, correctly.
- Candour where it counts: /hipaa, /integrations ("Most of the names below say not built"), /for-clinics ("A clinic-level export ... is not built"), /terms on crisis detection ("They can miss risk and can raise false alarms").
- The crisis box ("If you need help right now ... This is not an emergency service") is on every marketing page, with the radar as the next step.
- RTL mirroring is structurally right everywhere; no page scrolls sideways at 390 in either language.
- Mockups are real components on invented data, and the section that says so ("running on invented data") is honest, where it appears.

Bad:
- **Contradictions between public pages** are the biggest pattern: BAA included (/pricing, /features, /privacy) vs not signed (/hipaa); never over WhatsApp (/for-patients) vs WhatsApp first (/integrations/whatsapp); nothing is deleted (/for-patients) vs clinicians can delete (/privacy) vs clinicians cannot delete (/hipaa) vs retained until the practice deletes (/hipaa); clinic export not built (/for-clinics) vs partly working (/integrations); a wall the practice cannot see through vs patient names in the practice's own screen and "move a patient between your own clinicians" (/clinic/sign-in).
- **The same mockups on four pages:** the session room, transcript, note, copilot, risk alert and patient phones appear on /, /for-therapists, /features and /design, and the radar phone twice on /for-patients.
- **Fake data presented as live:** the hero radar phone on / and /for-patients shows three "FREE NOW" clinicians who do not exist, without a label beside it.
- **Mislabelled calls to action:** "Talk to us" opens an application form (/clinic/apply, /sponsor/apply); "Sign in" on /for-patients opens the clinician door.
- **Inconsistent auth doors:** /login and /staff/sign-in have "Forgot password?", /clinic/sign-in, /sponsor/sign-in and /partner/sign-in do not; /patient/login has its own reduced header; every door has two "which are you" choosers.
- **Tables and code at 390** clip without a scroll cue (pricing matrix, comparison tabs, integrations tabs, developer code blocks, clinic mockup rows).
- **SOS orb placement:** absent on /, /for-patients and every marketing page; present on /radar, /t and /patient/login, where at 390 it sits over a control (the password field; the share button), on the right in English and the left in Arabic.
- **Taxonomy and demo data not localised:** language and topic chips, day and month names, "TRANSCRIPT", "demo", in Arabic.
- **Engineering language to the public:** "the import graph is what stops it", "components/patient/bottom-nav.tsx", "a fact about the queries rather than a promise".

## The founder's complaints, checked

| Complaint | Still seen? | Evidence |
|---|---|---|
| Grey and thin text everywhere | **Yes.** Measured with computed styles: the bulk of body text on /pricing is Tailwind slate-600 (`oklch(0.446 0.043 257)`, #475569) at 14px, weight 400; the homepage carries 11px and 10px text in the same grey (eyebrows, mockup captions, "No card to start", footer links at 12px). It passes contrast (about 7.5:1) but reads grey and light because it is small, regular weight, system font, and a blue-grey slate rather than the navy ink the palette defines. | 006, 011, 040, 045 |
| The teal reading as green | **Partly.** The pressable teal (#2EC4B6 with navy ink) reads teal. What reads green is the darker teal used as ink on white: the "VERIFIED" pills, "+$10,000" in the pot mockup, the check marks, the "FREE NOW" labels and the link colour (`brand-700` #15746c), which at that lightness reads as pine green. | 006 tile 2, 040 sheet 1 |
| A price badge reading as part of the price | **Yes, in a new form.** No "most popular" badge remains, but every USD price has a dotted underline and hides its EGP figure; tapping swaps the big figure to EGP and pops a small navy "$80" badge that sits on the plan's subtitle. | 074 |
| The radar globe empty with two clinicians on it | **Yes.** Two clinicians, both in Cairo, render as one overlapping mark on a globe that fills the screen; with one on shift it is one dot. | 018, 052, 089, 123 |
| /for-patients showing the same app four times over eleven sections | **Yes, now five times** (two identical radar phones back to back, then sessions, claim and grant phones) over eleven sections. | 007, 041, 078 |
| Five heroes on a homepage that needed one | **Fixed as heroes, not as length.** There is one hero now, with four audience tabs that swap its phone. But the page below it is still eight mockups, a full pricing block, a comparison table, a crisis box and a second CTA band. | 006, 040 |

Also seen from the wider list in TAKEOVER s10: "empty states taking a whole card" is true of /radar (the empty list and "0 other clinicians are available right now" take the whole panel) and of the home's "What you will never see" card, whose main panel is empty.

## What I did that touched state

Nothing was submitted. But opening a clinician's row on /radar places a 60-second hold ("They now show as busy to everyone else"); I opened Sara Demo's sheet three times (twice from a plain Playwright script used to find the /t link and dump page text, once through the harness for 075), so she was shown as busy for up to a minute each time. I also used a plain Playwright script, signed out and read-only, to read full page text and computed text colours, because the harness truncates at 400 lines; every screenshot cited here came from the harness.
