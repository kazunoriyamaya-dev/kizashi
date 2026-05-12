/**
 * A005 顧客一覧
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
import { Button } from '@/components/ui/button';

export default async function CustomerListPage() {
  const supabase = createSupabaseServerClient();
  const { data: customers } = await supabase
    .from('customers')
    .select(
      `id, parent_name, parent_kana, created_at,
       profiles!customers_profile_id_fkey ( email, status, display_name ),
       children ( id ),
       customer_tickets ( remaining_count, status )`,
    )
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">顧客管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">最新の200件まで表示</p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>保護者氏名</TableHead>
              <TableHead>メール</TableHead>
              <TableHead>子供数</TableHead>
              <TableHead className="text-right">残チケット合計</TableHead>
              <TableHead>登録日</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  まだ顧客が登録されていません
                </TableCell>
              </TableRow>
            )}
            {customers?.map((c) => {
              const remaining = (c.customer_tickets ?? [])
                .filter((t) => t.status === 'active')
                .reduce((sum, t) => sum + (t.remaining_count ?? 0), 0);
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.parent_name}
                    {c.parent_kana && (
                      <span className="ml-2 text-xs text-muted-foreground">{c.parent_kana}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{c.profiles?.email ?? '–'}</TableCell>
                  <TableCell>{c.children?.length ?? 0} 人</TableCell>
                  <TableCell className="text-right font-mono">{remaining}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString('ja-JP')}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/customers/${c.id}`}>詳細</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
