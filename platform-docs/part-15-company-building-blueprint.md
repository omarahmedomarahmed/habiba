# Part 15 — Company Building Blueprint
MVP Definition, Hiring Plan, Budget Allocation, Go-To-Market Strategy, and Fundraising Framework

> **Note:** This section was outlined in the README (lines 9395–9416) but not yet fully written. This document captures what was specified in the outline and synthesizes context from throughout the full PRD.

---

## Overview

This section defines the operational blueprint for building 24Therapy.ai from zero to first revenue.

Key questions answered:
- What is the true MVP?
- Who do you hire first?
- How much does it cost?
- How do you acquire the first customers?
- How do you raise the first round?

---

## MVP Definition

### What the MVP Is NOT
- The full 12-system platform
- A complete patient portal
- A complete admin platform
- White labeling
- FHIR integrations

### What the MVP IS

**The Minimum Lovable Product for therapists:**

1. **AI Scribe** — Realtime transcription + SOAP/DAP/BIRP note generation
2. **Patient Records** — Basic patient management (create/view/update)
3. **Session Management** — Schedule, start, complete sessions
4. **Reports** — Generate and export session reports
5. **Marketplace Profile** — Basic public therapist listing
6. **Radar (Basic)** — Simple instant session matching

**Why this order:**
- AI Scribe = immediate value delivery = retention
- Patient Records = stickiness = switching cost
- Sessions = core workflow = daily use
- Reports = compliance value = professional necessity
- Marketplace = distribution = therapist acquisition
- Radar = network effect ignition

---

## Hiring Plan (Phase 1: 0–$1M ARR)

### Critical Hires (Months 1–3)

| Role | Priority | Why |
|------|----------|-----|
| Full-Stack Engineer #1 | Critical | Build product |
| Full-Stack Engineer #2 | Critical | Build product |
| AI/ML Engineer | Critical | Build scribe + copilot |
| Product Designer | High | Make it beautiful |

### Phase 1 Hires (Months 4–8)

| Role | Priority | Why |
|------|----------|-----|
| Backend Engineer | High | Scale infrastructure |
| DevOps/Infrastructure | High | Reliability |
| Customer Success #1 | High | Therapist retention |
| Sales/GTM #1 | Medium | Therapist acquisition |

### Phase 2 Hires ($1M–$5M ARR)

- Head of Product
- 2× Engineers
- Clinical Advisor (licensed therapist)
- Compliance Officer
- Marketing Lead
- Data Engineer

---

## Budget Allocation (Pre-Revenue)

### Seed Stage Budget (~$500K–$1.5M)

| Category | % | Priority |
|----------|---|----------|
| Engineering (salaries) | 55% | Must |
| Infrastructure (AWS/Vercel/AI APIs) | 15% | Must |
| Design | 10% | High |
| GTM / Marketing | 10% | High |
| Legal (HIPAA, privacy, corp) | 5% | Must |
| Miscellaneous | 5% | — |

### AI Cost Management (Critical)

AI API costs can destroy margins. Controls needed from day 1:
- OpenAI/Anthropic API budget caps
- Per-session cost tracking
- Model selection by task complexity
- Caching for repeated queries
- Cost alerts at 80% budget

---

## Go-To-Market Strategy

### Phase 1: Egypt Launch (Months 1–6)

**Why Egypt first:**
- Founder's network and credibility
- Underserved mental health market
- Lower CAC
- Proof of concept before global

**Channels:**
1. Direct outreach to therapists in Cairo and Alexandria
2. University counseling centers
3. Psychology departments
4. Private practice networks
5. Social media (LinkedIn for therapists, Instagram for patients)

**Target:** 50 therapists, 500 sessions in Month 1

### Phase 2: MENA Expansion (Months 7–18)

**Markets in order:**
1. UAE (Dubai, Abu Dhabi)
2. Saudi Arabia
3. Jordan
4. Lebanon
5. Kuwait

**Channels:**
- Regional therapist associations
- Telehealth conference presence
- PR in healthcare media
- Arabic-language content

### Phase 3: English Markets (Months 18–36)

**Markets:**
- UK (strong private therapy culture)
- Australia
- Canada

---

## Therapist Acquisition Engine

### 5 Core Channels

1. **Direct Outreach** — LinkedIn + email campaigns to licensed therapists
2. **Content Marketing** — Blog posts about documentation burden, AI tools
3. **Referral Program** — "Invite a colleague, get 2 months free"
4. **Community** — Private Facebook/WhatsApp groups for therapists
5. **Events** — Webinars on AI documentation, practice efficiency

### First Session Free Strategy

For patients:
- No credit card required
- Chat with AI first
- First session subsidized to reduce friction
- Leads to subscription or per-session billing

---

## Fundraising Framework

### Pre-Seed (Now → Launch)
- **Amount:** $300K–$800K
- **Source:** Founders, angels, family/friends
- **Use:** Build MVP, reach first 100 therapists
- **Milestone:** $10K MRR

### Seed Round
- **Amount:** $1.5M–$3M
- **Source:** Egyptian/MENA VCs, healthcare angels, global pre-seed funds
- **Use:** Hire team, launch Egypt, reach $100K MRR
- **Milestone:** 500 therapists, 5,000 sessions/month

### Series A
- **Amount:** $8M–$15M
- **Source:** Regional VCs, global healthcare VCs
- **Use:** MENA expansion, AI infrastructure, enterprise sales
- **Milestone:** $1M ARR, multi-country

### Series B+
- **Amount:** $25M+
- **Source:** US/global healthcare investors
- **Use:** US expansion, proprietary models, enterprise
- **Milestone:** $5M+ ARR

---

## Key Success Metrics (Phase 1)

| Metric | Target (Month 6) |
|--------|-----------------|
| Therapists signed up | 200+ |
| Active therapists (weekly) | 50+ |
| Sessions processed | 1,000/month |
| Net Revenue Retention | >100% |
| Therapist NPS | >50 |
| Notes generated | 500/month |
| AI approval rate | >80% |

---

*This section will be expanded in future versions with detailed hiring profiles, financial models, cap table strategy, and due diligence preparation materials.*
