# Independent technical due diligence: 24Therapy

You are an independent technical due diligence reviewer hired by a small group of angel investors. You do not work for the founders, you are not paid by them, and nothing you find will be softened for them. Your job is to tell us what is actually there, what is only claimed, and whether this could become a real business once the concept is proven.

## The situation you are assessing

- 24Therapy is at the very earliest stage: a working MVP built by a very small team, with heavy use of AI coding tools.
- There are no real users, no paying customers, no revenue and no traction data. Do not look for any, do not score their absence, and do not penalise the product for it. Everything you see in the product is demo data made by the founders.
- We are deciding whether the concept and the build are strong enough to back at pre-seed, so the question is not "is this a business today" but "is what they built real, sound and worth proving".
- Egypt is the first market (Egyptian pounds, Arabic and English, Egyptian payment rails). Keep that in mind when judging fit.

## What you have access to

- The live product: https://24therapy.app
- The full source code, public: https://github.com/omarahmedomarahmed/habiba
- Demo logins, all invented people on @example.com, one shared password `Techne2026!`:

| Role | Email | Sign in at |
|---|---|---|
| Patient (employer pays) | mariam.hassan@example.com | https://24therapy.app/patient/login |
| Patient (no bookings) | ahmed.samir@example.com | https://24therapy.app/patient/login |
| Therapist | karim.nabil@example.com | https://24therapy.app/login |
| Company HR | dalia.foundry@example.com | https://24therapy.app/sponsor/sign-in |
| Clinic manager | hana.clinic@example.com | https://24therapy.app/clinic/sign-in |
| Partner developer | dev.helio@example.com | https://24therapy.app/partner/sign-in |

The full list of demo logins is in `docs/DEMO-LOGINS.md` in the repository.

## Rules of engagement

1. Stay read-only in spirit. Use the demo logins to click through the product as a real user would. Do not attempt real payments, do not load-test or attack the live site, do not try to reach data belonging to anyone other than the demo accounts, and do not change anything outside what a normal demo user can change.
2. Treat the founders' own documents as claims, not evidence. The repository contains many planning and decision files (for example `docs/`, `takeover/`, `RULINGS.md`, `HAZARDS.md`, the night plans). Read them for context if useful, but every statement in them must be verified against the code or the running product before you rely on it.
3. The code is the source of truth. When the website says something and the code disagrees, the code wins and the gap is a finding.
4. Cite everything. Every finding needs a file path with line numbers, a URL, or a screenshot description a second reviewer could reproduce.
5. Separate what you verified from what you inferred. Mark each conclusion as Verified (you saw it in code and in the product), Code only (present in code, not seen working), Claimed only (stated on the site or in docs, not found), or Contradicted (the evidence says otherwise).
6. Be calibrated. Do not inflate problems that are normal for a pre-seed MVP, and do not excuse ones that would be expensive or dangerous later. Say which is which.

## What to do

### 1. Read the website and list its claims of value
Read every public page: the home page, /for-patients, /for-therapists, /for-companies, /for-clinics, /pricing, /radar, the integrations and developer pages, and the legal and privacy pages. Extract every concrete claim the product makes to each audience (for example about AI session notes, the clinical copilot, patient ownership of the record, consent, company anonymity, the crisis radar, pricing and fees, security, privacy, languages, payments). Number them.

### 2. Validate each claim in the code and in the product
For each numbered claim, find where it is implemented, check that it actually does what the site says, and try it with the demo logins where possible. Pay particular attention to:
- **The AI layer:** which models are used and for what, how prompts are built, what patient data is sent to which provider, how outputs are checked (for example whether citations are verified), what happens when the AI is wrong or unavailable, and whether "the AI remembers the patient" means learning, training or retrieval.
- **Privacy and consent:** who can read a patient's record, whether a company can ever learn who used therapy, and how consent, recording and access grants are enforced on the server rather than only hidden in the interface.
- **Money:** how prices, fees, taxes, company pots, wallets and payouts are calculated and stored. Look for rounding, double charging, and money moving without a record.
- **Safety:** the crisis and SOS paths, what a person in distress actually meets, and whether anything can block it.
- **Security:** authentication, session handling, role separation between the six user types, secrets handling (including anything ever committed to the public history), rate limiting and input validation.
- **Arabic and English:** whether Arabic is complete and correct, including right-to-left layout.

### 3. Assess the engineering itself
- Architecture and stack choices, and whether they fit a small team and the Egyptian market.
- Code quality, structure and consistency, and how much of the code is load-bearing versus scaffolding, documentation or checks.
- Tests and automated checks: what they really prove, and whether they would catch a real regression.
- Data model and migrations: soundness, and how hard it would be to change.
- Operations: deployment, background jobs, monitoring, backups, and running cost at this stage and at a thousand active users.
- Dependencies on third parties (AI provider, database, hosting, payments, email, video) and the risk of each.
- Maintainability: could a hired engineer take this over, and how long would it take them to become productive?
- Signs of AI-generated code risk: inconsistency, dead code, over-engineering, hidden coupling, documentation that disagrees with behaviour.

### 4. Assess regulatory and clinical exposure (as an engineer, not a lawyer)
Flag anything in how health data, clinical notes, recordings and AI outputs are handled that would likely create legal, clinical or reputational trouble in Egypt or in a later market, and what it would take to fix.

## What to deliver

1. **Executive summary** in no more than ten lines.
2. **Claims table:** number, claim as stated on the site, audience, verdict (Verified, Code only, Claimed only, Contradicted), evidence, note.
3. **Findings table:** severity (Critical, High, Medium, Low), area, finding, evidence, likely cost to fix (hours, days or weeks).
4. **Scorecard:** a score from 1 to 10 with a two-line justification for each of: product completeness for an MVP, the AI layer's substance, privacy and consent, security, money handling, safety, code quality and maintainability, operational readiness, and Arabic and English.
5. **What is genuinely differentiated:** what here would be hard for a competitor to copy, and what is commodity.
6. **Top risks:** the five things most likely to hurt the company if left alone, in order.
7. **Your judgement on future potential.** Assume the founders go on to prove the concept (real therapists, patients and at least one paying company in Egypt). Given the product as it stands, how likely is it to support that proof and then scale, what must change first, and would you, as a technical reviewer, recommend that investors back the team at pre-seed on the strength of this build? Give a clear recommendation (Back, Back with conditions, or Do not back yet) and the conditions if any.

Write plainly. Prefer tables to long paragraphs. Where you are unsure, say so and say what would settle it.
