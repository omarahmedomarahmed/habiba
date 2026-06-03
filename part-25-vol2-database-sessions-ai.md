# Part 25 — Complete Database Architecture & Data Model (Volume 2)
Sessions, Video Calls, Transcripts, Recordings, Reports, AI Notes, Session Intelligence Objects, Clinical Memory Tables, Assessments, Risk Monitoring, Outcome Tracking

> **Note:** This section was outlined in the README but not yet fully written. This document compiles all session/AI database schema that was defined across Parts 3, 4, 8, 26, and 25 Vol 1.

---

## Sessions Table

**`sessions`** — Core session record.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| organization_id | uuid (FK) | Parent organization |
| therapist_id | uuid (FK) | Assigned therapist |
| patient_id | uuid (FK) | Patient |
| session_type | enum | standard/radar/group/phone/in_person |
| status | enum | scheduled/in_progress/completed/cancelled/no_show |
| scheduled_at | timestamptz | Scheduled start time |
| started_at | timestamptz | Actual start time |
| ended_at | timestamptz | Actual end time |
| duration_minutes | integer | Session duration |
| session_number | integer | Sequential session count for patient |
| modality | enum | video/audio_only/in_person/phone |
| radar_session | boolean | Was this a Radar instant session |
| recording_enabled | boolean | Recording consent obtained |
| scribe_enabled | boolean | AI scribe active |
| notes | text | Quick therapist notes |
| created_at | timestamptz | Record creation time |

---

## Session Participants Table

**`session_participants`** — Multi-participant support.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| session_id | uuid (FK) | Reference to sessions |
| user_id | uuid (FK) | Participating user |
| role | enum | therapist/patient/observer/interpreter/family |
| joined_at | timestamptz | When they joined |
| left_at | timestamptz | When they left |

---

## Session Notes Table

**`session_notes`** — Therapist manual notes.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| session_id | uuid (FK) | Reference to sessions |
| therapist_id | uuid (FK) | Author |
| content | text | Note content |
| note_type | enum | pre_session/during_session/post_session |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last updated |

---

## Transcripts Table

**`transcripts`** — Master transcript record per session.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| session_id | uuid (FK) | Reference to sessions |
| status | enum | processing/completed/failed |
| language | varchar | Detected/specified language |
| word_count | integer | Total word count |
| duration_seconds | integer | Audio duration |
| storage_url | varchar | Full transcript storage URL |
| created_at | timestamptz | Creation timestamp |

---

## Transcript Segments Table

**`transcript_segments`** — Granular speaker-labeled segments.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| transcript_id | uuid (FK) | Reference to transcripts |
| session_id | uuid (FK) | Reference to sessions |
| speaker | enum | therapist/patient/unknown |
| speaker_label | varchar | Friendly label |
| start_time_ms | integer | Start in milliseconds |
| end_time_ms | integer | End in milliseconds |
| text | text | Spoken text |
| confidence | numeric(4,3) | ASR confidence 0-1 |
| sequence_number | integer | Ordering |

---

## Session Recordings Table

**`session_recordings`**

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| session_id | uuid (FK) | Reference to sessions |
| recording_type | enum | video/audio/screen |
| storage_url | varchar | Encrypted storage URL |
| size_bytes | bigint | File size |
| duration_seconds | integer | Recording duration |
| encryption_key_id | varchar | Key management reference |
| retention_until | date | Auto-delete date |
| created_at | timestamptz | Creation timestamp |

---

## AI Notes Table

**`ai_session_notes`** — AI-generated structured notes.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| session_id | uuid (FK) | Reference to sessions |
| patient_id | uuid (FK) | Reference to patients |
| therapist_id | uuid (FK) | Associated therapist |
| note_format | enum | soap/dap/birp/narrative/custom |
| content | jsonb | Structured note content |
| raw_content | text | Plain text version |
| status | enum | draft/pending_review/approved/rejected |
| version | integer | Note version number |
| approved_by | uuid (FK) | Therapist who approved |
| approved_at | timestamptz | Approval timestamp |
| ai_model_id | varchar | Model used for generation |
| prompt_version | varchar | Prompt version used |
| created_at | timestamptz | Generation timestamp |
| updated_at | timestamptz | Last update |

### SOAP Note Content Structure (JSONB)
```json
{
  "subjective": "Patient reports...",
  "objective": "Patient presented...",
  "assessment": "Patient demonstrates...",
  "plan": "Continue with..."
}
```

---

## AI Session Summaries Table

**`ai_session_summaries`**

| Field | Type |
|-------|------|
| id | uuid (PK) |
| session_id | uuid (FK) |
| patient_id | uuid (FK) |
| summary_type | enum (brief/detailed/patient_facing) |
| content | text |
| key_themes | text[] |
| action_items | jsonb |
| follow_up_suggestions | jsonb |
| created_at | timestamptz |

---

## Session Intelligence Objects Table

