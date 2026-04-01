import { Router, Request, Response, NextFunction } from 'express';
import pool from '../db/pool.js';
import { AuthenticatedRequest, PipelineEvent } from '../types/index.js';

const router = Router();

// ─── GET /api/crm/pipeline/stats ────────────────────────

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { campaign_id } = req.query;

    const conditions: string[] = ['p.entity_id = $1'];
    const params: unknown[] = [authed.entityId];
    let idx = 2;

    if (campaign_id) {
      conditions.push(`p.campaign_id = $${idx}`);
      params.push(campaign_id);
      idx++;
    }

    const where = conditions.join(' AND ');

    const stageResult = await pool.query(
      `SELECT p.pipeline_stage, count(*)::int AS count
       FROM prospects p
       WHERE ${where}
       GROUP BY p.pipeline_stage
       ORDER BY p.pipeline_stage`,
      params,
    );

    const campaignConditions: string[] = ['c.entity_id = $1'];
    const campaignParams: unknown[] = [authed.entityId];
    let cidx = 2;

    if (campaign_id) {
      campaignConditions.push(`c.id = $${cidx}`);
      campaignParams.push(campaign_id);
      cidx++;
    }

    const campaignWhere = campaignConditions.join(' AND ');

    const campaignStatsResult = await pool.query(
      `SELECT
         c.id AS campaign_id,
         c.name AS campaign_name,
         c.status AS campaign_status,
         c.total_prospect_count,
         c.total_message_count,
         c.total_reply_count,
         c.total_meeting_count,
         CASE WHEN c.total_prospect_count > 0
           THEN round((c.total_message_count::numeric / c.total_prospect_count) * 100, 1)
           ELSE 0
         END AS message_rate,
         CASE WHEN c.total_message_count > 0
           THEN round((c.total_reply_count::numeric / c.total_message_count) * 100, 1)
           ELSE 0
         END AS reply_rate,
         CASE WHEN c.total_reply_count > 0
           THEN round((c.total_meeting_count::numeric / c.total_reply_count) * 100, 1)
           ELSE 0
         END AS meeting_rate
       FROM campaigns c
       WHERE ${campaignWhere}
       ORDER BY c.created_at DESC`,
      campaignParams,
    );

    const totalProspects = stageResult.rows.reduce((sum, r) => sum + r.count, 0);

    res.json({
      summary: {
        total_prospects: totalProspects,
        stage_breakdown: stageResult.rows,
      },
      campaigns: campaignStatsResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/crm/pipeline/events ───────────────────────

router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { prospect_id, campaign_id, event_type, limit = '100', offset = '0' } = req.query;

    const conditions: string[] = ['entity_id = $1'];
    const params: unknown[] = [authed.entityId];
    let idx = 2;

    if (prospect_id) {
      conditions.push(`prospect_id = $${idx}`);
      params.push(prospect_id);
      idx++;
    }
    if (campaign_id) {
      conditions.push(`campaign_id = $${idx}`);
      params.push(campaign_id);
      idx++;
    }
    if (event_type) {
      conditions.push(`event_type = $${idx}`);
      params.push(event_type);
      idx++;
    }

    const where = conditions.join(' AND ');
    params.push(Number(limit), Number(offset));

    const result = await pool.query<PipelineEvent>(
      `SELECT * FROM pipeline_events WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    const countResult = await pool.query(
      `SELECT count(*)::int AS total FROM pipeline_events WHERE ${where}`,
      params.slice(0, -2),
    );

    res.json({
      events: result.rows,
      total: countResult.rows[0].total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
