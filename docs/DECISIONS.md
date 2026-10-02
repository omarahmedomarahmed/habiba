# Decisions

Every product, clinical, legal and money decision still in force, with its original ID so
code comments that cite it still resolve. New decisions are proposed in a pull request and
added here (`CLAUDE.md` rule 6). Clinical wording and safety thresholds need a qualified
clinician's review before real patients use them.

IDs: plain numbers are the founder's rulings of 24 and 25 September 2026; `N` are rulings
made on the founder's behalf during the night run of 25 to 26 September and the days after;
`CR` are the crisis rulings and `DD` the first due diligence rulings. `B1-`, `B2.` and `DC` are
the fixes for the second due diligence report (DD-2, 1 October 2026); `F`, `FB`, `FC`, `FD`
and `F-` name what needs the founder. Rulings that only governed how the night run was
organised were dropped; they are in the repository history.

**Proposed** marks a ruling made on the founder's behalf and built with the default shown. It
stands until the founder accepts, changes or reverses it; the list to accept is the first rows
of "Needs the founder".

## The rule above every ruling

Every tax, document, provider, fee, timing and approval rule is a setting at
`/admin/settings`, not a constant in code (`lib/settings/defs.ts`). A change applies from that
moment on, never rewrites a past invoice, payout, receipt or ledger entry, and is audited with
its old and new value. Provider keys stay in the environment.

## Money and tax

| ID | Decision | Why |
| --- | --- | --- |
| 1 | We are the agent: the therapist sells the session, we take our fee | Counsel's default until ruled otherwise (setting `tax.sellerModel`) |
| 2 | 0% VAT on session prices: healthcare is exempt, and only verified licensed clinicians practise | VAT Law 67/2016, exempt list item 39 |
| 4 | Company top-up: our document is a payment receipt, the ETA invoice is the only invoice (option B). Option C is built behind the same setting | Waiting for counsel on C |
| 5 | In person, paid to the therapist in cash: free through us; a pay-as-you-go therapist pays $1, and $3 more if the patient chose AI | No money passes through us |
| 5b | In person, paid through us: like a paid online session (our 15%, company benefit allowed). No priced session starts unpaid: the patient pays from a QR code and Start unlocks when paid. Only the enrolled patient, signed in, can spend company money; at most 2 pot-funded in-person sessions a week; the price is never above the therapist's list price; paid and not started is refunded to the wallet (settings `rules.inPerson`) | Closes "never paid" and "drain the pot" |
| 5c | A therapist chooses in person, online or both, and adds a practice address; patients can filter for in person | Founder, round two |
| 5d | Our 15% applies to every session paid through us, never to cash | One rule for every booking path |
| 5e | A new therapist added from a patient's QR waits for verification before the first session | No unverified clinician sees a patient under our name |
| 6, 6b | One session length, 50 minutes in total including a 10 minute countdown; one price set by the therapist; bookings on the hour | One product, no leftover "30 minute" wording |
| 7, 7b | A patient wallet, credited only when a cheaper replacement clinician steps in (the patient's own share; the company's share goes back to its pot). Spend order: company benefit, wallet, card. No top-up; hidden when empty | Money owed back without a refund trip |
| 9 | Bank details left as placeholders until real accounts exist | Production has no real users |
| 10 | Operator EGP rate stays at 50, changed by hand | Simple and visible |
| 11 | ETA e-invoicing: foundation built, wired when registration, e-seal and signer exist | Waiting for registration |
| 12 | Card gateway is Paymob; the patient pays the card fee, shown as its own line | Founder |
| 13, 13c | No two-person rule on payouts, top-up confirmations, verifications or anything urgent. Two people still required for refunds, confirming a transfer without proof, and manual ledger adjustments. Each is a switch | Those three can create money from nothing |
| 13b | Payouts provider is Paymob, ready for keys | Founder |
| 16 | A patient cancelling a paid booking gets a full refund up to 24 hours before, none after unless the therapist agrees | Setting `refunds.patientCancelWindowHours` |
| 17 | Stripe is not used; its code stays, nothing new is built on it, and production must boot without its secret | Egypt runs on transfer and Paymob |
| 18 | A transfer that arrives for a booking cancelled meanwhile goes to the patient's wallet; staff can "Refund instead" while it is unspent | Nothing lost, nothing paid twice |
| 19 | Paymob card payments land on our balance, so seat bills and moved sessions work as for transfers; revisit only if Paymob splits payments | Two gaps exist only on Stripe |
| N11 | Bills are stored in USD cents and shown in EGP at 50, so EGP figures move in steps of 0.50 (a part-month seat shows EGP 666.50) | Storing EGP per bill would change the transfer path; see EGP-native books in `docs/SECURITY-AND-PRIVACY.md` |

