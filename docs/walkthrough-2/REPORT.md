# The second walkthrough

Sprint 37R. Fourteen sprints and 57 route files after 22R, somebody used the
product again.

Everything below was done against a **freshly purged database** on the working
Neon branch: `scripts/reset.ts --i-mean-it`, one seeded admin, then
`ship:content 28 24`. Every account was created through the real forms. The
screenshots are in this directory, 334 of them, synthetic people only.

---

## 1 · What could not be walked, and why

This deployment has `DATABASE_URL` and `OPENAI_API_KEY` and nothing else. Five
capabilities are therefore **not walked in this sprint**, named here rather
than absorbed:

| gap | what is missing | what it blocks |
|---|---|---|
| **E1** | `BLOB_READ_WRITE_TOKEN` | Every upload. Verification documents (37R.3), patient profile documents and the document copilot with citations (37R.5). The onboarding page says so itself in an amber banner, which is the right behaviour |
| **E2** | Stripe keys | Invoices, payment, bundles, upgrade and downgrade, payouts (37R.3 tail, 37R.6). `/billing` and `/earnings` both say payments are not configured |
| **E3** | WhatsApp and email providers | Code delivery, so the **code half of the claim flow cannot be completed** (37R.10, 37R.11), the session summary email, the record export and the verification code at `/verify/[code]` (37R.15) |
| **E4** | Daily.co key | The video call. Audio capture, transcription and the note all still run; only the picture is absent |
| **E5** | OpenAI credits | The model half. A local mock stands in for transcription and note generation, so every transcript line reads `Transcribed chunk N` and every note is the same fixture note |

Two deviations inside the walkthrough itself, both recorded in the scripts that
made them:

- **W1** — the three verification documents were written straight into
  `therapist_verifications` (`.walkthrough2/stub-docs.ts`) because E1 blocks
  the upload. Everything after that — the real **Submit for verification**
  button, the real admin queue, the real approval — ran through the product.
- **W2** — a transcript with crisis language was seeded into one session
  (`.walkthrough2/seed-risk.ts`) because E5 means the microphone can only
  produce `Transcribed chunk N`. The risk assessment itself was then produced
  by the product's own `assessSessionRisk` on session finish, and its keyword
  floor needs no model.

One thing that looks like a defect in the screenshots and is not: the time zone
selector offers **UTC** on the patient signup page. That is the headless
browser's own zone, correctly detected. A real phone in Cairo reports
`Africa/Cairo`.

---

## 2 · The finding

### 🔴 C184 — the SOS orb showed an Egyptian patient a United States number

The single most safety-critical control in the product, pressed for the first
time by anybody in this sprint.

Layla's number is `+20 100 123 4567`. Her therapist practises in Egypt. Her
record was created from an Egyptian dialling code. The sheet that opens when
she presses SOS led with a large red card:

> 🇺🇸 **Help · 988 · United States**

`lib/crisis/line.ts` exists precisely to prevent this. Its own doc comment
says *"This product's first market is Egypt, and `tel:988` dialled from Cairo
reaches nothing"*. It exports `crisisLine(country)`, which returns null for
every country except the United States.

**The orb never called it.** It rendered `Object.entries(CRISIS_LINES)` — the
whole table — and the table has one row, so every patient on earth was shown
the American lifeline as the primary action. The always-true sentence
underneath ("call your local emergency number") was correct and was the second
thing on the screen rather than the first.

This was invisible to every verifier in the repository, and it would have
stayed invisible: the string `988` legitimately lives in `lib/crisis/line.ts`,
the component imports from the right module, and nothing about the code looks
wrong until you are a patient in Cairo looking at a flag that is not yours.

**Fixed.** `lineForNumber(e164)` does a longest-prefix match over the dialling
codes and answers only when the match leaves exactly one verified line between
its candidate countries — so `+20` gets nothing and falls through to the
sentence, and `+1` still gets 988 because the United States and Canada leave
one line between them. The orb takes the reader's own number, the patient
layout supplies it from the session, and eight unit tests hold both directions.
`verify:sprint37r` proves the scan that catches the old shape by running it
against the old shape.

