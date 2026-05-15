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
