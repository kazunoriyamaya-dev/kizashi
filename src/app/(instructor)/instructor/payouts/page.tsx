/**
 * 講師: 自分の精算履歴 + Stripe Connect オンボーディング
 */
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatJPY } from '@/lib/utils';
import {
  startInstructorOnboardingAction,
  refreshInstructorConnectStatusAction,
} from '@/lib/instructor/connect-actions';

const ERROR_MESSAGES: Record<string, string> = {
  onboard_failed: 'Stripe Connect の開始に失敗しました',
  no_account: 'Stripe Connect が未連携です',
};

export default async function InstructorPayoutsPage({
  searchParams,
}: {
  searchParams: { connect?: string; synced?: string; error?: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = createSupabaseServerClient();
  const { data: instructor } = await supabase
    .from('instructors')
    .select('id, nickname')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!instructor) return null;

  const [{ data: connect }, { data: payouts }, { data: invoice }] = await Promise.all([
    supabase
      .from('stripe_connect_accounts')
      .select('onboarding_completed, charges_enabled, payouts_enabled, stripe_account_id, last_synced_at')
      .eq('instructor_id', instructor.id)
      .maybeSingle(),
    supabase
      .from('payouts')
      .select(
        'id, period_month, gross_amount, stripe_fee_amount, designation_fee_amount, travel_fee_amount, instructor_amount, status, confirmed_at, paid_at, stripe_transfer_id, invoice_registration_no',
      )
      .eq('instructor_id', instructor.id)
      .order('period_month', { ascending: false })
      .limit(36),
    supabase
      .from('invoice_settings')
      .select('invoice_registration_no')
      .eq('instructor_id', instructor.id)
      .maybeSingle(),
  ]);

  const flash =
    searchParams.connect === 'return'
      ? 'Stripe Connect オンボーディングから戻りました。下のボタンで状態を同期してください。'
      : searchParams.connect === 'refresh'
        ? '再度オンボーディングが必要です。'
        : searchParams.synced
          ? 'Stripe Connect の状態を同期しました'
          : null;
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">精算</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          毎月の支払い予定額を確認できます (月末締め、翌月末払い、Q011)
        </p>
      </div>

      {flash && (
        <p className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
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
          <CardTitle className="text-base">Stripe Connect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {connect ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">オンボーディング</span>
                <Badge variant={connect.onboarding_completed ? 'success' : 'warning'}>
                  {connect.onboarding_completed ? '完了' : '未完了'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">支払い受領</span>
                <Badge variant={connect.payouts_enabled ? 'success' : 'warning'}>
                  {connect.payouts_enabled ? '受領可能' : '不可'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stripe Account ID</span>
                <span className="font-mono text-xs">{connect.stripe_account_id}</span>
              </div>
              {connect.last_synced_at && (
                <p className="text-xs text-muted-foreground">
                  最終同期: {new Date(connect.last_synced_at).toLocaleString('ja-JP')}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                {!connect.onboarding_completed && (
                  <form action={startInstructorOnboardingAction}>
                    <Button type="submit">オンボーディングを続行</Button>
                  </form>
                )}
                <form action={refreshInstructorConnectStatusAction}>
                  <Button type="submit" variant="outline">
                    状態を再同期
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                精算の振込を受け取るために Stripe Connect 連携が必要です
              </p>
              <form action={startInstructorOnboardingAction}>
                <Button type="submit">Stripe Connect を開始</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">インボイス番号 (Q012)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {invoice?.invoice_registration_no ? (
            <p>
              登録番号: <span className="font-mono">{invoice.invoice_registration_no}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              インボイス番号は登録されていません（プロフィール編集から登録できます）
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">精算履歴 (最新36ヶ月)</CardTitle>
        </CardHeader>
        <CardContent>
          {!payouts || payouts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              精算履歴はまだありません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>対象月</TableHead>
                  <TableHead className="text-right">売上</TableHead>
                  <TableHead className="text-right">取り分</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>支払日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.period_month.slice(0, 7)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatJPY(p.gross_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatJPY(p.instructor_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === 'paid'
                            ? 'success'
                            : p.status === 'confirmed'
                              ? 'default'
                              : p.status === 'cancelled'
                                ? 'destructive'
                                : 'secondary'
                        }
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString('ja-JP')
                        : '–'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
