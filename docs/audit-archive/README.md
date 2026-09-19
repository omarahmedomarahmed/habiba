# The hostile audit, September 2026

**Finished, archived, and kept for the findings rather than for the method.**

Ten documents. A brief written to be adversarial on purpose, and nine reports against it: the
patient, the clinician, the admin console, the sponsor, the clinic, the partner, the money, the
plan and its gates, and clinical safety.

## Why it is here and not in the working tree

It was a **one-off exercise against the product as it stood on 2026-09-14**, not a standing
process. Half of what it found has since been fixed, several of the files it scopes have moved,
and a reader who opens it expecting a current picture gets a September snapshot with no label on
it.

That is the same failure the simulation documents had: a true thing that stopped being true and
carried on reading as an instruction.

## What is still worth reading in it

The **reasoning**, not the status. Each report argues from the code to a conclusion, and the
arguments hold whether or not the line numbers do. `07-money.md` and `09-clinical-safety.md` are
the two that repaid the most.

## What replaced it

Nothing, and that is a decision rather than an oversight. The standing checks are
`npm run gates`, and the adversarial reading of the product is now done by walking it:
`docs/simulation/14-THE-REHEARSAL.md` is nine flows through the browser, and the six month run
is the same idea at length.

**If somebody runs another audit, it gets its own dated folder beside this one.** Editing this
one in place would produce a document that is partly 2026 and partly whenever, which is exactly
what this archive exists to prevent.
