# 24Therapy.ai — Part 20: AI Architecture, Clinical Intelligence Framework, Mental Health Reasoning Systems, Agent Infrastructure, Memory Engine & Proprietary Model Strategy

## IMPORTANT PRINCIPLE

24Therapy is **not an autonomous mental health provider.** It is not intended to diagnose, prescribe, or replace licensed clinicians.

The AI's role is to support workflows, documentation, organization, search, and clinical preparation **while keeping therapists in control of decisions.**

---

## THE AI PHILOSOPHY

Most healthcare AI companies focus on: Transcription | Summaries | Notes

These are useful, but **increasingly commoditized.**

24Therapy should focus on:
- **Context** — Understanding what's happening in this session
- **Memory** — Remembering what happened across sessions
- **Organization** — Structuring information for clinical use
- **Continuity** — Preserving context across time and therapist changes
- **Workflow Intelligence** — Supporting the full clinical workflow

---

## AI LAYERS OF THE PLATFORM (6 Layers)

### Layer 1 — Speech Intelligence

**Captures:** Audio | Voice | Conversation | Multiple speakers | Context

**Outputs:**
- Timestamped transcript
- Speaker labels (therapist/patient/other)
- Confidence scores per segment
- Language detection

### Layer 2 — Documentation Intelligence

**Creates:**
- Session notes (SOAP/DAP/BIRP)
- Session summaries
- Draft clinical documentation
- Follow-up task lists
- Treatment-plan updates

**All outputs are drafts requiring clinician review.**

### Layer 3 — Memory Intelligence

**Extracts from each session:**
- New facts about the patient
- Goal updates
- Life events mentioned
- Symptom changes
- Progress markers
- Treatment history updates

**Stores in structured form with embeddings.**

### Layer 4 — Clinical Search Intelligence

Allows therapists to query patient history naturally:

- *"Show every mention of sleep problems"*
- *"Summarize relationship issues over the last year"*
- *"List major life events"*
- *"What did we work on in the last 5 sessions?"*

### Layer 5 — Workflow Intelligence

Identifies and surfaces:
- Missing documentation
- Upcoming follow-ups
- Incomplete assessments
- Administrative actions needed
- Pending tasks

### Layer 6 — Outcome Intelligence

Measures longitudinally:
- Attendance patterns
- Engagement levels
- Assessment score trends
- Goal progress rates
- Treatment continuity

---

## AI AGENT SYSTEM (9 Specialized Agents)

### AGENT 1: Transcription Agent

**Responsibilities:**
- Speech recognition (Whisper or equivalent)
- Speaker identification and diarization
- Word-level timestamping
- Language detection (Arabic/English/French/etc.)
- Confidence scoring

**Output:** Structured transcript segments

---

### AGENT 2: Documentation Agent

**Responsibilities:**
- Generate structured notes from transcript
- Produce session summaries
- Create therapist-facing drafts (SOAP/DAP/BIRP)
- Create patient-friendly session summaries

**Important:** All outputs are **drafts requiring clinician review**. Never auto-publish.

---

### AGENT 3: Memory Agent

**One of the most valuable agents in the platform.**

**Responsibilities:**
- Extract meaningful information from transcript
- Store memories in patient_memories table
- Update patient timeline
- Merge duplicate memories intelligently
- Track changes over time

**Example memory creation:**
```json
{
  "memory_text": "Patient started new job at tech company in January 2024",
  "category": "life_events",
  "confidence_score": 0.92,
  "importance_score": 0.85,
  "source_session_id": "uuid-session-45",
  "related_topics": ["work_stress", "identity", "financial_security"]
}
```

---

### AGENT 4: Timeline Agent

**Maintains chronological understanding of the patient journey.**

**Events tracked:**
- New medication start/stop/change
- Relationship changes
- Major life events
- Treatment milestones
- Assessment score changes
- Hospitalization/crisis events

