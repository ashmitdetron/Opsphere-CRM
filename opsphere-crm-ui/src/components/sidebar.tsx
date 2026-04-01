'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  UserSearch,
  KanbanSquare,
  MessageSquare,
  GitBranch,
  CalendarDays,
  Mic2,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exclude?: string;
}

const nav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Leads', href: '/leads', icon: Users },
  { label: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { label: 'Prospects', href: '/prospects', icon: UserSearch, exclude: '/prospects/kanban' },
  { label: 'Kanban', href: '/prospects/kanban', icon: KanbanSquare },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Pipeline', href: '/pipeline', icon: GitBranch },
  { label: 'Appointments', href: '/appointments', icon: CalendarDays },
  { label: 'Brand Voices', href: '/brand-voices', icon: Mic2 },
];

const bottomNav: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exclude && (pathname === item.exclude || pathname.startsWith(item.exclude + '/'))) {
    return false;
  }
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, entity, logout } = useAuth();

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
          const active = isActive(pathname, item);
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
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-3 mt-3 border-t border-white/10">
          {bottomNav.map((item) => {
            const active = isActive(pathname, item);
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
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
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
