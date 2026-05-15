/**
 * メッセージ監査ログ (Q015 admin 閲覧監査)
 *
 * Server Component から呼ぶための薄いラッパー。
 * admin Supabase client を直接呼ぶのは src/lib 配下のみ許可。
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export async function recordThreadViewedAudit(params: {
  actorProfileId: string;
  threadId: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('audit_logs').insert({
    actor_profile_id: params.actorProfileId,
    actor_role: 'admin',
    action: 'message_thread.viewed',
    target_table: 'message_threads',
    target_id: params.threadId,
  });
  if (error) {
    logger.warn('recordThreadViewedAudit failed', { code: error.code });
  }
}
