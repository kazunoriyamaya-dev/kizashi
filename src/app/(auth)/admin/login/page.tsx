/**
 * A001 管理者ログイン
 *
 * email + password。Supabase Auth でユーザー作成は管理者間で手動運用。
 * ロール検証も signInAdminAction 内で行う。
 */
import { redirectIfAuthenticated } from '@/lib/auth';
import { signInAdminAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ERROR_MESSAGES: Record<string, string> = {
  missing_credentials: 'メールアドレスとパスワードを入力してください。',
  invalid_credentials: 'メールアドレスまたはパスワードが正しくありません。',
  not_admin: 'このアカウントは管理者権限を持っていません。',
  inactive: 'アカウントが利用停止中です。',
};

export default async function AdminLoginPage({
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
          <CardTitle className="text-2xl">管理者ログイン</CardTitle>
          <CardDescription>Kizashi 管理画面にアクセスします</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInAdminAction} className="space-y-4">
            {errorMessage && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="admin@kizashi.example.com"
              />
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
        </CardContent>
      </Card>
    </main>
  );
}
