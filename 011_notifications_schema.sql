-- ============================================================
-- 011_notifications_schema.sql
-- 24Therapy.ai — Notifications, Email Templates, SMS, Preferences
-- ============================================================
-- Covers:
-- - In-app notifications
-- - Email notifications + templates
-- - SMS notifications
-- - Push notifications
-- - Notification preferences (per user)
-- - Notification delivery tracking
-- - Scheduled notifications
-- ============================================================
-- Depends on: 001_core_schema.sql, 003_patients_schema.sql
-- ============================================================

-- ============================================================
-- NOTIFICATION TEMPLATES
-- Versioned templates for all notification types
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_key    VARCHAR(100) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    channel         VARCHAR(50) NOT NULL,
        -- email, sms, push, in_app
    subject         VARCHAR(500),       -- For email
    body_text       TEXT NOT NULL,      -- Plain text version
    body_html       TEXT,               -- HTML version (email only)
    variables       TEXT[] DEFAULT '{}', -- Template variables: {{patient_name}}, {{session_time}}, etc.
    is_active       BOOLEAN DEFAULT TRUE,
    language        VARCHAR(20) DEFAULT 'en',
    version         INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default notification templates
INSERT INTO notification_templates (template_key, name, channel, subject, body_text) VALUES
-- Email templates
('email.welcome.patient',
 'Welcome Email — Patient',
 'email',
 'Welcome to 24Therapy — Your mental health journey starts here',
 'Hi {{patient_name}}, welcome to 24Therapy. Your account has been created. Book your first session at {{booking_url}}'),

('email.welcome.therapist',
 'Welcome Email — Therapist',
 'email',
 'Welcome to 24Therapy — Your practice dashboard is ready',
 'Hi {{therapist_name}}, your 24Therapy account is approved. Access your dashboard at {{dashboard_url}}'),

('email.verify_email',
 'Email Verification',
 'email',
 'Verify your 24Therapy email address',
 'Hi {{user_name}}, please verify your email by clicking: {{verification_url}} (expires in 24 hours)'),

('email.password_reset',
 'Password Reset',
 'email',
 'Reset your 24Therapy password',
 'Hi {{user_name}}, click to reset your password: {{reset_url}} (expires in 1 hour). If you did not request this, ignore this email.'),

('email.session_reminder_24h',
 'Session Reminder — 24 Hours',
 'email',
 'Reminder: Your therapy session is tomorrow',
 'Hi {{patient_name}}, you have a session with {{therapist_name}} tomorrow at {{session_time}} ({{timezone}}). Join at: {{session_url}}'),

('email.session_reminder_1h',
 'Session Reminder — 1 Hour',
 'email',
 'Your therapy session starts in 1 hour',
 'Hi {{patient_name}}, your session with {{therapist_name}} starts in 1 hour at {{session_time}}. Join now: {{session_url}}'),

('email.session_completed',
 'Session Completed',
 'email',
 'Your session notes are ready',
 'Hi {{patient_name}}, your session with {{therapist_name}} is complete. Your session summary is available at: {{portal_url}}'),

('email.report_ready',
 'Report Ready for Review',
 'email',
 'Your clinical note is ready for review',
 'Hi Dr. {{therapist_name}}, the AI has generated a {{note_type}} note for your session with {{patient_name}}. Review at: {{note_url}}'),

('email.assessment_reminder',
 'Assessment Due Reminder',
 'email',
 'Your {{assessment_name}} assessment is due',
 'Hi {{patient_name}}, your therapist has requested you complete the {{assessment_name}} assessment. Complete it here: {{assessment_url}}'),

('email.payment_receipt',
 'Payment Receipt',
 'email',
 'Payment confirmed — 24Therapy receipt',
 'Hi {{user_name}}, your payment of {{amount}} {{currency}} has been confirmed. Receipt ID: {{receipt_id}}'),

('email.therapist_approved',
 'Therapist Account Approved',
 'email',
 'Your 24Therapy account has been approved!',
 'Hi {{therapist_name}}, congratulations! Your account has been verified. You can now start accepting patients. Access your dashboard: {{dashboard_url}}'),

