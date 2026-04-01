'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Campaign } from '@/lib/types';
import PageHeader from '@/components/page-header';
import Badge from '@/components/badge';
import EmptyState from '@/components/empty-state';
import { statusColor, formatDate } from '@/lib/utils';
import { Megaphone, Plus, Play, Pause, Rocket } from 'lucide-react';
import Link from 'next/link';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      const data = await api<{ campaigns: Campaign[]; total: number }>('/api/crm/campaigns');
      setCampaigns(data.campaigns);
      setTotal(data.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  async function handleRun(id: string) {
    setActionLoading(id);
    try {
      await api(`/api/crm/campaigns/${id}/run`, { method: 'POST' });
      fetchCampaigns();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function handlePause(id: string) {
    setActionLoading(id);
    try {
      await api(`/api/crm/campaigns/${id}/pause`, { method: 'POST' });
      fetchCampaigns();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  if (loading) {
    return <div className="flex justify-center py-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description={`${total} campaigns`}
        actions={
          <Link href="/campaigns/new" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition">
            <Plus className="h-4 w-4" /> New Campaign
          </Link>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="No campaigns yet"
          description="Create a campaign to start discovering and engaging prospects."
          action={
            <Link href="/campaigns/new" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> New Campaign
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-accent/30 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/campaigns/${c.id}`} className="font-semibold text-foreground hover:text-accent transition-colors">{c.name}</Link>
                    <Badge className={statusColor(c.status)}>{c.status}</Badge>
                  </div>
                  {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                    <span>{c.total_prospect_count} prospects</span>
                    <span>{c.total_message_count} messages</span>
                    <span>{c.total_reply_count} replies</span>
                    <span>{c.total_meeting_count} meetings</span>
                    <span>Created {formatDate(c.created_at)}</span>
                  </div>
                  {(c.icp_industries?.length || c.icp_keywords?.length) ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.icp_industries?.map((ind) => (
                        <span key={ind} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">{ind}</span>
                      ))}
                      {c.icp_keywords?.map((kw) => (
                        <span key={kw} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{kw}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2 shrink-0 ml-4">
                  {(c.status === 'draft' || c.status === 'active') && (
                    <button
                      onClick={() => handleRun(c.id)}
                      disabled={actionLoading === c.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition"
                    >
                      <Rocket className="h-3 w-3" /> {actionLoading === c.id ? '…' : 'Run Discovery'}
                    </button>
                  )}
                  {c.status === 'active' && (
                    <button
                      onClick={() => handlePause(c.id)}
                      disabled={actionLoading === c.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-background disabled:opacity-50 transition"
                    >
                      <Pause className="h-3 w-3" /> Pause
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
