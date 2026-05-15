/**
 * C015 顧客プロフィール編集
 *
 * 編集対象:
 *  - 保護者氏名・フリガナ・電話・メイン住所
 *  - 子供の追加・編集・削除（Q003 重複制約あり）
 */
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  updateCustomerProfileAction,
  addChildAction,
  updateChildAction,
  deleteChildAction,
} from '@/lib/customer/profile-actions';
import { ChildRow } from '@/components/customer/child-row';

const ERROR_MESSAGES: Record<string, string> = {
  validation: '入力内容に不備があります。',
  not_found: '顧客レコードが見つかりません。',
  update_failed: '更新に失敗しました。',
  child_validation: '子供情報の入力に不備があります。',
  child_duplicate: '同じ氏名・フリガナ・生年月日のお子様が既に登録されています。',
  child_create_failed: '追加に失敗しました。',
  child_update_failed: '更新に失敗しました。',
  child_delete_failed: '削除に失敗しました。',
  child_has_reservations: 'このお子様には既に予約があるため削除できません。',
};

export default async function EditCustomerProfilePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select(
      `id, parent_name, parent_kana, primary_address_id,
       profiles!customers_profile_id_fkey ( phone, display_name ),
       children ( id, name, kana, birth_date, notes, trial_used )`,
    )
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (!customer) return null;

  const { data: primaryAddress } = customer.primary_address_id
    ? await supabase
        .from('addresses')
        .select('postal_code, prefecture, city, address_line, building')
        .eq('id', customer.primary_address_id)
        .maybeSingle()
    : { data: null };

  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/mypage/profile" className="text-sm text-muted-foreground underline">
          ← プロフィールへ戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold">プロフィール編集</h1>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <form action={updateCustomerProfileAction}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">保護者情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="parent_name">お名前</Label>
                <Input
                  id="parent_name"
                  name="parent_name"
                  required
                  defaultValue={customer.parent_name}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="parent_kana">フリガナ</Label>
                <Input
                  id="parent_kana"
                  name="parent_kana"
                  defaultValue={customer.parent_kana ?? ''}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="display_name">表示名（任意）</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  defaultValue={customer.profiles?.display_name ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">電話番号</Label>
                <Input id="phone" name="phone" defaultValue={customer.profiles?.phone ?? ''} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">主住所（任意）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="primary_address.postal_code">郵便番号</Label>
                <Input
                  id="primary_address.postal_code"
                  name="primary_address.postal_code"
                  defaultValue={primaryAddress?.postal_code ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="primary_address.prefecture">都道府県</Label>
                <Input
                  id="primary_address.prefecture"
                  name="primary_address.prefecture"
                  defaultValue={primaryAddress?.prefecture ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="primary_address.city">市区町村</Label>
                <Input
                  id="primary_address.city"
                  name="primary_address.city"
                  defaultValue={primaryAddress?.city ?? ''}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary_address.address_line">町域・番地</Label>
              <Input
                id="primary_address.address_line"
                name="primary_address.address_line"
                defaultValue={primaryAddress?.address_line ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary_address.building">建物名（任意）</Label>
              <Input
                id="primary_address.building"
                name="primary_address.building"
                defaultValue={primaryAddress?.building ?? ''}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/mypage/profile">キャンセル</Link>
          </Button>
          <Button type="submit">保存</Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">お子様情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Q019: お子様情報は氏名・フリガナ・生年月日のみを保持します。 体験予約はお子様 1 人につき
            1 回まで利用可能です。
          </p>

          <div className="space-y-3">
            {customer.children?.map((c) => (
              <ChildRow
                key={c.id}
                child={c}
                updateAction={updateChildAction}
                deleteAction={deleteChildAction}
              />
            ))}
            {customer.children?.length === 0 && (
              <p className="text-sm text-muted-foreground">まだお子様情報が登録されていません</p>
            )}
          </div>

          <form action={addChildAction} className="rounded-md border-2 border-dashed p-3">
            <h3 className="mb-3 text-sm font-semibold">新しいお子様を追加</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-name">お名前</Label>
                <Input id="new-name" name="name" required maxLength={40} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-kana">フリガナ</Label>
                <Input id="new-kana" name="kana" required maxLength={40} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-birth">生年月日</Label>
                <Input id="new-birth" name="birth_date" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-notes">メモ（任意）</Label>
                <Input id="new-notes" name="notes" maxLength={200} />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="submit" size="sm">
                追加
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
