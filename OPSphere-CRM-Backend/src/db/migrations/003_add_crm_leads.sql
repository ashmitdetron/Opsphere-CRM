-- Migration 003: Add crm_leads table (separate from the existing OPSphere leads table)
-- Run: psql $DATABASE_URL -f src/db/migrations/003_add_crm_leads.sql

BEGIN;

-- ============================================================
-- crm_leads
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT,
  stage_id UUID,
  assigned_to UUID REFERENCES crm_users(id),
  notes TEXT,
  value NUMERIC,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_entity_id ON crm_leads(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_email ON crm_leads(email);
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage_id ON crm_leads(stage_id);

CREATE OR REPLACE TRIGGER trg_crm_leads_updated_at
  BEFORE UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
