# Security and privacy

Written from the code on 2026-10-01. The repository is public, so nothing here is a secret.

## Threat model, in short

| Who or what | What we protect against |
| --- | --- |
| An employer | Learning which employee is in therapy, when, or with whom, including by subtracting two published figures |
| A clinician | Reading a person's history without that person's live grant; reading another practice's patients |
| A clinic manager or clinic staff | Seeing clinical content, or more of a patient than first name and last initial |
| Our own staff | Reading clinical rows without a stated reason; moving money alone where two people are required |
| A stranger | Account enumeration, credential stuffing, guessing tokens, flooding resets, forged webhooks or callbacks |
| A model | Inventing a source, deciding a risk level, or speaking to a patient |
| A leaked URL or log | Opening a personal file, or exposing a transcript, token or cookie |

## Controls as built

| Control | Where |
| --- | --- |
| One table and one cookie per principal; sponsors, clinic managers and partners are never clinicians | `lib/routing.ts`, `lib/auth/`, `lib/patient-auth/`, `lib/clinic-auth/`, `lib/sponsor-auth/`, `lib/partner-auth/`; `verify:principals` |
| Passwords hashed with scrypt; sessions are opaque tokens in httpOnly cookies, 30 minute idle and 8 hour ceiling for clinicians and staff | `lib/auth/password.ts`, `lib/auth/session.ts` |
| Staff need an authenticator app or a recovery code; an emailed code is never a second step. The first app is enrolled only after six digits emailed to the member's own address prove the inbox, so a password alone never reaches the QR code. A super_admin resets another member's; a sole super_admin's way back is the audited `factor:reset` break glass. Clinicians, clinic managers and partner users may add one after typing their password again and are then asked for it at every sign-in | `lib/auth/totp.ts`, `lib/auth/second-factor.ts`, `lib/auth/enrolment-proof.ts`, `lib/auth/portal-second-step.ts`, `lib/auth/factor-reset.ts`; `verify:staff-2fa` |
| Every password door and the patient code doors lock per account as well as per network; the count is atomic and unknown addresses lock the same way; one-time codes count guesses in the database before comparing | `lib/rate-limit.ts` (`accountAttempt`), `lib/patient-auth/code-attempts.ts` |
| Every sign-in `next` goes through one same-origin check | `lib/auth/safe-redirect.ts` |
| The idle timeout counts a person's own requests; polls and refreshes do not extend it, and a room keeps a sign-in alive only while its session is in progress | `lib/auth/activity.ts`, `lib/auth/session.ts` |
| Webhook delivery connects to the address the SSRF check validated (no second DNS lookup) | `lib/net/public-url.ts` |
| Signup does not reveal whether an address is registered (ruling DD7) | clinician signup actions |
| Rate limits per /24 (IPv4) or /64 (IPv6) plus a platform-wide ceiling; reset limits a stranger cannot spend (ruling N38) | `lib/rate-limit.ts`, `lib/auth/reset-throttle.ts` |
| Grants: a clinician reads a person's history only under a live grant from that person. The AI profile, timeline, diagnoses and other clinicians' homework follow the same grant (`maySeeSharedRecord`); a person with a patient account counts as claimed | `lib/data/grants.ts`, `lib/access/state.ts` |
| A partner reads about a person only for sessions in its own practices and only while the person's link stands | `lib/partner/api.ts`, `lib/partner/platform.ts` |
| Record links: 24 hours, one open, then 15 minutes to read and download | `lib/data/export.ts` |
| An adult confirmation (patient's own, or the clinician's on the chart or session) before anything is recorded, transcribed or sent to the meeting bot | `lib/consent/adult.ts`, `lib/data/adult.ts` |
| Company anonymity: counts and money only. One helper behind every figure: complete weeks, a week shows only inside a period of at least 5 different people, one contiguous run of weeks so a held-back week looks empty | `lib/sponsor/ledger.ts` (`companyView`), `lib/data/sponsor-ledger.ts` |
| A stored public page making a claim that is false today is not served, and the console refuses to save one | `lib/content/claims.ts`, `lib/content/service.ts`; `verify:claims-defaults`, `verify:cms-claims` |
| Private files in a private Blob store, served through authorised routes; refused if the store is missing | `lib/uploads.ts`; `verify:blobs` |
| Staff read clinical rows only after giving a reason, for 15 minutes | `lib/audit.ts` (`investigationGrantHolds`) |
| Audit log, append-only, six years, no fixture door, TRUNCATE refused; every clinical read recorded | `lib/audit.ts`, `audit_log`, drizzle 0184 and 0189 |
| Partner API keys stored as SHA-256 hashes; webhooks signed with HMAC over timestamp and body | `lib/partner/keys.ts`, `lib/partner/webhooks.ts` |
| Stored third-party credentials and authenticator app secrets sealed with `TOKEN_ENCRYPTION_KEY` (set on Vercel production and preview, 2026-10-01) | `lib/crypto/secretbox.ts` |
| Ledger rules held by the database: unique posting keys, no UPDATE, each transaction balanced at commit; a card payment's claim, session and postings in one transaction | drizzle 0188, `lib/billing/ledger.ts`, `lib/billing/gateway/session.ts` |
| Money controls: maker and checker from transfer to payout, a 7 day hold on earnings, an `unknown` payout never resent or marked sent by hand, an EGP payout capped at the pounds that came in | `lib/billing/payouts.ts`, `lib/billing/payout-unknown.ts`, `lib/billing/egp-books.ts` |
| Cron route requires `CRON_SECRET`; payment simulators answer 404 on the live deployment | `app/api/cron/[job]/route.ts`, `app/dev/` |
| Content Security Policy enforced (report-only only when `CSP_ENFORCE=0`), nonce based with `strict-dynamic` | `lib/security/csp.ts`; `verify:csp` |
| Logs and error rows carry hashed ids and no bodies, query strings, headers or cookies | `lib/logger.ts`, `lib/observability/errors.ts` |
| AI: no prompt or completion text stored; citations must resolve; risk level decided in code; withdrawn cross-border consent stops model calls | `lib/ai/client.ts`, `lib/ai/case-copilot.ts`, `lib/crisis/level.ts`, `lib/data/ai-consent.ts` |
| Signup records the terms version naming the processors (OpenAI, Daily, Resend, Neon, Vercel and Recall.ai in the United States, WhatsApp run by Meta, Paymob in Egypt) and an 18-or-older confirmation | `lib/consent/terms.ts` (rulings DD1, DD2) |
| Production is reachable from a laptop only through an allow-list; a command that deletes or rewrites data needs a typed flag and `CONFIRM_PRODUCTION`; the build never writes to the database | `scripts/on-production.ts`, `scripts/_production-confirm.ts` |
| The database owner password was rotated on 2026-10-01 after a leaked copy in git history; the old one is refused on production and dev | `docs/OPERATIONS.md` |
| Point-in-time restore covers 7 days | Neon project setting; `docs/OPERATIONS.md` |

