/**
 * 管理者画面共通レイアウト
 *
 * 認可: requireRole('admin')
 * レイアウト: 左サイドバー (240px) + 上部ヘッダー + メインエリア
 */
import { requireRole } from '@/lib/auth';
import { SignOutButton } from '@/components/layout/sign-out-button';
import { AdminSidebarNav } from '@/components/admin/sidebar-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('admin');

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-background md:block">
        <div className="border-b border-border p-4">
          <div className="font-semibold">Kizashi 管理画面</div>
          <p className="mt-1 text-xs text-muted-foreground">{user.displayName}</p>
        </div>
        <div className="p-3">
          <AdminSidebarNav />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
          <div className="flex items-center gap-2 md:hidden">
            <span className="font-semibold">Kizashi 管理画面</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground md:inline">{user.displayName}</span>
            <SignOutButton role="admin" />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