**Creates:** Patient timeline (visual in UI)

---

### AGENT 5: Assessment Agent

**Tracks structured clinical assessments.**

**Supported assessments:** PHQ-9 | GAD-7 | PCL-5 | ASRS | AUDIT | DAST | WHO-5 | Custom

**Responsibilities:**
- Track scores over time
- Monitor trends (improving/stable/worsening)
- Create score visualizations
- Generate progress reports from assessment data

---

### AGENT 6: Risk Awareness Agent

**Purpose:** Flag language that may require therapist attention.

**Examples of flagged content:**
- Expressions of hopelessness
- Escalating distress language
- Potential safety concerns
- Major behavioral changes
- Statements about harm to self or others

**Outputs are framed as:** *"Observations for clinician review"* — not definitive clinical judgments.

**Escalation path:** AI flags → Therapist reviews → Therapist decides action → Audit logged

---

### AGENT 7: Therapist Copilot Agent

**Supports therapists during live sessions (real-time panel).**

**Can surface:**
- Relevant patient history ("Patient discussed work-related stress in the previous three sessions")
- Prior goals and current progress
- Past discussion topics not recently addressed
- Medication changes since last session
- Upcoming tasks or assessments

**Real-time suggestions during session. Not intrusive. Panel format.**

---

### AGENT 8: Workflow Agent

**Creates:**
- Follow-up tasks
- Reminders
- Documentation action items
- Assessment reminders

**Example:** *"Follow-up assessment (PHQ-9) due next week based on treatment plan schedule."*

---

### AGENT 9: Radar Matching Agent

**Matches patient needs to therapist availability.**

**Factors:**
- Patient's stated needs and language
- Therapist availability (real-time)
- Clinical specializations match
- Cultural background alignment
- Pricing match
- Response time history

**Assists matching with appropriate transparency and human oversight.**

---

## PATIENT AI SYSTEM (Consumer-Facing)

### Critical Rules

Must ALWAYS disclose it is an AI system.

Must NEVER claim to be:
- Doctor
- Therapist
- Psychiatrist
- Counselor
- Human

### Patient AI Goals

- Help users organize their thoughts
- Provide mental health information
- Support navigation to professional help
- Encourage professional care when appropriate
- Help schedule appointments
- Track goals between sessions (set by therapist)

### Patient AI Personality

**Always:** Calm | Professional | Supportive | Non-judgmental | Transparent

**Never:** Manipulative | Deceptive | Overpromising | Diagnostic

### Patient AI Conversation Flow

```
User arrives
  ↓ "How are you feeling today?"
  ↓ Active listening + reflective responses
  ↓ "What brought you here?"
  ↓ "Would you like support finding a therapist?"
  ↓ Warm handoff to booking flow
```

### Patient Intake Engine

**Purpose:** Collect structured intake information before therapist sessions.

**Collects:**
- Primary concerns
- Session type preference (video/audio/chat)
- Language preference
- Availability windows
- Previous therapy experience
- Insurance or self-pay

**Generates:** Structured intake summary for therapist pre-session review.

---

## THERAPIST COPILOT (Deep Dive)

One of the strongest differentiators. **During session, AI quietly assists.**

### Copilot Panel Sections

| Section | Content |
|---------|---------|
| **Session Summary** | Running summary of current session |
| **Suggested Questions** | Based on patient history and current discussion |
| **Memory Mentions** | Relevant memories triggered by current conversation |
| **Risk Indicators** | Language flagged for review |
| **Patient Context** | Quick reference: goals, medications, recent events |
| **Documentation Shortcuts** | One-click note starters |

**The therapist remains responsible for all care decisions.**

---

## MEMORY ENGINE ARCHITECTURE

### Memory Structure

