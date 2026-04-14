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

// ─── LinkedIn Search Helpers ──────────────────────────────

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Parse a LinkedIn search result title/snippet into structured prospect data.
 *
 * LinkedIn title formats:
 *   "John Smith - CEO at Acme Corp | LinkedIn"
 *   "Jane Doe - Chief Technology Officer | LinkedIn"
 *   "Bob Johnson | LinkedIn"
 */
function parseLinkedInResult(title: string, url: string): ProspectInput {
  // Normalise LinkedIn URL — strip query params and trailing slash
  let linkedin_url: string | null = null;
  if (url?.includes('linkedin.com/in/')) {
    linkedin_url = url.split('?')[0].replace(/\/$/, '');
  }

  // Strip common suffixes: " | LinkedIn", " - LinkedIn", "- LinkedIn"
  const cleanTitle = title
    .replace(/\s*[|]\s*LinkedIn\s*$/i, '')
    .replace(/\s*-\s*LinkedIn\s*$/i, '')
    .trim();

  let full_name: string | null = null;
  let job_title: string | null = null;
  let company_name: string | null = null;

  // Pattern A: "Name - Title at Company"  or  "Name - Title"
  const dashMatch = cleanTitle.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (dashMatch) {
    full_name = dashMatch[1].trim();
    const rest = dashMatch[2].trim();

    // Try "Title at Company"
    const atMatch = rest.match(/^(.+?)\s+at\s+(.+)$/i);
    if (atMatch) {
      job_title = atMatch[1].trim();
      company_name = atMatch[2].trim();
    } else {
      job_title = rest;
    }
  } else {
    // Pattern B: "Name | Title | Company" (pipe-separated)
    const parts = cleanTitle.split(/\s*\|\s*/);
    if (parts.length >= 2) {
      full_name = parts[0].trim();
      job_title = parts[1].trim();
      if (parts.length >= 3) company_name = parts[2].trim();
    } else {
      full_name = cleanTitle || null;
    }
  }

  // Split full name into first / last
  let first_name: string | null = null;
  let last_name: string | null = null;
  if (full_name) {
    const parts = full_name.trim().split(/\s+/);
    first_name = parts[0] ?? null;
    last_name = parts.length > 1 ? parts.slice(1).join(' ') : null;
  }

  return { full_name, first_name, last_name, job_title, company_name, linkedin_url };
}

async function serperSearch(query: string, apiKey: string, count: number): Promise<SearchResult[]> {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: Math.min(count, 100) }),
    signal: AbortSignal.timeout(10000),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await response.json() as any;
  if (!response.ok) {
    throw new AppError(502, 'SERPER_ERROR', data?.message || `Serper error ${response.status}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.organic ?? []).map((r: any) => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
  }));
}

async function bingSearch(query: string, apiKey: string, count: number): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({ q: query, count: String(count), mkt: 'en-US' });
    const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?${params}`, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.webPages?.value ?? []).map((r: any) => ({
      title: r.name || '',
      url: r.url || '',
      snippet: r.snippet || '',
    }));
  } catch {
    return [];
  }
}

async function duckDuckGoSearch(query: string, count: number): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({ q: query, kl: 'wt-wt' });
    const response = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];

    const html = await response.text();
    const results: SearchResult[] = [];

    // DDG HTML: <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=...">Title</a>
    // Attribute order varies — capture the full attribute string, then extract href separately.
    const aTagRe = /<a\b([^>]*\bclass="result__a"[^>]*)>([\s\S]*?)<\/a>/gi;
    const snippetRe = /<a\b[^>]*\bclass="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const snippets: string[] = [];
    for (const m of html.matchAll(snippetRe)) {
      snippets.push(m[1].replace(/<[^>]+>/g, '').trim());
    }

    let idx = 0;
    for (const m of html.matchAll(aTagRe)) {
      if (results.length >= count) break;

      const attrs = m[1];
      const titleHtml = m[2];

      const hrefMatch = attrs.match(/href="([^"]*)"/);
      if (!hrefMatch) { idx++; continue; }

      let url = hrefMatch[1];
      // Decode DDG redirect wrapper: //duckduckgo.com/l/?uddg=<encoded-url>
      const uddgMatch = url.match(/uddg=([^&"]+)/);
      if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
      if (url.startsWith('//')) url = 'https:' + url;

      const title = titleHtml.replace(/<[^>]+>/g, '').trim();
      const snippet = snippets[idx] ?? '';
      idx++;

      if (title && url) results.push({ title, url, snippet });
    }

    return results;
  } catch {
    return [];
  }
}

