'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Appointment, Campaign } from '@/lib/types';
import PageHeader from '@/components/page-header';
import Badge from '@/components/badge';
import EmptyState from '@/components/empty-state';
import { appointmentStatusColor, appointmentStatusLabel, formatDateTime } from '@/lib/utils';
import { CalendarDays, Plus, CheckCircle2, XCircle, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [aData, cData] = await Promise.all([
        api<{ appointments: Appointment[]; total: number }>('/api/crm/appointments', {
          params: {
            status: filterStatus || undefined,
            campaign_id: filterCampaign || undefined,
            limit: 50,
          },
        }),
        api<{ campaigns: Campaign[] }>('/api/crm/campaigns'),
      ]);
      setAppointments(aData.appointments);
      setTotal(aData.total);
      setCampaigns(cData.campaigns);
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterStatus, filterCampaign]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function updateStatus(id: string, status: Appointment['status']) {
    setActionLoading(id);
    try {
      await api(`/api/crm/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      fetchData();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  const selectCls = 'rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent';

  const upcomingCount = appointments.filter((a) => a.status === 'scheduled').length;
  const completedCount = appointments.filter((a) => a.status === 'completed').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description={`${total} total · ${upcomingCount} upcoming · ${completedCount} completed`}
        actions={
          <Link
            href="/appointments/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" /> New Appointment
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
        <select value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)} className={selectCls}>
          <option value="">All campaigns</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          title="No appointments yet"
          description="Book a meeting when a prospect is ready to talk."
          action={
            <Link href="/appointments/new" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> New Appointment
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-4">
                {/* Date block */}
                <div className="shrink-0 w-14 text-center rounded-lg border border-border bg-background py-2">
                  <p className="text-xs text-muted uppercase font-medium">
                    {new Date(a.scheduled_at).toLocaleDateString('en-AU', { month: 'short' })}
                  </p>
                  <p className="text-2xl font-bold leading-tight">
                    {new Date(a.scheduled_at).getDate()}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{a.title}</span>
                    <Badge className={appointmentStatusColor(a.status)}>{appointmentStatusLabel(a.status)}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    {a.prospect_name && (
                      <span className="font-medium text-foreground/80">
                        {a.prospect_name}
                        {a.prospect_company && ` · ${a.prospect_company}`}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(a.scheduled_at)} · {a.duration_minutes} min
                    </span>
                    {a.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {a.location}
                      </span>
                    )}
                    {a.campaign_name && <span>Campaign: {a.campaign_name}</span>}
                  </div>

                  {a.notes && <p className="mt-2 text-xs text-muted line-clamp-2">{a.notes}</p>}
                </div>

                {/* Status actions */}
                {a.status === 'scheduled' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => updateStatus(a.id, 'completed')}
                      disabled={actionLoading === a.id}
                      className="inline-flex items-center gap-1 rounded bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                      title="Mark complete"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Complete
                    </button>
                    <button
                      onClick={() => updateStatus(a.id, 'no_show')}
                      disabled={actionLoading === a.id}
                      className="inline-flex items-center gap-1 rounded bg-yellow-50 px-2.5 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
                      title="No show"
                    >
                      No Show
                    </button>
                    <button
                      onClick={() => updateStatus(a.id, 'cancelled')}
                      disabled={actionLoading === a.id}
                      className="inline-flex items-center gap-1 rounded bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                      title="Cancel"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