**Re-walked after the fix:** the Egyptian patient's sheet now reads *"Anywhere
else, call your local emergency number. It is free from any phone, and works
with no credit and no SIM."* and nothing else. A `+1` number still gets 988.

---

## 3 · Everything else that was wrong

| # | severity | finding | state |
|---|---|---|---|
| **C184** | 🔴 critical | The SOS orb printed the only line in the table to every patient in every country | **fixed** |
| **C185** | major | A signed-out visitor on an invite link or the signup page got the four-tab bottom bar, **every destination of which bounces to a sign-in screen**. `PatientChrome` has always taken a `nav` prop and its own comment explains exactly this; nothing ever passed it, so the default won | **fixed** — the layout asks `optionalPatient()` once and uses the answer for both the bar and the orb |
| **C185b** | minor | `/patient/claim` and `/patient/t/[id]` had no way back at all, and the nine pages that did have one all pointed at a fixed `/patient` rather than at where the reader came from | **fixed** — one `PatientBack` component, `router.back()` with a named fallback for the WhatsApp deep link that has no history |
| **C186** | major | Adding the same person twice — same phone, same email, ten seconds apart — created **two patient records with no warning of any kind**. In a product whose identity model is *the number is the handle*, the invite, the claim and the summary then attach to one of the two and the clinician reading the other sees half a history | **fixed** — refused, naming the record that already holds the number, with a deliberate tick for the real case of two people sharing a phone |
| **C187** | minor | The therapist's Crisis Radar control is a floating white circle containing a 12px grey dot. No icon, no text. On the walkthrough it read as a stray element or a spinner | **fixed** — the sidebar's own radar icon, with the status dot as a badge on it |
| **C188** | major | The admin console's sixteen destinations sit in one non-wrapping row capped at `max-w-5xl`. At 1440px it clips mid-word after "Radar lists": **Announce, Site content, Settings, Strings and the Audit log are off the screen**, with no fade, no arrow and no other link to them anywhere in the console | **fixed** — the row wraps on large screens and keeps horizontal scroll on phones |
| **C189** | minor | The invite landing said *"Create an account or sign in, then open this link again."* Untrue: signup carries `?invite=` and sign-in carries `?next=`, and both land back on the claim | **fixed** |
| **C190** | minor | The phone country selector beside a stored `+20…` number showed **United States**. Harmless to the data (`toE164` ignores the selector for E.164 input) and alarming to read | **fixed** — the selector is seeded from the number |
| **C191** | minor | `publishWhatIsTicked` confirmed with *"chart signed, their copy released, summary version 1 published."* — a sentence assembled from fragments and never given its capital | **fixed** |
| **C192** | minor | The consent screen tells a patient *"Used by Yasmin Farouk. Look for their request above"* whether or not the request is still above. After answering it, they are sent hunting for a section that has gone | **fixed** — it now says which |
| **C193** | observation | Signing up with a number that already has an account answers *"We could not create that account. Try signing in instead."* The wording is already deliberately neutral (the code says so, and matches the wrong-password message) but the **outcome** still differs from a successful signup, so a stranger who types an ex-partner's number learns they have an account here. The proper fix is a neutral response plus a message to the real owner, which needs E3 | **recorded, not fixed** |
| **C194** | observation | The admin usage chart with one day of data renders as a single full-height bar filling the card — it reads as a broken block rather than a chart | **recorded** |
| **C195** | observation | `/patient/residency` tells an Egyptian patient her record is kept *"In United States, which is where it belongs."* That is true of this deployment — the organisation is in the default region — but the sentence will read badly to the first Egyptian patient who opens it | **recorded** |
| **C196** | observation | The SOS button's accessible name is "Get help now", which does not contain its visible label "SOS" (WCAG 2.5.3). Voice control cannot press it by name | **fixed** — the name is now "SOS, get help now" |

### 🔴 C182 — the product is not localised, only the website is

