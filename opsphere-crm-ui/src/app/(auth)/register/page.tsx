'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Zap } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', displayName: '', organisationName: '', industry: '' });
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
      await register({
        email: form.email,
        password: form.password,
        displayName: form.displayName || undefined,
        organisationName: form.organisationName,
        industry: form.industry || undefined,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Zap className="h-8 w-8 text-accent" />
          <span className="text-2xl font-bold tracking-tight">OPSphere</span>
          <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-semibold uppercase text-accent">CRM</span>
        </div>
        <p className="text-sm text-muted">Create your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label htmlFor="orgName" className="block text-xs font-medium text-foreground mb-1.5">Organisation name</label>
          <input id="orgName" type="text" required value={form.organisationName} onChange={(e) => update('organisationName', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Acme Corp" />
        </div>

        <div>
          <label htmlFor="industry" className="block text-xs font-medium text-foreground mb-1.5">Industry <span className="text-muted">(optional)</span></label>
          <input id="industry" type="text" value={form.industry} onChange={(e) => update('industry', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="SaaS, Fintech…" />
        </div>

        <div>
          <label htmlFor="displayName" className="block text-xs font-medium text-foreground mb-1.5">Your name <span className="text-muted">(optional)</span></label>
          <input id="displayName" type="text" value={form.displayName} onChange={(e) => update('displayName', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Jane Smith" />
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-medium text-foreground mb-1.5">Email</label>
          <input id="email" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="you@company.com" />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-foreground mb-1.5">Password</label>
          <input id="password" type="password" required minLength={8} value={form.password} onChange={(e) => update('password', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Min 8 characters" />
        </div>

        <button type="submit" disabled={loading} className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50">
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
