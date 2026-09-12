# The walkthrough — what broke, and what was hard

**Sprint 22R.9. Written while walking the product as each kind of person, on a
freshly purged production database with one seeded admin and nothing else.**

Every account below was created through the real forms, in a real browser, at a
phone-sized viewport (430×932). Nothing was inserted to make a screen work,
with two exceptions declared in place: the words that would have been *spoken*
in a session (this browser has no microphone), and clearing the sign-in
throttle between roles, which was doing its job by stopping me.

The screenshots in this folder are the pages as they were, in the order they
were met. `sweep/` is every route for every role, 50 pages, all reachable.

---

## Part 1 — What was broken

Seven defects. Not one of them was visible to a verifier: in every case the
database was right, the query was right, the import graph was right, and the
screen was wrong.

### 🔴 1. The invite link a therapist hands over did not work

`/patient/invite/<token>` is the link a clinician gives a patient in the room.
For most of this book it is the *only* claim route that can work — §3b: most
patients have no email address at all.

Opened with no cookie, the middleware sent it to `/patient/login`. A patient
met a sign-in form for an account they do not have, with no mention of the
invite, of their therapist, or of what the link was for. The page behind it is
written for exactly that person — *"create an account or sign in, then open
this link again"* — and nobody could reach it.

**Fixed.** `PATIENT_OPEN_ROUTES` in `lib/routing.ts`, with a test that asserts
all four cookie states.

### 🔴 2. Signing up from the invite dropped the invite

The signup form carries `inviteToken` in a hidden field. `patientSignUp` never
read it. A patient who followed their therapist's link was dropped into the
*matching* route instead, which asks for a code by email or WhatsApp.

They have no email. WhatsApp is waiting on Meta. So the screen said:

> We could not send your code. Check the email address on your account, or ask
> your therapist for an invite link instead.

— to somebody with no email address, holding the invite link it suggests they
ask for. **A dead end on the primary way into this product.**

**Fixed.** Signup now hands them to the invite page, which asks the §3 step 7
consent question rather than answering it on their behalf.

### 🔴 3. The claim screen offered the patient their own record

Signing up creates a `people` row of your own, carrying the number you signed
up with. The matcher matched it. So the claim screen showed **two** cards, both
worded *"a therapist keeps notes for someone with your phone number"* — one of
them the patient's own empty row.

**Fixed.** `suggestionsFor` excludes the person the account already owns.

### 🔴 4. Claiming succeeded and showed an error

Press *"This is me — claim it"* and the success card appears — then, within the
same second, is replaced by:

> This link is no longer valid. It may have been used already, expired, or been
> taken back. Ask your therapist for a new one.

The action revalidates, the page re-runs on the server, and a single-use token
that has just been used no longer resolves. Everything worked. The last thing
the patient saw was an error.

**Fixed.** The claim lands on their own home now, with a confirmation and the
record it produced on the screen behind it.

### 🔴 5. The patient claimed their record and their app was empty

The worst of the seven. `patient_accounts.person_id` is what every patient
screen reads; claiming attaches a *different* person — the therapist's — and
nothing moved the account onto it.

So after a successful claim the patient's own home said:

> **Your record** · Not claimed yet · No therapist files are attached to your
> account yet.

…while their session, their clinical note and their approved summary sat in the
record they had just taken ownership of. `people.claimed_at`, the
`person_claims` row, the grant decision and the audit entry were all correct.

**Fixed.** `bindAccountToPerson`, on both claim routes, and only when the
account's own person carries no clinical record — where it does, two people
would have to be *merged*, and merging is what sprint 5 ruled we never do
silently. Walked again afterwards: "Your record — **Yours**", and the session
is there.

### 🔴 6. …and then the file count said zero

With the account on the right record, the same screen still said *"No therapist
files are attached to your account yet"* while the database, asked the same
question directly, said one. A correlated `sql<number>` subquery inside the
`select()` returned 0.

**Fixed.** Its own query. The screen reads "1 therapist file attached."

### 7. Two patients, one number, no warning

