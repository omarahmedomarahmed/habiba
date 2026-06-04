-- ============================================================
-- 012_audit_compliance_schema.sql
-- 24Therapy.ai — Audit Logs, HIPAA Compliance, GDPR Controls,
--                Security Incidents, Consent Management,
--                Data Retention, Access Controls
-- ============================================================
-- CRITICAL: This schema is legally required for HIPAA/GDPR.
-- audit_logs table MUST be append-only (no UPDATE/DELETE).
-- Ensure RLS policies restrict all modifications.
-- ============================================================
-- Depends on: 001_core_schema.sql
-- ============================================================

-- ============================================================
-- AUDIT LOGS (Immutable — Append Only — LEGALLY REQUIRED)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- WHO
    user_id         UUID,           -- NULL for system actions
    user_email      VARCHAR(255),   -- Denormalized for immutability
    user_role       VARCHAR(100),   -- Denormalized for immutability
    organization_id UUID,
    impersonated_by UUID,           -- If admin is impersonating
    -- WHAT
    action          VARCHAR(255) NOT NULL,
        -- Patterns: resource.operation
        -- Examples: patient.viewed, session.created, report.approved,
        --           file.downloaded, user.login, user.logout,
        --           medication.updated, assessment.completed
    resource_type   VARCHAR(100) NOT NULL,
    resource_id     UUID,
    old_value       JSONB,          -- State before change
    new_value       JSONB,          -- State after change
    -- HOW / WHERE
    ip_address      INET,
    user_agent      TEXT,
    request_id      UUID,           -- HTTP request correlation ID
    http_method     VARCHAR(10),
    http_path       TEXT,
    -- CONTEXT
    session_context TEXT,           -- HTTP session (not therapy session)
    metadata        JSONB,          -- Additional context
    -- WHEN
    created_at      TIMESTAMPTZ DEFAULT NOW()
    -- NOTE: NO updated_at — this table is append-only
    -- NOTE: NO deleted_at — records are never deleted
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user         ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource     ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action       ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created      ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip           ON audit_logs(ip_address);

-- Partition audit_logs by quarter for scale
-- CREATE TABLE audit_logs_2024_q1 PARTITION OF audit_logs FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

-- ============================================================
-- IMPORTANT: Row-Level Security on audit_logs
-- Prevents any user from modifying audit records
-- ============================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_insert_only ON audit_logs
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY audit_logs_select ON audit_logs
    FOR SELECT USING (
        -- Organization members can see their org's logs
        organization_id = current_setting('app.organization_id', TRUE)::UUID
        OR
        -- Super admins can see all
        current_setting('app.user_role', TRUE) = 'super_admin'
    );

-- NO UPDATE or DELETE policies — immutable by design

-- ============================================================
-- CONSENT MANAGEMENT
-- Track all patient and user consents (HIPAA + GDPR)
-- ============================================================

CREATE TABLE IF NOT EXISTS consent_versions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consent_type  VARCHAR(100) NOT NULL,
        -- privacy_policy, terms_of_service, recording_consent,
        -- telehealth_consent, ai_assistance_consent, data_processing_consent,
        -- marketing_consent, research_consent
    version       VARCHAR(20) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    content       TEXT NOT NULL,   -- Full legal text
    summary       TEXT,            -- Plain language summary
    effective_date DATE NOT NULL,
    language      VARCHAR(20) DEFAULT 'en',
    is_required   BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(consent_type, version, language)
);

-- Seed required consent types
INSERT INTO consent_versions (consent_type, version, title, content, effective_date) VALUES
('privacy_policy',         '1.0', 'Privacy Policy',               'See full privacy policy at /privacy',                    CURRENT_DATE),
('terms_of_service',       '1.0', 'Terms of Service',             'See full terms of service at /terms',                    CURRENT_DATE),
('recording_consent',      '1.0', 'Session Recording Consent',    'I consent to my therapy sessions being recorded for documentation purposes.', CURRENT_DATE),
('telehealth_consent',     '1.0', 'Telehealth Consent',           'I consent to receive mental health services via telehealth video/audio technology.', CURRENT_DATE),
('ai_assistance_consent',  '1.0', 'AI Assistance Consent',        'I consent to AI-assisted documentation and clinical support tools being used in my care.', CURRENT_DATE),
('data_processing_consent','1.0', 'Data Processing Consent',      'I consent to my health information being processed for treatment purposes.', CURRENT_DATE)
ON CONFLICT (consent_type, version, language) DO NOTHING;

