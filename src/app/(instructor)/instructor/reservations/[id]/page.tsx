/**
 * I003 講師予約詳細
 *
 * Q018 / RLS:
 *  - 顧客個人情報は予約に必要な範囲のみ表示
 *  - 子供は名前・カナのみ
 *  - 対面の場合のみ住所表示
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_LABELS, type Category } from '@/types';
import { formatJPY } from '@/lib/utils';

export default async function InstructorReservationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();

  const { data: r } = await supabase
    .from('reservations')
    .select(
      `id, start_at, end_at, category, status, delivery_type, reservation_type,
       designation_fee, google_meet_url, pair_participants,
       cancel_reason, cancel_note,
       children!reservations_child_id_fkey ( name, kana ),
       customers!reservations_customer_id_fkey ( parent_name ),
       addresses!reservations_location_address_id_fkey (
         postal_code, prefecture, city, address_line, building
       ),
       travel_fees ( mode, amount, round_trip_distance_km, is_manual, manual_reason )`,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!r) notFound();

  const travelFee = r.travel_fees?.[0];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/instructor" className="text-sm text-muted-foreground underline">
          ← 一覧へ戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold">予約詳細</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>予約情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="ステータス" value={<Badge variant="outline">{r.status}</Badge>} />
            <Row
              label="種別"
              value={
                r.reservation_type === 'trial' ? (
                  <Badge variant="warning">体験</Badge>
                ) : (
                  <Badge variant="outline">通常</Badge>
                )
              }
            />
            <Row label="開始" value={new Date(r.start_at).toLocaleString('ja-JP')} />
            <Row label="終了" value={new Date(r.end_at).toLocaleString('ja-JP')} />
            <Row label="カテゴリ" value={CATEGORY_LABELS[r.category as Category]} />
            <Row label="形式" value={r.delivery_type === 'onsite' ? '対面' : 'オンライン'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>顧客情報（必要範囲のみ）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="保護者" value={r.customers?.parent_name ?? '–'} />
            <Row label="お子さん" value={r.children ? `${r.children.name}（${r.children.kana}）` : '–'} />
            {Array.isArray(r.pair_participants) && r.pair_participants.length > 0 && (
              <Row
                label="ペア参加者"
                value={
                  <ul className="list-disc pl-4 text-xs">
                    {(r.pair_participants as Array<{ name?: string; note?: string }>).map((p, i) => (
                      <li key={i}>
                        {p.name ?? '(child)'}
                        {p.note ? ` / ${p.note}` : ''}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
          </CardContent>
        </Card>

        {r.delivery_type === 'onsite' && (
          <Card>
            <CardHeader>
              <CardTitle>実施場所（対面のみ表示）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {r.addresses ? (
                <>
                  <Row label="郵便番号" value={r.addresses.postal_code ?? '–'} />
                  <Row label="都道府県" value={r.addresses.prefecture ?? '–'} />
                  <Row label="市区町村" value={r.addresses.city ?? '–'} />
                  <Row label="町域・番地" value={r.addresses.address_line} />
                  {r.addresses.building && <Row label="建物名" value={r.addresses.building} />}
                </>
              ) : (
                <p className="text-muted-foreground">場所未指定</p>
              )}
              {travelFee && (
                <div className="mt-3 border-t pt-3">
                  <div className="text-xs text-muted-foreground">交通費 (Q009: 切り上げ)</div>
                  <div className="text-lg font-semibold">{formatJPY(travelFee.amount ?? 0)}</div>
                  <div className="text-xs text-muted-foreground">
                    {travelFee.mode === 'car' && travelFee.round_trip_distance_km != null
                      ? `${travelFee.round_trip_distance_km} km × 30円/km (往復)`
                      : '電車運賃'}
                    {travelFee.is_manual && '（手動入力）'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {r.delivery_type === 'online' && (
          <Card>
            <CardHeader>
              <CardTitle>オンライン会議</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {r.google_meet_url ? (
                <a
                  href={r.google_meet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Google Meet で参加
                </a>
              ) : (
                <p className="text-muted-foreground">Meet URL は未発行です</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>金額内訳</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="指名料 (Q023)" value={formatJPY(r.designation_fee ?? 0)} />
          {travelFee && r.delivery_type === 'onsite' && (
            <Row label="交通費" value={formatJPY(travelFee.amount ?? 0)} />
          )}
          {r.cancel_reason && (
            <>
              <Row label="キャンセル理由" value={r.cancel_reason} />
              {r.cancel_note && <Row label="メモ" value={r.cancel_note} />}
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
