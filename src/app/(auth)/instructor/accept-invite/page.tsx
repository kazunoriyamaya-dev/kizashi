/**
 * 講師招待受け入れ画面
 *
 * URL: /instructor/accept-invite?token=...
 *
 * フロー:
 *  1. token をサーバーサイドで検証 (verifyInviteToken)
 *  2. パスワード入力フォームを表示
 *  3. 送信は client component → /api/instructor/accept-invite に POST
 *  4. magic link を受け取って window.location.href で遷移 (自動ログイン)
 */
import Link from 'next/link';
import { verifyInviteToken } from '@/lib/auth/invite-token';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AcceptInviteForm } from './accept-invite-form';

export default function AcceptInvitePage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token;
  const verified = token ? verifyInviteToken(token) : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">講師アカウント初期設定</CardTitle>
          <CardDescription>ログインに使用するパスワードを設定してください</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              招待トークンがありません。招待メールから再度アクセスしてください。
            </p>
          ) : !verified ? (
            <div className="space-y-3">
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                招待リンクが無効、または有効期限を過ぎています。管理者にご連絡ください。
              </p>
              <p className="text-xs text-muted-foreground">
                既にアカウントを発行済みの方は{' '}
                <Link href="/instructor/login" className="underline">
                  ログイン画面
                </Link>{' '}
                からアクセスしてください。
              </p>
            </div>
          ) : (
            <AcceptInviteForm token={token} expiresAt={verified.expiresAt.toISOString()} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
