/**
 * 広告メトリクス 取得 / 同期
 *
 * 各 ad platform から日次の impressions / clicks / conversions / spend / revenue を取得し
 * marketing_ad_metrics_daily に upsert する。
 *
 * MVP では各 API のクライアント実装はスタブとし、credential が無い場合は no-op。
 * 本番運用時の TODO:
 *   - meta:   POST /{ad-account-id}/insights?fields=impressions,clicks,actions,spend
 *   - google: customers.searchStream / ad_group_ad daily report
 *   - tiktok: /open_api/v1.3/report/integrated/get/
 *
 * 既存の (status='active') ad_campaigns を対象にし、external_id 必須。
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export async function syncAdMetricsDaily(targetDate: Date = new Date()): Promise<{
  fetched: number;
  skipped: number;
}> {
  const admin = createSupabaseAdminClient();
  const dateStr = targetDate.toISOString().slice(0, 10);

  const { data: campaigns } = await admin
    .from('marketing_ad_campaigns')
    .select('id, platform, external_id')
    .eq('status', 'active')
    .not('external_id', 'is', null);

  if (!campaigns || campaigns.length === 0) return { fetched: 0, skipped: 0 };

  let fetched = 0;
  let skipped = 0;

  for (const c of campaigns) {
    const metrics = await fetchPlatformMetrics(c.platform, c.external_id!, dateStr);
    if (!metrics) {
      skipped++;
      continue;
    }
    await admin.from('marketing_ad_metrics_daily').upsert(
      {
        ad_campaign_id: c.id,
        date: dateStr,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        conversions: metrics.conversions,
        spend_jpy: metrics.spend_jpy,
        revenue_jpy: metrics.revenue_jpy,
        raw_payload: metrics.raw ?? {},
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'ad_campaign_id,date' },
    );
    fetched++;
  }

  return { fetched, skipped };
}

interface PlatformMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend_jpy: number;
  revenue_jpy: number;
  raw?: Record<string, unknown>;
}

async function fetchPlatformMetrics(
  platform: string,
  _externalId: string,
  _date: string,
): Promise<PlatformMetrics | null> {
  switch (platform) {
    case 'meta':
      if (!process.env.META_AD_ACCESS_TOKEN) {
        logger.warn('META_AD_ACCESS_TOKEN 未設定。Meta Ads 同期スキップ');
        return null;
      }
      return null; // 実装は本番運用時
    case 'google':
      if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
        logger.warn('GOOGLE_ADS_DEVELOPER_TOKEN 未設定。Google Ads 同期スキップ');
        return null;
      }
      return null;
    case 'tiktok':
      if (!process.env.TIKTOK_ADS_ACCESS_TOKEN) return null;
      return null;
    default:
      return null;
  }
}
