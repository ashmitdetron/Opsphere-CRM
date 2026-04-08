'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Lead, Campaign } from '@/lib/types';
import PageHeader from '@/components/page-header';
import EmptyState from '@/components/empty-state';
import { formatDate } from '@/lib/utils';
import { Users, Plus, Search, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});
  const [convertId, setConvertId] = useState<string | null>(null);
  const [convertCampaign, setConvertCampaign] = useState('');
  const [convertLoading, setConvertLoading] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const [lData, cData] = await Promise.all([
        api<{ leads: Lead[]; total: number }>('/api/crm/leads', {
          params: { search: search || undefined, limit: 50 },
        }),
        api<{ campaigns: Campaign[] }>('/api/crm/campaigns'),
      ]);
      setLeads(lData.leads);
      setTotal(lData.total);
      setCampaigns(cData.campaigns);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function handleSaveEdit() {
    if (!editId) return;
    try {
      await api(`/api/crm/leads/${editId}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditId(null);
      setEditForm({});
      fetchLeads();
    } catch { /* ignore */ }
  }

  async function handleConvert() {
    if (!convertId || !convertCampaign) return;
    setConvertLoading(true);
    try {
      await api(`/api/crm/leads/${convertId}/convert`, {
        method: 'POST',
        body: JSON.stringify({ campaign_id: convertCampaign, source: 'manual' }),
      });
      setConvertId(null);
      setConvertCampaign('');
      fetchLeads();
    } catch { /* ignore */ }
    setConvertLoading(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description={`${total} total leads`}
        actions={
          <Link href="/leads/new" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition">
            <Plus className="h-4 w-4" /> New Lead
          </Link>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="text"
          placeholder="Search leads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No leads yet"
          description="Create your first lead to get started."
          action={
            <Link href="/leads/new" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> New Lead
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium w-36"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <React.Fragment key={lead.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-background/50 transition-colors">
                    {editId === lead.id ? (
                      <>
                        <td className="px-5 py-2">
                          <input value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full rounded border border-border px-2 py-1 text-sm" />
                        </td>
                        <td className="px-5 py-2">
                          <input value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full rounded border border-border px-2 py-1 text-sm" />
                        </td>
                        <td className="px-5 py-2">
                          <input value={editForm.company || ''} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} className="w-full rounded border border-border px-2 py-1 text-sm" />
                        </td>
                        <td colSpan={2} />
                        <td className="px-5 py-2 flex gap-1">
                          <button onClick={handleSaveEdit} className="rounded bg-accent px-2 py-1 text-xs text-white">Save</button>
                          <button onClick={() => setEditId(null)} className="rounded bg-gray-200 px-2 py-1 text-xs"><X className="h-3 w-3" /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3 font-medium">{lead.name}</td>
                        <td className="px-5 py-3 text-muted">{lead.email || '—'}</td>
                        <td className="px-5 py-3">{lead.company || '—'}</td>
                        <td className="px-5 py-3 text-muted">{lead.source || '—'}</td>
                        <td className="px-5 py-3 text-muted tabular-nums">{formatDate(lead.created_at)}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => { setEditId(lead.id); setEditForm({ name: lead.name, email: lead.email ?? '', company: lead.company ?? '' }); }}
                              className="text-xs text-muted hover:text-foreground hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setConvertId(lead.id); setConvertCampaign(''); }}
                              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                            >
                              <ArrowRight className="h-3 w-3" /> Convert
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>

                  {/* Convert inline panel */}
                  {convertId === lead.id && (
                    <tr key={`${lead.id}-convert`} className="bg-accent/5 border-b border-border">
                      <td colSpan={6} className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-accent">Convert to Prospect</span>
                          <select
                            value={convertCampaign}
                            onChange={(e) => setConvertCampaign(e.target.value)}
                            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
                          >
                            <option value="">Select campaign…</option>
                            {campaigns.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={handleConvert}
                            disabled={!convertCampaign || convertLoading}
                            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {convertLoading ? 'Converting…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setConvertId(null)}
                            className="rounded bg-gray-200 px-3 py-1.5 text-xs text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