('email.radar_match',
 'New Radar Session Match',
 'email',
 'A patient is requesting an immediate session',
 'Hi {{therapist_name}}, a patient needs support now. Match score: {{match_score}}. Accept within {{timeout_minutes}} minutes: {{accept_url}}'),

-- SMS templates
('sms.session_starting',
 'Session Starting Soon — SMS',
 'sms',
 NULL,
 '24Therapy: Your session with {{therapist_name}} starts in 5 minutes. Join: {{session_url}}'),

('sms.radar_match',
 'Radar Match — SMS',
 'sms',
 NULL,
 '24Therapy: Patient needs immediate support. Accept in {{timeout_minutes}} min: {{accept_url}}'),

('sms.verification_code',
 'Phone Verification Code',
 'sms',
 NULL,
 '24Therapy: Your verification code is {{code}}. Valid for 10 minutes.'),

('sms.security_alert',
 'Security Alert — SMS',
 'sms',
 NULL,
 '24Therapy Security: New login from {{device}} in {{location}}. Not you? Secure your account: {{security_url}}'),

-- In-app notification templates
('in_app.session_reminder',
 'In-App Session Reminder',
 'in_app',
 NULL,
 'Your session with {{therapist_name}} starts at {{session_time}}'),

('in_app.report_ready',
 'In-App Report Ready',
 'in_app',
 NULL,
 'AI note for {{patient_name}} is ready for review'),

('in_app.assessment_submitted',
 'In-App Assessment Submitted',
 'in_app',
 NULL,
 '{{patient_name}} completed the {{assessment_name}}'),

('in_app.radar_request',
 'In-App Radar Request',
 'in_app',
 NULL,
 'New Radar session request — respond within {{timeout_minutes}} minutes'),

('in_app.risk_alert',
 'In-App Risk Alert',
 'in_app',
 NULL,
 'Risk indicator flagged for {{patient_name}} in session {{session_date}}')
ON CONFLICT (template_key) DO NOTHING;

-- ============================================================
-- NOTIFICATIONS
-- Delivered notification instances
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    template_key    VARCHAR(100) REFERENCES notification_templates(template_key),
    channel         VARCHAR(50) NOT NULL,
        -- email, sms, push, in_app
    title           VARCHAR(500),
    body            TEXT NOT NULL,
    action_url      TEXT,
    action_label    VARCHAR(100),
    read            BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    delivered       BOOLEAN DEFAULT FALSE,
    delivered_at    TIMESTAMPTZ,
    status          VARCHAR(50) DEFAULT 'pending',
        -- pending, sent, delivered, failed, bounced
    priority        VARCHAR(20) DEFAULT 'normal',
        -- low, normal, high, urgent
    metadata        JSONB,          -- Related entity references
    scheduled_for   TIMESTAMPTZ,   -- For scheduled notifications
    sent_at         TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user      ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read      ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON notifications(created_at DESC);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- Per-user, per-channel, per-event-type preferences
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id),
    -- In-app
    in_app_enabled  BOOLEAN DEFAULT TRUE,
    -- Email preferences
    email_enabled   BOOLEAN DEFAULT TRUE,
    email_session_reminders  BOOLEAN DEFAULT TRUE,
    email_report_ready       BOOLEAN DEFAULT TRUE,
    email_assessment_due     BOOLEAN DEFAULT TRUE,
    email_payment_events     BOOLEAN DEFAULT TRUE,
    email_marketing          BOOLEAN DEFAULT TRUE,
    email_radar_matches      BOOLEAN DEFAULT TRUE,
    email_risk_alerts        BOOLEAN DEFAULT TRUE,
    -- SMS preferences
    sms_enabled     BOOLEAN DEFAULT TRUE,
    sms_session_reminders    BOOLEAN DEFAULT TRUE,
    sms_radar_matches        BOOLEAN DEFAULT TRUE,
    sms_verification         BOOLEAN DEFAULT TRUE,
    sms_security_alerts      BOOLEAN DEFAULT TRUE,
    -- Push preferences
    push_enabled    BOOLEAN DEFAULT TRUE,
    push_token      TEXT,           -- FCM/APNs device token
    push_session_reminders   BOOLEAN DEFAULT TRUE,
    push_messages            BOOLEAN DEFAULT TRUE,
    push_radar               BOOLEAN DEFAULT TRUE,
    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_start     TIME,           -- e.g., 22:00
    quiet_end       TIME,           -- e.g., 08:00
    timezone        VARCHAR(100) DEFAULT 'UTC',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EMAIL DELIVERY LOG
