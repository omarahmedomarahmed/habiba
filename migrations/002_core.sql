-- ============================================================
-- 002_core.sql
-- 24Therapy.ai — Core: Plans, Organizations, Users, Auth
-- ============================================================

-- ------------------------------------------------------------
-- plans (legacy org plan reference)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                     VARCHAR(100) NOT NULL,
  code                     VARCHAR(50)  NOT NULL,
  description              TEXT,
  price_monthly            NUMERIC(10,2),
  price_yearly             NUMERIC(10,2),
  currency                 VARCHAR(3)   NOT NULL DEFAULT 'USD',
  max_therapists           INTEGER,
  max_patients             INTEGER,
  max_sessions_per_month   INTEGER,
  features                 JSONB        NOT NULL DEFAULT '{}',
  is_active                BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT plans_code_key UNIQUE (code)
);

-- ------------------------------------------------------------
-- organizations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(100) NOT NULL,
  organization_type VARCHAR(50)  NOT NULL DEFAULT 'solo',
  plan_id           UUID REFERENCES plans(id) ON DELETE SET NULL,
  status            VARCHAR(50)  NOT NULL DEFAULT 'trial',
  country           VARCHAR(2),
  timezone          VARCHAR(100) NOT NULL DEFAULT 'UTC',
  currency          VARCHAR(3)   NOT NULL DEFAULT 'USD',
  website           VARCHAR(500),
  logo_url          VARCHAR(1000),
  primary_color     VARCHAR(7),
  custom_domain     VARCHAR(255),
  trial_ends_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT organizations_slug_key UNIQUE (slug),
  CONSTRAINT organizations_type_check CHECK (
    organization_type IN ('solo','practice','clinic','hospital','enterprise','partner')
  ),
  CONSTRAINT organizations_status_check CHECK (
    status IN ('active','trial','suspended','cancelled','pending')
  )
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug        ON organizations (slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status      ON organizations (status);
CREATE INDEX IF NOT EXISTS idx_organizations_plan_id     ON organizations (plan_id);
CREATE INDEX IF NOT EXISTS idx_organizations_not_deleted ON organizations (id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- organization_settings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_settings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branding_settings     JSONB NOT NULL DEFAULT '{"logo_url":null,"primary_color":"#0A2342","secondary_color":"#1F5EFF","accent_color":"#24C8DB","custom_domain":null}',
  retention_settings    JSONB NOT NULL DEFAULT '{"session_recording_days":365,"transcript_days":2555,"report_days":2555}',
  notification_settings JSONB NOT NULL DEFAULT '{"session_reminder_hours":24,"email_enabled":true,"sms_enabled":false,"push_enabled":true}',
  feature_flags         JSONB NOT NULL DEFAULT '{}',
  security_settings     JSONB NOT NULL DEFAULT '{"mfa_required":false,"session_timeout_minutes":480,"ip_whitelist":[],"allowed_countries":[]}',
  ai_settings           JSONB NOT NULL DEFAULT '{"scribe_enabled":true,"copilot_enabled":true,"memory_enabled":true,"patient_companion_enabled":false}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_settings_org_id_key UNIQUE (organization_id)
);

CREATE OR REPLACE TRIGGER trg_organization_settings_updated_at
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email               VARCHAR(255) NOT NULL,
  phone               VARCHAR(50),
  password_hash       VARCHAR(255),
  first_name          VARCHAR(100),
  last_name           VARCHAR(100),
  avatar_url          VARCHAR(1000),
  role                VARCHAR(50)  NOT NULL DEFAULT 'therapist',
  status              VARCHAR(50)  NOT NULL DEFAULT 'invited',
  email_verified_at   TIMESTAMPTZ,
  phone_verified_at   TIMESTAMPTZ,
  mfa_enabled         BOOLEAN      NOT NULL DEFAULT FALSE,
  mfa_secret          VARCHAR(255),
  last_login_at       TIMESTAMPTZ,
  last_login_ip       VARCHAR(45),
  failed_login_count  INTEGER      NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  CONSTRAINT users_role_check CHECK (
    role IN ('super_admin','admin','manager','therapist','assistant','billing','support','patient')
  ),
  CONSTRAINT users_status_check CHECK (
    status IN ('active','inactive','invited','suspended')
  )
);

-- Unique email per org (only for non-deleted users)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_org_email_unique
  ON users (organization_id, email)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email           ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role            ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status          ON users (status);

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- user_permissions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_permissions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key VARCHAR(100) NOT NULL,
  granted        BOOLEAN      NOT NULL DEFAULT TRUE,
  granted_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT user_permissions_unique UNIQUE (user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions (user_id);

-- ------------------------------------------------------------
-- refresh_tokens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  device_info JSONB,
  ip_address  VARCHAR(45),
  expires_at  TIMESTAMPTZ  NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);

-- ------------------------------------------------------------
-- sso_connections
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sso_connections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        VARCHAR(50)  NOT NULL,
  provider_name   VARCHAR(100),
  config          JSONB        NOT NULL DEFAULT '{}',
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_sso_connections_updated_at
  BEFORE UPDATE ON sso_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
