# 24Therapy.ai — Part 13: Complete AI Architecture, Agent System Design, Clinical Copilot Framework, Memory Engine, Risk Detection, Model Orchestration & Mental Health Intelligence Layer

## IMPORTANT PRODUCT PRINCIPLE

24Therapy.ai is **AI-assisted care infrastructure**, not autonomous mental healthcare.

The platform must never position itself as:
- A therapist
- A psychiatrist
- A psychologist
- A medical provider

The platform **assists licensed professionals** and **supports patients between sessions**.

This distinction is critical for: Compliance | Liability | Regulatory approval | Enterprise adoption | Future acquisition

---

## AI PHILOSOPHY

Most AI healthcare companies focus on: **"Generate a note."**

24Therapy should focus on: **"Understand the entire patient journey."**

---

## THE AI STACK

The platform consists of multiple specialized AI systems.

**Not one chatbot. Not one model. An orchestrated intelligence platform.**

### AI Layer Architecture

```
Input Layer
  ↓ Speech Layer
  ↓ Understanding Layer
  ↓ Memory Layer
  ↓ Clinical Intelligence Layer
  ↓ Workflow Layer
  ↓ Output Layer
```

---

## AI AGENTS (10 Specialized Agents)

### Agent 1 — Transcription Agent

**Purpose:** Convert speech into structured text.

**Responsibilities:**
- Speaker Detection & Diarization
- Timestamping (word-level)
- Language Detection
- Medical Vocabulary Recognition
- Conversation Segmentation
- Noise Handling

**Outputs:** Transcript | Speaker Labels | Confidence Scores

**Technology:** OpenAI Whisper (primary), AssemblyAI (fallback), Azure Speech (enterprise)

---

### Agent 2 — Session Intelligence Agent

**Purpose:** Understand what happened in a session.

**Identifies:**
- Topics discussed
- Themes and patterns
- Symptoms mentioned
- Medications referenced
- Life events disclosed
- Behavioral patterns observed
- Goals mentioned
- Concerns raised

**Outputs:** Session Understanding Graph — structured data representing session content

---

### Agent 3 — Clinical Documentation Agent

**Purpose:** Generate clinical documentation.

**Outputs:**
- SOAP Notes (Subjective, Objective, Assessment, Plan)
- DAP Notes (Data, Assessment, Plan)
- BIRP Notes (Behavior, Intervention, Response, Plan)
- Custom Templates (organization-defined)
- Patient-Friendly Summaries
- Progress Reports
- Treatment Updates

**Critical rule:** All outputs are drafts requiring clinician review. Must be customizable — every therapist has preferred formats.

---

### Agent 4 — Memory Agent

**One of the most important agents. This is where the moat is built.**

**Purpose:** Maintain longitudinal patient understanding.

**Responsibilities:**
- Store meaningful memories from sessions
- Merge duplicate/overlapping memories
- Update stale memories when facts change
- Link related memories together
- Track contradictions across sessions

**Example lifecycle:**
```
Session 1 → Patient reports insomnia → Memory Created: "Reports insomnia, difficulty falling asleep"

Session 12 → Patient reports sleep improved → Memory Updated: "Sleep improved after starting exercise routine (Session 12)"

AI understands progression, not just isolated facts.
```

---

### Agent 5 — Therapist Copilot Agent

**Purpose:** Support therapist during live sessions (real-time).

**Can suggest:**
- Open-ended questions based on patient history
- Topics to revisit from previous sessions
- Follow-up areas from prior goals
- Treatment planning ideas
- Documentation shortcuts

**Cannot:**
- Override therapist decisions
- Make clinical diagnoses
- Act independently
- Prescribe actions

---

### Agent 6 — Risk Intelligence Agent

**Purpose:** Monitor safety indicators throughout sessions.

**Detects patterns associated with:**
- Crisis language
- Escalating distress
- Substance misuse concerns
- Severe symptom worsening
- Safety-related language

