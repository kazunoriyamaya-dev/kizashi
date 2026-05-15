/**
 * SNS 予約投稿の cron ディスパッチャ
 *
 * marketing_sns_posts.status='scheduled' かつ scheduled_at <= now() を取得し、
 * 各 channel の publish 関数を呼び出して結果を反映する。
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { publishToChannel } from '@/lib/marketing/sns/publishers';
import type { MarketingPostChannel } from '@/lib/marketing/sns/types';

export async function dispatchScheduledSnsPosts(limit = 30): Promise<{
  published: number;
  failed: number;
}> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: due, error } = await admin
    .from('marketing_sns_posts')
    .select('id, channel, body, hashtags, asset_ids')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error('dispatchScheduledSnsPosts: select failed', { code: error.code });
    return { published: 0, failed: 0 };
  }
  if (!due || due.length === 0) return { published: 0, failed: 0 };

  let published = 0;
  let failed = 0;

  for (const row of due) {
    // asset URL を解決
    const assetUrls: string[] = [];
    if (row.asset_ids && row.asset_ids.length > 0) {
      const { data: assets } = await admin
        .from('marketing_assets')
        .select('id, public_url')
        .in('id', row.asset_ids);
      if (assets) {
        for (const a of assets) {
          if (a.public_url) assetUrls.push(a.public_url);
        }
      }
    }

    // ロック取得目的に queued に上げる
    await admin
      .from('marketing_sns_posts')
      .update({ status: 'queued' })
      .eq('id', row.id)
      .eq('status', 'scheduled');

    const result = await publishToChannel({
      channel: row.channel as MarketingPostChannel,
      body: row.body,
      hashtags: row.hashtags ?? [],
      assetUrls,
    });

    if (result.ok) {
      await admin
        .from('marketing_sns_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          external_post_id: result.externalPostId ?? null,
          error_message: null,
        })
        .eq('id', row.id);
      published++;
    } else {
      await admin
        .from('marketing_sns_posts')
        .update({
          status: 'failed',
          error_message: result.error ?? 'unknown',
        })
        .eq('id', row.id);
      failed++;
    }
  }

  return { published, failed };
}
