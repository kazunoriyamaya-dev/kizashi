/**
 * C012 顧客メッセージ一覧
 *
 * - 管理者とのスレッド (常に1)
 * - 予約済み講師とのスレッド (予約のたびに作成可能)
 */
import { getCurrentUser } from '@/lib/auth';
import { listThreadsForUser } from '@/lib/messaging/threads';
import { ThreadList } from '@/components/messaging/thread-list';
import { Button } from '@/components/ui/button';
import { openCustomerAdminThreadAction } from '@/lib/messaging/actions';

export default async function CustomerMessagesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const threads = await listThreadsForUser('customer', me.userId);
  const errorMsg = searchParams.error;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">メッセージ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理者・予約したことがある講師とメッセージできます
        </p>
      </div>

      {errorMsg === 'open_failed' && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          スレッドを開けませんでした。再度お試しください。
        </p>
      )}

      <form action={openCustomerAdminThreadAction}>
        <Button type="submit" variant="outline" className="w-full">
          管理者にメッセージを送る
        </Button>
      </form>

      <ThreadList threads={threads} basePath="/mypage/messages" />
    </div>
  );
}
