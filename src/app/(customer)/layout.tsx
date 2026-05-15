/**
 * 顧客画面共通レイアウト
 *
 * Phase 5: スマホファースト + 下部固定ナビ
 *  - max-w-screen-md でモバイル最適
 *  - 下部に5タブナビ
 *  - 上部はシンプルなヘッダー（タイトル + 設定アイコン）
 */
import { requireRole } from '@/lib/auth';
import { SignOutButton } from '@/components/layout/sign-out-button';
import { CustomerBottomNav } from '@/components/customer/bottom-nav';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('customer');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-screen-md items-center justify-between px-4">
          <span className="font-semibold">Kizashi</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden text-muted-foreground sm:inline">{user.displayName}</span>
            <SignOutButton role="customer" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-screen-md px-4 pb-4 pt-4">{children}</main>
      <div className="mx-auto max-w-screen-md px-4 pb-28 pt-2 text-center text-xs text-muted-foreground">
        <a href="/contact" className="hover:underline">
          お問い合わせ
        </a>
        <span className="mx-2">·</span>
        <a href="/legal/terms" className="hover:underline">
          利用規約
        </a>
        <span className="mx-2">·</span>
        <a href="/legal/privacy" className="hover:underline">
          プライバシーポリシー
        </a>
        <span className="mx-2">·</span>
        <a href="/legal/tokushoho" className="hover:underline">
          特商法表記
        </a>
      </div>
      <CustomerBottomNav />
    </div>
  );
}
