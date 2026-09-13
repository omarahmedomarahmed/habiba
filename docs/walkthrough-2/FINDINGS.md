# 52.3 — the findings pass

Six portals, two languages, two directions, every control found by its visible label first.
Seventy-five frames per language under `frames/en/` and `frames/ar/`, written by
`scripts/walkthrough.ts` against the capture branch `ep-little-sky-a6v9sdx4`.

The instrument records a finding whenever a control cannot be found by what it says on screen and a
CSS selector is needed instead. **Both passes now end at zero findings.** That number is the end of
the story rather than the story: every one of the findings below was raised during the pass, and
what follows is what was found and what was done about it.

Ticket 52.3 asks for what was **hard**, not only for what was broken. Those are separated below.

---

## 1. The headline: the Arabic patient door was in English, and the ratchet could not see it

The Arabic patient sign-in page rendered its heading, its body and every hint in Arabic, and then
its four controls in English:

> **Phone number or email** · **Password** · **Sign in** · **Send me a code**

That is the first screen an Arabic-speaking patient ever sees. `t()` was called three lines away in
the same file.

**Why nobody noticed for thirty-seven sprints.** `scripts/_i18n-coverage.ts` counts visible English
by scanning JSX text nodes plus four HTML attributes — `aria-label`, `placeholder`, `title`, `alt`.
It did not count `label` or `hint`, which is how `<Field>` and `<Submit>` put text on screen in this
repository. There were **176** of those across the app, invisible to the instrument whose only job
is to count visible English.

This is the §6 family landing on the tool built to prevent §6: a check that passed by measuring the
wrong thing, where the thing it could not measure was most of the text.

The sharpest part is that the blind spot was **written down**. The note in `_i18n-coverage.json`
said plainly that "a string passed as an ordinary prop is invisible to it", and then argued the
ratchet was still the right one because it "cannot be satisfied by remembering". It could. It could
be satisfied by using a `label` prop. **A documented limitation whose cost is never counted is a
limitation nobody acts on** — and the cost here was the patient's own front door.

**Fixed, both halves.** `label` and `hint` are counted now, by name rather than by "any string prop"
(counting every prop would sweep up ids, routes and variants and give a number that moves when
somebody renames a variable, which is the failure sprints 51 and 53 each had to correct). And the
surface the finding was about was finished rather than merely re-measured: ten files keyed, 46 new
`MessageKey`s in both languages, and the patient surface went from **47 to 0**.

The floors rose on the two surfaces where the newly visible debt lives — admin 294 to 420, shared 60
to 80. That is pre-existing debt becoming visible, and the reasoning is recorded in
`_i18n-coverage.json` where the ratchet requires a rise to be argued for.

---

## 1b. And there was a SECOND blind spot, larger, found in a frame

With the `label` fix in and the patient surface reading **0**, the Arabic account screen still showed
two English controls: **Add a photo** and **Save your name**.

```tsx
{busy ? "Uploading…" : hasPhoto ? "Change your photo" : "Add a photo"}
{pending ? "Saving…" : "Save your name"}
```

Invisible for a different reason: `literalsIn`'s text-node pattern is `>([^<>{}]+)<`, which excludes
any run containing a brace, so **a JSX expression container is skipped entirely**. Every string
inside a ternary — which is where this codebase puts the pending state of every button it has — is
uncounted.

**That is a zero that does not mean zero**, and it was caught by looking at a picture rather than by
running a check. Which is the argument for 52.3 existing: the ratchet said the patient surface was
clean, and a frame said otherwise.

**The patient surface's share is keyed** — 30 more keys across fourteen components, both languages,
including the four local `Submit` helpers whose `"Working…"` was hardcoded in four separate files.
The Arabic account screen is now Arabic all the way down.

🔴 **The shape itself is NOT counted, and is left as a named gap rather than closed in a hurry.** A
regex for "a quoted string inside a brace" would also count Tailwind class names and enum values, and
a ratchet that counts class names is one that moves when somebody restyles a button — which is
exactly the failure sprints 51 and 53 each had to correct. Counting this needs a parser, not a
pattern. It is the next piece of i18n work and it is bigger than this one.

---

## 2. The patient portal had no way in at all

`patient_accounts` held **zero rows** on the capture branch. The seed created `patients` (what a
clinician wrote down) and `people`, and never created an account (somebody with a password) or a
claim (the moment the second takes over the first). Sprint 6 made those three distinct facts on
purpose; a seed that creates only the first models a product where nobody ever signs in.

So the first pass photographed `/patient/login` and `/patient/signup` and stopped. Two pictures of
two doors, filed as the patient walkthrough — and 37R.8 asks whether the patient app looks like the
best mental-health app anybody has built. Two doors cannot answer that.

Fixed in `scripts/seed-capture.ts`: an account, a claim and a history grant per cast patient. The
patient flow now walks fourteen screens.

---

## 3. Two records of one fact, and the screens read the softer one

Seeding a history grant failed on a database trigger:

```
history_grants: a grant cannot be held by a clinician whose verification is not approved
```

with all three clinicians already carrying `users.verification_status = 'verified'`. The trigger
reads `therapist_verifications.state = 'approved'` — a **different table**, which was empty.

