'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn, stageColor, stageLabel, statusColor } from '@/lib/utils';
import type { Prospect, Campaign, PipelineStage } from '@/lib/types';
import PageHeader from '@/components/page-header';
import { RefreshCw, Link2, Mail, ExternalLink, ArrowLeft } from 'lucide-react';

// ─── Stage Config ─────────────────────────────────────────────

const STAGES: PipelineStage[] = [
  'found',
  'researched',
  'message_drafted',
  'message_approved',
  'message_sent',
  'replied',
  'meeting_booked',
  'converted',
  'rejected',
];

const STAGE_COLUMN_COLORS: Record<PipelineStage, string> = {
  found:            'border-gray-200 bg-gray-50',
  researched:       'border-blue-200 bg-blue-50',
  message_drafted:  'border-yellow-200 bg-yellow-50',
  message_approved: 'border-indigo-200 bg-indigo-50',
  message_sent:     'border-purple-200 bg-purple-50',
  replied:          'border-green-200 bg-green-50',
  meeting_booked:   'border-emerald-200 bg-emerald-50',
  converted:        'border-teal-200 bg-teal-50',
  rejected:         'border-red-200 bg-red-50',
};

// ─── ProspectCard ─────────────────────────────────────────────

function ProspectCard({
  prospect,
  onDragStart,
}: {
  prospect: Prospect;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  const enrichmentBadge = {
    pending:     'bg-gray-100 text-gray-600',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed:   'bg-green-100 text-green-700',
    failed:      'bg-red-100 text-red-700',
    skipped:     'bg-gray-100 text-gray-400',
  }[prospect.enrichment_status] ?? 'bg-gray-100 text-gray-600';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, prospect.id)}
      className="bg-white rounded-lg border border-border shadow-xs p-3 cursor-grab active:cursor-grabbing select-none hover:shadow-sm transition-shadow group"
    >
      {/* Name + link */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <Link
          href={`/prospects/${prospect.id}`}
          className="text-sm font-medium leading-tight hover:text-accent transition-colors line-clamp-2"
          onClick={(e) => e.stopPropagation()}
        >
          {prospect.full_name || '(unnamed)'}
        </Link>
        <Link
          href={`/prospects/${prospect.id}`}
          className="opacity-0 group-hover:opacity-100 shrink-0 text-muted hover:text-accent transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Title + company */}
      {(prospect.job_title || prospect.company_name) && (
        <p className="text-xs text-muted leading-tight mb-2 line-clamp-2">
          {[prospect.job_title, prospect.company_name].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap gap-1 mt-1.5">
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', enrichmentBadge)}>
          {prospect.enrichment_status}
        </span>
        {prospect.source && (
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', statusColor(prospect.source) )}>
            {prospect.source}
          </span>
        )}
      </div>

      {/* Links row */}
      {(prospect.linkedin_url || prospect.email) && (
        <div className="flex gap-2 mt-2">
          {prospect.linkedin_url && (
            <a
              href={prospect.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="text-muted hover:text-blue-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Link2 className="h-3.5 w-3.5" />
            </a>
          )}
          {prospect.email && (
            <a
              href={`mailto:${prospect.email}`}
              className="text-muted hover:text-accent transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────

function KanbanColumn({
  stage,
  cards,
  onDragOver,
  onDrop,
}: {
  stage: PipelineStage;
  cards: Prospect[];
  onDragOver: (e: React.DragEvent, stage: PipelineStage) => void;
  onDrop: (e: React.DragEvent, stage: PipelineStage) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }
  function handleDragLeave() {
    setIsDragOver(false);
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    onDragOver(e, stage);
  }
  function handleDrop(e: React.DragEvent) {
    setIsDragOver(false);
    onDrop(e, stage);
  }

  // Ref for parent draggable card
  const onDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('prospectId', id);
    e.dataTransfer.setData('fromStage', stage);
    e.dataTransfer.effectAllowed = 'move';
  }, [stage]);

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border-2 min-h-[200px] transition-colors duration-150',
        STAGE_COLUMN_COLORS[stage],
        isDragOver && 'ring-2 ring-accent ring-offset-1',
      )}
      style={{ width: '220px', flexShrink: 0 }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-inherit">
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', stageColor(stage))}>
          {stageLabel(stage)}
        </span>
        <span className="text-xs text-muted font-medium">{cards.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {cards.map((p) => (
          <ProspectCard key={p.id} prospect={p} onDragStart={onDragStart} />
        ))}
        {cards.length === 0 && (
          <p className="text-xs text-muted text-center pt-6 italic">No prospects</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function KanbanPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<string | null>(null);
  const dragOver = useRef<PipelineStage | null>(null);

  // Load campaigns on mount
  useEffect(() => {
    api<{ campaigns: Campaign[] }>('/api/crm/campaigns', { params: { limit: '100' } })
      .then((d) => setCampaigns(d.campaigns))
      .catch(() => {});
  }, []);

  // Load prospects when campaign changes
  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { limit: '200', offset: '0' };
    if (selectedCampaign) params.campaign_id = selectedCampaign;

    api<{ prospects: Prospect[] }>('/api/crm/prospects', { params })
      .then((d) => setProspects(d.prospects))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedCampaign]);

  // Group by stage
  const byStage = Object.fromEntries(
    STAGES.map((s) => [s, prospects.filter((p) => p.pipeline_stage === s)]),
  ) as Record<PipelineStage, Prospect[]>;

  function handleDragOver(e: React.DragEvent, stage: PipelineStage) {
    e.preventDefault();
    dragOver.current = stage;
  }

  async function handleDrop(e: React.DragEvent, toStage: PipelineStage) {
    e.preventDefault();
    const prospectId = e.dataTransfer.getData('prospectId');
    const fromStage = e.dataTransfer.getData('fromStage') as PipelineStage;

    if (!prospectId || fromStage === toStage) return;

    setMoving(prospectId);

    // Optimistic update
    setProspects((prev) =>
      prev.map((p) => (p.id === prospectId ? { ...p, pipeline_stage: toStage } : p)),
    );

    try {
      await api(`/api/crm/prospects/${prospectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ pipeline_stage: toStage }),
      });
    } catch {
      // Revert on failure
      setProspects((prev) =>
        prev.map((p) => (p.id === prospectId ? { ...p, pipeline_stage: fromStage } : p)),
      );
    } finally {
      setMoving(null);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/prospects"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            List
          </Link>
          <PageHeader
            title="Pipeline Kanban"
            description="Drag prospects between stages to update their status"
          />
        </div>

        <div className="flex items-center gap-3">
          {loading && <RefreshCw className="h-4 w-4 text-muted animate-spin" />}

          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Board — horizontal scroll */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-3 h-full" style={{ minWidth: 'max-content' }}>
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              cards={byStage[stage]}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>

      {/* Total indicator */}
      <p className="shrink-0 pt-1 text-xs text-muted text-right">
        {prospects.length} prospect{prospects.length !== 1 ? 's' : ''} loaded
        {moving && ' · updating…'}
      </p>
    </div>
  );
}
