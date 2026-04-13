'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Megaphone,
  KanbanSquare,
  MessageSquare,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const nav = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { label: 'Kanban', href: '/prospects/kanban', icon: KanbanSquare },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Settings', href: '/settings', icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, entity, logout } = useAuth();
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    async function fetchDrafts() {
      try {
        const data = await api<{ total: number }>('/api/crm/messages?status=draft&limit=1');
        setDraftCount(data.total);
      } catch {
        // fail silently — badge just won't show
      }
    }

    fetchDrafts();
    const interval = setInterval(fetchDrafts, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-5 border-b border-white/10">
        <Zap className="h-6 w-6 text-accent" />
        <span className="text-lg font-bold tracking-tight">OPSphere</span>
        <span className="ml-1 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">CRM</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          const showBadge = item.label === 'Messages' && draftCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground',
              )}
            >
              <span className="relative shrink-0">
                <item.icon className="h-4 w-4" />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                    {draftCount > 99 ? '99' : draftCount}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-4">
        <div className="mb-3">
          <p className="text-xs font-medium truncate">{user?.email}</p>
          <p className="text-[11px] text-sidebar-foreground/50 truncate">{entity?.name}</p>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/60 hover:bg-white/10 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
