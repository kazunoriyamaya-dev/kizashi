/**
 * /api/marketing/subscribe - LP からの購読フォーム受け口
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { subscribeAndEnroll } from '@/lib/marketing/sequences/enroll';
import { trackEvent } from '@/lib/marketing/analytics/track';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  email: z.string().email(),
  name: z.string().max(80).optional().nullable(),
  source: z.string().max(40).optional().nullable(),
  landingPageId: z.string().uuid().optional().nullable(),
  sequenceIds: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
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

    // CV としても記録 + LP の conversion_count をインクリメントは別 RPC 不要 (analytics で見る)
    await trackEvent({
      eventName: 'subscribe',
      landingPageId: parsed.data.landingPageId ?? null,
      subscriberId: result.subscriberId,
      properties: { isNew: result.isNew, enrolledSequences: result.enrolledSequenceIds.length },
      ip:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        null,
      userAgent: req.headers.get('user-agent'),
      referrer: req.headers.get('referer'),
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
