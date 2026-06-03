# 24Therapy.ai — Part 2: Information Architecture, Website, User Journeys & Core Workflows

---

## Website Architecture Philosophy

The website is **not** a marketing website.  
The website is the **first layer of the product**.

Every page must move users toward one of four goals:
1. Start AI Chat
2. Book Therapy Session
3. Register as Therapist
4. Request Demo

---

## Public Website URL Structure

```
/                          Home
/features
  /features/ai-scribe
  /features/clinical-copilot
  /features/radar
  /features/practice-management
  /features/teletherapy
  /features/analytics
  /features/patient-management
  /features/api
/solutions
  /solutions/therapists
  /solutions/psychologists
  /solutions/psychiatrists
  /solutions/practices
  /solutions/clinics
  /solutions/universities
  /solutions/corporate-wellness
/pricing
/about
/contact
/blog
/resources
/security
/compliance
/hipaa
/gdpr
/terms
/privacy
/chat
/book-session
/find-therapist
/therapist-join
/demo
/login
/signup
```

---

## Home Page

**Primary Goal:** Get visitor into AI chat immediately.

### Hero Section
- **Headline:** 24/7 AI-Powered Mental Health Support
- **Subheadline:** Chat instantly with AI. Connect with licensed therapists in minutes. Let AI handle documentation while therapists focus on helping people.
- **Primary CTA:** Start AI Chat
- **Secondary CTA:** Book Session
- **Background:** Animated network visualization (Patients ↔ Therapists ↔ AI ↔ Sessions ↔ Reports)

### Page Sections
1. **Trust Section** — Stats: sessions completed, therapists onboarded, patient satisfaction, wait time, countries
2. **AI Chat Demo** — Live interactive (no registration required)
3. **Therapist Benefits** — Reduce notes 90%, AI documentation, real-time guidance
4. **Patient Benefits** — Anonymous support, instant AI conversation, therapist matching
5. **Radar Section** — User → AI Triage → Radar → Available Therapist → Session Starts
6. **AI Scribe Section** — Live note generation, session timeline, treatment recommendations
7. **Testimonials** — Patients, Therapists, Practice Owners
8. **Pricing Preview** — Free / Professional / Practice / Enterprise
9. **Footer** — Resources, Company, Legal, Developers, Social

---

## AI Chat Experience

This is the **most important feature** on the platform.

AI Chat exists **before** signup — native, not a popup.

### User Journey Flow

**First Screen:**
> Welcome. How are you feeling today?
- Anxious · Depressed · Stressed · Overwhelmed · Lonely · Not Sure

**Question 2:**
> How urgent is your situation?
- Just exploring · Need support today · Need therapist today · Emergency

**Question 3:**
> Have you spoken to a therapist before?
- Yes · No · Not sure

### AI Conversation Rules
The AI **must** clearly state:
- I am an AI assistant.
- I am not a licensed therapist.
- I cannot diagnose medical conditions.
- I can help organize thoughts and connect you with professional support.

### AI Goals
1. Help user
2. Assess urgency
3. Recommend therapist
4. Book session
5. Create account

### Crisis Detection
If user mentions suicide, self-harm, violence, immediate danger, or emergency abuse:
- AI immediately escalates
- Show emergency resources
- Suggest contacting emergency services
- Offer immediate therapist availability
- Do NOT attempt to act as emergency intervention

---

## Therapist Marketplace

Public therapist directory with search filters:
- Language · Country · Price · Availability · Specialization · Gender · Credentials · Years Experience · Session Type

### Therapist Profile
- Photo · Name · Credentials · Biography · Specialties · Languages · Pricing · Availability · Ratings · Reviews · Video Introduction · Book Now · Chat Now

---

## Book Session Flow

1. **Choose session type:** Video / Audio / Chat / In Person
2. **Choose date and time**
3. **Enter contact info** (all optional: Name, Email, Phone)
4. **Payment**
5. **Confirmation**

