/**
 * A003 予約管理一覧
 *
 * フィルタ: 期間 / ステータス
 */
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CATEGORY_LABELS, type Category, type ReservationStatus } from '@/types';

const STATUS_LABEL: Record<ReservationStatus, string> = {
  draft: '下書き',
  pending_payment: '決済待ち',
  confirmed: '確定',
  changed: '変更済',
  cancelled: 'キャンセル',
  completed: '完了',
  no_show: '無断欠席',
};

const STATUS_FILTERS = [
  { value: 'all', label: 'すべて' },
  { value: 'upcoming', label: '今後' },
  { value: 'past', label: '過去' },
  { value: 'cancelled', label: 'キャンセル' },
] as const;

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter = (searchParams.filter ?? 'upcoming') as 'all' | 'upcoming' | 'past' | 'cancelled';
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  let query = supabase
    .from('reservations')
    .select(
      `id, start_at, end_at, category, status, delivery_type, reservation_type, designation_fee,
       customers!reservations_customer_id_fkey ( parent_name ),
       instructors!reservations_instructor_id_fkey ( nickname ),
       children!reservations_child_id_fkey ( name )`,
    )
    .order('start_at', { ascending: filter === 'upcoming' });

  if (filter === 'upcoming') query = query.gte('start_at', now).neq('status', 'cancelled');
  else if (filter === 'past') query = query.lt('start_at', now);
  else if (filter === 'cancelled') query = query.eq('status', 'cancelled');

  const { data } = await query.limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">予約管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            予約の確認・強制変更・キャンセルが可能 (Q014 講師都合含む)
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link key={f.value} href={`/admin/reservations?filter=${f.value}`}>
            <Badge variant={filter === f.value ? 'default' : 'outline'} className="cursor-pointer">
              {f.label}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日時</TableHead>
              <TableHead>顧客</TableHead>
              <TableHead>お子様</TableHead>
              <TableHead>講師</TableHead>
              <TableHead>カテゴリ</TableHead>
              <TableHead>種別</TableHead>
              <TableHead>形式</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="w-20">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                  該当する予約はありません
                </TableCell>
              </TableRow>
            )}
            {data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {new Date(r.start_at).toLocaleString('ja-JP', {
                    month: '2-digit',
                    day: '2-digit',
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell className="text-sm">{r.customers?.parent_name ?? '–'}</TableCell>
                <TableCell className="text-sm">{r.children?.name ?? '–'}</TableCell>
                <TableCell className="text-sm">{r.instructors?.nickname ?? '未割当'}</TableCell>
                <TableCell className="text-sm">{CATEGORY_LABELS[r.category as Category]}</TableCell>
                <TableCell>
                  {r.reservation_type === 'trial' ? (
                    <Badge variant="warning">体験</Badge>
                  ) : (
                    <Badge variant="outline">通常</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {r.delivery_type === 'onsite' ? '対面' : 'オンライン'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.status === 'confirmed'
                        ? 'success'
                        : r.status === 'cancelled'
                          ? 'destructive'
                          : r.status === 'completed'
                            ? 'outline'
                            : 'secondary'
                    }
                  >
                    {STATUS_LABEL[r.status as ReservationStatus]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/reservations/${r.id}`}>詳細</Link>
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
