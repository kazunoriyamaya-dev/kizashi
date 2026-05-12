/**
 * I007 講師メッセージ一覧
 *
 * - 自分が担当した顧客とのスレッド
 * - 管理者とのスレッド
 */
import { getCurrentUser } from '@/lib/auth';
import { listThreadsForUser } from '@/lib/messaging/threads';
import { ThreadList } from '@/components/messaging/thread-list';
import { Button } from '@/components/ui/button';
import { openInstructorAdminThreadAction } from '@/lib/messaging/actions';

export default async function InstructorMessagesPage() {
  const me = await getCurrentUser();
  if (!me) return null;

  const threads = await listThreadsForUser('instructor', me.userId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">メッセージ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          予約実績のある顧客 / 管理者とメッセージできます
        </p>
      </div>

      <form action={openInstructorAdminThreadAction}>
        <Button type="submit" variant="outline" className="w-full">
          管理者にメッセージを送る
        </Button>
      </form>

      <ThreadList threads={threads} basePath="/instructor/messages" />
    </div>
  );
}
