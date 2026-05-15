/**
 * C005 通常予約登録
 *
 * Query: ?instructorId=xxx
 *
 * Server Component で必要なデータを取得し、Client Component (ReservationForm) に渡す。
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ReservationForm } from '@/components/customer/reservation-form';
import { INSTRUCTOR_DESIGNATION_FEES, type Category, type InstructorRank } from '@/types';

const ERROR_MESSAGES: Record<string, string> = {
  validation: '入力内容に不備があります。',
  ticket_not_found: '選択されたチケットが見つかりません。',
  ticket_owner_mismatch: 'チケットの所有者が一致しません。',
  ticket_inactive: 'チケットは利用停止中です。',
  ticket_remaining_zero: 'チケットの残数がありません。',
  ticket_expired: 'チケットの有効期限が切れています。',
  instructor_not_found: '講師が見つかりません。',
  instructor_inactive: '講師は現在予約を受け付けていません。',
  time_conflict: 'この時間帯は既に予約が入っています。別の時間を選択してください。',
  unknown: '予約に失敗しました。再度お試しください。',
};

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: { instructorId?: string; error?: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  if (!searchParams.instructorId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">予約を作成</h1>
        <p className="text-sm text-muted-foreground">
          まず{' '}
          <Link href="/mypage/instructors" className="underline">
            講師一覧
          </Link>{' '}
          から講師を選んでください
        </p>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();

  const [{ data: instructor }, { data: customer }, { data: settings }] = await Promise.all([
    supabase
      .from('instructors_public')
      .select('id, nickname, avatar_url, categories, rank')
      .eq('id', searchParams.instructorId)
      .maybeSingle(),
    supabase
      .from('customers')
      .select(
        `id,
         children ( id, name, kana )`,
      )
      .eq('profile_id', me.userId)
      .maybeSingle(),
    supabase.from('system_settings').select('instructor_designation_fees').maybeSingle(),
  ]);

  if (!instructor || !customer) notFound();

  const fees = ((settings?.instructor_designation_fees as Record<string, number>) ??
    INSTRUCTOR_DESIGNATION_FEES) as Record<InstructorRank, number>;
  const designationFee = fees[instructor.rank as InstructorRank] ?? 0;

  // 保有チケット取得
  const { data: tickets } = await supabase
    .from('customer_tickets')
    .select(
      `id, remaining_count, expires_at,
       tickets!customer_tickets_ticket_id_fkey ( name, duration_min, lesson_format, category )`,
    )
    .eq('customer_id', customer.id)
    .eq('status', 'active')
    .gt('remaining_count', 0)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });

  const ticketOptions = (tickets ?? [])
    .filter((t) => {
      // 講師の対応カテゴリかつ チケットのカテゴリ制約 を満たすもののみ
      const ticketCategory = t.tickets?.category as Category | null;
      if (!ticketCategory) return true; // 共通チケット
      return (instructor.categories as Category[] | null)?.includes(ticketCategory) ?? false;
    })
    .map((t) => ({
      id: t.id,
      ticket_name: t.tickets?.name ?? 'チケット',
      duration_min: t.tickets?.duration_min ?? 60,
      lesson_format: (t.tickets?.lesson_format ?? 'solo') as 'solo' | 'pair',
      remaining_count: t.remaining_count,
      expires_at: t.expires_at,
      category: (t.tickets?.category ?? null) as Category | null,
    }));

  const childrenList = (customer.children ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    kana: c.kana,
  }));

  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;
  const defaultCategory = ((instructor.categories as Category[] | null)?.[0] ??
    'learning') as Category;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/mypage/instructors/${instructor.id}`}
          className="text-sm text-muted-foreground underline"
        >
          ← 講師詳細へ戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold">予約を作成</h1>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <ReservationForm
        instructor={{
          id: instructor.id,
          nickname: instructor.nickname,
          avatar_url: instructor.avatar_url,
          categories: (instructor.categories as Category[]) ?? [],
          rank: instructor.rank as InstructorRank,
          designation_fee: designationFee,
        }}
        childrenList={childrenList}
        tickets={ticketOptions}
        defaultCategory={defaultCategory}
      />
    </div>
  );
}