**`session_intelligence`** — Rich structured AI output per session.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| session_id | uuid (FK) | Reference to sessions |
| patient_id | uuid (FK) | Reference to patients |
| themes_detected | text[] | Array of topics discussed |
| symptoms_mentioned | text[] | Symptoms referenced |
| goals_mentioned | text[] | Goals discussed |
| stressors_mentioned | text[] | Stressors identified |
| life_events_mentioned | text[] | Life events referenced |
| medication_mentions | text[] | Medications discussed |
| risk_indicators | text[] | Risk language detected |
| session_timeline | jsonb | Time-stamped topic segments |
| emotional_arc | jsonb | Emotional tone progression |
| created_at | timestamptz | Creation timestamp |

---

## Patient Memory Table

**`patient_memory`** — The core clinical intelligence asset.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| patient_id | uuid (FK) | Reference to patients |
| therapist_id | uuid (FK) | Associated therapist |
| memory_type | enum | symptom/goal/relationship/life_event/medication/risk/treatment/strength/protective_factor |
| title | varchar | Short memory label |
| content | text | Detailed memory content |
| context | jsonb | Additional structured context |
| confidence_score | numeric(3,2) | AI confidence 0-1 |
| source_session_id | uuid (FK) | Session where extracted |
| source_segment_ids | uuid[] | Transcript segments |
| status | enum | active/archived/superseded/rejected |
| reviewed_by | uuid (FK) | Therapist reviewer |
| reviewed_at | timestamptz | Review timestamp |
| embedding | vector(1536) | pgvector embedding |
| version | integer | Memory version |
| created_at | timestamptz | Extraction timestamp |
| updated_at | timestamptz | Last update |

**`memory_type` values:** `symptom` · `goal` · `relationship` · `life_event` · `medication` · `risk` · `treatment` · `strength` · `protective_factor`

---

## Memory Evolution Table

**`patient_memory_history`** — Tracks how memories change over time.

| Field | Type |
|-------|------|
| id | uuid (PK) |
| memory_id | uuid (FK) |
| previous_status | varchar |
| new_status | varchar |
| change_reason | text |
| changed_at | timestamptz |

---

## Assessment Templates Table

**`assessment_templates`**

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| name | varchar | e.g., "PHQ-9" |
| code | varchar | Machine-readable code |
| description | text | What it measures |
| questions | jsonb | Array of question objects |
| scoring_rules | jsonb | How to calculate scores |
| interpretation | jsonb | Score range meanings |
| is_public | boolean | Available to all orgs |
| organization_id | uuid (FK) | Custom assessment owner |
| created_at | timestamptz | Creation timestamp |

---

## Assessment Results Table

**`assessment_results`**

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| patient_id | uuid (FK) | Patient assessed |
| therapist_id | uuid (FK) | Administering therapist |
| session_id | uuid (FK) | Associated session (optional) |
| template_id | uuid (FK) | Assessment template |
| answers | jsonb | Raw patient answers |
| total_score | numeric | Calculated total |
| subscale_scores | jsonb | Sub-category scores |
| interpretation | varchar | AI/system interpretation |
| severity_level | enum | minimal/mild/moderate/severe |
| completed_at | timestamptz | Completion timestamp |
| reviewed_by | uuid (FK) | Reviewing therapist |

---

## Risk Assessments Table

**`risk_assessments`** — Clinical risk monitoring.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| patient_id | uuid (FK) | Patient |
| session_id | uuid (FK) | Triggering session |
| therapist_id | uuid (FK) | Assessing therapist |
| risk_type | enum | self_harm/suicide/violence/substance/medical |
| risk_level | enum | low/moderate/elevated/high/critical |
| indicators | text[] | Specific risk indicators |
| ai_detected | boolean | System-flagged vs. manual |
| notes | text | Clinical notes |
| action_taken | text | Response documented |
| reviewed_by | uuid (FK) | Reviewing clinician |
| reviewed_at | timestamptz | Review timestamp |
| created_at | timestamptz | Creation timestamp |

---

## Treatment Plans Table

**`treatment_plans`**

| Field | Type |
|-------|------|
| id | uuid (PK) |
| patient_id | uuid (FK) |
| therapist_id | uuid (FK) |
| title | varchar |
| diagnosis_code | varchar |
| goals | jsonb |
| interventions | jsonb |
| status | enum (draft/active/completed/on_hold) |
| review_date | date |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## Radar Network Tables

**`radar_requests`** — Patient requests for instant session.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| patient_id | uuid (FK) | Requesting patient |
| primary_concern | text | What patient needs help with |
| urgency_level | enum | normal/elevated/urgent/crisis |
| preferred_language | varchar | Language preference |
| specialization_preference | text[] | Preferred specializations |
| status | enum | searching/matched/in_session/completed/expired/cancelled |
| match_started_at | timestamptz | When matching began |
| matched_at | timestamptz | When match was found |
| expires_at | timestamptz | Request expiration |
| created_at | timestamptz | Request creation |

