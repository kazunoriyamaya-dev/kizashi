/**
 * 体験予約 管理者承認待ち画面 (Q003)
 *
 * 同じ氏名・カナ・生年月日のお子様が既に体験を利用済みのため、
 * 管理者の確認が必要な状態。
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Clock } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default async function TrialPendingPage({
  searchParams,
}: {
  searchParams: { review_id?: string };
}) {
  const me = await getCurrentUser();
  if (!me || !searchParams.review_id) redirect('/mypage');

  const supabase = createSupabaseServerClient();
  const { data: review } = await supabase
    .from('trial_pending_reviews')
    .select('id, status, requested_at, review_note, resulting_reservation_id')
    .eq('id', searchParams.review_id)
    .maybeSingle();

  if (!review) redirect('/mypage');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Clock className="mx-auto h-12 w-12 text-yellow-600" />
        <h1 className="mt-4 text-xl font-bold">体験予約 確認待ち</h1>
      </div>

      <Card className="border-yellow-300 bg-yellow-50">
        <CardContent className="space-y-3 pt-6 text-sm">
          <p className="text-yellow-900">
            同じ氏名・フリガナ・生年月日のお子様が既に体験を利用済みとなっています。
            重複利用ではないか管理者が確認しますので、しばらくお待ちください。
          </p>
          <p className="text-xs text-yellow-800">
            通常は 1 営業日以内に確認が完了します。確認結果はメール / LINE / アプリ内通知でお知らせします。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">申請日時</span>
            <span>{new Date(review.requested_at).toLocaleString('ja-JP')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ステータス</span>
            <Badge variant={review.status === 'pending' ? 'warning' : review.status === 'approved' ? 'success' : 'destructive'}>
              {review.status === 'pending' ? '確認中' : review.status === 'approved' ? '承認済み' : '却下'}
            </Badge>
          </div>
          {review.review_note && (
            <p className="text-xs text-muted-foreground">
              管理者メモ: {review.review_note}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {review.resulting_reservation_id && (
          <Button asChild className="w-full">
            <Link href={`/mypage/reservations/${review.resulting_reservation_id}`}>
              予約詳細を見る
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href="/mypage">マイページへ戻る</Link>
        </Button>
      </div>
    </div>
  );
}
