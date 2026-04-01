import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function stageColor(stage: string): string {
  const map: Record<string, string> = {
    found: 'bg-gray-100 text-gray-700',
    researched: 'bg-blue-100 text-blue-700',
    message_drafted: 'bg-yellow-100 text-yellow-700',
    message_approved: 'bg-indigo-100 text-indigo-700',
    message_sent: 'bg-purple-100 text-purple-700',
    replied: 'bg-green-100 text-green-700',
    meeting_booked: 'bg-emerald-100 text-emerald-700',
    converted: 'bg-teal-100 text-teal-800',
    rejected: 'bg-red-100 text-red-700',
  };
  return map[stage] || 'bg-gray-100 text-gray-600';
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
    archived: 'bg-gray-200 text-gray-500',
    approved: 'bg-indigo-100 text-indigo-700',
    rejected: 'bg-red-100 text-red-700',
    queued: 'bg-purple-100 text-purple-700',
    sent: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

export function stageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export function appointmentStatusColor(status: string): string {
  const map: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-600',
    no_show: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

export function appointmentStatusLabel(status: string): string {
  return status === 'no_show' ? 'No Show' : status.charAt(0).toUpperCase() + status.slice(1);
}
