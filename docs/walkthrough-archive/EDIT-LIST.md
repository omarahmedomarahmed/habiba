# 52.5 / 52.6 — the edit list

Four cuts, assembled from the frames in `frames/en/` and `frames/ar/`. Scripts, timed, are in
`SCRIPT-EN.md` and `SCRIPT-AR.md`.

**This is an edit list, not a video.** No ffmpeg, no rendered file. It names which frames form which
cut, in what order, for how long, and what appears on screen over them. An editor with these three
documents and the frames folder can assemble any of the four.

---

## What is true about these frames, said once, so no cut has to pretend

* **Every frame is real.** Every screen was reached by signing in through the actual form and
  clicking the actual controls, against a database seeded with the cast and its content. Nothing is
  a mockup and no service is stubbed.
* **Everybody in them is invented.** Layla Demo, Youssef Demo, Mariam Demo, Hana Example, Tarek
  Example, Dalia Example, Omar Example. Surnames Demo and Example, addresses at `example.com`,
  phone numbers in one sequential block. C225.
* **The room is the in-person path.** *Record from this device* — the default, and the flow most
  Egyptian therapists will actually use. The video room is not in any cut; see the note at the end.
* **Admin frames are gitignored.** Cut 3 is assembled from `frames/*/…-admin-*.png`, which exist on
  the capture machine and are not in the repository. An admin console is a map of the whole system.

Every cut exists twice, English and Arabic, from the two frame folders. The Arabic cut is also the
RTL cut: the layout mirrors, the tab order reverses, the SOS orb crosses to the other side. That is
worth holding a beat on rather than cutting past, because it is the thing most products in this
market do not do.

---

## CUT 1 — THE PATIENT · 1:50

*The one the product is judged on. It opens on a door and ends on a record she owns.*

| # | Frame | Hold | On screen |
| --- | --- | --- | --- |
| 1.1 | `009-patient-door` | 4s | — |
| 1.2 | `011-patient-sessions` | 7s | **Your record is yours** |
| 1.3 | `011-patient-sessions` (lower third, push in on the brief) | 6s | *Written to her, not about her* |
| 1.4 | `013-patient-homework` | 6s | **Do them or do not, nobody is counting** |
| 1.5 | `016-patient-summary` | 9s | **Every version stays, with the name of whoever wrote it** |
| 1.6 | `016-patient-summary` (hold on the two clinicians) | 5s | *Two therapists. Neither can take theirs back.* |
| 1.7 | `015-patient-assessments` | 5s | — |
| 1.8 | `014-patient-journal` | 5s | **The audio never leaves the phone** |
| 1.9 | `012-patient-messages` | 6s | **A check-in asks. It never interprets.** |
| 1.10 | `021-patient-consent` | 6s | **Who can read your history** |
| 1.11 | `019-patient-billing` | 5s | *What she paid, in what she paid it in* |
| 1.12 | `023-patient-account` | 6s | **Changing your number takes a person and a day** |
| 1.13 | `ar/011-patient-sessions` | 5s | — |
| 1.14 | `ar/023-patient-account` | 5s | **The same product, in Arabic, right to left** |
| 1.15 | `001-public-home` | 4s | 24Therapy |

🔴 **1.5 and 1.6 are the cut.** Everything else is a good app. The summary screen is the argument:
two named clinicians, in order, each with their credentials and licensing body, and a sentence
saying nobody can remove either. Hold it.

🔴 **1.9 needs its explainer or it is just a messages screen.** The reason the check-in matters is
what it does *not* do, and a frame cannot show an absence. The line carries it.

---

## CUT 2 — THE THERAPIST · 2:05

*One session, start to signed note, with nothing skipped.*

| # | Frame | Hold | On screen |
| --- | --- | --- | --- |
| 2.1 | `027-therapist-dashboard` | 5s | — |
| 2.2 | `042-room-new` | 7s | **One field, then you are recording** |
| 2.3 | `042-room-new` (hold on *Where*) | 5s | *One question, not a settings page* |
| 2.4 | `043-room-patient-chosen` | 4s | — |
| 2.5 | `044-room-opened` | 5s | — |
| 2.6 | `045-room-recording` | 8s | **Listening. The note is written the moment you end the session.** |
| 2.7 | `045-room-recording` (hold on *Off record*) | 5s | **Off record is a button, not a setting** |
| 2.8 | `046-room-ended` | 9s | **Three things, one button. Nothing is published by walking away.** |
| 2.9 | `046-room-ended` (hold on the two tick boxes) | 7s | *Signing the note and releasing her copy are two decisions* |
| 2.10 | `030-therapist-notes` | 6s | — |
| 2.11 | `028-therapist-patients` | 5s | — |
| 2.12 | `032-therapist-earnings` | 5s | **What you earned, per session, at the price on the day** |
| 2.13 | `038-therapist-on-call` | 6s | **Online means a stranger can reach you in ninety seconds** |
| 2.14 | `036-therapist-settings-records` | 5s | **Send it to your own EHR** |
| 2.15 | `ar/042-room-new` | 5s | — |
| 2.16 | `001-public-home` | 4s | 24Therapy |

