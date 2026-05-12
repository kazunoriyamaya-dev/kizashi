/**
 * A007 講師一覧
 *
 * 表示: ニックネーム / 本名 / カテゴリ / ランク / 移動手段 / ステータス / Calendar 連携 / 操作
 */
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { CATEGORY_LABELS, RANK_LABELS, type InstructorRank, type Category } from '@/types';

const RANK_VARIANT: Record<InstructorRank, 'rankGold' | 'rankSilver' | 'rankBronze' | 'rankRegular'> = {
  gold: 'rankGold',
  silver: 'rankSilver',
  bronze: 'rankBronze',
  regular: 'rankRegular',
};

const STATUS_VARIANT = {
  active: 'success',
  invited: 'warning',
  suspended: 'destructive',
  deleted: 'destructive',
} as const;

const STATUS_LABEL = {
  active: 'アクティブ',
  invited: '招待中',
  suspended: '停止中',
  deleted: '削除済',
} as const;

export default async function InstructorListPage({
  searchParams,
}: {
  searchParams: { created?: string; deleted?: string; invited?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: instructors } = await supabase
    .from('instructors')
    .select(
      'id, nickname, real_name, categories, rank, transportation_mode, status, contact_email, created_at, calendar_connections(id), stripe_connect_accounts(id, onboarding_completed)',
    )
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  const flash = searchParams.created
    ? '講師を登録しました'
    : searchParams.deleted
      ? '講師を削除しました'
      : searchParams.invited
        ? '招待メールを送信しました'
        : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">講師管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            講師の登録・編集・招待を行います
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/instructors/new">講師を新規登録</Link>
        </Button>
      </div>

      {flash && (
        <p className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {flash}
        </p>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ニックネーム</TableHead>
              <TableHead>本名</TableHead>
              <TableHead>カテゴリ</TableHead>
              <TableHead>ランク</TableHead>
              <TableHead>移動</TableHead>
              <TableHead>連携</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instructors?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  まだ講師が登録されていません
                </TableCell>
              </TableRow>
            )}
            {instructors?.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.nickname}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{i.real_name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(i.categories as Category[] | null)?.map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">
                        {CATEGORY_LABELS[c]}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={RANK_VARIANT[i.rank as InstructorRank]}>
                    {RANK_LABELS[i.rank as InstructorRank]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {i.transportation_mode === 'car' ? '車' : '電車'}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="flex flex-col gap-1">
                    <span className={i.calendar_connections?.length ? 'text-green-700' : 'text-muted-foreground'}>
                      Cal: {i.calendar_connections?.length ? '○' : '–'}
                    </span>
                    <span
                      className={
                        i.stripe_connect_accounts?.[0]?.onboarding_completed
                          ? 'text-green-700'
                          : 'text-muted-foreground'
                      }
                    >
                      Stripe: {i.stripe_connect_accounts?.[0]?.onboarding_completed ? '○' : '–'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[i.status as keyof typeof STATUS_VARIANT]}>
                    {STATUS_LABEL[i.status as keyof typeof STATUS_LABEL]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/instructors/${i.id}`}>詳細</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
