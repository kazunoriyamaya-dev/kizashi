/**
 * /api/cron/marketing-ad-sync
 *
 * 各広告 platform から前日の日次メトリクスを取得し、marketing_ad_metrics_daily に upsert する。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { isAuthorizedCron } from '@/lib/notifications/cron-auth';
import { syncAdMetricsDaily } from '@/lib/marketing/ads/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const yesterday = new Date(Date.now() - 24 * 60 * 60_000);
  const result = await syncAdMetricsDaily(yesterday);
  return NextResponse.json({ ok: true, target: yesterday.toISOString().slice(0, 10), ...result });
}