The biggest finding after the orb, and it is scope rather than a bug.

Every page was rendered with `Accept-Language: ar-EG`. Direction is **correct
everywhere**: 71 of 71 Arabic renders came back `dir="rtl"`, and no page
scrolls sideways on a phone in either language. What is inside the frame is
English:

| group | pages rendering English text in an Arabic, RTL layout |
|---|---|
| the whole admin console | 18 of 18 |
| the therapist portal | 21 of 21 |
| the patient app | 14 of 14 |
| sign-in and sign-up | 8 of 8 |
| the public site | 8 of 10 — only `/` and `/for-patients` are properly Arabic, with `/privacy` and `/terms` part-translated |

`lib/i18n/messages.ts` holds **87 keys**, 43 of which are used, by **4
components**. The product has something like a thousand strings. Sprint 31
shipped Arabic *addresses* and Arabic *CMS content*, and both work; it did not
translate the application, and nothing since has.

For a product whose first market is Egypt and whose patient app is the thing
somebody opens in a crisis, this is a sprint of its own. It is written up as
C182 in PLAN.md with a proposed shape.

---

## 4 · What worked, and I checked each one

- **The whole clinical loop.** Therapist signs up → onboarding → submits →
  admin approves → adds a patient with a phone number → invite link → patient
  signs up → claims → session → recording → transcript → note → the one
  approval screen with three items → signed, released, summary version 1.
- **The claim order (C121) is exactly right.** Before anything is proven the
  screen says: *"We have not looked yet. A phone number proves a number, not a
  person, so we check that you can receive a message at +20… before we say
  anything about any record."* The therapist's name is masked to `L•••• M••••••`
  on the invite claim. Nothing about any record appears before the handle.
- **Consent is off by default even on an invite the therapist sent.**
- **The risk assessment** fires on a seeded crisis transcript: *"Risk assessed
  for this session · elevated. Read the quoted lines before the next session.
  Matched against the crisis phrase list. Matched: better off without me."*
  With no model credits, that is the keyword floor working alone, which is the
  half that must never be dark.
- **Portability end to end.** Patient issues a code → therapist redeems it at
  `/connect` → patient is asked, with *"Yes, for 24 hours"*, *"Yes, until I
  change my mind"*, *"No thanks"* → access granted → the evidence screen opens.
  Then ask-my-old-therapist, declined with a reason, and the patient sees
  *"They said no. In their words: …"*. That round trip is the best-built thing
  in the product.
- **The evidence screen refuses without a grant** and says what is still
  visible and what is not.
- **Honest degradation everywhere.** The claim page says WhatsApp codes are not
  switched on and offers the invite link instead; onboarding says file storage
  is unconfigured; billing and earnings say payments are not set up; the room
  says video is not configured **and that recording and transcription still
  work**. Not one of these is a silent failure.
- **The invite link is shown once**, and the record page afterwards says *"A
  link issued on 11 Sept 2026 is still unused. It expires 11 Oct 2026. We
  cannot show it again"*, with **Cancel that link** and **Issue a new one**.
- **Empty states exist and read well** on the therapist portal: *"No sessions
  yet — start one and your note will be waiting when you finish."*
- **`/ar/*` for private paths redirects to the unprefixed route**, 124 times,
  exactly as C153 says it should.
- No page returned a non-200. No page scrolls horizontally on a 414px phone.

---

## 5 · Every page, judged as a design

The rule for this table: *would somebody paying for this believe it was
finished?* — asked separately from whether the buttons work.

**Verdicts.** `finished` = sections, cards, icons, hierarchy, something to rest
the eye on. `thin` = correct and plain: a heading, some text, one card, no
visual structure doing any work. `unstyled` = a heading and a paragraph.

**Method, stated so the table can be trusted.** The columns are measured on
every page: `icons` is the number of rendered SVGs, `panels` the number of
elements with a border, a shadow or a background of their own, `words` the
visible word count. Pages marked **seen** I opened and looked at; the rest are
judged from those counts plus their rendered text. Everything was captured at
414px and 1440px, in both languages.

