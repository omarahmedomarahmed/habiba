# Part 30 — API Specification
Request Structures, Response Structures, Authentication, Webhooks, and SDK Architecture

> **Status:** Outlined in PRD — full specification with potentially hundreds of endpoints coming in future version. Content synthesized from Part 14 (Interoperability & APIs).

---

## Overview

The 24Therapy Developer API transforms the platform from an application into **mental health infrastructure**.

Any company building in mental health can use 24Therapy's APIs to:
- Power their transcription
- Generate clinical notes
- Access therapist matching
- Retrieve patient assessments
- Build on the memory engine

---

## Authentication

```
Authorization: Bearer <api_key>
Content-Type: application/json
X-Organization-ID: <org_id>
```

**API Key Types:**
- `sk_live_xxx` — Production keys
- `sk_test_xxx` — Sandbox keys

---

## Core API Categories

### 1. Session API
```
POST   /v1/sessions                Create session
GET    /v1/sessions/:id            Get session
PATCH  /v1/sessions/:id            Update session
DELETE /v1/sessions/:id            Cancel session
POST   /v1/sessions/:id/start      Start session
POST   /v1/sessions/:id/end        End session
GET    /v1/sessions/:id/transcript Get transcript
GET    /v1/sessions/:id/notes      Get AI notes
GET    /v1/sessions/:id/summary    Get summary
```

### 2. Scribe API
```
POST   /v1/scribe/transcribe       Submit audio for transcription
POST   /v1/scribe/generate-note    Generate note from transcript
POST   /v1/scribe/generate-summary Generate session summary
GET    /v1/scribe/job/:id          Check processing status
```

### 3. Patient API
```
POST   /v1/patients                Create patient
GET    /v1/patients                List patients
GET    /v1/patients/:id            Get patient
PATCH  /v1/patients/:id            Update patient
DELETE /v1/patients/:id            Archive patient
GET    /v1/patients/:id/sessions   Patient sessions
GET    /v1/patients/:id/memory     Patient memory
GET    /v1/patients/:id/assessments Patient assessments
GET    /v1/patients/:id/timeline   Patient timeline
```

### 4. Memory API
```
GET    /v1/memory/:patient_id      Get all memories
POST   /v1/memory/:patient_id/search Search memories (semantic)
POST   /v1/memory/:patient_id      Create memory
PATCH  /v1/memory/:memory_id       Update memory
DELETE /v1/memory/:memory_id       Archive memory
```

### 5. Assessment API
```
GET    /v1/assessments/templates   List templates
POST   /v1/assessments             Create assessment result
GET    /v1/assessments/:patient_id List patient assessments
GET    /v1/assessments/:id/results Get results
```

### 6. Therapist API
```
GET    /v1/therapists              List/search therapists
GET    /v1/therapists/:id          Get therapist profile
GET    /v1/therapists/:id/availability Get availability
POST   /v1/therapists/match        Run matching algorithm
```

### 7. Radar API
```
POST   /v1/radar/request           Create matching request
GET    /v1/radar/request/:id       Get request status
POST   /v1/radar/request/:id/accept Accept match (therapist)
POST   /v1/radar/request/:id/decline Decline match
```

### 8. Webhook API
```
POST   /v1/webhooks                Register webhook
GET    /v1/webhooks                List webhooks
DELETE /v1/webhooks/:id            Delete webhook
```

---

## Standard Response Format

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_xxx",
    "timestamp": "2025-01-01T00:00:00Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "PATIENT_NOT_FOUND",
    "message": "Patient with ID xxx was not found.",
    "status": 404
  }
}
```

---

## SDKs

Available in:
- JavaScript/TypeScript (npm)
- Python (pip)
- Ruby (gem)
- PHP (composer)
- Go (go get)
- Java (maven)
- Swift (iOS)

---

## Rate Limits

| Plan | Requests/minute | Requests/day |
|------|----------------|--------------|
| Starter | 60 | 10,000 |
| Professional | 300 | 100,000 |
| Practice | 600 | 250,000 |
| Enterprise | Custom | Custom |

---

*Full endpoint documentation with request/response examples, error codes, and SDK guides to be completed in a future PRD version.*