```typescript
interface PatientMemory {
  id: UUID;
  patientId: UUID;
  category: MemoryCategory;
  memoryText: string;
  embedding: Vector1536;          // pgvector for semantic search
  importanceScore: number;         // 0-1
  confidenceScore: number;         // 0-1 (AI certainty)
  clinicalRelevanceScore: number;  // 0-1
  recencyScore: number;            // 0-1 (time-decayed)
  sourceSessionId: UUID;
  status: 'active' | 'archived' | 'reviewed';
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Memory Categories (Detailed)

| Category | Examples |
|---------|---------|
| **Symptoms** | Sleep issues, anxiety symptoms, depression markers |
| **Goals** | Personal goals, therapy goals, life goals |
| **Life Events** | Marriage, divorce, job change, loss, trauma |
| **Relationships** | Family dynamics, romantic relationships, friendships |
| **Work/School** | Career changes, academic performance, workplace conflict |
| **Family** | Family structure, dynamics, support system |
| **Trauma History** | Historical trauma disclosures |
| **Treatment Plans** | Prior treatment approaches and outcomes |
| **Medication History** | All medication changes with dates |
| **Assessments** | Significant assessment findings |
| **Behavioral Patterns** | Habits, avoidance patterns, coping styles |
| **Strengths** | Patient-reported strengths and resources |
| **Preferences** | Communication preferences, session preferences |

### Memory Lifecycle

```
Created (extracted from session)
  ↓ Validated (therapist review, optional)
  ↓ Updated (if new session changes existing memory)
  ↓ Referenced (used in context construction)
  ↓ Archived (no longer clinically relevant)
```

---

## KNOWLEDGE GRAPH ARCHITECTURE

### Entities (Nodes)

Patient | Therapist | Session | Assessment | Goal | Life Event | Medication | Symptom | Condition | Relationship | Organization

### Relationships (Edges)

| Relationship | Example |
|------------|---------|
| **Influences** | "Financial stress influences anxiety severity" |
| **Causes** | "Job loss caused depression episode" |
| **Improves** | "Exercise improved sleep quality" |
| **Worsens** | "Relationship conflict worsens panic attacks" |
| **Related To** | "Sleep issues related to anxiety" |
| **Occurred Before** | "Divorce occurred before depression diagnosis" |
| **Occurred After** | "Medication change occurred after crisis event" |
| **Mentioned During** | "Childhood trauma mentioned during Session 5" |

**Allows contextual, causal understanding — not just record retrieval.**

---

## CONTEXT MANAGEMENT SYSTEM

**One of the hardest AI problems in clinical settings.**

Every AI request should include:
- Current session content (last N minutes)
- Patient history summary
- Active treatment goals
- Recent life events (last 90 days)
- Most relevant memories (semantic search)
- Therapist preferences

**Not entire patient history every time** — use selective retrieval.

### Retrieval Architecture (RAG)

```
Therapist query / Session content
  ↓ Embed the query
  ↓ Search patient_memories (vector similarity)
  ↓ Filter by recency + importance + category
  ↓ Rank and select top K memories
  ↓ Inject into context window
  ↓ Generate response
```

**Reduces cost. Improves quality. Prevents context overflow.**

---

## PROMPT ARCHITECTURE (Enterprise-Grade)

### Prompt Hierarchy

```
System Prompt (platform-level rules)
  ↓ Clinical Rules (safety, ethics, disclosure requirements)
  ↓ Organization Rules (org-specific policies)
  ↓ Therapist Preferences (note format, style)
  ↓ Patient Context (current patient info)
  ↓ Session Context (current session content)
  ↓ User Request (specific task)
```

### Prompt Registry

All prompts stored in database with:
- Version number
- Author
- Performance metrics (acceptance rate, edit rate)
- A/B test results
- Approval status

**Never hardcode prompts. Every change tracked. Rollback possible.**

---

## MULTI-MODEL STRATEGY

**Never depend on one AI provider.**

### Abstraction Layer

```typescript
interface ModelGateway {
  complete(task: AITask, options: ModelOptions): Promise<AIResponse>;
}

