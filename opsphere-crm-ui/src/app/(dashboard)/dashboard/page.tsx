'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { PipelineStats, Campaign } from '@/lib/types';
import PageHeader from '@/components/page-header';
import StatCard from '@/components/stat-card';
import Badge from '@/components/badge';
import { stageLabel, stageColor, statusColor } from '@/lib/utils';
import { Users, MessageSquare, Reply, CalendarCheck, Megaphone, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<PipelineStats>('/api/crm/pipeline/stats'),
      api<{ campaigns: Campaign[] }>('/api/crm/campaigns', { params: { limit: 5 } }),
    ])
      .then(([s, c]) => { setStats(s); setCampaigns(c.campaigns); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const s = stats?.summary;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Overview of your outbound pipeline" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Prospects" value={s?.total_prospects ?? 0} icon={<Users className="h-5 w-5" />} />
        <StatCard
          label="Messages Sent"
          value={s?.stage_breakdown.find((x) => x.pipeline_stage === 'message_sent')?.count ?? 0}
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <StatCard
          label="Replies"
          value={s?.stage_breakdown.find((x) => x.pipeline_stage === 'replied')?.count ?? 0}
          icon={<Reply className="h-5 w-5" />}
        />
        <StatCard
          label="Meetings Booked"
          value={s?.stage_breakdown.find((x) => x.pipeline_stage === 'meeting_booked')?.count ?? 0}
          icon={<CalendarCheck className="h-5 w-5" />}
        />
      </div>

      {/* Pipeline Funnel */}
      {s && s.stage_breakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted" /> Pipeline Funnel</h2>
          <div className="flex flex-wrap gap-2">
            {s.stage_breakdown.map((stage) => (
              <div key={stage.pipeline_stage} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <Badge className={stageColor(stage.pipeline_stage)}>{stageLabel(stage.pipeline_stage)}</Badge>
                <span className="text-lg font-bold">{stage.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Campaigns */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Megaphone className="h-4 w-4 text-muted" /> Recent Campaigns</h2>
          <Link href="/campaigns" className="text-xs font-medium text-accent hover:underline">View all</Link>
        </div>
        {campaigns.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">No campaigns yet. Create your first one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border text-left text-xs text-muted">
                  <th className="px-5 py-2 font-medium">Name</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium text-right">Prospects</th>
                  <th className="px-5 py-2 font-medium text-right">Messages</th>
                  <th className="px-5 py-2 font-medium text-right">Replies</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-background/50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-foreground hover:text-accent">{c.name}</Link>
                    </td>
                    <td className="px-5 py-3"><Badge className={statusColor(c.status)}>{c.status}</Badge></td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.total_prospect_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.total_message_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.total_reply_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
