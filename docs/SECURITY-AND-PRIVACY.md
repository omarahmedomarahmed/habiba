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
| Staff need an authenticator app (no emailed code, no break-glass; an owner resets another member's); clinicians, clinic managers and partner users may add one and are then asked for it | `lib/auth/totp.ts`, `lib/auth/second-factor.ts`, `lib/auth/portal-second-step.ts`; `verify:staff-2fa` |
| Every password door and the patient code doors lock per account as well as per network; the count is atomic and unknown addresses lock the same way; one-time codes count guesses in the database before comparing | `lib/rate-limit.ts` (`accountAttempt`), `lib/patient-auth/code-attempts.ts` |
| Every sign-in `next` goes through one same-origin check | `lib/auth/safe-redirect.ts` |
| The idle timeout counts a person's own requests; polls and refreshes do not extend it, and a room keeps a sign-in alive only while its session is in progress | `lib/auth/activity.ts`, `lib/auth/session.ts` |
| Webhook delivery connects to the address the SSRF check validated (no second DNS lookup) | `lib/net/public-url.ts` |
| Signup does not reveal whether an address is registered (ruling DD7) | clinician signup actions |
| Rate limits per /24 (IPv4) or /64 (IPv6) plus a platform-wide ceiling; reset limits a stranger cannot spend (ruling N38) | `lib/rate-limit.ts`, `lib/auth/reset-throttle.ts` |
| Grants: a clinician reads a person's history only under a live grant from that person | `lib/data/grants.ts`, `lib/access/state.ts` |
| Company anonymity: counts and money only, published in steps of five sessions, months built from published weeks | `lib/data/sponsors.ts`, `lib/sponsor/ledger.ts` |
| Private files in a private Blob store, served through authorised routes; refused if the store is missing | `lib/uploads.ts`; `verify:blobs` |
| Staff read clinical rows only after giving a reason, for 15 minutes | `lib/audit.ts` (`investigationGrantHolds`) |
| Audit log, append-only, six years, no fixture door, TRUNCATE refused; every clinical read recorded | `lib/audit.ts`, `audit_log`, drizzle 0184 and 0189 |
| Partner API keys stored as SHA-256 hashes; webhooks signed with HMAC over timestamp and body | `lib/partner/keys.ts`, `lib/partner/webhooks.ts` |
| Stored third-party credentials sealed with `TOKEN_ENCRYPTION_KEY` | `lib/crypto/secretbox.ts` |
| Cron route requires `CRON_SECRET`; payment simulators answer 404 on the live deployment | `app/api/cron/[job]/route.ts`, `app/dev/` |
| Content Security Policy enforced (report-only only when `CSP_ENFORCE=0`), nonce based with `strict-dynamic` | `lib/security/csp.ts`; `verify:csp` |
| Logs and error rows carry hashed ids and no bodies, query strings, headers or cookies | `lib/logger.ts`, `lib/observability/errors.ts` |
| AI: no prompt or completion text stored; citations must resolve; risk level decided in code; withdrawn cross-border consent stops model calls | `lib/ai/client.ts`, `lib/ai/case-copilot.ts`, `lib/crisis/level.ts`, `lib/data/ai-consent.ts` |
| Signup records the terms version naming the processors (OpenAI, Daily, Resend, Neon, Vercel, all in the United States) and an 18-or-older confirmation | `lib/consent/terms.ts` (rulings DD1, DD2) |
| Production is reachable from a laptop only through an allow-list | `scripts/on-production.ts` |

## Not done yet

| Gap | State | Reference |
| --- | --- | --- |
| Second factor for clinicians, clinics and partners is optional; companies and patients have none | Proposed ruling in `docs/DECISIONS.md` (DD-2 B2) | none ruled |
| The app and the migrations share the database owner role, which can drop the audit triggers | Proposed: a restricted app role (`docs/DECISIONS.md`, DD-2 B2) | none ruled |
| BAAs and DPAs with Vercel, Neon, OpenAI, Daily, Resend | None signed; the site says 24Therapy is not HIPAA compliant | F10 |
| Legal entity name, address and data contact on `/privacy` and `/terms`; legal review incl. Egypt's data protection law and Arabic versions | Pages say they are unreviewed and name no entity | F9, FD2 |
| Data residency in Egypt | All data in AWS `us-west-2`; the region seam (`lib/db/region.ts`, `DATABASE_URL_EG`) has no second region open | counsel question 13 |
| EGP-native books | Bills are stored in USD cents and shown in EGP at a hand-set rate, so EGP figures move in steps of 0.50 | N11 |
| drizzle-orm upgrade (security advisory) | Held on 0.38: from 0.44 a failed query's error carries its SQL parameters, which the logger would write out | DD9, FD3 |
| Crisis phrase list and Arabic clinical questionnaires | Not yet reviewed by a native-speaking clinician | F-CR1, F8 |
| Error tracking service | None installed (`SENTRY_DSN` is unused) | |
| CSP violation reports | The policy has no `report-uri`, so refusals reach only the browser console | |

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