## Not done yet

| Gap | State | Reference |
| --- | --- | --- |
| No human reads the code | Every change is written and reviewed by AI agents; the review is labelled AI on the pull request | Needs the founder: a human engineer |
| `main` has no branch protection | CI runs on every pull request, but nothing in GitHub stops a merge on red or without a review | Needs the founder: require both CI jobs and a human reviewer |
| Crisis lexicon and wording unreviewed | The phrase list, the context rules (CR16, CR17) and the crisis copy have not been read by a native Arabic-speaking clinician | F-CR1, F-CR5, F-CR7 |
| No 24/7 human behind crisis alerts | The last stage emails managers and super admins; nobody is on a rota | F-CR4 |
| Data held in the United States | All data in AWS `us-west-2`; no Law 151/2020 transfer licence or local region; the region seam (`lib/db/region.ts`, `DATABASE_URL_EG`) has no second region open | Q (counsel), F9 |
| No field-level encryption | Notes, transcripts, journals and profiles are plaintext under Neon's disk encryption; only stored credentials and authenticator secrets are sealed, with no key rotation | none ruled |
| The app and the migrations share the database owner role, which can drop or disable the audit and ledger triggers | Proposed: a restricted app role | F-ROLE |
| Partner media has no 18+ check of ours | `lib/partner/media.ts` transcribes what a partner sends | FB5 |
| Paymob idempotency unconfirmed | Whether `client_reference_id` makes Send idempotent and looks a payout up is unconfirmed; a timed-out payout stays `unknown` until a callback or a second person's check | FC3 |
| Holding patient and company money | Whether this needs CBE licensing or a licensed PSP's marketplace product is unanswered | FC2, Q |
| Withholding tax and patient e-receipts | Withholding settings are stored and read by nothing; no B2C e-receipt; ETA covers company top-ups only and is off | FC2 |
| Second factor for clinicians, clinics and partners is optional; companies and patients have none | Proposed: mandatory for clinicians first | F-MFA |
| BAAs and DPAs with Vercel, Neon, OpenAI, Daily, Resend, Recall.ai, Meta and Paymob | None signed; the site says 24Therapy is not HIPAA compliant | F10, FB4 |
| Legal entity name, address and data contact on `/privacy` and `/terms`; legal review and Arabic versions | Pages say they are unreviewed and name no entity | F9, FD2 |
| EGP-native books | Payments and payouts carry the pounds and an EGP payout is capped; the full EGP column on every `eg` leg is a plan, not built | DC6 |
| drizzle-orm upgrade (security advisory) | Held on 0.38: from 0.44 a failed query's error carries its SQL parameters, which the logger would write out | DD9, FD3 |
| Arabic clinical questionnaires | PHQ-9 and GAD-7 shown in validated English until a clinician signs the Arabic | F8 |
| Error tracking and uptime service | None installed (`SENTRY_DSN` is unused); a GitHub workflow checks the site every 15 minutes as a stopgap | F-MON |
| CSP violation reports | The policy has no `report-uri`, so refusals reach only the browser console | |

