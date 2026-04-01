import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { AuthenticatedRequest, Campaign } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { discoverProspects } from '../services/agents/discoveryAgent.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────

const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  brand_voice_id: z.string().uuid().optional(),
  icp_industries: z.array(z.string()).optional(),
  icp_seniority: z.array(z.string()).optional(),
  icp_company_size: z.string().optional(),
  icp_locations: z.array(z.string()).optional(),
  icp_keywords: z.array(z.string()).optional(),
  daily_send_limit: z.number().int().min(1).default(20),
});

const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
});

// ─── GET /api/crm/campaigns ─────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { status, limit = '50', offset = '0' } = req.query;

    const conditions: string[] = ['entity_id = $1'];
    const params: unknown[] = [authed.entityId];
    let idx = 2;

    if (status) {
      conditions.push(`status = $${idx}`);
      params.push(status);
      idx++;
    }

    const where = conditions.join(' AND ');
    params.push(Number(limit), Number(offset));

    const result = await pool.query<Campaign>(
      `SELECT * FROM campaigns WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    const countResult = await pool.query(
      `SELECT count(*)::int AS total FROM campaigns WHERE ${where}`,
      params.slice(0, -2),
    );

    res.json({
      campaigns: result.rows,
      total: countResult.rows[0].total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/crm/campaigns/:id ─────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;

    const result = await pool.query<Campaign>(
      'SELECT * FROM campaigns WHERE id = $1 AND entity_id = $2',
      [id, authed.entityId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
    }

    const campaign = result.rows[0];

    const statsResult = await pool.query(
      `SELECT
         pipeline_stage,
         count(*)::int AS count
       FROM prospects
       WHERE campaign_id = $1 AND entity_id = $2
       GROUP BY pipeline_stage`,
      [id, authed.entityId],
    );

    res.json({
      campaign,
      stage_breakdown: statsResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/crm/campaigns ────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const body = createCampaignSchema.parse(req.body);

    const result = await pool.query<Campaign>(
      `INSERT INTO campaigns (
        entity_id, name, description, brand_voice_id,
        icp_industries, icp_seniority, icp_company_size, icp_locations, icp_keywords,
        daily_send_limit, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        authed.entityId,
        body.name,
        body.description ?? null,
        body.brand_voice_id ?? null,
        body.icp_industries ?? null,
        body.icp_seniority ?? null,
        body.icp_company_size ?? null,
        body.icp_locations ?? null,
        body.icp_keywords ?? null,
        body.daily_send_limit,
        authed.user.sub,
      ],
    );

    res.status(201).json({ campaign: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
      });
      return;
    }
    next(err);
  }
});

// ─── PATCH /api/crm/campaigns/:id ───────────────────────

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = updateCampaignSchema.parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fieldMap: Record<string, unknown> = {
      name: body.name,
      description: body.description,
      status: body.status,
      brand_voice_id: body.brand_voice_id,
      icp_industries: body.icp_industries,
      icp_seniority: body.icp_seniority,
      icp_company_size: body.icp_company_size,
      icp_locations: body.icp_locations,
      icp_keywords: body.icp_keywords,
      daily_send_limit: body.daily_send_limit,
    };

    for (const [col, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        fields.push(`${col} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (fields.length === 0) {
      throw new AppError(400, 'NO_FIELDS', 'No fields to update');
    }

    values.push(id, authed.entityId);

    const result = await pool.query<Campaign>(
      `UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${idx} AND entity_id = $${idx + 1} RETURNING *`,
      values,
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
    }

    res.json({ campaign: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
      });
      return;
    }
    next(err);
  }
});

// ─── POST /api/crm/campaigns/:id/run ────────────────────

router.post('/:id/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;

    const campaignResult = await pool.query<Campaign>(
      'SELECT * FROM campaigns WHERE id = $1 AND entity_id = $2',
      [id, authed.entityId],
    );

    if (campaignResult.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    if (campaign.status !== 'active' && campaign.status !== 'draft') {
      throw new AppError(400, 'INVALID_STATUS', 'Campaign must be active or draft to run discovery');
    }

    await pool.query(
      "UPDATE campaigns SET status = 'active' WHERE id = $1",
      [id],
    );

    const discoveries = await discoverProspects(campaign);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let insertedCount = 0;
      for (const disc of discoveries) {
        const existing = await client.query(
          'SELECT id FROM prospects WHERE campaign_id = $1 AND linkedin_url = $2',
          [id, disc.linkedin_url],
        );
        if (existing.rowCount && existing.rowCount > 0) continue;

        const discSource = disc.source && ['serper', 'apollo', 'bing', 'linkedin', 'manual'].includes(disc.source)
          ? disc.source
          : 'serper';

        const prospectResult = await client.query<{ id: string }>(
          `INSERT INTO prospects (entity_id, campaign_id, full_name, linkedin_url, company_name, job_title, email, source, pipeline_stage)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'found')
           RETURNING id`,
          [authed.entityId, id, disc.full_name, disc.linkedin_url, disc.company_name, disc.job_title, disc.email ?? null, discSource],
        );

        await client.query(
          `INSERT INTO pipeline_events (entity_id, prospect_id, campaign_id, event_type, to_stage, created_by)
           VALUES ($1, $2, $3, 'found', 'found', $4)`,
          [authed.entityId, prospectResult.rows[0].id, id, authed.user.sub],
        );

        insertedCount++;
      }

      await client.query(
        'UPDATE campaigns SET total_prospect_count = total_prospect_count + $1 WHERE id = $2',
        [insertedCount, id],
      );

      await client.query('COMMIT');

      res.json({
        message: 'Discovery agent completed',
        discovered: discoveries.length,
        inserted: insertedCount,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/crm/campaigns/:id/pause ──────────────────

router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;

    const result = await pool.query<Campaign>(
      `UPDATE campaigns SET status = 'paused' WHERE id = $1 AND entity_id = $2 AND status = 'active' RETURNING *`,
      [id, authed.entityId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Campaign not found or not active');
    }

    res.json({ campaign: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
