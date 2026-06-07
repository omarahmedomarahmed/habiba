# 24Therapy.ai — Part 11: Complete Screen-by-Screen UI Specification, Navigation Architecture, Component Library & Design System

---

## Design Objective

The product should immediately communicate:
Trust · Intelligence · Professionalism · Safety · Clinical Quality · Modern Technology

The interface should feel like:
- Modern healthcare software · Enterprise SaaS · AI-native platform

**Not:** Meditation app · Wellness startup · Consumer chatbot

---

## Visual Brand System

### Color System

| Token | Value |
|-------|-------|
| Primary Navy | `#0A2342` |
| Secondary Navy | `#123A63` |
| Deep Blue | `#1E4F8C` |
| Accent Blue | `#2F80ED` |
| Success | `#27AE60` |
| Warning | `#F2C94C` |
| Danger | `#EB5757` |
| Neutral (50–900) | Full scale |

### Typography
- Primary Font: **Inter**
- Headings: Bold | Body: Regular | Data: Medium

### Icon System
Recommended: **Lucide** or **Heroicons**

### Grid System
- Desktop: 12 columns
- Tablet: 8 columns
- Mobile: 4 columns

### Responsive Breakpoints
- Mobile: 0–768px
- Tablet: 768–1024px
- Desktop: 1024–1440px
- Wide: 1440px+

---

## Public Website

### Home Page

**Purpose:** Convert visitors into AI chat users, Patients, Therapists

**Hero Section:**
- Left: Headline + Subheadline + Buttons + Trust indicators
- Right: Interactive AI Chat Demo + Live animation

**Headline:** Mental Health Support Powered By AI. Delivered By Humans.

**CTA:** Start Chatting · Book Session · For Therapists

**Trust Bar:** Licensed Therapists · Response Time · Patients Helped · Countries Supported

**How It Works:** Step 1 Chat → Step 2 Get matched → Step 3 Meet therapist → Step 4 Receive support

---

### Therapist Landing Page
Sections: Hero · Benefits · AI Scribe Demo · Workflow Demo · ROI Calculator · Testimonials · Pricing · FAQ · Book Demo

---

### AI Scribe Page
**Hero:** "Turn Every Therapy Session Into Clinical Documentation Automatically"
Interactive Demo: Live Transcript → AI Notes → SOAP Generation → Risk Detection

---

### Developer Page
API Overview · Architecture · SDKs · Examples · Documentation · Sandbox

---

### Login Experience
Options: Email · Google · Microsoft · Magic Link · SSO

---

## Patient Portal

### Patient Home
**Purpose:** Show next action immediately.

Cards: Upcoming Session · Mood Today · Progress · Messages · Reports · AI Support

### Patient Navigation
Home · Sessions · Reports · Messages · Progress · Resources · Settings

### Patient Progress Page
Widgets: Mood Trend · Assessment Scores · Goals · Attendance · Progress Timeline

### Session History Page
Table: Date · Therapist · Type · Duration · Status · Actions (View / Download / Share)

### Report Page
Contains (therapist-approved only):
Session Summary · Insights · Goals · Recommendations · Homework · Resources

---

## Therapist Application

### Therapist Application (Onboarding)
Step 1: Basic Info
Step 2: License Verification
Step 3: Education
Step 4: Specializations
Step 5: Availability
Step 6: Video Introduction
Step 7: Agreement
Step 8: Review

---

### Therapist Dashboard

**Layout:**
- Top: Metrics
- Middle: Upcoming Sessions
- Right: AI Alerts
- Bottom: Tasks

**Dashboard Metrics:**
Today's Sessions · Patients Seen · Pending Reports · Revenue · Radar Requests · AI Saved Time

### Therapist Sidebar Navigation
Dashboard · Patients · Sessions · Calendar · Radar · AI Copilot · Reports · Tasks · Practice · Billing · Settings

---

## Patients Page

**Purpose:** Become therapist CRM.

### View Modes
Table · Cards · Timeline

### Table Columns
Name · Risk · Last Session · Next Session · Diagnosis · Medication · Status

---

## Patient Profile Screen

### HEADER
Name · Photo · Age · Risk Badge · Actions

### Quick Actions
Schedule · Message · Start Session · Add Note · Upload File

### Profile Tabs
Overview · Sessions · Reports · Assessments · Treatment · Medication · Files · Messages · Timeline · AI Insights

### Timeline Tab
Chronological entries: Session · Medication · Assessment · File Upload · Diagnosis · Treatment Update — all searchable

