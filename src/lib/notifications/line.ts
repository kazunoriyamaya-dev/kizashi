/**
 * LINE Messaging API による Push 送信 (Q016)
 *
 * 設計:
 *  - LINE Bot Push API: https://api.line.me/v2/bot/message/push
 *  - Bearer LINE_CHANNEL_ACCESS_TOKEN
 *  - 1日のメッセージ数制限あり (アカウントタイプ依存)
 *  - 失敗時は status='failed' で記録
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { renderTemplate } from '@/lib/notifications/templates';
import { logger } from '@/lib/logger';

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

interface LinePushBody {
  to: string;
  messages: Array<{ type: 'text'; text: string }>;
}

async function sendLinePush(
  toUserId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN_missing' };
  }

  const body: LinePushBody = {
    to: toUserId,
    messages: [{ type: 'text', text: text.slice(0, 5000) }],
  };

  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, error: `${res.status}_${detail.slice(0, 100)}` };
  }
  return { ok: true };
}

/**
 * queued な line_notification_logs を limit 件まで送信
 */
export async function dispatchPendingLineMessages(limit = 50): Promise<{
  sent: number;
  failed: number;
}> {
  const admin = createSupabaseAdminClient();

  const { data: queued } = await admin
    .from('line_notification_logs')
    .select('id, to_line_user_id, template, payload')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!queued || queued.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const row of queued) {
    if (!row.to_line_user_id) {
      await admin
        .from('line_notification_logs')
        .update({
          status: 'failed',
          error_message: 'no_to_line_user_id',
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      failed++;
      continue;
    }
    const content = renderTemplate(row.template, (row.payload as Record<string, unknown>) ?? {});
    const result = await sendLinePush(row.to_line_user_id, content.lineText);

    if (result.ok) {
      await admin
        .from('line_notification_logs')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id);
      sent++;
    } else {
      logger.warn('line push failed', { code: result.error });
      await admin
        .from('line_notification_logs')
        .update({
          status: 'failed',
          error_message: result.error?.slice(0, 500),
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      failed++;
    }
  }

  return { sent, failed };
}
