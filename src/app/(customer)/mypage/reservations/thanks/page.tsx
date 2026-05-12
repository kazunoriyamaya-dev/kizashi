/**
 * C007 予約サンキュー
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_LABELS, type Category } from '@/types';

export default async function ReservationThanksPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const me = await getCurrentUser();
  if (!me || !searchParams.id) redirect('/mypage');

  const supabase = createSupabaseServerClient();
  const { data: r } = await supabase
    .from('reservations')
    .select(
      `id, start_at, end_at, category, delivery_type, google_meet_url,
       instructors!reservations_instructor_id_fkey ( nickname ),
       children!reservations_child_id_fkey ( name )`,
    )
    .eq('id', searchParams.id)
    .maybeSingle();

  if (!r) redirect('/mypage');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
        <h1 className="mt-4 text-2xl font-bold">予約が確定しました</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          講師には自動的に通知されます。確認メールも送信されます。
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6 text-sm">
          <Row label="お子様" value={r.children?.name ?? '–'} />
          <Row label="講師" value={`${r.instructors?.nickname ?? '–'}先生`} />
          <Row label="日時" value={new Date(r.start_at).toLocaleString('ja-JP')} />
          <Row label="カテゴリ" value={CATEGORY_LABELS[r.category as Category]} />
          <Row
            label="形式"
            value={
              <Badge variant="outline">
                {r.delivery_type === 'onsite' ? '対面' : 'オンライン'}
              </Badge>
            }
          />
          {r.google_meet_url && (
            <Row
              label="Google Meet"
              value={
                <a
                  href={r.google_meet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  参加リンク
                </a>
              }
            />
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">次のアクション</h2>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/mypage/reservations/${r.id}`}>予約詳細を見る</Link>
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/mypage">マイページへ戻る</Link>
        </Button>
      </div>

      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-semibold">キャンセル・変更について (Q013)</p>
        <p className="mt-1">
          開始時刻の 1 時間前まで無料でキャンセル・変更できます。
          1 時間を過ぎてからのキャンセルはチケット消化扱いとなりますのでご注意ください。
        </p>
      </div>
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