-- Track deliverability metrics
-- ============================================================

CREATE TABLE IF NOT EXISTS email_delivery_log (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id   UUID REFERENCES notifications(id),
    recipient_email   VARCHAR(255) NOT NULL,
    provider          VARCHAR(50) DEFAULT 'resend',
        -- resend, sendgrid, ses, smtp
    provider_message_id VARCHAR(255),
    status            VARCHAR(50) DEFAULT 'sent',
        -- sent, delivered, opened, clicked, bounced, spam, failed
    opened_at         TIMESTAMPTZ,
    clicked_at        TIMESTAMPTZ,
    bounced_at        TIMESTAMPTZ,
    bounce_type       VARCHAR(50),  -- hard, soft
    spam_at           TIMESTAMPTZ,
    error_code        VARCHAR(100),
    error_message     TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PUSH NOTIFICATION DEVICES
-- Track registered push notification devices
-- ============================================================

CREATE TABLE IF NOT EXISTS push_devices (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id),
    platform     VARCHAR(20) NOT NULL,  -- ios, android, web
    device_token TEXT NOT NULL,
    device_name  VARCHAR(255),
    app_version  VARCHAR(50),
    is_active    BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_token)
);

-- ============================================================
-- NOTIFICATION QUEUE
-- Async notification processing queue
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id),
    priority        INTEGER DEFAULT 5,   -- 1=highest, 10=lowest
    attempts        INTEGER DEFAULT 0,
    max_attempts    INTEGER DEFAULT 3,
    next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    locked_at       TIMESTAMPTZ,         -- Prevent concurrent processing
    locked_by       VARCHAR(255),        -- Worker ID
    completed_at    TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_next ON notification_queue(next_attempt_at, priority)
    WHERE completed_at IS NULL AND failed_at IS NULL;

-- ============================================================
-- FUNCTION: Send notification (enqueue)
-- ============================================================

CREATE OR REPLACE FUNCTION enqueue_notification(
    p_user_id        UUID,
    p_template_key   VARCHAR,
    p_channel        VARCHAR,
    p_variables      JSONB,
    p_metadata       JSONB DEFAULT NULL,
    p_scheduled_for  TIMESTAMPTZ DEFAULT NULL,
    p_priority       VARCHAR DEFAULT 'normal'
) RETURNS UUID AS $$
DECLARE
    v_template notification_templates%ROWTYPE;
    v_notification_id UUID;
    v_body TEXT;
BEGIN
    -- Get template
    SELECT * INTO v_template
    FROM notification_templates
    WHERE template_key = p_template_key AND channel = p_channel AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE WARNING 'Notification template not found: % / %', p_template_key, p_channel;
        RETURN NULL;
    END IF;

    -- Simple variable substitution placeholder (actual substitution done in app layer)
    v_body := v_template.body_text;

    -- Create notification record
    INSERT INTO notifications (user_id, template_key, channel, title, body, metadata, scheduled_for, priority)
    VALUES (p_user_id, p_template_key, p_channel, v_template.subject, v_body, p_metadata,
            COALESCE(p_scheduled_for, NOW()), p_priority)
    RETURNING id INTO v_notification_id;

    -- Enqueue for processing
    INSERT INTO notification_queue (notification_id, priority)
    VALUES (v_notification_id, CASE p_priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 3 WHEN 'normal' THEN 5 ELSE 8 END);

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMUNICATION LOG
-- All outbound communications (patient-therapist)
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    type            VARCHAR(50) DEFAULT 'patient_therapist',
        -- patient_therapist, internal, support, broadcast
    patient_id      UUID REFERENCES patients(id),
    therapist_id    UUID REFERENCES therapists(id),
    status          VARCHAR(50) DEFAULT 'active',
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id),
    sender_id        UUID NOT NULL REFERENCES users(id),
    content          TEXT NOT NULL,
    content_type     VARCHAR(50) DEFAULT 'text',
        -- text, file, image, system
    file_url         TEXT,
    read             BOOLEAN DEFAULT FALSE,
    read_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread       ON messages(conversation_id, read) WHERE read = FALSE;
