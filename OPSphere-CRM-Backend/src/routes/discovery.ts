import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────

async function getOrgIntegrations(entityId: string): Promise<Record<string, string>> {
  const result = await pool.query<{ integrations: Record<string, string> }>(
    'SELECT integrations FROM organisations WHERE id = $1',
    [entityId],
  );
  return result.rows[0]?.integrations ?? {};
}

interface ProspectInput {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
}

async function saveProspects(
  prospects: ProspectInput[],
  campaignId: string,
  entityId: string,
  source: 'hunter' | 'apollo',
): Promise<number> {
  let saved = 0;
  for (const p of prospects) {
    if (!p.email) continue;

    const exists = await pool.query(
      'SELECT 1 FROM prospects WHERE campaign_id = $1 AND email = $2',
      [campaignId, p.email],
    );
    if ((exists.rowCount ?? 0) > 0) continue;

    await pool.query(
      `INSERT INTO prospects
         (entity_id, campaign_id, first_name, last_name, full_name, email,
          company_name, job_title, linkedin_url, source, pipeline_stage, enrichment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'found', 'pending')`,
      [
        entityId,
        campaignId,
        p.first_name ?? null,
        p.last_name ?? null,
        p.full_name ?? null,
        p.email,
        p.company_name ?? null,
        p.job_title ?? null,
        p.linkedin_url ?? null,
        source,
      ],
    );
    saved++;
  }
  return saved;
}

// ─── GET /status ─────────────────────────────────────────

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityId } = req as AuthenticatedRequest;
    const integrations = await getOrgIntegrations(entityId);

    res.json({
      hunter: !!integrations['HUNTER_API_KEY'],
      apollo: !!integrations['APOLLO_API_KEY'],
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /hunter ─────────────────────────────────────────

const hunterSchema = z.object({
  domain: z.string().min(1),
  campaign_id: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(10),
});

router.post('/hunter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { entityId } = authed;
    const body = hunterSchema.parse(req.body);

    const integrations = await getOrgIntegrations(entityId);
    const apiKey = integrations['HUNTER_API_KEY'];
    if (!apiKey) throw new AppError(400, 'NO_API_KEY', 'Hunter.io API key not configured. Add it in Settings → API Keys.');

    const campCheck = await pool.query(
      'SELECT 1 FROM campaigns WHERE id = $1 AND entity_id = $2',
      [body.campaign_id, entityId],
    );
    if ((campCheck.rowCount ?? 0) === 0) throw new AppError(404, 'NOT_FOUND', 'Campaign not found');

    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(body.domain)}&api_key=${apiKey}&limit=${body.limit}`;
    const response = await fetch(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;

    if (!response.ok) {
      throw new AppError(502, 'HUNTER_ERROR', data.errors?.[0]?.details || 'Hunter.io API error');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prospects: ProspectInput[] = (data.data?.emails ?? []).map((e: any) => ({
      first_name: e.first_name ?? null,
      last_name: e.last_name ?? null,
      full_name: [e.first_name, e.last_name].filter(Boolean).join(' ') || null,
      email: e.value ?? null,
      company_name: data.data?.organization ?? null,
      job_title: e.position ?? null,
      linkedin_url: e.linkedin ?? null,
    }));

    const saved = await saveProspects(prospects, body.campaign_id, entityId, 'hunter');

    res.json({ found: prospects.length, saved });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      return;
    }
    next(err);
  }
});

// ─── POST /apollo ─────────────────────────────────────────

const apolloSchema = z.object({
  campaign_id: z.string().uuid(),
  job_titles: z.array(z.string()).optional().default([]),
  locations: z.array(z.string()).optional().default([]),
  industries: z.array(z.string()).optional().default([]),
  per_page: z.number().int().min(1).max(100).default(25),
});

router.post('/apollo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { entityId } = authed;
    const body = apolloSchema.parse(req.body);

    const integrations = await getOrgIntegrations(entityId);
    const apiKey = integrations['APOLLO_API_KEY'];
    if (!apiKey) throw new AppError(400, 'NO_API_KEY', 'Apollo.io API key not configured. Add it in Settings → API Keys.');

    const campCheck = await pool.query(
      'SELECT 1 FROM campaigns WHERE id = $1 AND entity_id = $2',
      [body.campaign_id, entityId],
    );
    if ((campCheck.rowCount ?? 0) === 0) throw new AppError(404, 'NOT_FOUND', 'Campaign not found');

    const payload = {
      api_key: apiKey,
      per_page: body.per_page,
      person_titles: body.job_titles,
      person_locations: body.locations,
    };

    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify(payload),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;

    if (!response.ok) {
      throw new AppError(502, 'APOLLO_ERROR', data.error || 'Apollo.io API error');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prospects: ProspectInput[] = (data.people ?? []).map((p: any) => ({
      first_name: p.first_name ?? null,
      last_name: p.last_name ?? null,
      full_name: p.name ?? null,
      email: p.email ?? null,
      company_name: p.organization?.name ?? null,
      job_title: p.title ?? null,
      linkedin_url: p.linkedin_url ?? null,
    }));

    const saved = await saveProspects(prospects, body.campaign_id, entityId, 'apollo');

    res.json({ found: prospects.length, saved });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      return;
    }
    next(err);
  }
});

export default router;
