/**
 * A010 講師編集
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { InstructorForm } from '@/components/admin/instructor-form';
import { updateInstructorAction } from '@/lib/admin/instructor-actions';
import type { Category, InstructorRank } from '@/types';

const ERROR_MESSAGES: Record<string, string> = {
  validation: '入力内容に不備があります。',
  update_failed: '更新に失敗しました。',
};

export default async function EditInstructorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: instructor } = await supabase
    .from('instructors')
    .select(
      `*,
       addresses!instructors_base_address_id_fkey (
         postal_code, prefecture, city, address_line, building
       )`,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!instructor) notFound();

  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/admin/instructors/${instructor.id}`}
            className="text-sm text-muted-foreground underline"
          >
            ← 詳細へ戻る
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{instructor.nickname} を編集</h1>
        </div>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <InstructorForm
        action={updateInstructorAction.bind(null, instructor.id)}
        defaultValues={{
          real_name: instructor.real_name,
          real_name_kana: instructor.real_name_kana,
          nickname: instructor.nickname,
          contact_email: instructor.contact_email ?? '',
          contact_phone: instructor.contact_phone ?? '',
          public_bio: instructor.public_bio ?? '',
          avatar_url: instructor.avatar_url ?? '',
          categories: (instructor.categories as Category[]) ?? [],
          genres: (instructor.genres as string[]) ?? [],
          rank: instructor.rank as InstructorRank,
          transportation_mode: instructor.transportation_mode as 'train' | 'car',
          priority: instructor.priority,
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
        submitLabel="保存"
        cancelHref={`/admin/instructors/${instructor.id}`}
      />
    </div>
  );
}
