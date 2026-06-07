# 24Therapy.ai — Part 10: Complete User Lifecycle Architecture, Workflows, State Machines, Notifications, Automations, Permissions, Onboarding & Operational Logic

## PRODUCT PHILOSOPHY

Most SaaS products focus on screens. **Great products focus on workflows.**

24Therapy must be designed around:
- Patient journeys
- Therapist journeys
- Practice journeys
- Session journeys
- Recovery journeys

Every feature must support one of those journeys.

---

## USER TYPES

### Public Visitor
No account. Can: Chat with AI | Browse therapists | Book sessions | Learn about services
Cannot: View records | Access reports | Access patient information

### Anonymous User
Temporary identity. Created automatically. Can: Chat with AI | Start intake | Request Radar session | Receive temporary session link. May later convert into patient account.

### Patient
Can: Manage sessions | View approved reports | Track progress | Message therapists | Complete assessments

### Therapist
Can: Manage patients | Conduct sessions | Use AI copilot | Generate reports | Manage treatment plans

### Assistant
Can: Manage scheduling | Manage billing | Manage contact information
Cannot: View session recordings | View clinical notes | View transcripts

### Practice Owner
Can: Manage organization | Manage therapists | Manage billing | View analytics

### Internal Staff
Sales | Support | Success | Finance | Compliance | Operations

### Admin
System management.

### Super Admin
Platform-wide control.

---

## COMPLETE USER LIFECYCLE

### Visitor Journey
```
Visitor lands → Website → AI Chat → Value received → Session booked → Account created → Patient retained → Patient advocates
```

### Patient Lifecycle
```
Discovery → AI Chat → Assessment → Therapist Match → Session → Treatment → Progress → Recovery → Advocacy
```

### Therapist Lifecycle
```
Application → Verification → Approval → Onboarding → Patient Acquisition → Revenue Growth → Practice Expansion → Enterprise Adoption
```

---

## PATIENT ONBOARDING FLOW

### First Visit

**Step 1 — Mood Selection:**
Anxious | Depressed | Stressed | Burned Out | Lonely | Relationship Issues | Not Sure

**Step 2 — Urgency:**
Today | This Week | Emergency | Exploring Options

**Step 3 — AI Chat Begins**
AI builds initial profile. **No signup required.**

### Patient Account Creation
Triggered after: Booking | Session Completion | Report Request | Progress Tracking

**Required fields:** Name | Email | Phone | Country | Language | Password

**Optional fields:** Date of Birth | Gender | Emergency Contact

---

## PATIENT DASHBOARD WORKFLOWS

### Book Session
```
Book Session → Select Therapist → Choose Date → Payment → Confirmation
```

### Join Session
```
Join Session → Waiting Room → Consent → Session → Report
```

### Assessment
```
Assessment → Completion → Scoring → Storage → Progress Tracking
```

---

## THERAPIST APPLICATION WORKFLOW
```
Application Submitted
  ↓ Credential Upload
  ↓ Verification
  ↓ Interview
  ↓ Approval
  ↓ Activation
  ↓ Training
  ↓ Live
```

---

## THERAPIST ONBOARDING (9 Steps)

| Step | Action |
|------|--------|
| Step 1 | Profile setup |
| Step 2 | Specializations selection |
| Step 3 | Languages supported |
| Step 4 | Availability configuration |
| Step 5 | Pricing setup |
| Step 6 | License verification |
| Step 7 | Calendar sync |
| Step 8 | First patient import |
| Step 9 | First session |

---

## PATIENT IMPORT WORKFLOW

**Supported formats:** CSV | Excel | JSON | Future EHR Imports

**Import fields:** Patient Name | Email | Phone | Diagnoses | Notes | Medications | Tags | Therapist

AI cleans data, maps fields, creates records, flags errors.

---

## SESSION STATE MACHINE

```
Draft
  ↓ Scheduled
  ↓ Confirmed
  ↓ Waiting
  ↓ Live
  ↓ Completed
  ↓ Processed
  ↓ Signed
  ↓ Archived
```

**Alternative Paths:** Cancelled | No Show | Refunded | Deleted

---

## RADAR SESSION STATE MACHINE

```
Created
  ↓ Broadcast
  ↓ Matched
  ↓ Accepted
  ↓ Session Generated
  ↓ Live
  ↓ Completed
  ↓ Archived
```

**On timeout:** Escalation → Rebroadcast

---

## AI PROCESSING PIPELINE (Post-Session)

```
Session Ends
  ↓ Transcript Finalized
  ↓ Topic Extraction
  ↓ Memory Update
  ↓ Risk Review
  ↓ Documentation Generation
  ↓ Report Creation
  ↓ Therapist Review
  ↓ Approval
  ↓ Patient Distribution
```

---

## REPORT APPROVAL WORKFLOW

```
Generated
  ↓ Draft
  ↓ Reviewed
  ↓ Edited
  ↓ Signed
  ↓ Published
  ↓ Shared
  ↓ Archived
```

---

## NOTIFICATION ENGINE

Every event can generate notifications.

**Channels:** In-App | Email | SMS | Push | WhatsApp (Future)

