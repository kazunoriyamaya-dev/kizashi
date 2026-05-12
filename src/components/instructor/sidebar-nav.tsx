'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Calendar, User, CalendarCheck, MessageSquare, Banknote } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/instructor', label: '予約一覧', Icon: Calendar, exact: true },
  { href: '/instructor/profile', label: 'プロフィール', Icon: User },
  { href: '/instructor/calendar', label: 'Calendar連携', Icon: CalendarCheck },
  { href: '/instructor/messages', label: 'メッセージ', Icon: MessageSquare },
  { href: '/instructor/payouts', label: '精算', Icon: Banknote },
] as const;

export function InstructorSidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
