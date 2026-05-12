/**
 * I006 Google Calendar 連携画面
 *
 * - 連携状態を表示（connected_at / last_synced_at / sync_failures）
 * - 連携ボタン: GET /api/instructor/google-calendar/auth-url
 * - 連携解除ボタン: Server Action 経由で API 呼び出し
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { disconnectCalendarAction } from '@/lib/instructor/profile-actions';

const ERROR_MESSAGES: Record<string, string> = {
  provider: 'Google 側でエラーが発生しました。再度お試しください。',
  missing_params: '認証情報が不足しています。',
  state_mismatch: 'セッションが切れたため、再度お試しください。',
  token_exchange: 'アクセストークンの取得に失敗しました。',
  no_refresh_token: 'リフレッシュトークンが取得できませんでした。Google アカウント側の連携を一度解除して再度お試しください。',
  db_insert: '連携情報の保存に失敗しました。',
  db_update: '連携情報の更新に失敗しました。',
  forbidden: 'アクセス権がありません。',
};

export default async function InstructorCalendarPage({
  searchParams,
}: {
  searchParams: { connected?: string; disconnected?: string; error?: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = createSupabaseServerClient();

  const { data: instructor } = await supabase
    .from('instructors')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (!instructor) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          講師レコードが見つかりません。管理者にお問い合わせください。
        </CardContent>
      </Card>
    );
  }

  const { data: conn } = await supabase
    .from('calendar_connections')
    .select('google_account_email, last_synced_at, expires_at, sync_failures, created_at')
    .eq('instructor_id', instructor.id)
    .maybeSingle();

  const flash = searchParams.connected
    ? 'Google Calendar と連携しました'
    : searchParams.disconnected
      ? '連携を解除しました'
      : null;
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Google Calendar 連携</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          顧客からの予約は Google Calendar の空き枠と統合されます (Q005 / Q006)
        </p>
      </div>

      {flash && (
        <p className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {flash}
        </p>
      )}
      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            連携状態{' '}
            {conn ? (
              <Badge variant="success" className="ml-2">
                連携済み
              </Badge>
            ) : (
              <Badge variant="warning" className="ml-2">
                未連携
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {conn ? (
            <>
              <Row label="Google アカウント" value={conn.google_account_email} />
              <Row
                label="連携日"
                value={new Date(conn.created_at).toLocaleString('ja-JP')}
              />
              <Row
                label="最終同期"
                value={
                  conn.last_synced_at
                    ? new Date(conn.last_synced_at).toLocaleString('ja-JP')
                    : '–'
                }
              />
              <Row
                label="アクセストークン期限"
                value={new Date(conn.expires_at).toLocaleString('ja-JP')}
              />
              {conn.sync_failures > 0 && (
                <p className="text-xs text-yellow-700">
                  ⚠ 同期失敗が {conn.sync_failures} 回連続しています。再連携をお勧めします。
                </p>
              )}
              <div className="flex gap-2 pt-4">
                <form action="/api/instructor/google-calendar/auth-url">
                  <Button type="submit" variant="outline">
                    再連携（同じアカウント）
                  </Button>
                </form>
                <form action={disconnectCalendarAction}>
                  <Button type="submit" variant="destructive">
                    連携を解除
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                まだ Google Calendar と連携していません。連携することで、Calendar 上の予定が顧客の予約候補から自動的に除外されます。
              </p>
              <form action="/api/instructor/google-calendar/auth-url">
                <Button type="submit">Google Calendar と連携する</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>このアプリが取得する権限</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Calendar の予定の読み取り (空き枠判定用)</li>
            <li>予定の作成・更新・削除 (確定した予約をカレンダーに登録するため)</li>
            <li>Google アカウントのメールアドレス取得 (連携先表示用)</li>
            <li>Google Meet URL の自動発行 (オンライン予約用、Q006)</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            連携情報（リフレッシュトークン）は AES-256-GCM 暗号化して保存されます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
