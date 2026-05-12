/**
 * A009 講師詳細
 *
 * 表示: プロフィール / 連絡先 / 自宅住所 / カテゴリ / ランク / Calendar 連携 / Stripe Connect / インボイス
 * 操作: 編集 / 招待メール送信 / 論理削除
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORY_LABELS, RANK_LABELS, type Category, type InstructorRank } from '@/types';
import { sendInstructorInviteAction, deleteInstructorAction } from '@/lib/admin/instructor-actions';
import { openAdminInstructorThreadAction } from '@/lib/messaging/actions';

const ERROR_MESSAGES: Record<string, string> = {
  invite_failed: '招待メール送信に失敗しました',
  delete_failed: '削除に失敗しました',
};

export default async function InstructorDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string; updated?: string; invited?: string; error?: string };
}) {
  const supabase = createSupabaseServerClient();

  const { data: instructor } = await supabase
    .from('instructors')
    .select(
      `*,
       addresses!instructors_base_address_id_fkey (
         postal_code, prefecture, city, address_line, building
       ),
       calendar_connections (
         google_account_email, last_synced_at, expires_at
       ),
       stripe_connect_accounts (
         stripe_account_id, onboarding_completed, charges_enabled, payouts_enabled
       ),
       invoice_settings (
         invoice_registration_no, registered_at
       )`,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!instructor) notFound();

  const flash = searchParams.created
    ? '講師を登録しました。続けて招待メールを送信できます。'
    : searchParams.updated
      ? 'プロフィールを更新しました。'
      : searchParams.invited
        ? '招待メールを送信しました。'
        : null;

  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/instructors" className="text-sm text-muted-foreground underline">
            ← 一覧へ戻る
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{instructor.nickname}</h1>
          <p className="text-sm text-muted-foreground">{instructor.real_name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={sendInstructorInviteAction.bind(null, instructor.id)}>
            <Button type="submit" variant="outline">招待メールを送信</Button>
          </form>
          <form action={openAdminInstructorThreadAction.bind(null, instructor.id)}>
            <Button type="submit" variant="outline">メッセージを開く</Button>
          </form>
          <Button asChild>
            <Link href={`/admin/instructors/${instructor.id}/edit`}>編集</Link>
          </Button>
          <form action={deleteInstructorAction.bind(null, instructor.id)}>
            <Button type="submit" variant="destructive">削除（論理）</Button>
          </form>
        </div>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="ステータス" value={<StatusBadge status={instructor.status} />} />
            <DetailRow label="ランク" value={<RankBadge rank={instructor.rank as InstructorRank} />} />
            <DetailRow label="移動手段" value={instructor.transportation_mode === 'car' ? '車（30円/km）' : '電車'} />
            <DetailRow label="優先度" value={String(instructor.priority)} />
            <DetailRow
              label="カテゴリ"
              value={
                <div className="flex flex-wrap gap-1">
                  {(instructor.categories as Category[] | null)?.map((c) => (
                    <Badge key={c} variant="outline">
                      {CATEGORY_LABELS[c]}
                    </Badge>
                  ))}
                </div>
              }
            />
            <DetailRow
              label="ジャンル"
              value={(instructor.genres as string[] | null)?.join(', ') || '–'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>連絡先（管理者のみ閲覧）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="本名" value={instructor.real_name} />
            <DetailRow label="フリガナ" value={instructor.real_name_kana} />
            <DetailRow label="メール" value={instructor.contact_email ?? '–'} />
            <DetailRow label="電話" value={instructor.contact_phone ?? '–'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>自宅住所（交通費計算用）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {instructor.addresses ? (
              <>
                <DetailRow label="郵便番号" value={instructor.addresses.postal_code ?? '–'} />
                <DetailRow label="都道府県" value={instructor.addresses.prefecture ?? '–'} />
                <DetailRow label="市区町村" value={instructor.addresses.city ?? '–'} />
                <DetailRow label="町域・番地" value={instructor.addresses.address_line ?? '–'} />
                <DetailRow label="建物名" value={instructor.addresses.building ?? '–'} />
              </>
            ) : (
              <p className="text-muted-foreground">未登録</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>外部連携</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow
              label="Googleカレンダー"
              value={
                instructor.calendar_connections?.[0]
                  ? `連携済 (${instructor.calendar_connections[0].google_account_email})`
                  : '未連携'
              }
            />
            <DetailRow
              label="Stripe Connect"
              value={
                instructor.stripe_connect_accounts?.[0]?.onboarding_completed
                  ? `完了 (${instructor.stripe_connect_accounts[0].stripe_account_id})`
                  : '未完了'
              }
            />
            <DetailRow
              label="インボイス番号"
              value={instructor.invoice_settings?.[0]?.invoice_registration_no ?? '–'}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge variant="success">アクティブ</Badge>;
  if (status === 'invited') return <Badge variant="warning">招待中</Badge>;
  if (status === 'suspended') return <Badge variant="destructive">停止中</Badge>;
  return <Badge variant="destructive">削除済</Badge>;
}

function RankBadge({ rank }: { rank: InstructorRank }) {
  const variant =
    rank === 'gold'
      ? 'rankGold'
      : rank === 'silver'
        ? 'rankSilver'
        : rank === 'bronze'
          ? 'rankBronze'
          : 'rankRegular';
  return <Badge variant={variant}>{RANK_LABELS[rank]}</Badge>;
}
