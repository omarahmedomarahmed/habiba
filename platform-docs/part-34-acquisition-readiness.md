# Part 34 — Acquisition Readiness Blueprint
Building the company so a future acquirer can integrate technology, evaluate security, migrate customers, and buy infrastructure/APIs/datasets/marketplace

> **Status:** Outlined in PRD — detailed blueprint coming in future version. Content synthesized from Parts 5, 8, and 17.

---

## Overview

Every decision made in building 24Therapy should make the company easier to acquire at the right moment.

This requires thinking like a buyer from day 1.

---

## What Acquirers Want

### Technical Assets
- [ ] Clean, documented codebase
- [ ] API-first architecture (everything accessible via API)
- [ ] Complete data model documentation
- [ ] Security audit history
- [ ] SOC 2 Type II certification
- [ ] HIPAA compliance documentation
- [ ] No vendor lock-in at infrastructure layer
- [ ] Containerized, cloud-agnostic deployment

### Commercial Assets
- [ ] Recurring revenue with high retention
- [ ] Documented CAC and LTV by segment
- [ ] Therapist relationships (contracts, not just signups)
- [ ] Enterprise customer contracts
- [ ] Validated unit economics at scale

### Data Assets
- [ ] Structured mental health memory archive
- [ ] Outcome tracking datasets
- [ ] Assessment benchmark data
- [ ] Anonymization infrastructure in place
- [ ] Data governance framework documented

### Platform Assets
- [ ] Marketplace with real network effects
- [ ] Developer ecosystem (API customers)
- [ ] White label deployments
- [ ] Integration partnerships (EHRs, billing)

---

## Technology Integration Readiness

### For Acquirer Due Diligence
1. **Codebase audit** — Clean TypeScript, documented APIs, test coverage >70%
2. **Database documentation** — Full ERD, migration history, data dictionary
3. **Security audit** — Annual pen test, vulnerability history
4. **Infrastructure audit** — Cost structure, scaling evidence

### Migration Capabilities
- Customer data export in standard formats (JSON, HL7 FHIR)
- API migration tools for customers
- White-label customer rebrand toolkit
- Therapist credential portability

---

## Build Decisions That Aid Acquisition

| Decision | Why It Matters to Acquirers |
|----------|----------------------------|
| Multi-tenant architecture | Easier to white-label segments |
| Event-driven design | Easy to integrate into existing systems |
| Open API standards | FHIR-compatible data exchange |
| Standard auth (OAuth/SAML) | Easy SSO integration |
| Modular microservices | Acquirer can take specific components |
| Immutable audit logs | Compliance handover is clean |

---

## Acquisition Trigger Points

| Milestone | Makes Acquisition Attractive |
|-----------|------------------------------|
| 1,000 therapists | Proves product-market fit |
| 10,000 therapists | Proves scalable acquisition |
| $1M ARR | Proves monetization |
| $10M ARR | Proves scale |
| 10M sessions processed | Proves data moat |
| Hospital/enterprise contracts | Proves enterprise capability |

---

*Full acquisition playbook with legal checklist, data room structure, and integration architecture to be completed in a future version.*
