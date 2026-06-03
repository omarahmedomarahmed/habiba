# Part 25 — Complete Database Architecture & Data Model (Volume 1)
Core Multi-Tenant Data Foundation: Organizations, Users, Therapists, Patients, Medications

---

## Database Philosophy

Most startups create tables based on screens. That is wrong.

The database should be designed around **Business Entities** — not UI pages, not API endpoints, not temporary features.

Every future feature should be able to reuse existing entities.

---

## Database Design Principles

| Principle | Description |
|-----------|-------------|
| Multi-Tenant | Org-scoped data isolation |
| API First | Designed for programmatic access |
| Audit Ready | Every change traceable |
| AI Ready | Vector-friendly, rich metadata |
| Analytics Ready | Events & metrics tables |
| Enterprise Ready | RBAC, SSO, white label |
| Compliance Aware | HIPAA/GDPR structure |

---

## Primary Database: PostgreSQL

### Schema Groups

```
auth           organizations    users
patients       therapists       sessions
transcripts    reports          assessments
medications    billing          marketplace
notifications  audit            ai
analytics      integrations
```

---

## Core Entity Relationship Map

```
Organization
    ↓
Users
    ↓
Therapists
    ↓
Patients
    ↓
Sessions
    ↓
Transcripts
    ↓
Reports
    ↓
AI Intelligence
```

---

## Organizations Table

**`organizations`** — Represents a customer account.

**Examples:** Individual Therapist · Group Practice · Clinic · Hospital · Enterprise

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| name | varchar | Organization display name |
| slug | varchar (unique) | URL-safe identifier |
| organization_type | enum | solo/practice/clinic/hospital/enterprise/partner |
| plan_id | uuid (FK) | Current subscription plan |
| status | enum | active/trial/suspended/cancelled/pending |
| country | varchar | ISO country code |
| timezone | varchar | IANA timezone string |
| currency | varchar | ISO currency code |
| website | varchar | Organization website |
| logo_url | varchar | Logo storage URL |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |
| deleted_at | timestamptz | Soft delete timestamp |

**`organization_type` values:** `solo` · `practice` · `clinic` · `hospital` · `enterprise` · `partner`

**`status` values:** `active` · `trial` · `suspended` · `cancelled` · `pending`

---

## Organization Settings Table

**`organization_settings`**

| Field | Type | Description |
|-------|------|-------------|
| organization_id | uuid (FK) | Reference to organizations |
| branding_settings | jsonb | Logo, colors, custom domain |
| retention_settings | jsonb | Data retention policies |
| notification_settings | jsonb | Default notification prefs |
| feature_flags | jsonb | Enabled/disabled features |
| security_settings | jsonb | MFA, IP allowlist, etc. |

---

## Users Table

**`users`** — Master user record.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| organization_id | uuid (FK) | Parent organization |
| email | varchar (unique) | Login email |
| phone | varchar | Phone number |
| password_hash | varchar | Bcrypt hash |
| first_name | varchar | First name |
| last_name | varchar | Last name |
| avatar | varchar | Avatar image URL |
| status | enum | active/inactive/invited/suspended |
| role | enum | System role |
| last_login | timestamptz | Last login timestamp |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**`status` values:** `active` · `inactive` · `invited` · `suspended`

---

## User Roles

System-level roles (RBAC):

| Role | Description |
|------|-------------|
| super_admin | Platform-wide full access |
| admin | Organization full access |
| manager | Practice manager |
| therapist | Clinical access |
| assistant | Administrative access |
| billing | Finance access |
| support | Read-only support |

---

## User Permissions Table

**`user_permissions`** — Custom permission overrides.

| Field | Type | Description |
|-------|------|-------------|
| user_id | uuid (FK) | Reference to users |
| permission_key | varchar | Permission identifier string |
| granted | boolean | Whether granted or denied |
| created_at | timestamptz | Grant timestamp |

---

## Therapists Table

