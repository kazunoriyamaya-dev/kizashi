/**
 * /admin/marketing 配下で使うサーバー側クエリ
 *
 * admin 認証済みの Server Component から呼び出される前提。
 * RLS は admin all-access ポリシーが効いているのでサーバークライアント経由でも全件取れる。
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export interface MarketingDashboardKpi {
  campaigns: number;
  activeSequences: number;
  activeSubscribers: number;
  publishedLandingPages: number;
  publishedBlogPosts: number;
  scheduledSnsPosts: number;
  scheduledLineBroadcasts: number;
  activeAdCampaigns: number;
  thirtyDayClicks: number;
  thirtyDaySubscribers: number;
}

export async function fetchMarketingDashboardKpi(): Promise<MarketingDashboardKpi> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();

  const counts = await Promise.all([
    admin.from('marketing_campaigns').select('*', { count: 'exact', head: true }),
    admin
      .from('marketing_email_sequences')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    admin
      .from('marketing_email_subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    admin
      .from('marketing_landing_pages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    admin
      .from('marketing_blog_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    admin
      .from('marketing_sns_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled'),
    admin
      .from('marketing_line_broadcasts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled'),
    admin
      .from('marketing_ad_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    admin
      .from('marketing_affiliate_clicks')
      .select('*', { count: 'exact', head: true })
      .gte('clicked_at', since),
    admin
      .from('marketing_email_subscribers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since),
  ]);

  return {
    campaigns: counts[0].count ?? 0,
    activeSequences: counts[1].count ?? 0,
    activeSubscribers: counts[2].count ?? 0,
    publishedLandingPages: counts[3].count ?? 0,
    publishedBlogPosts: counts[4].count ?? 0,
    scheduledSnsPosts: counts[5].count ?? 0,
    scheduledLineBroadcasts: counts[6].count ?? 0,
    activeAdCampaigns: counts[7].count ?? 0,
    thirtyDayClicks: counts[8].count ?? 0,
    thirtyDaySubscribers: counts[9].count ?? 0,
  };
}

export async function listCampaigns(limit = 50) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listAssets(limit = 100) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('marketing_assets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listSnsPosts(limit = 50) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('marketing_sns_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listLineBroadcasts(limit = 50) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('marketing_line_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listSequences(limit = 50) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('marketing_email_sequences')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listLandingPages(limit = 50) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('marketing_landing_pages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listBlogPosts(limit = 50) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('marketing_blog_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listAffiliateLinks(limit = 100) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('marketing_affiliate_links')
    .select('*, marketing_affiliate_programs(name, network)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listAdCampaigns(limit = 50) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('marketing_ad_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface AnalyticsEngagementSummary {
  eventCount30: number;
  eventCount7: number;
  affiliateClick30: number;
  affiliateConversion30: number;
  emailSent30: number;
  emailFailed30: number;
  topEvents: Array<{ name: string; count: number }>;
  topPages: Array<{
    id: string;
    title: string;
    slug: string;
    view_count: number;
    conversion_count: number;
  }>;
}

/**
 * /admin/marketing/analytics 用のエンゲージメント指標を service-role で集計。
 * Server Component から直接 createSupabaseAdminClient を呼ばないために lib 側にまとめる
 * (ESLint no-restricted-imports に準拠)。
 */
export async function fetchAnalyticsEngagementSummary(): Promise<AnalyticsEngagementSummary> {
  const admin = createSupabaseAdminClient();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();

  const [
    eventCount30,
    eventCount7,
    affiliateClick30,
    affiliateConversion30,
    emailSent30,
    emailFailed30,
    topEventsRes,
    topPagesRes,
  ] = await Promise.all([
    admin
      .from('marketing_analytics_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since30),
    admin
      .from('marketing_analytics_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since7),
    admin
      .from('marketing_affiliate_clicks')
      .select('*', { count: 'exact', head: true })
      .gte('clicked_at', since30),
    admin
      .from('marketing_affiliate_conversions')
      .select('*', { count: 'exact', head: true })
      .gte('converted_at', since30),
    admin
      .from('marketing_email_sends')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since30)
      .eq('status', 'sent'),
    admin
      .from('marketing_email_sends')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since30)
      .eq('status', 'failed'),
    admin
      .from('marketing_analytics_events')
      .select('event_name')
      .gte('created_at', since30)
      .limit(1000),
    admin
      .from('marketing_landing_pages')
      .select('id, title, slug, view_count, conversion_count')
      .eq('status', 'published')
      .order('view_count', { ascending: false })
      .limit(10),
  ]);

  const counts = new Map<string, number>();
  for (const e of (topEventsRes.data ?? []) as Array<{ event_name: string }>) {
    counts.set(e.event_name, (counts.get(e.event_name) ?? 0) + 1);
  }
  const topEvents = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    eventCount30: eventCount30.count ?? 0,
    eventCount7: eventCount7.count ?? 0,
    affiliateClick30: affiliateClick30.count ?? 0,
    affiliateConversion30: affiliateConversion30.count ?? 0,
    emailSent30: emailSent30.count ?? 0,
    emailFailed30: emailFailed30.count ?? 0,
    topEvents,
    topPages: (topPagesRes.data ?? []) as AnalyticsEngagementSummary['topPages'],
  };
}

export async function fetchAdMetricsSummary(days = 30) {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const { data } = await admin
    .from('marketing_ad_metrics_daily')
    .select('impressions, clicks, conversions, spend_jpy, revenue_jpy')
    .gte('date', since);
  const sum = { impressions: 0, clicks: 0, conversions: 0, spend_jpy: 0, revenue_jpy: 0 };
  for (const r of data ?? []) {
    sum.impressions += r.impressions ?? 0;
    sum.clicks += r.clicks ?? 0;
    sum.conversions += r.conversions ?? 0;
    sum.spend_jpy += r.spend_jpy ?? 0;
    sum.revenue_jpy += r.revenue_jpy ?? 0;
  }
  return sum;
}