So a clinician row can say *verified* on every screen in the product while the constraint protecting
the clinical grant says they are not. The trigger is right; the screens read the softer column. The
seed now writes both, which closes it here and not elsewhere: **what else reads
`users.verification_status` and believes it is a question this pass could not answer and did not
try to.** It is left named rather than absorbed.

---

## 4. The session room runs. The video does not, and it says so.

Established directly before any cut was scripted, because a film of a room that does not work is the
one artefact this project must not produce.

With `DAILY_API_KEY` unset:

* the room **renders**, the clock runs, status goes **Live**, the transcript pane opens and says
  *Listening…*, the copilot appears, ending the session lands on the sign-and-release screen, and
  there are **no page errors**;
* the video tile **does not**. In its place the product says, in its own words: *"Video is not
  configured — The session is still recorded and transcribed. Add a Daily.co API key to enable video
  calls."*

The in-person path (*Record from this device*), which is the default and the majority flow, has no
such gap and was walked end to end: new session, patient chosen, room opened, recording started,
session ended, note written.

**For the edit list:** a cut of "The 24Therapy room" shot on this build puts that banner on screen.
Not stubbed, not hidden, not worked around. The patient and therapist cuts can be made entirely from
the in-person path with nothing missing.

---

## 5. Four findings the instrument raised against itself

Every one of these was a false accusation against the product, and each is the same shape as the
defects this project keeps finding — a check that passes, or fails, by measuring the wrong thing.
They are listed because an instrument nobody audits is an instrument nobody should trust.

| What it reported | What was true |
| --- | --- |
| All four portals: *"the form accepted the credentials and did not move"* | The screenshot was taken while the button still said **One moment…**. Signing in takes 1.9s, most of it password hashing. `networkidle` is satisfied the instant a server-action click returns, before the navigation has begun. Now waits for the URL to leave the door. |
| `/patient/login` *"does not present an email and a password field"* | It does. The field says **Phone number or email** and is a plain text input, because a patient may have signed up with either and `type="email"` would refuse a phone number. The product was right; the instrument asserted the absence of a thing by looking for one spelling of it. |
| The Arabic pass hung for thirty seconds trying to click a sign-in button | `getByText(/sign in/i)` matched `<title>Sign in · 24Therapy</title>` — an element that exists, is never rendered, and is in English on every page whatever the locale. `control()` now requires visible, not merely present. |
| The Arabic pass could not find any control | Every target was a hardcoded English literal. A hardcoded English label in a bilingual walkthrough is a check that can only ever pass in one language, and the language it fails in is the one nobody is looking at. The labels come from `lib/i18n/messages.ts` now, which also makes the walkthrough a coverage test: a key missing from `ar` shows up as a control that cannot be found. |

The first of those is worth stating plainly: **four false findings is worse than none**, because a
findings pass nobody can trust is a findings pass nobody reads.

---

## What was HARD

Not broken. Harder than it should be, or surprising on the way through.

**The frames folder held one language at a time.** A full run cleared `frames/` and wrote 75 files
under names that do not mention the locale, so the Arabic pass silently replaced all 75 English
frames. Two of the four cuts are bilingual and the RTL pass is the entire point of the Arabic one.
Now `frames/en/` and `frames/ar/`.

**Six doors, five English words for one field.** `Email` (therapist), `Work email` (staff), `Email
address` (clinic, sponsor, partner), `Phone number or email` (patient). In Arabic all five collapse
to البريد الإلكتروني except the staff one, so **the translated product is more consistent than the
English it was translated from.** "Phone number or email" is genuinely different and should stay;
the other four are one field wearing four labels.

**The patient's identity field gives the phone no keyboard hint.** `<Input id="handle"
autoComplete="username" />` carries no `inputMode`. On the device this product is designed for, a
field that accepts a phone number or an email opens the alphabetic keyboard. Defensible — the field
really does accept both — but it is the first thing a patient types on a phone, and nobody chose it.

**The patient picker on `/sessions/new` is a native `<select>`.** It cannot be clicked by its option
text. Recorded as a note rather than a finding: a native select *is* the findable control on a
phone, and the derived "Where" question above it is the one 41.2 put in place of the modality
toggle. It is the only control in six portals that needed a different kind of handle.

**The empty states are the best writing in the product and they are all anybody would see.** The
homework screen says *"Small things you and your therapist agreed on. Do them or do not, nobody is
counting."* The summary screen says *"Every version stays, with the name of whoever wrote it, and
nobody can take one back."* Both then show an empty card, because the cast has no homework, no
journal entry, no released summary, no assessment result and no message. See the note below: this is
a capture problem and not a product one, and it is the single biggest thing standing between these
frames and four usable films.

---

## Carried into 52.4 / the capture, not absorbed

1. **The cast needs content, not just accounts.** Homework, a journal entry, a released summary, an
   assessment result, a check-in exchange, a paid invoice. Without it the patient cut is four
   minutes of beautifully written empty states.
2. **The patient's session list repeats one sentence.** Five sessions, five identical *"Your
   therapist is still writing your summary."* That is the probe runs' residue rather than a defect,
   and it shows what a patient sees when a therapist never releases one. The capture seed should
   leave a mix.
3. **What else reads `users.verification_status`** and believes it, per finding 3.
4. **`inputMode` on the patient handle field**, per the note above.
5. **admin 420 and shared 80** are now recorded floors. They are debt made visible, and they only
   ever go down.
