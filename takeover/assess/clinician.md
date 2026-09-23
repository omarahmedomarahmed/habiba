# Clinician workspace, screen by screen

Assessor: `assess-sara` (Dr Sara Demo, clinic seat, 2 patients) and `assess-yasmin` (Dr Yasmin,
still applying). Walked on https://24therapy.app on 2026-09-23 (Cairo), from 02:40 Cairo time.
Screenshots are under `evidence/assess/assess-sara/` and `evidence/assess/assess-yasmin/`, named
`NNN-<label>-before.png` / `-after.png`. Nothing was pressed that submits, saves, invites,
publishes, starts or ends anything. The session room (`/sessions/[id]/room`) was not opened: it is
a live surface and another walker is in a session.

## Portal-wide defects, stated once so every entry below does not repeat them

- **W1. The radar status pill covers the page title on every page, at both widths.** A fixed pill
  ("Live on the radar" / "Busy, someone is booking you" + a red "sound off, turn on") sits at the
  top centre over the H1. At 1280px it hides most of "Your calendar", "New session" and the date
  on Home. At 390px the language switcher then sits on top of the pill, so the H1 of every page is
  unreadable and the "sound off, turn on" control is hidden under the language switch.
  (`012-dashboard-mobile-en-after.png`, `015--bookings-desktop-en-after.png`,
  `014--sessions-new-desktop-en-after.png`, `021..025-*-mobile-en-after.png`)
- **W2. The radar orb (bottom right, 48px) sits on content at 390px**: on the Clinic card chevron
  on Home, on the "Patient first name" input on New session, on note text on Notes.
  (`012`, `022`, `025` mobile)
- **W3. "Turn on your alarm" modal on every first load** with the whole app blurred behind it.
  "Not now" dismisses it for that page load only: after about fifty dismissals it was still there
  on the next page opened without dismissing it. (`010-sign-in-as-sara-after.png`,
  `066-alarm-modal-check-no-dismiss-after.png`)
- **W4. The radar state flips under you.** Home said "Live on the radar"; two minutes later every
  page said "Busy, someone is booking you" with an amber dot, although the calendar shows no hour
  held or booked. Nothing on screen says who, for when, or what to do.
  (`013` onward, compare `011`)
- **W5. Dates are mixed relative and absolute in one list** ("5 days ago", then "15 Aug 2026",
  then "4 days ago") and lists are not in date order (see /sessions).

## Sign-in pages (logged out)

### /login  (screenshots: evidence/assess/assess-sara/001, 002, 006, 007)
- For: a therapist signs in. Does the screen itself say so? yes ("Sign in to your practice", "I am a therapist" preselected)
- Next: type email and password, Sign in. Obvious.
- Missing: nothing essential. Language switch is hidden behind the hamburger at 390px.
- Decoration: the "WHICH ARE YOU?" chooser AND the "Not what you are? I am a patient · I run a company · I run a clinic" line say the same thing twice; the navy marketing card repeats the homepage.
- 390px: works (`002`). The form is above the fold.
- Arabic RTL: works; dir=rtl, all translated, fields and chips mirrored (`006`, `007`).
- Promise: none directly; the door to T1 to T5.
- Defects: none seen.

### /signup  (screenshots: 003, 004, 008)
- For: a therapist creates an account. Says so? yes ("Start your first session")
- Next: four fields, Create account. Obvious.
- Missing: nothing says that a new account has to be verified before patients can find it (see Yasmin below): "Four fields, then you are in" is only half true.
- Decoration: same marketing card and double audience chooser as /login.
- 390px: works apart from the duplicate paragraph (`004`).
- Arabic RTL: translated, rtl; the duplicate is duplicated in Arabic too (`008`).
- Promise: none; "Your first session is free" is a pricing claim that should be checked against `/pricing`.
- Defects: **the consent sentence "By creating an account you agree to our terms and privacy policy, and you obtain your patients' consent to recording." is printed twice**, one under the other (`003-signup-desktop-en-after.png`, `004`, `008`).

### /forgot-password  (screenshots: 005)
- For: ask for a reset link. Says so? yes
- Next: Send reset link; "Back to sign in" is there. Obvious.
- Missing: nothing.
- Decoration: marketing card again.
- 390px / Arabic: same shell as /login, not separately defective.
- Promise: none.
- Defects: none seen. Note the example.com demo clinicians can never receive this mail.

## Signed in as Dr Sara

Arabic RTL lines below were filled in after the Arabic pass (section "Arabic pass" at the end
lists the screenshot numbers).

