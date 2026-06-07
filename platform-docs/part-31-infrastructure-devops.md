# Part 31 — Infrastructure & DevOps
AWS Architecture, Kubernetes, CI/CD, Monitoring, Disaster Recovery, Backups, and Multi-Region Strategy

> **Status:** Outlined in PRD — deep technical specification coming in future version. Content synthesized from Part 8 (Enterprise Engineering Infrastructure).

---

## Overview

This section defines the complete infrastructure architecture for 24Therapy.ai — built for scale from day 1, designed to handle 100→100,000 concurrent sessions.

---

## Infrastructure Stack

| Layer | Technology |
|-------|------------|
| CDN / Edge | Cloudflare |
| Load Balancer | AWS ALB |
| API Gateway | Kong / AWS API Gateway |
| Container Orchestration | Kubernetes (EKS) |
| Primary Database | PostgreSQL (AWS RDS) |
| Cache | Redis (ElastiCache) |
| Object Storage | AWS S3 + Cloudflare R2 |
| Message Queue | Apache Kafka / NATS |
| Search | Elasticsearch / pgvector |
| Monitoring | Prometheus + Grafana |
| Error Tracking | Sentry |
| Logging | ELK Stack |
| CI/CD | GitHub Actions |
| IaC | Terraform |

---

## Multi-Region Strategy

### Phase 1 (Launch)
- Primary region: AWS eu-west-1 (Dublin) — covers MENA + Europe
- Backup: AWS me-south-1 (Bahrain)

### Phase 2 (Scale)
- Add AWS us-east-1 (US expansion)
- Global load balancing (Cloudflare)
- Data residency controls per organization

---

## Kubernetes Architecture

### Namespaces
- `production`
- `staging`
- `development`
- `monitoring`
- `ingress`

### Core Deployments
- api-gateway
- auth-service
- session-service
- ai-scribe-service
- transcript-service
- patient-service
- therapist-service
- notification-service
- billing-service
- radar-service
- websocket-service
- admin-service

### Scaling Targets

| Stage | Concurrent Sessions | Therapists |
|-------|--------------------|-|
| Launch | 100 | 500 |
| 6 months | 1,000 | 5,000 |
| 12 months | 10,000 | 50,000 |
| 24 months | 100,000 | 500,000 |

---

## CI/CD Pipeline

```
Developer pushes code
 ↓ GitHub Actions triggers
 ↓ Lint + TypeScript check
 ↓ Unit tests
 ↓ Integration tests
 ↓ Security scan (Snyk)
 ↓ Docker build
 ↓ Push to ECR
 ↓ Deploy to staging
 ↓ E2E tests
 ↓ Deploy to production (canary)
 ↓ Monitor (5 minutes)
 ↓ Full rollout or rollback
```

---

## Disaster Recovery

| Metric | Target |
|--------|--------|
| RPO (Recovery Point Objective) | < 15 minutes |
| RTO (Recovery Time Objective) | < 1 hour |
| Database backup frequency | Every 15 minutes |
| Database backup retention | 90 days |
| Recording retention | Configurable per org |
| Audit log retention | 7 years (HIPAA) |

---

## Security Infrastructure

- All data encrypted at rest (AES-256)
- All data encrypted in transit (TLS 1.3)
- End-to-end encryption for recordings
- WAF (Web Application Firewall) via Cloudflare
- DDoS protection
- Penetration testing (annual)
- Vulnerability scanning (continuous)
- SOC 2 Type II (target within 18 months)

---

*Full infrastructure diagrams, Terraform modules, Kubernetes manifests, and runbooks to be completed in a future PRD version.*
