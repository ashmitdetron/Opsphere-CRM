import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  className?: string;
}

export default function StatCard({ label, value, sub, icon, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
        {icon && <div className="text-muted">{icon}</div>}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