// ─── GET /status ─────────────────────────────────────────

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityId } = req as AuthenticatedRequest;
    const integrations = await getOrgIntegrations(entityId);

    res.json({
      hunter: !!integrations['HUNTER_API_KEY'],
      apollo: !!integrations['APOLLO_API_KEY'],
      bing: !!integrations['BING_SEARCH_KEY'],
      serper: !!integrations['SERPER_API_KEY'],
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /search (LinkedIn via Bing/DuckDuckGo) ─────────

const searchSchema = z.object({
  campaign_id: z.string().uuid(),
  job_titles: z.array(z.string()).min(1, 'At least one job title required'),
  locations: z.array(z.string()).optional().default([]),
  industries: z.array(z.string()).optional().default([]),
  limit: z.number().int().min(1).max(50).default(20),
});

const BLOCKED_DOMAINS = [
  'seek.com.au', 'indeed.com', 'linkedin.com/jobs', 'glassdoor',
  'youtube.com', 'facebook.com', 'twitter.com', 'reddit.com',
  'wikipedia.org', 'careerone.com.au', 'jora.com',
];

router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { entityId } = authed;
    const body = searchSchema.parse(req.body);

    const integrations = await getOrgIntegrations(entityId);
    const bingKey = integrations['BING_SEARCH_KEY'];
    const serperKey = integrations['SERPER_API_KEY'];

    const campCheck = await pool.query(
      'SELECT 1 FROM campaigns WHERE id = $1 AND entity_id = $2',
      [body.campaign_id, entityId],
    );
    if ((campCheck.rowCount ?? 0) === 0) throw new AppError(404, 'NOT_FOUND', 'Campaign not found');

    // Build query — use site: for Bing (supports it), plain keyword for Serper/DDG (site: blocked on free plans)
    const primaryTitle = body.job_titles[0];
    const locationStr = body.locations[0] ?? '';
    const industryStr = body.industries[0] ?? '';

    const buildQuery = (title: string, location: string, industry: string, useSiteOp: boolean) => {
      const sitePrefix = useSiteOp ? 'site:linkedin.com/in' : 'linkedin.com/in';
      return [sitePrefix, `"${title}"`, location ? `"${location}"` : '', industry ? `"${industry}"` : '']
        .filter(Boolean).join(' ');
    };

    const primaryQuery = buildQuery(primaryTitle, locationStr, industryStr, !!bingKey);
    const fallbackQuery = buildQuery(primaryTitle, locationStr, '', !!bingKey);

    const fetchCount = Math.min(body.limit * 3, 50);

    // Priority: Bing → Serper → DDG (last resort, often blocked server-side)
    let rawResults: SearchResult[] = [];
    let engine = 'none';
    let queryUsed = primaryQuery;

    if (bingKey) {
      rawResults = await bingSearch(primaryQuery, bingKey, fetchCount);
      if (rawResults.length > 0) { engine = 'bing'; }
      // Run remaining titles in parallel to fill quota
      if (rawResults.length < body.limit && body.job_titles.length > 1) {
        const extras = await Promise.all(
          body.job_titles.slice(1).map(t => bingSearch(buildQuery(t, locationStr, industryStr, true), bingKey, 10)),
        );
        rawResults = [...rawResults, ...extras.flat()];
      }
    }

    if (rawResults.length === 0 && serperKey) {
      rawResults = await serperSearch(primaryQuery, serperKey, fetchCount);
      if (rawResults.length > 0) { engine = 'serper'; }
      // Retry looser query
      if (rawResults.length === 0 && industryStr) {
        rawResults = await serperSearch(fallbackQuery, serperKey, fetchCount);
        queryUsed = fallbackQuery;
        if (rawResults.length > 0) engine = 'serper';
      }
    }

    if (rawResults.length === 0) {
      rawResults = await duckDuckGoSearch(primaryQuery, fetchCount);
      if (rawResults.length > 0) { engine = 'duckduckgo'; }
    }

    // Filter to real LinkedIn /in/ profile pages only
    const profileResults = rawResults.filter(r => {
      const url = r.url || '';
      if (!url.includes('linkedin.com/in/')) return false;
      if (url.includes('linkedin.com/in/search')) return false;
      if (BLOCKED_DOMAINS.some(d => url.includes(d))) return false;
      return true;
    });

    // Parse + deduplicate by linkedin_url
    const seenUrls = new Set<string>();
    const parsed: ProspectInput[] = [];

    for (const r of profileResults) {
      const p = parseLinkedInResult(r.title, r.url);
      if (!p.linkedin_url) continue;
      if (seenUrls.has(p.linkedin_url)) continue;
      seenUrls.add(p.linkedin_url);
      parsed.push(p);
    }

    // Save — dedup by linkedin_url per campaign
    let saved = 0;
    for (const p of parsed.slice(0, body.limit)) {
      if (p.linkedin_url) {
        const exists = await pool.query(
          'SELECT 1 FROM prospects WHERE campaign_id = $1 AND linkedin_url = $2',
          [body.campaign_id, p.linkedin_url],
        );
        if ((exists.rowCount ?? 0) > 0) continue;
      }

      await pool.query(
        `INSERT INTO prospects
           (entity_id, campaign_id, first_name, last_name, full_name,
            company_name, job_title, linkedin_url, source, pipeline_stage, enrichment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'found', 'pending')`,
        [
          entityId,
          body.campaign_id,
          p.first_name ?? null,
          p.last_name ?? null,
          p.full_name ?? null,
          p.company_name ?? null,
          p.job_title ?? null,
          p.linkedin_url ?? null,
          engine === 'bing' ? 'bing' : 'serper',
        ],
      );
      saved++;
    }

    res.json({
      found: parsed.length,
      saved,
      engine,
      query: queryUsed,
      debug: {
        hasSerper: !!serperKey,
        hasBing: !!bingKey,
        rawCount: rawResults.length,
        profileCount: profileResults.length,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      return;
    }
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
      per_page: body.per_page,
      person_titles: body.job_titles,
      person_locations: body.locations,
    };

    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
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
