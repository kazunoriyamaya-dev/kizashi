/**
 * メール送信 (Resend)
 *
 * 設計書 SEC003 + F039:
 *  - 個人情報をログに出さない
 *  - send 失敗時は status='failed' で記録、Cron バッチでリトライ
 */
import { Resend } from 'resend';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { renderTemplate } from '@/lib/notifications/templates';
import { logger } from '@/lib/logger';

let cached: Resend | null = null;
function getResend(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn('RESEND_API_KEY 未設定。メール送信をスキップ');
    return null;
  }
  cached = new Resend(key);
  return cached;
}

/**
 * queued な email_notification_logs を limit 件まで送信
 */
export async function dispatchPendingEmails(limit = 50): Promise<{
  sent: number;
  failed: number;
}> {
  const admin = createSupabaseAdminClient();
  const resend = getResend();
  if (!resend) return { sent: 0, failed: 0 };

  const from = process.env.EMAIL_FROM ?? 'noreply@kizashi.example.com';
  const replyTo = process.env.EMAIL_REPLY_TO;

  const { data: queued } = await admin
    .from('email_notification_logs')
    .select('id, to_email, template, subject, payload')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!queued || queued.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const row of queued) {
    if (!row.to_email) {
      await admin
        .from('email_notification_logs')
        .update({ status: 'failed', error_message: 'no_to_email', sent_at: new Date().toISOString() })
        .eq('id', row.id);
      failed++;
      continue;
    }
    const content = renderTemplate(row.template, (row.payload as Record<string, unknown>) ?? {});

    try {
      const result = await resend.emails.send({
        from,
        to: row.to_email,
        subject: row.subject || content.subject,
        text: content.text,
        html: content.html,
        replyTo,
      });
      await admin
        .from('email_notification_logs')
        .update({
          status: 'sent',
          provider_id: result.data?.id ?? null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      sent++;
    } catch (e) {
      logger.warn('email send failed', { code: (e as Error).message });
      await admin
        .from('email_notification_logs')
        .update({
          status: 'failed',
          error_message: (e as Error).message.slice(0, 500),
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      failed++;
    }
  }

  return { sent, failed };
}
