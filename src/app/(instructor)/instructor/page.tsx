/**
 * I002 講師予約一覧
 *
 * 自分が担当する予約を表示する。RLSにより自分の予約のみ取得可。
 */
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { getCurrentUser } from '@/lib/auth';

const STATUS_VARIANT = {
  confirmed: 'success',
  pending_payment: 'warning',
  changed: 'outline',
  cancelled: 'destructive',
  completed: 'outline',
  no_show: 'destructive',
  draft: 'secondary',
} as const;

export default async function InstructorReservationListPage() {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = createSupabaseServerClient();

  // 自分の instructor.id を取得
  const { data: instructor } = await supabase
    .from('instructors')
    .select('id')
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

  const now = new Date().toISOString();
  const { data: upcoming } = await supabase
    .from('reservations')
    .select(
      `id, start_at, end_at, category, status, delivery_type, reservation_type,
       customer_id`,
    )
    .eq('instructor_id', instructor.id)
    .gte('start_at', now)
    .order('start_at', { ascending: true })
    .limit(50);

  const { data: past } = await supabase
    .from('reservations')
    .select(
      `id, start_at, end_at, category, status, delivery_type, reservation_type,
       customer_id`,
    )
    .eq('instructor_id', instructor.id)
    .lt('start_at', now)
    .order('start_at', { ascending: false })
    .limit(30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">予約一覧</h1>
        <p className="mt-1 text-sm text-muted-foreground">自分が担当する予約を確認できます</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>今後の予約 ({upcoming?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming?.length === 0 ? (
            <p className="text-sm text-muted-foreground">予定なし</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>開始</TableHead>
                  <TableHead>カテゴリ</TableHead>
                  <TableHead>形式</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.start_at).toLocaleString('ja-JP')}</TableCell>
                    <TableCell>{CATEGORY_LABELS[r.category as Category]}</TableCell>
                    <TableCell>{r.delivery_type === 'onsite' ? '対面' : 'オンライン'}</TableCell>
                    <TableCell>
                      {r.reservation_type === 'trial' ? (
                        <Badge variant="warning">体験</Badge>
                      ) : (
                        <Badge variant="outline">通常</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status as keyof typeof STATUS_VARIANT]}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/instructor/reservations/${r.id}`}
                        className="text-sm text-primary underline"
                      >
                        詳細
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>過去の予約 (最新30件)</CardTitle>
        </CardHeader>
        <CardContent>
          {past?.length === 0 ? (
            <p className="text-sm text-muted-foreground">履歴なし</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>開始</TableHead>
                  <TableHead>カテゴリ</TableHead>
                  <TableHead>形式</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {past?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.start_at).toLocaleString('ja-JP')}</TableCell>
                    <TableCell>{CATEGORY_LABELS[r.category as Category]}</TableCell>
                    <TableCell>{r.delivery_type === 'onsite' ? '対面' : 'オンライン'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status as keyof typeof STATUS_VARIANT]}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/instructor/reservations/${r.id}`}
                        className="text-sm text-primary underline"
                      >
                        詳細
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