**Produces:**
- Risk flags (for therapist review)
- Risk summaries
- Recommended follow-up actions

**Critical rule:** AI flags concerns. Licensed clinicians decide all actions. AI never escalates directly to emergency services without therapist approval.

---

### Agent 7 — Patient Support Agent

**Patient-facing AI. Consumer experience.**

**Purpose:** Support users before, after, and between sessions.

**Can:**
- Answer general mental health questions
- Explain session reports (when shared)
- Provide coping resources
- Assist with scheduling
- Track goals set with therapist
- Encourage follow-through on homework

**Cannot:**
- Diagnose any condition
- Prescribe any action
- Claim to replace a therapist

**Must repeatedly communicate:** *"I am an AI assistant, not a licensed mental health professional. For clinical decisions, please consult your therapist."*

---

### Agent 8 — Treatment Planning Agent

**Purpose:** Assist clinicians in organizing treatment plans.

**Can generate:**
- Treatment goals
- Milestones
- Homework ideas
- Review schedules
- Progress structures

**Therapist approval required for all outputs.**

---

### Agent 9 — Practice Intelligence Agent

**Purpose:** Help practice owners understand their business.

**Analyzes:**
- Utilization rates
- Revenue trends
- Patient retention
- Scheduling patterns
- Operational bottlenecks
- Documentation completion rates

---

### Agent 10 — Radar Matching Agent

**Purpose:** Match patients to the right therapists instantly.

**Factors considered:**
- Language preference
- Current availability
- Clinical specializations
- Patient preferences
- Historical match outcomes
- Pricing match
- Location/timezone
- Response time history

**Generates ranked list with match score and reasoning.**

---

## THE MEMORY ENGINE (Core Moat Architecture)

This becomes one of the largest long-term moats.

**Traditional Systems:** Store notes.
**24Therapy:** Stores **understanding**.

### Memory Categories

| Category | What's Stored |
|---------|--------------|
| Identity | Name, family structure, occupation, education, location |
| Clinical | Symptoms, diagnoses, assessments, treatments |
| Behavioral | Patterns, triggers, habits, coping strategies |
| Relationships | Partners, parents, friends, coworkers, children |
| Goals | Personal, treatment, life, recovery goals |
| Preferences | Communication style, session preferences |
| Life Events | Trauma, transitions, milestones |
| Treatment History | Prior therapists, medications, interventions |
| Medication History | All medication changes with dates |

### Memory Scoring System

Every memory receives:
- **Importance Score** (0-1): Clinical weight
- **Confidence Score** (0-1): AI certainty
- **Clinical Relevance Score** (0-1): Current treatment applicability
- **Recency Score** (0-1): Time-weighted relevance

### Memory Consolidation Process

Without consolidation: Patient accumulates thousands of raw memories.

AI continuously:
1. Merges duplicates
2. Updates facts when new information emerges
3. Archives stale/resolved information
4. Promotes critical information for session context

### Memory Graph

```
Patient
  ↓ Divorce (Life Event)
  ↓ Depression Symptoms (Clinical)
  ↓ Sleep Problems (Symptom)
  ↓ Medication Change (Treatment)
  ↓ Improvement (Outcome)
```

AI can reason through relationships. "Patient's depression symptoms worsened after divorce and improved after medication adjustment and sleep improvement."

---

## KNOWLEDGE GRAPH SYSTEM

### Nodes
Patient | Therapist | Session | Diagnosis | Medication | Goal | Assessment | Relationship | Life Event

### Edges (Relationships)
- **Causes** → e.g., "Job loss causes financial anxiety"
- **Associated With** → e.g., "Sleep disruption associated with depression"
- **Improves** → e.g., "Exercise improves mood"
- **Worsens** → e.g., "Relationship conflict worsens anxiety"
- **Mentioned During** → e.g., "Childhood trauma mentioned during Session 5"
- **Linked To** → e.g., "Panic attacks linked to work stress"

