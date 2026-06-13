-- ============================================================
-- 24Therapy.ai — Migration 007: AI Schema
-- AI Notes, Session Intelligence, Patient Memory (pgvector),
-- Prompt Registry, AI Request Logs, Model Registry
-- ============================================================

-- ============================================================
-- AI SESSION NOTES (SOAP / DAP / BIRP / Narrative)
-- ============================================================
CREATE TABLE ai_session_notes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    patient_id          UUID NOT NULL REFERENCES patients(id),
    therapist_id        UUID NOT NULL REFERENCES therapists(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    note_format         VARCHAR(20) DEFAULT 'soap',     -- 'soap', 'dap', 'birp', 'narrative', 'custom'
    structured_content  JSONB NOT NULL,                 -- Format-specific structure (see below)
    raw_content         TEXT,                            -- Plain text version
    status              VARCHAR(50) DEFAULT 'draft',
    version             INTEGER NOT NULL DEFAULT 1,
    therapist_edits     JSONB DEFAULT '{}',              -- What therapist changed
    edit_distance       INTEGER,                          -- Measure of how much was edited
    edit_percentage     NUMERIC(5,2),                     -- % changed
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    ai_model_used       VARCHAR(100),                    -- e.g. 'gpt-4o'
    prompt_version      VARCHAR(50),                     -- e.g. 'SOAP_NOTE_V12'
    generation_latency_ms INTEGER,
    token_count         INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT note_format_check CHECK (
        note_format IN ('soap', 'dap', 'birp', 'narrative', 'custom')
    ),
    CONSTRAINT note_status_check CHECK (
        status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived')
    )
);

-- SOAP structured_content example:
-- {"subjective": "Patient reports...", "objective": "Patient presented...", "assessment": "...", "plan": "..."}
-- DAP: {"data": "...", "assessment": "...", "plan": "..."}
-- BIRP: {"behavior": "...", "intervention": "...", "response": "...", "plan": "..."}

CREATE INDEX idx_ai_notes_session ON ai_session_notes(session_id);
CREATE INDEX idx_ai_notes_patient ON ai_session_notes(patient_id);
CREATE INDEX idx_ai_notes_status ON ai_session_notes(status, therapist_id);

