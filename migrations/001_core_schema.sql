-- ============================================================
-- 24Therapy.ai — Migration 001: Core Schema
-- Organizations, Extensions, Plans
-- ============================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- trigram search

-- ============================================================
-- SUBSCRIPTION PLANS (reference table)
-- ============================================================
CREATE TABLE plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    code            VARCHAR(50) UNIQUE NOT NULL,  -- 'starter', 'professional', 'practice', 'enterprise'
    description     TEXT,
    price_monthly   NUMERIC(10,2),
    price_yearly    NUMERIC(10,2),
    currency        VARCHAR(3) DEFAULT 'USD',
    max_therapists  INTEGER,                      -- NULL = unlimited
    max_patients    INTEGER,                      -- NULL = unlimited
    max_sessions_per_month INTEGER,               -- NULL = unlimited
    features        JSONB DEFAULT '{}',           -- Feature flags included in plan
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORGANIZATIONS (multi-tenant root)
-- ============================================================
CREATE TABLE organizations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(100) UNIQUE NOT NULL,
    organization_type   VARCHAR(50) NOT NULL DEFAULT 'solo',
    plan_id             UUID REFERENCES plans(id),
    status              VARCHAR(50) NOT NULL DEFAULT 'trial',
    country             VARCHAR(2),       -- ISO 3166-1 alpha-2
    timezone            VARCHAR(100) DEFAULT 'UTC',
    currency            VARCHAR(3) DEFAULT 'USD',
    website             VARCHAR(500),
    logo_url            VARCHAR(1000),
    primary_color       VARCHAR(7),       -- Hex for white labeling
    custom_domain       VARCHAR(255),     -- White label domain
    trial_ends_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,      -- Soft delete
    
    CONSTRAINT organizations_type_check CHECK (
        organization_type IN ('solo', 'practice', 'clinic', 'hospital', 'enterprise', 'partner')
    ),
    CONSTRAINT organizations_status_check CHECK (
        status IN ('active', 'trial', 'suspended', 'cancelled', 'pending')
    )
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- ORGANIZATION SETTINGS
-- ============================================================
CREATE TABLE organization_settings (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id         UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    branding_settings       JSONB DEFAULT '{
        "logo_url": null,
        "primary_color": "#0A2342",
        "secondary_color": "#1F5EFF",
        "accent_color": "#24C8DB",
        "custom_domain": null
    }',
    retention_settings      JSONB DEFAULT '{
        "session_recording_days": 365,
        "transcript_days": 2555,
        "report_days": 2555
    }',
    notification_settings   JSONB DEFAULT '{
        "session_reminder_hours": 24,
        "email_enabled": true,
        "sms_enabled": false,
        "push_enabled": true
    }',
    feature_flags           JSONB DEFAULT '{}',
    security_settings       JSONB DEFAULT '{
        "mfa_required": false,
        "session_timeout_minutes": 480,
        "ip_whitelist": [],
        "allowed_countries": []
    }',
    ai_settings             JSONB DEFAULT '{
        "scribe_enabled": true,
        "copilot_enabled": true,
        "memory_enabled": true,
        "patient_companion_enabled": false
    }',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email               VARCHAR(255) NOT NULL,
    phone               VARCHAR(50),
    password_hash       VARCHAR(255),           -- bcrypt hash
    first_name          VARCHAR(100),
    last_name           VARCHAR(100),
    avatar_url          VARCHAR(1000),
    role                VARCHAR(50) NOT NULL DEFAULT 'therapist',
    status              VARCHAR(50) NOT NULL DEFAULT 'invited',
    email_verified_at   TIMESTAMPTZ,
    phone_verified_at   TIMESTAMPTZ,
    mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret          VARCHAR(255),           -- TOTP secret (encrypted)
    last_login_at       TIMESTAMPTZ,
    last_login_ip       VARCHAR(45),
    failed_login_count  INTEGER NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT users_role_check CHECK (
        role IN ('super_admin', 'admin', 'manager', 'therapist', 'assistant', 'billing', 'support', 'patient')
    ),
    CONSTRAINT users_status_check CHECK (
        status IN ('active', 'inactive', 'invited', 'suspended')
    )
);

-- Email must be unique per organization
CREATE UNIQUE INDEX idx_users_email_org ON users(organization_id, email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- USER PERMISSIONS (custom overrides beyond role)
-- ============================================================
CREATE TABLE user_permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_key  VARCHAR(100) NOT NULL,
    granted         BOOLEAN NOT NULL DEFAULT TRUE,
    granted_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, permission_key)
);

CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);

-- ============================================================
-- REFRESH TOKENS (auth)
-- ============================================================
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    device_info     JSONB,
    ip_address      VARCHAR(45),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- ============================================================
-- SSO CONNECTIONS (Enterprise)
-- ============================================================
CREATE TABLE sso_connections (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    provider            VARCHAR(50) NOT NULL,    -- 'saml', 'oidc', 'oauth2'
    provider_name       VARCHAR(100),
    config              JSONB NOT NULL DEFAULT '{}',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TIMESTAMPS TRIGGER (auto-update updated_at)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_settings_updated_at
    BEFORE UPDATE ON organization_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED: Default plans
-- ============================================================
INSERT INTO plans (name, code, description, price_monthly, price_yearly, max_therapists, max_patients, features) VALUES
('Starter', 'starter', 'Best for independent therapists. Free or pay-as-you-go.', 0.00, 0.00, 1, 50, '{"scribe": true, "copilot": false, "radar": true, "marketplace": true, "analytics": "basic"}'),
('Professional', 'professional', 'For active therapists with unlimited documentation needs.', 99.00, 990.00, 1, NULL, '{"scribe": true, "copilot": true, "radar": true, "marketplace": true, "analytics": "advanced", "priority_support": true}'),
('Practice', 'practice', 'For group practices with multiple therapists.', 249.00, 2490.00, 15, NULL, '{"scribe": true, "copilot": true, "radar": true, "marketplace": true, "analytics": "practice", "assistants": true, "shared_billing": true}'),
('Enterprise', 'enterprise', 'Custom pricing for hospitals and large organizations.', NULL, NULL, NULL, NULL, '{"scribe": true, "copilot": true, "radar": true, "marketplace": true, "analytics": "enterprise", "sso": true, "api_access": true, "white_label": true, "dedicated_support": true}');
