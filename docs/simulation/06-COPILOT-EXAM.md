# The exam at the end: how much does the copilot actually know?

**Run by the main session, after the last wave is captured and aged, and before the report.**

```
npm run copilot:exam -- --dry
npm run copilot:exam -- --json docs/walkthrough-3/COPILOT.json
```

## The claim being tested

> *The patient we know the most about has the smartest copilot, and after six months it
> can prepare a therapist who has never met them.*

That is the claim the whole memory layer exists to make good on. It is on the public site,
it is the reason a practice would pay for this rather than for a note-taker, and **until
this sprint nothing measured it.**

`evals/` measures the note writer, the risk model, attribution and speech. Every one of them
runs against fixture cases with no history behind them, which is right for what they test
and useless for this: **the copilot's whole value is the history**, so a fixture cannot test
it and a populated database has to. That is why this is a script against the simulation and
not a suite in `evals/`.

## How a mark is arrived at

For every patient with anything on record:

1. **Count what there is to know.** Sessions, approved notes, journal entries, documents,
   how many therapists have worked with them. One weighted number, `depth`.
2. **Build questions from their own rows**, each with the answer already in hand, before the
   copilot is asked anything. Counts and dates, what they wrote in their journal, what the
   last therapist planned, what they said they were struggling with, medication, diagnosis.
3. **Ask the copilot**, through `askPatientCopilot`, on a fresh thread. The same path the
   product uses.
4. **Ask for a handover**: *I have never met this person and I see them in ten minutes.*
5. **Mark each answer** against the record, 0 to 5, by a grader that is shown the record's
   answer and the copilot's answer and nothing else.

### 🔴 Why the grader is blind, and why that is not a detail

The grader never learns which patient it is marking, how the question was built, or what the
other patients scored. If it did, the exam would drift towards rewarding fluency, and a
confident answer about the wrong person is the specific failure this product cannot have.

The questions are also built **before** any answer is seen, from rows, which is what stops
the exam flattering a well-documented patient by asking them easier questions.

## 🔴 The control, which is half the exam

Every patient is asked things the record **does not** contain:

| Asked | Correct answer |
|---|---|
| Is this person on any medication we know about? | *(for a patient with none)* We have nothing recorded |
| Is there a diagnosis on file? | *(for a patient with none)* We have nothing recorded |
| Did they ever mention a brother called Hossam? | There is nobody of that name anywhere in this material |

**A copilot that fills these in scores zero**, and a run where everybody scores well on the
present half and badly on the absent half has found a copilot that says yes to everything.
That is worse than a copilot that forgets, because a clinician acting on a medication nobody
prescribed is a clinical incident and a clinician who has to look something up is not.

Read the `refuses` column before the `knows` column. The report says so in those words.

## What it prints

```
  Mostafa Demo            11 sessions ·  11 notes ·  14 journals ·  2 documents · depth 80
  Layla Demo               6 sessions ·   6 notes ·   8 journals ·  1 documents · depth 43
  ...
  Mostafa Demo           depth    80  knows 4.6/5  refuses 5.0/5  handover 5/5
  Karim Example          depth    15  knows 2.1/5  refuses 4.0/5  handover 2/5

  Correlation between how much there is to know and how much is known: 0.81
  🟢 The claim holds on this data: more history, better copilot.
```

🔴 **A run costs about $0.36**, which is 4% of the whole budget for the most interesting
question in the simulation. Run it once properly rather than twice quickly.

## How to read the result, honestly

| What comes back | What it means | What to do |
|---|---|---|
| Correlation **≥ 0.5** | The claim holds. More history really does produce a better copilot | Report the number and the two ends of the ladder |
| Correlation **0.2 to 0.5** | It leans the right way and is weak. The memory is reaching the answer, thinly | Report it as weak. Do not round it up |
| Correlation **below 0.2** | 🔴 **The claim does not hold.** The copilot is no better on a thick record than a thin one | This is the most important finding the whole simulation can produce. It means the retrieval, not the model, is the problem |
| Any patient scoring **below 4 on `refuses`** | The copilot is inventing | Name the patient, quote the invention, and put it at the top of the report |
| `P6` Karim scoring **as well as** `P3` Mostafa | Either the depth ladder was never driven, or the extra history is not reaching the prompt | Check `01-SEED.md`'s ladder against what the roll call printed before blaming the copilot |

## The handover, which is the part a person would actually use

The last question is not a fact check. It is the product's real claim in its real form: a
therapist who has never met this person, ten minutes out, wanting to know who they are, what
brought them, what has been tried, what the risk picture is, and what not to do in the first
session.

It is marked against the whole record, and the rubric says in as many words that **a brief
that could be about anybody scores zero.** Generic competence is the failure mode here: a
paragraph of warm, careful, plausible therapy language with no fact in it that could only
have come from this person's file.

🔴 **Paste `P3`'s handover and `P6`'s handover into the report, side by side.** They are the
same product answering about a person it has ten hours of history with and a person it has
three transcripts of. If a reader cannot tell which is which, the memory layer did not work,
and no correlation coefficient makes that case better.

## What this exam does not test

Said plainly so nobody reads more into the number than it carries:

- **Not clinical quality.** A copilot can be perfectly accurate about a record and give
  advice a supervisor would refuse. That is a different measurement and this is not it.
- **Not the live-session bound.** `askPatientCopilot` is called without `liveSince`, so the
  exam reads the whole record. What a copilot may see *during* a session is invariant 11 and
  is asserted by `verify:sprint48`, not here.
- **Not access control.** The exam runs as the last therapist who saw the patient. Whether a
  revoked clinician gets a degraded copilot is `P1`'s wave 3 scenario and is captured there.
- **Not the patient's own copilot.** Different prompt, different scope, different surface.
  Worth its own exam later; say so rather than implying this covered it.

## Record the result properly

`--json docs/walkthrough-3/COPILOT.json` writes every mark and every handover. Then write
`docs/walkthrough-3/COPILOT.md` by hand from it, and it needs four things and no more:

1. The ladder, as measured, not as designed.
2. The correlation, and the sentence about whether the claim held.
3. Every invention, quoted.
4. The two handovers, side by side.

A run that produces a number and no quotations has measured something nobody can check.
