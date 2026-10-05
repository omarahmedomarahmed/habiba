# Operations

How the product is run. Values never appear here: the repository is public, and every
secret lives in Vercel or in the operator's own `.env.local`.

## Environments

| What | Production | Dev |
| --- | --- | --- |
| Vercel | Project `habiba`, deploys from `main` only (`vercel.json` `git.deploymentEnabled`) | `npm run dev` on a laptop |
| Neon (project `gentle-waterfall-66476219`) | Branch `main`, endpoint `ep-wild-lake-a6tgm2r6` | Branch `sprint-1-settings`, endpoint `ep-aged-dust-a6huadss` (the name is historical; it is the dev database) |
| Region | Functions in `pdx1`, database in AWS `us-west-2` (ruling N16) | |
| Domain | `24therapy.app` | `localhost:3000` |

The third environment, `simulation-q1`, was deleted on the founder's word (ruling N35).
`scripts/_environments.ts` still lists it, so `settings:compare` reports it as absent.

`.env.local` keeps `DATABASE_URL` on dev. Production is reached only through
`npm run on:production -- <command>`, which reads `DATABASE_URL_PRODUCTION`, checks it names
the production endpoint, and runs one allowed command with it.

## Environment variables (names only)

| Group | Variables |
| --- | --- |
| Required in production (`lib/env.ts`) | `DATABASE_URL`, `AUTH_SECRET`, `OPENAI_API_KEY`, `APP_URL`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN` |
| Required on the live deployment | `RESEND_API_KEY` |
| Recommended | `DAILY_API_KEY`, `EMAIL_FROM`, `BLOB_PRIVATE_READ_WRITE_TOKEN` (without it personal files are refused), `TOKEN_ENCRYPTION_KEY` (seals authenticator app secrets, partner webhooks, meeting and EHR connections; see below) |
| WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APPROVED_TEMPLATES`, `WHATSAPP_TEMPLATE_LANGUAGE` |
| Paymob (waiting for keys) | `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_HMAC_SECRET`, `PAYMOB_BASE_URL`, `PAYMOB_PAYOUTS_CLIENT_ID`, `PAYMOB_PAYOUTS_CLIENT_SECRET`, `PAYMOB_PAYOUTS_USERNAME`, `PAYMOB_PAYOUTS_PASSWORD`, `PAYMOB_PAYOUTS_BASE_URL` |
| Gateway override and simulator (not on the live deployment) | `EGYPT_GATEWAY`, `EGYPT_GATEWAY_KEY`, `EGYPT_GATEWAY_HMAC`, `EGYPT_MERCHANT_ID`, `EGYPT_PAYOUTS`, `EGYPT_PAYOUTS_KEY`, `EGYPT_PAYOUTS_HMAC` |
| ETA e-invoicing (waiting for registration) | `ETA_MODE`, `ETA_CLIENT_ID`, `ETA_CLIENT_SECRET`, `ETA_SIGNER`, `ETA_SIGNER_URL`, `ETA_SIGNER_TOKEN` |
| Integrations | `RECALL_API_KEY`, `RECALL_BASE_URL`, `EHR_CLIENT_ID`, `EHR_CLIENT_SECRET` |
| Stripe (off, ruling 17) | `STRIPE_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (required only when enabled) |
| Switches | `CSP_ENFORCE` (`0` means report-only), `SIMULATION_RUNNING` (outbox for `@example.com`, robots disallow, wider limits), `SIMULATION_BANNER` (`0` hides the strip), `SHOWCASE_MODE` (`1` makes every scheduled job answer before any query, so the legacy showcase never wakes the database), `ALLOW_LOCAL_UPLOADS`, `OPENAI_BASE_URL` |
| Database extras | `DATABASE_URL_DIRECT`, `DATABASE_SSL`, `DATABASE_URL_EG` (a future Egyptian region; none is open), `DATABASE_URL_UNPOOLED` (on Vercel; no code reads it, but it carries the password, so it is rotated with `DATABASE_URL`) |
| CI only | `DATABASE_WS_PROXY` (a local WebSocket proxy in front of a throwaway Postgres; `docs/TESTING.md`) |
| Local only, never in Vercel | `DATABASE_URL_PRODUCTION`, `DATABASE_URL_DEV`, `DATABASE_URL_SIMULATION`, `DEMO_PRIVATE_PASSWORD`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_TEST_EMAIL`, `SEED_TEST_PASSWORD`, `E2E_CHROMIUM` |

