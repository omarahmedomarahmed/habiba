# Product

What each user can do today, written from the routes in `app/` on 2026-10-01. "Built" means
the screen and its action exist; it does not mean a real person has used it. Nothing has
launched to real patients: production holds an invented demo cast (`docs/DEMO.md`), the
product is in closed beta, and the public site says it is not HIPAA compliant.

The promises the public site makes are listed in `scripts/_value-statements.ts`
(`npm run prove` prints them); `lib/content/honesty.ts` refuses two claims outright: that
paid sessions cover our fee, and any forecast of what a clinician will earn.

## Switched off or waiting

| Thing | State |
| --- | --- |
| Card payments | Paymob adapter built, no keys; the pay page shows cards as coming soon. Bank transfer (InstaPay) is the live rail |
| Stripe | Off (ruling 17) |
| WhatsApp | Off until Meta approves the templates; email and in-app notices carry every message |
| Check-ins (unprompted messages to patients) | Built, switched off by default (`checkins.enabled`) |
| Video | Needs `DAILY_API_KEY`; without it the room says video is not configured, audio and notes still work |
| Zoom, Meet and Teams recording bot | Needs `RECALL_API_KEY` and `TOKEN_ENCRYPTION_KEY` |
| EHR connection | Needs `EHR_CLIENT_ID`, `EHR_CLIENT_SECRET` and `TOKEN_ENCRYPTION_KEY` |
| ETA e-invoices | Foundation built, waiting for registration |
| Data held in Egypt | Not available; everything is in the United States and the patient is told |

## Patient (`/patient`)

| Built | Notes |
| --- | --- |
| Sign up with a phone (email optional), confirm 18 or older, accept the processor notice | Sign in by password or one-time code |
| Find a therapist on the radar or browse by language, city and in person | "24/7" means the radar is open, never that someone will answer |
| Book from a therapist's open hours and pay: company benefit, then wallet, then bank transfer | A booking is confirmed only after our staff confirm the transfer |
| A page per session: join, reschedule, cancel (full refund up to 24 hours before) | The 50 minutes start when both people are in the room |
| Video session in the browser | |
| Read summaries a clinician signed, homework, journal, PHQ-9 and GAD-7 | No model output reaches a patient unsigned |
| Claim their record and link it across clinicians; see and revoke who can read it | Grants are per clinician |
| Withdraw cross-border consent, which stops all AI processing about them | `/patient/residency` |
| Enrol with an employer's benefit | The employer never learns who enrolled |
| Billing history with printable receipts, wallet balance | |
| SOS orb and `/sos` with local crisis numbers | Works without JavaScript; never depends on money |

Not built: talking to an AI; paying by card.

## Therapist (`/login`, then the dashboard)

| Built | Notes |
| --- | --- |
| Sign up and verification: identity, licence and headshot reviewed in our queue | Cannot see patients or appear on the radar until verified |
| Radar presence, opening hours, online or in person with a practice address | Hollow dot when offline, bright when live |
| Sessions in our video room or in person; a QR code for in-person payment | Start unlocks only when a priced session is paid |
| Recording with the patient's consent, live transcript, draft note to edit and sign, addenda | Note formats configurable; the note records how it was made |
| Risk flags with quoted lines and a recommended action; "Risk check failed" when the model fails | Level decided by code, not the model |
| Crisis alerts by email and in app, acknowledged on a signed-in page, escalated if not | `/on-call` |
| Case copilot with citations to session lines and documents; in-session suggestions; a general assistant over the roster | Copilot only for clinicians the patient granted |
| Patients: invite, upload documents, assessments, homework, portability requests (`/connect`) | |
| Earnings and payouts by InstaPay or wallet, paid by our staff | Fees are netted from earnings |
| Billing: pay as you go, or the Practice plan | |
| Language for every message, notifications, support tickets | |

Not built: a second sign-in factor; an earnings export.

## Clinic (`/clinic`)

| Built | Notes |
| --- | --- |
| Apply, then invite clinicians onto seats | A clinician reaches the radar only once verified |
| One bill for the practice; seats prorated; a seat leaving lowers the next bill | |
| Earnings per clinician | |
| Team: the admin plus up to two custom roles; staff assigned to clinicians | Money and membership are never delegated |
| Patients shown as first name and last initial | Never any clinical content |
| EHR connection panel (`/clinic/records`) and a download of the practice's own data (`/clinic/export`) | The EHR side needs keys |

## Company (`/sponsor`)

| Built | Notes |
| --- | --- |
| Apply, then fund a pot by bank transfer; welcome credit | Our staff confirm each transfer |
| Coverage share per session; set to zero without removing anyone | |
| Enrolment by work domain, an uploaded staff list (hashed) or a joining code, always with an email | |
| Pot balance and weekly ledger: price, cover, company share, employee share | Never who, which therapist or which day; published in steps of five sessions |
| Ask for unspent money back | |
| Team accounts | |

The HR integrations page is hidden until it is rebuilt.

## Partner developer (`/partner`)

| Built | Notes |
| --- | --- |
| Apply; approved by our staff | |
| API keys (sandbox and live), webhooks with signed deliveries and a delivery log, usage, team | Webhooks carry an event and an id, never content |
| The partner API (`/api/partner/v1`) and launches into a clinician's session, with the clinician's and patient's consent | |

Not built: partner invoices and payment instructions (partners are billed monthly at $3 a session in the ledger only).

## Our staff (`/admin`)

| Built | Notes |
| --- | --- |
| Verification queue, transfer queue (confirm or reject in our own words), payouts, refunds | Two people for refunds, transfers without proof and ledger adjustments |
| Support tickets, patients, therapists, clinics, companies, partners, benefits | Clinical rows only after giving a reason, for 15 minutes |
| Settings: prices, rules, crisis lines, countries, providers | Every change audited |
| Website content, interface strings, taxonomy | |
| AI usage and cost, errors, job health, audit log, ledger checks (`/admin/vault`) | |
| Actuals, the financial model and a business board | |
| Team and roles; authenticator setup at `/admin/security` | Second step required for every staff sign-in |

The console is English only (ruling N17).
