import { Prospect, EnrichmentResult } from '../../types/index.js';

// ─── API Keys ─────────────────────────────────────────────────
const PROXYCURL_API_KEY = process.env.PROXYCURL_API_KEY || '';
const HUNTER_API_KEY = process.env.HUNTER_API_KEY || '';
const CLEARBIT_API_KEY = process.env.CLEARBIT_API_KEY || '';

// ─── Endpoints ────────────────────────────────────────────────
const PROXYCURL_ENDPOINT = 'https://nubela.co/proxycurl/api/v2/linkedin';
const HUNTER_EMAIL_ENDPOINT = 'https://api.hunter.io/v2/email-finder';
const CLEARBIT_ENDPOINT = 'https://company.clearbit.com/v2/companies/find';

// ─── External Response Types ──────────────────────────────────

interface ProxycurlProfile {
  headline?: string;
  summary?: string;
  industry?: string;
  company?: {
    name?: string;
    company_size?: string;
    description?: string;
    website?: string;
  };
  experiences?: Array<{
    title?: string;
    company?: string;
    description?: string;
    starts_at?: { year: number };
    ends_at?: { year: number } | null;
  }>;
}

interface HunterEmailResponse {
  data?: {
    email?: string;
    score?: number;
    position?: string;
    department?: string;
  };
}

interface ClearbitCompany {
  name?: string;
  description?: string;
  employeesRange?: string;
  employees?: number;
  industry?: string;
  tags?: string[];
  metrics?: { employeesRange?: string };
}

// ─── Source 1: Proxycurl ──────────────────────────────────────

async function enrichViaProxycurl(linkedinUrl: string): Promise<ProxycurlProfile | null> {
  if (!PROXYCURL_API_KEY) {
    console.warn('[ResearchAgent:Proxycurl] API key not set — returning stub data');
    return {
      headline: 'VP of Sales at Acme Corp',
      summary: 'Experienced sales leader specialising in B2B SaaS...',
      industry: 'Software',
      company: {
        name: 'Acme Corp',
        company_size: '51-200',
        description: 'Leading provider of enterprise workflow solutions.',
        website: 'https://acme.example.com',
      },
      experiences: [
        {
          title: 'VP of Sales',
          company: 'Acme Corp',
          description: 'Leading 15-person sales org across APAC and EMEA.',
          starts_at: { year: 2021 },
          ends_at: null,
        },
      ],
    };
  }

  console.log(`[ResearchAgent:Proxycurl] Enriching: ${linkedinUrl}`);

  const url = new URL(PROXYCURL_ENDPOINT);
  url.searchParams.set('url', linkedinUrl);
  url.searchParams.set('use_cache', 'if-present');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${PROXYCURL_API_KEY}` },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[ResearchAgent:Proxycurl] Error ${response.status}: ${text}`);
    return null;
  }

  return response.json() as Promise<ProxycurlProfile>;
}

// ─── Source 2: Hunter.io Email Finder ─────────────────────────

function extractDomain(website: string): string | null {
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function findEmailViaHunter(
  fullName: string,
  domain: string,
): Promise<string | null> {
  if (!HUNTER_API_KEY) {
    console.log('[ResearchAgent:Hunter] API key not set — skipping');
    return null;
  }

  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  if (!firstName || !lastName || !domain) return null;

  console.log(`[ResearchAgent:Hunter] Email finder: ${firstName} ${lastName} @ ${domain}`);

  const url = new URL(HUNTER_EMAIL_ENDPOINT);
  url.searchParams.set('domain', domain);
  url.searchParams.set('first_name', firstName);
  url.searchParams.set('last_name', lastName);
  url.searchParams.set('api_key', HUNTER_API_KEY);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const text = await response.text();
    console.error(`[ResearchAgent:Hunter] Error ${response.status}: ${text}`);
    return null;
  }

  const data = (await response.json()) as HunterEmailResponse;
  const email = data.data?.email;
  const score = data.data?.score ?? 0;

  // Only use emails with confidence score >= 50
  if (email && score >= 50) {
    console.log(`[ResearchAgent:Hunter] Found email: ${email} (score: ${score})`);
    return email;
  }

  return null;
}

// ─── Source 3: Clearbit Company Enrichment ────────────────────

