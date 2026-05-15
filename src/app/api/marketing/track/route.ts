/**
 * /api/marketing/track - 汎用イベント受信
 *
 * クライアント JS / SDK から POST されたイベントを marketing_analytics_events に記録する。
 * 認証は行わず、anon でも記録可能。スパム対策は今後 rate limit を検討。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { trackEvent } from '@/lib/marketing/analytics/track';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  event_name: z.string().min(1).max(80),
  campaign_id: z.string().uuid().optional().nullable(),
  landing_page_id: z.string().uuid().optional().nullable(),
  blog_post_id: z.string().uuid().optional().nullable(),
  sns_post_id: z.string().uuid().optional().nullable(),
  affiliate_link_id: z.string().uuid().optional().nullable(),
  subscriber_id: z.string().uuid().optional().nullable(),
  profile_id: z.string().uuid().optional().nullable(),
  session_id: z.string().max(80).optional().nullable(),
  utm: z
    .object({
      source: z.string().optional().nullable(),
      medium: z.string().optional().nullable(),
      campaign: z.string().optional().nullable(),
      content: z.string().optional().nullable(),
    })
    .optional(),
  properties: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = Schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;
  const ua = req.headers.get('user-agent');
  const ref = req.headers.get('referer');

  await trackEvent({
    eventName: parsed.data.event_name,
    campaignId: parsed.data.campaign_id ?? null,
    landingPageId: parsed.data.landing_page_id ?? null,
    blogPostId: parsed.data.blog_post_id ?? null,
    snsPostId: parsed.data.sns_post_id ?? null,
    affiliateLinkId: parsed.data.affiliate_link_id ?? null,
    subscriberId: parsed.data.subscriber_id ?? null,
    profileId: parsed.data.profile_id ?? null,
    sessionId: parsed.data.session_id ?? null,
    ip,
    userAgent: ua,
    referrer: ref,
    utm: parsed.data.utm,
    properties: parsed.data.properties,
  });

  return NextResponse.json({ ok: true });
}
