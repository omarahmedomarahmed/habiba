-- ============================================================
-- 24Therapy.ai — Migration 006: Sessions Schema
-- Sessions, Participants, Notes, Transcripts, Segments, Recordings
-- ============================================================

-- ============================================================
-- SESSIONS
-- ============================================================
CREATE TABLE sessions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    therapist_id            UUID NOT NULL REFERENCES therapists(id),
    patient_id              UUID NOT NULL REFERENCES patients(id),
    session_type            VARCHAR(50) DEFAULT 'standard',
    modality                VARCHAR(50) DEFAULT 'video',
    status                  VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    scheduled_at            TIMESTAMPTZ,
    started_at              TIMESTAMPTZ,
    ended_at                TIMESTAMPTZ,
    duration_minutes        INTEGER,                    -- Calculated on end
    session_number          INTEGER,                    -- Sequential for this therapist-patient pair
    title                   VARCHAR(255),               -- e.g. "Session 12 - Anxiety focus"
    radar_session           BOOLEAN NOT NULL DEFAULT FALSE,
    radar_request_id        UUID,                       -- Reference to radar_requests
    recording_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
    scribe_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    video_room_id           VARCHAR(255),               -- External video provider room ID
    video_room_url          VARCHAR(1000),              -- Session join URL
    pre_session_notes       TEXT,
    post_session_quick_note TEXT,
    cancellation_reason     TEXT,
    cancelled_by            UUID REFERENCES users(id),
    cancelled_at            TIMESTAMPTZ,
    no_show                 BOOLEAN DEFAULT FALSE,
    billing_status          VARCHAR(50) DEFAULT 'pending',
    fee_charged             NUMERIC(10,2),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT session_type_check CHECK (
        session_type IN ('standard', 'radar', 'group', 'phone', 'in_person', 'intake', 'follow_up')
    ),
    CONSTRAINT session_modality_check CHECK (
        modality IN ('video', 'audio_only', 'phone', 'in_person')
    ),
    CONSTRAINT session_status_check CHECK (
        status IN ('scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled')
    ),
    CONSTRAINT session_billing_check CHECK (
        billing_status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'waived', 'not_applicable')
    )
);

CREATE INDEX idx_sessions_org ON sessions(organization_id);
CREATE INDEX idx_sessions_therapist ON sessions(therapist_id);
CREATE INDEX idx_sessions_patient ON sessions(patient_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_scheduled ON sessions(scheduled_at);
CREATE INDEX idx_sessions_radar ON sessions(radar_session) WHERE radar_session = TRUE;
CREATE INDEX idx_sessions_date ON sessions(organization_id, scheduled_at DESC);

-- ============================================================
-- SESSION PARTICIPANTS
-- ============================================================
CREATE TABLE session_participants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    role            VARCHAR(50) NOT NULL,        -- 'therapist', 'patient', 'observer', 'interpreter', 'family', 'supervisor'
    display_name    VARCHAR(200),
    joined_at       TIMESTAMPTZ,
    left_at         TIMESTAMPTZ,
    duration_seconds INTEGER,
    connection_quality JSONB,                   -- {avg_quality: 'good', drops: 2}
    
    CONSTRAINT participant_role_check CHECK (
        role IN ('therapist', 'patient', 'observer', 'interpreter', 'family', 'supervisor')
    )
);

CREATE INDEX idx_participants_session ON session_participants(session_id);

-- ============================================================
-- SESSION NOTES (therapist manual notes)
-- ============================================================
CREATE TABLE session_notes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    therapist_id    UUID NOT NULL REFERENCES therapists(id),
    patient_id      UUID NOT NULL REFERENCES patients(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    note_type       VARCHAR(50) DEFAULT 'during_session',
    content         TEXT,
    is_private      BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT note_type_check CHECK (
        note_type IN ('pre_session', 'during_session', 'post_session', 'quick_note')
    )
);

CREATE INDEX idx_session_notes_session ON session_notes(session_id);

-- ============================================================
-- TRANSCRIPTS (master record per session)
-- ============================================================
CREATE TABLE transcripts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
    patient_id          UUID NOT NULL REFERENCES patients(id),
    therapist_id        UUID NOT NULL REFERENCES therapists(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    status              VARCHAR(50) DEFAULT 'processing',
    language            VARCHAR(10) DEFAULT 'en',
    word_count          INTEGER,
    segment_count       INTEGER,
    duration_seconds    INTEGER,
    storage_url         VARCHAR(1000),           -- Full transcript text in S3
    processing_model    VARCHAR(100),            -- ASR model used
    processing_started  TIMESTAMPTZ,
    processing_completed TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT transcript_status_check CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'partial')
    )
);

