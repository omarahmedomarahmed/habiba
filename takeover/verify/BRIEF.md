# Brief for every verifier

Sixteen readers read all of `/home/user/habiba` line by line. Their notes are
`takeover/reading/code-01.md` to `code-16.md`, plus three document digests in the same folder.
Between them they report about 200 "Broken" entries and as many "Suspect" ones. Readers are
often right and sometimes wrong, and this codebase is full of holes that were patched three
files away. Your job is to turn the claims in YOUR DOMAIN into verdicts a founder can act on.

Read first: `docs/VALUE-STATEMENTS.md` (25 promises, P1 to A5), `takeover/MAP.md` (especially
"Confirmed by the coordinator", which is already verified; carry those in as CONFIRMED, cite
the MAP number, do not re-verify them), and `docs/TRAPS.md`.

## Method

1. Collect every entry in your domain from the Broken, Suspect and "Looks broken, is handled"
   sections of ALL sixteen code notes and the digests. Grep them; do not rely on one file.
2. Merge duplicates (two readers, one defect): keep one entry, list both sources.
3. For each, open the code yourself and decide. **Look for the patch before confirming**: grep
   for a guard in the caller, the data layer, a DB constraint or trigger (drizzle/*.sql), a
   middleware, a cron. Read the whole function, not the line the reader cited.
4. Where cheap and safe, prove by execution: a pure function can be run with
   `node --import tsx -e '...'` (dependencies are installed). NEVER run anything that touches a
   database, the network, or `npm run` scripts. No `.env.local` exists; keep it that way.
5. Read only. Do not edit any file except your own output file.

## Verdicts

- **CONFIRMED**: you saw the defect in the code and found no patch.
- **PARTLY**: part holds; say exactly which part and where the rest is handled.
- **HANDLED**: a patch elsewhere makes it not a defect; cite the patch file:line. These are as
  valuable as confirmations: they go in the report's "looks broken, is handled" section.
- **WRONG**: the reader misread; say why.
- **UNTESTABLE HERE**: needs a database or a browser; say what the walk should do to settle it.

## Output

`takeover/verify/<domain>.md`, written as you go (append after every few entries, so a context
compaction loses nothing; if compacted, re-read your own file and continue). One entry each:

```
### <DOMAIN>-<n> · <one-line title>
- Verdict: CONFIRMED | PARTLY | HANDLED | WRONG | UNTESTABLE HERE
- Sources: code-NN Broken 3, code-MM Suspect 7
- Promise: P1..A5 or none
- Who is hurt and how, in plain words a non-technical founder understands (one or two sentences)
- Evidence: file:line of the defect, and file:line of any patch you checked
- Severity: S1 (safety, legal, privacy wall, money lost or double-moved) | S2 (a person stuck,
  misled or refused wrongly) | S3 (wrong but survivable) | S4 (cosmetic, internal)
- Fix sketch: the smallest correct change, and which check would prove it
- Decision it came from: the ruling or sprint that made it this way, if you can tell
```

End the file with a table: every entry id, verdict, severity. Then reply with at most 15
lines: counts by verdict and severity, and your five most severe CONFIRMED entries.

Never use an em dash or en dash. No secrets in your output.
