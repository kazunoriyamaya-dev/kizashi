'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Sparkles,
  Image as ImageIcon,
  MessageCircle,
  MailPlus,
  ListChecks,
  PenSquare,
  Link as LinkIcon,
  BarChart3,
  Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin/marketing', label: 'ダッシュボード', Icon: LayoutDashboard, exact: true },
  { href: '/admin/marketing/campaigns', label: 'キャンペーン', Icon: Sparkles },
  { href: '/admin/marketing/assets', label: 'アセット', Icon: ImageIcon },
  { href: '/admin/marketing/sns', label: 'SNS', Icon: MessageCircle },
  { href: '/admin/marketing/line-broadcasts', label: 'LINE配信', Icon: MessageCircle },
  { href: '/admin/marketing/sequences', label: 'ステップメール', Icon: MailPlus },
  { href: '/admin/marketing/landing-pages', label: 'LP', Icon: ListChecks },
  { href: '/admin/marketing/blog', label: 'ブログ', Icon: PenSquare },
  { href: '/admin/marketing/affiliate', label: 'アフィリ', Icon: LinkIcon },
  { href: '/admin/marketing/ads', label: '広告', Icon: Megaphone },
  { href: '/admin/marketing/analytics', label: '分析', Icon: BarChart3 },
] as const;

export function MarketingSubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2">
      {NAV.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
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