### /dashboard  (screenshots: 010, 011, 012)
- For: the clinician's home: start a session, see radar state, see recent sessions. Says so? partly: "Hello, Sara" and a date; no line says what this page is for.
- Next: "Start a session" is the loudest thing on the page and is obvious. Nothing says what is next in the day: **no upcoming bookings, no "your next session is at", no drafts waiting**. A clinician with six open hours today cannot see them from Home.
- Missing: today's schedule; unsigned drafts; money owed (Tarek's session shows "$75 unpaid" on /on-call and nowhere here); a link to the Calendar.
- Decoration: the date line (hidden under the pill anyway); the "Clinic, 5 sessions this month" card is a number with no meaning attached (the sessions list shows 4 in September: 5 Sept, 12 Sept, 18 Sept, 19 Sept).
- 390px: problems. W1 (title and date hidden under the pill, pill's "sound off" hidden under the language switch), W2 (orb covers the Clinic card chevron). (`012-dashboard-mobile-en-after.png`)
- Arabic RTL: see Arabic pass.
- Promise: T1 (the drafts should surface here) and P1's clinician half (radar). Partly kept: radar state is here, drafts and bookings are not.
- Defects: "Recent sessions" is not in date order: Tarek "5 days ago" first, then Mariam 15 Aug, 22 Aug, 29 Aug, 5 Sept, and her most recent (19 Sept) is missing from the five shown (`011`). Radar "Live" then "Busy, someone is booking you" with nothing booked (W4).

### /sessions  (screenshots: 013, 021)
- For: every session, newest first. Says so? no subtitle; the H1 is hidden (W1).
- Next: open a session, or "New". Obvious.
- Missing: filters (by patient, by state), upcoming sessions, a date heading per group.
- Decoration: "Video" repeated on every row; "Note ready" pill repeated on every row with the same value.
- 390px: works apart from W1 (`021`).
- Arabic RTL: see Arabic pass.
- Promise: T1 (draft state visible per session). Kept in form ("Note ready" pill), but the pill says "Note ready" where /notes says "Approved" and the session says "Signed" and "Completed": four words for one state.
- Defects: **order is wrong**: Tarek (18 Sept, "5 days ago") first, then Mariam 15 Aug ascending to "4 days ago" (19 Sept) last. Relative and absolute dates mixed (W5). (`013--sessions-desktop-en-after.png`)

### /sessions/new  (screenshots: 014, 022)
- For: start recording a session now. Says so? yes, "One field, then you are recording."
- Next: pick where, pick or type a patient, Start session now. Obvious, and one tap starts recording (not pressed).
- Missing: a way to schedule rather than start now (that lives in /bookings, not linked from here).
- Decoration: the "YOUR PATIENT, ON THEIR OWN SCREEN" two-column tick/cross box. The crosses ("Loses the session by saying no", "Gets a note that pretends it covered the hour") read as things that happen to the patient unless you work out they are things that do NOT happen. Ambiguous at first read.
- 390px: problems: W1 hides the H1; the radar orb sits on the "Patient first name" input (`022`).
- Arabic RTL: see Arabic pass.
- Promise: T1, T2, P1. The consent line is there ("Confirm your patient has consented").
- Defects: "One field" is false: first name, mobile number, email and a patient picker are shown. The picker is labelled "Existing patient" but defaults to "New patient", with the hint "Or leave blank and type a name" under a select that cannot be blank. "Connect an account in Settings to run sessions there" sits under the room card, but Settings > Meeting accounts says recording is not switched on for this deployment: it points at a dead end. (`014--sessions-new-desktop-en-after.png`)

### /bookings, "Your calendar" (the calendar; there is no /calendar)  (screenshots: 015, 018, 019, 020, 023)
- For: open hours patients can book, and see who booked them. Says so? yes ("The hours you open here are what a patient can book").
- Next: tap a day to see its hours; then "Open them", "Invite them" or "Close this hour" (none pressed).
- Missing: **the bookings themselves.** See the founder complaint below. Also: sessions already held or scheduled (the Sessions list) never appear on the calendar; the month view has no month name and no weekday header; the expanded day is headed by a raw ISO key "2026-09-23".
- Decoration: none; it is too bare rather than too decorated.
- 390px: works as a 2-column grid; W1 hides the title (`023`). **The calendar is not in the mobile navigation at all**: the bottom bar is Home, Sessions, +, Patients, More, and More lists Copilot, Assistant, Notes, Connect, Crisis Radar, Earnings, Billing, Settings, with no Calendar (`055-more-menu-mobile-en-after.png`, `components/nav/bottom-nav.tsx` PRIMARY/MORE). On a phone the calendar has no door.
- Arabic RTL: see Arabic pass.
- Promise: none of the 25 directly; it feeds P1 (radar availability) and T4 (inviting into a slot).
- **Founder complaint, CONFIRMED.** In Week view every day is a tile with a bare number ("6") and no unit. Day view is ONE tile with the same number and nothing else (`019-bookings-day-view-after.png`); Month view is 35 tiles with numbers (`020`). The hours, their status and the patient's name only appear after tapping a day (`018-bookings-expand-wed-after.png`). The code says why: `components/scheduling/calendar.tsx` lines 211 to 245 render every view, including Day, as a count button, and the list of hours with `slot.patientName` only renders for `selected` days (lines 299 to 383). A booked hour shows as "6 · 1 booked" on the tile, never the name or time.
- Defects: tapping a day also opens an "Open these hours 09:00 to 17:00 / Open them" publishing form ABOVE the hours you came to read, so reading your day puts a publish button in front of you (`018`). The same hours are editable in a second, different UI on /on-call ("Hours people can book"), with another publish button: two calendars. The status pill says "Busy, someone is booking you" while every hour on the calendar is "Open".

### /patients  (screenshots: 016, 024)
- For: the caseload. Says so? yes, "2 on your caseload".
- Next: open a patient, Add a patient, or Import. Obvious.
- Missing: nothing structural; no search (fine at 2, not at 40).
- Decoration: initials avatars.
- 390px: works apart from W1 (`024`).
- Arabic RTL: see Arabic pass.
- Promise: P4 (one record), T5 (who has granted access). **No access state on the row**: Mariam has withdrawn access and her row looks identical to Tarek's.
- Defects: **Mariam's row says "last 15 Aug 2026"**; her last session was 19 Sept ("4 days ago" on /sessions). The profile repeats "Last seen 15 Aug 2026". It is showing her first session, not her last. (`016--patients-desktop-en-after.png`)

### /notes  (screenshots: 017, 025)
- For: recent notes. Says so? "Everything approved", which is a state, not a purpose.
- Next: open a note. Nothing to do if everything is approved, and the screen says so. Good.
- Missing: a drafts section heading (the mobile More menu advertises Notes as "Drafts waiting for you" while the page says "Everything approved").
- Decoration: the summary line, identical on all 7 rows in this seed, so it carries no information here.
- 390px: W1; the orb covers the end of a note summary (`025`).
- Arabic RTL: see Arabic pass.
- Promise: T1 ("says draft on every screen until it is signed"). Cannot be proved on this seed: nothing is a draft.
- Defects: same ordering bug as /sessions (Tarek first, then Mariam ascending).

### /copilot  (screenshots: 026, 035)
- For: one conversation per patient. Says so? yes.
- Next: open a patient's thread. Obvious.
- Missing: access state per patient: Mariam has withdrawn access, and her thread shows "Today" with a question, with no sign that asking again will be refused.
- Decoration: the quota banner ("Each session earns 4 copilot questions...") on every visit.
- 390px: works apart from W1 (`035`).
- Arabic RTL: see Arabic pass.
- Promise: T5. Not visibly kept here (see /copilot/[id]).
- Defects: "1 sessions" (plural on one) on Tarek's row (`026`).

### /copilot/[patientId]  (screenshots: 062 Mariam, 063 Tarek)
- For: ask the copilot about one patient. Says so? yes ("Ask me about Tarek. I have read every session in this chart and nothing outside it").
- Next: type a question or tap a prompt. Obvious.
- Missing: for Mariam, a plain statement that the copilot will not answer while access is withdrawn. The amber banner lists what you cannot see; it does not mention the copilot, and the Ask box, "24 left" and eight prompt buttons are all still there.
- Decoration: "READ ALOUD" explainer card; eight prompt chips that each have a copy icon.
- 390px: see mobile pass.
- Arabic RTL: see Arabic pass.
- Promise: **T5**. On screen it is not kept: the answer shows no source sentence attached (it has a timestamp chip reading "- · NaN:NaN" instead), and a revoked patient still shows a live Ask box. I did not press Ask, so whether the next question is refused is untested.
- Defects: **the citation chip renders "- · NaN:NaN"** (`062`, also on the patient profile `056`). **The conversation is upside down**: the answer is above the question it answers (`056-patient-desktop-en-after.png`). Quota contradiction: "Each session earns 4 questions"; Tarek has 1 session and "5 left", Mariam has 6 sessions, has asked one, and has "24 left".

### /assistant  (screenshots: 027, 032, 036)
- For: questions about your practice, not about a patient. Says so? yes, clearly.
- Next: answer the "Before you start" preferences, then type. The preferences card sits in front of the chat on every visit until saved.
- Missing: **no door on desktop**: the sidebar has no Assistant entry (only the phone's More menu has it). An empty "New chat" is listed in the thread list before anyone asked anything.
- Decoration: "50 left this month".
- 390px: the preferences card fills the first screen; the chat starts below the fold (`036`).
- Arabic RTL: see Arabic pass.
- Promise: none of the 25.
- Defects: **opening the page writes a row**: `app/(app)/assistant/page.tsx` line 41 calls `createThread(actor)` when there are no threads, so a GET creates an empty "New chat". It also duplicates the copilot preferences in /settings ("Answer in", "Read-aloud voice", "Speed").

### /on-call, "Crisis Radar"  (screenshots: 033, 037)
- For: go live on the radar and be booked. Says so? yes ("Fill a free half hour with someone who needs one now").
- Next: Go offline / stay, turn the alarm on. Clear at the top.
- Missing: nothing; it has too much. Seven sections in one scroll: live card, alert sounds, radar profile, a second hours editor, session history with money, ratings, your practice address. About 5,000px at desktop.
- Decoration: the dotted-grid spotlight on the navy card; "You are visible to the world".
- 390px: long; W1; orb over the alert-sound checkboxes (`037`).
- Arabic RTL: see Arabic pass.
- Promise: P1 (clinician side), T3 (session history shows the fee split).
- Defects: **contradictory money.** The live card says "Your rate · 30 min $75, You keep $67.50" (10%); the session history on the same page says "24Therapy took (15%) $11.25, You received $63.75"; /settings says "You keep $63.75, 24Therapy fee (15%)". **Contradictory status:** the chip says "Someone is booking you" and the headline says "You are visible to the world" at the same moment. **"Until Stripe verifies you"** on a rail with no card processor (`docs/TAKEOVER.md` s9); /earnings offers InstaPay and a mobile wallet. Rate is "per 30 min" while every session is 50 min. Ratings text: "your patient rates you to unlock their summary, so almost all of them do": a patient's summary is held behind rating the clinician, stated as a feature; worth a founder look against P3. The session history dates (15 Aug etc.) disagree with /earnings and /billing, which date every one of the same payments 23 Sept 2026.

### /connect  (screenshots: 034, 038)
- For: enter a code a patient gave you, and answer history requests. Says so? yes.
- Next: type code, "Ask them" (not pressed).
- Missing: **no door on desktop** (sidebar lacks it). No empty state for the "people asking for their own history" half: the subtitle promises it, the page shows only the code box.
- Decoration: none.
- 390px: works apart from W1 (`038`).
- Arabic RTL: see Arabic pass.
- Promise: P4 (the record finds its clinicians).
- Defects: as above.

### /billing  (screenshots: 030, 039)
- For: what you owe 24Therapy. Says so? no subtitle; H1 hidden (W1).
- Next: unclear. The first control is a **seat slider "2 seats, $144 a month"**, then "Cancel the plan".
- Missing: what is owed right now. Tarek's session is "$75 unpaid" on /on-call; here nothing is owed.
- Decoration: three plan cards with a repeated sentence ("Sessions and AI cost nothing on top. No per-session fee riding on the recording question." appears three times).
- 390px: W1; orb over the plan cards (`039`).
- Arabic RTL: see Arabic pass.
- Promise: T3 and C3. **C3 broken on screen**: Dr Sara is on a clinic seat, and her own Billing page shows the clinic's seat count as a draggable slider and a "Cancel the plan" button for the practice's $144 plan. A seat holder should not be able to see, let alone move, the practice's seats.
- Defects: "The plan runs to the date above": there is no date above. "Credit left $0" while five rows say "Session · from your credit". Each "Mariam Demo paid you" row says "Received" while /earnings says the same money is "Held until payouts open". All rows dated 23 Sept 2026 (the seed date), not the session dates (`030--billing-desktop-en-after.png`).

### /earnings  (screenshots: 031, 040)
- For: what patients paid you and what we hold. Says so? yes.
- Next: "Finish setting up payouts" (big teal) goes to /settings, while a payout form is on this same page two cards below. Two ways, different places.
- Missing: T3's "what is owed" half: held and owed are not shown as two halves of one number; there is only a "See what you owe" link.
- Decoration: the six identical patient-payment cards each carry two pills.
- 390px: W1; orb over the "Where your money goes" text (`040`).
- Arabic RTL: see Arabic pass.
- Promise: **T3**, not kept on this screen: no owed figure, no "payout is the difference".
- Defects: "Available now $382.50, what you can withdraw today" next to "We cannot send you anything until we know where" and "Held until payouts open" on every row. "Until Stripe verifies you" again, above an InstaPay form. (`031--earnings-desktop-en-after.png`)

### /onboarding, as a verified clinician  (screenshots: 041, 048)
- For: verification. Says so? yes, and says "You are verified".
- Next: none needed, yet the page ends in "Nearly there: Photo ID, Licence document, Headshot" with amber dots and a (disabled) "Submit for verification" button.
- Missing: a verified state that is only a verified state.
- Decoration: the long language and specialty chip clouds (repeated from /on-call).
- 390px: W1 hides "You are verified" (`048`).
- Arabic RTL: see Arabic pass.
- Promise: A1 and C1 (verification state).
- Defects: **contradictory status**: "You are verified" at the top and "Nearly there", three documents missing, at the bottom (`041-onboarding-desktop-en-after.png`). The licence number here (EPA-311907) is empty in /settings "Licence number"; two licence fields that do not agree.

### /settings  (screenshots: 042, 049)
- For: your details, getting paid, hours, copilot, security. Says so? section chips at the top.
- Next: edit a section; many "Save" buttons (five on one page).
- Missing: nothing structural.
- Decoration: the 3-step "Connect Stripe / Stripe verifies you / Money lands" diagram.
- 390px: works; section chips scroll sideways inside their row (`049`).
- Arabic RTL: see Arabic pass.
- Promise: T3 ("Pay my 24Therapy bill out of my earnings" is here, ticked).
- Defects: "Stripe" throughout the payout section (three steps and a button) while the product pays out by InstaPay and wallets. "Licence state" and "LCSW" credentials are US forms on an Egyptian clinician. Fee shown as 15% here and 10% on /on-call.

### /settings/codes  (screenshots: 043, 050)
- For: QR codes for a waiting room. Says so? yes.
- Next: name a code, "Create a code". Obvious. Good empty state.
- Missing: nothing. Reached only from /settings.
- 390px: works (`050`), W1 aside. Back link "Settings" present.
- Promise: P4 (claiming notes).
- Defects: none seen.

### /settings/integrations  (screenshots: 044, 051)
- For: meeting accounts. Says so? yes.
- Next: nothing; "Meeting recording is not switched on for this deployment."
- Missing: this is a dead end that /sessions/new sends people to.
- 390px: works (`051`).
- Promise: none.
- Defects: an admin-facing sentence ("for this deployment") shown to a clinician.

### /settings/records  (screenshots: 045, 052)
- For: connect an EHR. Says so? yes.
- Next: nothing: "This deployment cannot hold a connection yet. It needs no client registration and no token sealing key."
- Missing: **no door** from the clinician's settings (only the clinic portal and an API callback link here).
- Defects: an engineering sentence to a clinician, and it reads backwards ("needs no ... key" meaning "has no key").

### /support  (screenshots: 046, 053)
- For: raise a ticket; "A person reads this, and answers within a day." Says so? yes.
- Next: pick a topic, optional payout and session, describe, Send (not pressed).
- Missing: **no door**: nothing in the sidebar, the More menu or any page links to /support (`lib/routing.ts` is the only mention).
- 390px: works (`053`).
- Promise: A3 indirectly (a person answers).
- Defects: the session picker lists bare dates ("18 Sept 2026") with no patient name, so two sessions on one day are indistinguishable.

### /patients/import  (screenshots: 047, 054)
- For: import a caseload file. Says so? yes, and says nothing is created until you confirm.
- Next: choose file, country, "Show me what is in it". Obvious.
- 390px: works, the title is hidden (W1) (`054`).
- Promise: P4.
- Defects: no back link to /patients.

### /patients/[id]  (screenshots: 056 Mariam, 057 Tarek)
- For: one patient: access, invite, details, copilot, history. Says so? the name is the title; no line of purpose.
- Next: many: Ask for access, Invite to a session, edit and Save, ask the copilot, open documents, open evidence. Seven sections, three primary buttons.
- Missing: nothing is missing; the order is the problem (the editable form sits above the history).
- Decoration: the copilot "PROMPTS" column with eight chips, repeated from /copilot/[id].
- 390px: see mobile pass.
- Arabic RTL: see Arabic pass.
- Promise: P4, T4, T5. P4: "They own this record since 23 Sept 2026, and can withdraw your access" is clear. T5: Mariam withdrew access, the banner says so, yet the embedded copilot with "24 left" and an Ask box is still on the page.
- Defects: "Last seen 15 Aug 2026" for Mariam (wrong, see /patients); copilot answer above its question; "- · NaN:NaN" chip. Mariam's details form (name, email, phone, diagnoses) is editable with a Save although she has withdrawn access.

### /patients/[id]/documents  (screenshots: 058 Tarek, 060 Mariam)
- For: the person's files, profile, homework, questionnaires, diagnoses. Says so? yes.
- Next: add a file, set a step, send a questionnaire (none pressed).
- Missing: for Mariam, the page says you cannot see "their files", and then shows her three homework steps anyway.
- Decoration: four zero counters ("Open 3, Done 0, Not done 0, Completed -").
- Promise: P4.
- Defects: "Completed -" (a dash where a number or "none" belongs). Title is "Profile" but the link to it says "Profile and documents".

### /patients/[id]/evidence  (screenshots: 059 Tarek, 061 Mariam)
- For: every fact with the sentence it came from. Says so? yes for Tarek.
- Next: nothing ("Nothing recorded yet") for Tarek, although he has a signed note with SOAP content and a 10-segment transcript.
- Missing: for Mariam the page is only the amber banner and a back link: no title, nothing else.
- Promise: T5 ("the sentence it came from"). Not demonstrable: empty for both patients.
- Defects: empty despite a transcript and a note existing.

### /sessions/[id]  (screenshots: 064 Tarek, 065 Mariam)
- For: one session: close-out, note, summary, audio source, transcript. Says so? the patient name and "Completed".
- Next: nothing: everything is already signed and released.
- Missing: nothing; contradictions instead.
- Decoration: "From the recording" chip; "Who is speaking: No separate voices were detected".
- Promise: T1, P3. P3 is kept in content (version by Dr Sara Demo, released).
- Defects: **"Before you close this session" card on a completed session**, both boxes ticked and greyed, ending in a disabled button reading "Nothing ticked". **"The whole session was captured"** next to "Where this session's audio came from: No source is recorded for this session." **The summary "Version 2, by Dr Sara Demo on 18 Sept, 02:22" predates the session it summarises** (18 Sept, 03:12). Status words: Completed, Signed, Released, Approved on one page. (`064`)

## Signed in as Dr Yasmin, still applying (`assess-yasmin`)

Sign-in lands on /onboarding (`evidence/assess/assess-yasmin/001`). Every clinical route
(/dashboard, /sessions/new, /patients, /on-call, /bookings, /copilot) and **/support** redirects her
back to /onboarding (steps 003 to 012). She can reach /earnings, /billing and /settings.
Her navigation is "Finish verification, Earnings, Billing, Settings" on desktop and "Verify,
Billing, Settings" on the phone.

### /onboarding, while waiting  (screenshots: assess-yasmin/002 desktop en, 014 390px en, 016 390px ar, 017 desktop ar)
- For: tell an applicant where her application stands. Says so? yes: "With us for review. Somebody is checking your documents, usually within a working day. Sessions unlock when you are approved."
- **What is she waiting for:** a person to check her documents. Said clearly.
- **How long:** the screen says "usually within a working day". The seed submitted her application **40 days ago** (`scripts/seed-demo.ts` line 446, `daysAgo(40)`). The screen shows no submission date, no elapsed time, and nothing that changes when "a working day" has long passed. A person 40 days in reads the same sentence as a person 40 minutes in.
- **What she can do:** nothing on this screen. No way to see or correct what she submitted, no contact, no "ask us why", and /support redirects her back here. The sidebar calls this "Finish verification", an instruction to do something, while the page says there is nothing to do; /settings says "With our compliance team. Nothing else is needed from you." Three phrasings, one of them wrong.
- Next: none. A dead end with no way out except sign-out.
- Missing: submission date; elapsed time; a way to reach a person (support is blocked for her); a list of what she sent; what "approved" will unlock and what she can prepare meanwhile (rate, radar profile, hours are all behind the redirect).
- Decoration: "Why we ask": a tick column and a cross column. The cross column says her details will NOT "Be shown to patients", and the line directly under it says "Public: your headshot, name, credentials, languages and specialties." Read quickly, those contradict each other.
- 390px: the H1 "Verify your practice" is clipped to "Verify your pra" by the language switch (`014`). No radar pill for her, so W1 is only the switcher.
- Arabic RTL: translated and mirrored; spinner, ticks and crosses sit on the right (`016`).
- Promise: A1 ("Nothing is granted before a person confirms it"). Kept: sessions are locked. The honest half of the `crisis` position ("the applicant who is waiting ... strands a person") is confirmed on screen.
- Defects: the 40-day wait under "usually within a working day"; support blocked for exactly the person most likely to need it.

### /billing, as the applicant  (screenshots: assess-yasmin/009 desktop en, 018 390px ar)
- **Defect, privacy between clinicians:** Yasmin's Billing shows **"Your earnings we hold $382.50"**, which is Dr Sara's held money (her own /earnings says Held $0 and "No patient payments yet"). `app/(app)/billing/page.tsx` computes the summary from `actor.organizationId`, so every clinician on the Nile Practice seat sees the practice's figure labelled "Your earnings". She also sees the seat slider ("2 seats, $144 a month") and a "Cancel the plan" button for the clinic, as an unverified applicant.
- Arabic RTL: **untranslated** "Seats", "2 seats, $144 a month." (rendered with the full stop at the wrong end, ".seats, $144 a month 2"), "Clinic", "Pay as you go"; amounts render as "$US 0" and "$US 382.50" (`018-billing-mobile-ar-after.png`).

### /earnings and /settings, as the applicant  (screenshots: assess-yasmin/008, 010)
- /earnings: "Charge for your sessions. Set a price and the patient pays before they join. **Start today.**" and a "Set up payouts" button, to a person who cannot run a session. Empty state is otherwise good ("No patient payments yet").
- /settings: "Get paid by patients. **Charge from today.** Until Stripe verifies you we hold your share." Same problem. The "Your practice" card is the one honest line ("With our compliance team. Nothing else is needed from you.") and has an "Open verification" link.

## Arabic pass (Dr Sara, 390px steps 073 to 097, desktop steps 098 to 120)

Overall: `dir=rtl` on every page, no page scrolls sideways, the sidebar moves to the right, the
radar orb moves to bottom LEFT, chevrons point left, and most interface copy is translated. The
defects are specific strings and bidi, listed per page. W1 holds in Arabic too: the pill and the
switcher sit on the H1 at 390px on every page (`073` to `097`).

- **/dashboard** (`073`, `098`): "Clinic" card title untranslated; "مرحبًا، Sara" fine. The email under the avatar truncates at its START ("...emo@example.com"). Works otherwise.
- **/sessions** (`074`, `099`): "50 min · Video" untranslated on every row, and the bidi run breaks it into "min · Video 50".
- **/sessions/new** (`075`, `100`): translated; "غرفة 24Therapy" fine. The orb sits on the first-name input (bottom left now).
- **/bookings** (`076`, `101`, expanded `120`): translated except the zone: "كل الأوقات بتوقيت Cairo". The expanded day is still headed "2026-09-23". Same count-only tiles: the founder complaint holds in Arabic.
- **/patients** (`077`, `102`): "1 session · last" and "6 sessions · last" untranslated, mixed into Arabic dates ("6 sessions · last 15 أغسطس 2026").
- **/notes** (`078`, `103`): the English summary (content) truncates at its START ("...currence of middle-insomnia linked to anticipatory") because the clamp is RTL on LTR text.
- **/copilot** (`079`, `104`): "sessions on record 1" untranslated and bidi-broken.
- **/assistant** (`080`, `105`): "New chat", "50 left this month" and "Speed · 1.0×" untranslated.
- **/on-call** (`081`, `106`): translated; money shown as "$US 75" style. Works.
- **/connect** (`082`, `107`): works.
- **/billing** (`083`, `108`): **the worst Arabic page**: "Seats", "2 seats, $144 a month." (full stop at the wrong end), "Clinic", "Practice", "Pay as you go", "Session · from your credit", "First session, on us" untranslated; amounts as "$US 0".
- **/earnings** (`084`, `109`): "Patient payments" untranslated; amounts as "$US 382.50".
- **/onboarding** (`085`, `110`): works; the Egyptian regulator field stays in English (data).
- **/settings** (`086`, `111`): the section chip row starts off-screen: the first chip ("المساعد الإكلينيكي") is cut at the left edge at 390px. "USD"/"EGP" fine.
- **/settings/codes, /settings/integrations** (`087`, `088`): work.
- **/settings/records** (`089`): half-translated sentence: "لا يستطيع هذا النشر حفظ ربط بعد. يحتاج no client registration and no token sealing key."
- **/support** (`090`, `115`): works.
- **/patients/import** (`091`, `116`): the native file input reads "No file chosen / Choose File" in English.
- **/patients/[id]** (`092`, `093`, `117`): country-code list in English; homework titles and the journal are English content (acceptable). "- · NaN:NaN" chip again.
- **/copilot/[id]** (`096`, `118`): as /patients/[id].
- **/sessions/[id]** (`097`, `119`): "18 سبتمبر, 03:12 · 50 min · Video" (Latin comma, untranslated units); "المتابعة: One week." mixed. The note body is English content.
- Yasmin's /onboarding (`assess-yasmin/016`, `017`) works; her /billing (`018`) has the same untranslated strings as above.

## Opening scroll position at 390px

/patients/[id] and /copilot/[id] open at 390px **scrolled down to the copilot's Ask box**
(`067-detail-mobile-en-after.png`, `068`): the patient's name, the access banner and the back link
are above the fold. The page steals focus into the chat input on load.

## Summary

### The five screens most in need of redesign

1. **/bookings (the calendar).** It is the founder's complaint, confirmed at every view: Day, Week
   and Month are all tiles with a bare unexplained number; hours and patient names appear only after
   tapping a day; the tap also opens a publishing form above the hours; sessions never appear on
   it; it has no door on the phone; and /on-call carries a second, different editor for the same
   hours.
2. **/on-call.** Seven jobs on one 5,000px page (live state, alarm, public profile, a second
   calendar, money history, ratings, practice address) with a money contradiction (keep 90% on the
   card, 85% in the history and in Settings) and a status contradiction ("Someone is booking you"
   under "You are visible to the world").
3. **/billing.** A seat holder, and an unverified applicant, see the practice's seat slider, a
   "Cancel the plan" button and the practice's held earnings labelled "Your earnings" (Yasmin sees
   Sara's $382.50). Three plan cards repeat one sentence three times. Worst Arabic page.
4. **/patients/[id] with its copilot.** Seven sections and three primary actions; the chat is
   upside down, cites "- · NaN:NaN", and stays open (with "24 left") on a patient who withdrew
   access; at 390px it opens scrolled past the patient's name.
5. **/sessions/[id].** A close-out card titled "Before you close this session" on a closed session,
   ending in a disabled button reading "Nothing ticked"; "whole session captured" beside "No source
   is recorded"; a summary version dated before its session; four status words for one state.

Runner-up: **/onboarding for the applicant**: a dead end that says "usually within a working day"
to someone 40 days in, with support blocked.

### Screens with no door (no link reaches them)

- **/support**: linked from nowhere in the clinician app; and it redirects applicants to /onboarding.
- **/settings/records**: no link from the clinician's settings (only from the clinic portal and the EHR callback).
- **/assistant** and **/connect**: no entry in the desktop sidebar; reachable only from the phone's More menu.
- **/bookings (Calendar)**: no entry in the phone navigation (bottom bar or More); desktop sidebar only.
- **/patients/[id]/evidence**: reached only from inside a patient profile ("What we believe, and why"), which is fine, but it is empty for both patients.

### Patterns that repeat

Bad:
- The radar pill and the language switcher sit on the page title everywhere (W1); the orb sits on content at 390px (W2); the alarm modal returns on every fresh load (W3).
- Status words disagree across screens for the same thing: Note ready / Approved / Signed / Completed; Live / Busy, someone is booking you / You are visible to the world; You are verified / Nearly there; Finish verification / Nothing else is needed from you.
- Money figures disagree across screens: fee 10% vs 15%; "Received" vs "Held until payouts open" vs "Available now"; payments dated on the seed day instead of the session day; Tarek "$75 unpaid" on one screen and nowhere else.
- "Stripe" named on /on-call, /earnings and /settings, on a rail with no processor, above an InstaPay form.
- Lists not in date order and mixing "5 days ago" with "15 Aug 2026".
- Deployment and engineering sentences shown to clinicians (/settings/integrations, /settings/records).
- Copy that tells you what the product does not do in a tick-and-cross box (/sessions/new, /onboarding) reads as the opposite at a glance.
- Untranslated fragments concentrated in counts and units ("50 min · Video", "1 sessions", "2 seats"), and "$US" as the currency in Arabic.

Good:
- Every page is RTL-correct in structure, with no sideways scroll at 390px in either language.
- Purpose lines under most H1s are specific and honest ("Nothing is created until you say so", "A person reads this, and answers within a day").
- Empty states on /settings/codes, /earnings (Yasmin) and /patients/[id]/evidence are one line, not a whole card.
- P4 ownership wording on the patient profile is clear ("They own this record since ..., and can withdraw your access").
- A1 holds for the applicant: nothing clinical is reachable before approval.

### Founder complaints (TAKEOVER s10), checked on this portal

- **The therapist calendar hides bookings until a day is expanded: CONFIRMED**, in all three views and both languages (`015`, `019`, `020`, `018`, `120`; `components/scheduling/calendar.tsx` 211 to 245 and 299 to 383).
- **Grey and thin text everywhere: CONFIRMED in part**: secondary text is small slate-500 throughout (subtitles, calendar counts at 11px, the two consequence sentences under the calendar, the "Every answer cites its moment" line).
- **The teal reading as green: CONFIRMED**: the teal primary buttons and the "Note ready"/"Approved"/"Paid" pills sit together and read as one green (`013`, `031`).
- **Empty states taking a whole card: seen once**: /connect's single card and /patients/[id]/evidence's banner-only page; elsewhere empty states are small.
- **Two overlays in front of a form: CONFIRMED**: the "Turn on your alarm" modal over the whole app, plus the radar pill over the title, plus the orb over the New session form (`010`, `022`).
- **Contradictory statuses (said of the session room): CONFIRMED on /sessions/[id]** and across the portal, even without opening the room.
- A price badge reading as part of the price: not seen in this portal. Radar globe, /for-patients, homepage heroes: not in this portal.
