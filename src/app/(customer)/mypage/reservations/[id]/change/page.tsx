/**
 * C011 予約変更画面
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { ReservationChangeForm } from '@/components/customer/reservation-change-form';
import { canChangeReservation } from '@/lib/reservations/cancel-policy';

const ERROR_MESSAGES: Record<string, string> = {
  validation: '入力内容に不備があります。',
  reservation_not_found: '予約が見つかりません。',
  reservation_finalized: 'この予約は既にキャンセル/完了しています。',
  change_deadline_passed: '変更可能期限を過ぎています。キャンセル後に再予約してください。',
  time_conflict: 'この時間帯は他の予約が入っています。別の時間を選択してください。',
  invalid_time_range: '時間範囲が不正です。',
  unknown: '変更に失敗しました。',
};

export default async function ChangeReservationPage({
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
      `id, start_at, duration_min, delivery_type, instructor_id, status, customer_id,
       instructors!reservations_instructor_id_fkey ( nickname )`,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!rsv) notFound();

  // 自分の予約か検証
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer || rsv.customer_id !== customer.id) {
    redirect('/mypage/reservations');
  }

  // ポリシー判定
  const { data: policy } = await supabase
    .from('cancel_policies')
    .select('free_change_minutes_before_start')
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  const judge = canChangeReservation(rsv.start_at, {
    free_cancel_minutes_before_start: 60,
    free_change_minutes_before_start: policy?.free_change_minutes_before_start ?? 60,
    ticket_return_rule_in_deadline: '',
    ticket_return_rule_out_deadline: '',
    ticket_return_rule_company: '',
    ticket_return_rule_instructor: '',
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
        <h1 className="mt-2 text-2xl font-bold">予約を変更</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rsv.instructors?.nickname}先生 / {rsv.duration_min}分 /{' '}
          {rsv.delivery_type === 'onsite' ? '対面' : 'オンライン'}
        </p>
      </div>

      {!judge.allowed ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          変更可能期限（開始 {judge.deadlineMin} 分前）を過ぎています。
          キャンセル後に再予約してください。
        </div>
      ) : (
        <>
          {errorMessage && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <ReservationChangeForm
            reservationId={rsv.id}
            instructorId={rsv.instructor_id ?? ''}
            durationMin={rsv.duration_min}
            deliveryType={rsv.delivery_type as 'online' | 'onsite'}
            currentStartIso={rsv.start_at}
          />
        </>
      )}
    </div>
  );
}