## Closed on 2026-10-01 (DD-2)

| Finding | Closed by |
| --- | --- |
| Database owner password in public git history | Rotated on `main` and dev; Vercel updated; old password refused |
| Crisis phrases silenced or missed; journal hits stayed in the app; spent retries waited; anyone could acknowledge | Lexicon and context rules, `raiseCrisisAlert` for journals, escalate on spent retries, `mayAcknowledge` (`docs/ARCHITECTURE.md`, Crisis) |
| A refused or revoked clinician saw the AI profile, timeline and diagnoses | `maySeeSharedRecord` |
| The partner note API ignored an unlink | `partner_subjects.revoked_at` and own-practice scope |
| Company overview counted sessions, not people | One `companyView` for every figure |
| Card payment could be taken and not recorded; ledger rules in code only | One transaction; 0188 constraints; hourly sweep |
| One person could confirm a transfer, approve and send its payout; payout could pay twice after a timeout | Maker and checker; `unknown` state |
| Open redirect on sign-in; per-network guess counting only; idle timeout counted polls; emailed code as a staff second step | `safe-redirect.ts`; per-account atomic counts; `activity.ts`; app required |
| Audit log fixture door and TRUNCATE | 0189 |
| Webhook SSRF check before a second DNS lookup | Pinned address |
| Blank or stale AI notes | `UnusableNoteError`; translation source hash |
| False claims in stored CMS rows | `lib/content/claims.ts` guard and verifiers |
| No age check on clinician-made charts and sessions | Clinician's 18+ confirmation (0190) |
| Record links reusable for 3 days | 24 hours, one open |
| Restore history 1 day; no outside uptime check | 7 days; `uptime.yml` |
| No database suite in CI | "Database checks" job with `test:tenancy` |

## Video room hosts (audited)

The Content Security Policy must name every host the video room connects to, and those hosts
are named in the 1.8MB client that `@daily-co/daily-js` downloads at join time, not in the
installed package. The production signalling API is on `pluot.blue`, which the package never
mentions.

- Audit: `npm run audit:daily-hosts`
- Record: `npm run audit:daily-hosts -- --write` (rewrites the block below)
- Enforce: `npm run verify:csp` (fails when the installed version differs from the audited one,
  or a host has no decision)

```audited
daily-js 0.91.0
bundle 1775KB
allow *.daily.co · the bundle, geo lookup, rooms and media
noted *.google.com · the default STUN server, which connect-src does not govern
allow *.pluot.blue · the production signalling API and region lookup
noted *.pluot.co · compared against, never fetched: an origin fallback and the staging test
allow daily.co · the SDK's default domain
allow dailywebrtc.com · an alternate room domain the SDK swaps in
allow dailywebrtc.net · an alternate room domain the SDK swaps in
noted pluot.tv · compared against in the legacy origin test, never fetched
```

| Host | What it is | Directive |
| --- | --- | --- |
| `*.daily.co` | The bundle, geo lookup, media, rooms | `script-src` via `strict-dynamic`, `connect-src`, `media-src`, `frame-src` |
| `*.pluot.blue` | Production signalling and region lookup | `connect-src`, https and wss |
| `*.dailywebrtc.com`, `*.dailywebrtc.net` | Alternate room domains | `connect-src`, https and wss |

Blocked on purpose: Daily's own Sentry (consultation context does not leave this origin) and
WebAssembly (`script-src` has no `'wasm-unsafe-eval'`; turning on Daily's background effects or
noise cancellation would need it). STUN and TURN are not governed by `connect-src`.
`worker-src 'self' blob:` is set because workers are checked against `worker-src`.

After a Daily version bump, run the `--write` audit and read the diff: a new host is a policy
decision.
