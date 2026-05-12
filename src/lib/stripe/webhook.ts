/**
 * Stripe Webhook 処理（API021 / F037 / TC009 / TC010）
 *
 * 設計:
 *  - 署名検証 (constructEvent)
 *  - stripe_webhook_events.event_id UNIQUE で冪等性保証
 *  - checkout.session.completed → fn_grant_customer_ticket でチケット付与
 *  - payment_intent.succeeded → balance_transaction で実手数料取得 (Q010) → fn_apply_payment_fee
 *  - charge.refunded → payments.status を refunded に
 */
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

/**
 * Webhook の生バイナリと署名を受け取り、イベントを検証して処理する
 */
export async function handleStripeWebhook(
  rawBody: string | Buffer,
  signature: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('STRIPE_WEBHOOK_SECRET 未設定');
    return { ok: false, status: 500, error: 'webhook_secret_missing' };
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    logger.warn('stripe signature verification failed', { code: (e as Error).message });
    return { ok: false, status: 400, error: 'signature_invalid' };
  }

  const admin = createSupabaseAdminClient();

  // 冪等性: event_id UNIQUE で1回のみ処理
  const { data: existing } = await admin
    .from('stripe_webhook_events')
    .select('id, processed_at')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existing?.processed_at) {
    return { ok: true, status: 200 };
  }

  // INSERT (UNIQUE 違反は別 webhook が同時受信した想定 → 後勝ちで return)
  const { error: insertErr } = await admin.from('stripe_webhook_events').insert({
    event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    api_version: event.api_version ?? null,
    payload: event as unknown as Record<string, unknown>,
  });
  if (insertErr && insertErr.code !== '23505') {
    logger.error('stripe_webhook_events insert failed', { code: insertErr.code });
    return { ok: false, status: 500, error: 'webhook_insert_failed' };
  }

  // ハンドリング
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        // その他のイベントはログのみ、未処理状態で残す
        logger.info?.('stripe webhook event ignored', { code: event.type });
    }

    await admin
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', event.id);

    return { ok: true, status: 200 };
  } catch (e) {
    const message = (e as Error).message;
    logger.error('stripe webhook handler failed', { code: event.type, detail: message });
    await admin
      .from('stripe_webhook_events')
      .update({ error_message: message })
      .eq('event_id', event.id);
    return { ok: false, status: 500, error: 'handler_failed' };
  }
}

/**
 * checkout.session.completed
 *  - metadata から kizashi_customer_id / kizashi_ticket_id を取得
 *  - fn_grant_customer_ticket で payments + customer_tickets を atomic 作成
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return; // 未確定セッションは無視
  }

  const customerId = session.metadata?.kizashi_customer_id;
  const ticketId = session.metadata?.kizashi_ticket_id;
  if (!customerId || !ticketId) {
    throw new Error('missing_metadata');
  }

  const amount = session.amount_total ?? 0;
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

  if (!paymentIntentId) throw new Error('missing_payment_intent');

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc('fn_grant_customer_ticket', {
    p_customer_id: customerId,
    p_ticket_id: ticketId,
    p_stripe_session_id: session.id,
    p_stripe_pi_id: paymentIntentId,
    p_amount: amount,
    p_currency: session.currency ?? 'jpy',
    p_metadata: (session.metadata as unknown as Record<string, unknown>) ?? {},
  });

  if (error) {
    logger.error('fn_grant_customer_ticket failed', { code: error.code, detail: error.message });
    throw new Error(`grant_failed:${error.message}`);
  }

  // 通知: 顧客のプロフィール ID を引いて enqueue
  const { data: cust } = await admin
    .from('customers')
    .select('profile_id')
    .eq('id', customerId)
    .maybeSingle();
  if (cust?.profile_id) {
    const { enqueueNotification } = await import('@/lib/notifications/dispatch');
    await enqueueNotification(
      'ticket_purchased',
      { profileId: cust.profile_id },
      { ticket_id: ticketId, amount, stripe_session_id: session.id },
    );
  }
}

/**
 * payment_intent.succeeded
 *  - balance_transaction を取得して実手数料を反映 (Q010)
 *  - latest_charge から手数料・net_amount を抽出
 */
async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const stripe = getStripe();

  // charge と balance_transaction を expand 取得
  let charge: Stripe.Charge | null = null;
  if (pi.latest_charge) {
    const chargeId =
      typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge.id;
    charge = await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] });
  }

  if (!charge || !charge.balance_transaction) {
    // balance_transaction がまだ確定していない場合は無視（後の charge.updated で再処理）
    return;
  }

  const balanceTx =
    typeof charge.balance_transaction === 'string'
      ? await stripe.balanceTransactions.retrieve(charge.balance_transaction)
      : charge.balance_transaction;

  // session_id を payment_intent.metadata.checkout_session_id から取れない場合があるため、
  // payment_intent_id で payments を検索
  const admin = createSupabaseAdminClient();
  const { data: payment } = await admin
    .from('payments')
    .select('id')
    .eq('stripe_payment_intent_id', pi.id)
    .maybeSingle();

  if (!payment) {
    // checkout.session.completed が先に届くため通常はここに来ない
    logger.warn('payment not found for payment_intent', { code: pi.id });
    return;
  }

  const { error } = await admin.rpc('fn_apply_payment_fee', {
    p_payment_id: payment.id,
    p_stripe_charge_id: charge.id,
    p_stripe_fee: balanceTx.fee,
    p_net_amount: balanceTx.net,
  });
  if (error) {
    throw new Error(`apply_fee_failed:${error.message}`);
  }
}

/**
 * charge.refunded
 *  - payments.status を refunded / partially_refunded に更新
 *  - 関連の customer_tickets は別途キャンセル処理（Phase 9 で）
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const admin = createSupabaseAdminClient();
  const refundedAmount = charge.amount_refunded ?? 0;
  const status = charge.refunded ? 'refunded' : 'partially_refunded';

  const { error } = await admin
    .from('payments')
    .update({
      status,
      refunded_amount: refundedAmount,
      refunded_at: new Date().toISOString(),
    })
    .eq('stripe_charge_id', charge.id);

  if (error) {
    throw new Error(`refund_update_failed:${error.message}`);
  }
}
