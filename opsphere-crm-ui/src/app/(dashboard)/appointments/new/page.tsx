'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Prospect, Campaign } from '@/lib/types';
import PageHeader from '@/components/page-header';

export default function NewAppointmentPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    prospect_id: '',
    campaign_id: '',
    title: '',
    scheduled_at: '',
    duration_minutes: '30',
    location: '',
    notes: '',
  });

  useEffect(() => {
    Promise.all([
      api<{ prospects: Prospect[]; total: number }>('/api/crm/prospects', { params: { limit: 200 } }),
      api<{ campaigns: Campaign[] }>('/api/crm/campaigns'),
    ])
      .then(([pData, cData]) => {
        setProspects(pData.prospects);
        setCampaigns(cData.campaigns);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-fill campaign when prospect changes
  function handleProspectChange(prospectId: string) {
    setForm((prev) => {
      const prospect = prospects.find((p) => p.id === prospectId);
      return {
        ...prev,
        prospect_id: prospectId,
        campaign_id: prospect?.campaign_id ?? prev.campaign_id,
      };
    });
  }

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.prospect_id) { setError('Please select a prospect'); return; }
    if (!form.campaign_id) { setError('Please select a campaign'); return; }
    if (!form.scheduled_at) { setError('Please set the date and time'); return; }

    setSaving(true);
    try {
      await api('/api/crm/appointments', {
        method: 'POST',
        body: JSON.stringify({
          prospect_id: form.prospect_id,
          campaign_id: form.campaign_id,
          title: form.title,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
          duration_minutes: parseInt(form.duration_minutes) || 30,
          location: form.location || undefined,
          notes: form.notes || undefined,
        }),
      });
      router.push('/appointments');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create appointment');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

  return (
    <div className="max-w-lg space-y-6">
      <PageHeader title="New Appointment" description="Book a meeting with a prospect" />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5">Prospect *</label>
            <select value={form.prospect_id} onChange={(e) => handleProspectChange(e.target.value)} className={inputCls} required>
              <option value="">Select a prospect…</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || 'Unknown'}{p.company_name ? ` · ${p.company_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Campaign *</label>
            <select value={form.campaign_id} onChange={(e) => update('campaign_id', e.target.value)} className={inputCls} required>
              <option value="">Select a campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Meeting Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              className={inputCls}
              placeholder="Discovery Call · Demo · Follow-up"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={form.scheduled_at}
                onChange={(e) => update('scheduled_at', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Duration</label>
              <select value={form.duration_minutes} onChange={(e) => update('duration_minutes', e.target.value)} className={inputCls}>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">2 hours</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Location / Link</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              className={inputCls}
              placeholder="Zoom link, Google Meet, or office address…"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              className={inputCls + ' resize-none'}
              placeholder="Agenda, context, talking points…"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Booking…' : 'Book Appointment'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-background"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
