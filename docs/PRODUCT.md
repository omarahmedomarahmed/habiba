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
| Find a therapist on the radar (called "Radar", never a crisis service) or browse by language, city and in person | "24/7" means the radar is open, never that someone will answer |
| Book from a therapist's open hours and pay: company benefit, then wallet, then bank transfer | A booking is confirmed only after our staff confirm the transfer |
| A page per session: join, reschedule, cancel (full refund up to 24 hours before) | The 50 minutes start when both people are in the room |
| Video session in the browser | |
| Read summaries a clinician signed, homework, journal, PHQ-9 and GAD-7 | No model output reaches a patient unsigned. A journal entry with crisis words alerts the clinicians holding a grant, or the platform on-call when nobody does; the patient is not told |
| Claim their record and link it across clinicians; see and revoke who can read it | Grants are per clinician |
| Withdraw cross-border consent, which stops all AI processing about them | `/patient/residency`. Their clinician's room and session page then say live risk detection is off |
| Ask for a copy of their record by email | The link lives 24 hours and opens once, then gives 15 minutes to read and download |
| Enrol with an employer's benefit | The employer never learns who enrolled |
| Billing history with printable receipts, wallet balance | |
| SOS orb and `/sos` with local crisis numbers | Works without JavaScript; never depends on money. Says plainly that 24Therapy is not an emergency service |

Not built: talking to an AI; paying by card.

## Therapist (`/login`, then the dashboard)

| Built | Notes |
| --- | --- |
| Sign up and verification: identity, licence and headshot reviewed in our queue | Cannot see patients or appear on the radar until verified |
| Radar presence, opening hours, online or in person with a practice address | Hollow dot when offline, bright when live |
| Sessions in our video room or in person; a QR code for in-person payment | Start unlocks only when a priced session is paid. A booking whose hour passed with nobody starting it shows as "Did not take place" and is not earned |
| Confirm the patient is 18 or over when adding a chart, starting a session, or in the room | Nothing is recorded, transcribed or sent to the meeting bot without it; under 18 is refused |
| Recording with the patient's consent, live transcript, draft note to edit and sign, addenda | Note formats configurable; the note records how it was made. A failed draft says so ("try again" or "write it myself"), never a blank note. The English copy of an edited note is hidden until it is translated again |
| Risk flags with quoted lines and a recommended action; "Risk check failed" when the model fails | Level decided by code, not the model |
| Crisis alerts by email and in app, acknowledged on a signed-in page, escalated if not | `/on-call`. Only the clinician, a colleague in the practice or the platform on-call may acknowledge. When a patient paused AI, the room says "Live risk detection is off" |
| Case copilot with citations to session lines and documents; in-session suggestions; a general assistant over the roster | Copilot only for clinicians the patient granted. The AI profile, timeline and diagnoses also need a live grant (or a chart nobody else holds for an unclaimed person) |
| Patients: invite, upload documents, assessments, homework, portability requests (`/connect`) | |
| Earnings and payouts by InstaPay or wallet, paid by our staff | Fees are netted from earnings |
| Billing: pay as you go, or the Practice plan | |
| Language for every message, notifications, support tickets | |
| An optional authenticator app (Settings), added after typing the password again | Once on, every sign-in asks for it; a lost phone is reset by our staff |

Not built: an earnings export. The authenticator app is optional (founder item F-MFA).

## Clinic (`/clinic`)

| Built | Notes |
| --- | --- |
| Apply, then invite clinicians onto seats | A clinician reaches the radar only once verified |
| One bill for the practice; seats prorated; a seat leaving lowers the next bill | |
| Earnings per clinician | |
| Team: the admin plus up to two custom roles; staff assigned to clinicians | Money and membership are never delegated |
| An optional authenticator app for the clinic manager | Asked for at every sign-in once on |
| Patients shown as first name and last initial | Never any clinical content |
| EHR connection panel (`/clinic/records`) and a download of the practice's own data (`/clinic/export`) | The EHR side needs keys |

## Company (`/sponsor`)

| Built | Notes |
| --- | --- |
| Apply, then fund a pot by bank transfer; welcome credit | Our staff confirm each transfer |
| Coverage share per session; set to zero without removing anyone | |
| Enrolment by work domain, an uploaded staff list (hashed) or a joining code, always with an email | |
| Overview chart, pot balance and weekly ledger: price, cover, company share, employee share | Never who, which therapist or which day. Every figure comes from complete weeks, and a week shows only inside a period that at least 5 different people used; a held-back week looks like an empty one |
| Ask for unspent money back | |
| Team accounts | |

The HR integrations page is hidden until it is rebuilt.

## Partner developer (`/partner`)

| Built | Notes |
| --- | --- |
| Apply; approved by our staff | |
| API keys (sandbox and live), webhooks with signed deliveries and a delivery log, usage, team | Webhooks carry an event and an id, never content. An optional authenticator app per user |
| The partner API (`/api/partner/v1`) and launches into a clinician's session, with the clinician's and patient's consent | Notes and everything else about a person stop when the person unlinks, and cover only sessions in the partner's own practices |

Not built: partner invoices and payment instructions (partners are billed monthly at $3 a session in the ledger only).

## Our staff (`/admin`)

| Built | Notes |
| --- | --- |
| Verification queue, transfer queue (confirm or reject in our own words, optionally against the bank statement's amount), payouts, refunds | Two people for refunds, transfers without proof and ledger adjustments. Payouts: whoever confirmed the transfer does not approve, and whoever approves does not send (a switch, on). Earnings are withdrawable 7 days after the session |
| Payout states: requested, approved, sent, confirmed, rejected or returned; a provider send is sending, sent, failed or `unknown` when the provider did not answer | An `unknown` payout cannot be sent again or marked sent by hand; it is asked again hourly, and a second person may record that the provider confirms it was not sent |
| Support tickets, patients, therapists, clinics, companies, partners, benefits | Clinical rows only after giving a reason, for 15 minutes |
| Settings: prices, rules, crisis lines, countries, providers | Every change audited |
| Website content, interface strings, taxonomy | |
| AI usage and cost, errors, job health, audit log, ledger checks (`/admin/vault`) | |
| Actuals, the financial model and a business board | |
| Team and roles; authenticator setup at `/admin/security`; Sign-in security resets a clinician's, clinic manager's or partner user's app | An authenticator app is required for every staff sign-in, never an emailed code; the first app is set up after a code emailed to the member's own address |

The console is English only (ruling N17).
