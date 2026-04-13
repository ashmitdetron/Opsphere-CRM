'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import PageHeader from '@/components/page-header';
import { Building2, User, Check, AlertCircle, KeyRound } from 'lucide-react';

const INTEGRATION_KEYS = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic (Claude AI)', desc: 'AI message generation' },
  { key: 'SERPER_API_KEY', label: 'Serper', desc: 'Google prospect discovery' },
  { key: 'APOLLO_API_KEY', label: 'Apollo.io', desc: 'B2B prospect database search' },
  { key: 'BING_SEARCH_KEY', label: 'Bing Search', desc: 'Bing prospect discovery' },
  { key: 'PROXYCURL_API_KEY', label: 'Proxycurl', desc: 'LinkedIn profile enrichment' },
  { key: 'HUNTER_API_KEY', label: 'Hunter.io', desc: 'Email finder & verification' },
  { key: 'CLEARBIT_API_KEY', label: 'Clearbit', desc: 'Company data enrichment' },
  { key: 'PHANTOMBUSTER_API_KEY', label: 'PhantomBuster', desc: 'LinkedIn outreach automation' },
];

export default function SettingsPage() {
  const { user, entity } = useAuth();

  // Org form
  const [orgForm, setOrgForm] = useState({ name: '', industry: '', website: '' });
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSuccess, setOrgSuccess] = useState(false);
  const [orgError, setOrgError] = useState('');

  // Integrations
  const [integrations, setIntegrations] = useState<Record<string, { set: boolean; preview: string }>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [intSaving, setIntSaving] = useState(false);
  const [intSuccess, setIntSuccess] = useState(false);
  const [intError, setIntError] = useState('');

  useEffect(() => {
    if (!entity) return;
    api<{ entity: { id: string; name: string; industry: string | null; website: string | null } }>(
      `/api/entities/${entity.id}`,
    )
      .then((data) => setOrgForm({
        name: data.entity.name,
        industry: data.entity.industry ?? '',
        website: data.entity.website ?? '',
      }))
      .catch(() => setOrgForm({ name: entity.name, industry: '', website: '' }));

    api<{ integrations: Record<string, { set: boolean; preview: string }> }>(
      `/api/entities/${entity.id}/integrations`,
    )
      .then((data) => setIntegrations(data.integrations))
      .catch(() => {});
  }, [entity]);

  async function handleOrgSave(e: React.FormEvent) {
    e.preventDefault();
    setOrgError('');
    setOrgSuccess(false);
    setOrgSaving(true);
    try {
      await api(`/api/entities/${entity?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: orgForm.name,
          industry: orgForm.industry || undefined,
          website: orgForm.website || undefined,
        }),
      });
      setOrgSuccess(true);
      setTimeout(() => setOrgSuccess(false), 3000);
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setOrgSaving(false);
    }
  }

  async function handleIntSave(e: React.FormEvent) {
    e.preventDefault();
    setIntError('');
    setIntSuccess(false);
    setIntSaving(true);
    try {
      await api(`/api/entities/${entity?.id}/integrations`, {
        method: 'PATCH',
        body: JSON.stringify(keyInputs),
      });
      // Refresh masked previews
      const data = await api<{ integrations: Record<string, { set: boolean; preview: string }> }>(
        `/api/entities/${entity?.id}/integrations`,
      );
      setIntegrations(data.integrations);
      setKeyInputs({});
      setIntSuccess(true);
      setTimeout(() => setIntSuccess(false), 3000);
    } catch (err) {
      setIntError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIntSaving(false);
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader title="Settings" description="Manage your organisation and account preferences" />

      {/* Organisation */}
      <section>
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted" /> Organisation
        </h2>
        <form onSubmit={handleOrgSave} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          {orgError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{orgError}
            </div>
          )}
          {orgSuccess && (
            <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">
              <Check className="h-4 w-4 mt-0.5 shrink-0" />Organisation updated successfully.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5">Organisation Name *</label>
            <input type="text" required value={orgForm.name}
              onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
              className={inputCls} placeholder="Acme Corp" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Industry</label>
            <input type="text" value={orgForm.industry}
              onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
              className={inputCls} placeholder="SaaS, Consulting, Agency…" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Website</label>
            <input type="url" value={orgForm.website}
              onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })}
              className={inputCls} placeholder="https://yourcompany.com" />
          </div>
          <div className="pt-2">
            <button type="submit" disabled={orgSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
              {orgSaving ? 'Saving…' : 'Save Organisation'}
            </button>
          </div>
        </form>
      </section>

      {/* Account info */}
      <section>
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-muted" /> Account
        </h2>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-medium text-muted mb-1">Email</p>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted mb-1">Display Name</p>
            <p className="text-sm">{user?.displayName || <span className="text-muted">Not set</span>}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted mb-1">Role</p>
            <p className="text-sm capitalize">{user?.role}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted mb-1">Organisation ID</p>
            <p className="text-xs font-mono text-muted">{entity?.id}</p>
          </div>
        </div>
      </section>

      {/* API Keys */}
      <section>
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted" /> API Keys
        </h2>
        <p className="text-xs text-muted mb-4">Keys are stored securely per organisation. Leave a field blank to keep the existing value.</p>
        <form onSubmit={handleIntSave} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          {intError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{intError}
            </div>
          )}
          {intSuccess && (
            <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">
              <Check className="h-4 w-4 mt-0.5 shrink-0" />API keys saved successfully.
            </div>
          )}
          {INTEGRATION_KEYS.map(({ key, label, desc }) => {
            const current = integrations[key];
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium">{label}</label>
                  <span className="text-[10px] text-muted">{desc}</span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={keyInputs[key] ?? ''}
                    onChange={(e) => setKeyInputs({ ...keyInputs, [key]: e.target.value })}
                    className={inputCls}
                    placeholder={current?.set ? `••••••••${current.preview.slice(-4)}` : 'Not configured'}
                    autoComplete="new-password"
                  />
                  {current?.set && !keyInputs[key] && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-green-600 font-medium">Saved</span>
                  )}
                </div>
              </div>
            );
          })}
          <div className="pt-2">
            <button type="submit" disabled={intSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
              {intSaving ? 'Saving…' : 'Save API Keys'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
