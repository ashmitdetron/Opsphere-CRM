'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { BrandVoice } from '@/lib/types';
import PageHeader from '@/components/page-header';
import Badge from '@/components/badge';
import EmptyState from '@/components/empty-state';
import { Mic2, Plus, Pencil, Trash2, Star, X, Check } from 'lucide-react';

const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

const EMPTY_FORM = {
  name: '',
  industry: '',
  value_proposition: '',
  tone: 'professional',
  avoid_phrases: '',
  example_messages: '',
  is_default: false,
};

function toArray(s: string): string[] | undefined {
  const arr = s.split('\n').map((x) => x.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}

function fromArray(arr: string[] | null | undefined): string {
  return arr ? arr.join('\n') : '';
}

export default function BrandVoicesPage() {
  const [voices, setVoices] = useState<BrandVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchVoices = useCallback(async () => {
    try {
      const data = await api<{ brand_voices: BrandVoice[] }>('/api/crm/brand-voices');
      setVoices(data.brand_voices);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchVoices(); }, [fetchVoices]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError('');
  }

  function openEdit(v: BrandVoice) {
    setForm({
      name: v.name,
      industry: v.industry ?? '',
      value_proposition: v.value_proposition ?? '',
      tone: v.tone,
      avoid_phrases: fromArray(v.avoid_phrases),
      example_messages: fromArray(v.example_messages),
      is_default: v.is_default,
    });
    setEditingId(v.id);
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        industry: form.industry || undefined,
        value_proposition: form.value_proposition || undefined,
        tone: form.tone,
        avoid_phrases: toArray(form.avoid_phrases),
        example_messages: toArray(form.example_messages),
        is_default: form.is_default,
      };
      if (editingId) {
        await api(`/api/crm/brand-voices/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await api('/api/crm/brand-voices', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeForm();
      fetchVoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api(`/api/crm/brand-voices/${id}`, { method: 'DELETE' });
      fetchVoices();
    } catch { /* ignore */ }
    setDeletingId(null);
  }

  const toneOptions = ['professional', 'friendly', 'casual', 'formal', 'direct', 'empathetic', 'bold'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand Voices"
        description="Define messaging tone and style for AI message generation"
        actions={
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition">
            <Plus className="h-4 w-4" /> New Brand Voice
          </button>
        }
      />

      {/* Create / Edit Form */}
      {showForm && (
        <div className="rounded-xl border border-accent/30 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold">{editingId ? 'Edit Brand Voice' : 'New Brand Voice'}</h2>
            <button onClick={closeForm} className="text-muted hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>

          {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Default Voice" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Industry</label>
              <input type="text" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={inputCls} placeholder="SaaS, Fintech…" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5">Value Proposition</label>
              <textarea rows={2} value={form.value_proposition} onChange={(e) => setForm({ ...form, value_proposition: e.target.value })} className={inputCls + ' resize-none'} placeholder="We help companies automate their outbound sales…" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Tone</label>
              <select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} className={inputCls}>
                {toneOptions.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="is_default"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-accent"
              />
              <label htmlFor="is_default" className="text-sm font-medium cursor-pointer">Set as default voice</label>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Phrases to Avoid <span className="text-muted">(one per line)</span></label>
              <textarea rows={3} value={form.avoid_phrases} onChange={(e) => setForm({ ...form, avoid_phrases: e.target.value })} className={inputCls + ' resize-none'} placeholder="I wanted to reach out&#10;Just checking in&#10;Touch base" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Example Messages <span className="text-muted">(one per line)</span></label>
              <textarea rows={3} value={form.example_messages} onChange={(e) => setForm({ ...form, example_messages: e.target.value })} className={inputCls + ' resize-none'} placeholder="Hi [Name], noticed you're scaling your sales team…" />
            </div>
          </div>

          <div className="flex gap-3 mt-5 pt-4 border-t border-border">
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
              <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={closeForm} className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-background">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>
      ) : voices.length === 0 ? (
        <EmptyState
          icon={<Mic2 className="h-10 w-10" />}
          title="No brand voices yet"
          description="Create a brand voice to guide AI message generation tone and style."
          action={
            <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> New Brand Voice
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {voices.map((v) => (
            <div key={v.id} className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-accent/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm truncate">{v.name}</h3>
                    {v.is_default && (
                      <Badge className="bg-accent/10 text-accent">
                        <Star className="h-2.5 w-2.5 mr-1" />Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <Badge className="bg-indigo-50 text-indigo-700">{v.tone}</Badge>
                    {v.industry && <Badge className="bg-gray-100 text-gray-600">{v.industry}</Badge>}
                  </div>
                  {v.value_proposition && (
                    <p className="text-xs text-muted line-clamp-2">{v.value_proposition}</p>
                  )}
                  {v.avoid_phrases && v.avoid_phrases.length > 0 && (
                    <p className="text-[10px] text-muted mt-2">{v.avoid_phrases.length} phrase(s) to avoid</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(v)} className="rounded p-1.5 text-muted hover:bg-gray-100 hover:text-foreground" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(v.id)} disabled={deletingId === v.id} className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-500 disabled:opacity-50" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
