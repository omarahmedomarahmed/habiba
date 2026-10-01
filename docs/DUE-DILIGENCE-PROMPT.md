# Independent technical due diligence: 24Therapy

You are an independent technical due diligence reviewer hired by a small group of angel investors. You do not work for the founders, you are not paid by them, and nothing you find will be softened for them. Tell us what is actually there, what is only claimed, and whether this could become a real business once the concept is proven.

## The situation

- 24Therapy is a very early MVP built by a very small team, mostly by AI coding agents working under the founder's direction.
- There are no real users, no paying customers, no revenue and no traction data. Do not look for any, do not score their absence, and do not penalise the product for it. Everything in the product is demo data made by the founders.
- The question is whether the build is real, sound and worth proving at pre-seed. Egypt is the first market (Egyptian pounds, Arabic and English, Egyptian payment rails).

## How to approach it

Start from nothing. You have no earlier report, notes or conclusions to rely on, and you should not look for any: form every judgement yourself from the code and the running product.

## What you have access to

- The live product: https://24therapy.app
- The full source code, public: https://github.com/omarahmedomarahmed/habiba (its pull requests and Actions runs are public too)
- Demo logins, all invented people on @example.com, one shared password `Techne2026!`:

| Role | Email | Sign in at |
|---|---|---|
| Patient (employer pays) | mariam.hassan@example.com | https://24therapy.app/patient/login |
| Patient (no bookings) | ahmed.samir@example.com | https://24therapy.app/patient/login |
| Therapist | karim.nabil@example.com | https://24therapy.app/login |
| Therapist (Alexandria) | rania.khalil@example.com | https://24therapy.app/login |
| Company HR | dalia.foundry@example.com | https://24therapy.app/sponsor/sign-in |
| Clinic manager | hana.clinic@example.com | https://24therapy.app/clinic/sign-in |
| Partner developer | dev.helio@example.com | https://24therapy.app/partner/sign-in |

The full list is in the repository's demo documentation.

## Rules of engagement

1. Read-only in spirit. Use the demo logins as a real user would. No real payments, no load testing or attacks on the live site, no attempt to reach anything outside the demo accounts, nothing changed beyond what a normal demo user can change.
2. The founders' documents (README, `docs/`, `CLAUDE.md`, pull request descriptions, the decision log, AI review comments on pull requests) are claims, not evidence. Verify every one against the code or the running product before relying on it.
3. The code is the source of truth. Where the website, the docs or a pull request description disagree with the code, the code wins and the gap is a finding.
4. Cite everything: file path and line numbers, URL, pull request or Actions run, or a screenshot description another reviewer could reproduce.
5. Mark each conclusion Verified (seen in code and product), Code only, Claimed only, or Contradicted.
6. Be calibrated. Do not inflate what is normal for a pre-seed MVP; do not excuse what will be expensive or dangerous later. Say which is which.
7. On process: the repository uses pull requests, a GitHub Actions CI and AI code reviews that are labelled as AI. Judge that honestly: what it does and does not protect against, and whether any human is in the loop.

## What to do

1. **Claims.** Read every public page in English and Arabic (home, /for-patients, /for-therapists, /for-companies, /for-clinics, /pricing, /features, /radar, /sos, /integrations, /developers, /privacy, /terms, /hipaa, /security, /contact). List every concrete claim and validate each against code and product.
2. **Review the product.** Review the AI layer, privacy and consent, money, safety, security, Arabic and English, engineering quality, tests and CI, operations and cost, and regulatory and clinical exposure in Egypt.
3. **Recent changes.** The git history shows many recent changes; look specifically for problems they introduced, for example in crisis escalation, company ledger aggregation, partner launch scope, private file storage, signup consent and the age check, session timeouts, the audit log trigger, password reset limits, and the map and country lists.

## What to deliver

1. Executive summary, at most ten lines.
2. Claims table: number, claim as stated, audience, verdict, evidence, note.
3. Findings table: severity (Critical, High, Medium, Low), area, finding, evidence, likely cost to fix.
4. Scorecard from 1 to 10, each with a two-line justification, for: product completeness for an MVP, the AI layer's substance, privacy and consent, security, money handling, safety, code quality and maintainability, operational readiness, and Arabic and English.
5. What is genuinely differentiated, and what is commodity.
6. The five things most likely to hurt the company if left alone, in order.
7. Your judgement on future potential: assuming the founders prove the concept in Egypt (real therapists, patients and at least one paying company), how likely is this build to support that proof and then scale, what must change first, and would you recommend investors back the team at pre-seed on the strength of this build. Give a clear recommendation (Back, Back with conditions, Do not back yet) and the conditions.

Write plainly. Prefer tables to long paragraphs. Where you are unsure, say so and say what would settle it.
