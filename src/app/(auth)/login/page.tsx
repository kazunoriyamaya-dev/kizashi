/**
 * C001 顧客ログイン/登録画面
 *
 * Google または LINE SSO のみ提供。新規登録もこの画面から行う。
 * 既ログイン状態は middleware が /mypage 等へ redirect するが、念のため redirectIfAuthenticated も実行。
 */
import { redirectIfAuthenticated } from '@/lib/auth';
import { signInWithGoogleAction } from '@/lib/auth/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ERROR_MESSAGES: Record<string, string> = {
  oauth_init: 'ログインの開始に失敗しました。時間をおいて再度お試しください。',
  oauth_provider: 'ログインプロバイダーから戻る際にエラーが発生しました。',
  oauth_exchange: '認証情報の交換に失敗しました。再度お試しください。',
  missing_code: '認証コードが取得できませんでした。',
  no_profile: 'プロフィールが見つかりませんでした。',
  inactive: 'アカウントが利用停止中です。サポートにお問い合わせください。',
  line_config: 'LINEログインの設定に問題があります。',
  line_provider: 'LINE 側でエラーが発生しました。',
  line_state_mismatch: 'セッションが切れたため、再度お試しください。',
  line_token: 'LINEログインで認証エラーが発生しました。',
  line_user_lookup: 'LINEアカウントの確認に失敗しました。',
  line_create_user: 'アカウント作成に失敗しました。',
  line_session: 'ログイン情報の発行に失敗しました。',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; redirect_to?: string };
}) {
  await redirectIfAuthenticated();
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;
  const redirectTo = searchParams.redirect_to;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">Kizashi にログイン</CardTitle>
          <CardDescription>Google または LINE アカウントでご利用いただけます</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {errorMessage && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          <form action={signInWithGoogleAction.bind(null, redirectTo)}>
            <Button type="submit" className="w-full" variant="outline" size="lg">
              Google でログイン
            </Button>
          </form>

          <form
            action={`/api/auth/line/start${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`}
          >
            <Button
              type="submit"
              className="w-full bg-[#06C755] text-white hover:bg-[#06C755]/90"
              size="lg"
            >
              LINE でログイン
            </Button>
          </form>

          <p className="pt-4 text-center text-xs text-muted-foreground">
            ログインすることで利用規約とプライバシーポリシーに同意したものとみなします。
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
