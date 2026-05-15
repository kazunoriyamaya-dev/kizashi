/**
 * /admin/marketing 共通レイアウト
 *
 * 上位の (admin) layout で requireRole('admin') 済みなのでここでは UI のみ。
 * サブナビゲーションを表示する。
 */
import Link from 'next/link';
import { Sparkles, Image as ImageIcon, MessageCircle, MailPlus, ListChecks, FileText, PenSquare, Link as LinkIcon, BarChart3, Megaphone, LayoutDashboard } from 'lucide-react';
import { MarketingSubnav } from '@/components/admin/marketing/subnav';

export const MARKETING_NAV = [
  { href: '/admin/marketing', label: 'ダッシュボード', exact: true, Icon: LayoutDashboard },
  { href: '/admin/marketing/campaigns', label: 'キャンペーン', Icon: Sparkles },
  { href: '/admin/marketing/assets', label: 'アセット', Icon: ImageIcon },
  { href: '/admin/marketing/sns', label: 'SNS投稿', Icon: MessageCircle },
  { href: '/admin/marketing/line-broadcasts', label: 'LINE配信', Icon: MessageCircle },
  { href: '/admin/marketing/sequences', label: 'ステップメール', Icon: MailPlus },
  { href: '/admin/marketing/landing-pages', label: 'LP', Icon: ListChecks },
  { href: '/admin/marketing/blog', label: 'ブログCMS', Icon: PenSquare },
  { href: '/admin/marketing/affiliate', label: 'アフィリエイト', Icon: LinkIcon },
  { href: '/admin/marketing/ads', label: '広告', Icon: Megaphone },
  { href: '/admin/marketing/analytics', label: '分析', Icon: BarChart3 },
] as const;

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">マーケティング自動化</h2>
        <Link
          href="/admin"
          className="ml-auto text-xs text-muted-foreground hover:underline"
        >
          ← Kizashi 管理に戻る
        </Link>
      </div>
      <MarketingSubnav />
      <div>{children}</div>
    </div>
  );
}
