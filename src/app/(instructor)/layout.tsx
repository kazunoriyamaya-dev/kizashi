/**
 * 講師画面共通レイアウト
 *
 * Phase 4: サイドナビ + ヘッダー + メイン構成
 */
import { requireRole } from '@/lib/auth';
import { SignOutButton } from '@/components/layout/sign-out-button';
import { InstructorSidebarNav } from '@/components/instructor/sidebar-nav';

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('instructor');

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-background md:block">
        <div className="border-b border-border p-4">
          <div className="font-semibold">Kizashi 講師画面</div>
          <p className="mt-1 text-xs text-muted-foreground">{user.displayName}</p>
        </div>
        <div className="p-3">
          <InstructorSidebarNav />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
          <span className="font-semibold md:hidden">Kizashi 講師画面</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground md:inline">{user.displayName}</span>
            <SignOutButton role="instructor" />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