CREATE INDEX idx_transcripts_session ON transcripts(session_id);
CREATE INDEX idx_transcripts_patient ON transcripts(patient_id);
CREATE INDEX idx_transcripts_status ON transcripts(status);

-- ============================================================
-- TRANSCRIPT SEGMENTS (speaker-labeled, timestamped)
-- ============================================================
CREATE TABLE transcript_segments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transcript_id       UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    session_id          UUID NOT NULL REFERENCES sessions(id),
    patient_id          UUID NOT NULL REFERENCES patients(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    speaker             VARCHAR(20) DEFAULT 'unknown',    -- 'therapist', 'patient', 'unknown'
    speaker_label       VARCHAR(100),                     -- "Dr. Sara", "Patient"
    start_time_ms       INTEGER NOT NULL,
    end_time_ms         INTEGER NOT NULL,
    text                TEXT NOT NULL,
    confidence          NUMERIC(4,3),                     -- ASR confidence 0.000-1.000
    is_edited           BOOLEAN DEFAULT FALSE,
    edited_text         TEXT,                             -- Therapist-corrected version
    sequence_number     INTEGER NOT NULL,
    
    CONSTRAINT segment_speaker_check CHECK (
        speaker IN ('therapist', 'patient', 'family', 'interpreter', 'unknown')
    )
);

CREATE INDEX idx_segments_transcript ON transcript_segments(transcript_id);
CREATE INDEX idx_segments_session ON transcript_segments(session_id);
CREATE INDEX idx_segments_sequence ON transcript_segments(transcript_id, sequence_number);
-- Full text search on transcripts
CREATE INDEX idx_segments_text ON transcript_segments USING GIN(to_tsvector('english', text));

-- ============================================================
-- SESSION RECORDINGS
-- ============================================================
CREATE TABLE session_recordings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    recording_type      VARCHAR(20) DEFAULT 'video',  -- 'video', 'audio', 'screen'
    storage_url         VARCHAR(1000) NOT NULL,        -- Encrypted S3 URL
    storage_provider    VARCHAR(50) DEFAULT 'aws_s3',
    size_bytes          BIGINT,
    duration_seconds    INTEGER,
    format              VARCHAR(20),                   -- 'mp4', 'webm', 'mp3'
    encryption_key_id   VARCHAR(255),                  -- KMS key reference
    retention_until     DATE,                          -- Auto-delete date
    downloaded_count    INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recordings_session ON session_recordings(session_id);

-- ============================================================
-- SESSION REPORTS (final clinical reports)
-- ============================================================
CREATE TABLE session_reports (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL REFERENCES sessions(id),
    patient_id          UUID NOT NULL REFERENCES patients(id),
    therapist_id        UUID NOT NULL REFERENCES therapists(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    report_type         VARCHAR(50) DEFAULT 'clinical',  -- 'clinical', 'patient_summary', 'insurance', 'progress'
    title               VARCHAR(255),
    content             TEXT,
    structured_content  JSONB,
    status              VARCHAR(50) DEFAULT 'draft',
    storage_url         VARCHAR(1000),                    -- PDF in S3
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    sent_to_patient     BOOLEAN DEFAULT FALSE,
    sent_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT report_status_check CHECK (status IN ('draft', 'approved', 'sent', 'archived'))
);

CREATE INDEX idx_reports_session ON session_reports(session_id);
CREATE INDEX idx_reports_patient ON session_reports(patient_id);

-- ============================================================
-- FOREIGN KEY ADDITIONS (from earlier migrations that reference sessions)
-- ============================================================
ALTER TABLE patients ADD CONSTRAINT fk_patients_last_session
    FOREIGN KEY (id) REFERENCES patients(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE risk_assessments ADD CONSTRAINT fk_risk_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;

ALTER TABLE patient_life_events ADD CONSTRAINT fk_life_events_session
    FOREIGN KEY (source_session_id) REFERENCES sessions(id) ON DELETE SET NULL;

ALTER TABLE patient_relationships ADD CONSTRAINT fk_relationships_session
    FOREIGN KEY (source_session_id) REFERENCES sessions(id) ON DELETE SET NULL;

ALTER TABLE patient_files ADD CONSTRAINT fk_files_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transcripts_updated_at
    BEFORE UPDATE ON transcripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_reports_updated_at
    BEFORE UPDATE ON session_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-UPDATE patient last_session_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_patient_last_session()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        UPDATE patients
        SET last_session_at = NEW.ended_at,
            total_sessions = total_sessions + 1
        WHERE id = NEW.patient_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER after_session_completed
    AFTER UPDATE ON sessions
    FOR EACH ROW
    WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
    EXECUTE FUNCTION update_patient_last_session();
