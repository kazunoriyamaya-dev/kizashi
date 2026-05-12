/**
 * GET /api/cron/notify-reservation-reminder
 *
 * 翌日の予約（confirmed/changed）に対してリマインダー通知
 */
import { NextResponse, type NextRequest } from 'next/server';
import { isAuthorizedCron } from '@/lib/notifications/cron-auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { enqueueNotification } from '@/lib/notifications/dispatch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const tomorrowStart = new Date();
  tomorrowStart.setHours(0, 0, 0, 0);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const { data: rsvs } = await admin
    .from('reservations')
    .select(
      `id, start_at,
       customers!reservations_customer_id_fkey ( profile_id )`,
    )
    .in('status', ['confirmed', 'changed'])
    .gte('start_at', tomorrowStart.toISOString())
    .lt('start_at', tomorrowEnd.toISOString());

  let enqueued = 0;
  for (const r of rsvs ?? []) {
    if (!r.customers?.profile_id) continue;
    await enqueueNotification(
      'reservation_confirmed', // template 流用、テンプレに「明日です」を入れたい場合は別 template 追加
      { profileId: r.customers.profile_id },
      { reservation_id: r.id, kind: 'reminder', start_at: r.start_at },
    );
    enqueued++;
  }
  return NextResponse.json({ enqueued });
}
