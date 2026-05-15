'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Users,
  GraduationCap,
  Ticket,
  MessageSquare,
  ScrollText,
  Banknote,
  Settings,
  Sparkles,
  Megaphone,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', label: 'ダッシュボード', Icon: LayoutDashboard, exact: true },
  { href: '/admin/reservations', label: '予約管理', Icon: Calendar },
  { href: '/admin/trial-reviews', label: '体験確認', Icon: Sparkles },
  { href: '/admin/customers', label: '顧客管理', Icon: Users },
  { href: '/admin/instructors', label: '講師管理', Icon: GraduationCap },
  { href: '/admin/tickets', label: 'チケット管理', Icon: Ticket },
  { href: '/admin/messages', label: 'メッセージ', Icon: MessageSquare },
  { href: '/admin/marketing', label: 'マーケティング', Icon: Megaphone },
  { href: '/admin/policies/cancel', label: 'ポリシー設定', Icon: ScrollText },
  { href: '/admin/payouts', label: '精算管理', Icon: Banknote },
  { href: '/admin/settings', label: 'システム設定', Icon: Settings },
] as const;

export function AdminSidebarNav() {
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
