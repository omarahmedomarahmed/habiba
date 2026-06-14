# 24Therapy — Product MVP Specification

> **Audience:** Engineers, designers, and product stakeholders  
> **Status:** Go-to-market MVP  
> **Last Updated:** 2026-06-14

---

## What Is 24Therapy?

24Therapy is an AI-powered mental health platform for licensed therapists. It removes administrative burden by automatically recording, transcribing, and analyzing therapy sessions, then generating clinical notes, treatment plans, and shareable patient reports — all in real time.

**One-sentence pitch:** A therapist opens their phone, starts a session, and walks away with a full SOAP note, key insights, and a ready-to-share patient report — without writing a single word.

---

## Target User

| Field | Value |
|-------|-------|
| **Primary** | Licensed therapist (LCSW, LPC, LMFT, PsyD, PhD) in solo or small group practice |
| **Practice size** | 1–10 therapists |
| **Device** | Phone-first (therapist sees patients on their phone) |
| **Pain point** | Documentation takes 30–60 min after each session; no time for follow-up; no easy way to share notes with patients |

---

## Core User Journey

### Online Session (video/remote)
1. Therapist opens app → taps **New Session**
2. Selects **Online Session** → sets title and time
3. Gets shareable join link immediately
4. Sends link to patient (copy/share) or by email chip
5. Patient clicks link → no account required → enters name → joins Daily.co video room
6. Therapist starts session → AI records via device mic
7. Live transcript visible in right panel
8. Session ends → AI auto-generates SOAP note + insights within 60 seconds
9. Therapist reviews + approves note
10. Optional: **Share with Patient** → patient receives formatted email report

### In-Person Session (offline/physical)
1. Therapist opens app → taps **New Session**
2. Selects **In-Person** → enters patient name + optional email
3. Taps **Start Session Now** → goes straight to room (no waiting)
4. AI records device mic (both voices captured)
5. Therapist can pause AI (**OFF RECORD**) for sensitive moments
6. Session ends → same AI output generation
7. If patient email provided → **Share Report** sends formatted clinical summary

---

## Session Modes

| Mode | Modality | Video | Join Link | Start Flow |
|------|----------|-------|-----------|------------|
| Online | `video` | Daily.co iframe | Yes | Create → share link → patient joins |
| In-Person | `in_person` | None | No | Create → immediate redirect to room |
| Phone | `phone` | None | Optional | Create → therapist dials |

---

## AI Features

### Auto-Generation (triggered on session end)
Every session automatically generates:
- **SOAP Note** — Subjective, Objective, Assessment, Plan
- **Session Summary** — 2-3 sentence clinical summary
- **Key Talking Points** — Bullet list of main themes
- **Clinical Observations** — Patient presentation, affect, behavior
- **Potential Diagnosis** — Impressions only (therapist review required)
- **Treatment Recommendations** — Evidence-based suggestions
- **Follow-Up** — Recommended timeframe

All output stored in `ai_session_notes.structured_content` as JSON.

### Real-Time Copilot (during session)
- Clinical suggestions every 5 transcript segments
- Emotional context tracking (grief, fear, anxiety, etc.)
- Crisis keyword detection → therapist alert + risk assessment
- AI pause/resume (OFF RECORD mode)

### AI Workspace (post-session)
- Therapist chat about specific sessions or patients
- Context-aware: select session or patient from dropdown
- Modes: Copilot, Note Generator, Session Prep, Patient Summary, Treatment Planner, Assessment Analyzer, Referral Writer
- Credit system: 5 messages/session for PAYG plans; unlimited on paid plans

---

## Patient Model

Patients in 24Therapy are **not required to create accounts**.

| Scenario | Patient Record | User Account |
|----------|---------------|--------------|
| Offline/in-person | Created automatically (source: `offline_session`) | None required |
| Online (join link) | None created until therapist links | None required |
| Full patient | Created by therapist | Optional — for portal access |

Patient email is optional and used only for:
1. Sending session report after therapist approves
2. Looking up existing patient record within the org

---

## Plan Feature Matrix

| Feature | PAYG | Starter ($59/mo) | Unlimited ($99/mo) | Practice ($249/mo) |
|---------|------|------------------|-------------------|-------------------|
| Sessions | $6/session | 20/mo | Unlimited | Unlimited |
| AI Transcription | ✓ | ✓ | ✓ | ✓ |
| SOAP Notes | ✓ | ✓ | ✓ | ✓ |
| AI Copilot | ✓ | ✓ | ✓ | ✓ |
| AI Chat messages | 5/session | Unlimited | Unlimited | Unlimited |
| Recordings | — | ✓ | ✓ | ✓ |
| Radar Matching | — | ✓ | ✓ | ✓ |
| HIPAA BAA | — | ✓ | ✓ | ✓ |
| Analytics | Basic | Basic | Full | Full |
| Treatment Plans | ✓ | ✓ | ✓ | ✓ |
| Multi-location | — | — | — | ✓ |
| White-label | — | — | — | ✓ |
| EHR Integration | — | — | — | ✓ |
| Dedicated support | — | — | — | ✓ |

---

## Out of Scope for MVP

- Patient portal login (patient sees notes via email — no account needed)
- Group therapy sessions
- Prescribing / medication management
- Insurance billing / claims
- EHR system direct integrations (data export only in MVP)
- Multi-language transcription (English only in MVP)
- Session recording archival (7-year HIPAA retention — post-MVP)
- Real-time therapist-to-therapist messaging within sessions

---

## Security & HIPAA

- All PHI access logged to `phi_access_log` (HIPAA §164.312)
- Break-glass emergency access with audit trail
- AES-256-GCM message encryption at rest
- JWT auth with 30-min idle timeout + 4-hour absolute timeout
- No CORS wildcard in production
- Crisis events never expose risk level to patient (only supportive message)
- Sentry error monitoring with PHI stripped from request data
