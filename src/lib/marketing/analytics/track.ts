/**
 * マーケ イベント トラッキング サーバー側
 *
 * /api/marketing/track エンドポイントで使用。
 * クライアントから page_view / cta_click / form_submit などの汎用イベントを受け取り、
 * marketing_analytics_events に積む。
 */
import crypto from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export interface TrackEventInput {
  eventName: string;
  campaignId?: string | null;
  landingPageId?: string | null;
  blogPostId?: string | null;
  snsPostId?: string | null;
  affiliateLinkId?: string | null;
  subscriberId?: string | null;
  profileId?: string | null;
  sessionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
  };
  properties?: Record<string, unknown>;
}

export async function trackEvent(input: TrackEventInput): Promise<{ ok: boolean }> {
  const admin = createSupabaseAdminClient();
  const ipHash = input.ip ? hashIp(input.ip) : null;
  const { error } = await admin.from('marketing_analytics_events').insert({
    event_name: input.eventName.slice(0, 80),
    campaign_id: input.campaignId ?? null,
    landing_page_id: input.landingPageId ?? null,
    blog_post_id: input.blogPostId ?? null,
    sns_post_id: input.snsPostId ?? null,
    affiliate_link_id: input.affiliateLinkId ?? null,
    subscriber_id: input.subscriberId ?? null,
    profile_id: input.profileId ?? null,
    session_id: input.sessionId ?? null,
    ip_hash: ipHash,
    user_agent: input.userAgent?.slice(0, 256) ?? null,
    referrer: input.referrer?.slice(0, 512) ?? null,
    utm_source: input.utm?.source ?? null,
    utm_medium: input.utm?.medium ?? null,
    utm_campaign: input.utm?.campaign ?? null,
    utm_content: input.utm?.content ?? null,
    properties: input.properties ?? {},
  });
  return { ok: !error };
}

function hashIp(ip: string): string {
  const salt = process.env.ENCRYPTION_KEY ?? 'kizashi-default-salt';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}