### The public site

| page | verdict | icons | panels | words | what is missing |
|---|---|---|---|---|---|
| `/` | finished ·seen | 25 | 58 | 1207 | Nothing. The best page in the product |
| `/for-patients` | finished | 23 | 59 | 1483 | Nothing |
| `/radar` | finished | 4 | 9 | 55 | No `h1`. The empty state ("No one on shift") is a bare line |
| `/privacy` | thin | 4 | 12 | 301 | **Two `h1`s.** Long prose, no table of contents, no anchors |
| `/terms` | thin | 1 | 6 | 199 | **Two `h1`s.** Same |
| `/developers` | thin ·seen | 0 | 1 | 310 | Genuinely well set: an amber callout and four ruled sections. No icons, and a wide window leaves half the screen empty |
| `/for-clinics` | thin | 0 | 1 | 348 | Prose only. No pricing block, no logos, no call to action a clinic could press |
| `/integrations` | thin | 0 | 10 | 165 | A list of names with no logos and no status chips |
| `/integrations/[slug]` | unstyled | 1 | 1 | 103 | A heading, a paragraph, one link. Nothing to say what the integration does |
| `/verify` | unstyled | 0 | 2 | 37 | One input on an empty page. The most reassuring screen in the product is the plainest |

### Signing in and up

| page | verdict | icons | panels | words | what is missing |
|---|---|---|---|---|---|
| `/signup` | thin ·seen | 0 | 6 | 66 | Clean and calm; no icon, no proof, nothing about the product beside the form |
| `/login` | thin | 0 | 4 | 25 | Same |
| `/patient/signup` | thin ·seen | 0 | 8 | 571 | Works hard and reads well. The two long dropdowns (country, time zone) dominate it |
| `/patient/login` | thin | 0 | 7 | 72 | |
| `/forgot-password` | unstyled | 0 | 3 | 27 | Heading, one field, one button |
| `/patient/forgot-password` | unstyled | 0 | 3 | 43 | Same |
| `/reset-password` | unstyled | 0 | 1 | 18 | The invalid-link state is one sentence on a blank page |
| `/staff/sign-in` | unstyled | 0 | 3 | 18 | Fine for a staff door |

### The patient app

| page | verdict | icons | panels | words | what is missing |
|---|---|---|---|---|---|
| `/patient` | finished ·seen | 7 | 10 | 73 | **No `h1`.** Otherwise the second-best screen in the product |
| `/patient/radar` | finished ·seen | 9 | 13 | 60 | No `h1`. The globe is the only genuinely delightful thing here |
| `/patient/consent` | finished | 1 | 8 | 211 | Three sections that each carry their own explanation. One icon in the lot |
| `/patient/account` | thin | 1 | 14 | 182 | Bottom-tab root, no icons, a stack of fields |
| `/patient/journal` | thin ·seen | 2 | 5 | 67 | The dictate button is the only affordance; an empty journal shows nothing to start from |
| `/patient/sessions` | thin | 2 | 3 | 27 | All · Upcoming · Past are text, not tabs anybody would recognise |
| `/patient/record` | thin | 2 | 2 | 69 | One explanatory card and a link |
| `/patient/profile` | thin | 1 | 2 | 77 | Empty state is a grey sentence |
| `/patient/browse` | thin | 2 | 2 | 17 | **17 words.** "Nobody has been listed yet" with nowhere to go |
| `/patient/summary` | thin | 1 | 1 | 75 | The versions list is unstyled text under a heading |
| `/patient/claim` | thin | 0 | 2 | 61 | Carries the most important sentence in the product in plain body text |
| `/patient/billing` | thin ·seen | 0 | 1 | 63 | A bottom-tab root with one card, no icon, and fine print in grey |
| `/patient/homework` | thin | 1 | 1 | 38 | A tab root whose empty state is one sentence |
| `/patient/residency` | thin | 1 | 1 | 33 | One sentence in a card |
| `/patient/t/[id]` | finished | — | — | — | Shared with the public profile; now has a way back |
| `/patient/invite/[token]` | thin ·seen | 0 | 3 | 36 | The claim screen it leads to is the important one and reads well |

