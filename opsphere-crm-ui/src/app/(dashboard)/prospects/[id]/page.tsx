'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Prospect, OutreachMessage, PipelineEvent } from '@/lib/types';
import PageHeader from '@/components/page-header';
import Badge from '@/components/badge';
import { stageColor, stageLabel, statusColor, formatDate, formatDateTime } from '@/lib/utils';
import {
  Brain, Sparkles, ExternalLink, ArrowLeft, ChevronDown, ChevronUp,
  User, Building2, MapPin, Mail, Briefcase, Activity, MessageSquare, ArrowRight,
} from 'lucide-react';

interface ProspectDetail {
  prospect: Prospect;
  messages: OutreachMessage[];
  events: PipelineEvent[];
}

export default function ProspectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<ProspectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEnrichment, setShowEnrichment] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await api<ProspectDetail>(`/api/crm/prospects/${id}`);
      setData(result);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleEnrich() {
    setActionLoading('enrich');
    try {
      await api(`/api/crm/prospects/${id}/enrich`, { method: 'POST' });
      fetchData();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function handleGenerate() {
    setActionLoading('generate');
    try {
      await api(`/api/crm/prospects/${id}/generate-message`, { method: 'POST' });
      fetchData();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  if (loading) {
    return <div className="flex justify-center py-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>
        <p className="text-sm text-muted">Prospect not found.</p>
      </div>
    );
  }

  const { prospect, messages, events } = data;
  const enrichmentData = prospect.enrichment_data as Record<string, unknown> | null;
  const canEnrich = prospect.enrichment_status === 'pending' || prospect.enrichment_status === 'failed';
  const canGenerate = ['found', 'researched'].includes(prospect.pipeline_stage) && prospect.enrichment_status === 'completed';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + header */}
      <div>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Prospects
        </button>
        <PageHeader
          title={prospect.full_name || 'Unknown Prospect'}
          description={[prospect.job_title, prospect.company_name].filter(Boolean).join(' at ')}
          actions={
            <div className="flex gap-2">
              {canEnrich && (
                <button onClick={handleEnrich} disabled={!!actionLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  <Brain className="h-3.5 w-3.5" /> {actionLoading === 'enrich' ? 'Enriching…' : 'Enrich'}
                </button>
              )}
              {canGenerate && (
                <button onClick={handleGenerate} disabled={!!actionLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                  <Sparkles className="h-3.5 w-3.5" /> {actionLoading === 'generate' ? 'Generating…' : 'Generate Message'}
                </button>
              )}
              {prospect.linkedin_url && (
                <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:bg-background transition">
                  <ExternalLink className="h-3.5 w-3.5" /> LinkedIn
                </a>
              )}
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Profile */}
        <div className="lg:col-span-1 space-y-4">
          {/* Profile card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Profile</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Badge className={stageColor(prospect.pipeline_stage)}>{stageLabel(prospect.pipeline_stage)}</Badge>
                <Badge className={prospect.enrichment_status === 'completed' ? 'bg-green-100 text-green-700' : prospect.enrichment_status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}>
                  {prospect.enrichment_status}
                </Badge>
              </div>
              {prospect.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted shrink-0" />
                  <span className="truncate">{prospect.email}</span>
                </div>
              )}
              {prospect.job_title && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-3.5 w-3.5 text-muted shrink-0" />
                  <span>{prospect.job_title}</span>
                </div>
              )}
              {prospect.company_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-3.5 w-3.5 text-muted shrink-0" />
                  <span>{prospect.company_name}
                    {prospect.company_size && <span className="text-muted ml-1">({prospect.company_size})</span>}
                  </span>
                </div>
              )}
              {prospect.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-muted shrink-0" />
                  <span>{prospect.location}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-border text-xs text-muted space-y-1">
              <p>Source: <span className="capitalize">{prospect.source}</span></p>
              <p>Added: {formatDate(prospect.created_at)}</p>
            </div>
          </div>

          {/* Enrichment data */}
          {enrichmentData && Object.keys(enrichmentData).length > 0 && (
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <button
                onClick={() => setShowEnrichment(!showEnrichment)}
                className="w-full flex items-center justify-between p-4 text-xs font-semibold uppercase tracking-wider text-muted hover:bg-background/50 transition-colors rounded-xl"
              >
                <span className="flex items-center gap-1.5"><Brain className="h-3.5 w-3.5" /> Enrichment Data</span>
                {showEnrichment ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showEnrichment && (
                <div className="px-4 pb-4 space-y-2.5">
                  {Object.entries(enrichmentData).map(([key, val]) => {
                    if (!val || (typeof val === 'object' && Object.keys(val as object).length === 0)) return null;
                    return (
                      <div key={key}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-0.5">{key.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap">{typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: Messages + Events */}
        <div className="lg:col-span-2 space-y-4">
          {/* Messages */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="p-4 pb-3 border-b border-border flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted" />
              <h3 className="text-sm font-semibold">Messages ({messages.length})</h3>
            </div>
            {messages.length === 0 ? (
              <p className="p-4 text-sm text-muted">No messages yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {messages.map((m) => (
                  <div key={m.id} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={statusColor(m.status)}>{m.status}</Badge>
                      <span className="text-[10px] uppercase text-muted">{m.channel}</span>
                      <span className="text-[10px] text-muted ml-auto">{formatDateTime(m.created_at)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-foreground/80">{m.body}</p>
                    {m.ai_model && <p className="mt-1.5 text-[10px] text-muted">AI: {m.ai_model} v{m.ai_prompt_version}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline events timeline */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="p-4 pb-3 border-b border-border flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted" />
              <h3 className="text-sm font-semibold">Pipeline Events ({events.length})</h3>
            </div>
            {events.length === 0 ? (
              <p className="p-4 text-sm text-muted">No events yet.</p>
            ) : (
              <div className="p-4 space-y-2">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-accent shrink-0" />
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
      </div>
    </div>
  );
}
