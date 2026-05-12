import Link from 'next/link';

/**
 * トップページ
 *
 * MVPでは顧客はSNS/HPからログイン画面 (/login) に直接遷移する想定。
 * このページは開発用のエントリポイントとして3ロール画面への入口を提供する。
 * 本番運用前にロール別ランディングページに差し替える予定。
 */
export default function Home() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">Kizashi</h1>
        <p className="text-muted-foreground">小中学生向けパーソナルサービス 予約管理システム</p>
        <p className="mt-2 text-xs text-muted-foreground">Phase 0 開発雛形</p>
      </header>

      <nav className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        <Link
          href="/admin"
          className="rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-primary hover:shadow-md"
        >
          <h2 className="mb-1 text-lg font-semibold">管理者</h2>
          <p className="text-sm text-muted-foreground">講師・チケット・予約・精算管理</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">/admin</p>
        </Link>
        <Link
          href="/instructor"
          className="rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-primary hover:shadow-md"
        >
          <h2 className="mb-1 text-lg font-semibold">講師</h2>
          <p className="text-sm text-muted-foreground">予約・プロフィール・カレンダー</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">/instructor</p>
        </Link>
        <Link
          href="/mypage"
          className="rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-primary hover:shadow-md"
        >
          <h2 className="mb-1 text-lg font-semibold">顧客</h2>
          <p className="text-sm text-muted-foreground">講師選択・予約・チケット購入</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">/mypage</p>
        </Link>
      </nav>

      <section className="w-full max-w-3xl rounded-lg border border-dashed border-border p-6 text-sm">
        <h3 className="mb-2 font-semibold">Phase 0 完了</h3>
        <p className="text-muted-foreground">
          プロジェクト雛形・環境変数テンプレート・ディレクトリ構造の整備が完了しています。
          次フェーズ（P1）では Supabase スキーマと RLS を実装します。
        </p>
      </section>
    </main>
  );
}