`.env.example` lists the common ones. `SENTRY_DSN` is in it but nothing reads it.

`TOKEN_ENCRYPTION_KEY` was set on Vercel production and preview on 2026-10-01. Every
authenticator app secret is sealed with it (`lib/crypto/secretbox.ts`), and staff cannot sign in
without an app, so losing or changing the key means every account re-enrols its authenticator
app (and every stored partner, meeting and EHR credential is unreadable). Keep one copy in the
founder's password manager.

## Database credentials

| When | What happened |
| --- | --- |
| About 2026-09-23 | A Neon owner connection string was found in the public git history (the simulation branch), where it stays; due diligence flagged it again on 2026-10-01 |
| 2026-10-01 | Rotated: the owner role passwords on `main` and the dev branch were reset in Neon; Vercel `DATABASE_URL` and `DATABASE_URL_UNPOOLED` were updated; the old password was tried and refused on production and dev |

To rotate again:

1. Neon console, project, branch `main`, Roles: reset the owner role's password. Do the same on
   the dev branch.
2. Vercel, project `habiba`, Settings, Environment Variables: update `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED` for every environment that has them, then redeploy `main`.
3. Update `DATABASE_URL_PRODUCTION` and `DATABASE_URL` in the operator's own secrets file.
4. Prove it: `npm run on:production -- db:status` works with the new value, and a connection with
   the old one is refused. Record the date here.

Never paste a connection string into a command, a document, an issue or a chat; it goes from the
Neon console into Vercel and the secrets file only.

## Loading the secrets file

Keep it outside the repository (the repository is public) and load it in a subshell, so no value
is expanded onto a command line where `ps` and shell history would show it:

```
(set -a; . ~/24therapy-secrets.env; set +a; npm run gates)
```

Never `env $(xargs < file) ...`, and never `source .env.local` (H48); scripts load `.env.local`
themselves.

## Migrations

Nothing applies migrations on deploy. Every migration is additive and goes to production
**before** the code that needs it reaches `main`.

1. Write it with `npx drizzle-kit generate --custom`, never a plain `generate`: `drizzle/meta/`
   holds only the first snapshot, so a plain generate tries to recreate every table.
2. Set the new entry's `when` in `drizzle/meta/_journal.json` above the previous one. Drizzle
   skips an entry whose `when` is lower than the last applied, silently.
3. `npm run db:migrate` on dev, then check the column in `information_schema`. The runner
   prints "Migrations applied" either way; `scripts/migrate.ts` refuses when the directory and
   the journal disagree, and connects to the direct (not pooled) endpoint so its lock is
   released.
4. `npm run verify:migrations` (journal, ledger and every CHECK validated).
5. Before the merge that deploys, follow the deploy steps below.

CI's `verify:journal` fails a pull request that edits, removes or reorders a journal entry
`main` already had, or edits one of its SQL files: production already ran those, so the
journal only grows at the end.

The DD-2 migrations, all additive and safe to apply before the deploy (there is no 0193):

| Migration | What it does |
| --- | --- |
| 0188 | Ledger: `posting_key` and `leg` (unique per business event, so a double post fails), no UPDATE except a foreign key emptying an account column, each `txn_id` sums to zero at commit (deferred constraint trigger); `egp_minor` and `fx_rate_micro` on legs; the payout `unknown` state; the bank statement figure on a confirmed transfer |
| 0189 | Audit log: the `app.audit_fixtures` door is gone and TRUNCATE is refused; `portal_second_factors` and `portal_recovery_codes` for clinic managers and partner users |
| 0190 | `adult_confirmed_at` and `adult_confirmed_by` on `patients` and `sessions` |
| 0191 | `session_notes.content_en_source` (the hash a translation was made from) and `patients.address_as` |
| 0192 | A crisis alert may hang off a journal (`journal_id`, `person_id`, nullable clinician and practice); `sessions.live_risk_off_at` |
| 0194 | Journal alerts outlive the journal and the person: foreign keys become SET NULL, `journal_ref` keeps the source |
| 0195 | `payout_requests.provider_no_record_since`, and stamps the source hash on translations 0191 hid that were never edited after they were written |

## Deploy steps

Migrations stay manual: applying them needs the production owner credential, which never goes
to GitHub. The build does not touch the database.

