'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiUpload } from '@/lib/api';
import type { Campaign } from '@/lib/types';
import PageHeader from '@/components/page-header';
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

interface ImportResult {
  imported: number;
  skipped: number;
  total_rows: number;
}

export default function ProspectImportPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ campaigns: Campaign[] }>('/api/crm/campaigns')
      .then((data) => {
        setCampaigns(data.campaigns);
        if (data.campaigns.length === 1) setCampaignId(data.campaigns[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!campaignId) { setError('Please select a campaign'); return; }
    if (!file) { setError('Please select a CSV file'); return; }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaign_id', campaignId);

      const data = await apiUpload<ImportResult>('/api/crm/prospects/bulk-import', formData);
      setResult(data);
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Prospects
        </button>
        <PageHeader title="Import Prospects" description="Upload a CSV file to bulk-add prospects to a campaign" />
      </div>

      {/* CSV format guide */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> CSV Format
        </h3>
        <p className="text-xs text-muted mb-3">Your CSV must have a header row. Recognised column names:</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs font-mono">
          {[
            ['full_name', 'or first_name + last_name'],
            ['email', 'required if no name'],
            ['linkedin_url', 'https://linkedin.com/in/…'],
            ['company_name', 'or company'],
            ['company_website', 'or website'],
            ['job_title', 'or title'],
            ['industry', ''],
            ['location', ''],
            ['company_size', 'e.g. 50-200'],
          ].map(([col, hint]) => (
            <div key={col} className="contents">
              <span className="text-accent">{col}</span>
              <span className="text-muted">{hint}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Import complete</p>
              <p>{result.imported} imported · {result.skipped} skipped · {result.total_rows} total rows</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium mb-1.5">Campaign *</label>
          {loading ? (
            <div className="h-9 rounded-lg bg-gray-100 animate-pulse" />
          ) : (
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={inputCls} required>
              <option value="">Select a campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5">CSV File *</label>
          <div
            className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background px-6 py-8 text-center cursor-pointer hover:border-accent/50 transition-colors"
            onClick={() => document.getElementById('csv-file')?.click()}
          >
            <Upload className="h-8 w-8 text-muted mb-2" />
            {file ? (
              <div>
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">Click to upload or drag & drop</p>
                <p className="text-xs text-muted mt-0.5">CSV files only, max 10MB</p>
              </div>
            )}
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={importing || !file || !campaignId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Importing…' : 'Import Prospects'}
          </button>
          {result && (
            <button
              type="button"
              onClick={() => router.push('/prospects')}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-background"
            >
              View Prospects
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
