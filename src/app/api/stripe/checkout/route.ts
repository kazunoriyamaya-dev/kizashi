/**
 * API020 POST /api/stripe/checkout
 *
 * 顧客がチケットを Stripe で購入するための Checkout Session を作成し、URL を返す。
 *
 * Body:
 *  - ticket_id: string (uuid) 必須
 *  - return_to: string (任意) - 購入完了後に戻るパス（例: 予約フロー）
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe/checkout';
import { logger } from '@/lib/logger';

const BodySchema = z.object({
  ticket_id: z.string().uuid(),
  return_to: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select(
      `id,
       profiles!customers_profile_id_fkey ( email )`,
    )
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (!customer || !customer.profiles?.email) {
    return NextResponse.json({ error: 'customer_not_found' }, { status: 404 });
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const successUrl = `${appUrl}/mypage/tickets/checkout-complete?session_id={CHECKOUT_SESSION_ID}${parsed.data.return_to ? `&return_to=${encodeURIComponent(parsed.data.return_to)}` : ''}`;
  const cancelUrl = `${appUrl}/mypage/tickets?error=cancelled`;

  try {
    const result = await createCheckoutSession({
      customerId: customer.id,
      customerEmail: customer.profiles.email,
      ticketId: parsed.data.ticket_id,
      successUrl,
      cancelUrl,
      returnTo: parsed.data.return_to ?? undefined,
    });
    return NextResponse.json({
      session_id: result.sessionId,
      checkout_url: result.checkoutUrl,
    });
  } catch (e) {
    const message = (e as Error).message;
    logger.error('stripe checkout create failed', { code: message });
    if (message === 'ticket_not_found' || message === 'ticket_inactive') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 });
  }
}
