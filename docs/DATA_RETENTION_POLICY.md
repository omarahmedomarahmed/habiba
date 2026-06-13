# 24Therapy Data Retention Policy

> HIPAA §164.530(j) — Documentation and Record Retention
> Version 1.0 | Effective: 2026-06-13
> Security Officer: [DESIGNATE BEFORE LAUNCH]

---

## 1. Overview

This policy defines how long 24Therapy retains different categories of data and
the automated processes that enforce these retention schedules.

---

## 2. Retention Schedule

| Data Category | Retention Period | Basis | Automated? |
|---------------|-----------------|-------|------------|
| PHI access logs (`phi_access_log`) | 6 years | HIPAA §164.530(j)(2)(i) | ✅ Daily cron |
| Session records + transcripts | 7 years | HIPAA minimum for mental health | Manual (S3 archive pending) |
| AI session notes | 7 years | Same as session records | Manual |
| Patient records (active) | Duration of care + 7 years | State + HIPAA | Manual |
| Patient records (erasure_requested) | 30 days pending review | GDPR-aligned | ✅ Daily cron |
| Audit trail / break-glass log | 6 years | HIPAA §164.530(j) | Manual |
| Billing records | 7 years | IRS + HIPAA | Manual |
| De-identified analytics | Indefinite | No PHI content | N/A |

---

## 3. Automated Lifecycle (DataLifecycleService)

The `DataLifecycleService` NestJS module runs three cron jobs:

### 3.1 PHI Access Log Purge (Daily, 3am UTC)
```typescript
// Deletes phi_access_log rows older than 6 years
DELETE FROM phi_access_log WHERE accessed_at < NOW() - INTERVAL '6 years';
```

### 3.2 Erasure Request Processing (Daily, 4am UTC)
Patients who requested data erasure via `DELETE /patients/me` more than 30 days ago
are hard-deleted from the database (cascade deletes sessions, mood entries, notes, etc.).

**Before hard-delete, verify:**
- [ ] Patient has been notified of completion
- [ ] No legal hold is in place
- [ ] Billing records are archived separately (7-year IRS requirement)

### 3.3 Monthly Retention Report (1st of month, 5am UTC)
Logs current row counts for `phi_access_log` and erasure queue to application logs.
Review this report monthly.

---

## 4. Manual Retention Procedures

### 4.1 Session Record Archive (Year 7+)
When session data reaches 7 years, it must be moved to cold storage:
1. Run `scripts/backup-verify.js` to confirm staging restore works.
2. Export session data to encrypted S3 bucket (see `ops/RUNBOOK.md`).
3. Hard-delete from primary database.
4. Update archive index in `session_archive_index` table (create as needed).

### 4.2 Patient Record Retention After Care Ends
When a patient relationship ends:
- Set `patients.status = 'inactive'`.
- Schedule hard-delete 7 years from the last session date.
- This is not yet automated — add to manual quarterly review.

---

## 5. Data Deletion Request Workflow

### Patient-Initiated (HIPAA §164.524, GDPR Art. 17)
1. Patient calls `DELETE /patients/me` from the portal.
2. System sets `status = 'erasure_requested'`, `deleted_at = NOW()`.
3. Admin reviews within 30 days (check break-glass log for any pending access).
4. Automated hard-delete runs on day 31 if no hold is placed.
5. Notify patient of completion via email.

**Exceptions (when erasure can be denied):**
- Active legal hold or subpoena
- Ongoing insurance dispute
- State law requires longer retention

### Therapist- or Admin-Initiated
Submit request to Security Officer. Document reason. Follow same 30-day review.

---

## 6. Incident: Premature Data Deletion

If data is deleted before the retention period expires:
1. Classify as a potential HIPAA security incident.
2. Follow `ops/INCIDENT_RESPONSE.md` Phase 4.2 (Assessment).
3. Attempt restore from the most recent backup (`scripts/backup-verify.js`).
4. Document in incident log.

---

## 7. Policy Review Schedule

This policy is reviewed annually or after any significant system change or incident.
Next review: **2027-06-13**

---

*Last Updated: 2026-06-13*
