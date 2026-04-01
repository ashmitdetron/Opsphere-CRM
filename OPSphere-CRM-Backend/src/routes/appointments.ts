import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { AuthenticatedRequest, Appointment } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────

const createSchema = z.object({
  prospect_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  title: z.string().min(1),
  scheduled_at: z.string().min(1), // ISO datetime string
  duration_minutes: z.number().int().min(5).default(30),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  scheduled_at: z.string().min(1).optional(),
  duration_minutes: z.number().int().min(5).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
});

// ─── GET /api/crm/appointments ───────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { status, campaign_id, limit = '50', offset = '0' } = req.query;

    const conditions: string[] = ['a.entity_id = $1'];
    const params: unknown[] = [authed.entityId];
    let idx = 2;

    if (status) {
      conditions.push(`a.status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (campaign_id) {
      conditions.push(`a.campaign_id = $${idx}`);
      params.push(campaign_id);
      idx++;
    }

    const where = conditions.join(' AND ');
    params.push(Number(limit), Number(offset));

    const result = await pool.query(
      `SELECT a.*,
         p.full_name AS prospect_name,
         p.company_name AS prospect_company,
         p.job_title AS prospect_title,
         c.name AS campaign_name
       FROM appointments a
       LEFT JOIN prospects p ON p.id = a.prospect_id
       LEFT JOIN campaigns c ON c.id = a.campaign_id
       WHERE ${where}
       ORDER BY a.scheduled_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    const countResult = await pool.query(
      `SELECT count(*)::int AS total FROM appointments a WHERE ${where}`,
      params.slice(0, -2),
    );

    res.json({
      appointments: result.rows,
      total: countResult.rows[0].total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/crm/appointments/:id ──────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;

    const result = await pool.query(
      `SELECT a.*,
         p.full_name AS prospect_name,
         p.company_name AS prospect_company,
         p.job_title AS prospect_title,
         c.name AS campaign_name
       FROM appointments a
       LEFT JOIN prospects p ON p.id = a.prospect_id
       LEFT JOIN campaigns c ON c.id = a.campaign_id
       WHERE a.id = $1 AND a.entity_id = $2`,
      [req.params.id, authed.entityId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Appointment not found');
    }

    res.json({ appointment: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/crm/appointments ─────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const body = createSchema.parse(req.body);

    // Verify prospect belongs to this entity
    const prospectResult = await pool.query(
      'SELECT id, campaign_id, pipeline_stage FROM prospects WHERE id = $1 AND entity_id = $2',
      [body.prospect_id, authed.entityId],
    );

    if (prospectResult.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Prospect not found');
    }

    // Verify campaign belongs to this entity
    const campaignResult = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND entity_id = $2',
      [body.campaign_id, authed.entityId],
    );

    if (campaignResult.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const apptResult = await client.query<Appointment>(
        `INSERT INTO appointments (entity_id, prospect_id, campaign_id, title, scheduled_at, duration_minutes, location, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          authed.entityId,
          body.prospect_id,
          body.campaign_id,
          body.title,
          body.scheduled_at,
          body.duration_minutes,
          body.location ?? null,
          body.notes ?? null,
          authed.user.sub,
        ],
      );

      const prospect = prospectResult.rows[0];
      const fromStage = prospect.pipeline_stage;

      // Advance prospect to meeting_booked if not already there or past it
      if (!['meeting_booked', 'converted', 'rejected'].includes(fromStage)) {
        await client.query(
          "UPDATE prospects SET pipeline_stage = 'meeting_booked' WHERE id = $1",
          [body.prospect_id],
        );

        await client.query(
          `INSERT INTO pipeline_events (entity_id, prospect_id, campaign_id, event_type, from_stage, to_stage, notes, created_by)
           VALUES ($1, $2, $3, 'meeting_booked', $4, 'meeting_booked', $5, $6)`,
          [
            authed.entityId,
            body.prospect_id,
            body.campaign_id,
            fromStage,
            `Meeting booked: ${body.title}`,
            authed.user.sub,
          ],
        );

        await client.query(
          'UPDATE campaigns SET total_meeting_count = total_meeting_count + 1 WHERE id = $1',
          [body.campaign_id],
        );
      }

      await client.query('COMMIT');

      res.status(201).json({ appointment: apptResult.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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

// ─── PATCH /api/crm/appointments/:id ────────────────────

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const body = updateSchema.parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fieldMap: Record<string, unknown> = {
      title: body.title,
      scheduled_at: body.scheduled_at,
      duration_minutes: body.duration_minutes,
      location: body.location,
      notes: body.notes,
      status: body.status,
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

    values.push(req.params.id, authed.entityId);

    const result = await pool.query<Appointment>(
      `UPDATE appointments SET ${fields.join(', ')} WHERE id = $${idx} AND entity_id = $${idx + 1} RETURNING *`,
      values,
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Appointment not found');
    }

    res.json({ appointment: result.rows[0] });
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

// ─── DELETE /api/crm/appointments/:id ───────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;

    const result = await pool.query(
      'DELETE FROM appointments WHERE id = $1 AND entity_id = $2 RETURNING id',
      [req.params.id, authed.entityId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Appointment not found');
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