| Step | Command | When |
| --- | --- | --- |
| 1. What production lacks | `npm run on:production -- db:status` | Before every merge into `main`. Lists pending migrations and exits 1 while any are pending |
| 2. Apply them | `npm run on:production -- db:migrate` | When step 1 lists any |
| 3. Prove it | `npm run on:production -- verify:migrations`, then `db:status` again | After step 2 |
| 4. Merge | Merge commit into `main`; Vercel deploys it | After CI is green and steps 1 to 3 are clean |
| 5. Settings defaults | `npm run on:production -- settings:seed` | Manual now: the build no longer seeds production. Run it after a release that adds a settings group, field, country or shipped questionnaire. Insert-only, so it is safe to run every time; until it runs, a missing row reads as its defaults (`parseGroup` in `lib/settings/defs.ts`) |
| 6. Copy | `npm run on:production -- verify:cms-claims`, then `content:sync` or `content:rename` (below) for any row it names | After a release that corrects public copy; a stored row wins over the code |
| 7. Confirm the live site | The Vercel deployment status, then `https://24therapy.app/api/health` | After the deploy (H53) |

## The production allow-list

`scripts/on-production.ts` is the whole list. Anything else is refused with its reason.

| Deletes or rewrites data | Writes | Reads only |
| --- | --- | --- |
| `seed:demo`, `ship:content`, `settings:reprice`, `age` (unless `--dry`), `sim:clock` (unless `--dry` or `--show`), `content:sync` and `content:rename` (unless `--dry`), `blobs:migrate-private` (with `--apply`), `factor:reset` (unless `--dry`) | `db:migrate`, `settings:seed`, `settings:rails`, `simulate:seed`, `copilot:exam` | `db:status`, `settings:show`, `settings:check`, `verify:migrations`, `verify:cms-claims`, `verify:board`, `verify:cast`, `verify:demo`, `verify:event-demo`, `verify:physics`, `baseline`, `spend`, `physics`, `sim:inbox` |

A command in the first column refuses to run unless it is given
`--i-understand-this-deletes-production-data` and `CONFIRM_PRODUCTION` is set to the production
database host (the host part of `DATABASE_URL_PRODUCTION`, typed in full). Take a Neon
snapshot first. For example:

```
CONFIRM_PRODUCTION=<host> npm run on:production -- seed:demo -- --scenario=event --i-understand-this-deletes-production-data
```

Refused by name: `gates`, `verifiers`, `db:seed`, `demo:seed`, `db:reset`, `verify:synthetic`,
`verify:actuals`, `verify:payout`, `verify:limits` (they plant fixtures). Run those on dev.

## Settings

Prices, fees, rules, crisis lines, countries and provider names are rows in
`platform_settings` and `country_settings`, edited at `/admin/settings` and audited in
`settings_history`. The shipped defaults are `lib/settings/defs.ts`.

| Command | Does |
| --- | --- |
| `npm run settings:seed` | Inserts missing defaults; never overwrites a stored value. On production it is deploy step 5, never part of the build |
| `npm run settings:show` / `settings:check` | What is stored; whether it is complete |
| `npm run settings:compare` | Compares settings across the environments `.env.local` names |

## Content

Public pages are `content_pages` rows. A row, once published, wins over `lib/content/defaults.ts`
for ever, so editing the defaults changes nothing a visitor sees.

| Command | Use |
| --- | --- |
| `npm run on:production -- content:sync -- <block types> [--dry]` | Replace named block types on a page and prove every other block is byte-identical. The normal way to publish a copy change. Without `--dry` it needs the confirmation above |
| `npm run on:production -- content:rename -- "<exact phrase>" "<replacement>" [--dry]` | Replace one exact phrase in the text of every block, on every page and locale, for copy with no code default to sync from (the "Crisis Radar" wording, F-CR6). Never touches links, images, ids or block kinds; refuses any row whose blocks would change otherwise; writes in one transaction. Without `--dry` it needs the confirmation above |
| `npm run on:production -- verify:cms-claims` | Read-only: lists any published row making a claim that is false today (`lib/content/claims.ts`) and the `content:sync` command that fixes it. Until fixed, the site serves the code default for that row |
| `npm run on:production -- ship:content` (with the confirmation above) | Reseed every page from the defaults. Destroys authored copy richer than the defaults (H49). Use only when the defaults are the correction |

