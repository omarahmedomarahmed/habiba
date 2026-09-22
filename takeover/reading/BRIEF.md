# Brief for every code reader

You are one of sixteen readers doing the first complete line-by-line read of the 24Therapy
repository at `/home/user/habiba`. Nobody has ever read all of it. Your slice is a list of
files in `takeover/reading/slices/<NN>-<name>.txt`. **Read every line of every file on your
list, comments included**, using the Read tool (offset/limit for long files, continuing until
the end). Do not skim. Do not sample. The comments matter: this codebase argues with itself
in prose, and a comment describing a fix is not evidence the fix is still there.

## Before you open your first file

Read, in full: `docs/VALUE-STATEMENTS.md` (the 25 promises, ids P1 to A5),
`takeover/MAP.md` (the claims and suspects so far), `docs/TRAPS.md`, `HAZARDS.md`.

## What the product is, in five lines

A therapy platform launching in Egypt. Six separate principals with separate cookies: patient,
therapist, clinic manager, company (sponsor, funds a pot for staff therapy and must NEVER learn
who used it), partner (EHR), and our staff console. No card processor in Egypt: payments are
bank transfers an operator confirms by hand (`manual_payments`). The patient owns a versioned
record that follows them between clinicians. An AI writes notes from transcripts; a patient
never talks to a model.

## Hard rules

- **Read only.** Do not edit, create or delete any file except your own notes file. Do not run
  `npm`, any script, any database command, or anything that touches the network. You may use
  Read, Grep and Glob, and `wc`/`ls` via Bash.
- Never use an em dash or en dash in what you write. Commas, colons, parentheses.
- No secrets exist in this repo by rule; if you see anything that looks like a real key, token
  or password other than the documented demo password `Demo2026!Therapy`, report it as a
  finding with file and line, and do not copy the value into your notes.

## Write as you go, not at the end

Your notes file is `takeover/reading/code-<NN>.md` (NN from your slice name). **Append to it
after every few files**, so a context compaction never loses work. If your context is
compacted, re-read your own notes file and your slice list, and continue from the first file
not yet in your notes.

## The format of your notes file

```
# Slice NN: <name>

## Files
One entry per file, in slice order, EVERY file on the list:
### path/to/file.ts (N lines)
- For: what it is for, one line.
- Decides: the rules it enforces, with function names and line numbers.
- Assumes: what it relies on elsewhere (other files, DB constraints, callers).
- Promises: which of P1..A5 it serves, if any, and whether the code as written keeps it.
- Notes: anything else a redesigner or auditor needs.

## Stale
Comment or check describing something no longer true; exemption covering nothing; dead code;
a comment naming a file or function that does not exist. file:line, what it says, what is true.

## Suspect
A claim you could not test from your slice that would matter if false, or code that looks
wrong. file:line, the claim, why it matters, where the answer probably is.

## Broken
Defects you are confident of from reading. What a person would see, what the code does,
file:line. BEFORE writing one, grep for the patch: this codebase very often handles the
obvious hole in another file. If you find the patch, put it under "Looks broken, is handled"
instead, with both locations.

## Looks broken, is handled
Alarming at first sight, handled elsewhere. Both file:line locations and why it reads wrong.

## Unclaimed
Anything the code can do for a person that none of the 25 promises covers. Sort each into:
(a) worth selling, nothing advertises it; (b) nobody should have it, a hole; (c) half built,
a lifecycle with no way out or a screen with no door. file:line and one sentence.

## Promise evidence
For each of P1..A5 your slice touches: the id, what in your slice enforces or breaks it,
file:line, and your verdict (kept / partly: which part / broken / cannot tell from here).

## Coverage
The last section. A table of every file on your slice list with its line count and "read".
The coordinator will diff this against the list; a missing file is a failed slice.
```

## What matters most, by priority

1. Privacy walls: anything that could let the company/sponsor portal, clinic portal or partner
   reach a patient name, session time, attendance, note or transcript. Any query joining
   sponsor tables to sessions/patients.
2. Money: any path that can move money twice, grant before confirmation, drop a rejection
   reason, keep an overpayment silently, or compute a price differently from where it is shown.
3. Consent and recording: in-person sessions, off-the-record, AI consent, recording without
   consent (task 123).
4. Anything a person can get stuck in with no way out and nobody told.
5. Auth boundaries: one principal's cookie reaching another principal's data.

When done, reply with at most 15 lines: the three most serious findings, counts of entries
per section, and confirmation every listed file is in Coverage.
