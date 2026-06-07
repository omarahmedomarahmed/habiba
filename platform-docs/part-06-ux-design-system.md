# 24Therapy.ai — Part 6: Complete UX Architecture, Design System, Screen Specifications, Components, Workflows & AI Experiences

---

## Design Philosophy

The platform should feel like a combination of:
- Linear · Notion · Stripe · OpenAI · Ramp · Mercury · Vanta · Modern Healthcare Software

While maintaining:
- Clinical trust · Emotional safety · Enterprise professionalism · Simplicity under complexity

---

## UX Principles

### Principle 1 — One Click Rule
The user should never require more than one click to reach their most common task.
- Therapist: Start Session
- Patient: Book Session
- Admin: View Metrics

### Principle 2 — AI Visible But Not Dominant
AI should feel present. Not overwhelming. Not intrusive. Not constantly interrupting.
AI appears: when useful · when requested · when risk is detected · when context is available

### Principle 3 — Information Density Control
- Beginner therapist: Simple interface
- Advanced therapist: Power user interface
- Both supported simultaneously

---

## Global Layout System

Every application uses:
- Top Navigation
- Left Sidebar
- Main Content
- Right AI Panel
- Footer Utilities

---

## Global Header
Contains: Platform Logo · Global Search · Notifications · Messages · AI Assistant · Profile · Settings

---

## Global Search (CMD+K / CTRL+K)

Universal search across: Patients · Sessions · Reports · Transcripts · Therapists · Organizations · Messages · Invoices · Assessments · Medications · Tasks

Should feel like Linear Spotlight / Raycast.

---

## AI Command Bar

Most important productivity feature. Accessible anywhere.

Examples:
- Create patient · Find next session · Summarize John Smith
- Show anxiety trends · Generate report · Book session
- Show pending notes · Find medication history

---

## Design System

### Typography
**Primary Font:** Inter (fallback: System Fonts)

| Scale | Size |
|-------|------|
| Hero | 64px |
| Page Title | 48px |
| Section | 36px |
| Card Titles | 28px |
| Widget Titles | 20px |
| Body | 16px |
| Secondary | 14px |
| Metadata | 12px |

### Spacing Scale
4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128

### Border Radius
8 · 12 · 16 · 24

### Shadows
Subtle · Professional · Never excessive

### Animations
Fast · Smooth · Functional · Never decorative · Max 300ms

---

## Therapist Portal

### Primary Navigation (Sidebar)
Dashboard · Patients · Sessions · Calendar · Radar · AI Copilot · Reports · Practice · Billing · Settings

### Therapist Dashboard Sections

**Section 1 — Today's Overview:**
Cards: Today's Sessions · Patients Seen · Pending Reports · Revenue Today · Radar Availability

**Section 2 — Upcoming Sessions:**
List: Patient Name · Time · Session Type · Status · Actions (Join / Prepare / Reschedule)

**Section 3 — AI Insights:**
Recent Patient Risks · Follow-Up Opportunities · Medication Alerts · Attendance Risks · Treatment Progress

**Section 4 — Recent Activity:**
Session Completed · Report Generated · Patient Added · Medication Updated

---

## Patient Database

**Purpose:** Become therapist's second brain.

### List View Columns
Name · Age · Last Session · Risk Score · Diagnoses · Upcoming Session · Medication Status · Actions

### Filters
Diagnosis · Risk · Last Session · Therapist · Medication · Status · Language

---

## Patient Profile — Tabs

Overview · Sessions · Reports · Assessments · Medications · Treatment Plans · Files · Messages · AI Insights · Billing · Activity

### Overview Tab
Patient Photo · Basic Info · Contact Info · Emergency Contact · Current Diagnoses · Risk Status · Current Medications · Treatment Goals · Upcoming Appointments

### AI Insights Tab
Behavioral Trends · Emotional Patterns · Risk Changes · Treatment Progress · Attendance Trends · Medication Patterns · Conversation Themes · Life Events Timeline

---

## Session Center

### Session Room Layout
```
LEFT: Patient Context (Snapshot, Diagnoses, Medications, Goals, Risk, Last Summary)
CENTER: Video / Audio / Transcript / Notes / Timeline
RIGHT: AI Copilot (Suggested Qs, Themes, Concerns, Assessments, Treatment Ideas, Medication Mentions)
BOTTOM: Record | Pause | Bookmark | Create Note | Flag | Add Task | Upload | Share Screen | End Session
```

