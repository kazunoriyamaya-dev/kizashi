/**
 * I008 講師メッセージ詳細
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getThreadWithMessages, markThreadAsRead } from '@/lib/messaging/threads';
import { MessageChat } from '@/components/messaging/message-chat';

export default async function InstructorMessageThreadPage({
  params,
}: {
  params: { threadId: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const result = await getThreadWithMessages(params.threadId, 'instructor', me.userId);
  if ('error' in result) {
    notFound();
  }

  await markThreadAsRead(params.threadId, 'instructor');

  const { thread, messages } = result;
  const counterpart =
    thread.threadType === 'instructor_customer'
      ? `${thread.customerName ?? '–'}（保護者）`
      : '管理者';

  return (
    <div className="space-y-4">
      <Link href="/instructor/messages" className="text-sm text-muted-foreground underline">
        ← 一覧へ戻る
      </Link>
      <div>
        <h1 className="text-xl font-bold">{counterpart} とのメッセージ</h1>
      </div>

      <MessageChat
        threadId={thread.id}
        currentProfileId={me.userId}
        currentRole="instructor"
        messages={messages}
      />
    </div>
  );
}