Proposed on 1 October by the DD-2 money fixes (migration 0188). Built and switched on with the
defaults below; each waits for the founder to accept, change or reverse it (FC1).

| ID | Proposed ruling | Why |
| --- | --- | --- |
| DC1 | A card payment's claim, session update and ledger postings are one database transaction; an hourly sweep raises any card money that is not on the books to `/admin/errors` | A payment could be taken and never recorded |
| DC2 | Maker and checker from transfer to payout, on by default (`rules.approvals.payoutSeparation`): whoever confirmed a bank transfer behind a payout does not approve it, and whoever approves a payout does not send it. Narrows ruling 13 for payouts only; a team of one cannot pay out while it is on | One person could confirm an unmatched transfer, then approve and send the payout it funded |
| DC3 | Staff may type the bank statement's amount when confirming a transfer; it must match, and the audit row says whether the check was against the bank or book against book | Reconciliation compared our books with themselves only |
| DC4 | Earnings are withdrawable 7 days after the session ended (`rules.earnings.holdDays`) | A refund or chargeback after the session needs money to come back from |
| DC5 | A payout whose provider gave no answer is `unknown`: not sent again, not marked sent by hand, until the provider is asked again and says failed or sent | A timeout followed by "Mark sent" could pay twice |
| DC6 | Patient payments and payouts carry the EGP amount and the rate actually charged; an EGP payout is refused when it would send more pounds than the clinician's sessions brought in. Full EGP books are the plan below, not yet built | After a devaluation more EGP could go out than came in |
| FC4 | Keep "Transfer, approve and send by different people" on (the default). With one staff account it blocks the payout queue: approve and send, or send and confirm not sent, need two people. Either create a second staff account, or a super admin turns the rule off in Rules knowingly (one person can then confirm a transfer, approve the payout it funds and send it). The refusals say both options | A staffing and money control decision |

**DC6, the full plan (proposed, not built).** Keep a second, EGP column on every leg of the
Egyptian entity's books (`eg`), set from the money that moved (the transfer's pounds, the card
attempt's pounds, the payout's pounds), never from a rate looked up later. The `eg` books then
balance in pounds as well as in cents, the trial balance and `/admin/vault` show pounds for `eg`,
and the difference between the two columns over time is the real `fx_difference`. Bills keep
their USD price (ruling 10 and N11) but are settled and paid out from the pounds. Steps: post
pounds on every `eg` leg; backfill the payments since launch from `manual_payments` and
`gateway_payments`; move payouts and the earnings page to the EGP balance; then retire the
re-converted figures. Counsel's question on billing Egyptian therapists in USD (item Q) decides
whether prices themselves move to pounds.

## Product and access

