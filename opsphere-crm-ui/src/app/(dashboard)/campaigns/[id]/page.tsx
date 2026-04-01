'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Campaign, Prospect, PipelineStage } from '@/lib/types';
import PageHeader from '@/components/page-header';
import Badge from '@/components/badge';
import StatCard from '@/components/stat-card';
import { stageColor, stageLabel, statusColor, formatDate } from '@/lib/utils';
import {
  ArrowLeft, Rocket, Pause, Brain, Sparkles, Users,
  MessageSquare, Reply, CalendarCheck, RefreshCw,
} from 'lucide-react';

interface StageBreakdown {
  pipeline_stage: string;
  count: number;
}

interface CampaignDetailResponse {
  campaign: Campaign;
  stage_breakdown: StageBreakdown[];
}

interface ProspectsResponse {
  prospects: Prospect[];
  total: number;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [breakdown, setBreakdown] = useState<StageBreakdown[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [filterStage, setFilterStage] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ enriched: number; skipped: number } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, prospectsData] = await Promise.all([
        api<CampaignDetailResponse>(`/api/crm/campaigns/${id}`),
        api<ProspectsResponse>('/api/crm/prospects', {
          params: { campaign_id: id, pipeline_stage: filterStage || undefined, limit: 100 },
        }),
      ]);
      setCampaign(detail.campaign);
      setBreakdown(detail.stage_breakdown);
      setProspects(prospectsData.prospects);
      setTotal(prospectsData.total);
    } catch {
      router.replace('/campaigns');
    }
    setLoading(false);
  }, [id, filterStage, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleRun() {
    if (!campaign) return;
    setActionLoading('run');
    try {
      const result = await api<{ discovered: number; inserted: number }>(
        `/api/crm/campaigns/${id}/run`,
        { method: 'POST' },
      );
      alert(`Discovery complete — found ${result.discovered}, inserted ${result.inserted} new prospects.`);
      fetchAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Discovery failed');
    }
    setActionLoading(null);
  }

  async function handlePause() {
    setActionLoading('pause');
    try {
      await api(`/api/crm/campaigns/${id}/pause`, { method: 'POST' });
      fetchAll();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function handleBulkEnrich() {
    setBulkLoading(true);
    setBulkResult(null);
    const pending = prospects.filter((p) => p.enrichment_status === 'pending');
    let enriched = 0;
    let skipped = 0;
    for (const p of pending) {
      try {
        await api(`/api/crm/prospects/${p.id}/enrich`, { method: 'POST' });
        enriched++;
      } catch {
        skipped++;
      }
    }
    setBulkResult({ enriched, skipped });
    setBulkLoading(false);
    fetchAll();
  }

  async function handleEnrich(prospectId: string) {
    setActionLoading(`enrich-${prospectId}`);
    try {
      await api(`/api/crm/prospects/${prospectId}/enrich`, { method: 'POST' });
      fetchAll();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function handleGenerate(prospectId: string) {
    setActionLoading(`msg-${prospectId}`);
    try {
      await api(`/api/crm/prospects/${prospectId}/generate-message`, { method: 'POST' });
      fetchAll();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!campaign) return null;

  const pendingCount = prospects.filter((p) => p.enrichment_status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> All Campaigns
        </Link>
        <PageHeader
          title={campaign.name}
          description={campaign.description ?? undefined}
          actions={
            <div className="flex gap-2">
              {(campaign.status === 'draft' || campaign.status === 'active') && (
                <button
                  onClick={handleRun}
                  disabled={!!actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition"
                >
                  <Rocket className="h-4 w-4" />
                  {actionLoading === 'run' ? 'Running…' : 'Run Discovery'}
                </button>
              )}
              {campaign.status === 'active' && (
                <button
                  onClick={handlePause}
                  disabled={!!actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-background disabled:opacity-50 transition"
                >
                  <Pause className="h-4 w-4" /> Pause
                </button>
              )}
            </div>
          }
        />
        <div className="mt-1 flex items-center gap-2">
          <Badge className={statusColor(campaign.status)}>{campaign.status}</Badge>
          <span className="text-xs text-muted">Created {formatDate(campaign.created_at)}</span>
          {(campaign.icp_industries?.length || campaign.icp_locations?.length) && (
            <div className="flex gap-1 ml-2">
              {campaign.icp_industries?.map((i) => (
                <span key={i} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">{i}</span>
              ))}
              {campaign.icp_locations?.map((l) => (
                <span key={l} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{l}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Prospects" value={campaign.total_prospect_count} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Messages" value={campaign.total_message_count} icon={<MessageSquare className="h-4 w-4" />} />
        <StatCard label="Replies" value={campaign.total_reply_count} icon={<Reply className="h-4 w-4" />} />
        <StatCard label="Meetings" value={campaign.total_meeting_count} icon={<CalendarCheck className="h-4 w-4" />} />
      </div>

      {/* Stage breakdown */}
      {breakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Pipeline Stages</h3>
          <div className="flex flex-wrap gap-2">
            {breakdown.map((s) => (
              <button
                key={s.pipeline_stage}
                onClick={() => setFilterStage(filterStage === s.pipeline_stage ? '' : s.pipeline_stage)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors ${filterStage === s.pipeline_stage ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'}`}
              >
                <Badge className={stageColor(s.pipeline_stage)}>{stageLabel(s.pipeline_stage)}</Badge>
                <span className="text-sm font-semibold tabular-nums">{s.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prospects table */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold">
            Prospects
            {filterStage && (
              <span className="ml-2 text-xs font-normal text-muted">
                filtered: {stageLabel(filterStage)}
                <button onClick={() => setFilterStage('')} className="ml-1 text-accent hover:underline">×</button>
              </span>
            )}
          </h3>
          <div className="flex items-center gap-3">
            {bulkResult && (
              <span className="text-xs text-muted">
                Enriched {bulkResult.enriched}, skipped {bulkResult.skipped}
              </span>
            )}
            {pendingCount > 0 && (
              <button
                onClick={handleBulkEnrich}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {bulkLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                {bulkLoading ? 'Enriching…' : `Enrich ${pendingCount} pending`}
              </button>
            )}
          </div>
        </div>

        {prospects.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted text-center">
            No prospects found.{' '}
            {campaign.status !== 'archived' && (
              <button onClick={handleRun} className="text-accent hover:underline">Run discovery</button>
            )}{' '}
            to find prospects from your ICP.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Company</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Stage</th>
                  <th className="px-4 py-2.5 font-medium">Enrichment</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/prospects/${p.id}`} className="font-medium hover:text-accent transition-colors">
                        {p.full_name || '—'}
                      </Link>
                      {p.email && <div className="text-xs text-muted">{p.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">{p.company_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted">{p.job_title || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className={stageColor(p.pipeline_stage as PipelineStage)}>
                        {stageLabel(p.pipeline_stage)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        p.enrichment_status === 'completed' ? 'bg-green-100 text-green-700'
                        : p.enrichment_status === 'failed' ? 'bg-red-100 text-red-700'
                        : p.enrichment_status === 'in_progress' ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        {p.enrichment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{p.source}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {p.enrichment_status === 'pending' && (
                          <button
                            onClick={() => handleEnrich(p.id)}
                            disabled={!!actionLoading || bulkLoading}
                            className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50 transition"
                          >
                            <Brain className="h-3 w-3" />
                            {actionLoading === `enrich-${p.id}` ? '…' : 'Enrich'}
                          </button>
                        )}
                        {['found', 'researched'].includes(p.pipeline_stage) && p.enrichment_status === 'completed' && (
                          <button
                            onClick={() => handleGenerate(p.id)}
                            disabled={!!actionLoading}
                            className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-100 disabled:opacity-50 transition"
                          >
                            <Sparkles className="h-3 w-3" />
                            {actionLoading === `msg-${p.id}` ? '…' : 'Message'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > prospects.length && (
              <p className="px-4 py-3 text-xs text-muted border-t border-border">
                Showing {prospects.length} of {total} prospects
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
