/**
 * マーケ Attribution (新規顧客獲得 ファネル) ヘルパー
 *
 *  - recordLeadAttribution(): 購読フォーム送信時に流入源スナップショットを保存
 *  - syncAttribution(): 既存 customers / reservations / payments と紐付けて
 *                       trial_reserved_at / trial_completed_at / first_paid_at を更新
 *                       (cron バッチから定期実行)
 *  - fetchAcquisitionFunnel(): 管理画面表示用のファネル集計
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export type LeadSourceKind =
  | 'lp'
  | 'blog'
  | 'affiliate'
  | 'sns'
  | 'ad'
  | 'line'
  | 'direct'
  | 'referral'
  | 'unknown';

export interface AttributionInput {
  subscriberId: string;
  email: string;
  source: LeadSourceKind;
  landingPageId?: string | null;
  blogPostId?: string | null;
  snsPostId?: string | null;
  affiliateLinkId?: string | null;
  adCampaignId?: string | null;
  campaignId?: string | null;
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
  };
  referrer?: string | null;
}

/**
 * 購読フォーム submit 直後に呼び出し、attribution を保存する。
 * 既存レコードがあれば最初の流入源を保持し、UTM のみ最新で上書き。
 */
export async function recordLeadAttribution(input: AttributionInput): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('marketing_attribution')
    .select('id, lead_source_kind')
    .eq('email', input.email)
    .maybeSingle();

  if (existing) {
    // 既存: 最新の UTM だけ更新し、流入源は first-touch を保つ
    await admin
      .from('marketing_attribution')
      .update({
        utm_source: input.utm?.source ?? null,
        utm_medium: input.utm?.medium ?? null,
        utm_campaign: input.utm?.campaign ?? null,
        utm_content: input.utm?.content ?? null,
        referrer: input.referrer ?? null,
      })
      .eq('id', existing.id);
    return;
  }

  const { error } = await admin.from('marketing_attribution').insert({
    subscriber_id: input.subscriberId,
    email: input.email,
    lead_source_kind: input.source,
    landing_page_id: input.landingPageId ?? null,
    blog_post_id: input.blogPostId ?? null,
    sns_post_id: input.snsPostId ?? null,
    affiliate_link_id: input.affiliateLinkId ?? null,
    ad_campaign_id: input.adCampaignId ?? null,
    campaign_id: input.campaignId ?? null,
    utm_source: input.utm?.source ?? null,
    utm_medium: input.utm?.medium ?? null,
    utm_campaign: input.utm?.campaign ?? null,
    utm_content: input.utm?.content ?? null,
    referrer: input.referrer ?? null,
  });
  if (error) {
    logger.warn('recordLeadAttribution failed', { code: error.code });
  }
}

/**
 * cron から呼び出し、profile / 体験予約 / 顧客化 / 有料化を attribution に反映する。
 */
export async function syncAttribution(): Promise<{
  linked: number;
  trialReserved: number;
  trialCompleted: number;
  firstPaid: number;
}> {
  const admin = createSupabaseAdminClient();
  try {
    const { data, error } = await admin.rpc('fn_sync_marketing_attribution');
    if (error) {
      logger.error('fn_sync_marketing_attribution failed', { code: error.code });
      return { linked: 0, trialReserved: 0, trialCompleted: 0, firstPaid: 0 };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      linked: row?.linked ?? 0,
      trialReserved: row?.trial_reserved ?? 0,
      trialCompleted: row?.trial_completed ?? 0,
      firstPaid: row?.first_paid ?? 0,
    };
  } catch (e) {
    logger.error('syncAttribution exception', {
      message: e instanceof Error ? e.message.slice(0, 200) : 'unknown',
    });
    return { linked: 0, trialReserved: 0, trialCompleted: 0, firstPaid: 0 };
  }
}

export interface AcquisitionFunnel {
  windowDays: number;
  leads: number;
  profilesLinked: number;
  trialsReserved: number;
  trialsCompleted: number;
  firstPaid: number;
  firstPaidRevenueJpy: number;
  cvrLeadToTrial: number;
  cvrTrialToPaid: number;
  bySource: Array<{
    source: string;
    leads: number;
    trials: number;
    paid: number;
    revenueJpy: number;
  }>;
}

/**
 * 管理ダッシュボード用のファネル指標
 */
export async function fetchAcquisitionFunnel(windowDays = 30): Promise<AcquisitionFunnel> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60_000).toISOString();

  const { data, error } = await admin
    .from('marketing_attribution')
    .select(
      'lead_source_kind, lead_at, profile_linked_at, trial_reserved_at, trial_completed_at, first_paid_at, first_payment_jpy',
    )
    .gte('lead_at', since)
    .limit(10000);

  if (error || !data) {
    return {
      windowDays,
      leads: 0,
      profilesLinked: 0,
      trialsReserved: 0,
      trialsCompleted: 0,
      firstPaid: 0,
      firstPaidRevenueJpy: 0,
      cvrLeadToTrial: 0,
      cvrTrialToPaid: 0,
      bySource: [],
    };
  }

  const totals = {
    leads: data.length,
    profilesLinked: 0,
    trialsReserved: 0,
    trialsCompleted: 0,
    firstPaid: 0,
    revenueJpy: 0,
  };
  const sources = new Map<
    string,
    { leads: number; trials: number; paid: number; revenueJpy: number }
  >();
  for (const r of data) {
    if (r.profile_linked_at) totals.profilesLinked++;
    if (r.trial_reserved_at) totals.trialsReserved++;
    if (r.trial_completed_at) totals.trialsCompleted++;
    if (r.first_paid_at) {
      totals.firstPaid++;
      totals.revenueJpy += r.first_payment_jpy ?? 0;
    }
    const key = r.lead_source_kind ?? 'unknown';
    const bucket = sources.get(key) ?? { leads: 0, trials: 0, paid: 0, revenueJpy: 0 };
    bucket.leads++;
    if (r.trial_reserved_at) bucket.trials++;
    if (r.first_paid_at) {
      bucket.paid++;
      bucket.revenueJpy += r.first_payment_jpy ?? 0;
    }
    sources.set(key, bucket);
  }

  return {
    windowDays,
    leads: totals.leads,
    profilesLinked: totals.profilesLinked,
    trialsReserved: totals.trialsReserved,
    trialsCompleted: totals.trialsCompleted,
    firstPaid: totals.firstPaid,
    firstPaidRevenueJpy: totals.revenueJpy,
    cvrLeadToTrial: totals.leads > 0 ? (totals.trialsReserved / totals.leads) * 100 : 0,
    cvrTrialToPaid:
      totals.trialsReserved > 0 ? (totals.firstPaid / totals.trialsReserved) * 100 : 0,
    bySource: Array.from(sources.entries())
      .map(([source, b]) => ({ source, ...b }))
      .sort((a, b) => b.leads - a.leads),
  };
}
