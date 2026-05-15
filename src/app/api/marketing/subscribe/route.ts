/**
 * /api/marketing/subscribe - LP からの購読フォーム受け口
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { subscribeAndEnroll } from '@/lib/marketing/sequences/enroll';
import { trackEvent } from '@/lib/marketing/analytics/track';
import { recordLeadAttribution, type LeadSourceKind } from '@/lib/marketing/attribution';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  email: z.string().email(),
  name: z.string().max(80).optional().nullable(),
  source: z.string().max(40).optional().nullable(),
  landingPageId: z.string().uuid().optional().nullable(),
  blogPostId: z.string().uuid().optional().nullable(),
  affiliateLinkId: z.string().uuid().optional().nullable(),
  snsPostId: z.string().uuid().optional().nullable(),
  adCampaignId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  utm: z
    .object({
      source: z.string().optional().nullable(),
      medium: z.string().optional().nullable(),
      campaign: z.string().optional().nullable(),
      content: z.string().optional().nullable(),
    })
    .optional(),
  sequenceIds: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

function inferLeadSource(body: z.infer<typeof Schema>, referer: string | null): LeadSourceKind {
  if (body.adCampaignId) return 'ad';
  if (body.affiliateLinkId) return 'affiliate';
  if (body.landingPageId) return 'lp';
  if (body.blogPostId) return 'blog';
  if (body.snsPostId) return 'sns';
  if (body.utm?.medium === 'cpc' || body.utm?.medium === 'ppc') return 'ad';
  if (body.utm?.medium === 'affiliate') return 'affiliate';
  if (body.utm?.medium === 'social' || body.utm?.medium === 'sns') return 'sns';
  if (body.utm?.medium === 'email') return 'direct';
  if (body.utm?.medium === 'line') return 'line';
  if (body.source === 'blog') return 'blog';
  if (body.source === 'lp') return 'lp';
  if (referer && !referer.includes(process.env.APP_URL ?? '')) return 'referral';
  return 'unknown';
}

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

  const referer = req.headers.get('referer');

  try {
    const result = await subscribeAndEnroll({
      email: parsed.data.email,
      name: parsed.data.name ?? undefined,
      source: parsed.data.source ?? 'lp',
      landingPageId: parsed.data.landingPageId ?? undefined,
      sequenceIds: parsed.data.sequenceIds,
      tags: parsed.data.tags,
      metadata: parsed.data.metadata,
    });

    // 新規顧客獲得ファネルの起点を記録 (first-touch attribution)
    await recordLeadAttribution({
      subscriberId: result.subscriberId,
      email: parsed.data.email,
      source: inferLeadSource(parsed.data, referer),
      landingPageId: parsed.data.landingPageId ?? null,
      blogPostId: parsed.data.blogPostId ?? null,
      snsPostId: parsed.data.snsPostId ?? null,
      affiliateLinkId: parsed.data.affiliateLinkId ?? null,
      adCampaignId: parsed.data.adCampaignId ?? null,
      campaignId: parsed.data.campaignId ?? null,
      utm: parsed.data.utm,
      referrer: referer,
    });

    // 汎用イベントログ
    await trackEvent({
      eventName: 'subscribe',
      landingPageId: parsed.data.landingPageId ?? null,
      blogPostId: parsed.data.blogPostId ?? null,
      snsPostId: parsed.data.snsPostId ?? null,
      affiliateLinkId: parsed.data.affiliateLinkId ?? null,
      campaignId: parsed.data.campaignId ?? null,
      subscriberId: result.subscriberId,
      properties: { isNew: result.isNew, enrolledSequences: result.enrolledSequenceIds.length },
      ip:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        null,
      userAgent: req.headers.get('user-agent'),
      referrer: referer,
      utm: parsed.data.utm,
    });

    return NextResponse.json({
      ok: true,
      subscriberId: result.subscriberId,
      enrolled: result.enrolledSequenceIds.length,
      isNew: result.isNew,
    });
  } catch (e) {
    logger.error('subscribe failed', { message: e instanceof Error ? e.message : 'unknown' });
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
