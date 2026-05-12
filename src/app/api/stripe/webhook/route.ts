/**
 * API021 POST /api/stripe/webhook
 *
 * Stripe Webhook 受信エンドポイント
 *
 * 設計書:
 *  - 署名検証必須 (SEC003)
 *  - 冪等性必須 (TC010)
 *  - middleware は除外（matcher で /api/stripe/webhook を除外済み）
 *  - 生バイナリ取得のため request.text() を使用
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleStripeWebhook } from '@/lib/stripe/webhook';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'signature_missing' }, { status: 400 });
  }

  const rawBody = await request.text();
  const result = await handleStripeWebhook(rawBody, signature);

  if (!result.ok) {
    logger.warn('stripe webhook returned error', {
      code: String(result.status),
      detail: result.error,
    });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ received: true });
}
