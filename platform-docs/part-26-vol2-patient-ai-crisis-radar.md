# Part 26 — AI System Architecture (Volume 2)
Patient AI Companion, Crisis Routing, Radar Intelligence, Treatment Workflows, Therapist Agent, Practice Agent, Multi-Agent Systems & Mental Health Foundation Model

---

## The Second Side of the Platform

Volume 1 focused on: **Therapist Intelligence**  
Volume 2 focuses on: **Patient Intelligence**

Most mental health platforms begin when a therapist starts a session.  
**24Therapy begins before that.**

The first interaction often happens with: **The AI Companion**

---

## AI Companion Mission

The AI Companion is not therapy.  
The AI Companion is not a licensed clinician.  
The AI Companion should clearly disclose that it is an AI system and encourage users to seek professional help when appropriate.

**Goals:**
- Reduce friction
- Help users express concerns
- Gather context
- Encourage professional care
- Improve matching
- Support engagement between sessions

---

## First-Time User Flow

```
User arrives
     ↓
Primary CTA: "Talk To Someone Now"
Secondary CTA: "Chat With AI First"
```

No signup required initially.

---

## Mood Check Flow

Before conversation: 2–3 quick questions.

**Question 1:**
> "How are you feeling today?"
> 😔 😟 😐 🙂 😊

**Question 2:**
> "What best describes what brought you here?"
> Stress · Anxiety · Depression · Relationships · Trauma · Not Sure

**Question 3:**
> "Would you like:"
> - Someone to talk to now
> - Explore resources
> - Book later

**Entire flow:** Under 15 seconds.

---

## AI Companion Personality

**Brand principles:**
- Warm
- Calm
- Supportive
- Clear
- Non-judgmental

**Avoid:**
- False promises
- Overconfidence
- Pretending to be human
- Making clinical determinations

---

## Companion Memory

**Anonymous mode:** Local session memory only.

**Registered users:** Persistent memory with user consent.

**Stores:**
- Topics
- Goals
- Preferences
- Past conversations

---

## AI Companion Capabilities

**Can:**
- Help users organize thoughts
- Provide psychoeducational information
- Suggest journaling prompts
- Suggest coping exercises
- Encourage professional support
- Help book sessions

**Should not:** Present itself as a clinician or provide medical diagnoses.

---

## Crisis Detection System

**One of the most sensitive systems.**

**Goal:** Identify potentially urgent situations.

**Examples of signals:**
- References to self-harm
- Suicidal thinking
- Violence
- Medical emergencies
- Immediate danger

**System response:** Escalation pathways appropriate to jurisdiction, risk level, available resources, and platform policy.

### Crisis Engine

**Inputs:** Chat · Voice · Video transcript · Messages

**Outputs:**
- Risk score
- Risk category
- Suggested actions
- Escalation workflow

### Risk Levels (Internal Classification)

| Level | Description |
|-------|-------------|
| Low | No immediate concern |
| Moderate | Monitoring warranted |
| Elevated | Increased attention needed |
| High | Prompt clinical review |
| Critical | Immediate action pathway |

> **Note:** These are internal workflow classifications. Human review and established clinical protocols remain essential.

### Crisis Routing

Possible actions:
- Provide emergency resources
- Offer immediate connection to therapist
- Increase monitoring
- Trigger internal review workflows

> System should be designed with clinical governance and legal review.

---

## Radar Intelligence Engine

**One of the most unique assets.**

**Goal:** Find the **best** therapist available right now.

Not simply: "Available Therapist"  
Instead: **"Best Available Therapist"**

### Matching Factors

| Factor | Weight |
|--------|--------|
| Language | 30% |
| Specialty Match | 30% |
| Availability | 20% |
| Experience | 10% |
| Response Rate | 10% |

### Radar Score

Each therapist receives a **Match Score**.

```
Language Match      30%
Specialty Match     30%
Availability        20%
Experience          10%
Response Rate       10%
                   ────
Total              100%
```

Highest score gets priority.

### Smart Wait Time Prediction

**Patient sees:**
> "Estimated Wait: 7 Minutes"

**Based on:**
- Current availability
- Historical acceptance patterns
- Queue depth

---

## Therapist Agent

A dedicated AI for each therapist. Separate from patient AI.

**Purpose:** Practice assistant.

**Therapist can ask:**
- "Summarize this patient."
- "Show progress."
- "What goals remain open?"
- "What happened last session?"

**Agent searches:** Patient records · Notes · Reports · Memories · Assessments

**Returns:** Answers instantly.

### Therapist Knowledge Assistant

Can answer complex queries:
- "Show all sessions where sleep was discussed."
- "What medications have changed over the last six months?"

This becomes extremely valuable over time.

---

## Practice Agent

**For clinics and organizations.**

**Questions it can answer:**
- "Which therapists have capacity?"
- "Which patients missed appointments?"
- "Show utilization this month."
- "Which assessments are overdue?"

→ Operational intelligence for practice managers.

---

## Customer Success Agent

**Internal company tool.**

**Can answer:**
- "Which customers may churn soon?"
- "Who has low usage?"

Helps retention team prioritize outreach.

---

## Sales Agent

**Internal use.**

