# Founder decisions, 24 September 2026

These are the rulings on the fourteen open questions from the live walkthrough.
Where a ruling is still waiting for tax counsel, it says so.

**Rule for every tax and document decision: it must be reversible.** Each one is
a setting in `/admin/settings`, never a constant in code. A change applies to
money from that moment on and never rewrites a past invoice, payout or ledger
entry. If counsel says something different in a few days, we change the
setting, not the code.

## Ruled

| # | Decision | Ruling |
|---|---|---|
| 1 | Who sells the session | **We are the agent.** The therapist sells the session to the patient; we take our fee. Kept as a setting. |
| 2 | VAT on the session price | **0% for patients.** Healthcare is exempt (VAT Law 67/2016, exempt list item 39). Every therapist on the platform is a verified, licensed clinician; there is no unlicensed tier and there never will be. The 14% line the patient sees today goes away. The rate stays a setting. |
| 4 | Company top-up documents | **B now:** our document becomes a payment receipt and the ETA invoice is the only invoice. **C later** (deposit on top-up, one ETA invoice a month for what was spent) once counsel rules. Both are built behind a setting. |
| 5 | In-person sessions | **Free to the patient through us.** The therapist starts an in-person session inside their own practice for a patient who walked in and most likely paid them in cash. We do not care how that patient paid. The therapist confirms the patient's consent and the recording. The therapist pays us the session fee ($1) and the AI fee ($3, only when the patient said yes to AI), or nothing extra on a subscription that covers them. A pay-as-you-go therapist is told before starting: "this costs $1, and AI adds $3, on your bill after the session." |
| 5a | Where our 15% applies | **Only on paid online sessions booked through us:** a paid invite link, a radar session, or a future booking. A pay-as-you-go therapist also pays the $1 + $3 on those. |
| 6 | Session length | **One length: 50 minutes. One price, set by the therapist**, for radar, future bookings and invite links alike. The "30 minutes" in the current copy is left over from an old build and is wrong. |
| 7 | Patient credits | **A wallet on the patient's profile.** It is spent automatically on the next booking or radar session. When a radar therapist does not show and the patient ends up with a cheaper therapist, the difference goes into the wallet. It cannot be topped up. When it is empty the wallet is collapsed, not shown as zero. |
| 9 | Bank details | **Leave as they are.** Production has no real users; the example IBAN is part of testing. |
| 10 | Operator EGP rate | **Stays at 50.** An admin can change it by hand as often as needed. |
| 11 | ETA registration | **Build the foundation so it can be wired up** when registration, the e-seal and the signing provider exist. Counsel first. |
| 12 | Card gateway | **Paymob.** The patient pays the Paymob fee. It shows on the patient's price where the VAT line used to be. |
| 13 | Payouts provider | **Paymob too**, ready for the keys. Four eyes still apply before any send. |
| 14a | Production demo data | **Full freedom.** Delete, reseed, edit or add to it. Production has no real people and will not for a while. Keep demo logins for every user type so the new design can be tested live on production. |
| 14b | Fewer navigation pages | **Yes**, provided every feature is proven still reachable and clickable after the change. |

## Pending, waiting for counsel

| # | Decision | Status |
|---|---|---|
| 3 | Withholding tax on therapist payouts | **Not ruled.** Built as a setting at 0% with the options ready (0%, 3% services, 5% commissions). Nothing is deducted until it is ruled. |
| 3a | Tax a company withholds from its top-up | **Not ruled.** A field to record it on top-up confirmation will be built, off by default. |
| 4C | Top-up as a deposit with a monthly invoice | Built behind a setting. The setting stays on B until counsel rules. |
| 11 | ETA live keys, e-seal, signing provider | Waiting for registration. |

## Correction on record

The earlier decision table offered a VAT option for "unlicensed coaches". That
was wrong. Verification of licence is a hard gate in the code
(`requireVerified`, `isVerifiedClinician` in `lib/data/radar.ts`), and only
licensed clinicians practise on the platform.