### The therapist portal

Every page here is a **single ~620px column pinned beside the sidebar**, so on
a 1440px laptop roughly 40% of the screen is empty. That is one decision, and
it is the portal's biggest design problem (**C197**).

| page | verdict | icons | panels | words | what is missing |
|---|---|---|---|---|---|
| `/onboarding` | finished ·seen | 19 | 73 | 642 | Nothing. Cards, icons, an honest amber banner, a live checklist |
| `/settings` | finished ·seen | 14 | 43 | 880 | Nothing, other than the dead space |
| `/on-call` | finished | 21 | 93 | 792 | |
| `/sessions/[id]` | finished ·seen | 18 | 29 | 324 | Nothing. The three-item approval card is the best-designed thing in the portal |
| `/patients/[id]` | finished ·seen | 17 | 24 | 284 | |
| `/copilot/[patientId]` | finished | 28 | 24 | 181 | |
| `/sessions/new` | finished ·seen | 14 | 14 | 104 | |
| `/dashboard` | finished ·seen | 17 | 13 | 59 | Four cards and a very large empty right-hand side |
| `/patients/[id]/documents` | finished | 13 | 13 | 175 | |
| `/assistant` | finished | 14 | 18 | 152 | |
| `/billing` | finished | 15 | 18 | 130 | |
| `/earnings` | finished | 14 | 13 | 95 | |
| `/support` | finished | 11 | 13 | 81 | |
| `/connect` | thin | 11 | 10 | 62 | Most of its icons are the sidebar's. Two sections, both plain |
| `/copilot` | thin | 12 | 10 | 63 | An empty conversation list |
| `/patients` | thin | 13 | 10 | 33 | **33 words.** A count and a dashed "Add a patient" button |
| `/sessions` | thin | 13 | 10 | 29 | **29 words** |
| `/notes` | thin | 12 | 9 | 37 | |
| `/patients/[id]/evidence` | thin | 12 | 8 | 57 | **No `h1`.** The empty state is one grey sentence, on the screen whose whole job is explaining why the system believes things |
| `/settings/codes` | thin ·seen | 1 | 5 | 138 | Explains itself very well and looks like a form from 2009. The QR code itself is the only graphic |

### The admin console

Nine of eighteen pages have **zero icons**. This is the part of the product
nobody has ever looked at, and it shows (**C183**).

| page | verdict | icons | panels | words | what is missing |
|---|---|---|---|---|---|
| `/admin/strings` | finished | 19 | 528 | 1798 | A real editor. Dense but organised |
| `/admin/taxonomy` | finished | 5 | 227 | 550 | |
| `/admin/content` | finished | 28 | 15 | 144 | |
| `/admin/radar` | finished | 4 | 18 | 107 | |
| `/admin` | thin ·seen | 0 | 7 | 53 | Four stat cards, no icons, and a one-bar chart that reads as a broken block (C194) |
| `/admin/vault` | thin | 1 | 30 | 303 | A table with no visual hierarchy |
| `/admin/settings` | thin | 0 | 58 | 416 | 58 panels and not one icon; a long undifferentiated form |
| `/admin/audit` | thin | 0 | 101 | 954 | **The audit log has no table, no filters and no icons** — 101 stacked rows of text |
| `/admin/announce` | thin | 2 | 7 | 59 | |
| `/admin/ratings` | thin | 3 | 5 | 36 | |
| `/admin/therapists` | thin | 2 | 8 | 39 | |
| `/admin/verifications` | thin ·seen | 1 | 2 | 30 | The queue itself is good; the page around it is a heading and a filter row |
| `/admin/numbers` | unstyled ·seen | 0 | 2 | 57 | Heading, explanation card, "No number changes waiting." |
| `/admin/payouts` | unstyled | 0 | 4 | 45 | |
| `/admin/support` | unstyled | 0 | 4 | 36 | The support queue has no icons and no status colour |
| `/admin/usage` | unstyled | 0 | 6 | 95 | Two tables of numbers, no chart, on the page that is about a trend |
| `/admin/errors` | unstyled | 0 | 1 | 71 | One card |
| `/admin/tv` | unstyled | 0 | 5 | 30 | **No `h1`**, 30 words, and it is meant to go on a wall |

