/**
 * C002 顧客ダッシュボード
 *
 * Q024: 兄弟姉妹で共有のチケット残数（家族合算）
 * 新規顧客（trial_used が false の子供あり）には体験予約導線を強調
 */
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { fetchCustomerDashboard } from '@/lib/customer/dashboard-queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Ticket, Sparkles, ArrowRight } from 'lucide-react';
import { CATEGORY_LABELS, type Category } from '@/types';
import { formatJPY } from '@/lib/utils';
import { publicEnv } from '@/lib/env';
import { PushSubscribeButton } from '@/components/customer/push-subscribe-button';

export default async function CustomerDashboardPage() {
  const me = await getCurrentUser();
  if (!me) return null;

  const dash = await fetchCustomerDashboard(me.userId);
  if (!dash) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          顧客レコードが見つかりません。再度ログインしてください。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">こんにちは、{me.displayName}さん</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dash.childrenCount > 0
              ? `お子様 ${dash.childrenCount} 名のレッスンを管理しています`
              : 'まずはお子様情報を登録してください'}
          </p>
        </div>
        {publicEnv.vapidPublicKey && (
          <PushSubscribeButton vapidPublicKey={publicEnv.vapidPublicKey} />
        )}
      </div>

      {dash.childrenCount === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">お子様情報を登録しましょう</p>
              <p className="mt-1 text-sm text-muted-foreground">
                予約には子供の情報が必要です（氏名・フリガナ・生年月日のみ）
              </p>
            </div>
            <Button asChild>
              <Link href="/mypage/profile/edit">登録する</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {dash.hasUnusedTrial && dash.childrenCount > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-1 font-semibold text-yellow-900">
                <Sparkles className="h-4 w-4" />
                体験レッスンが利用できます
              </p>
              <p className="mt-1 text-sm text-yellow-800">
                お子様 1 人につき 1 回まで無料で体験レッスンをお試しいただけます
              </p>
            </div>
            <Button asChild className="bg-yellow-600 hover:bg-yellow-700">
              <Link href="/mypage/trial-reservation">体験予約する</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              チケット残数（家族合算）
            </CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dash.totalRemainingTickets} 回</div>
            {dash.activeTickets.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {dash.activeTickets.map((t) => (
                  <li key={t.id} className="flex items-center justify-between">
                    <span>
                      {t.name}: {t.remaining} 回
                    </span>
                    <span>~{new Date(t.expiresAt).toLocaleDateString('ja-JP')}</span>
                  </li>
                ))}
              </ul>
            )}
            {dash.activeTickets.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                チケットを購入して予約しましょう
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">次回の予約</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dash.nextReservation ? (
              <div className="space-y-1">
                <div className="text-base font-bold">
                  {new Date(dash.nextReservation.startAt).toLocaleString('ja-JP', {
                    month: '2-digit',
                    day: '2-digit',
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">
                    {CATEGORY_LABELS[dash.nextReservation.category as Category]}
                  </Badge>
                  <Badge variant="outline">
                    {dash.nextReservation.deliveryType === 'onsite' ? '対面' : 'オンライン'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  講師: {dash.nextReservation.instructorNickname ?? '未割当'}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-2 px-0">
                  <Link href={`/mypage/reservations/${dash.nextReservation.id}`}>
                    詳細 <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">予定された予約はありません</p>
                <Button asChild size="sm" className="mt-3" variant="outline">
                  <Link href="/mypage/instructors">講師を探す</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">予約履歴</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dash.recentReservationsCount} 件</div>
            <Button asChild variant="ghost" size="sm" className="mt-2 px-0">
              <Link href="/mypage/reservations">
                予約一覧を見る <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">購入金額（累計）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatJPY(dash.totalPaymentAmount)}</div>
            <Button asChild variant="ghost" size="sm" className="mt-2 px-0">
              <Link href="/mypage/tickets">
                チケットを購入 <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
