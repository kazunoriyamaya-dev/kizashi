/**
 * GET /api/cron/dispatch-notifications
 *
 * Vercel Cron から呼ばれ、queued な通知を batch 送信する
 * - dispatchPendingEmails / dispatchPendingLineMessages / dispatchPendingPush を並列実行
 * - 各 limit 50/50/100
 */
import { NextResponse, type NextRequest } from 'next/server';
import { isAuthorizedCron } from '@/lib/notifications/cron-auth';
import { dispatchPendingEmails } from '@/lib/notifications/email';
import { dispatchPendingLineMessages } from '@/lib/notifications/line';
import { dispatchPendingPush } from '@/lib/notifications/push';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const [email, line, push] = await Promise.all([
    dispatchPendingEmails(50),
    dispatchPendingLineMessages(50),
    dispatchPendingPush(100),
  ]);

  return NextResponse.json({ email, line, push });
}