CREATE TABLE IF NOT EXISTS patient_consents (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id        UUID NOT NULL REFERENCES patients(id),
    consent_version_id UUID NOT NULL REFERENCES consent_versions(id),
    consent_type      VARCHAR(100) NOT NULL,
    version           VARCHAR(20) NOT NULL,
    accepted          BOOLEAN NOT NULL,
    accepted_at       TIMESTAMPTZ,
    withdrawn_at      TIMESTAMPTZ,    -- GDPR right to withdraw
    withdrawn_reason  TEXT,
    ip_address        INET,
    user_agent        TEXT,
    signature         TEXT,           -- Digital signature hash
    method            VARCHAR(50) DEFAULT 'click',
        -- click, signature, verbal (noted by therapist), paper
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_consents_patient ON patient_consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_type    ON patient_consents(consent_type, version);

-- ============================================================
-- GDPR DATA SUBJECT REQUESTS
-- Right to access, right to erasure, right to portability
-- ============================================================

CREATE TABLE IF NOT EXISTS data_subject_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    patient_id      UUID REFERENCES patients(id),
    user_id         UUID REFERENCES users(id),
    request_type    VARCHAR(100) NOT NULL,
        -- access, erasure, portability, rectification, restriction, objection
    status          VARCHAR(50) DEFAULT 'pending',
        -- pending, in_progress, completed, rejected, partially_completed
    requested_at    TIMESTAMPTZ DEFAULT NOW(),
    due_by          TIMESTAMPTZ,    -- Regulatory deadline (30 days for GDPR)
    completed_at    TIMESTAMPTZ,
    handled_by      UUID REFERENCES users(id),
    notes           TEXT,
    rejection_reason TEXT,
    export_url      TEXT,           -- For access/portability requests
    export_expires_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECURITY INCIDENTS
-- Track security events, breaches, suspicious activity
-- ============================================================

CREATE TABLE IF NOT EXISTS security_incidents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    incident_type   VARCHAR(100) NOT NULL,
        -- unauthorized_access, failed_login_threshold, data_export,
        -- unusual_access_pattern, api_abuse, potential_breach,
        -- session_hijacking, permission_escalation
    severity        VARCHAR(50) DEFAULT 'medium',
        -- low, medium, high, critical
    status          VARCHAR(50) DEFAULT 'open',
        -- open, investigating, contained, resolved, reported_to_authorities
    description     TEXT NOT NULL,
    affected_users  UUID[],         -- User IDs affected
    affected_records INTEGER,       -- Number of records
    detected_at     TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    resolution      TEXT,
    reported_to_authorities BOOLEAN DEFAULT FALSE,
    reported_at     TIMESTAMPTZ,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DATA RETENTION POLICIES
-- Organization-configurable retention rules (HIPAA compliant)
-- ============================================================

CREATE TABLE IF NOT EXISTS data_retention_policies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id),
    recordings_days     INTEGER DEFAULT 730,    -- 2 years
    transcripts_days    INTEGER DEFAULT 1825,   -- 5 years
    reports_days        INTEGER DEFAULT 2555,   -- 7 years (HIPAA minimum)
    assessments_days    INTEGER DEFAULT 2555,   -- 7 years
    messages_days       INTEGER DEFAULT 1095,   -- 3 years
    audit_logs_days     INTEGER DEFAULT 2555,   -- 7 years (HIPAA requirement)
    patient_data_days   INTEGER DEFAULT 2555,   -- 7 years post-treatment
    allow_patient_deletion BOOLEAN DEFAULT FALSE,  -- GDPR right to erasure
    auto_archive_enabled   BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHI ACCESS LOG
-- Specific log for Protected Health Information access (HIPAA)
-- ============================================================