| ID | Decision | Why |
| --- | --- | --- |
| 8, 8b | Patients and therapists choose their language in settings and every message uses it. The patient's "You" page is a real profile (summaries, billing, bookings, employer badge or Enrol) | Founder, round two |
| 14a, 14b | Production demo data may be deleted, reseeded or edited freely, keeping a login for every user type. Fewer navigation pages, with proof every feature stays reachable | Founder |
| 15 | Company enrolment always needs an email: work domain, an uploaded staff list (stored hashed, each upload replaces the last, removed people paused after a grace period), or either plus an employee ID. The company never sees who enrolled | Privacy of employees |
| 20 | Clinicians are verified only through the verification queue, with documents and the reviewer's name | The one-click verify approved licences with no documents |
| 21 | The first extra owner needs a written reason and is audited; every later owner needs a second owner's approval | One founder cannot approve themselves |
| 22 | `/dev` pages (the payment simulators) answer 404 on the live site | Testing only |
| 23 | WhatsApp stays off until Meta approves the templates; email carries every message; the join link goes in a button | Meta approval pending |
| N9 | Product pictures on the public site use invented people, EGP prices from settings and no "online now" claim | The site must sell the product that exists |
| N16 | Server functions run in `pdx1` beside the database in `us-west-2` | Each page makes several database round trips |
| N17 | The staff console stays English only and has no language switch | Its readers are our staff |
| N22 | Production keeps `SIMULATION_RUNNING` (mail to `@example.com` stays in the outbox) with the strip hidden by `SIMULATION_BANNER=0` while strangers test with demo logins | Shared demo logins on the real product |
| N23 | Production holds the event demo cast | Founders need shareable logins with history |
| N25 | A verified clinician shows on the radar as a hollow dot, bright only while live | Shows the network without claiming anyone is available |
| N27 | Session reminders at 60, 30 and 15 minutes and "go in now" at 5, once each, only while still ahead, ignoring quiet hours | The patient chose the hour |
| N28 | The 50 minutes start when both people are in the room | An early patient must not lose minutes |
| N29 | The radar shows one marker per country and places clinicians by district from a city lookup; unknown places sit in Cairo | Founder |
| N34 | The every-minute tick reads a Blob marker and touches the database only when a session or crisis deadline is near | Keeps the database asleep |
| N35 | Only `main` deploys; Neon keeps only `main` and the dev branch | Preview branches woke the database and cost builds |
| N36 | Maps and country lists show Palestine (PS) and do not offer Israel; Hebrew is not a clinician language | Founder's market decision |
| N37 | A company's monthly figures are built only from published weekly periods, with one held-back figure shared by both views | Two views could be subtracted to isolate one person |
| N39 | A patient's "no" to a partner's recording links nobody; a consent link works only for that session's own patient | Declining must never widen access |
| B1-1 | Proposed. The AI standing profile, its timeline and the diagnoses follow the grant like files and journals: a refused, revoked or expired clinician sees none of them. The holder of an unclaimed chart keeps them only while no other clinician holds a chart for the person. A person with a patient account counts as claimed for access, so their clinicians need a grant. Homework set by other clinicians, and the patient's notes on it, follow the same rule; without it a clinician sees the steps they set | They are built from every clinic and the patient's uploads; a self-signup patient booked by two clinicians was "unclaimed" to both |
| B1-2 | Proposed. A partner gets a note only for a session held in its own practices, and only while the person's link stands; an unlink also stops transcript, note, summary, media, memory and copilot. A person who unlinks and later confirms a new link is linked again; a placeholder never re-opens a cut link | The note API matched on the person and ignored an unlink |
| B1-3 | Proposed. Every company figure (chart, totals, balance, ledger, CSV) comes from one view: complete weeks only, and a week shows only inside a period of at least the floor of different people. The chart is one run of weeks from the first published period to the last complete week, so a held-back week looks like an empty one. The balance is the one at the end of the last published period. `ledgerPublishing: live` no longer shows the current week. A money entry is written for every pot-funded session, whether or not the employee has seen the ledger notice yet (FB2; replaces the W2-S10 "told first" rule) | Five sessions can be one person, a figure left out of one view but not another can be subtracted, and a gap in the chart said when somebody used it |
| B1-4 | Proposed. A record link lives 24 hours and opens once: opening asks for a press, then gives 15 minutes to read and download. Not a sign-in, because many patients have no account | A forwarded or scanned email exposed the whole record for three days |

## Clinical and AI

| ID | Decision | Why |
| --- | --- | --- |
| N19 | A session with Arabic in it is transcribed twice (pinned to Arabic and to English) and the more confident pass kept | One pinned language mistranslated or romanised the other speaker |
| N20 | Arabic notes take the patient's gender from how they speak and are addressed, else gender-neutral; screens naming a clinician use neutral forms | The product records no gender |
| N21 | PHQ-9 and GAD-7 show in validated English on Arabic screens, with an Arabic line saying so, until a clinician signs the Arabic | Scores are valid only in a reviewed translation |
| DD3 | Withdrawing cross-border consent stops every AI call about that person (the keyword check still runs); data is kept and the page says so | The button used to do nothing |
| DD4 | Recording consent says audio is transcribed and summarised by OpenAI in the United States | It never mentioned AI or processing abroad |
| DD5 | The radar says "Licence document reviewed by 24Therapy", not "checked with the regulator" | Licences are self-declared and reviewed by us |
| DD6 | A failed or malformed risk check is stored and shown as "Risk check failed"; a malformed profile keeps the previous one | Failures used to look like clean sessions |
| B1-5 | Proposed. The clinician's assistant leaves anyone who paused AI processing off the roster it sends to the model, and the meeting bot is not sent for them | Both bypassed the pause |

## Crisis

