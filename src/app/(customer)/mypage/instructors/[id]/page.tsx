/**
 * C004 講師詳細（顧客向け）
 *
 * - instructors_public ビューから公開列のみ取得 (Q018)
 * - 指名料を表示（Q023: rank別）
 * - 「予約する」ボタンで予約画面 (C005) へ遷移（Phase 6 で実装）
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CATEGORY_LABELS,
  INSTRUCTOR_DESIGNATION_FEES,
  RANK_LABELS,
  type Category,
  type InstructorRank,
} from '@/types';
import { formatJPY } from '@/lib/utils';
import { openCustomerInstructorThreadAction } from '@/lib/messaging/actions';
import { getCurrentUser } from '@/lib/auth';

const RANK_VARIANT: Record<
  InstructorRank,
  'rankGold' | 'rankSilver' | 'rankBronze' | 'rankRegular'
> = {
  gold: 'rankGold',
  silver: 'rankSilver',
  bronze: 'rankBronze',
  regular: 'rankRegular',
};

export default async function InstructorDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const me = await getCurrentUser();
  const supabase = createSupabaseServerClient();
  const { data: instructor } = await supabase
    .from('instructors_public')
    .select('id, nickname, avatar_url, public_bio, categories, genres, rank')
    .eq('id', params.id)
    .maybeSingle();

  if (!instructor) notFound();

  // 予約実績があるか確認 (F034: メッセージ可否判定)
  let hasReservation = false;
  if (me?.role === 'customer') {
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', me.userId)
      .maybeSingle();
    if (customer) {
      const { count } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customer.id)
        .eq('instructor_id', instructor.id);
      hasReservation = (count ?? 0) > 0;
    }
  }

  const errorMessage =
    searchParams.error === 'no_reservation'
      ? '予約実績がある講師のみメッセージを送れます (F034)'
      : undefined;

  const { data: settings } = await supabase
    .from('system_settings')
    .select('instructor_designation_fees')
    .maybeSingle();

  const fees = ((settings?.instructor_designation_fees as Record<string, number>) ??
    INSTRUCTOR_DESIGNATION_FEES) as Record<InstructorRank, number>;
  const designationFee = fees[instructor.rank as InstructorRank] ?? 0;

  const initials = instructor.nickname.slice(0, 2);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/mypage/instructors" className="text-sm text-muted-foreground underline">
          ← 講師一覧へ戻る
        </Link>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar className="h-24 w-24">
          {instructor.avatar_url && (
            <AvatarImage src={instructor.avatar_url} alt={instructor.nickname} />
          )}
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold">{instructor.nickname}先生</h1>
          <Badge variant={RANK_VARIANT[instructor.rank as InstructorRank]} className="mx-auto">
            {RANK_LABELS[instructor.rank as InstructorRank]}
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">対応カテゴリ</h2>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(instructor.categories as Category[] | null)?.map((c) => (
                <Badge key={c} variant="outline">
                  {CATEGORY_LABELS[c]}
                </Badge>
              ))}
            </div>
          </div>

          {instructor.genres && (instructor.genres as string[]).length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground">対応ジャンル</h2>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(instructor.genres as string[]).map((g) => (
                  <Badge key={g} variant="secondary" className="text-xs">
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {instructor.public_bio && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground">自己紹介</h2>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                {instructor.public_bio}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardContent className="space-y-2 pt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">指名料（予約時に加算）</span>
            <span className="text-lg font-semibold">
              {designationFee > 0 ? `+${formatJPY(designationFee)}` : '無料'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Q023: 講師ランク別の指名料です。チケット消化と合わせてお支払いいただきます。
          </p>
        </CardContent>
      </Card>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <div className="sticky bottom-20 z-10 -mx-4 space-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button asChild size="lg" className="w-full">
          <Link href={`/mypage/reservations/new?instructorId=${instructor.id}`}>
            この講師に予約する
          </Link>
        </Button>
        {hasReservation && (
          <form action={openCustomerInstructorThreadAction.bind(null, instructor.id)}>
            <Button type="submit" variant="outline" size="lg" className="w-full">
              メッセージを送る
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
