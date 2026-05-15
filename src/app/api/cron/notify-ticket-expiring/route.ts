/**
 * GET /api/cron/notify-ticket-expiring
 *
 * Q022: チケット有効期限切れの 30/14/7/1 日前に通知
 * (system_settings.ticket_expiry_notify_days で日数配列をカスタマイズ可能)
 *
 * 日次 9:00 (JST 想定) Cron
 */
import { NextResponse, type NextRequest } from 'next/server';
import { isAuthorizedCron } from '@/lib/notifications/cron-auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { enqueueNotification } from '@/lib/notifications/dispatch';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  // ticket_expiry_notify_days を取得
  const { data: settings } = await admin
    .from('system_settings')
    .select('ticket_expiry_notify_days')
    .maybeSingle();
  const days = settings?.ticket_expiry_notify_days ?? [30, 14, 7, 1];

  let totalEnqueued = 0;
  // 各日数ごとに「ちょうど N 日後に切れる active チケット」を抽出
  for (const d of days) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + d);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const { data: tickets } = await admin
      .from('customer_tickets')
      .select(
        `id, expires_at, remaining_count, customer_id,
         customers!customer_tickets_customer_id_fkey ( profile_id )`,
      )
      .eq('status', 'active')
      .gt('remaining_count', 0)
      .gte('expires_at', start.toISOString())
      .lt('expires_at', end.toISOString());

    if (!tickets) continue;

    for (const t of tickets) {
      const profileId = t.customers?.profile_id;
      if (!profileId) continue;

      try {
        await enqueueNotification(
          'ticket_expiring',
          { profileId },
          {
            customer_ticket_id: t.id,
            days_left: d,
            expires_at: t.expires_at,
            remaining_count: t.remaining_count,
          },
        );
        totalEnqueued++;
      } catch (e) {
        logger.warn('ticket expiring enqueue failed', { code: (e as Error).message });
      }
    }
  }

  return NextResponse.json({ enqueued: totalEnqueued, days });
}
