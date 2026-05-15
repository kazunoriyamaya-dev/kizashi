/**
 * アフィリエイト クリックトラッカー
 *
 * /r/[code] エンドポイントから呼び出され、
 *  - リンク取得
 *  - クリックログ + click_count++
 *  - UTM 付き redirect URL を返す
 */
import crypto from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface TrackClickInput {
  code: string;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}

export interface TrackedRedirect {
  ok: boolean;
  target?: string;
  reason?: string;
}

export async function trackAndResolve(input: TrackClickInput): Promise<TrackedRedirect> {
  const admin = createSupabaseAdminClient();

  const { data: link, error } = await admin
    .from('marketing_affiliate_links')
    .select('id, target_url, is_active, utm_source, utm_medium, utm_campaign, utm_content')
    .eq('code', input.code)
    .maybeSingle();

  if (error) {
    logger.error('affiliate tracker select error', { code: error.code });
    return { ok: false, reason: 'lookup_failed' };
  }
  if (!link || !link.is_active) {
    return { ok: false, reason: 'not_found_or_inactive' };
  }

  const ipHash = input.ip ? hashIp(input.ip) : null;

  try {
    await admin.rpc('fn_record_affiliate_click', {
      p_link_id: link.id,
      p_ip_hash: ipHash,
      p_user_agent: (input.userAgent ?? '').slice(0, 256),
      p_referrer: (input.referrer ?? '').slice(0, 512),
    });
  } catch (e) {
    logger.warn('fn_record_affiliate_click failed', {
      message: e instanceof Error ? e.message.slice(0, 100) : 'unknown',
    });
  }

  const url = appendUtm(link.target_url, {
    utm_source: link.utm_source,
    utm_medium: link.utm_medium,
    utm_campaign: link.utm_campaign,
    utm_content: link.utm_content,
  });

  return { ok: true, target: url };
}

function appendUtm(
  url: string,
  utm: {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
  },
): string {
  try {
    const u = new URL(url);
    if (utm.utm_source) u.searchParams.set('utm_source', utm.utm_source);
    if (utm.utm_medium) u.searchParams.set('utm_medium', utm.utm_medium);
    if (utm.utm_campaign) u.searchParams.set('utm_campaign', utm.utm_campaign);
    if (utm.utm_content) u.searchParams.set('utm_content', utm.utm_content);
    return u.toString();
  } catch {
    return url;
  }
}

function hashIp(ip: string): string {
  const salt = process.env.ENCRYPTION_KEY ?? 'kizashi-default-salt';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}
