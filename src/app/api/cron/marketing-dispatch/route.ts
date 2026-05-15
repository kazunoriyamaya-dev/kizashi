/**
 * /api/cron/marketing-dispatch
 *
 * マーケ自動化系の cron ジョブをまとめて回す:
 *  - 予約 SNS 投稿の publish
 *  - 予約 LINE ブロードキャストの publish
 *  - ステップメールの dispatch (next_send_at <= now())
 *  - LP の publish / unpublish スケジュール反映
 *  - ブログの publish スケジュール反映
 */
import { NextResponse, type NextRequest } from 'next/server';
import { isAuthorizedCron } from '@/lib/notifications/cron-auth';
import { dispatchScheduledSnsPosts } from '@/lib/marketing/sns/dispatch';
import { dispatchScheduledLineBroadcasts } from '@/lib/marketing/line/broadcast';
import { dispatchEmailSequences } from '@/lib/marketing/sequences/dispatch';
import { publishDueLandingPages } from '@/lib/marketing/landing-pages/scheduler';
import { publishDueBlogPosts } from '@/lib/marketing/blog/scheduler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const [sns, line, seq, lp, blog] = await Promise.all([
    dispatchScheduledSnsPosts(),
    dispatchScheduledLineBroadcasts(),
    dispatchEmailSequences(),
    publishDueLandingPages(),
    publishDueBlogPosts(),
  ]);

  return NextResponse.json({ ok: true, sns, line, seq, lp, blog });
}
