# The one thing to paste into the new session

Copy everything below the line into the first message of a new chat pointed at this
repository. Nothing else needs to be said first.

---

You are taking over 24Therapy completely. The session before you is finished and you are not
continuing its work, you are replacing it.

**Read `docs/TAKEOVER.md` first. It is the only document written for you.**

Four things about it, before you open it.

**1. Do not trust it about the code, and do not trust any other `.md` file in this repository
about the code either.** The session that wrote it was compacted repeatedly, read a few dozen
files out of 1,106, and much of what it "knew" was a summary of a summary. Its sections are
labelled by how far each can be trusted. The parts about Neon, Vercel, DNS and the business
are the only source for those facts and you should believe them. Every claim it makes about
what the code does is a hypothesis for you to test.

**2. Your first task is to read every file.** Not a sample, not the ones that look important.
`lib`, `scripts`, `components`, `app`, `tests`, `drizzle`, `evals`, directory by directory.
About 280,000 lines, and the comments are a large fraction of it because this codebase argues
with itself in prose at length. Read the comments too, including the stale ones, and keep two
lists as you go:

- **Stale**: a comment or check describing something no longer true, an exemption covering
  nothing, a baseline nobody has lowered.
- **Suspect**: a claim in a comment you have not tested that would matter if false.

**3. Do not conclude anything from reading alone, and never from two or three files.** Every
single thing in this product was built, found to have a hole, patched, and the patch opened
another hole found later. Three defects in the last two days each passed every gate while
being locally correct code. `docs/TAKEOVER.md` section 1 has all three; read them and
understand why reading could not have caught any of them.

When you suspect something, **go and click it**. `docs/DEMO-LOGINS.md` has twelve accounts on
production and `docs/PROVE-IT.md` has five seeded database positions and a walk through them.
A claim becomes a fact when you have signed in as somebody and watched the screen, not before.

**4. Do not run `npm run gates`.** It takes 25 minutes and the previous session wasted hours
on it. Section 6 of `docs/TAKEOVER.md` is a table of which single check to run for which kind
of change, each of which takes seconds. Run the full pass twice only: once when you think you
are finished, and once before a deploy.

Two hard rules before you run anything at all:

- **`npm run seed:demo` deletes people.** Nothing reaches production except through
  `npm run on:production -- <command>` and its allow-list. `.env.local` stays pointed at dev.
- **The repository is public.** No real secret in any committed file, ever.

When the reading is done, bring the founder four lists: promises that are true, promises that
are not, things nobody had noticed, and things in these documents that are no longer true.
Then pick up Phase 0 in `docs/THE-PLAN.md`, because four defects that hurt a real person
outrank everything else including the redesign.

The founder is not technical. Explain in plain words, say what to click, never imply a
deadline that does not exist, and when something is broken say so plainly.
