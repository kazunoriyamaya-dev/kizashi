/**
 * 予約キャンセル確認画面 (顧客)
 *
 * - ポリシーを評価して「無料 / チケット消化 / 半額返金」を事前表示
 * - 顧客が「キャンセル」を押すと Server Action で確定
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { evaluateCancelPolicy } from '@/lib/reservations/cancel-policy';
import { cancelOwnReservationAction } from '@/lib/customer/reservation-modify-actions';
import { CATEGORY_LABELS, type Category } from '@/types';

const ERROR_MESSAGES: Record<string, string> = {
  reservation_already_finalized: 'この予約は既にキャンセル/完了しています。',
  reservation_not_found: '予約が見つかりません。',
  unknown: 'キャンセルに失敗しました。',
};

export default async function CancelReservationPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const supabase = createSupabaseServerClient();
  const { data: rsv } = await supabase
    .from('reservations')
    .select(
      `id, start_at, duration_min, delivery_type, category, status, customer_id,
       instructors!reservations_instructor_id_fkey ( nickname ),
       customer_tickets!reservations_customer_ticket_id_fkey (
         tickets!customer_tickets_ticket_id_fkey ( price )
       )`,
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!rsv) notFound();

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer || rsv.customer_id !== customer.id) {
    redirect('/mypage/reservations');
  }

  // ポリシー取得 & 判定
  const { data: policyRow } = await supabase
    .from('cancel_policies')
    .select(
      'free_cancel_minutes_before_start, free_change_minutes_before_start, ticket_return_rule_in_deadline, ticket_return_rule_out_deadline, ticket_return_rule_company, ticket_return_rule_instructor',
    )
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  const policy = {
    free_cancel_minutes_before_start: policyRow?.free_cancel_minutes_before_start ?? 60,
    free_change_minutes_before_start: policyRow?.free_change_minutes_before_start ?? 60,
    ticket_return_rule_in_deadline: policyRow?.ticket_return_rule_in_deadline ?? 'full_return',
    ticket_return_rule_out_deadline: policyRow?.ticket_return_rule_out_deadline ?? 'no_return',
    ticket_return_rule_company: policyRow?.ticket_return_rule_company ?? 'full_return',
    ticket_return_rule_instructor: policyRow?.ticket_return_rule_instructor ?? 'full_return',
  };

  const evaluation = evaluateCancelPolicy({
    startAt: rsv.start_at,
    reason: 'customer',
    policy,
    ticketUnitPrice: rsv.customer_tickets?.tickets?.price ?? 0,
    refundFeeFlat: 500,
  });

  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/mypage/reservations/${params.id}`}
          className="text-sm text-muted-foreground underline"
        >
          ← 予約詳細へ戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold">予約をキャンセル</h1>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <Card>
        <CardContent className="space-y-2 pt-6 text-sm">
          <Row label="日時" value={new Date(rsv.start_at).toLocaleString('ja-JP')} />
          <Row label="講師" value={`${rsv.instructors?.nickname ?? '–'}先生`} />
          <Row label="カテゴリ" value={CATEGORY_LABELS[rsv.category as Category]} />
          <Row label="形式" value={rsv.delivery_type === 'onsite' ? '対面' : 'オンライン'} />
        </CardContent>
      </Card>

      <Card
        className={
          evaluation.isFree
            ? 'border-green-300 bg-green-50'
            : evaluation.ticketReturnRule === 'half_refund_fee'
              ? 'border-yellow-300 bg-yellow-50'
              : 'border-destructive/30 bg-destructive/5'
        }
      >
        <CardContent className="space-y-2 pt-6 text-sm">
          <p className="font-semibold">
            {evaluation.isFree
              ? '無料でキャンセルできます'
              : evaluation.ticketReturnRule === 'half_refund_fee'
                ? `半額返金（¥${evaluation.refundAmount}）`
                : 'チケット消化扱いとなります'}
          </p>
          <p className="text-xs">{evaluation.description}</p>
          <p className="text-xs text-muted-foreground">
            開始時刻まで残り {Math.max(0, evaluation.minutesUntilStart)} 分
          </p>
        </CardContent>
      </Card>

      {!evaluation.allowed ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          開始時刻を過ぎているため、Web からのキャンセルはできません。サポートにお問い合わせください。
        </div>
      ) : (
        <form action={cancelOwnReservationAction.bind(null, params.id)} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="note" className="text-sm font-medium">
              キャンセル理由（任意）
            </label>
            <Textarea
              id="note"
              name="note"
              rows={3}
              placeholder="任意でキャンセル理由をお書きください"
            />
          </div>
          <Button type="submit" variant="destructive" size="lg" className="w-full">
            キャンセルを確定する
          </Button>
        </form>
      )}
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
