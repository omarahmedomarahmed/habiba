# The one thing to paste into the new session

Copy everything below the line into the first message of a new chat pointed at this
repository. Nothing else needs to be said first.

---

You are taking over 24Therapy completely. The session before you is finished and you are not
continuing its work, you are replacing it.

**Read `docs/TAKEOVER.md` first. It is the only document written for you.**

## What you are here to do

**Redesign this entire product, and close the holes you find doing it.** Every app and every
user-facing portal, drawn again as it should be rather than as it grew: the patient app, the
clinician's workspace and room, the clinic portal, the company portal, the partner portal, the
public site, and the console we run it from. A better flow, better screens, a coherent design.

The deliverable is **`24therapy.app/design`, completely rewritten by you**: its content, its
sub-pages, its wireframes and its UI screens, as samples the founder approves from before
anything is built for real.

**That is the goal. Everything before it is how you earn the right to do it.** You cannot
redesign a screen you have not understood, and you cannot understand this one by looking at
it, because every promise it makes is enforced somewhere in 280,000 lines nobody has read.

## The order, and it is not negotiable

**1. Read every `.md` before you open a single source file.** They are the claim set: what
this product says it is, what it promises, what it values, what it has already learned about
being wrong. Start with `docs/VALUE-STATEMENTS.md`, which is the 25 promises this product
makes, then `docs/TRAPS.md`, `HAZARDS.md` and `PLAN.md`. Section 8 of the takeover document
has the full order. Keep a list of every promise and where it claims to be enforced.

**2. Then read every line of code.** 1,158 files, about 280,000 lines, directory by directory.
The comments are a large fraction of it because this codebase argues with itself in prose.
Read them too, including the stale ones.

280,000 lines is three to four million tokens and **no context window holds that, including
yours**. So before opening each next directory, write what you learned into a working map:
what each file is for, what it assumes, what it decides, plus two lists you keep throughout.
**Stale**: a comment or check describing something no longer true. **Suspect**: a claim you
have not tested that would matter if false. The map is what you re-read after a compaction.

**3. Then walk the product as a person, with evidence.** Reading tells you what the code
says, not what somebody sees. Sign in as the demo cast in `docs/DEMO-LOGINS.md`, put the
database into each of the five seeded positions, and run the walk in `docs/PROVE-IT.md`. It is
written for eight people on eight devices, so **launch agents**: one persona each, their own
browser, running the cross-referenced steps in order, because step 4 on one screen depends on
step 3 on another. Do not serialise them. Corroborate every claim against a row. Write down
the passes as well as the failures.

The protocol, which is not optional and is in section 9 of the takeover document: **one shared
message board every agent reads before each click and posts to after each click**, so nobody
acts on a database that moved under them. **A screenshot before and after every click**, from
every persona, because a single shot shows a state and the pair shows a transition. **On the
operator's side, a screenshot of every entry approved and every screen opened.** A scenario
therefore ends with tens of screenshots from every side, which cut together into one demo
video for that feature and the promise it proves. Evidence goes in `evidence/`, gitignored.

**An operator stays signed in for the whole of every walkthrough, always.** There is no card
processor in Egypt, so every payment, transfer approval, payout, verification and manual step
waits on a person. A scenario that reaches a payment with no operator watching stalls, and the
agent waiting will report a product defect that is actually an empty chair.

**But touch no money before steps 1 and 2 are done.** Confirming a transfer, approving a
payout, passing a verification and releasing a held balance are all manual steps on a rail
with nothing behind them to reverse a mistake. In the walk they are expected, because by then
you will know what each one does downstream. Before it, they are not.

**You may delete anything person-shaped and you are expected to**: wipe the demo data, edit
the seeded data, seed your own, put the database into whatever position a scenario needs.
Fourteen tables are never deleted, because nothing in this repository could rebuild them: the
published website, the settings, the dictionary and the company's own books. They are named in
the `KEEP` list at the top of `scripts/seed-demo.ts`, which counts their rows before the wipe
and again after, and throws if any table came back smaller. Do not write a wipe that skips
that census.

**4. Assess every screen while you are looking at it.** You are the only one who will ever see
all of them with fresh eyes. For each: what is it for, what does a person do next, what is
missing, what is decoration, does it work at 390px and in Arabic RTL, and which promise is it
responsible for. That file is the raw material for the redesign.

**5. Then one report, before you design anything.** What percentage of what we claim actually
holds, with the arithmetic shown. What is broken and why. **What only LOOKS broken because it
is patched three files away**, which is the half a fresh reader always gets wrong and is worth
more than the rest of the list. And what you would do differently, with reasons. You are
invited to attack this: the architecture, the money, the claims, the checks, the design.

**6. Then redesign, and fix the holes.**

## Four things before you start

**Do not trust `docs/TAKEOVER.md` about the code, or any other `.md` here.** The session that
wrote it was compacted repeatedly, read a few dozen files out of 1,158, and much of what it
"knew" was a summary of a summary. Its sections are graded by trust. The parts about Neon,
Vercel, DNS and the business are the only source for those facts and you should believe them.
Every claim about what the code does is a hypothesis for you to test.

**Never conclude from two or three files.** Every single thing in this product was built,
found to have a hole, patched, and the patch opened another hole found later. Five defects in
the last two days each passed every gate while being locally correct code. Section 2 of the
takeover document has all five; read them and understand why reading alone could not have
caught any of them.

**Do not run `npm run gates`.** It takes 25 minutes and the previous session wasted hours on
it. Section 7 is a table of which single check to run for which change, each taking seconds.
Run the full pass twice only: when you think you are finished, and before a deploy.

**Two hard rules before you run anything at all.** `npm run seed:demo` deletes people, and
nothing reaches production except through `npm run on:production -- <command>` and its
allow-list, with `.env.local` staying pointed at dev. The repository is public: no real secret
in any committed file, ever.

## The task list is yours, and it is incomplete

There are 38 open tasks, plus the six that are the job itself (171 to 176). Every one exists
because somebody noticed something, and nobody has read this repository, so the list describes
the defects that happened to be found rather than the defects that exist. **Assume there are
more, and add them as you go**: a promise nothing enforces, a lifecycle state with no way out,
a screen with no task covering what is wrong with it, a surface with no gate. Bring the
founder the additions separately from the inherited list, so they can see what a full read
found that four months of building did not.

The founder is not technical. Explain in plain words, say what to click, never imply a
deadline that does not exist, and when something is broken say so plainly.
