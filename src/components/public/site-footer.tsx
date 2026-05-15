/**
 * 公開ページ用 共通フッター
 *
 * 法的リンク (利用規約 / プライバシー / 特商法表記 / お問い合わせ) を必ず含める。
 * Stripe 本番審査 + 改正個情法 で必須。
 */
import Link from 'next/link';

const COL_SERVICE = [
  { href: '/', label: 'サービス概要' },
  { href: '/#features', label: '特長' },
  { href: '/#pricing', label: '料金' },
  { href: '/blog', label: 'ブログ' },
];

const COL_USE = [
  { href: '/login?redirect_to=/mypage/trial-reservation', label: '無料体験予約' },
  { href: '/login', label: 'ログイン' },
  { href: '/contact', label: 'お問い合わせ' },
];

const COL_LEGAL = [
  { href: '/legal/terms', label: '利用規約' },
  { href: '/legal/privacy', label: 'プライバシーポリシー' },
  { href: '/legal/tokushoho', label: '特定商取引法に基づく表記' },
];

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-bold">Kizashi</p>
            <p className="mt-2 text-xs text-muted-foreground">
              小中学生向けのパーソナルレッスン予約サービス。
              お子様一人ひとりに合った先生と学びをつなぎます。
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">サービス</p>
            <ul className="mt-3 space-y-2 text-sm">
              {COL_SERVICE.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">ご利用</p>
            <ul className="mt-3 space-y-2 text-sm">
              {COL_USE.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">利用規約・法的情報</p>
            <ul className="mt-3 space-y-2 text-sm">
              {COL_LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t pt-6 text-xs text-muted-foreground">
          © {year} Kizashi. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
