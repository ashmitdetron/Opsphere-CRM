import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { AuthenticatedRequest, OutreachMessage, Prospect } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { enqueueMessage } from '../services/sendQueue.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────

const editMessageSchema = z.object({
  subject: z.string().optional(),
  body: z.string().min(1).optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(1),
});

// ─── GET /api/crm/messages ──────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { status, campaign_id, limit = '50', offset = '0' } = req.query;

    const conditions: string[] = ['entity_id = $1'];
    const params: unknown[] = [authed.entityId];
    let idx = 2;

    if (status) {
      conditions.push(`status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (campaign_id) {
      conditions.push(`campaign_id = $${idx}`);
      params.push(campaign_id);
      idx++;
    }

    const where = conditions.join(' AND ');
    params.push(Number(limit), Number(offset));

    const result = await pool.query<OutreachMessage>(
      `SELECT * FROM outreach_messages WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    const countResult = await pool.query(
      `SELECT count(*)::int AS total FROM outreach_messages WHERE ${where}`,
      params.slice(0, -2),
    );

    res.json({
      messages: result.rows,
      total: countResult.rows[0].total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/crm/messages/review-queue ─────────────────

router.get('/review-queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { campaign_id, limit = '50', offset = '0' } = req.query;

    const conditions: string[] = ["entity_id = $1", "status = 'draft'"];
    const params: unknown[] = [authed.entityId];
    let idx = 2;

    if (campaign_id) {
      conditions.push(`campaign_id = $${idx}`);
      params.push(campaign_id);
      idx++;
    }

    const where = conditions.join(' AND ');
    params.push(Number(limit), Number(offset));

    const result = await pool.query(
      `SELECT m.*, p.full_name AS prospect_name, p.company_name AS prospect_company, p.job_title AS prospect_title
       FROM outreach_messages m
       LEFT JOIN prospects p ON p.id = m.prospect_id
       WHERE ${where}
       ORDER BY m.created_at ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    const countResult = await pool.query(
      `SELECT count(*)::int AS total FROM outreach_messages WHERE ${where}`,
      params.slice(0, -2),
    );

    res.json({
      messages: result.rows,
      total: countResult.rows[0].total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/crm/messages/:id ────────────────────────

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = editMessageSchema.parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.subject !== undefined) {
      fields.push(`subject = $${idx}`);
      values.push(body.subject);
      idx++;
    }
    if (body.body !== undefined) {
      fields.push(`body = $${idx}`);
      values.push(body.body);
      idx++;
    }

    if (fields.length === 0) {
      throw new AppError(400, 'NO_FIELDS', 'No fields to update');
    }

    values.push(id, authed.entityId);

    const result = await pool.query<OutreachMessage>(
      `UPDATE outreach_messages SET ${fields.join(', ')}
       WHERE id = $${idx} AND entity_id = $${idx + 1} AND status = 'draft'
       RETURNING *`,
      values,
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Message not found or not in draft status');
    }

    res.json({ message: result.rows[0] });
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

// ─── POST /api/crm/messages/:id/approve ─────────────────

router.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;

    const result = await pool.query<OutreachMessage>(
      `UPDATE outreach_messages
       SET status = 'approved', approved_by = $1, approved_at = now()
       WHERE id = $2 AND entity_id = $3 AND status = 'draft'
       RETURNING *`,
      [authed.user.sub, id, authed.entityId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Message not found or not in draft status');
    }

    const msg = result.rows[0];

    await pool.query(
      `UPDATE prospects SET pipeline_stage = 'message_approved', is_approved = true
       WHERE id = $1 AND pipeline_stage IN ('message_drafted')`,
      [msg.prospect_id],
    );

    await pool.query(
      `INSERT INTO pipeline_events (entity_id, prospect_id, campaign_id, event_type, from_stage, to_stage, created_by)
       VALUES ($1, $2, $3, 'message_approved', 'message_drafted', 'message_approved', $4)`,
      [authed.entityId, msg.prospect_id, msg.campaign_id, authed.user.sub],
    );

    res.json({ message: msg });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/crm/messages/:id/reject ──────────────────

router.post('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = rejectSchema.parse(req.body);

    const result = await pool.query<OutreachMessage>(
      `UPDATE outreach_messages
       SET status = 'rejected', rejection_reason = $1
       WHERE id = $2 AND entity_id = $3 AND status = 'draft'
       RETURNING *`,
      [body.reason, id, authed.entityId],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Message not found or not in draft status');
    }

    const msg = result.rows[0];

    await pool.query(
      `INSERT INTO pipeline_events (entity_id, prospect_id, campaign_id, event_type, from_stage, to_stage, notes, created_by)
       VALUES ($1, $2, $3, 'message_rejected', 'message_drafted', 'message_drafted', $4, $5)`,
      [authed.entityId, msg.prospect_id, msg.campaign_id, body.reason, authed.user.sub],
    );

    res.json({ message: msg });
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

// ─── POST /api/crm/messages/:id/send ────────────────────

router.post('/:id/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;

    const msgResult = await pool.query<OutreachMessage>(
      "SELECT * FROM outreach_messages WHERE id = $1 AND entity_id = $2 AND status = 'approved'",
      [id, authed.entityId],
    );

    if (msgResult.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Message not found or not approved');
    }

    const msg = msgResult.rows[0];

    const prospectResult = await pool.query<Prospect>(
      'SELECT * FROM prospects WHERE id = $1',
      [msg.prospect_id],
    );

    if (prospectResult.rowCount === 0) {
      throw new AppError(404, 'PROSPECT_NOT_FOUND', 'Prospect not found');
    }

    const prospect = prospectResult.rows[0];

    await pool.query(
      "UPDATE outreach_messages SET status = 'queued' WHERE id = $1",
      [id],
    );

    const sendResult = await enqueueMessage(prospect, msg);

    if (sendResult.success) {
      await pool.query(
        `UPDATE outreach_messages SET status = 'sent', sent_at = now(), phantombuster_ref = $1
         WHERE id = $2`,
        [sendResult.phantombuster_ref, id],
      );

      await pool.query(
        "UPDATE prospects SET pipeline_stage = 'message_sent' WHERE id = $1",
        [msg.prospect_id],
      );

      await pool.query(
        `INSERT INTO pipeline_events (entity_id, prospect_id, campaign_id, event_type, from_stage, to_stage, created_by)
         VALUES ($1, $2, $3, 'message_sent', 'message_approved', 'message_sent', $4)`,
        [authed.entityId, msg.prospect_id, msg.campaign_id, authed.user.sub],
      );

      res.json({
        message: { ...msg, status: 'sent', phantombuster_ref: sendResult.phantombuster_ref },
        send_result: sendResult,
      });
    } else {
      await pool.query(
        "UPDATE outreach_messages SET status = 'failed' WHERE id = $1",
        [id],
      );

      throw new AppError(502, 'SEND_FAILED', `Failed to send message: ${sendResult.error}`);
    }
  } catch (err) {
    next(err);
  }
});

export default router;