**`therapists`** — Core therapist profile.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| organization_id | uuid (FK) | Parent organization |
| user_id | uuid (FK) | Reference to users |
| public_slug | varchar (unique) | Public profile URL slug |
| license_number | varchar | Professional license number |
| license_country | varchar | Country of licensure |
| license_state | varchar | State/province of licensure |
| license_status | enum | active/expired/pending/suspended |
| specializations | text[] | Array of specialization tags |
| languages | text[] | Languages spoken |
| years_experience | integer | Years in practice |
| bio | text | Public biography |
| education | jsonb | Education history array |
| availability_status | enum | available/busy/offline |
| marketplace_enabled | boolean | Listed on public marketplace |
| verification_status | enum | pending/reviewing/approved/rejected/suspended |
| rating | numeric(3,2) | Average rating (0-5) |
| review_count | integer | Total review count |
| created_at | timestamptz | Creation timestamp |

**`verification_status` values:** `pending` · `reviewing` · `approved` · `rejected` · `suspended`

---

## Therapist Credentials Table

**`therapist_credentials`**

Stores: Licenses · Degrees · Certifications · Insurance Documents · Government IDs

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| therapist_id | uuid (FK) | Reference to therapists |
| document_type | enum | license/degree/certification/insurance/id |
| document_url | varchar | Secure storage URL |
| status | enum | pending/verified/rejected/expired |
| expiration_date | date | Document expiration |
| verified_by | uuid (FK) | Admin who verified |
| verified_at | timestamptz | Verification timestamp |

---

## Therapist Specializations Table

**`therapist_specializations`** — Separate lookup table.

| Specialization |
|----------------|
| anxiety |
| depression |
| trauma |
| adhd |
| ocd |
| ptsd |
| grief |
| addiction |
| relationships |
| couples |
| eating_disorders |
| burnout |
| sleep |
| self_esteem |
| career |
| parenting |

---

## Patients Table

**`patients`** — Most important entity.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| organization_id | uuid (FK) | Parent organization |
| primary_therapist_id | uuid (FK) | Primary assigned therapist |
| external_patient_id | varchar | EHR/external system ID |
| first_name | varchar | First name |
| last_name | varchar | Last name |
| date_of_birth | date | Date of birth |
| gender | varchar | Gender identity |
| email | varchar | Contact email |
| phone | varchar | Contact phone |
| address | jsonb | Address object |
| emergency_contact | jsonb | Emergency contact details |
| status | enum | active/inactive/discharged/waitlist |
| anonymous_mode | boolean | Anonymized patient flag |
| on_medication | boolean | Currently on medication flag |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

---

## Patient Profile Extension Table

**`patient_profiles`** — Additional demographic/social data.

| Field | Type |
|-------|------|
| patient_id | uuid (FK) |
| occupation | varchar |
| relationship_status | varchar |
| education | varchar |
| living_situation | varchar |
| insurance_info | jsonb |
| notes | text |

---

## Patient Tags Table

**`patient_tags`**

Examples: `high_risk` · `vip` · `follow_up` · `medication_review` · `new_patient`

---

## Patient Contacts Table

**`patient_contacts`** — Emergency contacts, family, guardians.

| Field | Type |
|-------|------|
| id | uuid (PK) |
| patient_id | uuid (FK) |
| relationship | varchar |
| name | varchar |
| phone | varchar |
| email | varchar |
| is_emergency | boolean |

---

## Patient Consents Table

**`patient_consents`** — HIPAA/GDPR compliance.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| patient_id | uuid (FK) | Reference to patients |
| consent_type | varchar | e.g., therapy, recording, ai_scribe |
| version | varchar | Consent document version |
| accepted_at | timestamptz | When consent was given |
| expires_at | timestamptz | Consent expiration |
| evidence_url | varchar | Signed document URL |

---

## Patient Files Table

**`patient_files`**

Stores: Documents · PDFs · Uploads · Assessments · Referrals

| Field | Type |
|-------|------|
| id | uuid (PK) |
| patient_id | uuid (FK) |
| file_name | varchar |
| file_url | varchar |
| file_type | varchar |
| uploaded_by | uuid (FK) |
| created_at | timestamptz |

---

## Patient Timeline Events Table

**`patient_timeline_events`** — One of the most important tables.

Records everything meaningful in a patient's journey.

