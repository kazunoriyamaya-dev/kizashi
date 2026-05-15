/**
 * A004 予約詳細 (管理者)
 *
 * 機能:
 *  - 予約内容を表示
 *  - 「強制キャンセル」(customer/company/instructor 理由選択)
 *  - 「強制変更」リンク
 *  - 変更履歴を表示
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CATEGORY_LABELS, type Category } from '@/types';
import { formatJPY } from '@/lib/utils';
import {
  adminCancelReservationAction,
  adminChangeReservationAction,
} from '@/lib/admin/reservation-actions';
import { setTravelFeeManualAction, recalcTravelFeeAction } from '@/lib/admin/travel-fee-actions';

const ERROR_MESSAGES: Record<string, string> = {
  reservation_not_found: '予約が見つかりません。',
  reservation_already_finalized: '既にキャンセル/完了済みです。',
  reservation_finalized: '既にキャンセル/完了済みです。',
  time_conflict: '時間が他予約と衝突しています。',
  invalid_time_range: '時間範囲が不正です。',
  validation: '入力に不備があります。',
  travel_fee_update: '交通費の更新に失敗しました。',
  unknown: '処理に失敗しました。',
};

export default async function AdminReservationDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: {
    cancelled?: string;
    changed?: string;
    travel_fee_updated?: string;
    error?: string;
  };
}) {
  const supabase = createSupabaseServerClient();
  const { data: rsv } = await supabase
    .from('reservations')
    .select(
      `id, start_at, end_at, duration_min, category, status, delivery_type, reservation_type,
       designation_fee, google_meet_url, cancel_reason, cancel_note,
       customers!reservations_customer_id_fkey ( id, parent_name ),
       instructors!reservations_instructor_id_fkey ( id, nickname ),
       children!reservations_child_id_fkey ( name, kana ),
       customer_tickets!reservations_customer_ticket_id_fkey (
         remaining_count,
         tickets!customer_tickets_ticket_id_fkey ( name, price )
       ),
       travel_fees (
         id, mode, amount, one_way_distance_km, round_trip_distance_km,
         is_manual, manual_reason, requires_admin_review
       ),
       addresses!reservations_location_address_id_fkey (
         postal_code, prefecture, city, address_line, building
       )`,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!rsv) notFound();
  const travelFee = rsv.travel_fees?.[0];

  const { data: changes } = await supabase
    .from('reservation_changes')
    .select('change_type, before_data, after_data, note, created_at')
    .eq('reservation_id', params.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const flash = searchParams.cancelled
    ? '予約をキャンセルしました'
    : searchParams.changed
      ? '予約を変更しました'
      : searchParams.travel_fee_updated
        ? '交通費を更新しました'
        : null;
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  const isFinalized = rsv.status === 'cancelled' || rsv.status === 'completed';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/reservations" className="text-sm text-muted-foreground underline">
          ← 一覧へ戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold">予約詳細</h1>
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
          <CardTitle>予約情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="ID" value={<span className="font-mono text-xs">{rsv.id}</span>} />
          <Row
            label="ステータス"
            value={
              <Badge
                variant={
                  rsv.status === 'confirmed'
                    ? 'success'
                    : rsv.status === 'cancelled'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {rsv.status}
              </Badge>
            }
          />
          <Row
            label="種別"
            value={
              rsv.reservation_type === 'trial' ? (
                <Badge variant="warning">体験</Badge>
              ) : (
                <Badge variant="outline">通常</Badge>
              )
            }
          />
          <Row label="日時" value={new Date(rsv.start_at).toLocaleString('ja-JP')} />
          <Row label="時間" value={`${rsv.duration_min} 分`} />
          <Row label="カテゴリ" value={CATEGORY_LABELS[rsv.category as Category]} />
          <Row label="形式" value={rsv.delivery_type === 'onsite' ? '対面' : 'オンライン'} />
          <Row label="顧客" value={rsv.customers?.parent_name ?? '–'} />
          <Row
            label="お子様"
            value={`${rsv.children?.name ?? ''}（${rsv.children?.kana ?? ''}）`}
          />
          <Row label="講師" value={rsv.instructors?.nickname ?? '未割当'} />
          <Row label="指名料" value={formatJPY(rsv.designation_fee ?? 0)} />
          {rsv.customer_tickets && (
            <Row
              label="使用チケット"
              value={`${rsv.customer_tickets.tickets?.name ?? '–'} (残${rsv.customer_tickets.remaining_count}回)`}
            />
          )}
          {rsv.cancel_reason && <Row label="キャンセル理由" value={rsv.cancel_reason} />}
          {rsv.cancel_note && <Row label="メモ" value={rsv.cancel_note} />}
          {rsv.google_meet_url && (
            <Row
              label="Google Meet"
              value={
                <a
                  href={rsv.google_meet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Meet リンク
                </a>
              }
            />
          )}
        </CardContent>
      </Card>

      {rsv.delivery_type === 'onsite' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">交通費 (Q008/Q009)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {travelFee ? (
              <>
                <Row
                  label="モード"
                  value={travelFee.mode === 'car' ? '車（30円/km, 切り上げ）' : '電車'}
                />
                <Row label="金額" value={formatJPY(travelFee.amount ?? 0)} />
                {travelFee.round_trip_distance_km != null && (
                  <Row label="往復距離" value={`${travelFee.round_trip_distance_km} km`} />
                )}
                {travelFee.is_manual && (
                  <>
                    <Row label="種別" value={<Badge variant="warning">手動入力</Badge>} />
                    {travelFee.manual_reason && (
                      <Row label="理由" value={travelFee.manual_reason} />
                    )}
                  </>
                )}
                {travelFee.requires_admin_review && (
                  <p className="rounded-md border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900">
                    ⚠ 自動取得失敗のため管理者確認が必要です
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">交通費はまだ計算されていません</p>
            )}

            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-semibold">手動入力 / 上書き</p>
              <form
                action={setTravelFeeManualAction.bind(null, rsv.id)}
                className="grid gap-2 sm:grid-cols-2"
              >
                <div>
                  <Label htmlFor="mode" className="text-xs">
                    モード
                  </Label>
                  <select
                    id="mode"
                    name="mode"
                    defaultValue={travelFee?.mode ?? 'train'}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="train">電車</option>
                    <option value="car">車</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="amount" className="text-xs">
                    金額 (円)
                  </Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    min={0}
                    defaultValue={travelFee?.amount ?? 0}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label htmlFor="distance_km" className="text-xs">
                    距離 (km, 任意)
                  </Label>
                  <Input
                    id="distance_km"
                    name="distance_km"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={travelFee?.one_way_distance_km ?? ''}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label htmlFor="reason" className="text-xs">
                    理由
                  </Label>
                  <Input
                    id="reason"
                    name="reason"
                    required
                    placeholder="例: 駅徒歩圏内のため"
                    defaultValue={travelFee?.manual_reason ?? ''}
                    className="h-9"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
                  <form action={recalcTravelFeeAction.bind(null, rsv.id)}>
                    <Button type="submit" variant="outline" size="sm">
                      Maps から再計算
                    </Button>
                  </form>
                  <Button type="submit" size="sm">
                    手動入力で保存
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {!isFinalized && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">強制変更</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={adminChangeReservationAction.bind(null, rsv.id)}
                className="grid gap-3 sm:grid-cols-3"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="start_at">新しい開始 (ISO)</Label>
                  <Input
                    id="start_at"
                    name="start_at"
                    type="datetime-local"
                    required
                    defaultValue={rsv.start_at.slice(0, 16)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end_at">新しい終了 (ISO)</Label>
                  <Input
                    id="end_at"
                    name="end_at"
                    type="datetime-local"
                    required
                    defaultValue={rsv.end_at.slice(0, 16)}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full">
                    変更を保存
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-3">
                  管理者は変更可能期限の制限を受けません
                </p>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">強制キャンセル (Q013/Q014)</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={adminCancelReservationAction.bind(null, rsv.id)} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reason">キャンセル理由</Label>
                  <select
                    id="reason"
                    name="reason"
                    required
                    defaultValue="company"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="customer">生徒都合（チケットは設定ポリシー通り）</option>
                    <option value="company">弊社都合（チケット全額返却）</option>
                    <option value="instructor">講師都合 (Q014: チケット消化なし)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note">メモ</Label>
                  <Textarea id="note" name="note" rows={2} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="refund" defaultChecked />
                  half_refund_fee の場合に Stripe Refund を実行する
                </label>
                <Button type="submit" variant="destructive" className="w-full">
                  キャンセルを確定
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {changes && changes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">変更履歴</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {changes.map((c, idx) => (
              <div key={idx} className="rounded-md border p-3">
                <div className="font-semibold">{c.change_type}</div>
                <div className="text-muted-foreground">
                  {new Date(c.created_at).toLocaleString('ja-JP')}
                </div>
                {c.note && <p className="mt-1">{c.note}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
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
