/**
 * 公開ページ用 共通ヘッダー (未ログイン顧客向け)
 *
 * `/`, `/blog`, `/blog/[slug]`, `/lp/[slug]`, `/legal/*`, `/contact` で使う。
 * モバイル / デスクトップ両対応。CTA は「無料体験予約」固定。
 */
import Link from 'next/link';

const NAV = [
  { href: '/', label: 'トップ' },
  { href: '/#features', label: '特長' },
  { href: '/#pricing', label: '料金' },
  { href: '/blog', label: 'ブログ' },
  { href: '/contact', label: 'お問い合わせ' },
] as const;

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Kizashi
        </Link>
        <nav className="hidden flex-1 items-center gap-5 sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
          >
            ログイン
          </Link>
          <Link
            href="/login?redirect_to=/mypage/trial-reservation&utm_source=site&utm_medium=header&utm_campaign=trial_cta"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            無料体験予約
          </Link>
        </div>
      </div>
    </header>
  );
}
