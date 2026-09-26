# The Neon branches, and what each one is for

Six branches on project `gentle-waterfall-66476219` (`24therapy-v2`), and every
one of them has a job. This file exists because that was not written down
anywhere, so deciding which were safe to delete meant reading `.env.local`,
listing every compute endpoint, mapping endpoints back to branches, and
grepping four documents for the one snapshot a script names.

**🔴 Before deleting any branch, read the last section. A snapshot delete
cannot be undone and one of these is the only way back from `seed:demo`.**

---

## The three environments

These are task 66's "three environments, identical settings, one connection
string each". All three appear in `.env.local` and all three are load-bearing.

| Branch | Id | Endpoint | What it is |
| --- | --- | --- | --- |
| `main` | `br-curly-dream-a6b0shlz` | `ep-wild-lake-a6tgm2r6` | **Production.** The deployed product and the domain read this |
| `sprint-1-settings` | `br-round-star-a6vlxe55` | `ep-aged-dust-a6huadss` | **Dev.** `npm run gates` runs here. The name is historical and the usage is not: it is the busiest branch in the project |
| `simulation-q1` | `br-fragrant-bonus-a6ngfs07` | `ep-empty-queen-a62vlkkp` | The third environment, for a run that must not touch either of the others |

🔴 **`sprint-1-settings` is the dev database despite its name.** Anybody
tidying by name would delete it and every gate in the repository would go red
against nothing at all.

## The two Vercel previews

Created by the Neon integration, one per git branch that has a deployment.
Vercel recreates one if it is deleted and the branch is still being pushed to,
but the preview is broken until it does.

| Branch | Id | Git branch |
| --- | --- | --- |
| `preview/simulation` | `br-morning-water-a6f5okdq` | `simulation` |
| `preview/claude/24therapy-rebuild-research-fkjen7` | `br-shiny-sunset-a6zzalsm` | the working branch |

Delete one of these only when its git branch is finished with.

## The snapshot, and it is the only one

| Branch | Id | Taken |
| --- | --- | --- |
| `snapshot-six-month-simulation-2026-09-20` | `br-nameless-dust-a6ae5e4r` | 2026-09-20 20:07 UTC |

🔴 **This is the undo for `seed:demo`, and four places say so:**
`scripts/on-production.ts` (the allow-list entry that permits the only command
able to delete people), `scripts/logins.ts`, `docs/DEMO-CAST.md` and
`docs/simulation/00-START-HERE.md`.

`seed:demo` wipes the cast off production. The entry authorising it names this
branch as condition one of three. Deleting it does not merely lose a backup, it
retroactively removes the argument that made that command safe to run.

---

## What was deleted, and why it was the only candidate

`snapshot-before-demo-seed-2026-09-20` (`br-rapid-sea-a6jkrfx2`), taken two
hours after the one above and named by nothing in the codebase. Two snapshots
of the same pre-wipe production, one of which no script could restore from
because no script knew its id.

Deleted on 2026-09-22, on the founder's decision, after the alternatives were
put side by side. The documented one stays.

## Before deleting anything here

1. **Check `.env.local` first.** Three of these six are live connection
   strings and none of their names says so.
2. **Map endpoints, not names.** `list_postgres_endpoints` gives
   `branch_id` per endpoint, which is the only honest way to tell a branch
   something reads from one nothing does.
3. **Grep the repository for the branch id.** A branch a script names is a
   branch a script depends on.
4. **A snapshot delete is permanent.** Neon has no undelete.

---

## 🔴 Backups: restoring the database, and recovering files

Task 40. Two stores hold everything a person gave us: Postgres on Neon, and
files on Vercel Blob. **They are restored separately, and a restore of one
never touches the other.** Rehearse on `sprint-1-settings` (dev) first; never
on `main` without the founder's word.

### The database: point-in-time restore of `main`

Neon keeps the history of a root branch for the project's history window
(Settings, Storage, in the Neon Console). `main` is a root branch, so it can
be put back to any instant inside that window, to the millisecond.

