# 24Therapy — Incident Response Plan

> HIPAA §164.308(a)(6) — Security Incident Procedures
> Version 1.0 | Effective: 2026-06-13
> Security Officer: [DESIGNATE NAME + EMAIL BEFORE LAUNCH]

---

## 1. Severity Levels

| Level | Description | Response SLA |
|-------|-------------|--------------|
| **P0 — Critical** | PHI breach, total outage, crisis pipeline failure | 15 min |
| **P1 — High** | Partial data exposure, auth bypass, >50% error rate | 1 hr |
| **P2 — Medium** | Single feature outage, elevated errors, billing failure | 4 hr |
| **P3 — Low** | Cosmetic defects, non-PHI data issues | Next business day |

---

## 2. Detection

Incident detection sources:
- **Sentry** — unhandled exceptions, error rate spikes
- **Grafana/Prometheus** — HTTP error rate, DB connection failures, WebSocket drops
- **Railway alerts** — CPU >80%, memory >90%, zero replicas
- **Customer report** — support@24therapy.ai

---

## 3. Escalation Chain

```
On-call engineer
  └─ Security Officer (15 min)
       └─ CEO / Legal (30 min for P0)
            └─ Affected organizations (60 min for P0 PHI breach)
                 └─ HHS OCR (within 60 days if breach confirmed)
```

---

## 4. Response Phases

### 4.1 Identification (0–15 min)
1. Acknowledge alert — confirm it's a real incident, not a false positive.
2. Open incident channel `#incident-YYYYMMDD` in Slack.
3. Assign incident commander.
4. Classify severity (P0–P3).

### 4.2 Containment (15–60 min)
**For PHI breach:**
- Immediately revoke affected tokens: `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id IN (...)`.
- If DB is compromised: snapshot then restore from last known-good backup to isolated instance.
- Disable affected API routes: add IP block at Railway load balancer.
- Preserve all logs — do NOT delete any evidence.

**For auth bypass:**
- Rotate `JWT_SECRET` and `COOKIE_SECRET` via Railway env vars → triggers redeploy (all sessions invalidated).
- Check `phi_access_log` for suspicious access: `SELECT * FROM phi_access_log WHERE accessed_at > NOW() - INTERVAL '24h' ORDER BY accessed_at DESC LIMIT 500`.

**For crisis pipeline failure:**
- Switch to manual crisis protocol: notify all active therapists via Resend emergency template.
- Check WebSocket gateway health: `GET /health`.

### 4.3 Assessment (1–4 hr)
- Determine root cause.
- Identify all affected records: `SELECT DISTINCT patient_id FROM phi_access_log WHERE accessed_at BETWEEN $start AND $end AND actor_id NOT IN (expected_ids)`.
- Determine if PHI was accessed, exfiltrated, or modified.
- Write incident timeline (5-minute granularity).

### 4.4 Recovery
- Deploy patch with fix.
- Restore from backup if data was corrupted.
- Run `node scripts/backup-verify.js` to confirm restore integrity.
- Re-enable disabled routes.
- Monitor for 2 hrs after recovery before declaring incident closed.

### 4.5 Post-Incident
- Complete incident report within 5 business days.
- Root cause analysis (5-whys).
- Update runbook with new procedures.
- Track remediation items as GitHub issues.

---

## 5. HIPAA Breach Notification Requirements

HIPAA §164.400–414 mandates notification when PHI is acquired, accessed, used, or disclosed in a way not permitted by the Privacy Rule.

### Breach Assessment Checklist
- [ ] Was ePHI involved? (patient records, session notes, messages, assessments)
- [ ] Was it accessed by an unauthorized party?
- [ ] Was it actually acquired or viewed (vs. failed attempt)?
- [ ] Does an exception apply? (encrypted data with lost key = not a breach)

### Notification Timeline
| Recipient | Deadline | Method |
|-----------|----------|--------|
| Affected individuals | 60 days from discovery | Written notice by mail/email |
| HHS Office for Civil Rights | 60 days (< 500 affected) or 60 days year-end (annual summary) | HHS OCR online portal |
| Prominent media | 60 days (≥ 500 in a state) | Press release |

> See `ops/BREACH_NOTIFICATION_TEMPLATE.md` for pre-drafted notification letter.

---

## 6. Key Commands

### Check PHI access anomalies
```sql
SELECT u.email, u.role, p.action, p.resource_type, p.accessed_at
FROM phi_access_log p
JOIN users u ON u.id = p.actor_id
WHERE p.accessed_at > NOW() - INTERVAL '24h'
ORDER BY p.accessed_at DESC
LIMIT 100;
```

### Check for stuck notification queue
```sql
SELECT * FROM notification_queue
WHERE locked_at < NOW() - INTERVAL '10 minutes'
  AND completed_at IS NULL;
```

### Force-revoke all sessions for a user
```sql
UPDATE refresh_tokens SET revoked_at = NOW()
WHERE user_id = '<user-id>' AND revoked_at IS NULL;
```

### Check crisis alert integrity
```sql
SELECT s.id, s.patient_id, cr.risk_level, cr.detected_at, cr.resolved_at
FROM crisis_risk_assessments cr
JOIN sessions s ON s.id = cr.session_id
WHERE cr.detected_at > NOW() - INTERVAL '7d'
ORDER BY cr.detected_at DESC;
```

---

## 7. Contacts

| Role | Contact |
|------|---------|
| Security Officer | [DESIGNATE — required before launch] |
| Legal / HIPAA Counsel | [DESIGNATE] |
| Railway Support | support@railway.app |
| Vercel Support | vercel.com/support |
| HHS OCR Breach Portal | ocrportal.hhs.gov |

---

## 8. Evidence Preservation

For any P0/P1 incident:
1. Export Railway logs for the incident window (minimum 72-hr window).
2. Export `phi_access_log` for the incident window.
3. Take PostgreSQL dump: `pg_dump $DATABASE_URL > incident-$(date +%Y%m%d).sql`.
4. Store evidence in encrypted S3 bucket for minimum 6 years (HIPAA retention).