### Session Recording System
Types: Audio · Video · Transcript · AI Notes
Storage: Encrypted · Versioned · Audited · Permission Controlled

---

## Transcript Viewer

Features: Speaker Detection · Search · Bookmarks · Tags · Highlights · Jump to Recording · Jump to Notes · Export

Auto-generated tags:
Anxiety · Depression · Trauma · Family · Work · Sleep · Medication · Relationships · Goals · Risk

---

## Report Generation Center

After session, AI generates:
Clinical Summary · SOAP · DAP · BIRP · Progress Report · Treatment Recommendations · Patient Summary · Homework · Follow Up Plan

Therapist workflow: Edit → Approve → Reject → Regenerate → Sign → Publish

---

## Treatment Plan Center

Contains: Objectives · Milestones · Tasks · Assessments · Interventions · Target Dates · Progress

---

## Patient App

### Home
Mood Check · Upcoming Session · Progress · Messages · AI Support · Resources

### Daily Mood Check
Metrics: Mood · Stress · Anxiety · Sleep · Energy · Focus · Motivation → Charts generated

### Patient AI Assistant
**Can:** Explain Reports · Prepare for Session · Track Goals · Track Mood · Answer Platform Questions · Schedule Appointments

**Cannot:** Diagnose · Prescribe · Replace Therapist

---

## Radar Marketplace Interface

### Therapist Radar Screen
Shows: Incoming Requests · Urgency · Budget · Language · Estimated Session Length · Match Score
Buttons: Accept · Decline · View Details

### Radar Matching Engine Scores
Language · Availability · Specialization · Ratings · Response Time · Patient Preferences · Location

---

## Practice Management

### Owner Dashboard
Therapists · Assistants · Locations · Revenue · Utilization · Performance · Growth

### Team Management
Invite User · Assign Role · Assign Patients · Assign Locations · Set Permissions · Track Activity

---

## Calendar System
Supports: Google Calendar · Microsoft Outlook · Apple Calendar · Internal Calendar

---

## Billing Portal
Therapist Billing · Practice Billing · Patient Billing · Enterprise Billing
Invoices · Receipts · Payouts · Subscriptions · Taxes · Credits · Usage

---

## Developer Portal
API Keys · Webhooks · Logs · SDKs · Documentation · Sandbox · Usage Analytics · Rate Limits

---

## Mobile Experience

### Patient Mobile
Chat · Book Session · Join Session · Reports · Progress · Notifications

### Therapist Mobile
Radar · Patients · Sessions · AI Notes · Calendar · Messages

---

## Super Admin Portal

Sections: Organizations · Users · Revenue · Infrastructure · AI Usage · Security · Compliance · Support · Analytics · Developer Ecosystem

### Infrastructure Dashboard
CPU · Memory · Latency · API Traffic · AI Costs · Storage · Errors · Incidents

### AI Orchestration Center
Model Usage · Cost · Latency · Accuracy · Provider · Fallbacks · Performance
Can dynamically route: OpenAI · Anthropic · Custom Models · Local Models

---

## Feature Flag System

Allows: Enable Feature · Disable Feature · Beta Test · Rollout Gradually · Organization-Specific Releases

---

## Experimentation Platform

A/B Testing: Onboarding · Pricing · AI Prompts · Reports · UI · Flows

---

## Future Modules

- Psychiatry Suite
- Medication Intelligence
- Insurance Claims
- Provider Credentialing
- University Counseling
- Corporate Wellness
- Family Therapy
- Group Therapy
- Research Platform
- AI Outcome Prediction
- Clinical Benchmarking
- White Label Networks

---

## Ultimate Product Vision

A patient enters through AI.  
A therapist conducts sessions.  
AI handles documentation.  
Practice owners manage operations.  
Organizations manage care.  
Developers integrate APIs.  
Researchers generate insights.  
Healthcare systems connect infrastructure.

Everything flows through a single platform.

> **24Therapy.ai becomes: The Operating System for Mental Healthcare.**  
> Not a tool. Not an app. Not an AI scribe. A complete infrastructure layer.
