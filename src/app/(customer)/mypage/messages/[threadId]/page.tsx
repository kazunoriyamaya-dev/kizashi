/**
 * C013 顧客メッセージ詳細
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getThreadWithMessages, markThreadAsRead } from '@/lib/messaging/threads';
import { MessageChat } from '@/components/messaging/message-chat';

export default async function CustomerMessageThreadPage({
  params,
}: {
  params: { threadId: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const result = await getThreadWithMessages(params.threadId, 'customer', me.userId);
  if ('error' in result) {
    notFound();
  }

  // 既読更新
  await markThreadAsRead(params.threadId, 'customer');

  const { thread, messages } = result;
  const counterpart =
    thread.threadType === 'instructor_customer'
      ? `${thread.instructorNickname ?? '–'}先生`
      : '管理者';

  return (
    <div className="space-y-4">
      <Link href="/mypage/messages" className="text-sm text-muted-foreground underline">
        ← メッセージ一覧へ戻る
      </Link>
      <div>
        <h1 className="text-xl font-bold">{counterpart} とのメッセージ</h1>
      </div>

      <MessageChat
        threadId={thread.id}
        currentProfileId={me.userId}
        currentRole="customer"
        messages={messages}
      />
    </div>
  );
}