Allows advanced reasoning across the complete patient journey.

---

## AI ORCHESTRATION LAYER

**Critical design decision. Never rely on one AI provider.**

### Orchestration Flow

```
Request
  ↓ Intent Detection
  ↓ Task Classification
  ↓ Memory Retrieval (RAG)
  ↓ Context Construction
  ↓ Model Selection
  ↓ Generation
  ↓ Quality Validation
  ↓ Output
```

### Model Gateway Architecture

```
Model Gateway
  ├── Transcription → Whisper / AssemblyAI
  ├── Documentation → GPT-4 / Claude / Gemini
  ├── Memory Search → Vector Retrieval (pgvector)
  ├── Classification → Fast models (GPT-3.5 / Claude Haiku)
  ├── Summarization → Claude Sonnet / GPT-4o
  └── Analytics → Custom models
```

**Benefits:** Cost Optimization | Reliability | Vendor Independence | Future Acquisition Readiness | A/B Testing

---

## PROMPT MANAGEMENT SYSTEM (Prompt Registry)

Every prompt versioned in database. **Never hardcode prompts in application code.**

### prompt_registry table
| Field | Type |
|-------|------|
| id | UUID PK |
| prompt_key | VARCHAR UNIQUE | e.g., SOAP_NOTE_V12 |
| prompt_text | TEXT |
| purpose | TEXT |
| version | INTEGER |
| author | UUID FK |
| performance_metrics | JSONB |
| is_active | BOOLEAN |
| created_at | TIMESTAMP |

**Examples:** SOAP_NOTE_V12 | SESSION_SUMMARY_V5 | MEMORY_EXTRACTION_V8 | RISK_DETECTION_V3

Allows safe upgrades, rollback, A/B testing of prompts.

---

## AI OBSERVABILITY

Track everything with metrics:

| Metric | Purpose |
|--------|---------|
| Latency | Response time per request |
| Cost | Token usage and $ per request |
| Token Usage | Input/output token counts |
| Success Rate | % of successful generations |
| Hallucination Reports | Flagged inaccurate outputs |
| Acceptance Rate | % of AI notes accepted without edits |
| Regeneration Rate | % requiring regeneration |

---

## HUMAN FEEDBACK LOOP

Every therapist interaction teaches the platform:

| Action | Signal |
|--------|--------|
| Accepted Suggestion | Positive signal |
| Rejected Suggestion | Negative signal |
| Edited Report (minor) | Near-positive |
| Modified Summary | Learning signal |
| Deleted Recommendation | Negative signal |

**Used for prompt optimization and model evaluation.**

---

## REPORT GENERATION PIPELINE

```
Transcript (finalized)
  ↓ Topic Extraction (Agent 2)
  ↓ Clinical Context Retrieval (from patient history)
  ↓ Memory Retrieval (relevant memories via vector search)
  ↓ Template Selection (SOAP/DAP/BIRP/Custom)
  ↓ Draft Generation (Agent 3)
  ↓ Quality Check (Quality Assurance Agent)
  ↓ Therapist Review UI
  ↓ Edit & Approve
  ↓ Digital Signature
  ↓ Archive
```

### Quality Assurance Agent
Before output reaches therapist, checks:
- Missing required sections
- Formatting compliance
- Internal consistency
- No contradictions with known patient history
- Required fields present

---

## CONTEXT CONSTRUCTION ENGINE (Most Critical System)

Before ANY generation:

```json
{
  "patient_summary": "38-year-old female, depression + anxiety, 18 months treatment",
  "recent_sessions": "Last 3 session summaries",
  "current_goals": "Active treatment goals and progress",
  "assessments": "PHQ-9: 14 (moderate), GAD-7: 12 (moderate)",
  "medications": "Sertraline 50mg since Jan 2024",
  "risk_flags": "No current risk flags",
  "therapist_preferences": "Prefers SOAP format, CBT framework"
}
```

**Poor context = poor output. This is where most AI failures happen.**

