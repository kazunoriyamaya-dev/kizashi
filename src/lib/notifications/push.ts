/**
 * Web Push (VAPID) 通知 (Q016)
 *
 * 設計:
 *  - web-push ライブラリ + VAPID キー
 *  - push_subscriptions に endpoint/p256dh/auth を保存
 *  - dispatch 時に subscription_id 経由 or target_profile_id から全 sub に送信
 *  - 410 Gone / 404 → 購読を revoked_at で無効化
 */
import webpush from 'web-push';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { renderTemplate } from '@/lib/notifications/templates';
import { logger } from '@/lib/logger';

let configured = false;
function configureVapid(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:support@kizashi.example.com';
  if (!publicKey || !privateKey) {
    logger.warn('VAPID keys 未設定。Push 通知をスキップ');
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * 1 件の購読に Push 送信
 */
async function sendOne(
  subscription: { endpoint: string; p256dh: string; auth: string },
  title: string,
  body: string,
  url: string | undefined,
): Promise<{ ok: boolean; error?: string; gone?: boolean }> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({ title, body, url }),
      { TTL: 60 * 60 * 24 },
    );
    return { ok: true };
  } catch (e) {
    const err = e as { statusCode?: number; message?: string };
    const gone = err.statusCode === 404 || err.statusCode === 410;
    return { ok: false, error: err.message ?? 'unknown', gone };
  }
}

/**
 * queued な push_notification_logs を limit 件まで送信
 */
export async function dispatchPendingPush(limit = 100): Promise<{
  sent: number;
  failed: number;
  revoked: number;
}> {
  const admin = createSupabaseAdminClient();
  if (!configureVapid()) return { sent: 0, failed: 0, revoked: 0 };

  const { data: queued } = await admin
    .from('push_notification_logs')
    .select('id, subscription_id, target_profile_id, template, title, body, payload')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!queued || queued.length === 0) return { sent: 0, failed: 0, revoked: 0 };

  let sent = 0;
  let failed = 0;
  let revoked = 0;

  // subscription_id が個別指定されているもの → そのまま送信
  // 指定なし & target_profile_id あり → そのユーザーの全 active sub に展開
  for (const row of queued) {
    const content = renderTemplate(row.template, (row.payload as Record<string, unknown>) ?? {});
    const title = row.title || content.pushTitle;
    const body = row.body || content.pushBody;

    let subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> = [];

    if (row.subscription_id) {
      const { data: s } = await admin
        .from('push_subscriptions')
        .select('id, endpoint, p256dh_key, auth_key')
        .eq('id', row.subscription_id)
        .is('revoked_at', null)
        .maybeSingle();
      if (s) subs = [{ id: s.id, endpoint: s.endpoint, p256dh: s.p256dh_key, auth: s.auth_key }];
    } else if (row.target_profile_id) {
      const { data: list } = await admin
        .from('push_subscriptions')
        .select('id, endpoint, p256dh_key, auth_key')
        .eq('profile_id', row.target_profile_id)
        .is('revoked_at', null);
      subs = (list ?? []).map((s) => ({
        id: s.id,
        endpoint: s.endpoint,
        p256dh: s.p256dh_key,
        auth: s.auth_key,
      }));
    }

    if (subs.length === 0) {
      await admin
        .from('push_notification_logs')
        .update({
          status: 'failed',
          error_message: 'no_active_subscription',
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      failed++;
      continue;
    }

    let anySuccess = false;
    const errors: string[] = [];

    for (const s of subs) {
      const r = await sendOne(s, title, body, content.url);
      if (r.ok) {
        anySuccess = true;
      } else {
        errors.push(`${s.id}:${r.error}`);
        if (r.gone) {
          await admin
            .from('push_subscriptions')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', s.id);
          revoked++;
        }
      }
    }

    if (anySuccess) {
      await admin
        .from('push_notification_logs')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id);
      sent++;
    } else {
      await admin
        .from('push_notification_logs')
        .update({
          status: 'failed',
          error_message: errors.join('|').slice(0, 500),
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      failed++;
    }
  }

  return { sent, failed, revoked };
}