CREATE TABLE IF NOT EXISTS phi_access_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    organization_id UUID NOT NULL,
    patient_id      UUID NOT NULL,
    resource_type   VARCHAR(100) NOT NULL,
        -- patient_record, session_recording, transcript, clinical_note, assessment, medication
    resource_id     UUID,
    access_type     VARCHAR(50) NOT NULL,
        -- view, download, export, share, print
    access_reason   VARCHAR(255),   -- Treatment, payment, healthcare operations
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phi_access_patient ON phi_access_log(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phi_access_user    ON phi_access_log(user_id, created_at DESC);

-- ============================================================
-- ACCESS CONTROL VIOLATIONS
-- Log unauthorized access attempts
-- ============================================================

CREATE TABLE IF NOT EXISTS access_violations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID,
    organization_id UUID,
    attempted_action VARCHAR(255) NOT NULL,
    resource_type   VARCHAR(100),
    resource_id     UUID,
    required_permission VARCHAR(100),
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_violations_user ON access_violations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_violations_ip   ON access_violations(ip_address, created_at DESC);

-- ============================================================
-- BAA (Business Associate Agreements) Tracking
-- Track vendor BAAs required for HIPAA compliance
-- ============================================================

CREATE TABLE IF NOT EXISTS baa_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),  -- NULL = platform-level
    vendor_name     VARCHAR(255) NOT NULL,
    vendor_type     VARCHAR(100),
        -- cloud_provider, ai_provider, video_provider, email_provider,
        -- payment_processor, analytics, storage
    baa_signed      BOOLEAN DEFAULT FALSE,
    signed_at       TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    document_url    TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed platform-level BAA tracking
INSERT INTO baa_records (vendor_name, vendor_type, baa_signed, notes) VALUES
('Amazon Web Services (AWS)',    'cloud_provider',    TRUE,  'AWS BAA covers S3, RDS, EC2, EKS. Auto-enabled via AWS console.'),
('OpenAI',                       'ai_provider',       TRUE,  'OpenAI Business API BAA required. Must use API key with org BAA enrolled.'),
('Anthropic',                    'ai_provider',       FALSE, 'Anthropic Claude API. BAA available for enterprise customers.'),
('Daily.co / LiveKit',           'video_provider',    FALSE, 'WebRTC video provider. Must confirm BAA before enabling video sessions.'),
('Resend / SendGrid',            'email_provider',    FALSE, 'Email delivery provider. BAA required for PHI in emails.'),
('Stripe',                       'payment_processor', TRUE,  'Stripe BAA available. PCI-DSS compliant. No PHI transmitted.'),
('Cloudflare',                   'cloud_provider',    FALSE, 'Cloudflare for WAF/CDN. Review PHI exposure before enabling WAF logs.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- HIPAA COMPLIANCE CHECKLIST
-- Track compliance implementation status
-- ============================================================

CREATE TABLE IF NOT EXISTS compliance_checklist (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),  -- NULL = platform-level
    requirement     VARCHAR(255) NOT NULL,
    category        VARCHAR(100),
        -- administrative, physical, technical, organizational
    status          VARCHAR(50) DEFAULT 'pending',
        -- pending, in_progress, completed, not_applicable
    evidence_url    TEXT,
    responsible_party VARCHAR(255),
    notes           TEXT,
    due_date        DATE,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed HIPAA technical safeguards checklist
INSERT INTO compliance_checklist (requirement, category) VALUES
('Encryption at rest (AES-256) for all PHI',         'technical'),
('Encryption in transit (TLS 1.3) for all API calls','technical'),
('Audit logging for all PHI access',                  'technical'),
('Role-based access controls (RBAC)',                 'technical'),
('Automatic session timeout (15 min inactivity)',     'technical'),
('Multi-factor authentication for all staff',         'technical'),
('Unique user identification for all users',          'technical'),
('Emergency access procedures documented',            'administrative'),
('Business Associate Agreements with all vendors',    'organizational'),
('Workforce training on HIPAA policies',              'administrative'),
('Risk analysis and management process',              'administrative'),
('Incident response plan documented',                 'administrative'),
('Data backup and recovery procedures',               'technical'),
('Minimum necessary access principle enforced',       'technical'),
('Patient right of access procedures documented',     'administrative'),
('Breach notification procedures documented',         'administrative')
ON CONFLICT DO NOTHING;

-- ============================================================
-- FUNCTION: Create audit log entry (for use from application)
-- ============================================================

CREATE OR REPLACE FUNCTION create_audit_log(
    p_user_id         UUID,
    p_user_email      VARCHAR,
    p_user_role       VARCHAR,
    p_organization_id UUID,
    p_action          VARCHAR,
    p_resource_type   VARCHAR,
    p_resource_id     UUID,
    p_old_value       JSONB DEFAULT NULL,
    p_new_value       JSONB DEFAULT NULL,
    p_ip_address      INET DEFAULT NULL,
    p_metadata        JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id, user_email, user_role, organization_id,
        action, resource_type, resource_id,
        old_value, new_value, ip_address, metadata
    ) VALUES (
        p_user_id, p_user_email, p_user_role, p_organization_id,
        p_action, p_resource_type, p_resource_id,
        p_old_value, p_new_value, p_ip_address, p_metadata
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
