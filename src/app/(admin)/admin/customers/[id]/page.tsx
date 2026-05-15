/**
 * A006 顧客詳細
 *
 * 表示: プロフィール / 子供情報 / 予約履歴 / 購入履歴 / 体験利用状況
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { formatJPY } from '@/lib/utils';
import { CATEGORY_LABELS, type Category } from '@/types';
import { openAdminCustomerThreadAction } from '@/lib/messaging/actions';
import { Button } from '@/components/ui/button';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const [
    { data: customer },
    { data: children },
    { data: tickets },
    { data: payments },
    { data: reservations },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select(`*, profiles!customers_profile_id_fkey ( email, display_name, status )`)
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('children')
      .select('id, name, kana, birth_date, trial_used')
      .eq('customer_id', params.id)
      .order('birth_date'),
    supabase
      .from('customer_tickets')
      .select(
        `id, remaining_count, initial_count, expires_at, status,
           tickets!customer_tickets_ticket_id_fkey ( name, lesson_format, duration_min )`,
      )
      .eq('customer_id', params.id)
      .order('purchased_at', { ascending: false }),
    supabase
      .from('payments')
      .select('id, amount, status, created_at, stripe_session_id')
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('reservations')
      .select(
        `id, start_at, end_at, category, status, delivery_type, reservation_type,
           instructors!reservations_instructor_id_fkey ( nickname )`,
      )
      .eq('customer_id', params.id)
      .order('start_at', { ascending: false })
      .limit(30),
  ]);

  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/customers" className="text-sm text-muted-foreground underline">
            ← 一覧へ戻る
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{customer.parent_name}</h1>
          <p className="text-sm text-muted-foreground">{customer.profiles?.email}</p>
        </div>
        <form action={openAdminCustomerThreadAction.bind(null, customer.id)}>
          <Button type="submit" variant="outline">
            メッセージを開く
          </Button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>保護者プロフィール</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="氏名" value={customer.parent_name} />
            <Row label="フリガナ" value={customer.parent_kana ?? '–'} />
            <Row label="メール" value={customer.profiles?.email ?? '–'} />
            <Row label="LINE 連携" value={customer.line_user_id ? '済' : '–'} />
            <Row label="Google 連携" value={customer.google_sub ? '済' : '–'} />
            <Row
              label="アカウント状態"
              value={<StatusBadge status={customer.profiles?.status ?? 'active'} />}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>子供情報 ({children?.length ?? 0} 名)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {children?.length === 0 ? (
              <p className="text-muted-foreground">未登録</p>
            ) : (
              children?.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.kana} / {new Date(c.birth_date).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                  {c.trial_used ? (
                    <Badge variant="secondary">体験済</Badge>
                  ) : (
                    <Badge variant="success">体験未使用</Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>保有チケット</CardTitle>
        </CardHeader>
        <CardContent>
          {tickets?.length === 0 ? (
            <p className="text-sm text-muted-foreground">保有チケットなし</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品</TableHead>
                  <TableHead className="text-right">残/総</TableHead>
                  <TableHead>有効期限</TableHead>
                  <TableHead>状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      {t.tickets?.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t.tickets?.duration_min}分・
                        {t.tickets?.lesson_format === 'pair' ? 'ペア' : '単独'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {t.remaining_count} / {t.initial_count}
                    </TableCell>
                    <TableCell>{new Date(t.expires_at).toLocaleDateString('ja-JP')}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === 'active'
                            ? 'success'
                            : t.status === 'expired'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {t.status}
                      </Badge>
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
          <CardTitle>予約履歴 (最新30件)</CardTitle>
        </CardHeader>
        <CardContent>
          {reservations?.length === 0 ? (
            <p className="text-sm text-muted-foreground">予約なし</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>開始時刻</TableHead>
                  <TableHead>講師</TableHead>
                  <TableHead>カテゴリ</TableHead>
                  <TableHead>形式</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.start_at).toLocaleString('ja-JP')}</TableCell>
                    <TableCell>{r.instructors?.nickname ?? '未割当'}</TableCell>
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
                        {r.status}
                      </Badge>
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
          <CardTitle>購入履歴 (最新20件)</CardTitle>
        </CardHeader>
        <CardContent>
          {payments?.length === 0 ? (
            <p className="text-sm text-muted-foreground">購入履歴なし</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>購入日</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>Stripe Session</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.created_at).toLocaleString('ja-JP')}</TableCell>
                    <TableCell className="text-right font-mono">{formatJPY(p.amount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === 'paid'
                            ? 'success'
                            : p.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.stripe_session_id}</TableCell>
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge variant="success">アクティブ</Badge>;
  if (status === 'invited') return <Badge variant="warning">招待中</Badge>;
  if (status === 'suspended') return <Badge variant="destructive">停止中</Badge>;
  return <Badge variant="destructive">削除済</Badge>;
}
