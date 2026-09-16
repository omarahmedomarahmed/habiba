# The record, and who is allowed to read it

**Eleven walks through the one thing this product is actually selling: a clinical record that
belongs to the patient, which a clinician can read only while the patient lets them.**

Every other file here is about money, load or model quality. This one is about the promise.
If the money is wrong somebody is out of pocket and we fix it. If **this** is wrong, a person
in therapy was read by somebody they had told to stop, and there is no version of fixing it.

Like `09-THE-EDGES.md`, none of these is an extra scene. Each attaches to somebody already in
`01-THE-CAST.md`, in a wave they are already in.

---

## The rule for this file

**Every walk below is reported on, including the ones that pass**, with the same
`DID / SAW / ROW` discipline as everything else: what you did, what the screen said, and the
row id that proves it.

Two of them have a **negative** to report, and a negative is the hardest thing to evidence.
`R7` and `R8` are not "the copilot gave a shorter answer". They are "the copilot was asked
about a specific session it could see last week, and it said it cannot see it". Screenshot the
question and the refusal, both, or the walk does not count.

---

## Group R · one record, two clinicians, one revocation

The spine of this group is `P3` Mostafa, who is the only patient in the cast with **two**
therapists, and `P1` Layla, who is the only one who **revokes**.

### `R1` A patient claims the record their therapist wrote down

**Who:** `P1` Layla, wave 2. `T3` Dr Karim wrote her down after a radar session.

**The walk.** As `T3`, open her profile at `/patients/<id>`. She has not claimed yet, so the
page shows her initials, not a face, and one line saying nobody has claimed this record and
what is here is what he wrote down. Issue the claim link from the panel on that page.

Now as `P1`, in her own portal, claim it. Add a photograph in her account settings.

**Then go back to `T3`'s profile page for her and reload it.**

| What must be true | Why it is the whole point |
|---|---|
| The headshot is hers, and she put it there | A clinician cannot put a face on somebody's profile. It arrives when the patient decides it does |
| The line under her name has changed to say she owns this record and can withdraw his access | The state is stated, not implied by a missing badge |
| The picture is served from `/api/patient/avatar/<personId>` | C115. Not the storage URL, which is public the moment the page is screenshotted |

**Report:** both versions of the profile, before and after, side by side.

### `R2` The unclaimed profile is not an empty profile

**Who:** `P6` Ziad, who never creates an account at all, wave 3 onward.

`T3` has seen him three times through join links. There is no claim, no photograph and no
journal. The profile must still be **useful**: his sessions, the notes `T3` wrote, the files
`T3` added, and the copilot thread about him.

**The failure to watch for** is a page that reads as broken because the person has not claimed
it. A clinician with a real patient in front of them and a screen that says "no account" has a
product telling them their own work does not count.

### `R3` A second clinician asks, and the patient decides

**Who:** `P3` Mostafa and his second therapist, wave 4.

As the second therapist, open Mostafa's profile. The access banner says there is no grant.
Request access with a reason. As `P3`, in his own portal, read the request and approve it.

**Report the message he received.** C107: the patient is told on every new grant, and no
preference switches it off, because the threat model is somebody being pressured into
approving.

### `R4` And then the second clinician can read the first one's work

Same pair, immediately after `R3`.

**The walk.** On Mostafa's profile as the second therapist, the session history now lists
sessions the FIRST therapist ran, with their notes. Open one.

| What must be true |
|---|
| The sessions from the first therapist are in the list |
| Their notes open and are readable |
| Each note carries its provenance, so it is clear whose recollection it is |

### `R5` The copilot cites a session from before this clinician existed

Same pair, immediately after `R4`.

Ask Mostafa's copilot, from **the profile page**, a question that can only be answered from
the first therapist's sessions. `10-THE-STORY.md` plants the facts; use one from month 1.

**What must be true:** the answer is right, and it carries a citation that opens the session it
came from. An answer with no citation is the same defect as a wrong answer, one layer down.

### `R6` The same thread, from both doors

Ask a question on the profile page. Then open `/copilot/<id>` and look at the thread.

**The question and its answer must be there.** One thread per patient, not one per screen. Two
threads is two memories of one person, and the one a clinician is not looking at is the one
holding the correction they made.

### `R7` 🔴 The revocation, and what the copilot can see afterwards

**Who:** `P1` Layla and `T3`, wave 3. This is the walk the whole file is for.

