# The third walkthrough — the prompt for a fresh session

Paste everything below the line into a new session. Nothing above it is part of the prompt.

**Before you paste it, do the one thing no session can do for you:** confirm the capture
database branch exists and is migrated to the current schema. Everything else in this file
is instructions for the session; this is the blocker.

---

You are walking the whole of 24Therapy, by hand, as every kind of person who uses it, in
both languages, and writing down what you find. You are not building features. Read
`PLAN.md` §4's sprint 65 entry and `docs/walkthrough-archive/FINDINGS.md` first, then begin.

## Why this pass exists

Sixty-eight sprints have shipped. Thousands of automated checks pass. **A human has used
this product for a handful of hours in its entire history**, and every serious defect ever
found in it was found that way: an American crisis number shown to an Egyptian patient, a
duplicate patient record created silently, a product that was never translated. No verifier
saw any of them. The instrument you are about to run was itself two thirds blind until the
day before this prompt was written, and nothing noticed.

So the posture is: **a script passing is not evidence that a screen works.** You are the
evidence.

## What to do, in order

### 1. Prepare the capture branch

```
export DATABASE_URL='<the capture branch: ep-little-sky-a6v9sdx4>'
npm run db:migrate          # it has not been migrated since sprint 52
npm run db:reset -- --i-mean-it --demo
node --import tsx --conditions=react-server scripts/seed-capture.ts
npm run ship:content
```

Both `reset.ts` and `seed-capture.ts` refuse to run anywhere but that branch, by name. If
either refuses, stop and read why rather than working around it.

**Check the migration actually landed** against `information_schema` rather than trusting
the migrator's output. It prints "Migrations applied" either way.

### 2. Run the instrument

```
npm run dev &                # or next start against a build
WALK_URL=http://localhost:3100 node --import tsx --conditions=react-server scripts/walkthrough.ts
WALK_URL=http://localhost:3100 node --import tsx --conditions=react-server scripts/walkthrough.ts --locale ar
```

It walks 105 routes across seven principals, phone-sized for the apps and desk-sized for
the consoles, and **it now fails if a route exists that no flow visits.** If it fails that
way, a screen was built and nobody added it to the walk; add it before continuing.

It also records a finding every time a control cannot be found by its visible label and a
CSS selector was needed instead. **A control nobody can describe out loud is a control
nobody can find.** Those findings are data, not scripting noise.

### 3. Then use it yourself, which is the part that matters

The instrument photographs screens. It cannot tell you a screen is confusing, that a
sentence is wrong, or that a flow ends somewhere pointless. Open the product and be each
of these people, in both languages, on a phone:

| Be | And actually try to |
|---|---|
| A stranger in distress | Find somebody free right now and start a session, with no account |
| A patient | Claim the record a therapist keeps about you, then read it, then take that access back |
| A patient who has two therapists | Give each one access separately and revoke one |
| A therapist | Sign up, get verified, run a session, approve a note, send the summary |
| A therapist on the radar | Go on call, get found, and see whether the alarm actually reaches you |
| A practice manager | Buy seats, invite a colleague, try to see a note (you must fail) |
| A delegated member of staff | Do what you are allowed and be refused what you are not |
| An employer | Fund a pot, watch it spend, try to learn who attended (you must fail) |
| A developer | Get a key and open a session through the API |
| An operator | Verify a licence, close a country, answer a support ticket |

### 4. Write it down

Update `docs/walkthrough-3/FINDINGS.md` with what was hard, not only what was broken:
buttons nobody could find, steps where it was unclear what happens next, screens that
looked unfinished. Give every page a verdict: finished, thin, or unstyled. The last pass
found 13 finished, 34 thin and 14 unstyled, and that table became the design brief.

Record every defect as a numbered concern in `PLAN.md` §4 with what it was, why nothing
caught it, and what now does.

## What is knowingly not walkable, and why

Do not report these as findings. They are environment, not defects:

| What | Why |
|---|---|
| Note generation, the copilot, risk classification | The AI account had no credit at last measurement. If the notes do not write themselves, check the balance before filing a bug. |
| Video calls | Needs a video provider key |
| File uploads | Needs blob storage |
| Codes over WhatsApp | The message templates are waiting on approval. Email and password are the walkable paths. |
| Paying in Egyptian pounds | There is no gateway. The code refuses honestly and that refusal IS the correct behaviour to walk. |
| Egyptian data staying in Egypt | Designed, switch in place, pointing at the United States |

## The rules that do not bend

- **Never run any of this against production.** Both scripts refuse it by name. Do not
  remove the guard.
- **Synthetic people only.** Every person in the capture database is surnamed Demo or
  Example and every address is at `example.com`. A single real name in one committed frame
  is a disclosure that cannot be recalled.
- **Frames are gitignored.** The written record is committed; the screenshots are not.
  94MB accumulated across two passes and the third would have been read against two older
  versions of the product.
- **Do not fix things as you find them.** Finish the walk first. A pass that stops to fix
  the first defect finds one defect.
- **When you fix, fix the gate too.** Every defect worth finding is a defect something
  should have caught. Say what now catches it.

## What good looks like at the end

A findings document somebody can act on, a design verdict per page, a numbered concern per
defect, and an honest count of what you could not walk and why. Not a clean report.

**A clean report from a walkthrough of a product this size would mean you did not look.**
