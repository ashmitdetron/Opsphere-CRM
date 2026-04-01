'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Prospect, Campaign } from '@/lib/types';
import PageHeader from '@/components/page-header';
import Badge from '@/components/badge';
import EmptyState from '@/components/empty-state';
import { stageColor, stageLabel, formatDate } from '@/lib/utils';
import { UserSearch, Search, Sparkles, Brain, Upload } from 'lucide-react';
import Link from 'next/link';

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pData, cData] = await Promise.all([
        api<{ prospects: Prospect[]; total: number }>('/api/crm/prospects', {
          params: { search: search || undefined, campaign_id: filterCampaign || undefined, pipeline_stage: filterStage || undefined, limit: 50 },
        }),
        api<{ campaigns: Campaign[] }>('/api/crm/campaigns'),
      ]);
      setProspects(pData.prospects);
      setTotal(pData.total);
      setCampaigns(cData.campaigns);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, filterCampaign, filterStage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleEnrich(id: string) {
    setActionLoading(`enrich-${id}`);
    try {
      await api(`/api/crm/prospects/${id}/enrich`, { method: 'POST' });
      fetchData();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function handleGenerate(id: string) {
    setActionLoading(`msg-${id}`);
    try {
      await api(`/api/crm/prospects/${id}/generate-message`, { method: 'POST' });
      fetchData();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  const selectCls = "rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospects"
        description={`${total} prospects across all campaigns`}
        actions={
          <Link href="/prospects/import" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:bg-background transition">
            <Upload className="h-4 w-4" /> Import CSV
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
        </div>
        <select value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)} className={selectCls}>
          <option value="">All campaigns</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className={selectCls}>
          <option value="">All stages</option>
          {['found','researched','message_drafted','message_approved','message_sent','replied','meeting_booked','converted','rejected'].map((s) => (
            <option key={s} value={s}>{stageLabel(s)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>
      ) : prospects.length === 0 ? (
        <EmptyState icon={<UserSearch className="h-10 w-10" />} title="No prospects found" description="Run a campaign discovery or add prospects manually." />
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Enrichment</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/prospects/${p.id}`} className="font-medium hover:text-accent transition-colors">{p.full_name || '—'}</Link>
                    {p.email && <div className="text-xs text-muted">{p.email}</div>}
                  </td>
                  <td className="px-4 py-3">{p.company_name || '—'}</td>
                  <td className="px-4 py-3 text-muted">{p.job_title || '—'}</td>
                  <td className="px-4 py-3"><Badge className={stageColor(p.pipeline_stage)}>{stageLabel(p.pipeline_stage)}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge className={p.enrichment_status === 'completed' ? 'bg-green-100 text-green-700' : p.enrichment_status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}>
                      {p.enrichment_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted tabular-nums">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {p.enrichment_status === 'pending' && (
                        <button onClick={() => handleEnrich(p.id)} disabled={!!actionLoading} className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50">
                          <Brain className="h-3 w-3" /> {actionLoading === `enrich-${p.id}` ? '…' : 'Enrich'}
                        </button>
                      )}
                      {['found','researched'].includes(p.pipeline_stage) && p.enrichment_status === 'completed' && (
                        <button onClick={() => handleGenerate(p.id)} disabled={!!actionLoading} className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-100 disabled:opacity-50">
                          <Sparkles className="h-3 w-3" /> {actionLoading === `msg-${p.id}` ? '…' : 'Generate'}
                        </button>
                      )}
                      {p.linkedin_url && (
                        <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">LinkedIn</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