1. **Find the instant.** In the Neon Console open project
   `gentle-waterfall-66476219`, branch `main`, then **Backup & Restore**, and
   use **Time Travel Assist** to run read-only queries at a candidate time
   (for example `SELECT count(*) FROM session_payments WHERE status = 'paid'`)
   until you have the last good moment. Write it down in UTC, RFC 3339.
2. **Say so first.** Tell the founder and pause writes if you can (Vercel:
   redeploy with the maintenance banner, or pause the project). Anything
   written after the chosen instant is lost from `main` itself.
3. **Restore.** Console: **Restore from history**, branch `main`, tab **From
   history**, the timestamp, **Next**, check, **Restore**. Or the CLI:

   ```bash
   neon branches restore main ^self@2026-09-25T10:00:00Z \
     --project-id gentle-waterfall-66476219 \
     --preserve-under-name main_before_restore_2026-09-25
   ```

   The connection string does not change, so nothing in Vercel is edited.
   Connections drop for a few seconds and reconnect by themselves.
4. **Keep the backup branch.** Neon preserves the pre-restore state as
   `main_before_restore_…` (or `main_old_<timestamp>` from the Console). It
   holds whatever was written after the instant: copy anything worth keeping
   (a payment, a signed note) out of it by hand, then leave it until the
   founder says it can go. It has no compute and costs storage only.
5. **Check.** `npm run verify:launch` against production is not allowed from
   a session (`docs/TAKEOVER.md`); instead read the counts from step 1 again
   through the SQL Editor, and open `/admin` as an operator.
6. **Undo, if it was the wrong instant:** restore `main` again, tab **From
   another branch**, source the backup branch from step 4, at its head.

To look without restoring, create a branch from `main` at a past time
(**Branches, New branch, Past data**), connect to it and query; delete it
after. The migration ledger (`drizzle.__drizzle_migrations`) travels with the
restore, so a migration applied after the instant has to be applied again
(`docs/TAKEOVER.md`, "A migration goes to production BEFORE `main` is
pushed").

### Files: Vercel Blob

Two stores: the public one (`BLOB_READ_WRITE_TOKEN`, headshots only) and the
private one (`BLOB_PRIVATE_READ_WRITE_TOKEN`, every personal file; see
`lib/uploads.ts`). 🔴 **The private store has to exist before launch:**
`vercel blob create-store 24therapy-private --access private`, connect it to
project `habiba`, and set its token as `BLOB_PRIVATE_READ_WRITE_TOKEN` in
Production and Preview; then `npm run blobs:private -- --apply` moves the
older files in. **Vercel Blob has no undelete and no versioning.** A file
deleted there is gone unless a copy exists, and a database restore does not
bring one back.

What protects them today:

- Transfer receipts cannot be deleted by the product at all
  (`isUndeletable`, `verify:receipts`).
- Every path carries 24 random bytes and is written once, never overwritten,
  so a restored row points at the file it pointed at, provided the file was
  not deleted since (a replaced onboarding document is deleted).

To take a copy (do this before any risky operation, and on a schedule once
real people are on the product):

```bash
vercel blob list --limit 1000 > blob-list.txt
vercel blob get <url-or-pathname> --access private --output <local path>
```

(`vercel link` to project `habiba` first; a private store needs
`--access private`, a public one `--access public`.) Keep the copies off the
laptop and out of this repository: they are personal data.

To recover after a database restore:

1. List the rows whose file no longer answers: for each column in
   `scripts/blobs-to-private.ts` (`COLUMNS`), `vercel blob get` the stored
   address; a 404 is a lost file.
2. Put back what you have a copy of, under the **same pathname**, with
   `vercel blob put <file> --pathname <path> --access private`, so the row's
   address works again unchanged.
3. What has no copy is gone. Clear that column on the row (the clinician is
   asked to upload again, which is the ordinary missing-document path) and
   tell the person; never point a row at somebody else's file.

After any move of older files into private storage
(`npm run blobs:private -- --apply`), `npm run verify:blobs` proves no
personal column still points at a public file.
