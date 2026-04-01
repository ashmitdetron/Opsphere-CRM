import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { AuthenticatedRequest, Prospect, Campaign, BrandVoice } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { enrichProspect } from '../services/agents/researchAgent.js';
import { generateMessage } from '../services/agents/messageAgent.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Schemas ──────────────────────────────────────────────

const createProspectSchema = z.object({
  campaign_id: z.string().uuid(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  full_name: z.string().optional(),
  email: z.string().email().optional(),
  linkedin_url: z.string().url().optional(),
  company_name: z.string().optional(),
  company_website: z.string().url().optional(),
  job_title: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  company_size: z.string().optional(),
  source: z.enum(['csv', 'serper', 'proxycurl', 'linkedin', 'manual', 'apollo', 'bing']).default('manual'),
});

const updateProspectSchema = createProspectSchema.partial().extend({
  pipeline_stage: z.enum(['found', 'researched', 'message_drafted', 'message_approved', 'message_sent', 'replied', 'meeting_booked', 'converted', 'rejected']).optional(),
  is_approved: z.boolean().optional(),
  rejection_reason: z.string().optional(),
});

// ─── GET /api/crm/prospects ─────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { campaign_id, pipeline_stage, enrichment_status, search, limit = '50', offset = '0' } = req.query;

    const conditions: string[] = ['entity_id = $1'];
    const params: unknown[] = [authed.entityId];
    let idx = 2;

    if (campaign_id) {
      conditions.push(`campaign_id = $${idx}`);
      params.push(campaign_id);
      idx++;
    }
    if (pipeline_stage) {
      conditions.push(`pipeline_stage = $${idx}`);
      params.push(pipeline_stage);
      idx++;
    }
    if (enrichment_status) {
      conditions.push(`enrichment_status = $${idx}`);
      params.push(enrichment_status);
      idx++;
    }
    if (search) {
      conditions.push(`(full_name ILIKE $${idx} OR email ILIKE $${idx} OR company_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    params.push(Number(limit), Number(offset));

    const result = await pool.query<Prospect>(
      `SELECT * FROM prospects WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    const countResult = await pool.query(
      `SELECT count(*)::int AS total FROM prospects WHERE ${where}`,
      params.slice(0, -2),
    );

    res.json({
      prospects: result.rows,
      total: countResult.rows[0].total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/crm/prospects/:id ─────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;

    const prospectResult = await pool.query<Prospect>(
      'SELECT * FROM prospects WHERE id = $1 AND entity_id = $2',
      [id, authed.entityId],
    );

    if (prospectResult.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Prospect not found');
    }

    const messagesResult = await pool.query(
      'SELECT * FROM outreach_messages WHERE prospect_id = $1 AND entity_id = $2 ORDER BY created_at DESC',
      [id, authed.entityId],
    );

    const eventsResult = await pool.query(
      'SELECT * FROM pipeline_events WHERE prospect_id = $1 AND entity_id = $2 ORDER BY created_at DESC',
      [id, authed.entityId],
    );

    res.json({
      prospect: prospectResult.rows[0],
      messages: messagesResult.rows,
      events: eventsResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/crm/prospects ────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const body = createProspectSchema.parse(req.body);

    const campaignCheck = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND entity_id = $2',
      [body.campaign_id, authed.entityId],
    );
    if (campaignCheck.rowCount === 0) {
      throw new AppError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found');
    }

    const result = await pool.query<Prospect>(
      `INSERT INTO prospects (
        entity_id, campaign_id, first_name, last_name, full_name,
        email, linkedin_url, company_name, company_website, job_title,
        industry, location, company_size, source
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        authed.entityId,
        body.campaign_id,
        body.first_name ?? null,
        body.last_name ?? null,
        body.full_name ?? null,
        body.email ?? null,
        body.linkedin_url ?? null,
        body.company_name ?? null,
        body.company_website ?? null,
        body.job_title ?? null,
        body.industry ?? null,
        body.location ?? null,
        body.company_size ?? null,
        body.source,
      ],
    );

    await pool.query(
      `INSERT INTO pipeline_events (entity_id, prospect_id, campaign_id, event_type, to_stage, created_by)
       VALUES ($1, $2, $3, 'found', 'found', $4)`,
      [authed.entityId, result.rows[0].id, body.campaign_id, authed.user.sub],
    );

    await pool.query(
      'UPDATE campaigns SET total_prospect_count = total_prospect_count + 1 WHERE id = $1',
      [body.campaign_id],
    );

    res.status(201).json({ prospect: result.rows[0] });
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

// ─── PATCH /api/crm/prospects/:id ───────────────────────

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = updateProspectSchema.parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fieldMap: Record<string, unknown> = {
      first_name: body.first_name,
      last_name: body.last_name,
      full_name: body.full_name,
      email: body.email,
      linkedin_url: body.linkedin_url,
      company_name: body.company_name,
      company_website: body.company_website,
      job_title: body.job_title,
      industry: body.industry,
      location: body.location,
      company_size: body.company_size,
      pipeline_stage: body.pipeline_stage,
      is_approved: body.is_approved,
      rejection_reason: body.rejection_reason,
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

    const result = await pool.query<Prospect>(
      `UPDATE prospects SET ${fields.join(', ')} WHERE id = $${idx} AND entity_id = $${idx + 1} RETURNING *`,
      values,
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Prospect not found');
    }

    res.json({ prospect: result.rows[0] });
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

// ─── POST /api/crm/prospects/:id/enrich ─────────────────

router.post('/:id/enrich', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;

    const prospectResult = await pool.query<Prospect>(
      'SELECT * FROM prospects WHERE id = $1 AND entity_id = $2',
      [id, authed.entityId],
    );

    if (prospectResult.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Prospect not found');
    }

    const prospect = prospectResult.rows[0];

    await pool.query(
      "UPDATE prospects SET enrichment_status = 'in_progress' WHERE id = $1",
      [id],
    );

    try {
      const enrichment = await enrichProspect(prospect);

      const updatedResult = await pool.query<Prospect>(
        `UPDATE prospects
         SET enrichment_status = 'completed',
             enrichment_data = $1,
             pipeline_stage = 'researched',
             company_size = COALESCE($2, company_size),
             email = COALESCE(email, $3)
         WHERE id = $4
         RETURNING *`,
        [JSON.stringify(enrichment), enrichment.company_size, enrichment.email ?? null, id],
      );

      await pool.query(
        `INSERT INTO pipeline_events (entity_id, prospect_id, campaign_id, event_type, from_stage, to_stage, created_by)
         VALUES ($1, $2, $3, 'enriched', $4, 'researched', $5)`,
        [authed.entityId, id, prospect.campaign_id, prospect.pipeline_stage, authed.user.sub],
      );

      res.json({ prospect: updatedResult.rows[0], enrichment });
    } catch (enrichErr) {
      await pool.query(
        "UPDATE prospects SET enrichment_status = 'failed' WHERE id = $1",
        [id],
      );
      throw enrichErr;
    }
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/crm/prospects/:id/generate-message ───────

router.post('/:id/generate-message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { id } = req.params;

    const prospectResult = await pool.query<Prospect>(
      'SELECT * FROM prospects WHERE id = $1 AND entity_id = $2',
      [id, authed.entityId],
    );

    if (prospectResult.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Prospect not found');
    }

    const prospect = prospectResult.rows[0];

    const campaignResult = await pool.query<Campaign>(
      'SELECT * FROM campaigns WHERE id = $1',
      [prospect.campaign_id],
    );
    const campaign = campaignResult.rows[0];

    let brandVoice: BrandVoice | null = null;
    if (campaign.brand_voice_id) {
      const bvResult = await pool.query<BrandVoice>(
        'SELECT * FROM brand_voices WHERE id = $1',
        [campaign.brand_voice_id],
      );
      brandVoice = bvResult.rows[0] ?? null;
    }

    const generated = await generateMessage(prospect, campaign, brandVoice);

    const messageResult = await pool.query(
      `INSERT INTO outreach_messages (entity_id, campaign_id, prospect_id, subject, body, ai_model, ai_prompt_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        authed.entityId,
        prospect.campaign_id,
        id,
        generated.subject,
        generated.body,
        generated.ai_model,
        generated.ai_prompt_version,
      ],
    );

    await pool.query(
      `UPDATE prospects SET pipeline_stage = 'message_drafted' WHERE id = $1 AND pipeline_stage IN ('found', 'researched')`,
      [id],
    );

    await pool.query(
      `INSERT INTO pipeline_events (entity_id, prospect_id, campaign_id, event_type, from_stage, to_stage, created_by)
       VALUES ($1, $2, $3, 'message_drafted', $4, 'message_drafted', $5)`,
      [authed.entityId, id, prospect.campaign_id, prospect.pipeline_stage, authed.user.sub],
    );

    await pool.query(
      'UPDATE campaigns SET total_message_count = total_message_count + 1 WHERE id = $1',
      [prospect.campaign_id],
    );

    res.status(201).json({ message: messageResult.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/crm/prospects/bulk-import ────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

router.post('/bulk-import', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const campaignId = req.body.campaign_id as string;

    if (!campaignId) {
      throw new AppError(400, 'MISSING_CAMPAIGN', 'campaign_id is required');
    }

    const campaignCheck = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND entity_id = $2',
      [campaignId, authed.entityId],
    );
    if (campaignCheck.rowCount === 0) {
      throw new AppError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found');
    }

    if (!req.file) {
      throw new AppError(400, 'NO_FILE', 'CSV file is required');
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      throw new AppError(400, 'EMPTY_CSV', 'CSV must have a header row and at least one data row');
    }

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));

    const client = await pool.connect();
    let imported = 0;
    let skipped = 0;

    try {
      await client.query('BEGIN');

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });

        const fullName = row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim();
        if (!fullName && !row.email && !row.linkedin_url) {
          skipped++;
          continue;
        }

        const prospectResult = await client.query<{ id: string }>(
          `INSERT INTO prospects (
            entity_id, campaign_id, first_name, last_name, full_name,
            email, linkedin_url, company_name, company_website, job_title,
            industry, location, company_size, source
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'csv')
          RETURNING id`,
          [
            authed.entityId,
            campaignId,
            row.first_name || null,
            row.last_name || null,
            fullName || null,
            row.email || null,
            row.linkedin_url || null,
            row.company_name || row.company || null,
            row.company_website || row.website || null,
            row.job_title || row.title || null,
            row.industry || null,
            row.location || null,
            row.company_size || null,
          ],
        );

        await client.query(
          `INSERT INTO pipeline_events (entity_id, prospect_id, campaign_id, event_type, to_stage, notes, created_by)
           VALUES ($1, $2, $3, 'found', 'found', 'Imported from CSV', $4)`,
          [authed.entityId, prospectResult.rows[0].id, campaignId, authed.user.sub],
        );

        imported++;
      }

      await client.query(
        'UPDATE campaigns SET total_prospect_count = total_prospect_count + $1 WHERE id = $2',
        [imported, campaignId],
      );

      await client.query('COMMIT');

      res.status(201).json({
        imported,
        skipped,
        total_rows: lines.length - 1,
      });
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

export default router;