**Questions:**
- "Show all therapists who booked demos but never converted."
- "Rank leads by likelihood to subscribe."

---

## Treatment Workflow Engine

**Important future feature.**

The system supports structured care pathways.

**Examples:**
- Anxiety support workflows
- Sleep improvement workflows
- Stress management workflows
- Trauma-informed workflows
- ADHD support workflows

> These are configurable care support frameworks — **not** autonomous treatment plans.

### Workflow Components

| Component | Description |
|-----------|-------------|
| Assessments | Structured measurement tools |
| Goals | Patient-specific objectives |
| Exercises | Therapeutic homework |
| Follow-Ups | Scheduled check-ins |
| Educational Content | Psychoeducation resources |
| Progress Tracking | Outcome monitoring |

### Workflow Automation Example

```
Assessment Completed
      ↓
Goal Suggested
      ↓
Exercise Assigned
      ↓
Follow-Up Reminder
```

Therapist approval required where appropriate.

---

## Medication Intelligence

**One of the most complex future systems.**

**Purpose:** Track medication-related information.

**Capabilities:**
- Medication history
- Dosage tracking
- Adherence tracking
- Side-effect documentation
- Review reminders

### Medication Timeline

```
Medication A
10mg → 20mg → 30mg
```

Full historical view for every medication.

### Medication Adherence Tracking

Patient reports:
- Taking Consistently ✅
- Occasionally Missed ⚠️
- Frequently Missed ❌

Trend analysis available for clinical review.

---

## Assessment Intelligence

Assessment completion becomes structured intelligence.

**Standard assessments supported:**
- PHQ-9 (Depression)
- GAD-7 (Anxiety)
- ASRS (ADHD)
- PCL-5 (PTSD/Trauma)
- Custom assessments

### Assessment Insights

System may highlight:
- **Score Improved** ↑ (informational)
- **Score Stable** → (informational)
- **Score Worsened** ↓ (informational)

Presented as informational insights — clinical interpretation by therapist.

---

## Outcome Intelligence

**Future major differentiator.**

**Tracks:**
- Symptoms
- Goals
- Functioning
- Engagement
- Assessment trends

**Purpose:** Help clinicians understand progress over time.

### Outcome Models

| Model | What It Tracks |
|-------|---------------|
| Anxiety Trend | PHQ/GAD score progression |
| Sleep Trend | Sleep quality mentions |
| Engagement Trend | Session attendance, app usage |
| Attendance Trend | Session show rate |
| Goal Completion Trend | Goals achieved over time |

> Not predictions of individual clinical outcomes. Informational trend data only.

---

## Multi-Agent Architecture (Future Evolution)

Instead of one giant AI: **Multiple specialized agents.**

### Agent Types

| Agent | Serves |
|-------|--------|
| Patient Agent | Consumer-facing support |
| Therapist Agent | Clinical documentation |
| Practice Agent | Operations |
| Sales Agent | Internal sales |
| Support Agent | Customer support |
| Compliance Agent | Regulatory monitoring |
| Analytics Agent | Business intelligence |

### Orchestration Layer

**Routes tasks:**

Example — Therapist asks: "Generate patient summary."

```
System routes:
Memory Agent
 ↓ Report Agent
 ↓ Summary Agent
 ↓ Combines results
```

---

## Foundation Model Strategy

**Important strategic decision.**

Do not assume 24Therapy will train a frontier model immediately.

**Near-term strategy:**
- Use best available foundation models
- Add proprietary intelligence layers

### Proprietary Layer

The advantage comes from:
- Structured mental health memory
- Longitudinal patient context
- Outcome data
- Workflow intelligence
- Therapist feedback loops
- Domain-specific retrieval

> This is harder to replicate than a model itself.

---

## Mental Health Foundation Model (Long-Term)

**Future possibility** — after millions of sessions and strong governance.

Potential development of specialized behavioral-health language systems.

**Focus:**
- Clinical documentation
- Session understanding
- Behavioral pattern extraction
- Workflow assistance
- Outcome analysis

Subject to regulatory, ethical, and scientific constraints.

---

## The True Moat

Most competitors collect: **Transcripts.**

24Therapy collects:
```
Transcripts
+
Memory
+
Outcomes
+
Workflows
+
Therapist Feedback
+
Longitudinal Understanding
```

**That creates a significantly stronger intelligence layer.**

---

## Company Evolution Stages

| Stage | Identity |
|-------|----------|
| Stage 1 | AI Scribe |
| Stage 2 | Therapist Copilot |
| Stage 3 | Mental Health OS |
| Stage 4 | Behavioral Health Intelligence Platform |
| Stage 5 | Infrastructure Layer for Global Mental Healthcare |

---

## Summary: What Volume 2 Covers

✅ Patient AI Companion  
✅ Mood Intake Flow  
✅ Crisis Detection Architecture  
✅ Radar Matching Intelligence  
✅ Therapist Agent  
✅ Practice Agent  
✅ Treatment Workflow Engine  
✅ Medication Intelligence  
✅ Assessment Intelligence  
✅ Outcome Intelligence  
✅ Multi-Agent Architecture  
✅ Long-Term Foundation Model Strategy  
