# Independent technical due diligence, second round: 24Therapy

You are an independent technical due diligence reviewer hired by a small group of angel investors. You do not work for the founders, you are not paid by them, and nothing you find will be softened for them. Tell us what is actually there, what is only claimed, what changed since the last review, and whether this could become a real business once the concept is proven.

## The situation

- 24Therapy is a very early MVP built by a very small team, mostly by AI coding agents working under the founder's direction.
- There are no real users, no paying customers, no revenue and no traction data. Do not look for any, do not score their absence, and do not penalise the product for it. Everything in the product is demo data made by the founders.
- The question is whether the build is real, sound and worth proving at pre-seed. Egypt is the first market (Egyptian pounds, Arabic and English, Egyptian payment rails).

## This is a second review

A first independent review was done on 30 September 2026 against commit `56e5b12`. It recommended "Back with conditions". The founders say they have since fixed many of its findings, mainly in pull requests #41 and #42 of the repository. **Do not take that on trust.** For each finding below, check the code and the live product yourself and say whether it is Fixed, Partly fixed, Not fixed, or Made worse, with evidence. Then look for anything new, including problems the fixes themselves introduced.

| ID | Finding in the first review (summary) |
|---|---|
| F1 | AI agents push to production with no CI, no pull requests and no human review |
| F2 | Crisis alerts never leave the app; nobody is paged out of hours |
| F3 | Egyptian health data in the US and with OpenAI, no licence, no required consent at signup, consent screens that do nothing |
| F4 | Public legal and compliance claims that are false or contradict each other |
| F5 | SOS sheet missing the Egyptian mental health lines, needs JavaScript, keyword gaps, deduplication drops upgrades, false "therapist notified" message |
| F6 | A partner API key can mint a clinician session and partners vouch for recording consent |
| F7 | HR sees who enrolled and per-session prices; the anonymity floor counts entries, not people |
| F8 | Books kept in USD cents for an EGP business, no VAT on platform revenue, card and payout rails not live |
| F9 | Clinical files can fall back to public storage |
| F10 | A large AI-written codebase a small team will struggle to own |
| F11 | No age check; licence wording overclaims verification |
| F12 | AI notes not checked claim by claim; copilot and profile read only the start of sessions |
| F13 | Silent AI failures (malformed risk output reads as clean) |
| F14 | No clinician MFA, unrated password reset, signup reveals registered emails, editable audit log, an ORM advisory |
| F15 | Demo data in production, alerting inside the same database, manual migrations, backups |
| F16 | Many tests check source text; no tenancy tests; no row-level security |
| F17 | Visible inconsistencies in the demo |
| F18 | Arabic gaps (English-only errors, raw keys, a misleading clinical string) |
| F19 | AI and video cost per session |
| F20 | A sandbox partner key committed in the docs |
| F21 | Hygiene items (radar times in UTC, country default, dependencies) |

First review's scorecard, for comparison: product completeness 7, AI layer 7, privacy and consent 5, security 7, money 6, safety 4, code quality 6, operational readiness 3, Arabic and English 7.

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
7. On process: the repository now uses pull requests, a GitHub Actions CI and AI code reviews that are labelled as AI. Judge that honestly: what it does and does not protect against, and whether any human is in the loop.

## What to do

1. **Claims.** Read every public page in English and Arabic (home, /for-patients, /for-therapists, /for-companies, /for-clinics, /pricing, /features, /radar, /sos, /integrations, /developers, /privacy, /terms, /hipaa, /security, /contact). List every concrete claim and validate each against code and product.
2. **The first review's findings.** Give each of F1 to F21 a status with evidence.
3. **Fresh look.** Independently of the list, review the AI layer, privacy and consent, money, safety, security, Arabic and English, engineering quality, tests and CI, operations and cost, and regulatory and clinical exposure in Egypt.
4. **Regressions.** Look specifically for problems introduced by the recent fixes (crisis escalation, company ledger aggregation, partner launch scope, private file storage, signup consent and age check, session timeouts, audit log trigger, password reset limits, map and country lists).

## What to deliver

1. Executive summary, at most ten lines.
2. First-review findings table: ID, status (Fixed, Partly fixed, Not fixed, Made worse), evidence, what remains.
3. Claims table: number, claim as stated, audience, verdict, evidence, note.
4. New findings table: severity (Critical, High, Medium, Low), area, finding, evidence, likely cost to fix.
5. Scorecard from 1 to 10 for the same nine areas, each with a two-line justification and the change from the first review.
6. What is genuinely differentiated, and what is commodity.
7. The five things most likely to hurt the company if left alone, in order.
8. Your judgement on future potential: assuming the founders prove the concept in Egypt (real therapists, patients and at least one paying company), how likely is this build to support that proof and then scale, what must change first, and would you recommend investors back the team at pre-seed on the strength of this build. Give a clear recommendation (Back, Back with conditions, Do not back yet) and the conditions.

Write plainly. Prefer tables to long paragraphs. Where you are unsure, say so and say what would settle it.
