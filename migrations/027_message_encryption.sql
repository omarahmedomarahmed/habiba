-- Migration 027: Message content encryption flag
-- The application layer encrypts message content with AES-256-GCM before insert.
-- This column lets queries skip decrypt attempts on legacy plaintext rows.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS encrypted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_messages_encrypted ON messages(encrypted)
  WHERE encrypted = true;