| ID | Decision | Why |
| --- | --- | --- |
| CR1 | Every crisis alert also goes out at once by email (and WhatsApp when approved), linking to a signed-in page with an Acknowledge button | An in-app row is invisible at 3am; mail scanners open every link |
| CR2 | Unacknowledged after `crisis.escalateAfterMinutes` (default 15): a clinic's alert goes to its other clinicians and managers, then the platform; a solo clinician's goes straight to the platform | Nearest colleagues first |
| CR3 | The platform's on-call is every active manager and super admin | No rota exists; a flag nobody set is an empty list |
| CR4 | The minute tick wakes for crisis work through the marker's `crisisDueAt`; the hourly crisis job is the backstop | Escalate within a minute, keep the database asleep |
| CR5 | A higher level inside 10 minutes upgrades the alert, clears the acknowledgement and notifies again; same or lower is deduplicated | A higher level has not been acknowledged |
| CR6 | Egypt's SOS sheet lists the General Secretariat of Mental Health lines as "Mental health support"; 105 is "Health ministry hotline"; 123 and 112 stay | Source research; "نجدة" reads as the police |
| CR7 | A server-rendered `/sos` page lists the numbers as plain links; the orb and footer link to it | The orb needs JavaScript |
| CR8 | The patient's crisis reply is in their language and says the therapist was told only when that is true | It used to claim so to everyone |
| CR9 | "kms" matches only as a whole word, never after a number or before a slash | "I ran 5 kms" must not page anyone |
| CR10 | Proposed: a journal crisis hit raises the same alert as a session (email, then practice, then platform), one per clinician holding a live grant; with no grant holder it goes straight to the platform on-call. The patient is still told nothing about it (C123) | Journal hits never left the app |
| CR11 | Proposed: when every out-of-band send to the clinician fails (5 attempts), the alert escalates at once and the failure is shown on `/admin/errors`; so is a stage that emailed nobody | Spent retries used to wait silently for the deadline |
| CR12 | Proposed: only the treating clinician, a clinician (role `therapist`) in the same practice, or the platform on-call (manager, super admin) may acknowledge. `staff` may not. There is no clinical or on-call staff role, so the on-call list is the one CR3 already uses | An acknowledgement stops every escalation |
| CR13 | Proposed: a patient who paused AI is not transcribed; the room shows "Live risk detection is off" and the session keeps `live_risk_off_at` | Pausing AI silently turned off crisis detection |
| CR14 | Proposed: no copy calls the radar a crisis service ("Crisis Radar" is now "Radar"); `/sos` says 24Therapy is not an emergency service; 105's hours are shown as "check hours" until confirmed; "works with no SIM" is gone | There is no 24/7 staffing behind the word "crisis" |
| CR15 | Proposed, needs clinician review: break-glass for a journal alert no clinician can act on (no grant holder, or it reached the platform). A manager or super admin on-call gives a reason on the alert page; one `phi_access` audit row (`break_glass.crisis_contact`) is written, and for 15 minutes the page shows the person's name, phone, email and the journal words that raised it, with a link to the `/sos` numbers. The on-call decides whether to call, and records it on the alert by acknowledging | The on-call was told about a person they had no way to reach (F-CR4) |
| CR16 | Proposed, needs clinician review: a first-person phrase ("I wanted to die", "كنت بفكر اموت نفسي") alerts even when the sentence puts it in the past or says it is over. Past and resolved still quiet only a phrase that names nobody ("suicidal", "self-harm"). "كنت", "ايام", "used to", "انتهت", "تجاوزت", "no longer feel" are no longer read as past or resolved | Those words hid live disclosures; a clinician reading a past attempt is not a harm |
| CR17 | Proposed, needs clinician review: in a live session, a question from an unlabelled speaker is scanned unless its crisis words point at "you" ("kill yourself", "تنتحر", "نفسك"). "Do you have thoughts of suicide?" alerts when the speaker is unknown and is quiet only when labelled the therapist's | "Do you ever just want to die?" is often the patient's own |

## Sign-up and security