**Examples:** Session Completed · Medication Changed · Assessment Completed · Goal Added · Risk Alert Created · Report Generated

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| patient_id | uuid (FK) | Reference to patients |
| event_type | varchar | Type of event |
| title | varchar | Short title |
| description | text | Full description |
| created_by | uuid (FK) | Who created this event |
| created_at | timestamptz | Event timestamp |

---

## Therapist-Patient Assignments Table

**`therapist_patient_assignments`** — Many-to-many relationship.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| therapist_id | uuid (FK) | Reference to therapists |
| patient_id | uuid (FK) | Reference to patients |
| role | enum | primary/secondary/consulting |
| assigned_at | timestamptz | Assignment timestamp |

---

## Patient Relationships Table

**`patient_relationships`** — Future: used by AI for context.

Tracks: Family · Friends · Partners · Children · Employers

| Field | Type |
|-------|------|
| id | uuid (PK) |
| patient_id | uuid (FK) |
| relationship_type | varchar |
| person_name | varchar |
| notes | text |

---

## Patient Life Events Table

**`patient_life_events`** — Extremely valuable for AI context.

**Examples:** Marriage · Divorce · Job Loss · Graduation · Bereavement · Move · Trauma Event

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| patient_id | uuid (FK) | Reference to patients |
| event_type | varchar | Type of life event |
| event_date | date | When event occurred |
| description | text | Details |
| impact_level | enum | low/medium/high/critical |

---

## Patient Goals Table

**`patient_goals`**

| Field | Type |
|-------|------|
| id | uuid (PK) |
| patient_id | uuid (FK) |
| title | varchar |
| description | text |
| status | enum (active/completed/paused/cancelled) |
| target_date | date |
| created_by | uuid (FK) |
| created_at | timestamptz |

---

## Goal Progress Updates Table

**`goal_progress_updates`** — Stores progress notes over time.

| Field | Type |
|-------|------|
| id | uuid (PK) |
| goal_id | uuid (FK) |
| note | text |
| progress_score | integer |
| created_by | uuid (FK) |
| created_at | timestamptz |

---

## Patient Mood Tracking Table

**`patient_mood_entries`**

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| patient_id | uuid (FK) | Reference to patients |
| score | integer | 1–10 mood scale |
| notes | text | Optional patient notes |
| recorded_at | timestamptz | When recorded |

---

## Patient Journal Entries Table

**`patient_journal_entries`** — Future feature.

Allows patient reflection. AI may analyze trends with appropriate permissions.

| Field | Type |
|-------|------|
| id | uuid (PK) |
| patient_id | uuid (FK) |
| content | text |
| mood_score | integer |
| created_at | timestamptz |

---

## Medication Master Table

**`medications`** — Central medication catalog.

| Field | Type |
|-------|------|
| id | uuid (PK) |
| name | varchar |
| generic_name | varchar |
| classification | varchar |
| description | text |

---

## Patient Medications Table

**`patient_medications`** — Critical clinical table.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| patient_id | uuid (FK) | Reference to patients |
| medication_id | uuid (FK) | Reference to medications |
| dosage | varchar | e.g., "10mg" |
| frequency | varchar | e.g., "once daily" |
| start_date | date | Start of medication |
| end_date | date | End date (null if ongoing) |
| status | enum | active/paused/completed/discontinued |
| prescribed_by | varchar | Prescriber name/info |

---

## Medication History Table

**`patient_medication_history`** — Full audit trail of every change.

| Field | Type |
|-------|------|
| id | uuid (PK) |
| patient_medication_id | uuid (FK) |
| change_type | varchar |
| previous_value | jsonb |
| new_value | jsonb |
| changed_by | uuid (FK) |
| changed_at | timestamptz |

---

## Summary: What Volume 1 Covers

✅ Organizations  
✅ Users  
✅ Roles  
✅ Permissions  
✅ Therapists  
✅ Credentials  
✅ Patients  
✅ Consents  
✅ Files  
✅ Timeline  
✅ Goals  
✅ Mood Tracking  
✅ Relationships  
✅ Life Events  
✅ Medication Tracking  

---

*Volume 2 will define: Sessions · Video Calls · Transcripts · Recordings · Reports · AI Notes · Therapist Notes · Session Intelligence Objects · Clinical Memory Tables · Assessments · Risk Monitoring Tables · Outcome Tracking Tables*
