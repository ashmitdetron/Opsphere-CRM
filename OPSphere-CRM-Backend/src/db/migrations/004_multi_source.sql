-- Migration 004: Multi-source discovery + default campaigns
-- Extends source enum to include apollo/bing, seeds default campaigns for known orgs
-- Run: psql $DATABASE_URL -f src/db/migrations/004_multi_source.sql

BEGIN;

-- ============================================================
-- Extend prospect source CHECK to include apollo + bing
-- ============================================================
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_source_check;
ALTER TABLE prospects ADD CONSTRAINT prospects_source_check
  CHECK (source IN ('csv', 'serper', 'proxycurl', 'linkedin', 'manual', 'apollo', 'bing'));

-- ============================================================
-- Default campaigns for Detron, Manabuilt, and BYRZ
-- ============================================================
DO $$
DECLARE
  detron_id    UUID;
  manabuilt_id UUID;
  byrz_id      UUID;
BEGIN

  -- ── Detron ──────────────────────────────────────────────
  SELECT id INTO detron_id
  FROM organisations
  WHERE name ILIKE '%detron%'
  LIMIT 1;

  IF detron_id IS NOT NULL THEN
    INSERT INTO campaigns (
      entity_id, name, description,
      icp_industries, icp_seniority, icp_locations, icp_keywords,
      daily_send_limit, status
    )
    VALUES
      (
        detron_id,
        'APAC Automation Leaders',
        'Target operations and engineering leaders in manufacturing and industrial automation across the APAC region.',
        ARRAY['Manufacturing', 'Industrial Automation', 'Robotics', 'Engineering'],
        ARRAY['Head of Operations', 'VP Manufacturing', 'Director of Engineering', 'CTO', 'Plant Manager'],
        ARRAY['Sydney', 'Melbourne', 'Brisbane', 'Singapore', 'Auckland'],
        ARRAY['automation', 'efficiency', 'Industry 4.0', 'digital transformation'],
        25,
        'draft'
      ),
      (
        detron_id,
        'Enterprise Digital Transformation ANZ',
        'Reach IT and digital transformation decision-makers at mid-to-large enterprise companies in Australia and New Zealand.',
        ARRAY['Technology', 'Enterprise Software', 'Consulting'],
        ARRAY['CTO', 'CIO', 'VP Technology', 'Head of Digital', 'Director of IT'],
        ARRAY['Sydney', 'Melbourne', 'Auckland', 'Wellington'],
        ARRAY['digital transformation', 'cloud', 'ERP', 'integration'],
        20,
        'draft'
      );
    RAISE NOTICE 'Seeded 2 campaigns for Detron (%)' , detron_id;
  ELSE
    RAISE NOTICE 'Organisation "Detron" not found — skipping';
  END IF;

  -- ── Manabuilt ────────────────────────────────────────────
  SELECT id INTO manabuilt_id
  FROM organisations
  WHERE name ILIKE '%manabuilt%'
  LIMIT 1;

  IF manabuilt_id IS NOT NULL THEN
    INSERT INTO campaigns (
      entity_id, name, description,
      icp_industries, icp_seniority, icp_locations, icp_keywords,
      daily_send_limit, status
    )
    VALUES
      (
        manabuilt_id,
        'Construction & Property Development Leads',
        'Target project directors, developers, and procurement managers in construction and property development.',
        ARRAY['Construction', 'Property Development', 'Real Estate', 'Infrastructure'],
        ARRAY['Project Director', 'Development Manager', 'Head of Procurement', 'Construction Manager', 'GM'],
        ARRAY['Sydney', 'Melbourne', 'Brisbane', 'Gold Coast', 'Perth'],
        ARRAY['construction', 'development', 'build', 'residential', 'commercial'],
        20,
        'draft'
      ),
      (
        manabuilt_id,
        'Tier 1 Builder Outreach',
        'Target senior stakeholders at Tier 1 and Tier 2 construction companies looking to scale project delivery.',
        ARRAY['Construction', 'Civil Engineering'],
        ARRAY['CEO', 'COO', 'Managing Director', 'Head of Operations', 'Estimating Manager'],
        ARRAY['Sydney', 'Melbourne', 'Canberra', 'Brisbane'],
        ARRAY['tier 1', 'tier 2', 'subcontract', 'procurement', 'project pipeline'],
        15,
        'draft'
      );
    RAISE NOTICE 'Seeded 2 campaigns for Manabuilt (%)' , manabuilt_id;
  ELSE
    RAISE NOTICE 'Organisation "Manabuilt" not found — skipping';
  END IF;

  -- ── BYRZ ─────────────────────────────────────────────────
  SELECT id INTO byrz_id
  FROM organisations
  WHERE name ILIKE '%byrz%'
  LIMIT 1;

  IF byrz_id IS NOT NULL THEN
    INSERT INTO campaigns (
      entity_id, name, description,
      icp_industries, icp_seniority, icp_locations, icp_keywords,
      daily_send_limit, status
    )
    VALUES
      (
        byrz_id,
        'Brand & Marketing Decision Makers',
        'Reach CMOs, brand managers, and marketing leads at growth-stage companies looking for creative and brand strategy partners.',
        ARRAY['Marketing', 'Advertising', 'Media', 'E-commerce', 'Retail', 'Consumer Goods'],
        ARRAY['CMO', 'Head of Marketing', 'Brand Manager', 'Marketing Director', 'VP Marketing'],
        ARRAY['Sydney', 'Melbourne', 'Brisbane', 'Singapore', 'London'],
        ARRAY['brand', 'marketing', 'growth', 'creative', 'campaign'],
        30,
        'draft'
      ),
      (
        byrz_id,
        'Startup & Scale-up Founders',
        'Target founders and co-founders at startups and scale-ups in the growth phase who need brand and go-to-market support.',
        ARRAY['SaaS', 'Fintech', 'E-commerce', 'D2C', 'Consumer Tech'],
        ARRAY['Founder', 'Co-Founder', 'CEO', 'Head of Growth', 'Chief Marketing Officer'],
        ARRAY['Sydney', 'Melbourne', 'Singapore', 'Auckland', 'London'],
        ARRAY['startup', 'scale-up', 'growth', 'brand identity', 'go-to-market'],
        25,
        'draft'
      );
    RAISE NOTICE 'Seeded 2 campaigns for BYRZ (%)' , byrz_id;
  ELSE
    RAISE NOTICE 'Organisation "BYRZ" not found — skipping';
  END IF;

END $$;

COMMIT;
