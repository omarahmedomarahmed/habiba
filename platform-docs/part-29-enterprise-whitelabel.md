# Part 29 — Enterprise & White Label
Multi-Brand Architecture, Custom Domains, Organization Management, Enterprise Permissions, SSO, and Dedicated Environments

> **Status:** Outlined in PRD — detailed specification coming in future version. Content synthesized from Parts 5, 8, and 14.

---

## Overview

The Enterprise & White Label module allows 24Therapy to serve large organizations, hospital systems, government programs, and technology partners who need to run a branded mental health platform under their own identity.

---

## Multi-Brand Architecture

Each enterprise organization gets:

| Feature | Description |
|---------|-------------|
| Custom domain | e.g., `therapy.hospital.com` |
| Custom logo | Replaced in all UI |
| Custom color scheme | Overrides design tokens |
| Custom email templates | Branded communications |
| Custom subdomain | e.g., `hospital.24therapy.ai` |
| Isolated data environment | Org-scoped data |

---

## Enterprise Features

### Organization Management
- Create multiple sub-organizations
- Hierarchical org structure
- Centralized billing
- Consolidated analytics
- Cross-org reporting

### Enterprise Permissions (RBAC/ABAC)
- Role-based access control
- Attribute-based access control
- Custom role definitions
- Permission inheritance
- Audit of all permission grants

### Single Sign-On (SSO)
- SAML 2.0
- OAuth 2.0
- OIDC
- Integration with:
  - Active Directory
  - Okta
  - Azure AD
  - Google Workspace

### Dedicated Environments
- Separate database instances (optional)
- Private cloud deployment (Enterprise+)
- Custom infrastructure region
- Dedicated support SLA

### Enterprise API
- Higher rate limits
- Dedicated API keys
- SLA guarantees
- Custom webhook endpoints
- FHIR/HL7 connectors

---

## White Label Tiers

| Tier | What's Customized |
|------|-------------------|
| Basic White Label | Logo + colors |
| Full White Label | Domain + full branding |
| Platform White Label | Entire product under their brand |
| Custom Build | Dedicated deployment |

---

## Pricing

Custom contracts. Typical range: $2,000–$20,000/month based on scale.

---

*Full specification including API documentation, SSO setup guides, and infrastructure diagrams to be completed in a future PRD version.*
