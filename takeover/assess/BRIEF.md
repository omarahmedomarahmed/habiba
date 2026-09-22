# Brief for every screen assessor

You are assessing every screen of one portal of 24Therapy, live at https://24therapy.app, as
the raw material for a complete redesign. This is step 4 of `docs/TAKEOVER.md` s9: you are one
of the few people who will ever see every one of these screens with fresh eyes.

Read first: `docs/VALUE-STATEMENTS.md` (the 25 promises, P1 to A5), `docs/TAKEOVER.md` s10 (the
redesign brief, the palette, and the founder's own complaints about the current design), and
`docs/INVENTORY.md` for the list of pages in your portal (it omits sign-in pages, `/join`,
`/pay` and the room; include any of those that belong to your portal).

## How you look at a page

Use the harness, and only it, so every look leaves a screenshot either side:

```
node takeover/walk/step.mjs --run assess --as <your persona> --label "<what>" --url <path> [--mobile] [--full]
```

It prints the visible text, whether the page scrolls sideways, and the text direction. For
each page take FOUR looks: desktop English, 390px English (`--mobile`), 390px Arabic, desktop
Arabic. To switch language press the language control on the page
(`--selector 'text=العربية'`), then open the page again; the choice is a cookie and persists in
your persona's profile. Switch back with `--selector 'text=English'` when done. Use `--full` for
long pages. Read at least the 390px screenshots yourself with the Read tool: the text output
cannot tell you about overlap, clipping, contrast, or two things on top of each other.

A pop-up asking to turn on a sound alarm may cover clinician pages; dismiss it with
`--selector '?text=Not now'`.

## Hard rules

- **Look, never act.** Never press anything that submits a form, confirms, rejects, approves,
  pays, books, cancels, removes, invites, sends, publishes, saves, tops up, changes coverage, or
  signs anything. Opening a page, switching tabs within a page, opening a menu or a sheet and
  closing it again, and switching language are fine. If you are unsure whether a button
  changes something, do not press it and say so.
- Other walkers are using the database at the same time. Never sign out other personas and
  never use a persona name that is not yours.
- Passwords: the shared demo password is `Demo2026!Therapy`. Three accounts use a private one
  (`omar@24therapy.app`, `staff.demo@example.com`, `habiba@24therapy.app`); read it inside your
  command with `$(grep ^DEMO_PRIVATE_PASSWORD .env.local | cut -d= -f2-)` and never print it,
  write it down or put it in a file.
- Never use an em dash or en dash in what you write.

## What you write

`takeover/assess/<portal>.md`, written as you go (append after every page so a context
compaction loses nothing; if compacted, re-read your file and continue). For every page:

```
### /path  (screenshots: evidence/assess/<persona>/NNN...)
- For: what the screen is for, in one sentence. Does the screen itself say so? yes/no
- Next: what a person does next from here, and is that obvious?
- Missing: title, empty state, a way back, a way out of a dead end, a label, a link to it
- Decoration: what is ornament rather than information
- 390px: works / problems (overlap, clipping, sideways scroll, a control under the SOS orb...)
- Arabic RTL: works / problems (untranslated text, wrong direction, mirrored icons, dates, numbers, wrapping)
- Promise: which of P1..A5 this screen is responsible for, and does it keep it here?
- Defects: anything wrong you can see, with the screenshot file
```

End with: the five screens most in need of redesign and why; which screens have no door (no
link reaches them); patterns that repeat across the portal (good and bad); and a short list
of everything the founder complained about (TAKEOVER s10) that you saw confirmed or not.

Reply when done with at most 15 lines.
