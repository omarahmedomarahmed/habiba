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

