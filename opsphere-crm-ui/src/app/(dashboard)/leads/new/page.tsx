'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import PageHeader from '@/components/page-header';

export default function NewLeadPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', source: '', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/api/crm/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          company: form.company || undefined,
          source: form.source || undefined,
          notes: form.notes || undefined,
        }),
      });
      router.push('/leads');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <PageHeader title="New Lead" />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}

        <div>
          <label className="block text-xs font-medium mb-1.5">Name *</label>
          <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Phone</label>
            <input type="text" value={form.phone} onChange={(e) => update('phone', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">Company</label>
            <input type="text" value={form.company} onChange={(e) => update('company', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Source</label>
            <input type="text" value={form.source} onChange={(e) => update('source', e.target.value)} placeholder="website, referral…" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5">Notes</label>
          <textarea rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
            {loading ? 'Creating…' : 'Create Lead'}
          </button>
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-background">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
