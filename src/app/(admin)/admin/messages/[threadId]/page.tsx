/**
 * A016 管理者メッセージ詳細 (監査モード)
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { getThreadWithMessages, markThreadAsRead } from '@/lib/messaging/threads';
import { MessageChat } from '@/components/messaging/message-chat';

export default async function AdminMessageThreadPage({
  params,
}: {
  params: { threadId: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const result = await getThreadWithMessages(params.threadId, 'admin', me.userId);
  if ('error' in result) notFound();

  await markThreadAsRead(params.threadId, 'admin');

  // 監査閲覧の audit_logs を記録
  const admin = createSupabaseAdminClient();
  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'message_thread.viewed',
    target_table: 'message_threads',
    target_id: params.threadId,
  });

  const { thread, messages } = result;
  const counterpart =
    thread.threadType === 'admin_customer'
      ? `${thread.customerName ?? '–'}（顧客）`
      : thread.threadType === 'admin_instructor'
        ? `${thread.instructorNickname ?? '–'}（講師）`
        : `${thread.instructorNickname ?? '–'} ⇔ ${thread.customerName ?? '–'}`;

  return (
    <div className="space-y-4">
      <Link href="/admin/messages" className="text-sm text-muted-foreground underline">
        ← 一覧へ戻る
      </Link>
      <div>
        <h1 className="text-xl font-bold">{counterpart}</h1>
        <p className="text-xs text-muted-foreground">スレッド ID: {thread.id}</p>
      </div>

      <MessageChat
        threadId={thread.id}
        currentProfileId={me.userId}
        currentRole="admin"
        messages={messages}
        auditMode={thread.threadType === 'instructor_customer'}
      />
    </div>
  );
}
