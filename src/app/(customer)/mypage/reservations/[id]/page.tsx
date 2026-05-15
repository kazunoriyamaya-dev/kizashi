/**
 * C010 顧客予約詳細
 *
 * - 予約内容（日時・講師・形式・場所・Meet URL・チケット消化・指名料）
 * - キャンセル/変更可否をポリシーで判定して表示（Q013: 1時間前まで無料）
 * - キャンセル/変更ボタン (Phase 9 で実装)
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CATEGORY_LABELS, type Category } from '@/types';
import { formatJPY } from '@/lib/utils';

export default async function CustomerReservationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = createSupabaseServerClient();
  const { data: r } = await supabase
    .from('reservations')
    .select(
      `id, start_at, end_at, category, status, delivery_type, reservation_type,
       designation_fee, google_meet_url, customer_ticket_id, pair_participants,
       instructors!reservations_instructor_id_fkey ( id, nickname, avatar_url ),
       children!reservations_child_id_fkey ( name, kana ),
       addresses!reservations_location_address_id_fkey (
         postal_code, prefecture, city, address_line, building
       ),
       customer_tickets!reservations_customer_ticket_id_fkey (
         remaining_count,
         tickets!customer_tickets_ticket_id_fkey ( name )
       )`,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!r) notFound();

  // キャンセル/変更可否（Q013: 開始時刻 1 時間前まで無料）
  const { data: policy } = await supabase
    .from('cancel_policies')
    .select('free_cancel_minutes_before_start, free_change_minutes_before_start')
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  const freeCancelMin = policy?.free_cancel_minutes_before_start ?? 60;
  const freeChangeMin = policy?.free_change_minutes_before_start ?? 60;
  const minutesUntilStart = Math.floor((new Date(r.start_at).getTime() - Date.now()) / 1000 / 60);

  const canFreeCancel =
    r.status === 'confirmed' || r.status === 'pending_payment' || r.status === 'changed';
  const isFreeCancellable = canFreeCancel && minutesUntilStart >= freeCancelMin;
  const isPenaltyCancellable =
    canFreeCancel && minutesUntilStart < freeCancelMin && minutesUntilStart >= 0;
  const isFreeChangeable = canFreeCancel && minutesUntilStart >= freeChangeMin;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/mypage/reservations" className="text-sm text-muted-foreground underline">
          ← 予約一覧へ戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold">予約詳細</h1>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6 text-sm">
          <div className="flex items-center justify-between">
            <Badge
              variant={
                r.status === 'confirmed'
                  ? 'success'
                  : r.status === 'cancelled'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {r.status}
            </Badge>
            {r.reservation_type === 'trial' && <Badge variant="warning">体験</Badge>}
          </div>
          <Row label="日時" value={new Date(r.start_at).toLocaleString('ja-JP')} />
          <Row label="講師" value={`${r.instructors?.nickname ?? '–'}先生`} />
          <Row label="お子様" value={`${r.children?.name}（${r.children?.kana}）`} />
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

      {r.delivery_type === 'onsite' && r.addresses && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">実施場所</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {r.addresses.postal_code && <p>〒 {r.addresses.postal_code}</p>}
            <p>
              {[r.addresses.prefecture, r.addresses.city, r.addresses.address_line]
                .filter(Boolean)
                .join('')}
              {r.addresses.building && ` ${r.addresses.building}`}
            </p>
          </CardContent>
        </Card>
      )}

      {Array.isArray(r.pair_participants) && r.pair_participants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ペア参加者</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {(
                r.pair_participants as Array<{ name?: string; child_id?: string; type: string }>
              ).map((p, idx) => (
                <li key={idx}>{p.name ?? `子供 ID: ${p.child_id ?? ''}`}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">金額・チケット</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {r.customer_tickets && (
            <Row
              label="消化チケット"
              value={
                <span>
                  {r.customer_tickets.tickets?.name} ・ 残{r.customer_tickets.remaining_count}回
                </span>
              }
            />
          )}
          <Row label="指名料 (Q023)" value={formatJPY(r.designation_fee ?? 0)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">変更・キャンセル (Q013)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {r.status === 'cancelled' || r.status === 'completed' ? (
            <p className="text-muted-foreground">この予約は{r.status}されています</p>
          ) : (
            <>
              <p className="text-muted-foreground">
                開始時刻まで残り {Math.max(0, minutesUntilStart)} 分
              </p>
              <p className="text-xs text-muted-foreground">
                {isFreeCancellable
                  ? `開始 ${freeCancelMin} 分前まで無料でキャンセル・変更できます`
                  : isPenaltyCancellable
                    ? `開始 ${freeCancelMin} 分前を過ぎたため、キャンセル時はチケット消化扱いとなります`
                    : '開始時刻を過ぎているため操作できません'}
              </p>
              <div className="flex gap-2">
                <Button asChild variant="outline" disabled={!isFreeChangeable}>
                  <Link href={`/mypage/reservations/${r.id}/change`}>
                    {isFreeChangeable ? '変更する' : '変更不可'}
                  </Link>
                </Button>
                <Button asChild variant="destructive" disabled={!canFreeCancel}>
                  <Link href={`/mypage/reservations/${r.id}/cancel`}>
                    {isFreeCancellable ? '無料キャンセル' : 'キャンセル (チケット消化)'}
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                変更・キャンセル機能は Phase 9 で本実装されます
              </p>
            </>
          )}
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