---

## Session Center (Most Valuable Screen)

### Layout
```
Patient Context | Session Area | AI Copilot
```

### Patient Context Panel
Diagnosis · Goals · Medication · Risk Level · Last Summary · Recent Assessments · Upcoming Tasks

### Session Area
Video · Transcript · Chat · Files

### AI Copilot Panel
Suggested Questions · Themes · Risk Indicators · Assessment Suggestions · Treatment Suggestions

### Live Transcript
Features: Speaker Labels · Search · Bookmarks · Flags · Notes · Highlights

### AI Recommendation Cards
Examples:
- Explore sleep issues
- Discuss medication adherence
- Assess anxiety triggers
- Follow up on work stress

**Therapist decides. AI never acts autonomously.**

---

## Report Center

**AI Generated:** SOAP · DAP · BIRP · Custom

**Review Workflow:**
Generate → Review → Edit → Approve → Sign → Publish

---

## AI Copilot Page

Standalone therapist AI.

**Examples:**
- Summarize patient
- Prepare next session
- Generate treatment plan
- Review medications
- Analyze progress

---

## Radar Page

**Unique company feature.**

Incoming Requests — Live Queue Cards Display:
Wait Time · Urgency · Budget · Language · Match Score
Buttons: Accept · Decline · View Details

---

## Practice Page

**Tabs:** Overview · Users · Patients · Revenue · Analytics · Billing · Settings

**Practice Analytics:** Revenue · Retention · Utilization · Growth · Outcomes · Satisfaction

---

## Billing Page
Revenue · Invoices · Subscriptions · Payouts · Taxes · Usage

---

## Settings Page
Profile · Notifications · Calendar · Integrations · Security · AI Settings · Billing · Compliance

---

## Admin Portal

### Navigation
Dashboard · Organizations · Users · Revenue · Compliance · Support · Analytics · Infrastructure · AI

### Admin Dashboard Metrics
Active Therapists · Patients · Sessions · Revenue · MRR · AI Costs · Infrastructure Health

### Compliance Center
Tracks: Consent · Data Requests · Audit Logs · Retention · Exports · Deletion Requests

### Infrastructure Page
API Usage · Latency · Errors · Storage · Bandwidth · Cost

---

## Developer Portal

### Navigation
Overview · API Keys · Webhooks · Logs · Usage · Billing · Documentation · SDKs

### API Key Management
Generate · Rotate · Disable · Audit

### Webhook Management
Session Events · Patient Events · Report Events · Billing Events · Radar Events

---

## Mobile Applications

### Patient App
Home · Sessions · Reports · Chat · Progress

### Therapist App
Dashboard · Patients · Radar · Calendar · Reports

### Admin App
Monitoring · Alerts · Revenue · Support

---

## Design Component Library

### Core Components

| Component | Usage |
|-----------|-------|
| Button | Primary / Secondary / Ghost / Danger / Link |
| Input | Text, Email, Phone, Password, Date, Time, Search, Multi-select, Tags |
| Textarea | Auto-expand, Markdown support (future), Voice input |
| Dropdown | Searchable — Patients, Therapists, Medications |
| Table | Sorting, Filtering, Column selection, Export, Bulk actions |
| Card | Statistic, Patient, Session, Alert, AI, Revenue |
| Badge | Active, Pending, Completed, Premium, Urgent |
| Avatar | Photo or fallback initials |
| Modal | Small / Medium / Large / Fullscreen |
| Drawer | Preferred for editing/creating (less disruptive) |
| Toast | Top-right, for Saved/Generated/Uploaded/Error |
| Empty State | Never blank — always with CTA |
| Loading | Skeletons + Progress indicators |
| Timeline | Chronological entries |
| Chat | Session and AI chat |
| Transcript | Speaker detection, bookmarks, tags |
| Video Panel | WebRTC session view |
| Metric Card | Dashboard stats |
| Chart | Line, Bar, Area for analytics |
| Alert | Info / Success / Warning / Critical |

---

## Accessibility Requirements

- WCAG Compliance
- Keyboard Navigation
- Screen Readers
- Contrast Ratios
- Font Scaling

---

## Internationalization

Support: LTR · RTL · Arabic · English · French · Spanish · Future Languages

---

## UX North Star

A therapist should be able to:
1. Open platform
2. Find patient
3. Run session
4. Generate report
5. Finish documentation

**All within one workflow. Without switching tools. Without losing context. Without spending hours on administration.**