Adding a patient whose phone number is already on your caseload creates a
second record and a second person, silently. Sprint 5 ruled that matching is
*suggest-only, never merge* — the suggestion never appears at the point where a
duplicate is being made.

**Not fixed.** It needs a decision about what the suggestion should say and
what it offers to do; it is a real risk of split histories, and it is the one
finding here I would put in front of a clinician before choosing the wording.

---

## Part 2 — What was hard

This is the part a verifier cannot report. None of it is a bug.

### The verification form shows you an empty form after you have filled it

Save your country, licence body, licence number, languages and specialties, and
the page reloads with **"Choose a country"** and empty fields — while the
summary card underneath ("Nearly there") correctly lists what is saved. The
data is there. The form does not show it.

Two people out of three will fill it in again. Somebody careful will wonder
whether they broke something. It is the first screen a new clinician sees after
signing up, and it is the one that reads as untrustworthy.

### There is no way to tell what you already uploaded

The four document cards look identical whether or not a file is behind them —
the button changes from *Upload* to *Replace*, and that is the only signal. I
uploaded the same licence photo four times because I could not tell which card
had taken it. On a phone, holding a passport, this matters.

### "Try again shortly" does not say how long

The sign-in throttle is right to exist and it stopped me twice. But it says
*"Too many sign-in attempts from this connection. Try again shortly."* The
limiter knows the answer — `consume()` returns `retryAfter`, and the radar's
booking action already prints *"try again in 3 minutes"*. A person locked out
with no number retries, fails, and is not sure whether they are locked out or
wrong about their password.

### The patient's bottom navigation appears before they have an account

Open an invite link signed out and there is a Sessions / Steps / Billing / You
bar at the bottom of the screen. Every one of those is a redirect back to
sign-in. It is furniture for an app they have not joined yet.

### Approving the patient's summary is behind a tab you have to know to press

After signing a note, the app switches to the *Their summary* tab and *Approve
and send* is right there — good. Come back to the same session an hour later
and the page opens on *Clinical note*; the summary is still unapproved, the tab
says so in small grey text, and the button that sends the patient their
letter is one tap away and invisible.

I only found it because I knew it existed. A therapist who signs the note,
closes the phone and comes back has no prompt anywhere that a patient is
waiting for a summary.

### The note is called SOAP and quietly renders three of four letters

The generated note came back with Subjective, Objective and Plan. There was no
Assessment, and the heading simply is not rendered — no placeholder, no "the
model did not produce this". A clinician skimming a familiar shape does not
notice a missing section; they notice a *wrong* one.

### "First session — on us" is the only thing on the billing page

Correct, and the right thing to say. But the page also says *"Payments are not
configured on this deployment"* at the top — which is honest here and would be
alarming on the real one. Worth checking that this line is impossible in
production rather than merely unlikely.

### The claim question is asked in the plainest English on the site

Credit where it is due. *"Let this therapist keep seeing my profile — off by
default, even though they sent you this link. If you leave it off they keep the
notes they already wrote and nothing else."* That is the hardest idea in the
product, put to somebody in one sentence, defaulted the safe way. Nothing else
in the walkthrough was as good as that screen.

---

## What this walk did not cover

Stated plainly, because a list of what was checked is worth nothing without it.

- **A second therapist and revocation** (22R.3). Not walked.
- **Documents and the copilot** (22R.4) — uploading history, asking a question,
  checking citations resolve and that a revoked clinician gets nothing.
- **The copilot allowance being reached and refused, the radar, on-call, a
  payout request, EGP and USD, buying a bundle, and upgrading then downgrading
  while holding 30 unused sessions** (22R.6). Stripe is not configured on this
  deployment, so the money paths cannot be walked here at all.
- **A manager and a staff member signed in as themselves** (22R.7). Only the
  super admin was walked; the console's fifteen sections were all reachable.
- **A real session with audio.** The room degrades honestly without a
  microphone — *"No microphone access, so nothing is being transcribed"* — and
  an empty session refuses to invent a note, which is the right refusal. The
  transcript for the note below it was written into the database by hand and is
  declared as such.
