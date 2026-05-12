/**
 * I005 講師プロフィール編集
 */
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { InstructorProfileForm } from '@/components/instructor/profile-form';
import {
  updateInstructorSelfAction,
  upsertInvoiceSettingsAction,
} from '@/lib/instructor/profile-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Category } from '@/types';

const ERROR_MESSAGES: Record<string, string> = {
  validation: '入力内容に不備があります。',
  invoice_validation: 'インボイス登録番号は T+13桁の数字で入力してください。',
  not_found: '講師レコードが見つかりません。',
  update_failed: '更新に失敗しました。',
};

export default async function EditInstructorProfilePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = createSupabaseServerClient();
  const { data: instructor } = await supabase
    .from('instructors')
    .select(
      `id, nickname, avatar_url, public_bio, contact_phone,
       categories, genres, transportation_mode,
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
          講師レコードが見つかりません。
        </CardContent>
      </Card>
    );
  }

  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;
  const invoice = instructor.invoice_settings?.[0];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/instructor/profile" className="text-sm text-muted-foreground underline">
            ← プロフィールへ戻る
          </Link>
          <h1 className="mt-2 text-2xl font-bold">プロフィール編集</h1>
        </div>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <InstructorProfileForm
        action={updateInstructorSelfAction}
        defaultValues={{
          nickname: instructor.nickname,
          avatar_url: instructor.avatar_url ?? '',
          public_bio: instructor.public_bio ?? '',
          contact_phone: instructor.contact_phone ?? '',
          categories: (instructor.categories as Category[]) ?? [],
          genres: (instructor.genres as string[]) ?? [],
          transportation_mode: instructor.transportation_mode as 'train' | 'car',
          base_address: instructor.addresses
            ? {
                postal_code: instructor.addresses.postal_code,
                prefecture: instructor.addresses.prefecture,
                city: instructor.addresses.city,
                address_line: instructor.addresses.address_line,
                building: instructor.addresses.building,
              }
            : undefined,
        }}
      />

      <div className="border-t pt-8">
        <h2 className="text-lg font-semibold">インボイス登録番号 (Q012)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          適格請求書発行事業者登録番号（T+13桁）。未登録の場合は空欄のまま保存してください。
        </p>
        <form action={upsertInvoiceSettingsAction} className="mt-4 space-y-4 rounded-lg border bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice_registration_no">登録番号</Label>
              <Input
                id="invoice_registration_no"
                name="invoice_registration_no"
                placeholder="T1234567890123"
                pattern="^T\\d{13}$"
                defaultValue={invoice?.invoice_registration_no ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registered_at">登録日</Label>
              <Input
                id="registered_at"
                name="registered_at"
                type="date"
                defaultValue={invoice?.registered_at ?? ''}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">メモ</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={invoice?.notes ?? ''} />
          </div>
          <div className="flex justify-end">
            <Button type="submit">インボイス情報を保存</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