| ID | Decision | Why |
| --- | --- | --- |
| DD1 | Patient and clinician signup require a ticked notice naming OpenAI, Daily, Resend, Neon and Vercel (United States), and since terms version 2026-10-02 Recall.ai, WhatsApp (Meta) and Paymob; the version and time are stored | Proof of what each person agreed to |
| DD2 | The age gate is an "I am 18 or older" box; refusal shows help lines (Egypt Child Helpline 16000, ambulance 123) | A date of birth is data we cannot check |
| DD7 | Clinician signup answers "check your inbox" for new and registered addresses alike | No account enumeration |
| N38 | Clinician password resets: at most 3 an hour per address and network, and one email per address every 2 minutes (replaces the per-address limit in DD8) | A stranger cannot use up the owner's resets |
| DD8 | The reset form's token check is limited to 10 per 15 minutes | Token guessing |
| DD9 | drizzle-orm stays on 0.38 for now | From 0.44 query errors carry SQL parameters into logs |
| DD10, DD11 | Signed-out visitors see slot times in Cairo time when their country is Egypt or unknown; country comes from `x-vercel-ip-country`, default Egypt | Headless browsers report UTC |
| DD13 | Patient-facing errors on pay, join, booking, claim, sign-up, sign-in, account and feedback are bilingual | They were English under Arabic forms |
| B2.2 | Proposed. Every password door (clinician, staff, patient, company, clinic, partner) locks after 5 tries in 15 minutes per account as well as per network; patient sign-in codes after 10 tries an hour per account. Codes and reset codes sent: 5 an hour per handle and network, and the form says so when that is reached. A proved code or a reset clears the password count. Reset guesses: 10 an hour per account and network under 30 an hour per account. Unknown addresses count the same way and no message says whether an account exists | Per-network limits need only many networks, and per-account limits alone let a stranger keep a patient locked out |
| B2.3 | Proposed. The staff console requires an authenticator app; the emailed code is not a second step. A member without an app enrols on the second step page after six digits emailed to their own address prove the inbox, so a password alone never reaches the QR code. An owner resets another member's app from Team; a sole super_admin's way back is the audited break glass `factor:reset` (F-2FA-STAFF) | An inbox is not a second factor, and a stolen password must not plant an app |
| B2.4 | Proposed. Clinicians, clinic managers and partner users may add an authenticator app, after typing their password again; once on, every sign-in asks for it. A super_admin or manager resets it from Sign-in security in the console, audited. Optional until F-MFA is ruled | No second factor outside the back office, and a lost phone needs a way back |
| B2.5 | Proposed. The idle timeout counts a person's own requests only; polls, refreshes, prefetches and the radar ping do not. A session in progress keeps its clinician signed in; the note editor only while they type | An unattended screen stayed signed in for 8 hours |
| B1-6 | Proposed. A clinician confirms the patient is 18 or over (stored with who and when) when adding a chart, starting a session, or in the room. Nothing is recorded, transcribed or sent to the meeting bot without a confirmation on the session, its chart or the patient's own account. A recording yes given before the confirmation sends the meeting bot once the clinician confirms, and the room says the bot waits. Under 18 is refused; there is no guardian model | Only self-signup had an age check |
| FB1 | Proposed. No one under 18 on 24Therapy until counsel and a clinician design consent through a parent or guardian; the refusal (B1-6) stands until then. A clinician reviews the refusal wording | Clinical and legal |
| FB5 | Proposed. Partner media transcription (`lib/partner/media.ts`) carries no 18+ check of ours today; partners confirm in their agreement that every subject they send is 18 or over, and a later API version requires an `adult_confirmed` field on the consent call before any audio is transcribed | A contract term now, an API change for every integrator later |
| F-MFA | Proposed. Make the authenticator app mandatory for clinicians (they read clinical records), and later for clinic managers and partner admins, after a notice period; patients and companies stay optional (B2.4) | A lost phone then needs a recovery path we staff |
| F-2FA-STAFF | Proposed. The break glass `npm run on:production -- factor:reset -- <email>` (typed production confirmation, audited) is run only by the founder, only for a super_admin who lost the phone and the recovery codes, and each use is noted here with the date (B2.3) | Who may hold that power |
| F-ROLE | Proposed. Run the app as a restricted Postgres role `app_rw` (SELECT, INSERT, UPDATE, DELETE on tables, USAGE on sequences; INSERT and SELECT only on `audit_log`, no TRUNCATE); keep the owner role for `db:migrate` only; point Vercel's `DATABASE_URL` at `app_rw`. Until then the owner role the app uses can DROP or DISABLE the audit and ledger triggers (0184, 0188, 0189) | Neon roles, secrets and a deploy only the founder can make |

## Needs the founder

Open items as of 2026-10-01, most urgent first.