Copies of the home and for-patients rows from 2026-09-21 are in `docs/content-backup/`; each
row carries its `id`, so restoring one is a single `UPDATE content_pages SET blocks = ...`.

## Demo data

| Step | Command |
| --- | --- |
| Snapshot production in Neon first | Neon console, branch `main` |
| Seed the event cast (wipes people, keeps configuration and the published site) | `CONFIRM_PRODUCTION=<host> npm run on:production -- seed:demo -- --scenario=event --i-understand-this-deletes-production-data` |
| Prove it | `npm run on:production -- verify:event-demo` |
| Regenerate the login sheets | `npm run logins` |

`docs/DEMO.md` has the casts and the five test positions.

## Private files

Personal files (licences, IDs, receipts, support attachments, patient photos, documents) go to
the private Blob store and are read only through authorised routes (`lib/uploads.ts`). Files
written before the private store existed are moved with:

```
npm run on:production -- blobs:migrate-private              # dry run
CONFIRM_PRODUCTION=<host> npm run on:production -- blobs:migrate-private -- --apply --i-understand-this-deletes-production-data
```

`npm run verify:blobs` proves no personal column still points at a public file. An older
script, `npm run blobs:private`, does the same move in two steps.

## Lost authenticator apps

| Who lost it | Who resets it |
| --- | --- |
| A staff member or manager | A super_admin, from Team |
| A clinician, clinic manager or partner user | A super_admin or manager, from Sign-in security in the console |
| The only super_admin | Break glass, below. Audited, and the next sign-in enrols a new app after an emailed code |

```
npm run on:production -- factor:reset -- owner@example.com --dry
CONFIRM_PRODUCTION=<host> npm run on:production -- factor:reset -- owner@example.com --i-understand-this-deletes-production-data
```

Proposed (F-2FA-STAFF): only the founder runs the break glass, and each use is noted in
`docs/DECISIONS.md` with the date.

## Email DNS for `24therapy.app`

`npm run verify:email-dns` asks live DNS; this table is what it found on 2026-09-22.