**`radar_matches`** — Therapist matches for radar requests.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| request_id | uuid (FK) | Reference to radar_requests |
| therapist_id | uuid (FK) | Matched therapist |
| match_score | numeric(5,2) | Matching algorithm score |
| language_score | numeric | Language match component |
| specialty_score | numeric | Specialty match component |
| availability_score | numeric | Availability component |
| experience_score | numeric | Experience component |
| response_rate_score | numeric | Historical response rate |
| status | enum | pending/accepted/declined/expired |
| notified_at | timestamptz | When therapist was notified |
| responded_at | timestamptz | When therapist responded |

---

## Prompt Registry Table

**`prompt_registry`**

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| name | varchar | e.g., "SOAP_NOTE" |
| version | varchar | e.g., "v12" |
| template | text | Prompt template text |
| variables | jsonb | Required variables |
| owner | varchar | Team owner |
| status | enum | draft/testing/active/deprecated |
| performance_metrics | jsonb | Accuracy, approval rate, etc. |
| created_at | timestamptz | Creation timestamp |
| activated_at | timestamptz | When made active |

---

## AI Logs Table

**`ai_request_logs`** — Full observability.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| organization_id | uuid (FK) | Organization |
| user_id | uuid (FK) | Requesting user |
| agent_type | varchar | Which agent processed |
| model_id | varchar | Model used |
| prompt_version | varchar | Prompt used |
| input_tokens | integer | Input token count |
| output_tokens | integer | Output token count |
| cost_usd | numeric(10,6) | Estimated cost |
| latency_ms | integer | Response time |
| status | enum | success/failure/timeout |
| error_message | text | Error if failed |
| created_at | timestamptz | Request timestamp |

---

## Billing & Subscriptions Tables

**`subscriptions`**

| Field | Type |
|-------|------|
| id | uuid (PK) |
| organization_id | uuid (FK) |
| plan_id | uuid (FK) |
| status | enum (trialing/active/past_due/cancelled/paused) |
| current_period_start | timestamptz |
| current_period_end | timestamptz |
| trial_end | timestamptz |
| cancelled_at | timestamptz |
| stripe_subscription_id | varchar |
| created_at | timestamptz |

**`transactions`**

| Field | Type |
|-------|------|
| id | uuid (PK) |
| organization_id | uuid (FK) |
| subscription_id | uuid (FK) |
| amount_usd | numeric(10,2) |
| currency | varchar |
| status | enum (pending/completed/failed/refunded) |
| transaction_type | enum (subscription/session/addon/radar) |
| stripe_payment_id | varchar |
| created_at | timestamptz |

**`session_fees`** — Per-session marketplace fees.

| Field | Type |
|-------|------|
| id | uuid (PK) |
| session_id | uuid (FK) |
| patient_id | uuid (FK) |
| therapist_id | uuid (FK) |
| amount_charged | numeric(10,2) |
| platform_fee | numeric(10,2) |
| therapist_payout | numeric(10,2) |
| currency | varchar |
| status | enum (pending/paid/refunded) |
| created_at | timestamptz |

**`therapist_payouts`**

| Field | Type |
|-------|------|
| id | uuid (PK) |
| therapist_id | uuid (FK) |
| amount | numeric(10,2) |
| currency | varchar |
| payout_method | varchar |
| status | enum (pending/processing/completed/failed) |
| payout_date | date |
| created_at | timestamptz |

---

## Notifications Table

**`notifications`**

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| user_id | uuid (FK) | Recipient |
| organization_id | uuid (FK) | Organization scope |
| type | varchar | Notification type code |
| title | varchar | Short title |
| body | text | Full message |
| data | jsonb | Additional payload |
| channel | enum | in_app/email/sms/push |
| status | enum | pending/sent/read/failed |
| sent_at | timestamptz | Delivery timestamp |
| read_at | timestamptz | Read timestamp |
| created_at | timestamptz | Creation timestamp |

---

## Audit Logs Table

**`audit_logs`** — Immutable audit trail. HIPAA requirement.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Unique identifier |
| organization_id | uuid (FK) | Organization |
| user_id | uuid (FK) | Acting user |
| action | varchar | Action performed |
| resource_type | varchar | Entity type |
| resource_id | uuid | Entity identifier |
| ip_address | varchar | Request IP |
| user_agent | text | Browser/client |
| old_values | jsonb | Before state |
| new_values | jsonb | After state |
| created_at | timestamptz | Immutable timestamp |

> **Note:** Audit logs are append-only. No UPDATE or DELETE permitted.

---

## Summary: What Volume 2 Covers

✅ Sessions  
✅ Session Participants  
✅ Session Notes  
✅ Transcripts  
✅ Transcript Segments  
✅ Session Recordings  
✅ AI Notes (SOAP/DAP/BIRP)  
✅ Session Intelligence Objects  
✅ Patient Memory Tables  
✅ Memory Evolution History  
✅ Assessment Templates & Results  
✅ Risk Assessments  
✅ Treatment Plans  
✅ Radar Network Tables  
✅ Prompt Registry  
✅ AI Request Logs  
✅ Billing & Subscriptions  
✅ Notifications  
✅ Audit Logs  
