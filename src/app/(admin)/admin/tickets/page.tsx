/**
 * A011 チケット一覧
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
import { CATEGORY_LABELS, type Category } from '@/types';
import { formatJPY } from '@/lib/utils';

export default async function TicketListPage({
  searchParams,
}: {
  searchParams: { created?: string; deleted?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: tickets } = await supabase
    .from('tickets')
    .select(
      'id, name, category, price, session_count, valid_days, duration_min, lesson_format, sort_order, status',
    )
    .neq('status', 'deleted')
    .order('sort_order')
    .order('created_at', { ascending: false });

  const flash = searchParams.created
    ? 'チケットを登録しました'
    : searchParams.deleted
      ? 'チケットを削除しました'
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">チケット管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            販売中のチケット商品を管理します（Q023 共通チケットが基本）
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/tickets/new">チケットを新規登録</Link>
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
              <TableHead>名前</TableHead>
              <TableHead>カテゴリ</TableHead>
              <TableHead>レッスン</TableHead>
              <TableHead className="text-right">価格</TableHead>
              <TableHead className="text-right">回数</TableHead>
              <TableHead className="text-right">有効日数</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  まだチケットが登録されていません
                </TableCell>
              </TableRow>
            )}
            {tickets?.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>
                  {t.category ? (
                    CATEGORY_LABELS[t.category as Category]
                  ) : (
                    <Badge variant="outline">共通</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {t.duration_min}分 / {t.lesson_format === 'pair' ? 'ペア' : '単独'}
                </TableCell>
                <TableCell className="text-right font-mono">{formatJPY(t.price)}</TableCell>
                <TableCell className="text-right">{t.session_count} 回</TableCell>
                <TableCell className="text-right">{t.valid_days} 日</TableCell>
                <TableCell>
                  {t.status === 'active' ? (
                    <Badge variant="success">販売中</Badge>
                  ) : (
                    <Badge variant="secondary">停止中</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/tickets/${t.id}`}>編集</Link>
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
