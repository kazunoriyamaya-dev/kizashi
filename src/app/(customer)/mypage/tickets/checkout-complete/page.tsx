/**
 * Stripe Checkout 戻りページ
 *
 * 設計書 F037 / TC009:
 *  - フロント戻り URL だけでは予約確定しない（webhook が正）
 *  - サーバー側で payment.status を確認、paid なら成功表示
 *  - return_to があれば「予約フォームへ戻る」ボタンを出す
 *  - 未確定なら自動で 2 秒ごとにリフレッシュ
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PageProps {
  searchParams: { session_id?: string; return_to?: string };
}

export default async function CheckoutCompletePage({ searchParams }: PageProps) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const sessionId = searchParams.session_id;
  if (!sessionId) redirect('/mypage/tickets');

  const supabase = createSupabaseServerClient();
  const { data: payment } = await supabase
    .from('payments')
    .select(
      `id, status, amount, ticket_id,
       tickets!payments_ticket_id_fkey ( name )`,
    )
    .eq('stripe_session_id', sessionId)
    .maybeSingle();

  if (!payment) {
    return (
      <div className="space-y-4 py-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-yellow-600" />
        <h1 className="text-xl font-bold">決済情報を確認中…</h1>
        <p className="text-sm text-muted-foreground">
          このページは自動的に更新されます。しばらくお待ちください。
        </p>
        <meta httpEquiv="refresh" content="2" />
      </div>
    );
  }

  if (payment.status === 'pending') {
    return (
      <div className="space-y-4 py-8 text-center">
        <Clock className="mx-auto h-12 w-12 animate-spin text-primary" />
        <h1 className="text-xl font-bold">決済確認中…</h1>
        <p className="text-sm text-muted-foreground">
          Stripe からの確認通知を待っています（通常 1〜5秒）
        </p>
        <meta httpEquiv="refresh" content="2" />
      </div>
    );
  }

  if (payment.status === 'failed' || payment.status === 'refunded') {
    return (
      <div className="space-y-4 py-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">決済が完了しませんでした</h1>
        <p className="text-sm text-muted-foreground">時間をおいて再度お試しください。</p>
        <Button asChild>
          <Link href="/mypage/tickets">チケット画面へ戻る</Link>
        </Button>
      </div>
    );
  }

  // status === 'paid' or 'partially_refunded'
  const returnTo = searchParams.return_to;
  return (
    <div className="space-y-6 py-8 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
      <div>
        <h1 className="text-2xl font-bold">購入が完了しました</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          チケットがアカウントに付与されました
        </p>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6 text-left text-sm">
          <Row label="チケット" value={payment.tickets?.name ?? '–'} />
          <Row label="お支払い金額" value={`¥${payment.amount.toLocaleString()}`} />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {returnTo ? (
          <>
            <Button asChild className="w-full">
              <Link href={returnTo}>予約フォームへ戻る</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/mypage/tickets">チケット一覧</Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild className="w-full">
              <Link href="/mypage/instructors">講師を探す</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/mypage">マイページ</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
