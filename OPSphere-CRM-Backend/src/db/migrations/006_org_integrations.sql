-- Migration 006: Add integrations JSONB column to organisations
-- Stores per-org API keys (encrypted at rest by Supabase, access-controlled by row-level logic)
BEGIN;

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS integrations JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