---

## PATIENT TIMELINE REASONING

Future capability. Example Query: *"What changed over the last six months?"*

AI reviews: Sessions | Assessments | Goals | Medications | Reports | Memories

Generates comprehensive summary of patient trajectory.

---

## TREND DETECTION ENGINE

Tracks longitudinally:
- Mood Trends (assessment scores over time)
- Assessment Trends (PHQ-9, GAD-7 changes)
- Attendance Trends (session frequency)
- Goal Completion Trends
- Medication Changes
- Session Themes (recurring topics)

**Produces longitudinal insights for therapist and practice owner.**

---

## AI SEARCH ENGINE (Clinical Semantic Search)

Therapists can ask in natural language:
- "Show all discussions about sleep"
- "Find all medication changes"
- "Summarize family issues over the last year"
- "Show progress since January"

**Searches:** Transcripts | Reports | Memories | Assessments | Files

**Technology:** pgvector for semantic search with metadata filters

---

## PATIENT DIGITAL TWIN (Long-Term Vision)

Not shown publicly. Internal intelligence construct.

Represents the complete patient understanding:
- History
- Patterns
- Goals
- Challenges
- Relationships
- Progress

Allows contextual understanding across years of care.

---

## PERSONALIZED THERAPIST MODELS

AI learns each therapist's preferences:
- Preferred note format (SOAP/DAP/BIRP)
- Preferred terminology
- Preferred question styles
- Preferred report structure
- Documentation shortcuts used

**Improves outputs over time. Creates therapist lock-in.**

---

## ENTERPRISE AI CONTROLS

Organizations can configure:
- Recording on/off
- Transcription on/off
- AI Summaries on/off
- AI Suggestions during sessions
- Memory Retention duration
- Automations on/off
- Report Generation style

---

## SAFETY LAYER

Every AI output passes through:

```
Policy Validation (regulatory compliance)
  ↓ Safety Validation (harmful content check)
  ↓ Compliance Validation (HIPAA/GDPR check)
  ↓ Output delivered to user
```

---

## AI API PLATFORM (Future Revenue Stream)

External endpoints for third-party developers:
- `POST /transcribe` — Audio to transcript
- `POST /summarize` — Transcript to summary
- `POST /generate-report` — Transcript to clinical note
- `POST /search-patient` — Semantic patient search
- `POST /retrieve-memory` — Memory retrieval
- `POST /analyze-session` — Session intelligence
- `POST /match-therapist` — Radar matching

Allows third parties to build on 24Therapy infrastructure.

---

## PROPRIETARY MODEL ROADMAP

| Phase | Strategy | Timeline |
|-------|---------|---------|
| Phase 1 | Foundation Models (OpenAI, Anthropic, Google) | Now |
| Phase 2 | Mental Health Prompting Layer | Year 1 |
| Phase 3 | Fine-Tuned Documentation Models | Year 2 |
| Phase 4 | Fine-Tuned Mental Health Workflow Models | Year 3 |
| Phase 5 | Proprietary Mental Health Intelligence Models | Year 4+ |

---

## STRATEGIC MOAT

**Competitors will copy:** Scheduling | Video | Notes | Reports

**Harder to copy:**
- Longitudinal Memory (years of structured data)
- Knowledge Graph (relationships between entities)
- Workflow Intelligence (therapist preference models)
- Outcome Tracking (effectiveness data)
- Therapist Learning Layer (personalization)
- Practice Intelligence (operational insights)
- Network Effects (more therapists = better matching)

---

## TEN-YEAR AI VISION

The AI should eventually understand:
- Every patient journey
- Every treatment plan
- Every progress pattern
- Every operational workflow
- Every documentation process

**Without replacing clinicians.**

The result: Therapists become dramatically more efficient. Practices become dramatically more organized. Patients receive more consistent care.

**24Therapy.ai becomes the intelligence infrastructure layer powering mental healthcare worldwide.**
