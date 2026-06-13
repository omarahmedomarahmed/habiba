-- Local development database initialisation
-- Run once after creating the database:
--   psql $DATABASE_URL -f scripts/db/init.sql
-- Then run migrations:
--   node scripts/migrate.js

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reviewed: 2026-06-13 — 24Therapy audit
