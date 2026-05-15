/**
 * ステップメール cron ディスパッチャ
 *
 * marketing_email_enrollments.next_send_at <= now() を取得し、
 * step_order に対応する step を取り出して Resend で送信。
 * 送信後、次の step が存在すれば next_step_order++ / next_send_at = now() + delay_minutes、
 * 無ければ completed_at をセットする。
 */
import { Resend } from 'resend';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

let cached: Resend | null = null;
function getResend(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

export async function dispatchEmailSequences(limit = 50): Promise<{
  sent: number;
  failed: number;
  completed: number;
}> {
  const admin = createSupabaseAdminClient();
  const resend = getResend();
  if (!resend) {
    logger.warn('RESEND_API_KEY 未設定。ステップメール配信をスキップ');
    return { sent: 0, failed: 0, completed: 0 };
  }

  const now = new Date().toISOString();
  const { data: due, error } = await admin
    .from('marketing_email_enrollments')
    .select(
      'id, subscriber_id, sequence_id, next_step_order, marketing_email_subscribers!inner(id, email, name, status)',
    )
    .lte('next_send_at', now)
    .is('completed_at', null)
    .is('cancelled_at', null)
    .order('next_send_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error('dispatchEmailSequences: select failed', { code: error.code });
    return { sent: 0, failed: 0, completed: 0 };
  }
  if (!due || due.length === 0) return { sent: 0, failed: 0, completed: 0 };

  let sent = 0;
  let failed = 0;
  let completed = 0;

  for (const enroll of due) {
    const subscriber = enroll.marketing_email_subscribers as unknown as {
      id: string;
      email: string;
      name: string | null;
      status: string;
    };
    if (!subscriber || subscriber.status !== 'active') {
      await admin
        .from('marketing_email_enrollments')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', enroll.id);
      continue;
    }

    // sequence メタ
    const { data: sequence } = await admin
      .from('marketing_email_sequences')
      .select('id, name, from_name, from_email, reply_to, is_active')
      .eq('id', enroll.sequence_id)
      .maybeSingle();
    if (!sequence || !sequence.is_active) {
      await admin
        .from('marketing_email_enrollments')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', enroll.id);
      continue;
    }

    // 現在の step を取得
    const { data: step } = await admin
      .from('marketing_email_sequence_steps')
      .select('id, step_order, delay_minutes, subject, body_text, body_html, is_active')
      .eq('sequence_id', enroll.sequence_id)
      .eq('step_order', enroll.next_step_order)
      .maybeSingle();

    if (!step) {
      // step なし -> 完了
      await admin
        .from('marketing_email_enrollments')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', enroll.id);
      completed++;
      continue;
    }

    if (!step.is_active) {
      // 無効ステップ -> スキップして次へ
      await advance(admin, enroll.id, enroll.sequence_id, enroll.next_step_order);
      continue;
    }

    // ログ insert -> 送信 -> ステータス更新
    const personalizedSubject = personalize(step.subject, subscriber);
    const personalizedText = personalize(step.body_text, subscriber);
    const personalizedHtml = step.body_html ? personalize(step.body_html, subscriber) : null;

    const { data: sendLog } = await admin
      .from('marketing_email_sends')
      .insert({
        subscriber_id: subscriber.id,
        sequence_id: enroll.sequence_id,
        step_id: step.id,
        to_email: subscriber.email,
        subject: personalizedSubject,
        body_text: personalizedText,
        body_html: personalizedHtml,
        status: 'queued',
      })
      .select('id')
      .single();

    try {
      const fromName = sequence.from_name ?? 'Kizashi';
      const fromEmail =
        sequence.from_email ?? process.env.EMAIL_FROM ?? 'noreply@kizashi.example.com';
      const result = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: subscriber.email,
        subject: personalizedSubject,
        text: personalizedText,
        html: personalizedHtml ?? undefined,
        replyTo: sequence.reply_to ?? undefined,
      });
      if (result.error) throw new Error(result.error.message);

      if (sendLog) {
        await admin
          .from('marketing_email_sends')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_id: result.data?.id ?? null,
          })
          .eq('id', sendLog.id);
      }

      await advance(admin, enroll.id, enroll.sequence_id, enroll.next_step_order);
      sent++;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown';
      logger.warn('step mail send failed', {
        sequenceId: enroll.sequence_id,
        step: step.step_order,
      });
      if (sendLog) {
        await admin
          .from('marketing_email_sends')
          .update({ status: 'failed', error_message: message.slice(0, 200) })
          .eq('id', sendLog.id);
      }
      // 次回再試行: 30 分後
      await admin
        .from('marketing_email_enrollments')
        .update({ next_send_at: new Date(Date.now() + 30 * 60_000).toISOString() })
        .eq('id', enroll.id);
      failed++;
    }
  }

  return { sent, failed, completed };
}

async function advance(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  enrollmentId: string,
  sequenceId: string,
  currentStepOrder: number,
) {
  const nextOrder = currentStepOrder + 1;
  const { data: nextStep } = await admin
    .from('marketing_email_sequence_steps')
    .select('step_order, delay_minutes')
    .eq('sequence_id', sequenceId)
    .eq('step_order', nextOrder)
    .maybeSingle();

  if (!nextStep) {
    await admin
      .from('marketing_email_enrollments')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', enrollmentId);
    return;
  }

  await admin
    .from('marketing_email_enrollments')
    .update({
      next_step_order: nextStep.step_order,
      next_send_at: new Date(Date.now() + (nextStep.delay_minutes ?? 0) * 60_000).toISOString(),
    })
    .eq('id', enrollmentId);
}

function personalize(text: string, subscriber: { email: string; name: string | null }): string {
  return text
    .replace(/\{\{\s*name\s*\}\}/g, subscriber.name ?? 'お客様')
    .replace(/\{\{\s*email\s*\}\}/g, subscriber.email);
}
