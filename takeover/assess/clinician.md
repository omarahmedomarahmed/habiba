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
  "Not now" dismisses it for that page load only; it came back on the next navigation in a fresh
  context. (`010-sign-in-as-sara-after.png`)
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

