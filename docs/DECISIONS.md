# Founder decisions

Rulings from 24 September 2026, rounds one and two. Where a ruling is still
waiting for counsel or an accountant, it says so. The long-term list of
everything waiting on someone is `docs/LONG-TERM.md`.

## The rule above every ruling: nothing is set in stone

Every tax, document, provider, fee, timing and approval rule is a **setting in
`/admin/settings`**, never a constant in code. This matters because the legal
entity, the accountant and counsel may change any of these after the fact.

- A change applies to money from that moment on. It never rewrites a past
  invoice, payout, receipt or ledger entry.
- Every change is audited with its old and new value, who made it and when.
- Provider names (card gateway, payouts, ETA signer) are settings. Their keys
  and secrets stay in the environment and never in the repository.
- What each user type sees and pays follows from settings, so a different rule
  per user type is a settings change, not a rebuild.

## Ruled

| # | Decision | Ruling |
|---|---|---|
| 1 | Who sells the session | **We are the agent.** The therapist sells; we take our fee. A setting. |
| 2 | VAT on the session price | **0% for patients.** Healthcare is exempt (VAT Law 67/2016, exempt list item 39). Only verified, licensed clinicians practise here; there is no unlicensed tier. The rate is a setting. |
| 4 | Company top-up documents | **B now:** our document is a payment receipt, the ETA invoice is the only invoice. **C** (deposit on top-up, one ETA invoice a month for what was spent) is built behind the same setting. |
| 5 | In-person session, patient paid the therapist directly | **Cash: free through us.** The therapist confirms the patient's consent and the recording. A pay-as-you-go therapist pays $1 (session) and $3 (AI, only if the patient said yes), told before starting; a subscription covers both. No 15%. |
| 5b | In-person session, patient pays through 24Therapy | The therapist can charge an in-person session through us, exactly like a paid online session: our 15% applies, the company benefit can cover it, and a pay-as-you-go therapist also pays $1 + $3. **Pay before start (25 September): no priced session ever starts unpaid.** The patient pays on their own phone from a QR code; Start unlocks when paid. Design and closed loopholes in `docs/IN-PERSON-PAID.md`. |
| 5c | In-person bookings | **New in round two.** A therapist chooses whether bookings can be in person, online, or both, and adds a practice address for in person. Patients can filter for in person on the radar and see it on the profile. Booked in-person sessions are paid in advance like online ones. |
| 5d | Where our 15% applies | On every session paid **through us**: paid invite link, radar, future booking, and an in-person session the patient pays through us. Never on cash. |
| 6 | Session length | **One length, 50 minutes, one price set by the therapist**, for every kind of session. The "30 minutes", "half hour" and "one hour" wording is left over and is wrong. The length is a setting. |
| 7 | Patient credits | **A wallet on the patient's profile.** Spent automatically on the next booking or radar session. A no-show radar therapist replaced by a cheaper one puts the difference in the wallet. No top-up. Collapsed when empty, never shown as zero. |
| 8 | Language | **Revised in round two.** Patients and therapists choose their language in settings, and every message we send them uses it. |
| 8b | Patient profile page | **New in round two.** The patient's "You" page becomes a real profile: their summary, each session's summary, tabs for billing and past sessions, an employer badge (or an Enrol button), future bookings, sessions live now and sessions starting in N minutes, hours or days. Editing anything lives under settings on that page, including the language. |
| 9 | Bank details | **Leave as they are.** Production has no real users. |
| 10 | Operator EGP rate | **Stays at 50**, changed by an admin by hand as often as needed. |
| 11 | ETA | **Build the foundation**, wired up when registration, the e-seal and the signing provider exist. |
| 12 | Card gateway | **Paymob.** The patient pays the Paymob fee, shown where the VAT line used to be. |
| 13 | Two-person approval | **Revised in round two.** No two-person rule on payouts, company top-up confirmations, therapist verifications, or anything urgent. Refunds may keep it. Each one is a separate switch in settings. |
| 13b | Payouts provider | **Paymob**, ready for the keys. |
| 14a | Production demo data | **Full freedom** to delete, reseed, edit or add. Keep logins for every user type. |
| 14b | Fewer navigation pages | **Yes**, with proof every feature is still reachable and clickable. |

## Pending

| # | Decision | Status |
|---|---|---|
| 3 | Withholding on therapist payouts, and tax a company withholds from its top-up | **Waiting for counsel.** A setting at 0%; nothing is deducted until it is ruled. |
| 4C | Top-up as a deposit with a monthly invoice | Built behind a setting, left on B until counsel rules. |
| 11 | ETA live keys, e-seal, signing provider | Waiting for registration. |
| 6b | Does the 50 minutes include the 10-minute countdown? | Recommended: yes, 50 in total, bookings on the hour with a 10-minute gap. A setting. |
| 5e | New therapist from a patient QR waits for verification before the first session | Recommended: yes. |

## Correction on record

The first decision table offered a VAT option for "unlicensed coaches". That
was wrong. Licence verification is a hard gate in the code
(`requireVerified`, `isVerifiedClinician`), and only licensed clinicians
practise on the platform.

The earlier founder ruling "four eyes for payouts, refunds and verifications"
is replaced by ruling 13 above.
