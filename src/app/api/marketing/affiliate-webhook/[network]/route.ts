/**
 * /api/marketing/affiliate-webhook/[network]
 *
 * 各 ASP の postback (CV 通知) を受け取り、marketing_affiliate_conversions に記録する。
 * MVP 段階では署名検証は ASP ごとに異なるため、共通の AFFILIATE_WEBHOOK_SECRET を ?secret= or
 * Authorization Bearer で受け取る簡易方式。
 *
 * 期待する JSON:
 *   {
 *     "code": "<affiliate link code>",     // 必須 (どのリンクからの CV か)
 *     "external_order_id": "..."           // 任意
 *     "commission_jpy": 1000,
 *     "status": "confirmed" | "pending" | "rejected",
 *     "raw": { ... }                       // 任意 (ASP の生 payload)
 *   }
 */
import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  code: z.string().min(1),
  external_order_id: z.string().max(120).optional().nullable(),
  commission_jpy: z.number().int().min(0).default(0),
  status: z.enum(['pending', 'confirmed', 'rejected']).default('pending'),
  raw: z.record(z.unknown()).optional(),
});

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.AFFILIATE_WEBHOOK_SECRET;
  if (!secret) {
    // 未設定なら本番では拒否、dev では許可
    return process.env.NODE_ENV !== 'production';
  }
  const header = req.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true;
  const query = req.nextUrl.searchParams.get('secret');
  if (query && safeEqual(query, secret)) return true;
  return false;
}

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export async function POST(req: NextRequest, { params }: { params: { network: string } }) {
  if (!verifySecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

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

  const admin = createSupabaseAdminClient();

  const { data: link } = await admin
    .from('marketing_affiliate_links')
    .select('id, program_id')
    .eq('code', parsed.data.code)
    .maybeSingle();

  if (!link) {
    logger.warn('affiliate webhook: unknown code', { network: params.network });
    return NextResponse.json({ ok: false, error: 'unknown_code' }, { status: 404 });
  }

  const isConfirmed = parsed.data.status === 'confirmed';

  const { error } = await admin.from('marketing_affiliate_conversions').insert({
    link_id: link.id,
    program_id: link.program_id ?? null,
    external_order_id: parsed.data.external_order_id ?? null,
    commission_jpy: parsed.data.commission_jpy,
    status: parsed.data.status,
    raw_payload: { network: params.network, ...(parsed.data.raw ?? {}) },
    confirmed_at: isConfirmed ? new Date().toISOString() : null,
  });

  if (error) {
    logger.error('affiliate conversion insert failed', { code: error.code });
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 });
  }

  if (isConfirmed) {
    const { data: current } = await admin
      .from('marketing_affiliate_links')
      .select('conversion_count')
      .eq('id', link.id)
      .maybeSingle();
    if (current) {
      await admin
        .from('marketing_affiliate_links')
        .update({ conversion_count: (current.conversion_count ?? 0) + 1 })
        .eq('id', link.id);
    }
  }

  return NextResponse.json({ ok: true });
}
