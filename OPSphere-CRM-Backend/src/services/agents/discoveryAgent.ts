import { DiscoveryResult, Campaign } from '../../types/index.js';

// ─── API Keys ─────────────────────────────────────────────────
const SERPER_API_KEY = process.env.SERPER_API_KEY || '';
const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';
const BING_SEARCH_KEY = process.env.BING_SEARCH_KEY || '';

// ─── Endpoints ────────────────────────────────────────────────
const SERPER_ENDPOINT = 'https://google.serper.dev/search';
const APOLLO_ENDPOINT = 'https://api.apollo.io/v1/mixed_people/search';
const BING_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';

// ─── External Response Types ──────────────────────────────────

interface SerperSearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface SerperResponse {
  organic: SerperSearchResult[];
}

interface ApolloPerson {
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  linkedin_url?: string;
  email?: string;
  organization?: {
    name?: string;
    website_url?: string;
  };
}

interface ApolloResponse {
  people?: ApolloPerson[];
}

interface BingWebPage {
  name: string;
  url: string;
  snippet: string;
}

interface BingResponse {
  webPages?: { value: BingWebPage[] };
}

// ─── Query Builders ───────────────────────────────────────────

function buildLinkedInQuery(campaign: Campaign): string {
  const parts: string[] = ['site:linkedin.com/in'];
  if (campaign.icp_industries?.length) {
    parts.push(`(${campaign.icp_industries.join(' OR ')})`);
  }
  if (campaign.icp_seniority?.length) {
    parts.push(`(${campaign.icp_seniority.join(' OR ')})`);
  }
  if (campaign.icp_keywords?.length) {
    parts.push(campaign.icp_keywords.join(' '));
  }
  if (campaign.icp_locations?.length) {
    parts.push(`(${campaign.icp_locations.join(' OR ')})`);
  }
  return parts.join(' ');
}

function parseLinkedInTitle(result: { title: string; link: string }): DiscoveryResult | null {
  const url = result.link;
  if (!url.includes('linkedin.com/in/')) return null;

  const titleParts = result.title.replace(/ \| LinkedIn$/, '').split(' - ');
  const fullName = (titleParts[0] || '').trim();
  const jobTitle = (titleParts[1] || '').trim();
  const companyName = (titleParts[2] || '').trim();

  if (!fullName) return null;

  return {
    linkedin_url: url.split('?')[0],
    full_name: fullName,
    company_name: companyName,
    job_title: jobTitle,
    source: 'serper',
  };
}

// ─── Source 1: Serper (Google LinkedIn SERP) ──────────────────

async function searchViaSerper(campaign: Campaign, maxResults: number): Promise<DiscoveryResult[]> {
  if (!SERPER_API_KEY) {
    console.warn('[DiscoveryAgent:Serper] API key not set — returning stub data');
    return [
      {
        linkedin_url: 'https://linkedin.com/in/jane-smith-acme',
        full_name: 'Jane Smith',
        company_name: 'Acme Corp',
        job_title: 'VP of Sales',
        source: 'serper',
      },
      {
        linkedin_url: 'https://linkedin.com/in/john-doe-techstartup',
        full_name: 'John Doe',
        company_name: 'TechStartup Inc',
        job_title: 'Head of Growth',
        source: 'serper',
      },
    ];
  }

  const query = buildLinkedInQuery(campaign);
  console.log(`[DiscoveryAgent:Serper] Query: "${query}"`);

  const response = await fetch(SERPER_ENDPOINT, {
    method: 'POST',
    headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: maxResults }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[DiscoveryAgent:Serper] Error ${response.status}: ${text}`);
    return [];
  }

  const data = (await response.json()) as SerperResponse;
  return (data.organic || [])
    .map(parseLinkedInTitle)
    .filter((r): r is DiscoveryResult => r !== null);
}

// ─── Source 2: Apollo.io People Search ────────────────────────

async function searchViaApollo(campaign: Campaign, maxResults: number): Promise<DiscoveryResult[]> {
  if (!APOLLO_API_KEY) {
    console.log('[DiscoveryAgent:Apollo] API key not set — skipping');
    return [];
  }

  console.log('[DiscoveryAgent:Apollo] Running people search');

  const body: Record<string, unknown> = { per_page: maxResults, page: 1 };

  if (campaign.icp_seniority?.length) {
    body.person_titles = campaign.icp_seniority;
  }
  if (campaign.icp_locations?.length) {
    body.person_locations = campaign.icp_locations;
  }
  if (campaign.icp_industries?.length) {
    body.organization_industry_tag_ids = campaign.icp_industries;
  }
  if (campaign.icp_keywords?.length) {
    body.q_keywords = campaign.icp_keywords.join(' ');
  }

  const response = await fetch(APOLLO_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-Api-Key': APOLLO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[DiscoveryAgent:Apollo] Error ${response.status}: ${text}`);
    return [];
  }

  const data = (await response.json()) as ApolloResponse;
  const results: DiscoveryResult[] = [];

  for (const person of data.people || []) {
    const fullName = person.name || [person.first_name, person.last_name].filter(Boolean).join(' ');
    if (!fullName) continue;

    results.push({
      linkedin_url: person.linkedin_url || '',
      full_name: fullName,
      company_name: person.organization?.name || '',
      job_title: person.title || '',
      email: person.email,
      source: 'apollo',
    });
  }

  console.log(`[DiscoveryAgent:Apollo] Found ${results.length} prospects`);
  return results;
}

