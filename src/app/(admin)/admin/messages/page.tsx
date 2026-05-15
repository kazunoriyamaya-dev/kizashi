/**
 * A015 管理者メッセージ一覧 (F017 / Q015)
 *
 * - 全スレッドを監査閲覧可能（利用規約に明記済み）
 * - 顧客/講師にメッセージ送信可能
 */
import { getCurrentUser } from '@/lib/auth';
import { listThreadsForUser } from '@/lib/messaging/threads';
import { ThreadList } from '@/components/messaging/thread-list';

export default async function AdminMessagesPage() {
  const me = await getCurrentUser();
  if (!me) return null;

  const threads = await listThreadsForUser('admin', me.userId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">メッセージ監査</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          全ての会話を閲覧できます (Q015: 利用規約に明記済み)
        </p>
      </div>

      <p className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900">
        ⚠ プライバシー配慮: 業務上必要な範囲でのみ閲覧してください。 重要操作は audit_logs
        に記録されます。
      </p>

      <ThreadList threads={threads} basePath="/admin/messages" />
    </div>
  );
}