| ID | What | Why it waits for you |
| --- | --- | --- |
| F-CR1, F-CR5, F-CR7 | A native Arabic-speaking clinician reviews the crisis phrase list (`lib/crisis/alerts.ts`, `lib/crisis/context.ts`) and the crisis and live-risk wording in both languages (CR10 to CR17), and accepts or changes the known false alarms CR16 and CR17 keep (idioms such as "my boss will kill me", news or study mentions, a past attempt said to be over) | Only a clinician can say it is complete and safe |
| F-CR4 | The 24/7 position: staff an on-call rota, or accept that the last stage (managers and super admins, by email) is best effort and keep "crisis" out of all positioning (CR14). Also who acts on a journal alert no clinician holds a grant for, through the break glass (CR15) | Staffing and clinical responsibility |
| F-ENG | A human engineer with merge authority, and GitHub branch protection on `main`: require both CI jobs ("Static checks" and "Database checks") and a human reviewer's approval | Only the repository owner can set protection; no human reads the code today |
| F-DNS | Move the DMARC record for 24therapy.app from `p=none` to `p=quarantine` before 2026-10-06; `verify:email-dns` fails in CI from that date | Only the domain owner can edit DNS |
| FC4 | Create a second staff account, or turn off "Transfer, approve and send by different people" in Rules knowingly; with one account the payout queue is blocked | A staffing and money control decision |
| Q, F1, F9, FD2, FC2 | Counsel: Law 151/2020 and hosting outside Egypt; whether holding patient and company money needs CBE licensing or a licensed PSP's marketplace product; withholding on payouts and top-ups and patient e-receipts; an Arabic privacy notice and terms naming the same processors as signup; the entity's registered name, address and tax number. Also the rest of counsel's list: seller model, VAT scope and threshold, top-up documents, card fee, wallet licence, billing therapists in USD, which licences count, ETA issuer name | Legal |
| F-ROLE | Create the restricted app role and move Vercel's `DATABASE_URL` to it (ruling above) | Neon roles and Vercel secrets |
| F-MON | Choose and pay for an uptime monitor and an error tracker that alert someone who can act at any hour; today only `.github/workflows/uptime.yml` checks the site | A recurring cost and an on-call decision |
| FC3, P | Paymob confirms that `client_reference_id` makes Send idempotent and can look a payout up (`PAYMOB-CONFIRM` in `lib/billing/gateway/paymob.ts`); Paymob keys for cards and payouts; ETA registration with an e-seal and signer | Only Paymob and the company can |
| FC1 and the proposed rulings | Accept, change or reverse: DC1 to DC6, FC4, B1-1 to B1-6, B2.2 to B2.5, CR10 to CR17, FB1, FB2 (in B1-3), FB5, F-MFA, F-2FA-STAFF, F-ROLE | Product, money and clinical rules are yours |
| F-CR3, FD1 | Dial 08008880700, 0220816831, 105 and the Child Helpline 16000 once; confirm 105's days and hours, including Sunday | A number nobody has dialled is a risk |
| F10, FB4 | BAAs and DPAs with Vercel, Neon, OpenAI, Daily, Resend, Recall.ai, Meta and Paymob (needs the US entity) | Contracts and money |
| F2, F-CR2 | Meta approval of the WhatsApp templates, including `crisis_alert` and `crisis_escalated`; then list them in `WHATSAPP_APPROVED_TEMPLATES` | Your Meta account |
| F8 | Name a clinical reviewer to sign the Arabic PHQ-9 and GAD-7 | A qualified person only |
| F7 | Whether production's database stays awake (scale-to-zero off) at a monthly cost | A recurring cost |
| F3, F4, F5 | In `/admin/settings`: the Arabic name on Egypt's regulator line and an Arabic InstaPay note; save the rules once so the start clock is stored; patient bank details if bank transfer beyond InstaPay is wanted | Console login and a real account |
| FD3 | Approve the drizzle-orm 0.45 upgrade plan (DD9) | Changes how every database error is reported |

Done:

| ID | What | When |
| --- | --- | --- |
| F-CRED | The database owner password that sat in public git history: rotated on `main` and dev, Vercel `DATABASE_URL` and `DATABASE_URL_UNPOOLED` updated, the old password refused on production and dev (`docs/OPERATIONS.md`) | 2026-10-01 |
| F-CR6 | "Crisis Radar" and "رادار الأزمات" renamed in the published rows on production (`content:rename`, 8 phrases in 6 rows; a dry run now finds none) | 2026-10-02 |
| FB3 | `/hipaa`, `/privacy`, `/contact` and `/security` re-synced from the code on production (`content:sync`): Recall.ai, WhatsApp and Paymob named, data location stated, no unregistered company; `verify:cms-claims` passes on production | 2026-10-02 |
| F6 | `TOKEN_ENCRYPTION_KEY` set on Vercel production and preview; the only copy belongs in the founder's password manager | 2026-10-01 |