// ─── Source 3: Bing Web Search (LinkedIn SERP) ────────────────

async function searchViaBing(campaign: Campaign, maxResults: number): Promise<DiscoveryResult[]> {
  if (!BING_SEARCH_KEY) {
    console.log('[DiscoveryAgent:Bing] API key not set — skipping');
    return [];
  }

  const query = buildLinkedInQuery(campaign);
  console.log(`[DiscoveryAgent:Bing] Query: "${query}"`);

  const url = new URL(BING_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(maxResults));
  url.searchParams.set('mkt', 'en-US');

  const response = await fetch(url.toString(), {
    headers: { 'Ocp-Apim-Subscription-Key': BING_SEARCH_KEY },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[DiscoveryAgent:Bing] Error ${response.status}: ${text}`);
    return [];
  }

  const data = (await response.json()) as BingResponse;
  const pages = data.webPages?.value || [];

  return pages
    .map((page) => parseLinkedInTitle({ title: page.name, link: page.url }))
    .filter((r): r is DiscoveryResult => r !== null)
    .map((r) => ({ ...r, source: 'bing' }));
}

// ─── Deduplication ────────────────────────────────────────────

function deduplicateResults(results: DiscoveryResult[]): DiscoveryResult[] {
  const seenUrls = new Set<string>();
  const seenNameCompany = new Set<string>();
  const deduped: DiscoveryResult[] = [];

  for (const result of results) {
    const urlKey = result.linkedin_url?.toLowerCase();
    const nameCompanyKey = `${result.full_name.toLowerCase()}|${result.company_name.toLowerCase()}`;

    if (urlKey && seenUrls.has(urlKey)) continue;
    if (seenNameCompany.has(nameCompanyKey)) continue;

    if (urlKey) seenUrls.add(urlKey);
    seenNameCompany.add(nameCompanyKey);
    deduped.push(result);
  }

  return deduped;
}

// ─── Main Export ──────────────────────────────────────────────

export async function discoverProspects(
  campaign: Campaign,
  maxResults: number = 20,
): Promise<DiscoveryResult[]> {
  console.log(`[DiscoveryAgent] Running multi-source discovery for campaign: ${campaign.name}`);

  // Run all sources concurrently
  const [serperResults, apolloResults, bingResults] = await Promise.allSettled([
    searchViaSerper(campaign, maxResults),
    searchViaApollo(campaign, maxResults),
    searchViaBing(campaign, maxResults),
  ]);

  const allResults: DiscoveryResult[] = [
    ...(serperResults.status === 'fulfilled' ? serperResults.value : []),
    ...(apolloResults.status === 'fulfilled' ? apolloResults.value : []),
    ...(bingResults.status === 'fulfilled' ? bingResults.value : []),
  ];

  if (serperResults.status === 'rejected') {
    console.error('[DiscoveryAgent:Serper] Failed:', serperResults.reason);
  }
  if (apolloResults.status === 'rejected') {
    console.error('[DiscoveryAgent:Apollo] Failed:', apolloResults.reason);
  }
  if (bingResults.status === 'rejected') {
    console.error('[DiscoveryAgent:Bing] Failed:', bingResults.reason);
  }

  const deduped = deduplicateResults(allResults);
  console.log(
    `[DiscoveryAgent] Total: ${allResults.length} raw → ${deduped.length} after dedup ` +
    `(serper: ${serperResults.status === 'fulfilled' ? serperResults.value.length : 0}, ` +
    `apollo: ${apolloResults.status === 'fulfilled' ? apolloResults.value.length : 0}, ` +
    `bing: ${bingResults.status === 'fulfilled' ? bingResults.value.length : 0})`,
  );

  return deduped.slice(0, maxResults);
}