### Not reached

`/pay/[token]`, `/feedback/[token]`, `/support/[token]`, `/verify/[code]` and
`/join/[token]` need a live invoice, a finished rating, a support thread, an
issued export and a session invite respectively — E2 and E3 block the first
four. `/admin/content/[id]`, `/admin/therapists/[id]` and
`/admin/radar/investigate/[id]` need rows this walkthrough did not create.
`/j/[code]` and `/patient/invite/[token]` **were** walked.

**Tally: 13 finished, 34 thin, 14 unstyled**, plus the pages not reached.

---

## 6 · What was hard (37R.24)

Not what was broken. What cost me time, in order.

1. **The admin console's navigation hides a third of itself.** I did not know
   `/admin/strings` or `/admin/audit` existed until I read the route list. On a
   laptop they are simply not on the screen, and nothing else links to them.
2. **The therapist's radar control is an unlabelled grey dot.** I had to read
   the DOM to find out what it was. A clinician will not do that.
3. **The invite link is shown exactly once**, and the sentence telling you so
   is *below* the field. I lost the first one by navigating away. The recovery
   ("Issue a new one") is good, but the warning needs to be above the link, not
   under it.
4. **"Create an account or sign in, then open this link again"** made me think
   I had to keep the WhatsApp message. I did not.
5. **The language and specialty chips on onboarding cannot be selected with a
   keyboard-style click on the input** — the checkbox is `sr-only` inside the
   label, which is correct markup and cost me twenty minutes of thinking the
   save was broken. Not a defect; worth knowing.
6. **Nothing on the session page says the risk banner will appear.** When the
   transcript has no risk language there is no "no risk indicators" line, so
   you cannot tell the difference between *nothing found* and *not run*.
7. **The patient's "Back" was a fixed link to the home screen**, so moving
   between consent, summary and journal kept throwing me to the top.
8. **`/patient/browse` is seventeen words** and offers nothing to do. It is
   reachable from the home screen's most prominent card.

---

## 7 · The two screens that do not exist

- **37R.21 — `session_sources` has no interface, by design.** Confirmed. No
  component references it. 41.2 builds the "Where" field that writes it.
- **37R.22 — `session_voices` has no interface, and no ticket built one.**
  Confirmed, and here is the ruling: **the ticket is written, the screen is
  not built, and it is 37.5, owned by the half of sprint 37 that has not
  shipped.** The reason is not effort. `session_voices` rows are created by
  acoustic diarisation, and acoustic diarisation needs the provider that is
  **gap 37.4**. A binding screen built today would be the first screen in this
  product that cannot be walked by anybody, which is the failure this entire
  sprint exists to find. It ships with the rows it binds.

---

## 8 · Is this ready for a beta user who has never seen it?

**For an English-speaking therapist in the United States: yes, with the five
environment gaps closed.** The clinical loop works, the screens that carry the
product's arguments — the approval card, consent, portability, the claim order
— are genuinely well made, and every unconfigured capability says so instead of
failing quietly.

**For an Arabic-speaking patient in Egypt, which is the first market: no.** Not
because anything is broken — the crisis number was, and is now fixed — but
because **the application is in English**. A patient in Cairo opens an Arabic
marketing page, taps through, and lands in an English app with a correct
right-to-left layout. That is one sprint, and it is the sprint before launch.

The middle answer, which is the honest one: the product **works**, and roughly
half of it **looks finished**. 34 pages are thin and 14 are unstyled, and they
cluster exactly where the founder predicted — the admin console and the parts
of the therapist portal nobody demonstrates. None of that stops a beta; all of
it decides whether somebody believes the thing they are typing a patient's
crisis into was built by people who were paying attention.
