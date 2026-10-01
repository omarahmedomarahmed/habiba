# 24Therapy

24Therapy is a therapy platform launching in Egypt at `24therapy.app`. A clinician runs a
session (in our video room or in person), the audio is transcribed and an AI draft note is
written, and nothing reaches the patient until the clinician signs it. The record belongs to
the patient and follows them between clinicians. Patients find a therapist on a public map
(the radar), pay by bank transfer that our staff confirm, and employers can fund a pot that
pays for their staff's sessions without ever learning who went. It is one Next.js app, one
Vercel deployment and one Neon Postgres database. Nothing has launched to real patients yet:
production holds an invented demo cast (`docs/DEMO.md`).

## Who signs in

| User | Signs in at | Route group | Cookie | Never sees |
| --- | --- | --- | --- | --- |
| Patient | `/patient/login` | `app/(patient)` | `24t_patient` | Anyone else's anything; an unsigned AI text |
| Therapist | `/login` | `app/(app)`, room in `app/(room)` | `24t_session` | Another clinician's caseload |
| Clinic (manager and staff) | `/clinic/sign-in` | `app/(clinic)` | `24t_clinic` | Any clinical content |
| Company (sponsor) | `/sponsor/sign-in` | `app/(sponsor)` | `24t_sponsor` | Who booked, when, with whom |
| Partner developer | `/partner/sign-in` | `app/(partner)` | `24t_partner` | Content; webhooks carry ids only |
| Our staff | `/staff/sign-in` | `app/(admin)` | `24t_session` plus a second step | A sponsor joined to a session |

The routing table is `lib/routing.ts`; per-portal guards live in `lib/auth/`,
`lib/patient-auth/`, `lib/clinic-auth/`, `lib/sponsor-auth/` and `lib/partner-auth/`.
`docs/PRODUCT.md` says what each user can do today.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 App Router, React 19, TypeScript, Node 22 |
| Styling | Tailwind v4, tokens in `app/globals.css` |
| Database | Neon Postgres through Drizzle 0.38 (`lib/db/schema.ts`, migrations in `drizzle/`) |
| AI | OpenAI: `gpt-4o-mini-transcribe`, `gpt-4o`, `gpt-4o-mini` (`lib/ai/client.ts`) |
| Video | Daily (`@daily-co/daily-js`); Recall.ai for external meetings when keyed |
| Email | Resend; WhatsApp Cloud API when templates are approved |
| Files | Vercel Blob, a public store for headshots and a private one for everything personal |
| Payments | Bank transfer (InstaPay) confirmed by staff; Paymob adapter waiting for keys; Stripe off |
| Hosting | Vercel, functions in `pdx1` beside the database (`vercel.json`) |

## Local setup

```
npm install
cp .env.example .env.local     # DATABASE_URL = the dev branch, AUTH_SECRET = openssl rand -hex 32
npm run dev
```

- Point `DATABASE_URL` at the **dev** Neon branch (`sprint-1-settings`), never at production.
- Set `ALLOW_LOCAL_UPLOADS=1` to store uploads on disk instead of Blob.
- Every script loads `.env.local` itself (`node --env-file-if-exists`). Never `source` it: the
  `&` in the connection strings makes bash drop the database variables.
- Environment variables are listed by name in `docs/OPERATIONS.md`.

## Key commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Safety and due diligence unit suites (no database) |
| `npm run ci` | What GitHub runs on every pull request: typecheck, unit suites without a database, the prose ratchet, static verifiers |
| `npm run gates` | The full local pass, database included. Slow; run before a deploy |
| `npm run verify:<name>` | One verifier. `docs/TESTING.md` says which to run for what |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run on:production -- <command>` | The only way to run a command against production (allow-list in `scripts/on-production.ts`) |
| `npm run seed:demo -- --scenario=event` | Wipe people and seed the event demo cast (`docs/DEMO.md`) |
| `npm run logins` | Regenerate the login sheets from the cast files |
| `npm run content:sync -- <block types>` | Publish named CMS blocks without touching the rest |
| `npm run settings:check` | Is the stored configuration complete |
| `npm run inventory`, `npm run lifecycles` | Print every page and control, every state machine |
| `npm run plan` | The financial model's scenarios |

## How changes ship

`CLAUDE.md` is the rule. In short:

1. Work on a branch and open a pull request into `main`.
2. GitHub Actions runs `npm run ci` and the database suites (`.github/workflows/ci.yml`). Red blocks the merge.
3. An AI code review of the diff is recorded on the pull request, labelled as AI.
4. Before a merge that deploys: `npm run gates` locally, then
   `npm run on:production -- db:status` and, if it lists any, `npm run on:production -- db:migrate`
   (production migrations go first; `docs/OPERATIONS.md` has the deploy steps).
5. Merge with a merge commit. Only `main` deploys (`vercel.json`).

## Documentation

| File | What it covers |
| --- | --- |
| `CLAUDE.md` | How changes reach production |
| `docs/ARCHITECTURE.md` | Route groups, auth, data model, AI, money, crisis, privacy, jobs, observability |
| `docs/OPERATIONS.md` | Environments, variables, migrations, the production allow-list, content, demo, blobs, costs, backups, known hazards |
| `docs/TESTING.md` | `npm run ci`, `npm run gates`, verifier families, traps in checks |
| `docs/PRODUCT.md` | What each user can do today, and what is switched off or not built |
| `docs/SECURITY-AND-PRIVACY.md` | Threat model, controls as built, what is not done, the video host audit |
| `docs/DECISIONS.md` | Product, clinical, legal and money decisions in force, and what needs the founder |
| `docs/DEMO.md` | The demo casts, seeding, and which position proves which promise |
| `docs/DEMO-LOGINS.md` | The shareable event logins (generated by `npm run logins`) |
| `docs/simulation/` | The one-month simulation runbook, machine-checked by `verify:runbook` |
| `docs/business/` | Financial plan, brand and logo brief |
| `docs/DUE-DILIGENCE-PROMPT.md` | The independent due diligence brief |