---

## Instant Session (Radar) Flow

```
User clicks "Need Help Now"
           ↓
System creates Radar Request
(Mood, Urgency, Language, Country, Session Type, Budget)
           ↓
Request enters Radar Network
           ↓
Available therapists receive: Push · Email · SMS · In-app alert
           ↓
First therapist accepts → Request locked
           ↓
Session room generated
           ↓
User receives: Join Link + Countdown + Session Status
```

---

## Therapist Dashboard

### Main Navigation
Dashboard · Patients · Sessions · Calendar · Radar · Reports · AI Copilot · Practice · Billing · Settings

### Dashboard Widgets
- Today's Sessions
- Upcoming Sessions
- Radar Requests
- Pending Notes
- Revenue
- Patient Activity
- Medication Alerts
- Clinical Alerts
- AI Recommendations

---

## Patients Module

### Patient Database
- Searchable · Filterable · Infinite scale

### Patient Profile Structure
Basic Information · Contact Information · Emergency Contact · Medical History · Mental Health History · Medications · Diagnoses · Assessments · Insurance · Sessions · Treatment Plans · Files · Reports · Notes · AI Insights · Risk Indicators · Consent Records · Communication History

### Patient Timeline
Every patient gets a chronological timeline including:
Session · Medication · Assessment · Diagnosis · Report · Message · Appointment · Upload · Consent · Payment

---

## Session Management

### Session Types
Video · Audio · Chat · In-person · Group · Family

### Session States
Scheduled → Waiting → Active → Completed → Cancelled → No Show → Archived

---

## Session Room Layout

```
┌─────────────────────────────────────────────────────┐
│  LEFT SIDEBAR    │     CENTER          │ RIGHT SIDEBAR│
│  Patient Info    │  Live Video/Audio   │  AI Copilot  │
│  History         │  Live Transcript    │  Suggested Q │
│  Medications     │                     │  Risk Alerts │
│  Diagnoses       │                     │  Treatments  │
├──────────────────────────────────────────────────────┤
│  BOTTOM TOOLBAR: Record | Pause | Mute | Share | Note | Flag | End │
└─────────────────────────────────────────────────────┘
```

---

## Live Transcription Engine

- Every word timestamped
- Speaker separated: Therapist · Patient · Assistant · Family Member
- Transcript updates every few seconds
- AI extracts: Symptoms · Triggers · Emotions · Medication mentions · Risk factors · Treatment goals · Behavioral patterns · Relationships · Life events

---

## Session Outputs (AI Generated)

After session, AI generates:
1. Full Transcript
2. Clinical Summary
3. SOAP Note
4. DAP Note
5. BIRP Note
6. Progress Report
7. Treatment Recommendations
8. Medication Summary
9. Patient Summary
10. Homework Recommendations
11. Risk Assessment
12. Billing Summary

**Workflow:** AI generates → Therapist reviews → Approves / Edits / Signs → System distributes

---

## Therapist AI Copilot

Private AI workspace — only therapist data, never shared across practices.

**Example queries:**
- Summarize patient progress
- What changed since last session?
- What medications discussed?
- Show anxiety triggers
- Generate treatment plan
- Create follow-up homework
- Show risk indicators

---

## Therapist Memory System

Long-term intelligence layer tracking:
- Mood trends · Symptoms · Medication adherence · Attendance · Treatment progress · Goals · Behavioral changes · Risk changes

Generates: Weekly / Monthly / Quarterly / Annual summaries

> This becomes the therapist's **second brain**.

---

## Medication Management

Toggle: On / Off

When enabled, track:
- Medication Name · Dosage · Frequency · Prescriber · Start/End Dates · Changes · Side Effects · Compliance · Interactions · Notes

**Medication Timeline** shows all changes over time.

AI watches for: Missed medications · Changes · Conflicts · Side effect mentions · Compliance concerns
