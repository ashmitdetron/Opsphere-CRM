'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/page-header';
import { Search, Loader2, AlertCircle, CheckCircle2, Settings } from 'lucide-react';
import Link from 'next/link';

interface Campaign {
  id: string;
  name: string;
}

interface DiscoveryStatus {
  hunter: boolean;
  apollo: boolean;
}

interface DiscoveredProspect {
  email: string;
  full_name: string | null;
  company_name: string | null;
  job_title: string | null;
}

interface DiscoveryResult {
  found: number;
  saved: number;
  prospects?: DiscoveredProspect[];
}

const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

export default function DiscoverPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [status, setStatus] = useState<DiscoveryStatus>({ hunter: false, apollo: false });
  const [loading, setLoading] = useState(true);

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
          job_titles: apolloTitles.split(',').map((s) => s.trim()).filter(Boolean),
          locations: apolloLocations.split(',').map((s) => s.trim()).filter(Boolean),
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

  const noKeysConfigured = !status.hunter && !status.apollo;

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        title="Find Leads"
        description="Discover prospects using Hunter.io or Apollo.io and add them directly to a campaign."
      />

      {noKeysConfigured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            No discovery API keys configured.{' '}
            <Link href="/settings" className="underline font-medium">Go to Settings → API Keys</Link>{' '}
            to add your Hunter.io or Apollo.io key.
          </span>
        </div>
      )}

      {/* Hunter.io */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-muted" /> Hunter.io — Email Finder
          </h2>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.hunter ? 'bg-green-100 text-green-700' : 'bg-muted/30 text-muted'}`}>
            {status.hunter ? 'Configured' : 'Not configured'}
          </span>
        </div>

        <form onSubmit={runHunter} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          {hunterError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{hunterError}
            </div>
          )}
          {hunterResult && (
            <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              Found {hunterResult.found} contacts — {hunterResult.saved} new prospects added to campaign.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5">Campaign *</label>
            <select required value={hunterCampaign} onChange={(e) => setHunterCampaign(e.target.value)} className={inputCls}>
              <option value="">Select a campaign…</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Company Domain *</label>
            <input
              type="text"
              required
              value={hunterDomain}
              onChange={(e) => setHunterDomain(e.target.value)}
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
              onChange={(e) => setHunterLimit(Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={hunterRunning || !status.hunter}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {hunterRunning ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</> : 'Find Emails'}
            </button>
            {!status.hunter && (
              <Link href="/settings" className="ml-3 text-xs text-muted hover:underline inline-flex items-center gap-1">
                <Settings className="h-3 w-3" /> Add API Key
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* Apollo.io */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-muted" /> Apollo.io — B2B Database
          </h2>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.apollo ? 'bg-green-100 text-green-700' : 'bg-muted/30 text-muted'}`}>
            {status.apollo ? 'Configured' : 'Not configured'}
          </span>
        </div>

        <form onSubmit={runApollo} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          {apolloError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{apolloError}
            </div>
          )}
          {apolloResult && (
            <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              Found {apolloResult.found} people — {apolloResult.saved} new prospects added to campaign.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5">Campaign *</label>
            <select required value={apolloCampaign} onChange={(e) => setApolloCampaign(e.target.value)} className={inputCls}>
              <option value="">Select a campaign…</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Job Titles (comma-separated)</label>
            <input
              type="text"
              value={apolloTitles}
              onChange={(e) => setApolloTitles(e.target.value)}
              className={inputCls}
              placeholder="CTO, VP Engineering, Head of Product"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Locations (comma-separated)</label>
            <input
              type="text"
              value={apolloLocations}
              onChange={(e) => setApolloLocations(e.target.value)}
              className={inputCls}
              placeholder="United States, Canada, United Kingdom"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Results per page (max 100)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={apolloPerPage}
              onChange={(e) => setApolloPerPage(Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={apolloRunning || !status.apollo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {apolloRunning ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</> : 'Search Apollo'}
            </button>
            {!status.apollo && (
              <Link href="/settings" className="ml-3 text-xs text-muted hover:underline inline-flex items-center gap-1">
                <Settings className="h-3 w-3" /> Add API Key
              </Link>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
