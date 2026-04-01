import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { AuthenticatedRequest, BrandVoice } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional(),
  value_proposition: z.string().optional(),
  tone: z.string().default('professional'),
  avoid_phrases: z.array(z.string()).optional(),
  example_messages: z.array(z.string()).optional(),
  is_default: z.boolean().default(false),
});

const updateSchema = createSchema.partial();

// ─── GET /api/crm/brand-voices ───────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;

    const result = await pool.query<BrandVoice>(
      'SELECT * FROM brand_voices WHERE entity_id = $1 ORDER BY is_default DESC, name ASC',
      [authed.entityId],
    );

    res.json({ brand_voices: result.rows, total: result.rowCount ?? 0 });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/crm/brand-voices/:id ──────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;

    const result = await pool.query<BrandVoice>(
      'SELECT * FROM brand_voices WHERE id = $1 AND entity_id = $2',
      [req.params.id, authed.entityId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Brand voice not found');
    }

    res.json({ brand_voice: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/crm/brand-voices ─────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const body = createSchema.parse(req.body);

    // If setting as default, unset others first
    if (body.is_default) {
      await pool.query(
        'UPDATE brand_voices SET is_default = false WHERE entity_id = $1',
        [authed.entityId],
      );
    }

    const result = await pool.query<BrandVoice>(
      `INSERT INTO brand_voices (entity_id, name, industry, value_proposition, tone, avoid_phrases, example_messages, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        authed.entityId,
        body.name,
        body.industry ?? null,
        body.value_proposition ?? null,
        body.tone,
        body.avoid_phrases ?? null,
        body.example_messages ?? null,
        body.is_default,
      ],
    );

    res.status(201).json({ brand_voice: result.rows[0] });
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

// ─── PATCH /api/crm/brand-voices/:id ────────────────────

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const body = updateSchema.parse(req.body);

    if (body.is_default) {
      await pool.query(
        'UPDATE brand_voices SET is_default = false WHERE entity_id = $1',
        [authed.entityId],
      );
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fieldMap: Record<string, unknown> = {
      name: body.name,
      industry: body.industry,
      value_proposition: body.value_proposition,
      tone: body.tone,
      avoid_phrases: body.avoid_phrases,
      example_messages: body.example_messages,
      is_default: body.is_default,
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

    const result = await pool.query<BrandVoice>(
      `UPDATE brand_voices SET ${fields.join(', ')} WHERE id = $${idx} AND entity_id = $${idx + 1} RETURNING *`,
      values,
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Brand voice not found');
    }

    res.json({ brand_voice: result.rows[0] });
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

// ─── DELETE /api/crm/brand-voices/:id ───────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;

    const result = await pool.query(
      'DELETE FROM brand_voices WHERE id = $1 AND entity_id = $2 RETURNING id',
      [req.params.id, authed.entityId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Brand voice not found');
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
