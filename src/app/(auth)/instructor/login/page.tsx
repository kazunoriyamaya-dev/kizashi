/**
 * I001 講師ログイン
 *
 * 招待後にパスワードを設定済みの講師は email + password でログイン。
 * 招待状態（status='invited'）の場合はメールに記載された URL から /instructor/accept-invite に進む。
 */
import { redirectIfAuthenticated } from '@/lib/auth';
import { signInInstructorAction } from '@/lib/auth/instructor-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

const ERROR_MESSAGES: Record<string, string> = {
  missing_credentials: 'メールアドレスとパスワードを入力してください。',
  invalid_credentials: 'メールアドレスまたはパスワードが正しくありません。',
  not_instructor: '講師アカウントではありません。',
  inactive: 'アカウントが利用停止中です。',
  pending_invite: 'まずは招待メールから初期設定を完了してください。',
};

export default async function InstructorLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await redirectIfAuthenticated();
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">講師ログイン</CardTitle>
          <CardDescription>Kizashi 講師画面にアクセスします</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInInstructorAction} className="space-y-4">
            {errorMessage && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" name="email" type="email" required autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full">
              ログイン
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            招待メールが届いている方は{' '}
            <Link href="/instructor/accept-invite" className="underline">
              こちら
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
