# HIPAA Compliance Checklist — 24Therapy

> Status as of 2026-06-11. Review with legal counsel before signing BAAs or handling real PHI.
> Items marked ✅ are implemented. Items marked ⬜ are required before production PHI.

---

## Administrative Safeguards (§164.308)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Designated Security Officer | ⬜ | Assign before launch |
| Risk analysis documented | ⬜ | Document threats and mitigations |
| Risk management plan | ⬜ | |
| Workforce training on PHI handling | ⬜ | |
| Access authorization procedures | ✅ | Role-based access (super_admin/admin/therapist/patient) enforced via RolesGuard |
| Workforce clearance (background checks) | ⬜ | Process required for staff |
| Contingency plan (backup + DR) | ⬜ | Railway DB backups must be configured |
| BAAs with all business associates | ⬜ | Required before any real PHI |

---

## Physical Safeguards (§164.310)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Facility access controls | ✅ | Cloud-only deployment (Railway, Vercel) |
| Workstation security policy | ⬜ | Document policy for developers |
| Media disposal procedures | ⬜ | Document how logs/backups are purged |

---

## Technical Safeguards (§164.312)

### Access Control

| Requirement | Status | Notes |
|-------------|--------|-------|
| Unique user ID for each user | ✅ | UUID per user in `users` table |
| Emergency access procedure | ⬜ | Document break-glass process |
| Automatic logoff | ⬜ | JWT expiry (15 min access, 30 day refresh) partially covers this |
| Encryption/decryption | ✅ | TLS in transit (Railway/Vercel enforce HTTPS); DB at rest encrypted by Railway |

### Audit Controls

| Requirement | Status | Notes |
|-------------|--------|-------|
| PHI access logging | ✅ | `PhiAuditInterceptor` logs all PHI route access to `phi_access_log` |
| Audit log retention | ⬜ | Define retention policy; ensure logs are not purged < 6 years |
| Admin audit trail | ✅ | `audit_logs` table tracks admin actions |
| Login/logout events | ✅ | `last_login_at`, `last_login_ip` tracked in `users` |
| Failed login tracking | ✅ | `failed_login_count`, `locked_until` in `users`; account locked after 5 failures |

### Integrity

| Requirement | Status | Notes |
|-------------|--------|-------|
| Data integrity mechanisms | ✅ | PostgreSQL transactions; migration checksums verified |
| Transmission integrity | ✅ | HTTPS enforced (no HTTP in production CORS config) |

### Transmission Security

| Requirement | Status | Notes |
|-------------|--------|-------|
| Encryption in transit | ✅ | TLS everywhere (Railway, Vercel) |
| No PHI in logs | ✅ | Code policy: no transcript/message content in console/logger calls |
| PHI not echoed to patients in crisis | ✅ | Crisis pipeline sends only `crisis_support` event to patients (no risk level/indicators) |

---

## PHI Data Inventory

| Data type | Table | Notes |
|-----------|-------|-------|
| Patient names | `users` | |
| Session transcripts | `session_transcripts` | Sensitive — not logged |
| Session notes | `notes` | |
| Diagnoses | `clinical_assessments`, `patient_diagnoses` | |
| Medications | `medications` | |
| Messages | `messages` | Encrypted at rest via Railway |
| Risk assessments | `risk_assessments` | Crisis data — strict access |
| Mood/journal entries | `mood_entries`, `notes` (journal type) | |
| Assessment responses | `assessment_responses` | |
| PHI access log | `phi_access_log` | Audit trail |

---

## Minimum Necessary Standard

- Patients cannot see other patients' data (org-scoped queries + patient_id filtering).
- Therapists see only their own patients (therapist_id filtering in all service queries).
- Admins see org-wide data (org-scoped, not cross-org).
- Crisis alerts sent to therapist + admins only — patients receive supportive message, never risk scores.

---

## Before Accepting Real PHI

- [ ] BAA signed with Railway (database)
- [ ] BAA signed with Vercel (if PHI transits frontend — confirm)
- [ ] BAA signed with OpenAI (session transcripts are PHI)
- [ ] BAA signed with SendGrid (if emails contain PHI)
- [ ] BAA signed with Daily.co (video session recordings, if any)
- [ ] Penetration test completed
- [ ] Formal risk analysis documented
- [ ] Security officer designated
- [ ] Incident response plan written and tested
- [ ] Breach notification procedure documented (§164.400)
- [ ] Data retention policy documented
- [ ] Audit log retention policy implemented (6-year minimum)
- [ ] Employee HIPAA training completed and documented

---

## Not Yet Implemented (stretch goals)

- End-to-end encryption for messages at application layer
- Automated HIPAA audit reports
- Data export / Right of Access tooling (HIPAA §164.524)
- Automated data deletion / Right to Erasure workflow