**Before revoking**, as `T3`: ask her copilot a question that is answered by a session and by a
document she uploaded herself. Screenshot the answer with its citations.

**Then, as `P1`:** revoke his access from her own portal.

**Then, as `T3`, ask the same question again.**

| What must be true after revocation | Why |
|---|---|
| The banner on both the profile and the copilot says the access is gone, in words | A clinician who does not know they have been degraded reads a thin answer as the copilot being unhelpful |
| The copilot answers from **his own notes and the files he added**, and says so | §3: a revoked clinician keeps what they wrote |
| It does **not** answer from her journal, her documents or anything another clinician wrote | This is the promise |
| The diagnosis field on her profile refuses to save | The revoked state is enforced at the write, not just hidden in the read |
| A document URL kept from before revocation stops working | The filter is on the bytes, not on the list |

**Report the same question twice, with both answers.** A shorter answer is not evidence. A
named refusal is.

### `R8` And his own notes are still his

Same pair, immediately after `R7`.

`T3` opens the sessions he ran with her. The notes are there, readable, unchanged. Nothing he
wrote was deleted by her revoking.

**This is the half people expect to be broken**, and it is the half that makes the promise
survivable for a clinician: a record that can be taken away entirely is a record nobody will
write in.

### `R9` The invitation, from the profile, to a paid session

**Who:** `T1` Dr Amira and `P7` Yousra, wave 5.

From `P7`'s profile, press the invite button. One tap creates a video session at Amira's own
rate and sends the join link to the number on the chart.

| What must be true |
|---|
| The price shown is Amira's session rate, which she never typed into this page |
| The session exists, attached to `P7`, with a join token |
| The screen says whether the message actually went out, and shows the link either way |
| `P7` can open the link and is asked to pay before she joins |

Then try it on a walk-in with no phone and no email. **It must refuse and create no session.**
A session created and billed for an invitation nobody received is the worst outcome available
here, and it is silent.

---

## Group L · the long session, and what it costs

### `L1` 🔴 One session of the sixty two runs the full fifty minutes

**Who:** `P3` Mostafa with `T1`, wave 4. He is the deep record, so the longest session belongs
to him.

Every other session in the run is short, because a simulated session is expensive and sixty two
of them is the budget. **One is not.** Run it for the full fifty minutes with the microphone
open, end to end, and let the product do everything it normally does: transcribe in chunks,
diarise, write the note, assess risk.

**Why exactly one.** Cost per session is the number the whole pricing model rests on, and every
figure this product has ever reported for it came from short sessions. An average over sixty
one short sessions and one real one is not the answer either, which is why
`/admin/usage/sessions` reports the **spread**: cheapest, median, dearest.

### `L2` And it is read on the admin side

After `L1`, open `/admin/usage/sessions` as a super admin.

| What must be true |
|---|
| The fifty minute session is on the list, badged at its duration |
| Its cost is visibly the dearest of the sixty two |
| Its audio minutes are near fifty, because audio is the cost driver |
| The row says what the patient paid and what our fee was, beside what it cost us |
| Filtering to `T1` shows only her sessions |

**Report the four figures at the top of that page**, which are the answer to "what does a
session cost" in the only form that is honest: a cheapest, a median and a dearest, over a
known number of sessions.

### `L3` The transcript of it is attributable by hand

`L1` is offline, in a room, on one microphone, which is the case where the diariser correctly
declines to guess: the recording is cut on a clock rather than at turns, so most chunks hold
the end of one person's turn and the start of the other's, and C35 says a half-correct label in
a clinical record is worse than none.

**So the transcript will be mostly unattributed, and that is not the defect.** The defect would
be a screen that does not say so.

| What must be true |
|---|
| A line above the transcript explains why, in words, when most of it is unattributed |
| Each line offers you, them and not sure |
| Choosing one saves it and clears the dotted "worked out from the words" mark |
| A line owned by a separated voice shows its label and no control, and says where attribution lives |

---

## What this file does not cover, and why

**A clinician reading a record they were never granted.** That is not a walk, it is a
penetration test, and it is held by `verify:principals` on every gate pass: every clinical data
module is declared with the principals allowed to reach it, and a page that reaches one as the
wrong principal fails the build. A simulation walk would prove it once on one page; the gate
proves it on all 174 entry points every time anybody runs it.

**Somebody else's patient.** Same reason, plus `verify:profile`, which plants a clinician from
a second practice and watches `copilotViewFor` hand them nothing at all.
