/**
 * C014 顧客プロフィール表示
 */
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default async function CustomerProfilePage({
  searchParams,
}: {
  searchParams: { updated?: string; child_added?: string; child_updated?: string; child_deleted?: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select(
      `id, parent_name, parent_kana, line_user_id, google_sub, primary_address_id,
       profiles!customers_profile_id_fkey ( email, phone, display_name ),
       children ( id, name, kana, birth_date, trial_used )`,
    )
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (!customer) return null;

  // primary_address は別 query
  const { data: primaryAddress } = customer.primary_address_id
    ? await supabase
        .from('addresses')
        .select('postal_code, prefecture, city, address_line, building')
        .eq('id', customer.primary_address_id)
        .maybeSingle()
    : { data: null };

  const flash =
    searchParams.updated
      ? 'プロフィールを更新しました'
      : searchParams.child_added
        ? 'お子様情報を追加しました'
        : searchParams.child_updated
          ? 'お子様情報を更新しました'
          : searchParams.child_deleted
            ? 'お子様情報を削除しました'
            : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">プロフィール</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            保護者情報・お子様情報・連絡先を管理します
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/mypage/profile/edit">編集</Link>
        </Button>
      </div>

      {flash && (
        <p className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {flash}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">保護者</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="お名前" value={customer.parent_name} />
          <Row label="フリガナ" value={customer.parent_kana ?? '–'} />
          <Row label="メール" value={customer.profiles?.email ?? '–'} />
          <Row label="電話" value={customer.profiles?.phone ?? '–'} />
          <Row
            label="ログイン方法"
            value={
              <div className="flex gap-1">
                {customer.google_sub && <Badge variant="outline">Google</Badge>}
                {customer.line_user_id && <Badge variant="outline">LINE</Badge>}
                {!customer.google_sub && !customer.line_user_id && '–'}
              </div>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">お子様 ({customer.children?.length ?? 0} 名)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {customer.children?.length === 0 ? (
            <div>
              <p className="text-muted-foreground">まだお子様情報が登録されていません</p>
              <Button asChild className="mt-3" size="sm">
                <Link href="/mypage/profile/edit">追加する</Link>
              </Button>
            </div>
          ) : (
            customer.children?.map((c) => (
              <div key={c.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.kana} ・ {new Date(c.birth_date).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                  {c.trial_used ? (
                    <Badge variant="secondary">体験済</Badge>
                  ) : (
                    <Badge variant="success">体験未使用</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">主住所（任意）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {primaryAddress ? (
            <>
              <Row label="郵便番号" value={primaryAddress.postal_code ?? '–'} />
              <Row
                label="住所"
                value={`${primaryAddress.prefecture ?? ''}${primaryAddress.city ?? ''}${primaryAddress.address_line}${primaryAddress.building ? ' ' + primaryAddress.building : ''}`}
              />
            </>
          ) : (
            <p className="text-muted-foreground">未登録（対面予約時に必要に応じて入力）</p>
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
