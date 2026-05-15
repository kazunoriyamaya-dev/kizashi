/**
 * I004 講師プロフィール（自身の表示用）
 */
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CATEGORY_LABELS, RANK_LABELS, type Category, type InstructorRank } from '@/types';

export default async function InstructorProfilePage({
  searchParams,
}: {
  searchParams: { updated?: string; invoice_updated?: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = createSupabaseServerClient();
  const { data: instructor } = await supabase
    .from('instructors')
    .select(
      `*,
       addresses!instructors_base_address_id_fkey (
         postal_code, prefecture, city, address_line, building
       ),
       invoice_settings ( invoice_registration_no, registered_at, notes )`,
    )
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (!instructor) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          講師レコードが見つかりません。管理者にお問い合わせください。
        </CardContent>
      </Card>
    );
  }

  const flash = searchParams.updated
    ? 'プロフィールを更新しました'
    : searchParams.invoice_updated
      ? 'インボイス登録番号を更新しました'
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">プロフィール</h1>
          <p className="mt-1 text-sm text-muted-foreground">公開情報・自宅住所・インボイス番号</p>
        </div>
        <Button asChild>
          <Link href="/instructor/profile/edit">編集</Link>
        </Button>
      </div>

      {flash && (
        <p className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {flash}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>公開情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="ニックネーム" value={instructor.nickname} />
            <Row
              label="ランク"
              value={
                <Badge
                  variant={
                    instructor.rank === 'gold'
                      ? 'rankGold'
                      : instructor.rank === 'silver'
                        ? 'rankSilver'
                        : instructor.rank === 'bronze'
                          ? 'rankBronze'
                          : 'rankRegular'
                  }
                >
                  {RANK_LABELS[instructor.rank as InstructorRank]}
                </Badge>
              }
            />
            <Row
              label="カテゴリ"
              value={
                <div className="flex flex-wrap justify-end gap-1">
                  {(instructor.categories as Category[] | null)?.map((c) => (
                    <Badge key={c} variant="outline">
                      {CATEGORY_LABELS[c]}
                    </Badge>
                  ))}
                </div>
              }
            />
            <Row
              label="ジャンル"
              value={(instructor.genres as string[] | null)?.join(', ') || '–'}
            />
            <Row
              label="移動手段"
              value={instructor.transportation_mode === 'car' ? '車（30円/km）' : '電車'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>連絡先・ステータス</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="本名" value={`${instructor.real_name}（管理者管理）`} />
            <Row label="メール" value={instructor.contact_email ?? '–'} />
            <Row label="電話" value={instructor.contact_phone ?? '–'} />
            <Row label="ステータス" value={instructor.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>自宅住所</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {instructor.addresses ? (
              <>
                <Row label="郵便番号" value={instructor.addresses.postal_code ?? '–'} />
                <Row label="都道府県" value={instructor.addresses.prefecture ?? '–'} />
                <Row label="市区町村" value={instructor.addresses.city ?? '–'} />
                <Row label="町域・番地" value={instructor.addresses.address_line ?? '–'} />
                <Row label="建物名" value={instructor.addresses.building ?? '–'} />
              </>
            ) : (
              <p className="text-muted-foreground">未登録</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>インボイス登録番号 (Q012)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="登録番号"
              value={instructor.invoice_settings?.[0]?.invoice_registration_no ?? '–'}
            />
            <Row
              label="登録日"
              value={
                instructor.invoice_settings?.[0]?.registered_at
                  ? new Date(instructor.invoice_settings[0].registered_at).toLocaleDateString(
                      'ja-JP',
                    )
                  : '–'
              }
            />
            <Row label="メモ" value={instructor.invoice_settings?.[0]?.notes ?? '–'} />
          </CardContent>
        </Card>
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