async function enrichCompanyViaClearbit(domain: string): Promise<ClearbitCompany | null> {
  if (!CLEARBIT_API_KEY) {
    console.log('[ResearchAgent:Clearbit] API key not set — skipping');
    return null;
  }

  console.log(`[ResearchAgent:Clearbit] Company lookup: ${domain}`);

  const url = new URL(CLEARBIT_ENDPOINT);
  url.searchParams.set('domain', domain);

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${CLEARBIT_API_KEY}` },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[ResearchAgent:Clearbit] Error ${response.status}: ${text}`);
    return null;
  }

  return response.json() as Promise<ClearbitCompany>;
}

// ─── Source 4: Web Scraping Fallback ─────────────────────────

async function scrapeCompanyWebsite(
  websiteUrl: string,
): Promise<{ description: string | null; title: string | null }> {
  try {
    console.log(`[ResearchAgent:WebScrape] Fetching: ${websiteUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OPSphereBot/1.0)' },
    });

    clearTimeout(timeout);

    if (!response.ok) return { description: null, title: null };

    const html = await response.text();

    // Extract meta description
    const metaDescMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
    ) || html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i,
    );
    const description = metaDescMatch?.[1]?.trim() || null;

    // Extract og:description as fallback
    const ogDescMatch = html.match(
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
    );
    const ogDescription = ogDescMatch?.[1]?.trim() || null;

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || null;

    return {
      description: description || ogDescription,
      title,
    };
  } catch (err) {
    console.warn(`[ResearchAgent:WebScrape] Failed for ${websiteUrl}:`, err);
    return { description: null, title: null };
  }
}

// ─── Main Export ──────────────────────────────────────────────

export async function enrichProspect(prospect: Prospect): Promise<EnrichmentResult> {
  console.log(`[ResearchAgent] Enriching: ${prospect.full_name} (${prospect.linkedin_url || 'no LinkedIn'})`);

  // Run Proxycurl and determine company domain in parallel
  const domain = prospect.company_website
    ? extractDomain(prospect.company_website)
    : null;

  const [proxycurlResult, clearbitResult] = await Promise.allSettled([
    prospect.linkedin_url ? enrichViaProxycurl(prospect.linkedin_url) : Promise.resolve(null),
    domain ? enrichCompanyViaClearbit(domain) : Promise.resolve(null),
  ]);

  const profile = proxycurlResult.status === 'fulfilled' ? proxycurlResult.value : null;
  const company = clearbitResult.status === 'fulfilled' ? clearbitResult.value : null;

  if (proxycurlResult.status === 'rejected') {
    console.error('[ResearchAgent:Proxycurl] Failed:', proxycurlResult.reason);
  }
  if (clearbitResult.status === 'rejected') {
    console.error('[ResearchAgent:Clearbit] Failed:', clearbitResult.reason);
  }

  // Find email via Hunter if we don't have one yet
  let foundEmail: string | null = prospect.email || null;
  if (!foundEmail && domain && prospect.full_name) {
    try {
      foundEmail = await findEmailViaHunter(prospect.full_name, domain);
    } catch (err) {
      console.error('[ResearchAgent:Hunter] Failed:', err);
    }
  }

  // Determine company size (Proxycurl → Clearbit → null)
  const companySize =
    profile?.company?.company_size ||
    company?.metrics?.employeesRange ||
    company?.employeesRange ||
    (company?.employees ? `${Math.round(company.employees / 50) * 50}+` : null);

  // Determine about section (Proxycurl → Clearbit → web scrape)
  let aboutSection = profile?.company?.description || company?.description || null;

  if (!aboutSection && prospect.company_website) {
    try {
      const scraped = await scrapeCompanyWebsite(prospect.company_website);
      aboutSection = scraped.description;
    } catch (err) {
      console.warn('[ResearchAgent:WebScrape] Error:', err);
    }
  }

  // Build the merged enrichment result
  const raw: Record<string, unknown> = {};
  if (profile) raw.proxycurl = profile;
  if (company) raw.clearbit = company;
  if (foundEmail) raw.hunter_email = foundEmail;

  return {
    company_size: companySize ?? null,
    recent_news: null,
    about_section: aboutSection,
    headline: profile?.headline ?? null,
    summary: profile?.summary ?? null,
    email: foundEmail ?? null,
    raw,
  };
}
