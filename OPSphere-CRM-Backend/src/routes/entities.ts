import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { AuthenticatedRequest, Organisation } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────

const createEntitySchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional(),
  website: z.string().url().optional(),
});

// ─── GET /api/entities ───────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const result = await pool.query<Organisation>(
      `SELECT o.* FROM organisations o
       INNER JOIN crm_entity_members m ON m.entity_id = o.id
       WHERE m.user_id = $1
       ORDER BY o.name`,
      [authed.user.sub],
    );
    res.json({ entities: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/entities ──────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const body = createEntitySchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orgResult = await client.query<Organisation>(
        `INSERT INTO organisations (name, industry, website)
         VALUES ($1, $2, $3) RETURNING *`,
        [body.name, body.industry ?? null, body.website ?? null],
      );
      const org = orgResult.rows[0];

      await client.query(
        `INSERT INTO crm_entity_members (entity_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [org.id, authed.user.sub],
      );

      await client.query('COMMIT');

      res.status(201).json({ entity: org });
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

// ─── PATCH /api/entities/:id ────────────────────────────

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;

    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      industry: z.string().optional(),
      website: z.string().url().optional().or(z.literal('')),
    });

    const body = updateSchema.parse(req.body);

    const memberCheck = await pool.query(
      "SELECT 1 FROM crm_entity_members WHERE entity_id = $1 AND user_id = $2 AND role IN ('owner', 'admin')",
      [id, authed.user.sub],
    );
    if (memberCheck.rowCount === 0) {
      throw new AppError(403, 'FORBIDDEN', 'Only owners and admins can update this organisation');
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.name !== undefined) { fields.push(`name = $${idx}`); values.push(body.name); idx++; }
    if (body.industry !== undefined) { fields.push(`industry = $${idx}`); values.push(body.industry || null); idx++; }
    if (body.website !== undefined) { fields.push(`website = $${idx}`); values.push(body.website || null); idx++; }

    if (fields.length === 0) {
      throw new AppError(400, 'NO_FIELDS', 'No fields to update');
    }

    values.push(id);

    const result = await pool.query<Organisation>(
      `UPDATE organisations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Organisation not found');
    }

    res.json({ entity: result.rows[0] });
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

// ─── GET /api/entities/:id ───────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;

    const memberCheck = await pool.query(
      'SELECT 1 FROM crm_entity_members WHERE entity_id = $1 AND user_id = $2',
      [id, authed.user.sub],
    );
    if (memberCheck.rowCount === 0) {
      throw new AppError(403, 'NOT_MEMBER', 'User is not a member of this organisation');
    }

    const result = await pool.query<Organisation>(
      'SELECT * FROM organisations WHERE id = $1',
      [id],
    );
    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Organisation not found');
    }

    res.json({ entity: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