🔴 **2.8 and 2.9 are the cut.** Sprint 47's whole argument is on one screen: a clinical note the
practice keeps and a plain-language copy written to the patient are different documents with
different decisions attached, and neither happens because somebody closed a tab.

🔴 **2.7 exists because of what it prevents.** A recording control buried in settings is a recording
control nobody turns off mid-session. Showing it as a button next to *End session* is the point.

---

## CUT 3 — THE ADMIN · 1:20

*Assembled from gitignored frames. Not for public release without a second look at every frame.*

| # | Frame | Hold | On screen |
| --- | --- | --- | --- |
| 3.1 | `070-admin-dashboard` | 6s | — |
| 3.2 | `072-admin-content` | 7s | **Every string in the product, editable, in both languages** |
| 3.3 | `072-admin-content` (hold on one Arabic override) | 6s | *Nobody ships a build to change a sentence* |
| 3.4 | `073-admin-checkins` | 6s | **The mute rate is the number that matters** |
| 3.5 | `074-admin-payouts` | 5s | — |
| 3.6 | `071-admin-vault` | 6s | — |
| 3.7 | `075-admin-usage` | 5s | **What the copilot cost, per practice** |

🔴 **Before this cut is shown to anybody outside the company, every frame is reviewed against C225
individually.** The admin console shows many patients at once; the cast is synthetic, and that is a
fact about this database rather than a property of the screens.

🔴 **3.2 is the one that surprises people.** An operator changing product copy in both languages
without a deploy is unusual enough to be worth the seven seconds.

---

## CUT 4 — SPLIT SCREEN · 1:40

*C268: pressing a button on one side changes a screen on the other. The only cut that needs two
frames at once.*

Every row is a two-up. Left is the clinician's side, right the patient's or the portal's.

| # | Left | Right | Hold | On screen |
| --- | --- | --- | --- | --- |
| 4.1 | `046-room-ended` | `011-patient-sessions` | 9s | **He ticks. She has it.** |
| 4.2 | `030-therapist-notes` | `016-patient-summary` | 8s | *The clinical note stays. The summary is hers.* |
| 4.3 | `057-sponsor-overview` | `018-patient-benefit` | 8s | **A company funds it. She never sees a price.** |
| 4.4 | `059-sponsor-pot` | `019-patient-billing` | 7s | *The money moves and the clinical record does not* |
| 4.5 | `050-clinic-overview` | `051-clinic-people` | 6s | **A clinic sees its own people and none of the notes** |
| 4.6 | `065-partner-keys` | `067-partner-deliveries` | 7s | **A platform asks whether we have verified a clinician** |
| 4.7 | `065-partner-keys` | `036-therapist-settings-records` | 7s | *and a session held on their platform lands in the chart, source-attributed* |
| 4.8 | `021-patient-consent` | `053-clinic-records` | 8s | **She decides who reads it. Everybody else asks.** |
| 4.9 | `ar/011-patient-sessions` | `011-patient-sessions` | 6s | **One product. Two languages. Both directions.** |

🔴 **4.3 is the strongest thing in the whole capture.** A sponsored patient's screen shows no price
at all, and the sponsor's screen shows spend with no clinical word anywhere on it. Two frames prove
a wall that a paragraph cannot.

🔴 **4.8 is the ethical claim, shown rather than asserted.** The clinic portal has a records page and
it is a page about asking.

---

## The room, and why no cut shows a video call

The session room **runs**, and cut 2 is shot in it end to end: clock, Live status, transcript,
copilot, ending on the sign-and-release screen. That is the in-person path, *Record from this
device*, and it has no gap.

A Daily key was provided and is valid: the server-side integration genuinely works and rooms are
really created on the account. But the **browser in the capture container never connects to one** —
two takes, two participants, thirty-one seconds, "Connecting…" and no error, because the client
retries a blocked media path silently rather than failing.

So the choice was between a frame reading *"Video is not configured. The session is still recorded
and transcribed."* and a frame reading *"Connecting…"* forever. **The first is an honest sentence
about a build; the second is a spinner.** The capture ran without the key and no cut shows a video
call. When the films are shot somewhere with media egress, cut 2 gains a video variant and nothing
else changes.

---

## Assembly notes

* **Frames are 390×844 at 2× (phone) and 1280×900 (the consoles).** The patient, therapist and room
  flows are phone-shot because this is a phone-first product; clinic, sponsor, partner and admin are
  desk-shot because a clinic's bills at 390px is not how anybody reads them.
* **Holds assume no motion.** Adding a slow push-in on the long text frames (1.5, 2.8, 3.2) buys
  legibility without changing the timings.
* **The explainer lines are the script's own words**, so the on-screen text and the voiceover agree.
  Where a line appears in both, the voiceover says it and the card shows it; it is never said twice.
* **No frame is cropped to hide anything.** If a frame needs a crop for legibility, the crop is a
  push-in on something already in shot.
