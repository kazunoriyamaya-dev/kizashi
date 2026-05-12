'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, GraduationCap, Calendar, MessageSquare, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/mypage', label: 'ホーム', Icon: Home, exact: true },
  { href: '/mypage/instructors', label: '講師', Icon: GraduationCap },
  { href: '/mypage/reservations', label: '予約', Icon: Calendar },
  { href: '/mypage/messages', label: 'メッセージ', Icon: MessageSquare },
  { href: '/mypage/profile', label: 'プロフィール', Icon: User },
] as const;

export function CustomerBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background pb-safe">
      <div className="mx-auto flex max-w-screen-md items-stretch justify-around">
        {NAV_ITEMS.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'fill-primary/10')} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
