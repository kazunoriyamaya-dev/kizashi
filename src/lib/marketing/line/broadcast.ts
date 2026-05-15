/**
 * LINE 公式ブロードキャスト 配信モジュール
 *
 * 既存 src/lib/notifications/line.ts は 個別 push (to: <userId>) を扱う。
 * こちらは 全配信 (broadcast) / セグメント narrow cast を扱う。
 *
 *  - target_type='all'      : POST /v2/bot/message/broadcast
 *  - target_type='segment'  : audienceGroupId を作って /v2/bot/message/narrowcast
 *                              (MVP では audienceGroupId 解決は別途)
 *  - target_type='tag'      : narrowcast の demographic.filter を組み立て
 *
 * cron: marketing_line_broadcasts.status='scheduled' && scheduled_at <= now() を取得し送信。
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import type { LineMessageObject } from '@/lib/marketing/types';

const LINE_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast';
const LINE_NARROWCAST_URL = 'https://api.line.me/v2/bot/message/narrowcast';

async function sendBroadcast(messages: LineMessageObject[]): Promise<{ ok: boolean; error?: string; requestId?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN_missing' };

  const res = await fetch(LINE_BROADCAST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: messages.slice(0, 5) }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, error: `${res.status}_${detail.slice(0, 120)}` };
  }
  return { ok: true, requestId: res.headers.get('X-Line-Request-Id') ?? undefined };
}

async function sendNarrowcast(
  messages: LineMessageObject[],
  audienceGroupId?: string,
): Promise<{ ok: boolean; error?: string; requestId?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN_missing' };

  const body: Record<string, unknown> = {
    messages: messages.slice(0, 5),
  };
  if (audienceGroupId) {
    body.recipient = {
      type: 'audience',
      audienceGroupId: Number(audienceGroupId),
    };
  }

  const res = await fetch(LINE_NARROWCAST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, error: `${res.status}_${detail.slice(0, 120)}` };
  }
  return { ok: true, requestId: res.headers.get('X-Line-Request-Id') ?? undefined };
}

export async function dispatchScheduledLineBroadcasts(limit = 20): Promise<{
  sent: number;
  failed: number;
}> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: due, error } = await admin
    .from('marketing_line_broadcasts')
    .select('id, target_type, target_tag, messages, segment_id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error('dispatchScheduledLineBroadcasts: select failed', { code: error.code });
    return { sent: 0, failed: 0 };
  }
  if (!due || due.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const row of due) {
    const messages = (row.messages as LineMessageObject[] | null) ?? [];
    if (messages.length === 0) {
      await admin
        .from('marketing_line_broadcasts')
        .update({ status: 'failed', error_message: 'no_messages' })
        .eq('id', row.id);
      failed++;
      continue;
    }

    await admin
      .from('marketing_line_broadcasts')
      .update({ status: 'queued' })
      .eq('id', row.id)
      .eq('status', 'scheduled');

    const result =
      row.target_type === 'all'
        ? await sendBroadcast(messages)
        : await sendNarrowcast(messages);

    if (result.ok) {
      await admin
        .from('marketing_line_broadcasts')
        .update({
          status: 'published',
          sent_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', row.id);
      sent++;
    } else {
      await admin
        .from('marketing_line_broadcasts')
        .update({
          status: 'failed',
          error_message: result.error ?? 'unknown',
        })
        .eq('id', row.id);
      failed++;
    }
  }

  return { sent, failed };
}