// Routes to right model based on task type
class ModelRouter implements ModelGateway {
  async complete(task: AITask) {
    switch (task.type) {
      case 'transcription': return this.whisper.transcribe(task);
      case 'documentation': return this.gpt4.generate(task);
      case 'classification': return this.claudeHaiku.classify(task);
      case 'embedding': return this.ada.embed(task);
    }
  }
}
```

### Model Selection by Task

| Task | Primary Model | Fallback |
|------|-------------|---------|
| Transcription | Whisper | AssemblyAI |
| SOAP Notes | GPT-4o | Claude Sonnet |
| Session Summary | Claude Sonnet | GPT-4o |
| Classification | Claude Haiku | GPT-3.5 |
| Embeddings | text-embedding-3-large | Ada v2 |
| Risk Detection | GPT-4o | Claude Sonnet |

---

## MODEL EVALUATION SYSTEM

Every model measured continuously:

| Metric | Target |
|--------|--------|
| Note Acceptance Rate | >85% accepted without edits |
| Regeneration Rate | <10% require regeneration |
| Edit Extent | Minor edits only (not rewrites) |
| Latency | <30s for note generation |
| Cost per Session | Track and optimize |

---

## FEEDBACK LOOP

```
Therapist accepts note → Positive signal
Therapist edits note (minor) → Learning signal
Therapist rewrites note → Negative signal
Therapist regenerates → Strong negative signal
```

**Creates personalization. Improves outputs per therapist over time.**

---

## ORGANIZATION LEARNING (Future Enterprise)

Organizations can define:
- Custom documentation templates
- Organization-specific terminology
- Workflow preferences
- Clinical protocol requirements

**AI adapts to organization context.**

---

## PROPRIETARY DATA STRATEGY

**The long-term value is NOT the model itself. Models change.**

**Value comes from:**
- Workflow data (therapist preferences at scale)
- Memory structures (structured clinical intelligence)
- Clinical context systems (RAG infrastructure)
- Custom templates (org-specific knowledge)
- Knowledge graphs (causal relationships)
- Outcome tracking data (what works, what doesn't)
- Organization intelligence (practice-level patterns)

---

## FUTURE PROPRIETARY MODEL STRATEGY

| Stage | Action |
|-------|--------|
| Stage 1 | Use external models (OpenAI, Anthropic) |
| Stage 2 | Fine-tune for clinical documentation style |
| Stage 3 | Train mental-health-specific workflow models |
| Stage 4 | Proprietary clinical intelligence models |

**Focus areas for fine-tuning:**
- Clinical documentation (SOAP/DAP/BIRP style)
- Mental health risk classification
- Memory extraction from therapy transcripts
- Therapist-style matching
- Patient-therapist communication patterns

---

## WHAT SHOULD NEVER BE AUTOMATED

Certain actions must **always remain under clinician control:**

- Final diagnoses (any diagnostic conclusion)
- Medication prescribing decisions
- Treatment plan approval
- Documentation approval (therapist must sign)
- Patient communications requiring clinical judgment
- Crisis escalation to emergency services

---

## THE LONGEST-TERM MOAT

Not transcription. Not summaries. Not note generation.

**The strongest defensible asset becomes:**

> A structured clinical memory system that understands patient history across years of care and helps clinicians navigate that history efficiently.

No competitor can buy this. It must be built, session by session, patient by patient.

---

## THE ULTIMATE AI VISION

A therapist starts a session. The system already knows:
- Relevant history from prior sessions
- Open treatment goals
- Recent life changes
- Assessment trends
- Important events to follow up on
- Pending tasks

**The session happens naturally.**

AI assists silently:
- Documents the session as it unfolds
- Organizes information in real-time
- Updates patient memory
- Prepares report drafts
- Surfaces relevant context in copilot panel
- Supports continuity of care

**The therapist spends more time helping people and less time managing information.**

That is the vision. Build toward it from day one.