-- ============================================================
-- AI SESSION SUMMARIES
-- ============================================================
CREATE TABLE ai_session_summaries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    patient_id          UUID NOT NULL REFERENCES patients(id),
    therapist_id        UUID NOT NULL REFERENCES therapists(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    summary_type        VARCHAR(30) DEFAULT 'brief',     -- 'brief', 'detailed', 'patient_facing', 'insurance'
    content             TEXT NOT NULL,
    key_themes          TEXT[] DEFAULT '{}',
    action_items        JSONB DEFAULT '[]',               -- [{item, assignee, due_date}]
    follow_up_suggestions JSONB DEFAULT '[]',
    next_session_prep   TEXT,
    status              VARCHAR(30) DEFAULT 'draft',
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_summaries_session ON ai_session_summaries(session_id);
CREATE INDEX idx_summaries_patient ON ai_session_summaries(patient_id);

-- ============================================================
-- SESSION INTELLIGENCE OBJECTS (rich structured AI analysis)
-- ============================================================
CREATE TABLE session_intelligence (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id              UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
    patient_id              UUID NOT NULL REFERENCES patients(id),
    therapist_id            UUID NOT NULL REFERENCES therapists(id),
    organization_id         UUID NOT NULL REFERENCES organizations(id),
    themes_detected         TEXT[] DEFAULT '{}',        -- Anxiety, Sleep, Relationships, etc.
    symptoms_mentioned      TEXT[] DEFAULT '{}',
    goals_mentioned         TEXT[] DEFAULT '{}',
    stressors_mentioned     TEXT[] DEFAULT '{}',
    life_events_mentioned   TEXT[] DEFAULT '{}',
    medication_mentions     TEXT[] DEFAULT '{}',
    risk_indicators         TEXT[] DEFAULT '{}',
    protective_factors      TEXT[] DEFAULT '{}',
    session_timeline        JSONB DEFAULT '[]',          -- [{time_ms, topic, brief_summary}]
    emotional_arc           JSONB DEFAULT '{}',          -- {opening: 'neutral', middle: 'distressed', close: 'hopeful'}
    key_quotes              JSONB DEFAULT '[]',          -- Notable patient quotes (with segment refs)
    therapist_interventions TEXT[] DEFAULT '{}',         -- Types of interventions observed
    session_quality_score   NUMERIC(3,2),               -- Internal AI quality assessment 0-1
    processing_model        VARCHAR(100),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intelligence_session ON session_intelligence(session_id);
CREATE INDEX idx_intelligence_patient ON session_intelligence(patient_id);

-- ============================================================
-- PATIENT MEMORY (THE MOAT — with pgvector embeddings)
-- ============================================================
CREATE TABLE patient_memory (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    therapist_id        UUID REFERENCES therapists(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    memory_type         VARCHAR(50) NOT NULL,
    title               VARCHAR(500) NOT NULL,
    content             TEXT NOT NULL,
    context             JSONB DEFAULT '{}',              -- Supporting metadata
    confidence_score    NUMERIC(3,2),                   -- AI confidence 0.00-1.00
    source_session_id   UUID REFERENCES sessions(id) ON DELETE SET NULL,
    source_segment_ids  UUID[] DEFAULT '{}',             -- Transcript segment sources
    status              VARCHAR(30) DEFAULT 'active',
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1,
    superseded_by       UUID REFERENCES patient_memory(id),  -- When memory is updated
    embedding           vector(1536),                   -- pgvector: OpenAI text-embedding-3-small
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT memory_type_check CHECK (
        memory_type IN (
            'symptom', 'goal', 'relationship', 'life_event', 'medication',
            'risk', 'treatment', 'strength', 'protective_factor', 'preference',
            'belief', 'behavior', 'trigger', 'coping', 'general'
        )
    ),
    CONSTRAINT memory_status_check CHECK (
        status IN ('active', 'archived', 'superseded', 'rejected', 'pending_review')
    )
);

-- Standard index
CREATE INDEX idx_memory_patient ON patient_memory(patient_id);
CREATE INDEX idx_memory_type ON patient_memory(memory_type, patient_id);
CREATE INDEX idx_memory_status ON patient_memory(status, patient_id);
CREATE INDEX idx_memory_session ON patient_memory(source_session_id);

-- pgvector IVFFlat index for semantic similarity search
-- Use cosine distance (suited for normalized embeddings)
CREATE INDEX idx_memory_embedding ON patient_memory 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- MEMORY EVOLUTION HISTORY
-- ============================================================
CREATE TABLE patient_memory_history (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id           UUID NOT NULL REFERENCES patient_memory(id) ON DELETE CASCADE,
    patient_id          UUID NOT NULL REFERENCES patients(id),
    previous_content    TEXT,
    new_content         TEXT,
    previous_status     VARCHAR(30),
    new_status          VARCHAR(30),
    change_type         VARCHAR(50),    -- 'created', 'updated', 'reviewed', 'archived', 'superseded'
    change_reason       TEXT,
    changed_by          UUID REFERENCES users(id),
    changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_memory_history_memory ON patient_memory_history(memory_id);

-- ============================================================
-- PROMPT REGISTRY (versioned prompt management)
-- ============================================================
CREATE TABLE prompt_registry (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(100) NOT NULL,           -- e.g. 'SOAP_NOTE'
    version             VARCHAR(20) NOT NULL,            -- e.g. 'v12'
    full_key            VARCHAR(150) UNIQUE NOT NULL,    -- 'SOAP_NOTE_V12'
    description         TEXT,
    template            TEXT NOT NULL,                   -- The prompt template
    variables           JSONB DEFAULT '[]',              -- Required variable names
    output_schema       JSONB,                           -- Expected output structure
    owner               VARCHAR(100),                    -- Team owner
    status              VARCHAR(30) DEFAULT 'draft',
    performance_metrics JSONB DEFAULT '{}',              -- {approval_rate, avg_edit_pct, avg_latency_ms}
    ab_test_group       VARCHAR(20),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at        TIMESTAMPTZ,
    deprecated_at       TIMESTAMPTZ,
    
    CONSTRAINT prompt_status_check CHECK (
        status IN ('draft', 'testing', 'active', 'deprecated')
    )
);

CREATE INDEX idx_prompts_name ON prompt_registry(name, status);
CREATE INDEX idx_prompts_full_key ON prompt_registry(full_key);

-- Default prompt registry entries
INSERT INTO prompt_registry (name, version, full_key, description, template, status) VALUES
('SOAP_NOTE', 'v1', 'SOAP_NOTE_V1', 'Generate SOAP clinical note from session transcript', 
 'You are a clinical documentation assistant...', 'active'),
('SESSION_SUMMARY', 'v1', 'SESSION_SUMMARY_V1', 'Generate brief session summary', 
 'Summarize the following therapy session...', 'active'),
('MEMORY_EXTRACTION', 'v1', 'MEMORY_EXTRACTION_V1', 'Extract clinical memories from transcript', 
 'Extract key clinical information from this session...', 'active'),
('RISK_ASSESSMENT', 'v1', 'RISK_ASSESSMENT_V1', 'Identify risk indicators in transcript', 
 'Review the following transcript for risk indicators...', 'active'),
('COPILOT_SUGGESTIONS', 'v1', 'COPILOT_SUGGESTIONS_V1', 'Generate live copilot suggestions', 
 'Based on the ongoing conversation, suggest...', 'active');

-- ============================================================
-- AI MODEL REGISTRY
-- ============================================================
CREATE TABLE ai_model_registry (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider            VARCHAR(50) NOT NULL,    -- 'openai', 'anthropic', 'google', 'custom'
    model_id            VARCHAR(100) NOT NULL,   -- 'gpt-4o', 'claude-3-5-sonnet', etc.
    model_type          VARCHAR(50) NOT NULL,    -- 'llm', 'embedding', 'transcription', 'tts'
    display_name        VARCHAR(100),
    cost_per_1k_input   NUMERIC(10,6),
    cost_per_1k_output  NUMERIC(10,6),
    context_window      INTEGER,
    is_active           BOOLEAN DEFAULT TRUE,
    is_default          BOOLEAN DEFAULT FALSE,
    use_cases           TEXT[] DEFAULT '{}',     -- ['soap_notes', 'summaries', 'copilot']
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ai_model_registry (provider, model_id, model_type, display_name, cost_per_1k_input, cost_per_1k_output, context_window, is_default, use_cases) VALUES
('openai', 'gpt-4o', 'llm', 'GPT-4o', 0.005, 0.015, 128000, TRUE, ARRAY['soap_notes', 'summaries', 'copilot', 'memory']),
('openai', 'gpt-4o-mini', 'llm', 'GPT-4o Mini', 0.000150, 0.000600, 128000, FALSE, ARRAY['simple_tasks', 'classification']),
('anthropic', 'claude-3-5-sonnet-20241022', 'llm', 'Claude 3.5 Sonnet', 0.003, 0.015, 200000, FALSE, ARRAY['soap_notes', 'summaries']),
('openai', 'text-embedding-3-small', 'embedding', 'Text Embedding 3 Small', 0.000020, 0, 8191, TRUE, ARRAY['memory_embedding', 'search']),
('openai', 'whisper-1', 'transcription', 'Whisper v1', 0.006, 0, NULL, TRUE, ARRAY['transcription']);

-- ============================================================
-- AI REQUEST LOGS (full observability)
-- ============================================================
CREATE TABLE ai_request_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID REFERENCES organizations(id),
    user_id             UUID REFERENCES users(id),
    patient_id          UUID REFERENCES patients(id),
    session_id          UUID REFERENCES sessions(id),
    request_type        VARCHAR(50),             -- 'note_generation', 'summary', 'memory', 'copilot', 'embedding'
    agent_type          VARCHAR(50),
    model_id            VARCHAR(100),
    prompt_version      VARCHAR(50),
    input_tokens        INTEGER,
    output_tokens       INTEGER,
    cost_usd            NUMERIC(10,6),
    latency_ms          INTEGER,
    status              VARCHAR(20),             -- 'success', 'failure', 'timeout', 'cached'
    cache_hit           BOOLEAN DEFAULT FALSE,
    error_code          VARCHAR(50),
    error_message       TEXT,
    request_id          VARCHAR(100),            -- External request ID from provider
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for performance at scale
CREATE INDEX idx_ai_logs_org ON ai_request_logs(organization_id, created_at DESC);
CREATE INDEX idx_ai_logs_session ON ai_request_logs(session_id);
CREATE INDEX idx_ai_logs_date ON ai_request_logs(created_at DESC);
CREATE INDEX idx_ai_logs_type ON ai_request_logs(request_type, status);

-- ============================================================
-- COPILOT SUGGESTION LOGS (track what was suggested vs. used)
-- ============================================================
CREATE TABLE copilot_suggestion_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    therapist_id        UUID NOT NULL REFERENCES therapists(id),
    suggestion_type     VARCHAR(50),             -- 'question', 'observation', 'reminder', 'risk'
    suggestion_content  TEXT NOT NULL,
    context_snapshot    TEXT,                    -- Transcript context at time of suggestion
    was_acted_upon      BOOLEAN,                 -- Did therapist use it?
    therapist_rating    SMALLINT,                -- 1-5 rating if provided
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_copilot_logs_session ON copilot_suggestion_logs(session_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER update_ai_notes_updated_at
    BEFORE UPDATE ON ai_session_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memory_updated_at
    BEFORE UPDATE ON patient_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_intelligence_updated_at
    BEFORE UPDATE ON session_intelligence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Reviewed: 2026-06-13 — 24Therapy audit
