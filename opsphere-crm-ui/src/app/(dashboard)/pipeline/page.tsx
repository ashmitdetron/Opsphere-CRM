'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { PipelineStats, PipelineEvent } from '@/lib/types';
import PageHeader from '@/components/page-header';
import StatCard from '@/components/stat-card';
import Badge from '@/components/badge';
import { stageColor, stageLabel, statusColor, formatDateTime } from '@/lib/utils';
import { GitBranch, TrendingUp, Activity, BarChart3, ArrowRight } from 'lucide-react';

export default function PipelinePage() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<PipelineStats>('/api/crm/pipeline/stats'),
      api<{ events: PipelineEvent[] }>('/api/crm/pipeline/events', { params: { limit: 30 } }),
    ])
      .then(([s, e]) => { setStats(s); setEvents(e.events); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Pipeline" description="Funnel analytics and event log" />

      {/* Funnel Stages */}
      {stats && stats.summary.stage_breakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted" /> Pipeline Funnel</h2>
          <div className="flex flex-wrap gap-2">
            {stats.summary.stage_breakdown.map((stage, i) => (
              <div key={stage.pipeline_stage} className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
                  <Badge className={stageColor(stage.pipeline_stage)}>{stageLabel(stage.pipeline_stage)}</Badge>
                  <span className="text-2xl font-bold tabular-nums">{stage.count}</span>
                </div>
                {i < stats.summary.stage_breakdown.length - 1 && <ArrowRight className="h-4 w-4 text-muted shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign Performance */}
      {stats && stats.campaigns.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="p-5 pb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted" /> Campaign Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border text-left text-xs text-muted">
                  <th className="px-5 py-2 font-medium">Campaign</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium text-right">Prospects</th>
                  <th className="px-5 py-2 font-medium text-right">Messages</th>
                  <th className="px-5 py-2 font-medium text-right">Replies</th>
                  <th className="px-5 py-2 font-medium text-right">Meetings</th>
                  <th className="px-5 py-2 font-medium text-right">Msg Rate</th>
                  <th className="px-5 py-2 font-medium text-right">Reply Rate</th>
                  <th className="px-5 py-2 font-medium text-right">Meeting Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.campaigns.map((c) => (
                  <tr key={c.campaign_id} className="border-t border-border hover:bg-background/50 transition-colors">
                    <td className="px-5 py-3 font-medium">{c.campaign_name}</td>
                    <td className="px-5 py-3"><Badge className={statusColor(c.campaign_status)}>{c.campaign_status}</Badge></td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.total_prospect_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.total_message_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.total_reply_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.total_meeting_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.message_rate}%</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium text-green-600">{c.reply_rate}%</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.meeting_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event Log */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-5 pb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-muted" /> Recent Events</h2>
        </div>
        {events.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">No pipeline events yet.</p>
        ) : (
          <div className="px-5 pb-5 space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5 text-sm">
                <Badge className={stageColor(ev.to_stage || '')}>{ev.event_type.replace(/_/g, ' ')}</Badge>
                {ev.from_stage && ev.to_stage && (
                  <span className="text-xs text-muted flex items-center gap-1">
                    {stageLabel(ev.from_stage)} <ArrowRight className="h-3 w-3" /> {stageLabel(ev.to_stage)}
                  </span>
                )}
                {ev.notes && <span className="text-xs text-muted truncate flex-1">{ev.notes}</span>}
                <span className="text-[10px] text-muted ml-auto shrink-0">{formatDateTime(ev.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
