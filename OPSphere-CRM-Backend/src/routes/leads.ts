import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────

const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  stage_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  notes: z.string().optional(),
  value: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateLeadSchema = createLeadSchema.partial();

const stageSchema = z.object({
  stage_id: z.string().uuid(),
  notes: z.string().optional(),
});

const convertSchema = z.object({
  campaign_id: z.string().uuid(),
  source: z.enum(['csv', 'serper', 'proxycurl', 'linkedin', 'manual', 'apollo', 'bing']).default('manual'),
});

// ─── GET /api/crm/leads ──────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { stage_id, assigned_to, search, limit = '50', offset = '0' } = req.query;

    const conditions: string[] = ['entity_id = $1'];
    const params: unknown[] = [authed.entityId];
    let idx = 2;

    if (stage_id) {
      conditions.push(`stage_id = $${idx}`);
      params.push(stage_id);
      idx++;
    }
    if (assigned_to) {
      conditions.push(`assigned_to = $${idx}`);
      params.push(assigned_to);
      idx++;
    }
    if (search) {
      conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx} OR company ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    params.push(Number(limit), Number(offset));

    const result = await pool.query(
      `SELECT * FROM crm_leads WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    const countResult = await pool.query(
      `SELECT count(*)::int AS total FROM crm_leads WHERE ${where}`,
      params.slice(0, -2),
    );

    res.json({
      leads: result.rows,
      total: countResult.rows[0].total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/crm/leads/:id ─────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM crm_leads WHERE id = $1 AND entity_id = $2',
      [id, authed.entityId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Lead not found');
    }

    res.json({ lead: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/crm/leads ────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const body = createLeadSchema.parse(req.body);

    const result = await pool.query(
      `INSERT INTO crm_leads (entity_id, name, email, phone, company, source, stage_id, assigned_to, notes, value, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        authed.entityId,
        body.name,
        body.email ?? null,
        body.phone ?? null,
        body.company ?? null,
        body.source ?? null,
        body.stage_id ?? null,
        body.assigned_to ?? null,
        body.notes ?? null,
        body.value ?? null,
        body.metadata ? JSON.stringify(body.metadata) : null,
      ],
    );

    res.status(201).json({ lead: result.rows[0] });
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

// ─── PATCH /api/crm/leads/:id ───────────────────────────

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = updateLeadSchema.parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        const col = key === 'metadata' ? key : key;
        fields.push(`${col} = $${idx}`);
        values.push(key === 'metadata' ? JSON.stringify(value) : value);
        idx++;
      }
    }

    if (fields.length === 0) {
      throw new AppError(400, 'NO_FIELDS', 'No fields to update');
    }

    values.push(id, authed.entityId);

    const result = await pool.query(
      `UPDATE crm_leads SET ${fields.join(', ')} WHERE id = $${idx} AND entity_id = $${idx + 1} RETURNING *`,
      values,
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Lead not found');
    }

    res.json({ lead: result.rows[0] });
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

// ─── POST /api/crm/leads/:id/stage ──────────────────────

router.post('/:id/stage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = stageSchema.parse(req.body);

    const result = await pool.query(
      `UPDATE crm_leads SET stage_id = $1 WHERE id = $2 AND entity_id = $3 RETURNING *`,
      [body.stage_id, id, authed.entityId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Lead not found');
    }

    res.json({ lead: result.rows[0] });
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

// ─── POST /api/crm/leads/:id/convert ────────────────────

router.post('/:id/convert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = convertSchema.parse(req.body);

    const leadResult = await pool.query(
      'SELECT * FROM crm_leads WHERE id = $1 AND entity_id = $2',
      [id, authed.entityId],
    );

    if (leadResult.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Lead not found');
    }

    const lead = leadResult.rows[0];

    const prospectResult = await pool.query(
      `INSERT INTO prospects (entity_id, campaign_id, first_name, last_name, full_name, email, company_name, source, pipeline_stage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'found')
       RETURNING *`,
      [
        authed.entityId,
        body.campaign_id,
        null,
        null,
        lead.name,
        lead.email,
        lead.company,
        body.source,
      ],
    );

    await pool.query(
      `INSERT INTO pipeline_events (entity_id, prospect_id, campaign_id, event_type, to_stage, notes, created_by)
       VALUES ($1, $2, $3, 'found', 'found', $4, $5)`,
      [authed.entityId, prospectResult.rows[0].id, body.campaign_id, `Converted from lead ${id}`, authed.user.sub],
    );

    res.status(201).json({ prospect: prospectResult.rows[0] });
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

export default router;
