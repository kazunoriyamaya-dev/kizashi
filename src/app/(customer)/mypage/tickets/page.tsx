/**
 * C006 チケット購入画面
 *
 * - 保有チケット一覧 (active + 残数 > 0 のみ)
 * - 購入可能チケット一覧 (status=active)
 * - 各カードに「購入する」ボタン → Server Action 経由で Stripe Checkout に遷移
 */
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatJPY } from '@/lib/utils';
import { CATEGORY_LABELS, type Category } from '@/types';
import { startCheckoutAction } from '@/lib/customer/ticket-actions';

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: '決済をキャンセルしました。',
  customer_not_found: '顧客情報が見つかりませんでした。',
  missing_ticket: 'チケットを選択してください。',
  ticket_not_found: 'チケットが見つかりません。',
  ticket_inactive: 'このチケットは販売停止中です。',
  checkout_failed: '決済の開始に失敗しました。',
};

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { return_to?: string; error?: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer) return null;

  const [{ data: owned }, { data: catalog }] = await Promise.all([
    supabase
      .from('customer_tickets')
      .select(
        `id, remaining_count, initial_count, expires_at, status,
         tickets!customer_tickets_ticket_id_fkey ( name, duration_min, lesson_format, category )`,
      )
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .gt('remaining_count', 0)
      .order('expires_at', { ascending: true }),
    supabase
      .from('tickets')
      .select(
        'id, name, description, category, price, session_count, valid_days, duration_min, lesson_format',
      )
      .eq('status', 'active')
      .order('sort_order')
      .order('price'),
  ]);

  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;
  const returnTo = searchParams.return_to ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">チケット</h1>
        <p className="mt-1 text-sm text-muted-foreground">保有チケットの確認・新規購入ができます</p>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {returnTo && (
        <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          チケットを購入すると、購入完了後に予約フォームに自動で戻ります
        </p>
      )}

      {/* 保有チケット */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">保有チケット ({owned?.length ?? 0})</h2>
        {!owned || owned.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              利用可能なチケットがありません
            </CardContent>
          </Card>
        ) : (
          owned.map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-1 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t.tickets?.name}</span>
                  <Badge variant="success">
                    残{t.remaining_count}/{t.initial_count}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.tickets?.duration_min}分・
                  {t.tickets?.lesson_format === 'pair' ? 'ペア' : '単独'}・有効期限{' '}
                  {new Date(t.expires_at).toLocaleDateString('ja-JP')}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* 購入可能チケット */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">チケットを購入</h2>
        {!catalog || catalog.length === 0 ? (
          <p className="text-sm text-muted-foreground">販売中のチケットがありません</p>
        ) : (
          <div className="space-y-3">
            {catalog.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  {t.description && (
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {t.category ? (
                      <Badge variant="outline">{CATEGORY_LABELS[t.category as Category]}</Badge>
                    ) : (
                      <Badge variant="outline">共通</Badge>
                    )}
                    <Badge variant="outline">{t.duration_min}分</Badge>
                    <Badge variant="outline">{t.lesson_format === 'pair' ? 'ペア' : '単独'}</Badge>
                    <Badge variant="outline">{t.session_count}回分</Badge>
                    <Badge variant="outline">有効{t.valid_days}日</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-bold">{formatJPY(t.price)}</div>
                    <form action={startCheckoutAction}>
                      <input type="hidden" name="ticket_id" value={t.id} />
                      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
                      <Button type="submit">購入する</Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        決済は Stripe を通じて行われます。支払い情報は当アプリには保存されません。
      </p>
      <p className="text-xs text-muted-foreground">
        <Link href="/mypage" className="underline">
          マイページへ戻る
        </Link>
      </p>
    </div>
  );
}