| Record | State |
| --- | --- |
| SPF, root | Zoho, which hosts the mailboxes |
| SPF, `send.` subdomain | Amazon SES, which Resend sends through. Resend puts its SPF here, not at the root |
| DKIM | `zmail._domainkey` (Zoho) and `resend._domainkey` (the product's mail), both published |
| DMARC | `p=none` with aggregate reports to the founder, relaxed alignment (`adkim=r; aspf=r`), no `ruf` |

Relaxed SPF alignment is what lets the `send.` subdomain align with the root; do not tighten
it. After a fortnight of clean reports move DMARC to `p=quarantine`, then `p=reject`; the
verifier starts failing on 2026-10-06 while the policy is still `p=none`. Take exact record
values from the provider dashboards, never from a document.

## Monitoring

A stopgap only. `.github/workflows/uptime.yml` (a scheduled GitHub Actions workflow) fetches `https://24therapy.app/` and
`/api/health` every 15 minutes and fails if either is not a 200 within 10 seconds; GitHub emails
the repository owner about a failed scheduled run. Neither URL wakes the database. GitHub can
delay scheduled runs and pauses them after 60 days without repository activity. A real uptime
service and an error tracker are founder item F-MON in `docs/DECISIONS.md`.

## Costs that matter

| Cost | What drives it | Control |
| --- | --- | --- |
| Neon compute | The database sleeps after 5 idle minutes; any query wakes it | The minute tick reads a Blob marker and skips the database when nothing is due (ruling N34); CMS cache is 1800 s (`lib/content/service.ts`), never 300 |
| Neon history | Restore history bills per GB-month; retention is 7 days | Lower it before a bulk load (H10) and set it back to 7 days after |
| Vercel builds | Every pushed branch used to build | Only `main` deploys |
| AI | Transcription and notes | Measured at about $0.22 for a 50 minute session (`evals/physics.json`); per-call cost in `ai_request_logs` |

## Backups

| Store | Recovery |
| --- | --- |
| Postgres | Neon point-in-time restore of `main` inside the history window, 7 days since 2026-10-01 (Neon project history retention; it was 1 day). Neon console, Backup and Restore, or `neon branches restore main ^self@<time> --preserve-under-name <name>`. The connection string does not change. Rehearse on dev first. Migrations applied after the chosen instant must be applied again |
| Blob | No undelete and no versioning. Take copies with `vercel blob list` and `vercel blob get`, kept off the laptop and out of this repository. Paths are random and written once, so a restored row points at its file if the file still exists |
| CMS rows | `docs/content-backup/` (2026-09-21) |

## Known hazards

Traps in the code or tooling that have already cost time. `verify:claims` checks this table
keeps its Status column. Traps in the checks themselves are in `docs/TESTING.md`.

| # | Status | Hazard | Rule |
| --- | --- | --- | --- |
| H1 | live | `db:migrate` prints success whether or not it applied anything | Check `information_schema` after every migration |
| H2 | live | A prompt instruction placed after the JSON schema loses | Standing corrections go first |
| H4 | live | A fix for case A often breaks case B | Re-measure the case that already worked |
| H5 | live | `Object.is(-0, 0)` is false | Normalise anything produced by negation |
| H7 | live | `sql.raw` with data-derived values is injection | Bind parameters, `inArray` |
| H8 | live | Two `aria-live="polite"` regions queue behind each other | One polite region per screen |
| H9 | live | Vercel functions cap at 300 s (800 s on Fluid) | Long work goes to a resumable cron |
| H10 | live | Neon restore history bills about 10 times the row cost | Retention to 0 before a bulk load, back to 7 days after |
| H13 | live | `cost_microcents` is thousandths of a cent | Divide by 1e5 for dollars |
| H16 | live | Nothing migrates on deploy | Migrate production first, keep migrations additive |
| H18 | live | A generated journal `when` can land behind the last one and be skipped | Correct `when` after `generate --custom` |
| H19 | live | Plain `drizzle-kit generate` recreates every table | `--custom` only |
| H20 | live | A known-failing test is a test nobody reads | Re-diagnose a standing failure or fix it |
| H21 | live | The e2e suite needs its harness | Always `npm run test:e2e` (`tests/run-e2e.sh`) |
| H22 | live | An operator switch is read through an accessor, not its column name | Grep the accessor and its callers before deleting a control |
| H23 | live | The i18n ratchet cannot see strings inside JSX expressions | Zero means "no known English", not "no English" |
| H24 | live | Changing a table's data shape breaks functions that walk it | Re-read every walker when a schedule or ladder changes |
| H26 | live | A guard added to every writer can block a sanctioned production path | List who legitimately needs past it first |
| H27 | live | True copy goes stale when the product changes | `verify:claims` holds copy to settings; add a rule per figure-dependent claim |
| H28 | live | Fixing `lib/content/defaults.ts` changes nothing live | Publish with `content:sync` |
| H29 | live | A verifier that needs two rows and finds one reports the constraint broken | Plant fixtures and remove them |
| H31 | live | A skip list matched by name skips that name at every depth (`components/public`) | Anchor skip lists at the root |
| H32 | live | A server action is a boundary in the import graph | Stop at `"use server"`, skip `import type` |
| H33 | live | Some routes authenticate by a token in the URL or a header | Model capability auth by name |
| H44 | live | A bulk replace across prose edits sentences that only mention a command | Bulk-edit commands only inside code blocks and tables, then read the prose |
| H45 | live | `pkill -f "<pattern>"` can kill its own shell | Kill by port or exact process name |
| H46 | live | A symptom that survives a clean rebuild is a process | `ps -eo pid,args \| grep next-server` first |
| H48 | live | Sourcing `.env.local` in bash drops the database URLs (the `&`) | Never source it; scripts load it themselves |
| H49 | live | `ship:content` reseeds every page from defaults | Use `content:sync`; measure bytes before and after |
| H50 | live | The sign-in limiter is at its production setting locally | A verifier that signs in is not idempotent within 15 minutes; wait it out |
| H51 | live | A git worktree inside the repository is scanned as source | No agent worktrees present when running `npm run gates` |
| H53 | live | A deploy is not proven by a push | Confirm the Vercel status and the live site |
| B1 | live | The build is memory bound: one compile process, `--max-old-space-size=4096` | Do not raise the cap; `next.config.ts` turns the build worker off |
| B2 | live | Two builds writing `.next` at once corrupt each other | One build at a time; `verify:served` builds into `.next/served` |
| B3 | live | `next start` refuses to boot without `BLOB_READ_WRITE_TOKEN`, even locally | Pass any value for a screenshot, or use `next dev` |
| B4 | live | An interrupted `npm run gates` leaves a server on port 3199 | `kill -9 $(lsof -ti:3199)` |
