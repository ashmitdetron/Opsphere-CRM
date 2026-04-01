'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { OutreachMessage } from '@/lib/types';
import PageHeader from '@/components/page-header';
import Badge from '@/components/badge';
import EmptyState from '@/components/empty-state';
import { statusColor, formatDateTime, truncate } from '@/lib/utils';
import { MessageSquare, Check, X, Send, Edit3 } from 'lucide-react';

export default function MessagesPage() {
  const [tab, setTab] = useState<'queue' | 'all'>('queue');
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'queue') {
        const data = await api<{ messages: OutreachMessage[]; total: number }>('/api/crm/messages/review-queue');
        setMessages(data.messages);
        setTotal(data.total);
      } else {
        const data = await api<{ messages: OutreachMessage[]; total: number }>('/api/crm/messages');
        setMessages(data.messages);
        setTotal(data.total);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      await api(`/api/crm/messages/${id}/approve`, { method: 'POST' });
      fetchMessages();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    setActionLoading(id);
    try {
      await api(`/api/crm/messages/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: rejectReason }) });
      setRejectId(null);
      setRejectReason('');
      fetchMessages();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function handleSend(id: string) {
    setActionLoading(id);
    try {
      await api(`/api/crm/messages/${id}/send`, { method: 'POST' });
      fetchMessages();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function handleSaveEdit(id: string) {
    setActionLoading(id);
    try {
      await api(`/api/crm/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ body: editBody }) });
      setEditingId(null);
      setEditBody('');
      fetchMessages();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description={`${total} messages`} />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(['queue', 'all'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === t ? 'bg-white shadow-sm text-foreground' : 'text-muted hover:text-foreground'}`}>
            {t === 'queue' ? 'Review Queue' : 'All Messages'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>
      ) : messages.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-10 w-10" />} title={tab === 'queue' ? 'Review queue is empty' : 'No messages yet'} description="Generate messages from the Prospects page." />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{m.prospect_name || 'Unknown'}</span>
                    {m.prospect_company && <span className="text-xs text-muted">at {m.prospect_company}</span>}
                    <Badge className={statusColor(m.status)}>{m.status}</Badge>
                    <span className="text-[10px] text-muted uppercase">{m.channel}</span>
                  </div>

                  {editingId === m.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea rows={4} value={editBody} onChange={(e) => setEditBody(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(m.id)} disabled={actionLoading === m.id} className="rounded bg-accent px-3 py-1 text-xs font-medium text-white">Save</button>
                        <button onClick={() => setEditingId(null)} className="rounded bg-gray-200 px-3 py-1 text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap mt-1">{m.body}</p>
                  )}

                  {rejectId === m.id && (
                    <div className="mt-3 flex gap-2">
                      <input type="text" placeholder="Rejection reason…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-red-400" />
                      <button onClick={() => handleReject(m.id)} disabled={!rejectReason.trim()} className="rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Reject</button>
                      <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="rounded bg-gray-200 px-3 py-1.5 text-xs">Cancel</button>
                    </div>
                  )}

                  {m.ai_model && <p className="mt-2 text-[10px] text-muted">AI: {m.ai_model} v{m.ai_prompt_version}</p>}
                  {m.sent_at && <p className="text-[10px] text-muted">Sent {formatDateTime(m.sent_at)}</p>}
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  {m.status === 'draft' && (
                    <>
                      <button onClick={() => { setEditingId(m.id); setEditBody(m.body); }} className="rounded p-1.5 text-muted hover:bg-gray-100 hover:text-foreground" title="Edit"><Edit3 className="h-4 w-4" /></button>
                      <button onClick={() => handleApprove(m.id)} disabled={actionLoading === m.id} className="rounded p-1.5 text-green-600 hover:bg-green-50" title="Approve"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setRejectId(m.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Reject"><X className="h-4 w-4" /></button>
                    </>
                  )}
                  {m.status === 'approved' && (
                    <button onClick={() => handleSend(m.id)} disabled={actionLoading === m.id} className="inline-flex items-center gap-1 rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                      <Send className="h-3 w-3" /> {actionLoading === m.id ? '…' : 'Send'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
