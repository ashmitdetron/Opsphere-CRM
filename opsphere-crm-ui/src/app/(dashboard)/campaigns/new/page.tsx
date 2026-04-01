'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { BrandVoice } from '@/lib/types';
import PageHeader from '@/components/page-header';

export default function NewCampaignPage() {
  const router = useRouter();
  const [brandVoices, setBrandVoices] = useState<BrandVoice[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    brand_voice_id: '',
    icp_industries: '',
    icp_seniority: '',
    icp_company_size: '',
    icp_locations: '',
    icp_keywords: '',
    daily_send_limit: '20',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ brand_voices: BrandVoice[] }>('/api/crm/brand-voices')
      .then((data) => {
        setBrandVoices(data.brand_voices);
        // Auto-select default if present
        const def = data.brand_voices.find((v) => v.is_default);
        if (def) setForm((prev) => ({ ...prev, brand_voice_id: def.id }));
      })
      .catch(() => {});
  }, []);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toArray(csv: string): string[] | undefined {
    const arr = csv.split(',').map((s) => s.trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/api/crm/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          brand_voice_id: form.brand_voice_id || undefined,
          icp_industries: toArray(form.icp_industries),
          icp_seniority: toArray(form.icp_seniority),
          icp_company_size: form.icp_company_size || undefined,
          icp_locations: toArray(form.icp_locations),
          icp_keywords: toArray(form.icp_keywords),
          daily_send_limit: parseInt(form.daily_send_limit) || 20,
        }),
      });
      router.push('/campaigns');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

  return (
    <div className="max-w-lg space-y-6">
      <PageHeader title="New Campaign" description="Define your ICP and outreach criteria" />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}

        <div>
          <label className="block text-xs font-medium mb-1.5">Campaign name *</label>
          <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)} className={inputCls} placeholder="Q2 SaaS Outreach" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5">Description</label>
          <textarea rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} className={inputCls + ' resize-none'} placeholder="Target mid-market SaaS companies…" />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5">
            Brand Voice
            {brandVoices.length === 0 && (
              <span className="ml-2 text-muted font-normal">— <a href="/brand-voices" className="text-accent underline">Create one first</a></span>
            )}
          </label>
          <select value={form.brand_voice_id} onChange={(e) => update('brand_voice_id', e.target.value)} className={inputCls}>
            <option value="">None (use default AI tone)</option>
            {brandVoices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{v.is_default ? ' (default)' : ''} · {v.tone}
              </option>
            ))}
          </select>
        </div>

        <hr className="border-border" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">ICP Definition</p>

        <div>
          <label className="block text-xs font-medium mb-1.5">Industries <span className="text-muted">(comma separated)</span></label>
          <input type="text" value={form.icp_industries} onChange={(e) => update('icp_industries', e.target.value)} className={inputCls} placeholder="SaaS, Fintech, Healthcare" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5">Seniority levels <span className="text-muted">(comma separated)</span></label>
          <input type="text" value={form.icp_seniority} onChange={(e) => update('icp_seniority', e.target.value)} className={inputCls} placeholder="VP, Director, Head of" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">Company size</label>
            <input type="text" value={form.icp_company_size} onChange={(e) => update('icp_company_size', e.target.value)} className={inputCls} placeholder="50-200" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Daily send limit</label>
            <input type="number" min={1} value={form.daily_send_limit} onChange={(e) => update('daily_send_limit', e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5">Locations <span className="text-muted">(comma separated)</span></label>
          <input type="text" value={form.icp_locations} onChange={(e) => update('icp_locations', e.target.value)} className={inputCls} placeholder="Sydney, Melbourne, Singapore" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5">Keywords <span className="text-muted">(comma separated)</span></label>
          <input type="text" value={form.icp_keywords} onChange={(e) => update('icp_keywords', e.target.value)} className={inputCls} placeholder="growth, automation, outbound" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
            {loading ? 'Creating…' : 'Create Campaign'}
          </button>
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-background">Cancel</button>
        </div>
      </form>
    </div>
  );
}
