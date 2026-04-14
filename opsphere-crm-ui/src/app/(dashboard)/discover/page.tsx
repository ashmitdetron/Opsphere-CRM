'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/page-header';
import { Search, Loader2, AlertCircle, CheckCircle2, Settings, Zap } from 'lucide-react';
import Link from 'next/link';

interface Campaign {
  id: string;
  name: string;
}

interface DiscoveryStatus {
  hunter: boolean;
  apollo: boolean;
  bing: boolean;
  serper: boolean;
}

interface DiscoveryResult {
  found: number;
  saved: number;
  engine?: string;
  query?: string;
}

const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${configured ? 'bg-green-100 text-green-700' : 'bg-muted/30 text-muted'}`}>
      {configured ? 'Configured' : 'Not configured'}
    </span>
  );
}

function ResultBanner({ result }: { result: DiscoveryResult }) {
  return (
    <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700 space-y-1">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
        Found {result.found} profiles — {result.saved} new prospects added to campaign.
        {result.engine && <span className="text-green-600 text-xs">via {result.engine}</span>}
      </div>
      {result.query && (
        <p className="text-[11px] text-green-600 font-mono pl-6 break-all">Query: {result.query}</p>
      )}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{message}
    </div>
  );
}

export default function DiscoverPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [status, setStatus] = useState<DiscoveryStatus>({ hunter: false, apollo: false, bing: false, serper: false });
  const [loading, setLoading] = useState(true);

  // LinkedIn Search form
  const [searchCampaign, setSearchCampaign] = useState('');
  const [searchTitles, setSearchTitles] = useState('');
  const [searchLocations, setSearchLocations] = useState('');
  const [searchIndustries, setSearchIndustries] = useState('');
  const [searchLimit, setSearchLimit] = useState(20);
  const [searchRunning, setSearchRunning] = useState(false);
  const [searchResult, setSearchResult] = useState<DiscoveryResult | null>(null);
  const [searchError, setSearchError] = useState('');

  // Hunter form
  const [hunterCampaign, setHunterCampaign] = useState('');
  const [hunterDomain, setHunterDomain] = useState('');
  const [hunterLimit, setHunterLimit] = useState(10);
  const [hunterRunning, setHunterRunning] = useState(false);
  const [hunterResult, setHunterResult] = useState<DiscoveryResult | null>(null);
  const [hunterError, setHunterError] = useState('');

  // Apollo form
  const [apolloCampaign, setApolloCampaign] = useState('');
  const [apolloTitles, setApolloTitles] = useState('');
  const [apolloLocations, setApolloLocations] = useState('');
  const [apolloPerPage, setApolloPerPage] = useState(25);
  const [apolloRunning, setApolloRunning] = useState(false);
  const [apolloResult, setApolloResult] = useState<DiscoveryResult | null>(null);
  const [apolloError, setApolloError] = useState('');

  useEffect(() => {
    Promise.all([
      api<{ campaigns: Campaign[] }>('/api/crm/campaigns'),
      api<DiscoveryStatus>('/api/crm/discovery/status'),
    ])
      .then(([campData, statusData]) => {
        setCampaigns(campData.campaigns);
        setStatus(statusData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError('');
    setSearchResult(null);
    setSearchRunning(true);
    try {
      const result = await api<DiscoveryResult>('/api/crm/discovery/search', {
        method: 'POST',
        body: JSON.stringify({
          campaign_id: searchCampaign,
          job_titles: searchTitles.split(',').map(s => s.trim()).filter(Boolean),
          locations: searchLocations.split(',').map(s => s.trim()).filter(Boolean),
          industries: searchIndustries.split(',').map(s => s.trim()).filter(Boolean),
          limit: searchLimit,
        }),
      });
      setSearchResult(result);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearchRunning(false);
    }
  }

  async function runHunter(e: React.FormEvent) {
    e.preventDefault();
    setHunterError('');
    setHunterResult(null);
    setHunterRunning(true);
    try {
      const result = await api<DiscoveryResult>('/api/crm/discovery/hunter', {
        method: 'POST',
        body: JSON.stringify({
          campaign_id: hunterCampaign,
          domain: hunterDomain,
          limit: hunterLimit,
        }),
      });
      setHunterResult(result);
    } catch (err) {
      setHunterError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setHunterRunning(false);
    }
  }

  async function runApollo(e: React.FormEvent) {
    e.preventDefault();
    setApolloError('');
    setApolloResult(null);
    setApolloRunning(true);
    try {
      const result = await api<DiscoveryResult>('/api/crm/discovery/apollo', {
        method: 'POST',
        body: JSON.stringify({
          campaign_id: apolloCampaign,
          job_titles: apolloTitles.split(',').map(s => s.trim()).filter(Boolean),
          locations: apolloLocations.split(',').map(s => s.trim()).filter(Boolean),
          per_page: apolloPerPage,
        }),
      });
      setApolloResult(result);
    } catch (err) {
      setApolloError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setApolloRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        title="Find Leads"
        description="Discover prospects from LinkedIn, Hunter.io, or Apollo.io and add them to a campaign."
      />

      {/* ── LinkedIn Search (free) ── */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-muted" /> LinkedIn Search
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/20 text-accent">Free</span>
          </h2>
          <span className="text-[10px] text-muted">
            {status.bing ? 'Using Bing' : status.serper ? 'Using Serper (Google)' : 'No search key — add Serper or Bing'}
          </span>
        </div>
        <p className="text-xs text-muted mb-4">
          Searches <code className="bg-muted/20 px-1 rounded">site:linkedin.com/in</code> for people matching your criteria.
          Requires a <strong>Serper</strong> key (free at serper.dev — 2,500 searches) or <strong>Bing</strong> key (azure.com — 1,000/month free).
          Add in Settings → API Keys.
        </p>

        <form onSubmit={runSearch} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          {searchError && <ErrorBanner message={searchError} />}
          {searchResult && <ResultBanner result={searchResult} />}

          <div>
            <label className="block text-xs font-medium mb-1.5">Campaign *</label>
            <select required value={searchCampaign} onChange={e => setSearchCampaign(e.target.value)} className={inputCls}>
              <option value="">Select a campaign…</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Job Titles * (comma-separated)</label>
            <input
              type="text"
              required
              value={searchTitles}
              onChange={e => setSearchTitles(e.target.value)}
              className={inputCls}
              placeholder="CEO, CTO, Head of Engineering"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Locations (comma-separated)</label>
            <input
              type="text"
              value={searchLocations}
              onChange={e => setSearchLocations(e.target.value)}
              className={inputCls}
              placeholder="Australia, United States"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Industries (comma-separated, optional)</label>
            <input
              type="text"
              value={searchIndustries}
              onChange={e => setSearchIndustries(e.target.value)}
              className={inputCls}
              placeholder="SaaS, Fintech, Manufacturing"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Max results (up to 50)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={searchLimit}
              onChange={e => setSearchLimit(Number(e.target.value))}
              className={inputCls}
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={searchRunning}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {searchRunning
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</>
                : <><Zap className="h-3.5 w-3.5" /> Search LinkedIn</>}
            </button>
            {!status.bing && !status.serper && (
              <Link href="/settings" className="text-xs text-muted hover:underline inline-flex items-center gap-1">
                <Settings className="h-3 w-3" /> Add Serper or Bing key to enable search
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* ── Hunter.io ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-muted" /> Hunter.io — Email Finder
          </h2>
          <StatusBadge configured={status.hunter} />
        </div>

        <form onSubmit={runHunter} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          {hunterError && <ErrorBanner message={hunterError} />}
          {hunterResult && <ResultBanner result={hunterResult} />}

          <div>
            <label className="block text-xs font-medium mb-1.5">Campaign *</label>
            <select required value={hunterCampaign} onChange={e => setHunterCampaign(e.target.value)} className={inputCls}>
              <option value="">Select a campaign…</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Company Domain *</label>
            <input
              type="text"
              required
              value={hunterDomain}
              onChange={e => setHunterDomain(e.target.value)}
              className={inputCls}
              placeholder="acmecorp.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Limit (max 100)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={hunterLimit}
              onChange={e => setHunterLimit(Number(e.target.value))}
              className={inputCls}
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={hunterRunning || !status.hunter}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {hunterRunning ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</> : 'Find Emails'}
            </button>
            {!status.hunter && (
              <Link href="/settings" className="text-xs text-muted hover:underline inline-flex items-center gap-1">
                <Settings className="h-3 w-3" /> Add API Key
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* ── Apollo.io ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-muted" /> Apollo.io — B2B Database
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Paid plan required</span>
          </h2>
          <StatusBadge configured={status.apollo} />
        </div>

        <form onSubmit={runApollo} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          {apolloError && <ErrorBanner message={apolloError} />}
          {apolloResult && <ResultBanner result={apolloResult} />}

          <div>
            <label className="block text-xs font-medium mb-1.5">Campaign *</label>
            <select required value={apolloCampaign} onChange={e => setApolloCampaign(e.target.value)} className={inputCls}>
              <option value="">Select a campaign…</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Job Titles (comma-separated)</label>
            <input
              type="text"
              value={apolloTitles}
              onChange={e => setApolloTitles(e.target.value)}
              className={inputCls}
              placeholder="CTO, VP Engineering, Head of Product"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Locations (comma-separated)</label>
            <input
              type="text"
              value={apolloLocations}
              onChange={e => setApolloLocations(e.target.value)}
              className={inputCls}
              placeholder="United States, Canada"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Results per page (max 100)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={apolloPerPage}
              onChange={e => setApolloPerPage(Number(e.target.value))}
              className={inputCls}
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={apolloRunning || !status.apollo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {apolloRunning ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</> : 'Search Apollo'}
            </button>
            {!status.apollo && (
              <Link href="/settings" className="text-xs text-muted hover:underline inline-flex items-center gap-1">
                <Settings className="h-3 w-3" /> Add API Key
              </Link>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
