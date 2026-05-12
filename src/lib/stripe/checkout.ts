/**
 * Stripe Checkout Session 作成 (F036 / API020)
 *
 * 設計:
 *  - customers.stripe_customer_id を lazy 作成（無ければ Stripe Customer 作成 + DB 更新）
 *  - tickets.stripe_product_id / stripe_price_id を lazy sync（無ければ Stripe で Product/Price 作成 + DB 更新）
 *  - Checkout Session の metadata に customer_id / ticket_id を埋め込み
 *    → webhook で metadata から DB に反映
 *  - payment_intent_data.metadata にも複製（balance_transaction 経由のフェイルセーフ）
 *
 * 注: Stripe Product/Price は再利用するため、本番では管理者画面で事前に紐付ける運用を推奨。
 *     現実装は MVP として lazy sync (created_at 時に同期) を採用。
 */
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface CreateCheckoutSessionInput {
  customerId: string;
  customerEmail: string;
  ticketId: string;
  /** 成功時の redirect URL (Stripe が `?session_id={CHECKOUT_SESSION_ID}` を付与) */
  successUrl: string;
  cancelUrl: string;
  /** 予約フローから来た場合のリターン情報（成功画面で利用） */
  returnTo?: string;
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

/**
 * customers.stripe_customer_id を取得 or 新規作成
 */
async function ensureStripeCustomer(
  customerId: string,
  email: string,
): Promise<string> {
  const admin = createSupabaseAdminClient();
  const stripe = getStripe();

  const { data: customer } = await admin
    .from('customers')
    .select('stripe_customer_id, parent_name')
    .eq('id', customerId)
    .maybeSingle();

  if (customer?.stripe_customer_id) return customer.stripe_customer_id;

  const stripeCustomer = await stripe.customers.create({
    email,
    name: customer?.parent_name ?? undefined,
    metadata: { kizashi_customer_id: customerId },
  });

  await admin
    .from('customers')
    .update({ stripe_customer_id: stripeCustomer.id })
    .eq('id', customerId);

  return stripeCustomer.id;
}

/**
 * tickets.stripe_product_id / stripe_price_id を取得 or 新規作成
 */
async function ensureStripePrice(
  ticketId: string,
): Promise<{ priceId: string; ticketName: string; amount: number }> {
  const admin = createSupabaseAdminClient();
  const stripe = getStripe();

  const { data: ticket } = await admin
    .from('tickets')
    .select('id, name, description, price, stripe_product_id, stripe_price_id, status')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) throw new Error('ticket_not_found');
  if (ticket.status !== 'active') throw new Error('ticket_inactive');

  if (ticket.stripe_price_id) {
    return { priceId: ticket.stripe_price_id, ticketName: ticket.name, amount: ticket.price };
  }

  // Stripe Product 作成
  let productId = ticket.stripe_product_id;
  if (!productId) {
    const product = await stripe.products.create({
      name: ticket.name,
      description: ticket.description ?? undefined,
      metadata: { kizashi_ticket_id: ticket.id },
    });
    productId = product.id;
  }

  // Stripe Price 作成（JPY は税抜・税込どちらも整数指定）
  const price = await stripe.prices.create({
    product: productId,
    currency: 'jpy',
    unit_amount: ticket.price,
    metadata: { kizashi_ticket_id: ticket.id },
  });

  await admin
    .from('tickets')
    .update({ stripe_product_id: productId, stripe_price_id: price.id })
    .eq('id', ticket.id);

  return { priceId: price.id, ticketName: ticket.name, amount: ticket.price };
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CreateCheckoutSessionResult> {
  const stripe = getStripe();
  const stripeCustomerId = await ensureStripeCustomer(input.customerId, input.customerEmail);
  const { priceId, ticketName } = await ensureStripePrice(input.ticketId);

  // metadata に kizashi 側 ID を埋め込む
  const sessionMetadata: Stripe.MetadataParam = {
    kizashi_customer_id: input.customerId,
    kizashi_ticket_id: input.ticketId,
    ...(input.returnTo ? { return_to: input.returnTo } : {}),
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: sessionMetadata,
    payment_intent_data: {
      metadata: sessionMetadata, // PaymentIntent からも参照可能に
      description: `Kizashi チケット購入: ${ticketName}`,
    },
    locale: 'ja',
    allow_promotion_codes: false,
  });

  if (!session.url) {
    logger.error('stripe checkout session url missing', { code: session.id });
    throw new Error('checkout_url_missing');
  }

  // 事前 payment 行を pending で作成しておく（webhook 受信前の DB トレース用）
  const admin = createSupabaseAdminClient();
  await admin
    .from('payments')
    .insert({
      customer_id: input.customerId,
      ticket_id: input.ticketId,
      stripe_session_id: session.id,
      amount: 0, // webhook で確定
      currency: 'jpy',
      status: 'pending',
      metadata: { return_to: input.returnTo ?? null },
    });

  return { sessionId: session.id, checkoutUrl: session.url };
}