### Patient Notifications
- Upcoming Session reminder
- Session Reminder (24h, 1h)
- Report Available
- Assessment Due
- Message Received
- Payment Confirmed
- Goal Achieved

### Therapist Notifications
- Radar Request incoming
- Upcoming Session
- Pending Reports to review
- Medication Alert
- Patient Risk Alert
- Assessment Review required
- Billing Event

### Admin Notifications
- Support Escalation
- Compliance Alert
- Security Alert
- Revenue Alert
- Infrastructure Alert

---

## EMAIL SYSTEM

**Types:** Transactional | Marketing | Operational | Compliance

### Email Templates
| Template | Trigger |
|---------|---------|
| Welcome | Account creation |
| Verify Email | Registration |
| Password Reset | Forgot password |
| Session Reminder | 24h/1h before session |
| Session Completed | After session ends |
| Report Ready | Note approved |
| Assessment Reminder | Assessment due |
| Payment Receipt | Payment processed |
| Therapist Approved | Application approved |
| Practice Invitation | Team invite |
| Radar Match | Instant session matched |

---

## SMS SYSTEM

Used only for critical actions:
- Session Starting (5 min warning)
- Radar Match (instant)
- Verification codes
- Security Alerts

---

## TASK MANAGEMENT SYSTEM

Internal productivity layer. Tasks can belong to:
- Patient
- Session
- Treatment Plan
- Therapist
- Practice
- Admin Team

**Task Status:** Open | In Progress | Blocked | Completed | Archived

---

## INTERNAL MESSAGING

- Therapist ↔ Assistant
- Therapist ↔ Therapist
- Practice ↔ Team
- Admin ↔ Staff

Separate from patient communication.

---

## PATIENT COMMUNICATION CENTER

**Channels:** Chat | Email | Notifications | Video Sessions

Everything stored. Audited. Searchable.

---

## FILE MANAGEMENT SYSTEM

Patient Files | Reports | Assessments | Recordings | Documents | Images | PDFs | Insurance | Licenses

**Versioned.** Version Control: Every important object versioned (Report v1, v2, v3; Treatment Plan v1, v2).

---

## PERMISSION MATRIX

| Role | Access |
|------|--------|
| **Therapist** | Own Patients, Own Sessions, Own Reports |
| **Assistant** | Scheduling, Billing, Contact Info |
| **Practice Owner** | All Practice Data |
| **Admin** | Platform Data |
| **Super Admin** | Everything |

Every permission individually configurable.

---

## FEATURE FLAGS

Organization-specific feature toggles:
- Radar
- API Access
- White Label
- Custom Branding
- Advanced Analytics
- AI Premium

Allows gradual rollout.

---

## AUTOMATION ENGINE

Users create workflows. Examples:

### Workflow 1: Session End
```
When Session Ends
  → Generate Report
  → Notify Therapist
  → Send Assessment
  → Schedule Follow Up
```

### Workflow 2: Medication Update
```
Medication Updated
  → Notify Therapist
  → Create Review Task
  → Update Timeline
```

---

## AI AUTOMATION ENGINE (Future Premium)

```
Patient misses 3 sessions
  ↓ AI detects risk
  ↓ Create task
  ↓ Notify therapist
  ↓ Recommend outreach
```

---

## SUBSCRIPTION STATE MACHINE

```
Trial
  ↓ Active
  ↓ Past Due
  ↓ Suspended
  ↓ Cancelled
  ↓ Archived
```

Handles all billing edge cases.

---

## DATA RETENTION POLICIES

Configurable by organization, subject to compliance requirements.

**Data types with retention rules:**
- Recordings
- Transcripts
- Reports
- Assessments
- Messages
- Audit Logs

---

## SEARCH ARCHITECTURE

Search everything platform-wide:
- Patients
- Sessions
- Reports
- Messages
- Files
- Tasks
- Invoices
- Assessments
- Treatments

Global search available platform-wide.

---

## ACTIVITY FEED

Every organization gets activity feed. Examples:
- Patient Added
- Session Completed
- Report Approved
- Medication Updated
- Assessment Submitted

---

## ORGANIZATION SETTINGS

| Category | What's Configurable |
|---------|-------------------|
| General | Name, branding, timezone |
| Branding | Logo, colors, domain |
| Billing | Subscription, payment methods |
| Security | MFA, SSO, IP restrictions |
| Users | Invites, roles, permissions |
| Notifications | Channels, preferences |
| Compliance | Retention, audit, consent versions |
| API | Keys, webhooks |
| Integrations | EHR, calendar, payment |
| AI Settings | Features on/off |

---

## AI SETTINGS (Organization-Specific)

Controls:
- Transcript Generation (on/off)
- Recording (on/off)
- AI Notes (on/off)
- Risk Detection sensitivity
- Assessments (on/off)
- Memory Retention (duration)
- Automation (on/off)
- Report Styles (SOAP/DAP/BIRP/Custom)

---

## THE FINAL PRODUCT EXPERIENCE

**For therapists:** One system. Everything connected. AI everywhere. No extra work.

**For patients:** Fast access. Professional care. Simple experience. Transparent progress.

**For practices:** Revenue. Operations. Visibility. Control.

**For enterprises:** Compliance. Security. Scale. Integration.
