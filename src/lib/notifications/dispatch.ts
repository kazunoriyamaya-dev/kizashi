/**
 * 通知 enqueue dispatcher
 *
 * 設計書 F039 + Q016:
 *  - イベント発火時に enqueueNotification(event, target, payload) を呼び出す
 *  - 3 チャネル（email/line/push）すべてに queued レコードを作成
 *  - 実送信は Cron バッチ (dispatchPendingEmails/LineMessages/Push)
 *
 * target:
 *  - profile_id を指定すれば profiles から to_email / customers.line_user_id を解決
 *  - admin: actor_role='admin' の profiles 全員に送信
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { renderTemplate } from '@/lib/notifications/templates';
import { logger } from '@/lib/logger';

export type NotificationEvent =
  | 'reservation_confirmed'
  | 'reservation_changed'
  | 'reservation_cancelled_by_customer'
  | 'reservation_cancelled_by_instructor'
  | 'reservation_cancelled_by_company'
  | 'trial_reservation_confirmed'
  | 'trial_pending_admin'
  | 'ticket_purchased'
  | 'ticket_expiring'
  | 'instructor_invite'
  | 'message_received'
  | 'payout_drafted'
  | 'admin_error_alert';

export interface NotificationTarget {
  /** 通知対象 profile_id (顧客/講師)。null なら admin 全員 */
  profileId?: string | null;
  /** 通知対象が admin の場合 true */
  toAdmins?: boolean;
  /** 配信チャネル */
  channels?: Array<'email' | 'line' | 'push'>;
}

const DEFAULT_CHANNELS: Array<'email' | 'line' | 'push'> = ['email', 'line', 'push'];

/**
 * 通知を queue に積む
 *
 * - email: profiles.email + テンプレート → email_notification_logs
 * - line:  customers.line_user_id がある場合のみ → line_notification_logs
 * - push:  push_subscriptions が active な場合 → push_notification_logs (subscription_id=null で profile 単位)
 */
export async function enqueueNotification(
  event: NotificationEvent,
  target: NotificationTarget,
  payload: Record<string, unknown>,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const channels = target.channels ?? DEFAULT_CHANNELS;
  const content = renderTemplate(event, payload);

  // 送信対象 profileId を解決
  const profileIds: string[] = [];
  if (target.toAdmins) {
    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('status', 'active');
    for (const a of admins ?? []) profileIds.push(a.id);
  }
  if (target.profileId) profileIds.push(target.profileId);

  if (profileIds.length === 0) {
    logger.warn('enqueueNotification: no target', { code: event });
    return;
  }

  for (const profileId of profileIds) {
    // email
    if (channels.includes('email')) {
      const { data: profile } = await admin
        .from('profiles')
        .select('email')
        .eq('id', profileId)
        .maybeSingle();
      if (profile?.email) {
        await admin.from('email_notification_logs').insert({
          target_profile_id: profileId,
          to_email: profile.email,
          template: event,
          subject: content.subject,
          payload,
          status: 'queued',
        });
      }
    }

    // line
    if (channels.includes('line')) {
      // customers.line_user_id を経由
      const { data: customer } = await admin
        .from('customers')
        .select('line_user_id')
        .eq('profile_id', profileId)
        .maybeSingle();
      if (customer?.line_user_id) {
        await admin.from('line_notification_logs').insert({
          target_profile_id: profileId,
          to_line_user_id: customer.line_user_id,
          template: event,
          payload,
          status: 'queued',
        });
      }
    }

    // push (subscription_id を null にして profile 単位で配信)
    if (channels.includes('push')) {
      // push_subscriptions が 1 つ以上 active であれば 1 件のレコードを作成
      const { count } = await admin
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .is('revoked_at', null);
      if ((count ?? 0) > 0) {
        await admin.from('push_notification_logs').insert({
          subscription_id: null,
          target_profile_id: profileId,
          template: event,
          title: content.pushTitle,
          body: content.pushBody,
          payload,
          status: 'queued',
        });
      }
    }
  }
}
