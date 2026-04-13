-- Migration 005: Add hunter to prospect source constraint
BEGIN;

ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_source_check;
ALTER TABLE prospects ADD CONSTRAINT prospects_source_check
  CHECK (source IN ('csv', 'serper', 'proxycurl', 'linkedin', 'manual', 'apollo', 'bing', 'hunter'));

COMMIT;
