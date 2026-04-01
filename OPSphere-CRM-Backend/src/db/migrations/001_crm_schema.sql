-- OPSphere CRM Schema Migration
-- Creates all CRM-specific tables, indexes, and triggers.
-- Run: psql $DATABASE_URL -f src/db/migrations/001_crm_schema.sql

BEGIN;

-- ============================================================
-- Helper: auto-update updated_at on row modification
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- organisations
-- ============================================================
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organisations_name ON organisations(name);

CREATE OR REPLACE TRIGGER trg_organisations_updated_at
  BEFORE UPDATE ON organisations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- crm_users
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_users_entity_id ON crm_users(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_users_email ON crm_users(email);

CREATE OR REPLACE TRIGGER trg_crm_users_updated_at
  BEFORE UPDATE ON crm_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- crm_entity_members
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_entity_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_entity_members_entity_id ON crm_entity_members(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_entity_members_user_id ON crm_entity_members(user_id);

-- ============================================================
-- brand_voices
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  value_proposition TEXT,
  tone TEXT NOT NULL DEFAULT 'professional',
  avoid_phrases TEXT[],
  example_messages TEXT[],
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_voices_entity_id ON brand_voices(entity_id);

CREATE OR REPLACE TRIGGER trg_brand_voices_updated_at
  BEFORE UPDATE ON brand_voices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  brand_voice_id UUID REFERENCES brand_voices(id),
  icp_industries TEXT[],
  icp_seniority TEXT[],
  icp_company_size TEXT,
  icp_locations TEXT[],
  icp_keywords TEXT[],
  daily_send_limit INTEGER NOT NULL DEFAULT 20,
  total_prospect_count INTEGER NOT NULL DEFAULT 0,
  total_message_count INTEGER NOT NULL DEFAULT 0,
  total_reply_count INTEGER NOT NULL DEFAULT 0,
  total_meeting_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES crm_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_entity_id ON campaigns(entity_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

CREATE OR REPLACE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- prospects
-- ============================================================
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  email TEXT,
  linkedin_url TEXT,
  company_name TEXT,
  company_website TEXT,
  job_title TEXT,
  industry TEXT,
  location TEXT,
  company_size TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('csv', 'serper', 'proxycurl', 'linkedin', 'manual')),
  source_tier INTEGER NOT NULL DEFAULT 1,
  enrichment_status TEXT NOT NULL DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  enrichment_data JSONB NOT NULL DEFAULT '{}',
  pipeline_stage TEXT NOT NULL DEFAULT 'found' CHECK (pipeline_stage IN ('found', 'researched', 'message_drafted', 'message_approved', 'message_sent', 'replied', 'meeting_booked', 'converted', 'rejected')),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_entity_id ON prospects(entity_id);
CREATE INDEX IF NOT EXISTS idx_prospects_campaign_id ON prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_prospects_pipeline_stage ON prospects(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_prospects_enrichment_status ON prospects(enrichment_status);

CREATE OR REPLACE TRIGGER trg_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- outreach_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'linkedin' CHECK (channel IN ('linkedin', 'email')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'queued', 'sent', 'failed')),
  approved_by UUID REFERENCES crm_users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  sent_at TIMESTAMPTZ,
  phantombuster_ref TEXT,
  ai_model TEXT,
  ai_prompt_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_entity_id ON outreach_messages(entity_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_campaign_id ON outreach_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_prospect_id ON outreach_messages(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_status ON outreach_messages(status);

CREATE OR REPLACE TRIGGER trg_outreach_messages_updated_at
  BEFORE UPDATE ON outreach_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- pipeline_events (append-only — no updated_at)
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('found', 'enriched', 'message_drafted', 'message_approved', 'message_rejected', 'message_sent', 'reply_received', 'meeting_booked', 'converted', 'rejected')),
  from_stage TEXT,
  to_stage TEXT,
  notes TEXT,
  created_by UUID REFERENCES crm_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_entity_id ON pipeline_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_prospect_id ON pipeline_events(prospect_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_campaign_id ON pipeline_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_event_type ON pipeline_events(event_type);

-- ============================================================
-- appointments
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_by UUID REFERENCES crm_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_entity_id ON appointments(entity_id);
CREATE INDEX IF NOT EXISTS idx_appointments_prospect_id ON appointments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_appointments_campaign_id ON appointments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);

CREATE OR REPLACE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
